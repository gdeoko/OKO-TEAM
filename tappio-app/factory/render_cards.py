import json, sys, os, base64, asyncio
from playwright.async_api import async_playwright
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FD=os.path.abspath("assets/fonts")
def b64(p,mime): return f"data:{mime};base64,"+base64.b64encode(open(p,"rb").read()).decode()
ORB=b64(f"{FD}/Orbitron-Bold.ttf","font/ttf"); SYN=b64(f"{FD}/Syne-Extra.ttf","font/ttf"); DM=b64(f"{FD}/DMMono-Medium.ttf","font/ttf")
CSS=f"""@font-face{{font-family:Orb;src:url({ORB})}}@font-face{{font-family:Syn;src:url({SYN})}}@font-face{{font-family:DM;src:url({DM})}}
*{{margin:0;box-sizing:border-box}}html,body{{width:1080px;height:1920px;background:transparent;overflow:hidden}}"""
async def shot(html,out,bg=False):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=["--no-sandbox","--force-color-profile=srgb"])
        pg=await b.new_page(viewport={"width":1080,"height":1920},device_scale_factor=1)
        await pg.set_content(f"<style>{CSS}</style>{html}"); await pg.wait_for_timeout(250)
        await pg.screenshot(path=out,omit_background=not bg); await b.close()
async def main():
    d=json.load(open(sys.argv[1])); wd=sys.argv[2]; acc=d["brand"]["accent"]; acc2=d["brand"].get("accent2",acc)
    logo=b64(os.path.abspath(f'assets/logos/{d["brand"]["logo"]}'),"image/png")
    # COVER overlay (title over hook footage) — transparent, composited on cover.mp4
    c=d["cover"]; title=c["title"].replace("\n","<br>")
    cover=f"""<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,10,.55) 0%,rgba(5,7,10,.15) 40%,rgba(5,7,10,.75) 100%)"></div>
    <div style="position:absolute;top:150px;left:60px;right:60px;display:flex;flex-direction:column;gap:26px">
      <div style="align-self:flex-start;font-family:DM;color:{acc};font-size:30px;letter-spacing:8px;border:1.5px solid {acc};border-radius:999px;padding:12px 28px;background:rgba(5,7,10,.5)">{c['kicker']}</div>
      <div style="font-family:Orb;font-weight:800;font-size:118px;line-height:.98;color:#fff;text-shadow:0 6px 40px rgba(0,0,0,.7),0 0 60px {acc}44">{title}</div>
    </div>
    <div style="position:absolute;bottom:130px;left:0;right:0;text-align:center;font-family:Syn;color:{acc2};font-size:40px;letter-spacing:2px">a true story</div>"""
    await shot(cover,f"{wd}/cover_ov.png")
    # ENDCARD — full bg, logo + name + code word
    end=f"""<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,{acc}22 0%,#050709 60%)"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px">
      <img src="{logo}" style="width:300px;height:300px;border-radius:68px;box-shadow:0 0 80px {acc}88,0 30px 60px rgba(0,0,0,.6)">
      <div style="font-family:Orb;font-weight:800;font-size:70px;color:#fff;letter-spacing:1px">{d['brand']['name']}</div>
      <div style="font-family:Syn;font-size:40px;color:{acc};letter-spacing:2px">4 sensors. Any room. 60 seconds.</div>
      <div style="margin-top:20px;font-family:DM;font-size:34px;color:#fff;background:rgba(255,255,255,.06);border:1.5px solid {acc};border-radius:16px;padding:22px 40px;letter-spacing:3px">
        comment <span style="color:{acc}">{d['cta']['code']}</span> for the link</div>
    </div>"""
    await shot(end,f"{wd}/endcard.png",bg=True)
    print("cover_ov + endcard done")
asyncio.run(main())
