# -*- coding: utf-8 -*-
"""Планеты: настоящий шар с текстурой NASA, вращение считается кодом.

Прошлый подход обводил текстуру контурами и выдавал плоское пятно.
Здесь шар настоящий: для каждой точки диска считается точка на сфере,
из неё берётся цвет равнопромежуточной развёртки NASA, и сверху ложится
свет - дневная сторона, терминатор, лимб, атмосфера.

Вращение это сдвиг долготы от кадра к кадру. За три секунды шар делает
полный оборот, поэтому петля сходится сама: после 360 градусов картинка
та же, что была в начале, и склейки не видно.

    python3 kod_planeta.py <ключ>      earth jupiter mars saturn moon sun
"""

import os

import numpy as np
from PIL import Image
from scipy import ndimage

ТЕКС = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tex")
ПОДРОБНО = 2          # считаем вдвое крупнее и ужимаем: край выходит гладким


def _тек(имя):
    return np.asarray(Image.open(os.path.join(ТЕКС, имя)).convert("RGB"),
                      dtype=np.float32) / 255.0


# Широта считается ПЛЮСОМ, а не минусом: на листе ось y растёт вниз, и
# минус разворачивал карту - Антарктида уезжала на север. Поймано глазом
# на первом же прогоне Земли.
def _взять(тек, u, v):
    """Билинейная выборка по развёртке, с заворотом по долготе."""
    h, w = тек.shape[:2]
    fx = (u % 1.0) * (w - 1)
    fy = np.clip(v, 0.0, 1.0) * (h - 1)
    x0 = np.floor(fx).astype(np.int32)
    y0 = np.floor(fy).astype(np.int32)
    x1 = (x0 + 1) % w
    y1 = np.minimum(y0 + 1, h - 1)
    ax = (fx - x0)[..., None]
    ay = (fy - y0)[..., None]
    верх = тек[y0, x0] * (1 - ax) + тек[y0, x1] * ax
    низ = тек[y1, x0] * (1 - ax) + тек[y1, x1] * ax
    return верх * (1 - ay) + низ * ay


def _сфера(n, радиус, наклон):
    """Сетка диска: нормали, маска и мягкий край."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    c = (n - 1) / 2.0
    nx = (x - c) / (радиус * c)
    ny = (y - c) / (радиус * c)
    r2 = nx * nx + ny * ny
    nz = np.sqrt(np.clip(1.0 - r2, 0, 1))
    край = np.clip((1.0 - np.sqrt(r2)) * радиус * c * 1.4, 0, 1)
    t = np.radians(наклон)
    ny2 = ny * np.cos(t) - nz * np.sin(t)
    nz2 = ny * np.sin(t) + nz * np.cos(t)
    return nx, ny, nz, ny2, nz2, край


def _свет(цвет, nx, ny, nz, солнце, ambient, лимб, край_цвет, край_сила):
    lx, ly = солнце
    lz = np.sqrt(max(1.0 - lx * lx - ly * ly, 0.02))
    лам = np.clip(nx * lx + ny * ly + nz * lz, 0, 1)
    день = ambient + (1.0 - ambient) * np.power(лам, 0.62)
    из = цвет * день[..., None]
    ребро = np.power(np.clip(1.0 - nz, 0, 1), 2.4)
    из = из * (1.0 - ребро * лимб)[..., None]
    if край_сила:
        оц = np.array(край_цвет, np.float32)
        из = из + (ребро * край_сила * (0.25 + 0.75 * лам))[..., None] * оц
    return из, лам


def _диск(n, цвет, альфа):
    out = np.zeros((n, n, 4), np.float32)
    out[..., :3] = np.clip(цвет, 0, 1) * 255.0
    out[..., 3] = np.clip(альфа, 0, 1) * 255.0
    return out


# --- планеты -----------------------------------------------------------

def земля(n, доля):
    nx, ny, nz, ny2, nz2, край = _сфера(n, 0.86, 23.4)
    лат = 0.5 + np.arcsin(np.clip(ny2, -1, 1)) / np.pi
    лон = np.arctan2(nx, np.maximum(nz2, 1e-6)) / (2 * np.pi) + доля
    день = _взять(_тек("2k_earth_daymap.jpg"), лон, лат)
    ночь = _взять(_тек("2k_earth_nightmap.jpg"), лон, лат)
    обл = _взять(_тек("2k_earth_clouds.jpg"), лон * 1.0 + 0.02, лат)[..., 0]

    цв, лам = _свет(день, nx, ny, nz, (-0.46, -0.34), 0.06, 0.30,
                    (0.34, 0.62, 0.95), 0.55)
    # Ночная сторона это не чернота, а огни городов. Без них половина шара
    # проваливается в пустоту и планета выглядит обкусанной.
    тьма = np.clip(1.0 - лам * 3.2, 0, 1)
    цв = цв + ночь * (тьма ** 1.4)[..., None] * 1.25
    # облака идут поверх, освещённые тем же солнцем
    о = np.clip((обл - 0.16) / 0.84, 0, 1) * np.clip(лам * 1.25, 0, 1)
    цв = цв * (1 - о * 0.82)[..., None] + o_бел(o=о) * 0.82
    return _диск(n, цв, край)


def o_бел(o):
    return np.dstack([o, o, o]).astype(np.float32)


def _простая(n, файл, наклон, солнце, ambient, лимб, край_цвет, край_сила,
             доля, радиус=0.86, усиление=1.0):
    nx, ny, nz, ny2, nz2, край = _сфера(n, радиус, наклон)
    лат = 0.5 + np.arcsin(np.clip(ny2, -1, 1)) / np.pi
    лон = np.arctan2(nx, np.maximum(nz2, 1e-6)) / (2 * np.pi) + доля
    тек = _взять(_тек(файл), лон, лат) * усиление
    цв, _ = _свет(тек, nx, ny, nz, солнце, ambient, лимб, край_цвет,
                  край_сила)
    return _диск(n, цв, край), (nx, ny, nz, край)


def юпитер(n, доля):
    д, _ = _простая(n, "2k_jupiter.jpg", 3.1, (-0.46, -0.34), 0.10, 0.34,
                    (0.55, 0.62, 0.80), 0.28, доля, 0.88, 1.06)
    return д


def марс(n, доля):
    д, _ = _простая(n, "2k_mars.jpg", 25.2, (-0.46, -0.34), 0.09, 0.32,
                    (0.85, 0.55, 0.40), 0.30, доля, 0.84, 1.10)
    return д


def луна(n, доля):
    д, _ = _простая(n, "2k_moon.jpg", 6.7, (-0.52, -0.30), 0.045, 0.30,
                    (0.60, 0.68, 0.85), 0.22, доля, 0.85, 1.16)
    return д


def солнце(n, доля):
    """Солнце само себе источник: тени на нём нет, есть корона."""
    nx, ny, nz, ny2, nz2, край = _сфера(n, 0.74, 7.25)
    лат = 0.5 + np.arcsin(np.clip(ny2, -1, 1)) / np.pi
    лон = np.arctan2(nx, np.maximum(nz2, 1e-6)) / (2 * np.pi) + доля
    тек = _взять(_тек("2k_sun.jpg"), лон, лат)
    ребро = np.power(np.clip(1.0 - nz, 0, 1), 2.0)
    цв = тек * (1.25 - 0.35 * ребро)[..., None]
    диск = _диск(n, цв, край)

    корона = ndimage.gaussian_filter(край, n * 0.035)
    корона = np.clip(корона - край, 0, 1)
    гало = np.zeros((n, n, 4), np.float32)
    гало[..., :3] = np.array([255, 176, 70], np.float32)
    гало[..., 3] = np.clip(корона * 2.6, 0, 1) * 210
    out = Image.alpha_composite(Image.fromarray(гало.astype(np.uint8), "RGBA"),
                                Image.fromarray(диск.astype(np.uint8), "RGBA"))
    return np.asarray(out).astype(np.float32)


def сатурн(n, доля):
    """Шар и кольца: кольца идут и за шаром, и перед ним.

    Нарисовать их одним слоем нельзя - кольцо проходит ЗА планетой и
    ПЕРЕД ней, и если положить его целиком сверху, полоса пересечёт шар
    посередине. Поэтому диск колец делится по глубине на дальнюю и
    ближнюю половину, а между ними встаёт планета.
    """
    наклон = 26.7
    шар, (nx, ny, nz, край) = _простая(n, "2k_saturn.jpg", наклон,
                                       (-0.46, -0.30), 0.10, 0.30,
                                       (0.80, 0.72, 0.55), 0.24, доля,
                                       0.50, 1.05)
    y, x = np.mgrid[0:n, 0:n].astype(np.float32)
    c = (n - 1) / 2.0
    ux = (x - c) / c
    uy = (y - c) / c
    t = np.radians(наклон)
    # кольца лежат в плоскости экватора: сжимаем по вертикали на синус
    ry = uy / max(np.sin(t), 0.08)
    rr = np.hypot(ux, ry)
    внутр, внеш = 0.62, 1.02
    кольцо = (rr >= внутр) & (rr <= внеш)
    доляr = np.clip((rr - внутр) / (внеш - внутр), 0, 1)
    рт = np.asarray(Image.open(os.path.join(ТЕКС, "2k_saturn_ring_alpha.png"))
                    .convert("RGBA"), dtype=np.float32) / 255.0
    иx = np.clip((доляr * (рт.shape[1] - 1)).astype(np.int32), 0,
                 рт.shape[1] - 1)
    полоса = рт[0, иx]
    ка = полоса[..., 3] * кольцо
    кц = полоса[..., :3]
    if кц.max() < 0.05:
        кц = np.ones_like(кц) * np.array([0.86, 0.80, 0.68], np.float32)

    # тень планеты на кольцах и тень колец на планете
    тень_к = np.clip(1.0 - np.exp(-((ux + 0.22) ** 2) / 0.02), 0.35, 1.0)
    тень_к = np.where((uy > 0) & (np.abs(ux) < 0.55), тень_к, 1.0)
    кц = кц * (0.55 + 0.45 * тень_к)[..., None]

    дальше = uy < 0
    сл = []
    for маска in (дальше, ~дальше):
        a = ка * маска
        сл.append(_диск(n, кц, a))
    итог = Image.alpha_composite(
        Image.fromarray(сл[0].astype(np.uint8), "RGBA"),
        Image.fromarray(шар.astype(np.uint8), "RGBA"))
    итог = Image.alpha_composite(
        итог, Image.fromarray(сл[1].astype(np.uint8), "RGBA"))
    return np.asarray(итог).astype(np.float32)


ПЛАНЕТЫ = {"earth": земля, "jupiter": юпитер, "mars": марс, "moon": луна,
           "sun": солнце, "saturn": сатурн}


def собрать(ключ, размер=512, кадров=90):
    ф = ПЛАНЕТЫ[ключ]
    n = размер * ПОДРОБНО
    out = []
    for i in range(кадров):
        доля = i / float(кадров)          # полный оборот: петля сходится
        a = ф(n, доля)
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
        out.append(im.resize((размер, размер), Image.LANCZOS))
    return out


def выпустить(ключ, дом="/opt/oko-poster/rocketpack"):
    import foto_sticker as F
    ks = собрать(ключ, F.SIZE, F.FRAMES)
    for папка, предел, сторона in ((os.path.join(дом, "out"), F.LIMIT, None),
                                   (os.path.join(дом, "out_emo"),
                                    F.LIMIT_EMO, F.SIDE_EMO)):
        os.makedirs(папка, exist_ok=True)
        br, n = F.собрать(ks, os.path.join(папка, ключ + ".webm"), предел,
                          сторона)
        print("%-8s -> %-8s %3d кб (%s)" % (ключ, os.path.basename(папка),
                                            n // 1024, br))


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 2 and sys.argv[2] == "--выпустить":
        выпустить(sys.argv[1])
    else:
        ks = собрать(sys.argv[1], 300, 6)
        л = Image.new("RGB", (300 * 6, 300), (16, 18, 24))
        for i, e in enumerate(ks):
            f = Image.new("RGB", (300, 300), (16, 18, 24))
            f.paste(e, (0, 0), e)
            л.paste(f, (300 * i, 0))
        л.save("/opt/oko-poster/rocketpack/pl_%s.png" % sys.argv[1])
        print("готово", sys.argv[1])
