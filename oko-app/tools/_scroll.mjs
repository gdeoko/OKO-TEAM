import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate(`okoSkipAuth(); showTab('profile')`);
await p.waitForTimeout(1500);
await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
await p.waitForTimeout(600);
console.log(await p.evaluate(`(()=>{
  var из = [];
  [document.documentElement, document.body, document.querySelector('main'),
   document.querySelector('main > .screen.active')].forEach(function(el){
    if(!el) return;
    из.push({ узел: el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/)[0]:''),
              scrollH: el.scrollHeight, clientH: el.clientHeight, запас: el.scrollHeight-el.clientHeight,
              overflowY: getComputedStyle(el).overflowY });
  });
  /* последняя видимая кнопка и докуда вообще тянется содержимое */
  var scr = document.querySelector('main > .screen.active');
  var r = scr ? scr.getBoundingClientRect() : null;
  return { скроллеры: из, экран: r ? Math.round(r.top)+'..'+Math.round(r.bottom)+' при высоте окна '+innerHeight : '-' };
})()`));
await b.close();
