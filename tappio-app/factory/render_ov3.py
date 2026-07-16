#!/usr/bin/env python3
# v3 overlays: АНИМИРОВАННАЯ инфографика в прозрачный webm (alpha).
# Каждое наложение — своя сцена с движением: count-up числа, растущие бары,
# кольцо прогресса, стаггер-чипы, lower-third с wipe, кинетик-типографика.
# Playwright рендерит DOM покадрово (frame(p)), кадры -> vp9 yuva420p webm.
import json, sys, os, base64, asyncio, subprocess
from playwright.async_api import async_playwright
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
FD = os.path.abspath("assets/fonts")
FPS = 25

def fb(p): return base64.b64encode(open(p, "rb").read()).decode()
ORB = fb(f"{FD}/Orbitron-Bold.ttf"); SYN = fb(f"{FD}/Syne-Extra.ttf"); DM = fb(f"{FD}/DMMono-Medium.ttf")
def imgb(p): return "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()

CSS = f"""@font-face{{font-family:Orb;src:url(data:font/ttf;base64,{ORB})}}
@font-face{{font-family:Syn;src:url(data:font/ttf;base64,{SYN})}}
@font-face{{font-family:DM;src:url(data:font/ttf;base64,{DM})}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1080px;height:1920px;background:transparent;overflow:hidden;font-smooth:always;-webkit-font-smoothing:antialiased}}
#stage{{position:absolute;inset:0}}"""

# JS-движок наложений. init(spec) строит DOM, frame(p) двигает. p:0..1 по длине наложения.
JS = r"""
const A = SPEC.a, A2 = SPEC.a2 || SPEC.a;
const stage = document.getElementById('stage');
function eOut(t){return 1-Math.pow(1-Math.min(1,Math.max(0,t)),3);}
function eIO(t){t=Math.min(1,Math.max(0,t));return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
function env(p){ // общая огибающая появления/ухода
  const ain=eOut(p/0.16), aout=1-eOut((p-0.84)/0.16);
  return {vis:Math.max(0,Math.min(ain,aout<0?0:aout)), rise:(1-eOut(Math.min(1,p/0.16)))};
}
function reveal(p){return eOut((p-0.08)/0.60);} // прогресс инфографики
const T=SPEC.type, d=SPEC;
let build={};

function card(inner,style){return `<div style="background:rgba(5,7,10,.74);backdrop-filter:blur(10px);border:1px solid ${A}55;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.55),0 0 40px ${A}22;${style||''}">${inner}</div>`;}

function init(){
  let h='';
  const posY={top:230,upper:430,center:760,lower:1150}[d.pos|| 'upper'];
  if(T==='kicker'){
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:0;right:0;display:flex;justify-content:center">
      ${card(`<div style="font-family:DM;color:${A};font-size:30px;letter-spacing:7px;text-transform:uppercase;padding:24px 44px;border-left:6px solid ${A}">${d.text}</div>`)}</div>`;
  } else if(T==='stat_count'){
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:10px">
      <div id="num" style="font-family:Orb;font-weight:800;font-size:210px;line-height:.9;color:#fff;text-shadow:0 0 50px ${A}dd,0 10px 40px rgba(0,0,0,.6)">0</div>
      <div style="font-family:Syn;font-size:42px;letter-spacing:3px;color:${A};text-transform:uppercase;text-align:center;max-width:900px">${d.label||''}</div></div>`;
  } else if(T==='bars'){
    const rows=d.items.map((it,i)=>`<div style="display:flex;align-items:center;gap:20px;margin:14px 0">
        <div style="font-family:DM;font-size:34px;color:#fff;width:360px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it[0]}</div>
        <div style="flex:1;height:40px;background:rgba(255,255,255,.08);border-radius:20px;overflow:hidden">
          <div class="bar" data-v="${it[1]}" style="height:100%;width:0;background:linear-gradient(90deg,${A2},${A});border-radius:20px;box-shadow:0 0 24px ${A}88"></div></div>
        <div class="bval" data-v="${it[1]}" style="font-family:Orb;font-size:38px;color:${A};width:110px">0</div></div>`).join('');
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:60px;right:60px">
      ${card(`<div style="padding:34px 40px"><div style="font-family:Orb;font-weight:800;font-size:44px;color:#fff;letter-spacing:1px;margin-bottom:18px">${d.title||''}</div>${rows}</div>`)}</div>`;
  } else if(T==='ring'){
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:18px">
      <svg width="440" height="440" viewBox="0 0 440 440"><circle cx="220" cy="220" r="190" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="34"/>
      <circle id="arc" cx="220" cy="220" r="190" fill="none" stroke="${A}" stroke-width="34" stroke-linecap="round" transform="rotate(-90 220 220)" stroke-dasharray="1194" stroke-dashoffset="1194" style="filter:drop-shadow(0 0 16px ${A})"/>
      <text id="pct" x="220" y="248" text-anchor="middle" font-family="Orb" font-weight="800" font-size="150" fill="#fff">0%</text></svg>
      <div style="font-family:Syn;font-size:40px;letter-spacing:3px;color:${A};text-transform:uppercase;text-align:center;max-width:860px">${d.label||''}</div></div>`;
  } else if(T==='chips'){
    const cs=d.items.map((it,i)=>`<div class="chip" data-i="${i}" style="opacity:0;transform:scale(.6);font-family:DM;font-size:38px;letter-spacing:3px;color:#fff;background:rgba(5,7,10,.78);border:1.5px solid ${A};border-radius:999px;padding:22px 38px;box-shadow:0 0 30px ${A}55">${it}</div>`).join('');
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:0;right:0;display:flex;flex-wrap:wrap;gap:22px;justify-content:center;padding:0 90px">${cs}</div>`;
  } else if(T==='lowerthird'){
    h=`<div id="wrap" style="position:absolute;top:1120px;left:60px;right:60px;display:flex">
      ${card(`<div style="padding:0;display:flex;overflow:hidden"><div id="lbar" style="width:0;background:${A};box-shadow:0 0 30px ${A}"></div>
      <div style="padding:26px 40px"><div style="font-family:Orb;font-weight:800;font-size:52px;color:#fff">${d.title}</div>
      <div style="font-family:Syn;font-size:36px;color:${A};letter-spacing:2px;margin-top:6px">${d.sub||''}</div></div></div>`)}</div>`;
  } else if(T==='kinetic'){
    const big=(d.big||'').replace(/\n/g,'<br>');
    const words=(d.big||'').split(/\s|<br>|\n/).filter(Boolean);
    const maxw=Math.max(1,...words.map(w=>w.length));
    const kfs=Math.max(60,Math.min(120,Math.floor(980/(0.60*maxw))));  // авто-подбор под длинное слово
    h=`<div id="wrap" style="position:absolute;top:0;bottom:0;left:0;right:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
      <div style="font-family:DM;font-size:40px;letter-spacing:10px;color:${A};text-transform:uppercase;background:rgba(5,7,10,.5);padding:8px 22px;border-radius:8px">${d.top||''}</div>
      <div id="kbig" style="font-family:Syn;font-weight:800;font-size:${kfs}px;line-height:.94;color:#fff;text-align:center;text-transform:uppercase;letter-spacing:-1px;max-width:980px;word-break:keep-all;overflow-wrap:normal;text-shadow:0 0 46px ${A}bb,0 8px 40px rgba(0,0,0,.6)">${big}</div></div>`;
  } else if(T==='callout'){
    h=`<div id="wrap" style="position:absolute;top:${d.y||600}px;left:${d.x||600}px">
      <svg width="360" height="360" viewBox="0 0 360 360" style="overflow:visible"><circle id="ring2" cx="180" cy="180" r="150" fill="none" stroke="${A}" stroke-width="8" stroke-dasharray="942" stroke-dashoffset="942" style="filter:drop-shadow(0 0 12px ${A})"/></svg>
      <div style="position:absolute;top:400px;left:-40px;width:440px;font-family:DM;font-size:38px;color:${A};text-align:center;text-transform:uppercase;letter-spacing:2px">${d.text||''}</div></div>`;
  } else if(T==='ticker'){
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:0;right:0;display:flex;justify-content:center">
      ${card(`<div style="display:flex;align-items:center;gap:22px;padding:26px 44px">
        <div style="font-family:Orb;font-size:34px;color:${A}">▲</div>
        <div><div id="tnum" style="font-family:Orb;font-weight:800;font-size:96px;color:#fff;line-height:.9">0</div>
        <div style="font-family:Syn;font-size:34px;color:${A};letter-spacing:2px;text-transform:uppercase">${d.label||''}</div></div></div>`)}</div>`;
  } else if(T==='linechart'){
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:56px;right:56px">${card(`<div style="padding:34px 40px">
      <div style="font-family:Orb;font-weight:800;font-size:40px;color:#fff;margin-bottom:6px">${d.title||''}</div>
      <svg width="880" height="420" viewBox="0 0 880 420">
        <line x1="0" y1="120" x2="880" y2="120" stroke="${A}" stroke-width="2.5" stroke-dasharray="12 10" opacity=".55"/>
        <text x="878" y="106" text-anchor="end" font-family="DM" font-size="26" fill="${A}">${d.ceiling||'THE CEILING'}</text>
        <path id="lcline" d="" fill="none" stroke="${A}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 12px ${A})"/>
        <circle id="lcdot" r="13" fill="#fff" cx="0" cy="380" style="filter:drop-shadow(0 0 12px ${A})"/>
      </svg>
      <div style="display:flex;align-items:baseline;gap:14px;margin-top:4px">
        <div id="lcval" style="font-family:Orb;font-weight:800;font-size:76px;color:${A};line-height:.9">0${d.suffix||''}</div>
        <div style="font-family:Syn;font-size:34px;color:#fff;text-transform:uppercase;letter-spacing:2px">${d.label||''}</div></div>
    </div>`)}</div>`;
  } else if(T==='donut'){
    const segs=d.items||[["A",50],["B",30],["C",20]]; const tot=segs.reduce((s,x)=>s+x[1],0)||1;
    const cols=[A,A2,'#5a6472','#8892a0'];
    let off=0, arcs='';
    segs.forEach((s,i)=>{const frac=s[1]/tot; arcs+=`<circle class="dseg" data-len="${frac*1194}" data-off="${off*1194}" cx="220" cy="220" r="190" fill="none" stroke="${cols[i%cols.length]}" stroke-width="46" stroke-dasharray="0 1194" transform="rotate(${-90+off*360} 220 220)" style="filter:drop-shadow(0 0 8px ${cols[i%cols.length]}88)"/>`; off+=frac;});
    const leg=segs.map((s,i)=>`<div style="display:flex;align-items:center;gap:12px;margin:8px 0"><div style="width:26px;height:26px;border-radius:6px;background:${cols[i%cols.length]}"></div><div style="font-family:DM;font-size:32px;color:#fff">${s[0]}</div><div style="font-family:Orb;font-size:32px;color:${A};margin-left:auto">${Math.round(s[1]/tot*100)}%</div></div>`).join('');
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:20px">
      ${card(`<div style="display:flex;align-items:center;gap:36px;padding:34px 44px">
        <svg width="440" height="440" viewBox="0 0 440 440">${arcs}
          <text x="220" y="236" text-anchor="middle" font-family="Orb" font-weight="800" font-size="72" fill="#fff">${d.center||''}</text></svg>
        <div style="min-width:280px">${leg}</div></div>`)}</div>`;
  } else if(T==='gauge'){
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:14px">
      ${card(`<div style="padding:36px 50px;display:flex;flex-direction:column;align-items:center">
      <svg width="500" height="300" viewBox="0 0 500 290">
        <path d="M60,260 A190,190 0 0,1 440,260" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="34" stroke-linecap="round"/>
        <path id="gharc" d="M60,260 A190,190 0 0,1 440,260" fill="none" stroke="${A}" stroke-width="34" stroke-linecap="round" stroke-dasharray="597" stroke-dashoffset="597" style="filter:drop-shadow(0 0 12px ${A})"/>
        <line id="ghneedle" x1="250" y1="260" x2="250" y2="95" stroke="#fff" stroke-width="8" stroke-linecap="round" transform="rotate(-90 250 260)" style="filter:drop-shadow(0 0 8px ${A})"/>
        <circle cx="250" cy="260" r="18" fill="${A}"/>
        <text id="ghnum" x="250" y="220" text-anchor="middle" font-family="Orb" font-weight="800" font-size="86" fill="#fff">0</text></svg>
      <div style="font-family:Syn;font-size:38px;color:${A};letter-spacing:2px;text-transform:uppercase;text-align:center">${d.label||''}</div></div>`)}</div>`;
  } else if(T==='checklist'){
    const items=d.items||["Mirror","Outlet","Smoke detector"];
    const rows=items.map((it,i)=>`<div class="ckrow" data-i="${i}" style="display:flex;align-items:center;gap:22px;margin:16px 0;opacity:0">
      <div class="ckbox" style="width:56px;height:56px;border-radius:14px;border:3px solid ${A};display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 0 16px ${A}44">
        <svg width="36" height="36" viewBox="0 0 36 36"><path class="ckmark" d="M7,18 L15,26 L29,10" fill="none" stroke="${A}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="44" stroke-dashoffset="44"/></svg></div>
      <div style="font-family:Syn;font-weight:700;font-size:48px;color:#fff">${it}</div></div>`).join('');
    h=`<div id="wrap" style="position:absolute;top:${posY}px;left:60px;right:60px">${card(`<div style="padding:34px 44px">
      <div style="font-family:DM;font-size:28px;letter-spacing:6px;color:${A};text-transform:uppercase;margin-bottom:16px">${d.title||'CHECK THESE'}</div>${rows}</div>`)}</div>`;
  }
  stage.innerHTML=h;
}
init();

window.frame=function(p){
  const e=env(p), r=reveal(p), vis=e.vis;
  const wrap=document.getElementById('wrap');
  if(wrap){ wrap.style.opacity=vis; wrap.style.transform=`translateY(${e.rise*40}px)`; }
  if(T==='stat_count'){ const to=d.to||0; document.getElementById('num').textContent=(d.prefix||'')+Math.round(to*r)+(d.suffix||''); }
  else if(T==='bars'){ document.querySelectorAll('.bar').forEach(b=>{const v=+b.dataset.v; b.style.width=(v*r)+'%';});
    document.querySelectorAll('.bval').forEach(b=>{const v=+b.dataset.v; b.textContent=Math.round(v*r)+(d.unit||'%');}); }
  else if(T==='ring'){ const pct=d.pct||0; const off=1194*(1-pct/100*r); const a=document.getElementById('arc'); a.setAttribute('stroke-dashoffset',off);
    document.getElementById('pct').textContent=Math.round(pct*r)+'%'; }
  else if(T==='chips'){ document.querySelectorAll('.chip').forEach(c=>{const i=+c.dataset.i; const cp=eOut((r-i*0.13)/0.4); c.style.opacity=Math.max(0,Math.min(1,cp))*vis; c.style.transform=`scale(${0.6+0.4*Math.max(0,Math.min(1,cp))})`;}); }
  else if(T==='lowerthird'){ document.getElementById('lbar').style.width=(14*eOut(r/0.5))+'px'; }
  else if(T==='kinetic'){ const s=0.86+0.14*eOut(r/0.5); document.getElementById('kbig').style.transform=`scale(${s})`; }
  else if(T==='callout'){ document.getElementById('ring2').setAttribute('stroke-dashoffset',942*(1-eOut(r))); }
  else if(T==='ticker'){ document.getElementById('tnum').textContent=(d.prefix||'')+Math.round((d.to||0)*r)+(d.suffix||''); }
  else if(T==='linechart'){
    const line=document.getElementById('lcline');
    if(!line.getAttribute('d')){ const pts=[[0,380],[146,346],[293,300],[440,246],[586,168],[733,96],[880,54]]; line.setAttribute('d','M'+pts.map(p=>p.join(',')).join(' L')); }
    const L=line.getTotalLength(); line.style.strokeDasharray=L; line.style.strokeDashoffset=L*(1-r);
    const pt=line.getPointAtLength(L*Math.max(0.001,r)); const dot=document.getElementById('lcdot'); dot.setAttribute('cx',pt.x); dot.setAttribute('cy',pt.y);
    document.getElementById('lcval').textContent=Math.round((d.to||0)*r)+(d.suffix||''); }
  else if(T==='donut'){ document.querySelectorAll('.dseg').forEach(s=>{const len=+s.dataset.len; s.setAttribute('stroke-dasharray',(len*r)+' 1194');}); }
  else if(T==='gauge'){ const val=d.to||0, mx=d.max||100; const frac=Math.min(1,val/mx)*r;
    document.getElementById('gharc').setAttribute('stroke-dashoffset',597*(1-frac));
    document.getElementById('ghneedle').setAttribute('transform',`rotate(${-90+180*frac} 250 260)`);
    document.getElementById('ghnum').textContent=Math.round(val*r)+(d.suffix||''); }
  else if(T==='checklist'){ document.querySelectorAll('.ckrow').forEach(row=>{const i=+row.dataset.i;
    const a=Math.max(0,Math.min(1,(r-i*0.20)/0.28)); row.style.opacity=a*vis; row.style.transform=`translateX(${-24*(1-a)}px)`;
    const mk=row.querySelector('.ckmark'); const mp=Math.max(0,Math.min(1,(r-i*0.20-0.12)/0.18)); mk.setAttribute('stroke-dashoffset',44*(1-mp));
    row.querySelector('.ckbox').style.background=mp>0.5?A+'22':'transparent'; }); }
};
"""

async def render_overlay(pw_page, spec, dur, out_mov, tmp):
    os.makedirs(tmp, exist_ok=True)
    await pw_page.set_content(f"<style>{CSS}</style><div id='stage'></div>")
    # IIFE — свежий scope на каждое наложение, никаких коллизий const в глобале
    await pw_page.add_script_tag(content="(function(){const SPEC=" + json.dumps(spec) + ";\n" + JS + "\n})();")
    n = max(6, int(round(dur * FPS)))
    for k in range(n):
        p = k / (n - 1) if n > 1 else 1.0
        await pw_page.evaluate(f"window.frame({p})")
        await pw_page.screenshot(path=f"{tmp}/f{k:04d}.png", omit_background=True)
    # ProRes 4444 mov — надёжная альфа для композита в build3
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', str(FPS), '-i', f"{tmp}/f%04d.png",
                    '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
                    out_mov], check=True)
    subprocess.run(['rm', '-rf', tmp])

async def render_cover_endcard(page, d, wd, a, a2):
    logo = imgb(os.path.abspath(f'assets/logos/{d["brand"]["logo"]}'))
    c = d["cover"]; big_raw = c.get("big", "")
    _words = [w for w in big_raw.replace("\n", " ").split() if w]
    _maxw = max((len(w) for w in _words), default=1)
    cfs = max(64, min(118, int(980 / (0.60 * _maxw))))  # авто-подбор кегля обложки
    big = big_raw.replace("\n", "<br>")
    cover = f"""<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,7,10,.5),rgba(5,7,10,.18) 40%,rgba(5,7,10,.82))"></div>
    <div style="position:absolute;top:200px;left:60px;right:60px;display:flex;flex-direction:column;gap:18px">
     <div style="align-self:flex-start;font-family:DM;color:{a};font-size:30px;letter-spacing:8px;border:1.5px solid {a};border-radius:999px;padding:12px 28px;background:rgba(5,7,10,.5)">{c['kicker']}</div>
     <div style="font-family:DM;font-size:52px;letter-spacing:8px;color:{a2};text-transform:uppercase">{c.get('top','')}</div>
     <div style="font-family:Syn;font-weight:800;font-size:{cfs}px;line-height:.94;color:#fff;text-transform:uppercase;letter-spacing:-1px;max-width:980px;word-break:keep-all;overflow-wrap:normal;text-shadow:0 6px 40px rgba(0,0,0,.7),0 0 60px {a}55">{big}</div>
    </div>"""
    await page.set_content(f"<style>{CSS}</style><div id='stage'>{cover}</div>")
    await page.wait_for_timeout(180); await page.screenshot(path=f"{wd}/cover_ov.png", omit_background=True)
    end = f"""<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,{a}22,#050709 62%)"></div>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:38px">
      <img src="{logo}" style="width:300px;height:300px;border-radius:68px;box-shadow:0 0 80px {a}88,0 30px 60px rgba(0,0,0,.6)">
      <div style="font-family:Orb;font-weight:800;font-size:70px;color:#fff">{d['brand']['name']}</div>
      <div style="font-family:Syn;font-size:38px;color:{a};letter-spacing:2px;text-align:center;padding:0 80px">{d['cta']['text']}</div>
      <div style="margin-top:14px;font-family:DM;font-size:34px;color:#fff;background:rgba(255,255,255,.06);border:1.5px solid {a};border-radius:16px;padding:22px 40px;letter-spacing:3px">comment <span style="color:{a}">{d['cta']['code']}</span> for the link</div>
    </div>"""
    await page.set_content(f"<style>{CSS}</style><div id='stage'>{end}</div>")
    await page.wait_for_timeout(180); await page.screenshot(path=f"{wd}/endcard.png")

async def main():
    d = json.load(open(sys.argv[1])); wd = sys.argv[2]
    a = d["brand"]["accent"]; a2 = d["brand"].get("accent2", a)
    os.makedirs(f"{wd}/ovw", exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--force-color-profile=srgb"])
        page = await b.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        await render_cover_endcard(page, d, wd, a, a2)
        meta = []
        for i, ov in enumerate(d["overlays"]):
            spec = dict(ov); spec["a"] = a; spec["a2"] = a2
            dur = float(ov.get("dur", 1.6))
            out = f"{wd}/ovw/ov_{i:02d}.mov"
            await render_overlay(page, spec, dur, out, f"{wd}/ovw/_t{i:02d}")
            meta.append({"i": i, "at": ov["at"], "dur": dur, "file": out})
            print("overlay", i, ov["type"], f"{dur}s")
        await b.close()
    json.dump(meta, open(f"{wd}/ovw/meta.json", "w"))
    print("overlays done:", len(d["overlays"]))

asyncio.run(main())
