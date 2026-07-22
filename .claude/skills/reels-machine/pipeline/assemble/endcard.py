#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""КРАСИВАЯ финалка: тёмный фон + оранжевое свечение за логотипом + кнопка ПОДПИШИСЬ, fade-in.
python endcard.py out.mp4 [--logo logo_hd.png] [--dur 2.2] [--cta ПОДПИШИСЬ]"""
import os,sys,argparse,subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=1080,1920
def main():
    ap=argparse.ArgumentParser(); ap.add_argument("out")
    ap.add_argument("--logo",default="/home/user/OKO-TEAM/.claude/skills/reels-machine/logo_hd.png")
    ap.add_argument("--dur",type=float,default=2.2); ap.add_argument("--cta",default="ПОДПИШИСЬ")
    ap.add_argument("--font",default="/home/user/OKO-TEAM/.claude/skills/reels-machine/pipeline/assets/SoyuzGrotesk-Bold.ttf")
    a=ap.parse_args()
    im=Image.new("RGB",(W,H),(8,8,10))
    glow=Image.new("RGB",(W,H),(8,8,10)); gd=ImageDraw.Draw(glow)
    gd.ellipse([W//2-360,H//2-460,W//2+360,H//2+180],fill=(234,89,32))
    im=Image.blend(im,glow.filter(ImageFilter.GaussianBlur(180)),0.5).convert("RGBA")
    lg=Image.open(a.logo).convert("RGBA"); lw=760; lh=int(lg.height*lw/lg.width); lg=lg.resize((lw,lh))
    im.alpha_composite(lg,((W-lw)//2,(H-lh)//2-120)); d=ImageDraw.Draw(im)
    bw,bh=560,130; bx=(W-bw)//2; by=H//2+300
    d.rounded_rectangle([bx,by,bx+bw,by+bh],65,fill=(234,89,32))
    f=ImageFont.truetype(a.font,58); tw=d.textbbox((0,0),a.cta,font=f)[2]
    d.text((bx+(bw-tw)//2,by+34),a.cta,font=f,fill=(255,255,255))
    tmp="/tmp/_endcard.jpg"; im.convert("RGB").save(tmp,quality=94)
    subprocess.run(["ffmpeg","-y","-v","error","-loop","1","-t",f"{a.dur}","-i",tmp,
        "-vf",f"scale={W}:{H},fps=30,fade=t=in:st=0:d=0.4","-c:v","libx264","-pix_fmt","yuv420p","-r","30",a.out],check=True,timeout=60)
    print(a.out)
if __name__=="__main__": main()
