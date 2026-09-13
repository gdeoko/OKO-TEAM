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
from parts import C, glow, shadow, sphere

OK_LIT, OK_GREEN, OK_DEEP = "#8CF5BE", "#3BE08A", "#0E8B4D"
BAD_LIT, BAD_RED, BAD_DEEP = "#FFB4B4", "#F87171", "#A32626"
WARN_LIT, WARN, WARN_DEEP = "#FFDD8F", "#FFC24B", "#C8850C"
LOVE_LIT, LOVE, LOVE_DEEP = "#FF9CB4", "#E33A6B", "#8E1B47"


def ok():
    """Готово: объёмная кнопка, галочка вычерчивается."""
    draw = anim([(0, 0), (16, 0), (54, 100), (180, 100)])
    pop = anim([(0, [66, 66]), (14, [66, 66]), (50, [110, 110]),
                (66, [100, 100]), (180, [100, 100])])
    tick = path([(C - 66, C + 6), (C - 18, C + 56), (C + 70, C - 50)],
                closed=False)
    return [
        layer([shadow(C, C + 168, 118, 20, op=24)], name="shadow"),
        layer([group([glow(C, C, 172, OK_GREEN, op=18)],
                     gtr(opacity=anim([(0, 0), (50, 0), (62, 80), (110, 30),
                                       (180, 30)])), name="g")], name="glow"),
        layer([sphere(C, C, 150, OK_GREEN, OK_LIT, OK_DEEP, rim="#7BEFB4")],
              name="disc", scale=pop),
        layer([group([tick, stroke(WHITE, 30, 100, cap=2), trim(end=draw)],
                     name="t")], name="tick"),
    ]


def bad():
    """Не вышло: крест вычерчивается и коротко дрожит."""
    d1 = anim([(0, 0), (14, 0), (44, 100), (180, 100)])
    d2 = anim([(0, 0), (30, 0), (62, 100), (180, 100)])
    shake = anim([(0, 0), (62, 0), (70, -5), (78, 5), (86, -3), (94, 0),
                  (180, 0)])
    a = path([(C - 50, C - 50), (C + 50, C + 50)], closed=False)
    b = path([(C + 50, C - 50), (C - 50, C + 50)], closed=False)
    return [
        layer([shadow(C, C + 168, 118, 20, op=24)], name="shadow"),
        layer([sphere(C, C, 150, BAD_RED, BAD_LIT, BAD_DEEP, rim="#FFA0A0")],
              name="disc", scale=pulse([100, 100], [103, 103], times=2)),
        layer([group([a, stroke(WHITE, 28, 100, cap=2), trim(end=d1)],
                     name="a"),
               group([b, stroke(WHITE, 28, 100, cap=2), trim(end=d2)],
                     name="b")], name="cross", rot=shake),
    ]


def heart():
    """Спасибо: сердце бьётся, вокруг разлетаются искры."""
    h = path([
        (0, 88),
        (-106, -8, 40, 50, -24, -30),
        (-54, -74, -30, 20, 26, -18),
        (0, -32, -26, -20, 26, -20),
        (54, -74, -26, -18, 30, 20),
        (106, -8, -24, -30, -40, 50),
    ])
    beat = anim([(0, [100, 100]), (18, [116, 112]), (34, [100, 100]),
                 (52, [110, 107]), (70, [100, 100]), (180, [100, 100])])
    sparks = []
    for i, (dx, dy) in enumerate([(-140, -84), (140, -84), (-104, 104),
                                  (112, 100), (0, -150)]):
        t0 = 18 + i * 6
        p = anim([(0, [C, C]), (t0, [C, C]), (t0 + 44, [C + dx, C + dy]),
                  (180, [C + dx, C + dy])])
        o = anim([(0, 0), (t0, 0), (t0 + 8, 90), (t0 + 44, 0), (180, 0)])
        sparks.append(group([circle(0, 0, 10), fill(LOVE_LIT, o)],
                            gtr(pos=p), name="s%d" % i))
    return [
        layer(sparks, name="sparks"),
        layer([group([glow(C, C, 140, LOVE, op=16)], name="g")], name="glow"),
        layer([
            group([h, grad([(0, LOVE_LIT), (0.45, LOVE), (1, LOVE_DEEP)],
                           (C - 100, C - 88), (C + 100, C + 90))],
                  gtr(pos=(C, C - 6)), name="h"),
            # блик на левой доле - сердце становится телом, а не силуэтом
            group([ellipse(C - 46, C - 42, 30, 20), fill(WHITE, 44)],
                  gtr(pos=(C - 46, C - 42), anchor=(C - 46, C - 42), rot=-28),
                  name="hi"),
        ], name="heart", scale=beat),
    ]


def like():
    """Одобряю: рука с большим пальцем вверх.

    Палец делаем заметно выше кулака и уже его - именно перепад высоты
    читается как жест, а не форма самого кулака.
    """
    jump = anim([(0, [C, C + 16]), (24, [C, C - 24]), (44, [C, C + 8]),
                 (60, [C, C]), (180, [C, C])])
    tilt = anim([(0, -12), (24, 6), (44, -2), (60, 0), (180, 0)])
    return [
        layer([shadow(C, C + 202, 112, 18, op=20)], name="shadow"),
        layer([
            # палец: узкая высокая капсула, поднята над кулаком
            group([rect(C - 26, C - 86, 62, 176, 31),
                   grad([(0, WHITE), (0.4, CYAN_PALE), (1, CYAN)],
                        (C - 57, C - 174), (C + 5, C + 2))], name="thumb"),
            group([rect(C - 42, C - 96, 15, 128, 8), fill(WHITE, 52)],
                  name="thumb-hi"),
            # кулак: ниже и шире пальца
            group([rect(C + 16, C + 52, 190, 150, 40),
                   grad([(0, CYAN_PALE), (0.45, CYAN), (1, CYAN_DEEP)],
                        (C - 79, C - 23), (C + 111, C + 127))], name="fist"),
            # костяшки поперёк кулака
            group([rect(C + 16, C + 4, 176, 12, 6), fill(WHITE, 24)],
                  name="k0"),
            group([rect(C + 62, C + 44, 9, 92, 5), fill(CYAN_DEEP, 34)],
                  name="k1"),
            group([rect(C + 100, C + 50, 9, 78, 5), fill(CYAN_DEEP, 26)],
                  name="k2"),
            # манжета
            group([rect(C + 10, C + 142, 210, 50, 20),
                   grad([(0, CYAN), (1, CYAN_DEEP)],
                        (C - 95, C + 117), (C + 115, C + 167))], name="cuff"),
            group([rect(C + 10, C + 126, 198, 10, 5), fill(WHITE, 22)],
                  name="cuff-hi"),
        ], name="hand", pos=jump, rot=tilt),
    ]


def warn():
    """Внимание: знак мигает."""
    blink = anim([(0, 100), (30, 100), (38, 30), (50, 100), (92, 100),
                  (100, 30), (112, 100), (180, 100)])
    tri = path([(0, -120), (128, 106, -24, -40, 0, 0),
                (-128, 106, 0, 0, 24, -40)])
    return [
        layer([shadow(C, C + 190, 124, 18, op=22)], name="shadow"),
        layer([
            group([tri, grad([(0, WARN_LIT), (0.45, WARN), (1, WARN_DEEP)],
                             (C - 120, C - 116), (C + 120, C + 106))],
                  gtr(pos=(C, C - 4)), name="tri"),
            group([tri, stroke(WARN_LIT, 6, 60)], gtr(pos=(C, C - 4)),
                  name="edge"),
            # верхняя грань светлее - треугольник объёмный
            group([path([(0, -108), (60, -6), (-60, -6)]), fill(WHITE, 20)],
                  gtr(pos=(C, C - 4)), name="facet"),
        ], name="sign"),
        layer([group([rect(C, C + 6, 26, 84, 13), fill("#4A2F00")],
                     name="bar"),
               group([circle(C, C + 74, 15), fill("#4A2F00")], name="dot")],
              name="mark", opacity=blink),
    ]


def hello():
    """Привет: знак Rocket выезжает и покачивается."""
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
