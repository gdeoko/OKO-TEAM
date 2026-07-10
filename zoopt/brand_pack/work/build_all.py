import cairosvg, os
E=eval(open('emblem_data.txt').read()); W=eval(open('word_meta.txt').read())
T,dU,dY=E['t'],E['dU'],E['dY']; EW,EH=E['W'],E['H']
green,black,tag=W['green'],W['black'],W['tag']; word_w=W['word_w']; upm=W['upm']; tagw=W['tagw']; tsc=W['tag_scale']
def grp(items,fill): return ''.join(f'<path transform="translate({x:.1f},0)" d="{d}" fill="{fill}"/>' for d,x in items)
def emblem_inner(mode):
    if mode=='color': body=f'<path d="{dU}" fill="#0A0A0A"/><path d="{dY}" fill="#FFD500"/>'
    else: body=f'<path d="{dU} {dY}" fill="{mode}" fill-rule="evenodd"/>'
    return f'<g transform="{T}">{body}</g>'
def word_inner(mode):
    if mode=='color': gc,bc,tc='#1B8A3A','#0A0A0A','#0A0A0A'
    else: gc=bc=tc=mode
    tx=(word_w-tagw*tsc)/2
    return (f'<g transform="translate(0,{upm}) scale(1,-1)">{grp(green,gc)}{grp(black,bc)}</g>'
            f'<g transform="translate({tx:.1f},{upm*1.28:.0f}) scale({tsc},-{tsc})">{grp(tag,tc)}</g>')
WORD_H=upm*1.42
def wrap(vb,content,bg=None):
    r=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">'
    if bg: r+=f'<rect x="0" y="0" width="9999" height="9999" fill="{bg}"/>'
    return r+content+'</svg>'
def emblem_svg(mode): return wrap(f'0 0 {EW:.0f} {EH:.0f}', emblem_inner(mode))
def word_svg(mode):   return wrap(f'0 0 {word_w:.0f} {WORD_H:.0f}', word_inner(mode))
def vlock(mode):
    Wc=2000; pad=180; ew=980; es=ew/EW; eh=EH*es; ex=(Wc-ew)/2; ey=pad
    ww=1560; ws=ww/word_w; wh=WORD_H*ws; wx=(Wc-ww)/2; wy=ey+eh+150
    Hc=wy+wh+pad
    c=f'<g transform="translate({ex:.1f},{ey:.1f}) scale({es:.4f})">{emblem_inner(mode)}</g>'
    c+=f'<g transform="translate({wx:.1f},{wy:.1f}) scale({ws:.4f})">{word_inner(mode)}</g>'
    return wrap(f'0 0 {Wc} {Hc:.0f}',c)
def hlock(mode):
    eh=560; es=eh/EH; ew=EW*es
    ww=1420; ws=ww/word_w; wh=WORD_H*ws
    pad=150; gapx=90
    Wc=pad+ew+gapx+ww+pad; Hc=pad+max(eh,wh)+pad
    ey=(Hc-eh)/2; wy=(Hc-wh)/2 - eh*0.02
    c=f'<g transform="translate({pad:.1f},{ey:.1f}) scale({es:.4f})">{emblem_inner(mode)}</g>'
    c+=f'<g transform="translate({pad+ew+gapx:.1f},{wy:.1f}) scale({ws:.4f})">{word_inner(mode)}</g>'
    return wrap(f'0 0 {Wc:.0f} {Hc:.0f}',c)
OUT='/home/user/OKO-TEAM/zoopt/brand_pack'
specs={
 'zoopt-logo-vertical':(vlock,[8192,4096,2048,1024,512]),
 'zoopt-logo-horizontal':(hlock,[8192,4096,2048,1024,512]),
 'zoopt-emblem':(emblem_svg,[8192,4096,2048,1024,512,256]),
 'zoopt-wordmark':(word_svg,[8192,4096,2048,1024]),
}
modes={'color':'color','black':'#0A0A0A','white':'#FFFFFF'}
for base,(fn,sizes) in specs.items():
    for mname,mval in modes.items():
        svg=fn(mval)
        stem=f'{OUT}/{base}-{mname}'
        open(stem+'.svg','w').write(svg)
        cairosvg.svg2pdf(bytestring=svg.encode(),write_to=stem+'.pdf')
        for s in sizes:
            cairosvg.svg2png(bytestring=svg.encode(),write_to=f'{stem}-{s}.png',output_width=s)
print('exported all logos')
