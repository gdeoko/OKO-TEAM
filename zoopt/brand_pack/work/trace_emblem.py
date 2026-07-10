from PIL import Image, ImageFilter
import numpy as np, subprocess, re
src=Image.open('/home/user/OKO-TEAM/zoopt/assets/logo_src.png').convert('RGB')
a=np.asarray(src); R,G,B=a[...,0].astype(int),a[...,1].astype(int),a[...,2].astype(int)
black=(R<70)&(G<70)&(B<70); yellow=(R>150)&(G>135)&(B<95)
emb=black|yellow; rows=emb.sum(1); first=np.where(rows>5)[0][0]
gap=None
for y in range(first+40,len(rows)-1):
    if rows[y]<3 and rows[y+1]<3: gap=y;break
sub=emb[first:gap,:]; ys2,xs2=np.where(sub)
pad=16; cx0=max(0,xs2.min()-pad);cx1=min(a.shape[1],xs2.max()+pad)
oy0=first+max(0,ys2.min()-pad); oy1=first+min(sub.shape[0],ys2.max()+pad)
crop=src.crop((cx0,oy0,cx1,oy1)); s=3
crop=crop.resize((crop.width*s,crop.height*s),Image.LANCZOS)
ca=np.asarray(crop).astype(int); cR,cG,cB=ca[...,0],ca[...,1],ca[...,2]
bg=(cR>212)&(cG>206)&(cB>190)           # айвори-фон
union=~bg                                 # весь диск сплошной
yellow=(cR>140)&(cG>120)&(cB<105)
def dil(mask,k):
    im=Image.fromarray((mask*255).astype('uint8'),'L').filter(ImageFilter.MaxFilter(k))
    return np.asarray(im)>127
union=dil(union,5); yellow=dil(yellow,3)
def save_pbm(mask,path):
    Image.fromarray((~mask*255).astype('uint8'),'L').convert('1').save(path)
save_pbm(union,'union.pbm'); save_pbm(yellow,'yellow.pbm')
def trace(pbm):
    out=pbm.replace('.pbm','.svg')
    subprocess.run(['potrace',pbm,'-s','-o',out,'-a','1.3','-t','12','-O','0.35'],check=True)
    t=open(out).read()
    g=re.search(r'(<g [^>]*transform="([^"]+)"[^>]*>)(.*?)</g>',t,re.S)
    paths=re.findall(r'<path d="([^"]+)"',g.group(3))
    W=float(re.search(r'width="([0-9.]+)',t).group(1)); H=float(re.search(r'height="([0-9.]+)',t).group(1))
    return g.group(2),' '.join(paths),W,H
tU,dU,W,H=trace('union.pbm'); tY,dY,_,_=trace('yellow.pbm')
open('emblem_data.txt','w').write(repr({'t':tU,'dU':dU,'dY':dY,'W':W,'H':H}))
open('emblem-color.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}"><g transform="{tU}"><path d="{dU}" fill="#0A0A0A"/><path d="{dY}" fill="#FFD500"/></g></svg>')
import cairosvg; cairosvg.svg2png(url='emblem-color.svg',write_to='preview.png',output_width=600,background_color='#F5F1E8')
print('ok viewBox',W,H)
