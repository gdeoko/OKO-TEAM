import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.addInitScript(`window.__p3off=1`);
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2600);
await p.evaluate(`okoSkipAuth(); showTab('profile')`);
await p.waitForTimeout(1600);
await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
await p.waitForTimeout(500);
console.log(await p.evaluate(`(()=>{
  const scr=document.getElementById('screen-profile');
  const h=[...scr.querySelectorAll('*')].find(e=>/КАК ТЕБЯ НАЙДУТ/i.test(e.textContent||'')&&e.children.length===0);
  if(!h) return 'заголовка нет';
  const цепь=[]; let el=h;
  while(el && el!==scr){ 
    цепь.push(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+'.'+String(el.className).trim().split(/\\s+/).slice(0,2).join('.')
      +' h='+Math.round(el.getBoundingClientRect().height)+' детей='+el.children.length);
    el=el.parentElement; }
  /* соседи ближайшего блочного предка */
  const блок=h.closest('div');
  const рядом=[...(блок&&блок.parentElement?блок.parentElement.children:[])].map(e=>
    e.tagName.toLowerCase()+'.'+String(e.className).trim().split(/\\s+/).slice(0,2).join('.')+' h='+Math.round(e.getBoundingClientRect().height));
  return 'ЦЕПЬ ВВЕРХ:\\n  '+цепь.join('\\n  ')+'\\nСОСЕДИ:\\n  '+рядом.join('\\n  ');
})()`));
await b.close();
