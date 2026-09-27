#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Вырезка девушки из заставки бота: покадрово, BiRefNet.

Из заставки берётся ТОЛЬКО девушка. Знак и название рисует `лого.py`
отдельным слоем: в заставке они вплавлены в неоновый фон, и вырезка либо
тащит фон за собой, либо съедает слово AMBERRY (так и вышло с первого
раза - знак остался, названия под ним не было).

Выбор движка стоил пяти проб (27.09.2026):

| движок | скорость | край |
|---|---|---|
| u2netp | 0,14 с | почти всё стёр, 3 % непрозрачных |
| u2net | 0,32 с | дырки нет, но тащит чёрный кусок у бедра и серый шлейф |
| isnet-general-use | 0,91 с | тащит неоновую полосу фона |
| birefnet-portrait | ~11 с | чистый край |
| **birefnet-general** | **~11 с** | **чистый край, просвет под рукой на месте** |

**BiRefNet убивало по памяти на втором кадре** - и это не размер входа, а
арена onnxruntime: она растёт от кадра к кадру и за несколько кадров
съедает всю память. `enable_cpu_mem_arena=False` держит процесс в 3 ГБ,
и сессия спокойно проходит всю заставку. Без этой строки скрипт умрёт
молча, кодом 137.

Поверх маски идёт чистка: мягкий порог убирает полупрозрачную дымку
фона, сжатие на пиксель снимает кайму, лёгкое размытие возвращает краю
мягкость. Рамка висит весь ролик - на ней видно каждый огрех.

    python3 вырезать.py
"""
import os
import time

ТУТ = os.path.dirname(os.path.abspath(__file__))
ВХОД = os.path.join(ТУТ, "кадры")
ВЫХОД = os.path.join(ТУТ, "без-фона")

ОБРЕЗ = (460, 0, 1180, 704)   # девушка в кадре заставки
НИЗ, ВЕРХ = 26, 224           # мягкий порог: ниже - в ноль, выше - в единицу


def чистая_альфа(маска):
    """Дымку в ноль, тело в единицу, кайму долой, край - мягкий."""
    import numpy as np
    from PIL import Image, ImageFilter
    a = np.asarray(маска, dtype=np.float32)
    a = np.clip((a - НИЗ) / (ВЕРХ - НИЗ), 0, 1) * 255
    и = Image.fromarray(a.astype("uint8"), mode="L")
    и = и.filter(ImageFilter.MinFilter(3))        # сжать на пиксель - каймы нет
    return и.filter(ImageFilter.GaussianBlur(0.7))


def главное():
    import onnxruntime as ort
    from PIL import Image
    from rembg.sessions.birefnet_general import BiRefNetSessionGeneral

    настройки = ort.SessionOptions()
    настройки.enable_cpu_mem_arena = False        # см. заметку в шапке
    настройки.enable_mem_pattern = False
    настройки.intra_op_num_threads = 3   # на четырёх процесс упирался в память
    с = BiRefNetSessionGeneral("birefnet-general", настройки)

    os.makedirs(ВЫХОД, exist_ok=True)
    файлы = sorted(f for f in os.listdir(ВХОД) if f.endswith(".png"))
    т = time.time()
    for i, имя in enumerate(файлы, 1):
        цель = os.path.join(ВЫХОД, имя)
        if os.path.exists(цель):
            continue
        и = Image.open(os.path.join(ВХОД, имя)).convert("RGB").crop(ОБРЕЗ)
        и.putalpha(чистая_альфа(с.predict(и)[0]))
        и.save(цель)
        if i % 10 == 0:
            print("  %d из %d, %.1f с/кадр" % (i, len(файлы), (time.time()-т)/i),
                  flush=True)
    подрезать(файлы)
    print("готово: %d кадров за %.0f с" % (len(файлы), time.time()-т), flush=True)


def подрезать(файлы):
    """Подрезать все кадры по ОБЩЕМУ следу движения.

    По кадру бы вышло дёрганье: у каждого свой край, и при подгонке под
    высоту девушка бы прыгала. Общий след - одна рамка на всю заставку,
    движение остаётся ровно таким, как в боте.
    """
    import numpy as np
    from PIL import Image
    л = в = 10**6
    п = н = -1
    for имя in файлы:
        a = np.asarray(Image.open(os.path.join(ВЫХОД, имя)))[:, :, 3]
        ys, xs = np.where(a > 24)
        if not len(xs):
            continue
        л, п = min(л, xs.min()), max(п, xs.max())
        в, н = min(в, ys.min()), max(н, ys.max())
    if п < 0:
        return
    рамка = (int(л), int(в), int(п) + 1, int(н) + 1)
    print("общий след:", рамка, flush=True)
    for имя in файлы:
        путь = os.path.join(ВЫХОД, имя)
        и = Image.open(путь)
        if и.size != (рамка[2]-рамка[0], рамка[3]-рамка[1]):
            и.crop(рамка).save(путь)


if __name__ == "__main__":
    главное()
