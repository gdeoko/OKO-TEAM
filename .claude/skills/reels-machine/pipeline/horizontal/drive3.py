import json,os,glob
from fmts import SHAPES,PHOTO_ORDER,STOCK_ORDER
B=json.load(open('beats3.json'))
os.makedirs('aov3',exist_ok=True)
PNGS=sorted(glob.glob('photos3d/*.png'))
# photos -> premium shapes; stocks -> mix of fullscreen + shapes (all distinct treatments)
PHOTO_STOCKS=['iphone_hand','phone_repair','data_center','typing_laptop','handshake','foldable_hands','gadgets']
PHOTO_BEATS=[b['i'] for b in B if b['g'][0]=='photo']
STOCK_BEATS=[b['i'] for b in B if b['g'][0]=='stock']
FMT_BY_BEAT={}
for k,bi in enumerate(PHOTO_BEATS): FMT_BY_BEAT[bi]=PHOTO_ORDER[k%len(PHOTO_ORDER)]
for k,bi in enumerate(STOCK_BEATS): FMT_BY_BEAT[bi]=STOCK_ORDER[k%len(STOCK_ORDER)]
# place -> comp over-params (opos,oscale,oy)
PLACE={
 'center':   ('C',0.80,None),
 'bottom':   ('C',0.60,470),
 'lowbar':   ('C',0.55,660),   # true bottom lower-third, off face
 'left':     ('L',0.50,None),
 'right':    ('R',0.46,None),
 'rightsmall':('R',0.38,None),
 'split':    ('R',0.50,None),
}
jobs=[]; plan=[]; pidx=0
# reassign specific placements per feedback
DEVICE_CENTER={15,30}
LOWBAR={0,68,69}       # name/subscribe -> off face at very bottom
MEDIABIG_STOCK={7,39,54}  # boxed split stocks -> big feathered center
FS_STOCK={11,23,49}       # panel stocks -> fullscreen
for b in B:
    i=b['i']; g=b['g']; place=b['place']; dur=round(b['t1']-b['t0'],2)
    entry={'i':i,'t0':b['t0'],'t1':b['t1'],'trans':b['trans'],'gtype':g[0],'place':place}
    if g[0]=='comp':
        kind=g[1]
        if i in LOWBAR: place='lowbar'; entry['place']='lowbar'
        if i in DEVICE_CENTER: place='center'; entry['place']='center'
        P=dict(g[2]); P.update(kind=kind,dur=dur,seed=i)
        if kind=='device' and place=='center': P['pos']='C'
        if place=='fs':
            pass
        else:
            opos,osc,oy=PLACE.get(place,('C',0.7,None))
            P.update(over=True,opos=opos,oscale=osc)
            if oy: P['oy']=oy
        jobs.append({'id':'b%d'%i,'params':P}); entry['graphic']='over'
    elif g[0]=='photo':
        # NO static photos — use distinct stock VIDEOS in the premium shapes
        clip=PHOTO_STOCKS[pidx%len(PHOTO_STOCKS)]; pidx+=1
        entry['graphic']='shaped'; entry['clip']='broll_norm/%s.mp4'%clip; entry['fmt']=FMT_BY_BEAT[i]
    elif g[0]=='glb':
        entry['graphic']='glb'; entry['glb']='glbwebm/g%s.webm'%g[1]; entry['glbname']=g[1]
    elif g[0]=='stock':
        entry['graphic']='shaped'; entry['clip']='broll_norm/%s.mp4'%g[1]; entry['fmt']=FMT_BY_BEAT[i]
    plan.append(entry)
json.dump(jobs,open('anim/jobs3.json','w'),ensure_ascii=False)
json.dump(plan,open('plan3.json','w'),ensure_ascii=False,indent=0)
from collections import Counter
print('overlay jobs:',len(jobs),'| graphic:',Counter(e['graphic'] for e in plan))
print('places:',Counter(e['place'] for e in plan))
