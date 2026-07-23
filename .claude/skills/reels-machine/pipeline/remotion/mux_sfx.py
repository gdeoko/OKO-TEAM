import subprocess, os
FF="/usr/local/bin/ffmpeg"
SFX="/tmp/oko_remotion/public/sfx"
VID="/tmp/qa/real4_silent.mp4"
VO="/tmp/vc/vo4.mp3"; MUS="/tmp/vc/music.mp3"
OUT="/tmp/qa/OKO_real_v4.mp4"

# чистый, разнообразный бед: (файл, время_сек, громкость)
EV = [
 ("cash",1.98,0.4),                         # сотни тысяч
 ("impact1",3.05,0.32),                      # всё в одном (мягкий)
 ("whoosh1",4.5,0.42),                       # в фичи
 ("pop",4.54,0.28),("pop",5.24,0.28),("pop",6.10,0.28),("pop",6.96,0.28),
 ("ding",7.7,0.26),("ding",8.5,0.26),("ding",9.5,0.26),   # разблок-галочки
 ("whoosh2",10.46,0.42),("click",11.5,0.42),  # запускаешь / 1 клик
 ("ding",12.2,0.28),("ding",13.3,0.28),      # обучение / сертификат
 ("cash",14.3,0.45),                         # доход
 ("sweep",15.6,0.45),("boom",15.86,0.5),     # в финал
]

inputs=["-i",VID,"-i",VO,"-i",MUS]
for f,_,_ in EV: inputs+=["-i",f"{SFX}/{f}.mp3"]
fc=[]
fc.append("[2:a]atrim=0:23.4,afade=t=in:st=0:d=1.2,afade=t=out:st=21.4:d=2,volume=0.13[mus]")
fc.append("[1:a]volume=1.28[vo]")
labels=["[vo]","[mus]"]
for i,(f,t,v) in enumerate(EV):
    k=i+3; ms=int(t*1000)
    fc.append(f"[{k}:a]atrim=0:3,volume={v},adelay={ms}|{ms}[s{i}]")
    labels.append(f"[s{i}]")
fc.append("".join(labels)+f"amix=inputs={len(labels)}:duration=longest:normalize=0,alimiter=limit=0.95,aformat=sample_rates=44100[a]")
cmd=[FF,"-y"]+inputs+["-filter_complex",";".join(fc),"-map","0:v","-map","[a]",
 "-c:v","libx264","-crf","20","-preset","medium","-pix_fmt","yuv420p",
 "-c:a","aac","-b:a","192k","-movflags","+faststart","-t","23.4",OUT,"-loglevel","error"]
print("ffmpeg,",len(EV),"sfx...")
r=subprocess.run(cmd,capture_output=True,text=True)
print("exit",r.returncode)
print(r.stderr[-1200:] if r.returncode else f"OK {OUT} {os.path.getsize(OUT)//1024}KB")
