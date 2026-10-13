# -*- coding: utf-8 -*-
"""Сборка монтажного листа: сценарий + длительности озвучки + ассеты.

Кладёт в remotion/public всё, что нужно рендеру: звук сцен, кадры, логотип,
и montazh2.json, по которому Remotion строит ролик.

    python3 sborka.py
"""
import json
import os
import re
import shutil
import subprocess
import urllib.request

КОРЕНЬ = os.path.dirname(os.path.abspath(__file__))
ПУБЛИКА = os.path.join(КОРЕНЬ, "remotion", "public")
ГОЛОС = os.path.join(КОРЕНЬ, "golos2")
КАДРЫ_В_СЕК = 25
ХВОСТ = 0.55          # пауза после речи, чтобы кадр не обрывался на слове
# Какие сцены оживляем видео, какие идут фотографией.
ВИДЕО = set()


def по_сценарию(текст: str, слова: list) -> list:
    """Подписи берём из сценария, а время из расшифровки.

    Whisper слышит «два заведения-наведения» и ставит длинное тире, и этот мусор
    уезжал прямо в субтитры. Поэтому слова на экране всегда свои, а таймкоды
    притягиваются выравниванием: что совпало, берёт своё время, остальное
    раскладывается ровно между соседями.
    """
    import difflib
    свои = текст.split()
    if not слова:
        return []
    норм = lambda с: re.sub(r"[^а-яёa-z0-9]", "", с.lower())
    a = [норм(с) for с in свои]
    b = [норм(с["слово"]) for с in слова]
    время = [None] * len(свои)
    for i, j, n in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(n):
            время[i + k] = (слова[j + k]["старт"], слова[j + k]["конец"])
    первое = слова[0]["старт"]
    последнее = слова[-1]["конец"]
    if время[0] is None:
        время[0] = (первое, первое + 0.2)
    if время[-1] is None:
        время[-1] = (последнее - 0.2, последнее)
    i = 0
    while i < len(время):
        if время[i] is not None:
            i += 1
            continue
    # ровно разложить дырку между известными соседями
        л = i - 1
        п = i
        while п < len(время) and время[п] is None:
            п += 1
        нач = время[л][1]
        кон = время[п][0] if п < len(время) else нач + 0.3
        шаг = max(0.08, (кон - нач) / (п - л))
        for k in range(л + 1, п):
            время[k] = (нач + шаг * (k - л - 1), нач + шаг * (k - л))
        i = п
    return [{"слово": свои[i], "старт": round(время[i][0], 3), "конец": round(время[i][1], 3)}
            for i in range(len(свои))]


def есть(путь: str) -> bool:
    return os.path.exists(путь) and os.path.getsize(путь) > 10000


def главное() -> int:
    сценарий = json.load(open(os.path.join(КОРЕНЬ, "scenario2.json"), encoding="utf-8"))
    голос = json.load(open(os.path.join(ГОЛОС, "golos.json"), encoding="utf-8"))
    os.makedirs(os.path.join(ПУБЛИКА, "zvuk"), exist_ok=True)
    os.makedirs(os.path.join(ПУБЛИКА, "kadr"), exist_ok=True)

    логотип = os.path.join(КОРЕНЬ, "..", "app", "public_html", "assets", "img", "logo.png")
    if os.path.exists(логотип):
        shutil.copy(логотип, os.path.join(ПУБЛИКА, "logo.png"))

    сцены = []
    for с in сценарий["сцены"]:
        ид = с["id"]
        г = голос.get(ид)
        if not г:
            print("нет озвучки:", ид)
            continue
        длина = г["длительность"] + float(с.get("пауза") or ХВОСТ)
        кадров = max(KADR_MIN, int(round(длина * КАДРЫ_В_СЕК)))
        звук_из = os.path.join(ГОЛОС, ид + ".wav")
        звук_в = os.path.join(ПУБЛИКА, "zvuk", ид + ".wav")
        if os.path.exists(звук_из) and not os.path.exists(звук_в):
            shutil.copy(звук_из, звук_в)
        кусок = dict(с)
        кусок["кадров"] = кадров
        кусок["слова"] = по_сценарию(с["текст"], г["слова"])
        кусок["звук"] = "zvuk/%s.wav" % ид
        кусок["титул"] = сценарий["титул"]
        кусок["курс"] = сценарий["курс"]
        кусок["блок"] = сценарий["блок"]
        кусок["номер_урока"] = сценарий["номер"]
        сцены.append(кусок)

    музыка = "muzyka.mp3" if есть(os.path.join(ПУБЛИКА, "muzyka.mp3")) else ""
    монтаж = {"сцены": сцены, "музыка": музыка,
              "блок": сценарий.get("блок", "")}
    json.dump(монтаж, open(os.path.join(ПУБЛИКА, "montazh2.json"), "w", encoding="utf-8"),
              ensure_ascii=False)
    всего = sum(с["кадров"] for с in сцены)
    print("сцен: %d, кадров: %d, длина: %.1f мин"
          % (len(сцены), всего, всего / КАДРЫ_В_СЕК / 60))
    print("видов сцен:", len({с["вид"] for с in сцены}))
    return 0


KADR_MIN = 70

if __name__ == "__main__":
    raise SystemExit(главное())
