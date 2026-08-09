/* ============================================================================
   OKO · СИНХРОНИЗАЦИЯ С КАНАЛОМ ДОСТАВКИ

   Зачем это вообще нужно. Cron на VPS (`/root/oko-deploy.sh`, каждые 3 минуты)
   копирует в `/var/www/okoteam` НЕ всю папку `oko-app/prototype`, а короткий
   список — `index.html`, `app.js`, `app.css` — плюс всё содержимое
   `oko-app/site/*`. Проверено по факту 09.08: на проде лежат ровно те файлы,
   что есть в `site/` (иконки, манифест, service-worker), а любой `oko-*.js`
   отдаётся как index.html — это SPA-фолбэк nginx на 404.

   Что это значило. Весь слой полировки — 24 файла `oko-*.js`, `oko-v2.css`,
   спрайт иконок — на okoteam.top не приезжал никогда. Запись голосовых,
   клипы, соцслой, чаты, кошелёк, настройки, звонки, доступность: всё это
   работало локально и было невидимо на проде. Туда же уехали картинки
   пейволла: после выноса из base64 код зовёт `media/paywall/start.webp`,
   а файла на сервере нет.

   Что делает этот скрипт. Кладёт недостающие файлы в `oko-app/site/` —
   единственную папку, которую cron забирает целиком. Копии настоящие, не
   ссылки: `cp -r` на стороне VPS перенёс бы симлинк как симлинк и получил
   бы битый файл.

   Запуск (перед каждым коммитом, который меняет слои):
     node oko-app/tools/sync-deploy.mjs
     node oko-app/tools/sync-deploy.mjs --check   — только показать расхождения
   ============================================================================ */
import fs from 'node:fs/promises';
import path from 'node:path';

const SRC   = 'oko-app/prototype';
const DST   = 'oko-app/site';
const CHECK = process.argv.includes('--check');

/* Что синхронизируем. app.js / app.css / index.html здесь НЕТ намеренно:
   их cron копирует отдельно и они на проде совпадают байт в байт. */
const ФАЙЛЫ = [
  /\.js$/,      /* oko-*.js — все слои полировки + service-worker.js */
  /\.css$/,     /* oko-v2.css и прочие слои стилей */
  /\.svg$/,     /* oko-icons.svg — исходник спрайта */
];
const ПАПКИ = ['media'];               /* media/paywall, media/cert */
const НЕ_БРАТЬ = new Set(['app.js', 'app.css']);   /* едут своим путём */
const НЕ_БРАТЬ_RX = [/\.min\.(js|css)$/];          /* сборка build-min.mjs */

const kb = n => (n / 1024).toFixed(0) + ' КБ';

async function файлы(dir, base = '') {
  const out = [];
  let entries;
  try { entries = await fs.readdir(path.join(dir, base), { withFileTypes: true }); }
  catch (e) { return out; }
  for (const e of entries) {
    const rel = base ? path.join(base, e.name) : e.name;
    if (e.isDirectory()) out.push(...await файлы(dir, rel));
    else out.push(rel);
  }
  return out;
}

/* --- собираем список к копированию --- */
const кандидаты = [];

for (const f of await файлы(SRC)) {
  if (f.includes(path.sep)) continue;                       /* только верхний уровень */
  if (НЕ_БРАТЬ.has(f)) continue;
  if (НЕ_БРАТЬ_RX.some(rx => rx.test(f))) continue;
  if (!ФАЙЛЫ.some(rx => rx.test(f))) continue;
  кандидаты.push(f);
}
for (const папка of ПАПКИ) {
  for (const f of await файлы(path.join(SRC, папка))) кандидаты.push(path.join(папка, f));
}

/* --- сравниваем и копируем --- */
let новых = 0, обновлено = 0, совпало = 0, байт = 0;
const строки = [];

for (const rel of кандидаты.sort()) {
  const src = path.join(SRC, rel);
  const dst = path.join(DST, rel);
  const данные = await fs.readFile(src);
  let было = null;
  try { было = await fs.readFile(dst); } catch (e) {}

  if (было && было.equals(данные)) { совпало++; continue; }

  const метка = было ? 'обновлён' : 'НОВЫЙ   ';
  if (было) обновлено++; else новых++;
  байт += данные.length;
  строки.push(`  ${метка} ${rel.padEnd(24)} ${kb(данные.length).padStart(9)}`);

  if (!CHECK) {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.writeFile(dst, данные);
  }
}

console.log(строки.length ? строки.join('\n') : '  (расхождений нет)');
console.log(`\nИТОГО: новых ${новых}, обновлено ${обновлено}, уже совпадало ${совпало}, объём ${kb(байт)}`);
console.log(CHECK
  ? '\n(--check: ничего не записано)'
  : `\nФайлы разложены в ${DST}/ — cron заберёт их на okoteam.top в ближайшие 3 минуты.`);
