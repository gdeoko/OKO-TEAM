/* Откуда берётся пустота снизу: перечисляем прямых детей экрана с их
   геометрией и отступами, плюс ищем ряд бейджей профиля. */
import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

const ДЕТИ = `(() => {
  const scr = document.querySelector('main > .screen.active');
  if(!scr) return {};
  const дети = [...scr.children].map(el => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return {
      узел: el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\\s+/).slice(0,2).join('.'):''),
      верх: Math.round(r.top - scr.getBoundingClientRect().top + scr.scrollTop),
      высота: Math.round(r.height),
      display: cs.display,
      minHeight: cs.minHeight,
      paddingBottom: cs.paddingBottom,
      marginBottom: cs.marginBottom,
      пусто: (el.textContent||'').trim() ? 'нет' : 'ДА'
    };
  });
  const cs = getComputedStyle(scr);
  return {
    экран: scr.id || scr.className,
    scrollHeight: scr.scrollHeight, clientHeight: scr.clientHeight,
    paddingBottom: cs.paddingBottom, minHeight: cs.minHeight,
    дети
  };
})()`;

const БЕЙДЖИ = `(() => {
  /* ищем ряд, где рядом стоят слова из списка Даниэля */
  const слова = ['Ранний','MAX','Партнёр','реакций','Автор'];
  let ряд = null;
  document.querySelectorAll('main > .screen.active *').forEach(el => {
    const t = (el.textContent||'').replace(/\\s+/g,' ');
    if(слова.filter(w => t.includes(w)).length >= 3){
      if(!ряд || el.contains(ряд) === false && ряд.contains(el)) ряд = el;
    }
  });
  if(!ряд) return { нет: 'ряда бейджей' };
  const cs = getComputedStyle(ряд), r = ряд.getBoundingClientRect();
  return {
    узел: ряд.tagName.toLowerCase()+'.'+String(ряд.className).trim().split(/\\s+/).slice(0,3).join('.'),
    текст: (ряд.textContent||'').replace(/\\s+/g,' ').trim().slice(0,70),
    видно: ряд.clientWidth, надо: ряд.scrollWidth,
    скроллит: ряд.scrollWidth > ряд.clientWidth + 2 ? 'ДА' : 'нет',
    overflowX: cs.overflowX, display: cs.display, flexWrap: cs.flexWrap,
    высота: Math.round(r.height)
  };
})()`;

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil:'domcontentloaded' });
await p.waitForTimeout(2500);
await p.evaluate('okoSkipAuth()');

for (const [имя, шаг] of [['мини-аппы',`showTab('mini')`], ['лента',`showTab('feed')`], ['чаты',`showTab('chats')`]]) {
  await p.evaluate(шаг).catch(()=>{});
  await p.waitForTimeout(900);
  await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
  await p.waitForTimeout(300);
  const r = await p.evaluate(ДЕТИ);
  console.log('\n══ ' + имя + ' ══  scrollH=' + r.scrollHeight + ' clientH=' + r.clientHeight + ' padBottom=' + r.paddingBottom + ' minH=' + r.minHeight);
  (r.дети||[]).forEach(d => console.log('   ' + JSON.stringify(d)));
}

await p.evaluate(`showTab('profile')`);
await p.waitForTimeout(1200);
await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
await p.waitForTimeout(400);
console.log('\n══ бейджи профиля ══');
console.log('  ', JSON.stringify(await p.evaluate(БЕЙДЖИ)));
await b.close();
