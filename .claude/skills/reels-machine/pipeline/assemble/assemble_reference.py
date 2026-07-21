# -*- coding: utf-8 -*-
import json,re,subprocess,os
from PIL import Image, ImageDraw, ImageFont
OUT="/tmp/v2"; W,H=1080,1920
FONT=f"{OUT}/SoyuzGrotesk-Bold.ttf"
voice=f"{OUT}/voice.mp3"; base=f"{OUT}/base.mp4"
W2=json.load(open(f"{OUT}/words.json"))
dur=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",voice]).strip())
LINES=["5 нейросетей уже пишут код за тебя.","Cursor допишет функцию раньше, чем ты закончишь мысль.",
 "GitHub Copilot подсказывает строку прямо в редакторе.","ChatGPT объяснит чужой код за одну минуту.",
 "v0 соберёт интерфейс из одного предложения.","А пятую, Claude, мы в V.CODE используем каждый день.","Подпишись, покажу как."]
CARDS=[None,"CURSOR","GITHUB COPILOT","CHATGPT","v0","CLAUDE",None]

# окна сегментов по таймингам
counts=[len(re.findall(r"\S+",l)) for l in LINES]; seg=[]; wi=0
for c in counts:
    a=wi; b=min(len(W2),wi+c)
    seg.append((W2[a]["t"] if b>a else (seg[-1][1] if seg else 0), W2[b-1]["e"] if b>a else dur)); wi=b

def at(t):
    h=int(t//3600); m=int((t%3600)//60); s=t%60; return f"{h}:{m:02d}:{s:05.2f}"

# --- ASS: караоке-выделение (\kf оранж заливка), 2 слова, Союз Гротекс ---
ass=f"{OUT}/k.ass"
with open(ass,"w",encoding="utf-8") as f:
    f.write("[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\n\n[V4+ Styles]\n")
    f.write("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\n")
    # Primary=оранж (после заливки=выделение), Secondary=белый (до)
    f.write("Style: Kar,Soyuz Grotesk,104,&H002059EA,&H00FFFFFF,&H00101010,&H90000000,-1,7,2,2,70,70,470\n")
    f.write("Style: Card,Soyuz Grotesk,58,&H002059EA,&H002059EA,&H00FFFFFF,&H00000000,-1,4,0,8,60,60,360\n\n")
    f.write("[Events]\nFormat: Layer, Start, End, Style, Text\n")
    for li,line in enumerate(LINES):
        a,b=seg[li]; wds=[w.strip(",.").upper() for w in re.findall(r"\S+",line)]
        n=len(wds); step=max(0.28,(b-a)/max(1,n)); j=0
        while j<n:
            grp=wds[j:j+2]; gs=a+j*step; ge=a+min(n,j+2)*step
            kf="".join("{\\kf%d}%s "%(int(step*100),wr) for wr in grp)
            f.write(f"Dialogue: 0,{at(gs)},{at(ge)},Kar,{{\\an2\\fad(40,40)}}{kf.strip()}\n")
            j+=2
        if CARDS[li]:
            f.write(f"Dialogue: 1,{at(a)},{at(b)},Card,{{\\an8\\fad(120,120)\\bord5}}▍ {CARDS[li]}\n")

# --- КОД-ИНФОГРАФИКА (рисую заново PIL): бейджи-метрики под сегменты ---
def font(sz): return ImageFont.truetype(FONT,sz)
def badge(text, sub, path, accent=(234,89,32)):
    im=Image.new("RGBA",(560,240),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([6,6,554,234],38,fill=(12,12,14,235),outline=accent,width=6)
    d.line([40,120,150,120],fill=accent,width=8)
    f1=font(96); f2=font(34)
    d.text((175,42),text,font=f1,fill=(255,255,255,255))
    d.text((178,158),sub,font=f2,fill=accent+(255,))
    im.save(path)
badge("10с","CURSOR · МГНОВЕННО",f"{OUT}/ov1.png")
badge("1 МИН","CHATGPT · ОБЪЯСНИТ",f"{OUT}/ov2.png")
# код-сниппет карточка (рисуем «код» заново)
def code_card(path):
    im=Image.new("RGBA",(720,300),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.rounded_rectangle([6,6,714,294],26,fill=(14,16,22,235),outline=(234,89,32),width=5)
    for i,(c,t) in enumerate([((120,220,255),"def solve(task):"),((180,255,180),"    return ai.write(task)"),((255,200,120),"# готово за секунды")]):
        d.text((40,44+i*74),t,font=font(38),fill=c+(255,))
    im.save(path)
code_card(f"{OUT}/ov3.png")

# наложить инфографику с анимацией (slide-in) в разные моменты по 3-4с
s1a,s1b=seg[1]; s3a,s3b=seg[3]; s4a,s4b=seg[4]
subbed=f"{OUT}/sub3.mp4"
# сначала субтитры
subprocess.run(["ffmpeg","-y","-v","error","-i",base,"-vf",f"subtitles={ass}:fontsdir={OUT}","-c:v","libx264","-pix_fmt","yuv420p",subbed],check=True,timeout=240)
# затем инфографика-оверлеи (slide + fade), каждая ~3с в своём окне
fc=(
 f"[0][1]overlay=x='if(lt(t,{s1a}),-600,min(60, -600+({(60+600)})*(t-{s1a})/0.4))':y=560:"
 f"enable='between(t,{s1a},{s1a}+3)'[a];"
 f"[a][2]overlay=x='W-560-min(60,60*(t-{s3a})/0.4)':y=560:enable='between(t,{s3a},{s3a}+3)'[b];"
 f"[b][3]overlay=x=(W-720)/2:y='H-360+ (1-min(1,(t-{s4a})/0.4))*80':enable='between(t,{s4a},{s4a}+3)'[v]"
)
withov=f"{OUT}/ov.mp4"
r=subprocess.run(["ffmpeg","-y","-v","error","-i",subbed,"-i",f"{OUT}/ov1.png","-i",f"{OUT}/ov2.png","-i",f"{OUT}/ov3.png",
    "-filter_complex",fc,"-map","[v]","-c:v","libx264","-pix_fmt","yuv420p",withov],capture_output=True,text=True,timeout=240)
if r.returncode!=0:
    open(f"{OUT}/ov.err","w").write(r.stderr[-1500:]); withov=subbed  # фолбэк без оверлеев

# обложка первым кадром (1.3с) + финалка
cover=f"{OUT}/coverclip.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-loop","1","-t","1.3","-i",f"{OUT}/cover.jpg","-vf",f"scale={W}:{H},setsar=1,fps=30","-c:v","libx264","-pix_fmt","yuv420p",cover],timeout=60)
end=f"{OUT}/end3.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-f","lavfi","-i",f"color=c=0x0a0a0a:s={W}x{H}:d=1.8",
    "-vf",f"drawtext=fontfile={FONT}:text='V.CODE':fontcolor=0xEA5920:fontsize=160:x=(w-tw)/2:y=(h-th)/2-70,"
    f"drawtext=fontfile={FONT}:text='подпишись':fontcolor=white:fontsize=56:x=(w-tw)/2:y=(h-th)/2+130",
    "-c:v","libx264","-pix_fmt","yuv420p","-r","30",end],timeout=60)
# конкат cover(без звука)+ролик+финалка, звук=тишина(кавер)+voice+тишина(финалка)
open(f"{OUT}/cc3.txt","w").write(f"file '{cover}'\nfile '{withov}'\nfile '{end}'\n")
vfull=f"{OUT}/vfull3.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-f","concat","-safe","0","-i",f"{OUT}/cc3.txt","-c:v","libx264","-pix_fmt","yuv420p",vfull],check=True,timeout=200)
# аудио: 1.3с тишины + voice + хвост
reel=f"{OUT}/reel3.mp4"
subprocess.run(["ffmpeg","-y","-v","error","-i",vfull,"-i",voice,"-filter_complex",
    "[1:a]adelay=1300|1300,apad[a]","-map","0:v","-map","[a]","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",reel],check=True,timeout=200)
print("reel3:",os.path.getsize(reel),"overlays_err:",os.path.exists(f"{OUT}/ov.err"))
