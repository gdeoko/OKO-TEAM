import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
p.on('pageerror', e => console.log('ОШИБКА:', String(e).split('\n')[0].slice(0,110)));
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2600);
await p.evaluate(`okoSkipAuth(); showTab('profile')`);
await p.waitForTimeout(1600);
await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate(`(()=>{
  const scr=document.getElementById('screen-profile');
  const строка=scr.querySelector('.p3-check');
  const скрытый=scr.querySelector('[data-p3hidden="1"]');
  const карточки=[...scr.querySelectorAll('*')].filter(e=>/В 5 раз чаще|показов в неделю|Первые 500 просмотров/.test(e.textContent||'')&&e.children.length===0);
  const видныеКарточки=карточки.filter(e=>e.offsetParent!==null);
  return {
    строкаСводки: строка? (строка.textContent||'').replace(/\\s+/g,' ').trim() : 'НЕТ',
    скрытыйБлок: скрытый? скрытый.tagName.toLowerCase()+'.'+String(скрытый.className).split(' ')[0]+' высота='+Math.round(скрытый.getBoundingClientRect().height) : 'НЕТ',
    карточекЧекЛистаВидно: видныеКарточки.length,
    прогрессСборки: /Прогресс сборки/.test(scr.textContent)?'ЕСТЬ':'убран',
    вСети: /в сети/.test(scr.textContent)?'ЕСТЬ':'убрано',
    высотаЭкрана: scr.scrollHeight
  };
})()`), null, 1));
await b.close();
