# -*- coding: utf-8 -*-
"""Проба видео-модели: наш готовый кадр -> ролик. Меряет, что вернулось."""
import base64, io, json, os, subprocess, sys, time, urllib.request
sys.path.insert(0, "/opt/amberry/rocket-panel/bot")
import catalog, места, prompts

БАЗА = "https://api.apimodels.app/v1"
КЛЮЧ = os.environ["APIMODELS_KEY"]
МОДЕЛЬ = sys.argv[1]
КАЧЕСТВО = sys.argv[2]
КНОПКА = sys.argv[3] if len(sys.argv) > 3 else "ac_above"
КАДР = sys.argv[4] if len(sys.argv) > 4 else "/root/proba/p_ph_above.png"
СЕК = int(sys.argv[5]) if len(sys.argv) > 5 else 5


def зов(путь, тело=None):
    з = urllib.request.Request(
        БАЗА + путь, data=json.dumps(тело).encode() if тело is not None else None,
        method="POST" if тело is not None else "GET",
        headers={"Authorization": "Bearer " + КЛЮЧ, "Content-Type": "application/json"})
    with urllib.request.urlopen(з, timeout=180) as р:
        return json.loads(р.read())


# Кадр уходит жпегом: пнг на два мегабайта в base64 раздувается до трёх,
# и запрос упирается в предел раньше, чем модель его увидит.
from PIL import Image
им = Image.open(КАДР).convert("RGB")
буф = io.BytesIO()
им.save(буф, "JPEG", quality=90)
кадр = "data:image/jpeg;base64," + base64.b64encode(буф.getvalue()).decode()
print("кадр %s -> %dx%d, %d КБ в запросе" % (os.path.basename(КАДР), им.size[0],
                                             им.size[1], len(кадр) // 1024))

сц = [s for s in catalog.все_сценарии() if s.key == КНОПКА][0]
сырой = сц.промпт(место=места.КАК_НА_ФОТО)
обяз = prompts.обязательные(сырой)
промпт = prompts.коротко(сырой, 2900 - len(обяз) - 2) + "\n\n" + обяз
стороны = "9:16"

# У каждой модели своё поле первого кадра, и угадывать нельзя: не то
# поле сервис молча выбрасывает и считает задачу текстом-в-видео —
# ролик выходит с чужой женщиной, а деньги списаны.
ВАРИАНТЫ = {
    "minimax-h3": [{"images": [кадр]}, {"first_frame_url": кадр}],
    "minimax-h3-lite": [{"images": [кадр]}],
    "wan-2.7-i2v-spicy": [{"image": кадр}, {"first_frame_url": кадр},
                          {"images": [кадр]}],
}
for добавка in ВАРИАНТЫ.get(МОДЕЛЬ, [{"images": [кадр]}]):
    тело = {"model": МОДЕЛЬ, "prompt": промпт, "resolution": КАЧЕСТВО,
            "ratio": стороны, "duration": СЕК}
    тело.update(добавка)
    поле = ",".join(добавка)
    т0 = time.time()
    try:
        о = зов("/video/generations", тело)
    except Exception as e:
        print("  поле %-16s запрос отбит: %s" % (поле, str(e)[:160]), flush=True)
        continue
    д = о.get("data") or о
    tid = д.get("taskId") or д.get("task_id") or д.get("id")
    print("  поле %-16s задача %s" % (поле, tid), flush=True)
    ссылка = None
    for _ in range(140):
        time.sleep(5)
        р = (зов("/video/generations?task_id=" + tid).get("data") or {})
        сс = [c for c in (р.get("resultUrls") or []) if c]
        if сс:
            ссылка = сс[0]; break
        if str(р.get("state") or "").lower() in ("failed", "error"):
            print("    ОТКАЗ: %s" % str(р.get("failMsg") or р)[:200], flush=True)
            break
    if not ссылка:
        continue
    путь = "/root/proba/v_%s_%s.mp4" % (МОДЕЛЬ, КАЧЕСТВО)
    subprocess.run(["curl", "-sL", "-A", "Mozilla/5.0", "-o", путь, ссылка], check=True)
    инфо = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=codec_type,codec_name,width,height,duration",
         "-of", "default=nw=1", путь], capture_output=True, text=True).stdout
    print("    готово за %d с · %d КБ · %s" % (
        time.time() - т0, os.path.getsize(путь) // 1024,
        " ".join(инфо.split())), flush=True)
    print("    модель в ответе: %s" % str(р.get("modelType") or р.get("model") or "-"),
          flush=True)
    break
