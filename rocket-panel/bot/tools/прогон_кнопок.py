# -*- coding: utf-8 -*-
"""Сквозной прогон кнопок через API: фото и видео. Ничего не шлёт наружу.
Пишет строку на кнопку в /root/proba/smoke.csv и кадры рядом."""
import base64, io, json, os, subprocess, sys, time, urllib.request
sys.path.insert(0, "/opt/amberry/rocket-panel/bot")
import catalog, места, prompts
from PIL import Image, ImageFilter, ImageStat

БАЗА = "https://api.apimodels.app/v1"
КЛЮЧ = os.environ["APIMODELS_KEY"]
МОДЕЛЬ_ФОТО = os.environ.get("PROBA_PHOTO", "qwen3-image")
МОДЕЛЬ_ВИДЕО = os.environ.get("PROBA_VIDEO", "minimax-h3-lite")
КАЧЕСТВО = os.environ.get("PROBA_QUALITY", "768p")
ЧТО = sys.argv[1] if len(sys.argv) > 1 else "фото"
КНОПКИ = sys.argv[2].split(",") if len(sys.argv) > 2 else None
ОТЧЁТ = os.environ.get("PROBA_REPORT", "/root/proba/smoke.csv")
ЛАПЛАС = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], scale=1)
ЦЕНА = {"qwen3-image": 0.039, "qwen3-image-pro": 0.079}


def резкость(им):
    return ImageStat.Stat(им.convert("L").filter(ЛАПЛАС)).stddev[0] ** 2


def зов(путь, тело=None):
    з = urllib.request.Request(
        БАЗА + путь, data=json.dumps(тело).encode() if тело is not None else None,
        method="POST" if тело is not None else "GET",
        headers={"Authorization": "Bearer " + КЛЮЧ, "Content-Type": "application/json"})
    with urllib.request.urlopen(з, timeout=180) as р:
        return json.loads(р.read())


def дождаться(вид, tid, попыток=100):
    for _ in range(попыток):
        time.sleep(5)
        р = (зов("/%s/generations?task_id=%s" % (вид, tid)).get("data") or {})
        сс = [c for c in (р.get("resultUrls") or []) if c]
        if сс:
            return сс[0], р
        if str(р.get("state") or "").lower() in ("failed", "error"):
            return None, р
    return None, {"state": "timeout"}


реф = "data:image/jpeg;base64," + base64.b64encode(
    io.open("/root/proba/ref.jpg", "rb").read()).decode()
# ПАРНОЙ КНОПКЕ НУЖНЫ ДВА РЕФЕРЕНСА, и это не придирка: промпт парной
# сцены говорит «первый с первого снимка, второй со второго». С одним
# снимком запрос уходит не тем, чем уходит у человека, и прогон
# проверял бы не то. Второй снимок — тот же, отражённый: для проверки
# формы запроса этого довольно, а судить о сходстве лиц всё равно не
# мне.
_вт = "/root/proba/ref2.jpg"
if not os.path.exists(_вт):
    Image.open("/root/proba/ref.jpg").transpose(
        Image.FLIP_LEFT_RIGHT).save(_вт, "JPEG", quality=90)
реф2 = "data:image/jpeg;base64," + base64.b64encode(
    io.open(_вт, "rb").read()).decode()
отчёт = io.open(ОТЧЁТ, "a", encoding="utf-8")
если_нет = lambda s: s if s else "-"
кнопки = [s for s in catalog.все_сценарии()
          if not catalog.скрыт(s.key) and s.наполнен
          and (not КНОПКИ or s.key in КНОПКИ)]
if ЧТО == "видео":
    кнопки = [s for s in кнопки if s.двухшаговый or s.job.startswith(("i2v", "sound"))]
else:
    кнопки = [s for s in кнопки if not s.двухшаговый]
print("прогон «%s»: кнопок %d · фото %s · видео %s %s"
      % (ЧТО, len(кнопки), МОДЕЛЬ_ФОТО, МОДЕЛЬ_ВИДЕО, КАЧЕСТВО), flush=True)
потрачено = 0.0
for сц in кнопки:
    имя = catalog.имя(сц.key, сц.title, "", "ru")
    сырой = (сц.prompt_фото(места.КАК_НА_ФОТО, None) if сц.двухшаговый
             else сц.промпт(место=места.КАК_НА_ФОТО))
    # Собираем ровно так, как собирает бот (см. bot._проход).
    промпт = prompts.под_предел(сырой, 2900)
    т0 = time.time()
    рефы = [реф, реф2] if сц.пара else [реф]
    тело = {"model": МОДЕЛЬ_ФОТО, "prompt": промпт, "aspect_ratio": "9:16",
            "resolution": "2K", "image": рефы, "image_urls": рефы}
    try:
        о = зов("/images/generations", тело)
    except Exception as e:
        стр = "%s;%s;ОТКАЗ ЗАПРОСА;%s;;;" % (сц.key, имя, str(e)[:120])
        print(стр, flush=True); отчёт.write(стр + "\n"); отчёт.flush(); continue
    д = о.get("data") or о
    tid = д.get("taskId") or д.get("task_id") or д.get("id")
    ссылка, р = дождаться("images", tid)
    потрачено += ЦЕНА.get(МОДЕЛЬ_ФОТО, 0.08)
    if not ссылка:
        причина = str(р.get("failMsg") or р.get("failCode") or р.get("state"))[:120]
        стр = "%s;%s;ОТКАЗ;%s;%d;%d;" % (сц.key, имя, причина, len(промпт), time.time() - т0)
        print(стр, flush=True); отчёт.write(стр + "\n"); отчёт.flush(); continue
    путь = "/root/proba/s_%s_%s.png" % (МОДЕЛЬ_ФОТО, сц.key)
    subprocess.run(["curl", "-sL", "-A", "Mozilla/5.0", "-o", путь, ссылка], check=True)
    им = Image.open(путь)
    ш, в = им.size
    пах = резкость(им.crop((0, int(в * .45), ш, int(в * .70))))
    стр = "%s;%s;ок;%dx%d;%d;%d;%.0f;%.0f" % (
        сц.key, имя, ш, в, len(промпт), time.time() - т0, резкость(им), пах)
    print(стр, flush=True)
    отчёт.write(стр + "\n"); отчёт.flush()
print("ПОТРАЧЕНО примерно $%.2f" % потрачено, flush=True)
