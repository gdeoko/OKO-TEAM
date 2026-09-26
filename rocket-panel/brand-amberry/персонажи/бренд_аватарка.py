#!/usr/bin/env python3
"""Аватарка самого AMBERRY: девушка в основе, лого и подпись в сцене.

Прежняя аватарка бренда (`amberry-avatar-512.png`) - плоская малина на
чёрном. Рядом с пятью живыми лицами она смотрится как иконка приложения,
а не как аккаунт: в ленте соцсетей кружок с плоским знаком пролистывают.
Здесь основа - Ника, лицо бренда, а лого и слово AMBERRY встроены в
кадр неоном, а не наклеены сверху.

Два правила кадра, оба из-за круглой обрезки:
  * всё важное - внутри центрального круга. Соцсети режут квадрат в
    круг, и углы пропадают вместе с тем, что в них положили;
  * подпись не у самого низа. Нижняя кромка уходит под обрезку первой.

Ника не описывается словами заново: приложены её принятая аватарка и
заставка бота. Слова задают сцену, референсы - человека; без них выходит
другая блондинка (проверено дважды).

    python3 бренд_аватарка.py            собрать
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

РЕФЕРЕНСЫ = [
    os.path.join(ТУТ, "аватар-ника.jpg"),          # лицо: её и только её
    os.path.join(БРЕНД, "amberry-icon-512.png"),   # малина: форма и цвет
    os.path.join(БРЕНД, "start", "заставка-16x9.jpg"),  # свет и настроение
]

РАСКЛАДКИ = {
    # Как на заставке бота: знак и слово слева, Ника справа. Узнаётся
    # мгновенно теми, кто уже видел бота.
    "бок": (
        "HER PLACEMENT. She sits in the RIGHT-OF-CENTRE part of the "
        "square, her face filling roughly forty percent of the frame "
        "height, cropped just below the collarbones. "
        "THE LOGO sits in the UPPER LEFT area, clearly separated from her "
        "head, sized about one fifth of the frame width. "
        "THE WORD runs horizontally across the LOWER LEFT, directly below "
        "the berry mark, its baseline about one fifth of the frame height "
        "above the bottom edge."),
    # Осевая: всё по центральной оси. В маленьком кружке ленты читается
    # лучше - глазу не нужно искать, где здесь главное.
    "ось": (
        "HER PLACEMENT. She is CENTRED in the square, facing camera, her "
        "face filling roughly forty five percent of the frame height, "
        "cropped just below the collarbones, positioned slightly below "
        "the middle so there is room above her head. "
        "THE LOGO floats CENTRED directly above her head against the "
        "black, sized about one sixth of the frame width, with clear dark "
        "space between the berry and her hair. "
        "THE WORD runs CENTRED horizontally across the lower part of the "
        "frame, over her shoulders, its baseline about one eighth of the "
        "frame height above the bottom edge, letters bright enough to "
        "read against her skin and the dark."),
}

ПРОМПТ = """
A premium square 1:1 brand profile picture for a neon night-club style
adult brand called AMBERRY. This is a finished advertising key visual:
the logo and the typography are built INTO the scene as real physical
neon and glossy objects, never pasted flat on top.

THE WOMAN IS THE FOUNDATION OF THE FRAME. She is the same woman as in
the first attached reference - keep her recognisably her: long, perfectly
straight, sleek warm ash blonde hair with a soft side part, falling flat
and glossy past her shoulders; large grey-blue eyes with heavy dark
winged eyeliner and thick lashes; a soft rounded feminine face with
gently full cheeks, a small straight nose, naturally full glossy
nude-pink lips; warm sun-kissed golden skin. Do not restyle her into a
different person, do not make her hair white platinum, do not sharpen her
face into a different bone structure.

SHE WEARS a magenta satin top with a thin strap clearly visible over
the shoulder - tasteful and modest, nothing revealing, no cleavage in
frame. She looks straight into the lens with a confident, slightly
teasing expression, lips softly parted in a small knowing smile.

THE LOGO. The AMBERRY raspberry mark from the second attached reference -
a glossy three dimensional berry built of rounded magenta spheres with a
single leaf on top and a drop at the bottom - glows in the same glossy
neon magenta #FF0A8C with specular highlights, casting its own pink glow
into the haze. Keep its proportions and shape exactly as in the
reference: same berry, same leaf, same drop. Do not redraw it as grapes
or a strawberry, do not flatten it, do not change its colour.

THE TYPOGRAPHY. The single word "AMBERRY" in a wide geometric sans serif,
all capitals, generously letterspaced, built as a genuine neon tube
glowing hot magenta #FF0A8C with a white hot inner core and soft bloom.
Spelled EXACTLY A-M-B-E-R-R-Y, one word, correct letterforms, no other
text anywhere, no tagline, no watermark, no signature, no UI.

%(РАСКЛАДКА)s

THE SET AND LIGHT, matching the attached third reference. Pure black
studio void #07060A, no grey lift. Tall vertical neon tubes in hot
magenta #FF0A8C and violet #7A2BFF glow far behind her, heavily
defocused into soft bokeh. Thin volumetric haze so each light carries a
visible beam. Her FACE is lit by a soft neutral beauty light that keeps
her natural warm skin tone completely readable - never washed in pink.
The brand neon works as EDGE light: a hot pink rim from behind her left
traces her cheek, jaw and hair edge, a violet rim from behind her right
separates her from the black.

COMPOSITION FOR A ROUND CROP. This image will be displayed as a circle.
Everything that matters - her whole face, the berry mark and the full
word AMBERRY - must sit well inside the central circle of the square,
with a generous margin. The four corners hold nothing but black and
distant bokeh, because they will be cut away.

QUALITY. Full frame camera, 85mm lens at f/1.8, sharp focus on her eyes,
shallow natural depth of field. Commercial advertising photography, 8K,
ultra sharp, photorealistic skin with real pore texture, cinematic
colour grading, rich true blacks, no banding, no plastic smoothing.
""".strip()

ОТРИЦАНИЕ = ("child, teenager, underage, blurry, deformed face, extra "
             "fingers, hands in frame, second person, misspelled text, "
             "garbled letters, wrapped text, text touching the frame edge, "
             "text in the corners, watermark, signature, flat pasted logo, "
             "grapes, strawberry, white platinum hair, magenta skin cast, "
             "plastic airbrushed skin, nudity, cleavage, grey background")


def в_дата(путь):
    вид = "png" if путь.lower().endswith(".png") else "jpeg"
    with open(путь, "rb") as ф:
        return "data:image/%s;base64,%s" % (вид, base64.b64encode(ф.read()).decode())


def зов(аргументы):
    """Через curl: urllib в облачной сессии висит на прокси минутами."""
    р = subprocess.run(
        ["curl", "-s", "-m", "180", "-H", "Authorization: Bearer " + КЛЮЧ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, timeout=200)
    if р.returncode:
        raise RuntimeError("curl: " + р.stderr.decode()[-200:])
    о = json.loads(р.stdout or b"{}")
    return о.get("data") or о


def главное(раскладка="бок"):
    есть = [п for п in РЕФЕРЕНСЫ if os.path.exists(п)]
    print("референсов: %d из %d" % (len(есть), len(РЕФЕРЕНСЫ)), flush=True)
    if not есть:
        raise SystemExit("без референсов выйдет другая девушка - не запускаю")
    кадры = [в_дата(п) for п in есть]
    тело = {"model": МОДЕЛЬ, "prompt": ПРОМПТ % {"РАСКЛАДКА": РАСКЛАДКИ[раскладка]}, "aspect_ratio": "1:1",
            "resolution": "2K", "negative_prompt": ОТРИЦАНИЕ,
            # Поле референсов у агрегаторов зовётся по-разному; шлём оба
            # ходовых имени - лишнее сервер игнорирует, а недостающее
            # стоило бы нам генерации с чужим лицом.
            "image": кадры, "image_urls": кадры}
    # Тело с картинками большое: через файл, а не аргументом командной строки.
    врем = os.path.join("/tmp", "amberry-запрос.json")
    with open(врем, "w") as ф:
        json.dump(тело, ф)
    д = зов(["-X", "POST", БАЗА + "/images/generations", "-d", "@" + врем])
    os.remove(врем)
    задача = д.get("taskId")
    if not задача:
        raise SystemExit("задача не создана: " + str(д)[:400])
    print("задача", задача, flush=True)
    было = ""
    for _ in range(144):
        time.sleep(5)
        с = зов([БАЗА + "/images/generations?task_id=" + задача])
        сост = (с.get("state") or "").lower()
        if сост != было:
            print("  ...", сост, flush=True)
            было = сост
        if сост in ("completed", "succeeded", "success"):
            путь = os.path.join(ТУТ, "бренд-аватарка-%s.jpg" % раскладка)
            subprocess.run(["curl", "-s", "-m", "180", "-o", путь,
                            с["resultUrls"][0]], check=True, timeout=200)
            print("готово: %s (%.0f КБ, %s кредита)" % (
                путь, os.path.getsize(путь) / 1024, с.get("credits")))
            return путь
        if сост in ("failed", "error"):
            raise SystemExit("отказ: " + str(с.get("failMsg") or с)[:400])
    raise SystemExit("не дождались")


if __name__ == "__main__":
    if not КЛЮЧ:
        raise SystemExit("нет APIMODELS_KEY")
    главное(sys.argv[1] if len(sys.argv) > 1 else "бок")
