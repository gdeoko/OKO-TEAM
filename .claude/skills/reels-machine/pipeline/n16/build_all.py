# -*- coding: utf-8 -*- n16 «Пиццерия сняла один ролик» — self-contained build (stage1/2/3).
import json, os, subprocess, sys, glob
sys.path.insert(0, os.path.abspath('.'))
import build_reel as BR

DAY='n16'; VO=f'{DAY}/vo'; C=f'{DAY}/clips'; OVD=f'{DAY}/ov'
SEGS=['s1','s2','s3','s4','s5','s6']
os.makedirs(OVD, exist_ok=True)

# --- новый грейд под тему (тёплый «огонь печи») ---
BR.GRADES['firelight']=("eq=contrast=1.09:saturation=1.16:brightness=0.008,"
  "curves=r='0/0.02 0.5/0.55 1/1':b='0/0 0.5/0.43 1/0.93',"
  "colorbalance=rs=.04:gs=.01:bs=-.03:rm=.02:bm=-.015,vignette=PI/4.6,noise=alls=4:allf=t")
GRADE='firelight'

tl=BR.timeline(VO, SEGS)
def at(seg,off): return (tl['cover'] if seg=='cover' else tl['starts'][seg])+off

# --- раскладка кадров по окнам сцен (нарратив: пусто -> процесс/огонь -> просмотры -> аншлаг -> люди -> CTA) ---
SC={
 's1':['c1_empty','c2_night'],
 's2':['c3_dough','c4_oven','c5_film'],
 's3':['c6_phone','c7_views','c13_scroll'],
 's4':['c8_busy','c9_reserve'],
 's5':['c10_diners','c11_studio'],
 's6':['c12_camera','c14_type'],
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

# --- GL transitions (5 свежих, мимо реестра) ---
GL=[('Mosaic','ov/g1'),('InvertedPageCurl','ov/g2'),('kaleidoscope','ov/g3'),('wind','ov/g4'),('squareswire','ov/g5')]
GL=[(n, f'{DAY}/{d.split("/")[-1]}') for n,d in GL]
try:
    if not os.path.exists(f'{DAY}/g5/015.png'):
        BR.make_gl_transitions(f'{DAY}/stage1.mp4', GL, tl['bounds'], gln=16, runner='motion/transitions_gl.cjs')
    else: print('gl cached')
    GL_OK=True
except Exception as e:
    print('GL fail, fallback to simple:', str(e)[:200]); GL_OK=False

# --- FX overlays (свежий набор: slam, gridpop, donut, profilecmp + бренд-фурнитура) ---
OR='#EA5920'; WH='#ffffff'; GR='#8a8a8a'
fx_jobs=[]
def fx(type, seg, off, fr, **kw):
    d=f'{OVD}/{type}_{seg}_{int(off*100)}'
    j=dict(type=type, dir=d, frames=fr, **kw); fx_jobs.append((j, at(seg,off))); return d
# cover: camera-UI рамка (бренд)
fx('camui','cover',0.0,50, tc='REC 00:03')
# s1 hook «пустовало по будням»: slam + stamp «ЗНАКОМО?»
fx('slam','s1',0.35,40, words=['ПУСТО','ПО БУДНЯМ'], colors=[WH,OR], y=0.42)
fx('stamp','s1',2.0,40, text='ЗНАКОМО?', color=OR, x=0.5, y=0.62, big=True, rot=-0.09)
fx('shine','s1',0.7,24)
# s2 «сняли одно видео, живой огонь»: lowerthird + callout(снимают процесс)
fx('lowerthird','s2',0.3,58, title='ОДИН РОЛИК', sub='живой огонь в кадре', y=1150)
fx('callout','s2',2.0,40, x=0.5, y=0.30, label='снимают процесс')
# s3 «триста тысяч просмотров за неделю»: statcard + gridpop + ticker
fx('statcard','s3',0.4,52, val=300000, label='просмотров за неделю', y=300)
fx('gridpop','s3',2.4,44, y=0.5)
fx('ticker','s3',0.0,300, text='V.CODE · видеопродакшн · Ставрополь · снимаем вкусно · ')
# s4 «столов не осталось, бронь на 2 недели»: donut(занято) + profilecmp(будни/пятница)
fx('donut','s4',0.4,54, val=100, x=0.5, y=0.28, label='занято')
fx('profilecmp','s4',2.2,54, cards=[['будни',30,GR],['пятница',100,OR]])
# s5 «люди идут за тем, что видели»: toast + likes
fx('toast','s5',0.4,48, text='свет · вкус · эмоция')
fx('likes','s5',1.8,46, n=24)
# s6 CTA: dm + likes-нет, stamp НАПИШИТЕ
fx('dm','s6',0.4,54, items=['СЪЕМКА','+1 бронь','запись открыта'], y=980)
fx('stamp','s6',2.2,42, text='НАПИШИТЕ', color=OR, x=0.5, y=0.30, rot=0.08)

json.dump([j for j,_ in fx_jobs], open(f'{DAY}/fx_jobs.json','w'), ensure_ascii=False)
print('fx jobs', len(fx_jobs))
r=subprocess.run(['node','motion/fx_engine.js', f'{DAY}/fx_jobs.json'], capture_output=True, text=True, cwd='.')
sys.stderr.write(r.stderr[-1500:]); print(r.stdout[-600:])

# --- 3D droplet (свежая фигура — давно не было; оранж) ---
three_dir=f'{DAY}/ov/three_droplet'
tj=[dict(shape='droplet', dir=three_dir, frames=34, dur=34/30, col='EA5920', col2='ffffff', scale=560)]
json.dump(tj, open(f'{DAY}/three_jobs.json','w'))
if not os.path.exists(f'{three_dir}/033.png'):
    r3=subprocess.run(['node','three/three_render.js', f'{DAY}/three_jobs.json'], capture_output=True, text=True, cwd='.')
else:
    class _R: stdout='cached';stderr=''
    r3=_R()
print('three:', r3.stdout[-200:], r3.stderr[-300:])
THREE_OK=os.path.exists(f'{three_dir}/033.png')

# расписание оверлеев для stage2
sched=[]
for j,t in fx_jobs:
    if os.path.exists(f'{j["dir"]}/{j["frames"]-1:03d}.png'):
        sched.append(dict(dir=j['dir'], t=round(t,3), frames=j['frames'], scale=None))
if THREE_OK:
    sched.append(dict(dir=three_dir, t=round(at('s3',1.4),3), frames=34, scale=560))
json.dump(dict(sched=sched, gl=[d for _,d in GL] if GL_OK else [], bounds=tl['bounds'], total=tl['total']),
          open(f'{DAY}/stage2_plan.json','w'))
print('overlays ready:', len(sched), 'three', THREE_OK, 'gl', GL_OK)
