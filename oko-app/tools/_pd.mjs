import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2600);
await p.evaluate(`okoSkipAuth(); showTab('profile')`);
await p.waitForTimeout(1500);
await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate(`(()=>{
  const узел = el => el ? el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).slice(0,3).join('.'):'') : null;
  const найти = re => { let r=null; document.querySelectorAll('main > .screen.active *').forEach(el=>{
      const t=(el.textContent||'').replace(/\\s+/g,' ').trim();
      if(re.test(t) && (!r || r.contains(el))) r=el; }); return r; };
  const чек = найти(/КАК ТЕБЯ НАЙДУТ/);
  const прогресс = найти(/^Прогресс сборки/);
  const соцсети = найти(/^Мои соцсети/);
  const статус = document.querySelector('#screen-profile .pp2-nick, #screen-profile .sub, .pp2-top .sub');
  return {
    чекЛист: чек ? { узел: узел(чек), корень: узел(чек.closest('.okg-ob, section, .pp2-block, .card')||чек.parentElement), высота: Math.round(чек.getBoundingClientRect().height) } : 'нет',
    прогресс: прогресс ? { узел: узел(прогресс), строка: узел(прогресс.closest('button, .prow, a')||прогресс), текст:(прогресс.textContent||'').replace(/\\s+/g,' ').trim().slice(0,44) } : 'нет',
    соцсети: соцсети ? { узел: узел(соцсети), текст:(соцсети.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60) } : 'нет',
    статусПодНиком: статус ? (статус.textContent||'').trim().slice(0,40) : 'не нашёл'
  };
})()`), null, 1));
await b.close();
