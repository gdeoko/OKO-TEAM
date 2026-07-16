#!/usr/bin/env python3
# Assemble from deterministic 30fps frames + eugene VO + ducked music + SFX + karaoke.
import subprocess, os, re, glob
os.chdir(os.path.dirname(os.path.abspath(__file__)))
def run(a,**k):
    r=subprocess.run(a,capture_output=True,text=True,**k)
    if r.returncode!=0: print("FAIL:"," ".join(a[:6])); print(r.stderr[-1600:]); raise SystemExit(1)
    return r
def have(f): return os.path.exists(f) and os.path.getsize(f)>10000

ADUR=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0","vo/full.mp3"]).decode().strip())
FPS=30; COVER=2.4; XF=0.4; MAIN_AT=COVER-XF; TOTAL=COVER+ADUR-XF
print(f"ADUR={ADUR:.2f} MAIN_AT={MAIN_AT} TOTAL={TOTAL:.2f}")

# shift subs by MAIN_AT
def shift_ass(src,dst,off):
    def cvt(ts):
        h,m,rest=ts.split(':'); s,cs=rest.split('.')
        x=int(h)*3600+int(m)*60+int(s)+int(cs)/100+off
        H=int(x//3600);x-=H*3600;M=int(x//60);x-=M*60;S=int(x);C=int(round((x-S)*100))
        return f"{H}:{M:02d}:{S:02d}.{C:02d}"
    out=[]
    for ln in open(src):
        m=re.match(r"(Dialogue: \d+,)(\d+:\d\d:\d\d\.\d\d),(\d+:\d\d:\d\d\.\d\d),",ln)
        out.append(f"{m.group(1)}{cvt(m.group(2))},{cvt(m.group(3))},"+ln.split(',',4)[4] if m else ln)
    open(dst,"w").write("".join(out))
shift_ass("subs.ass","subs_final.ass",MAIN_AT)

# 1. main video from frames
if not have("main.mp4"):
    run(["ffmpeg","-y","-framerate",str(FPS),"-i","rec/frames/f%05d.jpg","-t",f"{ADUR:.3f}",
         "-vf","format=yuv420p","-c:v","libx264","-preset","medium","-crf","18","-r",str(FPS),"main.mp4"])
# 2. cover
if not have("cover.mp4"):
    run(["ffmpeg","-y","-loop","1","-i","assets/cover.png","-t",str(COVER),
         "-vf",f"scale=2200:-1,zoompan=z='min(zoom+0.0009,1.10)':d={int(COVER*FPS)}:s=1920x1080:fps={FPS},format=yuv420p",
         "-c:v","libx264","-preset","medium","-crf","18","cover.mp4"])
# 3. xfade
if not have("video.mp4"):
    run(["ffmpeg","-y","-i","cover.mp4","-i","main.mp4","-filter_complex",
         f"[0:v][1:v]xfade=transition=fade:duration={XF}:offset={MAIN_AT},format=yuv420p[v]",
         "-map","[v]","-c:v","libx264","-preset","medium","-crf","18","video.mp4"])

# 4. audio: SFX cues (output-time sec, gain)
S=[0.0, 18.525, 35.2, 56.938, 76.963, 95.713, 113.588, 128.55, 144.375]
cues=[("sfx/whoosh.mp3",MAIN_AT+s-0.12,0.30) for s in S]
cues+=[("sfx/riser.mp3",MAIN_AT+0.2,0.22),
 ("sfx/sparkle.mp3",MAIN_AT+19.6,0.30),("sfx/pop.mp3",MAIN_AT+20.5,0.26),("sfx/pop.mp3",MAIN_AT+21.4,0.26),
 ("sfx/pop.mp3",MAIN_AT+35.6,0.24),("sfx/pop.mp3",MAIN_AT+36.2,0.24),
 ("sfx/sparkle.mp3",MAIN_AT+116.19,0.38),("sfx/impact.mp3",MAIN_AT+116.29,0.30),
 ("sfx/impact.mp3",MAIN_AT+129.10,0.30),("sfx/impact.mp3",MAIN_AT+129.70,0.30),("sfx/impact.mp3",MAIN_AT+130.30,0.32),
 ("sfx/sparkle.mp3",MAIN_AT+144.57,0.32)]
cues=[c for c in cues if os.path.exists(c[0])]
inp=[]; fc=[]
for k,(f,t,g) in enumerate(cues):
    inp+=["-i",f]; fc.append(f"[{k}:a]adelay={int(t*1000)}|{int(t*1000)},volume={g}[s{k}]")
fc.append("".join(f"[s{k}]" for k in range(len(cues)))+f"amix=inputs={len(cues)}:normalize=0:duration=longest[sfx]")
run(["ffmpeg","-y",*inp,"-filter_complex",";".join(fc),"-map","[sfx]","-t",f"{TOTAL:.3f}","-c:a","pcm_s16le","sfxbed.wav"])

d=int(MAIN_AT*1000)
run(["ffmpeg","-y","-i","vo/full.mp3","-stream_loop","-1","-i","music.mp3","-i","sfxbed.wav","-filter_complex",
     f"[0:a]adelay={d}|{d},volume=1.18,aresample=48000,asplit=2[vo][vok];"
     f"[1:a]volume=0.10,aresample=48000[mus];"
     f"[mus][vok]sidechaincompress=threshold=0.05:ratio=9:attack=5:release=340[musd];"
     f"[2:a]aresample=48000[sfxa];"
     f"[vo][musd][sfxa]amix=inputs=3:normalize=0:duration=first[mx];"
     f"[mx]loudnorm=I=-14:TP=-1.5:LRA=11[a]",
     "-map","[a]","-t",f"{TOTAL:.3f}","-c:a","pcm_s16le","audio.wav"])

# 5. final mux + burn karaoke  (also web version <30MB)
run(["ffmpeg","-y","-i","video.mp4","-i","audio.wav","-vf","ass=subs_final.ass",
     "-map","0:v","-map","1:a","-c:v","libx264","-preset","slow","-crf","19","-pix_fmt","yuv420p",
     "-c:a","aac","-b:a","192k","-movflags","+faststart","-shortest","oko_lesson1.mp4"])
run(["ffmpeg","-y","-i","video.mp4","-i","audio.wav","-vf","ass=subs_final.ass",
     "-map","0:v","-map","1:a","-c:v","libx264","-preset","medium","-crf","24","-pix_fmt","yuv420p",
     "-c:a","aac","-b:a","160k","-movflags","+faststart","-shortest","oko_lesson1_web.mp4"])
print("DONE", os.path.getsize("oko_lesson1.mp4"), os.path.getsize("oko_lesson1_web.mp4"))
