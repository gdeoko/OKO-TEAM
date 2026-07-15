#!/usr/bin/env python3
import subprocess, os, json, glob, re
os.chdir(os.path.dirname(os.path.abspath(__file__)))
def run(args, **k):
    r=subprocess.run(args, capture_output=True, text=True, **k)
    if r.returncode!=0:
        print("FAIL:"," ".join(args[:6])); print(r.stderr[-1500:]); raise SystemExit(1)
    return r
def have(f): return os.path.exists(f) and os.path.getsize(f)>10000

WEBM=glob.glob("rec/vid/*.webm")[0]
# auto-detect black leader end (animation t=0)
_bd=subprocess.run(["ffmpeg","-i",WEBM,"-vf","blackdetect=d=0.15:pix_th=0.06","-an","-f","null","-"],
                   capture_output=True,text=True).stderr
_m=re.search(r"black_start:0(?:\.0+)?\s+black_end:([0-9.]+)",_bd)
LEADER=float(_m.group(1)) if _m else 1.4
print("LEADER detected =",LEADER)
ADUR=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0","vo/full.mp3"]).decode().strip())
COVER=2.4; XF=0.4; MAIN_AT=COVER-XF   # output time where main (anim t=0) starts = 2.0
TOTAL=COVER+ADUR-XF
print(f"ADUR={ADUR:.2f} MAIN_AT={MAIN_AT} TOTAL={TOTAL:.2f}")

# ---- shift subtitles by MAIN_AT ----
def shift_ass(src,dst,off):
    def sh(m):
        def cvt(ts):
            h,mm,rest=ts.split(':'); s,cs=rest.split('.')
            x=int(h)*3600+int(mm)*60+int(s)+int(cs)/100+off
            h2=int(x//3600); x-=h2*3600; m2=int(x//60); x-=m2*60; s2=int(x); cs2=int(round((x-s2)*100))
            return f"{h2}:{m2:02d}:{s2:02d}.{cs2:02d}"
        return f"Dialogue: {m.group(1)},{cvt(m.group(2))},{cvt(m.group(3))},"
    out=[]
    for ln in open(src):
        m=re.match(r"Dialogue: (\d+),(\d+:\d\d:\d\d\.\d\d),(\d+:\d\d:\d\d\.\d\d),",ln)
        out.append(re.sub(r"Dialogue: (\d+),(\d+:\d\d:\d\d\.\d\d),(\d+:\d\d:\d\d\.\d\d),",sh,ln) if m else ln)
    open(dst,"w").write("".join(out))
shift_ass("subs.ass","subs_final.ass",MAIN_AT)

# ---- 1. main video (trim synced) ----
if not have("main.mp4"): run(["ffmpeg","-y","-ss",str(LEADER),"-i",WEBM,"-t",f"{ADUR:.3f}",
     "-an","-vf","fps=30,format=yuv420p","-c:v","libx264","-preset","medium","-crf","18","main.mp4"])
# ---- 2. cover video (subtle zoom) ----
if not have("cover.mp4"): run(["ffmpeg","-y","-loop","1","-i","assets/cover.png","-t",str(COVER),
     "-vf",f"scale=2200:-1,zoompan=z='min(zoom+0.0009,1.10)':d={int(COVER*30)}:s=1920x1080:fps=30,format=yuv420p",
     "-c:v","libx264","-preset","medium","-crf","18","cover.mp4"])
# ---- 3. xfade cover->main ----
if not have("video.mp4"): run(["ffmpeg","-y","-i","cover.mp4","-i","main.mp4","-filter_complex",
     f"[0:v][1:v]xfade=transition=fade:duration={XF}:offset={MAIN_AT},format=yuv420p[v]",
     "-map","[v]","-c:v","libx264","-preset","medium","-crf","18","video.mp4"])

# ---- 4. audio ----
# SFX cue list: (file, time_in_output_sec, gain)
seg=[0,28.75,57.426,90.782,121.186,147.39,171.026,198.526,223.818]
cues=[]
for i,s in enumerate(seg):
    cues.append(("sfx/whoosh.mp3", MAIN_AT+s-0.15, 0.32))
# accents
cues += [
 ("sfx/riser.mp3",  MAIN_AT+0.2, 0.22),
 ("sfx/sparkle.mp3",MAIN_AT+30.0,0.30),("sfx/pop.mp3",MAIN_AT+31.0,0.28),("sfx/pop.mp3",MAIN_AT+32.0,0.28),
 ("sfx/type.mp3",   MAIN_AT+149.0,0.35),("sfx/type.mp3",MAIN_AT+149.8,0.35),("sfx/type.mp3",MAIN_AT+150.6,0.35),
 ("sfx/sparkle.mp3",MAIN_AT+175.0,0.40),("sfx/impact.mp3",MAIN_AT+175.1,0.30),
 ("sfx/impact.mp3", MAIN_AT+199.3,0.30),("sfx/impact.mp3",MAIN_AT+200.1,0.30),("sfx/impact.mp3",MAIN_AT+200.9,0.32),
 ("sfx/sparkle.mp3",MAIN_AT+224.2,0.34),
]
cues=[c for c in cues if os.path.exists(c[0])]
# build sfx bed
inp=[]; fc=[];
for k,(f,t,g) in enumerate(cues):
    inp+=["-i",f]
    fc.append(f"[{k}:a]adelay={int(t*1000)}|{int(t*1000)},volume={g}[s{k}]")
mix="".join(f"[s{k}]" for k in range(len(cues)))
fc.append(mix+f"amix=inputs={len(cues)}:normalize=0:duration=longest[sfx]")
run(["ffmpeg","-y",*inp,"-filter_complex",";".join(fc),"-map","[sfx]","-t",f"{TOTAL:.3f}","-c:a","pcm_s16le","sfxbed.wav"])

# vo delayed, music looped+ducked, then mix
d=int(MAIN_AT*1000)
run(["ffmpeg","-y","-i","vo/full.mp3","-stream_loop","-1","-i","music.mp3","-i","sfxbed.wav",
     "-filter_complex",
     f"[0:a]adelay={d}|{d},volume=1.0,aresample=48000,asplit=2[vo][vok];"
     f"[1:a]volume=0.15,aresample=48000[mus];"
     f"[mus][vok]sidechaincompress=threshold=0.03:ratio=6:attack=6:release=320[musd];"
     f"[2:a]aresample=48000[sfxa];"
     f"[vo][musd][sfxa]amix=inputs=3:normalize=0:duration=first[mx];"
     f"[mx]loudnorm=I=-14:TP=-1.5:LRA=11[a]",
     "-map","[a]","-t",f"{TOTAL:.3f}","-c:a","pcm_s16le","audio.wav"])

# ---- 5. final mux + burn karaoke ----
run(["ffmpeg","-y","-i","video.mp4","-i","audio.wav",
     "-vf","ass=subs_final.ass",
     "-map","0:v","-map","1:a","-c:v","libx264","-preset","slow","-crf","19","-pix_fmt","yuv420p",
     "-c:a","aac","-b:a","192k","-movflags","+faststart","-shortest","oko_lesson1.mp4"])
print("DONE oko_lesson1.mp4", os.path.getsize("oko_lesson1.mp4"))
