#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Автономная обложка БЕЗ коннектора Higgsfield: фон рисует FLUX.1-schnell (HF ZeroGPU,
gradio_client, нужен HF_TOKEN), крупный русский заголовок композитится PIL шрифтом Союз Гротекс.
Обложка потом идёт ПЕРВЫМ КАДРОМ ролика.

  python cover_flux.py "ЗАГОЛОВОК|СТРОКА2" out.jpg --accent EA5920 --font path.ttf --scene "dark dev studio"
"""
import os, sys, shutil, argparse
from PIL import Image, ImageDraw, ImageFont
W,H=1080,1920
SPACES=["black-forest-labs/FLUX.1-schnell","black-forest-labs/FLUX.1-dev"]

def flux_bg(scene, out_png):
    from gradio_client import Client, handle_file  # noqa
    prompt=(f"cinematic vertical 9:16 poster background, {scene}, glowing orange neon accents, "
            "dark moody, volumetric haze, high detail, no text, no letters, orange and deep blue")
    last=None
    for sp in SPACES:
        try:
            c=Client(sp, token=os.environ.get("HF_TOKEN"), verbose=False)
            r=c.predict(prompt=prompt, seed=0, randomize_seed=True, width=768, height=1344,
                        num_inference_steps=4, api_name="/infer")
            p=r[0] if isinstance(r,(list,tuple)) else r
            if isinstance(p,dict): p=p.get("path") or p.get("url")
            shutil.copy(p, out_png); return True
        except Exception as e:
            last=e; continue
    sys.stderr.write(f"[flux fail: {last}]\n"); return False

def compose(title, out_jpg, accent, font_path, scene):
    bg=os.path.join(os.path.dirname(out_jpg) or ".","_bg.png")
    if flux_bg(scene, bg) and os.path.exists(bg):
        im=Image.open(bg).convert("RGB").resize((W,H))
    else:
        im=Image.new("RGB",(W,H),(10,10,12))  # фолбэк-фон
    # затемняющий градиент под текст
    ov=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(ov)
    d.rectangle([0,int(H*0.30),W,int(H*0.72)],fill=(0,0,0,120))
    im=Image.alpha_composite(im.convert("RGBA"),ov).convert("RGB")
    d=ImageDraw.Draw(im)
    ac=tuple(int(accent[i:i+2],16) for i in (0,2,4))
    lines=title.split("|"); y=int(H*0.34); MAXW=W-120
    for k,ln in enumerate(lines):
        sz=140
        while sz>60:
            f=ImageFont.truetype(font_path, sz)
            if d.textbbox((0,0),ln,font=f)[2]<=MAXW: break
            sz-=6
        w=d.textbbox((0,0),ln,font=f)[2]
        col=(255,255,255) if k==0 else ac
        d.text(((W-w)//2,y),ln,font=f,fill=col); y+=int(sz*1.18)
    fb=ImageFont.truetype(font_path,64)
    d.text(((W-d.textbbox((0,0),"V.CODE",font=fb)[2])//2,H-190),"V.CODE",font=fb,fill=ac)
    im.save(out_jpg,quality=92)
    return out_jpg

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("title"); ap.add_argument("out")
    ap.add_argument("--accent",default="EA5920"); ap.add_argument("--font",required=True)
    ap.add_argument("--scene",default="dark developer workspace, neural network, code on monitors")
    a=ap.parse_args(); compose(a.title,a.out,a.accent,a.font,a.scene); print("обложка:",a.out)

if __name__=="__main__": main()
