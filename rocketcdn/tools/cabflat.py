#!/usr/bin/env python3
"""
Паспорт плоской рамы рубки: контур окна и места приборов.

Рама рубки снова плоская - тем же кадром, что стоял 17-19 августа и
понравился и заказчику, и его клиенту. Причина в качестве: объёмная
сетка пересэмплирует снимок дважды (развёртка плюс мипы), и на экране
он мылится, а край окна режется по клеткам сетки. Плоский слой браузер
масштабирует один раз своим фильтром - кадр остаётся резким, кромка
ровной.

Здесь считается то, что нужно сцене: контур прозрачного окна в долях
кадра, его габарит и места, куда лягут живые приборы.

  python3 tools/cabflat.py assets/gen/cockpit-wide-hd.webp \
      assets/gen/cockpit-tall-hd.webp > assets/gen/cab/flat.js
"""
import json
import math
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

CONTOUR_N = 72


def window_mask(im):
    """Окно - прозрачная область, накрывающая центр кадра.

    Просто «всё прозрачное» брать нельзя: у кадра прозрачны и углы
    за габаритом рубки. Растим область от центра.
    """
    a = np.asarray(im)[:, :, 3]
    h, w = a.shape
    tr = a < 128
    if not tr[h // 2, w // 2]:
        raise SystemExit("центр кадра непрозрачен: окна нет")
    seen = np.zeros_like(tr)
    q = deque([(h // 2, w // 2)])
    seen[h // 2, w // 2] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and tr[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def contour(mask, n=CONTOUR_N):
    """Контур окна лучами из центра масс, против часовой стрелки."""
    h, w = mask.shape
    ys, xs = np.nonzero(mask)
    cy, cx = float(ys.mean()), float(xs.mean())
    pts = []
    for i in range(n):
        ang = 2.0 * math.pi * i / n
        dx, dy = math.cos(ang), math.sin(ang)
        lo, hi = 0.0, float(max(w, h))
        r = 0.0
        while r < hi:
            x, y = cx + dx * (r + 2), cy + dy * (r + 2)
            if x < 0 or y < 0 or x >= w or y >= h or not mask[int(y), int(x)]:
                break
            r += 2
        lo, hi = r, r + 2
        for _ in range(12):
            m = (lo + hi) / 2
            x, y = cx + dx * m, cy + dy * m
            if 0 <= x < w and 0 <= y < h and mask[int(y), int(x)]:
                lo = m
            else:
                hi = m
        pts.append([round((cx + dx * lo) / w, 5), round((cy + dy * lo) / h, 5)])
    return pts


def one(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    mask = window_mask(im)
    ys, xs = np.nonzero(mask)
    box = {"l": round(float(xs.min()) / w, 5), "r": round(float(xs.max()) / w, 5),
           "t": round(float(ys.min()) / h, 5), "b": round(float(ys.max()) / h, 5)}
    return {
        "файл": "assets/gen/" + os.path.basename(path),
        "w": w, "h": h,
        "контур": contour(mask),
        "коробка": box,
        "поля": {
            "слева": round(box["l"], 5),
            "справа": round(1 - box["r"], 5),
            "сверху": round(box["t"], 5),
            "снизу": round(1 - box["b"], 5),
        },
    }


def main():
    wide, tall = one(sys.argv[1]), one(sys.argv[2])
    for name, d in (("широкая", wide), ("высокая", tall)):
        p = d["поля"]
        sys.stderr.write("%s %sx%s  поля %.1f %.1f %.1f %.1f\n" % (
            name, d["w"], d["h"], p["слева"] * 100, p["справа"] * 100,
            p["сверху"] * 100, p["снизу"] * 100))
    out = {"широкая": wide, "высокая": tall}
    print("/* Паспорт плоской рамы. Собран tools/cabflat.py, руками не править. */")
    print("window.RC_CAB_FLAT = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";")


if __name__ == "__main__":
    main()
