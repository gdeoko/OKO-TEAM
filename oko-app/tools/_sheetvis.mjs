import { chromium } from 'playwright-core';
import { CLEAN_START } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate(`okoSkipAuth(); showTab('feed')`);
await p.waitForTimeout(800);
console.log(await p.evaluate(`(()=>{
  var sh = document.getElementById('sheet-ads-create');
  var cs = getComputedStyle(sh), r = sh.getBoundingClientRect();
  var btn = sh.querySelector('.ads-nav .btn');
  var br = btn ? btn.getBoundingClientRect() : null;
  var подЛи = br ? document.elementFromPoint(br.left + br.width/2, br.top + br.height/2) : null;
  return {
    классы: sh.className,
    display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
    transform: cs.transform.slice(0,40), pointerEvents: cs.pointerEvents,
    рамка: Math.round(r.top)+','+Math.round(r.left)+' '+Math.round(r.width)+'x'+Math.round(r.height),
    кнопкаВидна: !!(br && br.width>8 && br.height>8),
    ктоВТочке: подЛи ? (подЛи.tagName + '.' + String(подЛи.className).slice(0,30)) : '(вне экрана)'
  };
})()`));
await b.close();
