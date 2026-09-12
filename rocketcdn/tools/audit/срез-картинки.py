# -*- coding: utf-8 -*-
"""Как выглядит марка после clip-path на каждом экране. Контур берём
   из паспорта рамы и раскладки кадра - той же арифметикой, что в браузере."""
import json, re, sys
from PIL import Image, ImageDraw
src = open('assets/gen/cab/flat.js', encoding='utf-8').read()
FLAT = json.loads(src[src.index('{', src.index('RC_CAB_FLAT')):].rstrip().rstrip(';'))
ДНО = 0.978
def какой(W,H): return "высокая" if H>W else ("средняя" if W/H<1.55 else "широкая")
def покрытие(m,W,H):
    k=max(W/m['w'],H/m['h']); dw=m['w']*k; dh=m['h']*k; д=0.5
    if dh>H:
        д=(H-ДНО*dh)/(H-dh); д=max(0.5,min(1.0,д))
    return dict(dw=dw,dh=dh,ox=(W-dw)/2,oy=(H-dh)*д)
ЭК={"телефон":(412,800),"узкий":(360,640),"планшет":(820,1180),"четыре":(1024,768),
    "ноутбук":(1280,720),"ПК":(1440,900),"широкий":(1920,1080),"лежачий":(900,412)}
mark=Image.open('assets/mark.webp').convert('RGBA')
масштаб=6
плитки=[]
for имя,(W,H) in ЭК.items():
    m=FLAT[какой(W,H)]; п=покрытие(m,W,H)
    P=[((п['ox']+q[0]*п['dw']), (п['oy']+q[1]*п['dh'])) for q in m['контур']]
    ш = 44 if W<=760 else min(max(0.07*W,54),92)
    ш=int(round(ш))
    # клип в долях коробки элемента
    кл=[((x/W)*ш, (y/H)*ш) for x,y in P]
    tile=Image.new('RGBA',(ш,ш),(0,0,0,0))
    hh=int(round(ш/(343/320)))
    tile.paste(mark.resize((ш,hh), Image.LANCZOS),(0,(ш-hh)//2))
    маска=Image.new('L',(ш,ш),0)
    ImageDraw.Draw(маска).polygon(кл, fill=255)
    рез=Image.new('RGBA',(ш,ш),(0,0,0,0)); рез.paste(tile,(0,0),маска)
    # рядом целая
    пара=Image.new('RGBA',(ш*2+8,ш),(14,22,34,255))
    пара.paste(tile,(0,0),tile); пара.paste(рез,(ш+8,0),рез)
    плитки.append((имя,пара))
Ш=max(p.width for _,p in плитки); В=sum(p.height for _,p in плитки)+len(плитки)*14
холст=Image.new('RGBA',(Ш,В),(14,22,34,255)); y=0
d=ImageDraw.Draw(холст)
for имя,p in плитки:
    холст.paste(p,(0,y),p); d.text((2,y+p.height+1), имя, fill=(200,230,255)); y+=p.height+14
холст.resize((Ш*масштаб,В*масштаб), Image.NEAREST).save('tools/audit/кадры/срез-все-экраны.png')
print('готово', Ш*масштаб, В*масштаб)
