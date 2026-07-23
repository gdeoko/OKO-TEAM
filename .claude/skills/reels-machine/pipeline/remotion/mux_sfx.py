import subprocess, os
FF="/usr/local/bin/ffmpeg"
SFX="/tmp/oko_remotion/public/sfx"
VID="/tmp/qa/real3_silent.mp4"
VO="/tmp/vc/vo2.mp3"; MUS="/tmp/vc/music.mp3"
OUT="/tmp/qa/OKO_real_v3.mp4"

# события: (файл, время_сек, громкость)
EV = [
 ("cash",0.15,0.45),
 ("whoosh1",3.0,0.5),("impact1",4.02,0.4),
 ("sweep",6.2,0.5),
 ("pop",6.23,0.4),("pop",7.13,0.4),("pop",7.93,0.4),("pop",8.87,0.4),
 ("whoosh2",9.6,0.45),
 ("ding",9.7,0.32),("ding",10.45,0.32),("ding",11.45,0.32),
 ("whoosh1",12.5,0.5),("click",12.72,0.5),
 ("sweep",14.45,0.5),("ding",15.35,0.45),
 ("ding",15.9,0.4),
 ("whoosh2",16.8,0.45),("cash",16.95,0.5),
 ("sweep",17.9,0.55),("boom",18.5,0.6),("impact1",18.5,0.4),
]

inputs = ["-i",VID,"-i",VO,"-i",MUS]
for f,_,_ in EV: inputs += ["-i", f"{SFX}/{f}.mp3"]

fc = []
fc.append("[2:a]atrim=0:24.5,afade=t=in:st=0:d=1.2,afade=t=out:st=22.5:d=2,volume=0.15[mus]")
fc.append("[1:a]highpass=f=85,volume=1.32[vo]")
labels=["[vo]","[mus]"]
for i,(f,t,v) in enumerate(EV):
    k=i+3; ms=int(t*1000)
    fc.append(f"[{k}:a]atrim=0:3,volume={v},adelay={ms}|{ms}[s{i}]")
    labels.append(f"[s{i}]")
fc.append("".join(labels)+f"amix=inputs={len(labels)}:duration=longest:normalize=0,alimiter=limit=0.95,aformat=sample_rates=44100[a]")

cmd=[FF,"-y"]+inputs+["-filter_complex",";".join(fc),
     "-map","0:v","-map","[a]","-c:v","libx264","-crf","20","-preset","medium",
     "-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart","-t","24.5",OUT,"-loglevel","error"]
print("running ffmpeg with",len(EV),"sfx events...")
r=subprocess.run(cmd,capture_output=True,text=True)
print("exit",r.returncode)
if r.returncode: print(r.stderr[-1500:])
else: print("OK", OUT, os.path.getsize(OUT)//1024,"KB")
