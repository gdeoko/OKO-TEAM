#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Входной кадр Формата 2: наша модель ОДЕТА, но под одеждой купальник.

Отличие от `../референсы/` принципиальное. Там кадр «одета полностью»:
тот, что человек прикладывает в бота. Здесь кадр, из которого вырастает
движение снятия, - значит под верхней вещью ОБЯЗАН быть купальник, иначе
модели нечего открыть и она придумает наготу.

Обстановка только бытовая: бассейн, пляж, зал, сауна, балкон. Там снятая
майка читается как «пошла плавать» - именно поэтому блогерам за это
ничего не бывает. Та же сцена в спальне превращает то же движение в
стриптиз, и жалоба приходит не за кадр, а за намёк.

    export APIMODELS_KEY=...
    python3 кадр_снятия.py ника            все сцены
    python3 кадр_снятия.py ника 0          одну
    python3 кадр_снятия.py забрать ника 0 <taskId>
"""
import json
import os
import subprocess
import sys
import time

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
sys.path.insert(0, os.path.join(БРЕНД, "персонажи"))

КЛЮЧ = os.environ.get("APIMODELS_KEY", "")
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = os.environ.get("AMBERRY_IMG_MODEL", "doubao-seedream-5-0-pro")

from сделать_аватарки import ПЕРСОНАЖИ                        # noqa: E402

# Камера телефона, а не студия: ролик притворяется обычной съёмкой.
# Купальник разрешён прямо - без него движение снятия некуда вести, - но
# всё остальное закрыто теми же словами, что и в референсах.
ОБЩЕЕ = (
    "Ultra-realistic vertical photograph shot on a modern flagship "
    "smartphone camera, 9:16 vertical framing, casual everyday photo, not a "
    "studio editorial. Natural composition, slight handheld feel, honest "
    "colors. "
    "The figure is visible from head to at least mid-thigh, standing "
    "naturally with a relaxed posture, facing the camera, both arms free "
    "and away from the body, nothing cropped awkwardly. "
    "Photo-real skin with pores and fine texture, no plastic airbrushing, "
    "no beauty filter. Sharp focus on the subject, clean exposure, no "
    "motion blur on the face. Quality: 8K, ultra sharp, true-to-life color. "
    "She wears an ordinary sporty swimsuit UNDERNEATH her outer clothing, "
    "modest full-coverage swimwear of the kind worn at a public pool, and "
    "the outer garment stays fully on in this photo. "
    "Strictly no text, no letters, no watermarks, no logos, no borders, no "
    "collage, no additional people, no extra limbs, no extra fingers, no "
    "deformed hands, no nudity, no underwear, no lingerie, no see-through "
    "fabric, nothing revealing."
)

# Сцены. Обстановка бытовая, верхняя вещь - та, которую снимают через
# голову: свободная футболка, толстовка, рубашка. Узкое платье не
# годится, модель не снимет его убедительно.
СЦЕНЫ = [
    {
        "имя": "бассейн-день",
        "фигура": "toned athletic build, defined waist, long legs",
        "сцена": (
            "Standing at the edge of an outdoor hotel swimming pool on a "
            "bright summer day, turquoise water and sun loungers behind her, "
            "palm shadows on the tiles. Over her swimsuit she wears a loose "
            "oversized white cotton t-shirt reaching mid-thigh, hair tied up "
            "in a high bun. She stands facing the camera, weight on one leg, "
            "calm friendly expression. Clean midday sunlight."),
    },
    {
        "имя": "пляж-вечер",
        "фигура": "slim figure with soft natural proportions",
        "сцена": (
            "Standing on a sandy beach in the late golden hour, calm sea and "
            "a low warm sun behind her, soft rim light on her hair. Over her "
            "swimsuit she wears a light grey oversized hoodie reaching the "
            "hips, sleeves pushed up, barefoot on the sand. Facing the "
            "camera, relaxed stance, half-smile."),
    },
    {
        "имя": "зал-день",
        "фигура": "fit hourglass figure with a defined waist",
        "сцена": (
            "Standing in a bright modern gym, grey equipment softly out of "
            "focus behind her, even ceiling light. Over her sports swimsuit "
            "top she wears a loose black training t-shirt and matching "
            "shorts, hair in a ponytail. Facing the camera, both hands "
            "relaxed at her sides, confident direct gaze."),
    },
    {
        "имя": "сауна-вечер",
        "фигура": "average natural build, realistic everyday proportions",
        "сцена": (
            "Standing in the warm wooden anteroom of a spa, soft amber "
            "light, wooden benches and towels behind her, faint steam. Over "
            "her swimsuit she wears a soft white waffle robe, open and loose "
            "but fully covering, belt tied. Facing the camera, calm and "
            "unhurried."),
    },
]


def зов(аргументы):
    р = subprocess.run(
        ["curl", "-s", "-m", "90", "-H", "Authorization: Bearer " + КЛЮЧ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, timeout=120)
    if р.returncode:
        raise RuntimeError("curl: " + р.stderr.decode()[-200:])
    о = json.loads(р.stdout or b"{}")
    if о.get("code") not in (200, None):
        raise RuntimeError("APIMODELS: %s" % str(о)[:300])
    return о.get("data") or {}


def забрать(лицо, номер, задача):
    """Ждать задачу и положить файл. Состояние в поле state, не status."""
    было = ""
    for _ in range(180):
        д = зов([БАЗА + "/images/generations?task_id=" + задача])
        сост = (д.get("state") or "").lower()
        if сост != было:
            print("  ...", сост or "(без состояния)", flush=True)
            было = сост
        ссылки = д.get("resultUrls") or []
        if ссылки:
            путь = os.path.join(ТУТ, "вход-%s-%s.jpg"
                                % (лицо, СЦЕНЫ[номер]["имя"]))
            subprocess.run(["curl", "-s", "-m", "180", "-o", путь, ссылки[0]],
                           check=True, timeout=200)
            print("  готово:", путь, os.path.getsize(путь), "байт", flush=True)
            return путь
        if сост in ("failed", "error"):
            print("  отказ:", str(д)[:300])
            return None
        time.sleep(5)
    print("  не дождались, задача", задача)
    return None


def сделать(лицо, номер):
    с = СЦЕНЫ[номер]
    промпт = " ".join([ОБЩЕЕ, ПЕРСОНАЖИ[лицо],
                       "Her body: " + с["фигура"] + ".", с["сцена"]])
    print("%s сцена %d (%s): промпт %d знаков"
          % (лицо, номер, с["имя"], len(промпт)), flush=True)
    тело = json.dumps({"model": МОДЕЛЬ, "prompt": промпт,
                       "aspect_ratio": "9:16", "resolution": "2K"})
    д = зов(["-X", "POST", БАЗА + "/images/generations", "-d", тело])
    задача = д.get("taskId")
    if not задача:
        print("  не приняли задачу:", str(д)[:300])
        return None
    print("  задача", задача, flush=True)
    return забрать(лицо, номер, задача)


if __name__ == "__main__":
    арг = sys.argv[1:]
    if not КЛЮЧ:
        raise SystemExit("нет APIMODELS_KEY")
    if арг and арг[0] == "забрать":
        _, лицо, номер, задача = арг
        забрать(лицо, int(номер), задача)
    else:
        лицо = (арг[0] if арг else "ника").lower()
        номера = [int(арг[1])] if len(арг) > 1 else range(len(СЦЕНЫ))
        for н in номера:
            сделать(лицо, н)
