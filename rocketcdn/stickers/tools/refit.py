# -*- coding: utf-8 -*-
"""Уточнение подгонки по свежему замеру.

Один проход не всегда попадает: у рисунка, который в сыром виде вылезал
за кадр, замер занижен - обрезанное краем в рамку не попало. Поэтому
подгонка уточняется по уже подогнанному результату, а коэффициенты
перемножаются.

    python3 refit.py <замер_текущего_out.json>
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FIT = os.path.join(HERE, "..", "out", "fit.json")
SIZE = 512.0
TARGET = 0.82


def main():
    if len(sys.argv) < 2:
        print("нужен файл замера")
        return 1
    with open(sys.argv[1], encoding="utf-8") as f:
        now = json.load(f)
    with open(FIT, encoding="utf-8") as f:
        fit = json.load(f)

    c = SIZE / 2
    changed = 0
    for key, b in now.items():
        side = max(b["w"], b["h"])
        # во сколько ещё раз промахнулись и насколько центр не по месту
        k = (SIZE * TARGET) / float(side)
        dx, dy = c - b["cx"], c - b["cy"]
        if abs(k - 1) < 0.01 and abs(dx) < 3 and abs(dy) < 3:
            continue
        old = fit.get(key)
        if not old:
            continue
        # рамка в fit.json хранится в координатах сырой сборки, поэтому
        # поправку переводим обратно: делим на уже применённый зум
        zoom_old = (SIZE * TARGET) / float(max(old["w"], old["h"]))
        w_eff = old["w"] / k
        h_eff = old["h"] / k
        old["w"], old["h"] = w_eff, h_eff
        old["cx"] -= dx / zoom_old
        old["cy"] -= dy / zoom_old
        changed += 1
        print("  уточнён %-9s x%.3f  сдвиг %+.0f %+.0f" % (key, k, dx, dy))

    with open(FIT, "w", encoding="utf-8") as f:
        json.dump(fit, f, ensure_ascii=False, indent=1)
    print("уточнено %d из %d" % (changed, len(now)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
