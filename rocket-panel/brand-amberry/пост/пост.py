#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Пост AMBERRY: слева фото дня, справа результат бота под мутью.

Раскладка владельца от 28.09.2026: сверху заголовок с подзаголовком, в
середине две панели - одетая и результат, снизу лого, название и ник.

ПОЧЕМУ НЕ «СГЕНЕРИТЬ ЦЕЛИКОМ И ВКЛЕИТЬ НА ГЛАЗ». Модель не знает, где
именно код вставит картинку, и шов разъезжается; а левая половина,
сгенерированная заново, была бы УЖЕ НЕ ТОЙ девушкой, которую бот
раздевал, - пара «до/после» перестаёт быть честной.

Поэтому APIMODELS рисует только оправу: фон, заголовок, подзаголовок,
низ с лого и ником, рамки панелей. На месте фотографий она кладёт две
ПЛОСКИЕ ЗАЛИВКИ - зелёную слева и пурпурную справа. Код находит их по
цвету и вставляет настоящие кадры пиксель в пиксель: границы берутся от
самой картинки, а не от догадки.

Весь текст и лого по-прежнему рождаются в промпте (правило владельца),
руками ставятся только две фотографии - то же исключение, что у
последнего слайда карусели.

    python3 пост.py <одетая.jpg> <результат-муть.jpg> [выход.jpg]
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time

from PIL import Image, ImageFilter

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = "gpt-image-2"
ЗНАК = os.path.join(БРЕНД, "amberry-icon-512-alpha.png")
Ш, В = 1080, 1350

ЗАГОЛОВОК = "СЛЕВА ТВОЁ ФОТО"
ПОДЗАГОЛОВОК = "Справа - что вернул бот"

# Ключевые цвета панелей. Берутся предельно чистыми: любое другое место
# кадра к ним не приблизится, и маска не зацепит лишнего.
ЛЕВЫЙ_КЛЮЧ = (0, 255, 0)
ПРАВЫЙ_КЛЮЧ = (255, 0, 255)

ПРОМПТ = (
 "Vertical 4:5 image, 1080x1350 pixels, a premium social media post card "
 "for an adult-oriented Telegram bot brand called AMBERRY. This image is a "
 "DESIGNED CARD, not a photograph: it is a dark layout with typography, a "
 "brand lockup and two empty picture placeholders. Overall art direction: "
 "deep near-black background (#0A0A0C) with a subtle vertical gradient, hot "
 "neon pink accents (#FF0A8C), two thin vertical neon tubes glowing far "
 "behind everything at the left and right edges, soft volumetric haze, a "
 "faint glossy reflection along the very bottom, cinematic contrast, "
 "commercial design quality, ultra sharp, 8K, no banding, no noise. "
 "LAYOUT, from top to bottom, with generous even margins of about sixty "
 "pixels on the left and right. "
 "FIRST, in the top area, two lines of Russian text, centred, never "
 "touching the edges. The headline is the largest text in the whole image, "
 "heavy condensed geometric uppercase sans, pure white core with a thin hot "
 "pink neon outline and a soft outer glow, reading exactly: \"%s\". "
 "Directly beneath it, at roughly half that size, lighter weight, in a calm "
 "warm grey-white, reading exactly: \"%s\". "
 "SECOND, in the middle of the card and taking up most of its height, TWO "
 "RECTANGULAR PICTURE PLACEHOLDERS side by side, the same size as each "
 "other, the same vertical position, separated by a narrow dark gap of "
 "about thirty pixels. Each placeholder is a tall portrait rectangle with "
 "softly rounded corners and a thin bright hot pink neon border with a soft "
 "outer glow. The INSIDE of the left placeholder is filled with COMPLETELY "
 "FLAT PURE GREEN, hex #00FF00, one single solid colour, absolutely uniform, "
 "no gradient, no texture, no shading, no objects, no text, nothing at all "
 "inside it. The INSIDE of the right placeholder is filled with COMPLETELY "
 "FLAT PURE MAGENTA, hex #FF00FF, again one single solid colour, absolutely "
 "uniform, no gradient, no texture, no shading, no objects, no text, nothing "
 "at all inside it. These two flat colour fields are the most important part "
 "of the image and must be reproduced as perfectly even blocks of colour, "
 "because a photograph will be placed into each of them afterwards. Do not "
 "draw any person, any body, any face or any object inside either "
 "placeholder. Do not blur their edges into the background: the neon border "
 "must stay crisp so the boundary of each colour field is exact. "
 "THIRD, under the two placeholders, a compact brand lockup, centred, in "
 "this order: the brand mark from the attached reference file, small, "
 "reproduced EXACTLY as given - same stylised raspberry shape, same "
 "proportions, same hot pink colour - never redrawn in another style and "
 "never duplicated anywhere else in the frame; beneath the mark the brand "
 "name in heavy uppercase Latin letters with wide letter spacing, white with "
 "a hot pink neon outline, reading exactly: \"AMBERRY\"; and beneath that, "
 "smaller, in a calm light grey, the bot handle reading exactly: "
 "\"@theamberrybot\". "
 "TYPOGRAPHY RULES. Every Russian and Latin character is spelled exactly as "
 "written here, letter for letter, unbroken, not duplicated, not "
 "transliterated, with no extra word invented and no word dropped. Cyrillic "
 "glyphs must be correct Russian letterforms, not lookalike Latin shapes. "
 "Text is crisp and fully readable at small size, never overlapping the "
 "placeholders, never running off the edge of the card. "
 "COLOUR DISCIPLINE. Outside the two colour fields the palette is only "
 "black, white and hot pink. No orange, no teal, no lime green anywhere "
 "except inside the left placeholder, no purple wash over the whole card. "
 "The green and magenta fields must not tint the background around them "
 "beyond a faint natural glow from their neon borders. "
 "AVOID every common generation artefact: no stray letters, no watermark, "
 "no stock logo, no page numbers, no second copy of the brand mark, no "
 "drop shadows behind the whole card, no picture frame around the image "
 "itself, no border of any colour at the outer edge of the card. The result "
 "must look like a deliberate, expensive advertising layout: every element "
 "is there because it sells the product, and nothing is decorative filler."
) % (ЗАГОЛОВОК, ПОДЗАГОЛОВОК)


def зов(аргументы, ключ):
    р = subprocess.run(
        ["curl", "-s", "-m", "180", "-H", "Authorization: Bearer " + ключ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, text=True, timeout=210)
    return json.loads(р.stdout or "{}")


def знак_датой():
    return "data:image/png;base64," + base64.b64encode(
        open(ЗНАК, "rb").read()).decode()


def задачи(новое=None):
    п = os.path.join(ТУТ, ".задачи.json")
    было = json.load(open(п, encoding="utf-8")) if os.path.exists(п) else {}
    if новое is None:
        return было
    было.update(новое)
    json.dump(было, open(п, "w", encoding="utf-8"), ensure_ascii=False)
    return было


def оправа(ключ, имя="оправа"):
    """Карточка без фотографий: текст, лого, две цветные панели."""
    цель = os.path.join(ТУТ, имя + ".png")
    if os.path.exists(цель):
        print("оправа уже есть, не переделываю", flush=True)
        return цель
    отпечаток = hashlib.sha1(ПРОМПТ.encode("utf-8")).hexdigest()[:12]
    было = задачи().get(имя) or {}
    з = было.get("id") if было.get("промпт") == отпечаток else None
    if not з:
        тело = json.dumps({"model": МОДЕЛЬ, "prompt": ПРОМПТ,
                           "aspect_ratio": "4:5",
                           "image": [знак_датой()], "image_urls": [знак_датой()]})
        п = subprocess.run(
            ["curl", "-s", "-m", "180", "-H", "Authorization: Bearer " + ключ,
             "-H", "Content-Type: application/json", "-X", "POST",
             БАЗА + "/images/generations", "--data-binary", "@-"],
            input=тело, capture_output=True, text=True, timeout=210)
        з = (json.loads(п.stdout or "{}").get("data") or {}).get("taskId")
        if not з:
            raise SystemExit("задачу не приняли: %s" % п.stdout[:200])
        задачи({имя: {"id": з, "промпт": отпечаток}})
    print("жду оправу, задача %s" % з, flush=True)
    for _ in range(150):
        р = зов([БАЗА + "/images/generations?task_id=" + з], ключ).get("data", {})
        с = (р.get("state") or "").lower()
        if с in ("success", "succeeded", "completed"):
            subprocess.run(["curl", "-sL", "-o", цель,
                            (р.get("resultUrls") or [""])[0]], check=True)
            задачи({имя: None})
            print("оправа готова", flush=True)
            return цель
        if с in ("fail", "failed", "error"):
            задачи({имя: None})
            raise SystemExit("оправа не вышла: %s" % str(р)[:220])
        time.sleep(4)
    raise SystemExit("оправу не дождались")


def окно(кадр, ключ_цвета, допуск=70):
    """Границы плоской заливки по цвету. Возвращает (x1, y1, x2, y2)."""
    точки = кадр.convert("RGB").load()
    ш, в = кадр.size
    кл, кс, кси = ключ_цвета
    сx, сy = [], []
    шаг = 2
    for y in range(0, в, шаг):
        for x in range(0, ш, шаг):
            r, g, b = точки[x, y]
            if abs(r - кл) + abs(g - кс) + abs(b - кси) <= допуск:
                сx.append(x); сy.append(y)
    if len(сx) < 500:
        return None
    return (min(сx), min(сy), max(сx) + шаг, max(сy) + шаг)


def домутить(и):
    """Добить муть уже в размере панели.

    Первая сборка мутила кадр в размере ЛИСТА, а в панель он потом
    вписывался с увеличением центра - и сквозь муть читался силуэт.
    Сила мути должна считаться от ширины ПАНЕЛИ, а не листа, иначе она
    каждый раз оказывается слабее задуманной ровно во столько раз, во
    сколько панель меньше листа.
    """
    ш, в = и.size
    мелко = max(8, ш // 14)
    и = и.resize((max(1, ш // мелко), max(1, в // мелко)), Image.BILINEAR)
    и = и.resize((ш, в), Image.BICUBIC)
    return и.filter(ImageFilter.GaussianBlur(max(6, ш // 26)))


def вписать(фото, рамка, мутить=False):
    """Кадр в окно: заполняем целиком, лишнее срезаем по центру."""
    x1, y1, x2, y2 = рамка
    ш, в = x2 - x1, y2 - y1
    и = Image.open(фото).convert("RGB")
    к = max(ш / и.width, в / и.height)
    и = и.resize((max(1, round(и.width * к)), max(1, round(и.height * к))),
                 Image.LANCZOS)
    сx, сy = (и.width - ш) // 2, (и.height - в) // 2
    и = и.crop((сx, сy, сx + ш, сy + в))
    return домутить(и) if мутить else и


def собрать(одетая, результат, выход, ключ):
    карточка = Image.open(оправа(ключ)).convert("RGB")
    if карточка.size != (Ш, В):
        к = max(Ш / карточка.width, В / карточка.height)
        карточка = карточка.resize((round(карточка.width * к),
                                    round(карточка.height * к)), Image.LANCZOS)
        x, y = (карточка.width - Ш) // 2, (карточка.height - В) // 2
        карточка = карточка.crop((x, y, x + Ш, y + В))

    лево = окно(карточка, ЛЕВЫЙ_КЛЮЧ)
    право = окно(карточка, ПРАВЫЙ_КЛЮЧ)
    for имя, р in (("зелёная", лево), ("пурпурная", право)):
        if not р:
            raise SystemExit("%s панель не нашлась - оправу надо переснять" % имя)
        доля = (р[2]-р[0]) * (р[3]-р[1]) / (Ш*В)
        print("%s панель: %s, %.0f%% листа" % (имя, р, доля*100), flush=True)
        if доля < 0.05:
            raise SystemExit("%s панель слишком мала, оправа негодная" % имя)

    карточка.paste(вписать(одетая, лево), (лево[0], лево[1]))
    карточка.paste(вписать(результат, право, мутить=True),
                    (право[0], право[1]))
    карточка.save(выход, quality=95)
    return выход


if __name__ == "__main__":
    ключ = os.environ.get("APIMODELS_KEY", "")
    if not ключ:
        raise SystemExit("нет APIMODELS_KEY")
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    выход = sys.argv[3] if len(sys.argv) > 3 else os.path.join(ТУТ, "пост.jpg")
    print(собрать(sys.argv[1], sys.argv[2], выход, ключ))
