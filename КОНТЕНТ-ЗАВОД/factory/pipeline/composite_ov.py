#!/usr/bin/env python3
# composite_ov.py — финальный свод С НАЛОЖЕНИЯМИ (инфографика/анимации по смыслу).
# Вход: montage.mp4 + audio.m4a(VO+музыка) + subs_std.ass + ov/o*.webm(по schedule.json) + лого-CTA.
# Использование: python3 composite_ov.py <WD> <TOTAL> <CTA> <OUT.mp4>
import subprocess,os,sys,json
WD=sys.argv[1]; TOTAL=float(sys.argv[2]); CTA=float(sys.argv[3]); OUT=sys.argv[4]
FONTS="/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"
LOGO="/home/user/OKO-TEAM/brand/metanoia/png/metanoia-logo-1024.png"
sched=json.load(open(f"{WD}/schedule.json")) if os.path.exists(f"{WD}/schedule.json") else []

# входы: 0=montage, 1=audio, 2=logo, 3..=наложения (в порядке schedule)
inputs=["-i",f"{WD}/work/montage.mp4","-i",f"{WD}/work/audio.m4a","-i",LOGO]
ov_idx=[]
for s in sched:
    p=f"{WD}/ov/o{s['id']}.webm"
    if os.path.exists(p):
        inputs+=["-c:v","libvpx-vp9","-i",p]; ov_idx.append((len(ov_idx)+3,s))

fc=[]; cur="0:v"
# наложить каждую инфографику в её окне времени.
# ВАЖНО: overlay синхронит вторичный вход с главным таймлайном от t=0, а webm короткие —
# поэтому СДВИГАЕМ PTS каждого webm на его start (setpts=PTS+start/TB), иначе к окну enable
# webm уже кончился и показывает последний (прозрачный) кадр.
for n,(idx,s) in enumerate(ov_idx):
    st=float(s['start']); en=st+float(s['dur'])
    lbl=f"v{n}"; sh=f"s{n}"
    fc.append(f"[{idx}:v]setpts=PTS+{st:.3f}/TB[{sh}]")
    fc.append(f"[{cur}][{sh}]overlay=0:0:enable='between(t,{st:.2f},{en:.2f})':shortest=0[{lbl}]")
    cur=lbl
# субтитры
fc.append(f"[{cur}]subtitles={WD}/work/subs_std.ass:fontsdir={FONTS}[sub]")
# CTA-эндкард: лого + okoteam.top
fc.append(f"[2:v]scale=210:-1[lg]")
fc.append(f"[sub][lg]overlay=x=(W-w)/2:y=1000:enable='between(t,{CTA},{TOTAL})'[lgv]")
fc.append(f"[lgv]drawtext=fontfile={FONTS}/montserrat-v31-cyrillic_latin-700.ttf:text='okoteam.top':"
          f"fontcolor=0xF6F2E8:fontsize=52:x=(w-tw)/2:y=1215:box=1:boxcolor=0xC4703F@0.85:boxborderw=18:"
          f"enable='between(t,{CTA},{TOTAL})'[v]")
cmd=["ffmpeg","-y"]+inputs+["-filter_complex",";".join(fc),"-map","[v]","-map","1:a",
     "-t",str(TOTAL),"-r","30","-c:v","libx264","-preset","medium","-crf","19","-pix_fmt","yuv420p",
     "-c:a","aac","-b:a","192k","-movflags","+faststart",OUT]
r=subprocess.run(cmd,capture_output=True,text=True)
ok=os.path.exists(OUT) and os.path.getsize(OUT)>300000
print("composite_ov", "OK "+str(os.path.getsize(OUT))+" наложений:"+str(len(ov_idx)) if ok else "FAIL\n"+r.stderr[-600:])
