#!/usr/bin/env python3
"""
Атлас лиц клавиш из снятого кадра клавиатуры.

Генератор рисует двенадцать подсвеченных клавиш решёткой четыре на три.
Снимок хорош сам по себе, но для развёртки нужен порядок: каждое лицо
своей клеткой, все клетки одного размера, ряд ровный. Здесь двенадцать
лиц вырезаются по местам и складываются в атлас 4x4.

Четвёртый ряд - ровный тёмный металл с той же плиты. На него уходят
бока и низ объёмной крышки: в кадре они почти не видны, а брать под них
кусок лица нельзя, иначе рисунок поедет по рёбрам.

  python3 tools/cabkeys.py assets/gen/cab/cand/клавиши-1.png \
      assets/gen/cab/keys

Кладёт <имя>-atlas.webp и печатает раскладку.
"""
import os
import sys

from PIL import Image

# Где лежат лица на исходном кадре 1024x768. Снято руками по одному
# разу: генератор ставит решётку почти ровно, но не идеально, и
# подгонять каждую клетку по краю дешевле, чем искать их поиском.
FACES = [
    (108, 78, 252, 218), (332, 82, 476, 222), (546, 80, 690, 220), (768, 74, 912, 214),
    (96, 288, 250, 432), (326, 292, 476, 436), (546, 290, 692, 434), (764, 288, 916, 432),
    (100, 496, 250, 640), (324, 498, 476, 642), (546, 496, 692, 640), (766, 494, 916, 638),
]
# Кусок ровного тёмного металла на бока крышки.
DARK = (940, 690, 1010, 760)

CELL = 256
COLS = 4
ROWS = 4


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src, base = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert("RGB")
    if im.size != (1024, 768):
        im = im.resize((1024, 768), Image.LANCZOS)
    atlas = Image.new("RGB", (CELL * COLS, CELL * ROWS), (12, 13, 14))
    for i, box in enumerate(FACES):
        cell = im.crop(box).resize((CELL, CELL), Image.LANCZOS)
        atlas.paste(cell, ((i % COLS) * CELL, (i // COLS) * CELL))
    dark = im.crop(DARK).resize((CELL * COLS, CELL), Image.LANCZOS)
    atlas.paste(dark, (0, CELL * (ROWS - 1)))
    atlas.save(base + "-atlas.webp", quality=94, method=6)
    print("атлас", atlas.size, "клеток", COLS, "x", ROWS,
          "лиц", len(FACES), "тёмный ряд", ROWS - 1)


if __name__ == "__main__":
    main()
