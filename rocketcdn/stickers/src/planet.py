# -*- coding: utf-8 -*-
"""Отрисовка планет, снятых с текстур NASA.

Текстуры лежат на самом сайте и крутятся в его полёте. Вставить их в
.tgs нельзя - картинок в формате нет, - поэтому каждая планета заранее
разложена на шар, освещена и обведена контурами (tools/planet_trace.py).
Здесь эти контуры превращаются в слои Lottie.
"""

import json
import os

from tgs import fill, group, gtr, val

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "planets")
_cache = {}


def load(key):
    if key not in _cache:
        with open(os.path.join(DATA, key + ".json"), encoding="utf-8") as f:
            _cache[key] = json.load(f)
    return _cache[key]


def shapes(key, size, pos):
    """Планета: сплошной диск базового цвета и пятна поверх него."""
    from tgs import circle
    data = load(key)
    k = float(size) / data["size"]
    half = data["size"] / 2.0
    # база снизу: фильтр мелочи не должен оставлять в планете дыры
    out = [group([circle(pos[0], pos[1], size / 2.0),
                  fill(data.get("base", "#8899AA"))], name="base")]
    for i, lay in enumerate(data["layers"]):
        paths = []
        for c in lay["p"]:
            v = [[(x - half) * k + pos[0], (y - half) * k + pos[1]]
                 for x, y in c]
            z = [[0, 0]] * len(v)
            paths.append({"ty": "sh",
                          "ks": val({"i": z, "o": z, "v": v, "c": True})})
        if paths:
            out.append(group(paths + [fill(lay["c"])], name="s%d" % i))
    return out


def planet(key, size=300, pos=(256, 256), name=None):
    """Готовая планета одной группой."""
    return group(shapes(key, size, pos), name=name or key)
