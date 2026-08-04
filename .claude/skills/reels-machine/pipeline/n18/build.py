# -*- coding: utf-8 -*-
"""n18 — «Почему 90% роликов не досматривают» (viral, удержание). Музыка+текст, БЕЗ VO
(OmniVoice HF в AcceleratorError). Структура shock-stat + 3 причины + формула + CTA.
Всё разное относительно n17: грейд punch, счётчик/нумерация/callout, свои кадры/музыка."""
import os, sys, json, subprocess, urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__)); SKILL=os.path.abspath(os.path.join(HERE,".."))
ROOT=os.path.abspath(os.path.join(SKILL,".."))
sys.path.insert(0, os.path.join(SKILL,"assemble")); sys.path.insert(0, os.path.join(SKILL,"motion"))
import captions as CAP, assemble_reel as ASM, music as MUS
from overlay_render import render_overlay
CA="/root/.ccr/ca-bundle.crt"; KEY=os.environ["PEXELS_API_KEY"]
DAY=os.path.join(SKILL,"n18"); CL=os.path.join(DAY,"clips"); VO=os.path.join(DAY,"vo"); OV=os.path.join(DAY,"ov")
for d in (DAY,CL,VO,OV): os.makedirs(d,exist_ok=True)

STEPS=[
 {"cap":"90% бросают за три секунды.","q":["thumb scrolling phone social feed","bored person looking at phone"]},
 {"cap":"Первая. Долгий разгон.","q":["person talking camera vlog intro","man swiping phone fast"]},
 {"cap":"Вторая. Нет вопроса в начале.","q":["confused thinking person question","close up eyes thinking doubt"]},
 {"cap":"Третья. Картинка застыла.","q":["static talking head boring","video editing timeline screen"]},
 {"cap":"Вопрос в первую секунду.","q":["fast dynamic video editing cuts","creative videographer shooting"]},
 {"cap":"Снимем так. СЪЕМКА в директ.","q":["cinema camera operator studio","videographer filming closeup studio"]},
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
                files.sort(key=lambda f:abs(f["height"]-2160)); USED.add(v["id"])
                return {"id":v["id"],"url":files[0]["link"]}
    return None
def dl(url,p): subprocess.run(["curl","-sL","--max-time","90","-o",p,url],check=True); return os.path.getsize(p)>20000 if os.path.exists(p) else False

# --- overlay HTML (по смыслу, отличаются от n17) ---
def ov_counter(big,small):
    return f"""<style>@keyframes pp{{0%{{transform:translate(-50%,-50%) scale(.5);opacity:0}}20%{{transform:translate(-50%,-50%) scale(1.08);opacity:1}}32%{{transform:translate(-50%,-50%) scale(1)}}100%{{opacity:1}}}}
    .c{{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);text-align:center;font-family:'Montserrat',Arial;animation:pp 3s forwards}}
    .n{{font-weight:900;font-size:280px;color:#EA5920;text-shadow:0 10px 34px rgba(0,0,0,.6);line-height:.9}}
    .l{{font-weight:800;font-size:60px;color:#fff;letter-spacing:2px;text-shadow:0 4px 16px rgba(0,0,0,.7)}}</style>
    <div class="c"><div class="n">{big}</div><div class="l">{small}</div></div>"""
def ov_num(n):
    return f"""<style>@keyframes sl{{0%{{transform:translateX(-140px);opacity:0}}22%{{transform:translateX(8px);opacity:1}}30%{{transform:translateX(0)}}100%{{opacity:1}}}}
    .w{{position:absolute;left:70px;top:26%;font-family:'Montserrat',Arial;animation:sl 3s forwards;display:flex;align-items:center;gap:24px}}
    .b{{width:150px;height:150px;border-radius:34px;background:#EA5920;color:#fff;font-weight:900;font-size:96px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.5)}}</style>
    <div class="w"><div class="b">{n}</div></div>"""
def ov_callout(text):
    return f"""<style>@keyframes fu{{0%{{transform:translateY(40px);opacity:0}}25%{{transform:translateY(0);opacity:1}}100%{{opacity:1}}}}
    .k{{position:absolute;left:50%;bottom:30%;transform:translateX(-50%);width:88%;text-align:center;font-family:'Montserrat',Arial;
    background:rgba(13,13,13,.82);border:5px solid #EA5920;border-radius:28px;padding:34px 20px;animation:fu 3s forwards}}
    .t{{font-weight:900;font-size:74px;color:#fff;line-height:1.05;text-shadow:0 4px 14px rgba(0,0,0,.6)}}</style>
    <div class="k"><div class="t">{text}</div></div>"""

def main():
    manifest=[]; idx=0
    for si,st in enumerate(STEPS):
        for q in st["q"]:
            c=pick(q) or pick(q.split()[0]+" cinematic")
            if not c: print("no clip",q); continue
            p=os.path.join(CL,f"c{idx:02d}.mp4")
            if dl(c["url"],p): manifest.append({"step":si,"path":p,"id":c["id"]}); print(f"s{si} {c['id']}"); idx+=1
    json.dump(manifest,open(os.path.join(DAY,"clips_manifest.json"),"w"),indent=1)
    CLIP_DUR=2.3
    clips=[{"path":m["path"],"dur":CLIP_DUR} for m in manifest]; total=len(clips)*CLIP_DUR
    per={}; [per.__setitem__(m["step"],per.get(m["step"],0)+1) for m in manifest]
    win=[]; t=0.0
    for si in range(len(STEPS)):
        n=per.get(si,0)
        if n: win.append((si,t,t+n*CLIP_DUR)); t+=n*CLIP_DUR
    # captions synthetic timings
    words=[]
    for si,w0,w1 in win:
        ws=[x for x in STEPS[si]["cap"].replace(",", " ").split() if x]
        span=(w1-w0-0.3)/max(1,len(ws))
        for k,wd in enumerate(ws): words.append({"w":wd,"t":round(w0+0.15+k*span,3),"d":round(span*0.9,3)})
    ass=os.path.join(DAY,"captions.ass"); CAP.build_ass(words,ass)
    mus=os.path.join(DAY,"music.mp3"); got=MUS.fetch("tense dramatic energetic build suspense",mus); print("music",got)
    vo=os.path.join(VO,"silent.wav")
    subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-t",f"{total:.2f}","-i","anullsrc=r=44100:cl=stereo","-c:a","pcm_s16le",vo],check=True)
    overlays=[]
    def add(name,html,start,dur): d=os.path.join(OV,name); render_overlay(html,d,dur=dur,fps=30); overlays.append({"dir":d,"start":start,"dur":dur})
    W={si:(a,b) for si,a,b in win}
    if 0 in W: add("stat", ov_counter("90%","бросают за 3 сек"), W[0][0]+0.3, min(2.8,W[0][1]-W[0][0]-0.4))
    if 1 in W: add("n1", ov_num("1"), W[1][0]+0.3, min(2.6,W[1][1]-W[1][0]-0.4))
    if 2 in W: add("n2", ov_num("2"), W[2][0]+0.3, min(2.6,W[2][1]-W[2][0]-0.4))
    if 3 in W: add("n3", ov_num("3"), W[3][0]+0.3, min(2.6,W[3][1]-W[3][0]-0.4))
    if 4 in W: add("formula", ov_callout("вопрос → ответ дробим"), W[4][0]+0.3, min(2.8,W[4][1]-W[4][0]-0.4))
    print("overlays",len(overlays))
    spec={"clips":clips,"captions":ass,"vo":vo,"music":mus if got else None,"overlays":overlays,
          "grade":"punch","tmp":os.path.join(DAY,"_asm"),"out":os.path.join(DAY,"reel.mp4")}
    out,dur=ASM.build(spec); print("REEL",out,dur)

if __name__=="__main__": main()
