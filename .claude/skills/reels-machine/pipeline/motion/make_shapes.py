# -*- coding: utf-8 -*- generate shape masks + brand-accent rings. python3 make_shapes.py
from PIL import Image, ImageDraw, ImageFilter
import math, os, sys
ACCENT=(234,89,32)  # #EA5920
os.makedirs('shapes',exist_ok=True)

def poly_pts(cx,cy,r,n,rot=-math.pi/2):
    return [(cx+r*math.cos(rot+2*math.pi*i/n), cy+r*math.sin(rot+2*math.pi*i/n)) for i in range(n)]

def draw_shape(d, name, W, H, inset):
    x0,y0,x1,y1=inset,inset,W-inset,H-inset; cx,cy=W/2,H/2; r=min(W,H)/2-inset
    if name=='circle': d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=255)
    elif name=='oval': d.ellipse([x0,cy-r*0.72,x1,cy+r*0.72],fill=255)
    elif name=='hexagon': d.polygon(poly_pts(cx,cy,r,6,0),fill=255)
    elif name=='pentagon': d.polygon(poly_pts(cx,cy,r,5),fill=255)
    elif name=='diamond': d.polygon([(cx,y0),(x1,cy),(cx,y1),(x0,cy)],fill=255)
    elif name=='roundsquare': d.rounded_rectangle([x0,y0,x1,y1],radius=int(min(W,H)*0.18),fill=255)
    elif name=='rrect': d.rounded_rectangle([x0,y0,x1,y1],radius=int(min(W,H)*0.06),fill=255)
    elif name=='arch': d.rounded_rectangle([x0,cy,x1,y1],radius=6,fill=255); d.pieslice([x0,y0,x1,y0+(cy-y0)*2],180,360,fill=255)
    elif name=='tv': d.rounded_rectangle([x0,y0,x1,y1],radius=int(min(W,H)*0.10),fill=255)
    elif name=='parallelogram': sk=W*0.18; d.polygon([(x0+sk,y0),(x1,y0),(x1-sk,y1),(x0,y1)],fill=255)
    elif name=='tilt': d.rounded_rectangle([x0,y0,x1,y1],radius=int(min(W,H)*0.08),fill=255)  # rotate at composite
    elif name=='phone': d.rounded_rectangle([x0,y0,x1,y1],radius=int(min(W,H)*0.13),fill=255)
    elif name=='strip': d.rounded_rectangle([cx-W*0.22,y0,cx+W*0.22,y1],radius=40,fill=255)
    elif name=='band': d.rounded_rectangle([x0,cy-H*0.22,x1,cy+H*0.22],radius=40,fill=255)
    else: d.ellipse([cx-r,cy-r,cx+r,cy+r],fill=255)

def make(name, W, H, feather=10, ring=14):
    m=Image.new('L',(W,H),0); draw_shape(ImageDraw.Draw(m),name,W,H,ring+feather+4)
    m=m.filter(ImageFilter.GaussianBlur(feather))
    if name=='tilt': m=m.rotate(-10,expand=False,resample=Image.BICUBIC)
    m.save(f'shapes/{name}_{W}x{H}_mask.png')
    # ring = accent annulus = dilate(mask edge)
    outer=Image.new('L',(W,H),0); draw_shape(ImageDraw.Draw(outer),name,W,H,feather+2)
    inner=Image.new('L',(W,H),0); draw_shape(ImageDraw.Draw(inner),name,W,H,feather+2+ring)
    if name=='tilt': outer=outer.rotate(-10,resample=Image.BICUBIC); inner=inner.rotate(-10,resample=Image.BICUBIC)
    import numpy as np
    ann=(np.array(outer).astype(int)-np.array(inner).astype(int)).clip(0,255).astype('uint8')
    ann_img=Image.fromarray(ann,'L').filter(ImageFilter.GaussianBlur(1.5))
    ringimg=Image.new('RGBA',(W,H),(0,0,0,0)); ringimg.putalpha(ann_img)
    solid=Image.new('RGBA',(W,H),ACCENT+(255,)); ringimg=Image.composite(solid,Image.new('RGBA',(W,H),(0,0,0,0)),ann_img)
    ringimg.save(f'shapes/{name}_{W}x{H}_ring.png')

if __name__=='__main__':
    # default box sizes used by shaped_insert
    boxes=[('circle',760,760),('hexagon',820,820),('diamond',820,820),('phone',620,1240),
           ('strip',520,1500),('band',980,560),('roundsquare',820,820),('tv',900,700),
           ('pentagon',800,800),('parallelogram',920,620),('tilt',860,660),('arch',760,900),
           ('oval',900,680)]
    for n,w,h in boxes: make(n,w,h); print('shape',n,w,h)
    print('DONE shapes')
