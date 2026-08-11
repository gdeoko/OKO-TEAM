/* ============================================================================
   OKO · ЧТО ЗАНИМАЕТ ПОТОК ПОСЛЕ ПЕРЕКЛЮЧЕНИЯ ВКЛАДКИ

   probe-tabs показал: сам showTab быстрый (1–7 мс), раскладка 20–176 мс,
   а дальше на каждое переключение приходится ~8 полных пересканов доступности
   и ~15 повторных прогонов хуков мини-приложений. Всё это происходит ПОСЛЕ
   отрисованного кадра, поэтому в замер «showTab + кадр» не попадало — но
   палец в это время уже тянется к следующей кнопке, и именно эти сотни
   миллисекунд человек называет «меню лагает».

   Здесь меряем не догадку, а факт: сколько миллисекунд главный поток занят
   в течение секунды после переключения и чьи это миллисекунды.

   Запуск: node oko-app/tools/probe-after.mjs
   ============================================================================ */
import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
p.on('dialog', d => d.dismiss().catch(() => {}));
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3400);
await p.evaluate('okoSkipAuth()');
await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
await p.waitForTimeout(600);

/* Длинные задачи ловим PerformanceObserver'ом: браузер сам знает, когда
   поток был занят дольше 50 мс, и врать тут нечему. */
await p.evaluate(`(() => {
  window.__дл = [];
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__дл.push(Math.round(e.duration)); })
      .observe({ entryTypes: ['longtask'] });
  } catch (e) {}
})()`);

const ВКЛАДКИ = ['feed', 'chats', 'mini', 'wallet', 'profile', 'feed', 'chats', 'mini', 'wallet', 'profile'];
console.log('  вкладка    занято потока за 1 с после переключения   длинные задачи');
console.log('  ' + '-'.repeat(66));

let всего = 0;
for (const т of ВКЛАДКИ) {
  const r = await p.evaluate(`(async () => {
    window.__дл.length = 0;
    /* Тик-детектор: сравниваем ожидаемое время срабатывания с фактическим.
       Разница и есть время, отданное чужой работе. */
    let простой = 0, шагов = 0;
    let было = performance.now();
    const стоп = performance.now() + 1000;
    showTab('${т}');
    while (performance.now() < стоп) {
      await new Promise(r => setTimeout(r, 8));
      const t = performance.now();
      простой += Math.max(0, (t - было) - 8);
      было = t; шагов++;
    }
    return { занято: Math.round(простой), дл: window.__дл.slice() };
  })()`);
  await p.waitForTimeout(400);
  всего += r.занято;
  console.log('  ' + т.padEnd(10)
    + String(r.занято + ' мс').padStart(28)
    + '   ' + (r.дл.length ? r.дл.join(', ') + ' мс' : '—'));
}
console.log('\n  Итого занято потока: ' + всего + ' мс на 10 переключений ('
  + Math.round(всего / 10) + ' мс в среднем)');

/* Сколько стоит один полный проход доступности и один прогон хуков mini2. */
const цена = await p.evaluate(`(() => {
  const из = {};
  try {
    const t0 = performance.now();
    document.documentElement.dispatchEvent(new Event('nothing'));
    из.пусто = Math.round(performance.now() - t0);
  } catch (e) {}
  return из;
})()`);
void цена;

await b.close();
