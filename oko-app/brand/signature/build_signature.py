#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Realistic OKO owner signature builder.

Works from the HIGH-RES RASTER of the real pen signature (keeps pen pressure /
variable stroke width / ink density) instead of a flat potrace vector. The source
alpha channel already encodes natural anti-aliased pressure; we clean it gently,
recolor to a natural navy ink (with density-driven shade variation so cores pool
darker and tails fade), and emit transparent PNGs, an SVG (embedded hi-res raster
so it scales without going flat) and a PDF.
"""
import io, base64, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SRC = "/root/.claude/uploads/1e302e81-cfb3-54d9-9e3e-3f0368f4c654/63e747a4-________2.png"
OUT = "/home/user/OKO-TEAM/oko-app/brand/signature"

# ---- load source (already RGBA with real pressure in alpha) ----
src = Image.open(SRC).convert("RGBA")
a = np.asarray(src).astype(np.float32)
alpha = a[..., 3] / 255.0

# ---- gentle cleanup: kill any stray isolated speck, keep soft edges ----
mask = alpha > (12 / 255.0)
lbl, n = ndimage.label(mask)
if n > 1:
    sizes = ndimage.sum(np.ones_like(lbl), lbl, range(1, n + 1))
    keep = set(int(i) + 1 for i, s in enumerate(sizes) if s >= 40)
    clean = np.isin(lbl, list(keep))
    alpha = alpha * clean  # zero out specks, preserve everything real

# ---- density map: how "inky" each pixel is (drives shade + subtle pooling) ----
# core density = alpha; add a touch of low-freq variation so ink is not perfectly flat.
h, w = alpha.shape
rng = np.random.default_rng(21)
low = rng.random((h // 24, w // 24)).astype(np.float32)
low = np.asarray(Image.fromarray((low * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)) / 255.0
low = 0.94 + 0.06 * low  # +/-6% ink density mottle, very subtle


def render(core, edge, alpha_map, tighten=1.0):
    """core/edge = RGB (0-255) for dense core vs thin tail. Returns cropped RGBA."""
    t = np.clip(alpha_map, 0, 1)
    # shade: dense strokes -> core color, faint tails -> edge color
    shade = t[..., None]
    rgb = edge[None, None, :] * (1 - shade) + core[None, None, :] * shade
    # subtle per-pixel density mottle (ink pooling / paper absorption)
    rgb = rgb * low[..., None]
    out_alpha = np.clip(alpha_map * tighten, 0, 1) * 255.0
    arr = np.zeros((h, w, 4), np.float32)
    arr[..., :3] = np.clip(rgb, 0, 255)
    arr[..., 3] = out_alpha
    im = Image.fromarray(arr.astype(np.uint8), "RGBA")
    # tight crop to ink + padding
    ys, xs = np.where(out_alpha > 8)
    pad = 40
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad)
    return im.crop((x0, y0, x1, y1))


NAVY_CORE = np.array([13, 20, 56], np.float32)    # deep pooled ink
NAVY_EDGE = np.array([38, 54, 122], np.float32)    # thin fading tails
BLACK_CORE = np.array([8, 8, 12], np.float32)
BLACK_EDGE = np.array([44, 44, 52], np.float32)
BLUE_CORE = np.array([21, 45, 120], np.float32)    # brand-leaning blue
BLUE_EDGE = np.array([48, 78, 168], np.float32)
WHITE_CORE = np.array([248, 250, 255], np.float32)
WHITE_EDGE = np.array([214, 222, 240], np.float32)

variants = {
    "navy": (NAVY_CORE, NAVY_EDGE),
    "black": (BLACK_CORE, BLACK_EDGE),
    "blue": (BLUE_CORE, BLUE_EDGE),
    "white": (WHITE_CORE, WHITE_EDGE),
}

os.makedirs(OUT, exist_ok=True)
imgs = {}
for name, (core, edge) in variants.items():
    im = render(core, edge, alpha)
    im.save(f"{OUT}/signature-{name}.png")
    imgs[name] = im
    print(f"wrote signature-{name}.png {im.size}")

# primary = navy realistic raster
primary = imgs["navy"]
primary.save(f"{OUT}/signature.png")
print("primary signature.png =", primary.size)

# ---- SVG: embed the hi-res realistic raster so it scales without going flat ----
buf = io.BytesIO(); primary.save(buf, "PNG")
b64 = base64.b64encode(buf.getvalue()).decode()
W, H = primary.size
svg = (f'<?xml version="1.0" encoding="UTF-8"?>\n'
       f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
       f'width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
       f'<image width="{W}" height="{H}" xlink:href="data:image/png;base64,{b64}"/></svg>')
open(f"{OUT}/signature.svg", "w").write(svg)
# blue/black svg variants (embed those rasters)
for name in ("blue", "black", "white"):
    b = io.BytesIO(); imgs[name].save(b, "PNG")
    e = base64.b64encode(b.getvalue()).decode()
    ww, hh = imgs[name].size
    open(f"{OUT}/signature-{name}.svg", "w").write(
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{ww}" height="{hh}" viewBox="0 0 {ww} {hh}">'
        f'<image width="{ww}" height="{hh}" xlink:href="data:image/png;base64,{e}"/></svg>')
print("wrote signature.svg (+blue/black/white)")

# ---- PDF: navy signature on transparent, page = trimmed bbox at 300dpi scale ----
pdf = primary.copy()
bg = Image.new("RGB", pdf.size, (255, 255, 255))
bg.paste(pdf, mask=pdf.split()[3])
bg.save(f"{OUT}/signature.pdf", "PDF", resolution=300.0)
print("wrote signature.pdf")
print("DONE")
