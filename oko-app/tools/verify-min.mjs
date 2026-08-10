/* ============================================================================
   OKO · СВЕРКА ОБЛЕГЧЁННОГО ЯДРА С ИСХОДНЫМ

   index.html грузит media/app/app.min.js вместо app.js. Проверка одна, зато
   по существу: поднимаем приложение дважды — с исходным ядром и с
   облегчённым — и сверяем, что наружу выставлен ОДИН И ТОТ ЖЕ набор
   глобальных имён. Разметка зовёт функции прямо из onclick, слои цепляются
   друг за друга по именам; пропади хоть одно, приложение развалится молча.

   Заодно сверяем количество экранов-вкладок и отсутствие ошибок JS.

   Запуск: node oko-app/tools/verify-min.mjs
   ============================================================================ */
import { chromium } from 'playwright-core';
import { CLEAN_START } from './clean-start.mjs';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

async function снять(подменить) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(CLEAN_START);
  const p = await c.newPage();
  const ош = [];
  p.on('pageerror', e => ош.push(String(e).split('\n')[0].slice(0, 120)));
  p.on('dialog', d => d.dismiss().catch(() => {}));
  if (подменить) {
    /* Подменяем ссылку на ядро прямо в ответе, чтобы сравнить одну и ту же
       страницу с двумя вариантами app.js. */
    await p.route('**/index.html', async route => {
      const r = await route.fetch();
      let t = await r.text();
      t = t.replace('media/app/app.min.js', 'app.js').replace(/media\/app\/app\.min\.css/g, 'app.css');
      await route.fulfill({ response: r, body: t });
    });
  }
  await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3600);
  await p.evaluate('okoSkipAuth()');
  const данные = await p.evaluate(`(()=>({
    globals: Object.getOwnPropertyNames(window).filter(k=>{
      try{ return typeof window[k]==='function' && /^[a-zA-Z_$]/.test(k); }catch(e){ return false; }
    }).sort(),
    экранов: document.querySelectorAll('main > .screen').length,
    вкладок: document.querySelectorAll('nav#tabs > button').length,
    стилей: getComputedStyle(document.body).getPropertyValue('--accent').trim()
  }))()`);
  await c.close();
  return { ...данные, ошибки: [...new Set(ош)] };
}

const мин = await снять(false);
const ориг = await снять(true);
await b.close();

const нет = ориг.globals.filter(g => !мин.globals.includes(g));
const лишние = мин.globals.filter(g => !ориг.globals.includes(g));

console.log(`  глобальных функций: исходник ${ориг.globals.length}, облегчённое ${мин.globals.length}`);
console.log(`  экранов: ${ориг.экранов} / ${мин.экранов}   вкладок: ${ориг.вкладок} / ${мин.вкладок}`);
console.log(`  --accent: «${ориг.стилей}» / «${мин.стилей}»`);
if (нет.length) console.log('\n  ПРОПАЛИ в облегчённом (' + нет.length + '): ' + нет.slice(0, 25).join(', '));
if (лишние.length) console.log('\n  появились лишние (' + лишние.length + '): ' + лишние.slice(0, 25).join(', '));
if (ориг.ошибки.length) console.log('\n  ошибки JS в исходнике: ' + ориг.ошибки.join(' | '));
if (мин.ошибки.length) console.log('\n  ошибки JS в облегчённом: ' + мин.ошибки.join(' | '));

const беда = нет.length || лишние.length || мин.экранов !== ориг.экранов
  || мин.вкладок !== ориг.вкладок || мин.стилей !== ориг.стилей || мин.ошибки.length;
console.log(беда ? '\n  РАСХОЖДЕНИЕ — облегчённое ядро отдавать нельзя' : '\n  Совпадает полностью.');
process.exit(беда ? 1 : 0);
