#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Анимированные наложения/инфографика через ЛОКАЛЬНЫЙ Chromium: HTML+CSS/JS → прозрачная
PNG-секвенция (детерминированный seek через Web Animations API). Каждый ролик — СВОИ overlay
(разные, не шаблон): передаёшь свой HTML. Потом секвенция композитится ffmpeg-ом на кадр.

  render_overlay(html_str, out_dir, dur=3.0, fps=30) -> out_dir/f_%04d.png (RGBA)
CLI: python overlay_render.py in.html out_dir 3.0 30
"""
import os, sys, glob
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

def render_overlay(html, out_dir, dur=3.0, fps=30, w=1080, h=1920):
    os.makedirs(out_dir, exist_ok=True)
    from playwright.sync_api import sync_playwright
    n=int(dur*fps)
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True, executable_path=CHROME,
            args=["--no-sandbox","--force-color-profile=srgb","--disable-gpu"])
        pg=b.new_page(viewport={"width":w,"height":h}, device_scale_factor=1)
        pg.emulate_media(media="screen")
        pg.set_content(html, wait_until="load")
        # прозрачный фон
        pg.evaluate("document.documentElement.style.background='transparent';document.body.style.background='transparent';document.body.style.margin='0'")
        for i in range(n):
            t=(i/fps)*1000.0
            pg.evaluate("(ms)=>{document.getAnimations().forEach(a=>{try{a.pause();a.currentTime=ms;}catch(e){}});}", t)
            pg.screenshot(path=os.path.join(out_dir,f"f_{i:04d}.png"), omit_background=True)
        b.close()
    return sorted(glob.glob(os.path.join(out_dir,"f_*.png")))

if __name__=="__main__":
    html=open(sys.argv[1]).read(); d=render_overlay(html, sys.argv[2],
        float(sys.argv[3]) if len(sys.argv)>3 else 3.0, int(sys.argv[4]) if len(sys.argv)>4 else 30)
    print("кадров:",len(d))
