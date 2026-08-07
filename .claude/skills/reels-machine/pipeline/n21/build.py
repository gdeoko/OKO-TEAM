# -*- coding: utf-8 -*-
"""n21 — «Цветокоррекция за 2 минуты» (useful, до/после). Голос Владимира (ретраи) +
музыка-фолбэк. Grade cineTO (новый), инфографика ДО/ПОСЛЕ по смыслу. Кадры под смысл.
Всё разное относительно n17-n20."""
import os, sys, json, subprocess, urllib.parse, time
HERE=os.path.dirname(os.path.abspath(__file__)); SKILL=os.path.abspath(os.path.join(HERE,".."))
ROOT=os.path.abspath(os.path.join(SKILL,".."))
sys.path.insert(0, os.path.join(SKILL,"assemble")); sys.path.insert(0, os.path.join(SKILL,"motion"))
sys.path.insert(0, os.path.join(SKILL,"voice_omnivoice"))
import captions as CAP, assemble_reel as ASM, music as MUS
from overlay_render import render_overlay
import vcode_voice as VV
CA="/root/.ccr/ca-bundle.crt"; KEY=os.environ["PEXELS_API_KEY"]
DAY=os.path.join(SKILL,"n21"); CL=os.path.join(DAY,"clips"); VO=os.path.join(DAY,"vo"); OV=os.path.join(DAY,"ov")
for d in (DAY,CL,VO,OV): os.makedirs(d,exist_ok=True)
# новый грейд teal-orange киношный (не повторяет warm/teal/punch/noir прошлых)
ASM.GRADES["cineTO"]=("curves=b='0/0.05 0.5/0.45 1/0.92':r='0/0 0.5/0.54 1/1',"
  "eq=contrast=1.12:saturation=1.2,colorbalance=rs=.05:bs=.06:gm=-.02:bm=.04:rh=.06,vignette=PI/5")

SEGS=[
 {"t":"Почему видео с телефона выглядит дёшево? Всё дело в цвете.","cap":"Дело в цвете",
  "q":["flat ungraded raw video footage","dull grey video clip phone"]},
 {"t":"Сырой кадр плоский и серый. Цветокоррекция добавляет ему глубину.","cap":"Цвет даёт глубину",
  "q":["color grading software color wheels","editor grading footage monitor"]},
 {"t":"Первый шаг. Выставите баланс белого, чтобы кожа стала естественной.","cap":"1. Баланс белого",
  "q":["white balance camera skin tone","portrait color correction face"]},
 {"t":"Второй шаг. Поднимите контраст и уведите тени в лёгкий синий.","cap":"2. Контраст и тени",
  "q":["moody blue shadows cinematic","contrast video editing screen"]},
 {"t":"Третий шаг. Добавьте тёплый оттенок в света, и картинка сразу оживает.","cap":"3. Тёплые света",
  "q":["warm golden cinematic footage","teal orange graded shot"]},
 {"t":"Две минуты работы, и телефонный кадр выглядит как кино. Напишите СЪЕМКА в директ.","cap":"СЪЕМКА в директ",
  "q":["colorist working studio monitor","cinema camera studio filming"]},
]
def used_ids():
    import re; reg=os.path.join(ROOT,"reference","USED_FOOTAGE.md")
    return set(int(x) for x in re.findall(r"\b(\d{6,9})\b", open(reg).read())) if os.path.exists(reg) else set()
USED=used_ids()
def cj(u): return json.loads(subprocess.check_output(["curl","-s","--max-time","30","--cacert",CA,"-H",f"Authorization: {KEY}",u]))
def pick(q):
    for page in (1,2,3):
        u=f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&size=medium&per_page=12&page={page}"
        try: data=cj(u)
        except Exception: continue
        for v in data.get("videos",[]):
            if v["id"] in USED: continue
            files=[f for f in v["video_files"] if f["height"] and f["width"] and f["height"]>f["width"] and f["height"]>=1600]
            if files and 3<=v["duration"]<=40:
                files.sort(key=lambda f:abs(f["height"]-2160)); USED.add(v["id"]); return {"id":v["id"],"url":files[0]["link"]}
    return None
def dl(url,p): subprocess.run(["curl","-sL","--max-time","90","-o",p,url],check=True); return os.path.getsize(p)>20000 if os.path.exists(p) else False
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).strip())
def whisper_words(wav):
    from faster_whisper import WhisperModel
    m=WhisperModel("small",device="cpu",compute_type="int8")
    segs,_=m.transcribe(wav,vad_filter=True,word_timestamps=True,language="ru")
    return [{"w":w.word.strip(),"t":float(w.start),"d":float(w.end-w.start)} for s in segs for w in (s.words or [])]
def synth_retry(text,out,tries=4):
    for a in range(tries):
        try:
            VV.synth(text,out)
            if os.path.exists(out) and os.path.getsize(out)>2000: return True
        except Exception as e: print(f"  synth try{a+1}: {str(e)[:50]}"); time.sleep(12)
    return False

def fetch_clips():
    manifest=[]; clips=[]; idx=0; per={}
    for i,s in enumerate(SEGS):
        d=seg_durs[i]; n=max(1,round(d/2.6)); cd=d/n
        for k in range(n):
            q=s["q"][k%len(s["q"])]
            c=pick(q) or pick(q.split()[0]+" cinematic") or pick("cinematic color grade")
            if not c: continue
            p=os.path.join(CL,f"c{idx:02d}.mp4")
            if dl(c["url"],p): clips.append({"path":p,"dur":round(cd,3)}); manifest.append({"step":i,"id":c["id"]}); per[i]=per.get(i,0)+1; idx+=1
    json.dump(manifest,open(os.path.join(DAY,"clips_manifest.json"),"w"),indent=1)
    return clips,per

def overlays_build(win):
    ov=[]
    def add(name,html,start,d): dd=os.path.join(OV,name); render_overlay(html,dd,dur=d,fps=30); ov.append({"dir":dd,"start":start,"dur":d})
    W={i:(a,b) for i,a,b in win}
    if 1 in W:
        ba="""<style>@keyframes f{0%{opacity:0;transform:translateY(28px)}20%{opacity:1;transform:none}100%{opacity:1}}
        .w{position:absolute;left:50%;top:27%;transform:translateX(-50%);width:84%;font-family:'Montserrat',Arial;animation:f 3s forwards}
        .r{display:flex;align-items:center;justify-content:space-between;margin:9px 0;border-radius:20px;padding:18px 26px;font-weight:900;font-size:54px}
        .a{background:rgba(120,120,120,.85);color:#eee}.b{background:#EA5920;color:#fff}</style>
        <div class="w"><div class="r a">ДО<span>плоско</span></div><div class="r b">ПОСЛЕ<span>кино</span></div></div>"""
        add("beforeafter",ba,W[1][0]+0.3,min(3.0,W[1][1]-W[1][0]-0.4))
    if 5 in W:
        tm="""<style>@keyframes pop{0%{transform:translate(-50%,-50%) scale(.5);opacity:0}25%{transform:translate(-50%,-50%) scale(1.08);opacity:1}40%{transform:translate(-50%,-50%) scale(1)}100%{opacity:1}}
        .s{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);font-family:'Montserrat',Arial;text-align:center;animation:pop 3s forwards}
        .n{font-weight:900;font-size:150px;color:#EA5920;line-height:.9;text-shadow:0 8px 26px rgba(0,0,0,.5)}
        .l{font-weight:800;font-size:52px;color:#fff}</style>
        <div class="s"><div class="n">2 МИН</div><div class="l">и как кино</div></div>"""
        add("time",tm,W[5][0]+0.4,min(2.6,W[5][1]-W[5][0]-0.5))
    return ov

def assemble(clips,win,vo_path):
    words=None
    if vo_path:
        ww=whisper_words(vo_path)
        script=[w for s in SEGS for w in s["t"].replace(",", " ").split()]
        words=CAP.align_to_audio(script,ww)
    else:
        words=[]
        for i,w0,w1 in win:
            ws=[x for x in SEGS[i]["cap"].replace(",", " ").split() if x]
            span=(w1-w0-0.3)/max(1,len(ws))
            for k,wd in enumerate(ws): words.append({"w":wd,"t":round(w0+0.15+k*span,3),"d":round(span*0.9,3)})
    ass=os.path.join(DAY,"captions.ass"); CAP.build_ass(words,ass)
    mus=os.path.join(DAY,"music.mp3"); got=MUS.fetch("uplifting cinematic inspiring bright",mus); print("music",got)
    if not vo_path:
        vo_path=os.path.join(VO,"silent.wav")
        total=win[-1][2]
        subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-t",f"{total:.2f}","-i","anullsrc=r=44100:cl=stereo","-c:a","pcm_s16le",vo_path],check=True)
    overlays=overlays_build(win)
    print("overlays",len(overlays))
    spec={"clips":clips,"captions":ass,"vo":vo_path,"music":mus if got else None,"overlays":overlays,
          "grade":"cineTO","tmp":os.path.join(DAY,"_asm"),"out":os.path.join(DAY,"reel.mp4")}
    out,d=ASM.build(spec); print("REEL",out,d)

# ---- MAIN ----
voms=[]; seg_durs=[]; VOICE_OK=True
for i,s in enumerate(SEGS):
    mp=os.path.join(VO,f"s{i}.mp3")
    if synth_retry(s["t"],mp): voms.append(mp); seg_durs.append(dur(mp)); print(f"VO s{i}: {seg_durs[-1]:.2f}s")
    else: print(f"VO s{i} FAILED -> MUSIC-ONLY"); VOICE_OK=False; break
if VOICE_OK:
    lst=os.path.join(VO,"list.txt"); open(lst,"w").write("".join(f"file '{p}'\n" for p in voms))
    vo=os.path.join(VO,"vo.mp3"); subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",lst,"-c","copy",vo],check=True)
    clips,per=fetch_clips()
    # windows from VO segment durations (clips per segment sum to seg_durs[i])
    win=[]; t=0.0
    for i in range(len(SEGS)):
        if per.get(i,0): win.append((i,t,t+seg_durs[i])); t+=seg_durs[i]
    assemble(clips,win,vo)
else:
    seg_durs=[4.0]*len(SEGS)
    clips,per=fetch_clips()
    win=[]; t=0.0; CLIP=2.4
    for i in range(len(SEGS)):
        nn=per.get(i,0)
        if nn: win.append((i,t,t+nn*CLIP)); t+=nn*CLIP
    # rebuild clips with uniform dur
    for c in clips: c["dur"]=2.4
    assemble(clips,win,None)
