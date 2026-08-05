# -*- coding: utf-8 -*-
"""n19 — «Зачем бизнесу студия» (selling). ГОЛОС ВЛАДИМИРА (OmniVoice ожил) + караоке по
таймингам whisper. Кадры под смысл, инфографика по смыслу, музыка дакинг, грейд warm.
Всё разное относительно n17/n18. Обложка — постер при публикации."""
import os, sys, json, subprocess, urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__)); SKILL=os.path.abspath(os.path.join(HERE,".."))
ROOT=os.path.abspath(os.path.join(SKILL,".."))
sys.path.insert(0, os.path.join(SKILL,"assemble")); sys.path.insert(0, os.path.join(SKILL,"motion"))
sys.path.insert(0, os.path.join(SKILL,"voice_omnivoice"))
import captions as CAP, assemble_reel as ASM, music as MUS
from overlay_render import render_overlay
import vcode_voice as VV
CA="/root/.ccr/ca-bundle.crt"; KEY=os.environ["PEXELS_API_KEY"]
DAY=os.path.join(SKILL,"n19"); CL=os.path.join(DAY,"clips"); VO=os.path.join(DAY,"vo"); OV=os.path.join(DAY,"ov")
for d in (DAY,CL,VO,OV): os.makedirs(d,exist_ok=True)

SEGS=[
 {"t":"Снимаете бизнес на телефон? Тогда теряете клиентов каждый день.",
  "q":["business owner filming phone shop","amateur phone video dim"]},
 {"t":"Телефон даёт просто картинку. Студия даёт доверие и продажи.",
  "q":["professional studio softbox product shoot","cinema camera studio setup"]},
 {"t":"Свет, звук и монтаж уровня продакшна. Клиент сразу видит серьёзный бренд.",
  "q":["studio lighting softbox setup","video editing color grading monitor"]},
 {"t":"Один студийный ролик работает на вас долгие месяцы.",
  "q":["cinematic product commercial studio","brand video premium look"]},
 {"t":"Пока конкурент снимает в темноте, ваш бизнес уже выглядит как кино.",
  "q":["cinematic film set professional","operator shooting cinema camera studio"]},
 {"t":"Снимем ваш продукт в студии. Напишите СЪЕМКА в директ.",
  "q":["videographer studio filming product","cinema camera closeup studio"]},
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

CAP_SHORT=["Снимаете на телефон? Теряете клиентов.","Телефон — картинка. Студия — продажи.",
 "Свет, звук, монтаж продакшна.","Один ролик работает месяцами.","Конкурент в темноте, вы — в кино.",
 "Снимем в студии. СЪЕМКА в директ."]

def build_music_only():
    print("=== MUSIC-ONLY build (voice flapped) ===")
    manifest=[]; clips=[]; idx=0; CLIP_DUR=2.4; win=[]; t=0.0
    for i,s in enumerate(SEGS):
        n=2; w0=t
        for k in range(n):
            q=s["q"][k%len(s["q"])]
            c=pick(q) or pick(q.split()[0]+" cinematic") or pick("cinematic studio")
            if not c: continue
            p=os.path.join(CL,f"c{idx:02d}.mp4")
            if dl(c["url"],p): clips.append({"path":p,"dur":CLIP_DUR}); manifest.append({"step":i,"id":c["id"]}); idx+=1
        win.append((i,w0,t+ (idx and CLIP_DUR*2))); t=CLIP_DUR*idx
    # recompute windows cleanly
    win=[]; t=0.0; per={}
    for m in manifest: per[m["step"]]=per.get(m["step"],0)+1
    for i in range(len(SEGS)):
        nn=per.get(i,0)
        if nn: win.append((i,t,t+nn*CLIP_DUR)); t+=nn*CLIP_DUR
    total=t
    json.dump(manifest,open(os.path.join(DAY,"clips_manifest.json"),"w"),indent=1)
    words=[]
    for i,w0,w1 in win:
        ws=[x for x in CAP_SHORT[i].replace(",", " ").replace("—"," ").split() if x]
        span=(w1-w0-0.3)/max(1,len(ws))
        for k,wd in enumerate(ws): words.append({"w":wd,"t":round(w0+0.15+k*span,3),"d":round(span*0.9,3)})
    ass=os.path.join(DAY,"captions.ass"); CAP.build_ass(words,ass)
    mus=os.path.join(DAY,"music.mp3"); got=MUS.fetch("confident uplifting corporate inspiring business",mus); print("music",got)
    vo=os.path.join(VO,"silent.wav")
    subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-t",f"{total:.2f}","-i","anullsrc=r=44100:cl=stereo","-c:a","pcm_s16le",vo],check=True)
    overlays=[]
    def add(name,html,start,d): dd=os.path.join(OV,name); render_overlay(html,dd,dur=d,fps=30); overlays.append({"dir":dd,"start":start,"dur":d})
    W={i:(a,b) for i,a,b in win}
    if 1 in W:
        cmp_html="""<style>@keyframes f{0%{opacity:0;transform:translateY(30px)}20%{opacity:1;transform:none}100%{opacity:1}}
        .w{position:absolute;left:50%;top:28%;transform:translateX(-50%);width:86%;font-family:'Montserrat',Arial;animation:f 3s forwards}
        .r{display:flex;align-items:center;justify-content:space-between;margin:10px 0;border-radius:22px;padding:20px 28px;font-weight:900;font-size:54px}
        .a{background:rgba(90,90,90,.85);color:#ddd}.b{background:#EA5920;color:#fff}</style>
        <div class="w"><div class="r a">телефон<span>картинка</span></div><div class="r b">студия<span>продажи</span></div></div>"""
        add("cmp",cmp_html,W[1][0]+0.3,min(3.0,W[1][1]-W[1][0]-0.4))
    if 5 in W:
        cta_html="""<style>@keyframes pop{0%{transform:translate(-50%,-50%) scale(.5) rotate(-8deg);opacity:0}25%{transform:translate(-50%,-50%) scale(1.08) rotate(-8deg);opacity:1}40%{transform:translate(-50%,-50%) scale(1) rotate(-8deg)}100%{opacity:1}}
        .s{position:absolute;left:50%;top:32%;transform:translate(-50%,-50%) rotate(-8deg);font-family:'Montserrat',Arial;font-weight:900;font-size:92px;color:#EA5920;border:8px solid #EA5920;border-radius:24px;padding:18px 44px;animation:pop 3s forwards;background:rgba(13,13,13,.35)}</style>
        <div class="s">СЪЕМКА</div>"""
        add("cta",cta_html,W[5][0]+0.4,min(2.8,W[5][1]-W[5][0]-0.5))
    print("overlays",len(overlays))
    spec={"clips":clips,"captions":ass,"vo":vo,"music":mus if got else None,"overlays":overlays,
          "grade":"warm","tmp":os.path.join(DAY,"_asm"),"out":os.path.join(DAY,"reel.mp4")}
    out,d=ASM.build(spec); print("REEL",out,d)

import time
def synth_retry(text,out,tries=4):
    for a in range(tries):
        try:
            VV.synth(text,out)
            if os.path.exists(out) and os.path.getsize(out)>2000: return True
        except Exception as e:
            print(f"  synth try{a+1} fail: {str(e)[:60]}"); time.sleep(12)
    return False

def main():
    # 1) VO per segment (Vladimir clone) with retries; fallback to music-only if voice flaps
    voms=[]; seg_durs=[]; VOICE_OK=True
    for i,s in enumerate(SEGS):
        mp=os.path.join(VO,f"s{i}.mp3")
        if synth_retry(s["t"],mp):
            voms.append(mp); seg_durs.append(dur(mp)); print(f"VO s{i}: {seg_durs[-1]:.2f}s")
        else:
            print(f"VO s{i}: FAILED after retries -> switch to MUSIC-ONLY mode"); VOICE_OK=False; break
    if not VOICE_OK:
        return build_music_only()
    # concat VO
    lst=os.path.join(VO,"list.txt"); open(lst,"w").write("".join(f"file '{p}'\n" for p in voms))
    vo=os.path.join(VO,"vo.mp3"); subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",lst,"-c","copy",vo],check=True)
    total=dur(vo); print("VO total",round(total,2))

    # 2) clips per segment sized to VO seg duration (cuts ~2.6s)
    manifest=[]; clips=[]; idx=0
    for i,s in enumerate(SEGS):
        d=seg_durs[i]; n=max(1,round(d/2.6)); cd=d/n
        picks=[]
        qs=s["q"]
        for k in range(n):
            q=qs[k%len(qs)]
            c=pick(q) or pick(q.split()[0]+" cinematic") or pick("cinematic studio")
            if not c: continue
            p=os.path.join(CL,f"c{idx:02d}.mp4")
            if dl(c["url"],p): clips.append({"path":p,"dur":round(cd,3)}); manifest.append({"step":i,"id":c["id"]}); idx+=1
        print(f"seg{i}: {n} clips @ {cd:.2f}s")
    json.dump(manifest,open(os.path.join(DAY,"clips_manifest.json"),"w"),indent=1)

    # 3) captions from whisper on final VO, aligned to script
    ww=whisper_words(vo)
    script_words=[w for s in SEGS for w in s["t"].replace(",", " ").split()]
    timed=CAP.align_to_audio(script_words, ww)
    ass=os.path.join(DAY,"captions.ass"); CAP.build_ass(timed,ass)

    # 4) music (selling: confident uplifting), ducked under voice by assemble_reel
    mus=os.path.join(DAY,"music.mp3"); got=MUS.fetch("confident uplifting corporate inspiring business",mus); print("music",got)

    # 5) overlays by meaning (few, different from n17/n18)
    overlays=[]
    def add(name,html,start,d): dd=os.path.join(OV,name); render_overlay(html,dd,dur=d,fps=30); overlays.append({"dir":dd,"start":start,"dur":d})
    # compare "телефон / студия" during segment2 (Телефон даёт... Студия даёт...)
    st2=sum(seg_durs[:1])
    cmp_html="""<style>@keyframes f{0%{opacity:0;transform:translateY(30px)}20%{opacity:1;transform:none}100%{opacity:1}}
    .w{position:absolute;left:50%;top:28%;transform:translateX(-50%);width:86%;font-family:'Montserrat',Arial;animation:f 3s forwards}
    .r{display:flex;align-items:center;justify-content:space-between;margin:10px 0;border-radius:22px;padding:20px 28px;font-weight:900;font-size:56px}
    .a{background:rgba(90,90,90,.85);color:#ddd}.b{background:#EA5920;color:#fff}</style>
    <div class="w"><div class="r a">телефон<span>картинка</span></div><div class="r b">студия<span>продажи</span></div></div>"""
    add("cmp", cmp_html, st2+0.4, min(3.0, seg_durs[1]-0.5))
    # CTA stamp during last segment
    stC=sum(seg_durs[:5])
    cta_html="""<style>@keyframes pop{0%{transform:translate(-50%,-50%) scale(.5) rotate(-8deg);opacity:0}25%{transform:translate(-50%,-50%) scale(1.08) rotate(-8deg);opacity:1}40%{transform:translate(-50%,-50%) scale(1) rotate(-8deg)}100%{opacity:1}}
    .s{position:absolute;left:50%;top:32%;transform:translate(-50%,-50%) rotate(-8deg);font-family:'Montserrat',Arial;font-weight:900;font-size:96px;color:#EA5920;border:8px solid #EA5920;border-radius:24px;padding:18px 44px;animation:pop 3s forwards;background:rgba(13,13,13,.35)}</style>
    <div class="s">СЪЕМКА</div>"""
    add("cta", cta_html, stC+0.5, min(2.8, seg_durs[5]-0.6))
    print("overlays",len(overlays))

    spec={"clips":clips,"captions":ass,"vo":vo,"music":mus if got else None,"overlays":overlays,
          "grade":"warm","tmp":os.path.join(DAY,"_asm"),"out":os.path.join(DAY,"reel.mp4")}
    out,d=ASM.build(spec); print("REEL",out,d)

if __name__=="__main__": main()
