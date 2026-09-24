// Стикеры: все тридцать — настоящие картинки, ставятся и остаются в переписке.
//
// Она присылала снимок, где вместо стикеров стояли серые значки битых
// картинок с подписями pray, heart, sun. Эта проверка ловит такое обратно.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const нехватка = [];
p.on('response', (r) => { if (r.url().includes('/stickers/') && r.status() >= 400) нехватка.push(r.url()); });
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mt_onb', '1');
  localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_kids', JSON.stringify([{ лид: 1, name: 'Милана', age: 8, img: 'assets/img/avatars/star.jpg' }]));
  localStorage.setItem('mt_active_kid', '1');
});
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1200);
let плохо = 0;

// Открываем чат учеников и панель стикеров.
await p.click('.nav__tab[data-tab="chats"]');
await p.waitForTimeout(500);
await p.click('.chat-item >> nth=1');
await p.waitForTimeout(700);
await p.click('#cvStickerBtn');
await p.waitForTimeout(900);

const панель = await p.evaluate(() => {
  const кнопки = [...document.querySelectorAll('#cvStickers [data-sticker]')];
  return {
    всего: кнопки.length,
    безКартинки: кнопки.filter((к) => к.classList.contains('stk--noimg')).length,
    битых: кнопки.filter((к) => {
      const и = к.querySelector('img');
      return и && и.complete && и.naturalWidth === 0;
    }).length,
    названия: кнопки.map((к) => к.getAttribute('title')).filter(Boolean).length,
  };
});
console.log('панель стикеров:', JSON.stringify(панель));
if (панель.всего !== 30) { console.log('ОЙ: стикеров не тридцать'); плохо++; }
if (панель.безКартинки || панель.битых) { console.log('ОЙ: есть битые стикеры'); плохо++; }
if (панель.названия !== панель.всего) { console.log('ОЙ: у стикера нет названия'); плохо++; }

// Ставим стикер и проверяем, что он появился в переписке настоящей картинкой.
await p.click('#cvStickers [data-sticker]');
await p.waitForTimeout(700);
const вЧате = await p.evaluate(() => {
  const и = [...document.querySelectorAll('#cvMsgs img')].filter((x) => x.src.includes('/stickers/'));
  const последний = и[и.length - 1];
  return { сколько: и.length, шириной: последний ? последний.naturalWidth : 0 };
});
console.log('стикер в переписке:', JSON.stringify(вЧате));
if (!вЧате.сколько) { console.log('ОЙ: стикер не отправился'); плохо++; }
if (вЧате.шириной === 0) { console.log('ОЙ: стикер в переписке битый'); плохо++; }

// После перезагрузки стикер остаётся: она жаловалась, что «не работает».
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1200);
await p.click('.nav__tab[data-tab="chats"]');
await p.waitForTimeout(500);
await p.click('.chat-item >> nth=1');
await p.waitForTimeout(800);
const после = await p.evaluate(() =>
  [...document.querySelectorAll('#cvMsgs img')].filter((x) => x.src.includes('/stickers/')).length);
console.log('стикеров после перезагрузки:', после);
if (!после) { console.log('ОЙ: стикер не сохранился'); плохо++; }

if (нехватка.length) { console.log('ОЙ: не отдались файлы:', нехватка.slice(0, 5)); плохо++; }
if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
