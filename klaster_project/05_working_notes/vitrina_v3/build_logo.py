import cairosvg, os
from logo_lib import emblem_svg, gear_path, person_path, glyph_groups_svg
from fontTools.ttLib import TTFont

OSWALD="fonts/oswald-cyr-700.ttf"
OUT="/home/user/OKO-TEAM/klaster_project/03_deliverables/brandbook/logo"
os.makedirs(OUT, exist_ok=True)
CHAR="#14171C"; AMBER="#E8A400"; WHITE="#FFFFFF"; INK="#0E1116"

def emblem_group(cx, cy, size, fill):
    R_tip=size*0.46; R_root=size*0.375; R_hole=size*0.30
    g=gear_path(cx,cy,R_tip,R_root,R_hole,teeth=10,tooth_frac=0.52)
    person=person_path(cx,cy,R_hole*1.02)
    return f'<g fill="{fill}" fill-rule="evenodd"><path d="{g}"/></g><g fill="{fill}">{person}</g>'

def wordmark(x, baseline, fs, fill, ls=None, text="КЛАСТЕР"):
    if ls is None: ls=fs*0.02
    return glyph_groups_svg(OSWALD, text, fs, letter_spacing=ls, x=x, y=baseline, fill=fill)

def svg_wrap(w,h,body,bg=None):
    b=f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}" width="{w:.1f}" height="{h:.1f}">{b}{body}</svg>'

# ---- EMBLEM variants ----
def write(fn, s): open(os.path.join(OUT,fn),"w").write(s); 
write("klaster-emblem.svg", emblem_svg(CHAR))
write("klaster-emblem-white.svg", emblem_svg(WHITE))
write("klaster-emblem-amber.svg", emblem_svg(AMBER))
# app icon (amber rounded plate + charcoal emblem)
S=240
icon=svg_wrap(S,S, f'<rect width="{S}" height="{S}" rx="{S*0.22:.1f}" fill="{AMBER}"/>' + emblem_group(S/2,S/2,S*0.72,INK))
write("klaster-appicon-amber.svg", icon)
icon_dark=svg_wrap(S,S, f'<rect width="{S}" height="{S}" rx="{S*0.22:.1f}" fill="{INK}"/>' + emblem_group(S/2,S/2,S*0.72,AMBER))
write("klaster-appicon-dark.svg", icon_dark)

# ---- HORIZONTAL lockup ----
def horizontal(emb_fill, wm_fill, fn, bg=None):
    es=120.0; pad=14.0
    fs=88.0
    # wordmark baseline aligned to emblem vertical center-ish
    wm_body, wm_w = wordmark(0,0,fs,wm_fill)
    gap=es*0.28
    w=pad + es + gap + wm_w + pad*1.4
    h=pad + es + pad
    cyc=h/2
    body=f'<g transform="translate({pad},{pad})">{emblem_group(es/2,es/2,es,emb_fill)}</g>'
    # baseline so caps-height vertically centered: Oswald cap height ~0.72em
    caph=fs*0.72
    baseline=cyc + caph/2
    body+=f'<g transform="translate({pad+es+gap},{baseline})">{wm_body_shift(wm_fill,fs)}</g>'
    write(fn, svg_wrap(w,h,body,bg))
    return w,h

def wm_body_shift(fill,fs):
    b,_=wordmark(0,0,fs,fill); return b

horizontal(CHAR, CHAR, "klaster-logo-horizontal.svg")
horizontal(WHITE, WHITE, "klaster-logo-horizontal-white.svg")
horizontal(CHAR, CHAR, "klaster-logo-horizontal-onwhite.svg", bg=WHITE)

# ---- STACKED lockup (emblem top, wordmark, tagline) ----
def stacked(emb_fill, wm_fill, tag_fill, fn, bg=None):
    es=150.0; fs=76.0; tfs=15.5
    wm_body,wm_w=wordmark(0,0,fs,wm_fill)
    tag="ПРОСТРАНСТВО УСПЕШНЫХ КОМПАНИЙ"
    tg_body,tg_w=glyph_groups_svg(OSWALD,tag,tfs,letter_spacing=tfs*0.26,x=0,y=0,fill=tag_fill)
    w=max(es,wm_w,tg_w)+56
    cxw=w/2
    caph=fs*0.72
    y_emb=24
    y_wm=y_emb+es+54
    y_tag=y_wm+26
    h=y_tag+20
    body=f'<g transform="translate({cxw-es/2},{y_emb})">{emblem_group(es/2,es/2,es,emb_fill)}</g>'
    body+=f'<g transform="translate({cxw-wm_w/2},{y_wm})">{wm_body}</g>'
    body+=f'<g transform="translate({cxw-tg_w/2},{y_tag})">{tg_body}</g>'
    write(fn, svg_wrap(w,h,body,bg))

stacked(CHAR,CHAR,AMBER,"klaster-logo-stacked.svg")
stacked(WHITE,WHITE,AMBER,"klaster-logo-stacked-white.svg")
print("SVGs written:", len(os.listdir(OUT)))
