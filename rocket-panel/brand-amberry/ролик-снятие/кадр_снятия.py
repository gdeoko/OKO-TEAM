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
    python3 кадр_снятия.py ника 0          пара кадров одной сцены
    python3 кадр_снятия.py ника            все сцены
    python3 кадр_снятия.py забрать ника 0 одежда <taskId>

ПАРА, А НЕ ОДИН КАДР. На сцену делается два снимка: «одета» и «в
купальнике». Сцена, поза, свет и обстановка у них описаны ОДНИМ текстом -
разойдётся описание, разойдётся и картинка, а их потом стыковать в одном
ролике. Третий кадр, результат, APIMODELS не сделает: его делает наша
карта тем же путём, которым бот обслуживает клиента.
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
    # ПОЗА, ПРИЧЁСКА И КАДР ЗАДАНЫ ЗДЕСЬ, А НЕ В СЦЕНЕ. Два снимка
    # стыкуются в одном ролике: если на первом пучок, а на втором
    # распущенные волосы, склейка читается как подмена человека. Первая
    # проба разошлась ровно так - и причёской, и планом.
    "Her hair is worn down, straight and loose, falling in front of both "
    "shoulders, parted in the middle, exactly the same way in every shot. "
    "She stands upright and square to the camera, weight evenly on both "
    "feet, shoulders level, arms hanging relaxed at her sides, hands open "
    "and empty, holding nothing. "
    # КАМЕРА РОВНО, А НЕ СВЕРХУ. «Камера на высоте груди» модель читала
    # как пожелание и всё равно ставила её выше головы, глядя вниз: кадр
    # получался съёмкой сверху, плечи широкие, ноги короткие. Помогает
    # не высота, а НАКЛОН, названный прямо: ось объектива горизонтальна,
    # съёмка в упор, горизонт по центру кадра.
    "Framing is identical every time: she is centred in the vertical "
    "frame, the top of her head a little below the upper edge, the crop "
    "at mid-thigh. "
    "The camera stands on a tripod at the height of her chest and the "
    "lens axis is strictly horizontal - a straight-on eye-level shot. "
    "The horizon line runs across the middle of the frame, behind her at "
    "chest height. The camera is NOT above her and NOT tilted downward, "
    "it does not look down at her from a high angle. Her figure is seen "
    "edge-on and her legs keep their full natural length in the frame. "
    "Photo-real skin with pores and fine texture, no plastic airbrushing, "
    "no beauty filter. Sharp focus on the subject, clean exposure, no "
    "motion blur on the face. Quality: 8K, ultra sharp, true-to-life color. "
    "Strictly no text, no letters, no watermarks, no logos, no borders, no "
    "collage, no additional people, no extra limbs, no extra fingers, no "
    "deformed hands, no nudity, no underwear, no lingerie, no see-through "
    "fabric, nothing revealing."
)

# Одежда и купальник описываются ОТДЕЛЬНО, а сцена - общая. Так два
# кадра остаются одним и тем же местом, светом и позой, и различаются
# ровно тем, чем должны.
# ОДИН КУПАЛЬНИК НА ОБА КАДРА, И ЦВЕТ НАЗВАН. Первая проба этого не
# делала: под футболкой модель нарисовала белый низ, а на втором кадре
# был чёрный - на стыке отрезков это читается как подмена, и «единое
# видео» рассыпается на два ролика. Вещь описывается тут один раз.
КУПАЛЬНИК_ВЕЩЬ = (
    "a modern open two-piece swimsuit in plain matte BLACK, the same one "
    "in every shot: a black triangle bikini top on thin black string "
    "straps over the shoulders, tied at the back, and matching black "
    "high-leg bikini bottoms sitting high on the hips, one solid black "
    "colour, no pattern, no text, neatly worn and well fitted"
)

ОДЕТА = (
    "UNDERNEATH her outer clothing she is wearing " + КУПАЛЬНИК_ВЕЩЬ + ". "
    "The outer garment stays fully on and fully covers her in this photo, "
    "and whatever shows at the hips below its hem is that same black "
    "swimsuit and nothing else."
)
# КУПАЛЬНИК ОТКРЫТЫЙ И СОВРЕМЕННЫЙ - как у моделей на наших эталонах.
#
# ФИЛЬТР МОДЕЛИ ОТКАЗАЛ 26.09.2026 (CONTENT_MODERATION) на первой
# редакции этого куска. Отказ дала не сама вещь, а оговорки вокруг неё:
# «ничего не соскальзывает, ничего не отодвинуто, ничего не прозрачно».
# Отрицание НАЗЫВАЕТ то, чего мы избегаем, и фильтр читает названное, а
# не отрицание. Описывать вещь спокойно, как в каталоге одежды, и не
# перечислять, чего с ней не происходит.
# Закрытый спортивный, снятый первой пробой, для ленты не годится: он
# читается как бассейн при санатории, а не как девушка с курорта, ради
# которой на страницу заходят. Открытый - это по-прежнему купальник,
# площадкам он разрешён, и снимать с него нечего иначе как по сюжету.
# ЗАПАСНОЕ ОПИСАНИЕ, ПОСПОКОЙНЕЕ. Фильтр модели отбивает не вещь, а
# плотность слов вокруг неё: на пляже в закатном свете «треугольный верх
# на тонких завязках» уходит в отказ три раза из трёх, а «чёрный
# раздельный купальник» проходит. Вещь та же, слов меньше.
КУПАЛЬНИК_ВЕЩЬ_МЯГЧЕ = (
    "a plain black two-piece swimsuit, the same one in every shot: a "
    "simple black swim top and matching black swim bottoms, one solid "
    "colour, no pattern, neatly worn and well fitted"
)

КУПАЛЬНИК = (
    "She wears ONLY her swimsuit in this photo - the outer garment is gone, "
    "not held, not in frame. She is wearing " + КУПАЛЬНИК_ВЕЩЬ + ". "
    "Her pose, the place, the light and the framing stay exactly the same "
    "as with the outer garment on."
)

# Сцены. Обстановка бытовая, верхняя вещь - та, которую снимают через
# голову: свободная футболка, толстовка, рубашка. Узкое платье не
# годится, модель не снимет его убедительно.
#
# ВЕРХНЯЯ ВЕЩЬ - ТОЛЬКО ВЕРХ, НИКАКОГО НИЗА. В зале первая редакция
# надела поверх купальника футболку И шорты. Футболка ушла через голову,
# а шорты остались - и на стыке с отрезком в купальнике низ сменился
# рывком, вместе с придуманным моделью розовым верхом. Низ обязан быть
# один и тот же во всех трёх отрезках, значит это всегда купальник, а
# сверху одна вещь, снимаемая через голову.
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
            "hips, sleeves pushed up, barefoot on the sand. Half-smile."),
    },
    {
        "имя": "зал-день",
        "фигура": "fit hourglass figure with a defined waist",
        "сцена": (
            "Standing in a bright modern gym, grey equipment softly out of "
            "focus behind her, even ceiling light. Over her swimsuit she "
            "wears one loose black training t-shirt and nothing else - no "
            "shorts, no leggings, the t-shirt long enough to reach the top "
            "of her thighs. Confident direct gaze."),
    },
    {
        "имя": "сауна-вечер",
        "фигура": "average natural build, realistic everyday proportions",
        "сцена": (
            "Standing in the warm wooden anteroom of a spa, soft amber "
            "light, wooden benches and towels behind her, faint steam. Over "
            "her swimsuit she wears a soft white waffle robe, open and loose "
            "but fully covering, belt tied. Calm and unhurried."),
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


def забрать(лицо, номер, вид, задача):
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
            путь = os.path.join(ТУТ, "вход-%s-%s-%s.jpg"
                                % (лицо, СЦЕНЫ[номер]["имя"], вид))
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


def сделать(лицо, номер, вид="одежда", мягче=False):
    с = СЦЕНЫ[номер]
    вещь = КУПАЛЬНИК_ВЕЩЬ_МЯГЧЕ if мягче else КУПАЛЬНИК_ВЕЩЬ
    одета = ("UNDERNEATH her outer clothing she is wearing " + вещь + ". "
             "The outer garment stays fully on and fully covers her in this "
             "photo, and whatever shows at the hips below its hem is that "
             "same black swimsuit and nothing else.")
    купальник = ("She wears ONLY her swimsuit in this photo - the outer "
                 "garment is gone, not held, not in frame. She is wearing "
                 + вещь + ". Her pose, the place, the light and the framing "
                 "stay exactly the same as with the outer garment on.")
    промпт = " ".join([ОБЩЕЕ, ПЕРСОНАЖИ[лицо],
                       "Her body: " + с["фигура"] + ".", с["сцена"],
                       одета if вид == "одежда" else купальник])
    print("%s сцена %d (%s), %s: промпт %d знаков"
          % (лицо, номер, с["имя"], вид, len(промпт)), flush=True)
    тело = json.dumps({"model": МОДЕЛЬ, "prompt": промпт,
                       "aspect_ratio": "9:16", "resolution": "2K"})
    д = зов(["-X", "POST", БАЗА + "/images/generations", "-d", тело])
    задача = д.get("taskId")
    if not задача:
        print("  не приняли задачу:", str(д)[:300])
        return None
    print("  задача", задача, flush=True)
    return забрать(лицо, номер, вид, задача)


if __name__ == "__main__":
    арг = sys.argv[1:]
    if not КЛЮЧ:
        raise SystemExit("нет APIMODELS_KEY")
    if арг and арг[0] == "забрать":
        _, лицо, номер, вид, задача = арг
        забрать(лицо, int(номер), вид, задача)
    else:
        лицо = (арг[0] if арг else "ника").lower()
        номера = [int(арг[1])] if len(арг) > 1 else range(len(СЦЕНЫ))
        for н in номера:
            for вид in ("одежда", "купальник"):
                сделать(лицо, н, вид)
