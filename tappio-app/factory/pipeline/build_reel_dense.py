# -*- coding: utf-8 -*- dense-FX rebuild. python3 build_v2.py <day>
import sys, os, json, subprocess
sys.path.insert(0, os.path.abspath('.'))
import reel_lib as R
from configs_v2 import REELS

DAY = sys.argv[1]
REM_ENTRY = os.path.abspath('../b1/rem/entry.tsx')
REMBIN = os.path.abspath('node_modules/.bin/remotion')
HEADLESS = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'

def seq(tl, SC):
    shots=[]
    for (w0,w1),sc in zip(tl['windows'],SC):
        d=(w1-w0)/len(sc)
        for cid,ss in sc: shots.append((cid,ss,d))
    return shots

CFG = REELS[DAY]
tl = R.timeline(f'{DAY}/vo', CFG['segs'])

def at_sec(a):
    kind,off=a
    if kind=='cover': return tl['cover']+off
    if kind=='abs': return off
    return tl['starts'][kind]+off

# ---------- 1. cover + stage1 ----------
cv=CFG['cover']
R.cover(f'{DAY}/cover.jpg', cv['head'], cv['sub'], cv['bg'], cv['seek'])
cfg=dict(shots=seq(tl,CFG['SC']), cover=f'{DAY}/cover.jpg', grade=CFG['grade'], cta=CFG.get('cta','НАПИШИТЕ СЪЕМКА'), musvol=CFG['musvol'])
if CFG.get('bw_punch'): cfg['bw_punch']=at_sec(CFG['bw_punch'])
R.stage1(cfg, tl)

# ---------- 2. gl transitions ----------
R.gl_transitions('stage1.mp4', CFG['gl'], tl['bounds'], gln=16)

# ---------- 3. generate overlay assets (fx + lottie + remotion) ----------
fx_jobs=[]; lot_jobs=[]; three_jobs=[]; ov_dicts=[]
os.makedirs(f'{DAY}/ov', exist_ok=True)
for i,ov in enumerate(CFG['OV']):
    d=f'{DAY}/ov/{i}_{ov["type"] if ov["eng"]=="fx" else ov["eng"]}'
    t=at_sec(ov['at']); fr=ov['fr']; dur=fr/30.0
    common=dict(t=t, fade=ov.get('fade',dur))
    if ov.get('scale'): common['scale']=ov['scale']
    if ov.get('pos'): common['pos']=ov['pos']
    if ov['eng']=='fx':
        j={k:v for k,v in ov.items() if k not in ('eng','at','fr','scale','pos','fade')}
        j['dir']=d; j['frames']=fr; fx_jobs.append(j)
        ov_dicts.append(dict(dir=d, **common))
    elif ov['eng']=='lot':
        lot_jobs.append(dict(query=ov['query'], dir=d, frames=fr, x=ov.get('x',0.5), y=ov.get('y',0.5),
                             size=ov.get('size',420), speed=ov.get('speed',1.0)))
        ov_dicts.append(dict(dir=d, **common))
    elif ov['eng']=='three':
        three_jobs.append(dict(shape=ov['shape'], dir=d, frames=fr, col=ov.get('col','9CF806'), col2=ov.get('col2','e8842a')))
        ov_dicts.append(dict(dir=d, **common))
    elif ov['eng']=='rem':
        outd=os.path.abspath(d)
        subprocess.run([REMBIN,'render',REM_ENTRY,ov['comp'],outd,'--sequence','--image-format=png',
                        '--gl=swiftshader','--props='+json.dumps(ov.get('props',{}))],
                       check=True, capture_output=True)
        ov_dicts.append(dict(dir=d+'/element-%02d.png', **common))

if fx_jobs:
    json.dump(fx_jobs, open(f'{DAY}/fxjobs.json','w'), ensure_ascii=False)
    subprocess.run(['node','fx.js',f'{DAY}/fxjobs.json'], check=True)
if lot_jobs:
    json.dump(lot_jobs, open(f'{DAY}/lotjobs.json','w'), ensure_ascii=False)
    subprocess.run(['node','lottie_render.js',f'{DAY}/lotjobs.json'], check=True)
if three_jobs:
    json.dump(three_jobs, open(f'{DAY}/threejobs.json','w'), ensure_ascii=False)
    subprocess.run(['node','three_render.js',f'{DAY}/threejobs.json'], check=True)

# ---------- 4. drop overlays whose assets failed to render ----------
def has_frames(od):
    d=od['dir']
    if '%' in d:  # remotion pattern element-%02d.png
        base=os.path.dirname(d); return os.path.isdir(base) and any(f.endswith('.png') for f in os.listdir(base))
    return os.path.isdir(d) and os.path.exists(os.path.join(d,'000.png'))
kept=[od for od in ov_dicts if has_frames(od)]
if len(kept)!=len(ov_dicts): print('dropped', len(ov_dicts)-len(kept), 'empty overlays')
ov_dicts=kept

# ---------- 5. stage2 with dense overlays ----------
R.stage2(cfg, tl, CFG['gl'], gln=16, overlays=ov_dicts)

# ---------- 5. stage3 audio + karaoke ----------
sfx=[(n, at_sec(a), g, m) for (n,a,g,m) in CFG.get('sfx',[])]
R.stage3(cfg, tl, CFG['music'], CFG['out'], sfx_hits=sfx)
print('DONE', DAY, '->', CFG['out'], '| overlays:', len(ov_dicts))
