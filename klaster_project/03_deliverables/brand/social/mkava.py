#!/usr/bin/env python3
"""Ава для соцсетей: настоящее лого «Активити» на сгенерированный фон.

Лого не перерисовываем и не растягиваем: берём оригинальный PNG,
вписываем по большей стороне, ставим ровно в центр. Пропорции сохраняются
до пикселя.

  python3 mkava.py <фон.jpg> <эмблема.png> <куда/>
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter

BG, LOGO, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)

SIDE = 1024          # рабочий размер
DOLYA = 0.52         # какую часть стороны занимает лого

# ---- фон: обрезаем по центру в квадрат ----
bg = Image.open(BG).convert('RGB')
w, h = bg.size
s = min(w, h)
bg = bg.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
bg = bg.resize((SIDE, SIDE), Image.LANCZOS)

# ---- лого: вписываем, пропорции не трогаем ----
lg = Image.open(LOGO).convert('RGBA')
lw, lh = lg.size
k = (SIDE * DOLYA) / max(lw, lh)
lg = lg.resize((max(1, round(lw * k)), max(1, round(lh * k))), Image.LANCZOS)
lw, lh = lg.size
px, py = (SIDE - lw) // 2, (SIDE - lh) // 2

# ---- тень под лого, чтобы золото не слипалось с фоном ----
ten = Image.new('RGBA', (SIDE, SIDE), (0, 0, 0, 0))
sil = Image.new('RGBA', lg.size, (0, 0, 0, 0))
sil.paste((0, 0, 0, 150), (0, 0), lg.split()[3])
ten.paste(sil, (px, py + round(SIDE * 0.012)), sil)
ten = ten.filter(ImageFilter.GaussianBlur(SIDE * 0.022))

kadr = Image.alpha_composite(bg.convert('RGBA'), ten)
kadr.paste(lg, (px, py), lg)

# ---- квадратная ----
sq = kadr.convert('RGB')
for n in (1024, 512, 256, 128):
    sq.resize((n, n), Image.LANCZOS).save(
        os.path.join(OUT, f'klaster-avatar-square-{n}.jpg'), quality=94, subsampling=0)

# ---- круглая: маска с мягким краем ----
M = 4
m = Image.new('L', (SIDE * M, SIDE * M), 0)
ImageDraw.Draw(m).ellipse((0, 0, SIDE * M - 1, SIDE * M - 1), fill=255)
m = m.resize((SIDE, SIDE), Image.LANCZOS)
rd = kadr.copy()
rd.putalpha(m)
for n in (1024, 512, 256, 128):
    rd.resize((n, n), Image.LANCZOS).save(
        os.path.join(OUT, f'klaster-avatar-round-{n}.png'))

# ---- фавиконка ----
sq.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'))

print('готово:', ', '.join(sorted(os.listdir(OUT))))
