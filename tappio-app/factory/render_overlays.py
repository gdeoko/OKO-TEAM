import json, sys, os, base64, asyncio
from playwright.async_api import async_playwright
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FONT_DIR=os.path.abspath("assets/fonts")
def font_b64(p): return base64.b64encode(open(p,"rb").read()).decode()
ORB=font_b64(f"{FONT_DIR}/Orbitron-Bold.ttf"); SYN=font_b64(f"{FONT_DIR}/Syne-Extra.ttf"); DM=font_b64(f"{FONT_DIR}/DMMono-Medium.ttf")

CSS=f"""
@font-face{{font-family:Orb;src:url(data:font/ttf;base64,{ORB})}}
@font-face{{font-family:Syn;src:url(data:font/ttf;base64,{SYN})}}
@font-face{{font-family:DM;src:url(data:font/ttf;base64,{DM})}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1080px;height:1920px;background:transparent;overflow:hidden}}
.stage{{position:absolute;inset:0}}
"""

def kicker(text,accent):
    return f"""<div class="stage" style="display:flex;align-items:flex-start;justify-content:center;padding-top:250px">
      <div style="background:rgba(5,7,10,.72);backdrop-filter:blur(8px);border:1px solid {accent}55;border-left:6px solid {accent};
                  padding:26px 40px;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5)">
        <div style="font-family:DM;color:{accent};font-size:26px;letter-spacing:6px;text-transform:uppercase">{text}</div>
      </div></div>"""

def stat(big,sub,accent):
    return f"""<div class="stage" style="display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div style="font-family:Orb;font-weight:800;font-size:220px;line-height:.9;color:#fff;
                  text-shadow:0 0 40px {accent}cc,0 8px 40px rgba(0,0,0,.6)">{big}</div>
      <div style="font-family:Syn;font-size:44px;letter-spacing:3px;color:{accent};margin-top:10px;text-transform:uppercase">{sub}</div>
    </div>"""

def chips(items,accent):
    cells="".join(f"""<div style="font-family:DM;font-size:38px;letter-spacing:3px;color:#fff;
        background:rgba(5,7,10,.7);border:1.5px solid {accent};border-radius:999px;padding:20px 34px;
        box-shadow:0 0 30px {accent}44">{it}</div>""" for it in items)
    return f"""<div class="stage" style="display:flex;flex-wrap:wrap;gap:22px;align-content:center;justify-content:center;padding:0 90px">{cells}</div>"""

async def render(html, out):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=["--no-sandbox","--force-color-profile=srgb"])
        pg=await b.new_page(viewport={"width":1080,"height":1920},device_scale_factor=1)
        await pg.set_content(f"<style>{CSS}</style>{html}")
        await pg.wait_for_timeout(250)
        await pg.screenshot(path=out,omit_background=True)
        await b.close()

async def main():
    d=json.load(open(sys.argv[1])); wd=sys.argv[2]
    acc=d["brand"]["accent"]; os.makedirs(f"{wd}/ov",exist_ok=True)
    for s in d["segments"]:
        ov=s.get("overlay");
        if not ov: continue
        if ov["type"]=="kicker": h=kicker(ov["text"],acc)
        elif ov["type"]=="stat": h=stat(ov["big"],ov["sub"],acc)
        elif ov["type"]=="chips": h=chips(ov["items"],acc)
        else: continue
        await render(h,f"{wd}/ov/{s['id']}.png")
        print("overlay",s["id"],ov["type"])
asyncio.run(main())
