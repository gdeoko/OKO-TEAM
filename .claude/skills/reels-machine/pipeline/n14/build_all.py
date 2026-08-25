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
GR='#8a8a8a'  # нейтральный серый для «плохого» столбца (без зелёного)
# cover: camera-UI рамка (бренд)
fx('camui','cover',0.0,60, tc='REC 00:03')
# s1 hook (~1-5с): statcard «3» + steps 1-2-3 + shine  → код-инфографика подряд
fx('statcard','s1',0.5,44, val=3, label='простых приёма', y=300)
fx('steps','s1',1.9,58, items=[['1','свет от окна'],['2','шаг ближе'],['3','ритм монтажа']], y=560)
fx('shine','s1',0.9,26)
# s2 приём1 свет (~5-15с): lowerthird + callout + bars(тень/свет) + donut(80%)
fx('lowerthird','s2',0.4,60, title='ПРИЁМ 1', sub='свет от окна', y=1150)
fx('callout','s2',2.4,42, x=0.5, y=0.30, label='к свету лицом')
fx('bars','s2',4.4,64, data=[['без света',26,GR],['от окна',100,OR]])
fx('donut','s2',7.2,60, val=80, label='кадра решает свет', x=0.5, y=0.28)
# s3 приём2 шаг (~15-24с): lowerthird + stamp + bars(зум/шаг) + statcard(100%)
fx('lowerthird','s3',0.3,60, title='ПРИЁМ 2', sub='шаг ближе, не зум', y=1150)
fx('stamp','s3',2.2,40, text='БЕЗ ЗУМА', color=OR, x=0.5, y=0.56, big=True, rot=-0.12)
fx('bars','s3',4.6,60, data=[['цифровой зум',18,GR],['шаг ногами',100,OR]])
fx('statcard','s3',7.0,52, val=100, suf='%', label='качества сохранил', y=300)
# s4 приём3 ритм (~24-31с): lowerthird + gridpop + statcard(3 сек)
fx('lowerthird','s4',0.3,56, title='ПРИЁМ 3', sub='ритм монтажа', y=1150)
fx('gridpop','s4',1.6,56, y=560)
fx('statcard','s4',4.0,48, val=3, suf=' сек', label='на один кадр', y=300)
# s5 база (~31-37с): toast + ratings(5) уровень студии
fx('toast','s5',0.5,50, text='свет · звук · монтаж')
fx('ratings','s5',2.6,54, stars=5, val=5, label='уровень студии', y=340)
fx('ticker','s2',0.0,300, text='V.CODE · видеопродакшн · Ставрополь · снимаем дорого · ')
# s6 CTA (~37-45с): dm + likes + stamp
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
