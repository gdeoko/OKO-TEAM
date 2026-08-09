import { chromium } from 'playwright-core';
const B = 'http://127.0.0.1:8199/index.html';
const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader'] });
const ctx = await br.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, reducedMotion:'reduce' });
await ctx.addInitScript(`
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
    var o=document.getElementById('onboard'); if(o){o.classList.add('hidden'); o.style.display='none';}
  };
  try{ ['oko-onboard-done','oko-stories-seen','oko-tour-done','oko-tour','oko-onboarded'].forEach(k=>localStorage.setItem(k,'1'));
       localStorage.setItem('oko-onb2-intro', JSON.stringify({done:true,skipped:true})); }catch(e){}
`);
const p = await ctx.newPage();
await p.route('**/oko-eye.glb', r=>r.abort());
await p.route('**/vendor/**', r=>r.abort());
await p.goto(B, {waitUntil:'domcontentloaded', timeout:120000});
await p.waitForTimeout(1600);
await p.evaluate("okoSkipAuth(); showTab('academy'); acOpenLesson(3);");
await p.waitForTimeout(700);
console.log('1 acView =', await p.evaluate("window.acView"));
console.log('кнопки .oko-back:', JSON.stringify(await p.evaluate(`
  Array.from(document.querySelectorAll('button.oko-back')).map(b=>{
    const r=b.getBoundingClientRect();
    return {hidden:b.hasAttribute('hidden'), cls:b.className, parent:(b.parentElement&&(b.parentElement.id||b.parentElement.className))||'', rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width)]};
  })`)));
console.log('navstack:', await p.evaluate("typeof nvStack!=='undefined' ? JSON.stringify(nvStack.map(x=>x.key||x.id||String(x))) : (typeof NV!=='undefined'? JSON.stringify(Object.keys(NV)) : 'нет доступа')"));
await p.evaluate("acBackHome()"); await p.waitForTimeout(500);
console.log('после acBackHome() acView =', await p.evaluate("window.acView"));
await p.evaluate("acOpenLesson(3)"); await p.waitForTimeout(500);
const btn = await p.$('button.oko-back:not([hidden])');
await p.evaluate(`(()=>{const b=[...document.querySelectorAll('button.oko-back')].find(x=>!x.hasAttribute('hidden')); window.__clicked = b ? (b.className+' @'+Math.round(b.getBoundingClientRect().left)) : 'нет'; b && b.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`);
await p.waitForTimeout(700);
console.log('кликнули:', await p.evaluate("window.__clicked"), '→ acView =', await p.evaluate("window.acView"));
await br.close();
