"""Обводим проём на снимке рубки и готовим текстуру рамы.

Зачем. Геометрия обязана совпасть с рисунком до пикселя: тогда
снимок ложится на железо один в один - ни щели между рамой и
проёмом, ни куска рубки поверх космоса. Поэтому контур не
придумывается в коде, а снимается с самого снимка.

Как. Порог по яркости, связная тёмная область вокруг середины,
затем луч из центра в каждую из N сторон до первой светлой точки.
Проём выпуклый, поэтому лучевой обход даёт честный контур.
"""
from PIL import Image
import numpy as np, json, sys, os

def build(src, dst_img, top_cut, bot_keep, out_w, N=48):
    im = Image.open(src).convert('RGB')
    W0, H0 = im.size
    box = (0, int(H0*top_cut), W0, int(H0*bot_keep))
    im = im.crop(box)
    W1, H1 = im.size
    out_h = int(round(out_w * H1 / W1))
    im = im.resize((out_w, out_h), Image.LANCZOS)
    a = np.asarray(im).astype(int)
    lum = a.max(axis=2)
    dark = lum <= 12
    H, W = dark.shape
    cy, cx = H//2, W//2
    # середина обязана быть в проёме
    if not dark[cy, cx]:
        raise SystemExit('середина кадра не чёрная - проём не найден')
    pts = []
    for k in range(N):
        ang = 2*np.pi*k/N
        dx, dy = np.cos(ang), np.sin(ang)
        r = 1.0
        last = (cx, cy)
        while True:
            x = int(round(cx + dx*r)); y = int(round(cy + dy*r))
            if x < 0 or y < 0 or x >= W or y >= H: break
            if not dark[y, x]: break
            last = (x, y); r += 1.0
        pts.append([round(last[0]/W, 4), round(last[1]/H, 4)])
    im.save(dst_img, 'WEBP', quality=94, method=5)
    return pts, (out_w, out_h)

if __name__ == '__main__':
    O = '/home/user/OKO-TEAM/rocketcdn/assets/gen/panel'
    pts, size = build('frame/cw1.png', os.path.join(O, 'cockpit-wide.webp'), 0.03, 0.90, 1600)
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    print('wide', size, 'файл', os.path.getsize(os.path.join(O,'cockpit-wide.webp')))
    print('рамка: лево %.1f%% право %.1f%% верх %.1f%% низ %.1f%%' % (
        min(xs)*100, (1-max(xs))*100, min(ys)*100, (1-max(ys))*100))
    json.dump(pts, open('shape_wide.json','w'))
    print(json.dumps(pts))
