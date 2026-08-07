# -*- coding: utf-8 -*-
"""Пересборка n21 из ГОТОВЫХ голоса+кадров (без повторного синтеза): фикс субтитров."""
import os, sys, json, subprocess, glob
HERE=os.path.dirname(os.path.abspath(__file__)); SKILL=os.path.abspath(os.path.join(HERE,".."))
sys.path.insert(0,os.path.join(SKILL,"assemble")); sys.path.insert(0,os.path.join(SKILL,"motion"))
sys.path.insert(0,os.path.join(SKILL,"voice_omnivoice"))
import captions as CAP, assemble_reel as ASM, music as MUS
import build as B  # reuse SEGS, overlays_build, ASM.GRADES cineTO
DAY=HERE; VO=os.path.join(DAY,"vo")
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).strip())

seg_durs=[dur(os.path.join(VO,f"s{i}.mp3")) for i in range(len(B.SEGS))]
vo=os.path.join(VO,"vo.mp3")
manifest=json.load(open(os.path.join(DAY,"clips_manifest.json")))
per={}
for m in manifest: per[m["step"]]=per.get(m["step"],0)+1
# clips in manifest order, dur = seg_durs[step]/count
clip_files=sorted(glob.glob(os.path.join(DAY,"clips","c*.mp4")))
clips=[]
for idx,m in enumerate(manifest):
    st=m["step"]; cd=seg_durs[st]/per[st]
    clips.append({"path":clip_files[idx],"dur":round(cd,3)})
win=[]; t=0.0
for i in range(len(B.SEGS)):
    if per.get(i,0): win.append((i,t,t+seg_durs[i])); t+=seg_durs[i]

# captions from whisper (fixed captions.py)
from faster_whisper import WhisperModel
mm=WhisperModel("small",device="cpu",compute_type="int8")
segs,_=mm.transcribe(vo,vad_filter=True,word_timestamps=True,language="ru")
ww=[{"w":w.word.strip(),"t":float(w.start),"d":float(w.end-w.start)} for s in segs for w in (s.words or [])]
script=[w for s in B.SEGS for w in s["t"].replace(",", " ").split()]
timed=CAP.align_to_audio(script,ww)
ass=os.path.join(DAY,"captions.ass"); CAP.build_ass(timed,ass)
mus=os.path.join(DAY,"music.mp3")  # reuse existing
overlays=B.overlays_build(win); print("overlays",len(overlays))
spec={"clips":clips,"captions":ass,"vo":vo,"music":mus if os.path.exists(mus) else None,
      "overlays":overlays,"grade":"cineTO","tmp":os.path.join(DAY,"_asm2"),"out":os.path.join(DAY,"reel.mp4")}
out,d=ASM.build(spec); print("REEL",out,d)
