# -*- coding: utf-8 -*-
"""n17 — «Один софтбокс = кино» (useful, свет). Музыка+текст на экране, БЕЗ VO
(OmniVoice HF сегодня в AcceleratorError). Кадры под смысл, xfade, инфографика по смыслу,
караоке-субтитры (бренд), обложка постером при публикации. Всё разное (реестры)."""
import os, sys, json, subprocess, urllib.parse, random
HERE=os.path.dirname(os.path.abspath(__file__))
SKILL=os.path.abspath(os.path.join(HERE,".."))            # pipeline/
ROOT=os.path.abspath(os.path.join(SKILL,".."))            # reels-machine/
sys.path.insert(0, os.path.join(SKILL,"assemble"))
sys.path.insert(0, os.path.join(SKILL,"motion"))
import captions as CAP
import assemble_reel as ASM
import music as MUS
from overlay_render import render_overlay

CA="/root/.ccr/ca-bundle.crt"
KEY=os.environ["PEXELS_API_KEY"]
DAY=os.path.join(SKILL,"n17")
CL=os.path.join(DAY,"clips"); VO=os.path.join(DAY,"vo"); OV=os.path.join(DAY,"ov")
for d in (DAY,CL,VO,OV): os.makedirs(d,exist_ok=True)

# ---- 6 шагов (текст на экране = смысл; кадры под каждый шаг) ----
STEPS=[
 {"cap":"Один софтбокс. Снимает как кино.",
  "q":["cinematic portrait softbox studio dark","videographer filming softbox light"]},
 {"cap":"Свет сбоку под сорок пять градусов.",
  "q":["studio softbox side light portrait","soft light on face studio"]},
 {"cap":"Чуть выше глаз. Тень уходит вниз.",
  "q":["portrait lighting shadow face studio","beauty dish light face closeup"]},
 {"cap":"Разверни к стене. Свет станет мягче.",
  "q":["soft diffused light interior wall","bounce light studio softbox"]},
 {"cap":"Один источник. Картинка объёмная.",
  "q":["dramatic single light portrait","moody cinematic portrait light"]},
 {"cap":"Снимем ваш продукт. СЪЕМКА в директ.",
  "q":["cinema camera operator studio","videographer filming product studio"]},
]

# ---- дедуп id из реестра ----
def used_ids():
    ids=set()
    reg=os.path.join(ROOT,"reference","USED_FOOTAGE.md")
    if os.path.exists(reg):
        import re
        ids=set(int(x) for x in re.findall(r"\b(\d{6,9})\b", open(reg).read()))
    return ids
USED=used_ids()

def cj(u): return json.loads(subprocess.check_output(["curl","-s","--max-time","30","--cacert",CA,"-H",f"Authorization: {KEY}",u]))
def pick_clip(q):
    for page in (1,2,3):
        u=f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&size=medium&per_page=12&page={page}"
        try: data=cj(u)
        except Exception: continue
        for v in data.get("videos",[]):
            if v["id"] in USED: continue
            files=[f for f in v["video_files"] if f["height"] and f["width"] and f["height"]>f["width"] and f["height"]>=1600]
            if not files: continue
            if not (3<=v["duration"]<=40): continue
            files.sort(key=lambda f:abs(f["height"]-2160))
            USED.add(v["id"])
            return {"id":v["id"],"dur":v["duration"],"url":files[0]["link"]}
    return None

def dl(url,path):
    subprocess.run(["curl","-sL","--max-time","90","-o",path,url],check=True)
    return os.path.exists(path) and os.path.getsize(path)>20000

def main():
    # 1) fetch 2 clips per step
    manifest=[]; idx=0
    for si,st in enumerate(STEPS):
        for q in st["q"]:
            c=pick_clip(q)
            if not c:
                c=pick_clip(q.split()[0]+" cinematic")
            if not c:
                print("no clip for",q); continue
            p=os.path.join(CL,f"c{idx:02d}.mp4")
            if dl(c["url"],p):
                manifest.append({"step":si,"path":p,"id":c["id"]})
                print(f"step{si} clip {c['id']}")
                idx+=1
    json.dump(manifest,open(os.path.join(DAY,"clips_manifest.json"),"w"),indent=1)

    # 2) timeline: each clip ~2.2s
    CLIP_DUR=2.2
    clips=[{"path":m["path"],"dur":CLIP_DUR} for m in manifest]
    total=len(clips)*CLIP_DUR
    # per-step window
    per_step={}
    for m in manifest: per_step.setdefault(m["step"],0); per_step[m["step"]]+=1
    # step windows (by clip counts)
    win=[]; t=0.0
    for si in range(len(STEPS)):
        n=per_step.get(si,0)
        if n==0: continue
        w0=t; w1=t+n*CLIP_DUR; win.append((si,w0,w1)); t=w1

    # 3) synthetic caption word-timings (no VO): spread step words across its window
    words=[]
    for si,w0,w1 in win:
        ws=[x for x in STEPS[si]["cap"].replace(",", " ").split() if x]
        span=(w1-w0-0.3)/max(1,len(ws))
        for k,wd in enumerate(ws):
            wt=w0+0.15+k*span
            words.append({"w":wd,"t":round(wt,3),"d":round(span*0.9,3)})
    ass=os.path.join(DAY,"captions.ass"); CAP.build_ass(words,ass)

    # 4) music (energetic, unique)
    mus=os.path.join(DAY,"music.mp3")
    got=MUS.fetch("energetic cinematic uplifting inspiring",mus)
    print("music:",got)

    # 5) silent VO (music-driven)
    vo=os.path.join(VO,"silent.wav")
    subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-t",f"{total:.2f}",
        "-i","anullsrc=r=44100:cl=stereo","-c:a","pcm_s16le",vo],check=True)

    # 6) meaningful overlays (by meaning): "45°" on step2 window, "1 источник" on step5
    overlays=[]
    def html_badge(big, small, accent="#EA5920"):
        return f"""<style>@keyframes p{{0%{{transform:scale(.6);opacity:0}}18%{{transform:scale(1.06);opacity:1}}30%{{transform:scale(1)}}100%{{opacity:1}}}}
        .b{{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);text-align:center;
        font-family:'Montserrat',Arial;animation:p 3s forwards}}
        .big{{font-weight:900;font-size:210px;color:{accent};text-shadow:0 8px 30px rgba(0,0,0,.6);line-height:.9}}
        .sm{{font-weight:800;font-size:64px;color:#fff;letter-spacing:2px;margin-top:8px;text-shadow:0 4px 16px rgba(0,0,0,.7)}}</style>
        <div class="b"><div class="big">{big}</div><div class="sm">{small}</div></div>"""
    def add_ov(name,html,start,dur):
        d=os.path.join(OV,name); render_overlay(html,d,dur=dur,fps=30); overlays.append({"dir":d,"start":start,"dur":dur})
    # 45 degrees during step2
    s2=next((w for w in win if w[0]==1),None)
    if s2: add_ov("deg45", html_badge("45°","угол света"), s2[1]+0.3, min(3.0,s2[2]-s2[1]-0.4))
    s5=next((w for w in win if w[0]==4),None)
    if s5: add_ov("onesrc", html_badge("1","источник света"), s5[1]+0.3, min(3.0,s5[2]-s5[1]-0.4))
    print("overlays",len(overlays))

    # 7) assemble
    spec={"clips":clips,"captions":ass,"vo":vo,"music":mus if got else None,
          "overlays":overlays,"grade":"teal","tmp":os.path.join(DAY,"_asm"),
          "out":os.path.join(DAY,"reel.mp4")}
    out,dur=ASM.build(spec)
    print("REEL:",out,dur,"с")

if __name__=="__main__":
    main()
