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

# ─────────────────────────────────────────────────────────────────────────────
# ГЛАЗАМИ — ОБЯЗАТЕЛЬНО.
#
# Автозамер сам по себе не годится: заливка круга к краям тускнеет, а вокруг
# идут золотые ленты, ноты и закат. Порог пониже — заливка утекает в закат и
# центр съезжает вниз; порог повыше — обрывается на середине круга. Так герб
# дважды сел мимо кольца.
#
# Поэтому порядок такой: автозамер даёт приближение, дальше НАНОСИМ СЕТКУ на
# область круга (--grid), считываем края кольца по подписям, и проверяем выбор
# контуром (--check) до того, как ставить герб. Три минуты работы против
# кривого логотипа на восьмистах письмах.
#
#   python3 afisha_circle.py афиша.png --grid  вывод.jpg
#   python3 afisha_circle.py афиша.png --check вывод.jpg CX CY D
# ─────────────────────────────────────────────────────────────────────────────
if len(sys.argv) > 2 and sys.argv[2] == '--grid':
    from PIL import ImageDraw
    out = sys.argv[3]
    x0, y0, x1, y1 = int(W*.36), int(H*.38), int(W*.66), int(H*.87)
    crop = im.crop((x0, y0, x1, y1)).resize(((x1-x0)*2, (y1-y0)*2), Image.LANCZOS)
    dr = ImageDraw.Draw(crop)
    for x in range(x0, x1+1, 25):
        X = (x-x0)*2
        dr.line([X, 0, X, crop.size[1]], fill=(255,0,0) if x % 100 == 0 else (255,120,120))
        if x % 50 == 0: dr.text((X+3, 4), str(x), fill=(255,255,0))
    for y in range(y0, y1+1, 25):
        Y = (y-y0)*2
        dr.line([0, Y, crop.size[0], Y], fill=(0,140,255) if y % 100 == 0 else (140,200,255))
        if y % 50 == 0: dr.text((4, Y+3), str(y), fill=(0,255,255))
    crop.save(out, quality=88)
    print('сетка:', out)
    raise SystemExit

if len(sys.argv) > 2 and sys.argv[2] == '--check':
    from PIL import ImageDraw
    out = sys.argv[3]
    cx, cy, d = (float(v) for v in sys.argv[4:7])
    v = im.copy(); dr = ImageDraw.Draw(v)
    dr.ellipse([cx-d/2, cy-d/2, cx+d/2, cy+d/2], outline=(255,0,0), width=4)
    dr.line([cx-30, cy, cx+30, cy], fill=(255,0,0), width=3)
    dr.line([cx, cy-30, cx, cy+30], fill=(255,0,0), width=3)
    v.save(out, quality=88)
    print('контроль:', out)
    raise SystemExit

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
