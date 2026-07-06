# -*- coding: utf-8 -*-
"""
16 плёнок оклейки витрины ЗоОпт (павильон №69-70).
Каждая функция строит одну плёнку и возвращает путь к PDF.
Размеры — по замерам витрины (см), контент — по ТЗ.
"""
import design_system as ds
from design_system import (Panel, IVORY, GREEN, GREEN_DARK, YELLOW, BLACK, RICH_BLACK,
                           F_HEAD, F_BLACK, F_HEAD_S, F_SUB, F_SUB_R, F_SUB_B)
import silhouettes as sil

PHONE = "+7 (977) 99-555-66"
SITE = "zoopt.ru"


def _dots(items):
    return "  ·  ".join(items)


def _shell(name, w, h, logo_corner=True):
    p = Panel(name, w, h)
    p.background()
    p.edge_stripes()
    if logo_corner:
        p.logo_corner(height_cm=8.0, margin_cm=3.0, which="left")
    return p


def _category_top(name, w, h, ai_name, heading, items, circle_d, head_cm=8.0):
    """Верхняя категорийная плёнка: круг-луна + премиум AI-силуэт + заголовок + список."""
    p = _shell(name, w, h, logo_corner=True)
    cx = p.cx
    cy_circle = h * 0.40
    p.ai_moon(ai_name, cx, cy_circle, circle_d)
    y_head = cy_circle + circle_d / 2.0 + head_cm + 3.0
    if isinstance(heading, (list, tuple)):
        for i, line in enumerate(heading):
            p.text_fit(y_head + i * (head_cm + 1.5), line, F_HEAD, head_cm,
                       GREEN_DARK, max_w_cm=w - 16, tracking=0.08)
        y_head += (len(heading) - 1) * (head_cm + 1.5)
    else:
        p.text_fit(y_head, heading, F_HEAD, head_cm, GREEN_DARK,
                   max_w_cm=w - 16, tracking=0.1)
    p.text_fit(y_head + head_cm + 5.0, _dots(items), F_SUB_B, 3.4, BLACK,
               max_w_cm=w - 13)
    p.corner_leaves(size_cm=4.5)
    return p.finish()


# ============================ СЕКЦИЯ 1 ============================
def section_1_top():   # 65×90 — логотип + СКЛАД·МАРКЕТ
    p = Panel("vitrina_01_top_65x90", 65, 90)
    p.background(); p.edge_stripes()
    # векторный локап: эмблема + шрифтовой знак — чёткий на большом размере
    p.brand_lockup(y_top_cm=16, emblem_h_cm=22, wordmark_cap_cm=9.5, tagline=True)
    p.corner_leaves(size_cm=6.0)
    return p.finish()


def section_1_bottom():  # 65×110 — часы работы + QR
    p = _shell("vitrina_01_bottom_65x110", 65, 110, logo_corner=False)
    p.text_fit(20, "ЧАСЫ РАБОТЫ", F_HEAD, 6.0, GREEN_DARK, max_w_cm=51, tracking=0.08)
    p.moon_circle(p.cx, 48, 36)
    p.text(p.cx, 46, "9:00", F_BLACK, 7.2, BLACK)
    p.text(p.cx, 59, "18:00", F_BLACK, 7.2, BLACK)
    p.qr(p.cx - 7, 74, 14, f"https://{SITE}")
    p.text(p.cx, 96, SITE, F_SUB_B, 3.2, GREEN_DARK)
    p.corner_leaves(size_cm=4.0)
    return p.finish()


# ============================ СЕКЦИЯ 2 (СОБАКИ) ==================
def section_2_top():   # 51×117
    return _category_top("vitrina_02_top_51x117", 51, 117, "dog", "СОБАКАМ",
                         ["Корма", "Игрушки", "Аксессуары"], circle_d=40, head_cm=8.0)


def section_2_bottom():  # 51×57 — аксессуары собак (AI)
    p = _shell("vitrina_02_bottom_51x57", 51, 57, logo_corner=False)
    p.ai_scene("dogtoys", p.cx, 28, max_w_cm=42, max_h_cm=44)
    return p.finish()


# ============================ СЕКЦИЯ 3 — ДВЕРЬ №70 ==============
def _door_top(name, w, h, number):
    p = Panel(name, w, h)
    p.background(); p.edge_stripes()
    p.logo_center(y_cm=8, height_cm=6)
    cy = h * 0.44
    d = min(w - 12, 42)
    p.moon_circle(p.cx, cy, d)
    p.text(p.cx, cy + d * 0.28, number, F_BLACK, d * 0.62, BLACK)
    p.text_fit(cy + d / 2.0 + 12, "ВХОД", F_HEAD, 9.5, GREEN_DARK, max_w_cm=w - 15, tracking=0.25)
    p.corner_leaves(size_cm=4.0)
    return p.finish()


def section_3_top():   # 51×117 — ВХОД №70
    return _door_top("vitrina_03_top_51x117_DOOR70", 51, 117, "70")


def section_3_bottom():  # 51×57 — дверь низ (по ТЗ можно прозрачную; печатаем простую)
    p = Panel("vitrina_03_bottom_51x57_DOOR70", 51, 57)
    p.background(); p.edge_stripes()
    p.frame_thin(inset_cm=4.0, color=GREEN, weight_cm=0.2)
    p.text(p.cx, 32, SITE, F_SUB_B, 3.2, GREEN_DARK)
    return p.finish()


# ============================ СЕКЦИЯ 4 (КОШКИ) =================
def section_4_top():   # 65×90
    return _category_top("vitrina_04_top_65x90", 65, 90, "cat", "КОШКАМ",
                         ["Корма", "Наполнители", "Игрушки"], circle_d=38, head_cm=8.0)


def section_4_bottom():  # 65×110 — игрушки кошек (AI)
    p = _shell("vitrina_04_bottom_65x110", 65, 110, logo_corner=False)
    p.text_fit(16, "КОШКИ ЛЮБЯТ ЗоОпт", F_HEAD, 4.2, GREEN_DARK, max_w_cm=49, tracking=0.04)
    p.ai_scene("cattoys", p.cx, 60, max_w_cm=51, max_h_cm=48)
    p.text_fit(100, "Ассортимент 300+ товаров", F_SUB, 2.8, BLACK, max_w_cm=49)
    return p.finish()


# ============================ СЕКЦИЯ 5 — ДВЕРЬ №69 =============
def section_5_top():   # 65×90 — ВХОД №69
    return _door_top("vitrina_05_top_65x90_DOOR69", 65, 90, "69")


def section_5_bottom():  # 65×110 — лого + zoopt.ru
    p = Panel("vitrina_05_bottom_65x110_DOOR69", 65, 110)
    p.background(); p.edge_stripes()
    p.brand_lockup(y_top_cm=26, emblem_h_cm=20, wordmark_cap_cm=7.5, tagline=True)
    p.text(p.cx, 96, SITE, F_SUB_B, 3.4, GREEN_DARK)
    p.corner_leaves(size_cm=4.0)
    return p.finish()


# ============================ СЕКЦИЯ 6 (ГРЫЗУНЫ И ПТИЦЫ) ======
def section_6_top():   # 51×117
    return _category_top("vitrina_06_top_51x117", 51, 117, "rodent",
                         ["ГРЫЗУНАМ", "И ПТИЦАМ"], ["Клетки", "Корма", "Витамины"],
                         circle_d=40, head_cm=6.0)


def section_6_bottom():  # 51×57 — товары для птиц и грызунов (AI)
    p = _shell("vitrina_06_bottom_51x57", 51, 57, logo_corner=False)
    p.ai_scene("birds", p.cx, 28, max_w_cm=42, max_h_cm=44)
    return p.finish()


# ============================ СЕКЦИЯ 7 (АКВАРИУМИСТИКА) =======
def section_7_top():   # 51×117
    return _category_top("vitrina_07_top_51x117", 51, 117, "aqua",
                         "АКВАРИУМИСТИКА", ["Аквариумы", "Корма", "Фильтры"],
                         circle_d=40, head_cm=5.0)


def section_7_bottom():  # 51×57 — аквариум (AI)
    p = _shell("vitrina_07_bottom_51x57", 51, 57, logo_corner=False)
    p.ai_scene("aqua", p.cx, 28, max_w_cm=43, max_h_cm=46)
    return p.finish()


# ============================ СЕКЦИЯ 8 (ОПТ) ==================
def section_8_top():   # 65×90 — ОПТ
    p = Panel("vitrina_08_top_65x90", 65, 90)
    p.background(); p.edge_stripes()
    p.logo_center(y_cm=6, height_cm=7)
    p.text_fit(58, "ОПТ", F_BLACK, 46, GREEN_DARK, max_w_cm=49, tracking=0.05)
    p.text_fit(74, "ДЛЯ МАГАЗИНОВ И ВЕТКЛИНИК", F_SUB_B, 3.2, BLACK, max_w_cm=49)
    p.corner_leaves(size_cm=5.0)
    return p.finish()


def section_8_bottom():  # 65×110 — большой QR прайса + телефон
    p = _shell("vitrina_08_bottom_65x110", 65, 110, logo_corner=False)
    p.text_fit(16, "ПРАЙС ОПТОМ", F_HEAD, 5.2, GREEN_DARK, max_w_cm=49, tracking=0.08)
    p.qr(p.cx - 15, 24, 30, f"https://{SITE}/wholesale")
    p.text(p.cx, 66, "Наведите камеру —", F_SUB, 2.6, BLACK)
    p.text(p.cx, 70.5, "скачать прайс-лист", F_SUB, 2.6, BLACK)
    p.moon_circle(p.cx, 88, 14, color=YELLOW)
    p.text(p.cx, 88.5, PHONE, F_SUB_B, 2.7, BLACK)
    p.text_fit(100, SITE + "/wholesale", F_SUB_B, 3.0, GREEN_DARK, max_w_cm=49)
    p.corner_leaves(size_cm=4.0)
    return p.finish()


# ------------------------------------------------------------------
ALL = [
    section_1_top, section_1_bottom,
    section_2_top, section_2_bottom,
    section_3_top, section_3_bottom,
    section_4_top, section_4_bottom,
    section_5_top, section_5_bottom,
    section_6_top, section_6_bottom,
    section_7_top, section_7_bottom,
    section_8_top, section_8_bottom,
]
