#!/usr/bin/env python3
"""
OKO packaging asset generator.
Generates store-ready icons and splash screens for Android, iOS, desktop and PWA
from the brand master logo. Brand: black background + lime #9AFF00 mark.

Source of truth for the mark:  oko-app/brand/oko-logo-master-transparent.png (1000x1000 RGBA)
Run:  python3 packaging/scripts/gen-assets.py
All output goes to packaging/icons/* and packaging/splash/*.
Idempotent — safe to re-run.
"""
import os, json
from PIL import Image

# ---- paths -----------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
PKG  = os.path.abspath(os.path.join(HERE, ".."))          # packaging/
BRAND = os.path.abspath(os.path.join(PKG, "..", "brand")) # oko-app/brand
MARK_PATH = os.path.join(BRAND, "oko-logo-master-transparent.png")

BLACK = (0, 0, 0, 255)
LIME  = (154, 255, 0, 255)   # #9AFF00 (reference, mark already colored)

ICONS = os.path.join(PKG, "icons")
SPLASH = os.path.join(PKG, "splash")

def outdir(*p):
    d = os.path.join(*p)
    os.makedirs(d, exist_ok=True)
    return d

# ---- helpers ---------------------------------------------------------------
_mark_cache = None
def mark():
    """Return the trimmed logo mark as RGBA (tight bounding box)."""
    global _mark_cache
    if _mark_cache is None:
        im = Image.open(MARK_PATH).convert("RGBA")
        bbox = im.getbbox()
        _mark_cache = im.crop(bbox) if bbox else im
    return _mark_cache.copy()

def fit_mark(canvas_size, coverage):
    """Return the mark resized so its longest side == canvas_size*coverage."""
    m = mark()
    target = int(canvas_size * coverage)
    w, h = m.size
    scale = target / max(w, h)
    return m.resize((max(1, int(w*scale)), max(1, int(h*scale))), Image.LANCZOS)

def compose(canvas_size, coverage, bg=BLACK, transparent=False):
    """Square canvas with centered mark. bg ignored if transparent."""
    base = Image.new("RGBA", (canvas_size, canvas_size),
                     (0, 0, 0, 0) if transparent else bg)
    m = fit_mark(canvas_size, coverage)
    x = (canvas_size - m.size[0]) // 2
    y = (canvas_size - m.size[1]) // 2
    base.alpha_composite(m, (x, y))
    return base

def flatten(img, bg=BLACK):
    """Remove alpha -> opaque RGB (required for iOS icons)."""
    b = Image.new("RGBA", img.size, bg)
    b.alpha_composite(img)
    return b.convert("RGB")

def circle_mask(img):
    from PIL import ImageDraw
    mask = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, img.size[0]-1, img.size[1]-1], fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out

def save_png(img, path):
    img.save(path, "PNG")
    return path

# ---------------------------------------------------------------------------
# 1) PWA icons (mirror what the site already serves, plus extras)
# ---------------------------------------------------------------------------
def gen_pwa():
    d = outdir(ICONS, "pwa")
    for s in (72, 96, 128, 144, 152, 192, 256, 384, 512):
        save_png(compose(s, 0.74, transparent=True).convert("RGBA"),
                 os.path.join(d, f"oko-icon-{s}.png"))
    # maskable: mark must live inside the 80% safe circle -> coverage ~0.56 on black
    for s in (192, 512):
        save_png(compose(s, 0.56, bg=BLACK), os.path.join(d, f"oko-maskable-{s}.png"))
    print("PWA icons ->", d)

# ---------------------------------------------------------------------------
# 2) Android
# ---------------------------------------------------------------------------
def gen_android():
    d = outdir(ICONS, "android")
    # Play Store hi-res icon 512x512 (32-bit PNG with alpha allowed)
    save_png(compose(512, 0.66, bg=BLACK), os.path.join(d, "play-store-icon-512.png"))

    # Adaptive icon layers (108dp). xxxhdpi -> 432px. Safe zone = center 66%.
    afg = outdir(d, "adaptive")
    # foreground: transparent, mark inside safe zone (coverage ~0.42 of full 432)
    save_png(compose(432, 0.42, transparent=True), os.path.join(afg, "ic_launcher_foreground.png"))
    # background: solid brand black
    bg = Image.new("RGBA", (432, 432), BLACK)
    save_png(bg, os.path.join(afg, "ic_launcher_background.png"))
    # monochrome (Android 13 themed icon): white silhouette-ish -> use mark alpha as white
    m = fit_mark(432, 0.42)
    mono = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
    white = Image.new("RGBA", m.size, (255, 255, 255, 0))
    white.putalpha(m.split()[3])
    mono.alpha_composite(white, ((432-m.size[0])//2, (432-m.size[1])//2))
    save_png(mono, os.path.join(afg, "ic_launcher_monochrome.png"))

    # Legacy mipmap square + round per density
    dens = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for name, px in dens.items():
        dd = outdir(d, "mipmap-" + name)
        sq = compose(px, 0.70, bg=BLACK)
        save_png(sq, os.path.join(dd, "ic_launcher.png"))
        save_png(circle_mask(compose(px, 0.66, bg=BLACK)),
                 os.path.join(dd, "ic_launcher_round.png"))
    print("Android icons ->", d)

# ---------------------------------------------------------------------------
# 3) iOS AppIcon.appiconset (opaque, no alpha)
# ---------------------------------------------------------------------------
def gen_ios():
    d = outdir(ICONS, "ios", "AppIcon.appiconset")
    # (size_pt, scale) -> filename & pixel size
    specs = [
        (20, 2, "icon-20@2x.png"), (20, 3, "icon-20@3x.png"),
        (29, 2, "icon-29@2x.png"), (29, 3, "icon-29@3x.png"),
        (40, 2, "icon-40@2x.png"), (40, 3, "icon-40@3x.png"),
        (60, 2, "icon-60@2x.png"), (60, 3, "icon-60@3x.png"),
        # iPad
        (20, 1, "icon-20.png"), (29, 1, "icon-29.png"),
        (40, 1, "icon-40.png"), (76, 1, "icon-76.png"),
        (76, 2, "icon-76@2x.png"), (83.5, 2, "icon-83.5@2x.png"),
    ]
    made = {}
    for pt, sc, fn in specs:
        px = int(round(pt * sc))
        img = flatten(compose(px, 0.66, bg=BLACK))
        img.save(os.path.join(d, fn), "PNG")
        made[fn] = px
    # marketing 1024 (no alpha)
    flatten(compose(1024, 0.66, bg=BLACK)).save(os.path.join(d, "icon-1024.png"), "PNG")

    contents = {"images": [], "info": {"version": 1, "author": "xcode"}}
    def add(size, scale, fn, idiom):
        contents["images"].append({
            "size": f"{size}x{size}", "idiom": idiom,
            "filename": fn, "scale": f"{scale}x"})
    add("20","2","icon-20@2x.png","iphone"); add("20","3","icon-20@3x.png","iphone")
    add("29","2","icon-29@2x.png","iphone"); add("29","3","icon-29@3x.png","iphone")
    add("40","2","icon-40@2x.png","iphone"); add("40","3","icon-40@3x.png","iphone")
    add("60","2","icon-60@2x.png","iphone"); add("60","3","icon-60@3x.png","iphone")
    add("20","1","icon-20.png","ipad");      add("20","2","icon-20@2x.png","ipad")
    add("29","1","icon-29.png","ipad");      add("29","2","icon-29@2x.png","ipad")
    add("40","1","icon-40.png","ipad");      add("40","2","icon-40@2x.png","ipad")
    add("76","1","icon-76.png","ipad");      add("76","2","icon-76@2x.png","ipad")
    add("83.5","2","icon-83.5@2x.png","ipad")
    contents["images"].append({"size":"1024x1024","idiom":"ios-marketing",
                               "filename":"icon-1024.png","scale":"1x"})
    with open(os.path.join(d, "Contents.json"), "w") as f:
        json.dump(contents, f, indent=2)
    print("iOS AppIcon set ->", d)

# ---------------------------------------------------------------------------
# 4) Desktop icons (.png set, .ico, .icns)
# ---------------------------------------------------------------------------
def gen_desktop():
    d = outdir(ICONS, "desktop")
    sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
    pngs = {}
    for s in sizes:
        img = compose(s, 0.72, bg=BLACK)
        p = os.path.join(d, f"icon-{s}.png")
        save_png(img, p)
        pngs[s] = img
    # Tauri conventional names
    save_png(pngs[32], os.path.join(d, "32x32.png"))
    save_png(pngs[128], os.path.join(d, "128x128.png"))
    save_png(compose(256, 0.72, bg=BLACK), os.path.join(d, "128x128@2x.png"))
    save_png(pngs[512], os.path.join(d, "icon.png"))  # generic 512 source
    # Windows .ico (multi-resolution)
    ico_src = compose(256, 0.72, bg=BLACK).convert("RGBA")
    ico_src.save(os.path.join(d, "icon.ico"), format="ICO",
                 sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
    # macOS .icns
    try:
        icns_src = compose(1024, 0.72, bg=BLACK).convert("RGBA")
        icns_src.save(os.path.join(d, "icon.icns"), format="ICNS")
    except Exception as e:
        print("  ICNS write failed (", e, ") - use `iconutil`/`tauri icon` on a Mac")
    # copy the ready icons into tauri/icons too
    td = outdir(PKG, "desktop", "tauri", "icons")
    for fn in ("32x32.png", "128x128.png", "128x128@2x.png", "icon.png",
               "icon.ico", "icon.icns"):
        src = os.path.join(d, fn)
        if os.path.exists(src):
            Image.open(src).save(os.path.join(td, fn)) if fn.endswith(".png") else \
                __import__("shutil").copyfile(src, os.path.join(td, fn))
    print("Desktop icons ->", d, "and", td)

# ---------------------------------------------------------------------------
# 5) Splash screens (black bg + centered mark)
# ---------------------------------------------------------------------------
def gen_splash():
    d = outdir(SPLASH)
    def splash(w, h, name, coverage=0.34):
        base = Image.new("RGBA", (w, h), BLACK)
        side = min(w, h)
        m = mark()
        target = int(side * coverage)
        sc = target / max(m.size)
        m2 = m.resize((int(m.size[0]*sc), int(m.size[1]*sc)), Image.LANCZOS)
        base.alpha_composite(m2, ((w-m2.size[0])//2, (h-m2.size[1])//2))
        base.convert("RGB").save(os.path.join(d, name), "PNG")
    # Capacitor / universal
    splash(2732, 2732, "splash-2732x2732.png", 0.28)   # Capacitor default (universal)
    splash(1080, 1920, "splash-portrait-1080x1920.png")
    splash(1920, 1080, "splash-landscape-1920x1080.png")
    splash(1284, 2778, "splash-ios-portrait-1284x2778.png")   # iPhone Pro Max
    splash(2778, 1284, "splash-ios-landscape-2778x1284.png")
    splash(1242, 2688, "splash-portrait-1242x2688.png")
    # Android 12+ splash icon (centered, <=  ~240dp). Provide a 960x960 icon-only.
    save_png(compose(960, 0.42, bg=BLACK), os.path.join(d, "android12-splash-icon-960.png"))
    print("Splash ->", d)

if __name__ == "__main__":
    print("mark source:", MARK_PATH, "->", mark().size)
    gen_pwa(); gen_android(); gen_ios(); gen_desktop(); gen_splash()
    print("DONE")
