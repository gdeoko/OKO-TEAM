# -*- coding: utf-8 -*-
"""Реакции для чата и канала: да, нет, спасибо, одобряю, внимание, привет.

Без них пак мёртвый: планетой на сообщение не ответишь. Формы простые
нарочно - эти шесть чаще всего ставят размером со строку.
"""

from tgs import (CYAN, CYAN_DEEP, CYAN_LIT, CYAN_PALE, INK, INK_2, MIST,
                 SILVER, STEEL, VIOLET, VIOLET_DEEP, VIOLET_LIT, WHITE, anim,
                 circle, ellipse, fill, grad, group, gtr, layer, path, pulse,
                 rect, stroke, trim, val)
import brand_logo as BL
from parts import C, glow, shadow
from scenes_daily import _bounce, _pop, _shake, _swing, icon

OK_LIT, OK_GREEN, OK_DEEP = "#8CF5BE", "#3BE08A", "#0E8B4D"
BAD_LIT, BAD_RED, BAD_DEEP = "#FFB4B4", "#F87171", "#A32626"
WARN_LIT, WARN, WARN_DEEP = "#FFDD8F", "#FFC24B", "#C8850C"
LOVE_LIT, LOVE, LOVE_DEEP = "#FF9CB4", "#E33A6B", "#8E1B47"


def ok():
    """Готово."""
    return _pop(360, "#4CAF50", 155, 20, "2705")


def bad():
    """Не вышло."""
    return _shake(340, "#F44336", 150, 18, "274c")


def heart():
    """Спасибо."""
    return _pop(360, "#F44336", 155, 20, "2764")


def like():
    """Одобряю."""
    return _bounce(360, "#FFCA28", 150, 18, "1f44d")


def warn():
    """Внимание."""
    return _shake(360, "#FFB300", 150, 20, "26a0")


def hello():
    """Привет: фирменный знак выезжает и покачивается."""
    wave = anim([(0, -14), (36, 10), (72, -8), (108, 6), (144, -4),
                 (180, -14)])
    come = anim([(0, [C - 34, C + 44]), (34, [C, C]), (180, [C, C])])
    return [
        layer([group([glow(C, C, 180, CYAN_LIT, op=12)], name="g")],
              name="glow"),
        layer([BL.mark("cdn", 340, (C, C))], name="mark", pos=come, rot=wave),
    ]


SCENES = [
    ("ok",    ok,    "✅", "Готово"),
    ("bad",   bad,   "❌", "Не вышло"),
    ("heart", heart, "❤️", "Спасибо"),
    ("like",  like,  "👍", "Одобряю"),
    ("warn",  warn,  "⚠️", "Внимание"),
    ("hello", hello, "👋", "Привет"),
]
