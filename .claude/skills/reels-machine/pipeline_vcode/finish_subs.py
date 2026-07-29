#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Re-burn BRAND-CORRECT karaoke on existing graded videos, re-mux audio, prepend cover.
Brand subtitle spec: Soyuz Grotesk, LOWERCASE, active word ORANGE (#EA5920=&H002059EA&),
past words WHITE, soft shadow + glow, NO black outline. Appear word-by-word."""
import json, os, subprocess, sys

FAC="/tmp/claude-0/-home-user-OKO-TEAM/4d03047f-7a59-58cd-ac9b-80a55112aa48/scratchpad/factory"
FONTS="/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"
OUT=os.path.join(FAC,"out"); TMP=os.path.join(FAC,"tmp")
W,H=1080,1920
WHITE="&H00FFFFFF&"; ORANGE="&H002059EA&"

def run(cmd):
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode!=0:
        print("ERR:",r.stderr[-1200:]); raise SystemExit(1)
def dur(p):
    r=subprocess.run(["ffprobe","-v","quiet","-show_entries","format=duration","-of","csv=p=0",p],
                     capture_output=True,text=True)
    try:return float(r.stdout.strip())
    except:return 0.0
def at(t):
    h=int(t//3600);m=int((t%3600)//60);s=t%60
    return f"{h:d}:{m:02d}:{s:05.2f}"

def esc(txt): return txt.replace("\\","\\\\")

def build_ass(segs,starts,path):
    head=f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: kar,Soyuz Grotesk,80,{WHITE},{WHITE},&H00202020&,&HB0000000&,-1,0,0,0,100,100,0,0,1,0,4,2,110,110,330,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev=[]
    for seg,st in zip(segs,starts):
        wj=json.load(open(seg["words"]))["words"]
        words=[w for w in wj if w["w"].strip()]
        # chunk into lines of <=3 words / <=18 chars
        chunks=[]; cur=[]
        for w in words:
            cand=cur+[w]
            if sum(len(x["w"]) for x in cand)+len(cand)<=18 and len(cand)<=3: cur=cand
            else:
                if cur:chunks.append(cur)
                cur=[w]
        if cur:chunks.append(cur)
        for ch in chunks:
            cstart=st+ch[0]["t"]
            cend=st+ch[-1]["t"]+ch[-1]["d"]
            # each word appears at its time; active=orange, past=white
            for i,w in enumerate(ch):
                a=st+w["t"]
                b=st+(ch[i+1]["t"] if i+1<len(ch) else (ch[-1]["t"]+ch[-1]["d"]+0.05))
                parts=[]
                for j in range(i+1):
                    wl=esc(ch[j]["w"].lower())
                    if j==i: parts.append(f"{{\\c{ORANGE}}}{wl}{{\\c{WHITE}}}")
                    else:    parts.append(wl)
                txt="{\\blur6}"+" ".join(parts)
                ev.append(f"Dialogue: 0,{at(a)},{at(b)},kar,,0,0,0,,{txt}")
    open(path,"w").write(head+"\n".join(ev)+"\n")

def finish(rid):
    man=TTS[rid]; segs=man["segments"]
    starts=[]; t=0.0
    for s in segs: starts.append(t); t+=s["dur"]
    graded=os.path.join(TMP,f"{rid}_graded.mp4")
    T=dur(graded)
    ass=os.path.join(TMP,f"{rid}_k2.ass"); build_ass(segs,starts,ass)
    subbed=os.path.join(TMP,f"{rid}_sub2.mp4")
    run(["ffmpeg","-y","-i",graded,"-vf",f"ass={ass}:fontsdir={FONTS}",
         "-c:v","libx264","-preset","medium","-crf","20","-r","30",subbed])
    voice=os.path.join(TMP,f"{rid}_voice.mp3")
    mus=MUSIC.get(rid); final=os.path.join(TMP,f"{rid}_final2.mp4")
    if mus and os.path.exists(mus["path"]):
        afc=(f"[2:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.14,"
             f"afade=t=in:st=0:d=1,afade=t=out:st={max(0,T-1.2):.2f}:d=1.2[m];"
             f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,dynaudnorm=g=8,asplit=2[vk][vm];"
             f"[m][vk]sidechaincompress=threshold=0.03:ratio=8:attack=5:release=250[mc];"
             f"[vm][mc]amix=inputs=2:duration=first:weights='1 0.7',loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
        run(["ffmpeg","-y","-i",subbed,"-i",voice,"-stream_loop","-1","-i",mus["path"],
             "-filter_complex",afc,"-map","0:v","-map","[aout]","-c:v","copy","-c:a","aac",
             "-b:a","192k","-t",f"{T:.3f}","-movflags","+faststart",final])
    else:
        run(["ffmpeg","-y","-i",subbed,"-i",voice,"-map","0:v","-map","1:a","-c:v","copy",
             "-c:a","aac","-b:a","192k","-af","loudnorm=I=-14:TP=-1.5","-t",f"{T:.3f}",
             "-movflags","+faststart",final])
    cov=os.path.join(TMP,f"{rid}_cover.png")
    covclip=os.path.join(TMP,f"{rid}_cc2.mp4")
    run(["ffmpeg","-y","-loop","1","-i",cov,"-f","lavfi","-t","0.5","-i","anullsrc=r=44100:cl=stereo",
         "-vf","scale=1080:1920,setsar=1,format=yuv420p","-t","0.5","-r","30",
         "-c:v","libx264","-preset","veryfast","-c:a","aac","-shortest",covclip])
    outp=os.path.join(OUT,f"{rid}_final.mp4")
    run(["ffmpeg","-y","-i",covclip,"-i",final,"-filter_complex",
         "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]","-map","[v]","-map","[a]",
         "-c:v","libx264","-preset","medium","-crf","21","-c:a","aac","-b:a","192k",
         "-r","30","-movflags","+faststart",outp])
    print(f"{rid} finished: {dur(outp):.1f}s {os.path.getsize(outp)/1e6:.1f}MB")

TTS=json.load(open(os.path.join(FAC,"tts_v_manifest.json")))
MUSIC=json.load(open(os.path.join(FAC,"music_manifest.json")))
for rid in (sys.argv[1:] or ["v1","v2","v3","v4","v5","v6","v7"]):
    finish(rid)
print("ALL FINISHED")
