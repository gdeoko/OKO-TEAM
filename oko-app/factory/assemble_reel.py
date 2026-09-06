# -*- coding: utf-8 -*-
# Финальная сборка ролика DIESEL по брифу:
#  база = H3-клипы + сток (никакой статики на основной дорожке, движение гарантировано);
#  поверх = accents.mov (инфографика кодом) -> titles.mov (заголовки по ключевому слову)
#  -> вырезки (rembg, вход/уход, муть+тень) -> 3D (.mov alpha);
#  обложка (ChatGPT) первым кадром; звук = голос + музыка (дакинг) + SFX по битам.
# H3/вырезки/3D опциональны: если файлов нет — собирается на стоке (для теста), потом досборка.
import os, sys, json, subprocess, glob, math, random

ROOT="/home/user/OKO-TEAM/oko-app/factory"
R=sys.argv[1]                      # R1..R5
W=f"{ROOT}/builds2/{R}"
os.makedirs(W, exist_ok=True)
Wv=1080; Hv=1920; FPS=30

def run(cmd, **kw):
    r=subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode!=0:
        sys.stderr.write("FFERR "+(" ".join(cmd[:6]))+"\n"+r.stderr[-800:]+"\n")
    return r

def dur(path):
    o=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",path],
                     capture_output=True,text=True).stdout.strip()
    try: return float(o)
    except: return 0.0

VOICE=f"{ROOT}/voices2/{R}.mp3"
VDUR=dur(VOICE)
TOTAL=round(VDUR+0.6,2)           # хвост под затухание
print(f"{R} voice={VDUR:.2f} total={TOTAL:.2f}", flush=True)

# ---- собрать список базовых клипов: H3 (если есть) + сток ----
h3=sorted(glob.glob(f"{ROOT}/h3out/{R}/*.mp4"))
stock=sorted(glob.glob(f"{ROOT}/stock2/{R}/*.mp4"))
random.seed({"R1":11,"R2":22,"R3":33,"R4":44,"R5":55}[R])
# чередуем H3 и сток так, чтобы H3 стояли на смысловых точках (начало, середины)
base_clips=[]
if h3:
    # H3 первым (хук) и распределены; сток заполняет остальное
    pool=stock[:]
    seq=[]
    hi=0
    for i in range(max(len(stock)+len(h3), 6)):
        if h3 and (i%2==0) and hi<len(h3):
            seq.append(h3[hi]); hi+=1
        elif pool:
            seq.append(pool.pop(0))
    # добить оставшиеся H3
    while hi<len(h3): seq.append(h3[hi]); hi+=1
    base_clips=seq
else:
    base_clips=stock[:]
if not base_clips:
    print("НЕТ базовых клипов — прерываю"); sys.exit(2)

N=len(base_clips)
OVL=0.5                            # перекрытие xfade
seg=round((TOTAL+OVL*(N-1))/N,3)  # длина сегмента, чтобы сумма с перекрытиями = TOTAL
seg=max(seg,2.2)
# набор уникальных переходов на ролик (ноль повторов между роликами по стартовому индексу)
TRANS={"R1":["fade","slideup","wiperight","circleopen","smoothleft","radial"],
       "R2":["slideleft","wipedown","dissolve","pixelize","circleclose","fadeblack"],
       "R3":["wiperight","slidedown","hlslice","diagtl","fadegrays","circleopen"],
       "R4":["smoothup","wipeup","squeezev","zoomin","hblur","slideright"],
       "R5":["circleclose","wipeleft","vertopen","diagbr","distance","fade"]}[R]

# ---- 1) нормализуем каждый базовый клип: 1080x1920, движение, длина seg ----
segdir=f"{W}/segs"; os.makedirs(segdir,exist_ok=True)
seg_files=[]
for i,src in enumerate(base_clips):
    out=f"{segdir}/s{i:02d}.mp4"
    sd=dur(src)
    is_img = src.lower().endswith((".jpg",".jpeg",".png"))
    NF=int(round(seg*FPS))
    if is_img or sd<0.4:
        # статика -> ken burns зумом; выход жёстко NF кадров (кап -t seg), на основную дорожку голую статику не ставим
        vf=(f"scale=1620:2880:force_original_aspect_ratio=increase,crop=1620:2880,"
            f"zoompan=z='min(zoom+0.0009,1.16)':d={NF}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={Wv}x{Hv}:fps={FPS},"
            f"trim=duration={seg},setsar=1")
        run(["ffmpeg","-y","-loglevel","error","-loop","1","-i",src,
             "-vf",vf,"-r",str(FPS),"-t",f"{seg}","-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p",out])
    else:
        # видео уже движется: нормализуем fps/размер, петля если коротко, жёсткий кап по выходу
        loops = max(0, math.ceil(seg/sd)-1)
        vf=(f"fps={FPS},scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1")
        run(["ffmpeg","-y","-loglevel","error","-stream_loop",str(loops),"-i",src,
             "-an","-vf",vf,"-r",str(FPS),"-t",f"{seg}","-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p",out])
    if os.path.exists(out) and os.path.getsize(out)>10000:
        seg_files.append(out)
print(f"{R} segs={len(seg_files)} seg={seg:.2f}", flush=True)

# ---- 2) xfade-цепочка сегментов -> base.mp4 ----
base=f"{W}/base.mp4"
if len(seg_files)==1:
    run(["ffmpeg","-y","-loglevel","error","-i",seg_files[0],"-t",f"{TOTAL}","-c:v","libx264","-crf","19","-pix_fmt","yuv420p",base])
else:
    inp=[];
    for f in seg_files: inp+=["-i",f]
    fc=[]; cur="[0:v]"; off=0.0
    for i in range(1,len(seg_files)):
        tr=TRANS[(i-1)%len(TRANS)]
        off=round(off+seg-OVL,3)
        nxt=f"[v{i}]" if i<len(seg_files)-1 else "[v]"
        fc.append(f"{cur}[{i}:v]xfade=transition={tr}:duration={OVL}:offset={off}{nxt}")
        cur=nxt
    run(["ffmpeg","-y","-loglevel","error"]+inp+["-filter_complex",";".join(fc),
         "-map","[v]","-t",f"{TOTAL}","-r",str(FPS),"-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p",base])
print(f"{R} base {os.path.exists(base)} {os.path.getsize(base) if os.path.exists(base) else 0}", flush=True)

# ---- 3) слои: accents -> titles -> вырезки -> 3D -> обложка первым кадром ----
acc=f"{ROOT}/overlays2/{R}/accents.mov"; tit=f"{ROOT}/overlays2/{R}/titles.mov"  # qtrle: корректная альфа, быстрый декод на свободном CPU
cover=f"{ROOT}/covers/{R}_cover.jpg"
cutouts=sorted(glob.glob(f"{ROOT}/cutouts2/{R}/*.png"))
d3=sorted(glob.glob(f"{ROOT}/3dout/{R}/*.mov"))

inp=["-i",base]; idx=1
fc=[]; cur="[0:v]"
if os.path.exists(acc):
    inp+=["-i",acc]; fc.append(f"{cur}[{idx}:v]overlay=0:0:eof_action=pass:format=auto[a{idx}]"); cur=f"[a{idx}]"; idx+=1
if os.path.exists(tit):
    inp+=["-i",tit]; fc.append(f"{cur}[{idx}:v]overlay=0:0:eof_action=pass:format=auto[a{idx}]"); cur=f"[a{idx}]"; idx+=1
# вырезки (тень/glow уже впечены в PNG): вход/уход fade+slide, низ-угол, скромный размер, не на центральных титрах/верхних акцентах/краях
CUT_SLOTS=[0.24,0.52]                              # доли старта по таймлайну (центр-титровые биты, не последний)
CUT_H=640                                          # высота вырезки, px
for k,cf in enumerate(cutouts[:2]):
    inp+=["-loop","1","-i",cf]; st=round(TOTAL*CUT_SLOTS[k],2); en=round(st+3.0,2)  # -loop 1: картинка -> поток, иначе fade/enable по времени не работают
    xpos = "44" if k%2==0 else "W-w-44"            # низ-левый / низ-правый угол
    ybase = 150                                    # отступ от низа
    fc.append(f"[{idx}:v]scale=-1:{CUT_H},format=rgba,"
              f"fade=t=in:st={st}:d=0.4:alpha=1,fade=t=out:st={round(en-0.4,2)}:d=0.4:alpha=1[cc{idx}]")
    fc.append(f"{cur}[cc{idx}]overlay=x={xpos}:y='H-h-{ybase}+(1-min(1,max(0,(t-{st})/0.4)))*80':"
              f"enable='between(t,{st},{en})'[a{idx}]")
    cur=f"[a{idx}]"; idx+=1
# 3D alpha .mov
for k,df in enumerate(d3[:2]):
    inp+=["-i",df]; st=round(TOTAL*(0.30+0.3*k),2); en=round(st+4.0,2)
    fc.append(f"[{idx}:v]scale=520:-1[ds{idx}]")
    xpos = "W-w-70" if k%2==0 else "70"
    fc.append(f"{cur}[ds{idx}]overlay=x={xpos}:y=H-h-620:enable='between(t,{st},{en})'[a{idx}]")
    cur=f"[a{idx}]"; idx+=1
# обложка прикрепляется первым кадром отдельным concat-этапом ниже (без хрупкого overlay)
fc.append(f"{cur}null[v]"); cur="[v]"

vfull=f"{W}/vfull.mp4"
run(["ffmpeg","-y","-loglevel","error"]+inp+["-filter_complex",";".join(fc),
     "-map","[v]","-t",f"{TOTAL}","-r",str(FPS),"-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p",vfull])
print(f"{R} vfull {os.path.exists(vfull)} {os.path.getsize(vfull) if os.path.exists(vfull) else 0}", flush=True)

# ---- 4) звук: голос + музыка(дакинг) + SFX ----
music=f"{ROOT}/audio2/{R}/music.mp3"
sfx=sorted(glob.glob(f"{ROOT}/audio2/{R}/sfx_*.mp3"))
ainp=["-i",VOICE]; ai=1; af=[]
mixparts=["[v0]"]
af.append("[0:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1.0[v0]")
if os.path.exists(music):
    ainp+=["-stream_loop","-1","-i",music]
    # музыка приглушена и duck'ается под голос (sidechaincompress ключ = голос)
    af.append(f"[{ai}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.16[mus0]")
    af.append("[mus0][0:a]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[mus]")
    mixparts.append("[mus]"); ai+=1
# SFX по битам
sfx_slots=[0.02,0.30,0.55,0.80]
for k,sf in enumerate(sfx[:4]):
    ainp+=["-i",sf]
    st=round(TOTAL*sfx_slots[k],2)
    af.append(f"[{ai}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.5,adelay={int(st*1000)}|{int(st*1000)}[sfx{k}]")
    mixparts.append(f"[sfx{k}]"); ai+=1
af.append("".join(mixparts)+f"amix=inputs={len(mixparts)}:normalize=0:duration=first[aout]")
audio=f"{W}/audio.m4a"
run(["ffmpeg","-y","-loglevel","error"]+ainp+["-filter_complex",";".join(af),
     "-map","[aout]","-t",f"{TOTAL}","-c:a","aac","-b:a","192k",audio])
print(f"{R} audio {os.path.exists(audio)}", flush=True)

# ---- 5) тело ролика (видео+звук) ----
body=f"{W}/body.mp4"
run(["ffmpeg","-y","-loglevel","error","-i",vfull,"-i",audio,
     "-map","0:v","-map","1:a","-c:v","copy","-c:a","aac","-b:a","192k","-shortest",body])
reel=f"{W}/reel.mp4"
# ---- 6) обложка первым кадром (pervyi_kadr): 0.7с с лёгким зумом + whoosh, затем тело ----
if os.path.exists(cover):
    cov_clip=f"{W}/cover_clip.mp4"; CD=0.7
    vf=(f"scale=1300:2311:force_original_aspect_ratio=increase,crop=1300:2311,"
        f"zoompan=z='min(zoom+0.0018,1.12)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={Wv}x{Hv}:fps={FPS},setsar=1")
    wh=sorted(glob.glob(f"{ROOT}/audio2/{R}/sfx_*.mp3"))
    if wh:
        run(["ffmpeg","-y","-loglevel","error","-loop","1","-t",f"{CD}","-i",cover,"-i",wh[0],
             "-vf",vf,"-r",str(FPS),"-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p",
             "-c:a","aac","-b:a","192k","-af","volume=0.6","-shortest",cov_clip])
    else:
        run(["ffmpeg","-y","-loglevel","error","-loop","1","-t",f"{CD}","-i",cover,
             "-f","lavfi","-i","anullsrc=r=44100:cl=stereo","-vf",vf,"-r",str(FPS),
             "-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-shortest",cov_clip])
    # concat (одинаковые параметры) через демуксер
    lst=f"{W}/concat.txt"; open(lst,"w").write(f"file '{cov_clip}'\nfile '{body}'\n")
    run(["ffmpeg","-y","-loglevel","error","-f","concat","-safe","0","-i",lst,
         "-c:v","libx264","-preset","veryfast","-crf","19","-pix_fmt","yuv420p",
         "-c:a","aac","-b:a","192k","-movflags","+faststart",reel])
else:
    run(["ffmpeg","-y","-loglevel","error","-i",body,"-c","copy","-movflags","+faststart",reel])
ok=os.path.exists(reel) and os.path.getsize(reel)>50000
print(f"{R} REEL {'OK' if ok else 'FAIL'} {os.path.getsize(reel) if ok else 0} -> {reel}", flush=True)
