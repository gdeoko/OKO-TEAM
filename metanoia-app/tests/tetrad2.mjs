// Финал тетради 1 и её кроссворд в уроке 1: открываются, заполняются, держатся.
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
const ж = (м) => p.waitForTimeout(м);

// 1. Кроссворд Екатерины в уроке 1: четыре подсказки, вписываем ответы.
const кроссворд = await p.evaluate(async () => {
  const ж = (м) => new Promise((r) => setTimeout(r, м));
  openLesson(1); await ж(800);
  const поля = [...document.querySelectorAll('[data-word-in]')];
  const вопросы = [...document.querySelectorAll('.tword__q')].map((э) => э.textContent.trim());
  return { полей: поля.length, вопросы, длины: поля.map((п) => п.placeholder.length) };
});
console.log('кроссворд:', JSON.stringify(кроссворд));
if (кроссворд.полей !== 4) { console.log('ОЙ: подсказок не четыре'); плохо++; }
if (!кроссворд.вопросы.join(' ').includes('говорящий от имени Господа')) {
  console.log('ОЙ: первой подсказки нет'); плохо++;
}

// Вписываем её ответы, в том числе в другом регистре и с «е» вместо «ё».
for (const [i, слово] of [['0', 'пророк'], ['1', 'Исаия'], ['2', 'СВЕТ'], ['3', 'писание']]) {
  await p.fill(`[data-word-in="${i}"]`, слово);
  await ж(80);
}
const сошлось = await p.evaluate(() => ({
  зелёных: document.querySelectorAll('.tword--ok').length,
  итог: (document.querySelector('.task--words .task__res') || {}).textContent || '',
}));
console.log('после ввода:', JSON.stringify(сошлось));
if (сошлось.зелёных !== 4) { console.log('ОЙ: не все слова зачтены'); плохо++; }
if (!сошлось.итог.includes('Все слова')) { console.log('ОЙ: задание не засчитано'); плохо++; }

// 2. Подзаголовок и стих урока 1 — из её тетради, а не девиз главы.
const шапка = await p.evaluate(() => {
  // Экраны из DOM не удаляются, поэтому ищем строго внутри экрана урока.
  const экран = document.querySelector('[data-screen="lesson"]');
  const взять = (сел) => (экран.querySelector(сел) || {}).textContent || '';
  return {
    эпиграф: взять('.lesson-epigraph'),
    стих: взять('.feed-card--quote .feed-card__title'),
    ссылка: взять('.feed-card--quote .quote-ref'),
  };
});
console.log('шапка урока 1:', JSON.stringify(шапка));
if (!шапка.эпиграф.includes('Обещание великого Света')) { console.log('ОЙ: нет подзаголовка'); плохо++; }
if (!шапка.стих.includes('ходящий во тьме')) { console.log('ОЙ: не её стих'); плохо++; }
if (!шапка.ссылка.includes('Исаия 9:2')) { console.log('ОЙ: не та ссылка'); плохо++; }

// 3. Финал тетради: пока урок 4 не пройден — его нет.
const доФинала = await p.evaluate(async () => {
  const ж = (м) => new Promise((r) => setTimeout(r, м));
  openLesson(4); await ж(700);
  return document.querySelectorAll('#tetradFinal .tf').length;
});
if (доФинала !== 0) { console.log('ОЙ: финал показан до конца урока 4'); плохо++; }

// 4. Проходим уроки 1-4 целиком и смотрим финал.
await p.evaluate(() => {
  for (let n = 1; n <= 4; n++) {
    localStorage.setItem('mt_lesson_' + n,
      JSON.stringify({ read: true, task: true, test: true, done: true, ts: Date.now() }));
  }
});
const финал = await p.evaluate(async () => {
  const ж = (м) => new Promise((r) => setTimeout(r, м));
  openLesson(4); await ж(800);
  return {
    есть: !!document.querySelector('#tetradFinal .tf'),
    фонарей: document.querySelectorAll('.tf-lamp').length,
    метки: [...document.querySelectorAll('.tf-lamp__mark')].map((э) => э.textContent.trim()),
    полей: document.querySelectorAll('#tetradFinal [data-tf]').length,
    имя: (document.querySelector('.tf-sign span') || {}).textContent || '',
    дальше: (document.querySelector('.tf-next') || {}).textContent || '',
  };
});
console.log('финал тетради:', JSON.stringify(финал));
if (!финал.есть) { console.log('ОЙ: финала нет'); плохо++; }
if (финал.фонарей !== 4) { console.log('ОЙ: фонарей не четыре'); плохо++; }
if (финал.метки.join(',') !== 'ОБЕЩАНИЕ,ПОСЛАННИК,РОЖДЕНИЕ,ПОКЛОНЕНИЕ') {
  console.log('ОЙ: метки фонарей не её'); плохо++;
}
if (финал.полей !== 7) { console.log('ОЙ: полей не семь'); плохо++; }
if (финал.имя !== 'Милана') { console.log('ОЙ: подпись не именем ребёнка'); плохо++; }

// 5. Написанное держится после перезагрузки.
await p.fill('[data-tf="останется"]', 'Господь держит слово');
await ж(200);
await p.reload({ waitUntil: 'load' });
await ж(1200);
const после = await p.evaluate(async () => {
  const ж = (м) => new Promise((r) => setTimeout(r, м));
  openLesson(4); await ж(800);
  return (document.querySelector('[data-tf="останется"]') || {}).value || '';
});
console.log('после перезагрузки:', JSON.stringify(после));
if (после !== 'Господь держит слово') { console.log('ОЙ: запись не сохранилась'); плохо++; }

// 6. Финал живёт только в четвёртом уроке.
const вДругом = await p.evaluate(async () => {
  const ж = (м) => new Promise((r) => setTimeout(r, м));
  openLesson(3); await ж(700);
  return document.querySelectorAll('#tetradFinal .tf').length;
});
if (вДругом !== 0) { console.log('ОЙ: финал вылез в урок 3'); плохо++; }

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
