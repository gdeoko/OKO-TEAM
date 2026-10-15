#!/usr/bin/env python3
"""
Десять художественных вариантов рубки на устройство: ПК и телефон.

Заказчик показал старые кадры рубки (17-19 августа), которые понравились
и ему, и его клиенту: тёмная панорамная трапеция, тонкая циановая кромка
по контуру остекления, внизу пульт с экранами-радарами, всё глубоко в
тени, без пересветов. Задача - то же настроение, но чище и реалистичнее.

Каждый вариант - своё прочтение этой основы: трапеция или восьмиугольник,
кромка светится или только фаска ловит свет, пульт с двумя или тремя
экранами. Общее у всех: рама тонкая (не больше 12-15 процентов на
сторону), космос в дыре чисто чёрный, никакого зелёного, никаких
пересветов, циан #42B2DC.

  python3 tools/cab10.py пк 1        # вариант 1 для ПК
  python3 tools/cab10.py моб 7       # вариант 7 для телефона
  python3 tools/cab10.py пк все      # все десять подряд

Кладёт в assets/gen/cab/cand10/{пк,моб}-N.png
"""
import os
import shutil
import sys

from gradio_client import Client

SPACES = ["black-forest-labs/FLUX.1-dev", "black-forest-labs/FLUX.1-schnell"]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "assets", "gen", "cab", "cand10")

CORE = (
    "Interior of a modern spacecraft cockpit seen from the pilot seat, photorealistic, "
    "shot straight ahead, symmetrical. In the exact centre one very large viewport "
    "opening filled with pure solid black, absolutely empty: no stars, no glass, no "
    "reflection, no glare, nothing inside it. {shape} The opening takes at least "
    "three quarters of the picture in both directions; the surrounding structure is a "
    "narrow band, never wider than one eighth of the picture on any side. {frame} "
    "Below the opening a slim console ledge: {console} "
    "Materials: soft touch matte dark charcoal composite, precision machined dark "
    "titanium, gently radiused corners, flush seamless surfaces, clinically clean, "
    "expensive, current generation spaceflight design of year 2035. "
    "Lighting: very dark cabin, deep shadow, cinematic. The only light is dim cool "
    "cyan close to #42B2DC: {light} A few tiny status points. No bright white lights, "
    "no blown highlights, no overexposure anywhere, everything moody and restrained. "
    "Absolutely no mechanical keyboard, no rows of keycaps, no toggle switches, no "
    "green colour, no orange, no CRT, no retro, no clutter, no rivets, no text, no "
    "letters, no logos, no people, no hands. Razor sharp, 8K, photoreal, high "
    "dynamic range, shot on a cinema camera."
)

SHAPES = {
    "трапеция": "The opening is a wide panoramic trapeze, slightly narrower at the "
                "top, with slim angled corner posts, like the bridge of a modern "
                "starship.",
    "октагон": "The opening is a wide octagon with generous flat chamfered corners.",
    "скругление": "The opening is a wide rectangle with large smooth radiused "
                  "corners, one continuous curve.",
}

FRAMES = {
    "кромка": "A single thin luminous cyan line runs along the very edge of the "
              "opening, following its shape exactly, set into a recessed channel; "
              "the rest of the frame is dark.",
    "фаска": "The frame edge is a machined chamfer catching a faint cyan sheen; no "
             "light lines at all, the frame reads only through its highlights.",
    "двойная": "Two parallel hairline cyan light guides trace the opening edge a "
               "few centimetres apart; between them brushed dark titanium.",
}

# Пульт генерится ПУСТЫМ: посадочные места под кнопки и экраны без
# содержимого. Кнопки и приборы потом рисует код ровно в эти места -
# так они выходят единым целым с панелью, а не вклейкой. Заказчик
# прямо попросил заглушки.
CONSOLES = {
    "триэкрана": "three empty recessed screen bays of dark glass, completely "
                 "blank, no interface, only the faintest cyan tint deep inside; "
                 "between and below them one long shallow recessed tray running "
                 "the full width of the ledge, empty and unlabeled, ready to "
                 "receive a row of buttons; on the right end of the ledge a "
                 "small round empty projection pad.",
    "дваэкрана": "two wide empty recessed screen bays of dark blank glass with "
                 "the faintest cyan tint, no interface content at all; below "
                 "them one continuous shallow recessed tray across the whole "
                 "width, empty, unlabeled; a small round empty projection pad "
                 "at the right end.",
    "полоса": "one continuous blank strip of dark matte glass across the whole "
              "width, empty, with a single hairline cyan edge; beneath it a "
              "shallow empty recessed tray for controls; a small round empty "
              "projection pad at the right end.",
}

LIGHTS = {
    "тихий": "the thin light guides at perhaps a tenth of full brightness, and a "
             "faint cyan wash from the console screens onto the ledge.",
    "экраны": "only the console screens glow, their cyan light grazing the frame "
              "from below; the light lines are barely visible.",
}

# Десять сочетаний на устройство. Порядок от самого близкого к любимым
# старым кадрам к более смелым прочтениям.
VARIANTS = [
    ("трапеция", "кромка", "триэкрана", "тихий", 11),
    ("трапеция", "кромка", "дваэкрана", "экраны", 23),
    ("трапеция", "фаска", "триэкрана", "экраны", 37),
    ("трапеция", "двойная", "полоса", "тихий", 41),
    ("октагон", "кромка", "триэкрана", "тихий", 53),
    ("октагон", "фаска", "дваэкрана", "экраны", 67),
    ("октагон", "двойная", "полоса", "тихий", 71),
    ("скругление", "кромка", "дваэкрана", "тихий", 83),
    ("скругление", "фаска", "триэкрана", "экраны", 97),
    ("скругление", "двойная", "полоса", "экраны", 103),
]

SIZES = {"пк": (1536, 864), "моб": (832, 1664)}


def prompt_for(n):
    sh, fr, co, li, _ = VARIANTS[n - 1]
    return CORE.format(shape=SHAPES[sh], frame=FRAMES[fr],
                       console=CONSOLES[co], light=LIGHTS[li])


def gen(dev, n, ser=""):
    w, h = SIZES[dev]
    seed = VARIANTS[n - 1][4] * 101 + (7777 if ser else 0)
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, "%s-%s%d.png" % (dev, ser, n))
    tok = os.environ.get("HF_TOKEN")
    p = prompt_for(n)
    for sp in SPACES:
        steps = 28 if "dev" in sp else 4
        try:
            c = Client(sp, token=tok, verbose=False)
            r = c.predict(prompt=p, seed=seed, randomize_seed=False,
                          width=w, height=h, guidance_scale=3.5,
                          num_inference_steps=steps, api_name="/infer")
            path = r[0] if isinstance(r, (list, tuple)) else r
            if isinstance(path, dict):
                path = path.get("path") or path.get("url")
            shutil.copy(path, dst)
            print("готов", dst, os.path.getsize(dst) // 1024, "КБ", sp.split("/")[-1])
            return True
        except Exception as e:
            print("мимо", sp.split("/")[-1], str(e)[:140])
    return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    dev = sys.argv[1]
    ser = sys.argv[3] if len(sys.argv) > 3 else ""
    if sys.argv[2] == "все":
        ok = sum(gen(dev, i, ser) for i in range(1, 11))
        print("всего", ok, "из 10")
    else:
        gen(dev, int(sys.argv[2]), ser)
