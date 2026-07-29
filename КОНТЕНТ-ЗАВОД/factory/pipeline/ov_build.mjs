// ov_build.mjs — ГЕНЕРАТОР наложений/инфографики по СМЫСЛУ сценария.
// Библиотека анимированных «механик» с ТЁМНОЙ ПОДЛОЖКОЙ (читаемо на любом кадре, как в профи-рилсах).
// Пишет <WD>/jobs.json (для ovgen.mjs) + <WD>/schedule.json (id->start для composite_ov.py).
// Запуск: OVWD=<WD> node ov_build.mjs <config.json>
import fs from 'fs';
const WD = process.env.OVWD || process.argv[3];
const CFG = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!WD) { console.error('need OVWD'); process.exit(1); }

const GOLD="#E6B877", NAVY="#12202E", CREAM="#FAF8F5", TERRA="#E08A6E", BLUE="#8FC0E6", SAGE="#9FC7A8";
const PAL={GOLD,NAVY,CREAM,TERRA,BLUE,SAGE};
const col=x=>PAL[x]||x;
const esc=s=>String(s).replace(/ /g,'&nbsp;');
// тёмная подложка-плашка (почти непрозрачная — текст читается на ЛЮБОМ кадре, профи-стиль)
const SCRIM='linear-gradient(135deg,rgba(9,15,23,.90),rgba(15,25,37,.86))';
const panel=(top,h,extra='')=>`position:absolute;left:70px;top:${top}px;width:940px;height:${h}px;`+
  `background:${SCRIM};border-radius:40px;box-shadow:0 22px 60px rgba(0,0,0,.55);border:1.5px solid rgba(230,184,119,.28);${extra}`;

// ── МЕХАНИКИ (каждая: {css, body, render}); #w — общий контейнер (его opacity = вход/выход всей сцены) ──
const KINDS = {
  strike(p){const acc=col(p.accent||'TERRA');return{
   css:`#w{opacity:0}
    #pnl{${panel(300,360)}}
    #big{position:absolute;top:360px;left:0;width:1080px;text-align:center;font-family:'PF';font-size:150px;color:${CREAM};text-shadow:0 6px 26px rgba(0,0,0,.6)}
    #ln{position:absolute;height:16px;background:${acc};border-radius:8px;top:445px;left:22%;width:0;box-shadow:0 0 26px ${acc}}
    #sub{position:absolute;top:560px;left:0;width:1080px;text-align:center;font-family:'M9';font-size:48px;color:${GOLD};letter-spacing:1px;opacity:0}`,
   body:`<div id="w"><div id="pnl"></div><div id="big">${esc(p.word)}</div><div id="ln"></div><div id="sub">${esc(p.sub||'')}</div></div>`,
   render:`function(t){var w=document.getElementById('w'),big=document.getElementById('big'),ln=document.getElementById('ln'),sub=document.getElementById('sub');
    w.style.opacity=Math.min(seg(t,0,0.4),1-seg(t,${p.dur}-0.5,${p.dur}));
    big.style.transform='scale('+(0.7+0.3*eob(seg(t,0,0.5)))+')';
    ln.style.width=(56*eox(seg(t,0.9,1.7)))+'%';
    big.style.color=seg(t,1.5,2.0)>0.5?'#c9bcae':'${CREAM}';
    sub.style.opacity=seg(t,2.0,2.5);sub.style.transform='translateY('+(1-eoc(seg(t,2.0,2.5)))*20+'px)';}`};},

  list(p){const acc=col(p.accent||'TERRA');const items=p.items||[];const H=180+items.length*118;
   const rows=items.map((it,i)=>`<div class="row" id="r${i}"><span class="dot"></span><span class="tx">${esc(it)}</span><span class="st" id="s${i}"></span></div>`).join('');
   return{
   css:`#w{opacity:0}
    #pnl{${panel(p.top||350,H)}}
    #L{position:absolute;top:${(p.top||350)+56}px;left:150px;width:820px}
    .row{position:relative;display:flex;align-items:center;gap:28px;margin:26px 0;opacity:0}
    .dot{min-width:28px;height:28px;border-radius:50%;background:${acc};box-shadow:0 0 18px ${acc}}
    .tx{font-family:'M7';font-size:66px;color:${CREAM}}
    .st{position:absolute;left:56px;height:10px;background:${acc};border-radius:5px;top:52%;width:0}`,
   body:`<div id="w"><div id="pnl"></div><div id="L">${rows}</div></div>`,
   render:`function(t){document.getElementById('w').style.opacity=Math.min(seg(t,0,0.4),1-seg(t,${p.dur}-0.5,${p.dur}));
     var n=${items.length};for(var i=0;i<n;i++){var st=0.35+i*0.85;var r=document.getElementById('r'+i);
       r.style.opacity=seg(t,st,st+0.4);r.style.transform='translateX('+(1-eob(seg(t,st,st+0.45)))*-60+'px)';
       ${p.strike?`document.getElementById('s'+i).style.width=(r.querySelector('.tx').offsetWidth*eox(seg(t,st+0.55,st+1.1)))+'px';`:''}}}`};},

  quote(p){return{
   css:`#w{opacity:0}
    #Q{position:absolute;top:340px;left:70px;width:940px;background:${SCRIM};border-radius:44px;padding:60px 56px;
       box-shadow:0 24px 66px rgba(0,0,0,.6);border:1.5px solid rgba(230,184,119,.3)}
    #Q:after{content:'';position:absolute;bottom:-26px;left:130px;border:22px solid transparent;border-top-color:rgba(18,30,44,.7);border-bottom:0}
    #qt{font-family:'PF';font-size:70px;color:${CREAM};line-height:1.24;text-shadow:0 3px 14px rgba(0,0,0,.5)}
    #at{font-family:'M7';font-size:42px;color:${GOLD};margin-top:28px}`,
   body:`<div id="w"><div id="Q"><div id="qt">${esc(p.text)}</div><div id="at">${esc(p.attrib||'')}</div></div></div>`,
   render:`function(t){var w=document.getElementById('w'),Q=document.getElementById('Q');
     w.style.opacity=Math.min(seg(t,0,0.4),1-seg(t,${p.dur}-0.5,${p.dur}));
     Q.style.transform='translateY('+(1-eob(seg(t,0,0.55)))*40+'px) scale('+(0.95+0.05*eob(seg(t,0,0.55)))+')';
     document.getElementById('at').style.opacity=seg(t,0.9,1.4);}`};},

  transform(p){return{
   css:`#w{opacity:0}
    #pnl{${panel(400,470)}}
    #f{position:absolute;top:445px;left:0;width:1080px;text-align:center;font-family:'PF';font-size:110px;color:${TERRA};display:inline-block}
    #fx{position:absolute;top:500px;left:34%;height:12px;width:0;background:${TERRA};border-radius:6px}
    #ar{position:absolute;top:585px;left:0;width:1080px;text-align:center;font-family:'M9';font-size:64px;color:${CREAM};opacity:0}
    #to{position:absolute;top:640px;left:0;width:1080px;text-align:center;font-family:'PF';font-size:150px;color:${GOLD};opacity:0}`,
   body:`<div id="w"><div id="pnl"></div><div id="f">${esc(p.from)}</div><div id="fx"></div><div id="ar">↓</div><div id="to">${esc(p.to)}</div></div>`,
   render:`function(t){var w=document.getElementById('w'),to=document.getElementById('to');
     w.style.opacity=Math.min(seg(t,0,0.4),1-seg(t,${p.dur}-0.5,${p.dur}));
     document.getElementById('fx').style.width=(32*eox(seg(t,0.6,1.2)))+'%';
     document.getElementById('ar').style.opacity=seg(t,1.2,1.6);
     to.style.opacity=seg(t,1.6,2.0);to.style.transform='scale('+(0.5+0.5*eob(seg(t,1.6,2.3)))+')';
     var pl=Math.sin(t*5)*0.5+0.5;to.style.textShadow='0 0 '+(18+pl*30)+'px rgba(230,184,119,.7)';}`};},

  chips(p){const items=p.items||[];const acc=col(p.positive?'SAGE':'BLUE');
   const rows=items.map((it,i)=>`<div class="ch" id="c${i}"><span class="tk">✓</span>${esc(it)}</div>`).join('');
   return{
   css:`#w{opacity:0}
    #C{position:absolute;top:${p.top||400}px;left:0;width:1080px;text-align:center}
    .ch{display:inline-flex;align-items:center;gap:24px;font-family:'M7';font-size:60px;color:${CREAM};
      background:${SCRIM};border:1.5px solid rgba(230,184,119,.3);border-radius:46px;padding:26px 50px;margin:18px auto;
      box-shadow:0 14px 38px rgba(0,0,0,.5);opacity:0}
    .tk{width:60px;height:60px;border-radius:50%;background:${acc};color:${NAVY};font-size:38px;font-weight:bold;display:flex;align-items:center;justify-content:center}`,
   body:`<div id="w"><div id="C">${rows.split('</div>').join('</div><br>')}</div></div>`,
   render:`function(t){document.getElementById('w').style.opacity=Math.min(seg(t,0,0.4),1-seg(t,${p.dur}-0.5,${p.dur}));
     var n=${items.length};for(var i=0;i<n;i++){var st=0.35+i*0.9;var c=document.getElementById('c'+i);
       c.style.opacity=seg(t,st,st+0.4);c.style.transform='translateX('+(1-eob(seg(t,st,st+0.45)))*70+'px)';}}`};},

  statement(p){return{
   css:`#w{opacity:0}
    #pnl{${panel(420,400)}}
    #ng{position:absolute;top:470px;left:0;width:1080px;text-align:center;font-family:'M7';font-size:72px;color:#c9bcae;display:inline-block}
    #ngx{position:absolute;top:522px;left:30%;height:10px;width:0;background:${TERRA};border-radius:5px}
    #ps{position:absolute;top:600px;left:0;width:1080px;text-align:center;font-family:'PF';font-size:110px;color:${GOLD};opacity:0;text-shadow:0 6px 26px rgba(0,0,0,.5)}`,
   body:`<div id="w"><div id="pnl"></div><div id="ng">${esc(p.neg)}</div><div id="ngx"></div><div id="ps">${esc(p.pos)}</div></div>`,
   render:`function(t){var w=document.getElementById('w'),ps=document.getElementById('ps');
     w.style.opacity=Math.min(seg(t,0,0.4),1-seg(t,${p.dur}-0.5,${p.dur}));
     document.getElementById('ngx').style.width=(40*eox(seg(t,0.7,1.4)))+'%';
     ps.style.opacity=seg(t,1.4,1.9);ps.style.transform='translateY('+(1-eob(seg(t,1.4,2.1)))*30+'px)';}`};},

  ctaword(p){return{
   css:`#w{opacity:0}
    #pnl{${panel(300,380)}}
    #lab{position:absolute;top:346px;left:0;width:1080px;text-align:center;font-family:'M9';font-size:52px;color:${CREAM};letter-spacing:2px}
    #wd{position:absolute;top:440px;left:0;width:1080px;text-align:center}
    #wd b{display:inline-block;font-family:'PF';font-size:120px;color:${NAVY};background:${GOLD};padding:18px 64px;border-radius:38px;letter-spacing:4px;box-shadow:0 14px 44px rgba(0,0,0,.5)}`,
   body:`<div id="w"><div id="pnl"></div><div id="lab">напиши слово</div><div id="wd"><b>${esc(p.word)}</b></div></div>`,
   render:`function(t){var w=document.getElementById('w'),wd=document.querySelector('#wd b');
     w.style.opacity=Math.min(seg(t,0,0.4),1-seg(t,${p.dur}-0.5,${p.dur}));
     document.getElementById('lab').style.opacity=seg(t,0.2,0.7);
     wd.style.transform='scale('+(0.7+0.3*eob(seg(t,0.4,1.1)))+')';wd.style.opacity=seg(t,0.4,0.9);
     var pl=Math.sin(t*4)*0.5+0.5;wd.style.boxShadow='0 14px 44px rgba(0,0,0,.5),0 0 '+(pl*40)+'px rgba(230,184,119,.7)';}`};},

  // kinetic одиночная фраза (лёгкая, быстрая) — компактный скрим
  word(p){const c=col(p.color||'CREAM');const top=p.top||440;const h=p.h||190;return{
   css:`#w{opacity:0}
    #pn{position:absolute;left:120px;top:${top}px;width:840px;height:${h}px;background:${SCRIM};border-radius:36px;box-shadow:0 18px 50px rgba(0,0,0,.5);border:1.5px solid rgba(230,184,119,.26)}
    #tx{position:absolute;left:0;top:${top}px;width:1080px;height:${h}px;display:flex;align-items:center;justify-content:center;text-align:center;font-family:'PF';font-size:${p.size||78}px;color:${c};padding:0 90px;text-shadow:0 4px 18px rgba(0,0,0,.5)}`,
   body:`<div id="w"><div id="pn"></div><div id="tx">${esc(p.text)}</div></div>`,
   render:`function(t){var w=document.getElementById('w');
     w.style.opacity=Math.min(seg(t,0,0.35),1-seg(t,${p.dur}-0.4,${p.dur}));
     document.getElementById('tx').style.transform='translateY('+(1-eob(seg(t,0,0.5)))*30+'px) scale('+(0.9+0.1*eob(seg(t,0,0.5)))+')';}`};},

  // фраза 1-2 строки + анимированное подчёркивание
  phrase(p){const top=p.top||430;const h=p.h||240;return{
   css:`#w{opacity:0}
    #pn{position:absolute;left:110px;top:${top}px;width:860px;height:${h}px;background:${SCRIM};border-radius:38px;box-shadow:0 18px 52px rgba(0,0,0,.5);border:1.5px solid rgba(230,184,119,.26)}
    #tx{position:absolute;left:0;top:${top+38}px;width:1080px;text-align:center;font-family:'M7';font-size:${p.size||62}px;color:${CREAM};padding:0 100px;line-height:1.2;text-shadow:0 3px 14px rgba(0,0,0,.5)}
    #ul{position:absolute;top:${top+h-64}px;left:50%;transform:translateX(-50%);height:10px;width:0;background:${col(p.accent||'GOLD')};border-radius:5px;box-shadow:0 0 18px ${col(p.accent||'GOLD')}}`,
   body:`<div id="w"><div id="pn"></div><div id="tx">${esc(p.text)}</div><div id="ul"></div></div>`,
   render:`function(t){var w=document.getElementById('w');
     w.style.opacity=Math.min(seg(t,0,0.35),1-seg(t,${p.dur}-0.4,${p.dur}));
     document.getElementById('tx').style.transform='translateY('+(1-eob(seg(t,0,0.5)))*26+'px)';
     document.getElementById('ul').style.width=(440*eox(seg(t,0.5,1.2)))+'px';}`};},

  counter(p){return{
   css:`#w{opacity:0}
    #pnl{${panel(540,500)}}
    svg{position:absolute;top:600px;left:50%;transform:translateX(-50%)}
    #num{position:absolute;top:640px;left:0;width:1080px;text-align:center;font-family:'PF';font-size:280px;color:${GOLD};line-height:1;text-shadow:0 6px 30px rgba(0,0,0,.5)}
    #lab{position:absolute;top:940px;left:0;width:1080px;text-align:center;font-family:'M9';font-size:52px;color:${CREAM};letter-spacing:3px;opacity:0}`,
   body:`<div id="w"><div id="pnl"></div><svg width="380" height="380" viewBox="0 0 380 380"><circle id="rg" cx="190" cy="190" r="168" fill="none" stroke="${GOLD}" stroke-width="9" stroke-linecap="round" stroke-dasharray="1055" stroke-dashoffset="1055" transform="rotate(-90 190 190)"/></svg><div id="num">${esc(p.n)}</div><div id="lab">${esc(p.label||'')}</div></div>`,
   render:`function(t){var w=document.getElementById('w'),num=document.getElementById('num');
     w.style.opacity=Math.min(seg(t,0,0.4),1-seg(t,${p.dur}-0.5,${p.dur}));
     num.style.transform='scale('+(0.4+0.6*eob(seg(t,0,0.55)))+')';
     document.getElementById('rg').style.strokeDashoffset=1055*(1-eoc(seg(t,0.2,1.3)));
     document.getElementById('lab').style.opacity=seg(t,1.0,1.5);}`};},
};

const jobs=[], schedule=[];
CFG.forEach((s,i)=>{
  const b=KINDS[s.kind]; if(!b){console.error('unknown kind',s.kind);return;}
  const built=b({...s});
  const id=`${i}_${s.kind}`;
  jobs.push({id,kind:s.kind,dur:s.dur,css:built.css,body:built.body,render:built.render});
  schedule.push({id,start:s.start,dur:s.dur});
});
fs.writeFileSync(`${WD}/jobs.json`, JSON.stringify(jobs));
fs.writeFileSync(`${WD}/schedule.json`, JSON.stringify(schedule));
console.log('ov_build:', jobs.length, 'сцен ->', schedule.map(s=>s.id+'@'+s.start).join(', '));
