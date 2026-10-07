// Память от старых версий приложения не должна валить экраны.
// На этом уже обожглись: список игр давно стал плоским, а код всё перечислял
// полки free/premium/daily, и пожелание игры из старой версии роняло профиль.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
// Непрогрузку внешних файлов не считаем: скрипт Телеграма мы сами и глушим.
p.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('КОНСОЛЬ: ' + m.text());
});
await p.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
let плохо = 0;

await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mt_onb', '1'); localStorage.setItem('mt_auth', '1');
  // Ребёнок старого образца: без лида, с возрастом строкой, с полем rank.
  localStorage.setItem('mt_kids', JSON.stringify([{ name: 'Соня', age: '8', rank: 'Росточек', streak: 4, img: '' }]));
  // Пожелания игр и подарков от версии, где игры лежали по полкам.
  localStorage.setItem('mt_wishes', JSON.stringify(['temple', 'quiz', 'ковчег']));
  localStorage.setItem('mt_merch', JSON.stringify([{ name: 'Кружка Метанойи', price: 1500 }]));
  // Прогресс в снятом формате и по несуществующему уроку.
  localStorage.setItem('mt_lesson_1', JSON.stringify({ read: true, task: true, test: true, done: true }));
  localStorage.setItem('mt_lesson_999', JSON.stringify({ read: true, done: true }));
  localStorage.setItem('mt_game_levels', JSON.stringify({ quiz: 3 }));
  localStorage.setItem('mt_points', '340');
  localStorage.setItem('mt_comments', '{"0":[{"name":"Мария","text":"Спасибо","time":"вчера"}]}');
});
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1300);

const экраны = [
  ['профиль', () => document.querySelector('.nav__tab[data-tab="profile"]').click()],
  ['ребёнок', () => openChild(DEMO.children[0])],
  ['главная', () => document.querySelector('.nav__tab[data-tab="home"]').click()],
  ['уроки', () => document.querySelector('.nav__tab[data-tab="lessons"]').click()],
  ['игры', () => document.querySelector('.nav__tab[data-tab="games"]').click()],
  ['урок', () => openLesson(1)],
  ['магазин', () => openShop()],
];
for (const [имя, шаг] of экраны) {
  const ок = await p.evaluate((исх) => {
    try { eval('(' + исх + ')()'); return true; } catch (e) { return String(e.message || e); }
  }, шаг.toString());
  await p.waitForTimeout(500);
  const пусто = await p.evaluate(() => {
    const э = document.querySelector('.screen--active');
    return !э || (э.innerText || '').trim().length < 12;
  });
  if (ок !== true) { console.log('ОЙ: ' + имя + ' не открылся: ' + ок); плохо++; }
  else if (пусто) { console.log('ОЙ: ' + имя + ' пуст'); плохо++; }
  else console.log(имя + ' ok');
}

// Карточка ребёнка не показывает «undefined лет» и не берёт ранг из старой записи.
const карточка = await p.evaluate(() => ({
  имя: (document.getElementById('childName') || {}).textContent || '',
  ранг: (document.getElementById('childRank') || {}).textContent || '',
}));
console.log('карточка ребёнка:', JSON.stringify(карточка));
if (/undefined|NaN/.test(карточка.имя + карточка.ранг)) { console.log('ОЙ: в карточке мусор'); плохо++; }

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 4)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
