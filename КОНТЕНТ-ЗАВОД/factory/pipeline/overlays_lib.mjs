import fs from 'fs';
const WD="/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad/reel02";
const GOLD="#D4A574", NAVY="#1A3A52", CREAM="#FAF8F5", TERRA="#C97064", BLUE="#7AAED4";
const jobs=[];

// 1 — HOOK: «Как дела в школе?» с анимированным зачёркиванием + «спроси иначе»
jobs.push({id:"1_hook",kind:"strike",dur:4.0,
 css:`#wrap{position:absolute;top:300px;left:0;width:1080px;text-align:center}
 #q{font-family:'PF';font-size:78px;color:${CREAM};display:inline-block;padding:0 30px;text-shadow:0 6px 30px rgba(0,0,0,.6)}
 #ln{position:absolute;height:12px;background:${TERRA};border-radius:6px;top:52%;left:8%;box-shadow:0 0 20px ${TERRA}}
 #alt{font-family:'M9';font-size:44px;color:${GOLD};margin-top:34px;letter-spacing:1px}`,
 body:`<div id="wrap"><div id="q">«Как дела в&nbsp;школе?»</div><div id="ln"></div><div id="alt">спроси иначе →</div></div>`,
 render:`function(t){var w=document.getElementById('wrap'),q=document.getElementById('q'),ln=document.getElementById('ln'),alt=document.getElementById('alt');
  var app=eob(seg(t,0,0.5)); q.style.transform='translateY('+(1-app)*40+'px)'; q.style.opacity=seg(t,0,0.4);
  var s=eox(seg(t,0.9,1.7)); ln.style.width=(84*s)+'%';
  q.style.color=seg(t,1.4,1.9)>0.5?'#b9a89a':'${CREAM}';
  alt.style.opacity=seg(t,1.9,2.4); alt.style.transform='translateX('+(1-eoc(seg(t,1.9,2.4)))*30+'px)';
  var out=seg(t,3.5,4.0); w.style.opacity=1-out;}`});

// 2 — COUNTER: «3» с кольцом + «вопроса перед сном»
jobs.push({id:"2_count",kind:"counter",dur:3.0,
 css:`#c{position:absolute;top:640px;left:0;width:1080px;text-align:center}
 svg{position:absolute;top:0;left:50%;transform:translateX(-50%)}
 #n{font-family:'PF';font-size:280px;color:${GOLD};line-height:1;text-shadow:0 8px 40px rgba(0,0,0,.5)}
 #lab{font-family:'M9';font-size:52px;color:${CREAM};letter-spacing:3px;margin-top:10px}`,
 body:`<div id="c"><svg id="ring" width="360" height="360" viewBox="0 0 360 360"><circle cx="180" cy="180" r="160" fill="none" stroke="${GOLD}" stroke-width="8" stroke-linecap="round" stroke-dasharray="1005" stroke-dashoffset="1005" transform="rotate(-90 180 180)"/></svg><div id="n" style="position:relative;padding-top:40px">3</div><div id="lab">ВОПРОСА ПЕРЕД СНОМ</div></div>`,
 render:`function(t){var c=document.getElementById('c'),n=document.getElementById('n'),ring=document.querySelector('#ring circle'),lab=document.getElementById('lab');
  var p=eob(seg(t,0,0.55)); n.style.transform='scale('+(0.4+0.6*p)+')'; n.style.opacity=seg(t,0,0.4);
  ring.style.strokeDashoffset=1005*(1-eoc(seg(t,0.2,1.2)));
  lab.style.opacity=seg(t,0.9,1.4); lab.style.transform='translateY('+(1-eoc(seg(t,0.9,1.4)))*20+'px)';
  c.style.opacity=1-seg(t,2.6,3.0);}`});

// chip factory (вопросы) — плашка снизу
function chip(id,dur,num,txt){return {id,kind:"chip",dur,
 css:`#chip{position:absolute;bottom:430px;left:60px;width:960px;background:linear-gradient(120deg,rgba(26,58,82,.92),rgba(20,44,62,.92));
  border-radius:34px;padding:40px 44px;display:flex;align-items:center;gap:34px;box-shadow:0 16px 50px rgba(0,0,0,.45);border:2px solid rgba(212,165,116,.35)}
 #num{min-width:104px;height:104px;border-radius:26px;background:${GOLD};color:${NAVY};font-family:'PF';font-size:70px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(0,0,0,.35)}
 #tx{font-family:'M7';font-size:56px;color:${CREAM};line-height:1.12}`,
 body:`<div id="chip"><div id="num">${num}</div><div id="tx">${txt}</div></div>`,
 render:`function(t){var ch=document.getElementById('chip'),num=document.getElementById('num');
  var i=eob(seg(t,0,0.5)); ch.style.transform='translateX('+(1-i)*-120+'px)'; ch.style.opacity=seg(t,0,0.35);
  var pl=Math.sin(t*6)*0.5+0.5; num.style.boxShadow='0 6px 20px rgba(0,0,0,.35),0 0 '+(10+pl*22)+'px rgba(212,165,116,'+(0.3+pl*0.4)+')';
  ch.style.opacity=Math.min(seg(t,0,0.35),1-seg(t,${dur}-0.5,${dur}));}`};}
jobs.push(chip("3_q1",4.0,"1","Что сегодня тебя&nbsp;порадовало?"));
jobs.push(chip("4_q2",4.2,"2","Кому ты сегодня&nbsp;помог?"));
jobs.push(chip("5_q3",4.5,"3","За что скажем&nbsp;спасибо?"));

// 6 — BRAIN: анимированный контур мозга + пульсирующий узел «последнее» + подпись
jobs.push({id:"6_brain",kind:"brain",dur:4.5,
 css:`#b{position:absolute;top:560px;left:0;width:1080px;text-align:center}
 svg{filter:drop-shadow(0 8px 30px rgba(0,0,0,.5))}
 #cap{font-family:'M9';font-size:46px;color:${CREAM};margin-top:26px;letter-spacing:1px}
 #cap b{color:${GOLD}}`,
 body:`<div id="b"><svg width="520" height="440" viewBox="0 0 520 440">
  <path id="brain" d="M150 250 C90 250 70 190 110 160 C90 110 150 70 200 95 C230 60 320 60 350 100 C420 90 450 160 415 200 C445 240 410 300 350 290 C330 330 250 340 220 305 C160 330 120 300 150 250 Z" fill="none" stroke="${BLUE}" stroke-width="6" stroke-dasharray="1400" stroke-dashoffset="1400" stroke-linecap="round"/>
  <g id="nodes" opacity="0"><circle cx="180" cy="180" r="9" fill="${CREAM}"/><circle cx="250" cy="150" r="9" fill="${CREAM}"/><circle cx="320" cy="200" r="9" fill="${CREAM}"/><circle cx="260" cy="250" r="9" fill="${CREAM}"/></g>
  <circle id="last" cx="345" cy="255" r="16" fill="${GOLD}"/></svg>
  <div id="cap"><b>последняя мысль</b> закрепляется во сне</div></div>`,
 render:`function(t){var b=document.getElementById('b'),br=document.getElementById('brain'),nd=document.getElementById('nodes'),last=document.getElementById('last'),cap=document.getElementById('cap');
  br.style.strokeDashoffset=1400*(1-eoc(seg(t,0.1,1.6)));
  nd.style.opacity=seg(t,1.3,1.9);
  var pl=Math.sin(t*7)*0.5+0.5; last.setAttribute('r',12+pl*8); last.style.filter='drop-shadow(0 0 '+(8+pl*18)+'px ${GOLD})'; last.style.opacity=seg(t,1.8,2.2);
  cap.style.opacity=seg(t,2.1,2.6); cap.style.transform='translateY('+(1-eoc(seg(t,2.1,2.6)))*18+'px)';
  b.style.opacity=Math.min(1,1-seg(t,4.05,4.5));}`});

// 7 — FLOW: вопрос → близость → вера
jobs.push({id:"7_flow",kind:"flow",dur:3.2,
 css:`#f{position:absolute;top:840px;left:0;width:1080px;display:flex;justify-content:center;align-items:center;gap:0}
 .nd{font-family:'M7';font-size:40px;color:${NAVY};background:${CREAM};border-radius:40px;padding:24px 34px;opacity:0;box-shadow:0 10px 30px rgba(0,0,0,.35)}
 .nd.g{background:${GOLD}} .ar{width:70px;height:6px;background:${GOLD};margin:0 6px;opacity:0;border-radius:3px}`,
 body:`<div id="f"><div class="nd" id="n1">вопрос</div><div class="ar" id="a1"></div><div class="nd" id="n2">близость</div><div class="ar" id="a2"></div><div class="nd g" id="n3">вера</div></div>`,
 render:`function(t){function sh(el,a,b){el.style.opacity=seg(t,a,b);el.style.transform='translateY('+(1-eob(seg(t,a,b)))*24+'px)';}
  sh(document.getElementById('n1'),0,0.4); document.getElementById('a1').style.opacity=seg(t,0.5,0.8);
  sh(document.getElementById('n2'),0.7,1.1); document.getElementById('a2').style.opacity=seg(t,1.2,1.5);
  sh(document.getElementById('n3'),1.4,1.9);
  document.getElementById('f').style.opacity=Math.min(1,1-seg(t,2.8,3.2));}`});

// 8 — CTA: нижняя плашка + лого + бренд-строка
jobs.push({id:"8_cta",kind:"cta",dur:3.5,
 css:`#cta{position:absolute;bottom:250px;left:0;width:1080px;text-align:center}
 #save{display:inline-block;font-family:'M9';font-size:50px;color:${NAVY};background:${GOLD};padding:26px 54px;border-radius:44px;letter-spacing:1px;box-shadow:0 12px 40px rgba(0,0,0,.4)}
 #lg{width:120px;height:120px;margin:34px auto 8px;display:block}
 #brand{font-family:'M7';font-size:40px;color:${CREAM};letter-spacing:3px}`,
 body:`<div id="cta"><div id="save">Сохраните на&nbsp;вечер</div><img id="lg" class="LOGO"><div id="brand">МЕТАНОЙА · школа для детей</div></div>`,
 render:`function(t){var save=document.getElementById('save'),lg=document.getElementById('lg'),br=document.getElementById('brand');
  var p=eob(seg(t,0,0.5)); save.style.transform='scale('+(0.7+0.3*p)+')'; save.style.opacity=seg(t,0,0.4);
  var pl=Math.sin(t*5)*0.5+0.5; save.style.boxShadow='0 12px 40px rgba(0,0,0,.4),0 0 '+(pl*30)+'px rgba(212,165,116,.6)';
  lg.style.opacity=seg(t,0.5,1.0); lg.style.transform='translateY('+(1-eoc(seg(t,0.5,1.0)))*20+'px)';
  br.style.opacity=seg(t,0.8,1.3);
  document.getElementById('cta').style.opacity=Math.min(1,1-seg(t,3.15,3.5));}`});

fs.writeFileSync(`${WD}/jobs.json`, JSON.stringify(jobs));
console.log("jobs:", jobs.length, jobs.map(j=>j.id).join(", "));
