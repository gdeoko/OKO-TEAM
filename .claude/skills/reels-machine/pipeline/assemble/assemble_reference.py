# -*- coding: utf-8 -*-
import os,sys,json,subprocess,urllib.parse,random,shutil,re
sys.path.insert(0,"/home/user/OKO-TEAM/.claude/skills/reels-machine/pipeline/assemble")
sys.path.insert(0,"/home/user/OKO-TEAM/.claude/skills/reels-machine/pipeline/motion")
from overlay_render import render_overlay
OUT="/tmp/r";W,H=1080,1920
CA="/root/.ccr/ca-bundle.crt";PEXELS=os.environ["PEXELS_API_KEY"]
SK="/home/user/OKO-TEAM/.claude/skills/reels-machine/pipeline";FONT=f"{SK}/assets/SoyuzGrotesk-Bold.ttf"
sc=json.load(open(f"{OUT}/scn.json"));LINES=[sc["hook"]]+sc["segments"]+[sc["cta"]]
timed=json.load(open(f"{OUT}/timed.json"))
voice=f"{OUT}/voice.mp3"
dur=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",voice]).strip())
# окна сегментов из timed (по числу слов в строке)
cnt=[len(re.findall(r"\S+",l)) for l in LINES];seg=[];wi=0
for c in cnt:
    a=wi;b=min(len(timed),wi+c);seg.append((timed[a]["t"] if b>a else 0, timed[b-1]["t"]+timed[b-1]["d"] if b>a else dur));wi=b

# 1) КАДРЫ по смыслу (beats) + добор
beats=sc.get("beats",[])
Q=beats+["programmer coding screen","ai code assistant","developer laptop dark","code editor autocomplete","screenshot code phone","chatbot fixing code","free zero cost tech","bookmark save subscribe"]
def cj(u):return json.loads(subprocess.check_output(["curl","-s","--max-time","30","--cacert",CA,"-H",f"Authorization: {PEXELS}",u]))
clips=[];used=set();per=2.5;need=int(dur/per)+2
for q in Q:
    if len(clips)>=need:break
    try:d=cj(f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&size=medium&per_page=8")
    except Exception:continue
    vs=d.get("videos",[]);random.Random(len(q)).shuffle(vs)
    for v in vs:
        if v["id"] in used:continue
        vf=[f for f in v["video_files"] if (f.get("height") or 0)>=1200 and (f.get("width") or 0)<(f.get("height") or 0)] or [f for f in v["video_files"] if (f.get("height") or 0)>=900]
        if not vf:continue
        vf.sort(key=lambda f:-(f.get("height") or 0));p=f"{OUT}/c{len(clips)}.mp4";used.add(v["id"])
        subprocess.run(["curl","-s","--max-time","80","--cacert",CA,"-o",p,vf[0]["link"]],timeout=90)
        if os.path.exists(p) and os.path.getsize(p)>60000:clips.append(p)
        break
print("clips",len(clips),flush=True)
# нарезка под dur (кадр = стоки; первые 1.2с — обложка)
COVERT=1.2
parts=[];t=COVERT;i=0
while t<dur-0.1 and clips:
    c=clips[i%len(clips)];sg=min(per,dur-t);p=f"{OUT}/s{i}.mp4"
    subprocess.run(["ffmpeg","-y","-v","error","-ss","0.5","-t",f"{sg:.2f}","-i",c,"-vf",f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1,fps=30,eq=contrast=1.06:saturation=1.12","-an","-c:v","libx264","-preset","veryfast","-pix_fmt","yuv420p",p],timeout=120)
    if os.path.exists(p):parts.append(p)
    t+=sg;i+=1
# обложка (первый кадр, под звук)
cov=f"{OUT}/cover.jpg"
subprocess.run(["python3",f"{SK}/motion/cover_flux.py","3 БЕСПЛАТНЫЕ|НЕЙРОСЕТИ ДЛЯ КОДА",cov,"--font",FONT,"--scene","dark IDE code editor, three glowing AI logos, orange neon"],timeout=160)
if not os.path.exists(cov):
    subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-i",f"color=c=0x0a0a0a:s={W}x{H}",  "-frames:v","1",cov],timeout=30)
covclip=f"{OUT}/cov.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-loop","1","-t",f"{COVERT}","-i",cov,"-vf",f"scale={W}:{H},setsar=1,fps=30","-c:v","libx264","-pix_fmt","yuv420p",covclip],timeout=60)
open(f"{OUT}/cc.txt","w").write(f"file '{covclip}'\n"+"".join(f"file '{p}'\n" for p in parts))
base=f"{OUT}/base.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",f"{OUT}/cc.txt","-t",f"{dur:.2f}","-c:v","libx264","-pix_fmt","yuv420p",base],check=True,timeout=200)
# субтитры
subbed=f"{OUT}/subbed.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-i",base,"-vf",f"subtitles={OUT}/subs.ass:fontsdir={SK}/assets","-c:v","libx264","-pix_fmt","yuv420p",subbed],check=True,timeout=220)

# 2) АНИМО-ИНФОГРАФИКА (счётчик+бар), верх-центр, по одной, на сегменты 1,2,3
INFO=sc.get("infographics",[])
cur=subbed
for k,label in enumerate(INFO):
    li=k+1;
    if li>=len(seg):break
    a,b=seg[li];win=min(3.0,max(1.8,b-a))
    name,metric=(label.split("·")+[""])[:2]
    html=f"""<div style="position:absolute;left:0;right:0;top:360px;text-align:center;font-family:sans-serif">
     <div style="display:inline-block;background:rgba(12,12,15,.92);border:5px solid #EA5920;border-radius:34px;padding:26px 46px;animation:sl 3s ease both">
      <div style="font-size:64px;font-weight:900;color:#EA5920;animation:pl 1.3s ease infinite">{metric.strip()}</div>
      <div style="font-size:40px;font-weight:800;color:#fff;letter-spacing:2px;margin-top:6px">{name.strip()}</div>
      <div style="height:10px;background:#333;border-radius:6px;margin-top:16px;overflow:hidden"><div style="height:100%;background:#EA5920;width:0;animation:bar 3s ease forwards"></div></div>
     </div></div>
     <style>@keyframes sl{{0%{{transform:translateY(-40px);opacity:0}}12%{{transform:translateY(0);opacity:1}}86%{{opacity:1}}100%{{opacity:0}}}}
     @keyframes pl{{0%,100%{{transform:scale(1)}}50%{{transform:scale(1.06)}}}}@keyframes bar{{0%{{width:0}}18%{{width:0}}70%{{width:100%}}100%{{width:100%}}}}</style>"""
    od=f"{OUT}/info{li}"
    try:
        render_overlay(html,od,win,24)
        nxt=f"{OUT}/wi{li}.mp4"
        subprocess.run(["ffmpeg","-y","-v","error","-i",cur,"-framerate","24","-i",f"{od}/f_%04d.png","-filter_complex",f"[1:v]setpts=PTS-STARTPTS+{a}/TB[o];[0:v][o]overlay=0:0:enable='between(t,{a},{a+win})'[v]","-map","[v]","-c:v","libx264","-preset","veryfast","-pix_fmt","yuv420p",nxt],capture_output=True,timeout=160)
        if os.path.exists(nxt) and os.path.getsize(nxt)>10000: cur=nxt
    except Exception as e: open(f"{OUT}/ie{li}.txt","w").write(str(e)[:500])
withinfo=cur

# 3) финалка + голос (БЕЗ задержки — звук с 0, тишины нет)
end=f"{OUT}/end.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-i",f"color=c=0x0a0a0a:s={W}x{H}:d=1.6","-vf",f"drawtext=fontfile={FONT}:text='V.CODE':fontcolor=0xEA5920:fontsize=160:x=(w-tw)/2:y=(h-th)/2-60,drawtext=fontfile={FONT}:text='подпишись':fontcolor=white:fontsize=54:x=(w-tw)/2:y=(h-th)/2+120","-c:v","libx264","-pix_fmt","yuv420p","-r","30",end],timeout=60)
open(f"{OUT}/cc2.txt","w").write(f"file '{withinfo}'\nfile '{end}'\n")
vfull=f"{OUT}/vfull.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",f"{OUT}/cc2.txt","-c:v","libx264","-pix_fmt","yuv420p",vfull],check=True,timeout=200)
reel=f"{OUT}/reel.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-i",vfull,"-i",voice,"-filter_complex","[1:a]apad[a]","-map","0:v","-map","[a]","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",reel],check=True,timeout=200)
print("REEL_DONE",os.path.getsize(reel),"clips",len(parts),"info",len(INFO),flush=True)
