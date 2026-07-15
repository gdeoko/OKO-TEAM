# -*- coding: utf-8 -*-
"""V.CODE cover via FREE FLUX (HF ZeroGPU) + real logo composite.
Connector-free path for autonomous 9:00 sessions (no Higgsfield needed).
Usage: python3 cover_flux.py "<visual prompt>" "<HEADLINE>" out.jpg [logo_hd.png]
Fallback: if FLUX space is unreachable, falls back to a Pexels still + logo.
"""
import os, sys, io, time, subprocess, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

OR=(234,89,32); WH=(255,255,255); BK=(12,12,12)
W,H=768,1376  # 9:16 cover, matches reel covers

def _font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "SouzGrotesk-Bold.ttf","/tmp/SouzGrotesk-Bold.ttf"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()

CA=os.environ.get("CA_BUNDLE","/root/.ccr/ca-bundle.crt")
if os.path.exists(CA):
    os.environ.setdefault("REQUESTS_CA_BUNDLE",CA)
    os.environ.setdefault("SSL_CERT_FILE",CA)

def flux(prompt, seed):
    """Generate a 9:16 base image via free HF ZeroGPU FLUX.1-schnell. Returns PIL or None."""
    try:
        from gradio_client import Client
        tok=os.environ.get("HF_TOKEN")
        sslv=CA if os.path.exists(CA) else True
        for space in ["black-forest-labs/FLUX.1-schnell","black-forest-labs/FLUX.1-dev"]:
            try:
                c=Client(space, token=tok, ssl_verify=sslv, verbose=False)
                # FLUX.1-schnell /infer -> (image_path, seed)
                res=c.predict(prompt, seed, True, 768, 1344, 4, api_name="/infer")
                path=res[0] if isinstance(res,(list,tuple)) else res
                if isinstance(path,dict): path=path.get("path") or path.get("url")
                if path and os.path.exists(path):
                    return Image.open(path).convert("RGB")
            except Exception as e:
                print("[flux] space fail:", space, str(e)[:160]); continue
    except Exception as e:
        print("[flux] import/setup fail:", str(e)[:160])
    return None

def _curl(url, headers=None, out=None):
    cmd=["curl","-sS","--cacert",CA,url]
    for k,v in (headers or {}).items(): cmd+=["-H",f"{k}: {v}"]
    if out: cmd+=["-o",out]
    return subprocess.run(cmd,capture_output=True,timeout=60)

def pexels_still(query):
    """Fallback base: a Pexels photo still (via curl through proxy)."""
    import json, urllib.parse
    key=os.environ.get("PEXELS_API_KEY")
    if not key: return None
    try:
        u=f"https://api.pexels.com/v1/search?query={urllib.parse.quote(query)}&per_page=15&orientation=portrait"
        r=_curl(u,{"Authorization":key})
        data=json.loads(r.stdout.decode())
        photos=data.get("photos",[])
        if not photos: return None
        p=random.choice(photos[:10])["src"]["large2x"]
        tmp="_pex_still.jpg"; _curl(p,None,tmp)
        return Image.open(tmp).convert("RGB")
    except Exception as e:
        print("[pexels] fail:", str(e)[:120]); return None

def cover_crop(im):
    iw,ih=im.size; tr=W/H
    if iw/ih>tr:
        nw=int(ih*tr); im=im.crop(((iw-nw)//2,0,(iw-nw)//2+nw,ih))
    else:
        nh=int(iw/tr); im=im.crop((0,(ih-nh)//2,iw,(ih-nh)//2+nh))
    return im.resize((W,H), Image.LANCZOS)

def grade(im):
    im=ImageEnhance.Contrast(im).enhance(1.10)
    im=ImageEnhance.Color(im).enhance(1.06)
    # warm push toward brand orange
    r,g,b=im.split()
    r=r.point(lambda v:min(255,int(v*1.05))); b=b.point(lambda v:int(v*0.95))
    return Image.merge("RGB",(r,g,b))

def vignette(im, strength=0.55):
    mask=Image.new("L",(W,H),0); d=ImageDraw.Draw(mask)
    d.ellipse((-W*0.3,-H*0.2,W*1.3,H*1.2), fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(160))
    dark=ImageEnhance.Brightness(im).enhance(1-strength)
    return Image.composite(im,dark,mask)

def wrap(draw,text,font,maxw):
    words=text.split(); lines=[]; cur=""
    for w in words:
        t=(cur+" "+w).strip()
        if draw.textlength(t,font=font)<=maxw: cur=t
        else: lines.append(cur); cur=w
    if cur: lines.append(cur)
    return lines

def compose(base, headline, logo_path):
    im=vignette(grade(cover_crop(base)))
    # bottom gradient scrim for text legibility (darken video, no plate)
    scrim=Image.new("L",(W,H),0); ds=ImageDraw.Draw(scrim)
    for y in range(H):
        a=0 if y<H*0.5 else int(200*((y-H*0.5)/(H*0.5)))
        ds.line([(0,y),(W,y)], fill=a)
    dark=ImageEnhance.Brightness(im).enhance(0.35)
    im=Image.composite(dark,im,scrim)
    d=ImageDraw.Draw(im)
    # headline (brand orange accent word style: whole thing bold white, keyword orange)
    fs=96
    while fs>44:
        f=_font(fs); lines=wrap(d,headline.upper(),f,W-120)
        if len(lines)<=3: break
        fs-=6
    f=_font(fs); lh=int(fs*1.06); tot=lh*len(lines)
    y=H-160-tot
    for i,ln in enumerate(lines):
        col=OR if (i==len(lines)-1 and len(lines)>1) else WH
        lw=d.textlength(ln,font=f); x=(W-lw)//2
        # stroke
        for ox,oy in [(-3,0),(3,0),(0,-3),(0,3)]:
            d.text((x+ox,y+oy),ln,font=_font(fs),fill=BK)
        d.text((x,y),ln,font=f,fill=col); y+=lh
    # accent bar
    d.rectangle((W//2-70,y+14,W//2+70,y+22), fill=OR)
    # real logo top-center
    if logo_path and os.path.exists(logo_path):
        lg=Image.open(logo_path).convert("RGBA")
        lw=300; lh2=int(lg.height*lw/lg.width)
        lg=lg.resize((lw,lh2),Image.LANCZOS)
        im=im.convert("RGBA"); im.alpha_composite(lg,((W-lw)//2,70)); im=im.convert("RGB")
    return im

def main():
    prompt=sys.argv[1] if len(sys.argv)>1 else "cinematic video production studio, orange rim light, moody dark, shallow depth of field, professional camera gear, dramatic lighting"
    headline=sys.argv[2] if len(sys.argv)>2 else "V.CODE"
    out=sys.argv[3] if len(sys.argv)>3 else "cover_flux.jpg"
    logo=sys.argv[4] if len(sys.argv)>4 else "logo_hd.png"
    seed=random.randint(1,10**9)
    full=(prompt+", vertical 9:16, high detail, no text, no watermark, professional color grade, "
          "orange and black palette, cinematic")
    base=flux(full,seed)
    src="FLUX"
    if base is None:
        base=pexels_still("cinematic video production studio dark")
        src="PEXELS-fallback"
    if base is None:
        base=Image.new("RGB",(W,H),(18,14,12)); src="SOLID-fallback"
    im=compose(base,headline,logo)
    im.save(out,quality=92)
    print(f"[cover_flux] saved {out} via {src} ({im.size})")

if __name__=="__main__": main()
