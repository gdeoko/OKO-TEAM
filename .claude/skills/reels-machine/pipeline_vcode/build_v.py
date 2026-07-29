#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reels build engine: 7 vertical viral reels 1080x1920.
Per reel: unique clips, zoompan motion, xfade on every cut, per-reel grade,
PIL infographic overlays synced to voice, karaoke subs, watermark, progress bar,
voice + unique music duck + loudnorm, branded cover as first frame.
"""
import json, os, sys, subprocess, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FAC="/tmp/claude-0/-home-user-OKO-TEAM/4d03047f-7a59-58cd-ac9b-80a55112aa48/scratchpad/factory"
FONTS="/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"
LOGO="/home/user/OKO-TEAM/.claude/skills/reels-machine/logo_hd.png"
OUT=os.path.join(FAC,"out"); os.makedirs(OUT,exist_ok=True)
TMP=os.path.join(FAC,"tmp"); os.makedirs(TMP,exist_ok=True)
OVR=os.path.join(FAC,"overlays"); os.makedirs(OVR,exist_ok=True)

W,H=1080,1920
ORANGE=(234,89,32); WHITE=(255,255,255); DARK=(13,13,13); GREY=(150,150,150)
F_BLACK=os.path.join(FONTS,"montserrat-v31-cyrillic_latin-900.ttf")
F_BOLD =os.path.join(FONTS,"montserrat-v31-cyrillic_latin-700.ttf")
F_SOYUZ=os.path.join(FONTS,"soyuz.ttf")
F_MAN  =os.path.join(FONTS,"manrope-v20-cyrillic_latin-800.ttf")

def fnt(path,size): return ImageFont.truetype(path,size)
def run(cmd):
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode!=0:
        print("FFMPEG ERR:"," ".join(cmd)[:200]); print(r.stderr[-1500:]); raise SystemExit(1)
    return r
def probe_dur(p):
    r=subprocess.run(["ffprobe","-v","quiet","-show_entries","format=duration","-of","csv=p=0",p],
                     capture_output=True,text=True)
    try:return float(r.stdout.strip())
    except:return 0.0

# ---------- GRADES (ffmpeg eq/curves) ----------
GRADES={
 "warm_cine":"eq=contrast=1.12:saturation=1.18:gamma=0.98,colorbalance=rs=.06:gs=.02:bs=-.05:rm=.04:bm=-.03",
 "moody_dark":"eq=contrast=1.18:saturation=0.92:brightness=-0.03:gamma=0.94,colorbalance=rs=-.03:bs=.05:bm=.04",
 "clean_ad":"eq=contrast=1.08:saturation=1.10:brightness=0.02:gamma=1.02",
 "teal_orange":"eq=contrast=1.15:saturation=1.20,colorbalance=rs=.08:bs=.06:gm=-.03:bm=.05:rh=.05",
 "flower_soft":"eq=contrast=1.05:saturation=1.12:brightness=0.03:gamma=1.03,colorbalance=rs=.05:bs=.02",
 "noir_bw":"hue=s=0,eq=contrast=1.28:brightness=-0.02:gamma=0.96",
}

# ---------- PIL overlay helpers ----------
def new_canvas(): return Image.new("RGBA",(W,H),(0,0,0,0))
def rounded(draw,xy,r,fill=None,outline=None,width=0):
    draw.rounded_rectangle(xy,radius=r,fill=fill,outline=outline,width=width)
def shadow_text(base,pos,text,font,fill,anchor="la",shadow=(0,0,0,180),off=4):
    lay=Image.new("RGBA",base.size,(0,0,0,0)); d=ImageDraw.Draw(lay)
    d.text((pos[0]+off,pos[1]+off),text,font=font,fill=shadow,anchor=anchor)
    lay=lay.filter(ImageFilter.GaussianBlur(3)); base.alpha_composite(lay)
    d2=ImageDraw.Draw(base); d2.text(pos,text,font=font,fill=fill,anchor=anchor)

def wrap(text,font,maxw,draw):
    words=text.split(); lines=[]; cur=""
    for w in words:
        t=(cur+" "+w).strip()
        if draw.textlength(t,font=font)<=maxw: cur=t
        else:
            if cur:lines.append(cur)
            cur=w
    if cur:lines.append(cur)
    return lines

# each generator draws a mostly-transparent 1080x1920 PNG with brand infographic
def ov_badge(txt):
    img=new_canvas(); d=ImageDraw.Draw(img)
    f=fnt(F_BLACK,64); lines=wrap(txt.upper(),f,W-180,d)[:3]
    y=250;
    # top chip
    d.rounded_rectangle((90,150,90+430,150+70),radius=35,fill=ORANGE)
    shadow_text(img,(305,185),"V.CODE · ХУК",fnt(F_BOLD,34),WHITE,anchor="mm")
    for ln in lines:
        shadow_text(img,(90,y),ln,f,WHITE); y+=80
    d.rounded_rectangle((90,y+10,90+120,y+18),radius=4,fill=ORANGE)
    return img
def ov_counter(num,label):
    img=new_canvas(); d=ImageDraw.Draw(img)
    shadow_text(img,(W//2,760),num,fnt(F_BLACK,240),ORANGE,anchor="mm")
    shadow_text(img,(W//2,930),label.upper(),fnt(F_BOLD,52),WHITE,anchor="mm")
    return img
def ov_stamp(txt):
    img=new_canvas()
    st=Image.new("RGBA",(760,200),(0,0,0,0)); d=ImageDraw.Draw(st)
    d.rounded_rectangle((6,6,754,194),radius=18,outline=ORANGE,width=8)
    d.text((380,100),txt.upper(),font=fnt(F_BLACK,72),fill=ORANGE,anchor="mm")
    st=st.rotate(-8,expand=True,resample=Image.BICUBIC)
    img.alpha_composite(st,(int(W/2-st.width/2),300))
    return img
def ov_bars(pairs):
    # pairs: list of (label, value 0..1, text)
    img=new_canvas(); d=ImageDraw.Draw(img)
    x0=140; y0=560; bw=W-2*x0; gap=40; bh=90
    shadow_text(img,(x0,y0-110),"РЕЗУЛЬТАТ",fnt(F_BOLD,44),WHITE)
    for i,(lab,val,tx) in enumerate(pairs):
        y=y0+i*(bh+gap)
        d.rounded_rectangle((x0,y,x0+bw,y+bh),radius=18,fill=(255,255,255,40))
        d.rounded_rectangle((x0,y,x0+int(bw*val),y+bh),radius=18,fill=ORANGE)
        d.text((x0+24,y+bh//2),lab.upper(),font=fnt(F_BOLD,40),fill=WHITE,anchor="lm")
        d.text((x0+bw-24,y+bh//2),tx,font=fnt(F_BLACK,44),fill=WHITE,anchor="rm")
    return img
def ov_callout(txt):
    img=new_canvas(); d=ImageDraw.Draw(img)
    f=fnt(F_BLACK,70); lines=wrap(txt.upper(),f,W-200,d)[:3]
    bh=len(lines)*82+80; y0=int(H*0.62)
    d.rounded_rectangle((80,y0,W-80,y0+bh),radius=28,fill=(13,13,13,205),outline=ORANGE,width=5)
    y=y0+40
    for ln in lines:
        shadow_text(img,(W//2,y+30),ln,f,WHITE,anchor="mm"); y+=82
    return img
def ov_compare(a,b):
    img=new_canvas(); d=ImageDraw.Draw(img)
    y0=600;
    d.rounded_rectangle((100,y0,W-100,y0+150),radius=22,fill=(255,255,255,35))
    d.text((140,y0+75),a.upper(),font=fnt(F_BOLD,48),fill=GREY,anchor="lm")
    shadow_text(img,(W//2,y0+240),"↓",fnt(F_BLACK,90),ORANGE,anchor="mm")
    d.rounded_rectangle((100,y0+320,W-100,y0+470),radius=22,fill=ORANGE)
    d.text((140,y0+395),b.upper(),font=fnt(F_BLACK,54),fill=WHITE,anchor="lm")
    return img
def ov_cta(cta):
    img=new_canvas(); d=ImageDraw.Draw(img)
    d.rounded_rectangle((90,H//2-260,W-90,H//2+260),radius=40,fill=(13,13,13,225),outline=ORANGE,width=6)
    try:
        lg=Image.open(LOGO).convert("RGBA"); r=520/lg.width; lg=lg.resize((520,int(lg.height*r)))
        img.alpha_composite(lg,(int(W/2-lg.width/2),H//2-210))
    except Exception as e: print("logo",e)
    shadow_text(img,(W//2,H//2+60),"НАПИШИТЕ",fnt(F_BOLD,52),WHITE,anchor="mm")
    d.rounded_rectangle((W//2-250,H//2+110,W//2+250,H//2+200),radius=45,fill=ORANGE)
    shadow_text(img,(W//2,H//2+155),cta,fnt(F_BLACK,60),WHITE,anchor="mm")
    return img

def build_overlay(seg,reel_title):
    ov=seg["ov"]; txt=seg["text"]
    if ov=="badge": return ov_badge(reel_title.split(":")[0] if ":" in reel_title else txt)
    if ov=="counter":
        # extract a number-ish (case-insensitive), longest keys first
        import re
        low=txt.lower()
        mapping=[("десять тысяч",("10 000","листовок")),("пятьдесят девять",("$59 000 000","за минуту")),
                 ("сто тысяч",("100 000","подписчиков")),("двое суток",("48 часов","до очереди")),
                 ("три недели",("3 недели","очередь")),("миллион",("1 000 000","рублей на рекламу")),
                 ("двести",("200","просмотров")),("неделю",("7 дней","запись закрыта")),
                 ("семь дней",("7 дней","запись")),("год",("1 год","каждый день"))]
        for k,(n,l) in mapping:
            if k in low: return ov_counter(n,l)
        return ov_counter("×10","эффект")
    if ov=="stamp":
        low=txt.lower(); key="ОДИН РОЛИК"
        if "один ролик" in low or "сняли один" in low or "выложил один" in low: key="ОДИН РОЛИК"
        elif "крупным" in low or "мастера" in low: key="КРУПНЫЙ ПЛАН"
        elif "честный" in low: key="ЖИВОЙ КАДР"
        elif "первый кадр" in low or "цеплять" in low: key="ПЕРВЫЙ КАДР"
        return ov_stamp(key)
    if ov=="bars":
        return ov_bars([("было",0.18,"0"),("стало",0.95,"МАКС")])
    if ov=="callout": return ov_callout(txt)
    if ov=="compare":
        return ov_compare("миллион на рекламу","один живой ролик")
    if ov=="cta": return ov_cta(seg.get("cta","СЪЁМКА"))
    return new_canvas()

# ---------- COVER ----------
def build_cover(rid,reel):
    # use first clip frame + dark gradient + hook text + logo
    clips=CLIPS[rid]; first=None
    for s in reel["segments"]:
        if clips.get(s["id"]): first=clips[s["id"]][0]["path"]; break
    frame=os.path.join(TMP,f"{rid}_coverframe.png")
    run(["ffmpeg","-y","-i",first,"-vf","scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
         "-frames:v","1",frame])
    base=Image.open(frame).convert("RGBA")
    grad=Image.new("RGBA",(W,H),(0,0,0,0)); gd=ImageDraw.Draw(grad)
    for y in range(H):
        a=int(235*(y/H)**1.4)
        gd.line([(0,y),(W,y)],fill=(13,13,13,min(a,235)))
    base.alpha_composite(grad)
    d=ImageDraw.Draw(base)
    d.rounded_rectangle((80,H-720,80+380,H-650),radius=34,fill=ORANGE)
    d.text((270,H-685),"V.CODE",font=fnt(F_BLACK,44),fill=WHITE,anchor="mm")
    title=reel["title"].split(":")[-1].strip() if ":" in reel["title"] else reel["title"]
    f=fnt(F_BLACK,96); lines=wrap(title.upper(),f,W-160,d)[:4]
    y=H-600
    for ln in lines:
        shadow_text(base,(80,y),ln,f,WHITE); y+=104
    d.rounded_rectangle((80,y+20,80+160,y+30),radius=5,fill=ORANGE)
    try:
        lg=Image.open(LOGO).convert("RGBA"); r=300/lg.width; lg=lg.resize((300,int(lg.height*r)))
        base.alpha_composite(lg,(W-lg.width-70,120))
    except: pass
    cov=os.path.join(TMP,f"{rid}_cover.png"); base.convert("RGB").save(cov,quality=92)
    return cov

# ---------- CLIP PROCESS (zoompan) ----------
def process_clip(src,dst,slot,mode):
    FR=max(int(round(slot*30)),12)
    pre="scale=1296:2304:force_original_aspect_ratio=increase,crop=1296:2304"
    cx="iw/2-(iw/zoom/2)"; cy="ih/2-(ih/zoom/2)"
    if mode==0:  zp=f"zoompan=z='1.0+0.12*on/{FR}':d=1:x='{cx}':y='{cy}':s=1080x1920:fps=30"
    elif mode==1:zp=f"zoompan=z='1.12-0.12*on/{FR}':d=1:x='{cx}':y='{cy}':s=1080x1920:fps=30"
    elif mode==2:zp=f"zoompan=z=1.0:d=1:x='(iw-1080)*on/{FR}':y='(ih-1920)/2':s=1080x1920:fps=30"
    elif mode==3:zp=f"zoompan=z=1.0:d=1:x='(iw-1080)*(1-on/{FR})':y='(ih-1920)/2':s=1080x1920:fps=30"
    elif mode==4:zp=f"zoompan=z=1.0:d=1:x='(iw-1080)/2':y='(ih-1920)*on/{FR}':s=1080x1920:fps=30"
    else:        zp=f"zoompan=z=1.0:d=1:x='(iw-1080)/2':y='(ih-1920)*(1-on/{FR})':s=1080x1920:fps=30"
    vf=f"{pre},{zp},trim=duration={slot:.3f},setsar=1,format=yuv420p"
    run(["ffmpeg","-y","-stream_loop","3","-i",src,"-an","-vf",vf,"-r","30",
         "-t",f"{slot:.3f}","-c:v","libx264","-preset","veryfast","-crf","20",dst])

# ---------- KARAOKE ASS ----------
def ass_time(t):
    h=int(t//3600);m=int((t%3600)//60);s=t%60
    return f"{h:d}:{m:02d}:{s:05.2f}"
def build_ass(rid,segs,starts,path):
    head=f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: kar,Montserrat,86,&H00FFFFFF,&H002059EA,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,3,2,80,80,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines=[]
    for seg,st in zip(segs,starts):
        wj=json.load(open(seg["words"]))["words"]
        # group words into chunks of 2-3 (<=16 chars)
        chunks=[]; cur=[]
        for w in wj:
            tst=w["w"].strip()
            if not tst: continue
            cand=cur+[w]
            if sum(len(x["w"]) for x in cand)+len(cand)<=17 and len(cand)<=3:
                cur=cand
            else:
                if cur: chunks.append(cur)
                cur=[w]
        if cur: chunks.append(cur)
        for ch in chunks:
            cs=st+ch[0]["t"]; ce=st+ch[-1]["t"]+ch[-1]["d"]
            # highlight each word progressively via \k
            txt=""
            for wi,w in enumerate(ch):
                kdur=int(round(w["d"]*100))
                txt+=f"{{\\k{kdur}}}{w['w'].upper()} "
            lines.append(f"Dialogue: 0,{ass_time(cs)},{ass_time(ce)},kar,,0,0,0,,{{\\blur3}}{txt.strip()}")
    open(path,"w").write(head+"\n".join(lines)+"\n")

# ---------- MAIN PER REEL ----------
def build_reel(rid):
    reel=TTS[rid]; segs=reel["segments"]; grade=GRADES[reel["grade"]]
    # inject cta into cta segment
    for s in segs:
        s["cta"]=reel["cta"]
    # audio: concat voice segments; record starts
    starts=[]; t=0.0
    vlist=os.path.join(TMP,f"{rid}_v.txt");
    with open(vlist,"w") as f:
        for s in segs:
            starts.append(t); t+=s["dur"]
            f.write(f"file '{s['mp3']}'\n")
    T=t
    voice=os.path.join(TMP,f"{rid}_voice.mp3")
    run(["ffmpeg","-y","-f","concat","-safe","0","-i",vlist,"-c","copy",voice])
    voice_dur=probe_dur(voice); T=max(T,voice_dur)

    # choose clips (flatten in segment order), N by tempo ~2.7s
    flat=[]
    for s in segs:
        for c in CLIPS[rid].get(s["id"],[]): flat.append(c["path"])
    N=max(6,min(len(flat),int(round(T/2.7))))
    used=flat[:N]
    overlap=0.42
    slot=(T+(N-1)*overlap)/N
    # process each clip
    proc=[]
    for i,src in enumerate(used):
        dst=os.path.join(TMP,f"{rid}_p{i:02d}.mp4")
        process_clip(src,dst,slot+0.05,i%6)
        proc.append(dst)

    # xfade chain
    XF=["fade","fadeblack","wipeleft","wiperight","slideup","circleopen","dissolve","radial","smoothleft","pixelize"]
    inputs=[]
    for p in proc: inputs+=["-i",p]
    fc=""; cur="0:v"; acc=slot
    for i in range(1,N):
        off=acc-overlap
        xf=XF[(i-1)%len(XF)]
        out=f"x{i}"
        fc+=f"[{cur}][{i}:v]xfade=transition={xf}:duration={overlap:.3f}:offset={off:.3f}[{out}];"
        cur=out; acc=off+slot
    base=os.path.join(TMP,f"{rid}_base.mp4")
    fc_final=fc+f"[{cur}]trim=duration={T:.3f},setpts=PTS-STARTPTS,format=yuv420p[vout]"
    run(["ffmpeg","-y",*inputs,"-filter_complex",fc_final,"-map","[vout]",
         "-c:v","libx264","-preset","veryfast","-crf","20","-r","30",base])

    # overlays: build PNG per segment
    ov_inputs=[]; ov_meta=[]
    for i,(s,st) in enumerate(zip(segs,starts)):
        img=build_overlay(s,reel["title"])
        pth=os.path.join(OVR,f"{rid}_ov{i}.png"); img.save(pth)
        ov_inputs.append(pth); ov_meta.append((st,st+s["dur"]))

    # grade + watermark + progress bar + overlays composite
    cov=build_cover(rid,reel)
    # inputs: base(0), overlays(1..), logo/wm via drawtext
    gin=["-i",base]
    for p in ov_inputs: gin+=["-loop","1","-i",p]
    gfc=f"[0:v]{grade}[g];"
    # progress bar
    gfc+=f"[g]drawbox=x=0:y={H-10}:w=iw:h=10:color=black@0.35:t=fill[g2];"
    gfc+=(f"[g2]drawbox=x=0:y={H-10}:w='iw*t/{T:.3f}':h=10:color=0x{ORANGE[0]:02x}{ORANGE[1]:02x}{ORANGE[2]:02x}:t=fill[g3];")
    # watermark text
    gfc+=(f"[g3]drawtext=fontfile={F_BLACK}:text='V.CODE':x=w-tw-40:y=54:fontsize=44:"
          f"fontcolor=white:shadowcolor=black@0.6:shadowx=3:shadowy=3[cur0];")
    cur="cur0"
    for i,(a,b) in enumerate(ov_meta):
        idx=i+1
        fade=0.3
        nxt=f"cur{idx}"
        gfc+=(f"[{idx}:v]format=rgba,fade=t=in:st={a:.2f}:d={fade}:alpha=1,"
              f"fade=t=out:st={max(a, b-fade):.2f}:d={fade}:alpha=1[o{idx}];")
        gfc+=(f"[{cur}][o{idx}]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[{nxt}];")
        cur=nxt
    graded=os.path.join(TMP,f"{rid}_graded.mp4")
    gfc+=f"[{cur}]format=yuv420p[vf]"
    run(["ffmpeg","-y",*gin,"-filter_complex",gfc,"-map","[vf]","-t",f"{T:.3f}",
         "-c:v","libx264","-preset","medium","-crf","20","-r","30",graded])

    # karaoke ass
    ass=os.path.join(TMP,f"{rid}.ass"); build_ass(rid,segs,starts,ass)
    subbed=os.path.join(TMP,f"{rid}_sub.mp4")
    run(["ffmpeg","-y","-i",graded,"-vf",f"ass={ass}:fontsdir={FONTS}",
         "-c:v","libx264","-preset","medium","-crf","20","-r","30",subbed])

    # audio mix: voice + music duck
    mus=MUSIC.get(rid)
    final=os.path.join(OUT,f"{rid}.mp4")
    if mus and os.path.exists(mus["path"]):
        # input0=subbed(video only), input1=voice, input2=music(looped)
        afc=(f"[2:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.14,"
             f"afade=t=in:st=0:d=1,afade=t=out:st={max(0,T-1.2):.2f}:d=1.2[m];"
             f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,dynaudnorm=g=8,asplit=2[vk][vm];"
             f"[m][vk]sidechaincompress=threshold=0.03:ratio=8:attack=5:release=250[mc];"
             f"[vm][mc]amix=inputs=2:duration=first:weights='1 0.7',"
             f"loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
        run(["ffmpeg","-y","-i",subbed,"-i",voice,"-stream_loop","-1","-i",mus["path"],
             "-filter_complex",afc,"-map","0:v","-map","[aout]",
             "-c:v","copy","-c:a","aac","-b:a","192k","-t",f"{T:.3f}",
             "-movflags","+faststart",final])
    else:
        run(["ffmpeg","-y","-i",subbed,"-i",voice,"-map","0:v","-map","1:a",
             "-c:v","copy","-c:a","aac","-b:a","192k","-af","loudnorm=I=-14:TP=-1.5",
             "-t",f"{T:.3f}","-movflags","+faststart",final])

    # prepend cover 0.5s
    covclip=os.path.join(TMP,f"{rid}_covclip.mp4")
    run(["ffmpeg","-y","-loop","1","-i",cov,"-f","lavfi","-t","0.5","-i","anullsrc=r=44100:cl=stereo",
         "-vf","scale=1080:1920,setsar=1,format=yuv420p","-t","0.5","-r","30",
         "-c:v","libx264","-preset","veryfast","-c:a","aac","-shortest",covclip])
    withcover=os.path.join(OUT,f"{rid}_final.mp4")
    cc=os.path.join(TMP,f"{rid}_concat.txt")
    open(cc,"w").write(f"file '{covclip}'\nfile '{final}'\n")
    # re-encode concat (different params) via filter concat
    run(["ffmpeg","-y","-i",covclip,"-i",final,"-filter_complex",
         "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]",
         "-map","[v]","-map","[a]","-c:v","libx264","-preset","medium","-crf","21",
         "-c:a","aac","-b:a","192k","-r","30","-movflags","+faststart",withcover])
    sz=os.path.getsize(withcover)/1e6
    dur=probe_dur(withcover)
    print(f"{rid} DONE: {dur:.1f}s {sz:.1f}MB -> {withcover}")
    return withcover,cov

if __name__=="__main__":
    TTS=json.load(open(os.path.join(FAC,"tts_v_manifest.json")))
    CLIPS=json.load(open(os.path.join(FAC,"clips_v_manifest.json")))
    MUSIC=json.load(open(os.path.join(FAC,"music_manifest.json")))
    only=sys.argv[1:] or sorted(TTS.keys())
    for rid in only:
        print(f"\n########## BUILD {rid} ##########")
        build_reel(rid)
