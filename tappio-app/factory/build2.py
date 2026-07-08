#!/usr/bin/env python3
"""Tappio reel builder v2 - app-demo scenes, animated overlays, kinetic titles,
transition flashes, per-reel effect rotation. Timeline stays audio-synced (hard cuts
+ overlay transition effects), so no xfade offset math."""
import json,sys,os,subprocess,hashlib
FD=os.path.abspath("assets/fonts")
def probe(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())
def run(cmd):
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode: sys.stderr.write(" ".join(cmd)[:400]+"\n"+r.stderr[-3000:]); raise SystemExit(1)
    return r
GRADES={
 'teal_orange':"curves=r='0/0.05 0.5/0.52 1/1':b='0/0 0.5/0.44 1/0.92',eq=saturation=1.22:contrast=1.09,vignette=PI/4.6,noise=alls=3:allf=t",
 'clean_ad':"eq=contrast=1.06:saturation=1.12:brightness=0.008,colorbalance=rs=.02:bs=.015,vignette=PI/4.8,noise=alls=3:allf=t",
 'cold_cyan':"curves=b='0/0.06 0.5/0.55 1/1',eq=saturation=1.15:contrast=1.1,colorbalance=bs=.05:rs=-.02,vignette=PI/4.6,noise=alls=3:allf=t",
 'purple_dream':"eq=contrast=1.06:saturation=1.18:brightness=0.012,colorbalance=rs=.02:bs=.04:gm=-.02,vignette=PI/5,noise=alls=4:allf=t",
 'warm_gold':"eq=contrast=1.07:saturation=1.15:brightness=0.012,colorbalance=rs=.05:bs=-.03,vignette=PI/4.8,noise=alls=4:allf=t",
}
# motion presets (zoompan) - rotated per scene
def zmotion(mode,fr):
    return {
     'zin':"z='min(1.03+0.0022*on,1.20)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
     'zout':"z='max(1.20-0.0022*on,1.03)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
     'panr':f"z=1.13:x='(iw-iw/zoom)*min(on/{fr},1)':y='ih/2-(ih/zoom/2)'",
     'panl':f"z=1.13:x='(iw-iw/zoom)*(1-min(on/{fr},1))':y='ih/2-(ih/zoom/2)'",
     'pandown':f"z=1.13:y='(ih-ih/zoom)*min(on/{fr},1)':x='iw/2-(iw/zoom/2)'",
    }[mode]

# overlay entrance animations: return (x_expr, y_expr, alpha via fade) for overlay filter
def ov_anim(style,a,b):
    """returns (setup_filters_on_overlay_input, overlay_xy) using absolute time t."""
    din=0.42; dout=0.3
    fade=f"fade=in:st={a:.2f}:d={din}:alpha=1,fade=out:st={b-dout:.2f}:d={dout}:alpha=1"
    if style=='slideup':
        return fade, f"0:'if(lt(t,{a+din}),H*0.04*(1-(t-{a})/{din}),0)'"
    if style=='slidedown':
        return fade, f"0:'if(lt(t,{a+din}),-H*0.04*(1-(t-{a})/{din}),0)'"
    if style=='slideleft':
        return fade, f"'if(lt(t,{a+din}),W*0.05*(1-(t-{a})/{din}),0)':0"
    return fade, "0:0"  # plain fade / pop (pop handled by scale in PNG render if needed)

def build_ass(words_by_seg, starts, acc, path, style='karaoke'):
    h=acc.lstrip('#'); ass_acc=f"&H00{h[4:6]}{h[2:4]}{h[0:2]}".upper()
    head=f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Base,Syne,76,&H00FFFFFF,&H000000FF,&H00000000,&HB4050709,-1,0,0,0,100,100,1,0,1,0,3,2,60,60,320,1
Style: Hi,Syne,76,{ass_acc},&H000000FF,&H00000000,&HB4050709,-1,0,0,0,100,100,1,0,1,0,3,2,60,60,320,1
[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
    def at(t):
        h=int(t//3600); m=int(t%3600//60); s=t%60; return f"{h:d}:{m:02d}:{s:05.2f}"
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
                    parts.append(("{\\rHi}" if j==i else "{\\rBase}")+txt)
                lines.append(f"Dialogue: 0,{at(st)},{at(max(en,st+0.05))},Base,,0,0,0,,{' '.join(parts)}")
    open(path,'w').write(head+"\n".join(lines)+"\n")

def main():
    d=json.load(open(sys.argv[1])); wd=sys.argv[2]; out=sys.argv[3]
    acc=d["brand"]["accent"]; grade=d.get("grade","clean_ad")
    rid=d["id"]; seed=int(hashlib.md5(rid.encode()).hexdigest(),16)
    segs=[s["id"] for s in d["segments"]]
    vo={s:probe(f"{wd}/vo/{s}.mp3") for s in segs}; cta_dur=probe(f"{wd}/vo/cta.mp3")
    words={s:json.load(open(f"{wd}/vo/{s}.json")) for s in segs}; words["cta"]=json.load(open(f"{wd}/vo/cta.json"))
    COVER=1.3; GAP=0.26; LEAD=0.1
    starts={}; t=COVER+LEAD
    for s in segs: starts[s]=t; t+=vo[s]+GAP
    cta_start=t; t_main_end=cta_start+cta_dur+0.5; endcard=2.6; total=t_main_end+endcard
    cuts=[0,COVER]
    for i,s in enumerate(segs[:-1]): cuts.append(starts[segs[i+1]]-GAP/2)
    cuts.append(t_main_end)
    scene_ids=["cover"]+segs; win={"cover":(0,COVER)}
    for i,s in enumerate(segs): win[s]=(cuts[i+1],cuts[i+2])
    MOTION=['zin','panr','zout','panl','pandown']
    inputs=[]; fc=[]
    for i,sid in enumerate(scene_ids):
        dur=win[sid][1]-win[sid][0]
        seg=next((x for x in d["segments"] if x["id"]==sid),None)
        vis=(seg or {}).get("visual","stock")
        if vis.startswith("DEMO:"):
            src=f"appdemo/{vis[5:]}.mp4"; sdur=probe(src); seek=0.0
            inputs+=['-ss',f'{seek:.2f}','-t',f'{dur+0.25:.2f}','-i',src]
            fc.append(f"[{i}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,setsar=1[v{i}]")
            continue
        src=f"{wd}/stock/{sid}.mp4"; sdur=probe(src); seek=max(0,min(2.0,sdur-dur-0.2))
        inputs+=['-ss',f'{seek:.2f}','-t',f'{dur+0.25:.2f}','-i',src]
        fr=max(1,int(dur*30)); mode=MOTION[(seed+i)%len(MOTION)]; zp=zmotion(mode,fr)
        glitch=f",chromashift=crh=-10:cbh=10:enable='lt(t,0.08)'" if i and (seed+i)%2==0 else ""
        fc.append(f"[{i}:v]trim=0:{dur:.3f},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,"
                  f"zoompan={zp}:d=1:s=1080x1920:fps=30,setsar=1{glitch}[v{i}]")
    n=len(scene_ids)
    fc.append("".join(f"[v{i}]" for i in range(n))+f"concat=n={n}:v=1:a=0[cat]")
    fc.append(f"[cat]{GRADES[grade]}[g]")
    inputs+=['-loop','1','-framerate','30','-t',f'{endcard:.2f}','-i',f"{wd}/endcard.png"]
    fc.append(f"[{n}:v]scale=1080:1920,fps=30,setsar=1,fade=in:st=0:d=0.4[ec]")
    fc.append(f"[g][ec]concat=n=2:v=1:a=0[base]")
    # transition flash overlays at each internal cut (brand glow streak)
    chain="[base]"
    # overlays: cover + per-seg, with animated entrance
    ov_styles=['slideup','pop','slideleft','slidedown','pop','slideup']
    ovs=[("cover_ov.png",0.0,COVER+0.35,'fadecover')]
    seg_by_id={x["id"]:x for x in d["segments"]}
    for j,s in enumerate(segs):
        if not os.path.exists(f"{wd}/ov/{s}.png"): continue
        segd=seg_by_id.get(s,{}); vis=segd.get("visual","stock"); oty=segd.get("overlay",{}).get("type")
        # demo scenes already carry their own UI text: skip big centered overlays there
        if vis.startswith("DEMO:") and oty in ("stat","chips","kinetic"): continue
        a,b=win[s]; b=min(b-0.1,cta_start-0.1); a=a+0.12
        if b-a>0.7: ovs.append((f"ov/{s}.png",a,b,ov_styles[(seed+j)%len(ov_styles)]))
    ov_base=n+1
    for k,(png,a,b,style) in enumerate(ovs):
        inputs+=['-loop','1','-framerate','30','-t',f'{total:.2f}','-i',f"{wd}/{png}"]
        idx=ov_base+k; fade,xy=ov_anim(style if style!='fadecover' else 'plain',a,b)
        fc.append(f"[{idx}:v]format=rgba,fps=30,{fade}[o{k}]")
        nl=f"[ov{k}]"; fc.append(f"{chain}[o{k}]overlay={xy}:enable='between(t,{a:.2f},{b:.2f})'{nl}"); chain=nl
    fc.append(f"{chain}null[vout]")
    run(['ffmpeg','-y','-v','error']+inputs+['-filter_complex',';'.join(fc),'-map','[vout]','-t',f'{total:.2f}',
         '-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p',f"{wd}/stage_v.mp4"])
    print("video ok",round(probe(f"{wd}/stage_v.mp4"),2))
    starts_all=dict(starts); starts_all["cta"]=cta_start
    build_ass(dict(words),starts_all,acc,f"{wd}/subs.ass")
    # audio
    a_in=[]; amaps=[]; k=0; seq=segs+["cta"]
    for s in seq:
        a_in+=['-i',f"{wd}/vo/{s}.mp3"]; st=starts_all[s]
        amaps.append(f"[{k}:a]adelay={int(st*1000)}|{int(st*1000)},volume=1.15[a{k}]"); k+=1
    a_in+=['-i',f"{wd}/aud/music.mp3"]; mi=k
    a_in+=['-i',f"{wd}/aud/whoosh.mp3"]; wi=k+1
    a_in+=['-i',f"{wd}/aud/impact.mp3"]; ii=k+2
    af=amaps[:]; vm="".join(f"[a{j}]" for j in range(k))
    af.append(f"{vm}amix=inputs={k}:normalize=0,asplit=2[voice1][voice2]")
    af.append(f"[{mi}:a]aloop=loop=-1:size=2e9,atrim=0:{total:.2f},volume=0.15,afade=in:st=0:d=1,afade=out:st={total-1.2:.2f}:d=1.2[mus]")
    af.append(f"[{ii}:a]adelay=200|200,volume=0.7[imp]")
    af.append(f"[{wi}:a]adelay={int((COVER-0.05)*1000)}|{int((COVER-0.05)*1000)},volume=0.4[wh]")
    af.append(f"[mus][voice1]sidechaincompress=threshold=0.03:ratio=6:attack=5:release=250[mduck]")
    af.append(f"[voice2][mduck][imp][wh]amix=inputs=4:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    run(['ffmpeg','-y','-v','error']+a_in+['-filter_complex',';'.join(af),'-map','[aout]','-t',f'{total:.2f}',f"{wd}/audio.m4a"])
    print("audio ok")
    run(['ffmpeg','-y','-v','error','-i',f"{wd}/stage_v.mp4",'-i',f"{wd}/audio.m4a",
         '-filter_complex',f"[0:v]subtitles={wd}/subs.ass:fontsdir={FD}[v]",'-map','[v]','-map','1:a',
         '-c:v','libx264','-preset','medium','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-b:a','150k','-movflags','+faststart','-t',f'{total:.2f}',out])
    print("FINAL",out,round(probe(out),2),"s",os.path.getsize(out)//1024,"KB")
main()
