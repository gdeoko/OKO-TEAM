import os,json,hashlib
W=os.path.dirname(os.path.abspath(__file__))
TOTAL=json.load(open(W+"/words.json"))["total"]
FB="file://"+os.environ.get("FACTORY_FONTS","/home/user/OKO-TEAM/oko-app/factory/fonts")
# A = list of overlays. Each: {t,e,type,x?,zone?,data}. Types (varied motion-graphics library):
#   chips ticks ring route bar stamp badge  (classic)
#   bigstat speedo odometer lowerthird vs linechart iconrow sidebars donut  (NEW, distinct looks/zones)
# STYLE seed (env OVL_STYLE 0..4) changes box look + default zone per reel so reels don't look alike.
A=json.loads(os.environ.get("OVL_A") or json.dumps([
 {"t":1.15,"e":4.0,"type":"bigstat","data":{"num":"×2","label":"РЕСУРС ДВИГАТЕЛЯ"}},
 {"t":4.2,"e":7.1,"type":"speedo","data":{"val":180,"unit":"КМ/Ч","label":"МАКС. СКОРОСТЬ"}},
 {"t":7.45,"e":10.2,"type":"iconrow","data":{"items":["4×4","V-TWIN","800cc"]}},
 {"t":10.4,"e":13.0,"type":"vs","data":{"a":"АРЕНДА","av":"СЕЗОН","b":"ПОКУПКА","bv":"ГОДЫ"}},
 {"t":13.4,"e":16.2,"type":"odometer","data":{"to":995,"suf":" 000 ₽","label":"ОТ"}},
 {"t":16.4,"e":19.0,"type":"linechart","data":{"label":"СПРОС РАСТЁТ","pts":[0.2,0.35,0.3,0.55,0.7,0.9]}},
 {"t":19.4,"e":22.2,"type":"route","x":"c","data":{"a":"ЗАВОД КНР","b":"ВАШ ГОРОД"}},
 {"t":22.4,"e":25.2,"type":"donut","data":{"val":100,"label":"ПОД КЛЮЧ"}},
 {"t":25.6,"e":28.4,"type":"lowerthird","data":{"label":"В ЦЕНЕ","val":"доставка · таможня · документы"}},
 {"t":28.6,"e":31.4,"type":"sidebars","data":{"items":[["МОЩНОСТЬ",0.9],["НАДЁЖНОСТЬ",0.95],["ЦЕНА",0.6]]}},
 {"t":31.6,"e":34.2,"type":"badge","x":"c","data":{"txt":"ПИШИ ГОРОД","arrow":True}},
 {"t":34.4,"e":37.0,"type":"stamp","x":"c","data":{"a":"DIESEL","b":"CARGO"}},
]))
# per-reel visual style — pick from env, else hash of the script so each reel differs
SEED=int(os.environ.get("OVL_STYLE") or (int(hashlib.md5(json.dumps(A,ensure_ascii=False).encode()).hexdigest(),16)%5))
HTML=r"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'soyuz';src:url('%FB%/SoyuzGrotesk-Bold.ttf')}
@font-face{font-family:'man8';src:url('%FB%/manrope-v20-cyrillic_latin-800.ttf')}
@font-face{font-family:'mont9';src:url('%FB%/montserrat-v31-cyrillic_latin-900.ttf')}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;background:transparent;overflow:hidden}
#stage{position:absolute;inset:0;font-family:'man8'}
.box{position:absolute}
.amb{color:#FF7A3C}.wht{color:#F6F4F1}.mono{font-family:'mont9'}
</style></head><body><div id="stage"></div>
<script>
const A=%A%, TOTAL=%TOTAL%, SEED=%SEED%;
const AMB="#EA5920", AMB2="#FF7A3C", INK="#0c0a08", WHT="#F6F4F1";
const stage=document.getElementById('stage');
const ease=x=>1-Math.pow(1-x,3), back=x=>{const c=1.70158;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
const clamp=x=>Math.max(0,Math.min(1,x));
// STYLE presets — box look + default top zone differ per reel
const STYLES=[
 {box:'linear-gradient(150deg,rgba(16,12,10,.82),rgba(26,17,12,.66))',bd:'2px solid rgba(234,89,32,.55)',rad:26,blur:'blur(5px)',topY:170,ease:ease},
 {box:'rgba(12,10,8,.9)',bd:'none',rad:8,blur:'none',topY:210,ease:back},
 {box:'transparent',bd:'2.5px solid rgba(234,89,32,.85)',rad:0,blur:'none',topY:150,ease:ease},
 {box:'linear-gradient(120deg,rgba(234,89,32,.92),rgba(180,60,18,.92))',bd:'none',rad:20,blur:'none',topY:230,ease:back},
 {box:'rgba(255,255,255,.06)',bd:'1.5px solid rgba(255,255,255,.35)',rad:34,blur:'blur(9px)',topY:190,ease:ease},
];
const ST=STYLES[SEED%STYLES.length];
function boxCSS(pad){return 'background:'+ST.box+';border:'+ST.bd+';border-radius:'+ST.rad+'px;'
  +(ST.blur!='none'?'backdrop-filter:'+ST.blur+';':'')+'box-shadow:0 18px 50px rgba(0,0,0,.45);padding:'+(pad||'24px 30px')+';';}
function zoneTop(x,w){const L=x=='l'?70:(x=='r'?1010-w:(1080-w)/2);return {left:L,top:ST.topY};}
function el(){const e=document.createElement('div');e.className='box';return e;}
function env(p){const i=ST.ease(clamp(p/0.16)),o=ease(clamp((p-0.86)/0.14));return {op:i*(1-o),ty:(1-i)*26 - o*12};}

function draw(a,p){
  const d=a.data, t=a.type, b=el(); let w=560,pos=null; const g=ease(clamp((p-0.1)/0.55));
  if(t=='chips'){ w=760; let h='<div style="display:flex;flex-wrap:wrap;justify-content:center;width:'+w+'px">';
    d.items.forEach((it,i)=>{const s=ease(clamp((p-(0.12+i*0.12))/0.2));
      h+='<span class="wht" style="display:inline-block;font-size:34px;'+boxCSS('14px 24px').replace(/padding[^;]*;/,'')+'padding:14px 24px;margin:6px;opacity:'+s+';transform:translateY('+((1-s)*20)+'px) scale('+(0.9+0.1*s)+')">'+it+'</span>';});
    b.innerHTML=h+'</div>';
  } else if(t=='ring'||t=='donut'){ w=300; const val=Math.round((d.val||100)*g);
    const R=82,C=2*Math.PI*R, seg=t=='donut'; const off=C*(1-(seg?1:0.78)*g);
    b.innerHTML='<div style="'+boxCSS('24px')+'width:300px;display:flex;flex-direction:column;align-items:center">'
     +'<svg width="200" height="200" viewBox="0 0 200 200"><circle cx="100" cy="100" r="'+R+'" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="'+(seg?26:16)+'"/>'
     +'<circle cx="100" cy="100" r="'+R+'" fill="none" stroke="'+AMB+'" stroke-width="'+(seg?26:16)+'" stroke-linecap="'+(seg?'butt':'round')+'" transform="rotate('+(seg?-90:135)+' 100 100)" stroke-dasharray="'+(seg?(C*0.24)+' '+(C*0.02):C)+'" stroke-dashoffset="'+off+'"/>'
     +'<text x="100" y="116" text-anchor="middle" class="mono" font-size="56" fill="'+WHT+'">'+val+(d.suf||(t=='ring'?'%':''))+'</text></svg>'
     +'<div class="amb" style="font-size:28px;letter-spacing:2px;margin-top:6px">'+d.label+'</div></div>';
  } else if(t=='ticks'){ w=560; let h='<div style="'+boxCSS()+'width:560px">';
    d.items.forEach((it,i)=>{const s=ease(clamp((p-(0.14+i*0.16))/0.2));
      h+='<div style="display:flex;align-items:center;gap:18px;padding:10px 0;opacity:'+(0.25+0.75*s)+';transform:translateX('+((1-s)*24)+'px)">'
       +'<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="'+AMB2+'" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" style="transform:scale('+(0.5+0.5*s)+')"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>'
       +'<span class="wht" style="font-size:38px">'+it+'</span></div>';});
    b.innerHTML=h+'</div>';
  } else if(t=='bar'){ w=560; b.innerHTML='<div style="'+boxCSS()+'width:560px">'
     +'<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="amb" style="font-size:30px">'+d.label+'</span>'
     +'<span class="wht mono" style="font-size:44px">'+d.val+'</span></div>'
     +'<div style="height:18px;background:rgba(255,255,255,.14);border-radius:9px;margin-top:16px;overflow:hidden">'
     +'<div style="height:100%;width:'+((d.fill||1)*100*g)+'%;background:linear-gradient(90deg,'+AMB+','+AMB2+')"></div></div></div>';
  } else if(t=='stamp'){ w=260; const r=back(clamp(p/0.34)); pos=zoneTop(a.x||'c',w);
    b.innerHTML='<div style="width:260px;height:260px;position:relative;transform:scale('+(0.4+0.6*r)+') rotate('+((1-r)*-28)+'deg);opacity:'+clamp(p/0.3)+'">'
     +'<div style="position:absolute;inset:0;border:5px solid '+AMB+';border-radius:50%;box-shadow:0 0 30px rgba(234,89,32,.5)"></div>'
     +'<div style="position:absolute;inset:22px;border:2px dashed rgba(255,122,60,.7);border-radius:50%"></div>'
     +'<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center" class="mono" line-height:1>'
     +'<span class="wht" style="font-size:52px">'+d.a+'</span><span class="amb" style="font-size:52px">'+d.b+'</span></div></div>';
  } else if(t=='route'){ w=620; const gg=clamp((p-0.12)/0.6); const dotx=60+(620-120)*ease(gg);
    b.innerHTML='<div style="'+boxCSS()+'width:620px;position:relative">'
     +'<div style="display:flex;justify-content:space-between;align-items:center"><span class="wht mono" style="font-size:40px">'+d.a+'</span><span class="wht mono" style="font-size:40px">'+d.b+'</span></div>'
     +'<div style="position:relative;height:40px;margin-top:8px"><div style="position:absolute;top:19px;left:10px;right:10px;height:3px;background:repeating-linear-gradient(90deg,rgba(255,122,60,.7) 0 14px,transparent 14px 26px)"></div>'
     +'<div style="position:absolute;top:6px;left:'+dotx+'px;width:28px;height:28px;border-radius:50%;background:'+AMB2+';box-shadow:0 0 18px '+AMB2+'"></div></div></div>';
  } else if(t=='badge'){ const txt=d.txt+(d.arrow?'  →':''); w=Math.min(760,120+txt.length*22);
    const pulse=1+(d.arrow?0.04*Math.sin(p*6.28*3):0);
    b.innerHTML='<div style="'+boxCSS('22px 34px')+'display:inline-flex;align-items:center;transform:scale('+pulse+')"><span class="wht" style="font-size:38px">'+txt.replace('→','<span class="amb">→</span>')+'</span></div>';
  }
  // ---- NEW distinct mechanics ----
  else if(t=='bigstat'){ // fullscreen huge number slam, center, no box
    const r=back(clamp(p/0.3)); w=900; pos={left:90,top:560};
    b.innerHTML='<div style="width:900px;text-align:center;opacity:'+clamp(p/0.2)+'">'
     +'<div class="mono amb" style="font-size:300px;line-height:.9;transform:scale('+(0.6+0.4*r)+');text-shadow:0 10px 60px rgba(0,0,0,.7)">'+d.num+'</div>'
     +'<div class="wht" style="font-size:52px;letter-spacing:3px;margin-top:10px;opacity:'+ease(clamp((p-0.25)/0.3))+'">'+d.label+'</div></div>';
  } else if(t=='speedo'){ // semicircle gauge w/ sweeping needle, center
    w=560; pos={left:260,top:520}; const val=Math.round((d.val||0)*g); const ang=-90+180*clamp(g);
    b.innerHTML='<div style="width:560px;display:flex;flex-direction:column;align-items:center;opacity:'+clamp(p/0.18)+'">'
     +'<svg width="560" height="320" viewBox="0 0 560 320"><path d="M60 300 A220 220 0 0 1 500 300" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="26" stroke-linecap="round"/>'
     +'<path d="M60 300 A220 220 0 0 1 500 300" fill="none" stroke="'+AMB+'" stroke-width="26" stroke-linecap="round" stroke-dasharray="691" stroke-dashoffset="'+(691*(1-clamp(g)))+'"/>'
     +'<g transform="rotate('+ang+' 280 300)"><line x1="280" y1="300" x2="280" y2="120" stroke="'+AMB2+'" stroke-width="9" stroke-linecap="round"/></g>'
     +'<circle cx="280" cy="300" r="16" fill="'+WHT+'"/></svg>'
     +'<div class="mono wht" style="font-size:96px;margin-top:-30px">'+val+'<span class="amb" style="font-size:44px"> '+(d.unit||'')+'</span></div>'
     +'<div class="amb" style="font-size:32px;letter-spacing:2px">'+d.label+'</div></div>';
  } else if(t=='odometer'){ // big rolling count-up number
    w=760; pos=zoneTop(a.x||'c',w); const val=Math.round((d.to||0)*g);
    b.innerHTML='<div style="'+boxCSS('26px 40px')+'width:760px;text-align:center">'
     +'<span class="amb" style="font-size:40px">'+(d.label||'')+' </span>'
     +'<span class="mono wht" style="font-size:120px;letter-spacing:2px">'+val+'</span>'
     +'<span class="wht" style="font-size:44px">'+(d.suf||'')+'</span></div>';
  } else if(t=='lowerthird'){ // bottom strip sliding in
    w=1080; const sx=(1-back(clamp(p/0.3)))*-1080; pos={left:0,top:1400};
    b.innerHTML='<div style="width:1080px;transform:translateX('+sx+'px)"><div style="'+boxCSS('26px 60px')+'border-radius:0;margin:0 40px;display:flex;align-items:baseline;gap:24px">'
     +'<span class="mono amb" style="font-size:52px">'+d.label+'</span><span class="wht" style="font-size:40px">'+d.val+'</span></div></div>';
  } else if(t=='vs'){ // split comparison two columns w/ VS
    w=820; pos=zoneTop('c',w); const l=ease(clamp((p-0.1)/0.3)),r=ease(clamp((p-0.25)/0.3));
    b.innerHTML='<div style="width:820px;display:flex;align-items:stretch;gap:0">'
     +'<div style="flex:1;'+boxCSS('30px')+'border-radius:'+ST.rad+'px 0 0 '+ST.rad+'px;text-align:center;opacity:'+l+';transform:translateX('+((1-l)*-40)+'px)"><div class="wht" style="font-size:40px">'+d.a+'</div><div class="mono amb" style="font-size:64px">'+d.av+'</div></div>'
     +'<div style="display:flex;align-items:center;justify-content:center;width:80px;background:'+AMB+';color:'+INK+'" class="mono"><span style="font-size:44px">VS</span></div>'
     +'<div style="flex:1;'+boxCSS('30px')+'border-radius:0 '+ST.rad+'px '+ST.rad+'px 0;text-align:center;opacity:'+r+';transform:translateX('+((1-r)*40)+'px)"><div class="wht" style="font-size:40px">'+d.b+'</div><div class="mono amb" style="font-size:64px">'+d.bv+'</div></div></div>';
  } else if(t=='linechart'){ // SVG line drawing on
    w=680; pos={left:200,top:1150}; const pts=d.pts||[0.2,0.5,0.8]; const n=pts.length;
    let path='M'; pts.forEach((v,i)=>{path+=(i?' L':'')+(40+i*(600/(n-1)))+' '+(220-v*180);});
    const len=1400, dash=len*(1-clamp(g));
    b.innerHTML='<div style="'+boxCSS('24px 30px')+'width:680px"><div class="amb" style="font-size:32px;margin-bottom:8px">'+d.label+'</div>'
     +'<svg width="640" height="240" viewBox="0 0 640 240"><path d="'+path+'" fill="none" stroke="'+AMB2+'" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="'+len+'" stroke-dashoffset="'+dash+'"/>'
     +'<circle cx="'+(40+(n-1)*(600/(n-1)))+'" cy="'+(220-pts[n-1]*180)+'" r="11" fill="'+AMB+'" opacity="'+clamp((g-0.85)/0.15)+'"/></svg></div>';
  } else if(t=='iconrow'){ // row of specs popping in pill-tiles (distinct from chips: tiles w/ big mono numbers)
    // full-width centered container so long labels (ШНОРКЕЛЬ и т.п.) не вылезают за экран
    pos={left:0,top:ST.topY}; const fs=d.items.length>=3?38:48;
    let h='<div style="width:1080px;display:flex;gap:18px;justify-content:center;flex-wrap:wrap">';
    d.items.forEach((it,i)=>{const s=back(clamp((p-(0.1+i*0.14))/0.3));
      h+='<div style="'+boxCSS('20px 22px')+'text-align:center;opacity:'+clamp(s)+';transform:scale('+(0.7+0.3*clamp(s))+')"><div class="mono amb" style="font-size:'+fs+'px;white-space:nowrap">'+it+'</div></div>';});
    b.innerHTML=h+'</div>';
  } else if(t=='sidebars'){ // vertical bar chart w/ animated columns
    w=560; pos=zoneTop('c',w); let h='<div style="'+boxCSS('30px')+'width:560px;display:flex;align-items:flex-end;gap:26px;height:300px">';
    d.items.forEach((it,i)=>{const s=ease(clamp((p-(0.1+i*0.12))/0.4));const hh=it[1]*200*s;
      h+='<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%"><div style="width:100%;height:'+hh+'px;background:linear-gradient(180deg,'+AMB2+','+AMB+');border-radius:8px 8px 0 0"></div><div class="wht" style="font-size:24px;margin-top:12px;text-align:center">'+it[0]+'</div></div>';});
    b.innerHTML=h+'</div>';
  }
  if(!pos) pos=zoneTop(a.x||'c',w);
  b.style.left=pos.left+'px'; b.style.top=pos.top+'px';
  const e=env(p); b.style.opacity=(b.style.opacity||e.op); if(!/translateX|scale/.test(b.innerHTML.slice(0,0))){}
  b.style.transform='translateY('+e.ty+'px)'; b.style.opacity=e.op;
  return b;
}
window.render=function(t){ const ts=t*TOTAL; stage.innerHTML='';
  A.forEach(a=>{ if(ts>=a.t-0.05 && ts<=a.e+0.3){ const p=(ts-a.t)/(a.e-a.t); stage.appendChild(draw(a,clamp(p))); }});
};
window.render(0);
</script></body></html>"""
html=(HTML.replace("%FB%",FB).replace("%A%",json.dumps(A,ensure_ascii=False))
          .replace("%TOTAL%",str(TOTAL)).replace("%SEED%",str(SEED)))
open(W+"/ig/html/accents.html","w").write(html)
print("accents.html built,",len(A),"overlays, STYLE seed",SEED)
