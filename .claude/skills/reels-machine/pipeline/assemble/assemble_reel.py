#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V.CODE — ИНТЕГРИРОВАННАЯ сборка ролика: стоки-под-смысл + ПЕРЕХОДЫ между кадрами +
АНИМО-ИНФОГРАФИКА кодом (по смыслу, каждые 3-4с, над субтитрами) + караоке-субтитры + музыка.
Ролик 20-50с. Всё разное каждый раз. Обложка НЕ интро (thumbnail при публикации).

spec = {
  "clips":[{"path","dur"} ...],           # стоки по сегментам (смысл), сумма = длина ролика
  "captions":"captions.ass",
  "vo":"vo.mp3", "music":"music.mp3",
  "overlays":[{"dir":"png_seq_dir","start":t,"dur":d} ...],   # анимо-инфографика (по смыслу)
  "grade":"...", "transition":"fade|slideleft|...", "out":"reel.mp4"
}
build(spec) -> out
"""
import subprocess, os, json

GRADES = {
 "warm":"eq=contrast=1.06:saturation=1.12:brightness=0.01,vignette=PI/5",
 "teal":"curves=b='0/0.03 0.5/0.46 1/0.95',eq=saturation=1.18:contrast=1.08,vignette=PI/4.7",
 "punch":"eq=contrast=1.1:saturation=1.16:brightness=0.008,vignette=PI/4.8",
 "noir":"eq=contrast=1.15:saturation=0.9:brightness=-0.01,vignette=PI/4.4",
}
# gl-подобные переходы через xfade (встроенные ffmpeg)
XFADES = ["fade","fadeblack","slideleft","slideright","slideup","wipeleft","circleopen","dissolve","smoothleft"]

def _probe(p):
    return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).strip())

def build(spec):
    clips = spec["clips"]; N=len(clips)
    grade = GRADES.get(spec.get("grade","warm"), GRADES["warm"])
    TR = 0.4                                  # длительность перехода
    tmp = spec.get("tmp","/tmp/_asm"); os.makedirs(tmp, exist_ok=True)
    # --- 1) нормализуем каждый клип в отдельный сегмент (scale/crop/zoom/grade), с запасом на переход ---
    segs=[]
    for i,c in enumerate(clips):
        d = c["dur"] + (TR if i < N-1 else 0)         # +переход к следующему
        seg=f"{tmp}/seg{i}.mp4"
        zoom=["z='min(1.02+0.0016*on,1.13)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
              "z='max(1.13-0.0016*on,1.02)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"][i%2]
        vf=(f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,"
            f"zoompan={zoom}:d=1:s=1080x1920:fps=30,setsar=1,{grade}")
        subprocess.run(["ffmpeg","-y","-v","error","-stream_loop","-1","-t",f"{d:.2f}","-i",c["path"],
            "-vf",vf,"-an","-r","30","-c:v","libx264","-preset","fast","-crf","18","-pix_fmt","yuv420p",seg],check=True)
        segs.append((seg,c["dur"]))
    # --- 2) склейка с ПЕРЕХОДАМИ (xfade), накопительный offset ---
    base=f"{tmp}/base.mp4"
    if N==1:
        subprocess.run(["ffmpeg","-y","-v","error","-i",segs[0][0],"-c","copy",base],check=True)
    else:
        inp=[];
        for s,_ in segs: inp+=["-i",s]
        fc=[]; off=0.0; cur="0:v"
        for i in range(1,N):
            off += segs[i-1][1]                       # старт перехода = конец предыдущего клипа
            tr = XFADES[(i-1) % len(XFADES)] if spec.get("vary_tr",True) else "fade"
            out=f"x{i}"
            fc.append(f"[{cur}][{i}:v]xfade=transition={tr}:duration={TR}:offset={off:.2f}[{out}]")
            cur=out
        subprocess.run(["ffmpeg","-y","-v","error",*inp,"-filter_complex",";".join(fc),
            "-map",f"[{cur}]","-r","30","-c:v","libx264","-preset","fast","-crf","18","-pix_fmt","yuv420p",base],check=True)
    total=_probe(base)
    # --- 3) наложение АНИМО-ИНФОГРАФИКИ (PNG-секвенции) + СУБТИТРЫ ---
    ov=spec.get("overlays",[]) or []
    inp=["-i",base]; fc=[]; cur="0:v"
    for j,o in enumerate(ov, start=1):
        inp+=["-framerate","30","-i",os.path.join(o["dir"],"f_%04d.png")]
        st=o["start"]; en=st+o["dur"]
        # сдвигаем секвенцию во времени и включаем только в окне
        fc.append(f"[{j}:v]setpts=PTS-STARTPTS+{st}/TB[o{j}]")
        nxt=f"v{j}"
        fc.append(f"[{cur}][o{j}]overlay=0:0:enable='between(t,{st:.2f},{en:.2f})'[{nxt}]")
        cur=nxt
    capf=f"[{cur}]subtitles={spec['captions']}:fontsdir=fonts[vout]" if spec.get("captions") else f"[{cur}]null[vout]"
    fc.append(capf)
    withov=f"{tmp}/withov.mp4"
    subprocess.run(["ffmpeg","-y","-v","error",*inp,"-filter_complex",";".join(fc),
        "-map","[vout]","-t",f"{total:.2f}","-r","30","-c:v","libx264","-preset","medium","-crf","19","-pix_fmt","yuv420p",withov],check=True)
    # --- 4) аудио: голос + музыка (тихо, фейды) ---
    vo=spec["vo"]; mus=spec.get("music")
    ai=["-i",withov,"-i",vo]; af=[]
    if mus:
        ai+=["-stream_loop","-1","-t",f"{total+0.5:.2f}","-i",mus]
        af.append(f"[2:a]volume=0.11,afade=t=in:st=0:d=0.5,afade=t=out:st={total-0.8:.2f}:d=0.7[m]")
        af.append(f"[1:a]afade=t=out:st={total-0.6:.2f}:d=0.5[v]")
        af.append("[v][m]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-14:TP=-1.2[a]")
    else:
        af.append(f"[1:a]afade=t=out:st={total-0.6:.2f}:d=0.5,loudnorm=I=-14:TP=-1.2[a]")
    subprocess.run(["ffmpeg","-y","-v","error",*ai,"-filter_complex",";".join(af),
        "-map","0:v","-map","[a]","-t",f"{total:.2f}","-c:v","copy","-c:a","aac","-b:a","160k",spec["out"]],check=True)
    return spec["out"], round(total,2)

if __name__=="__main__":
    import sys
    spec=json.load(open(sys.argv[1]))
    out,dur=build(spec); print("готов:",out,dur,"с")
