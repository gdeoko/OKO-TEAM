/* ============================================================================
   ЧЕСТНАЯ ПРОВЕРКА ПРОДА

   Зачем. nginx на okoteam.top отдаёт index.html на любой неизвестный путь —
   это SPA-фолбэк. Статус при этом 200. Поэтому обычная проверка «curl вернул
   200, значит файл на месте» ВРЁТ: 09.08 так незаметно прошло то, что весь
   слой полировки (24 файла) на прод не приезжал никогда, а приложение
   работало на одном ядре.

   Как проверять правильно: смотреть Content-Type и размер. Если у `.js`
   приходит `text/html` и размер совпадает с index.html — файла нет.

   Что делает скрипт: берёт список того, что index.html реально просит
   (script src и link href), плюс ядро и иконки, и стучится по каждому
   адресу на проде. Печатает таблицу и в конце — сколько файлов подменено
   фолбэком, сколько едет без сжатия и общий вес первой загрузки.

   Запуск:
     node oko-app/tools/probe-prod.mjs
     node oko-app/tools/probe-prod.mjs https://okoteam.top
   ============================================================================ */
import fs from 'node:fs/promises';

const БАЗА = (process.argv[2] || 'https://okoteam.top').replace(/\/$/, '');
const kb = n => (n / 1024).toFixed(0) + ' КБ';

/* --- что просит сам index.html --- */
const html = await fs.readFile('oko-app/prototype/index.html', 'utf-8');
const пути = new Set(['app.js', 'app.css', 'service-worker.js', 'oko-manifest.json', 'oko-eye.glb']);
for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) пути.add(m[1]);
for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)) пути.add(m[1]);
for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) пути.add(m[1]);

/* importmap: через него грузится Three.js для 3D-знака. Его адреса не
   видны ни в script src, ни в link href — именно поэтому пропажа vendor/
   с прода не всплывала до проверки зеркала. */
for (const m of html.matchAll(/<script[^>]*type="importmap"[^>]*>([\s\S]*?)<\/script>/g)) {
  try {
    const imports = JSON.parse(m[1]).imports || {};
    for (const v of Object.values(imports)) {
      /* «three/addons/» → папка: проверяем файл, который точно оттуда берут */
      пути.add(String(v).endsWith('/') ? v + 'loaders/GLTFLoader.js' : v);
    }
  } catch (e) { console.log('  (importmap не разобрался — проверь вручную)'); }
}

/* пути в коде слоёв, которые грузятся во время работы */
for (const доп of ['oko-eye.glb', 'media/paywall/start.webp', 'media/cert/seal.png']) пути.add(доп);

/* внешние адреса не наши — не проверяем */
const список = [...пути].filter(p => !/^https?:|^\/\//.test(p)).sort();

/* размер index.html: с ним сравниваем, чтобы поймать подмену фолбэком */
const корень = await fetch(БАЗА + '/', { redirect: 'follow' }).catch(() => null);
const индексРазмер = корень ? (await корень.arrayBuffer()).byteLength : 0;

const строки = [];
let подменено = 0, безСжатия = 0, вес = 0, ошибок = 0;

for (const путь of список) {
  const url = БАЗА + '/' + путь.replace(/^\//, '');
  let r;
  try { r = await fetch(url, { headers: { 'Accept-Encoding': 'gzip, br' } }); }
  catch (e) { строки.push(`  ✗ ${путь.padEnd(30)} не ответил: ${String(e).slice(0, 40)}`); ошибок++; continue; }

  const тип  = (r.headers.get('content-type') || '').split(';')[0];
  const сжат = r.headers.get('content-encoding') || '';
  const тело = (await r.arrayBuffer()).byteLength;

  /* Подмена фолбэком: просили скрипт или стиль, а пришёл HTML. */
  const ждёмJs  = /\.(js|mjs)$/.test(путь);
  const ждёмCss = /\.css$/.test(путь);
  const фолбэк  = (ждёмJs || ждёмCss) && тип === 'text/html';

  if (фолбэк) {
    подменено++;
    строки.push(`  ✗ ${путь.padEnd(30)} ФАЙЛА НЕТ — пришёл index.html (${kb(тело)})`);
    continue;
  }
  if (r.status !== 200) { ошибок++; строки.push(`  ✗ ${путь.padEnd(30)} статус ${r.status}`); continue; }

  вес += тело;
  const крупный = тело > 100 * 1024;
  if (!сжат && крупный && /\.(js|css|json|svg|html)$/.test(путь)) безСжатия++;
  строки.push(`  ✓ ${путь.padEnd(30)} ${тип.padEnd(26)} ${kb(тело).padStart(9)}${сжат ? '  ' + сжат : (крупный ? '  БЕЗ СЖАТИЯ' : '')}`);
}

console.log(`ПРОД: ${БАЗА}   (index.html = ${kb(индексРазмер)})\n`);
console.log(строки.join('\n'));
console.log('\nИТОГО:');
console.log(`  проверено файлов:      ${список.length}`);
console.log(`  подменено фолбэком:    ${подменено}${подменено ? '   ← этих файлов на сервере НЕТ' : ''}`);
console.log(`  не ответили / не 200:  ${ошибок}`);
console.log(`  едут без сжатия:       ${безСжатия}`);
console.log(`  вес первой загрузки:   ${kb(вес)}`);
process.exit(подменено || ошибок ? 1 : 0);
