/* ============================================================================
   OKO · ПОЧЕМУ ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ТОРМОЗИТ

   probe-perf показал по вкладкам подряд: 201, 124, 556, 707, 1360, 1186, 1075 мс.
   Владелец про это и говорит — «меню лагает». Секунда с лишним на тап по
   нижнему меню человек замечает наверняка.

   Здесь не общий замер, а разбор по слагаемым. На каждое переключение
   меряем отдельно:
     • сколько взял сам showTab (синхронная часть),
     • сколько времени потом браузер считал раскладку и рисовал,
     • сколько узлов в документе до и после,
     • сколько живых таймеров и наблюдателей накопилось.

   Счётчики таймеров и наблюдателей ставятся подменой конструкторов ДО загрузки
   приложения: иначе не отличить «слой подписался один раз» от «слой
   подписывается на каждое переключение и никогда не отписывается».

   Запуск: node oko-app/tools/probe-tabs.mjs
   ============================================================================ */
import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';

/* ВНИМАНИЕ: скрипт живёт внутри шаблонной строки, поэтому любой \n, \d, \w,
   \. должен быть удвоен — иначе движок подставит настоящий перенос строки
   прямо в тело литерала и весь init-скрипт упадёт с SyntaxError ещё до того,
   как объявит window.__oko_счёт. Именно на этом прошлый запуск и споткнулся. */
const СЧЁТЧИКИ = `
(() => {
  const с = { интервалы: 0, таймауты: 0, rAF: 0, наблюдатели: 0, слушатели: 0,
              откуда: {}, таймерыОткуда: {}, писать: false };
  window.__oko_счёт = с;

  /* Кто вызвал: первая строка стека, указывающая на файл приложения. */
  const место = () => {
    try {
      const строки = ((new Error()).stack || '').split('\\n');
      const л = строки.find(x => /oko-|app\\.js|app\\.min\\.js|index\\.html/.test(x)) || '';
      const м = л.match(/([\\w.-]+\\.(?:js|html)):(\\d+)/);
      return м ? м[1] + ':' + м[2] : '?';
    } catch (e) { return '?'; }
  };
  const пометить = (куда) => { const м = место(); куда[м] = (куда[м] || 0) + 1; };

  const si = window.setInterval;
  window.setInterval = function (...a) { с.интервалы++; return si.apply(this, a); };
  const st = window.setTimeout;
  window.setTimeout = function (...a) {
    с.таймауты++;
    if (с.писать) пометить(с.таймерыОткуда);
    return st.apply(this, a);
  };
  const rf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (...a) { с.rAF++; return rf.apply(this, a); };

  ['MutationObserver', 'IntersectionObserver', 'ResizeObserver'].forEach(имя => {
    const О = window[имя];
    if (!О) return;
    window[имя] = class extends О {
      constructor(...a) { super(...a); с.наблюдатели++; }
    };
  });

  const доб = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (...a) {
    с.слушатели++;
    if (с.писать) пометить(с.откуда);
    return доб.apply(this, a);
  };
})()
`;

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(СЧЁТЧИКИ);
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
p.on('dialog', d => d.dismiss().catch(() => {}));
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3400);
await p.evaluate('okoSkipAuth()');
await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
await p.waitForTimeout(500);

const ВКЛАДКИ = ['feed', 'chats', 'mini', 'wallet', 'profile', 'feed', 'chats', 'mini', 'wallet', 'profile'];

/* Запись «кто вешает» включаем только на замерах: при старте приложение
   законно подписывается на сотни событий, и они бы забили картину. */
await p.evaluate('window.__oko_счёт.писать = true');

console.log('  вкладка    showTab   раскладка   узлов   +таймеров  +наблюд.  +слушат.');
console.log('  ' + '-'.repeat(70));

let прошлые = await p.evaluate('({...window.__oko_счёт, узлов: document.querySelectorAll("*").length})');

for (const т of ВКЛАДКИ) {
  const r = await p.evaluate(`(async () => {
    const было = performance.now();
    showTab('${т}');
    const после = performance.now();
    /* ждём, пока браузер посчитает раскладку и нарисует кадр */
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    document.body.getBoundingClientRect();
    const конец = performance.now();
    return { showTab: Math.round(после - было), кадр: Math.round(конец - после),
             узлов: document.querySelectorAll('*').length, ...window.__oko_счёт };
  })()`);
  await p.waitForTimeout(260);
  const д = (a, b) => String(a - b).padStart(4);
  console.log('  ' + т.padEnd(10)
    + String(r.showTab + ' мс').padStart(8)
    + String(r.кадр + ' мс').padStart(11)
    + String(r.узлов).padStart(9)
    + д(r.интервалы + r.таймауты, прошлые.интервалы + прошлые.таймауты).padStart(11)
    + д(r.наблюдатели, прошлые.наблюдатели).padStart(10)
    + д(r.слушатели, прошлые.слушатели).padStart(10));
  прошлые = r;
}

/* Кто именно обрабатывает showTab: ядро или обёртки слоёв. */
console.log('\n  Кто обернул showTab:');
console.log(await p.evaluate(`(() => {
  const s = String(window.showTab);
  return '    длина обёртки: ' + s.length + ' символов\\n'
       + '    начало: ' + s.slice(0, 220).replace(/\\s+/g, ' ');
})()`));

const итог = await p.evaluate('window.__oko_счёт');
console.log('\n  Всего за сессию: интервалов ' + итог.интервалы + ', таймаутов ' + итог.таймауты
  + ', rAF ' + итог.rAF + ', наблюдателей ' + итог.наблюдатели + ', слушателей ' + итог.слушатели);

const топ = о => Object.entries(о || {}).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('\n  Кто вешает слушателей НА ПЕРЕКЛЮЧЕНИЯХ (10 штук):');
топ(итог.откуда).forEach(([м, n]) => console.log('    ' + String(n).padStart(4) + '  ' + м));
console.log('\n  Кто ставит таймауты НА ПЕРЕКЛЮЧЕНИЯХ:');
топ(итог.таймерыОткуда).forEach(([м, n]) => console.log('    ' + String(n).padStart(4) + '  ' + м));

await b.close();
