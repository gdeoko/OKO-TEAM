/* ============================================================================
   OKO · СБОРКА ОБЛЕГЧЁННОЙ ВЕРСИИ

   Зачем. Замер показал: okoteam.top отдаёт app.js разжатым — 4,9 МБ, app.css —
   1,1 МБ. Правильное лекарство одно: включить gzip в nginx (готовый скрипт
   лежит в oko-app/deploy/enable-gzip.sh). Но пока к VPS нет доступа, вес можно
   заметно срезать прямо в исходниках — код написан с очень подробными
   комментариями, и они едут на телефон вместе с логикой.

   Что делает. Убирает комментарии и лишние пробелы, НЕ переименовывая ничего.
   Это принципиально: файлы приложения ссылаются друг на друга по именам
   глобальных функций и переменных (`typeof recStream !== 'undefined'`,
   `window.okoSocial`, chain-патчи вида `const prev = window.feedScore`).
   Любое переименование идентификаторов сломает эти связи, поэтому его здесь
   нет и быть не должно.

   Что НЕ делает. Не трогает исходники: результат кладётся рядом с суффиксом
   `.min.js` / `.min.css`. Переключение приложения на облегчённые файлы —
   отдельное осознанное действие, не побочный эффект сборки.

   Запуск:
     node oko-app/tools/build-min.mjs            — собрать и показать выигрыш
     node oko-app/tools/build-min.mjs --check    — только показать, ничего не писать
   ============================================================================ */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzip = promisify(zlib.gzip);
const DIR = 'oko-app/prototype';
const CHECK = process.argv.includes('--check');

/* --------------------------------------------------------------------------
   Удаление комментариев из JS с уважением к строкам, шаблонам и регулярным
   выражениям. Наивный поиск `//` и `/*` разрушил бы адреса вида https://,
   регулярки и содержимое шаблонных строк — а в этом коде их много.
   -------------------------------------------------------------------------- */
function stripJsComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  /* Отличить деление от начала регулярного выражения можно только по
     предыдущему значимому символу: после значения идёт деление, после
     оператора или открывающей скобки — регулярка. */
  let prevMeaningful = '';

  while (i < n) {
    const c = src[i], c2 = src[i + 1];

    /* строка в одинарных или двойных кавычках */
    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === q) break;
        j++;
      }
      out += src.slice(i, j + 1);
      prevMeaningful = q;
      i = j + 1;
      continue;
    }

    /* шаблонная строка: внутри могут быть вложенные ${ ... } с чем угодно */
    if (c === '`') {
      let j = i + 1, depth = 0;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (depth > 0 && src[j] === '}') { depth--; j++; continue; }
        if (depth === 0 && src[j] === '`') break;
        j++;
      }
      out += src.slice(i, j + 1);
      prevMeaningful = '`';
      i = j + 1;
      continue;
    }

    /* однострочный комментарий */
    if (c === '/' && c2 === '/') {
      let j = i + 2;
      while (j < n && src[j] !== '\n') j++;
      i = j;
      continue;
    }

    /* блочный комментарий */
    if (c === '/' && c2 === '*') {
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
      /* перенос строки вместо комментария: иначе склеятся соседние строки и
         сломается автоматическая расстановка точек с запятой */
      out += '\n';
      i = j + 2;
      continue;
    }

    /* регулярное выражение */
    if (c === '/' && /[=(,:[!&|?{};+\-*%~^<>\n]/.test(prevMeaningful || '\n')) {
      let j = i + 1, cls = false, ok = false;
      while (j < n) {
        const ch = src[j];
        if (ch === '\\') { j += 2; continue; }
        if (ch === '[') cls = true;
        else if (ch === ']') cls = false;
        else if (ch === '/' && !cls) { ok = true; break; }
        else if (ch === '\n') break;
        j++;
      }
      if (ok) {
        let k = j + 1;
        while (k < n && /[a-z]/.test(src[k])) k++;   /* флаги */
        out += src.slice(i, k);
        prevMeaningful = '/';
        i = k;
        continue;
      }
    }

    out += c;
    if (!/\s/.test(c)) prevMeaningful = c;
    i++;
  }
  return out;
}

/* Схлопываем отступы и пустые строки. Переносы строк сохраняем — код
   местами полагается на автоматическую расстановку точек с запятой. */
function squeezeJs(src) {
  return src
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .filter(l => l.length)
    .join('\n');
}

function minifyCss(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

const kb = n => (n / 1024).toFixed(0) + ' КБ';

const targets = [
  ...(await fs.readdir(DIR)).filter(f => /\.js$/.test(f) && !/\.min\.js$/.test(f) && f !== 'service-worker.js'),
  ...(await fs.readdir(DIR)).filter(f => /\.css$/.test(f) && !/\.min\.css$/.test(f)),
];

let было = 0, стало = 0, былоGz = 0, сталоGz = 0;
const строки = [];

for (const f of targets) {
  const p = path.join(DIR, f);
  const src = await fs.readFile(p, 'utf-8');
  const min = f.endsWith('.css') ? minifyCss(src) : squeezeJs(stripJsComments(src));

  /* Страховка: если результат подозрительно мал, значит разбор сломался —
     такой файл не пишем и говорим об этом вслух. */
  if (min.length < src.length * 0.2) {
    строки.push(`  ${f.padEnd(22)} ПРОПУЩЕН: разбор дал ${kb(min.length)} из ${kb(src.length)} — похоже на ошибку`);
    continue;
  }

  const gzA = (await gzip(src)).length;
  const gzB = (await gzip(min)).length;
  было += src.length; стало += min.length; былоGz += gzA; сталоGz += gzB;

  const out = p.replace(/\.(js|css)$/, '.min.$1');
  if (!CHECK) await fs.writeFile(out, min);
  строки.push(`  ${f.padEnd(22)} ${kb(src.length).padStart(9)} → ${kb(min.length).padStart(9)}   (gzip ${kb(gzA)} → ${kb(gzB)})`);
}

console.log(строки.join('\n'));
console.log('\nВСЕГО:');
console.log(`  без сжатия: ${kb(было)} → ${kb(стало)}  (минус ${(100 - стало / было * 100).toFixed(0)}%)`);
console.log(`  под gzip:   ${kb(былоGz)} → ${kb(сталоGz)}  (минус ${(100 - сталоGz / былоGz * 100).toFixed(0)}%)`);
console.log(CHECK ? '\n(--check: файлы не записаны)' : '\nОблегчённые файлы записаны рядом с исходниками.');
