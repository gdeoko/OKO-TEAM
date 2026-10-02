# -*- coding: utf-8 -*-
"""Сборка паков Rocket CDN: .tgs для стикеров и для кастом-эмодзи.

Файл один и тот же: Telegram берёт анимированные эмодзи тем же .tgs
512x512, что и стикеры. Поэтому пары совпадают буквально, файл в файл,
а не «похожи».

    python3 build.py            собрать всё
    python3 build.py launch     собрать один сюжет (быстрая правка)
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tgs import STICKER, check, compose, save_tgs  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "out")


def catalog():
    """Все сюжеты пака: (ключ, функция, эмодзи, подпись).

    Порядок файлов задаёт порядок в паке: сперва бренд и космос, потом
    VPN, потом CDN, в конце реакции для переписки.
    """
    items = []
    # scenes_daily снят с маршрута 13.09: готовые формы Noto узнаются как
    # чужие и в паке смотрятся наклейкой из другого набора.
    for mod_name in ("scenes_space", "scenes_vpn", "scenes_cdn",
                     "scenes_react"):
        try:
            mod = __import__(mod_name)
        except ImportError:
            continue
        items += mod.SCENES
    return items


# сколько кадра занимает предмет после подгонки: 82% даёт воздух по краям
# и при этом не мельчит в размере эмодзи
TARGET = 0.82
FIT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                   "out", "fit.json")


def fits():
    """Замеры прошлого прохода: где на самом деле лежит рисунок.

    Первый проход собирает как нарисовано, measure.mjs меряет готовые
    файлы настоящим плеером, второй проход подгоняет всё в одну сетку.
    Пока замеров нет, сборка идёт как есть.
    """
    try:
        with open(FIT, encoding="utf-8") as f:
            raw = json.load(f)
    except (IOError, ValueError):
        return {}
    c = STICKER / 2.0
    out = {}
    for key, b in raw.items():
        # берём большую сторону: предмет вписывается в квадрат целиком
        zoom = (STICKER * TARGET) / float(max(b["w"], b["h"]))
        # зум идёт от центра холста и уносит туда же центр рисунка:
        # точка v становится c + (v - c) * zoom. Сдвигаем ровно на
        # столько, сколько центр рисунка при этом не добрал до середины.
        out[key] = (zoom, (-(b["cx"] - c) * zoom, -(b["cy"] - c) * zoom))
    return out


def build(only=None, raw=False):
    out_dir = os.path.abspath(OUT)
    fit = {} if raw else fits()
    os.makedirs(out_dir, exist_ok=True)
    manifest, problems = [], []

    for key, fn, emoji, title in catalog():
        if only and key != only:
            continue
        layers = fn()
        zoom, shift = fit.get(key, (1.0, (0.0, 0.0)))
        data = compose(layers, STICKER, name=key, zoom=zoom, shift=shift)
        dest = os.path.join(out_dir, "%s.tgs" % key)
        size = save_tgs(data, dest)
        bad = check(data, STICKER, dest)
        if bad:
            problems.append((key, bad))
        manifest.append({"key": key, "emoji": emoji, "title": title,
                         "file": "%s.tgs" % key, "bytes": size})
        mark = "!!" if bad else "ok"
        print("%s %-9s %6d Б  x%.2f  %s %s" %
              (mark, key, size, zoom, emoji, title))

    with open(os.path.join(out_dir, "manifest.json"), "w",
              encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    if problems:
        print("\nне проходят требования Telegram:")
        for key, bad in problems:
            for b in bad:
                print("  %-9s %s" % (key, b))
        return 1
    total = sum(m["bytes"] for m in manifest)
    print("\nсобрано %d, вес %.1f КБ, самый тяжёлый %d Б" %
          (len(manifest), total / 1024.0,
           max(m["bytes"] for m in manifest) if manifest else 0))
    return 0


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    sys.exit(build(args[0] if args else None, raw="--raw" in sys.argv))
