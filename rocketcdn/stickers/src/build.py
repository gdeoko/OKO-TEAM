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
    for mod_name in ("scenes_space", "scenes_vpn", "scenes_cdn",
                     "scenes_react"):
        try:
            mod = __import__(mod_name)
        except ImportError:
            continue
        items += mod.SCENES
    return items


def build(only=None):
    out_dir = os.path.abspath(OUT)
    os.makedirs(out_dir, exist_ok=True)
    manifest, problems = [], []

    for key, fn, emoji, title in catalog():
        if only and key != only:
            continue
        layers = fn()
        data = compose(layers, STICKER, name=key)
        dest = os.path.join(out_dir, "%s.tgs" % key)
        size = save_tgs(data, dest)
        bad = check(data, STICKER, dest)
        if bad:
            problems.append((key, bad))
        manifest.append({"key": key, "emoji": emoji, "title": title,
                         "file": "%s.tgs" % key, "bytes": size})
        mark = "!!" if bad else "ok"
        print("%s %-9s %6d Б  %s %s" % (mark, key, size, emoji, title))

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
    sys.exit(build(sys.argv[1] if len(sys.argv) > 1 else None))
