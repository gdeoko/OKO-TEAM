import json,sys,os,base64,asyncio
from playwright.async_api import async_playwright
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"; FD=os.path.abspath("assets/fonts")
def fb(p): return base64.b64encode(open(p,"rb").read()).decode()
ORB=fb(f"{FD}/Orbitron-Bold.ttf"); SYN=fb(f"{FD}/Syne-Extra.ttf"); DM=fb(f"{FD}/DMMono-Medium.ttf")
def imgb(p): return "data:image/png;base64,"+base64.b64encode(open(p,"rb").read()).decode()
CSS=f"""@font-face{{font-family:Orb;src:url(data:font/ttf;base64,{ORB})}}@font-face{{font-family:Syn;src:url(data:font/ttf;base64,{SYN})}}@font-face{{font-family:DM;src:url(data:font/ttf;base64,{DM})}}
*{{margin:0;padding:0;box-sizing:border-box}}html,body{{width:1080px;height:1920px;background:transparent;overflow:hidden}}.stage{{position:absolute;inset:0}}"""
def kicker(t,a): return f"""<div class="stage" style="display:flex;align-items:flex-start;justify-content:center;padding-top:260px"><div style="background:rgba(5,7,10,.72);backdrop-filter:blur(8px);border:1px solid {a}55;border-left:6px solid {a};padding:26px 42px;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5)"><div style="font-family:DM;color:{a};font-size:27px;letter-spacing:6px;text-transform:uppercase">{t}</div></div></div>"""
def stat(big,sub,a):
    fs=200
    if len(big)>4: fs=int(200*4.2/len(big))
    fs=max(96,min(200,fs))
    return f"""<div class="stage" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 60px"><div style="font-family:Orb;font-weight:800;font-size:{fs}px;line-height:.92;color:#fff;text-align:center;max-width:960px;text-shadow:0 0 40px {a}cc,0 8px 40px rgba(0,0,0,.6)">{big}</div><div style="font-family:Syn;font-size:44px;letter-spacing:3px;color:{a};margin-top:18px;text-transform:uppercase;text-align:center">{sub}</div></div>"""
def chips(items,a):
    cells="".join(f"""<div style="font-family:DM;font-size:38px;letter-spacing:3px;color:#fff;background:rgba(5,7,10,.72);border:1.5px solid {a};border-radius:999px;padding:20px 34px;box-shadow:0 0 30px {a}44">{it}</div>""" for it in items)
    return f"""<div class="stage" style="display:flex;flex-wrap:wrap;gap:22px;align-content:center;justify-content:center;padding:0 90px">{cells}</div>"""
def kinetic(top,big,a,a2):
    big=big.replace("\n","<br>")
    return f"""<div class="stage" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
      <div style="font-family:DM;font-size:40px;letter-spacing:10px;color:{a};text-transform:uppercase;background:rgba(5,7,10,.5);padding:8px 20px;border-radius:8px">{top}</div>
      <div style="font-family:Syn;font-weight:800;font-size:112px;line-height:.94;color:#fff;text-align:center;text-transform:uppercase;text-shadow:0 0 44px {a}aa,0 8px 40px rgba(0,0,0,.6);letter-spacing:-1px;max-width:940px;overflow-wrap:break-word">{big}</div>
    </div>"""
async def shot(html,out,bg=False):
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=CHROME,args=["--no-sandbox","--force-color-profile=srgb"])
        pg=await b.new_page(viewport={"width":1080,"height":1920},device_scale_factor=1)
        await pg.set_content(f"<style>{CSS}</style>{html}"); await pg.wait_for_timeout(220)
        await pg.screenshot(path=out,omit_background=not bg); await b.close()
async def main():
    d=json.load(open(sys.argv[1])); wd=sys.argv[2]; a=d["brand"]["accent"]; a2=d["brand"].get("accent2",a)
    os.makedirs(f"{wd}/ov",exist_ok=True)
    for s in d["segments"]:
        ov=s.get("overlay");
        if not ov: continue
        ty=ov["type"]
        if ty=="kicker": h=kicker(ov["text"],a)
        elif ty=="stat": h=stat(ov["big"],ov["sub"],a)
        elif ty=="chips": h=chips(ov["items"],a)
        elif ty=="kinetic": h=kinetic(ov["top"],ov["big"],a,a2)
        else: continue
        await shot(h,f"{wd}/ov/{s['id']}.png"); print("ov",s["id"],ty)
    # cover overlay
    c=d["cover"]; logo=imgb(os.path.abspath(f'assets/logos/{d["brand"]["logo"]}'))
    if c.get("style")=="kinetic":
        big=c["big"].replace("\n","<br>")
        cover=f"""<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,10,.5),rgba(5,7,10,.2) 40%,rgba(5,7,10,.8))"></div>
        <div style="position:absolute;top:200px;left:60px;right:60px;display:flex;flex-direction:column;gap:18px">
         <div style="align-self:flex-start;font-family:DM;color:{a};font-size:30px;letter-spacing:8px;border:1.5px solid {a};border-radius:999px;padding:12px 28px;background:rgba(5,7,10,.5)">{c['kicker']}</div>
         <div style="font-family:DM;font-size:52px;letter-spacing:8px;color:{a2};text-transform:uppercase">{c['top']}</div>
         <div style="font-family:Syn;font-weight:800;font-size:118px;line-height:.94;color:#fff;text-transform:uppercase;letter-spacing:-1px;max-width:960px;overflow-wrap:break-word;text-shadow:0 6px 40px rgba(0,0,0,.7),0 0 60px {a}55">{big}</div>
        </div>"""
    else:
        top=c.get("top",""); big=c.get("big",c.get("title","")).replace("\n","<br>")
        cover=f"""<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,10,.5),rgba(5,7,10,.15) 40%,rgba(5,7,10,.8))"></div>
        <div style="position:absolute;top:190px;left:60px;right:60px;display:flex;flex-direction:column;gap:20px">
         <div style="align-self:flex-start;font-family:DM;color:{a};font-size:30px;letter-spacing:8px;border:1.5px solid {a};border-radius:999px;padding:12px 28px;background:rgba(5,7,10,.5)">{c['kicker']}</div>
         <div style="font-family:Orb;font-weight:700;font-size:60px;letter-spacing:2px;color:{a2}">{top}</div>
         <div style="font-family:Orb;font-weight:800;font-size:118px;line-height:.96;color:#fff;text-shadow:0 6px 40px rgba(0,0,0,.7),0 0 60px {a}44">{big}</div>
        </div>"""
    await shot(cover,f"{wd}/cover_ov.png")
    # endcard
    end=f"""<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,{a}22,#050709 62%)"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:38px">
      <img src="{logo}" style="width:300px;height:300px;border-radius:68px;box-shadow:0 0 80px {a}88,0 30px 60px rgba(0,0,0,.6)">
      <div style="font-family:Orb;font-weight:800;font-size:70px;color:#fff">{d['brand']['name']}</div>
      <div style="font-family:Syn;font-size:38px;color:{a};letter-spacing:2px;text-align:center;padding:0 80px">{d['cta']['text']}</div>
      <div style="margin-top:14px;font-family:DM;font-size:34px;color:#fff;background:rgba(255,255,255,.06);border:1.5px solid {a};border-radius:16px;padding:22px 40px;letter-spacing:3px">comment <span style="color:{a}">{d['cta']['code']}</span> for the link</div>
    </div>"""
    await shot(end,f"{wd}/endcard.png",bg=True); print("cover+endcard done")
asyncio.run(main())
