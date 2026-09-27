#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Вырезка фона из заставки бота: покадрово, u2net.

Заставка бота нужна нам БЕЗ ФОНА, чтобы девушка стояла поверх кадра
фильма и делала те же движения. Готовой альфы у видео нет, поэтому фон
снимается с каждого кадра отдельно.

Выбор движка стоил трёх проб (27.09.2026):

| движок | скорость | край |
|---|---|---|
| birefnet-portrait | 60 с первый кадр, дальше процесс УБИВАЛО по памяти | лучший |
| u2netp | 0,14 с | почти всё стёр, 3 % непрозрачных |
| **u2net** | **0,32 с** | **чистый, 22 % непрозрачных** |
| isnet-general-use | 0,91 с | тащит неоновую полосу фона |

Пробовали и без нейросети: фон в заставке почти чёрный, и `lumakey`
снимает его мгновенно - но оставляет розовые неоновые полосы и обрывки
надписи. Для рамки, которая висит весь ролик, это брак.

    python3 вырезать.py
"""
import os
import sys
import time

ТУТ = os.path.dirname(os.path.abspath(__file__))
ВХОД = os.path.join(ТУТ, "кадры")
ВЫХОД = os.path.join(ТУТ, "без-фона")


def главное():
    from rembg import remove, new_session
    from PIL import Image
    os.makedirs(ВЫХОД, exist_ok=True)
    с = new_session("u2net")
    файлы = sorted(f for f in os.listdir(ВХОД) if f.endswith(".png"))
    т = time.time()
    for i, имя in enumerate(файлы, 1):
        цель = os.path.join(ВЫХОД, имя)
        if os.path.exists(цель):
            continue
        и = Image.open(os.path.join(ВХОД, имя))
        remove(и, session=с).save(цель)
        if i % 20 == 0:
            print("  %d из %d, %.1f с/кадр" % (i, len(файлы), (time.time()-т)/i),
                  flush=True)
    print("готово: %d кадров за %.0f с" % (len(файлы), time.time()-т), flush=True)


if __name__ == "__main__":
    главное()
