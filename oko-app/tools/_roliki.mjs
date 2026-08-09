/* Где слово «ролик» реально видит человек, а где оно только в комментарии.
   Комментарии режем тем же разборщиком, что и сборка облегчённой версии:
   наивный поиск сломался бы об адреса, регулярки и шаблонные строки. */
import fs from 'node:fs/promises';
import path from 'node:path';

function stripJsComments(src) {
  let out = '', i = 0; const n = src.length; let prev = '';
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1;
      while (j < n) { if (src[j] === '\\') { j += 2; continue; } if (src[j] === q) break; j++; }
      out += src.slice(i, j + 1); prev = q; i = j + 1; continue;
    }
    if (c === '`') {
      let j = i + 1, d = 0;
      while (j < n) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') { d++; j += 2; continue; }
        if (d > 0 && src[j] === '}') { d--; j++; continue; }
        if (d === 0 && src[j] === '`') break;
        j++;
      }
      out += src.slice(i, j + 1); prev = '`'; i = j + 1; continue;
    }
    if (c === '/' && c2 === '/') { let j = i + 2; while (j < n && src[j] !== '\n') j++; out += '\n'; i = j; continue; }
    if (c === '/' && c2 === '*') { let j = i + 2; while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++; out += '\n'; i = j + 2; continue; }
    if (c === '/' && /[=(,:[!&|?{};+\-*%~^<>\n]/.test(prev || '\n')) {
      let j = i + 1, cls = false, ok = false;
      while (j < n) {
        const ch = src[j];
        if (ch === '\\') { j += 2; continue; }
        if (ch === '[') cls = true; else if (ch === ']') cls = false;
        else if (ch === '/' && !cls) { ok = true; break; }
        else if (ch === '\n') break;
        j++;
      }
      if (ok) { let k = j + 1; while (k < n && /[a-z]/.test(src[k])) k++; out += src.slice(i, k); prev = '/'; i = k; continue; }
    }
    out += c; if (!/\s/.test(c)) prev = c; i++;
  }
  return out;
}

const РОЛИК = /(?<![А-Яа-яЁёA-Za-z])[Рр]олик[а-яё]*/g;
const DIR = 'oko-app/prototype';
const файлы = ['index.html', 'app.js',
  ...(await fs.readdir(path.join(DIR, 'media/app'))).filter(f => /\.js$/.test(f)).map(f => 'media/app/' + f)];

let всего = 0;
for (const rel of файлы) {
  const src = await fs.readFile(path.join(DIR, rel), 'utf-8');
  /* В .html комментарии — <!-- -->, в .js — разборщиком выше. */
  const чистый = rel.endsWith('.html')
    ? src.replace(/<!--[\s\S]*?-->/g, '\n').replace(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g, (m, js) => stripJsComments(js))
    : stripJsComments(src);
  const найдено = чистый.match(РОЛИК);
  if (!найдено) continue;
  всего += найдено.length;
  /* показываем по одному примеру каждой формы слова с окружением */
  const примеры = new Map();
  for (const m of чистый.matchAll(/.{0,42}(?<![А-Яа-яЁёA-Za-z])[Рр]олик[а-яё]*.{0,26}/g)) {
    const слово = m[0].match(РОЛИК)[0];
    if (!примеры.has(слово)) примеры.set(слово, m[0].replace(/\s+/g, ' ').trim());
  }
  console.log(`\n${rel} — ${найдено.length}`);
  for (const [сл, ctx] of [...примеры].slice(0, 6)) console.log(`   ${сл.padEnd(12)} … ${ctx}`);
}
console.log(`\nВСЕГО вне комментариев: ${всего}`);
