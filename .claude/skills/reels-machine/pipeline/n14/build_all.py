# -*- coding: utf-8 -*- n14 «3 приёма снять дорого» — self-contained build (stage1/2/3).
import json, os, subprocess, sys, glob
sys.path.insert(0, os.path.abspath('.'))
import build_reel as BR

DAY='n14'; VO=f'{DAY}/vo'; C=f'{DAY}/clips'; OVD=f'{DAY}/ov'
SEGS=['s1','s2','s3','s4','s5','s6']
os.makedirs(OVD, exist_ok=True)

# --- новый грейд под тему (диверсити: грейд всегда новый) ---
BR.GRADES['crisp_studio']=("eq=contrast=1.07:saturation=1.14:brightness=0.012,"
  "colorbalance=rs=.015:gs=.005:bs=-.01,unsharp=5:5:0.5,vignette=PI/5,noise=alls=3:allf=t")
GRADE='crisp_studio'

tl=BR.timeline(VO, SEGS)
def at(seg,off): return (tl['cover'] if seg=='cover' else tl['starts'][seg])+off

# --- раскладка кадров по окнам сцен (2-3 клипа/окно, смена ~3с) ---
SC={
 's1':['c1_hook','c2_hold'],
 's2':['c3_window','c4_soft','c5_shadow'],
 's3':['c6_step','c7_feet','c8_frame'],
 's4':['c9_clap','c10_edit'],
 's5':['c11_light','c12_mic'],
 's6':['c13_owner','c14_dm'],
}
def clip_dur(p): return BR.probe(p)
shots=[]
for seg,(w0,w1) in zip(SEGS, tl['windows']):
    names=SC[seg]; d=(w1-w0)/len(names)
    for nm in names:
        src=f'{C}/{nm}.mp4'; avail=clip_dur(src)
        seek=min(0.6, max(0.0, avail-d-0.4))
        shots.append((src, seek, d))
print('shots', len(shots), 'total video', round(tl['total'],2),'s')

# --- STAGE 1 ---
if not os.path.exists(f'{DAY}/stage1.mp4'):
    BR.stage1(shots, tl, f'{DAY}/cover.jpg', '../logo_hd.png', out=f'{DAY}/stage1.mp4', grade=GRADE)
else: print('stage1 cached')

# --- GL transitions (свежие, мимо реестра) на внутренних границах ---
GL=[('windowslice','ov/g1'),('Swirl','ov/g2'),('doorway','ov/g3'),('Fold','ov/g4'),('hexagonalize','ov/g5')]
GL=[(n, f'{DAY}/{d.split("/")[-1]}') for n,d in GL]
try:
    if not os.path.exists(f'{DAY}/g5/015.png'):
        BR.make_gl_transitions(f'{DAY}/stage1.mp4', GL, tl['bounds'], gln=16, runner='motion/transitions_gl.cjs')
    else: print('gl cached')
    GL_OK=True
except Exception as e:
    print('GL fail, fallback to simple:', str(e)[:200]); GL_OK=False

# --- FX overlays (код-инфографика, разные, мимо реестра) ---
OR='#EA5920'; WH='#ffffff'
fx_jobs=[]
def fx(type, seg, off, fr, **kw):
    d=f'{OVD}/{type}_{seg}_{int(off*100)}'
    j=dict(type=type, dir=d, frames=fr, **kw); fx_jobs.append((j, at(seg,off))); return d
# cover: camera-UI рамка (бренд)
fx('camui','cover',0.0,60, tc='REC 00:03')
# s1 hook: slam «3 ПРИЁМА» + steps 1-2-3 (превью приёмов)
fx('steps','s1',1.7,58, items=[['1','свет от окна'],['2','шаг ближе'],['3','ритм монтажа']], y=520)
fx('shine','s1',0.9,26)
# s2 приём1 свет: lowerthird + callout
fx('lowerthird','s2',0.4,66, title='ПРИЁМ 1', sub='свет от окна', y=1150)
fx('callout','s2',3.0,44, x=0.5, y=0.34, label='к свету лицом')
# s3 приём2 шаг: lowerthird + stamp «БЕЗ ЗУМА»
fx('lowerthird','s3',0.3,64, title='ПРИЁМ 2', sub='шаг ближе, не зум', y=1150)
fx('stamp','s3',2.4,42, text='БЕЗ ЗУМА', color=OR, x=0.5, y=0.6, big=True, rot=-0.12)
# s4 приём3 ритм: lowerthird + gridpop (смена планов) + slam «3 СЕК»
fx('lowerthird','s4',0.3,60, title='ПРИЁМ 3', sub='ритм монтажа', y=1150)
fx('gridpop','s4',1.5,58, y=560)
fx('slam','s4',3.6,38, words=['КАЖДЫЕ 3 СЕК'], colors=[WH], y=1000)
# s5 база: toast «свет · звук · монтаж»
fx('toast','s5',0.6,54, text='свет · звук · монтаж')
fx('ticker','s2',0.0,170, text='V.CODE · видеопродакшн · Ставрополь · снимаем дорого · ')
# s6 CTA: dm + likes + stamp
fx('dm','s6',0.5,56, items=['СЪЕМКА','+1 заявка','запись открыта'], y=980)
fx('likes','s6',1.7,48, n=18)
fx('stamp','s6',2.6,44, text='НАПИШИТЕ', color=OR, x=0.5, y=0.30, rot=0.08)

json.dump([j for j,_ in fx_jobs], open(f'{DAY}/fx_jobs.json','w'), ensure_ascii=False)
print('fx jobs', len(fx_jobs))
r=subprocess.run(['node','motion/fx_engine.js', f'{DAY}/fx_jobs.json'], capture_output=True, text=True, cwd='.')
sys.stderr.write(r.stderr[-1500:]); print(r.stdout[-600:])

# --- 3D torus (свежая фигура/цвет) ---
three_dir=f'{DAY}/ov/three_torus'
tj=[dict(shape='torus', dir=three_dir, frames=34, dur=34/30, col='EA5920', col2='ffffff', scale=560)]
json.dump(tj, open(f'{DAY}/three_jobs.json','w'))
# three_render ждёт three3d рядом (cwd)
if not os.path.exists(f'{three_dir}/033.png'):
    r3=subprocess.run(['node','three/three_render.js', f'{DAY}/three_jobs.json'], capture_output=True, text=True, cwd='.')
else:
    class _R: stdout='cached';stderr=''
    r3=_R()
print('three:', r3.stdout[-200:], r3.stderr[-300:])
THREE_OK=os.path.exists(f'{three_dir}/033.png')

# сохраняем расписание оверлеев для stage2
sched=[]
for j,t in fx_jobs:
    if os.path.exists(f'{j["dir"]}/{j["frames"]-1:03d}.png'):
        sched.append(dict(dir=j['dir'], t=round(t,3), frames=j['frames'], scale=None))
if THREE_OK:
    sched.append(dict(dir=three_dir, t=round(at('s2',3.0),3), frames=34, scale=560))
json.dump(dict(sched=sched, gl=[d for _,d in GL] if GL_OK else [], bounds=tl['bounds'], total=tl['total']),
          open(f'{DAY}/stage2_plan.json','w'))
print('overlays ready:', len(sched), 'three', THREE_OK, 'gl', GL_OK)
