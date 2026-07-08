#!/usr/bin/env python3
import json,sys,os,subprocess,re
FD=os.path.abspath("assets/fonts")
def probe(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())
def run(cmd):
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode: sys.stderr.write(r.stderr[-3000:]); raise SystemExit(1)
    return r

GRADES={
 'teal_orange':"curves=r='0/0.05 0.5/0.52 1/1':b='0/0 0.5/0.44 1/0.92',eq=saturation=1.22:contrast=1.09,vignette=PI/4.6,noise=alls=4:allf=t",
 'clean_ad':"eq=contrast=1.05:saturation=1.1:brightness=0.008,colorbalance=rs=.02:bs=.015,vignette=PI/4.8,noise=alls=3:allf=t",
}
ZOOM=[
 "z='min(1.03+0.0022*on,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
 "z='max(1.18-0.0022*on,1.03)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
 "z=1.12:x='(iw-iw/zoom)*min(on/{fr},1)':y='ih/2-(ih/zoom/2)'",
 "z=1.12:x='(iw-iw/zoom)*(1-min(on/{fr},1))':y='ih/2-(ih/zoom/2)'",
]

def ass_time(t):
    h=int(t//3600); m=int(t%3600//60); s=t%60
    return f"{h:d}:{m:02d}:{s:05.2f}"

def build_ass(words_by_seg, starts, acc, total, path):
    # accent hex #RRGGBB -> ASS &HBBGGRR&
    h=acc.lstrip('#'); ass_acc=f"&H00{h[4:6]}{h[2:4]}{h[0:2]}".upper()
    head=f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Base,Syne,74,&H00FFFFFF,&H000000FF,&H00000000,&HB4050709,-1,0,0,0,100,100,1,0,1,0,7,2,60,60,300,1
Style: Hi,Syne,74,{ass_acc},&H000000FF,&H00000000,&HB4050709,-1,0,0,0,100,100,1,0,1,0,7,2,60,60,300,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
    lines=[]
    # group words into lines of <=3 words / <=18 chars, karaoke highlight active word
    for seg,words in words_by_seg.items():
        base=starts[seg]
        groups=[]; cur=[]; ln=0
        for w in words:
            wl=len(w['w'])
            if cur and (len(cur)>=3 or ln+wl>18):
                groups.append(cur); cur=[]; ln=0
            cur.append(w); ln+=wl+1
        if cur: groups.append(cur)
        for g in groups:
            g_start=base+g[0]['t']; g_end=base+g[-1]['t']+g[-1]['d']
            for i,w in enumerate(g):
                st=base+w['t']; en=base+g[i+1]['t'] if i+1<len(g) else g_end
                parts=[]
                for j,ww in enumerate(g):
                    txt=ww['w'].upper().replace('{','(').replace('}',')')
                    parts.append(("{\\rHi}" if j==i else "{\\rBase}")+txt)
                lines.append(f"Dialogue: 0,{ass_time(st)},{ass_time(max(en,st+0.05))},Base,,0,0,0,,{' '.join(parts)}")
    open(path,'w').write(head+"\n".join(lines)+"\n")

def main():
    d=json.load(open(sys.argv[1])); wd=sys.argv[2]; out=sys.argv[3]
    acc=d["brand"]["accent"]; grade=d.get("grade","clean_ad")
    segs=[s["id"] for s in d["segments"]]
    vo={s:probe(f"{wd}/vo/{s}.mp3") for s in segs}
    cta_dur=probe(f"{wd}/vo/cta.mp3")
    words={s:json.load(open(f"{wd}/vo/{s}.json")) for s in segs}
    words["cta"]=json.load(open(f"{wd}/vo/cta.json"))
    # timeline
    COVER=1.2; GAP=0.28; LEAD=0.12
    starts={}; t=COVER+LEAD
    for s in segs: starts[s]=t; t+=vo[s]+GAP
    cta_start=t; t_main_end=cta_start+cta_dur+0.5
    endcard=2.6; total=t_main_end+endcard
    # scene windows (visual): cover[0..COVER], each seg fills to next start, cta shares last, endcard tail
    scene_ids=["cover"]+segs
    win={}
    win["cover"]=(0,COVER)
    for i,s in enumerate(segs):
        end = starts[segs[i+1]] if i+1<len(segs) else t_main_end
        win[s]=(starts[s]-LEAD if i==0 else starts[s]-GAP/2, end - (GAP/2 if i+1<len(segs) else 0))
    # rebuild simple contiguous windows
    cuts=[0,COVER]
    for i,s in enumerate(segs[:-1]): cuts.append(starts[segs[i+1]]-GAP/2)
    cuts.append(t_main_end)
    win={}; win["cover"]=(0,COVER)
    for i,s in enumerate(segs): win[s]=(cuts[i+1],cuts[i+2])
    # ---- STAGE 1: scene footage concat with motion + grade ----
    inputs=[]; fc=[]
    for i,sid in enumerate(scene_ids):
        dur=win[sid][1]-win[sid][0]
        src=f"{wd}/stock/{sid}.mp4"
        sdur=probe(src); seek=max(0,min(2.0, sdur-dur-0.2))
        inputs+=['-ss',f'{seek:.2f}','-t',f'{dur+0.25:.2f}','-i',src]
        fr=max(1,int(dur*30)); zp=ZOOM[i%4].format(fr=fr)
        glitch=f",chromashift=crh=-10:cbh=10:enable='lt(t,0.09)'" if i and i%2==0 else ""
        fc.append(f"[{i}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,"
                  f"zoompan={zp}:d=1:s=1080x1920:fps=30,setsar=1{glitch}[v{i}]")
    n=len(scene_ids)
    fc.append("".join(f"[v{i}]" for i in range(n))+f"concat=n={n}:v=1:a=0[cat]")
    fc.append(f"[cat]{GRADES[grade]}[g]")
    # endcard: append static
    inputs+=['-loop','1','-framerate','30','-t',f'{endcard:.2f}','-i',f"{wd}/endcard.png"]
    fc.append(f"[{n}:v]scale=1080:1920,fps=30,setsar=1,fade=in:st=0:d=0.4[ec]")
    fc.append(f"[g][ec]concat=n=2:v=1:a=0[base]")
    # overlays: cover_ov + per-seg overlays with fade in/out inside their window
    ov_inputs=[]; ov_idx=n+1; chain="[base]"
    ovs=[("cover_ov.png",0.0,COVER+0.3)]
    for s in segs:
        if os.path.exists(f"{wd}/ov/{s}.png"):
            a,b=win[s]; b=min(b-0.1, t_main_end-0.5); ovs.append((f"ov/{s}.png",a+0.15,b))
    for k,(png,a,b) in enumerate(ovs):
        inputs+=['-loop','1','-framerate','30','-t',f'{total:.2f}','-i',f"{wd}/{png}"]
        idx=ov_idx+k
        fc.append(f"[{idx}:v]format=rgba,fps=30,fade=in:st={a:.2f}:d=0.3:alpha=1,fade=out:st={b-0.3:.2f}:d=0.3:alpha=1[o{k}]")
        nl=f"[ov{k}]"
        fc.append(f"{chain}[o{k}]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'{nl}")
        chain=nl
    fc.append(f"{chain}null[vout]")
    run(['ffmpeg','-y','-v','error']+inputs+['-filter_complex',';'.join(fc),'-map','[vout]','-t',f'{total:.2f}',
         '-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p',f"{wd}/stage_v.mp4"])
    print("video ok",round(probe(f"{wd}/stage_v.mp4"),2),"s")
    # ---- KARAOKE ASS ----
    starts_all=dict(starts); starts_all["cta"]=cta_start
    words_all=dict(words)
    build_ass(words_all, starts_all, acc, total, f"{wd}/subs.ass")
    # ---- AUDIO: VO segments at starts + cta, music duck, sfx ----
    a_in=[]; amaps=[]; k=0
    seq=segs+["cta"]
    for s in seq:
        a_in+=['-i',f"{wd}/vo/{s}.mp3"]
        st=starts_all[s]
        amaps.append(f"[{k}:a]adelay={int(st*1000)}|{int(st*1000)},volume=1.15[a{k}]"); k+=1
    # music
    a_in+=['-i',f"{wd}/aud/music.mp3"]; mi=k
    a_in+=['-i',f"{wd}/aud/whoosh.mp3"]; wi=k+1
    a_in+=['-i',f"{wd}/aud/impact.mp3"]; ii=k+2
    af=amaps[:]
    voice_mix="".join(f"[a{j}]" for j in range(k))
    af.append(f"{voice_mix}amix=inputs={k}:normalize=0,asplit=2[voice1][voice2]")
    af.append(f"[{mi}:a]aloop=loop=-1:size=2e9,atrim=0:{total:.2f},volume=0.16,afade=in:st=0:d=1,afade=out:st={total-1.2:.2f}:d=1.2[mus]")
    # impact on cover hit + whoosh at first cut
    af.append(f"[{ii}:a]adelay=200|200,volume=0.7[imp]")
    af.append(f"[{wi}:a]adelay={int((COVER-0.05)*1000)}|{int((COVER-0.05)*1000)},volume=0.45[wh]")
    af.append(f"[mus][voice1]sidechaincompress=threshold=0.03:ratio=6:attack=5:release=250[mduck]")
    af.append(f"[voice2][mduck][imp][wh]amix=inputs=4:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    run(['ffmpeg','-y','-v','error']+a_in+['-filter_complex',';'.join(af),'-map','[aout]','-t',f'{total:.2f}',f"{wd}/audio.m4a"])
    print("audio ok")
    # ---- BURN subs + mux ----
    run(['ffmpeg','-y','-v','error','-i',f"{wd}/stage_v.mp4",'-i',f"{wd}/audio.m4a",
         '-filter_complex',f"[0:v]subtitles={wd}/subs.ass:fontsdir={FD}[v]",
         '-map','[v]','-map','1:a','-c:v','libx264','-preset','medium','-crf','24','-pix_fmt','yuv420p',
         '-c:a','aac','-b:a','150k','-movflags','+faststart','-t',f'{total:.2f}',out])
    print("FINAL",out,round(probe(out),2),"s",os.path.getsize(out)//1024,"KB")
main()
