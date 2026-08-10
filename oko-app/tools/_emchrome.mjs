import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
for (const w of [320, 390]) {
  const c = await b.newContext({ viewport:{width:w,height:800}, isMobile:true, hasTouch:true });
  await c.addInitScript(CLEAN_START);
  const p = await c.newPage();
  p.on('pageerror', e => console.log('ОШИБКА:', String(e).split('\n')[0].slice(0,100)));
  await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
  await p.waitForTimeout(2600);
  await p.evaluate(`okoSkipAuth(); showTab('chats')`);
  await p.waitForTimeout(800);
  await p.evaluate(`(()=>{const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();})()`);
  await p.waitForTimeout(700);
  await p.evaluate(`(()=>{ if(window.okoEmoji&&okoEmoji.open) okoEmoji.open(); else { const b=[...document.querySelectorAll('button')].find(x=>/эмодзи|emoji/i.test(x.getAttribute('aria-label')||'')); b&&b.click(); } })()`).catch(()=>{});
  await p.waitForTimeout(900);
  console.log(w+'px:', JSON.stringify(await p.evaluate(`(()=>{
    const пан=[...document.querySelectorAll('[class*="okoem"], [class*="emj"], [id*="emo" i]')]
      .filter(e=>{const r=e.getBoundingClientRect(); return r.height>100 && r.width>100;}).pop();
    if(!пан) return {панель:'не нашёл'};
    const листающиеся=[...пан.querySelectorAll('*')].filter(e=>e.scrollWidth>e.clientWidth+2 && e.clientWidth>40)
      .map(e=>({узел:e.className&&typeof e.className==='string'?e.className.trim().split(/\s+/)[0]:e.tagName,
                видно:e.clientWidth, надо:e.scrollWidth, лишку:e.scrollWidth-e.clientWidth}));
    return {
      панель: Math.round(пан.getBoundingClientRect().height),
      класс: String(пан.className).trim().split(/\s+/)[0],
      листающихсяРядов: листающиеся.length,
      ряды: листающиеся.slice(0,4),
      переполнениеДок: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  })()`)));
  await c.close();
}
await b.close();
