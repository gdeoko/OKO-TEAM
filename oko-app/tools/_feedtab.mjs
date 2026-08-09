import { chromium } from 'playwright-core';
import { CLEAN_START } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
for (const [имя, vp] of [['десктоп',{width:1440,height:900}], ['мобильный',{width:390,height:844}]]) {
  const c = await b.newContext({ viewport: vp });
  await c.addInitScript(CLEAN_START);
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2500);
  const r = await p.evaluate(`(()=>{
    okoSkipAuth(); showTab('feed');
    var b = document.querySelector('.feed-tabs button[data-fk="sub"]');
    var было = document.querySelector('.feed-tabs button.on');
    if(b) b.click();
    var стало = document.querySelector('.feed-tabs button.on');
    return { кнопкаНайдена: !!b, было: было && было.textContent.trim(), стало: стало && стало.textContent.trim(),
             рядов: document.querySelectorAll('.feed-tabs').length };
  })()`);
  await p.waitForTimeout(900);
  const после = await p.evaluate(`(()=>{var a=document.querySelector('.feed-tabs button.on'); return a&&a.textContent.trim();})()`);
  console.log(имя, JSON.stringify({...r, черезСекунду: после}));
  await c.close();
}
await b.close();
