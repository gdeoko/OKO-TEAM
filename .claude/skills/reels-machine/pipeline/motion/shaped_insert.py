# -*- coding: utf-8 -*- shaped stock insert: clip in a shape + accent ring over blurred/darkened bg
# python3 shaped_insert.py <clip> <shape> <dur> <out.mp4> [seek] [bgclip]
import sys, subprocess, os
W,H=1080,1920
BOX={'circle':(760,760),'hexagon':(820,820),'diamond':(820,820),'phone':(620,1240),
     'strip':(520,1500),'band':(980,560),'roundsquare':(820,820),'tv':(900,700),
     'pentagon':(800,800),'parallelogram':(920,620),'tilt':(860,660),'arch':(760,900),'oval':(900,680)}

def insert(clip, shape, dur, out, seek=0.0, bgclip=None):
    bw,bh=BOX[shape]; px=(W-bw)//2
    # vertical placement: upper-mid so karaoke (bottom) stays clear
    py=int(H*0.30) if bh<1100 else int(H*0.12)
    mask=f'shapes/{shape}_{bw}x{bh}_mask.png'; ring=f'shapes/{shape}_{bw}x{bh}_ring.png'
    bg=bgclip or clip
    fc=(
      f"[0:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
      f"gblur=sigma=32,eq=brightness=-0.36:saturation=0.9,setsar=1[bg];"
      f"[1:v]scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},setsar=1[fgc];"
      f"[2:v]format=gray,scale={bw}:{bh}[m];[fgc][m]alphamerge[fg];"
      f"[bg][fg]overlay={px}:{py}[b1];"
      f"[3:v]scale={bw}:{bh}[rg];[b1][rg]overlay={px}:{py}[vout]"
    )
    cmd=['ffmpeg','-y','-v','error',
         '-ss',str(seek),'-t',f'{dur:.2f}','-i',bg,
         '-ss',str(seek),'-t',f'{dur:.2f}','-i',clip,
         '-i',mask,'-i',ring,
         '-filter_complex',fc,'-map','[vout]','-t',f'{dur:.2f}',
         '-r','30','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p',out]
    r=subprocess.run(cmd,capture_output=True,text=True)
    if r.returncode: print(r.stderr[-1500:]); raise SystemExit(1)
    return out

if __name__=='__main__':
    clip,shape,dur,out=sys.argv[1],sys.argv[2],float(sys.argv[3]),sys.argv[4]
    seek=float(sys.argv[5]) if len(sys.argv)>5 else 0.0
    bg=sys.argv[6] if len(sys.argv)>6 else None
    insert(clip,shape,dur,out,seek,bg); print('OK',out)
