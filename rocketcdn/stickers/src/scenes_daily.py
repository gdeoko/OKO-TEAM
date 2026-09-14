# -*- coding: utf-8 -*-
"""Ходовые эмодзи: то, что ставят каждый день.

Планетой на «спасибо» не ответишь, а этих ставят десятками раз в день.

Формы берутся готовыми из открытого набора Noto Emoji (Apache 2.0) и
переводятся в фигуры тем же конвертером, что переносит фирменный
логотип. Причина простая: руки, лица и жесты, нарисованные от руки
прямоугольниками, выходят кривыми, а узнаются такие знаки как раз по
точности формы.

Фирменным остаётся всё остальное - брендовое свечение под предметом,
свет и характер движения: подскок с отскоком, дрожь, пульс.
"""

import os

from tgs import (CYAN, CYAN_DEEP, CYAN_LIT, CYAN_PALE, INK, VIOLET,
                 VIOLET_LIT, WHITE, anim, circle, fill, group, gtr, layer,
                 pulse, spring, val)
from parts import C, glow, shadow
from svg2lottie import convert

ICONS = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     "..", "assets", "emoji")
_cache = {}


def icon(code, size=380, pos=(C, C), name="icon"):
    """Иконка из набора, вписанная в квадрат size и поставленная в pos."""
    if code not in _cache:
        _cache[code] = convert(os.path.join(ICONS, code + ".svg"))
    groups, w, h = _cache[code]
    k = float(size) / max(w, h)
    return group(list(groups),
                 gtr(pos=(pos[0] - w * k / 2.0, pos[1] - h * k / 2.0),
                     scale=(k * 100, k * 100)), name=name)


# --- характеры движения ------------------------------------------------
#
# Один и тот же приём на всех сделал бы пак мёртвым, поэтому движений
# несколько, и каждое подобрано под смысл знака.

def _pop(size=380, tint=CYAN_LIT, halo=150, op=16, code=None):
    """Появление с отскоком: знак прилетает и коротко качается."""
    return [
        layer([group([glow(C, C, halo, tint, op=op)], name="g")],
              name="glow"),
        layer([icon(code, size)], name="icon",
              scale=spring(0, 34, [62, 62], [100, 100], over=0.18)),
    ]


def _breathe(size=380, tint=CYAN_LIT, halo=150, op=16, code=None,
             times=2, lo=97, hi=104):
    """Дыхание: знак мерно пульсирует."""
    return [
        layer([group([glow(C, C, halo, tint, op=op)], name="g")],
              name="glow"),
        layer([icon(code, size)], name="icon",
              scale=pulse([lo, lo], [hi, hi], times=times)),
    ]


def _bounce(size=380, tint=CYAN_LIT, halo=150, op=16, code=None):
    """Подскок: знак подпрыгивает и приземляется с наклоном."""
    jump = anim([(0, [C, C + 16]), (22, [C, C - 28], "out"),
                 (42, [C, C + 6]), (56, [C, C - 5]), (68, [C, C]),
                 (180, [C, C])])
    tilt = anim([(0, -10), (22, 6, "out"), (42, -3), (58, 1), (68, 0),
                 (180, 0)])
    return [
        layer([shadow(C, C + 196, 118, 18, op=20)], name="shadow"),
        layer([group([glow(C, C, halo, tint, op=op)], name="g")],
              name="glow"),
        layer([icon(code, size)], name="icon", pos=jump, rot=tilt),
    ]


def _shake(size=380, tint=CYAN_LIT, halo=150, op=16, code=None):
    """Дрожь: знак трясётся, будто на нервах."""
    r = anim([(0, 0), (12, -6), (24, 6), (36, -4), (48, 4), (60, -2),
              (72, 0), (120, 0), (132, -5), (144, 4), (156, -2), (168, 0),
              (180, 0)])
    sc = anim([(0, [100, 100]), (12, [104, 96]), (30, [97, 104]),
               (48, [102, 98]), (66, [100, 100]), (180, [100, 100])])
    return [
        layer([group([glow(C, C, halo, tint, op=op)], name="g")],
              name="glow"),
        layer([icon(code, size)], name="icon", rot=r, scale=sc),
    ]


def _swing(size=380, tint=CYAN_LIT, halo=150, op=16, code=None):
    """Покачивание: знак машет из стороны в сторону."""
    r = anim([(0, -14), (36, 14, "out"), (72, -10), (108, 10), (144, -6),
              (180, -14)])
    return [
        layer([group([glow(C, C, halo, tint, op=op)], name="g")],
              name="glow"),
        layer([icon(code, size)], name="icon", rot=r),
    ]


def _rise(size=380, tint=CYAN_LIT, halo=150, op=16, code=None):
    """Всплытие: знак выезжает снизу и мягко встаёт."""
    up = spring(0, 44, [C, C + 70], [C, C], over=0.10)
    o = anim([(0, 0), (10, 100), (180, 100)])
    return [
        layer([group([glow(C, C, halo, tint, op=op)],
                     gtr(opacity=anim([(0, 0), (30, 100), (180, 100)])),
                     name="g")], name="glow"),
        layer([group([icon(code, size, (0, 0))], gtr(opacity=o), name="i")],
              name="icon", pos=up),
    ]


# --- сюжеты ------------------------------------------------------------

def hundred():
    """Сто из ста."""
    return _pop(370, "#F44336", 160, 18, "1f4af")


def money_bag():
    """Мешок денег."""
    return _bounce(360, "#FFCA28", 150, 18, "1f4b0")


def handshake():
    """Договорились."""
    return _pop(390, CYAN_LIT, 150, 16, "1f91d")


def smile():
    """Улыбка."""
    return _bounce(360, "#FFCA28", 150, 18, "1f604")


def phone():
    """Связь."""
    return _breathe(340, CYAN_LIT, 145, 18, "1f4f2")


def secure():
    """Зашифровано."""
    return _breathe(340, VIOLET_LIT, 145, 18, "1f50f")


def pray():
    """Спасибо."""
    return _breathe(360, CYAN_LIT, 155, 20, "1f64f", times=2, lo=98, hi=104)


def mind_blown():
    """Взрыв мозга."""
    return _shake(370, "#FF7043", 160, 20, "1f92f")


def cry():
    """Плачу."""
    return _shake(360, CYAN_LIT, 150, 16, "1f62d")


def facepalm():
    """Рука-лицо."""
    return _breathe(370, "#FFCA28", 150, 14, "1f926", times=1, lo=99, hi=103)


def party():
    """Праздник."""
    return _bounce(370, VIOLET_LIT, 155, 20, "1f973")


def laugh():
    """Смех."""
    return _shake(360, "#FFCA28", 150, 18, "1f602")


def popper():
    """Хлопушка."""
    return _pop(380, "#FFCA28", 160, 20, "1f389")


def megaphone():
    """Объявление."""
    return _swing(360, CYAN_LIT, 150, 18, "1f4e2")


def battery():
    """Заряд."""
    return _breathe(330, "#4CAF50", 140, 18, "1f50b")


def cash():
    """Наличные."""
    return _bounce(360, "#4CAF50", 150, 18, "1f4b5")


def money_fly():
    """Деньги улетают."""
    return _swing(370, "#4CAF50", 150, 16, "1f4b8")


def wave():
    """Привет."""
    return _swing(350, CYAN_LIT, 150, 18, "1f44b")


def star():
    """Звезда."""
    return _pop(340, "#FFCA28", 150, 20, "1f31f")


def brain():
    """Голова работает."""
    return _breathe(350, VIOLET_LIT, 150, 18, "1f9e0")


SCENES = [
    ("hundred",  hundred,    "💯", "Сто из ста"),
    ("bag",      money_bag,  "💰", "Деньги"),
    ("deal",     handshake,  "🤝", "Договорились"),
    ("smile",    smile,      "😄", "Улыбка"),
    ("phone",    phone,      "📲", "Связь"),
    ("secure",   secure,     "🔏", "Зашифровано"),
    ("pray",     pray,       "🙏", "Спасибо"),
    ("blown",    mind_blown, "🤯", "Взрыв мозга"),
    ("cry",      cry,        "😭", "Плачу"),
    ("facepalm", facepalm,   "🤦", "Рука-лицо"),
    ("party",    party,      "🥳", "Праздник"),
    ("laugh",    laugh,      "😂", "Смех"),
    ("popper",   popper,     "🎉", "Хлопушка"),
    ("shout",    megaphone,  "📢", "Объявление"),
    ("battery",  battery,    "🔋", "Заряд"),
    ("cash",     cash,       "💵", "Наличные"),
    ("flyaway",  money_fly,  "💸", "Деньги улетают"),
    ("wave",     wave,       "👋", "Привет"),
    ("star",     star,       "🌟", "Звезда"),
    ("brain",    brain,      "🧠", "Голова работает"),
]
