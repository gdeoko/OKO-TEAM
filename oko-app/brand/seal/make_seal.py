#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OKO official round seal generator — programmatic, crisp Cyrillic on arcs (glyphs->vector paths)."""
import math, re, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

FONT = "/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts/montserrat-v31-cyrillic_latin-700.ttf"
LOGO_SVG = "/home/user/OKO-TEAM/oko-app/brand/vector/oko-logo.svg"

# ---- font setup ----
_ft = TTFont(FONT)
_upm = _ft["head"].unitsPerEm
_cmap = _ft.getBestCmap()
_glyphset = _ft.getGlyphSet()
_hmtx = _ft["hmtx"]

def glyph_path_and_adv(ch):
    gname = _cmap.get(ord(ch))
    if gname is None:
        gname = _cmap.get(ord(' '))
    adv = _hmtx[gname][0]
    pen = SVGPathPen(_glyphset)
    _glyphset[gname].draw(pen)
    return pen.getCommands(), adv

CX = CY = 500.0

LAST_SPAN = {}

def arc_span(text, radius, font_px, tracking_px):
    """Total angular span (deg) that text would occupy — for layout verification."""
    s = font_px / _upm
    total = 0.0
    for i, ch in enumerate(text):
        _, adv = glyph_path_and_adv(ch)
        total += math.degrees((adv * s) / radius)
        if i < len(text) - 1:
            total += math.degrees(tracking_px / radius)
    return total

def arc_text(text, radius, center_deg, font_px, tracking_px, side="top", tag=None):
    """Return SVG path-d fragments for text laid along a circle.
    center_deg: clockwise angle from top (0=12 o'clock) where the text is centred.
    side: 'top' -> reading clockwise, glyph tops point outward.
          'bottom' -> reading left->right along bottom, glyph tops point inward."""
    s = font_px / _upm
    items = []
    total = 0.0
    for i, ch in enumerate(text):
        _, adv = glyph_path_and_adv(ch)
        w_deg = math.degrees((adv * s) / radius)
        items.append([ch, adv, w_deg])
        total += w_deg
        if i < len(text) - 1:
            total += math.degrees(tracking_px / radius)
    if tag:
        LAST_SPAN[tag] = total
    d = 1.0 if side == "top" else -1.0
    phi = center_deg - d * total / 2.0
    out = []
    for i, (ch, adv, w_deg) in enumerate(items):
        cdeg = phi + d * (w_deg / 2.0)
        rad = math.radians(cdeg)
        px = CX + radius * math.sin(rad)
        py = CY - radius * math.cos(rad)
        rot = cdeg if side == "top" else cdeg + 180.0
        path, _ = glyph_path_and_adv(ch)
        if path.strip():
            tf = (f"translate({px:.3f},{py:.3f}) rotate({rot:.4f}) "
                  f"scale({s:.6f},{-s:.6f}) translate({-adv/2.0:.3f},0)")
            out.append(f'<path transform="{tf}" d="{path}"/>')
        phi += d * (w_deg + math.degrees(tracking_px / radius))
    return "\n".join(out)

def star(cx, cy, r_out, r_in=None, points=5, rot_deg=-90):
    if r_in is None:
        r_in = r_out * 0.42
    pts = []
    for k in range(points * 2):
        rr = r_out if k % 2 == 0 else r_in
        a = math.radians(rot_deg + k * 180.0 / points)
        pts.append(f"{cx + rr*math.cos(a):.2f},{cy + rr*math.sin(a):.2f}")
    return f'<polygon points="{" ".join(pts)}"/>'

# ---- embed logo (eye) ----
def logo_group(color, size, cy_off):
    svg = open(LOGO_SVG).read()
    m = re.search(r"(<g\b.*?</g>)", svg, re.S)
    inner = m.group(1)
    inner = re.sub(r'fill="#9AFF00"', f'fill="{color}"', inner)
    scale = size / 2000.0
    tx = CX - size / 2.0
    ty = (CY + cy_off) - size / 2.0
    return f'<g transform="translate({tx:.2f},{ty:.2f}) scale({scale:.5f})">{inner}</g>'

def logo_at(color, size, cx, cy):
    """Embed the eye logo centred at an arbitrary point."""
    svg = open(LOGO_SVG).read()
    inner = re.search(r"(<g\b.*?</g>)", svg, re.S).group(1)
    inner = re.sub(r'fill="#9AFF00"', f'fill="{color}"', inner)
    scale = size / 2000.0
    return f'<g transform="translate({cx - size/2:.2f},{cy - size/2:.2f}) scale({scale:.5f})">{inner}</g>'

def straight_text(text, cy, font_px, tracking_px):
    """Horizontally-centred text as vector paths at baseline y=cy."""
    s = font_px / _upm
    total = 0.0
    for i, ch in enumerate(text):
        _, adv = glyph_path_and_adv(ch)
        total += adv * s
        if i < len(text) - 1:
            total += tracking_px
    x = CX - total / 2.0
    segs = []
    for i, ch in enumerate(text):
        path, adv = glyph_path_and_adv(ch)
        if path.strip():
            tf = f"translate({x:.3f},{cy:.3f}) scale({s:.6f},{-s:.6f})"
            segs.append(f'<path transform="{tf}" d="{path}"/>')
        x += adv * s + tracking_px
    return "\n".join(segs)

def polar(deg, r):
    a = math.radians(deg)
    return CX + r * math.sin(a), CY - r * math.cos(a)

def ring_c(r, w, color, dash=None, op=1.0):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<circle cx="{CX}" cy="{CY}" r="{r}" fill="none" stroke="{color}" stroke-width="{w}" opacity="{op}"{d}/>'

def guilloche_band(Rc, amp, lobes, color, sw=0.7, op=0.5, n=1600, phases=(0.0, math.pi)):
    """Interwoven sinusoidal security band (banknote-style guilloché)."""
    out = []
    for ph in phases:
        pts = []
        for i in range(n + 1):
            th = 2 * math.pi * i / n
            r = Rc + amp * math.sin(lobes * th + ph)
            pts.append("%.2f,%.2f" % polar(math.degrees(th), r))
        out.append(f'<polyline fill="none" stroke="{color}" stroke-width="{sw}" '
                   f'opacity="{op}" points="{" ".join(pts)}"/>')
    return "\n".join(out)

def separator(style, deg, radius, color, size):
    cx, cy = polar(deg, radius)
    if style == "diamond":
        p = f'{cx:.1f},{cy-size:.1f} {cx+size*0.62:.1f},{cy:.1f} {cx:.1f},{cy+size:.1f} {cx-size*0.62:.1f},{cy:.1f}'
        dots = (f'<circle cx="{cx-size*1.55:.1f}" cy="{cy:.1f}" r="{size*0.16:.1f}"/>'
                f'<circle cx="{cx+size*1.55:.1f}" cy="{cy:.1f}" r="{size*0.16:.1f}"/>')
        return f'<polygon points="{p}"/>' + dots
    if style == "hexstar":
        pts = []
        for k in range(12):
            rr = size if k % 2 == 0 else size * 0.5
            a = math.radians(-90 + k * 30)
            pts.append(f"{cx+rr*math.cos(a):.2f},{cy+rr*math.sin(a):.2f}")
        return f'<polygon points="{" ".join(pts)}"/>'
    if style == "dotcircle":
        return (f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{size:.1f}" fill="none" '
                f'stroke="{color}" stroke-width="{size*0.16:.2f}"/>'
                f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{size*0.34:.1f}"/>')
    if style == "eye":
        return logo_at(color, size * 2.6, cx, cy)
    return ""

TOP_TEXT = "ИНДИВИДУАЛЬНЫЙ ПРЕДПРИНИМАТЕЛЬ"
BOTTOM_TEXT = "ИЛЬЯСОВ ДАНИЭЛЬ АЛЬБЕРТОВИЧ · ИНН 682016634349"

STAMP_FILTER = '''<filter id="ink" x="-20%" y="-20%" width="140%" height="140%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9 0.9" numOctaves="2" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="11" result="mott"/>
  <feColorMatrix in="mott" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.5 0.9" result="mask"/>
  <feComposite in="d" in2="mask" operator="in" result="rough"/>
  <feMerge><feMergeNode in="rough"/></feMerge>
</filter>'''

def build_seal(color="#1e3a8a", stamp=False, variant="A"):
    """variant 'A' = premium guilloché ; variant 'B' = minimal-premium medallion."""
    W = 1000
    els = []
    # ================= outer double ring =================
    els.append(ring_c(491, 6.5, color))
    els.append(ring_c(480, 1.8, color))
    # ================= arc texts (classic split) =========
    if variant == "A":
        Rt, Rb = 421, 452
        ft, fb = 40, 36
        tt, tb = 7.0, 2.6
    else:
        Rt, Rb = 423, 454
        ft, fb = 41, 37
        tt, tb = 8.0, 2.8
    top = arc_text(TOP_TEXT, radius=Rt, center_deg=0.0, font_px=ft, tracking_px=tt, side="top", tag="top")
    bottom = arc_text(BOTTOM_TEXT, radius=Rb, center_deg=180.0, font_px=fb, tracking_px=tb, side="bottom", tag="bottom")
    els.append(top); els.append(bottom)
    # inner boundary of the text band
    els.append(ring_c(407, 1.8, color))
    # ================= decorative middle zone ============
    if variant == "A":
        els.append(guilloche_band(381, 9.0, 44, color, sw=0.7, op=0.5))
        els.append(guilloche_band(381, 4.2, 88, color, sw=0.5, op=0.32, phases=(0.0,)))
        els.append(ring_c(357, 1.4, color, op=0.9))
        med_out, med_in = 346, 337
        logo_size, cy_logo = 352, CY - 84   # hero eye: ~1.52x, centred high in medallion
        f_name = 58
    else:
        els.append(ring_c(392, 1.2, color, dash="1.5 6", op=0.85))  # fine dotted guide ring
        med_out, med_in = 366, 356
        logo_size, cy_logo = 236, CY - 74
        f_name = 54
    # ================= medallion double ring =============
    els.append(ring_c(med_out, 3.0, color))
    els.append(ring_c(med_in, 1.5, color))
    # ================= separators at 3 & 9 o'clock =======
    sep_style = "diamond" if variant == "A" else "dotcircle"
    sep_r = (Rt + Rb) / 2.0
    for deg in (90.0, 270.0):
        els.append(separator(sep_style, deg, sep_r, color, 10.5 if variant == "A" else 8.5))
    # ================= centre emblem =====================
    els.append(logo_at(color, logo_size, CX, cy_logo))
    if variant == "A":
        # hero eye up top; the inner field is filled premium below it
        els.append(straight_text("ОКО PROJECT", cy=CY + 96, font_px=f_name, tracking_px=6))
        els.append(f'<rect x="{CX-108}" y="{CY+114}" width="216" height="2.6" rx="1.3"/>')
        els.append(straight_text("MOSCOW · DUBAI", cy=CY + 144, font_px=25, tracking_px=6))
        els.append(straight_text("МОСКВА · РФ", cy=CY + 172, font_px=21, tracking_px=4))
        # inner arc text hugging the bottom inside of the medallion (top kept clean)
        els.append(arc_text("МЕДИЙНОСТЬ · КОНТЕНТ · МАРКЕТИНГ", radius=302,
                            center_deg=180.0, font_px=22, tracking_px=3.0,
                            side="bottom", tag="inner"))
    else:
        els.append(straight_text("ОКО PROJECT", cy=CY + 92, font_px=f_name, tracking_px=5))
        els.append(f'<rect x="{CX-96}" y="{CY+108}" width="192" height="2.4" rx="1.2"/>')
        els.append(straight_text("MOSCOW · DUBAI", cy=CY + 136, font_px=25, tracking_px=5))
        els.append(straight_text("МОСКВА · РФ", cy=CY + 164, font_px=21, tracking_px=4))

    defs = STAMP_FILTER if stamp else ""
    grp = (f'<g fill="{color}" stroke="none" filter="url(#ink)" opacity="0.9">'
           if stamp else f'<g fill="{color}" stroke="none">')
    body = "\n".join(els)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{W}" viewBox="0 0 {W} {W}">
<defs>{defs}</defs>
{grp}
{body}
</g>
</svg>'''

if __name__ == "__main__":
    color = sys.argv[1] if len(sys.argv) > 1 else "#1e3a8a"
    stamp = len(sys.argv) > 2 and sys.argv[2] == "stamp"
    variant = sys.argv[4] if len(sys.argv) > 4 else "A"
    out = sys.argv[3] if len(sys.argv) > 3 else "/tmp/seal.svg"
    open(out, "w").write(build_seal(color, stamp, variant))
    print("wrote", out, "spans:", {k: round(v, 1) for k, v in LAST_SPAN.items()})
