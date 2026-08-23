#!/usr/bin/env python3
"""
Разбор сгенерированного кадра кабины на детали для трёхмерной сцены.

На входе фотореалистичный снимок рубки, в центре которого чистая чёрная
дыра окна. На выходе набор, из которого rc-panel собирает настоящую
объёмную раму, а не картинку на стекле:

  <имя>-albedo.webp  цвет рамы, окно выбито в прозрачность
  <имя>-emis.webp    только то, что светится само: клавиши, экраны, лампы
  <имя>-rough.webp   шероховатость, чтобы блик шёл по металлу, а не по всему
  <имя>.json         контур окна, рамки полей и найденные клавиши

Глубину считает отдельный шаг (cabdepth.py), она приходит картой и
поднимает вершины сетки: от этого у рамы появляется силуэт и она
отзывается на свет мира за окном.

Запуск:  python3 tools/cabgen.py снимок.png assets/gen/cab/wide
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

# Порог, ниже которого пиксель считаем дырой окна. Генератор рисует её
# чистым нулём, но сжатие в png оставляет крошку в единицы уровней.
DARK = 16

# Сколько точек оставляем в контуре окна. Шестьдесят четыре достаточно,
# чтобы восьмиугольник со скруглениями читался, и мало настолько, что
# отсечение слоёв по clip-path не тормозит телефон.
CONTOUR_N = 64


def load(path):
    im = Image.open(path).convert("RGB")
    return im, np.asarray(im).astype(np.float32)


def luminance(a):
    return 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]


def opening_mask(a):
    """Чёрная дыра окна: самая большая тёмная область, накрывающая центр.

    Просто «всё тёмное» брать нельзя: в рубке полно чёрных щелей и
    подрезов, и они слились бы с окном в одну кляксу. Поэтому растим
    область от центра кадра по четырёхсвязности.
    """
    h, w = a.shape[:2]
    dark = luminance(a) < DARK
    seen = np.zeros((h, w), dtype=bool)
    cy, cx = h // 2, w // 2
    if not dark[cy, cx]:
        # Центр закрыт чем-то светлым: ищем ближайший тёмный пиксель по
        # горизонтали, генератор иногда сдвигает окно на пару процентов.
        row = np.nonzero(dark[cy])[0]
        if not len(row):
            raise SystemExit("окно не найдено: в центре нет чёрного")
        cx = int(row[np.argmin(np.abs(row - cx))])
    # Заливка построчными отрезками: рекурсия на кадре 1536x1024 не живёт.
    stack = [(cy, cx)]
    seen[cy, cx] = True
    while stack:
        y, x = stack.pop()
        x0 = x
        while x0 > 0 and dark[y, x0 - 1] and not seen[y, x0 - 1]:
            x0 -= 1
            seen[y, x0] = True
        x1 = x
        while x1 < w - 1 and dark[y, x1 + 1] and not seen[y, x1 + 1]:
            x1 += 1
            seen[y, x1] = True
        for ny in (y - 1, y + 1):
            if ny < 0 or ny >= h:
                continue
            xx = x0
            while xx <= x1:
                if dark[ny, xx] and not seen[ny, xx]:
                    seen[ny, xx] = True
                    stack.append((ny, xx))
                    while xx <= x1 and dark[ny, xx]:
                        xx += 1
                xx += 1
    return seen


def contour(mask, n=CONTOUR_N):
    """Контур окна лучами из центра масс: n точек, порядок против часовой.

    Луч честнее обхода границы: он сам сглаживает зубцы сжатия и всегда
    отдаёт выпуклый по построению многоугольник, а рама у нас именно
    выпуклая. Обход границы дал бы четыре тысячи точек и ворс по краю.
    """
    h, w = mask.shape
    ys, xs = np.nonzero(mask)
    cy, cx = float(ys.mean()), float(xs.mean())
    pts = []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        dx, dy = math.cos(a), math.sin(a)
        # Шагаем наружу до первого не-окна, потом уточняем половинками.
        lo, hi = 0.0, float(max(w, h))
        step = 1.0
        r = 0.0
        while r < hi:
            x, y = cx + dx * (r + step), cy + dy * (r + step)
            if x < 0 or y < 0 or x >= w or y >= h or not mask[int(y), int(x)]:
                break
            r += step
        lo, hi = r, r + step
        for _ in range(12):
            m = (lo + hi) / 2
            x, y = cx + dx * m, cy + dy * m
            if 0 <= x < w and 0 <= y < h and mask[int(y), int(x)]:
                lo = m
            else:
                hi = m
        pts.append([(cx + dx * lo) / w, (cy + dy * lo) / h])
    return pts, (cx / w, cy / h)


def glow(a):
    """Что светится само. Лайм, янтарь и красный - остальное холодный металл."""
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    lime = (g > 70) & (g > r * 1.18) & (g > b * 1.18)
    amber = (r > 110) & (g > 60) & (g < r * 0.92) & (b < g * 0.75)
    red = (r > 110) & (g < r * 0.55) & (b < r * 0.55)
    white = luminance(a) > 205
    return lime, amber, red, (lime | amber | red | white)


def components(mask, min_area, max_area, min_side):
    """Связные пятна маски прямоугольниками. Нужны, чтобы найти клавиши."""
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    out = []
    for y0 in range(h):
        row = np.nonzero(mask[y0] & ~seen[y0])[0]
        for x0 in row:
            if seen[y0, x0]:
                continue
            stack = [(y0, int(x0))]
            seen[y0, x0] = True
            xs0 = xs1 = int(x0)
            ys0 = ys1 = y0
            area = 0
            while stack:
                y, x = stack.pop()
                area += 1
                if x < xs0:
                    xs0 = x
                if x > xs1:
                    xs1 = x
                if y < ys0:
                    ys0 = y
                if y > ys1:
                    ys1 = y
                for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            bw, bh = xs1 - xs0 + 1, ys1 - ys0 + 1
            if area < min_area or area > max_area:
                continue
            if bw < min_side or bh < min_side:
                continue
            out.append({"x": xs0, "y": ys0, "w": bw, "h": bh, "area": area})
    return out


def keys(lime, mask_win, h, w):
    """Подсвеченные клавиши нижней полки: квадратные пятна лайма под окном.

    Их положение нужно, чтобы поставить поверх кадра настоящие объёмные
    кнопки, которые уходят вниз при нажатии. Крышку каждой берём куском
    того же кадра, поэтому в покое разницы не видно.
    """
    ys, xs = np.nonzero(mask_win)
    win_b = ys.max() / h
    band = np.zeros_like(lime)
    band[int(win_b * h):, :] = True
    cand = components(lime & band, min_area=(h * w) // 6000, max_area=(h * w) // 220, min_side=8)
    out = []
    for c in cand:
        ar = c["w"] / max(1.0, c["h"])
        if ar < 0.45 or ar > 2.4:
            continue
        out.append({
            "x": c["x"] / w, "y": c["y"] / h,
            "w": c["w"] / w, "h": c["h"] / h,
        })
    out.sort(key=lambda k: (round(k["y"] * 24), k["x"]))
    return out


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src, base = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.dirname(base) or ".", exist_ok=True)
    im, a = load(src)
    h, w = a.shape[:2]

    win = opening_mask(a)
    poly, centre = contour(win)
    ys, xs = np.nonzero(win)
    box = {
        "l": float(xs.min()) / w, "r": float(xs.max()) / w,
        "t": float(ys.min()) / h, "b": float(ys.max()) / h,
    }

    lime, amber, red, lit = glow(a)

    # Кромку кадра гасим до ровной черноты.
    #
    # Сцена кладёт снимок так, чтобы кромка окна села на обещанные доли
    # кадра, и на краях экрана снимка может не хватить. Там сетка
    # продолжается с прижатой развёрткой, то есть крайний ряд пикселей
    # растягивается до края. Если в этом ряду что-то есть, наружу идут
    # полосы. Ровная чернота растягивается незаметно.
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum(np.minimum(xx, w - 1 - xx) / (w * 0.035),
                      np.minimum(yy, h - 1 - yy) / (h * 0.035))
    fade = np.clip(edge, 0.0, 1.0)[:, :, None]
    a = a * fade
    lit = lit & (fade[:, :, 0] > 0.35)

    im = Image.fromarray(a.astype(np.uint8), "RGB")

    # Цвет рамы: окно выбито в прозрачность, чтобы сквозь него был мир.
    alpha = Image.fromarray(((~win) * 255).astype(np.uint8), "L")
    # Край дыры чуть размываем: иначе по контуру идёт пиксельная лесенка.
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    albedo = im.copy()
    albedo.putalpha(alpha)
    albedo.save(base + "-albedo.webp", quality=94, method=6)

    # Свечение отдельным слоем.
    #
    # Сюда идёт весь кадр, а не только лампы. Причина видна на первой же
    # сборке: рубка на снимке тёмная сама по себе, материал в сцене
    # гасит неосвещённое до черноты, и рама вышла сплошным чёрным
    # силуэтом поверх звёзд. Сначала стояла добавка в двадцать два
    # процента - её не хватило: двадцать два процента от тёмного
    # графита это ноль.
    #
    # Поэтому запечённый свет идём почти в полную силу, а лампы поверх
    # него ещё ярче. Физика сцены при этом никуда не девается: блик,
    # тень и отражение считаются нормалями и шероховатостью и ложатся
    # сверху.
    emis = np.where(lit[:, :, None], np.minimum(a * 1.7, 255.0), a * 0.88).astype(np.uint8)
    Image.fromarray(emis, "RGB").save(base + "-emis.webp", quality=88, method=6)

    # Шероховатость: тёмный матовый анод шершавый, полировка и стекло гладкие.
    lum = luminance(a) / 255.0
    rough = np.clip(0.92 - lum * 0.62, 0.12, 0.95)
    rough[lit] = 0.28
    Image.fromarray((rough * 255).astype(np.uint8), "L").save(base + "-rough.webp", quality=86, method=6)

    data = {
        "src": os.path.basename(src),
        "w": w, "h": h,
        "окно": {"контур": [[round(p[0], 5), round(p[1], 5)] for p in poly],
                 "центр": [round(centre[0], 5), round(centre[1], 5)],
                 "коробка": {k: round(v, 5) for k, v in box.items()}},
        "поля": {
            "слева": round(box["l"], 5),
            "справа": round(1.0 - box["r"], 5),
            "сверху": round(box["t"], 5),
            "снизу": round(1.0 - box["b"], 5),
        },
        "клавиши": [{k: round(v, 5) for k, v in kk.items()} for kk in keys(lime, win, h, w)],
    }
    with open(base + ".json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)

    print("кадр", w, "x", h)
    print("поля  слева %.1f%%  справа %.1f%%  сверху %.1f%%  снизу %.1f%%" % (
        data["поля"]["слева"] * 100, data["поля"]["справа"] * 100,
        data["поля"]["сверху"] * 100, data["поля"]["снизу"] * 100))
    print("окно занимает %.1f%% ширины и %.1f%% высоты" % (
        (box["r"] - box["l"]) * 100, (box["b"] - box["t"]) * 100))
    print("клавиш найдено", len(data["клавиши"]))
    print("светится %.1f%% кадра" % (lit.mean() * 100))


if __name__ == "__main__":
    main()
