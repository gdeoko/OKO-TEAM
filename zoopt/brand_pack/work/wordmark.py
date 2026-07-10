from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
FB='/home/user/OKO-TEAM/zoopt/assets/fonts/Unbounded-Black.ttf'
FS='/home/user/OKO-TEAM/zoopt/assets/fonts/Unbounded-SemiBold.ttf'
def load(p):
    f=TTFont(p); return f,f.getGlyphSet(),f.getBestCmap(),f['head'].unitsPerEm,f['hmtx']
def run(fp,text,ls=0):
    f,gs,cmap,upm,hmtx=load(fp)
    x=0; out=[]
    for ch in text:
        if ch==' ': x+=upm*0.32+ls; continue
        gn=cmap[ord(ch)]; pen=SVGPathPen(gs); gs[gn].draw(pen)
        out.append((pen.getCommands(),x)); x+=hmtx[gn][0]+ls
    return out,x,upm
# вордмарк: ЗОО (зелёный) + ОПТ (чёрный), общий поток
segz,_,upm=run(FB,'ЗОО',ls=8)
# продолжаем ОПТ со смещения после ЗОО
allz,wtot,_=run(FB,'ЗОООПТ',ls=8)
# split: первые 3 буквы зелёные, остальные чёрные
green=allz[:3]; black=allz[3:]
def group(items,fill):
    ps=''.join(f'<path transform="translate({x:.1f},0)" d="{d}" fill="{fill}"/>' for d,x in items)
    return ps
# тег
tagitems,tagw,upm2=run(FS,'СКЛАД · МАРКЕТ',ls=120)
# компоновка: слово масштаб 1 (в em-юнитах upm), тег меньше и по центру
import cairosvg
# высота слова ~ upm (cap). Флип Y: g scale(1,-1)
WM_H=upm*1.02
tag_scale=0.32
# центрируем тег под словом
tagw_s=tagw*tag_scale; word_w=wtot
tx=(word_w-tagw_s)/2
svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {word_w:.0f} {WM_H*1.5:.0f}">
<g transform="translate(0,{upm:.0f}) scale(1,-1)">{group(green,'#1B8A3A')}{group(black,'#0A0A0A')}</g>
<g transform="translate({tx:.1f},{upm*1.28:.0f}) scale({tag_scale},-{tag_scale})">{group(tagitems,'#0A0A0A')}</g>
</svg>'''
open('wordmark-color.svg','w').write(svg)
cairosvg.svg2png(url='wordmark-color.svg',write_to='prev_word.png',output_width=900,background_color='#F5F1E8')
open('word_meta.txt','w').write(repr({'word_w':word_w,'upm':upm,'WM_H':WM_H,'green':green,'black':black,'tag':tagitems,'tagw':tagw,'tag_scale':tag_scale}))
print('word_w',word_w,'upm',upm,'glyphs',len(allz),'tag',len(tagitems))
