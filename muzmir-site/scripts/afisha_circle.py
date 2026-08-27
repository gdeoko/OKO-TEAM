"""
ГДЕ ИМЕННО ЛЕЖИТ ЗОЛОТОЙ КРУГ.

Первый заход искал просто «золотые пиксели» и ловил вместе с кругом ленты, ноты
и подсветку зданий — центр уезжал, диаметр раздувался, логотип садился криво.

Круг отличается от всего остального тем, что он ЗАЛИТ: на своей средней линии он
даёт длинный непрерывный отрезок ярких пикселей, а лента даёт короткий. Поэтому
меряем по самому длинному непрерывному отрезку в строке и в столбце.
"""
import sys, json
from PIL import Image

im = Image.open(sys.argv[1]).convert('RGB')
W, H = im.size
px = im.load()

def gold(x, y):
    r, g, b = px[x, y]
    return r > 200 and g > 160 and b > 90 and r >= g >= b

def longest_run(coords, fixed, horizontal):
    best = (0, 0, 0)          # длина, начало, конец
    cur = None
    for v in coords:
        ok = gold(v, fixed) if horizontal else gold(fixed, v)
        if ok:
            if cur is None: cur = v
        else:
            if cur is not None:
                if v - cur > best[0]: best = (v - cur, cur, v)
                cur = None
    if cur is not None and coords[-1] - cur > best[0]:
        best = (coords[-1] - cur, cur, coords[-1])
    return best

xs = list(range(int(W * .28), int(W * .78)))
ys = list(range(int(H * .30), int(H * .95)))

# Строка с самым длинным отрезком — средняя линия круга.
rowBest = max(((longest_run(xs, y, True), y) for y in ys), key=lambda t: t[0][0])
(dx, x1, x2), yMid = rowBest
cx = (x1 + x2) / 2

# Столбец через найденный центр — вертикальный диаметр.
(dy, y1, y2) = longest_run(ys, int(cx), False)
cy = (y1 + y2) / 2
d = (dx + dy) / 2

print(json.dumps({'W': W, 'H': H, 'cx': round(cx, 1), 'cy': round(cy, 1),
                  'd': round(d, 1), 'dx': dx, 'dy': dy,
                  'left%': round(cx / W * 100, 2), 'top%': round(cy / H * 100, 2),
                  'size%': round(d / H * 100, 2)}, ensure_ascii=False))
