// Вкладки поиска и история запросов работают по-настоящему.
//
// Ловили на этом: три вкладки «Рекомендуем / Популярное / Новое» нажимались,
// но список от этого не менялся ни на строку. Теперь вкладки считают по
// настоящему прогрессу ребёнка, а история помнит, что он искал.
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
  // Ребёнок прошёл три урока и один раз доиграл мемори.
  for (let n = 1; n <= 3; n++) {
    localStorage.setItem('mt_lesson_' + n,
      JSON.stringify({ read: true, task: true, test: true, done: true, ts: Date.now() }));
  }
  localStorage.setItem('mt_lvl_memory', '2');
});
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1200);
let плохо = 0;

const вкладка = async (имя) => {
  await p.evaluate((и) => {
    const э = document.querySelector(`.tab-chip[data-srtab="${и}"]`);
    э.click();
  }, имя);
  await p.waitForTimeout(400);
  return p.evaluate(() => [...document.querySelectorAll('#searchResults .sr__title')]
    .map((x) => x.textContent.trim()));
};

await p.evaluate(() => switchTab('search'));
await p.waitForTimeout(400);

const пройдено = await вкладка('done');
console.log('пройдено (%d): %s', пройдено.length, пройдено.slice(0, 6).join(' | '));
if (пройдено.length !== 4) { console.log('ОЙ: должно быть три урока и одна игра'); плохо++; }
if (!пройдено.includes('Библейское мемори')) { console.log('ОЙ: сыгранной игры нет'); плохо++; }
if (пройдено.some((т) => т.includes('Поклонение') || т.includes('волхвов'))) {
  console.log('ОЙ: непройденный урок попал в «Пройдено»'); плохо++;
}

const дальше = await вкладка('next');
console.log('что дальше (%d): %s', дальше.length, дальше.slice(0, 5).join(' | '));
if (!дальше.length) { console.log('ОЙ: «Что дальше» пусто'); плохо++; }
if (дальше.includes('Библейское мемори')) { console.log('ОЙ: сыгранная игра в «Что дальше»'); плохо++; }
for (const т of пройдено) {
  if (дальше.includes(т)) { console.log('ОЙ: пройденное попало в «Что дальше»: ' + т); плохо++; break; }
}
// Проверки по главам, до которых ребёнок не дошёл, — не «ближайшее дело».
const чужиеПроверки = дальше.filter((т) => т.includes('Проверка знаний')
  && !т.includes('Жизнь Господа'));
if (чужиеПроверки.length) {
  console.log('ОЙ: проверки недоступных глав в «Что дальше»:', чужиеПроверки); плохо++;
}

const всё = await вкладка('all');
console.log('всё:', всё.length);
if (всё.length !== 0) { console.log('ОЙ: «Всё» без запроса должно молчать'); плохо++; }

// Вкладки действительно дают разные списки, а не один и тот же.
if (JSON.stringify(пройдено) === JSON.stringify(дальше)) {
  console.log('ОЙ: вкладки показывают одно и то же'); плохо++;
}

// История запросов: помнит, подставляет, чистится.
await p.evaluate(() => {
  const и = document.getElementById('searchInput');
  и.value = 'ковчег';
  и.dispatchEvent(new Event('change'));
  и.value = '';
  и.dispatchEvent(new Event('input'));
});
await p.waitForTimeout(500);
const история = await p.evaluate(() => ({
  видна: !document.getElementById('searchHist').hidden,
  запросы: [...document.querySelectorAll('.search-hist__q')].map((x) => x.textContent),
}));
console.log('история:', JSON.stringify(история));
if (!история.видна || !история.запросы.includes('ковчег')) {
  console.log('ОЙ: запрос не запомнился'); плохо++;
}

await p.click('.search-hist__q');
await p.waitForTimeout(500);
const подставилось = await p.evaluate(() => document.getElementById('searchInput').value);
if (подставилось !== 'ковчег') { console.log('ОЙ: запрос не подставился'); плохо++; }

await p.evaluate(() => {
  const и = document.getElementById('searchInput');
  и.value = '';
  и.dispatchEvent(new Event('input'));
});
await p.waitForTimeout(500);
await p.click('.search-hist__clr');
await p.waitForTimeout(300);
const послеЧистки = await p.evaluate(() => document.getElementById('searchHist').hidden);
if (!послеЧистки) { console.log('ОЙ: история не очистилась'); плохо++; }

// История не растёт бесконечно: её предел десять запросов.
await p.evaluate(() => {
  const и = document.getElementById('searchInput');
  for (let k = 1; k <= 14; k++) {
    и.value = 'запрос' + k;
    и.dispatchEvent(new Event('change'));
  }
  и.value = '';
  и.dispatchEvent(new Event('input'));
});
await p.waitForTimeout(500);
const сколько = await p.evaluate(() => document.querySelectorAll('.search-hist__q').length);
console.log('в истории после четырнадцати запросов:', сколько);
if (сколько !== 10) { console.log('ОЙ: история не держит предел в десять'); плохо++; }

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
