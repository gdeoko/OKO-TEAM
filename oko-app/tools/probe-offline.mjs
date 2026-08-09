/* ============================================================================
   ОФЛАЙН И ВЕС ПЕРВОЙ ЗАГРУЗКИ

   Две вещи, которые видно только в живом браузере с service worker.

   1. Сколько байт стоит первый заход и сколько — второй. Раньше SW на
      install тянул все 30+ файлов через `cache: 'reload'`, то есть в обход
      HTTP-кэша, ровно тогда же, когда те же файлы качала сама страница.
      Человек платил за приложение дважды. Здесь это видно числом.

   2. Работает ли приложение без сети. Оболочка офлайна лежит в CORE_CACHE,
      всё остальное оседает в ASSET_CACHE при первом обращении. Гасим сеть
      и перезагружаем: приложение должно подняться, а не показать ошибку.

   Запуск: node oko-app/tools/probe-offline.mjs [адрес]
   ============================================================================ */
import { chromium } from 'playwright-core';

const БАЗА = process.argv[2] || 'http://127.0.0.1:8199/index.html';
const kb = n => (n / 1024).toFixed(0) + ' КБ';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await c.newPage();

/* --- считаем байты, отделяя сеть от кэша ---------------------------------
   Событие response срабатывает и на ответы, которые отдал service worker
   из кэша: по объёму они выглядят как настоящая загрузка, хотя в сеть не
   ходили. Различаем по fromServiceWorker() — иначе второй заход покажет
   тот же вес, что и первый, и замер будет бессмысленным. */
let байт = 0, запросов = 0, изКэша = 0, кэшБайт = 0;
const учёт = async r => {
  let размер = 0;
  try {
    const l = r.headers()['content-length'];
    размер = l ? +l : (await r.body().catch(() => Buffer.alloc(0))).length;
  } catch (e) {}
  let свой = false;
  try { свой = r.fromServiceWorker(); } catch (e) {}
  if (свой) { изКэша++; кэшБайт += размер; }
  else { запросов++; байт += размер; }
};
p.on('response', учёт);
const снять = () => {
  const r = { изСети: { запросов, вес: kb(байт) }, изКэша: { ответов: изКэша, вес: kb(кэшБайт) } };
  байт = 0; запросов = 0; изКэша = 0; кэшБайт = 0;
  return r;
};

await p.goto(БАЗА, { waitUntil: 'load' });
/* ждём, пока SW встанет и доработает install */
await p.waitForTimeout(6000);
const первый = снять();

const sw = await p.evaluate(`(async () => {
  if (!('serviceWorker' in navigator)) return { есть: false };
  const r = await navigator.serviceWorker.getRegistration();
  return { есть: !!r, активен: !!(r && r.active), состояние: r && r.active ? r.active.state : '-' };
})()`);

/* --- второй заход: сколько ушло в сеть, когда кэш уже прогрет --- */
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(3000);
const второй = снять();

/* --- третий заход: без сети --- */
снять();
await c.setOffline(true);
let офлайнОшибка = '';
const ошибки = [];
p.on('pageerror', e => ошибки.push(String(e).split('\n')[0].slice(0, 100)));
try { await p.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }); }
catch (e) { офлайнОшибка = String(e).slice(0, 90); }
await p.waitForTimeout(4000);

const офлайн = await p.evaluate(`(() => ({
  заголовок: document.title || '(нет)',
  естьРазметка: !!document.querySelector('nav, #screen-feed, .tabs, #tabs'),
  видноОшибку: /офлайн|offline|нет соединения/i.test(document.body.innerText.slice(0, 400)),
  ядро: typeof showTab,
  слои: document.querySelectorAll('script[src*="media/app/"]').length
}))()`).catch(e => ({ ошибка: String(e).slice(0, 80) }));

await c.setOffline(false);
await b.close();

console.log(JSON.stringify({
  первыйЗаход:  первый,
  второйЗаход:  второй,
  serviceWorker: sw,
  безСети: { ...офлайн, ошибкаПерезагрузки: офлайнОшибка || 'нет', ошибкиJS: [...new Set(ошибки)].slice(0, 3) },
}, null, 2));
