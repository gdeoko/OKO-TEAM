#!/usr/bin/env python3
# МЕТАНОЙА · БЕСПЛАТНАЯ обложка/картинка — Pollinations FLUX (без ключа, без квоты, безлимит).
# НЕ Higgsfield/nano_banana (платно). usage: python3 cover_free.py "<prompt>" out.jpg [W H seed]
import sys, os, urllib.parse, subprocess
def main():
    prompt=sys.argv[1]; outp=sys.argv[2]
    W=sys.argv[3] if len(sys.argv)>3 else "1080"
    H=sys.argv[4] if len(sys.argv)>4 else "1920"
    seed=sys.argv[5] if len(sys.argv)>5 else "42"
    cacert=os.environ.get("SSL_CERT_FILE","/root/.ccr/ca-bundle.crt")
    p=urllib.parse.quote(prompt)
    url=f"https://image.pollinations.ai/prompt/{p}?width={W}&height={H}&nologo=true&model=flux&seed={seed}"
    subprocess.run(["curl","-s","--cacert",cacert,"--max-time","180","-o",outp,url],check=True)
    # апскейл/кроп до точного размера через ffmpeg (Pollinations иногда отдаёт меньше)
    tmp=outp+".fix.jpg"
    subprocess.run(["ffmpeg","-v","error","-y","-i",outp,"-vf",
        f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}","-q:v","3",tmp],check=True)
    os.replace(tmp,outp)
    sz=subprocess.run(["ffprobe","-v","error","-show_entries","stream=width,height","-of","csv=p=0:s=x",outp],capture_output=True,text=True).stdout.strip()
    print("OK", outp, sz)
if __name__=="__main__": main()
