# -*- coding: utf-8 -*-
"""Спрайт-лист руки в высоком разрешении: чистый матт (лайм на белом) + общий bbox + ячейка 660x366."""
from PIL import Image
import numpy as np, glob, os
from scipy import ndimage as nd

SRC=sorted(glob.glob('seq/hand_raw/*.png'))
assert len(SRC)==36, len(SRC)
mats=[]
for f in SRC:
    a=np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    dist=255.0-a.min(axis=2)                 # белый фон -> 0
    solid=dist>10
    solid=nd.binary_closing(solid,structure=np.ones((9,9)),iterations=1)
    lbl,nl=nd.label(~solid)
    border=set(np.unique(np.concatenate([lbl[0],lbl[-1],lbl[:,0],lbl[:,-1]]))); border.discard(0)
    bg=np.isin(lbl,list(border))
    # закрытые белые области: мелкие — это блики на металле (заливаем), крупные — просветы между пальцами (оставляем фоном)
    sizes=nd.sum(np.ones_like(lbl),lbl,index=np.arange(1,nl+1))
    holes=np.zeros_like(bg)
    for i in range(1,nl+1):
        if i in border: continue
        if sizes[i-1] < 1200: holes |= (lbl==i)
    obj=(~bg) & (~(( ~solid) & ~holes))
    obj=obj | holes
    obj=nd.binary_closing(obj,structure=np.ones((3,3)),iterations=1)
    inner=nd.binary_erosion(obj,structure=np.ones((3,3)),iterations=2)
    band=obj&~inner
    alpha=obj.astype(np.float32)
    soft=np.clip(dist/26.0,0,1)
    alpha[band]=np.maximum(soft[band],0.35)
    # манжета белая на белом фоне — заклеиваем рваные края крупным closing
    obj2=nd.binary_closing(obj,structure=np.ones((3,3)),iterations=1)
    alpha=np.maximum(alpha,obj2.astype(np.float32)*0.0+np.where(obj2,1.0,0.0))
    alpha=np.clip(nd.gaussian_filter(alpha,0.8),0,1)
    inner=nd.binary_erosion(obj2,structure=np.ones((3,3)),iterations=2)
    alpha[inner]=1.0
    alpha[~obj2]=np.minimum(alpha[~obj2],0.0)
    A=alpha[...,None]
    col=np.clip(np.where(A>0.02,(a-(1.0-A)*255.0)/np.maximum(A,0.02),0.0),0,255)
    # ПЕРЕКРАС В БРЕНДОВЫЙ ЛАЙМ: яркость металла -> рампа тёмно-зелёный → лайм → почти белый лайм
    L=np.clip(col.mean(axis=2)/255.0,0,1)[...,None]
    dark =np.array([26.,58.,0.],dtype=np.float32)
    mid  =np.array([154.,255.,0.],dtype=np.float32)
    light=np.array([182.,236.,96.],dtype=np.float32)
    t=np.power(L,0.82)
    lo=dark+(mid-dark)*np.clip(t/0.80,0,1)
    hi=mid+(light-mid)*np.clip((t-0.80)/0.20,0,1)
    col=np.where(t<0.80,lo,hi)
    rgba=np.dstack([col,alpha*255.0]).astype(np.uint8)
    rgba=np.asarray(Image.fromarray(rgba,'RGBA').rotate(-90,expand=True))  # запястье слева, пальцы вправо
    mats.append(rgba)

# общий bbox по всем кадрам
x0,y0,x1,y1=10**9,10**9,-1,-1
for m in mats:
    ys,xs=np.nonzero(m[:,:,3]>25)
    x0=min(x0,xs.min()); x1=max(x1,xs.max()); y0=min(y0,ys.min()); y1=max(y1,ys.max())
pad=6
H,W=mats[0].shape[:2]
x0=max(0,x0-pad); y0=max(0,y0-pad); x1=min(W-1,x1+pad); y1=min(H-1,y1+pad)
cw,ch=x1-x0+1, y1-y0+1
# отрезаем «рукав» слева — остаётся чистая кисть, край растворяется голограммой
CUT=0.34
x0=x0+int(cw*CUT)
cw,ch=x1-x0+1, y1-y0+1
print('bbox',x0,y0,x1,y1,'cell',cw,ch,'aspect',round(cw/ch,4))
CW,CH=660,round(660*ch/cw)
print('ASPECT_FOR_HOLO', round(CW/CH,4))
print('target cell',CW,CH,'sheet',CW*6,CH*6)
sheet=Image.new('RGBA',(CW*6,CH*6),(0,0,0,0))
for i,m in enumerate(mats):
    cell=Image.fromarray(m,'RGBA').crop((x0,y0,x1+1,y1+1)).resize((CW,CH),Image.LANCZOS)
    ca=np.asarray(cell).astype(np.float32)
    # запястье уходит в тень: плавная S-кривая по альфе + затемнение цвета, без плоского блока
    x=np.linspace(0,1,CW)
    t=np.clip(x/0.34,0,1)
    ease=t*t*(3-2*t)                       # smoothstep
    ca[:,:,3:4]*=ease[None,:,None]
    shade=(0.24+0.76*ease)[None,:,None]    # к левому краю темнее
    ca[:,:,0:3]*=shade
    # нижняя кромка рукава в левой половине тоже гаснет
    y=np.linspace(0,1,CH); vb=np.clip((1.0-y)/0.16,0,1); vb=vb*vb*(3-2*vb)
    left=np.clip((0.62-x)/0.62,0,1)[None,:]
    fade=1.0-(1.0-vb[:,None])*left
    ca[:,:,3]*=fade
    cell=Image.fromarray(ca.astype(np.uint8),'RGBA')
    sheet.paste(cell,((i%6)*CW,(i//6)*CH))
sheet.save('hand_sheet_hi.webp','WEBP',quality=90,method=6)
print('size KB',os.path.getsize('hand_sheet_hi.webp')//1024)
# превью последнего кадра на тёмном
m=sheet.crop((5*CW,5*CH,6*CW,6*CH))
bg=Image.new('RGBA',m.size,(6,10,4,255)); bg.alpha_composite(m)
bg.convert('RGB').save('hand_hi_prev.png')
