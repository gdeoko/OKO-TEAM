# -*- coding: utf-8 -*-
"""Космос и бренд: ракета, знак Rocket, планеты.

Планеты взяты не из головы: цвета сняты с текстур NASA, которые лежат
на самом сайте (`assets/space/*.webp`) и крутятся в его полёте. Поэтому
Марс здесь ржавый, Сатурн песочный, а Юпитер в своих полосах, а не
просто «оранжевый шар».

Подложки нет - стикер прозрачный. Объём держат свет, отражённый свет по
тёмному краю и блик, как на корпусе ракеты в логотипе.
"""

from tgs import (CYAN, CYAN_DEEP, CYAN_LIT, CYAN_PALE, INK, INK_2, MIST,
                 SILVER, STEEL, VIOLET, VIOLET_DEEP, VIOLET_LIT, WHITE, anim,
                 circle, ellipse, fill, grad, grad_stroke, group, gtr, layer,
                 on_circle, path, pulse, rect, stroke, trim, val)
import brand_logo as BL
import planet as PL
from parts import C, glow, limb, shadow, sphere

# --- цвета, снятые с текстур NASA на сайте ------------------------------
JUP_LIT, JUP, JUP_DEEP = "#E8DCC4", "#C8A882", "#7A5C42"
JUP_BAND, JUP_SPOT = "#A8804E", "#C4553A"
MARS_LIT, MARS, MARS_DEEP = "#D98E62", "#A85A3C", "#5E2F20"
SAT_LIT, SAT, SAT_DEEP = "#FFEACB", "#DDC196", "#8C7448"
MOON_LIT, MOON, MOON_DEEP = "#E8E8E8", "#9A9A9A", "#4A4A4A"
SUN_LIT, SUN, SUN_DEEP = "#FFD98A", "#F49235", "#D2540A"
EARTH_SEA, EARTH_LIT, EARTH_DEEP = "#1C6FA8", "#7FD8FA", "#0A2E52"
EARTH_LAND = "#2F7D44"


def _bands(rows, r):
    """Полосы на планете: эллипсы по широтам, сжатые к краям шара."""
    return [group([ellipse(C, C + y * r, r * 0.97, h * r), fill(col, op)],
                  name="b") for y, h, col, op in rows]


def launch():
    """Взлёт: фирменная ракета идёт вверх, из сопла бьёт пламя."""
    up = anim([(0, [C, C + 18]), (60, [C, C - 14]), (120, [C, C + 5]),
               (180, [C, C + 18])])
    tilt = anim([(0, -3), (52, 3), (112, -2), (180, -3)])

    def tongue(w, h, color, op, phase):
        p = path([
            (0, 0),
            (w, -h * 0.30, -w * 0.26, h * 0.16, w * 0.16, -h * 0.20),
            (w * 0.30, -h * 0.74, w * 0.14, h * 0.18, -w * 0.10, -h * 0.16),
            (0, -h, w * 0.22, h * 0.16, -w * 0.22, h * 0.16),
            (-w * 0.30, -h * 0.74, -w * 0.10, -h * 0.16, w * 0.14, h * 0.18),
            (-w, -h * 0.30, -w * 0.16, -h * 0.20, w * 0.26, h * 0.16),
        ])
        sc = anim([(0, [100, 78 + phase]), (26, [106, 126 + phase]),
                   (56, [96, 90 + phase]), (86, [104, 130 + phase]),
                   (118, [98, 84 + phase]), (150, [103, 116 + phase]),
                   (180, [100, 78 + phase])])
        return group([p, fill(color, op)],
                     gtr(pos=(0, 0), anchor=(0, 0), scale=sc), name="t")

    flame = group([
        tongue(66, 196, CYAN_DEEP, 66, 0),
        tongue(46, 150, CYAN, 86, 8),
        tongue(27, 98, CYAN_PALE, 94, 4),
        tongue(12, 50, WHITE, 96, 2),
    ], gtr(pos=(C - 26, C + 52), rot=16), name="flame")

    return [
        layer([group([flame], name="fl")], name="flame"),
        layer([BL.rocket("cdn", 214, (C + 22, C - 52), rot=-30,
                         with_trail=False)], name="rocket", pos=up, rot=tilt),
    ]


def logo_mark():
    """Знак Rocket: буква выходит, ракета садится в неё."""
    grow = anim([(0, [74, 74]), (32, [108, 108]), (54, [100, 100]),
                 (180, [100, 100])])
    fly = anim([(0, [C - 250, C + 220]), (40, [C - 250, C + 220]),
                (82, [C - 60, C + 36]), (100, [C - 48, C + 28]),
                (180, [C - 48, C + 28])])
    fly_op = anim([(0, 0), (40, 0), (54, 100), (180, 100)])
    return [
        layer([group([glow(C, C, 190, CYAN_LIT, op=13)], name="g")],
              name="glow"),
        layer([BL.letter("cdn", 320, (C + 30, C))], name="letter", scale=grow),
        layer([group([BL.rocket("cdn", 210, (0, 0))],
                     gtr(pos=fly, opacity=fly_op), name="f")], name="rocket"),
    ]


def earth():
    """Земля: настоящая текстура NASA, вокруг вспыхивают узлы сети."""
    dots = []
    for i in range(6):
        x, y = on_circle(C, C, 208, i * 60)
        t0 = i * 26
        o = anim([(0, 30), (max(1, t0), 100), (min(179, t0 + 34), 30),
                  (180, 30)])
        dots.append(group([
            group([circle(x, y, 26), fill(CYAN_LIT, 14)], name="halo"),
            group([circle(x, y, 13), fill(CYAN_PALE, o)], name="d"),
        ], name="n%d" % i))
    return [
        layer([glow(C, C, 158, CYAN_LIT, op=18, steps=4)], name="atmo"),
        layer([PL.planet("earth", 300, (C, C))], name="globe"),
        layer([limb(C, C, 150, CYAN_LIT, op=54, width=11)], name="limb"),
        layer([group([ellipse(C, C, 212, 62), stroke(CYAN_LIT, 4, 42)],
                     gtr(pos=(C, C), anchor=(C, C), rot=-16), name="o")],
              name="orbit"),
        layer(dots, name="nodes", rot=anim([(0, 0), (180, 60)], easing=False)),
    ]


def jupiter():
    """Юпитер: текстура NASA с полосами и Большим красным пятном."""
    return [
        layer([shadow(C, C + 176, 118, 18, op=20)], name="shadow"),
        layer([PL.planet("jupiter", 320, (C, C))], name="ball"),
        layer([limb(C, C, 160, JUP_LIT, op=30, width=7)], name="limb"),
    ]


def mars():
    """Марс: текстура NASA - ржавые равнины и полярная шапка."""
    return [
        layer([shadow(C, C + 172, 112, 18, op=20)], name="shadow"),
        layer([PL.planet("mars", 300, (C, C))], name="ball"),
        layer([limb(C, C, 150, "#E8A97E", op=26, width=6)], name="limb"),
    ]


def saturn():
    """Сатурн: текстура NASA и кольцо, проходящее спереди и сзади.

    Кольца в развёртке нет - оно не часть шара, - поэтому рисуется
    отдельно, half за планетой, half перед ней.
    """
    tilt = anim([(0, -16), (90, -21), (180, -16)])
    bob = anim([(0, [C, C + 6]), (90, [C, C - 6]), (180, [C, C + 6])])
    return [
        layer([group([ellipse(C, C, 236, 64),
                      grad_stroke([(0, SAT_DEEP), (0.5, SAT_LIT), (1, SAT)],
                                  (C - 234, C), (C + 234, C), 24, opacity=62),
                      trim(start=val(50), end=val(100))],
                     gtr(pos=(C, C), anchor=(C, C), rot=tilt), name="far")],
              name="ring-far", pos=bob),
        layer([PL.planet("saturn", 286, (C, C))], name="ball", pos=bob),
        layer([limb(C, C, 143, SAT_LIT, op=26, width=6)], name="limb",
              pos=bob),
        # тень от кольца ложится поперёк диска
        layer([group([ellipse(C, C + 14, 146, 14), fill("#4E3F22", 46)],
                     gtr(pos=(C, C + 14), anchor=(C, C + 14), rot=tilt),
                     name="sh")], name="ringshadow", pos=bob),
        layer([group([ellipse(C, C, 236, 64),
                      grad_stroke([(0, SAT), (0.5, SAT_LIT), (1, SAT_DEEP)],
                                  (C - 234, C), (C + 234, C), 24, opacity=96),
                      trim(start=val(0), end=val(50))],
                     gtr(pos=(C, C), anchor=(C, C), rot=tilt), name="near"),
               group([ellipse(C, C, 236, 64), stroke(INK, 4, 38),
                      trim(start=val(0), end=val(50))],
                     gtr(pos=(C, C), anchor=(C, C), rot=tilt), name="gap")],
              name="ring-near", pos=bob),
    ]


def moon():
    """Луна: текстура NASA и ракета, обходящая её по орбите."""
    return [
        layer([PL.planet("moon", 292, (C, C))], name="ball"),
        layer([group([BL.rocket("cdn", 92, (C, C - 178), rot=60)],
                     name="orb")], name="orbit",
              rot=anim([(0, 0), (180, 360)], easing=False)),
    ]


def sun():
    """Солнце: текстура NASA, корона дышит, по краю бьют протуберанцы."""
    flares = []
    for i in range(10):
        x, y = on_circle(C, C, 132, i * 36)
        t0 = (i * 17) % 160
        sc = anim([(0, [100, 60]), (max(1, t0), [100, 128], "out"),
                   (min(179, t0 + 40), [100, 70]), (180, [100, 60])])
        flares.append(group([path([(-20, 6), (-7, -30, -4, 10, 3, -12),
                                   (0, -62, -6, 16, 6, 16),
                                   (9, -28, -3, -12, 5, 10), (20, 6)]),
                             fill(SUN_LIT, 62)],
                            gtr(pos=(x, y), anchor=(0, 0), scale=sc,
                                rot=i * 36), name="f%d" % i))
    return [
        layer([group([glow(C, C, 176, SUN, op=24, steps=4)],
                     gtr(scale=pulse([96, 96], [108, 108], times=2),
                         anchor=(C, C), pos=(C, C)), name="g")],
              name="corona"),
        layer(flares, name="flares"),
        layer([PL.planet("sun", 262, (C, C))], name="ball",
              scale=pulse([99, 99], [103, 103], times=3)),
        layer([limb(C, C, 131, SUN_LIT, op=44, width=9)], name="limb"),
    ]


def astro():
    """Космонавт: в стекле шлема отражается ракета."""
    bob = anim([(0, [C, C + 5]), (90, [C, C - 9]), (180, [C, C + 5])])
    sheen_p = anim([(0, [C - 62, C - 16]), (70, [C + 44, C - 34]),
                    (180, [C - 62, C - 16])])
    return [
        layer([shadow(C, C + 196, 118, 18, op=22)], name="shadow"),
        layer([
            group([rect(C, C + 172, 258, 130, 62),
                   grad([(0, MIST), (1, STEEL)],
                        (C - 130, C + 112), (C + 130, C + 232))], name="suit"),
            group([rect(C - 128, C + 8, 44, 82, 20), fill(STEEL)], name="e1"),
            group([rect(C + 128, C + 8, 44, 82, 20), fill(STEEL)], name="e2"),
        ], name="suit", pos=bob),
        layer([sphere(C, C, 128, MIST, WHITE, STEEL, rim=WHITE)],
              name="helmet", pos=bob),
        layer([
            group([rect(C, C + 6, 192, 148, 68),
                   grad([(0, CYAN_DEEP), (0.5, INK_2), (1, INK)],
                        (C - 96, C - 68), (C + 96, C + 80))], name="visor"),
            group([rect(C, C + 6, 192, 148, 68), stroke(CYAN_LIT, 5, 76)],
                  name="rim"),
            group([circle(C + 50, C - 26, 4), fill(WHITE, 72)], name="st1"),
            group([circle(C + 66, C + 20, 3), fill(WHITE, 56)], name="st2"),
            group([BL.rocket("cdn", 84, (C + 24, C + 18), rot=-8)],
                  name="reflect"),
        ], name="visor", pos=bob),
        layer([group([ellipse(0, 0, 44, 18), fill(WHITE, 40)],
                     gtr(pos=sheen_p, rot=-22), name="s")], name="sheen"),
    ]


SCENES = [
    ("launch",  launch,    "🚀", "Взлёт"),
    ("logo",    logo_mark, "💙", "Знак Rocket"),
    ("earth",   earth,     "🌍", "Сеть"),
    ("jupiter", jupiter,   "🟠", "Юпитер"),
    ("mars",    mars,      "🔴", "Марс"),
    ("saturn",  saturn,    "🪐", "Сатурн"),
    ("moon",    moon,      "🌙", "Луна"),
    ("sun",     sun,       "☀️", "Солнце"),
    ("astro",   astro,     "👨‍🚀", "Космонавт"),
]
