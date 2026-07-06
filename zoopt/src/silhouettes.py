# -*- coding: utf-8 -*-
"""
Плоские векторные силуэты животных в стиле логотипа ЗоОпт.
Каждая функция рисует силуэт вписанным в квадрат [0..1]x[0..1] c началом
координат в левом-нижнем углу, цветом fill. Масштаб/позиция задаются извне
через canvas.translate + canvas.scale.

draw(panel, animal, x_cm, y_cm, size_cm, color) — удобная обёртка: рисует
силуэт по центру (x_cm,y_cm) вписанным в круг диаметра size_cm.
"""
from reportlab.lib.units import mm


# --------- низкоуровневые пути в единичном квадрате ---------
def _dog(p):
    # сидящая собака в профиль (морда вправо), пропорции ретривера
    p.moveTo(0.57, 0.03)                               # передняя лапа
    p.lineTo(0.75, 0.03)
    p.curveTo(0.745, 0.20, 0.735, 0.34, 0.735, 0.44)   # передняя нога вверх
    p.curveTo(0.75, 0.52, 0.775, 0.565, 0.81, 0.60)    # грудь -> горло
    p.curveTo(0.855, 0.615, 0.905, 0.605, 0.95, 0.635) # челюсть -> низ носа
    p.curveTo(0.975, 0.65, 0.975, 0.69, 0.945, 0.705)  # передняя часть носа
    p.curveTo(0.905, 0.725, 0.865, 0.72, 0.835, 0.75)  # верх морды
    p.curveTo(0.805, 0.83, 0.75, 0.905, 0.68, 0.905)   # лоб -> макушка
    p.curveTo(0.665, 0.905, 0.65, 0.885, 0.645, 0.86)  # начало уха
    p.curveTo(0.615, 0.875, 0.585, 0.80, 0.60, 0.735)  # висячее ухо вниз
    p.curveTo(0.61, 0.70, 0.585, 0.675, 0.55, 0.675)   # кончик уха у шеи
    p.curveTo(0.50, 0.675, 0.45, 0.655, 0.415, 0.615)  # затылок -> холка
    p.curveTo(0.31, 0.665, 0.185, 0.60, 0.15, 0.46)    # спина к крупу
    p.curveTo(0.095, 0.34, 0.10, 0.17, 0.19, 0.095)    # круп вниз слева
    p.curveTo(0.25, 0.05, 0.35, 0.04, 0.43, 0.075)     # низ крупа по земле
    p.curveTo(0.48, 0.10, 0.53, 0.09, 0.555, 0.05)     # к передней лапе
    p.close()
    # хвост — небольшой завиток у крупа слева
    p.moveTo(0.155, 0.20)
    p.curveTo(0.075, 0.155, 0.03, 0.235, 0.075, 0.29)
    p.curveTo(0.10, 0.255, 0.125, 0.235, 0.175, 0.245)
    p.close()


def _cat(p):
    # сидящая кошка в профиль (уши, хвост)
    p.moveTo(0.30, 0.02)
    p.lineTo(0.66, 0.02)
    p.curveTo(0.66, 0.24, 0.64, 0.40, 0.62, 0.52)
    p.curveTo(0.62, 0.62, 0.66, 0.70, 0.70, 0.78)
    p.lineTo(0.60, 0.92)                              # левое ухо
    p.lineTo(0.56, 0.74)
    p.curveTo(0.50, 0.72, 0.44, 0.72, 0.40, 0.74)
    p.lineTo(0.34, 0.92)                              # правое ухо (визуально)
    p.lineTo(0.32, 0.74)
    p.curveTo(0.26, 0.64, 0.24, 0.44, 0.26, 0.26)
    p.curveTo(0.28, 0.14, 0.30, 0.06, 0.30, 0.02)
    p.close()
    # хвост
    p.moveTo(0.64, 0.06)
    p.curveTo(0.82, 0.04, 0.92, 0.14, 0.90, 0.30)
    p.curveTo(0.89, 0.38, 0.84, 0.40, 0.84, 0.32)
    p.curveTo(0.85, 0.20, 0.78, 0.14, 0.66, 0.16)
    p.close()


def _fish(p):
    # рыбка в профиль
    p.moveTo(0.06, 0.50)
    p.curveTo(0.18, 0.74, 0.50, 0.80, 0.72, 0.62)   # верх тела
    p.curveTo(0.80, 0.56, 0.86, 0.54, 0.90, 0.56)   # к хвосту
    p.lineTo(1.00, 0.74)                             # верхний хвост
    p.lineTo(0.94, 0.50)
    p.lineTo(1.00, 0.26)                             # нижний хвост
    p.lineTo(0.90, 0.44)
    p.curveTo(0.86, 0.46, 0.80, 0.44, 0.72, 0.38)
    p.curveTo(0.50, 0.20, 0.18, 0.26, 0.06, 0.50)   # низ тела
    p.close()
    # верхний плавник
    p.moveTo(0.40, 0.72)
    p.lineTo(0.52, 0.90)
    p.lineTo(0.58, 0.70)
    p.close()


def _bird(p):
    # попугай на жёрдочке в профиль
    p.moveTo(0.40, 0.04)
    p.curveTo(0.30, 0.10, 0.26, 0.24, 0.30, 0.40)   # грудь
    p.curveTo(0.32, 0.54, 0.34, 0.66, 0.40, 0.78)
    p.curveTo(0.46, 0.90, 0.60, 0.94, 0.70, 0.86)   # голова
    p.curveTo(0.78, 0.80, 0.78, 0.72, 0.72, 0.70)
    p.lineTo(0.90, 0.66)                             # клюв
    p.lineTo(0.72, 0.60)
    p.curveTo(0.72, 0.54, 0.70, 0.50, 0.66, 0.48)
    p.curveTo(0.74, 0.42, 0.78, 0.30, 0.72, 0.18)   # крыло/спина
    p.curveTo(0.84, 0.30, 0.72, 0.06, 0.56, 0.06)   # хвост длинный
    p.lineTo(0.66, 0.02)
    p.lineTo(0.46, 0.02)
    p.close()


def _hamster(p):
    # хомяк — пухлый округлый силуэт в профиль, мордочка вправо
    p.moveTo(0.22, 0.24)
    p.curveTo(0.12, 0.34, 0.12, 0.52, 0.24, 0.62)     # спина округлая
    p.curveTo(0.30, 0.67, 0.38, 0.69, 0.46, 0.68)
    p.curveTo(0.47, 0.76, 0.56, 0.78, 0.585, 0.70)    # маленькое ухо
    p.curveTo(0.66, 0.685, 0.74, 0.63, 0.80, 0.55)    # к щеке
    p.curveTo(0.87, 0.505, 0.90, 0.455, 0.885, 0.42)  # пухлая щека вперёд
    p.curveTo(0.915, 0.43, 0.93, 0.41, 0.915, 0.385)  # носик
    p.curveTo(0.88, 0.36, 0.86, 0.365, 0.83, 0.375)
    p.curveTo(0.74, 0.29, 0.60, 0.24, 0.46, 0.235)    # низ мордочки/грудка
    p.curveTo(0.42, 0.20, 0.34, 0.19, 0.30, 0.215)    # передняя лапка
    p.curveTo(0.27, 0.20, 0.24, 0.205, 0.22, 0.24)
    p.close()


def _turtle(p):
    # черепаха в профиль
    p.moveTo(0.16, 0.30)
    p.curveTo(0.18, 0.52, 0.36, 0.66, 0.60, 0.66)   # панцирь
    p.curveTo(0.80, 0.66, 0.90, 0.54, 0.88, 0.38)
    p.curveTo(0.87, 0.32, 0.82, 0.30, 0.80, 0.34)   # к голове
    p.curveTo(0.90, 0.34, 0.98, 0.40, 0.98, 0.34)   # голова
    p.curveTo(0.98, 0.28, 0.92, 0.26, 0.86, 0.28)
    p.curveTo(0.82, 0.26, 0.78, 0.26, 0.74, 0.28)   # шея вниз
    p.lineTo(0.70, 0.20)                             # передняя лапа
    p.lineTo(0.64, 0.28)
    p.curveTo(0.50, 0.30, 0.36, 0.30, 0.28, 0.28)
    p.lineTo(0.24, 0.20)                             # задняя лапа
    p.lineTo(0.18, 0.28)
    p.close()


def _paw(p):
    # лапа (подушечки) — для нижних плёнок
    # главная подушечка
    p.moveTo(0.30, 0.14)
    p.curveTo(0.18, 0.24, 0.20, 0.44, 0.36, 0.50)
    p.curveTo(0.50, 0.55, 0.62, 0.52, 0.70, 0.44)
    p.curveTo(0.82, 0.34, 0.80, 0.18, 0.66, 0.12)
    p.curveTo(0.54, 0.07, 0.40, 0.07, 0.30, 0.14)
    p.close()


_SHAPES = {
    "dog": _dog, "cat": _cat, "fish": _fish, "bird": _bird,
    "hamster": _hamster, "turtle": _turtle, "paw": _paw,
}


def draw_unit(canvas, shape, color):
    canvas.setFillColor(color)
    path = canvas.beginPath()
    _SHAPES[shape](path)
    canvas.drawPath(path, stroke=0, fill=1)


def draw(panel, shape, x_cm, y_cm, size_cm, color):
    """Рисует силуэт по центру (x_cm,y_cm сверху) вписанным в квадрат size_cm."""
    c = panel.c
    c.saveState()
    # левый-нижний угол единичного квадрата
    x0 = panel.X(x_cm - size_cm / 2.0)
    y0 = panel.Y(y_cm + size_cm / 2.0)
    c.translate(x0, y0)
    c.scale(panel.S(size_cm), panel.S(size_cm))
    draw_unit(c, shape, color)
    c.restoreState()


# =================================================================
# Простые вектор-иконки для нижних плёнок (рисуются напрямую на canvas)
# Все — в стиле flat, задаются центром и размером в см на панели.
# =================================================================
def icon(panel, kind, x_cm, y_cm, size_cm, color):
    c = panel.c
    c.saveState()
    c.setFillColor(color)
    c.setStrokeColor(color)
    s = panel.S(size_cm)
    cx = panel.X(x_cm)
    cy = panel.Y(y_cm)

    def circle(dx, dy, r, fill=1, sw=0.0):
        c.setLineWidth(panel.S(sw))
        c.circle(cx + dx * s, cy + dy * s, r * s, stroke=1 if sw else 0, fill=fill)

    if kind == "bowl":  # миска
        p = c.beginPath()
        p.moveTo(cx - 0.5 * s, cy + 0.05 * s)
        p.lineTo(cx + 0.5 * s, cy + 0.05 * s)
        p.curveTo(cx + 0.42 * s, cy - 0.35 * s, cx - 0.42 * s, cy - 0.35 * s, cx - 0.5 * s, cy + 0.05 * s)
        c.drawPath(p, fill=1, stroke=0)
        c.setLineWidth(panel.S(0.06 * size_cm))
        c.setStrokeColor(color)
        c.ellipse(cx - 0.5 * s, cy + 0.0 * s, cx + 0.5 * s, cy + 0.16 * s, stroke=1, fill=0)
    elif kind == "bone":  # косточка
        r = 0.16
        circle(-0.42, 0.16, r); circle(-0.42, -0.16, r)
        circle(0.42, 0.16, r); circle(0.42, -0.16, r)
        c.rect(cx - 0.42 * s, cy - 0.12 * s, 0.84 * s, 0.24 * s, stroke=0, fill=1)
    elif kind == "leash":  # поводок (карабин+ремень)
        c.setLineWidth(panel.S(0.10 * size_cm))
        c.setStrokeColor(color)
        p = c.beginPath()
        p.moveTo(cx - 0.45 * s, cy - 0.4 * s)
        p.curveTo(cx - 0.1 * s, cy + 0.1 * s, cx + 0.2 * s, cy + 0.2 * s, cx + 0.35 * s, cy + 0.42 * s)
        c.drawPath(p, stroke=1, fill=0)
        c.circle(cx + 0.4 * s, cy + 0.42 * s, 0.12 * s, stroke=1, fill=0)
    elif kind == "wheel":  # колесо для грызуна
        c.setLineWidth(panel.S(0.08 * size_cm))
        c.setStrokeColor(color)
        c.circle(cx, cy, 0.45 * s, stroke=1, fill=0)
        c.circle(cx, cy, 0.30 * s, stroke=1, fill=0)
        for a in range(0, 360, 45):
            import math
            dx, dy = math.cos(math.radians(a)), math.sin(math.radians(a))
            c.line(cx + 0.30 * s * dx, cy + 0.30 * s * dy, cx + 0.45 * s * dx, cy + 0.45 * s * dy)
    elif kind == "perch":  # жёрдочка
        c.setLineWidth(panel.S(0.09 * size_cm))
        c.setStrokeColor(color)
        c.line(cx, cy + 0.5 * s, cx, cy - 0.2 * s)
        c.line(cx - 0.35 * s, cy - 0.2 * s, cx + 0.35 * s, cy - 0.2 * s)
        c.line(cx - 0.25 * s, cy + 0.5 * s, cx + 0.25 * s, cy + 0.5 * s)
    elif kind == "feeder":  # кормушка
        c.rect(cx - 0.4 * s, cy - 0.4 * s, 0.8 * s, 0.5 * s, stroke=0, fill=1)
        c.setLineWidth(panel.S(0.08 * size_cm)); c.setStrokeColor(color)
        c.line(cx, cy + 0.1 * s, cx, cy + 0.45 * s)
        c.arc(cx - 0.25 * s, cy + 0.3 * s, cx + 0.25 * s, cy + 0.6 * s, 0, 180)
    elif kind == "yarn":  # клубок
        c.circle(cx, cy, 0.45 * s, stroke=0, fill=1)
        c.setStrokeColor(color)
    elif kind == "post":  # когтеточка
        c.rect(cx - 0.12 * s, cy - 0.45 * s, 0.24 * s, 0.9 * s, stroke=0, fill=1)
        c.rect(cx - 0.35 * s, cy - 0.5 * s, 0.7 * s, 0.12 * s, stroke=0, fill=1)
        c.circle(cx, cy + 0.5 * s, 0.12 * s, stroke=0, fill=1)
    elif kind == "bubbles":  # пузыри
        circle(-0.2, -0.2, 0.18); circle(0.15, 0.05, 0.12); circle(0.3, 0.3, 0.08)
    c.restoreState()


def waves(panel, y_cm, amp_cm=2.0, wl_cm=8.0, color=None, weight_cm=0.4):
    """Волны по всей ширине панели на высоте y_cm."""
    import math
    from design_system import GREEN
    c = panel.c
    c.setStrokeColor(color or GREEN)
    c.setLineWidth(panel.S(weight_cm))
    for off in (0, amp_cm * 1.6):
        p = c.beginPath()
        x = 3.0
        p.moveTo(panel.X(x), panel.Y(y_cm + off))
        while x <= panel.w - 3.0:
            x += 0.5
            yy = y_cm + off + amp_cm * math.sin(2 * math.pi * x / wl_cm)
            p.lineTo(panel.X(x), panel.Y(yy))
        c.drawPath(p, stroke=1, fill=0)
