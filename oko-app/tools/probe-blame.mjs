/* ============================================================================
   OKO · КТО СЪЕДАЕТ ПОТОК ПОСЛЕ ПЕРЕКЛЮЧЕНИЯ — ПРЯМОЙ ОПЫТ

   Догадка по стекам показывает, кто ставит таймеры, но не сколько они стоят.
   Здесь честный A/B: один и тот же прогон, но выбранный слой не загружается
   вовсе. Разница в занятости потока — цена этого слоя.

   Запуск: node oko-app/tools/probe-blame.mjs
   ============================================================================ */
import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

/* node probe-blame.mjs [вкладки через запятую] [слои через запятую] */
const ВКЛАДКИ = (process.argv[2] || 'feed,chats,mini,wallet,profile,feed,chats,mini,wallet,profile').split(',');

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

async function прогон(блок) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(CLEAN_START);
  if (блок) await c.route('**/' + блок, r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
  const p = await c.newPage();
  p.on('dialog', d => d.dismiss().catch(() => {}));
  await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3400);
  await p.evaluate('okoSkipAuth()').catch(() => {});
  await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
  await p.waitForTimeout(600);

  let всего = 0;
  for (const т of ВКЛАДКИ) {
    const r = await p.evaluate(`(async () => {
      let простой = 0; let было = performance.now();
      const стоп = performance.now() + 1000;
      try { showTab('${т}'); } catch (e) {}
      while (performance.now() < стоп) {
        await new Promise(r => setTimeout(r, 8));
        const t = performance.now();
        простой += Math.max(0, (t - было) - 8);
        было = t;
      }
      return Math.round(простой);
    })()`).catch(() => 0);
    await p.waitForTimeout(350);
    всего += r;
  }
  await c.close();
  return всего;
}

const ОПЫТЫ = [null].concat(
  (process.argv[3] || 'oko-a11y.js,oko-mini2.js,oko-growth.js,oko-back.js,oko-profile3.js').split(','));
const базa = {};
console.log('  что отключено          занято потока   разница');
console.log('  ' + '-'.repeat(50));
let эталон = 0;
for (const о of ОПЫТЫ) {
  const мс = await прогон(о);
  if (о === null) эталон = мс;
  базa[о || 'ничего'] = мс;
  console.log('  ' + (о || 'ничего (эталон)').padEnd(22)
    + String(мс + ' мс').padStart(12)
    + (о ? String((мс - эталон > 0 ? '+' : '') + (мс - эталон) + ' мс').padStart(11) : ''));
}
await b.close();
