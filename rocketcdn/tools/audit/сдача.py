#!/usr/bin/env python3
"""Сквозной приёмочный обмер сайта. Числа, а не впечатление.

  python3 tools/audit/сдача.py [ширина] [высота] [dpr]
"""
import json, sys
from playwright.sync_api import sync_playwright

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
БАЗА = "http://127.0.0.1:8123/index.html"
РАЗДЕЛЫ = ["hero","what","products","how","kpi","included","infra","cases",
           "reliability","adv","year","effect","route","prog","faq","contact","epilogue"]

W = int(sys.argv[1]) if len(sys.argv)>1 else 1440
H = int(sys.argv[2]) if len(sys.argv)>2 else 900
DPR = float(sys.argv[3]) if len(sys.argv)>3 else 2

КАДРЫ = """(мс)=>new Promise(res=>{const t=[];let п=performance.now();const t0=п;
 function тик(ts){t.push(ts-п);п=ts;
  if(ts-t0<мс)requestAnimationFrame(тик);
  else{const s=t.slice(1).sort((a,b)=>a-b);
   res({кадров:s.length,медиана:+s[s.length>>1].toFixed(1),
        худшие5:+s[Math.floor(s.length*0.95)].toFixed(1)});}}
 requestAnimationFrame(тик);})"""

РАЗДЕЛ = """(и)=>{const e=document.getElementById(и);const r=e.getBoundingClientRect();
 const к=Array.from(e.querySelectorAll('.card,.cin-item,.rc-tile,li'))
   .map(x=>x.getBoundingClientRect()).filter(x=>x.width>40&&x.height>24);
 function разброс(зн){const гр={};зн.forEach(v=>{const k=Math.round(v/40);(гр[k]=гр[k]||[]).push(v)});
   let м=0;Object.values(гр).forEach(g=>{if(g.length<2)return;м=Math.max(м,Math.max(...g)-Math.min(...g))});return м;}
 const мел=Array.from(e.querySelectorAll('a,button,[role=button],input,select'))
   .map(x=>({т:x.tagName,r:x.getBoundingClientRect()}))
   .filter(x=>x.r.width>0&&x.r.height>0&&(x.r.width<44||x.r.height<44))
   .map(x=>x.т+' '+Math.round(x.r.width)+'x'+Math.round(x.r.height));
 const выс=к.map(x=>Math.round(x.height));
 return {высота:Math.round(r.height),карточек:к.length,
   лев:разброс(к.map(x=>Math.round(x.left))),прав:разброс(к.map(x=>Math.round(x.right))),
   высоты:(выс.length>1?Math.max(...выс)-Math.min(...выс):0),
   мелких:мел.length,примеры:мел.slice(0,4),
   вбок:Math.max(0,Math.round(document.documentElement.scrollWidth-innerWidth))};}"""

with sync_playwright() as p:
    br = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox","--use-gl=swiftshader"])
    ctx = br.new_context(viewport={"width":W,"height":H}, device_scale_factor=DPR)
    ctx.add_init_script("""Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});
                           Object.defineProperty(navigator,'deviceMemory',{get:()=>8});""")
    pg = ctx.new_page()
    ошибки=[]; зап={"n":0,"байт":0}
    pg.on("console", lambda m: ошибки.append(m.type+": "+m.text[:150]) if m.type in ("error","warning") else None)
    pg.on("pageerror", lambda e: ошибки.append("исключение: "+str(e)[:150]))
    def отклик(r):
        зап["n"]+=1
        try: зап["байт"]+=int(r.headers.get("content-length") or 0)
        except Exception: pass
    pg.on("response", отклик)

    pg.goto(БАЗА, wait_until="domcontentloaded", timeout=90000)
    pg.wait_for_timeout(6000)
    сцены={"главная":pg.evaluate(КАДРЫ,1500)}

    разделы=[]
    for ид in РАЗДЕЛЫ:
        if not pg.evaluate("и=>!!document.getElementById(и)",ид):
            разделы.append({"ид":ид,"нет":True}); continue
        pg.evaluate("""и=>{const e=document.getElementById(и);
            scrollTo(0,e.getBoundingClientRect().top+scrollY-innerHeight*0.15);}""",ид)
        pg.wait_for_timeout(650)
        д=pg.evaluate(РАЗДЕЛ,ид); д["ид"]=ид; разделы.append(д)

    всего=pg.evaluate("()=>document.body.scrollHeight"); y=0; всалоне=False
    while y<всего:
        y+=600; pg.evaluate("v=>scrollTo(0,v)",y); pg.wait_for_timeout(120)
        кл=pg.evaluate("()=>document.documentElement.className")
        if not всалоне and "rc-stage" in кл:
            всалоне=True; pg.wait_for_timeout(900)
            сцены["салон"]=pg.evaluate(КАДРЫ,1500)
        if "rc-flying" in кл: break
    pg.wait_for_timeout(2000)
    сцены["полёт"]=pg.evaluate(КАДРЫ,2000)
    сцены["холст"]=pg.evaluate("""()=>{const c=document.querySelector('.rcf-cv');
        return c?[c.width,c.height,innerWidth,innerHeight]:null}""")

    вбок=max([r.get("вбок",0) for r in разделы if not r.get("нет")]+[0])
    print(json.dumps({"окно":"%dx%d@%g"%(W,H,DPR),"вбок":вбок,
        "ошибок":len(ошибки),"ошибки":ошибки[:8],
        "запросов":зап["n"],"мегабайт":round(зап["байт"]/1048576,2),
        "сцены":сцены,"разделы":разделы}, ensure_ascii=False))
    br.close()
