# -*- coding: utf-8 -*- V.CODE daily autopilot — spec-driven reel builder.
# Собирает ОДИН ролик из JSON-спеки проверенным конвейером (Silero + Pexels + cover_flux +
# музыка + sfx + stage1/gl/fx/3d/stage2/stage3). Разнообразие fx/gl/3d/grade — авто-ротацией
# по индексу n (число ранее собранных автопилотом роликов). Запуск из cwd = pipeline/.
#   python3 <this> <spec.json> <DAY_DIR> <n_index> <used_ids.json>
import json, os, subprocess, sys, re, wave, urllib.parse
sys.path.insert(0, os.path.abspath('.'))
import build_reel as BR

CA='/root/.ccr/ca-bundle.crt'
OR='#EA5920'; WH='#ffffff'; GR='#8a8a8a'

# ---------- пулы разнообразия (ротация по n) ----------
GL_POOL=[
 ['Mosaic','InvertedPageCurl','kaleidoscope','wind','squareswire'],
 ['CrossZoom','Rolls','StereoViewer','Overexposure','ZoomLeftWipe'],
 ['windowslice','Swirl','doorway','Fold','hexagonalize'],
 ['ButterflyWaveScrawler','undulatingBurnOut','crosshatch','swap','randomsquares'],
 ['GridFlip','polar_function','PolkaDotsCurtain','Radial','SimpleZoom'],
 ['WaterDrop','Dreamy','cube','Bounce','ripple'],
]
SHAPE_POOL=['droplet','coin','torus','diamond','ring']
GRADE_POOL=[
 ('firelight',"eq=contrast=1.09:saturation=1.16:brightness=0.008,curves=r='0/0.02 0.5/0.55 1/1':b='0/0 0.5/0.43 1/0.93',colorbalance=rs=.04:gs=.01:bs=-.03:rm=.02:bm=-.015,vignette=PI/4.6,noise=alls=4:allf=t"),
 ('bold_punch',"eq=contrast=1.12:saturation=1.18:brightness=0.006,curves=all='0/0 0.5/0.47 1/1',colorbalance=rs=.02:bs=-.015,vignette=PI/4.5,noise=alls=4:allf=t"),
 ('crisp_studio',"eq=contrast=1.10:saturation=1.08:brightness=0.006,unsharp=5:5:0.8,colorbalance=rs=.015:bs=.01,vignette=PI/4.7,noise=alls=3:allf=t"),
 ('warm_cine',"eq=contrast=1.06:saturation=1.12:brightness=0.01,colorbalance=rs=.03:bs=-.02,vignette=PI/5,noise=alls=4:allf=t"),
 ('teal_orange',"curves=r='0/0.05 0.5/0.52 1/1':b='0/0 0.5/0.44 1/0.92',eq=saturation=1.3:contrast=1.1,vignette=PI/4.6"),
 ('moody_dark',"eq=contrast=1.14:saturation=0.98:brightness=-0.02,curves=all='0/0.02 0.5/0.44 1/0.96',vignette=PI/4.2,noise=alls=5:allf=t"),
]
S4_STYLE=['donut','bars','profilecmp','ratings']  # ротация «сравнивающего» виджета

def sh(cmd, **kw): return subprocess.run(cmd, capture_output=True, text=True, **kw)

# ---------- 1. Silero TTS ----------
def tts(spec, DAY, SEGS):
    import torch
    VOICE='eugene'; SR=48000; SPEED=0.97; MODEL='models/v4_ru.pt'
    os.makedirs(f'{DAY}/vo', exist_ok=True)
    torch.set_num_threads(max(1,(os.cpu_count() or 2)))
    if not os.path.exists(MODEL):
        os.makedirs('models', exist_ok=True)
        sh(['curl','-sL','--cacert',CA,'-o',MODEL,'https://models.silero.ai/models/tts/ru/v4_ru.pt'])
    model=torch.package.PackageImporter(MODEL).load_pickle("tts_models","model"); model.to('cpu')
    def strip_acc(s): return ''.join(c for c in s if c not in ('́','̀'))
    def dur(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())
    for sid in SEGS:
        clean=strip_acc(spec['segs'][sid]); ok=False
        for a in range(4):
            try:
                wav=model.apply_tts(text=clean, speaker=VOICE, sample_rate=SR, put_accent=True, put_yo=True)
                pcm=(wav.numpy()*32767).astype('<i2'); raw=f'{DAY}/vo/{sid}.wav'
                with wave.open(raw,'wb') as w:
                    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
                sh(['ffmpeg','-y','-v','error','-i',raw,'-filter:a',f'atempo={SPEED}','-ar','44100',f'{DAY}/vo/{sid}.mp3'])
                os.remove(raw)
                if os.path.getsize(f'{DAY}/vo/{sid}.mp3')>2500: ok=True; break
            except Exception as e: print(sid,'tts retry',a,str(e)[:100])
        if not ok: raise SystemExit(f'{sid} tts failed')
        D=dur(f'{DAY}/vo/{sid}.mp3'); words=[strip_acc(w) for w in re.findall(r'[^\s]+',spec['segs'][sid])]
        wt=[]
        for w in words:
            core=re.sub(r'[^\wЀ-ӿ]','',w); pause=0.35 if re.search(r'[.,!?:;]',w) else 0.0
            wt.append(max(1,len(core))+pause*4)
        tot=sum(wt); t=0.0; out=[]; lead=0.10*D; span=D-lead-0.05
        for w,ww in zip(words,wt):
            d=span*ww/tot; out.append({'w':re.sub(r'[.,!?:;]+$','',w),'t':round(lead+t,3),'d':round(d,3)}); t+=d
        json.dump(out,open(f'{DAY}/vo/{sid}.json','w'),ensure_ascii=False)
    print('tts ok', len(SEGS),'segs')

# ---------- 2. Pexels fetch + download ----------
def fetch_clips(spec, DAY, used_path):
    KEY=os.environ['PEXELS_API_KEY']
    used=set(json.load(open(used_path))) if os.path.exists(used_path) else set()
    def cj(u): return json.loads(subprocess.check_output(['curl','-s','--max-time','30','--cacert',CA,'-H',f'Authorization: {KEY}',u]))
    picks={}
    for name,q in spec['queries'].items():
        got=None
        for page in (1,2,3,4):
            u=f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&size=medium&per_page=15&page={page}"
            try: data=cj(u)
            except Exception as e: print(name,'ERR',e); continue
            cands=[]
            for v in data.get('videos',[]):
                if v['id'] in used or v['id'] in [p['id'] for p in picks.values()]: continue
                files=[f for f in v['video_files'] if f['height'] and f['width'] and f['height']>f['width'] and f['height']>=1900]
                if not files: continue
                files.sort(key=lambda f:abs(f['height']-2160)); cands.append((v['id'],v['duration'],files[0]))
            cands=[c for c in cands if 3<=c[1]<=40]
            if cands: got=cands[0]; break
        if not got: raise SystemExit(f'{name}: no clip for "{q}"')
        vid,d,f=got; picks[name]={'id':vid,'dur':d,'url':f['link']}
        print(name,vid,d)
    os.makedirs(f'{DAY}/clips',exist_ok=True)
    for name,info in picks.items():
        out=f"{DAY}/clips/{name}.mp4"
        sh(['curl','-s','--max-time','120','--cacert',CA,'-o',out,info['url']])
        if not os.path.exists(out) or os.path.getsize(out)<20000: raise SystemExit(f'{name} download failed')
    json.dump(picks, open(f'{DAY}/clips_manifest.json','w'), indent=1)
    return [p['id'] for p in picks.values()]

# ---------- 3. cover / music / sfx ----------
def make_cover(spec, DAY):
    cov=spec.get('cover',{})
    r=sh(['python3','motion/cover_flux.py', cov.get('prompt','V.CODE video production studio, cinematic'),
          cov.get('headline','V.CODE'), f'{DAY}/cover.jpg', '../logo_hd.png'])
    if not os.path.exists(f'{DAY}/cover.jpg'):
        # аварийный фолбэк: первый клип как стилл
        first=sorted(os.listdir(f'{DAY}/clips'))[0]
        sh(['ffmpeg','-y','-v','error','-i',f'{DAY}/clips/{first}','-frames:v','1','-vf','scale=768:1376:force_original_aspect_ratio=increase,crop=768:1376',f'{DAY}/cover.jpg'])
    print('cover ok', os.path.exists(f'{DAY}/cover.jpg'))

def make_music(spec, DAY):
    KEY=os.environ.get('FREESOUND_API_KEY',''); os.makedirs(f'{DAY}/music',exist_ok=True)
    q=urllib.parse.quote(spec.get('music_query','inspiring cinematic'))
    url=f"https://freesound.org/apiv2/search/text/?query={q}&filter=duration:%5B40%20TO%20200%5D&fields=id,previews&page_size=5&sort=score&token={KEY}"
    try:
        d=json.loads(subprocess.check_output(['curl','-s','--max-time','40','--cacert',CA,url]))
        prev=d['results'][0]['previews']['preview-hq-mp3']
        sh(['curl','-sL','--max-time','60','--cacert',CA,'-o',f'{DAY}/music/track.mp3',prev])
    except Exception as e: print('music err',str(e)[:100])
    ok=os.path.exists(f'{DAY}/music/track.mp3') and os.path.getsize(f'{DAY}/music/track.mp3')>10000
    if not ok:  # тихий фолбэк — синтетический пад, чтобы сборка не падала
        sh(['ffmpeg','-y','-v','error','-f','lavfi','-i','sine=frequency=110:duration=60','-af','tremolo=f=0.2:d=0.6,volume=0.4','-ar','44100',f'{DAY}/music/track.mp3'])
    print('music ok')

def make_sfx(DAY):
    sh(['python3','motion/sfx_bank.py',DAY])
    need=['whoosh1','impact1','pop1','ding1','riser1']
    have=all(os.path.exists(f'{DAY}/sfx/{n}.mp3') for n in need)
    if not have:  # фолбэк-щелчки, чтобы finalize не падал
        os.makedirs(f'{DAY}/sfx',exist_ok=True)
        for cat in ['whoosh','impact','pop','ding','riser','swoosh']:
            for i in (1,2,3):
                p=f'{DAY}/sfx/{cat}{i}.mp3'
                if not os.path.exists(p):
                    sh(['ffmpeg','-y','-v','error','-f','lavfi','-i','anoisesrc=d=0.4:c=pink:a=0.3','-af','afade=t=out:st=0.1:d=0.3','-ar','44100',p])
    print('sfx ok')

# ---------- 4. fx auto-plan ----------
def fx_plan(spec, n, tl, at):
    c=spec.get('content',{}); jobs=[]
    def fx(type, seg, off, fr, **kw): jobs.append((dict(type=type, **kw), seg, off, fr))
    fx('camui','cover',0.0,50, tc=f'REC 00:0{(n%5)+1}')
    # s1 hook
    hw=c.get('hook_words')
    if hw: fx('slam','s1',0.35,40, words=hw[:2], colors=[WH,OR], y=0.42)
    else:  fx('statcard','s1',0.35,44, val=c.get('main_stat',1), suf='', label=c.get('main_label','')[:22], y=300)
    fx('stamp','s1',2.0,40, text=c.get('hook_stamp','А ВЫ?'), color=OR, x=0.5, y=0.62, big=True, rot=-0.09)
    fx('shine','s1',0.7,24)
    # s2
    fx('lowerthird','s2',0.3,58, title=c.get('lt_title','ФАКТ'), sub=c.get('lt_sub','')[:30], y=1150)
    fx('callout','s2',2.0,40, x=0.5, y=0.30, label=c.get('callout','смотрите'))
    # s3 main number
    fx('statcard','s3',0.4,52, val=int(c.get('main_stat',100)), label=c.get('main_label','просмотров')[:22], y=300)
    fx('gridpop','s3',2.4,44, y=0.5)
    fx('ticker','s3',0.0,300, text=c.get('ticker','V.CODE · видеопродакшн · Ставрополь · '))
    # s4 сравнивающий виджет — ротация
    style=S4_STYLE[n % len(S4_STYLE)]; cmp=c.get('cmp',[['было',30],['стало',100]])
    if style=='donut':      fx('donut','s4',0.5,54, val=int(cmp[1][1]), x=0.5, y=0.28, label=c.get('occ_label','результат'))
    elif style=='bars':     fx('bars','s4',0.5,56, data=[[str(cmp[0][0]),int(cmp[0][1]),GR],[str(cmp[1][0]),int(cmp[1][1]),OR]])
    elif style=='ratings':  fx('ratings','s4',0.5,52, stars=5, val=5, label=c.get('occ_label','доверяют'), y=320)
    else:                   fx('profilecmp','s4',0.5,54, cards=[[str(cmp[0][0]),int(cmp[0][1]),GR],[str(cmp[1][0]),int(cmp[1][1]),OR]])
    # s5
    fx('toast','s5',0.4,48, text=c.get('toast','свет · звук · монтаж'))
    fx('likes','s5',1.8,46, n=12+(n%3)*6)
    # s6 CTA
    fx('dm','s6',0.4,54, items=c.get('cta',['СЪЕМКА','+1 заявка','запись открыта'])[:3], y=980)
    fx('stamp','s6',2.2,42, text='НАПИШИТЕ', color=OR, x=0.5, y=0.30, rot=0.08)
    return jobs

# ---------- 5. STAGE1 + gl + fx + 3d ----------
def build_video(spec, DAY, n, SEGS):
    gradek, gradev = GRADE_POOL[n % len(GRADE_POOL)]; BR.GRADES[gradek]=gradev
    tl=BR.timeline(f'{DAY}/vo', SEGS)
    def at(seg,off): return (tl['cover'] if seg=='cover' else tl['starts'][seg])+off
    # раскладка кадров
    shots=[]
    for seg,(w0,w1) in zip(SEGS, tl['windows']):
        names=spec['scene_map'][seg]; d=(w1-w0)/len(names)
        for nm in names:
            src=f'{DAY}/clips/{nm}.mp4'; avail=BR.probe(src); seek=min(0.6, max(0.0, avail-d-0.4))
            shots.append((src, seek, d))
    if not os.path.exists(f'{DAY}/stage1.mp4'):
        BR.stage1(shots, tl, f'{DAY}/cover.jpg', '../logo_hd.png', out=f'{DAY}/stage1.mp4', grade=gradek)
    # gl
    names=GL_POOL[n % len(GL_POOL)]
    GL=[(nm, f'{DAY}/g{i+1}') for i,nm in enumerate(names)]
    GL_OK=True
    try:
        if not os.path.exists(f'{DAY}/g5/015.png'):
            BR.make_gl_transitions(f'{DAY}/stage1.mp4', GL, tl['bounds'], gln=16, runner='motion/transitions_gl.cjs')
    except Exception as e: print('GL fail:',str(e)[:150]); GL_OK=False
    # fx
    os.makedirs(f'{DAY}/ov', exist_ok=True); jobs=fx_plan(spec, n, tl, at); fxj=[]
    for j,seg,off,fr in jobs:
        d=f'{DAY}/ov/{j["type"]}_{seg}_{int(off*100)}'; jj=dict(j); jj['dir']=d; jj['frames']=fr
        fxj.append((jj, at(seg,off)))
    json.dump([j for j,_ in fxj], open(f'{DAY}/fx_jobs.json','w'), ensure_ascii=False)
    r=sh(['node','motion/fx_engine.js', f'{DAY}/fx_jobs.json'], cwd='.'); sys.stderr.write(r.stderr[-1200:])
    # 3d
    shape=SHAPE_POOL[n % len(SHAPE_POOL)]; three_dir=f'{DAY}/ov/three_{shape}'
    tj=[dict(shape=shape, dir=three_dir, frames=34, dur=34/30, col='EA5920', col2='ffffff', scale=560)]
    json.dump(tj, open(f'{DAY}/three_jobs.json','w'))
    if not os.path.exists(f'{three_dir}/033.png'):
        sh(['node','three/three_render.js', f'{DAY}/three_jobs.json'], cwd='.')
    THREE_OK=os.path.exists(f'{three_dir}/033.png')
    sched=[]
    for j,t in fxj:
        if os.path.exists(f'{j["dir"]}/{j["frames"]-1:03d}.png'):
            sched.append(dict(dir=j['dir'], t=round(t,3), frames=j['frames'], scale=None))
    if THREE_OK: sched.append(dict(dir=three_dir, t=round(at('s3',1.4),3), frames=34, scale=560))
    json.dump(dict(sched=sched, gl=[d for _,d in GL] if GL_OK else [], bounds=tl['bounds'], total=tl['total']),
              open(f'{DAY}/stage2_plan.json','w'))
    print('video built: overlays',len(sched),'three',THREE_OK,'gl',GL_OK)
    return tl

# ---------- 6. STAGE2 + STAGE3 (композит + караоке + звук) ----------
def finalize(spec, DAY, SEGS, tl):
    plan=json.load(open(f'{DAY}/stage2_plan.json')); total=plan['total']; bounds=plan['bounds']; GLN=16
    def run(cmd):
        r=subprocess.run(cmd,capture_output=True,text=True)
        if r.returncode!=0: sys.stderr.write(r.stderr[-2500:]); raise SystemExit('ffmpeg fail')
    overlays=[]
    for gdir, tb in zip(plan['gl'], bounds[1:]): overlays.append((gdir, tb-(GLN/2)/30, GLN))
    for s in plan['sched']: overlays.append((s['dir'], s['t'], s['frames']))
    inputs=['-i',f'{DAY}/stage1.mp4']
    for d,t,fr in overlays: inputs+=['-framerate','30','-i',f'{d}/%03d.png']
    fc=[]; cur='0:v'
    for k,(d,t,fr) in enumerate(overlays, start=1):
        fc.append(f"[{k}:v]setpts=PTS+{t:.3f}/TB[o{k}]"); nxt=f"c{k}"
        fc.append(f"[{cur}][o{k}]overlay=0:0:eof_action=pass[{nxt}]"); cur=nxt
    fc.append(f"[{cur}]format=yuv420p[vout]")
    if not os.path.exists(f'{DAY}/stage2.mp4'):
        run(['ffmpeg','-y','-v','error']+inputs+['-filter_complex',';'.join(fc),'-map','[vout]','-t',f'{total:.2f}','-r','30','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',f'{DAY}/stage2.mp4'])
    # karaoke ASS
    def fmt(t):
        h=int(t//3600); t-=h*3600; m=int(t//60); t-=m*60; s=int(t); cs=int((t-s)*100); return f"{h}:{m:02d}:{s:02d}.{cs:02d}"
    head=("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n[V4+ Styles]\n"
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
      "Style: Sub,Soyuz Grotesk,82,&H002059EA&,&H00FFFFFF,&H00101010,&H64000000,-1,0,0,0,100,100,1,0,1,0,0,2,90,90,330,204\n"
      "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    def esc(w): return w.replace('{','').replace('}','').upper()
    events=[]
    for s in SEGS:
        words=json.load(open(f'{DAY}/vo/{s}.json')); base=tl['starts'][s]; lines=[]; cur2=[]; ln=0
        for w in words:
            wl=len(w['w'])
            if cur2 and (len(cur2)>=2 or ln+wl+1>16): lines.append(cur2); cur2=[]; ln=0
            cur2.append(w); ln+=wl+1
        if cur2: lines.append(cur2)
        for line in lines:
            st=base+line[0]['t']; en=base+line[-1]['t']+line[-1]['d']+0.12; parts=[]
            for i,w in enumerate(line):
                nxt=line[i+1]['t'] if i+1<len(line) else (w['t']+w['d']); k=max(6,int(round((nxt-w['t'])*100)))
                parts.append("{\\k"+str(k)+"}"+esc(w['w']))
            events.append(f"Dialogue: 0,{fmt(st)},{fmt(en)},Sub,,0,0,0,,{' '.join(parts)}")
    open(f'{DAY}/subs.ass','w').write(head+'\n'.join(events)+'\n')
    # audio
    inp=['-i',f'{DAY}/stage2.mp4']; idx=[1]
    def add(*a):
        inp.extend(a); i=idx[0]; idx[0]+=1; return i
    vo_i={s:add('-i',f'{DAY}/vo/{s}.mp3') for s in SEGS}; I_MUS=add('-i',f'{DAY}/music/track.mp3')
    def sfx(name): return add('-i',f'{DAY}/sfx/{name}.mp3')
    S_wh=[sfx('whoosh1'),sfx('whoosh2'),sfx('whoosh3'),sfx('swoosh1'),sfx('swoosh2')]
    S_imp=[sfx('impact1'),sfx('impact2')]; S_pop=[sfx('pop1'),sfx('pop2')]; S_ding=sfx('ding1'); S_riser=sfx('riser1')
    os.makedirs(f'{DAY}/fonts',exist_ok=True); subprocess.run(['cp','fonts/soyuz.ttf',f'{DAY}/fonts/soyuz.ttf'])
    fa=[f"[0:v]ass={DAY}/subs.ass:fontsdir={DAY}/fonts[vout]"]; vparts=[]
    for s in SEGS:
        ms=int(tl['starts'][s]*1000); fa.append(f"[{vo_i[s]}:a]adelay={ms}|{ms},dynaudnorm=g=7[v_{s}]"); vparts.append(f"[v_{s}]")
    fa.append("".join(vparts)+f"amix=inputs={len(SEGS)}:normalize=0,volume=2.0[voall]")
    fa.append("[voall]asplit=2[vo][voduck]")
    fa.append(f"[{I_MUS}:a]aloop=loop=-1:size=2000000000,atrim=0:{total:.2f},asetpts=PTS-STARTPTS,volume=0.15,afade=t=in:d=1.4,afade=t=out:st={total-2.6:.2f}:d=2.6[musraw]")
    fa.append("[musraw][voduck]sidechaincompress=threshold=0.05:ratio=6:attack=15:release=450:makeup=1[mus]")
    sfx_lab=[]; c2=[0]
    def place(inp_i, at_t, dur, vol):
        c2[0]+=1; lab=f"sx{c2[0]}"; ms=int(at_t*1000)
        fa.append(f"[{inp_i}:a]atrim=0:{dur},afade=t=out:st={max(0,dur-0.06):.2f}:d=0.06,adelay={ms}|{ms},volume={vol}[{lab}]"); sfx_lab.append(f"[{lab}]")
    def A(seg,off): return tl['starts'][seg]+off
    for i,tb in enumerate(tl['bounds'][1:]): place(S_wh[i%len(S_wh)], tb-0.18, 0.6, 0.4)
    place(S_imp[0], A('s1',0.35), 0.7, 0.5); place(S_imp[1], A('s3',0.4), 0.7, 0.5)
    place(S_pop[0], A('s3',2.4), 0.4, 0.42); place(S_pop[1], A('s4',0.5), 0.4, 0.42); place(S_pop[0], A('s6',2.2), 0.4, 0.4)
    place(S_riser, A('s5',2.4), 1.6, 0.28); place(S_ding, A('s6',0.5), 0.6, 0.4)
    fa.append("[vo][mus]"+"".join(sfx_lab)+f"amix=inputs={2+len(sfx_lab)}:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11,apad,atrim=0:{total:.2f}[aout]")
    run(['ffmpeg','-y','-v','error']+inp+['-filter_complex',';'.join(fa),'-map','[vout]','-map','[aout]','-t',f'{total:.2f}','-r','30','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k',f'{DAY}/reel.mp4'])
    print('reel ok', round(BR.probe(f'{DAY}/reel.mp4'),2),'s', os.path.getsize(f'{DAY}/reel.mp4')//1024,'KB')

def main():
    spec_path, DAY, n, used_path = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    spec=json.load(open(spec_path)); SEGS=['s1','s2','s3','s4','s5','s6']
    os.makedirs(DAY, exist_ok=True)
    # идемпотентность: не переделывать уже готовые тяжёлые шаги (безопасный повтор/FORCE)
    if all(os.path.exists(f'{DAY}/vo/{s}.mp3') for s in SEGS): print('tts cached')
    else: tts(spec, DAY, SEGS)
    if os.path.exists(f'{DAY}/clips_manifest.json') and all(os.path.exists(f'{DAY}/clips/{n2}.mp4') for n2 in spec['queries']):
        print('clips cached'); new_ids=[p['id'] for p in json.load(open(f'{DAY}/clips_manifest.json')).values()]
    else: new_ids=fetch_clips(spec, DAY, used_path)
    if not os.path.exists(f'{DAY}/cover.jpg'): make_cover(spec, DAY)
    else: print('cover cached')
    if not (os.path.exists(f'{DAY}/music/track.mp3') and os.path.getsize(f'{DAY}/music/track.mp3')>10000): make_music(spec, DAY)
    else: print('music cached')
    if not os.path.exists(f'{DAY}/sfx/whoosh1.mp3'): make_sfx(DAY)
    else: print('sfx cached')
    tl=build_video(spec, DAY, n, SEGS)
    finalize(spec, DAY, SEGS, tl)
    # POST.txt
    open(f'{DAY}/POST.txt','w').write(spec.get('post',''))
    json.dump(new_ids, open(f'{DAY}/new_ids.json','w'))
    print('BUILD_DONE', DAY)

if __name__=='__main__': main()
