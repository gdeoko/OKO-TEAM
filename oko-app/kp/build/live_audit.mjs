import { chromium } from 'playwright-core';
const PAGES=['https://okoteam.top/kp/','https://okoteam.top/kp-dmitry/','https://okoteam.top/kp-speto/'];
const DEV=[['phone-se',375,667,true],['phone-a51',412,915,true],['phone-max',430,932,true],['tab-p',820,1180,true],['tab-l',1180,820,true],['laptop',1366,768,false],['desk',1920,1080,false],['wide',2560,1200,false]];
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
for(const URL of PAGES){
 for(const [dev,w,h,touch] of DEV){
  const ctx=await br.newContext({viewport:{width:w,height:h},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
  const pg=await ctx.newPage(); const errs=[];
  pg.on('pageerror',e=>errs.push(String(e).slice(0,120)));
  pg.on('response',r=>{if(r.status()>=400)errs.push('H'+r.status()+':'+r.url().split('/').slice(-2).join('/'));});
  try{ await pg.goto(URL,{waitUntil:'domcontentloaded',timeout:45000}); }catch(e){console.log(URL,dev,'GOTO-FAIL');await ctx.close();continue;}
  await pg.waitForTimeout(3200);
  try{await pg.click('#plEnter',{timeout:8000});}catch(e){errs.push('NO-ENTER');}
  await pg.waitForTimeout(2200);
  const r=await pg.evaluate(async()=>{
    const out={ovf:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    // hand
    const hh=document.getElementById('handHero');
    if(hh){const base=hh.getBoundingClientRect().top+scrollY;
      for(let d=-innerHeight*0.9;d<innerHeight*0.8;d+=18){scrollTo(0,base+d);await new Promise(x=>requestAnimationFrame(x));await new Promise(x=>requestAnimationFrame(x));
        if((window.__handOpen||0)>0.98)break;}
      await new Promise(x=>setTimeout(x,700));
      const st=document.querySelector('.hand-stage').getBoundingClientRect();
      const of=document.getElementById('offer').getBoundingClientRect();
      out.hand={open:+(window.__handOpen||0).toFixed(2),gap:Math.round(of.top-st.bottom),
        capOpacity:+( [...document.querySelectorAll('.hand-caption .hc')].pop()||{style:{}} ).style.opacity||0};
      scrollBy(0,innerHeight*1.5);await new Promise(x=>setTimeout(x,800));
      out.handAfter=+(window.__handOpen||0).toFixed(2);}
    // agents
    const pin=document.getElementById('adtPin');
    if(pin){scrollTo(0,pin.getBoundingClientRect().top+scrollY+innerHeight*0.5);await new Promise(x=>setTimeout(x,900));
      const f=document.getElementById('holoWoman').getBoundingClientRect();
      const cs=[...document.querySelectorAll('.acap')].map(c=>c.getBoundingClientRect());
      const cta=document.querySelector('.adt-cta .btn');
      out.ag={figT:Math.round(f.top),figB:Math.round(f.bottom),cT:Math.round(Math.min(...cs.map(b=>b.top))),
        cB:Math.round(Math.max(...cs.map(b=>b.bottom))),ctaB:cta?Math.round(cta.getBoundingClientRect().bottom):null,vh:innerHeight,
        ok:f.top>=62 && Math.max(...cs.map(b=>b.bottom))<=innerHeight && (cta?cta.getBoundingClientRect().bottom<=innerHeight:true) && f.bottom<=Math.min(...cs.map(b=>b.top))+4};}
    // guarantees
    const gp=document.querySelector('.guar-pin');
    if(gp){scrollTo(0,gp.getBoundingClientRect().top+scrollY+innerHeight*0.5);await new Promise(x=>setTimeout(x,900));
      const f=document.getElementById('guarRobot').getBoundingClientRect();
      const cs=[...document.querySelectorAll('.gcard')].map(c=>c.getBoundingClientRect());
      const stk=document.querySelector('.guar-sticky').getBoundingClientRect();
      out.gu={figT:Math.round(f.top),figB:Math.round(f.bottom),cB:Math.round(Math.max(...cs.map(b=>b.bottom))),vh:innerHeight,
        inside:f.top>=stk.top-2&&f.bottom<=stk.bottom+2, ok:f.top>=62&&Math.max(...cs.map(b=>b.bottom))<=innerHeight+2};}
    return out;});
  console.log(URL.split('/').slice(-2)[0],dev,JSON.stringify(r),errs.length?('ERR '+JSON.stringify([...new Set(errs)].slice(0,3))):'');
  await ctx.close();
 }
}
console.log('DONE'); await br.close();
