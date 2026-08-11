/* ============================================================================
   OKO · ЦЕНА ПРОХОДА ДОСТУПНОСТИ ПО ЧАСТЯМ

   A/B-опыт (probe-blame) показал: слой доступности отвечает за 2964 мс из
   4113 мс занятого потока на десяти переключениях вкладок — почти три
   четверти. Дебаунс убрал большую часть, но на кошельке и профиле осталось
   по 300 мс. Здесь смотрим, какая именно часть прохода их берёт, чтобы
   чинить измеренное, а не предполагаемое.

   Запуск: node oko-app/tools/probe-a11y-cost.mjs
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

const ВКЛАДКИ = ['feed', 'chats', 'mini', 'wallet', 'profile'];
console.log('  вкладка   проходов  landmarks  runNaming  syncStates  syncDialogs  runTargets  интеракт.');
console.log('  ' + '-'.repeat(94));

for (const т of ВКЛАДКИ) {
  await p.evaluate(`okoA11y.часы(true)`);
  await p.evaluate(`(async () => {
    window.__п = 0;
    const s = okoA11y.scan; /* считаем проходы через обёртку на время замера */
    showTab('${т}');
    await new Promise(r => setTimeout(r, 1200));
  })()`);
  const ч = await p.evaluate('okoA11y.часы()');
  const узлов = await p.evaluate(`document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])').length`);
  const в = k => String((ч && ч[k] != null ? ч[k] : 0) + ' мс');
  console.log('  ' + т.padEnd(10)
    + String((ч && ч.проходов) || 0).padStart(9)
    + в('landmarks').padStart(11)
    + в('runNaming').padStart(11)
    + в('syncStates').padStart(12)
    + в('syncDialogs').padStart(13)
    + в('runTargets').padStart(12)
    + String(узлов).padStart(11));
}

await b.close();
