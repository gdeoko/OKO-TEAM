# -*- coding: utf-8 -*- n15 «3 приёма снять дорого» — self-contained build (stage1/2/3).
import json, os, subprocess, sys, glob
sys.path.insert(0, os.path.abspath('.'))
import build_reel as BR

DAY='n15'; VO=f'{DAY}/vo'; C=f'{DAY}/clips'; OVD=f'{DAY}/ov'
SEGS=['s1','s2','s3','s4','s5','s6']
os.makedirs(OVD, exist_ok=True)

# --- новый грейд под тему (виральный/продающий — контрастный) ---
BR.GRADES['bold_punch']=("eq=contrast=1.12:saturation=1.18:brightness=0.006,"
  "curves=all='0/0 0.5/0.47 1/1',colorbalance=rs=.02:bs=-.015,vignette=PI/4.5,noise=alls=4:allf=t")
GRADE='bold_punch'

tl=BR.timeline(VO, SEGS)
def at(seg,off): return (tl['cover'] if seg=='cover' else tl['starts'][seg])+off

# --- раскладка кадров по окнам сцен (2-3 клипа/окно, смена ~3с) ---
SC={
 's1':['c1_hook','c2_think'],
 's2':['c3_scroll','c4_screen','c13_watch'],
 's3':['c7_shoot','c6_ads','c10_team'],
 's4':['c8_trust','c5_deal'],
 's5':['c11_studio','c12_camera'],
 's6':['c9_client','c14_type'],
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
GL=[('CrossZoom','ov/g1'),('Rolls','ov/g2'),('StereoViewer','ov/g3'),('Overexposure','ov/g4'),('ZoomLeftWipe','ov/g5')]
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
GR='#8a8a8a'  # нейтральный серый для «слабого» столбца (без зелёного)
# cover: camera-UI рамка (бренд)
fx('camui','cover',0.0,50, tc='REC 00:02')
# s1 hook «конкурент уже снимает, а вы думаете»: statcard 89% + stamp «А ВЫ?»
fx('statcard','s1',0.4,42, val=89, suf='%', label='выбирают глазами', y=300)
fx('stamp','s1',2.1,40, text='А ВЫ?', color=OR, x=0.5, y=0.6, big=True, rot=-0.1)
fx('shine','s1',0.8,24)
# s2 «клиент выбирает того кого видит»: lowerthird ФАКТ + callout + bars(без видео/с видео)
fx('lowerthird','s2',0.3,58, title='ФАКТ', sub='выбирают того, кого видят', y=1150)
fx('callout','s2',1.8,40, x=0.5, y=0.30, label='листает мимо')
fx('bars','s2',3.4,56, data=[['без видео',22,GR],['с видео',100,OR]])
# s3 «видео работает месяцами, реклама пока платишь»: moneycount + bars(реклама/видео)
fx('moneycount','s3',0.4,54, val=50000, label='в месяц на рекламу', y=300)
fx('bars','s3',3.0,56, data=[['реклама',26,GR],['видео',100,OR]])
# s4 «доверие даёт лицо и голос»: lowerthird ДОВЕРИЕ + ratings 5
fx('lowerthird','s4',0.3,56, title='ДОВЕРИЕ', sub='лицо и голос продают', y=1150)
fx('ratings','s4',2.0,52, stars=5, val=5, label='вам доверяют', y=320)
# s5 «мы снимем — будут смотреть до конца»: toast + statcard(до конца)
fx('toast','s5',0.4,48, text='свет · звук · монтаж')
fx('statcard','s5',1.6,46, val=100, suf='%', label='досматривают', y=300)
fx('ticker','s2',0.0,300, text='V.CODE · видеопродакшн · Ставрополь · снимаем дорого · ')
# s6 CTA: dm + likes + stamp НАПИШИТЕ
fx('dm','s6',0.4,54, items=['СЪЕМКА','+1 заявка','запись открыта'], y=980)
fx('likes','s6',1.4,46, n=18)
fx('stamp','s6',2.3,42, text='НАПИШИТЕ', color=OR, x=0.5, y=0.30, rot=0.08)

json.dump([j for j,_ in fx_jobs], open(f'{DAY}/fx_jobs.json','w'), ensure_ascii=False)
print('fx jobs', len(fx_jobs))
r=subprocess.run(['node','motion/fx_engine.js', f'{DAY}/fx_jobs.json'], capture_output=True, text=True, cwd='.')
sys.stderr.write(r.stderr[-1500:]); print(r.stdout[-600:])

# --- 3D torus (свежая фигура/цвет) ---
three_dir=f'{DAY}/ov/three_coin'
tj=[dict(shape='coin', dir=three_dir, frames=34, dur=34/30, col='EA5920', col2='ffffff', scale=560)]
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
    sched.append(dict(dir=three_dir, t=round(at('s1',1.4),3), frames=34, scale=560))
json.dump(dict(sched=sched, gl=[d for _,d in GL] if GL_OK else [], bounds=tl['bounds'], total=tl['total']),
          open(f'{DAY}/stage2_plan.json','w'))
print('overlays ready:', len(sched), 'three', THREE_OK, 'gl', GL_OK)
