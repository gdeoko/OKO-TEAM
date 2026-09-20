"""Знаки бренда MARA. Единственный источник правды для бота и панели.

Правило то же, что у OKO: логотип берётся ОТСЮДА и нигде не рисуется
заново. Появится новая версия знака — меняются файлы в этой папке и
LOGO_DATA_URI, а не код в двадцати местах.
"""

import pathlib

NAME = "MARA"
TAGLINE = "Её не существует"
BOT = "@maraneon_bot"
CHANNEL = "@maraneon"
SUPPORT = "@maraneon_support_bot"

# Цвет. Снят с EWA Product (#CD2C8A) и сдвинут в ядовитую сторону:
# у них ягодная маджента для БАДов, у нас неон для ночного продукта.
NEON = "#FF0A8C"
GLOW = "#FF5CB4"
DEEP = "#8A0F52"
BLACK = "#000000"
INK = "#0B0A0D"
LINE = "#1C1A20"
WHITE = "#FFFFFF"
MUTE = "#8A8792"

_ЗДЕСЬ = pathlib.Path(__file__).parent
MARK_SVG = _ЗДЕСЬ / "mara-mark.svg"
LOCKUP_SVG = _ЗДЕСЬ / "mara-lockup.svg"
AVATAR_PNG = _ЗДЕСЬ / "mara-avatar-512.png"


def logo_data_uri():
    """Готовая строка для <img src=...>. Читается с диска, не хранится
    в коде: иначе при смене знака половина мест останется на старом."""
    return (_ЗДЕСЬ / "mara-logo-b64.txt").read_text().strip()
