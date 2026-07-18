#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build all seal deliverables for both premium variants (A=guilloche primary, B=medallion alt)."""
import os, io, glob, shutil
import numpy as np
import cairosvg
from PIL import Image, ImageFilter
import make_seal

OUT = "/home/user/OKO-TEAM/oko-app/brand/seal"
if os.path.isdir(OUT):
    for f in glob.glob(f"{OUT}/*"):
        # never delete build scripts, __pycache__, or any directory
        if os.path.isfile(f) and not f.endswith(".py"):
            os.remove(f)
os.makedirs(OUT, exist_ok=True)

COLORS = {"blue": "#1e3a8a", "violet": "#2b4fd8", "black": "#111111", "lime": "#9AFF00"}
SIZES = [512, 1024, 2048]
VARIANTS = {"A": "", "B": "alt-"}   # variant -> file prefix ('' primary, 'alt-' secondary)

def svg_to_rgba(svg_str, size, bg=None):
    png = cairosvg.svg2png(bytestring=svg_str.encode(), output_width=size, output_height=size,
                           background_color=bg)
    return Image.open(io.BytesIO(png)).convert("RGBA")

def make_stamp_texture(img, seed=7):
    """Flat vector render -> realistic rubber-stamp ink, staying even & crisp."""
    rng = np.random.default_rng(seed)
    w, h = img.size
    a = np.asarray(img).astype(np.float32)
    alpha = a[..., 3] / 255.0
    low = rng.random((h // 16, w // 16)).astype(np.float32)
    low = np.asarray(Image.fromarray((low * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)) / 255.0
    low = 0.82 + 0.18 * low
    fine = rng.random((h, w)).astype(np.float32)
    fine = np.asarray(Image.fromarray((fine * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))) / 255.0
    fine = 0.90 + 0.10 * fine
    voids = (rng.random((h, w)) > 0.0028).astype(np.float32)
    voids = np.asarray(Image.fromarray((voids * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.4))) / 255.0
    voids = 0.35 + 0.65 * voids
    a[..., 3] = np.clip(alpha * low * fine * voids * 0.92 * 255.0, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")

n = 0
for var, pfx in VARIANTS.items():
    for name, hexc in COLORS.items():
        clean = make_seal.build_seal(hexc, stamp=False, variant=var)
        stamp = make_seal.build_seal(hexc, stamp=True, variant=var)
        open(f"{OUT}/seal-{pfx}{name}.svg", "w").write(clean); n += 1
        open(f"{OUT}/seal-{pfx}{name}-stamp.svg", "w").write(stamp); n += 1
        cairosvg.svg2pdf(bytestring=clean.encode(), write_to=f"{OUT}/seal-{pfx}{name}.pdf"); n += 1
        for s in SIZES:
            base = svg_to_rgba(clean, s)
            base.save(f"{OUT}/seal-{pfx}{name}-{s}.png"); n += 1
            make_stamp_texture(base, seed=7 + s).save(f"{OUT}/seal-{pfx}{name}-{s}-stamp.png"); n += 1

shutil.copy(f"{OUT}/seal-blue.svg", f"{OUT}/seal.svg")
shutil.copy(f"{OUT}/seal-blue-stamp.svg", f"{OUT}/seal_stamp.svg")
shutil.copy(f"{OUT}/seal-blue.pdf", f"{OUT}/seal.pdf")
print("SEAL DONE:", n, "files ->", OUT)
