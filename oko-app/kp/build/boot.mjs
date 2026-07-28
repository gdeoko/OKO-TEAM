import { chromium } from 'playwright-core';
const M={'phone-se':[375,667,true],'phone-a51':[412,915,true],'phone-max':[430,932,true],'laptop':[1366,768,false],'desk':[1920,1080,false]};
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=document-user-activation-required']});
for(const dev of Object.keys(M)){const [w,h,touch]=M[dev];
 const ctx=await br.newContext({viewport:{width:w,height:h},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
 const pg=await ctx.newPage(); const errs=[];
 pg.on('pageerror',e=>errs.push(String(e).slice(0,120)));
 await pg.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded'});
 await pg.waitForTimeout(4200);
 const b=await pg.evaluate(()=>({booting:document.body.classList.contains('booting'),
   plDone:document.getElementById('preloader').classList.contains('done'),
   btn:!!document.getElementById('plEnter'),
   heroOp:getComputedStyle(document.querySelector('.hero-title')).opacity,
   audio:window.__audio?window.__audio.state():null,
   sy:Math.round(scrollY)}));
 // эмулируем первый жест
 await pg.mouse.click(w/2,h*0.75).catch(()=>{});
 await pg.waitForTimeout(2600);
 const a2=await pg.evaluate(()=>window.__audio?window.__audio.state():null);
 // геометрия героя
 const hero=await pg.evaluate(()=>{const ew=document.querySelector('.eye-wrap').getBoundingClientRect();
   const bd=document.querySelector('.hero-badge').getBoundingClientRect();
   const nav=document.getElementById('nav').getBoundingClientRect();
   const hint=document.querySelector('.scroll-hint').getBoundingClientRect();
   return {navB:Math.round(nav.bottom),eyeT:Math.round(ew.top),eyeH:Math.round(ew.height),badgeT:Math.round(bd.top),hintB:Math.round(hint.bottom),vh:innerHeight,
     gapTop:Math.round(ew.top-nav.bottom)};});
 // секции
 const secs=await pg.evaluate(async()=>{const o={};
  for(const [k,sel,fig,card,head] of [['ag','#adtPin','#holoWoman','.acap','.adt-head'],['gu','.guar-pin','#guarRobot','.gcard','.guar-head']]){
   const e=document.querySelector(sel);scrollTo(0,e.getBoundingClientRect().top+scrollY+innerHeight*0.5);await new Promise(x=>setTimeout(x,1000));
   const f=document.querySelector(fig).getBoundingClientRect();
   const hd=document.querySelector(head).getBoundingClientRect();
   const cs=[...document.querySelectorAll(card)].map(c=>c.getBoundingClientRect());
   const cta=[...document.querySelectorAll('.adt-cta .btn')].map(c=>c.getBoundingClientRect()).filter(r=>r.top>0&&r.top<innerHeight);
   o[k]={vh:innerHeight,headT:Math.round(hd.top),headB:Math.round(hd.bottom),figT:Math.round(f.top),figB:Math.round(f.bottom),
     cT:Math.round(Math.min(...cs.map(b=>b.top))),cB:Math.round(Math.max(...cs.map(b=>b.bottom))),
     ctaB:cta.length?Math.round(Math.max(...cta.map(r=>r.bottom))):null,
     figOp:document.querySelector(fig).style.opacity||getComputedStyle(document.querySelector(fig)).opacity};
  } return o;});
 console.log(dev,'BOOT',JSON.stringify(b),'AFTERGESTURE',JSON.stringify(a2));
 console.log(dev,'HERO',JSON.stringify(hero));
 console.log(dev,'SECS',JSON.stringify(secs), errs.length?('ERR '+errs.slice(0,2)):'');
 await ctx.close();}
console.log('DONE'); await br.close();
