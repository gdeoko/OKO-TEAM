import subprocess,os
FF="/usr/local/bin/ffmpeg"; S2="/tmp/oko_remotion/public/sfx2"; S1="/tmp/oko_remotion/public/sfx"
VID="/tmp/qa/story_silent.mp4"; VO="/tmp/vc2/vo_s.mp3"; MUS="/tmp/vc2/music_story.mp3"; OUT="/tmp/qa/OKO_story.mp4"
# (path, time, vol)
EV=[(f"{S2}/subdrop.mp3",3.9,0.42),(f"{S2}/riser.mp3",6.6,0.4),(f"{S2}/impact.mp3",8.0,0.5),
    (f"{S2}/swish.mp3",11.55,0.34),(f"{S2}/swish.mp3",15.96,0.34),
    (f"{S1}/cash.mp3",25.5,0.42),(f"{S2}/impact.mp3",31.4,0.5)]
for p,_,_ in EV: assert os.path.exists(p),p
inp=["-i",VID,"-i",VO,"-i",MUS]
for p,_,_ in EV: inp+=["-i",p]
fc=["[2:a]atrim=0:36,volume=0.17,afade=t=out:st=34:d=2[mus]","[1:a]volume=1.3[vo]"]
lab=["[vo]","[mus]"]
for i,(p,t,v) in enumerate(EV):
    k=i+3; ms=int(t*1000); fc.append(f"[{k}:a]atrim=0:4,volume={v},adelay={ms}|{ms}[s{i}]"); lab.append(f"[s{i}]")
fc.append("".join(lab)+f"amix=inputs={len(lab)}:duration=longest:normalize=0,alimiter=limit=0.95,aformat=sample_rates=44100[a]")
cmd=[FF,"-y"]+inp+["-filter_complex",";".join(fc),"-map","0:v","-map","[a]","-c:v","libx264","-crf","20","-preset","medium","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart","-t","36",OUT,"-loglevel","error"]
r=subprocess.run(cmd,capture_output=True,text=True)
print("exit",r.returncode, (r.stderr[-800:] if r.returncode else f"OK {OUT} {os.path.getsize(OUT)//1024}KB"))
