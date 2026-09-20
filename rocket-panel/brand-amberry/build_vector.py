"""Пересборка вектора AMBERRY из эталона amberry-71-flat.jpg.

Запускать, когда меняется эталон:  python build_vector.py
Нужны potrace, numpy, scipy, Pillow. Аватарки-PNG снимаются отдельно,
браузером (см. README) — здесь только SVG.

Два решения, которые нельзя выкинуть при правке:

1. ПОДЛОЖКА. В эталоне промежутки между костянками — просто чёрный фон.
   Если оставить их дырками, на белом знак рассыпается в кружки. Поэтому
   под розовый рисунок кладётся тёмный силуэт ягоды.
2. ПОДЛОЖКА СЧИТАЕТСЯ ТОЛЬКО ПО СТРОКАМ ЯГОДЫ. Пустить заливку дырок на
   надпись — и внутренние просветы A, B, R затянет.
"""

import os
import re
import subprocess

import numpy as np
from PIL import Image
from scipy import ndimage

ЗДЕСЬ = os.path.dirname(os.path.abspath(__file__))
ЭТАЛОН = os.path.join(ЗДЕСЬ, "amberry-71-flat.jpg")
НЕОН, ТЬМА = "#FF0A8C", "#150309"
МАСШТАБ = 4        # трассируем увеличенную маску: кривые выходят глаже
СТОРОНА = 1024


def маска_розового(путь):
    im = np.asarray(Image.open(путь).convert("RGB")).astype(np.int16)
    R, G = im[:, :, 0], im[:, :, 1]
    return ndimage.median_filter((R > 90) & (R - G > 50), size=3)


def найти_разрыв(маска):
    """Где кончается ягода и начинается надпись — по пустым строкам."""
    строки = маска.sum(axis=1)
    занято = np.where(строки > 0)[0]
    пусто = [y for y in range(занято[0], занято[-1]) if строки[y] == 0]
    группы, н, п = [], пусто[0], пусто[0]
    for y in пусто[1:]:
        if y == п + 1:
            п = y
        else:
            группы.append((н, п))
            н = п = y
    группы.append((н, п))
    return max(группы, key=lambda r: r[1] - r[0])


def трасса(маска, имя, рабочая):
    б = ndimage.zoom(маска.astype(np.float32), МАСШТАБ, order=1) > 0.5
    h, w = б.shape
    pbm, svg = f"{рабочая}/{имя}.pbm", f"{рабочая}/{имя}.svg"
    with open(pbm, "wb") as f:
        f.write(b"P4\n%d %d\n" % (w, h))
        f.write(np.packbits(б.astype(np.uint8), axis=1).tobytes())
    subprocess.run(["potrace", "-b", "svg", "-a", "1.4", "-O", "0.6",
                    "-t", "10", "-u", "4", "-o", svg, pbm], check=True)
    т = open(svg).read()
    d = " ".join(re.findall(r'\bd="([^"]+)"', т))
    tr = re.search(r'<g transform="([^"]+)"', т).group(1)
    return d, tr, w, h


def собрать(маска, ягода_низ, файл, заголовок, рабочая):
    под = np.zeros_like(маска)
    под[:ягода_низ] = ndimage.binary_fill_holes(маска[:ягода_низ])
    под = ndimage.binary_dilation(под, iterations=2)

    d_р, tr_р, W, H = трасса(маска, файл + "-r", рабочая)
    d_п, tr_п, _, _ = трасса(под, файл + "-p", рабочая)
    ш, в = ((СТОРОНА, round(СТОРОНА * H / W)) if W >= H
            else (round(СТОРОНА * W / H), СТОРОНА))
    к = ш / W
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ш} {в}"'
         f' width="{ш}" height="{в}">\n'
         f'  <title>{заголовок}</title>\n'
         f'  <g transform="scale({к:.6f}) {tr_п}">'
         f'<path fill="{ТЬМА}" fill-rule="evenodd" d="{d_п}"/></g>\n'
         f'  <g transform="scale({к:.6f}) {tr_р}">'
         f'<path fill="{НЕОН}" fill-rule="evenodd" d="{d_р}"/></g>\n'
         f'</svg>\n')
    open(os.path.join(ЗДЕСЬ, f"{файл}.svg"), "w").write(s)
    print(f"{файл}.svg — {ш}x{в}, {len(s)} байт")


def обрезать(м, поле=0.06):
    ys, xs = np.where(м)
    h, w = м.shape
    p = int(поле * max(ys.max() - ys.min(), xs.max() - xs.min()))
    return м[max(0, ys.min() - p):min(h, ys.max() + p + 1),
             max(0, xs.min() - p):min(w, xs.max() + p + 1)]


def в_квадрат(м):
    """Иконку ставят в квадратные гнёзда — она обязана быть квадратной."""
    h, w = м.shape
    с = max(h, w)
    к = np.zeros((с, с), dtype=bool)
    к[(с - h) // 2:(с - h) // 2 + h, (с - w) // 2:(с - w) // 2 + w] = м
    return к


def main():
    рабочая = os.path.join(ЗДЕСЬ, "_build")
    os.makedirs(рабочая, exist_ok=True)

    розовое = маска_розового(ЭТАЛОН)
    ягода_низ, надпись_верх = найти_разрыв(розовое)
    print(f"ягода до строки {ягода_низ}, надпись с {надпись_верх}")

    собрать(розовое, ягода_низ + 3, "amberry-mark", "AMBERRY", рабочая)

    ягода = розовое.copy()
    ягода[ягода_низ:] = False
    кв = в_квадрат(обрезать(ягода))
    собрать(кв, кв.shape[0], "amberry-icon", "AMBERRY — знак", рабочая)


if __name__ == "__main__":
    main()
