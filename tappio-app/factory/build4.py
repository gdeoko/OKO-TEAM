#!/usr/bin/env python3
"""Tappio reel builder v3 — модель shot-list.
- 12-18 уникальных 4К-клипов, каждый со своим движением (zoompan)
- xfade-переходы между КАЖДЫМ кадром (тип ротуется по seed, ничего не повторяется)
- анимированные наложения-инфографика (webm alpha) композитятся по таймлайну
- уникальная музыка на ролик (fetch_music) + whoosh на каждый переход
- караоке-субтитры из VO-битов, обложка кадром 0, эндкард
"""
import json, sys, os, subprocess, hashlib
FD = os.path.abspath("assets/fonts")
def probe(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())
def run(cmd, tag=""):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(tag+" FAIL\n"+" ".join(cmd)[:500]+"\n"+r.stderr[-3500:]+"\n"); raise SystemExit(1)
    return r
GRADES = {
 'teal_orange':"curves=r='0/0.05 0.5/0.52 1/1':b='0/0 0.5/0.44 1/0.92',eq=saturation=1.22:contrast=1.09,vignette=PI/4.6,noise=alls=3:allf=t",
 'clean_ad':"eq=contrast=1.06:saturation=1.12:brightness=0.008,colorbalance=rs=.02:bs=.015,vignette=PI/4.8,noise=alls=3:allf=t",
 'cold_cyan':"curves=b='0/0.06 0.5/0.55 1/1',eq=saturation=1.15:contrast=1.1,colorbalance=bs=.05:rs=-.02,vignette=PI/4.6,noise=alls=3:allf=t",
 'purple_dream':"eq=contrast=1.06:saturation=1.18:brightness=0.012,colorbalance=rs=.02:bs=.04:gm=-.02,vignette=PI/5,noise=alls=4:allf=t",
 'warm_gold':"eq=contrast=1.07:saturation=1.15:brightness=0.012,colorbalance=rs=.05:bs=-.03,vignette=PI/4.8,noise=alls=4:allf=t",
}
TRANS = ['fade','wipeleft','wiperight','slideup','slidedown','circleopen','circleclose','dissolve',
         'smoothleft','smoothright','diagtl','diagbr','squeezeh','squeezev','radial','pixelize',
         'zoomin','wipetl','wipebr','fadeblack','coverleft','revealleft','vuslice','hlslice']
MOTION = ['zin','zout','panr','panl','pandown','panup']
def zmotion(mode, fr):
    return {
     'zin':"z='min(1.02+0.0020*on,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
     'zout':"z='max(1.18-0.0020*on,1.02)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
     'panr':f"z=1.12:x='(iw-iw/zoom)*min(on/{fr},1)':y='ih/2-(ih/zoom/2)'",
     'panl':f"z=1.12:x='(iw-iw/zoom)*(1-min(on/{fr},1))':y='ih/2-(ih/zoom/2)'",
     'pandown':f"z=1.12:y='(ih-ih/zoom)*min(on/{fr},1)':x='iw/2-(iw/zoom/2)'",
     'panup':f"z=1.12:y='(ih-ih/zoom)*(1-min(on/{fr},1))':x='iw/2-(iw/zoom/2)'",
    }[mode]

def build_ass(words_by_seg, starts, acc, path):
    h = acc.lstrip('#'); ass_acc = f"&H00{h[4:6]}{h[2:4]}{h[0:2]}".upper()
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Base,Syne,76,&H00FFFFFF,&H000000FF,&H00000000,&HB4050709,-1,0,0,0,100,100,1,0,1,0,3,2,60,60,300,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
    def at(t):
        hh=int(t//3600); m=int(t%3600//60); s=t%60; return f"{hh:d}:{m:02d}:{s:05.2f}"
    lines=[]
    for seg,words in words_by_seg.items():
        base=starts[seg]; groups=[]; cur=[]; ln=0
        for w in words:
            wl=len(w['w'])
            if cur and (len(cur)>=3 or ln+wl>18): groups.append(cur); cur=[]; ln=0
            cur.append(w); ln+=wl+1
        if cur: groups.append(cur)
        for g in groups:
            g_end=base+g[-1]['t']+g[-1]['d']
            for i,w in enumerate(g):
                st=base+w['t']; en=base+g[i+1]['t'] if i+1<len(g) else g_end
                parts=[]
                for j,ww in enumerate(g):
                    txt=ww['w'].upper().replace('{','(').replace('}',')')
                    parts.append(("{\\c"+ass_acc+"}" if j==i else "{\\c&H00FFFFFF&}")+txt)
                lines.append(f"Dialogue: 0,{at(st)},{at(max(en,st+0.05))},Base,,0,0,0,,{' '.join(parts)}")
    open(path,'w').write(head+"\n".join(lines)+"\n")

def render_insert(src, shape, box, shapes_dir, pos, dur, out):
    """Форма-вставка (MOTION ARSENAL): footage в форме + кольцо над размытым/затемнённым фоном."""
    W,H=box; X=(1080-W)//2
    Y={'upper':300,'center':(1920-H)//2-70,'lower':1920-H-360}.get(pos,(1920-H)//2-70)
    mask=f"{shapes_dir}/{shape}_mask.png"; ring=f"{shapes_dir}/{shape}_ring.png"
    fc=(f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,"
        f"gblur=sigma=24,eq=brightness=-0.34:saturation=0.9,"
        f"zoompan=z='min(1.02+0.0016*on,1.14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30[bg];"
        f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30[fgc];[fgc][1:v]alphamerge[fg];"
        f"[bg][fg]overlay={X}:'{Y}+9*sin(t*1.4)'[b1];[b1][2:v]overlay={X}:'{Y}+9*sin(t*1.4)'[o]")
    run(['ffmpeg','-y','-v','error','-i',src,'-i',mask,'-i',ring,'-filter_complex',fc,
         '-map','[o]','-t',f'{dur:.2f}','-r','30','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',out],"INSERT")
    return out

def main():
    d=json.load(open(sys.argv[1])); wd=sys.argv[2]; out=sys.argv[3]
    acc=d["brand"]["accent"]; grade=d.get("grade","clean_ad")
    seed=int(hashlib.md5(d["id"].encode()).hexdigest(),16)
    beats=[s["id"] for s in d["segments"]]
    vo={s:probe(f"{wd}/vo/{s}.mp3") for s in beats}; cta_dur=probe(f"{wd}/vo/cta.mp3")
    words={s:json.load(open(f"{wd}/vo/{s}.json")) for s in beats}; words["cta"]=json.load(open(f"{wd}/vo/cta.json"))
    LEAD=1.3; GAP=0.24
    starts={}; t=LEAD
    for s in beats: starts[s]=t; t+=vo[s]+GAP
    cta_start=t; t_main_end=cta_start+cta_dur+0.5
    total_main=t_main_end
    endcard=2.6; XD=0.45; XDE=0.5
    total=total_main - XDE + endcard   # эндкард наезжает xfade'ом

    # ---- визуальный бед: N кадров с xfade ----
    shots=d["shots"]; N=len(shots)
    D=(total_main + (N-1)*XD)/N        # длина кадра с учётом overlap
    app=d.get("app","spy"); shapes_dir=f"assets/shapes/{app}"
    boxes=json.load(open(f"{shapes_dir}/_boxes.json")) if os.path.exists(f"{shapes_dir}/_boxes.json") else {}
    inputs=[]; fc=[]
    for i,sh in enumerate(shots):
        vis=sh.get("visual","stock"); ins=sh.get("insert")
        composed=False
        if str(vis).startswith("DEMO:"):
            src=f"appdemo/{vis[5:]}.mp4"; composed=True
        elif ins and ins in boxes:
            src=render_insert(f"{wd}/stock/shot_{i:02d}.mp4", ins, boxes[ins], shapes_dir,
                              sh.get("pos","center"), D+0.3, f"{wd}/ins_{i:02d}.mp4"); composed=True
        else:
            src=f"{wd}/stock/shot_{i:02d}.mp4"
        inputs+=['-i',src]
        fr=max(1,int(D*30)); mode=MOTION[(seed+i)%len(MOTION)]
        glitch=f",chromashift=crh=-8:cbh=8:enable='lt(t,0.06)'" if (seed+i)%3==0 else ""
        if composed:  # уже собран/двигается — без zoompan, лёгкий брэсинг
            fc.append(f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,"
                      f"tpad=stop_mode=clone:stop_duration=4,trim=0:{D+0.05:.3f},setpts=PTS-STARTPTS,setsar=1{glitch}[v{i}]")
        else:
            fc.append(f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,"
                      f"tpad=stop_mode=clone:stop_duration=4,trim=0:{D+0.05:.3f},setpts=PTS-STARTPTS,"
                      f"zoompan={zmotion(mode,fr)}:d=1:s=1080x1920:fps=30,setsar=1{glitch}[v{i}]")
    # xfade-цепь
    prev="v0"
    for k in range(1,N):
        tr=TRANS[(seed+k*7)%len(TRANS)]; off=k*(D-XD)
        lbl=f"x{k}"
        fc.append(f"[{prev}][v{k}]xfade=transition={tr}:duration={XD}:offset={off:.3f}[{lbl}]"); prev=lbl
    fc.append(f"[{prev}]{GRADES[grade]},trim=0:{total_main:.3f}[bed]")
    # эндкард
    ec_i=N; inputs+=['-loop','1','-framerate','30','-t',f'{endcard+0.3:.2f}','-i',f"{wd}/endcard.png"]
    fc.append(f"[{ec_i}:v]scale=1080:1920,fps=30,setsar=1[ecraw]")
    fc.append(f"[bed][ecraw]xfade=transition=fadeblack:duration={XDE}:offset={total_main-XDE:.3f}[withec]")
    # обложка кадром 0 — ИИ (Nano Banana Pro), иначе HTML-фолбэк
    ai_cov=d.get("cover",{}).get("ai")
    cov_png=ai_cov if (ai_cov and os.path.exists(ai_cov)) else f"{wd}/cover_ov.png"
    cov_i=N+1; inputs+=['-loop','1','-framerate','30','-t',f'{total:.2f}','-i',cov_png]
    fc.append(f"[{cov_i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=rgba,fps=30,fade=out:st={LEAD-0.35:.2f}:d=0.35:alpha=1[cov]")
    fc.append(f"[withec][cov]overlay=0:0:enable='between(t,0,{LEAD:.2f})'[base0]")
    # ---- анимированные наложения ----
    meta=json.load(open(f"{wd}/ovw/meta.json"))
    chain="[base0]"; ov_in_base=N+2
    for j,m in enumerate(meta):
        inputs+=['-i',m["file"]]
        idx=ov_in_base+j
        at=LEAD + m["at"]*(t_main_end-LEAD)
        dur=m["dur"]
        nl=f"[c{j}]"
        fc.append(f"[{idx}:v]setpts=PTS+{at:.3f}/TB[ovs{j}]")
        fc.append(f"{chain}[ovs{j}]overlay=0:0:enable='between(t,{at:.3f},{at+dur:.3f})'{nl}"); chain=nl
    fc.append(f"{chain}null[vout]")
    run(['ffmpeg','-y','-v','error']+inputs+['-filter_complex',';'.join(fc),'-map','[vout]','-t',f'{total:.2f}',
         '-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p',f"{wd}/stage_v.mp4"],"VIDEO")
    print("video ok",round(probe(f"{wd}/stage_v.mp4"),2),"| shots",N,"| overlays",len(meta))

    # ---- субтитры ----
    starts_all=dict(starts); starts_all["cta"]=cta_start
    build_ass(dict(words),starts_all,acc,f"{wd}/subs.ass")

    # ---- аудио: голос + уникальная музыка (дак) + whoosh на каждый переход ----
    seq=beats+["cta"]; a_in=[]; amaps=[]; k=0
    for s in seq:
        a_in+=['-i',f"{wd}/vo/{s}.mp3"]; st=starts_all[s]
        amaps.append(f"[{k}:a]adelay={int(st*1000)}|{int(st*1000)},volume=1.15[a{k}]"); k+=1
    a_in+=['-i',f"{wd}/aud/music.mp3"]; mi=k
    a_in+=['-i',f"aud_sfx/whoosh.mp3"] if os.path.exists("aud_sfx/whoosh.mp3") else ['-i',"work/spy_001/aud/whoosh.mp3"]; wi=k+1
    a_in+=['-i',"work/spy_001/aud/impact.mp3"]; ii=k+2
    a_in+=['-i',"work/spy_001/aud/click.mp3"]; di=k+3
    af=amaps[:]; vm="".join(f"[a{j}]" for j in range(k))
    af.append(f"{vm}amix=inputs={k}:normalize=0,asplit=2[voice1][voice2]")
    af.append(f"[{mi}:a]aloop=loop=-1:size=2e9,atrim=0:{total:.2f},volume=0.16,afade=in:st=0:d=1,afade=out:st={total-1.2:.2f}:d=1.2[mus]")
    # whoosh на каждый переход между кадрами
    sfx=[]
    for k2 in range(1,N):
        tcut=k2*(D-XD)
        sfx.append(f"[{wi}:a]atrim=0:0.5,adelay={int(tcut*1000)}|{int(tcut*1000)},volume=0.26[wh{k2}]")
    # impact на КАЖДОЙ цифровой инфографике (осмысленный SFX)
    NUM={'stat_count','ring','bars','ticker','stat'}
    imp_lbls=[]
    for j,m in enumerate(meta):
        oty=d["overlays"][m["i"]].get("type")
        if oty in NUM:
            t=LEAD+m["at"]*(t_main_end-LEAD)
            sfx.append(f"[{ii}:a]adelay={int(t*1000)}|{int(t*1000)},volume=0.55[im{j}]"); imp_lbls.append(f"[im{j}]")
    # ding на CTA
    sfx.append(f"[{di}:a]adelay={int(cta_start*1000)}|{int(cta_start*1000)},volume=0.5[ding]")
    af+=sfx
    all_sfx="".join(f"[wh{k2}]" for k2 in range(1,N))+"".join(imp_lbls)+"[ding]"
    n_sfx=(N-1)+len(imp_lbls)+1
    af.append(f"{all_sfx}amix=inputs={n_sfx}:normalize=0[sfxall]")
    af.append(f"[mus][voice1]sidechaincompress=threshold=0.03:ratio=6:attack=5:release=250[mduck]")
    af.append(f"[voice2][mduck][sfxall]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    run(['ffmpeg','-y','-v','error']+a_in+['-filter_complex',';'.join(af),'-map','[aout]','-t',f'{total:.2f}',f"{wd}/audio.m4a"],"AUDIO")
    print("audio ok")

    run(['ffmpeg','-y','-v','error','-i',f"{wd}/stage_v.mp4",'-i',f"{wd}/audio.m4a",
         '-filter_complex',f"[0:v]subtitles={wd}/subs.ass:fontsdir={FD}[v]",'-map','[v]','-map','1:a',
         '-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','150k',
         '-movflags','+faststart','-t',f'{total:.2f}',out],"MUX")
    print("FINAL",out,round(probe(out),2),"s",os.path.getsize(out)//1024,"KB")
main()
