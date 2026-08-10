/* Замер дефектов из списка Даниэля: пустые чёрные поля снизу, обрезание
   сверху, бейджи в горизонтальном скролле. Сначала числа — потом правки. */
import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

const ЗАМЕР = `(() => {
  const scr = document.querySelector('main > .screen.active');
  const main = document.querySelector('main');
  if(!scr) return { нет: 'экрана' };
  const sr = scr.getBoundingClientRect();

  /* самый нижний видимый непустой элемент внутри экрана */
  let низ = -1, ктоВнизу = '';
  scr.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return;
    const t = (el.textContent||'').trim();
    const своё = el.children.length === 0;
    const рисует = t || cs.backgroundImage !== 'none' || el.tagName === 'IMG' || el.tagName === 'SVG';
    if(!(своё && рисует)) return;
    const r = el.getBoundingClientRect();
    if(r.width < 4 || r.height < 4) return;
    const абс = r.bottom - sr.top + scr.scrollTop;
    if(абс > низ){ низ = абс; ктоВнизу = (t || el.tagName).slice(0,26); }
  });

  /* шапка приложения и первый элемент содержимого — ловим обрезание сверху */
  const шапка = document.querySelector('header, .app-head, .hd, #okoHead');
  const шр = шапка ? шапка.getBoundingClientRect() : null;
  let первый = null, ктоСверху = '';
  scr.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return;
    const t = (el.textContent||'').trim();
    if(!t || el.children.length) return;
    const r = el.getBoundingClientRect();
    if(r.width < 4 || r.height < 4) return;
    if(первый === null || r.top < первый){ первый = r.top; ктоСверху = t.slice(0,26); }
  });

  /* горизонтальные скроллы внутри экрана */
  const скроллы = [];
  scr.querySelectorAll('*').forEach(el => {
    if(el.scrollWidth > el.clientWidth + 4){
      const cs = getComputedStyle(el);
      if(cs.overflowX === 'auto' || cs.overflowX === 'scroll'){
        skрол(скроллы, {
          узел: el.tagName.toLowerCase()+'.'+String(el.className).trim().split(/\\s+/).slice(0,2).join('.'),
          видно: el.clientWidth, надо: el.scrollWidth,
          текст: (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,52)
        });
      }
    }
  });
  function skрол(a,o){ if(a.length<6) a.push(o); }

  return {
    высотаПрокрутки: scr.scrollHeight,
    видимаяВысота: scr.clientHeight,
    последнийЭлементНа: Math.round(низ),
    пустоСнизу: Math.round(scr.scrollHeight - низ),
    ктоВнизу,
    отступСнизу: getComputedStyle(scr).paddingBottom,
    шапкаДо: шр ? Math.round(шр.bottom) : '(нет шапки)',
    первыйТекстНа: первый === null ? '(нет)' : Math.round(первый),
    ктоСверху,
    подШапкой: (шр && первый !== null && первый < шр.bottom - 1) ? 'ДА, обрезается' : 'нет',
    горизонтальныеСкроллы: скроллы
  };
})()`;

const ЭКРАНЫ = [
  ['кошелёк',   `showTab('wallet')`],
  ['мини-аппы', `showTab('mini')`],
  ['профиль',   `showTab('profile')`],
  ['лента',     `showTab('feed')`],
  ['чаты',      `showTab('chats')`],
];

const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
for (const [имя, w, h] of [['телефон 390', 390, 844], ['узкий 320', 320, 720], ['telegram 390', 390, 788]]) {
  const c = await b.newContext({ viewport:{width:w, height:h}, isMobile:true, hasTouch:true });
  await c.addInitScript(CLEAN_START);
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8199/index.html', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.evaluate('okoSkipAuth()');
  console.log('\n══════ ' + имя + ' ══════');
  for (const [экран, шаг] of ЭКРАНЫ) {
    await p.evaluate(шаг).catch(()=>{});
    await p.waitForTimeout(900);
    await p.evaluate(CLOSE_OVERLAYS).catch(()=>{});
    await p.waitForTimeout(400);
    const r = await p.evaluate(ЗАМЕР).catch(e => ({ ошибка: String(e).slice(0,90) }));
    console.log(экран.padEnd(11), JSON.stringify(r));
  }
  await c.close();
}
await b.close();
