"""Знаки бренда AMBERRY. Единственный источник правды для бота и панели.

Правило то же, что у OKO: логотип берётся ОТСЮДА и нигде не рисуется
заново. Появится новая версия знака — меняются файлы в этой папке, а не
код в двадцати местах.
"""

import pathlib

NAME = "AMBERRY"
TAGLINE = "Оживляет любое фото"
BOT = "@theamberrybot"
CHANNEL = "@amberryneon"
SUPPORT = "@amberry_support_bot"

NEON = "#FF0A8C"
GLOW = "#FF5CB4"
DEEP = "#8A0F52"
AMBER = "#FFB020"          # редкий акцент, «amber» из имени
BLACK = "#000000"
INK = "#0B0A0D"
LINE = "#1C1A20"
WHITE = "#FFFFFF"
MUTE = "#8A8792"

_ЗДЕСЬ = pathlib.Path(__file__).parent
MARK_SVG = _ЗДЕСЬ / "amberry-mark.svg"          # вектор: ягода + надпись
ICON_SVG = _ЗДЕСЬ / "amberry-icon.svg"          # вектор: одна ягода, квадрат
AVATAR_PNG = _ЗДЕСЬ / "amberry-avatar-512.png"  # аватарка из вектора
ICON_PNG = _ЗДЕСЬ / "amberry-icon-512.png"
HERO_JPG = _ЗДЕСЬ / "amberry-hero.jpg"          # парадный рендер с фоном


def mark_or_icon(px):
    """Мельче сотни пикселей надпись схлопывается в полоску — там ставится
    одна ягода. Порог не на глаз: на 96 px слово ещё читается, на 48 нет."""
    return MARK_SVG if px >= 96 else ICON_SVG


def logo_data_uri():
    """Готовая строка для <img src=...>. Читается с диска, не хранится в
    коде: иначе при смене знака половина мест останется на старом."""
    return (_ЗДЕСЬ / "amberry-logo-b64.txt").read_text().strip()
