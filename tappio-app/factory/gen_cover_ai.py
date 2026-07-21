#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI-ОБЛОЖКА ролика: фон через Pollinations FLUX (connector-free, без ключей) +
брендовый текст поверх (kicker/top/big + акцент + логотип). Уникальный сид на ролик.
Если сеть/картинка не удались — молча выходим, build4 берёт HTML-обложку (fallback).

Использование: python3 gen_cover_ai.py <script.json> <workdir>
Пишет <workdir>/cover_ai.png и проставляет script["cover"]["ai"] = путь.
"""
import json, os, sys, hashlib, urllib.parse, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "assets", "fonts")
LOGOS = os.path.join(HERE, "assets", "logos")
CA = "/root/.ccr/ca-bundle.crt"
W, H = 1080, 1920

# тематический промпт фона под приложение (+ цвет бренда для когезии)
THEME = {
 "spy": "cinematic dark hotel bedroom at night, tiny hidden surveillance camera lens glinting on the wall, {c} teal cyan neon rim light, moody thriller atmosphere, deep shadows, ultra detailed, photographic",
 "brain": "abstract glowing human brain made of neural connections and synapses, {c} violet purple neon energy, dark cinematic background, particles, depth, ultra detailed 3d render",
 "tape": "modern empty living room with warm sunlight, subtle glowing AR measurement lines and markers on the floor and walls, {c} golden amber accent light, architectural, clean, cinematic, ultra detailed",
}

def font(name, size):
    for f in (name, "Syne-Extra.ttf", "Orbitron-Bold.ttf"):
        p = os.path.join(FONTS, f)
        if os.path.exists(p):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
    return ImageFont.load_default()

def hexrgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def fetch_bg(prompt, seed, out):
    enc = urllib.parse.quote(prompt)
    url = f"https://image.pollinations.ai/prompt/{enc}?width=1080&height=1920&nologo=true&model=flux&seed={seed}"
    for _ in range(2):
        r = subprocess.run(["curl", "-s", "-o", out, "--cacert", CA, "-m", "150", url],
                           capture_output=True)
        if os.path.exists(out) and os.path.getsize(out) > 25000:
            try:
                Image.open(out).verify(); return True
            except Exception: pass
    return False

def fit_text(draw, text, fnt_path, maxw, start, minsz=48):
    s = start
    while s > minsz:
        f = font(fnt_path, s)
        if draw.textlength(text, font=f) <= maxw: return f
        s -= 4
    return font(fnt_path, minsz)

def main():
    S = sys.argv[1]; WD = sys.argv[2]
    d = json.load(open(S))
    app = d.get("app", "spy")
    cov = d.get("cover", {})
    acc = d["brand"].get("accent", "#00D9FF")
    acc2 = d["brand"].get("accent2", acc)
    name = d["brand"].get("name", "")
    logo = d["brand"].get("logo", f"{app}.png")
    rid = d.get("id", "x")
    seed = int(hashlib.md5(rid.encode()).hexdigest()[:8], 16) % 999999

    bg = os.path.join(WD, "cover_bg.jpg")
    prompt = THEME.get(app, THEME["spy"]).format(c=acc)
    if not fetch_bg(prompt, seed, bg):
        print("COVER_AI skip (no bg)"); return

    im = Image.open(bg).convert("RGB").resize((W, H), Image.LANCZOS)
    # затемнение + виньетка сверху/снизу для читаемости текста
    ov = Image.new("L", (W, H), 0)
    dd = ImageDraw.Draw(ov)
    for y in range(H):
        a = 165 if y < H*0.42 else (150 if y > H*0.7 else 60)
        dd.line([(0, y), (W, y)], fill=a)
    black = Image.new("RGB", (W, H), (3, 5, 8))
    im = Image.composite(black, im, ov)
    dr = ImageDraw.Draw(im)
    A = hexrgb(acc)

    # KICKER (капсула)
    kick = (cov.get("kicker", "") or "").upper()
    if kick:
        kf = font("DMMono-Medium.ttf", 46)
        tw = dr.textlength(kick, font=kf)
        x0, y0 = 70, 150
        dr.rounded_rectangle([x0, y0, x0+tw+70, y0+86], radius=43, outline=A, width=4)
        dr.text((x0+35, y0+18), kick, font=kf, fill=A)

    # TOP (подзаголовок)
    top = (cov.get("top", "") or "").upper()
    if top:
        tf = fit_text(dr, top, "Montserrat-900.ttf" if os.path.exists(os.path.join(FONTS,"montserrat-v31-cyrillic_latin-900.ttf")) else "Orbitron-Bold.ttf", W-140, 76)
        # использовать реальный montserrat 900
        mp = os.path.join(FONTS, "montserrat-v31-cyrillic_latin-900.ttf")
        if os.path.exists(mp): tf = ImageFont.truetype(mp, 76) if dr.textlength(top, font=ImageFont.truetype(mp,76))<=W-140 else fit_text(dr,top,None,W-140,76)
        dr.text((70, 300), top, font=tf, fill=A)

    # BIG (главный заголовок, огромный, со свечением)
    big_lines = (cov.get("big", "") or "").split("\n")
    y = 390
    syne = os.path.join(FONTS, "Syne-Extra.ttf")
    for line in big_lines:
        lt = line.upper().strip()
        if not lt: continue
        bf = ImageFont.truetype(syne, 150) if os.path.exists(syne) else font(None, 150)
        while dr.textlength(lt, font=bf) > W-90 and bf.size > 70:
            bf = ImageFont.truetype(syne, bf.size-6) if os.path.exists(syne) else font(None, bf.size-6)
        # свечение
        glow = Image.new("RGBA", (W, H), (0,0,0,0)); gd = ImageDraw.Draw(glow)
        gd.text((70, y), lt, font=bf, fill=(A[0],A[1],A[2],180))
        glow = glow.filter(ImageFilter.GaussianBlur(14))
        im = Image.alpha_composite(im.convert("RGBA"), glow).convert("RGB")
        dr = ImageDraw.Draw(im)
        dr.text((70, y), lt, font=bf, fill=(255,255,255))
        y += bf.size + 8

    # акцентная линия
    dr.rectangle([70, y+18, 70+220, y+30], fill=A)

    # логотип/бренд снизу
    lp = os.path.join(LOGOS, logo)
    if os.path.exists(lp):
        try:
            lg = Image.open(lp).convert("RGBA"); r = 120/lg.height
            lg = lg.resize((int(lg.width*r), 120), Image.LANCZOS)
            im.paste(lg, (70, H-210), lg)
        except Exception: pass
    if name:
        nf = font("Montserrat-900.ttf", 40)
        mp = os.path.join(FONTS, "montserrat-v31-cyrillic_latin-700.ttf")
        if os.path.exists(mp): nf = ImageFont.truetype(mp, 40)
        dr.text((70, H-70), name, font=nf, fill=(255,255,255))

    out = os.path.join(WD, "cover_ai.png")
    im.save(out)
    d.setdefault("cover", {})["ai"] = out
    json.dump(d, open(S, "w"), ensure_ascii=False, indent=1)
    print("COVER_AI ok ->", out)

if __name__ == "__main__":
    try: main()
    except Exception as e:
        print("COVER_AI error:", str(e)[:150])
