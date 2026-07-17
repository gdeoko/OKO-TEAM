# -*- coding: utf-8 -*- n16 stage2 (composite) + stage3 (karaoke + audio)
import json, os, subprocess, sys, glob
sys.path.insert(0, os.path.abspath('.'))
import build_reel as BR
DAY='n16'; VO=f'{DAY}/vo'
SEGS=['s1','s2','s3','s4','s5','s6']
tl=BR.timeline(VO, SEGS)
plan=json.load(open(f'{DAY}/stage2_plan.json'))
total=plan['total']
def run(cmd):
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode!=0:
        sys.stderr.write(' '.join(cmd)[:400]+'\n'+r.stderr[-3000:]); raise SystemExit(1)

# ================= STAGE 2: composite gl + overlays =================
bounds=plan['bounds']; GLN=16
overlays=[]
for gdir, tb in zip(plan['gl'], bounds[1:]):
    overlays.append((gdir, tb-(GLN/2)/30, GLN))
for s in plan['sched']:
    overlays.append((s['dir'], s['t'], s['frames']))

inputs=['-i',f'{DAY}/stage1.mp4']
for d,t,fr in overlays:
    inputs+=['-framerate','30','-i',f'{d}/%03d.png']
fc=[]; cur='0:v'
for k,(d,t,fr) in enumerate(overlays, start=1):
    fc.append(f"[{k}:v]setpts=PTS+{t:.3f}/TB[o{k}]")
    nxt=f"c{k}"
    fc.append(f"[{cur}][o{k}]overlay=0:0:eof_action=pass[{nxt}]")
    cur=nxt
fc.append(f"[{cur}]format=yuv420p[vout]")
if not os.path.exists(f'{DAY}/stage2.mp4'):
    run(['ffmpeg','-y','-v','error']+inputs+['-filter_complex',';'.join(fc),
     '-map','[vout]','-t',f'{total:.2f}','-r','30','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',f'{DAY}/stage2.mp4'])
print('stage2 ok', round(BR.probe(f'{DAY}/stage2.mp4'),2))

# ================= STAGE 3: karaoke ASS =================
def fmt(t):
    h=int(t//3600); t-=h*3600; m=int(t//60); t-=m*60; s=int(t); cs=int((t-s)*100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
head=r"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Soyuz Grotesk,82,&H002059EA&,&H00FFFFFF,&H00101010,&H64000000,-1,0,0,0,100,100,1,0,1,0,0,2,90,90,330,204
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
def esc(w): return w.replace('{','').replace('}','').upper()
events=[]
for s in SEGS:
    words=json.load(open(f'{VO}/{s}.json'))
    base=tl['starts'][s]
    lines=[]; cur=[]; ln=0
    for w in words:
        wl=len(w['w'])
        if cur and (len(cur)>=2 or ln+wl+1>16): lines.append(cur); cur=[]; ln=0
        cur.append(w); ln+=wl+1
    if cur: lines.append(cur)
    for line in lines:
        st=base+line[0]['t']; en=base+line[-1]['t']+line[-1]['d']+0.12
        parts=[]
        for i,w in enumerate(line):
            nxt=line[i+1]['t'] if i+1<len(line) else (w['t']+w['d'])
            k=max(6,int(round((nxt-w['t'])*100)))
            parts.append(r"{\k"+str(k)+r"}"+esc(w['w']))
        events.append(f"Dialogue: 0,{fmt(st)},{fmt(en)},Sub,,0,0,0,,{' '.join(parts)}")
open(f'{DAY}/subs.ass','w').write(head+'\n'.join(events)+'\n')
print('ass events', len(events))

# ================= STAGE 3: audio =================
inp=['-i',f'{DAY}/stage2.mp4']; idx=1
def add(*a):
    global idx; inp.extend(a); i=idx; idx+=1; return i
vo_i={s:add('-i',f'{VO}/{s}.mp3') for s in SEGS}
I_MUS=add('-i',f'{DAY}/music/track.mp3')
def sfx(name): return add('-i',f'{DAY}/sfx/{name}.mp3')
S_wh=[sfx('whoosh1'),sfx('whoosh2'),sfx('whoosh3'),sfx('swoosh1'),sfx('swoosh2')]
S_imp=[sfx('impact1'),sfx('impact2')]
S_pop=[sfx('pop1'),sfx('pop2')]
S_ding=sfx('ding1')
S_riser=sfx('riser1')

fa=[f"[0:v]ass={DAY}/subs.ass:fontsdir={DAY}/fonts[vout]"]
os.makedirs(f'{DAY}/fonts',exist_ok=True)
subprocess.run(['cp','fonts/soyuz.ttf',f'{DAY}/fonts/soyuz.ttf'])
vparts=[]
for s in SEGS:
    ms=int(tl['starts'][s]*1000)
    fa.append(f"[{vo_i[s]}:a]adelay={ms}|{ms},dynaudnorm=g=7[v_{s}]"); vparts.append(f"[v_{s}]")
fa.append("".join(vparts)+f"amix=inputs={len(SEGS)}:normalize=0,volume=2.0[voall]")
fa.append("[voall]asplit=2[vo][voduck]")
fa.append(f"[{I_MUS}:a]aloop=loop=-1:size=2000000000,atrim=0:{total:.2f},asetpts=PTS-STARTPTS,"
          f"volume=0.15,afade=t=in:d=1.4,afade=t=out:st={total-2.6:.2f}:d=2.6[musraw]")
fa.append(f"[musraw][voduck]sidechaincompress=threshold=0.05:ratio=6:attack=15:release=450:makeup=1[mus]")
sfx_lab=[]; c=0
def place(inp_i, at_t, dur, vol):
    global c; c+=1; lab=f"sx{c}"; ms=int(at_t*1000)
    fa.append(f"[{inp_i}:a]atrim=0:{dur},afade=t=out:st={max(0,dur-0.06):.2f}:d=0.06,adelay={ms}|{ms},volume={vol}[{lab}]")
    sfx_lab.append(f"[{lab}]")
def A(seg,off): return tl['starts'][seg]+off
# whoosh на 5 gl-переходах
for i,tb in enumerate(tl['bounds'][1:]):
    place(S_wh[i%len(S_wh)], tb-0.18, 0.6, 0.4)
# impact на слэме и главной цифре
place(S_imp[0], A('s1',0.35), 0.7, 0.5)
place(S_imp[1], A('s3',0.4), 0.7, 0.5)
# pop на появлении графики
place(S_pop[0], A('s3',2.4), 0.4, 0.42)   # gridpop
place(S_pop[1], A('s4',0.4), 0.4, 0.42)   # donut
place(S_pop[0], A('s6',2.2), 0.4, 0.4)    # stamp НАПИШИТЕ
# riser нагнетание перед CTA
place(S_riser, A('s5',2.6), 1.6, 0.28)
# ding на CTA
place(S_ding, A('s6',0.5), 0.6, 0.4)

fa.append("[vo][mus]"+"".join(sfx_lab)+f"amix=inputs={2+len(sfx_lab)}:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11,apad,atrim=0:{total:.2f}[aout]")
run(['ffmpeg','-y','-v','error']+inp+['-filter_complex',';'.join(fa),
     '-map','[vout]','-map','[aout]','-t',f'{total:.2f}','-r','30',
     '-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p',
     '-c:a','aac','-b:a','192k',f'{DAY}/reel.mp4'])
print('reel ok', round(BR.probe(f'{DAY}/reel.mp4'),2),'s', os.path.getsize(f'{DAY}/reel.mp4')//1024,'KB')
