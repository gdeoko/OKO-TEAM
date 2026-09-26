#!/usr/bin/env python3
"""Аватарки персонажей со знаком AMBERRY в кадре.

Первая пятёрка вышла без единого следа бренда: красивые лица, по которым
не понять, чьи они. В ленте это пять случайных девушек, а не сетка одного
продукта.

Знак ставится ГЕНЕРАЦИЕЙ, а не наклейкой поверх: канон завода запрещает
накладывать текст слоем на готовую картинку, и правильно - наклейка видна
наклейкой, а вшитый в сцену неон выглядит частью кадра.

Лицо не сочиняется заново: референсом идёт принятая аватарка персонажа,
вторым - файл лого из пака. Без них выходит другая девушка и
перерисованная ягода.

    python3 лого_на_аватарки.py ника
    python3 лого_на_аватарки.py все
"""
import base64
import json
import os
import subprocess
import sys
import time

КЛЮЧ = os.environ.get("APIMODELS_KEY", "")
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = os.environ.get("AMBERRY_IMG_MODEL", "gpt-image-2.5-sunburst")
ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
ЛОГО = os.path.join(БРЕНД, "amberry-icon-512.png")

ЛИЦА = {
    "ника": "warm ash blonde hair, grey-blue eyes, golden tan",
    "мира": "jet black wavy hair, emerald green eyes, olive skin",
    "ева":  "copper red hair, freckles, jade green eyes, fair skin",
    "юки":  "straight jet black hair with curtain bangs, dark brown eyes",
    "сая":  "dark brown curls with caramel highlights, hazel eyes, bronze skin",
}

ПРОМПТ = """
Take the woman from the FIRST attached reference and keep her EXACTLY as she
is: same face, same bone structure, same eyes, same hair colour and cut, same
skin tone, same makeup, same magenta strap top, same pose and framing, same
neon lighting and black background. She is %s. Do not restyle her, do not
change her age, do not swap her for a different model. This is the same
person, the same photograph - only one thing is added.

ADD THE BRAND MARK. The AMBERRY raspberry from the SECOND attached reference
- a glossy three dimensional berry of rounded magenta spheres with one leaf on
top and a drop at the bottom - glows as a small neon sign in the LOWER CENTRE
of the square, over her shoulder and the dark background, sized about one
tenth of the frame width. Directly beneath it, the word "AMBERRY" in a wide
geometric sans serif, all capitals, letterspaced, built as a real neon tube in
hot magenta #FF0A8C with a white hot inner core and a soft bloom, no wider
than one third of the frame. Spelled EXACTLY A-M-B-E-R-R-Y.

The mark and the word form one compact signature block in the lowest sixth of
the frame, its bottom edge about one twelfth of the frame height above the
bottom, well inside the middle third horizontally: this image is displayed as
a circle and the corners are cut away. It must read as a discreet signature,
small and calm - her face stays the subject of the picture.

Keep the berry's proportions and colour exactly as in the reference: same
berry, same leaf, same drop, glossy magenta. Do not redraw it as grapes or a
strawberry, do not flatten it into a sticker, do not put it on her clothes.

Photographic quality unchanged: 8K, ultra sharp, real pore texture, cinematic
neon grading, rich true blacks, no plastic smoothing, no watermark, no extra
text anywhere.
""".strip()

ОТРИЦАНИЕ = ("different face, different woman, changed hair colour, changed "
             "eye colour, extra text, misspelled text, garbled letters, "
             "watermark, flat pasted sticker logo, grapes, strawberry, logo on "
             "clothing, text in the corners, nudity, cleavage")


def в_дата(путь):
    вид = "png" if путь.lower().endswith(".png") else "jpeg"
    with open(путь, "rb") as ф:
        return "data:image/%s;base64,%s" % (вид, base64.b64encode(ф.read()).decode())


def зов(аргументы):
    р = subprocess.run(
        ["curl", "-s", "-m", "180", "-H", "Authorization: Bearer " + КЛЮЧ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, timeout=200)
    if р.returncode:
        raise RuntimeError("curl: " + р.stderr.decode()[-200:])
    о = json.loads(р.stdout or b"{}")
    return о.get("data") or о


def сделать(кто):
    исход = os.path.join(ТУТ, "аватар-%s.jpg" % кто)
    if not os.path.exists(исход):
        print("нет исходной аватарки:", исход)
        return None
    кадры = [в_дата(исход), в_дата(ЛОГО)]
    тело = {"model": МОДЕЛЬ, "prompt": ПРОМПТ % ЛИЦА[кто], "aspect_ratio": "1:1",
            "resolution": "2K", "negative_prompt": ОТРИЦАНИЕ,
            "image": кадры, "image_urls": кадры}
    врем = "/tmp/amberry-%s.json" % кто
    json.dump(тело, open(врем, "w"))
    д = зов(["-X", "POST", БАЗА + "/images/generations", "-d", "@" + врем])
    os.remove(врем)
    задача = д.get("taskId")
    if не_задача(задача, д):
        return None
    print("%s: задача %s" % (кто, задача), flush=True)
    было = ""
    for _ in range(180):
        time.sleep(5)
        с = зов([БАЗА + "/images/generations?task_id=" + задача])
        сост = (с.get("state") or "").lower()
        if сост != было:
            print("  %s ... %s" % (кто, сост), flush=True)
            было = сост
        if сост in ("completed", "succeeded", "success"):
            путь = os.path.join(ТУТ, "аватар-%s-лого.jpg" % кто)
            subprocess.run(["curl", "-s", "-m", "180", "-o", путь,
                            с["resultUrls"][0]], check=True, timeout=200)
            print("  %s готово: %.0f КБ" % (кто, os.path.getsize(путь) / 1024), flush=True)
            return путь
        if сост in ("failed", "error"):
            print("  %s отказ: %s" % (кто, с.get("failMsg"))); return None
    print("  %s не дождались" % кто)
    return None


def не_задача(задача, д):
    if not задача:
        print("задача не создана:", str(д)[:300])
        return True
    return False


if __name__ == "__main__":
    if not КЛЮЧ:
        raise SystemExit("нет APIMODELS_KEY")
    что = sys.argv[1:] or ["ника"]
    кого = list(ЛИЦА) if что == ["все"] else что
    for к in кого:
        if к in ЛИЦА:
            сделать(к)
