#!/usr/bin/env python3
"""
Настоящие четыре угла каждой ниши пульта.

Ниши на снимке рубки идут в перспективе: это не прямоугольники, а
наклонные четырёхугольники, и у левого крыла наклон в одну сторону, у
правого в другую. Заказчик это увидел сразу: «там форма кнопок ромбик
с наклоном, а у тебя обычные прямоугольники».

Прежний разбор отдавал только габаритную коробку (x0..x1, y0..y1), и
клавиша ложилась в нишу ровным прямоугольником поверх наклонной. Здесь
у каждого пятна берутся четыре крайние точки по суммам и разностям
координат - для параллелограмма это ровно его углы.

  python3 tools/cabniche.py assets/gen/cockpit-mid-hd.webp [порог_площади]
"""
import json
import math
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter


def мин_прямоугольник(xx, yy):
    """Четыре угла наименьшего прямоугольника вокруг пятна.

    Прежний способ брал крайние точки по суммам и разностям координат.
    Для ниши, лежащей ровно или с малым завалом, это её углы. Но на
    боковых крыльях рубки ниши развёрнуты почти на сорок пять
    градусов, и там способ ломается: два угла из четырёх совпадают,
    прямоугольник вырождается в линию. Из-за этого боковые ниши
    вообще не попадали в разметку, и кнопки, которым не хватило
    места, висели на гладкой панели - заказчик увидел ровно это.

    Считаем честно: крутим точки от нуля до девяноста градусов,
    берём тот угол, при котором габаритная коробка наименьшая, и
    возвращаем её углы обратно в исходных координатах. Способ не
    зависит от наклона вовсе.
    """
    лучший = None
    for град in range(0, 90):
        a = град * math.pi / 180.0
        ca, sa = math.cos(a), math.sin(a)
        u = xx * ca + yy * sa
        v = -xx * sa + yy * ca
        u0, u1 = u.min(), u.max()
        v0, v1 = v.min(), v.max()
        пл = (u1 - u0) * (v1 - v0)
        if лучший is None or пл < лучший[0]:
            лучший = (пл, ca, sa, u0, u1, v0, v1)
    _, ca, sa, u0, u1, v0, v1 = лучший
    углы_uv = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    out = []
    for u, v in углы_uv:
        out.append((u * ca - v * sa, u * sa + v * ca))
    return out


def ниши(путь, минпл=0.0006, разм=0.008, порог=0.8):
    im = Image.open(путь).convert("RGBA")
    w, h = im.size
    a = np.asarray(im).astype(np.float32)
    alpha = a[:, :, 3]
    lum = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]
    ys = np.nonzero((alpha < 128).any(axis=1))[0]
    низ = int(ys.max()) if len(ys) else int(h * 0.75)

    сер = np.asarray(Image.fromarray(lum.astype(np.uint8), "L")
                     .filter(ImageFilter.GaussianBlur(w * разм))).astype(np.float32)
    стена = np.asarray(Image.fromarray(((lum - сер > порог) * 255).astype(np.uint8), "L")
                       .filter(ImageFilter.MaxFilter(3))) > 127
    поле = (~стена) & (alpha > 200) & (lum > 2)
    поле[:низ, :] = False

    метки = np.zeros((h, w), np.int32)
    n = 0
    из_ = []
    for y in range(низ, h):
        for x in np.nonzero(поле[y])[0]:
            if метки[y, x]:
                continue
            n += 1
            q = deque([(y, x)])
            метки[y, x] = n
            pts = []
            while q:
                cy, cx = q.popleft()
                pts.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if низ <= ny < h and 0 <= nx < w and поле[ny, nx] and not метки[ny, nx]:
                        метки[ny, nx] = n
                        q.append((ny, nx))
            пл = len(pts) / float(w * h)
            if пл < минпл:
                continue
            t = np.array(pts, dtype=np.float64)
            yy, xx = t[:, 0], t[:, 1]
            углы = мин_прямоугольник(xx, yy)
            из_.append({
                "пл": round(пл, 5),
                "угол": [[round(float(px) / w, 4), round(float(py) / h, 4)] for px, py in углы],
                "цх": round(float(xx.mean()) / w, 4),
                "цy": round(float(yy.mean()) / h, 4),
                "ш": round(float(xx.max() - xx.min()) / w, 4),
                "в": round(float(yy.max() - yy.min()) / h, 4),
            })
    из_.sort(key=lambda z: (round(z["цy"], 2), z["цх"]))
    return {"низ_окна": round(низ / h, 4), "кадр": [w, h], "ниши": из_}


if __name__ == "__main__":
    мин = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0006
    print(json.dumps(ниши(sys.argv[1], мин), ensure_ascii=False, indent=1))
