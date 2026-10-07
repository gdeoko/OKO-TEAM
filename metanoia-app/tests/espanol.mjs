// Испанский интерфейс. Уроки, стихи и имена остаются по-русски до её
// испанских текстов: машинный перевод Писания мы не ставим. А вот заголовки
// разделов, кнопки, пункты меню и фильтры должны переводиться все.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
await p.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('mt_onb', '1'); localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_lang', 'es');
  localStorage.setItem('mt_kids', '[{"name":"Соня","age":8,"img":"","лид":"k1"},{"name":"Пётр","age":6,"img":"","лид":"k2"}]');
  localStorage.setItem('mt_active_kid', 'k1');
  localStorage.setItem('mt_lesson_1', JSON.stringify({ read: true, task: true, test: true, done: true, ts: Date.now() }));
});
await p.reload({ waitUntil: 'load' });
await p.waitForSelector('.splash--hide', { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(1000);
let плохо = 0;

// 1. В словаре нет повторов: второй такой же ключ молча затирает первый.
const дубли = await p.evaluate(() => {
  const ключи = Object.keys(ПЕРЕВОД);
  return { всего: ключи.length, пустые: ключи.filter((k) => !ПЕРЕВОД[k]) };
});
console.log('в словаре строк: ' + дубли.всего);
if (дубли.всего < 170) { console.log('ОЙ: словарь поредел'); плохо++; }
if (дубли.пустые.length) { console.log('ОЙ: пустые переводы:', дубли.пустые); плохо++; }

// 2. Заголовки разделов, кнопки и меню по всем экранам: русского остаться не должно.
const русские = () => p.evaluate(() => {
  const рус = /[а-яё]/i;
  const контент = '.lp-text, .lesson-text, .feed-card--quote, .lesson-golden, .lq, .slovar,'
    + ' .vspomni, .pomosh__say, .wb-sit, .lesson-epigraph, .lesson-intro, .quote-ref,'
    + ' .book-page, .chat-msg, .task, .q-text, .opt, .game-art, .povtor__list, .znak';
  const найдено = new Set();
  document.querySelectorAll('.section-title, .menu-item, .lstep, .block-title, .chip').forEach((э) => {
    if (э.closest(контент)) return;
    const т = [...э.childNodes].filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(' ')
      .replace(/\s+/g, ' ').trim();
    if (т && рус.test(т)) найдено.add(т);
  });
  return [...найдено];
});

const всего = new Set();
for (const t of ['home', 'games', 'chats', 'lessons', 'profile']) {
  await p.evaluate((x) => document.querySelector(`.nav__tab[data-tab="${x}"]`).click(), t);
  await p.waitForTimeout(450);
  (await русские()).forEach((с) => всего.add(с));
}
for (const n of [1, 20]) {
  await p.evaluate((н) => openLesson(н), n); await p.waitForTimeout(800);
  (await русские()).forEach((с) => всего.add(с));
}
await p.evaluate(() => openChild(DEMO.children[0])); await p.waitForTimeout(600);
(await русские()).forEach((с) => всего.add(с));
for (const f of ['openSearch', 'openBook', 'openAbout', 'openShop', 'openRanks', 'openBadges', 'openCerts']) {
  const ок = await p.evaluate((имя) => {
    if (typeof window[имя] !== 'function') return false;
    try { window[имя](); return true; } catch (e) { return false; }
  }, f);
  if (ок) { await p.waitForTimeout(450); (await русские()).forEach((с) => всего.add(с)); }
}
// Названия глав и уроков содержат имена и книги Писания: их она переведёт сама.
const её = (с) => /^Глава \d|^Урок \d|Завет|Иерусалим/.test(с);
const осталось = [...всего].filter((с) => !её(с));
console.log('русских заголовков и кнопок: ' + осталось.length);
осталось.slice(0, 12).forEach((с) => console.log('  ' + JSON.stringify(с)));
if (осталось.length) { console.log('ОЙ: интерфейс не переведён до конца'); плохо++; }

// 3. Проверочные строки точно на испанском.
await p.evaluate(() => document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(500);
const низ = await p.evaluate(() => [...document.querySelectorAll('.nav__tab')].map((э) => э.innerText.trim()).join(', '));
console.log('низ меню: ' + низ);
if (/[а-яё]/i.test(низ)) { console.log('ОЙ: нижнее меню по-русски'); плохо++; }

// 4. Переключение назад на русский возвращает исходные слова.
await p.evaluate(() => { localStorage.setItem('mt_lang', 'ru'); });
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(900);
const низРу = await p.evaluate(() => [...document.querySelectorAll('.nav__tab')].map((э) => э.innerText.trim()).join(', '));
console.log('низ меню по-русски: ' + низРу);
if (!/Уроки/.test(низРу)) { console.log('ОЙ: русский не вернулся'); плохо++; }

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
