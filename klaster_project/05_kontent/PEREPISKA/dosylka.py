# -*- coding: utf-8 -*-
"""Досылка недель 2-4 в ветку Публикация через мост задач.

Прямое подключение к Телеграму тем же ключом сессии рубит её насмерть:
служба агента держит acc4 постоянно, и второй заход сервер считает утечкой.
Поэтому кладём задачи в очередь, а отправляет их живое подключение службы.
"""
import glob, os, sys, time
sys.path.insert(0, "/opt/oko-agents")
sys.path.insert(0, "/opt/oko-poster")
sys.path.insert(0, "/opt/oko-poster/perepiska")
from core import taskqueue as q
from emo import обычные, премиум
from audit30 import всё

ФОРУМ = -1003575806235
ВЕТКА = 9
АКК = "acc4"
КАДРЫ = "/opt/oko-poster/klaster_nedelya1"
С_КОГО = os.getenv("С_КОГО", "w2-05")
ПАУЗА = 9


def подпись(е):
    рубрика = " · рубрика «%s»" % е["рубрика"] if е.get("рубрика") else ""
    return "%s · %s · %s%s" % (е["день"], е["площадка"], е["формат"], рубрика)


def кадры(е):
    имя = (е.get("кадр") or "").split("..")[0]
    if not имя or "снимаем" in имя:
        return []
    основа = имя.rsplit("-", 1)[0] if имя[-1].isdigit() else имя
    ряд = sorted(glob.glob(os.path.join(КАДРЫ, основа + "-*.png")))
    if ряд and ("карусель" in е["формат"] or "истори" in е["формат"]):
        return ряд
    один = os.path.join(КАДРЫ, имя + ".png")
    return [один] if os.path.exists(один) else []


def тело(е):
    т = е.get("текст", "")
    оформ = премиум if е["площадка"] == "Telegram" else обычные
    куски = [подпись(е), оформ(т)]
    if е.get("слайды"):
        куски.append("Слайды:\n" + "\n".join(е["слайды"]))
    if е.get("опрос"):
        куски.append("Опрос: " + " · ".join(е["опрос"]))
    if е.get("хештеги"):
        куски.append(е["хештеги"])
    return "\n\n".join(к for к in куски if к)


def послать(res):
    t = q.enqueue("generic", ФОРУМ, АКК)
    res["message_thread_id"] = ВЕТКА
    q.mark(t, "done", res)
    time.sleep(ПАУЗА)
    return t


единицы = list(всё())
коды = [е["код"] for е in единицы]
старт = коды.index(С_КОГО)
for е in единицы[старт:]:
    if not е.get("текст"):
        continue
    ряд = кадры(е)
    for н, файл in enumerate(ряд, 1):
        подп = подпись(е) + (" · кадр %d из %d" % (н, len(ряд)) if len(ряд) > 1 else "")
        послать({"image_url": файл, "caption": подп})
    текст = тело(е)
    # У моста потолок 4000 знаков на сообщение, длинные статьи режем по абзацам.
    if len(текст) <= 3900:
        послать({"text": текст})
    else:
        куски, буфер = [], ""
        for абзац in текст.split("\n\n"):
            if len(буфер) + len(абзац) + 2 > 3900:
                куски.append(буфер)
                буфер = абзац
            else:
                буфер = (буфер + "\n\n" + абзац) if буфер else абзац
        куски.append(буфер)
        for к in куски:
            послать({"text": к})
    print(е["код"], "поставлено кадров", len(ряд), flush=True)
print("ДОСЫЛКА ПОСТАВЛЕНА ЦЕЛИКОМ", flush=True)
