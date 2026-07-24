#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""РЕШЕНИЕ премиум хром/3D-стикеров (CapCut Y2K уровень) БЕСПЛАТНО:
FLUX.1-schnell (HF PRO ZeroGPU, не кредиты Higgsfield) генерит элемент на чёрном фоне
-> rembg вырезает в прозрачный PNG -> public/chrome/*.png -> ChromeSticker (fx2) анимирует
(флоат + 3D-поворот + глинт). Кастом под ОКО, безлимит.
    pip install "rembg[cpu]" onnxruntime ; export HF_TOKEN=...
    python gen_chrome.py
"""
import os, shutil
from gradio_client import Client
from rembg import remove
from PIL import Image

PROMPTS = {
 "chrome_star":"A single glossy chrome 3D five-pointed star, liquid mirror-polished silver metal with iridescent rainbow reflections and a lime green rim highlight, floating centered on a pure solid black background, Y2K aesthetic, premium studio product render, octane, 8k ultra sharp, no text",
 "chrome_ring":"A glossy chrome 3D circular emblem ring, liquid mirror-polished silver metal with lime green 9AFF00 neon reflections, floating centered on pure solid black background, premium futuristic brand mark, studio render, octane, 8k ultra sharp, no text",
 "chrome_coin":"A single glossy 3D chrome and gold coin with embossed ruble currency symbol, mirror-polished metal with lime green rim light, floating centered on pure solid black background, Y2K premium studio product render, octane, 8k ultra sharp",
 "chrome_arrow":"A single glossy chrome 3D arrow pointing upward, liquid mirror-polished silver metal with iridescent and lime green reflections, floating centered on pure solid black background, Y2K aesthetic, premium studio render, octane, 8k ultra sharp, no text",
 "chrome_diamond":"A single glossy 3D crystal diamond gemstone, iridescent holographic chrome facets with lime green and pink reflections, floating centered on pure solid black background, Y2K premium studio render, octane, 8k ultra sharp, no text",
 "liquid_blob":"A glossy chrome liquid metal abstract blob, mirror-polished mercury silver with iridescent rainbow and lime green reflections, floating centered on pure solid black background, Y2K aesthetic, premium studio render, octane, 8k ultra sharp, no text",
}

def gen(prompt, out, w=1024, h=1024):
    c = Client("black-forest-labs/FLUX.1-schnell", token=os.environ["HF_TOKEN"])
    r = c.predict(prompt, 0, True, w, h, 4, api_name="/infer")
    src = r[0] if isinstance(r,(list,tuple)) else r
    shutil.copy(src.get("path") if isinstance(src,dict) else src, out)

if __name__ == "__main__":
    os.makedirs("public/flux3d", exist_ok=True); os.makedirs("public/chrome", exist_ok=True)
    for name, p in PROMPTS.items():
        raw = f"public/flux3d/{name}.png"
        gen(p, raw)
        remove(Image.open(raw).convert("RGBA")).save(f"public/chrome/{name}.png")
        print("OK", name)
