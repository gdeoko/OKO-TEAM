import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate('okoSkipAuth()');
const где = [['профиль',`showTab('profile')`],['моя страница',`showTab('profile');(()=>{const b=[...document.querySelectorAll('[data-my]')].find(x=>x.getAttribute('data-my')==='page');b&&b.click();})()`],['публичный',`typeof psOpenProfile==='function'&&psOpenProfile('Даниэль Ильясов')`]];
for(const [имя,шаг] of где){
  await p.keyboard.press('Escape').catch(()=>{});
  await p.evaluate(шаг).catch(()=>{});
  await p.waitForTimeout(1200);
  await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
  await p.waitForTimeout(400);
  console.log(имя, JSON.stringify(await p.evaluate(`(()=>{
    const el=document.getElementById('profAch');
    const видно=el&&el.offsetParent!==null;
    const r=el?el.getBoundingClientRect():null;
    return { естьВDOM: !!el, виден: !!видно,
      размер: r?Math.round(r.width)+'x'+Math.round(r.height):'-',
      скроллит: el? (el.scrollWidth>el.clientWidth+2?'ДА '+el.scrollWidth+'>'+el.clientWidth:'нет') : '-',
      строк: el? new Set([...el.children].map(x=>Math.round(x.getBoundingClientRect().top))).size : 0,
      текст: el?(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,60):'' };
  })()`)));
}
await b.close();
