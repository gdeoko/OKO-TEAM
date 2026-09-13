# -*- coding: utf-8 -*-
"""Rocket CDN: скорость, сеть, доставка контента.

Зал ЦОД срисован с фотографий самого сайта (`assets/gen/dc-moscow`,
`dc-almaty`, `dc-prague`): тёмные стойки уходят в перспективу, по
фасадам горят циановые огоньки, пол отражает свет.
"""

from tgs import (CYAN, CYAN_DEEP, CYAN_LIT, CYAN_PALE, INK, INK_2, MIST,
                 SILVER, STEEL, VIOLET, VIOLET_LIT, WHITE, anim, circle,
                 ellipse, fill, grad, grad_stroke, group, gtr, layer,
                 on_circle, path, pulse, rect, stroke, trim, val)
import brand_logo as BL
from parts import C, contact, gloss, glow, shadow, sphere

RACK_DARK = "#0C1B2A"
RACK_MID = "#16324A"


def bolt():
    """Молния: горячий разряд с тёмным кантом и свечением."""
    shape = path([(30, -172), (-104, 22), (-6, 22), (-30, 172),
                  (104, -22), (6, -22)])
    core = path([(22, -140), (-74, 16), (-8, 16), (-22, 138),
                 (74, -16), (2, -16)])
    jolt = anim([(0, [100, 100]), (30, [100, 100]), (38, [110, 110]),
                 (52, [97, 97]), (62, [100, 100]), (120, [100, 100]),
                 (128, [106, 106]), (142, [100, 100]), (180, [100, 100])])
    halo = anim([(0, 18), (38, 74), (64, 20), (128, 66), (150, 18), (180, 18)])
    return [
        layer([group([glow(C, C, 118, CYAN_LIT, op=20, steps=3)],
                     gtr(opacity=halo), name="g")], name="glow"),
        layer([
            # тёмный кант держит форму на белом фоне
            group([shape, stroke(CYAN_DEEP, 16, 92)], gtr(pos=(C, C)),
                  name="outline"),
            group([shape, grad([(0, CYAN_PALE), (0.38, CYAN_LIT), (1, CYAN)],
                               (C + 84, C - 178), (C - 86, C + 178))],
                  gtr(pos=(C, C)), name="bolt"),
            group([core, fill(WHITE, 80)], gtr(pos=(C, C)), name="core"),
        ], name="bolt", scale=jolt),
    ]


def datacenter():
    """Зал ЦОД: стойки в перспективе, огни состояния перемигиваются.

    Три собственных ЦОД - то, чем сеть держится, поэтому зал рисуется
    с той же подсветкой, что на фотографиях сайта.
    """
    racks = []
    # стойки парами слева и справа, дальние ниже и уже - отсюда перспектива
    for i in range(3):
        k = 1.0 - i * 0.22
        w, h = 88 * k, 250 * k
        y = C - 10 + i * 16
        for side in (-1, 1):
            x = C + side * (150 - i * 44)
            leds = []
            for j in range(5):
                t0 = (i * 5 + j * 3 + (0 if side < 0 else 7)) * 9
                o = anim([(0, 24), (max(1, t0 % 170), 100),
                          (min(179, t0 % 170 + 24), 24), (180, 24)])
                leds.append(group([rect(x + w * 0.26, y - h * 0.32 + j * h * 0.15,
                                        w * 0.30, 6 * k, 3 * k),
                                   fill(CYAN_LIT, o)], name="l%d" % j))
            racks.append(group([
                group([rect(x, y, w, h, 8 * k),
                       grad([(0, RACK_MID), (0.5, RACK_DARK), (1, INK)],
                            (x - w / 2, y - h / 2), (x + w / 2, y + h / 2))],
                      name="box"),
                group([rect(x, y, w, h, 8 * k), stroke(CYAN, 3, 40)],
                      name="edge"),
                # фасад: узкие полки
                group([rect(x - w * 0.16, y, w * 0.44, h * 0.86, 4),
                       fill(INK, 50)], name="face"),
            ] + leds, name="r%d%d" % (i, side)))
    return [
        # дальний свет коридора
        layer([group([ellipse(C, C + 30, 120, 150), fill(CYAN_LIT, 12)],
                     name="far"),
               group([ellipse(C, C + 30, 70, 100), fill(CYAN_PALE, 14)],
                     name="far2")], name="depth"),
        layer(racks, name="racks"),
        # отражение на полу
        layer([group([ellipse(C, C + 190, 210, 34), fill(CYAN_LIT, 16)],
                     name="floor")], name="floor"),
    ]


def speed():
    """Спидометр: стрелка уходит в красную зону и держится на пределе."""
    ticks = []
    for i in range(11):
        x1, y1 = on_circle(C, C + 14, 148, -120 + i * 24)
        x2, y2 = on_circle(C, C + 14, 122, -120 + i * 24)
        ticks.append(group([path([(x1, y1), (x2, y2)], closed=False),
                            stroke(CYAN_LIT if i < 8 else "#F87171", 8, 86)],
                           name="t%d" % i))
    needle = anim([(0, -108), (54, 76), (78, 58), (96, 84), (128, 70),
                   (180, -108)])
    return [
        layer([shadow(C, C + 186, 128, 18, op=20)], name="shadow"),
        layer([
            group([circle(C, C + 14, 172),
                   grad([(0, MIST), (0.5, SILVER), (1, STEEL)],
                        (C - 172, C - 158), (C + 172, C + 186), kind=2)],
                  name="case"),
            group([circle(C, C + 14, 152),
                   grad([(0, INK_2), (1, INK)],
                        (C - 140, C - 130), (C + 140, C + 160), kind=2)],
                  name="dial"),
            group([circle(C, C + 14, 152), stroke(CYAN, 3, 40)],
                  name="dial-r"),
        ], name="dial"),
        layer(ticks, name="ticks"),
        layer([group([path([(0, 22), (-11, 0), (0, -146), (11, 0)]),
                      grad([(0, WHITE), (1, CYAN_LIT)], (0, -146), (0, 22))],
                     gtr(pos=(C, C + 14), rot=needle), name="n")],
              name="needle"),
        layer([group([circle(C, C + 14, 24),
                      grad([(0, WHITE), (1, STEEL)],
                           (C - 20, C - 8), (C + 20, C + 36), kind=2)],
                     name="cap"),
               group([circle(C, C + 14, 10), fill(CYAN_DEEP)], name="cap2")],
              name="cap"),
    ]


def wifi():
    """Раздача: дуги сигнала расходятся от точки одна за другой."""
    arcs = []
    for i in range(3):
        r = 74 + i * 58
        t0 = 16 + i * 18
        o = anim([(0, 0), (t0, 0), (t0 + 16, 100), (t0 + 92, 100),
                  (t0 + 112, 16), (180, 0)])
        k = r * 0.42
        a = path([(C - r * 0.78, C + 96 - r * 0.42, 0, 0, 0, -k),
                  (C, C + 96 - r, -k, 0, k, 0),
                  (C + r * 0.78, C + 96 - r * 0.42, 0, -k, 0, 0)],
                 closed=False)
        arcs.append(group([a, stroke(CYAN_LIT, 22, o, cap=2)],
                          name="a%d" % i))
    return [
        layer(arcs, name="arcs"),
        layer([group([glow(C, C + 96, 40, CYAN_LIT, op=22)], name="h"),
               group([circle(C, C + 96, 26),
                      grad([(0, WHITE), (1, CYAN)],
                           (C - 26, C + 70), (C + 26, C + 122), kind=2)],
                     name="dot")], name="dot",
              scale=pulse([92, 92], [110, 110], times=3)),
    ]


def cloud():
    """Облако раздаёт: из него сыплются пакеты данных."""
    puffs = [(-78, 8, 58), (-8, -34, 78), (72, 6, 56)]
    drops = []
    for i in range(4):
        x = C - 90 + i * 60
        t0 = i * 26
        p = anim([(0, [x, C + 60]), (max(1, 60 + t0), [x, C + 200]),
                  (180, [x, C + 200])], easing=False)
        o = anim([(0, 0), (max(1, t0), 90), (60 + t0, 0), (180, 0)])
        drops.append(group([rect(0, 0, 17, 40, 8),
                            grad([(0, CYAN_PALE), (1, CYAN)],
                                 (0, -20), (0, 20))],
                           gtr(pos=p, opacity=o), name="d%d" % i))
    return [
        layer(drops, name="drops"),
        layer([
            group([rect(C, C + 6, 254, 76, 38),
                   grad([(0, WHITE), (0.5, CYAN_PALE), (1, "#9FD6EE")],
                        (C - 120, C - 30), (C + 120, C + 44))], name="base"),
        ] + [
            group([circle(C + px, C - 20 + py, pr),
                   grad([(0, WHITE), (0.55, CYAN_PALE), (1, "#9FD6EE")],
                        (C + px - pr, C - 20 + py - pr),
                        (C + px + pr, C - 20 + py + pr), kind=2)],
                  name="p%d" % i) for i, (px, py, pr) in enumerate(puffs)
        ] + [
            # блик по верхней кромке - облако объёмное, а не пятно
            group([ellipse(C - 20, C - 86, 62, 20), fill(WHITE, 62)],
                  name="hi"),
        ], name="cloud", scale=pulse([99, 99], [103, 103], times=2)),
    ]


def play():
    """Стриминг: кнопка пуск, вокруг бежит полоса загрузки."""
    ring = anim([(0, 0), (150, 100), (180, 100)])
    return [
        layer([shadow(C, C + 188, 116, 18, op=20)], name="shadow"),
        layer([group([circle(C, C, 172), stroke(INK_2, 16, 80)],
                     name="track")], name="track"),
        layer([group([circle(C, C, 172),
                      grad_stroke([(0, CYAN_LIT), (1, VIOLET)],
                                  (C - 172, C - 172), (C + 172, C + 172), 16),
                      trim(start=val(0), end=ring, offset=val(-90))],
                     name="bar")], name="bar"),
        layer([sphere(C, C, 124, CYAN, CYAN_PALE, CYAN_DEEP, rim=CYAN_LIT),
               gloss(C, C, 124, op=38)], name="btn",
              scale=pulse([98, 98], [104, 104], times=2)),
        layer([group([path([(-38, -58), (62, 0), (-38, 58)]), fill(WHITE)],
                     gtr(pos=(C + 10, C)), name="tri"),
               group([path([(-38, -58), (62, 0), (-38, 58)]),
                      stroke(CYAN_DEEP, 5, 30)],
                     gtr(pos=(C + 10, C)), name="tri-r")], name="tri"),
    ]


def download():
    """Загрузка: стрелка идёт вниз, полка подсвечивается ударом."""
    drop = anim([(0, [C, C - 104]), (58, [C, C - 12]), (72, [C, C - 26]),
                 (84, [C, C - 16]), (180, [C, C - 104])])
    hit = anim([(0, 26), (58, 26), (66, 100), (110, 26), (180, 26)])
    return [
        layer([group([
            group([rect(0, -40, 52, 124, 16),
                   grad([(0, CYAN_PALE), (1, CYAN)], (-26, -102), (26, 22))],
                  name="stem"),
            group([path([(-72, 18), (72, 18), (0, 110)]),
                   grad([(0, WHITE), (1, CYAN)], (-72, 18), (72, 110))],
                  name="head"),
        ], gtr(pos=drop), name="arrow")], name="arrow"),
        layer([group([rect(C, C + 150, 228, 26, 13), fill(CYAN_LIT, hit)],
                     name="shelf"),
               group([rect(C, C + 150, 228, 26, 13),
                      grad_stroke([(0, CYAN_LIT), (1, CYAN_DEEP)],
                                  (C - 114, C + 137), (C + 114, C + 163), 5)],
                     name="shelf-r")], name="shelf"),
    ]


def chart():
    """График растёт: столбики поднимаются, линия чертится поверх."""
    bars = []
    heights = [70, 118, 92, 168, 214]
    for i, h in enumerate(heights):
        x = C - 132 + i * 66
        t0 = 10 + i * 16
        sc = anim([(0, [100, 2]), (t0, [100, 2]), (t0 + 40, [100, 108]),
                   (t0 + 52, [100, 100]), (180, [100, 100])])
        bars.append(group([
            group([rect(0, -h / 2.0, 46, h, 10),
                   grad([(0, CYAN_LIT), (1, CYAN_DEEP)], (0, -h), (0, 0))],
                  name="b"),
            group([rect(-12, -h / 2.0, 10, h * 0.86, 5), fill(WHITE, 22)],
                  name="hi"),
        ], gtr(pos=(x, C + 140), anchor=(0, 0), scale=sc), name="b%d" % i))
    line = path([(C - 132, C + 70), (C - 66, C + 22), (C, C + 48),
                 (C + 66, C - 30), (C + 132, C - 82)], closed=False)
    draw = anim([(0, 0), (44, 0), (140, 100), (180, 100)])
    return [
        layer(bars, name="bars"),
        layer([group([line, stroke(WHITE, 11, 96, cap=2), trim(end=draw)],
                     name="l")], name="line"),
        layer([group([glow(C + 132, C - 82, 26, WHITE, op=26)], name="h"),
               group([circle(C + 132, C - 82, 15), fill(WHITE)], name="t")],
              name="tip", opacity=anim([(0, 0), (138, 0), (150, 100),
                                        (180, 100)])),
    ]


def fire():
    """Турбо: пламя с горячим белым ядром."""
    def tongue(w, h, color, op, phase, lean=0):
        p = path([
            (0, 0),
            (w, -h * 0.30, -w * 0.26, h * 0.16, w * 0.16, -h * 0.20),
            (w * 0.34, -h * 0.72, w * 0.14, h * 0.18, -w * 0.10, -h * 0.16),
            (lean, -h, w * 0.24, h * 0.16, -w * 0.24, h * 0.16),
            (-w * 0.34, -h * 0.72, -w * 0.10, -h * 0.16, w * 0.14, h * 0.18),
            (-w, -h * 0.30, -w * 0.16, -h * 0.20, w * 0.26, h * 0.16),
        ])
        sc = anim([(0, [100, 76 + phase]), (24, [106, 124 + phase]),
                   (52, [96, 88 + phase]), (80, [104, 130 + phase]),
                   (112, [98, 82 + phase]), (146, [103, 118 + phase]),
                   (180, [100, 76 + phase])])
        return group([p, fill(color, op)],
                     gtr(pos=(C, C + 186), anchor=(0, 0), scale=sc), name="t")
    return [
        layer([group([glow(C, C + 60, 150, CYAN, op=16)], name="g")],
              name="glow"),
        layer([
            tongue(116, 300, CYAN_DEEP, 74, 0, lean=-10),
            tongue(84, 236, CYAN, 88, 8, lean=8),
            tongue(52, 162, CYAN_PALE, 94, 4, lean=-5),
            tongue(23, 86, WHITE, 96, 2, lean=4),
        ], name="flame"),
    ]


SCENES = [
    ("bolt",     bolt,       "⚡", "Скорость"),
    ("dc",       datacenter, "🏢", "Свои ЦОД"),
    ("speed",    speed,      "🏎", "На пределе"),
    ("wifi",     wifi,       "📶", "Раздача"),
    ("cloud",    cloud,      "☁️", "Облако"),
    ("play",     play,       "▶️", "Стриминг"),
    ("download", download,   "⬇️", "Загрузка"),
    ("chart",    chart,      "📈", "Рост"),
    ("fire",     fire,       "🔥", "Турбо"),
]
