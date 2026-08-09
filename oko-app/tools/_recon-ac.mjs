import { chromium } from 'playwright-core';
const B = 'http://127.0.0.1:8199/index.html';
const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader'] });
const ctx = await br.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await ctx.addInitScript(`
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
    var o=document.getElementById('onboard'); if(o){o.classList.add('hidden'); o.style.display='none';}
  };
  try{ localStorage.setItem('oko-onboard-done','1'); localStorage.setItem('oko-stories-seen','1'); localStorage.setItem('oko-tour-done','1'); localStorage.setItem('oko-tour','1'); }catch(e){}
`);
const p = await ctx.newPage();
p.on('pageerror', e=>console.log('PAGEERR', String(e).slice(0,200)));
await p.goto(B, {waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
await p.evaluate(`okoSkipAuth(); showTab('academy');`);
await p.waitForTimeout(900);
console.log(JSON.stringify(await p.evaluate(()=>({
  winAcView: typeof window.acView,
  acViewVal: (typeof acView!=='undefined')?acView:null,
  winAcS: typeof window.acS,
  winAcOpenLesson: typeof window.acOpenLesson,
  winAcRender: typeof window.acRender,
  winACCOURSES: typeof window.AC_COURSES,
})), null, 1));
// что за плавающее кольцо
await p.evaluate(`acOpenLesson(0)`); await p.waitForTimeout(600);
console.log(JSON.stringify(await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll('body > *').forEach(el=>{
    const cs=getComputedStyle(el); const r=el.getBoundingClientRect();
    if(cs.position==='fixed' && r.width>0 && r.height>0 && r.top<window.innerHeight && r.bottom>0)
      out.push({tag:el.tagName, id:el.id, cls:String(el.className).slice(0,60), rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], z:cs.zIndex, txt:(el.innerText||'').slice(0,30)});
  });
  return out;
}), null, 1));
// проверка кнопки назад в шапке
console.log('back-header:', JSON.stringify(await p.evaluate(()=>{
  const b=document.querySelector('button.oko-back');
  return b?{hidden:b.hasAttribute('hidden'), rect:b.getBoundingClientRect().toJSON()}:null;
})));
await p.evaluate(()=>{ const b=document.querySelector('button.oko-back:not([hidden])'); b&&b.click(); });
await p.waitForTimeout(600);
console.log('after back:', await p.evaluate(()=>({view:(typeof acView!=='undefined')?acView:null, screen:(document.querySelector('main > .screen.active')||{}).id})));
await br.close();
