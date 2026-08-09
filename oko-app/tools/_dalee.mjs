import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
p.on('pageerror', e => console.log('ОШИБКА:', String(e).split('\n').slice(0,5).join('\n  ')));
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate(`okoSkipAuth(); showTab('feed')`);
await p.waitForTimeout(800);
await p.evaluate(CLOSE_OVERLAYS);
await p.waitForTimeout(300);
const кто = await p.evaluate(`(()=>{
  var els=[...document.querySelectorAll('button,[role="button"]')].filter(function(e){
    var cs=getComputedStyle(e); if(cs.display==='none'||cs.visibility==='hidden') return false;
    var r=e.getBoundingClientRect(); if(r.width<8||r.height<8) return false;
    return /^Далее$/i.test((e.textContent||'').replace(/\\s+/g,' ').trim());
  });
  return els.map(function(e){
    var par=e.parentElement, chain=[];
    for(var i=0;par&&i<4;par=par.parentElement,i++) chain.push(par.tagName.toLowerCase()+(par.id?'#'+par.id:'')+(par.className&&typeof par.className==='string'?'.'+par.className.trim().split(/\\s+/)[0]:''));
    return { cls:e.className, onclick:e.getAttribute('onclick')||'[js]', предки:chain.join(' < ') };
  });
})()`);
console.log('кнопок «Далее»:', JSON.stringify(кто, null, 1));
await p.evaluate(`(()=>{var e=[...document.querySelectorAll('button,[role="button"]')].find(function(x){return /^Далее$/i.test((x.textContent||'').trim());}); e&&e.click();})()`);
await p.waitForTimeout(1500);
await b.close();
