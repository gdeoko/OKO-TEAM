#!/usr/bin/env python3
"""
Удвоение кадра рубки С СОХРАНЕНИЕМ прозрачного окна.

cabup.py гоняет кадр через нейросетевой апскейлер, но тот работает
только с тремя каналами и прозрачность теряет. У рамы рубки окно
вырезано прозрачностью - без неё вместо космоса будет чёрный
прямоугольник.

Поэтому здесь два потока. Цвет идёт через апскейлер и получает
дорисованный микрорельеф. Прозрачность увеличивается отдельно,
обычным Ланцошем: у неё нет фактуры, ей нужна только ровная кромка,
и нейросеть на ней только напортит.

  python3 tools/cabsharp.py вход.webp выход.webp
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cabup import up  # noqa: E402


def main():
    src, dst = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    rgb = Image.new("RGB", (w, h), (0, 0, 0))
    rgb.paste(im.convert("RGB"), (0, 0), im.split()[3])
    tmp_in = "/tmp/_sharp_in.png"
    tmp_out = "/tmp/_sharp_out.png"
    rgb.save(tmp_in)
    up(tmp_in, tmp_out, 2)
    big = Image.open(tmp_out).convert("RGB")
    W, H = big.size
    alpha = im.split()[3].resize((W, H), Image.LANCZOS)
    out = big.copy()
    out.putalpha(alpha)
    out.save(dst, quality=95, method=6)
    a = np.asarray(alpha)
    print("готово", dst, out.size, "прозрачных", int((a < 128).sum()))


if __name__ == "__main__":
    main()
