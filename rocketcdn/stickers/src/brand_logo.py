# -*- coding: utf-8 -*-
"""Настоящий знак Rocket: «R» с ракетой, взятая из фирменного вектора.

Берём только знак - надписи «RocketCDN», «RocketVPN» и слоган отрезаны:
в стикере они не читаются, а в эмодзи размером со строку превращаются
в грязь. Знак и есть то, по чему бренд узнают.

Два вида заливки:
  оригинал  - родные градиенты логотипа, как в фирменном файле;
  монохром  - знак одним цветом, силуэтом. Нужен там, где картинка
              мелкая или лежит на цветной подложке.
"""

import os

from svg2lottie import convert
from tgs import CYAN, CYAN_DEEP, CYAN_LIT, VIOLET, VIOLET_LIT, fill, grad, \
    group, gtr, path, val

# фирменные файлы лежат в самом проекте, рядом с сайтом
ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "..", "..", "assets")
SOURCES = {
    "cdn": os.path.join(ASSETS, "brand", "rocketcdn-logo-vector.svg"),
    "vpn": os.path.join(ASSETS, "rocketvpn-logo.svg"),
}

# группы знака в фирменном файле; дальше идут надпись и слоган
MARK_GROUPS = 13
# внутри знака: сперва корпус ракеты с иллюминатором, потом сама буква
ROCKET_GROUPS = slice(0, 5)
LETTER_GROUPS = slice(5, 13)

# рамки частей знака в координатах исходника
ROCKET_BOX = {"cdn": (197.0, 67.0, 371.0, 241.0),
              "vpn": (169.0, 152.0, 285.0, 268.0)}

# рамка знака в координатах исходника: (x0, y0, x1, y1)
MARK_BOX = {"cdn": (199.0, 0.0, 457.0, 293.0),
            "vpn": (169.0, 107.0, 343.0, 303.0)}

_cache = {}


def _load(brand):
    if brand not in _cache:
        groups, w, h = convert(SOURCES[brand])
        _cache[brand] = groups[:MARK_GROUPS]
    return _cache[brand]


def _recolor(items, color, opacity=100):
    """Заменить все заливки одним цветом - получить силуэт знака."""
    out = []
    for it in items:
        if it.get("ty") == "gr":
            out.append({"ty": "gr", "nm": it.get("nm", "g"),
                        "it": _recolor(it["it"], color, opacity)})
        elif it.get("ty") in ("fl", "gf"):
            out.append(fill(color, opacity))
        else:
            out.append(it)
    return out


def trail(brand="cdn", color=None, op=88):
    """Шлейф скорости за ракетой.

    В фирменном файле он единственный кусок, залитый картинкой, а в .tgs
    картинок нет. Поэтому шлейф собран вектором по тем же трём полосам,
    под тем же углом и с тем же затуханием, что в оригинале.
    """
    lit = color or CYAN_LIT
    deep = color or CYAN
    # смещение вдоль сопла, ширина у начала, длина - как в оригинале
    bands = [(-6, 26, 165), (24, 18, 128), (48, 12, 96)]
    out = []
    for i, (off, wide, long_) in enumerate(bands):
        # полоса выходит прямо из сопла влево-вниз под 45 и сходит на нет
        p = path([(off, off),
                  (off + wide, off + wide),
                  (off + wide - long_ * 0.72, off + wide + long_ * 0.72),
                  (off - long_ * 0.72, off + long_ * 0.72)])
        out.append(group([p, grad(
            [(0, lit), (0.55, deep), (1, deep)],
            (off, off), (off - long_ * 0.7, off + long_ * 0.7),
            opacity=val(max(op - i * 16, 20)))], name="band%d" % i))
    return group(out, name="trail")


def mark(brand="cdn", size=300, pos=(256, 256), color=None, opacity=100,
         with_trail=True, name="mark"):
    """Знак Rocket нужного размера, поставленный центром в pos.

    size - сторона квадрата, в который вписывается знак; пропорции
    сохраняются всегда, знак не растягивается.
    """
    x0, y0, x1, y1 = MARK_BOX[brand]
    w, h = x1 - x0, y1 - y0
    k = float(size) / max(w, h)
    items = list(_load(brand))
    if color:
        items = _recolor(items, color, 100)
    inner = []
    if with_trail:
        # шлейф выходит из сопла ракеты, координаты сопла в файле знака
        nozzle = (x0 + w * 0.22, y0 + h * 0.52)
        inner.append(group([trail(brand, color)],
                           gtr(pos=nozzle), name="trail"))
    inner += items
    # переносим знак в начало координат, потом ставим куда просят
    return group(inner,
                 gtr(pos=pos, anchor=(x0 + w / 2.0, y0 + h / 2.0),
                     scale=(k * 100, k * 100), opacity=opacity),
                 name=name)


def rocket(brand="cdn", size=180, pos=(256, 256), color=None, rot=0,
           opacity=100, with_trail=True, name="rocket"):
    """Только ракета из фирменного знака - без буквы.

    Ею летают все сюжеты пака: это та самая ракета логотипа, а не
    похожая на неё.
    """
    x0, y0, x1, y1 = ROCKET_BOX[brand]
    w, h = x1 - x0, y1 - y0
    k = float(size) / max(w, h)
    items = list(_load(brand)[ROCKET_GROUPS])
    if color:
        items = _recolor(items, color, 100)
    inner = []
    if with_trail:
        inner.append(group([trail(brand, color)],
                           gtr(pos=(x0 + w * 0.30, y0 + h * 0.62)),
                           name="trail"))
    inner += items
    return group(inner,
                 gtr(pos=pos, anchor=(x0 + w / 2.0, y0 + h / 2.0),
                     scale=(k * 100, k * 100), rot=rot, opacity=opacity),
                 name=name)


def letter(brand="cdn", size=300, pos=(256, 256), color=None, opacity=100,
           name="letter"):
    """Только буква R из знака, без ракеты."""
    x0, y0, x1, y1 = MARK_BOX[brand]
    w, h = x1 - x0, y1 - y0
    k = float(size) / max(w, h)
    items = list(_load(brand)[LETTER_GROUPS])
    if color:
        items = _recolor(items, color, 100)
    return group(items,
                 gtr(pos=pos, anchor=(x0 + w / 2.0, y0 + h / 2.0),
                     scale=(k * 100, k * 100), opacity=opacity), name=name)
