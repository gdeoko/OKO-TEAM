# -*- coding: utf-8 -*-
"""Перенос настоящих планет NASA в векторные фигуры Lottie.

Требование владельца: планеты как в жизни, теми же текстурами, что
крутятся в полёте на сайте. Прямо вставить их нельзя - в .tgs картинок
нет вовсе. Поэтому текстура проходит весь путь честно:

  1. равнопромежуточная развёртка NASA раскладывается на шар -
     считается, какая точка текстуры видна в каждом пикселе диска;
  2. на диск ложится свет: терминатор, отражённый край, лимб;
  3. цвета сводятся к небольшому набору - глаз всё равно читает планету
     пятнами, а не пикселями;
  4. каждое пятно обводится контуром и упрощается, пока держит форму.

На выходе - слои фигур, которые рисуют ту же планету, но вектором и
весом в пару килобайт.

    python3 planet_trace.py <текстура.webp> <ключ> [диаметр] [цветов]
"""

import json
import os
import sys

import numpy as np
from PIL import Image
from skimage import measure


def project(img, size, lon0=0.0, tilt=0.0):
    """Развёртку - на диск планеты.

    Для каждого пикселя диска считается точка на сфере и берётся цвет
    текстуры в ней. Без этого текстура легла бы плоской заплатой, а не
    шаром: у шара к краю всё сжимается.
    """
    tex = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    th, tw = tex.shape[:2]
    r = size / 2.0
    y, x = np.mgrid[0:size, 0:size]
    nx = (x - r + 0.5) / r
    ny = (y - r + 0.5) / r
    rho2 = nx * nx + ny * ny
    inside = rho2 <= 1.0
    nz = np.sqrt(np.clip(1.0 - rho2, 0, 1))

    # наклон оси: planeta повёрнута к нам не строго экватором
    t = np.radians(tilt)
    ny2 = ny * np.cos(t) - nz * np.sin(t)
    nz2 = ny * np.sin(t) + nz * np.cos(t)

    lat = np.arcsin(np.clip(ny2, -1, 1))
    lon = np.arctan2(nx, np.clip(nz2, 1e-6, None)) + np.radians(lon0)

    u = ((lon / (2 * np.pi) + 0.5) % 1.0) * (tw - 1)
    v = (0.5 - lat / np.pi) * (th - 1)
    out = tex[np.clip(v.astype(int), 0, th - 1),
              np.clip(u.astype(int), 0, tw - 1)]
    return out, inside, nx, ny, nz


def light(rgb, inside, nx, ny, nz, sun=(-0.42, -0.40), ambient=0.46,
          rim=0.40, limb=0.26, gain=1.18):
    """Свет на шаре: дневная сторона, терминатор, отражённый край.

    Плоско залитая текстура выглядит наклейкой. Планету делает объёмной
    именно свет: яркая обращённая к солнцу сторона, мягкий переход в
    ночь и светлый ободок по краю, где атмосфера просвечивает.
    """
    lx, ly = sun
    lz = np.sqrt(max(1.0 - lx * lx - ly * ly, 0.01))
    lam = np.clip(nx * lx + ny * ly + nz * lz, 0, 1)
    # мягкая растяжка: терминатор не должен быть резаной границей
    day = ambient + (1.0 - ambient) * np.power(lam, 0.58)

    # gain: текстуры NASA сняты тёмными, на экране планета должна светиться
    out = rgb * day[..., None] * gain

    # отражённый свет по тёмному краю - планета не проваливается в чёрное
    back = np.clip(-(nx * lx + ny * ly + nz * lz), 0, 1)
    edge = np.power(np.clip(1.0 - nz, 0, 1), 2.2)
    out += rgb * (back * edge * rim)[..., None] * 0.9

    # лимб: свечение по самому краю диска
    out += (edge * limb)[..., None] * np.array([0.55, 0.72, 0.95])

    out = np.clip(out, 0, 1)
    out[~inside] = 0
    return out


def quantize(rgb, inside, levels=13):
    """Свести цвета к небольшому набору.

    Пятнами планета читается не хуже, чем пикселями, а весит на два
    порядка меньше. Набор берётся по самой картинке, а не задаётся: у
    Юпитера свои полосы, у Марса свои равнины.
    """
    px = rgb[inside].reshape(-1, 3)
    if len(px) > 40000:
        px = px[np.random.RandomState(7).choice(len(px), 40000, False)]
    # k-средних на небольшом наборе: быстро и без лишних зависимостей
    rs = np.random.RandomState(3)
    cent = px[rs.choice(len(px), levels, False)].copy()
    for _ in range(14):
        d = ((px[:, None, :] - cent[None, :, :]) ** 2).sum(2)
        lab = d.argmin(1)
        for i in range(levels):
            m = lab == i
            if m.any():
                cent[i] = px[m].mean(0)
    d = ((rgb.reshape(-1, 1, 3) - cent[None, :, :]) ** 2).sum(2)
    idx = d.argmin(1).reshape(rgb.shape[:2])
    idx[~inside] = -1
    return idx, cent


def _area(c):
    """Площадь контура: по ней отсеивается крап квантования."""
    x = c[:, 1]
    y = c[:, 0]
    return abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1))) / 2.0


def contours(idx, value, simplify=1.4, min_area=90.0):
    """Контуры одного цвета. Мелочь отбрасывается, остальное упрощается.

    Без порога по площади диск покрывается крапом из одиночных пятен:
    глаз читает его как грязь, а вес растёт втрое.
    """
    mask = (idx == value).astype(np.float32)
    if mask.sum() < 40:
        return []
    # сглаживание маски убирает зубчатость на границе пятен
    from scipy.ndimage import uniform_filter
    mask = uniform_filter(mask, size=3)
    out = []
    for c in measure.find_contours(mask, 0.5):
        if len(c) < 10 or _area(c) < min_area:
            continue
        c = measure.approximate_polygon(c, tolerance=simplify)
        if len(c) < 4:
            continue
        out.append([(float(p[1]), float(p[0])) for p in c])
    return out


def trace(path, size=300, levels=13, tilt=0.0, lon0=0.0, simplify=1.4,
          sun=(-0.42, -0.40), min_area=90.0):
    """Текстура -> список (цвет, контуры) от тёмного к светлому."""
    img = Image.open(path)
    rgb, inside, nx, ny, nz = project(img, size, lon0, tilt)
    lit = light(rgb, inside, nx, ny, nz, sun=sun)
    idx, cent = quantize(lit, inside, levels)

    # база: средний цвет освещённого диска. Она рисуется сплошным кругом,
    # поэтому дырок в планете не бывает, чем бы ни закончился фильтр.
    base = lit[inside].reshape(-1, 3).mean(0)
    base_hex = "#%02X%02X%02X" % tuple(int(round(v * 255)) for v in base)

    # порядок: сперва крупные тёмные пятна, сверху мелкие светлые
    order = sorted(range(levels), key=lambda i: cent[i].mean())
    layers = []
    for i in order:
        cs = contours(idx, i, simplify, min_area)
        if not cs:
            continue
        col = "#%02X%02X%02X" % tuple(int(round(v * 255)) for v in cent[i])
        layers.append((col, cs))
    return layers, size, base_hex


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    src, key = sys.argv[1], sys.argv[2]
    size = int(sys.argv[3]) if len(sys.argv) > 3 else 300
    levels = int(sys.argv[4]) if len(sys.argv) > 4 else 13
    layers, size, base = trace(src, size, levels)
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "..", "src", "planets", key + ".json")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as f:
        json.dump({"size": size, "base": base,
                   "layers": [{"c": c, "p": [[[round(x, 1), round(y, 1)]
                                              for x, y in cs]
                                             for cs in css]}
                              for c, css in layers]}, f)
    pts = sum(len(c) for _, cs in layers for c in cs)
    print("%-9s %d пятен, %d точек -> %s" %
          (key, len(layers), pts, os.path.basename(dest)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
