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
from parts import C, gloss, glow, shadow, sphere

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
    """Земля: узлы сети вспыхивают по орбите."""
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
        layer([glow(C, C, 166, CYAN_LIT, op=16, steps=4)], name="atmo"),
        layer([sphere(C, C, 154, EARTH_SEA, EARTH_LIT, EARTH_DEEP,
                      rim=CYAN_LIT)], name="globe"),
        layer([
            group([ellipse(C - 52, C - 40, 58, 38), fill(EARTH_LAND, 74)],
                  gtr(rot=-18), name="m1"),
            group([ellipse(C + 44, C + 22, 50, 44), fill(EARTH_LAND, 70)],
                  name="m2"),
            group([ellipse(C - 16, C + 84, 44, 20), fill(EARTH_LAND, 62)],
                  name="m3"),
            group([ellipse(C + 68, C - 66, 26, 18), fill(EARTH_LAND, 56)],
                  name="m4"),
        ], name="land"),
        layer([group([ellipse(C, C, 212, 62), stroke(CYAN_LIT, 4, 42)],
                     gtr(pos=(C, C), anchor=(C, C), rot=-16), name="o")],
              name="orbit"),
        layer(dots, name="nodes", rot=anim([(0, 0), (180, 60)], easing=False)),
    ]


def jupiter():
    """Юпитер: полосы и красное пятно, цвета сняты с текстуры NASA."""
    rows = [(-0.62, 0.10, JUP_LIT, 46), (-0.34, 0.13, JUP_BAND, 40),
            (-0.06, 0.11, JUP_LIT, 34), (0.20, 0.14, JUP_BAND, 44),
            (0.50, 0.12, JUP_DEEP, 30)]
    return [
        layer([shadow(C, C + 186, 120, 18, op=20)], name="shadow"),
        layer([sphere(C, C, 160, JUP, JUP_LIT, JUP_DEEP, rim=JUP_LIT)],
              name="ball"),
        layer(_bands(rows, 160), name="bands"),
        # Большое красное пятно: оно ниже экватора и вытянуто по широте
        layer([group([ellipse(C - 58, C + 40, 42, 26), fill(JUP_SPOT, 82)],
                     gtr(rot=-8), name="spot"),
               group([ellipse(C - 58, C + 40, 26, 15), fill("#8F3524", 60)],
                     gtr(rot=-8), name="in")], name="spot",
              scale=pulse([99, 99], [102, 102], times=2)),
    ]


def mars():
    """Марс: ржавый шар с тёмными равнинами и полярной шапкой."""
    return [
        layer([shadow(C, C + 180, 112, 18, op=20)], name="shadow"),
        layer([sphere(C, C, 150, MARS, MARS_LIT, MARS_DEEP, rim="#C77A52")],
              name="ball"),
        layer([
            group([ellipse(C - 40, C - 10, 52, 34), fill(MARS_DEEP, 40)],
                  gtr(rot=-14), name="p1"),
            group([ellipse(C + 46, C + 44, 40, 26), fill(MARS_DEEP, 34)],
                  name="p2"),
            group([ellipse(C + 18, C - 62, 30, 18), fill(MARS_DEEP, 28)],
                  name="p3"),
            group([ellipse(C - 6, C - 126, 46, 20), fill(WHITE, 74)],
                  name="cap"),
        ], name="surface"),
    ]


def saturn():
    """Сатурн: песочный шар и кольцо - половина за ним, половина перед."""
    tilt = anim([(0, -16), (90, -21), (180, -16)])
    bob = anim([(0, [C, C + 6]), (90, [C, C - 6]), (180, [C, C + 6])])
    rows = [(-0.44, 0.11, SAT_LIT, 40), (-0.08, 0.13, "#C9AC7C", 34),
            (0.32, 0.12, SAT_DEEP, 26)]
    return [
        layer([group([ellipse(C, C, 232, 62),
                      grad_stroke([(0, SAT_DEEP), (0.5, SAT_LIT), (1, SAT)],
                                  (C - 230, C), (C + 230, C), 22, opacity=64),
                      trim(start=val(50), end=val(100))],
                     gtr(pos=(C, C), anchor=(C, C), rot=tilt), name="far")],
              name="ring-far", pos=bob),
        layer([sphere(C, C, 148, SAT, SAT_LIT, SAT_DEEP, rim=SAT_LIT)],
              name="ball", pos=bob),
        layer(_bands(rows, 148), name="bands", pos=bob),
        layer([group([ellipse(C, C, 232, 62),
                      grad_stroke([(0, SAT), (0.5, SAT_LIT), (1, SAT_DEEP)],
                                  (C - 230, C), (C + 230, C), 22, opacity=96),
                      trim(start=val(0), end=val(50))],
                     gtr(pos=(C, C), anchor=(C, C), rot=tilt), name="near"),
               # щель Кассини: тонкий тёмный разрыв в кольце
               group([ellipse(C, C, 232, 62), stroke(INK, 4, 38),
                      trim(start=val(0), end=val(50))],
                     gtr(pos=(C, C), anchor=(C, C), rot=tilt), name="gap")],
              name="ring-near", pos=bob),
    ]


def moon():
    """Луна: кратеры и ракета, обходящая её по орбите."""
    craters = [(-44, -36, 26), (34, 14, 19), (-8, 56, 14), (48, -50, 11),
               (-64, 34, 10), (16, -14, 8)]
    return [
        layer([sphere(C, C, 146, MOON, MOON_LIT, MOON_DEEP, rim="#C8C8C8")],
              name="ball"),
        layer([group([
            group([circle(C + x, C + y, r), fill(MOON_DEEP, 26)], name="c"),
            # светлая кромка с одной стороны делает пятно лункой
            group([circle(C + x - r * 0.16, C + y - r * 0.18, r * 0.82),
                   fill(MOON_LIT, 22)], name="l"),
        ], name="cr%d" % i) for i, (x, y, r) in enumerate(craters)],
              name="craters"),
        layer([group([BL.rocket("cdn", 92, (C, C - 178), rot=60)],
                     name="orb")], name="orbit",
              rot=anim([(0, 0), (180, 360)], easing=False)),
    ]


def sun():
    """Солнце: корона дышит, по краю бьют протуберанцы."""
    flares = []
    for i in range(10):
        x, y = on_circle(C, C, 132, i * 36)
        t0 = (i * 17) % 160
        sc = anim([(0, [100, 60]), (max(1, t0), [100, 128]),
                   (min(179, t0 + 40), [100, 70]), (180, [100, 60])])
        flares.append(group([path([(-20, 6), (-7, -30, -4, 10, 3, -12),
                                   (0, -62, -6, 16, 6, 16),
                                   (9, -28, -3, -12, 5, 10), (20, 6)]),
                             fill(SUN_LIT, 62)],
                            gtr(pos=(x, y), anchor=(0, 0), scale=sc,
                                rot=i * 36), name="f%d" % i))
    return [
        layer([group([glow(C, C, 178, SUN, op=22, steps=4)],
                     gtr(scale=pulse([96, 96], [108, 108], times=2),
                         anchor=(C, C), pos=(C, C)), name="g")],
              name="corona"),
        layer(flares, name="flares"),
        layer([sphere(C, C, 132, SUN, SUN_LIT, SUN_DEEP, rim=SUN_LIT,
                      rim_op=70)], name="ball",
              scale=pulse([99, 99], [103, 103], times=3)),
        layer([group([ellipse(C - 34, C + 22, 24, 16), fill(SUN_DEEP, 34)],
                     name="s1"),
               group([ellipse(C + 40, C - 30, 18, 13), fill(SUN_DEEP, 28)],
                     name="s2")], name="spots"),
    ]


def comet():
    """Комета: горячее ядро и длинный гаснущий хвост."""
    fly = anim([(0, [C - 44, C - 30]), (180, [C + 86, C + 54])],
               easing=False)
    # клин: широкий у ядра, сходит на нет к хвосту
    tail = path([(26, -50), (-186, 42, 54, -32, -34, 12),
                 (-180, 86, 0, -14, 0, 14), (22, 56, -40, -10, 0, 0)])
    wisp = path([(14, -26), (-140, 32, 42, -18, -28, 8),
                 (-136, 56, 0, -8, 0, 8), (12, 30, -34, -6, 0, 0)])
    return [
        layer([group([
            group([tail, grad([(0, CYAN_PALE), (0.42, CYAN), (1, CYAN_DEEP)],
                              (20, 0), (-244, 84), opacity=val(64))],
                  name="tail"),
            group([wisp, grad([(0, WHITE), (1, CYAN_LIT)],
                              (10, 0), (-186, 54), opacity=val(82))],
                  name="wisp"),
            group([glow(0, 0, 66, CYAN_LIT, op=28)], name="halo"),
            group([circle(0, 0, 38), fill(WHITE)], name="core"),
            group([circle(-7, -8, 10), fill(WHITE, 92)], name="hi"),
        ], gtr(pos=fly, rot=6), name="c")], name="comet"),
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
    ("comet",   comet,     "☄️", "Комета"),
    ("astro",   astro,     "👨‍🚀", "Космонавт"),
]
