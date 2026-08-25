#!/usr/bin/env python3
# compose3.py v2 — placement-based compositor with feathered contrast (no glitch boxes).
# places: fs | center | bottom | left | right | rightsmall | split | leftpanel | rightpanel
import json,os,subprocess,sys
from fmts import SHAPES as FMTMAP
BASE='cc_key.mp4'
VP9='-c:v libvpx-vp9'
SEG='seg'; os.makedirs(SEG,exist_ok=True)
PLAN=json.load(open('plan3.json'))
ONLY=set(int(x) for x in sys.argv[1:]) if len(sys.argv)>1 else None

def run(cmd):
    r=subprocess.run(cmd,shell=True,capture_output=True,text=True)
    if r.returncode!=0: print('FFMPEG ERR:\n',cmd,'\n',r.stderr[-1500:]); raise SystemExit(1)
    return r
def entrance(tr):
    return 'fade=t=in:st=0:d=%.2f'%({'whip':0.10,'rgbslide':0.16,'fade':0.28}.get(tr,0.18))

def build(e):
    i=e['i']; dur=round(e['t1']-e['t0'],3); place=e['place']; gt=e['gtype']; gl=e['graphic']; t0=e['t0']; ent=entrance(e['trans'])
    ins=[('-ss %.3f -t %.3f'%(t0,dur),BASE)]      # 0 = him base
    F=[]
    def add_over():
        ins.append((VP9,'aov3/ob%d.webm'%i)); gi=len(ins)-1
        F.append('[%d:v]fps=30,scale=1920:1080,setsar=1[g]'%gi); return '[g]'
    def add_glb():
        ins.append((VP9,e['glb'])); gi=len(ins)-1
        F.append('[%d:v]fps=30,scale=1920:1080,setsar=1[g]'%gi); return '[g]'
    def add_clip(path,label):
        ins.append(('-stream_loop -1 -t %.3f'%dur,path)); return len(ins)-1
    def add_img(path):
        ins.append(('-loop 1 -t %.3f'%dur,path)); return len(ins)-1

    MW,MH=1400,788; MX,MY=(1920-MW)//2,(1080-MH)//2
    # ---------- SHAPED MEDIA (photo or stock in a UNIQUE shape/format) ----------
    if gl=='shaped':
        shape,x,y,w,h,him,zoom=FMTMAP[e['fmt']]
        isphoto = 'media' in e
        if isphoto: mi=add_img(e['media'])
        else: mi=add_clip(e['clip'],'c')
        # ---- him base (skip for fullscreen media which covers everything) ----
        if shape!='full':
            if him=='blurall':
                F.append('[0:v]fps=30,scale=2112:1188,crop=1920:1080,gblur=sigma=15,eq=brightness=-0.34:saturation=0.72,setsar=1[b]')
            elif him=='sideL':   # him on the LEFT, shape goes right
                F.append('[0:v]fps=30,scale=2208:1242,crop=1920:1080:288:100,setsar=1[b]')
            elif him=='sideR':   # him on the RIGHT, shape goes left
                F.append('[0:v]fps=30,scale=2208:1242,crop=1920:1080:0:100,setsar=1[b]')
            else:                # none
                F.append('[0:v]fps=30,scale=1920:1080,setsar=1[b]')
        # ---- fullscreen / feather special cases ----
        if shape=='full':
            # reliable crop-PAN across a slightly-larger clip (no zoompan black-bug). 4 directions.
            D=max(0.2,dur)
            if   zoom==1: cx="(iw-1920)*t/%.3f"%D;         cy="(ih-1080)/2"
            elif zoom==2: cx="(iw-1920)*(1-t/%.3f)"%D;     cy="(ih-1080)/2"
            elif zoom==3: cx="(iw-1920)/2";                cy="(ih-1080)*t/%.3f"%D
            elif zoom==4: cx="(iw-1920)/2";                cy="(ih-1080)*(1-t/%.3f)"%D
            else:         cx="(iw-1920)/2";                cy="(ih-1080)/2"
            F.append("[%d:v]fps=30,scale=2160:1215:force_original_aspect_ratio=increase,crop=2160:1215,"
                     "eq=contrast=1.05:saturation=1.12:brightness=-0.02,setsar=1,"
                     "crop=1920:1080:x='%s':y='%s',setsar=1,%s[vo]"%(mi,cx,cy,ent))
            return ins,';'.join(F),dur
        if shape=='feather':
            msk=add_img('media_mask.png')
            zp = ",zoompan=z='min(1+0.0006*on,1.10)':d=%d:s=%dx%d:fps=30"%(max(2,int(dur*30)),w,h) if zoom else ""
            F.append('[%d:v]fps=30,scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d%s,setsar=1[m0]'%(mi,int(w*1.08),int(h*1.08),w,h,zp))
            F.append('[%d:v]scale=%dx%d[mk]'%(msk,w,h))
            F.append('[m0][mk]alphamerge[m]')
            F.append('[b][m]overlay=%d:%d,%s[vo]'%(x,y,ent))
            return ins,';'.join(F),dur
        # ---- general shape: mask + lime ring (video motion is inherent; no zoompan) ----
        smi=add_img('shapes/%s_mask.png'%shape); rgi=add_img('shapes/%s_ring.png'%shape)
        F.append('[%d:v]fps=30,scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,eq=saturation=1.08:contrast=1.04,setsar=1[m0]'%(mi,w,h,w,h))
        F.append('[%d:v]scale=%dx%d[sm]'%(smi,w,h))
        F.append('[m0][sm]alphamerge[shp]')
        F.append('[b][shp]overlay=%d:%d[bb]'%(x,y))
        F.append('[%d:v]scale=%dx%d[rg]'%(rgi,w,h))
        F.append('[bb][rg]overlay=%d:%d,%s[vo]'%(x,y,ent))
        return ins,';'.join(F),dur

    # ---------- PHOTO as big feathered-center media (legacy) ----------
    if gl=='media':
        mi=add_img(e['media']); msk=add_img('media_mask.png')
        F.append('[0:v]fps=30,scale=2112:1188,crop=1920:1080,gblur=sigma=16,eq=brightness=-0.36:saturation=0.7,setsar=1[b]')
        F.append("[%d:v]scale=1560:878:force_original_aspect_ratio=increase,crop=1560:878,"
                 "zoompan=z='min(1+0.0006*on,1.10)':d=%d:s=%dx%d:fps=30,setsar=1[m0]"%(mi,max(2,int(dur*30)),MW,MH))
        F.append('[%d:v]scale=%dx%d[mk]'%(msk,MW,MH))
        F.append('[m0][mk]alphamerge[m]')
        F.append('[b][m]overlay=%d:%d,%s[vo]'%(MX,MY,ent))
        return ins,';'.join(F),dur

    # ---------- STOCK / AIVIDEO ----------
    if gl=='clip':
        ci=add_clip(e['clip'],'c')
        if place=='mediabig':
            # stock as big feathered-center media over darkened+blurred video (no box-on-face)
            msk=add_img('media_mask.png')
            F.append('[0:v]fps=30,scale=2112:1188,crop=1920:1080,gblur=sigma=16,eq=brightness=-0.36:saturation=0.7,setsar=1[b]')
            F.append('[%d:v]fps=30,scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,eq=saturation=1.1:contrast=1.05,setsar=1[m0]'%(ci,MW,MH,MW,MH))
            F.append('[%d:v]scale=%dx%d[mk]'%(msk,MW,MH))
            F.append('[m0][mk]alphamerge[m]')
            F.append('[b][m]overlay=%d:%d,%s[vo]'%(MX,MY,ent))
        elif place=='fs':
            # fullscreen stock with a punchy zoom-in entrance (nice transition from him)
            F.append('[%d:v]fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,'
                     "eq=contrast=1.06:saturation=1.12:brightness=-0.02,zoompan=z='min(1.12-0.0009*on,1.12)':d=%d:s=1920x1080:fps=30,setsar=1,%s[vo]"%(ci,max(2,int(dur*30)),ent))
        elif place in ('split','leftpanel','rightpanel'):
            # him + stock in a clean straight rounded panel (no crooked half-screen)
            side_left = place=='leftpanel'
            px = 80 if side_left else 960
            hx = '520' if side_left else '0'   # reframe him to the opposite side
            F.append('[0:v]fps=30,scale=2208:1242,crop=1920:1080:%s:100,setsar=1[b]'%hx)
            F.append('[%d:v]fps=30,scale=880:560:force_original_aspect_ratio=increase,crop=880:560,'
                     'eq=saturation=1.08:contrast=1.04,setsar=1,drawbox=0:0:880:560:0x9AFF00@1:t=5[p]'%ci)
            F.append('[b][p]overlay=%d:262:shortest=1,%s[vo]'%(px,ent))
        else:  # fs
            F.append('[%d:v]fps=30,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,'
                     'eq=contrast=1.06:saturation=1.12:brightness=-0.02,setsar=1,%s[vo]'%(ci,ent))
        return ins,';'.join(F),dur

    # ---------- COMP fullscreen (own bg) ----------
    if gl=='over' and place=='fs':
        g=add_over()
        F.append('color=c=black:s=1920x1080:d=%.3f,fps=30[bk]'%dur)
        F.append('[bk][g]overlay=0:0,%s[vo]'%ent)
        return ins,';'.join(F),dur

    # ---------- graphic over video (comp/photo/glb) with feathered contrast ----------
    g = add_glb() if gl=='glb' else add_over()
    if place=='center':
        # blur+darken WHOLE frame, big graphic centered (face blurred -> no obstruction, great contrast)
        F.append('[0:v]fps=30,scale=2112:1188,crop=1920:1080,gblur=sigma=15,eq=brightness=-0.34:saturation=0.7,setsar=1[b]')
        F.append('[b]%soverlay=0:0,%s[vo]'%(g,ent))
    elif place in ('bottom','lowbar'):
        gi=add_img('grad_bottom.png')
        F.append('[0:v]fps=30,scale=1920:1080,setsar=1[b0]')
        F.append('[b0][%d:v]overlay=0:0[b]'%gi)
        F.append('[b]%soverlay=0:0,%s[vo]'%(g,ent))
    elif place in ('left',):
        gi=add_img('grad_left.png')
        F.append('[0:v]fps=30,scale=2208:1242,crop=1920:1080:0:100,setsar=1[b0]')   # him to the right
        F.append('[b0][%d:v]overlay=0:0[b]'%gi)
        F.append('[b]%soverlay=0:0,%s[vo]'%(g,ent))
    elif place in ('right','rightsmall','split'):
        gi=add_img('grad_right.png')
        F.append('[0:v]fps=30,scale=2208:1242,crop=1920:1080:300:100,setsar=1[b0]')  # him to the left
        F.append('[b0][%d:v]overlay=0:0[b]'%gi)
        F.append('[b]%soverlay=0:0,%s[vo]'%(g,ent))
    else:  # fallback center
        F.append('[0:v]fps=30,scale=2112:1188,crop=1920:1080,gblur=sigma=15,eq=brightness=-0.34,setsar=1[b]')
        F.append('[b]%soverlay=0:0,%s[vo]'%(g,ent))
    return ins,';'.join(F),dur

def render_seg(e):
    i=e['i']; ins,fc,dur=build(e)
    incmd=' '.join('%s -i %s'%(fl,p) for fl,p in ins)
    out='%s/seg_%03d.mp4'%(SEG,i)
    run('ffmpeg -v error -y %s -filter_complex "%s" -map "[vo]" -t %.3f -r 30 -c:v libx264 '
        '-preset veryfast -crf 20 -pix_fmt yuv420p -x264-params keyint=60:min-keyint=60:scenecut=0 -an %s'%(incmd,fc,dur,out))

if __name__=='__main__':
    todo=[e for e in PLAN if ONLY is None or e['i'] in ONLY]
    for k,e in enumerate(todo):
        if e['graphic']=='glb' and not os.path.exists(e['glb']): print('WARN %d no glb'%e['i']); e['graphic']='over'; e['place']='center'
        if e['graphic']=='over' and not os.path.exists('aov3/ob%d.webm'%e['i']): print('WARN %d no overlay'%e['i']); continue
        render_seg(e)
        print('seg %03d (%d/%d) place=%s gt=%s'%(e['i'],k+1,len(todo),e['place'],e['gtype']))
    print('DONE')
