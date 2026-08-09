/* Рвётся ли слово НА САМОМ ДЕЛЕ.

   Все прежние детекторы считали ширину слова канвасом и сравнивали с шириной
   ячейки. Это догадка: она не знает про переносы по дефисам, про то, как
   браузер реально разложил строки, и про то, что ячейка могла быть шире в
   момент замера. Здесь мы не считаем, а СМОТРИМ: разбиваем текст по буквам
   через Range, берём координаты каждой буквы и ищем место, где строка
   сменилась между двумя буквами одного слова. Если такого места нет —
   переноса посреди слова нет, чем бы там ни закончилась арифметика. */
import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

const ПРОВЕРКА = `(() => {
  const плохие = [];
  const узлы = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.nodeValue || '');
    if (!t.trim() || t.trim().length < 4) continue;
    const el = n.parentElement;
    if (!el || el.ownerSVGElement) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    узлы.push(n);
  }

  for (const n of узлы) {
    const t = n.nodeValue;
    const rng = document.createRange();
    let прошлыйНиз = null, прошлыйСимвол = '';
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      rng.setStart(n, i); rng.setEnd(n, i + 1);
      const rects = rng.getClientRects();
      if (!rects.length) { прошлыйСимвол = ch; continue; }
      const низ = Math.round(rects[0].bottom);
      /* строка сменилась? */
      if (прошлыйНиз !== null && низ > прошлыйНиз + 2) {
        /* перенос между двумя буквами — значит порвали слово */
        const букваДо = /[\\wа-яёА-ЯЁ]/.test(прошлыйСимвол);
        const букваПосле = /[\\wа-яёА-ЯЁ]/.test(ch);
        if (букваДо && букваПосле) {
          const el = n.parentElement;
          plохие_push(плохие, {
            текст: t.trim().slice(0, 48),
            разрыв: t.slice(Math.max(0, i - 8), i) + '|' + t.slice(i, i + 8),
            узел: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''),
            ширина: el.offsetWidth,
            wordBreak: getComputedStyle(el).wordBreak,
            overflowWrap: getComputedStyle(el).overflowWrap
          });
        }
      }
      прошлыйНиз = низ; прошлыйСимвол = ch;
    }
    rng.detach && rng.detach();
  }
  function plохие_push(a, o){ if (a.length < 12) a.push(o); }
  return плохие;
})()`;

const ЭКРАНЫ = [
  ['профиль',      `showTab('profile')`],
  ['моя страница', `showTab('profile'); (()=>{const b=[...document.querySelectorAll('[data-my]')].find(x=>x.getAttribute('data-my')==='page'); b&&b.click();})()`],
  ['создать',      `showTab('profile'); (()=>{const b=[...document.querySelectorAll('[data-my]')].find(x=>x.getAttribute('data-my')==='create'); b&&b.click();})()`],
  ['настройки',    `showTab('profile'); typeof st2Open==='function'&&st2Open()`],
  ['каналы',       `typeof chOpen==='function'&&chOpen('list')`],
];

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
for (const [ш, vp] of [['узкий', { width: 320, height: 720 }], ['обычный', { width: 390, height: 844 }]]) {
  const c = await b.newContext({ viewport: vp, isMobile: true, hasTouch: true });
  await c.addInitScript(CLEAN_START);
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.evaluate('okoSkipAuth()');
  for (const [имя, шаг] of ЭКРАНЫ) {
    await p.keyboard.press('Escape').catch(() => {});
    await p.evaluate(шаг).catch(() => {});
    await p.waitForTimeout(900);
    await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
    /* ждём конца анимаций — иначе строки ещё едут */
    await p.evaluate(`(() => new Promise(r => { let n = 0; const t = () => { n++;
      let run = 0; try { run = document.getAnimations().filter(a => a.playState === 'running').length; } catch(e){}
      if (!run || n > 25) return r(n); setTimeout(t, 40); }; t(); }))()`).catch(() => {});
    const r = await p.evaluate(ПРОВЕРКА).catch(e => [{ ошибка: String(e).slice(0, 120) }]);
    console.log(`${ш.padEnd(8)} ${имя.padEnd(14)} настоящих разрывов: ${r.length}`);
    for (const x of r.slice(0, 4)) console.log('   ', JSON.stringify(x));
  }
  await c.close();
}
await b.close();
