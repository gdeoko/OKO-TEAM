// Числа в текстах приложения — настоящие, а не написанные руками когда-то.
// Ловили на этом: обещали 19 игр, а их 17. Сверяем обещание со списком.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
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

const правда = await p.evaluate(() => ({
  игр: (typeof GAMES !== 'undefined' ? GAMES : []).length,
  уроков: Object.keys(window.LESSONS || {}).length,
  вОглавлении: (typeof DEMO !== 'undefined' ? DEMO.blocks : [])
    .reduce((s, b) => s + b.lessons.filter((l) => !l.exam).length, 0),
  глав: (typeof DEMO !== 'undefined' ? DEMO.blocks : []).length,
  рангов: (typeof RANKS !== 'undefined' ? RANKS : []).length,
  стикеров: (typeof STICKERS !== 'undefined' ? STICKERS : []).length,
}));
console.log('по спискам:', JSON.stringify(правда));

if (правда.уроков !== 105) { console.log('ОЙ: уроков не 105'); плохо++; }
if (правда.вОглавлении !== правда.уроков) { console.log('ОЙ: оглавление разошлось с содержанием'); плохо++; }
if (правда.глав !== 3) { console.log('ОЙ: глав не три'); плохо++; }
if (правда.стикеров < 30) { console.log('ОЙ: стикеров меньше тридцати, она просила тридцать'); плохо++; }

// Открываем «О школе» и сверяем каждое число в тексте со списками.
await p.evaluate(() => (typeof openAbout === 'function' ? openAbout() : switchTab('profile')));
await p.waitForTimeout(600);
const текст = await p.evaluate(() => {
  const э = document.querySelector('[data-screen="about"]');
  return э ? (э.innerText || '').replace(/\s+/g, ' ') : '';
});
console.log('о школе:', текст.slice(0, 260));

const проверки = [
  { что: 'уроков', re: /(\d+)\s+уроков/, ждём: правда.уроков },
  { что: 'игр', re: /(\d+)\s+доб[а-я]+\s+игр/, ждём: правда.игр },
];
for (const пр of проверки) {
  const м = текст.match(пр.re);
  if (!м) { console.log('ОЙ: в «О школе» нет числа: ' + пр.что); плохо++; continue; }
  if (Number(м[1]) !== пр.ждём) {
    console.log(`ОЙ: обещано ${м[1]} ${пр.что}, а на деле ${пр.ждём}`); плохо++;
  }
}

// Храма, который она просила убрать, в обещаниях школы тоже быть не должно.
if (/храм/i.test(текст)) { console.log('ОЙ: «О школе» всё ещё обещает храм'); плохо++; }

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
