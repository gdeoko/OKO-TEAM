import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, colorScheme:'dark' });
await ctx.addInitScript(`
  window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){}
    var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}
    var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}
    var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};
  try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1');}catch(e){}
`);
const p = await ctx.newPage();
p.on('pageerror',e=>console.log('PAGEERROR',String(e.stack||e).slice(0,300)));
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded',timeout:60000});
await p.waitForTimeout(2200);
await p.evaluate(`okoSkipAuth();`);
await p.waitForTimeout(500);
await p.evaluate(`typeof st2Open==='function'&&st2Open()`);
for (const ms of [400,1000,2000,3500]){
  await p.waitForTimeout(ms===400?400:(ms-400));
  const r = await p.evaluate(() => {
    const v = document.getElementById('st2View');
    if(!v) return {no:'нет #st2View'};
    const cs = getComputedStyle(v), b = v.getBoundingClientRect();
    const stackC = document.elementsFromPoint(innerWidth/2, innerHeight/2).slice(0,8).map(e=>(e.id?'#'+e.id:e.tagName)+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/)[0]:''));
    return { role:v.getAttribute('role'), modal:v.getAttribute('aria-modal'),
      pos:cs.position, z:cs.zIndex, vis:cs.visibility, disp:cs.display, op:cs.opacity,
      rect:Math.round(b.width)+'x'+Math.round(b.height)+' @'+Math.round(b.left)+','+Math.round(b.top),
      cover:((b.width*b.height)/(innerWidth*innerHeight)).toFixed(2), atCenter:stackC,
      hasA11y: !!window.okoA11y, why: window.okoA11y && window.okoA11y.why(v) };
  });
  console.log(JSON.stringify(r));
}
await b.close();
