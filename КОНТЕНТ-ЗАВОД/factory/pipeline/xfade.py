import subprocess
WD="/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad/reel02"
N=12; D=2.9; OV=0.40
trans=["fade","slideleft","wiperight","circleopen","dissolve","slideup","fadeblack","smoothright","circleclose","wipeup","diagtl"]
inp=[]
for i in range(N): inp += ["-i", f"{WD}/seg/s{i:02d}.mp4"]
fc=[]; prev="0:v"; total=D
for k in range(N-1):
    off=round(total-OV,3)
    lbl=f"x{k}"
    a=f"[{prev}]" if k==0 else f"[{prev}]"
    fc.append(f"{a}[{k+1}:v]xfade=transition={trans[k]}:duration={OV}:offset={off}[{lbl}]")
    prev=lbl; total=round(total+D-OV,3)
filt=";".join(fc)
out=f"{WD}/work/montage.mp4"
cmd=["ffmpeg","-y"]+inp+["-filter_complex",filt,"-map",f"[{prev}]","-r","30","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p",out]
print("итоговая длит.:",total,"с")
r=subprocess.run(cmd,capture_output=True,text=True)
import os
print("montage:", "OK" if os.path.exists(out) else "FAIL", r.stderr[-200:] if not os.path.exists(out) else "")
