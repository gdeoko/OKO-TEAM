import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
for (const w of [320, 390]) {
  const c = await b.newContext({ viewport:{width:w, height:800}, isMobile:true, hasTouch:true });
  await c.addInitScript(CLEAN_START);
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2500);
  await p.evaluate(`okoSkipAuth(); showTab('profile')`);
  await p.waitForTimeout(1500);
  await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
  await p.waitForTimeout(600);
  console.log(w+' px:', JSON.stringify(await p.evaluate(`(()=>{
    var pill = document.querySelector('.okg-pill');
    if(!pill) return {плашки:'нет'};
    var cs = getComputedStyle(pill), pr = pill.getBoundingClientRect();
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return {плашка:'скрыта'};
    var задетые = [];
    document.querySelectorAll('button, [role="button"], .prow, .pp2-row').forEach(function(el){
      if(pill.contains(el) || el.contains(pill)) return;
      var cs2 = getComputedStyle(el);
      if(cs2.display==='none'||cs2.visibility==='hidden'||+cs2.opacity===0) return;
      var r = el.getBoundingClientRect();
      if(r.width<8||r.height<8) return;
      var пересек = !(r.right < pr.left || r.left > pr.right || r.bottom < pr.top || r.top > pr.bottom);
      if(пересек) задетые.push(((el.textContent||'').trim().slice(0,24))||el.className);
    });
    return { плашка: Math.round(pr.left)+','+Math.round(pr.top)+' '+Math.round(pr.width)+'x'+Math.round(pr.height),
             перекрывает: задетые };
  })()`)));
  await c.close();
}
await b.close();
