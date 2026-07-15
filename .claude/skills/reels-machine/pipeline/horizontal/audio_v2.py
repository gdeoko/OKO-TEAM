import json,os,subprocess,glob
P=json.load(open('plan3.json')); P=sorted(P,key=lambda e:e['t0'])
def run(c): 
    r=subprocess.run(c,shell=True,capture_output=True,text=True)
    if r.returncode: print('ERR',c[:200],'\n',r.stderr[-800:]); raise SystemExit(1)
os.makedirs('vv',exist_ok=True)
# 1) per-beat voice slices from cc_1080, concat -> voice.m4a (matches video timeline)
starts=[]; cum=0
with open('vv/list.txt','w') as f:
    for e in P:
        d=round(e['t1']-e['t0'],3)
        out='vv/a%03d.m4a'%e['i']
        run('ffmpeg -v error -y -ss %.3f -t %.3f -i cc_1080.mp4 -vn -c:a aac -b:a 192k %s'%(e['t0'],d,out))
        f.write("file 'a%03d.m4a'\n"%e['i']); starts.append((e,cum)); cum+=d
run('ffmpeg -v error -y -f concat -safe 0 -i vv/list.txt -c copy voice.m4a')
DUR=cum
print('voice dur',round(DUR,2))
# 2) music sections (scaled to DUR)
secs=[('music/m1_intro.mp3',0,46),('music/m3_corp.mp3',46,118),('music/m4_dark.mp3',118,206),
      ('music/m5_uplift.mp3',206,286),('music/m6_cta.mp3',286,DUR)]
fil=[]; mins=[]
for k,(mf,a,b) in enumerate(secs):
    L=round(min(b,DUR)-a,2)
    if L<=0: continue
    fil.append("[%d:a]aformat=channel_layouts=stereo,atrim=0:%.2f,afade=t=in:st=0:d=0.8,afade=t=out:st=%.2f:d=0.8,asetpts=PTS-STARTPTS[m%d]"%(k,L,max(0.1,L-0.8),k))
    mins.append("[m%d]"%k)
inp=' '.join('-i %s'%s[0] for s in secs)
fil.append("".join(mins)+"concat=n=%d:v=0:a=1,volume=0.28[music]"%len(mins))
# 3) MEANINGFUL sfx by beat kind (impact on data/3D, ding on CTA, whoosh on stock/transition)
import glob as _g
def pick(lst): 
    r=sorted(_g.glob('sfx/%s'%lst)); return r[0] if r else None
BK={b['i']:(b['g'][1] if b['g'][0]=='comp' else b['g'][0]) for b in json.load(open('beats3.json'))}
WH=sorted(_g.glob('sfx/whoosh_*.mp3')); IM=sorted(_g.glob('sfx/impact_*.mp3')); DG=sorted(_g.glob('sfx/ding_*.mp3')); PO=sorted(_g.glob('sfx/pop_*.mp3'))
def sfx_for(i,n):
    k=BK.get(i,'')
    if k in ('subscribe','cta_title','name'): return (DG[n%len(DG)] if DG else (WH[0] if WH else None),0.24)
    if k in ('stat','compare','linechart','gauge','donut','map_routes','timeline','flowtree','list2num','list3b','list3c','list_brands','rule','kinetic','title'): return (IM[n%len(IM)] if IM else (WH[0] if WH else None),0.20)
    if k in ('glb','stock','photo','device','pill','arrows'): return (WH[n%len(WH)] if WH else None,0.18)
    return (WH[n%len(WH)] if WH else None,0.15)
sidx=len(secs); sfxin=[]; slbl=[]
for n,(e,st) in enumerate(starts):
    if st<0.15 or st>DUR-0.3: continue
    f,vol=sfx_for(e['i'],n)
    if not f: continue
    sfxin.append('-i %s'%f); ii=sidx+len(sfxin)-1
    d=int(st*1000)
    fil.append("[%d:a]aformat=channel_layouts=stereo,atrim=0:1.4,volume=%.2f,adelay=%d|%d[w%d]"%(ii,vol,d,d,n))
    slbl.append("[w%d]"%n)
fil.append("".join(slbl)+"amix=inputs=%d:normalize=0:dropout_transition=0[sfx]"%len(slbl))
# 4) mix voice + ducked music + sfx
vidx=sidx+len(sfxin)
inp2=inp+' '+' '.join(sfxin)+' -i voice.m4a'
fil.append("[%d:a]aformat=channel_layouts=stereo,dynaudnorm=f=200:g=6,asplit=2[vv][vkey]"%vidx)
fil.append("[music][vkey]sidechaincompress=threshold=0.06:ratio=6:attack=15:release=300[musd]")
fil.append("[vv][musd][sfx]amix=inputs=3:normalize=0,alimiter=limit=0.96[aout]")
open('fa2.txt','w').write(";".join(fil))
run('ffmpeg -v error -y %s -filter_complex_script fa2.txt -map "[aout]" -c:a aac -b:a 192k full_a.m4a'%inp2)
print('audio ok, sfx',len(slbl))
