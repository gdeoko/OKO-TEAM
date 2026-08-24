#!/usr/bin/env python3
"""
Разметка ниш пульта: куда лягут приборы и кнопки.

Плита приходит из кабинета с пустым пультом: чистый металл, а в нём
неглубокие ниши под приборы. Их границы читаются глазом по светлой
фаске, значит читаются и счётом. Ниша - гладкое тёмное поле, фаска -
светлая линия вокруг него.

Считаем так: берём полосу ниже окна, вычитаем крупный размыв (уходит
общая светотень, остаются перепады), тёмные поля метим, режем на
связные куски, отбрасываем мелочь. У каждого куска берём центр и
вписанный прямоугольник - по ним слой и рисует свет.

  python3 tools/cabniche.py плита.webp > разметка.json
"""
import json
import sys

import numpy as np
from PIL import Image, ImageFilter


def поля(path, минплощадь=0.0007):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    a = np.asarray(im).astype(np.float32)
    alpha = a[:, :, 3]
    lum = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]

    # Окно вырезано в прозрачность: полка начинается под ним.
    ys = np.nonzero((alpha < 128).any(axis=1))[0]
    низ = int(ys.max()) if len(ys) else int(h * 0.78)

    сер = np.asarray(Image.fromarray(lum.astype(np.uint8), "L")
                     .filter(ImageFilter.GaussianBlur(w * 0.02))).astype(np.float32)
    рельеф = lum - сер

    поле = np.zeros((h, w), dtype=bool)
    поле[низ:, :] = (рельеф[низ:, :] < -0.8) & (lum[низ:, :] > 6) & (alpha[низ:, :] > 200)

    # чистим точечный шум
    м = Image.fromarray((поле * 255).astype(np.uint8), "L")
    м = м.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    поле = np.asarray(м) > 127

    метки = np.zeros((h, w), dtype=np.int32)
    из_ = []
    n = 0
    from collections import deque
    for y in range(низ, h):
        for x in range(w):
            if not поле[y, x] or метки[y, x]:
                continue
            n += 1
            q = deque([(y, x)])
            метки[y, x] = n
            точки = []
            while q:
                cy, cx = q.popleft()
                точки.append((cy, cx))
                for ny, nx in ((cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)):
                    if низ <= ny < h and 0 <= nx < w and поле[ny, nx] and not метки[ny, nx]:
                        метки[ny, nx] = n
                        q.append((ny, nx))
            если = len(точки) / float(w * h)
            if если < минплощадь:
                continue
            ту = np.array(точки)
            y0, y1 = int(ту[:, 0].min()), int(ту[:, 0].max())
            x0, x1 = int(ту[:, 1].min()), int(ту[:, 1].max())
            # вписанный прямоугольник: сужаем габарит, пока все его
            # точки не окажутся внутри поля
            маска = метки[y0:y1+1, x0:x1+1] == n
            вх, вy = вписать(маска)
            из_.append({
                "центр": [round((x0 + (вх[0]+вх[1])/2.0) / w, 4),
                          round((y0 + (вy[0]+вy[1])/2.0) / h, 4)],
                "габарит": [round(x0/w,4), round(y0/h,4), round(x1/w,4), round(y1/h,4)],
                "нутро": [round((x0+вх[0])/w,4), round((y0+вy[0])/h,4),
                          round((x0+вх[1])/w,4), round((y0+вy[1])/h,4)],
                "площадь": round(если, 5),
            })
    из_.sort(key=lambda d: (-d["площадь"]))
    return {"w": w, "h": h, "низ_окна": round(низ / h, 4), "ниши": из_}


def вписать(маска):
    """Наибольший вписанный прямоугольник по строкам гистограммой."""
    hh, ww = маска.shape
    выс = np.zeros(ww, dtype=np.int32)
    лучше = (0, (0, 0), (0, 0))
    for y in range(hh):
        выс = np.where(маска[y], выс + 1, 0)
        стек = []
        for x in range(ww + 1):
            v = выс[x] if x < ww else 0
            старт = x
            while стек and стек[-1][1] >= v:
                sx, sv = стек.pop()
                пл = sv * (x - sx)
                if пл > лучше[0]:
                    лучше = (пл, (sx, x - 1), (y - sv + 1, y))
                старт = sx
            стек.append((старт, v))
    return лучше[1], лучше[2]


if __name__ == "__main__":
    print(json.dumps(поля(sys.argv[1]), ensure_ascii=False, indent=1))
