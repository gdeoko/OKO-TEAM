#!/usr/bin/env python3
"""
Сборка паспорта кабины в один файл рядом с кодом сцены.

Контур окна, поля рамы, найденные клавиши и грубая карта глубины
кладутся прямо в javascript. Так рама строится сразу, первым кадром:
если бы паспорт тянулся отдельным запросом, сцена успевала подняться
раньше него и собирала раму по запасным числам, а потом дёргалась.

Карта глубины идёт восьмибитной решёткой в base64. Её размер выбран
так, чтобы поперёк стойки приходилось два десятка отсчётов - крупную
форму это держит, мелочь всё равно даёт карта нормалей.

  python3 tools/cabmeta.py assets/gen/cab/wide assets/gen/cab/tall \
      > assets/gen/cab/meta.js
"""
import base64
import json
import os
import sys

import numpy as np
from PIL import Image

GRID_LONG = 256


def one(base):
    with open(base + ".json", encoding="utf-8") as f:
        meta = json.load(f)
    dep = Image.open(base + "-depth.png").convert("L")
    w, h = dep.size
    if w >= h:
        gw = GRID_LONG
        gh = max(8, int(round(GRID_LONG * h / w)))
    else:
        gh = GRID_LONG
        gw = max(8, int(round(GRID_LONG * w / h)))
    small = dep.resize((gw, gh), Image.BOX)
    raw = np.asarray(small).astype(np.uint8).tobytes()
    return {
        "имя": os.path.basename(base),
        "w": meta["w"], "h": meta["h"],
        "контур": meta["окно"]["контур"],
        "коробка": meta["окно"]["коробка"],
        "поля": meta["поля"],
        "клавиши": meta["клавиши"],
        "глубина": {"w": gw, "h": gh, "d": base64.b64encode(raw).decode("ascii")},
    }


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    wide, tall = one(sys.argv[1]), one(sys.argv[2])
    out = {"широкая": wide, "высокая": tall}
    body = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    print("/* Паспорт кабины. Собран tools/cabmeta.py, руками не править. */")
    print("window.RC_CAB_META = " + body + ";")


if __name__ == "__main__":
    main()
