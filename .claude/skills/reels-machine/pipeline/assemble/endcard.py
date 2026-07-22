#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Финалка ролика с РЕАЛЬНЫМ логотипом (не PIL-текст). Логотип по центру + CTA,
бренд-фон, лёгкая анимация. python endcard.py out.mp4 --logo logo_hd.png --dur 1.8"""
import os,sys,argparse,subprocess
from PIL import Image
W,H=1080,1920
def main():
    ap=argparse.ArgumentParser(); ap.add_argument("out")
    ap.add_argument("--logo",default="/home/user/OKO-TEAM/.claude/skills/reels-machine/logo_hd.png")
    ap.add_argument("--dur",type=float,default=1.8); ap.add_argument("--cta",default="подпишись")
    ap.add_argument("--font",default="/home/user/OKO-TEAM/.claude/skills/reels-machine/pipeline/assets/SoyuzGrotesk-Bold.ttf")
    a=ap.parse_args()
    tmp="/tmp/_end_logo.png"
    lg=Image.open(a.logo).convert("RGBA"); lw=680; lh=int(lg.height*lw/lg.width); lg=lg.resize((lw,lh))
    canvas=Image.new("RGBA",(W,H),(10,10,12,255)); canvas.alpha_composite(lg,((W-lw)//2,(H-lh)//2-60)); canvas.convert("RGB").save(tmp)
    # лёгкий зум + CTA снизу
    subprocess.run(["ffmpeg","-y","-v","error","-loop","1","-t",f"{a.dur}","-i",tmp,
        "-vf",f"scale={W}:{H},zoompan=z='min(zoom+0.0009,1.06)':d={int(a.dur*30)}:s={W}x{H},"
        f"drawtext=fontfile={a.font}:text='{a.cta}':fontcolor=0xEA5920:fontsize=60:x=(w-tw)/2:y=h-360",
        "-c:v","libx264","-pix_fmt","yuv420p","-r","30",a.out],check=True,timeout=60)
    print(a.out)
if __name__=="__main__": main()
