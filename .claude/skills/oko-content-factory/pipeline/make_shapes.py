#!/usr/bin/env python3
# Генератор форм-вставок (MOTION ARSENAL): feather-маска (ЧБ) + акцентное кольцо (RGBA).
# Использование: python3 make_shapes.py "#00D9FF" assets/shapes/spy
import sys, os, math, json
from PIL import Image, ImageDraw, ImageFilter, ImageChops

def hex_rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

BOXES = {  # (w, h) бокса формы
    'circle': (900, 900), 'hexagon': (900, 820), 'phone': (600, 1240),
    'tv': (1000, 640), 'tilt': (960, 780), 'diamond': (900, 900),
    'rrect': (900, 1160), 'arch': (840, 1140),
}
PAD = 60

def hexagon_pts(x0, y0, w, h):
    cx, cy, rx, ry = x0+w/2, y0+h/2, w/2, h/2
    return [(cx+rx*math.cos(math.pi/6+k*math.pi/3), cy+ry*math.sin(math.pi/6+k*math.pi/3)) for k in range(6)]

def stamp(name, W, H, inset):
    """белая форма name на чёрном холсте W×H, с отступом inset от бокса."""
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    x0, y0 = PAD+inset, PAD+inset
    w, h = BOXES[name][0]-2*inset, BOXES[name][1]-2*inset
    x1, y1 = x0+w, y0+h
    if name == 'circle': d.ellipse([x0, y0, x1, y1], fill=255)
    elif name == 'diamond': d.polygon([((x0+x1)/2, y0), (x1, (y0+y1)/2), ((x0+x1)/2, y1), (x0, (y0+y1)/2)], fill=255)
    elif name == 'hexagon': d.polygon(hexagon_pts(x0, y0, w, h), fill=255)
    elif name == 'phone': d.rounded_rectangle([x0, y0, x1, y1], radius=90, fill=255)
    elif name == 'tv': d.rounded_rectangle([x0, y0, x1, y1], radius=52, fill=255)
    elif name == 'rrect': d.rounded_rectangle([x0, y0, x1, y1], radius=68, fill=255)
    elif name == 'arch':
        r = w/2
        d.rounded_rectangle([x0, y0+r, x1, y1], radius=36, fill=255)
        d.pieslice([x0, y0, x1, y0+2*r], 180, 360, fill=255)
    elif name == 'tilt':
        base = Image.new('L', (w, h), 0)
        ImageDraw.Draw(base).rounded_rectangle([0, 0, w-1, h-1], radius=70, fill=255)
        base = base.rotate(-9, expand=True, resample=Image.BICUBIC)
        img.paste(base, ((W-base.width)//2, (H-base.height)//2))
    return img

def build(name, accent, outdir):
    w, h = BOXES[name]; W, H = w+PAD*2, h+PAD*2
    mask = stamp(name, W, H, 0).filter(ImageFilter.GaussianBlur(6))
    mask.save(f"{outdir}/{name}_mask.png")
    outer = stamp(name, W, H, 0).point(lambda p: 255 if p > 100 else 0)
    inner = stamp(name, W, H, 14).point(lambda p: 255 if p > 100 else 0)
    band = ImageChops.subtract(outer, inner).filter(ImageFilter.GaussianBlur(1.1))
    r, g, b = hex_rgb(accent)
    color = Image.new('RGBA', (W, H), (r, g, b, 0)); color.putalpha(band)
    glow = color.filter(ImageFilter.GaussianBlur(13))
    ring = Image.alpha_composite(glow, color)
    ring.save(f"{outdir}/{name}_ring.png")
    return W, H

def main():
    accent, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    meta = {}
    for name in BOXES:
        meta[name] = list(build(name, accent, outdir)); print("shape", name, meta[name])
    json.dump(meta, open(f"{outdir}/_boxes.json", "w"))

main()
