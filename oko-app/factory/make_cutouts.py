# -*- coding: utf-8 -*-
# Вырезки для роликов: rembg по объект-исходникам + мягкая тень/муть под вырезкой (бриф).
# Вход objsrc/{R}_obj{n}.jpg -> cutouts2/{R}/c{n}.png (RGBA, тень уже впечена, фон прозрачный).
import os, sys, glob
from PIL import Image, ImageFilter, ImageChops
from rembg import remove, new_session
ROOT="/home/user/OKO-TEAM/oko-app/factory"
SESS=new_session("u2net")

def cutout(src, dst, target_h=900):
    im=Image.open(src).convert("RGB")
    rgba=remove(im, session=SESS, post_process_mask=True).convert("RGBA")
    # обрезаем по bbox альфы
    a=rgba.split()[3]; bbox=a.getbbox()
    if bbox: rgba=rgba.crop(bbox)
    # нормируем высоту
    w,h=rgba.size; scale=target_h/h
    rgba=rgba.resize((max(1,int(w*scale)), target_h), Image.LANCZOS)
    w,h=rgba.size
    # холст с запасом под тень
    pad=90; W=w+pad*2; H=h+pad*2
    canvas=Image.new("RGBA",(W,H),(0,0,0,0))
    # тень: чёрный силуэт из альфы, размытие, смещение вниз, полупрозрачно
    alpha=rgba.split()[3]
    shadow=Image.new("RGBA",(W,H),(0,0,0,0))
    sil=Image.new("RGBA",(w,h),(0,0,0,150))
    sil.putalpha(ImageChops.multiply(alpha, Image.new("L",(w,h),150)))
    shadow.paste(sil,(pad+10,pad+26),sil)
    shadow=shadow.filter(ImageFilter.GaussianBlur(22))
    # амбер-ореол (rim-halo): расширяем силуэт, заливаем амбером, размываем — объект читается на любом фоне
    halo=Image.new("RGBA",(W,H),(0,0,0,0))
    hm=Image.new("L",(W,H),0)
    hmo=Image.new("L",(w,h),255); hmo=ImageChops.multiply(hmo, alpha)
    hm.paste(hmo,(pad,pad))
    hm=hm.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(16))
    amber=Image.new("RGBA",(W,H),(234,89,32,255)); amber.putalpha(hm.point(lambda v:int(v*0.85)))
    out=Image.alpha_composite(canvas, shadow)
    out=Image.alpha_composite(out, amber)
    out.alpha_composite(rgba,(pad,pad))
    out.save(dst)
    return out.size

if __name__=="__main__":
    reels=sys.argv[1:] or ["R1","R2","R3","R4","R5"]
    for R in reels:
        os.makedirs(f"{ROOT}/cutouts2/{R}", exist_ok=True)
        srcs=sorted(glob.glob(f"{ROOT}/objsrc/{R}_obj*.jpg"))
        for i,s in enumerate(srcs):
            dst=f"{ROOT}/cutouts2/{R}/c{i+1}.png"
            try:
                sz=cutout(s,dst); print(R,f"c{i+1}",sz,flush=True)
            except Exception as e:
                print(R,f"c{i+1}","ERR",repr(e)[:120],flush=True)
    print("CUTOUTS_DONE")
