# -*- coding: utf-8 -*-
"""Сквозной прогон кнопок через API с ЗАМЕРОМ ПОЗЫ. Наружу не шлёт.

## Что меряется

Поза нашего кадра против ПРИНЯТОГО ВЛАДЕЛЬЦЕМ кадра той же кнопки
(`поза_сверка.py`, скелеты mediapipe, приведённые к общему росту).
Кнопка обещает человеку конкретный кадр — он показан прямо под ней, —
и обещание надо сверять числом, а не предполагать.

Резкость считается заодно, но главный столбец здесь поза: владелец
02.10.2026 написал «позы ракурсы не соблюдаются», и отвечать на это
надо тем же, чем меряешь.

## Промпт берётся У БОТА, а не собирается заново

`bot.тексты_кнопки()` — то же самое, что уходит живому человеку.
Прежняя версия этого файла собирала промпт своей копией кода бота и
ровно поэтому не заметила развилку, из-за которой эталон выключался
на умолчании: мерила не то, что шлют.

    PROBA_PLACE=ref|sc_hotel   какое место подставить (умолчание ref)
    PROBA_PHOTO=qwen3-image    модель
    PROBA_MODE=новый|старый    новый — как шлёт бот сейчас; старый —
                               собранный промпт без эталона, то есть то,
                               что уходило до 02.10.2026. Нужен, чтобы
                               сравнивать на ОДНОМ И ТОМ ЖЕ снимке: «до»,
                               снятое на другом референсе, не сравнение.
    PROBA_REF=/путь/ref.jpg    снимок клиентки
    python3 прогон_кнопок.py фото [кнопка,кнопка]
"""
import base64, io, json, os, subprocess, sys, time, urllib.request
sys.path.insert(0, "/opt/amberry/rocket-panel/bot")
import catalog, места, поза_сверка, примеры
import bot as БОТ
from PIL import Image, ImageFilter, ImageStat

БАЗА = "https://api.apimodels.app/v1"
КЛЮЧ = os.environ["APIMODELS_KEY"]
МОДЕЛЬ_ФОТО = os.environ.get("PROBA_PHOTO", "qwen3-image")
МЕСТО_КЛЮЧ = os.environ.get("PROBA_PLACE", "ref")
РЕЖИМ = os.environ.get("PROBA_MODE", "новый")
СНИМОК = os.environ.get("PROBA_REF", "/root/proba/ref_klientka.jpg")
КНОПКИ = sys.argv[2].split(",") if len(sys.argv) > 2 else None
ОТЧЁТ = os.environ.get("PROBA_REPORT", "/root/proba/poza.csv")
ЛАПЛАС = ImageFilter.Kernel((3, 3), [0, 1, 0, 1, -4, 1, 0, 1, 0], scale=1)
ЦЕНА = {"qwen3-image": 0.039, "qwen3-image-pro": 0.079}

МЕСТО = (места.КАК_НА_ФОТО if МЕСТО_КЛЮЧ == "ref"
         else [м for м in места.ВСЕ if м.key == МЕСТО_КЛЮЧ][0])


def резкость(им):
    return ImageStat.Stat(им.convert("L").filter(ЛАПЛАС)).stddev[0] ** 2


def зов(путь, тело=None):
    з = urllib.request.Request(
        БАЗА + путь, data=json.dumps(тело).encode() if тело is not None else None,
        method="POST" if тело is not None else "GET",
        headers={"Authorization": "Bearer " + КЛЮЧ, "Content-Type": "application/json"})
    with urllib.request.urlopen(з, timeout=180) as р:
        return json.loads(р.read())


def дождаться(tid, попыток=100):
    for _ in range(попыток):
        time.sleep(5)
        р = (зов("/images/generations?task_id=%s" % tid).get("data") or {})
        сс = [c for c in (р.get("resultUrls") or []) if c]
        if сс:
            return сс[0], р
        if str(р.get("state") or "").lower() in ("failed", "error"):
            return None, р
    return None, {"state": "timeout"}


реф = "data:image/jpeg;base64," + base64.b64encode(
    io.open(СНИМОК, "rb").read()).decode()
_вт = os.path.splitext(СНИМОК)[0] + "_2.jpg"
if not os.path.exists(_вт):
    Image.open(СНИМОК).transpose(
        Image.FLIP_LEFT_RIGHT).save(_вт, "JPEG", quality=90)
реф2 = "data:image/jpeg;base64," + base64.b64encode(
    io.open(_вт, "rb").read()).decode()

кнопки = [s for s in catalog.все_сценарии()
          if not s.скрыт and s.наполнен
          and not s.двухшаговый and (not КНОПКИ or s.key in КНОПКИ)]
print("прогон «%s»: кнопок %d · %s · место %s · снимок %s"
      % (РЕЖИМ, len(кнопки), МОДЕЛЬ_ФОТО, МЕСТО.key, os.path.basename(СНИМОК)),
      flush=True)
отчёт = io.open(ОТЧЁТ, "a", encoding="utf-8")
потрачено = 0.0
for сц in кнопки:
    имя = catalog.имя(сц.key, сц.title, "", "ru")
    # РОВНО ТО, ЧТО ШЛЁТ БОТ (или то, что слал до фикса).
    if РЕЖИМ == "старый":
        промпт = сц.промпт(место=МЕСТО, сложение=None)
    else:
        промпт, _, _ = БОТ.тексты_кнопки(сц, МЕСТО, None)
    промпт = БОТ.prompts.под_предел(промпт, БОТ.КОРОТКИЙ_ПРЕДЕЛ)
    т0 = time.time()
    рефы = [реф, реф2] if сц.пара else [реф]
    тело = {"model": МОДЕЛЬ_ФОТО, "prompt": промпт, "aspect_ratio": "9:16",
            "resolution": "2K", "image": рефы, "image_urls": рефы}
    try:
        о = зов("/images/generations", тело)
    except Exception as e:                                  # noqa: BLE001
        стр = "%s;%s;ОТКАЗ ЗАПРОСА;%s;;;;" % (сц.key, имя, str(e)[:100])
        print(стр, flush=True); отчёт.write(стр + "\n"); отчёт.flush(); continue
    д = о.get("data") or о
    ссылка, р = дождаться(д.get("taskId") or д.get("task_id") or д.get("id"))
    потрачено += ЦЕНА.get(МОДЕЛЬ_ФОТО, 0.08)
    if not ссылка:
        причина = str(р.get("failMsg") or р.get("failCode") or р.get("state"))[:100]
        стр = "%s;%s;ОТКАЗ;%s;%d;%d;;" % (сц.key, имя, причина, len(промпт),
                                          time.time() - т0)
        print(стр, flush=True); отчёт.write(стр + "\n"); отчёт.flush(); continue
    путь = "/root/proba/%s_%s_%s.png" % (РЕЖИМ, МЕСТО.key, сц.key)
    subprocess.run(["curl", "-sL", "-A", "Mozilla/5.0", "-o", путь, ссылка], check=True)
    им = Image.open(путь)
    ш, в = им.size
    пах = резкость(им.crop((0, int(в * .45), ш, int(в * .70))))
    # ПОЗА ПРОТИВ ПРИНЯТОГО КАДРА.
    с = поза_сверка.сверить(сц.key, путь)
    поза = с.get("расхождение")
    ушли = ",".join(с.get("ушли") or []) or ("беда:" + с["беда"] if с.get("беда") else "")
    стр = "%s;%s;ок;%dx%d;%d;%d;%.0f;%.0f;%s;%s;%s" % (
        сц.key, имя, ш, в, len(промпт), time.time() - т0, резкость(им), пах,
        ("%.3f" % поза) if поза is not None else "-",
        "совпала" if с.get("совпала") else "РАЗОШЛАСЬ", ушли)
    print(стр, flush=True)
    отчёт.write(стр + "\n"); отчёт.flush()
print("ПОТРАЧЕНО примерно $%.2f" % потрачено, flush=True)
