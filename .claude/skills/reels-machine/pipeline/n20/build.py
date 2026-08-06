# -*- coding: utf-8 -*-
"""n20 — «Что скрывают видеографы: 3 секрета» (viral). Музыка+текст (OmniVoice в
AcceleratorError). Grade noir, секрет-ревил инфографика, мистическая музыка. Кадры под смысл.
Всё разное относительно n17/n18/n19."""
import os, sys, json, subprocess, urllib.parse
HERE=os.path.dirname(os.path.abspath(__file__)); SKILL=os.path.abspath(os.path.join(HERE,".."))
ROOT=os.path.abspath(os.path.join(SKILL,".."))
sys.path.insert(0, os.path.join(SKILL,"assemble")); sys.path.insert(0, os.path.join(SKILL,"motion"))
import captions as CAP, assemble_reel as ASM, music as MUS
from overlay_render import render_overlay
CA="/root/.ccr/ca-bundle.crt"; KEY=os.environ["PEXELS_API_KEY"]
DAY=os.path.join(SKILL,"n20"); CL=os.path.join(DAY,"clips"); VO=os.path.join(DAY,"vo"); OV=os.path.join(DAY,"ov")
for d in (DAY,CL,VO,OV): os.makedirs(d,exist_ok=True)

STEPS=[
 {"cap":"3 секрета видеографов","q":["videographer behind scenes filming","cinema camera operator closeup"]},
 {"cap":"Свет важнее камеры","q":["film lighting softbox set","cinematographer lighting face"]},
 {"cap":"Снимают в 2 раза больше","q":["video editing timeline footage","editor reviewing many takes laptop"]},
 {"cap":"Первые 3 секунды отдельно","q":["clapperboard take film set","filming closeup phone hook"]},
 {"cap":"Решает подготовка","q":["videographer planning storyboard notes","film crew preparing shot"]},
 {"cap":"СЪЕМКА в директ","q":["cinematic camera studio filming","operator shooting product studio"]},
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

def ov_secret(n,text):
    return f"""<style>@keyframes rv{{0%{{transform:translate(-50%,-50%) scale(.7);opacity:0;filter:blur(8px)}}22%{{transform:translate(-50%,-50%) scale(1.04);opacity:1;filter:blur(0)}}32%{{transform:translate(-50%,-50%) scale(1)}}100%{{opacity:1}}}}
    .c{{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);width:80%;text-align:center;font-family:'Montserrat',Arial;
    background:rgba(13,13,13,.86);border:5px solid #EA5920;border-radius:26px;padding:30px 24px;animation:rv 3s forwards}}
    .lab{{font-weight:800;font-size:44px;color:#EA5920;letter-spacing:6px}}
    .t{{font-weight:900;font-size:72px;color:#fff;line-height:1.05;margin-top:10px;text-shadow:0 4px 14px rgba(0,0,0,.6)}}</style>
    <div class="c"><div class="lab">СЕКРЕТ {n}</div><div class="t">{text}</div></div>"""

def main():
    manifest=[]; clips=[]; idx=0; CLIP_DUR=2.4; per={}
    for i,s in enumerate(STEPS):
        for k in range(2):
            q=s["q"][k%len(s["q"])]
            c=pick(q) or pick(q.split()[0]+" cinematic") or pick("cinematic film")
            if not c: continue
            p=os.path.join(CL,f"c{idx:02d}.mp4")
            if dl(c["url"],p): clips.append({"path":p,"dur":CLIP_DUR}); manifest.append({"step":i,"id":c["id"]}); per[i]=per.get(i,0)+1; idx+=1
    json.dump(manifest,open(os.path.join(DAY,"clips_manifest.json"),"w"),indent=1)
    win=[]; t=0.0
    for i in range(len(STEPS)):
        nn=per.get(i,0)
        if nn: win.append((i,t,t+nn*CLIP_DUR)); t+=nn*CLIP_DUR
    total=t
    words=[]
    for i,w0,w1 in win:
        ws=[x for x in STEPS[i]["cap"].replace(",", " ").split() if x]
        span=(w1-w0-0.3)/max(1,len(ws))
        for k,wd in enumerate(ws): words.append({"w":wd,"t":round(w0+0.15+k*span,3),"d":round(span*0.9,3)})
    ass=os.path.join(DAY,"captions.ass"); CAP.build_ass(words,ass)
    mus=os.path.join(DAY,"music.mp3"); got=MUS.fetch("mysterious tense cinematic reveal dark",mus); print("music",got)
    vo=os.path.join(VO,"silent.wav")
    subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-t",f"{total:.2f}","-i","anullsrc=r=44100:cl=stereo","-c:a","pcm_s16le",vo],check=True)
    overlays=[]
    def add(name,html,start,d): dd=os.path.join(OV,name); render_overlay(html,dd,dur=d,fps=30); overlays.append({"dir":dd,"start":start,"dur":d})
    W={i:(a,b) for i,a,b in win}
    secrets={1:("1","свет важнее камеры"),2:("2","снимают больше"),3:("3","первые 3 секунды")}
    for si,(nn,txt) in secrets.items():
        if si in W: add(f"s{si}", ov_secret(nn,txt), W[si][0]+0.3, min(2.8,W[si][1]-W[si][0]-0.4))
    print("overlays",len(overlays))
    spec={"clips":clips,"captions":ass,"vo":vo,"music":mus if got else None,"overlays":overlays,
          "grade":"noir","tmp":os.path.join(DAY,"_asm"),"out":os.path.join(DAY,"reel.mp4")}
    out,d=ASM.build(spec); print("REEL",out,d)

if __name__=="__main__": main()
