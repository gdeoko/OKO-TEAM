# -*- coding: utf-8 -*-
"""Сборка пака Rocket Pack из фотореалистичных кадров.

Порядок в паке задаётся ЗДЕСЬ, а не порядком файлов на диске: сперва
бренд и космос, потом VPN, потом CDN, в конце реакции для переписки.
Человек листает пак сверху вниз и должен понимать, где он находится.

Замок собирается из двух кадров в один стикер, знак берётся настоящим
файлом логотипа и через ключ по чёрному не идёт.

    python3 build_foto.py [папка_кадров] [папка_выдачи]
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import foto_sticker as F

# (ключ, эмодзи, подпись, движение, источник, второй кадр)
ПАК = [
    ("logo",     "💙", "Знак Rocket",    "парит",   "logo",     None),
    ("launch",   "🚀", "Взлёт",          "полёт",   "launch",   None),
    ("earth",    "🌍", "Сеть",           "парит",   "earth",    None),
    ("jupiter",  "🟠", "Юпитер",         "парит",   "jupiter",  None),
    ("mars",     "🔴", "Марс",           "парит",   "mars",     None),
    ("saturn",   "🪐", "Сатурн",         "парит",   "saturn",   None),
    ("moon",     "🌙", "Луна",           "парит",   "moon",     None),
    ("sun",      "☀️", "Солнце",         "пульс",   "sun",      None),
    ("astro",    "👨‍🚀", "Космонавт",   "парит",   "astro",    None),

    ("shield",   "🛡", "Щит VPN",        "покой",   "shield",   None),
    ("lock",     "🔓", "Замок и ключ",   "переход", "lock_a",   "lock_b"),
    ("key",      "🔑", "Ключ",           "покой",   "key",      None),
    ("anon",     "🥷", "Анонимность",    "парит",   "anon",     None),
    ("geo",      "🌐", "Смена страны",   "парит",   "geo",      None),
    ("tunnel",   "🕳", "Туннель",        "пульс",   "tunnel",   None),
    ("unblock",  "🚫", "Блок снят",      "пульс",   "unblock",  None),

    ("bolt",     "⚡", "Скорость",       "пульс",   "bolt",     None),
    ("dc",       "🏢", "Свои ЦОД",       "покой",   "dc",       None),
    ("speed",    "🏎", "На пределе",     "пульс",   "speed",    None),
    ("wifi",     "📶", "Раздача",        "пульс",   "wifi",     None),
    ("cloud",    "☁️", "Облако",         "парит",   "cloud",    None),
    ("play",     "▶️", "Стриминг",       "пульс",   "play",     None),
    ("download", "⬇️", "Загрузка",       "покой",   "download", None),
    ("chart",    "📈", "Рост",           "покой",   "chart",    None),
    ("fire",     "🔥", "Турбо",          "пульс",   "fire",     None),

    ("ok",       "✅", "Готово",         "пульс",   "ok",       None),
    ("bad",      "❌", "Не вышло",       "пульс",   "bad",      None),
    ("heart",    "❤️", "Спасибо",        "пульс",   "heart",    None),
    ("like",     "👍", "Одобряю",        "парит",   "like",     None),
    ("warn",     "⚠️", "Внимание",       "пульс",   "warn",     None),
    ("hello",    "👋", "Привет",         "парит",   "hello",    None),
]


def main():
    кадры = sys.argv[1] if len(sys.argv) > 1 else "/opt/oko-poster/rocketpack"
    выдача = sys.argv[2] if len(sys.argv) > 2 else os.path.join(кадры, "out")
    os.makedirs(выдача, exist_ok=True)

    манифест, нет = [], []
    for ключ, эмодзи, подпись, движение, ист, второй in ПАК:
        src = os.path.join(кадры, ист + ".png")
        втор = os.path.join(кадры, второй + ".png") if второй else None
        if not os.path.exists(src) or (втор and not os.path.exists(втор)):
            нет.append(ключ)
            continue
        dest, n, br = F.собрать_ключ(src, ключ, движение, выдача, втор)
        манифест.append({"key": ключ, "file": ключ + ".webm",
                         "emoji": эмодзи, "title": подпись})
        print("%-10s %3d кб  %-6s %s" % (ключ, n // 1024, br, подпись))
        sys.stdout.flush()

    with open(os.path.join(выдача, "manifest.json"), "w",
              encoding="utf-8") as f:
        json.dump(манифест, f, ensure_ascii=False, indent=1)
    print("\nв паке %d из %d" % (len(манифест), len(ПАК)))
    if нет:
        print("нет кадров: %s" % ", ".join(нет))
    return 0


if __name__ == "__main__":
    sys.exit(main())
