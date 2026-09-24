// Картинки внутри игр: у каждой игры есть иллюстрация, и она по теме хода.
//
// Её замечание: «в играх просто серо и тексты», «добавьте картинки прям
// внутрь игр, во все игры». Проверяем каждую игру из списка.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('mt_onb', '1');
  localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_music_off', '1');
  localStorage.setItem('mt_kids', JSON.stringify([{ лид: 1, name: 'Милана', age: 8, img: 'assets/img/avatars/star.jpg' }]));
  localStorage.setItem('mt_active_kid', '1');
});
await p.reload({ waitUntil: 'load' });
await p.waitForSelector('.splash--hide', { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(1000);
let плохо = 0;

const ключи = await p.evaluate(() => GAMES.map((g) => g.key));
console.log('игр в списке: ' + ключи.length);

for (const к of ключи) {
  await p.evaluate((к) => openGame(к), к);
  await p.waitForTimeout(900);
  const итог = await p.evaluate(() => {
    const экран = document.querySelector('.screen--active');
    const арт = экран && экран.querySelector('.game-art');
    const кадр = арт && арт.querySelector('img');
    return {
      экран: экран ? экран.dataset.screen : 'нет',
      есть: !!арт && !арт.hidden,
      живая: !!(кадр && kadrOk(кадр)),
      адрес: кадр ? кадр.getAttribute('src') : '',
    };
    function kadrOk(и) { return и.complete && и.naturalWidth > 0; }
  });
  console.log('%-12s %s', к, JSON.stringify(итог));
  if (!итог.есть) { console.log('ОЙ: в игре «' + к + '» нет картинки'); плохо++; }
  if (!итог.живая) { console.log('ОЙ: в игре «' + к + '» картинка не загрузилась'); плохо++; }
}

// Картинка идёт за темой хода, а не стоит одна и та же на всю игру.
const поТеме = await p.evaluate(async () => {
  const ж = (м) => new Promise((r) => setTimeout(r, м));
  const взять = () => {
    const и = document.querySelector('.screen--active .game-art img');
    return и ? и.getAttribute('src') : '';
  };
  openGame('quiz'); await ж(700);
  const первый = взять();
  // Отвечаем как попало: важно, что ход сменился.
  document.querySelector('#quizOpts .qopt')?.click();
  await ж(1800);
  return { первый, второй: взять() };
});
console.log('викторина по ходам:', JSON.stringify(поТеме));
if (!поТеме.первый) { console.log('ОЙ: в викторине нет картинки'); плохо++; }

// Тема считается по тексту: слово «ковчег» приводит к голубю, а не к лампе.
const подбор = await p.evaluate(() => ({
  ковчег: символКартинка('Кто построил ковчег, чтобы спастись от потопа?'),
  храм: символКартинка('Где Соломон построил храм?'),
  пусто: символКартинка('совершенно нейтральная строка'),
  ноябрь: символКартинка('Это было в ноябре, поздней осенью'),
}));
console.log('подбор по словам:', JSON.stringify(подбор));
if (!/dove/.test(подбор.ковчег)) { console.log('ОЙ: ковчег не нашёл голубя'); плохо++; }
if (!/church/.test(подбор.храм)) { console.log('ОЙ: храм не нашёлся'); плохо++; }
if (подбор.пусто !== '') { console.log('ОЙ: нейтральной строке подобрали картинку'); плохо++; }
if (подбор.ноябрь !== '') { console.log('ОЙ: «ноябре» принято за Ноя'); плохо++; }

// Окно стиха дня не остаётся висеть над следующей игрой.
const окно = await p.evaluate(async () => {
  const ж = (м) => new Promise((r) => setTimeout(r, м));
  openGame('dailyverse'); await ж(600);
  const открыто = !document.getElementById('dailyVerse').hidden;
  openGame('quiz'); await ж(600);
  return { открыто, осталось: !document.getElementById('dailyVerse').hidden };
});
console.log('стих дня:', JSON.stringify(окно));
if (!окно.открыто) { console.log('ОЙ: стих дня не открылся'); плохо++; }
if (окно.осталось) { console.log('ОЙ: окно стиха осталось поверх игры'); плохо++; }

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
