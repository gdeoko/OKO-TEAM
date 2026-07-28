# -*- coding: utf-8 -*-
"""Чистый матт белого робота на белом фоне: топология flood-fill + мягкая кромка + снятие белого спилла."""
from PIL import Image
import numpy as np, glob, os
from scipy import ndimage as nd

SRC=sorted(glob.glob('seq/robo_raw/*.png'))
OUT='seq/robo_mat3'; os.makedirs(OUT,exist_ok=True)
UP=2  # апскейл

def matte(path):
    im=Image.open(path).convert('RGB')
    a=np.asarray(im).astype(np.float32)
    # «непринадлежность белому»: 0 = чистый белый фон, 1 = плотный объект
    dist=(255.0-a.min(axis=2))            # насколько пиксель темнее белого
    solid = dist>7                         # чувствительно: ловим даже слабый контур
    solid = nd.binary_closing(solid,structure=np.ones((9,9)),iterations=1)  # заклеиваем разрывы контура
    # заливка фона от рамки по «почти белым» пикселям
    nearwhite = ~solid
    lbl,_=nd.label(nearwhite)
    border=set(np.unique(np.concatenate([lbl[0],lbl[-1],lbl[:,0],lbl[:,-1]])))
    border.discard(0)
    bg=np.isin(lbl,list(border))
    obj = ~bg                              # объект + внутренние дырки уже закрыты
    obj = nd.binary_closing(obj,structure=np.ones((3,3)),iterations=1)
    obj = nd.binary_fill_holes(obj)
    # мягкая кромка: в полосе 2px берём частичную альфу по «затемнению»
    inner = nd.binary_erosion(obj,structure=np.ones((3,3)),iterations=2)
    band  = obj & ~inner
    alpha = obj.astype(np.float32)
    soft  = np.clip(dist/26.0,0,1)
    alpha[band]=np.maximum(soft[band],0.35)
    # лёгкое сглаживание только по кромке
    alpha = nd.gaussian_filter(alpha,0.6)
    alpha = np.clip(alpha,0,1)
    alpha[inner]=1.0
    alpha[bg]=0.0
    # снятие белого спилла: наблюдаемое = a*C + (1-a)*белый  =>  C = (obs-(1-a)*255)/a
    A=alpha[...,None]
    col=np.where(A>0.02,(a-(1.0-A)*255.0)/np.maximum(A,0.02),0.0)
    col=np.clip(col,0,255)
    rgba=np.dstack([col,alpha*255.0]).astype(np.uint8)
    out=Image.fromarray(rgba,'RGBA')
    if UP!=1: out=out.resize((out.width*UP,out.height*UP),Image.LANCZOS)
    return out

for i,f in enumerate(SRC):
    matte(f).save(os.path.join(OUT,os.path.basename(f)))
    if i%40==0: print('  ',i,'/',len(SRC))
print('frames',len(SRC),'->',OUT)
# превью на тёмном фоне
m=Image.open(os.path.join(OUT,os.path.basename(SRC[40])))
bg=Image.new('RGBA',m.size,(6,10,4,255)); bg.alpha_composite(m)
bg.convert('RGB').resize((420,420)).save('robo_mat3_prev.png')
al=np.asarray(m)[:,:,3]
print('partial alpha px:',int(((al>10)&(al<245)).sum()),'of',al.size)
