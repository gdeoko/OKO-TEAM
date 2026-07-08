import asyncio, os, base64, sys, subprocess, glob
from playwright.async_api import async_playwright
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FD=os.path.abspath("assets/fonts")
def b64(p): return "data:font/ttf;base64,"+base64.b64encode(open(p,"rb").read()).decode()
ORB,DM,SYN=b64(f"{FD}/Orbitron-Bold.ttf"),b64(f"{FD}/DMMono-Medium.ttf"),b64(f"{FD}/Syne-Extra.ttf")
async def rec(tpl,out,secs):
    html=open(tpl).read().replace("ORB",ORB).replace("DM",DM).replace("SYN",SYN)
    vdir=out+"_vid"; os.makedirs(vdir,exist_ok=True)
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=["--no-sandbox","--force-color-profile=srgb"])
        ctx=await b.new_context(viewport={"width":1080,"height":1920},device_scale_factor=1,
            record_video_dir=vdir,record_video_size={"width":1080,"height":1920})
        pg=await ctx.new_page(); await pg.set_content(html); 
        await pg.wait_for_timeout(int(secs*1000))
        await ctx.close(); await b.close()
    webm=glob.glob(f"{vdir}/*.webm")[0]
    subprocess.run(['ffmpeg','-y','-v','error','-i',webm,'-vf','scale=1080:1920,fps=30','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-an',out],check=True)
    subprocess.run(['rm','-rf',vdir])
    print("recorded",out,round(float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',out])),2),"s")
async def main():
    jobs=[("appdemo/spy_scan.html","appdemo/spy_scan.mp4",4.2),
          ("appdemo/brain_score.html","appdemo/brain_score.mp4",4.2),
          ("appdemo/tape_ar.html","appdemo/tape_ar.mp4",4.4)]
    for t,o,s in jobs: await rec(t,o,s)
asyncio.run(main())
