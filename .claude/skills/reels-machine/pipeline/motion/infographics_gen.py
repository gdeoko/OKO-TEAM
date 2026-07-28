#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V.CODE — генератор АНИМИРОВАННОЙ инфографики кодом (по смыслу, каждые 3-4с, всегда разная).
Строит HTML+CSS-анимацию под смысл сегмента, рендерит через overlay_render в прозрачную PNG-секвенцию.
Стили НЕ повторять внутри ролика: big_number / badge / checklist / bar / tag / underline.
Позиция по умолчанию — верхняя/средняя зона (субтитры внизу y~1560, не перекрывать).

  from infographics_gen import overlay_html, STYLES
  html = overlay_html("big_number", {"num":"80%","label":"смотрят без звука"})
  render_overlay(html, out_dir, dur, fps)   # из overlay_render
"""
FONT = "Montserrat, 'Soyuz Grotesk', Arial, sans-serif"
AC = "#EA5920"       # бренд-оранж
WH = "#FFFFFF"

def _shell(body, extra_css=""):
    return f"""<!doctype html><html><head><meta charset=utf-8><style>
*{{margin:0;padding:0;box-sizing:border-box;font-family:{FONT};}}
html,body{{width:1080px;height:1920px;background:transparent;overflow:hidden;}}
.wrap{{position:absolute;width:1080px;height:1920px;}}
@keyframes popIn{{0%{{opacity:0;transform:scale(.4)}}60%{{opacity:1;transform:scale(1.12)}}100%{{opacity:1;transform:scale(1)}}}}
@keyframes slideL{{0%{{opacity:0;transform:translateX(-140px)}}100%{{opacity:1;transform:translateX(0)}}}}
@keyframes slideU{{0%{{opacity:0;transform:translateY(60px)}}100%{{opacity:1;transform:translateY(0)}}}}
@keyframes fadeOut{{0%,80%{{opacity:1}}100%{{opacity:0}}}}
@keyframes grow{{0%{{width:0}}100%{{width:var(--w)}}}}
@keyframes glow{{0%,100%{{filter:drop-shadow(0 0 18px rgba(234,89,32,.6))}}50%{{filter:drop-shadow(0 0 40px rgba(234,89,32,.95))}}}}
{extra_css}
</style></head><body><div class="wrap">{body}</div></body></html>"""

def big_number(d):
    y = d.get("y", 560)
    body = f"""<div style="position:absolute;top:{y}px;left:0;width:1080px;text-align:center;
      animation:popIn .55s cubic-bezier(.2,1.3,.4,1) both, glow 2.2s ease-in-out .55s infinite">
      <div style="font-size:220px;font-weight:900;color:{AC};line-height:.9;text-shadow:0 8px 30px rgba(0,0,0,.6)">{d['num']}</div>
      <div style="font-size:58px;font-weight:800;color:{WH};margin-top:14px;letter-spacing:1px;
        text-shadow:0 4px 16px rgba(0,0,0,.8);animation:slideU .5s ease .35s both">{d.get('label','')}</div>
    </div>"""
    return _shell(body)

def badge(d):
    y = d.get("y", 300)
    body = f"""<div style="position:absolute;top:{y}px;left:60px;
      animation:slideL .5s cubic-bezier(.2,1,.3,1) both">
      <span style="display:inline-block;background:{AC};color:#111;font-size:62px;font-weight:900;
        padding:20px 44px;border-radius:22px;box-shadow:0 10px 34px rgba(234,89,32,.55);
        text-transform:uppercase;letter-spacing:2px">{d['text']}</span></div>"""
    return _shell(body)

def checklist(d):
    items = d["items"]; y = d.get("y", 520)
    rows = ""
    for i, it in enumerate(items):
        rows += f"""<div style="display:flex;align-items:center;margin:0 0 34px 0;
          animation:slideL .5s ease {0.35+i*0.5:.2f}s both">
          <span style="width:66px;height:66px;flex:0 0 66px;border-radius:16px;background:{AC};
            color:#111;font-size:44px;font-weight:900;display:flex;align-items:center;justify-content:center;
            margin-right:26px;box-shadow:0 6px 20px rgba(234,89,32,.5)">✓</span>
          <span style="font-size:56px;font-weight:800;color:{WH};text-shadow:0 3px 14px rgba(0,0,0,.85)">{it}</span></div>"""
    return _shell(f"""<div style="position:absolute;top:{y}px;left:70px;width:940px">{rows}</div>""")

def bar_stat(d):
    y = d.get("y", 640); pct = d.get("pct", 70)
    body = f"""<div style="position:absolute;top:{y}px;left:80px;width:920px;animation:slideU .5s ease both">
      <div style="font-size:56px;font-weight:900;color:{WH};margin-bottom:22px;text-shadow:0 3px 14px rgba(0,0,0,.85)">{d.get('label','')}</div>
      <div style="width:920px;height:46px;background:rgba(255,255,255,.16);border-radius:24px;overflow:hidden">
        <div style="--w:{pct}%;height:46px;background:{AC};border-radius:24px;
          animation:grow 1.1s cubic-bezier(.2,.9,.2,1) .3s both;box-shadow:0 0 24px rgba(234,89,32,.7)"></div></div>
      <div style="font-size:120px;font-weight:900;color:{AC};margin-top:10px;animation:popIn .5s ease .9s both">{pct}%</div></div>"""
    return _shell(body)

def corner_tag(d):
    body = f"""<div style="position:absolute;top:180px;right:56px;animation:popIn .5s ease both, glow 2s ease-in-out .5s infinite">
      <div style="background:rgba(17,17,17,.82);border:3px solid {AC};border-radius:22px;padding:20px 30px;text-align:center">
        <div style="font-size:92px;font-weight:900;color:{AC};line-height:1">{d['num']}</div>
        <div style="font-size:34px;font-weight:800;color:{WH};letter-spacing:1px">{d.get('label','')}</div></div></div>"""
    return _shell(body)

def underline_word(d):
    y = d.get("y", 430)
    body = f"""<div style="position:absolute;top:{y}px;left:0;width:1080px;text-align:center;animation:slideU .45s ease both">
      <span style="position:relative;font-size:104px;font-weight:900;color:{WH};text-shadow:0 5px 20px rgba(0,0,0,.85)">
        {d['word']}
        <span style="position:absolute;left:0;bottom:-14px;height:16px;background:{AC};border-radius:8px;
          --w:100%;width:0;animation:grow .6s ease .3s both;display:block"></span></span></div>"""
    return _shell(body)

STYLES = {"big_number":big_number,"badge":badge,"checklist":checklist,
          "bar":bar_stat,"tag":corner_tag,"underline":underline_word}

def overlay_html(style, data):
    return STYLES[style](data)

if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(__file__))
    from overlay_render import render_overlay
    style = sys.argv[1] if len(sys.argv) > 1 else "big_number"
    import json
    data = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {"num":"80%","label":"смотрят без звука"}
    out = sys.argv[3] if len(sys.argv) > 3 else "/tmp/ovl"
    dur = float(sys.argv[4]) if len(sys.argv) > 4 else 3.0
    html = overlay_html(style, data)
    open(os.path.join("/tmp","_ov.html"),"w").write(html)
    frames = render_overlay(html, out, dur, 30)
    print(f"{style}: {len(frames)} кадров -> {out}")
