# -*- coding: utf-8 -*-
"""Rocket VPN: защита, приватность, обход блокировок.

Фиолетовая половина бренда. Предметы объёмные: у металла светлая полоса
вдоль формы, у корпусов фаска сверху и отражённый свет снизу.
"""

from tgs import (CYAN, CYAN_DEEP, CYAN_LIT, CYAN_PALE, INK, INK_2, MIST,
                 SILVER, STEEL, VIOLET, VIOLET_DEEP, VIOLET_LIT, WHITE, anim,
                 circle, ellipse, fill, grad, grad_stroke, group, gtr, layer,
                 on_circle, path, pulse, rect, stroke, trim, val)
import brand_logo as BL
from parts import C, glow, shadow, sphere

DEEPEST = "#2A1470"   # дно фиолетового, темнее VIOLET_DEEP
BAD_RED = "#F87171"


def _shield(w, h):
    """Гербовый щит: плечи вверху, остриё внизу."""
    return path([
        (0, -h),
        (w, -h * 0.60, -w * 0.5, 0, 0, 0),
        (w * 0.86, h * 0.18, 0, 0, 0, h * 0.34),
        (0, h, w * 0.42, -h * 0.2, -w * 0.42, -h * 0.2),
        (-w * 0.86, h * 0.18, 0, h * 0.34, 0, 0),
        (-w, -h * 0.60, 0, 0, w * 0.5, 0),
    ])


def shield():
    """Щит VPN: полированный кант, утопленное поле, знак внутри."""
    shine = anim([(0, [C - 150, C + 210]), (96, [C + 150, C - 210]),
                  (180, [C + 150, C - 210])])
    shine_op = anim([(0, 0), (14, 60), (84, 60), (100, 0), (180, 0)])
    return [
        layer([shadow(C, C + 196, 122, 20, op=24)], name="shadow"),
        layer([
            group([_shield(160, 198),
                   grad([(0, VIOLET_LIT), (0.34, WHITE), (0.56, VIOLET),
                         (1, VIOLET_DEEP)],
                        (C - 150, C - 190), (C + 150, C + 190))],
                  gtr(pos=(C, C - 4)), name="edge"),
            group([_shield(132, 164),
                   grad([(0, VIOLET), (0.5, VIOLET_DEEP), (1, DEEPEST)],
                        (C - 120, C - 150), (C + 120, C + 160))],
                  gtr(pos=(C, C - 2)), name="field"),
            group([_shield(132, 164), stroke(VIOLET_LIT, 5, 42)],
                  gtr(pos=(C, C - 2)), name="inner"),
        ], name="shield", scale=pulse([98, 98], [102, 102], times=2)),
        layer([BL.mark("vpn", 178, (C + 6, C - 14), color=WHITE,
                       with_trail=False)], name="mark"),
        layer([group([rect(0, 0, 74, 500, 37), fill(WHITE, 26)],
                     gtr(pos=shine, rot=-34, opacity=shine_op), name="s")],
              name="shine"),
    ]


def _bow(w=64, top=-40, bottom=30, width=32):
    """Стальная дужка замка: скоба с круглым сечением."""
    return group([
        path([(-w, bottom), (-w, top, 0, 0, 0, -52),
              (w, top, 0, -52, 0, 0), (w, bottom, 0, 0, 0, 0)], closed=False),
        grad_stroke([(0, STEEL), (0.28, WHITE), (0.55, MIST), (1, STEEL)],
                    (-w, top - 20), (w, bottom), width, opacity=100),
    ], name="bow")


def _lock_body(color_top=VIOLET_LIT, color_mid=VIOLET, color_deep=VIOLET_DEEP):
    """Корпус замка: фаска сверху, тело, отражённый свет снизу."""
    return [
        group([rect(C, C + 56, 250, 196, 44),
               grad([(0, color_top), (0.16, color_mid), (0.72, color_deep),
                     (1, DEEPEST)],
                    (C - 125, C - 42), (C + 125, C + 154))], name="body"),
        group([rect(C, C + 56, 250, 196, 44), stroke(color_top, 4, 58)],
              name="rim"),
        group([rect(C, C - 16, 192, 32, 16), fill(WHITE, 22)], name="top"),
        group([rect(C, C + 136, 192, 16, 8), fill(color_top, 34)],
              name="bottom"),
        group([circle(C, C + 34, 29), fill("#1A0E42")], name="hole"),
        group([circle(C, C + 34, 29), stroke(INK, 4, 54)], name="hole-r"),
        group([rect(C, C + 78, 21, 50, 10), fill("#1A0E42")], name="slot"),
    ]


def lock():
    """Замок защёлкивается: дужка садится в корпус, вспыхивает свет."""
    bow = anim([(0, [C, C - 118]), (44, [C, C - 74]), (58, [C, C - 82]),
                (70, [C, C - 78]), (180, [C, C - 78])])
    return [
        layer([shadow(C, C + 168, 132, 20, op=26)], name="shadow"),
        layer([group([glow(C, C + 40, 150, VIOLET_LIT, op=22)],
                     gtr(anchor=(C, C + 40), pos=(C, C + 40),
                         opacity=anim([(0, 0), (58, 0), (68, 90), (110, 0),
                                       (180, 0)])), name="g")], name="flash"),
        layer([_bow()], name="bow", pos=bow),
        layer(_lock_body(), name="body"),
    ]


def unlock():
    """Замок открыт: дужка отходит, корпус горит зелёным светом доступа."""
    bow = anim([(0, [C - 44, C - 96]), (90, [C - 44, C - 108]),
                (180, [C - 44, C - 96])])
    return [
        layer([shadow(C, C + 168, 132, 20, op=26)], name="shadow"),
        layer([group([_bow()], gtr(rot=-18), name="b")], name="bow", pos=bow),
        layer(_lock_body(CYAN_LIT, CYAN, CYAN_DEEP), name="body",
              scale=pulse([100, 100], [103, 103], times=2)),
    ]


def key():
    """Ключ поворачивается - доступ выдан."""
    turn = anim([(0, -16), (60, 14), (120, -7), (180, -16)])
    return [
        layer([shadow(C, C + 150, 130, 18, op=20)], name="shadow"),
        layer([
            group([circle(C - 72, C + 6, 66),
                   grad([(0, VIOLET_LIT), (0.4, VIOLET), (1, VIOLET_DEEP)],
                        (C - 130, C - 56), (C - 14, C + 68))], name="ring"),
            group([circle(C - 72, C + 6, 66), stroke(WHITE, 4, 30)],
                  name="ring-hi"),
            group([circle(C - 72, C + 6, 31), fill(DEEPEST)], name="hole"),
            group([rect(C + 42, C + 6, 224, 40, 14),
                   grad([(0, VIOLET_LIT), (0.4, VIOLET), (1, VIOLET_DEEP)],
                        (C - 70, C - 14), (C + 154, C + 26))], name="stem"),
            group([rect(C + 42, C - 6, 200, 8, 4), fill(WHITE, 26)],
                  name="stem-hi"),
            group([rect(C + 100, C + 44, 30, 54, 10), fill(VIOLET)],
                  name="t1"),
            group([rect(C + 146, C + 40, 26, 46, 9), fill(VIOLET)],
                  name="t2"),
        ], name="key", rot=turn),
    ]


def anon():
    """Приватность: фигура в капюшоне, лица не видно.

    Прежде круглая голова над узким телом читалась снеговиком. Капюшон
    и широкие плечи дают силуэт, который узнаётся с одного взгляда.
    """
    return [
        layer([shadow(C, C + 214, 150, 20, op=22)], name="shadow"),
        layer([
            # плечи: шире книзу, срезанные - фигура, а не столбик
            group([path([(C - 78, C - 4), (C + 78, C - 4),
                         (C + 168, C + 200, 18, -84, 0, 0),
                         (C - 168, C + 200, 0, 0, -18, -84)]),
                   grad([(0, VIOLET), (0.6, VIOLET_DEEP), (1, DEEPEST)],
                        (C - 160, C + 10), (C + 160, C + 200))],
                  name="shoulders"),
            # капюшон поверх головы
            group([path([(C, C - 156, -104, 8, 104, 8),
                         (C + 108, C + 44, 6, -76, -4, 44),
                         (C - 108, C + 44, 4, 44, -6, -76)]),
                   grad([(0, VIOLET_LIT), (0.45, VIOLET), (1, VIOLET_DEEP)],
                        (C - 108, C - 150), (C + 108, C + 50))],
                  name="hood"),
            # тень внутри капюшона - там, где лицо
            group([ellipse(C, C - 24, 74, 86), fill("#0E0726", 96)],
                  name="face"),
            group([circle(C - 30, C - 30, 11), fill(CYAN_LIT, 94)], name="e1"),
            group([circle(C + 30, C - 30, 11), fill(CYAN_LIT, 94)], name="e2"),
            # край капюшона ловит свет
            group([path([(C, C - 150, -96, 8, 96, 8),
                         (C + 98, C + 30, 4, -70, 0, 0),
                         (C - 98, C + 30, 0, 0, -4, -70)], closed=False),
                   stroke(VIOLET_LIT, 6, 54)], name="edge"),
        ], name="figure"),
        layer([group([_shield(52, 64),
                      grad([(0, CYAN_LIT), (1, CYAN_DEEP)],
                           (C + 74, C + 76), (C + 140, C + 178))],
                     gtr(pos=(C + 112, C + 124)), name="badge"),
               group([_shield(52, 64), stroke(WHITE, 4, 58)],
                     gtr(pos=(C + 112, C + 124)), name="rim")],
              name="badge", scale=pulse([97, 97], [106, 106], times=3)),
    ]


def geo():
    """Смена страны: глобус, метка перескакивает по точкам."""
    hops = [(C - 58, C - 48), (C + 50, C + 6), (C - 16, C + 66)]
    jump = anim([(0, list(hops[0])), (56, list(hops[0])),
                 (62, list(hops[1])), (116, list(hops[1])),
                 (122, list(hops[2])), (180, list(hops[2]))], easing=False)
    grid = []
    for i in range(3):
        rx = 134 - i * 44
        grid.append(group([ellipse(C, C, max(rx, 12), 134),
                           stroke(VIOLET_LIT, 3, 44)], name="m%d" % i))
    return [
        layer([glow(C, C, 128, VIOLET_LIT, op=14)], name="atmo"),
        layer([sphere(C, C, 134, "#6C3BE8", "#C4A8FF", VIOLET_DEEP,
                      rim=VIOLET_LIT)], name="globe"),
        layer(grid + [group([rect(C, C, 268, 3, 2), fill(VIOLET_LIT, 52)],
                            name="eq")], name="grid"),
        layer([group([
            group([path([(0, 40), (34, -20, 14, 20, -12, -20),
                         (-34, -20, -12, -20, 14, 20)]),
                   grad([(0, WHITE), (0.5, CYAN_PALE), (1, CYAN)],
                        (-34, -44), (34, 40))], name="pin"),
            group([path([(0, 40), (34, -20, 14, 20, -12, -20),
                         (-34, -20, -12, -20, 14, 20)]),
                   stroke(CYAN_DEEP, 5, 70)], name="pin-r"),
            group([circle(0, -22, 13), fill(DEEPEST)], name="hole"),
        ], gtr(pos=jump), name="pin")], name="pin"),
    ]


def tunnel():
    """Защищённый туннель: кольца бегут к центру, в нём идёт ракета."""
    rings = []
    for i in range(6):
        t0 = i * 30
        sc = anim([(0, [168 - i * 26, 168 - i * 26]),
                   (180, [22, 22])], easing=False)
        rings.append(group([circle(C, C, 100),
                            stroke(VIOLET_LIT if i % 2 else CYAN_LIT, 13,
                                   anim([(0, 34), (60, 100), (180, 28)]))],
                           gtr(pos=(C, C), anchor=(C, C), scale=sc),
                           name="r%d" % i))
    return [
        layer(rings, name="rings"),
        layer([BL.rocket("vpn", 96, (C + 46, C - 52), rot=-30)],
              name="rocket", scale=pulse([95, 95], [105, 105], times=2)),
    ]


def unblock():
    """Блок снят: запрет разваливается, путь открыт."""
    off_l = anim([(0, [C, C]), (64, [C, C]), (108, [C - 210, C - 80]),
                  (180, [C - 210, C - 80])])
    off_r = anim([(0, [C, C]), (64, [C, C]), (108, [C + 210, C + 80]),
                  (180, [C + 210, C + 80])])
    fade = anim([(0, 100), (64, 100), (106, 0), (180, 0)])
    show = anim([(0, 0), (84, 0), (114, 100), (180, 100)])
    return [
        layer([group([BL.rocket("vpn", 148, (C + 54, C - 62), rot=-30)],
                     gtr(opacity=show), name="free")], name="rocket"),
        layer([
            group([group([circle(C, C, 124), stroke(BAD_RED, 22, 100),
                          trim(start=val(0), end=val(50))], name="h")],
                  gtr(pos=off_l, anchor=(C, C), opacity=fade), name="l"),
            group([group([circle(C, C, 124), stroke(BAD_RED, 22, 100),
                          trim(start=val(50), end=val(100))], name="h")],
                  gtr(pos=off_r, anchor=(C, C), opacity=fade), name="r"),
        ], name="ban"),
        layer([group([rect(C, C, 248, 22, 11), fill(BAD_RED)],
                     gtr(pos=(C, C), anchor=(C, C), rot=-45, opacity=fade),
                     name="bar")], name="bar"),
    ]


SCENES = [
    ("shield",  shield,  "🛡", "Щит VPN"),
    ("lock",    lock,    "🔒", "Защита включена"),
    ("unlock",  unlock,  "🔓", "Доступ открыт"),
    ("key",     key,     "🔑", "Ключ"),
    ("anon",    anon,    "🥷", "Анонимность"),
    ("geo",     geo,     "🌐", "Смена страны"),
    ("tunnel",  tunnel,  "🕳", "Туннель"),
    ("unblock", unblock, "🚫", "Блок снят"),
]
