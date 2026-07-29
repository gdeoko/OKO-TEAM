// ov_build.mjs — ГЕНЕРАТОР наложений/инфографики по СМЫСЛУ сценария.
// Библиотека анимированных «механик»; на ролик — маленький конфиг данными (kind/start/dur/params).
// Пишет <WD>/jobs.json (для ovgen.mjs) + <WD>/schedule.json (id->start для composite_ov.py).
// Запуск: OVWD=<WD> node ov_build.mjs <config.json>
import fs from 'fs';
const WD = process.env.OVWD || process.argv[3];
const CFG = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!WD) { console.error('need OVWD'); process.exit(1); }

const GOLD="#D4A574", NAVY="#1A3A52", CREAM="#FAF8F5", TERRA="#C97064", BLUE="#7AAED4", SAGE="#8FB39B";
const PAL={GOLD,NAVY,CREAM,TERRA,BLUE,SAGE};
const col=x=>PAL[x]||x;
const esc=s=>String(s).replace(/ /g,'&nbsp;');

// ── МЕХАНИКИ (каждая: {css, body, render}) ─────────────────────────────
const KINDS = {
  // крупное слово с анимированным зачёркиванием + подпись
  strike(p){const acc=col(p.accent||'TERRA');return{
   css:`#w{position:absolute;top:300px;left:0;width:1080px;text-align:center}
    #big{font-family:'PF';font-size:150px;color:${CREAM};display:inline-block;padding:0 30px;text-shadow:0 8px 34px rgba(0,0,0,.6)}
    #ln{position:absolute;height:16px;background:${acc};border-radius:8px;top:46%;left:16%;box-shadow:0 0 26px ${acc}}
    #sub{font-family:'M9';font-size:46px;color:${GOLD};margin-top:30px;letter-spacing:1px}`,
   body:`<div id="w"><div id="big">${esc(p.word)}</div><div id="ln"></div><div id="sub">${esc(p.sub||'')}</div></div>`,
   render:`function(t){var w=document.getElementById('w'),big=document.getElementById('big'),ln=document.getElementById('ln'),sub=document.getElementById('sub');
    var a=eob(seg(t,0,0.5)); big.style.transform='scale('+(0.6+0.4*a)+')'; big.style.opacity=seg(t,0,0.4);
    var s=eox(seg(t,0.9,1.7)); ln.style.width=(70*s)+'%';
    big.style.color=seg(t,1.5,2.0)>0.5?'#b9a89a':'${CREAM}';
    sub.style.opacity=seg(t,2.0,2.5); sub.style.transform='translateY('+(1-eoc(seg(t,2.0,2.5)))*22+'px)';
    w.style.opacity=Math.min(seg(t,0,0.3),1-seg(t,${p.dur}-0.45,${p.dur}));}`};},

  // список строк: появляются по очереди, опц. зачёркивание
  list(p){const acc=col(p.accent||'TERRA');const items=p.items||[];
   const rows=items.map((it,i)=>`<div class="row" id="r${i}"><span class="dot"></span><span class="tx">${esc(it)}</span><span class="st" id="s${i}"></span></div>`).join('');
   return{
   css:`#L{position:absolute;top:${p.top||380}px;left:90px;width:900px}
    .row{position:relative;display:flex;align-items:center;gap:26px;margin:18px 0;opacity:0}
    .dot{min-width:26px;height:26px;border-radius:50%;background:${acc};box-shadow:0 0 16px ${acc}}
    .tx{font-family:'M7';font-size:64px;color:${CREAM};text-shadow:0 4px 18px rgba(0,0,0,.5)}
    .st{position:absolute;left:52px;height:9px;background:${acc};border-radius:5px;top:52%;width:0}`,
   body:`<div id="L">${rows}</div>`,
   render:`function(t){var n=${items.length};for(var i=0;i<n;i++){var st=0.25+i*0.9;var r=document.getElementById('r'+i);
     r.style.opacity=seg(t,st,st+0.4);r.style.transform='translateX('+(1-eob(seg(t,st,st+0.45)))*-70+'px)';
     ${p.strike?`var s=document.getElementById('s'+i);var tw=r.querySelector('.tx').offsetWidth;s.style.width=(tw*eox(seg(t,st+0.5,st+1.05)))+'px';`:''}}
     document.getElementById('L').style.opacity=Math.min(1,1-seg(t,${p.dur}-0.5,${p.dur}));}`};},

  // цитата в «пузыре»
  quote(p){return{
   css:`#Q{position:absolute;top:330px;left:70px;width:940px;background:linear-gradient(135deg,rgba(250,248,245,.97),rgba(238,232,222,.97));
     border-radius:40px;padding:56px 52px;box-shadow:0 22px 60px rgba(0,0,0,.5);opacity:0}
    #Q:after{content:'';position:absolute;bottom:-28px;left:120px;border:22px solid transparent;border-top-color:rgba(240,234,224,.97);border-bottom:0}
    #qt{font-family:'PF';font-size:66px;color:${NAVY};line-height:1.22}
    #at{font-family:'M7';font-size:40px;color:${TERRA};margin-top:26px}`,
   body:`<div id="Q"><div id="qt">${esc(p.text)}</div><div id="at">${esc(p.attrib||'')}</div></div>`,
   render:`function(t){var q=document.getElementById('Q');var a=eob(seg(t,0,0.55));
     q.style.opacity=seg(t,0,0.4);q.style.transform='translateY('+(1-a)*40+'px) scale('+(0.94+0.06*a)+')';
     document.getElementById('at').style.opacity=seg(t,0.9,1.4);
     q.style.opacity=Math.min(seg(t,0,0.4),1-seg(t,${p.dur}-0.5,${p.dur}));}`};},

  // трансформация слова: from (красное, зачёркнуто) → to (золотое)
  transform(p){return{
   css:`#T{position:absolute;top:420px;left:0;width:1080px;text-align:center}
    #f{font-family:'PF';font-size:118px;color:${TERRA};position:relative;display:inline-block}
    #f .x{position:absolute;left:0;top:50%;height:12px;width:0;background:${TERRA};border-radius:6px}
    #ar{font-family:'M9';font-size:70px;color:${CREAM};margin:14px 0}
    #to{font-family:'PF';font-size:150px;color:${GOLD};text-shadow:0 0 40px rgba(212,165,116,.6);opacity:0}`,
   body:`<div id="T"><div id="f">${esc(p.from)}<span class="x"></span></div><div id="ar">↓</div><div id="to">${esc(p.to)}</div></div>`,
   render:`function(t){var f=document.getElementById('f'),x=f.querySelector('.x'),ar=document.getElementById('ar'),to=document.getElementById('to'),T=document.getElementById('T');
     f.style.opacity=seg(t,0,0.4);x.style.width=(f.offsetWidth*eox(seg(t,0.6,1.2)))+'px';
     ar.style.opacity=seg(t,1.2,1.6);
     var a=eob(seg(t,1.6,2.3));to.style.opacity=seg(t,1.6,2.0);to.style.transform='scale('+(0.5+0.5*a)+')';
     var pl=Math.sin(t*5)*0.5+0.5;to.style.textShadow='0 0 '+(20+pl*34)+'px rgba(212,165,116,.7)';
     T.style.opacity=Math.min(seg(t,0,0.3),1-seg(t,${p.dur}-0.5,${p.dur}));}`};},

  // чипы (позитивные, с галочкой) — по очереди
  chips(p){const items=p.items||[];const acc=col(p.positive?'SAGE':'BLUE');
   const rows=items.map((it,i)=>`<div class="ch" id="c${i}"><span class="tk">✓</span>${esc(it)}</div>`).join('');
   return{
   css:`#C{position:absolute;top:${p.top||400}px;left:0;width:1080px;text-align:center}
    .ch{display:inline-flex;align-items:center;gap:22px;font-family:'M7';font-size:58px;color:${NAVY};
      background:${CREAM};border-radius:44px;padding:24px 46px;margin:16px auto;box-shadow:0 12px 34px rgba(0,0,0,.4);opacity:0}
    .tk{width:56px;height:56px;border-radius:50%;background:${acc};color:${CREAM};font-size:36px;display:flex;align-items:center;justify-content:center}`,
   body:`<div id="C">${rows.split('</div>').join('</div><br>')}</div>`,
   render:`function(t){var n=${items.length};for(var i=0;i<n;i++){var st=0.3+i*0.95;var c=document.getElementById('c'+i);
     var a=eob(seg(t,st,st+0.45));c.style.opacity=seg(t,st,st+0.35);c.style.transform='translateX('+(1-a)*70+'px)';}
     document.getElementById('C').style.opacity=Math.min(1,1-seg(t,${p.dur}-0.5,${p.dur}));}`};},

  // контраст-утверждение: neg (зачёркнуто) → pos (золотое)
  statement(p){return{
   css:`#S{position:absolute;top:430px;left:0;width:1080px;text-align:center}
    #ng{font-family:'M7';font-size:70px;color:#b9a89a;position:relative;display:inline-block}
    #ng .x{position:absolute;left:0;top:52%;height:9px;width:0;background:${TERRA};border-radius:5px}
    #ps{font-family:'PF';font-size:104px;color:${GOLD};margin-top:26px;opacity:0;text-shadow:0 8px 34px rgba(0,0,0,.5)}`,
   body:`<div id="S"><div id="ng">${esc(p.neg)}<span class="x"></span></div><div id="ps">${esc(p.pos)}</div></div>`,
   render:`function(t){var ng=document.getElementById('ng'),x=ng.querySelector('.x'),ps=document.getElementById('ps'),S=document.getElementById('S');
     ng.style.opacity=seg(t,0,0.4);x.style.width=(ng.offsetWidth*eox(seg(t,0.7,1.4)))+'px';
     var a=eob(seg(t,1.4,2.1));ps.style.opacity=seg(t,1.4,1.9);ps.style.transform='translateY('+(1-a)*30+'px)';
     S.style.opacity=Math.min(seg(t,0,0.3),1-seg(t,${p.dur}-0.5,${p.dur}));}`};},

  // CTA: «Напиши: СЛОВО» пульсирующая плашка
  ctaword(p){return{
   css:`#W{position:absolute;top:300px;left:0;width:1080px;text-align:center}
    #lab{font-family:'M9';font-size:52px;color:${CREAM};letter-spacing:2px;margin-bottom:26px}
    #wd{display:inline-block;font-family:'PF';font-size:120px;color:${NAVY};background:${GOLD};
      padding:20px 66px;border-radius:40px;letter-spacing:4px;box-shadow:0 14px 46px rgba(0,0,0,.45)}`,
   body:`<div id="W"><div id="lab">напиши слово</div><div id="wd">${esc(p.word)}</div></div>`,
   render:`function(t){var lab=document.getElementById('lab'),wd=document.getElementById('wd'),W=document.getElementById('W');
     lab.style.opacity=seg(t,0,0.5);
     var a=eob(seg(t,0.3,1.0));wd.style.opacity=seg(t,0.3,0.8);wd.style.transform='scale('+(0.7+0.3*a)+')';
     var pl=Math.sin(t*4)*0.5+0.5;wd.style.boxShadow='0 14px 46px rgba(0,0,0,.45),0 0 '+(pl*40)+'px rgba(212,165,116,.7)';
     W.style.opacity=Math.min(seg(t,0,0.3),1-seg(t,${p.dur}-0.5,${p.dur}));}`};},

  // счётчик: большое число + кольцо + подпись
  counter(p){return{
   css:`#N{position:absolute;top:560px;left:0;width:1080px;text-align:center}
    svg{position:absolute;top:0;left:50%;transform:translateX(-50%)}
    #num{font-family:'PF';font-size:300px;color:${GOLD};line-height:1;position:relative;padding-top:30px;text-shadow:0 8px 40px rgba(0,0,0,.5)}
    #lab{font-family:'M9';font-size:52px;color:${CREAM};letter-spacing:3px;margin-top:8px}`,
   body:`<div id="N"><svg width="380" height="380" viewBox="0 0 380 380"><circle id="rg" cx="190" cy="190" r="168" fill="none" stroke="${GOLD}" stroke-width="9" stroke-linecap="round" stroke-dasharray="1055" stroke-dashoffset="1055" transform="rotate(-90 190 190)"/></svg><div id="num">${esc(p.n)}</div><div id="lab">${esc(p.label||'')}</div></div>`,
   render:`function(t){var num=document.getElementById('num'),rg=document.getElementById('rg'),lab=document.getElementById('lab'),N=document.getElementById('N');
     var a=eob(seg(t,0,0.55));num.style.transform='scale('+(0.4+0.6*a)+')';num.style.opacity=seg(t,0,0.4);
     rg.style.strokeDashoffset=1055*(1-eoc(seg(t,0.2,1.3)));
     lab.style.opacity=seg(t,1.0,1.5);
     N.style.opacity=Math.min(seg(t,0,0.3),1-seg(t,${p.dur}-0.5,${p.dur}));}`};},
};

const jobs=[], schedule=[];
CFG.forEach((s,i)=>{
  const b=KINDS[s.kind]; if(!b){console.error('unknown kind',s.kind);return;}
  const p={...s,dur:s.dur};
  const built=b(p);
  const id=`${i}_${s.kind}`;
  jobs.push({id,kind:s.kind,dur:s.dur,css:built.css,body:built.body,render:built.render});
  schedule.push({id,start:s.start,dur:s.dur});
});
fs.writeFileSync(`${WD}/jobs.json`, JSON.stringify(jobs));
fs.writeFileSync(`${WD}/schedule.json`, JSON.stringify(schedule));
console.log('ov_build:', jobs.length, 'сцен ->', schedule.map(s=>s.id+'@'+s.start).join(', '));
