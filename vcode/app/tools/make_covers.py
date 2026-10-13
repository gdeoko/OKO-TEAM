# -*- coding: utf-8 -*-
"""Обложки курсов V.CODE: вёрстка + рендер Chromium. Бесплатно, без API.

    python3 tools/make_covers.py

Когда рубильник завода снят, те же обложки можно пересобрать генерацией:
смотри tools/covers_prompts.md — там готовые промпты под APIMODELS.
"""
import os, sys
from playwright.sync_api import sync_playwright

ВЫХОД = os.path.join(os.path.dirname(__file__), "..", "public_html", "assets", "img")
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

ОБЛОЖКИ = [
    ("course-creator.jpg", "КОНТЕНТ-КРЕАТОР", "съёмка · монтаж · заказы",
     "#7C5CFF", "#22D3EE", "camera"),
    ("course-ai.jpg", "МОНТАЖ С НЕЙРОСЕТЯМИ", "конвейер роликов на автомате",
     "#22D3EE", "#7C5CFF", "chip"),
    ("og.jpg", "V.CODE", "школа контент-креаторов и биржа заказов",
     "#7C5CFF", "#22D3EE", "play"),
]

ЗНАКИ = {
  "camera": """<rect x='18' y='40' width='124' height='88' rx='18'/>
    <circle cx='80' cy='84' r='27'/><path d='M56 40l10-18h28l10 18'/>""",
  "chip": """<rect x='34' y='34' width='92' height='92' rx='16'/>
    <rect x='62' y='62' width='36' height='36' rx='8'/>
    <path d='M80 34V14M80 146v-20M34 80H14M146 80h-20M52 34V18M108 34V18M52 146v-16M108 146v-16'/>""",
  "play": """<circle cx='80' cy='80' r='58'/><path d='M66 54l48 26-48 26z'/>""",
}

ШАБЛОН = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1600px; height:900px; background:#08090C; overflow:hidden;
         font-family:'Inter',sans-serif; position:relative; }
  .grid { position:absolute; inset:0;
    background-image:linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
                     linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
    background-size:64px 64px; mask-image:radial-gradient(90%% 90%% at 30%% 40%%, #000 20%%, transparent 75%%); }
  .glow1 { position:absolute; width:900px; height:900px; left:-220px; top:-280px; border-radius:50%%;
    background:radial-gradient(circle, %(c1)s55 0%%, transparent 62%%); filter:blur(14px); }
  .glow2 { position:absolute; width:760px; height:760px; right:-180px; bottom:-300px; border-radius:50%%;
    background:radial-gradient(circle, %(c2)s4D 0%%, transparent 62%%); filter:blur(14px); }
  .beam { position:absolute; right:140px; top:-200px; width:280px; height:1400px;
    background:linear-gradient(180deg, %(c2)s33, transparent 70%%); transform:rotate(18deg); filter:blur(28px); }
  .mark { position:absolute; right:92px; top:78px; width:160px; height:160px; opacity:.92; }
  .mark svg { width:100%%; height:100%%; }
  .wrap { position:absolute; left:92px; bottom:104px; max-width:1060px; }
  .kicker { font-size:21px; letter-spacing:.42em; text-transform:uppercase;
    color:%(c1)s; margin-bottom:26px; font-weight:500; }
  h1 { font-family:'Unbounded',sans-serif; font-weight:800; font-size:%(size)spx;
    line-height:.96; letter-spacing:-.03em; color:#F4F6FB; text-wrap:balance;
    text-shadow:0 12px 60px rgba(0,0,0,.8); }
  h1 em { font-style:normal; background:linear-gradient(100deg,%(c1)s,%(c2)s);
    -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
  .sub { margin-top:26px; font-size:30px; color:#9AA3B2; letter-spacing:.01em; }
  .line { position:absolute; left:92px; bottom:72px; width:1416px; height:2px;
    background:linear-gradient(90deg,%(c1)s,%(c2)s,transparent); opacity:.65; }
  .corner { position:absolute; border-color:%(c1)s; border-style:solid; width:58px; height:58px; opacity:.55; }
  .c1 { left:48px; top:48px; border-width:2px 0 0 2px; }
  .c2 { right:48px; top:48px; border-width:2px 2px 0 0; }
  .c3 { left:48px; bottom:48px; border-width:0 0 2px 2px; }
  .c4 { right:48px; bottom:48px; border-width:0 2px 2px 0; }
  .noise { position:absolute; inset:0; opacity:.05;
    background-image:url("data:image/svg+xml,%%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%%3E%%3Cfilter id='n'%%3E%%3CfeTurbulence baseFrequency='.9'/%%3E%%3C/filter%%3E%%3Crect width='120' height='120' filter='url(%%23n)'/%%3E%%3C/svg%%3E"); }
</style></head><body>
  <div class="grid"></div><div class="glow1"></div><div class="glow2"></div><div class="beam"></div>
  <div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div>
  <div class="mark"><svg viewBox="0 0 160 160" fill="none" stroke="%(c1)s" stroke-width="7"
      stroke-linecap="round" stroke-linejoin="round">%(znak)s</svg></div>
  <div class="wrap">
    <div class="kicker">V.CODE · академия</div>
    <h1>%(title)s</h1>
    <div class="sub">%(sub)s</div>
  </div>
  <div class="line"></div>
  <div class="noise"></div>
</body></html>"""


def главное():
    out = os.path.abspath(ВЫХОД)
    os.makedirs(out, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        pg = b.new_context(viewport={"width": 1600, "height": 900},
                           device_scale_factor=1).new_page()
        for имя, титул, под, c1, c2, знак in ОБЛОЖКИ:
            слова = титул.split()
            if len(слова) > 1:
                титул_html = " ".join(слова[:-1]) + " <em>" + слова[-1] + "</em>"
            else:
                титул_html = "<em>%s</em>" % титул
            размер = 104 if len(титул) > 16 else 128
            pg.set_content(ШАБЛОН % {"c1": c1, "c2": c2, "title": титул_html,
                                     "sub": под, "znak": ЗНАКИ[знак], "size": размер})
            pg.wait_for_timeout(1200)
            путь = os.path.join(out, имя)
            pg.screenshot(path=путь, type="jpeg", quality=92)
            print("готово:", путь)
        b.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(главное())
