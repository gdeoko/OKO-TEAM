# -*- coding: utf-8 -*-
"""Фирменный знак Rocket: настоящий вектор, объём и свет от кода.

Правило владельца жёсткое: лого только настоящее, 1:1, не перерисовывать.
Поэтому форма и цвета берутся из его же файла, а кодом добавляется то,
чего в плоском файле нет: толщина, фаска, отражение студии, бегущий блик
и фирменное свечение следа.

Расстояние до края считается прямо по маске знака (преобразование
расстояний), дальше всё как в движке объёма: высота, нормали, свет.
Значит объём получает ЛЮБАЯ форма, а не только собранная из кругов.
"""

import os

import numpy as np
from PIL import Image
from scipy import ndimage

import obyom as O

ЗНАК = "/opt/oko-poster/rocketpack/logo.png"


def _маска_и_цвет(путь, поле, доля=0.86):
    """Знак по центру листа: маска, свои цвета и расстояние до края."""
    im = Image.open(путь).convert("RGBA")
    bb = im.split()[3].getbbox()
    if bb:
        im = im.crop(bb)
    k = (поле * доля) / float(max(im.size))
    nw, nh = max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k))
    im = im.resize((nw, nh), Image.LANCZOS)
    лист = Image.new("RGBA", (поле, поле), (0, 0, 0, 0))
    лист.paste(im, ((поле - nw) // 2, (поле - nh) // 2))
    a = np.asarray(лист).astype(np.float32)
    м = a[..., 3] / 255.0
    цвет = a[..., :3] / 255.0
    # расстояние до края в долях листа: внутри отрицательное, как у SDF
    внутрь = ndimage.distance_transform_edt(м > 0.5)
    наружу = ndimage.distance_transform_edt(м <= 0.5)
    sdf = (наружу - внутрь) / float(поле) * 2.0
    return м, цвет, sdf.astype(np.float32)


_кэш = {}


def _знак(поле):
    if поле not in _кэш:
        _кэш[поле] = _маска_и_цвет(ЗНАК, поле)
    return _кэш[поле]


def кадр(поле, t):
    м, цвет, sdf = _знак(поле)
    x, y = O.лист(поле)

    # Толщина знака: у ракеты и буквы она одна, поэтому фаска общая.
    h = O.высота(sdf, фаска=0.022, выпукл=0.35)
    nx, ny, nz = O.нормали(h, сила=1.15, размыв=1.2)

    # Свет: мягкий сверху слева, отражение студии, фирменный ободок.
    lx, ly = -0.42, -0.58
    lz = np.sqrt(max(1.0 - lx * lx - ly * ly, 0.05))
    лам = np.clip(nx * lx + ny * ly + nz * lz, 0, 1)
    зерк = O.среда(nx, ny, nz)

    из = цвет * (0.58 + 0.46 * лам)[..., None] + зерк * 0.28

    hx, hy, hz = lx, ly, lz + 1.0
    дл = np.sqrt(hx * hx + hy * hy + hz * hz)
    спек = np.clip(nx * hx / дл + ny * hy / дл + nz * hz / дл, 0, 1)
    из = из + np.power(спек, 120.0)[..., None] * 0.9

    # Блик идёт ПО ЗНАКУ, а не мигает целиком: полоса проходит наискось
    # и цепляет только выпуклости. Ровно так свет ведёт себя на металле.
    ход = -1.5 + 3.0 * ((t * 1.0) % 1.0)
    d = (x * 0.86 + y * 0.52) - ход
    полоса = np.exp(-(d * d) / (2 * 0.13 ** 2))
    из = из + (полоса * np.clip(лам, 0.25, 1.0))[..., None] * 0.55

    ребро = np.clip(1.0 - nz, 0, 1) ** 2.0
    из = из + ребро[..., None] * np.array(O.CYAN_LIT, np.float32) / 255.0 * 0.45

    тело = np.zeros((поле, поле, 4), np.uint8)
    тело[..., :3] = (np.clip(из, 0, 1) * 255).astype(np.uint8)
    тело[..., 3] = (np.clip(м * 1.02, 0, 1) * 255).astype(np.uint8)

    # След за ракетой и так фирменного цвета - подсвечиваем его, а не
    # рисуем поверх новое пятно: наклеенное свечение видно сразу.
    синий = np.clip((цвет[..., 2] - цвет[..., 0] * 1.05) * 3.0, 0, 1) * м
    пульс = 0.45 + 0.55 * (0.5 + 0.5 * np.sin(t * 2 * np.pi))
    гало = O.свечение(синий, O.CYAN_LIT, 0.055, 0.75 * пульс)

    тень = O.тень(sdf, размыв=0.028, сдвиг=(0.0, 0.026), сила=0.30)
    # лёгкое дыхание: знак чуть поднимается и опускается
    сдв = int(round(поле * 0.012 * np.sin(t * 2 * np.pi)))
    слои = O.слить(тень, гало, тело)
    if сдв:
        подвинут = Image.new("RGBA", (поле, поле), (0, 0, 0, 0))
        подвинут.paste(слои, (0, -сдв))
        return подвинут
    return слои


def собрать(поле=512, кадров=90):
    return [кадр(поле, i / float(кадров)) for i in range(кадров)]


def выпустить(дом="/opt/oko-poster/rocketpack", ключ="logo"):
    import foto_sticker as F
    ks = собрать(F.SIZE, F.FRAMES)
    for п, пред, ст in ((os.path.join(дом, "out"), F.LIMIT, None),
                        (os.path.join(дом, "out_emo"), F.LIMIT_EMO,
                         F.SIDE_EMO)):
        os.makedirs(п, exist_ok=True)
        br, n = F.собрать(ks, os.path.join(п, ключ + ".webm"), пред, ст)
        print("%-8s -> %-8s %3d кб (%s)" % (ключ, os.path.basename(п),
                                            n // 1024, br))


if __name__ == "__main__":
    import sys
    if "--выпустить" in sys.argv:
        выпустить()
        raise SystemExit(0)
    ks = собрать(340, 8)
    K = 220
    л = Image.new("RGB", (K * 4, K), (246, 246, 246))
    px = л.load()
    for yy in range(K):
        for xx in range(л.width):
            if ((xx // 11) + (yy // 11)) % 2:
                px[xx, yy] = (224, 224, 224)
    for i, n in enumerate((0, 2, 4, 6)):
        e = ks[n].resize((K, K), Image.LANCZOS)
        л.paste(e, (K * i, 0), e)
    л.save("/opt/oko-poster/rocketpack/kl.png")
    print("готово")
