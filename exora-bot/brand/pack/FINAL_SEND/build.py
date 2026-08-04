#!/usr/bin/env python3
"""Exora brand pack v3 — soft even glow, no square cutoff."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pathlib import Path
import base64, math

ROOT     = Path("/home/user/OKO-TEAM/exora-bot/brand")
LOGO_PNG = ROOT/"pack/vector/exora-FINAL-transparent.png"
FONTS    = ROOT/"fonts"
OUT      = ROOT/"pack/FINAL_SEND"
OUT.mkdir(parents=True, exist_ok=True)

MINT_LIGHT = (220,255,238)
MINT       = (108,225,172)
MINT_DEEP  = ( 46,155,108)


# -----------------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------------
def load_logo(size):
    lo = Image.open(LOGO_PNG).convert("RGBA")
    return lo.resize((size, size), Image.LANCZOS)


def paint_glow(canvas, logo, logo_xy, radius, color):
    """Paint a Gaussian-blurred glow directly onto the full canvas.

    Puts the logo's alpha mask at logo_xy, then blurs the WHOLE canvas.
    Blur spreads freely — no square edge, halo fades softly outward."""
    W, H = canvas.size
    mask = logo.split()[3]

    big_mask = Image.new("L", (W, H), 0)
    big_mask.paste(mask, logo_xy)
    big_mask = big_mask.filter(ImageFilter.GaussianBlur(radius=radius))

    glow = Image.new("RGBA", (W, H), color)
    glow.putalpha(big_mask)
    canvas.alpha_composite(glow)


def gradient_bg(W, H, hi_x=0.5, hi_y=0.44, strength=1.0):
    """Deep dark → teal radial background."""
    bg = Image.new("RGB", (W, H), (4, 7, 14))
    cx, cy = int(W * hi_x), int(H * hi_y)
    max_r = int(math.hypot(W, H) * 0.6)
    for r in range(max_r, 0, -8):
        t = 1 - r / max_r
        if t < 0.55:
            k = t / 0.55
            col = (int(4 + k * 8), int(7 + k * 28), int(14 + k * 40))
        else:
            k = (t - 0.55) / 0.45
            col = (int(12 + k * 35 * strength),
                   int(35 + k * 130 * strength),
                   int(54 + k * 100 * strength))
        ImageDraw.Draw(bg).ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    bg = bg.filter(ImageFilter.GaussianBlur(radius=40))
    return bg.convert("RGBA")


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def text_width(text, ttf_name, size, letter_spacing=0):
    f = font(ttf_name, size)
    tmp = Image.new("RGBA", (6000, 800), (0, 0, 0, 0))
    td  = ImageDraw.Draw(tmp)
    if letter_spacing == 0:
        b = td.textbbox((0, 0), text, font=f)
        return b[2] - b[0], b[3] - b[1]
    w = 0
    for i, ch in enumerate(text):
        b = td.textbbox((0, 0), ch, font=f)
        w += (b[2] - b[0]) + (letter_spacing if i < len(text) - 1 else 0)
    return w, f.getbbox("Ag")[3]


def draw_metallic_text(canvas, text, xy, ttf_name, size,
                       color_top=MINT_LIGHT, color_bot=MINT_DEEP,
                       shadow=True, glow=True, letter_spacing=0):
    """Vertical metallic gradient text + soft glow + drop shadow."""
    f = font(ttf_name, size)
    tmp = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    td  = ImageDraw.Draw(tmp)

    x0, y0 = xy
    if letter_spacing:
        cursor = x0
        for ch in text:
            td.text((cursor, y0), ch, font=f, fill=(255, 255, 255, 255))
            b = td.textbbox((cursor, y0), ch, font=f)
            cursor = b[2] + letter_spacing
        bbox = td.textbbox((0, 0), text, font=f)
        h = bbox[3] - bbox[1]
    else:
        td.text((x0, y0), text, font=f, fill=(255, 255, 255, 255))
        bbox = td.textbbox((x0, y0), text, font=f)
        h = bbox[3] - bbox[1]

    grad = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for i in range(canvas.size[1]):
        k = max(0.0, min(1.0, (i - y0) / max(1, h)))
        k = k * k * (3 - 2 * k)
        col = (
            int(color_top[0] * (1 - k) + color_bot[0] * k),
            int(color_top[1] * (1 - k) + color_bot[1] * k),
            int(color_top[2] * (1 - k) + color_bot[2] * k),
            255,
        )
        gd.line([(0, i), (canvas.size[0], i)], fill=col)

    text_alpha = tmp.split()[3]
    grad.putalpha(text_alpha)

    if glow:
        # soft mint glow around the text — big blur, low alpha
        gmask = text_alpha.filter(ImageFilter.GaussianBlur(radius=size // 6))
        gcol = Image.new("RGBA", canvas.size, (140, 240, 190, 180))
        gcol.putalpha(gmask)
        canvas.alpha_composite(gcol)

    if shadow:
        sh_mask = Image.new("L", canvas.size, 0)
        sh_mask.paste(text_alpha, (3, 6))
        sh_mask = sh_mask.filter(ImageFilter.GaussianBlur(radius=10))
        sh = Image.new("RGBA", canvas.size, (0, 0, 0, 190))
        sh.putalpha(sh_mask)
        canvas.alpha_composite(sh)

    canvas.alpha_composite(grad)

    # thin top highlight
    hl = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(hl)
    if letter_spacing:
        cursor = x0
        for ch in text:
            hd.text((cursor, y0 - 1), ch, font=f, fill=(255, 255, 255, 110))
            b = hd.textbbox((cursor, y0 - 1), ch, font=f)
            cursor = b[2] + letter_spacing
    else:
        hd.text((x0, y0 - 1), text, font=f, fill=(255, 255, 255, 110))
    hl_mask = hl.split()[3].filter(ImageFilter.GaussianBlur(radius=1))
    hl_col = Image.new("RGBA", canvas.size, (255, 255, 255, 120))
    hl_col.putalpha(hl_mask)
    canvas.alpha_composite(hl_col)


# =============================================================================
# 1) AVATAR — 1024×1024, no text
# =============================================================================
def build_avatar(size=1024):
    bg = gradient_bg(size, size)

    logo_size = int(size * 0.56)          # немного меньше → воздух и glow
    logo = load_logo(logo_size)
    lx = (size - logo_size) // 2
    ly = (size - logo_size) // 2

    # 3-слойный soft glow — все на ПОЛНОМ холсте, blur не режется
    paint_glow(bg, logo, (lx, ly), radius=int(size * 0.11),
               color=(94, 210, 156, 70))
    paint_glow(bg, logo, (lx, ly), radius=int(size * 0.055),
               color=(140, 240, 190, 110))
    paint_glow(bg, logo, (lx, ly), radius=int(size * 0.018),
               color=(220, 255, 238, 150))

    bg.alpha_composite(logo, (lx, ly))

    # мягкий виньет по краям
    vig = Image.new("L", (size, size), 0)
    vd  = ImageDraw.Draw(vig)
    vd.ellipse([-size // 3, -size // 3, size + size // 3, size + size // 3],
               fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(radius=size // 8))
    vig_dark = Image.new("RGBA", (size, size), (0, 0, 0, 90))
    inv = Image.eval(vig, lambda v: 255 - v)
    vig_dark.putalpha(inv)
    bg.alpha_composite(vig_dark)

    bg.save(OUT / "exora-AVATAR-1024.png", "PNG", optimize=True)
    bg.resize((640, 640), Image.LANCZOS).save(
        OUT / "exora-AVATAR-640.png", "PNG", optimize=True)
    print("avatar OK")


# =============================================================================
# 2) COVER — 1920×1080 horizontal with text
# =============================================================================
def build_cover(w=1920, h=1080):
    bg = gradient_bg(w, h, hi_x=0.22, hi_y=0.5, strength=0.9)

    logo_area_cx = int(w * 0.22)
    logo_size = int(h * 0.70)
    logo = load_logo(logo_size)
    lx = logo_area_cx - logo_size // 2
    ly = (h - logo_size) // 2

    # мягкое цветное свечение по всей сцене вокруг лого
    paint_glow(bg, logo, (lx, ly), radius=160, color=(94, 210, 156, 60))
    paint_glow(bg, logo, (lx, ly), radius=70,  color=(140, 240, 190, 100))
    paint_glow(bg, logo, (lx, ly), radius=22,  color=(220, 255, 238, 140))

    bg.alpha_composite(logo, (lx, ly))

    # ------ текст справа ------
    text_area_x0 = int(w * 0.42)
    text_area_x1 = int(w * 0.97)
    text_area_w  = text_area_x1 - text_area_x0

    text = "EXORA"
    ls = 18
    tsize = 260
    tw, th = text_width(text, "Orbitron-VF.ttf", tsize, letter_spacing=ls)
    while tw > text_area_w and tsize > 100:
        tsize -= 10
        tw, th = text_width(text, "Orbitron-VF.ttf", tsize, letter_spacing=ls)

    tx = text_area_x0 + (text_area_w - tw) // 2
    ty = int(h * 0.28)

    draw_metallic_text(bg, text, (tx, ty),
                       "Orbitron-VF.ttf", tsize,
                       letter_spacing=ls)

    tagline = "CRYPTO EXCHANGE · 24/7 · 0% FEE"
    ts  = 38
    ls2 = 5
    tw2, th2 = text_width(tagline, "SpaceGrotesk-VF.ttf", ts, letter_spacing=ls2)
    tx2 = text_area_x0 + (text_area_w - tw2) // 2
    ty2 = ty + th + 55
    tag_font = font("SpaceGrotesk-VF.ttf", ts)
    td = ImageDraw.Draw(bg)
    cursor = tx2
    for ch in tagline:
        td.text((cursor, ty2), ch, font=tag_font, fill=(215, 240, 228, 235))
        b = td.textbbox((cursor, ty2), ch, font=tag_font)
        cursor = b[2] + ls2

    ly_line = ty2 + th2 + 34
    line_w = tw // 3
    line_x = text_area_x0 + (text_area_w - line_w) // 2
    ImageDraw.Draw(bg).rectangle(
        [line_x, ly_line, line_x + line_w, ly_line + 4],
        fill=(94, 210, 156, 240))

    sub = "USDT · TRC-20 · ERC-20 · BEP-20 · TON"
    ss  = 24; ls3 = 4
    sw, _ = text_width(sub, "SpaceGrotesk-VF.ttf", ss, letter_spacing=ls3)
    sx = text_area_x0 + (text_area_w - sw) // 2
    sy = ly_line + 34
    sf = font("SpaceGrotesk-VF.ttf", ss)
    cursor = sx
    for ch in sub:
        td.text((cursor, sy), ch, font=sf, fill=(160, 190, 180, 200))
        b = td.textbbox((cursor, sy), ch, font=sf)
        cursor = b[2] + ls3

    bg.save(OUT / "exora-COVER-1920x1080.png", "PNG", optimize=True)
    bg.resize((1280, 720), Image.LANCZOS).save(
        OUT / "exora-COVER-1280x720.png", "PNG", optimize=True)
    bg.resize((640, 360), Image.LANCZOS).save(
        OUT / "exora-COVER-640x360.png", "PNG", optimize=True)
    print("cover OK")


# =============================================================================
# 3) SVG + Icon 512×512 1:1 with text, transparent bg
# =============================================================================
def build_svg_and_icon(size=512):
    S = 2048
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    logo_size = int(S * 0.55)
    logo = load_logo(logo_size)
    lx = (S - logo_size) // 2
    ly = int(S * 0.06)

    # radial glow ЗА лого (мягкий, до самых краёв без обрезки)
    paint_glow(canvas, logo, (lx, ly), radius=int(S * 0.12),
               color=(94, 210, 156, 90))
    paint_glow(canvas, logo, (lx, ly), radius=int(S * 0.05),
               color=(140, 240, 190, 130))
    paint_glow(canvas, logo, (lx, ly), radius=int(S * 0.017),
               color=(220, 255, 238, 160))

    canvas.alpha_composite(logo, (lx, ly))

    text = "EXORA"
    tsize = 340; ls = 22
    tw, th = text_width(text, "Orbitron-VF.ttf", tsize, letter_spacing=ls)
    tx = (S - tw) // 2
    ty = ly + logo_size + int(S * 0.03)
    draw_metallic_text(canvas, text, (tx, ty),
                       "Orbitron-VF.ttf", tsize,
                       letter_spacing=ls)

    tagline = "CRYPTO EXCHANGE"
    ts = 60; ls2 = 12
    tw2, th2 = text_width(tagline, "SpaceGrotesk-VF.ttf", ts, letter_spacing=ls2)
    tx2 = (S - tw2) // 2
    ty2 = ty + th + 40
    tf = font("SpaceGrotesk-VF.ttf", ts)
    td = ImageDraw.Draw(canvas)
    cursor = tx2
    for ch in tagline:
        td.text((cursor, ty2), ch, font=tf, fill=(200, 235, 220, 220))
        b = td.textbbox((cursor, ty2), ch, font=tf)
        cursor = b[2] + ls2

    canvas.save(OUT / "exora-ICON-square-2048.png", "PNG", optimize=True)
    canvas.resize((size, size), Image.LANCZOS).save(
        OUT / "exora-ICON-512.png", "PNG", optimize=True)
    canvas.resize((192, 192), Image.LANCZOS).save(
        OUT / "exora-ICON-192.png", "PNG", optimize=True)

    b64 = base64.b64encode((OUT / "exora-ICON-512.png").read_bytes()).decode()
    svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="512" height="512" viewBox="0 0 512 512">
  <title>Exora Crypto Exchange</title>
  <image href="data:image/png;base64,{b64}" width="512" height="512"/>
</svg>
"""
    (OUT / "exora-ICON-square-512.svg").write_text(svg)

    mono = """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="currentColor">
  <text x="256" y="298" text-anchor="middle" font-family="Orbitron, 'Space Grotesk', Impact, sans-serif"
        font-size="130" font-weight="900" letter-spacing="10">EXORA</text>
  <text x="256" y="352" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif"
        font-size="26" font-weight="600" letter-spacing="8" opacity=".72">CRYPTO EXCHANGE</text>
  <rect x="176" y="176" width="160" height="8"/>
  <rect x="176" y="384" width="160" height="8"/>
</svg>
"""
    (OUT / "exora-ICON-mono-512.svg").write_text(mono)
    print("icon+svg OK")


if __name__ == "__main__":
    build_avatar()
    build_cover()
    build_svg_and_icon()
    print("\nDONE →", OUT)
