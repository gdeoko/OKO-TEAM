# -*- coding: utf-8 -*-
"""Детали, из которых собираются сюжеты: ракета, иллюминатор, звёзды.

Ракета срисована с логотипа: острый нос, серебристый корпус, тёмный
иллюминатор с бликом, острые крылья назад. Нарисована носом вверх и
центром в нуле, поэтому её можно повернуть под любой угол.
"""

import math
from tgs import (CANVAS, CYAN, CYAN_DEEP, CYAN_LIT, CYAN_PALE, INK, INK_2,
                 MIST, SILVER, STEEL, VIOLET, VIOLET_DEEP, VIOLET_LIT, WHITE,
                 anim, circle, ellipse, fill, grad, grad_stroke, group, gtr,
                 on_circle, path, poly, pulse, rect, repeat, star, stroke,
                 trim, val)

C = CANVAS / 2.0  # центр холста


# --- ракета ------------------------------------------------------------

def rocket_body(tint=CYAN, lit=CYAN_LIT, deep=CYAN_DEEP):
    """Корпус ракеты. Рисуется вокруг нуля, нос смотрит вверх."""
    # обвод корпуса: острый нос, плавные бока, срез снизу
    hull = path([
        (0, -104),
        (20, -52, -6, -20, 5, 16),
        (28, 34, 0, -16, 0, 10),
        (22, 58, 3, -8, -3, 4),
        (-22, 58, 4, 4, -4, -4),
        (-28, 34, 0, 10, 0, -16),
        (-20, -52, -5, 16, 6, -20),
    ])
    # левое и правое крыло
    wing_l = path([
        (-26, 6),
        (-62, 64, 6, -10, 0, 6),
        (-24, 52, -6, 6, 0, 0),
    ])
    wing_r = path([
        (26, 6),
        (62, 64, -6, -10, 0, 6),
        (24, 52, 6, 6, 0, 0),
    ])
    # тень вдоль правого борта даёт объём
    shade = path([
        (6, -78),
        (24, 30, -4, -24, 0, 12),
        (18, 56, 2, -8, 0, 0),
        (6, 56),
    ])
    return [
        group([wing_l, fill(deep)], name="wing-l"),
        group([wing_r, fill(deep)], name="wing-r"),
        group([hull, grad([(0, WHITE), (0.45, SILVER), (1, STEEL)],
                          (-30, -90), (34, 60))], name="hull"),
        group([shade, fill(tint, 34)], name="shade"),
        # иллюминатор: тёмное стекло, светлое кольцо, блик сверху слева
        group([circle(0, -34, 19), fill(INK_2)], name="glass"),
        group([circle(0, -34, 19), stroke(lit, 4, 92)], name="glass-ring"),
        group([circle(-6, -40, 6), fill(WHITE, 78)], name="glass-hi"),
    ]


def rocket_flame(strength=1.0, seed=0):
    """Пламя под соплом: три языка, каждый живёт своим ритмом."""
    def tongue(w, h, color, op, phase):
        p = path([
            (0, 52),
            (w, 78, -w * 0.2, -8, w * 0.1, 10),
            (0, 78 + h, w * 0.5, -6, -w * 0.5, -6),
            (-w, 78, -w * 0.1, 10, w * 0.2, -8),
        ])
        # язык вытягивается и опадает - огонь не стоит на месте
        sc = anim([(0, [100, 70 + phase]), (22, [100, 118 + phase]),
                   (48, [100, 84 + phase]), (74, [100, 126 + phase]),
                   (104, [100, 78 + phase]), (134, [100, 116 + phase]),
                   (160, [100, 88 + phase]), (180, [100, 70 + phase])])
        return group([p, fill(color, op)],
                     gtr(pos=(0, 52), anchor=(0, 52), scale=sc), name="tongue")

    s = strength
    return [
        tongue(34 * s, 96 * s, CYAN_DEEP, 70, seed),
        tongue(24 * s, 66 * s, CYAN, 88, seed + 8),
        tongue(13 * s, 38 * s, CYAN_PALE, 96, seed + 4),
    ]


def rocket(scale=100, rot=0, pos=(0, 0), tint=CYAN, lit=CYAN_LIT,
           deep=CYAN_DEEP, flame=True, flame_strength=1.0, name="rocket"):
    """Готовая ракета: корпус, крылья, стекло и, если нужно, пламя."""
    items = []
    if flame:
        items += rocket_flame(flame_strength)
    items += rocket_body(tint, lit, deep)
    return group(items, gtr(pos=pos, scale=(scale, scale), rot=rot), name=name)


# --- иллюминатор -------------------------------------------------------

def porthole(r=196, tint=CYAN, deep=CYAN_DEEP, lit=CYAN_LIT, glow=True):
    """Круглое окно корабля: тёмное стекло, ободок, блик по краю.

    Даёт стикеру опору на любом фоне - и на светлой теме, и на тёмной.
    """
    items = []
    if glow:
        items.append(group(
            [circle(C, C, r + 16),
             grad([(0, tint), (1, tint)], (C, C - r), (C, C + r), kind=2,
                  opacity=val(16))], name="glow"))
    items += [
        # стекло: глубина от края к центру
        group([circle(C, C, r),
               grad([(0, INK_2), (0.62, INK), (1, "#020509")],
                    (C - r * 0.5, C - r * 0.7), (C + r * 0.6, C + r),
                    kind=2)], name="glass"),
        # ободок корпуса
        group([circle(C, C, r), grad_stroke(
            [(0, lit), (0.5, tint), (1, deep)],
            (C - r, C - r), (C + r, C + r), 9, opacity=96)], name="rim"),
        # внутреннее тонкое кольцо
        group([circle(C, C, r - 15), stroke(tint, 2, 34)], name="rim-in"),
        # блик по верхней дуге: окно живое, а не плоский круг
        group([circle(C, C, r - 5), stroke(WHITE, 6, 30),
               trim(start=val(58), end=val(88))], name="sheen"),
    ]
    return items


def rivets(r=170, count=12, color=CYAN, size=4, op=42):
    """Заклёпки по кругу - мелкая деталь корпуса."""
    x, y = on_circle(C, C, r, 0)
    return group([circle(x, y, size), fill(color, op),
                  repeat(count, rotate=360.0 / count,
                         anchor=(C - x, C - y))], name="rivets")


# --- космос ------------------------------------------------------------

STAR_FIELD = [
    (128, 118, 3.4), (206, 74, 2.2), (352, 96, 3.0), (416, 168, 2.4),
    (92, 206, 2.6), (150, 330, 2.2), (300, 396, 3.2), (404, 322, 2.6),
    (246, 152, 1.8), (330, 258, 2.0), (170, 250, 1.7), (386, 414, 2.0),
]


def stars(color=WHITE, field=None, twinkle=True, op=88):
    """Звёздная россыпь. Мерцают вразнобой, иначе поле выглядит мёртвым."""
    field = field or STAR_FIELD
    out = []
    for i, (x, y, r) in enumerate(field):
        if twinkle:
            ph = (i * 37) % 180
            o = anim([(0, 26 + (i * 13) % 60),
                      (max(1, (ph) % 180), op),
                      (min(179, (ph + 62) % 180 + 1), 22),
                      (180, 26 + (i * 13) % 60)])
        else:
            o = val(op)
        out.append(group([circle(x, y, r), fill(color, o)], name="s%d" % i))
    return group(out, name="stars")


def streaks(color=CYAN_PALE, count=7, op=54, r=176):
    """Полосы скорости: то, что за иллюминатором пролетает мимо.

    Масок в .tgs нет, обрезать по стеклу нечем, поэтому полосы живут
    внутри круга радиусом r - иначе они торчат наружу палками.
    """
    import math as _m
    out = []
    for i in range(count):
        # чем дальше полоса от оси, тем короче её путь по хорде круга
        frac = (i + 0.5) / count
        dx = (frac * 2 - 1) * r * 0.82
        half = _m.sqrt(max(r * r - dx * dx, 1)) * 0.9
        x = C + dx
        w = 2 + (i % 3)
        h = min(46 + (i % 4) * 22, half * 1.1)
        t0 = int((i * 180.0 / count) % 180)
        y0, y1 = C - half, C + half
        # полоса идёт сверху вниз и возвращается, каждая со своим сдвигом
        start = y0 + (y1 - y0) * (t0 / 180.0)
        out.append(group(
            [rect(0, 0, w, h, w / 2.0), fill(color, op)],
            gtr(pos=anim([(0, [x, start]), (180 - t0, [x, y1]),
                          (180 - t0, [x, y0]), (180, [x, start])],
                         easing=False) if t0 else
                anim([(0, [x, y0]), (180, [x, y1])], easing=False)),
            name="k%d" % i))
    return group(out, name="streaks")


def orbit_ring(r, color=CYAN, width=3, op=40, tilt=0, squash=42):
    """Наклонённое кольцо орбиты."""
    return group([ellipse(C, C, r, r * squash / 100.0),
                  stroke(color, width, op)],
                 gtr(pos=(C, C), anchor=(C, C), rot=tilt), name="orbit")


def glow_dot(x, y, r, color, op=100):
    """Точка со свечением - узел сети, огонёк, искра."""
    return group([
        group([circle(x, y, r * 2.6), fill(color, 16)], name="halo"),
        group([circle(x, y, r * 1.6), fill(color, 30)], name="halo2"),
        group([circle(x, y, r), fill(color, op)], name="core"),
    ], name="dot")


# --- объём: приёмы, которыми плоская фигура становится телом ------------
#
# В логотипе Rocket ракета не плоская: у неё металлический корпус с
# бликом, тёмная сторона и стекло. Эти же приёмы собраны здесь, чтобы
# весь пак держал один язык - не рисунок иконки, а предмет со светом.

def shadow(cx, cy, rx, ry, color=INK, op=20, steps=4):
    """Мягкая тень под предметом.

    Размытия в .tgs нет, поэтому мягкость набирается несколькими
    эллипсами с убывающей плотностью.
    """
    out = []
    for i in range(steps, 0, -1):
        k = i / float(steps)
        out.append(group([ellipse(cx, cy, rx * (0.52 + 0.62 * k),
                                  ry * (0.52 + 0.62 * k)),
                          fill(color, op * (1.1 - k) / steps * 1.9)],
                         name="sh%d" % i))
    return group(out, name="shadow")


def glow(cx, cy, r, color, op=26, steps=3):
    """Свечение вокруг источника света."""
    out = []
    for i in range(steps, 0, -1):
        k = i / float(steps)
        out.append(group([circle(cx, cy, r * (0.55 + 0.85 * k)),
                          fill(color, op * (1.05 - k))], name="g%d" % i))
    return group(out, name="glow")


def sphere(cx, cy, r, base, lit, deep, light=(-0.42, -0.46), rim=None,
           rim_op=54, name="sphere"):
    """Шар со светом: свет сверху-слева, тень снизу-справа, отражённый
    свет по нижнему краю и блик.

    Именно отражённый свет по тёмному краю отличает шар от кружка с
    градиентом: без него предмет выглядит наклейкой.
    """
    lx, ly = cx + r * light[0], cy + r * light[1]
    rim = rim or lit
    return group([
        # тело: свет смещён к источнику
        group([circle(cx, cy, r),
               grad([(0, lit), (0.42, base), (1, deep)],
                    (lx, ly), (cx + r * 0.9, cy + r * 1.0), kind=2)],
              name="body"),
        # отражённый свет по нижнему краю
        group([circle(cx, cy, r),
               grad([(0, rim), (0.55, rim), (1, deep)],
                    (cx + r * 0.5, cy + r * 0.86), (cx, cy), kind=2,
                    opacity=val(rim_op))], name="rim"),
        # тень на дальней стороне
        group([circle(cx + r * 0.30, cy + r * 0.34, r * 0.92),
               grad([(0, INK), (1, INK)], (cx, cy), (cx + r, cy + r), kind=2,
                    opacity=val(22))], name="shade"),
        # блик: маленький, смещённый, вытянутый по форме
        group([ellipse(lx, ly, r * 0.30, r * 0.22), fill(WHITE, 52)],
              gtr(pos=(lx, ly), anchor=(lx, ly), rot=-28), name="spec"),
        group([ellipse(lx, ly, r * 0.13, r * 0.09), fill(WHITE, 82)],
              name="spec2"),
    ], name=name)


def metal(shape, p0, p1, base=SILVER, lit=WHITE, deep=STEEL, name="metal"):
    """Металлическая заливка: светлая полоса вдоль формы, как на корпусе
    ракеты в логотипе."""
    return group([shape, grad([(0, deep), (0.28, base), (0.5, lit),
                               (0.74, base), (1, deep)], p0, p1)], name=name)


def glass(shape, p0, p1, tint=CYAN_DEEP, name="glass"):
    """Тёмное стекло с подсветкой к низу."""
    return group([shape, grad([(0, INK), (0.55, INK_2), (1, tint)], p0, p1)],
                 name=name)


def sheen(cx, cy, w, h, rot=-24, op=34):
    """Косой блик - кладётся поверх стекла или металла."""
    return group([ellipse(0, 0, w, h), fill(WHITE, op)],
                 gtr(pos=(cx, cy), rot=rot), name="sheen")


def gloss(cx, cy, r, op=46, spread=0.72, lift=0.30):
    """Глянцевая линза сверху предмета.

    Блик-точка говорит про источник света, а вот эта широкая линза - про
    материал: так выглядит полированный шар или кнопка под стеклом.
    Гаснет к середине, поэтому низ остаётся матовым.
    """
    rx, ry = r * spread, r * spread * 0.62
    cy2 = cy - r * lift
    return group([
        group([ellipse(cx, cy2, rx, ry),
               grad([(0, WHITE), (0.55, WHITE), (1, WHITE)],
                    (cx, cy2 - ry), (cx, cy2 + ry),
                    opacity=val(op))], name="lens"),
    ], name="gloss")


def contact(cx, cy, rx, ry=None, color=INK, op=30):
    """Контактная тень: узкая тёмная полоска там, где предмет касается.

    Без неё предмет висит в воздухе; с ней - стоит.
    """
    ry = ry or rx * 0.16
    return group([
        group([ellipse(cx, cy, rx * 1.25, ry * 1.6), fill(color, op * 0.32)],
              name="soft"),
        group([ellipse(cx, cy, rx, ry), fill(color, op)], name="core"),
    ], name="contact")


def limb(cx, cy, r, color, op=42, width=9):
    """Атмосферный лимб: светящийся ободок по краю шара.

    У планеты с атмосферой край всегда светлее диска - солнце просвечивает
    её насквозь по касательной. Одна эта деталь отличает планету от шарика.
    """
    return group([circle(cx, cy, r - width * 0.4),
                  stroke(color, width, op)], name="limb")


def terminator(cx, cy, r, deep=INK, op=52, shift=0.34):
    """Терминатор: мягкая граница дня и ночи.

    Плоская тёмная заплата поперёк шара читается грязью. Здесь тень
    набирается кольцами убывающей плотности от края к освещённой стороне.
    """
    out = []
    for i in range(4):
        k = i / 3.0
        out.append(group([
            circle(cx + r * shift * (0.35 + 0.65 * k),
                   cy + r * shift * 0.5 * (0.35 + 0.65 * k),
                   r * (1.0 - 0.02 * i)),
            grad([(0, deep), (0.55, deep), (1, deep)],
                 (cx + r, cy + r * 0.6), (cx - r * 0.2, cy - r * 0.3),
                 kind=2, opacity=val(op / 4.0))], name="t%d" % i))
    return group(out, name="terminator")


def from_svg(d, size, pos=(C, C), src=24.0, flip_y=False):
    """Фигура из SVG-пути, вписанная в квадрат size и поставленная в pos.

    Сердце и ладонь от руки выходили кривыми: у таких форм важен каждый
    изгиб, и на глаз их не поставить. Здесь берётся выверенный контур, а
    разбирает его тот же парсер, что переносит фирменный логотип.
    """
    from svg2lottie import parse_path
    k = float(size) / src
    out = []
    for pts, closed in parse_path(d):
        v, i, o = [], [], []
        for p in pts:
            x, y = (p[0] - src / 2) * k + pos[0], (p[1] - src / 2) * k + pos[1]
            ix, iy = (p[2] - src / 2) * k + pos[0], (p[3] - src / 2) * k + pos[1]
            ox, oy = (p[4] - src / 2) * k + pos[0], (p[5] - src / 2) * k + pos[1]
            v.append([x, y])
            i.append([ix - x, iy - y])
            o.append([ox - x, oy - y])
        out.append({"ty": "sh", "ks": val({"i": i, "o": o, "v": v,
                                           "c": closed})})
    return out
