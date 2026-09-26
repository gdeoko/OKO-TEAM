#!/usr/bin/env python3
"""Знак AMBERRY с прозрачным фоном - из того же файла, что и везде.

Лого у нас одно и настоящее: `amberry-icon-512.png`. Но оно лежит на
чёрном, и на аутро это незаметно (там фон тоже чёрный), а поверх кадра
ролика вылезает чёрный квадрат.

Фон снимается ЗАЛИВКОЙ ОТ УГЛОВ, а не порогом по яркости. Порог съел бы
и тёмную обводку самой ягоды (#150309) - знак стал бы тоньше, то есть
перерисованным. Заливка убирает только ту черноту, что связана с краем
листа; всё, что внутри силуэта, остаётся как было, пиксель в пиксель.
"""
from PIL import Image, ImageFilter
from collections import deque

ИСХОД = "amberry-icon-512.png"
ВЫХОД = "amberry-icon-512-alpha.png"
ПОРОГ = 26          # что считаем чернотой фона


def снять_фон(путь=ИСХОД, выход=ВЫХОД):
    и = Image.open(путь).convert("RGB")
    ш, в = и.size
    п = и.load()
    фон = bytearray(ш * в)
    очередь = deque()
    for x in range(ш):
        for y in (0, в - 1):
            очередь.append((x, y))
    for y in range(в):
        for x in (0, ш - 1):
            очередь.append((x, y))
    while очередь:
        x, y = очередь.popleft()
        if not (0 <= x < ш and 0 <= y < в) or фон[y * ш + x]:
            continue
        r, g, b = п[x, y]
        if max(r, g, b) > ПОРОГ:
            continue
        фон[y * ш + x] = 1
        очередь.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    альфа = Image.frombytes("L", (ш, в),
                            bytes(0 if f else 255 for f in фон))
    # Полпикселя размытия: без него край знака идёт лесенкой.
    альфа = альфа.filter(ImageFilter.GaussianBlur(0.6))
    и = и.convert("RGBA")
    и.putalpha(альфа)
    и.save(выход)
    доля = sum(фон) / (ш * в)
    print(f"{выход}: снято {доля:.0%} площади")
    return выход


if __name__ == "__main__":
    снять_фон()
