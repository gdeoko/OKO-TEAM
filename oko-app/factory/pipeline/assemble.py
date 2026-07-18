import os,json,subprocess
W=os.path.dirname(os.path.abspath(__file__)); FT=W+"/foot"; SEGD=W+"/segs"; os.makedirs(SEGD,exist_ok=True)
T=json.load(open(W+"/timing.json")); sched=T["schedule"]
def run(c):
    r=subprocess.run(c,capture_output=True,text=True)
    if r.returncode!=0: print("FFERR",r.stderr[-500:])
    return r.returncode
GRADE=("eq=contrast=1.10:saturation=1.14:brightness=-0.010,"
       "colorbalance=rs=0.04:gs=0.0:bs=-0.05:rm=0.03:gm=0.0:bm=-0.03:rh=0.02:bh=-0.02,"
       "curves=all='0/0.03 0.5/0.5 1/0.97',vignette=PI/4.6")
segs=[]
COVER=T["cover"]
# cover with slow push-in
cov=f"{SEGD}/seg00.mp4"
run(["ffmpeg","-y","-loop","1","-t",f"{COVER}","-i",W+"/cover.jpg","-r","30",
     "-vf",f"scale=1188:2112:force_original_aspect_ratio=increase,crop=1080:1920,"
           f"zoompan=z='min(1.0+0.12*on/{int(COVER*30)},1.12)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,format=yuv420p",
     "-c:v","libx264","-preset","medium","-crf","19","-pix_fmt","yuv420p",cov])
segs.append(cov)
idx=0
for clip,st,d in sched[1:]:
    idx+=1; src=f"{FT}/{clip}.mp4"; out=f"{SEGD}/seg{idx:02d}.mp4"
    dirn=idx%4
    if dirn==0: pan="x='(iw-1080)*(t/DUR)':y='(ih-1920)/2'"
    elif dirn==1: pan="x='(iw-1080)*(1-t/DUR)':y='(ih-1920)/2'"
    elif dirn==2: pan="x='(iw-1080)/2':y='(ih-1920)*(t/DUR)'"
    else: pan="x='(iw-1080)/2':y='(ih-1920)*(1-t/DUR)'"
    pan=pan.replace("DUR",f"{d:.3f}")
    vf=f"scale=1188:2112:force_original_aspect_ratio=increase,crop=1080:1920:{pan},{GRADE},fps=30,format=yuv420p"
    run(["ffmpeg","-y","-stream_loop","4","-i",src,"-t",f"{d:.3f}","-an","-vf",vf,
        "-c:v","libx264","-preset","medium","-crf","19","-pix_fmt","yuv420p",out])
    print(f"{idx:02d} {clip} {d:.2f}s")
with open(SEGD+"/list.txt","w") as f:
    for s in segs+[f"{SEGD}/seg{i:02d}.mp4" for i in range(1,idx+1)]: f.write(f"file '{s}'\n")
run(["ffmpeg","-y","-f","concat","-safe","0","-i",SEGD+"/list.txt","-c","copy",W+"/base.mp4"])
bd=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",W+"/base.mp4"],capture_output=True,text=True).stdout.strip()
print("BASE",bd,"s | content_end",T["content_end"])
