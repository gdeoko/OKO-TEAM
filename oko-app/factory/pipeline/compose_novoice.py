import os,json,subprocess
W=os.path.dirname(os.path.abspath(__file__))
T=json.load(open(W+"/timing.json"))
def run(c,label=""):
    r=subprocess.run(c,capture_output=True,text=True)
    if r.returncode!=0: print("ERR",label,r.stderr[-800:])
    return r.returncode
# endcard.mp4 is pre-rendered (brand-constant, animated). Concat base + endcard.
open(W+"/vlist.txt","w").write(f"file '{W}/base.mp4'\nfile '{W}/endcard.mp4'\n")
run(["ffmpeg","-y","-f","concat","-safe","0","-i",W+"/vlist.txt","-c","copy",W+"/vfull.mp4"],"concat")
# overlays (all offset 0, full length): accents (top) + titles (mid) + subtitles (bottom)
inp=["-i",W+"/vfull.mp4","-i",f"{W}/ig/titles.mov"]
fc=("[0:v][1:v]overlay=0:0:eof_action=pass:format=auto[v]")
cmd=["ffmpeg","-y"]+inp+["-i",W+"/audio.m4a","-filter_complex",fc,
     "-map","[v]","-map","2:a","-c:v","libx264","-preset","medium","-crf","20",
     "-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-movflags","+faststart",W+"/reel.mp4","-loglevel","error"]
open(W+"/compose_cmd.txt","w").write(" ".join(cmd))
run(cmd,"compose")
d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",W+"/reel.mp4"],capture_output=True,text=True).stdout.strip()
sz=os.path.getsize(W+"/reel.mp4")//1024//1024 if os.path.exists(W+"/reel.mp4") else 0
print("REEL",d,"s",sz,"MB")
