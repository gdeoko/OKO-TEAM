from playwright.sync_api import sync_playwright
import sys
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
W,Hv=int(sys.argv[1]),int(sys.argv[2]); держать = len(sys.argv)>3
with sync_playwright() as p:
    br=p.chromium.launch(executable_path=CHROME,args=["--no-sandbox","--use-gl=swiftshader"])
    ctx=br.new_context(viewport={"width":W,"height":Hv},device_scale_factor=2)
    ctx.add_init_script("Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});")
    pg=ctx.new_page()
    pg.goto("http://127.0.0.1:8123/index.html",wait_until="domcontentloaded",timeout=90000)
    pg.wait_for_timeout(8000)
    if держать:
        pg.evaluate("()=>{setInterval(()=>{document.documentElement.setAttribute('data-degrade','0');},100);}")
    H=pg.evaluate("()=>document.body.scrollHeight"); y=0; точка=None
    while y<H:
        y+=300; pg.evaluate("v=>scrollTo(0,v)",y); pg.wait_for_timeout(100)
        d=pg.evaluate("""()=>{const b=document.querySelector('.dsk-b-fly');if(!b)return null;
          const r=b.getBoundingClientRect();if(!(r.width>10&&r.top>0&&r.top<innerHeight))return null;
          const cx=r.left+r.width/2,cy=r.top+r.height/2;const e=document.elementFromPoint(cx,cy);
          return (e&&(e===b||b.contains(e)))?[Math.round(cx),Math.round(cy)]:null;}""")
        if d: точка=d; break
    ст=pg.evaluate("()=>document.documentElement.getAttribute('data-degrade')")
    if not точка:
        print("%dx%d degrade=%s: кнопка полёта НЕ предлагается"%(W,Hv,ст)); br.close(); raise SystemExit
    pg.mouse.click(точка[0],точка[1]); pg.wait_for_timeout(9000)
    летим=pg.evaluate("()=>document.documentElement.classList.contains('rc-flying')")
    print("%dx%d degrade=%s: кнопка есть, клик -> летим %s"%(W,Hv,ст,летим))
    if летим:
        pg.evaluate("()=>{const b=document.querySelector('.rcf-brief');if(b)b.style.display='none';}")
        pg.wait_for_timeout(800); pg.screenshot(path="/tmp/финал-%d.png"%W)
    br.close()
