import subprocess, os
WD="/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad/reel02"
FONTS="/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"
# оверлеи: (id, старт, длит) — тайминг под РЕАЛЬНЫЙ голос (whisper) + 2 новые анимации
ov=[("A_night",0.9,4.6),("1_hook",1.0,4.0),("2_count",5.8,3.0),("B_qdots",9.0,13.6),
    ("3_q1",9.3,4.0),("4_q2",13.8,4.2),("5_q3",18.2,4.5),("6_brain",22.6,4.5),("7_flow",27.0,3.2)]
ins=["-i",f"{WD}/work/intro.mp4","-i",f"{WD}/work/montage_b.mp4","-i",f"{WD}/work/outro2.mp4"]
for oid,_,_ in ov: ins+=["-c:v","libvpx-vp9","-i",f"{WD}/ov/o{oid}.webm"]
ins+=["-i",f"{WD}/work/audio36.m4a"]
fc=[]
fc.append("[0:v][1:v]xfade=transition=fade:duration=0.4:offset=1.8[b1]")
fc.append("[b1][2:v]xfade=transition=fadeblack:duration=0.4:offset=31.8[base]")
prev="base"
for i,(oid,off,d) in enumerate(ov):
    idx=3+i
    fc.append(f"[{idx}:v]setpts=PTS+{off}/TB,format=yuva420p[s{i}]")
    fc.append(f"[{prev}][s{i}]overlay=0:0:enable='between(t,{off},{off+d})':eof_action=pass[c{i}]")
    prev=f"c{i}"
# прогресс-бар сверху
fc.append(f"[{prev}]drawbox=x=0:y=0:w='min(iw,iw*(t-2)/30)':h=8:color=0xD4A574@0.9:t=fill:enable='between(t,2,32)'[pb]")
# резкие караоке-субтитры (синхрон whisper)
fc.append(f"[pb]subtitles={WD}/work/subs3.ass:fontsdir={FONTS}[v]")
filt=";".join(fc)
aidx=3+len(ov)
out=f"{WD}/work/reel02_v3.mp4"
cmd=["ffmpeg","-y"]+ins+["-filter_complex",filt,"-map","[v]","-map",f"{aidx}:a",
     "-t","36.0","-r","30","-c:v","libx264","-preset","medium","-crf","19","-pix_fmt","yuv420p",
     "-c:a","aac","-b:a","192k","-movflags","+faststart",out]
r=subprocess.run(cmd,capture_output=True,text=True)
print("OK" if os.path.exists(out) and os.path.getsize(out)>10000 else "FAIL")
if not (os.path.exists(out) and os.path.getsize(out)>10000): print(r.stderr[-1000:])
