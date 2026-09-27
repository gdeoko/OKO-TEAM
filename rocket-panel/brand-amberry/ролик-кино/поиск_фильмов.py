#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Поиск фильмов под формат 4: общественное достояние, цвет, откровенность.

Правка владельца 27.09.2026: отрезки нужны откровеннее - но БЕЗ НАГОТЫ, и
приоритет цветным. Чёрно-белое pre-code кино даёт нужный намёк, но в ленте
проигрывает: цвет держит взгляд дольше.

Где цвет и при этом общественное достояние:

- **пеплум 1958-1965** (Геркулес, Голиаф, Мачисте) - итальянские ленты,
  в США копирайт не продлён. Гаремные танцы, рабыни, купальни;
- **жанровое кино 1958-1968** - «Wild Women of Wongo», «Eegah»,
  «Girl in Gold Boots»: джунгли, бассейны, гоу-гоу;
- **мексиканские луча-фильмы** - вампирши, кабаре, борцовки.

Поиск идёт по словам сцены, а не по жанру: гарем, танцовщица, купальник,
кабаре, джунгли. Цвет проверяется не по метке (её обычно нет), а по
самому файлу - `проверить_цвет.py`.

    python3 поиск_фильмов.py [сколько]
"""
import json
import sys
import urllib.parse
import urllib.request

ПОИСК = "https://archive.org/advancedsearch.php"

# Слова сцены. Наготы среди них нет намеренно: нужен намёк, а не она сама.
СЛОВА = [
    "harem", "belly dance", "dancing girls", "slave girl", "cabaret",
    "showgirl", "burlesque", "go-go", "nightclub dancer", "bikini",
    "swimming pool party", "beach party", "jungle girl", "amazon women",
    "temptress", "seductress", "bathing beauties", "chorus girls",
]

# Годы цветного жанрового кино, у которого копирайт не продлён.
ГОДЫ = "[1950 TO 1975]"


def искать(слово, сколько=12, годы=ГОДЫ):
    выражение = ('collection:(feature_films) AND licenseurl:(*publicdomain*) '
                 'AND date:%s AND (%s)' % (годы, слово))
    п = urllib.parse.urlencode({
        "q": выражение, "rows": сколько, "page": 1, "output": "json",
        "fl[]": "identifier",
    }, doseq=True)
    # fl[] повторяется - urlencode одиночным словарём так не умеет
    п += "&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=downloads&sort%5B%5D=downloads+desc"
    с = urllib.request.urlopen(ПОИСК + "?" + п, timeout=60).read()
    return json.loads(с)["response"]["docs"]


def главное(сколько=8):
    видел = set()
    for слово in СЛОВА:
        try:
            найдено = искать('"%s"' % слово, сколько)
        except Exception as e:
            print("  %-22s ошибка %s" % (слово, e), flush=True)
            continue
        свежие = [д for д in найдено if д["identifier"] not in видел]
        видел.update(д["identifier"] for д in свежие)
        if not свежие:
            continue
        print("\n== %s" % слово, flush=True)
        for д in свежие:
            print("   %-46s %-6s %8s  %s" % (
                д["identifier"][:46], д.get("year", "?"),
                д.get("downloads", 0), str(д.get("title", ""))[:44]), flush=True)


if __name__ == "__main__":
    главное(int(sys.argv[1]) if len(sys.argv) > 1 else 8)
