// Все 105 уроков читаются постранично, а не простынёй текста.
// Раньше страницы были только у её уроков 1-14, остальные шли одним куском:
// с телефона это неудобно, глазу не за что зацепиться. Текст не меняли, он
// совпадает с озвучкой, его просто разрезали по абзацам.
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

// 1. У каждого из 105 уроков страниц столько же, сколько абзацев рассказа,
//    и ни один урок не остался простынёй.
const свод = await p.evaluate(() => {
  const итог = { простыни: [], расхождения: [], безКартинки: [], пустые: [] };
  for (let n = 1; n <= 105; n++) {
    const урок = window.LESSONS[n];
    const абзацев = (урок.story || []).length;
    const стр = страницыЧтения(n, урок);
    if (!абзацев) { итог.пустые.push(n); continue; }
    if (стр.length !== абзацев) итог.расхождения.push(n + ': ' + стр.length + ' вместо ' + абзацев);
    if (!стр.some((с) => s(с))) итог.безКартинки.push(n);
    if (стр.some((с) => !с.text || !с.text.trim())) итог.пустые.push(n);
  }
  function s(с) { return !!с.img; }
  return итог;
});
console.log('страниц по всем урокам:', JSON.stringify(свод));
if (свод.расхождения.length) { console.log('ОЙ: страниц не по абзацам:', свод.расхождения.slice(0, 5)); плохо++; }
if (свод.безКартинки.length) { console.log('ОЙ: уроки без картинки в тексте:', свод.безКартинки.slice(0, 8)); плохо++; }
if (свод.пустые.length) { console.log('ОЙ: пустые страницы:', свод.пустые.slice(0, 8)); плохо++; }

// 2. Три урока из разных глав открываются пейджером, кнопки листают, счётчик живой.
for (const n of [20, 55, 94]) {
  await p.evaluate((н) => openLesson(н), n);
  await p.waitForTimeout(700);
  const было = await p.evaluate(() => {
    const э = document.querySelector('[data-screen="lesson"]');
    const пейджер = э.querySelector('.lesson-pager');
    return {
      пейджер: !!пейджер,
      простыня: !!э.querySelector('.lesson-story'),
      слайдов: э.querySelectorAll('.lp-slide').length,
      точек: э.querySelectorAll('.lp-dot').length,
      счётчик: (э.querySelector('#lpCur') || {}).textContent || '',
      картинок: э.querySelectorAll('.lp-img').length,
    };
  });
  console.log('урок ' + n + ':', JSON.stringify(было));
  if (!было.пейджер) { console.log('ОЙ: урок ' + n + ' без пейджера'); плохо++; }
  if (было.простыня) { console.log('ОЙ: урок ' + n + ' остался простынёй'); плохо++; }
  if (было.слайдов < 3) { console.log('ОЙ: в уроке ' + n + ' мало страниц'); плохо++; }
  if (было.точек !== было.слайдов) { console.log('ОЙ: точек не по страницам в уроке ' + n); плохо++; }
  if (было.картинок < 1) { console.log('ОЙ: в уроке ' + n + ' нет иллюстрации'); плохо++; }

  // Листаем вперёд стрелкой и смотрим, что счётчик сдвинулся.
  await p.click('[data-screen="lesson"] .lp-btn[data-dir="1"]');
  await p.waitForTimeout(700);
  const стало = await p.$eval('[data-screen="lesson"] #lpCur', (e) => e.textContent);
  if (стало === было.счётчик) { console.log('ОЙ: в уроке ' + n + ' страница не листается'); плохо++; }
}

// 3. Высота читалки идёт за открытой страницей: под короткой страницей не
//    должно оставаться белое поле ростом с картинку.
await p.evaluate(() => openLesson(20));
await p.waitForTimeout(900);
const высоты = await p.evaluate(() => {
  const тр = document.querySelector('[data-screen="lesson"] .lp-track');
  const сл = document.querySelectorAll('[data-screen="lesson"] .lp-slide');
  return { трек: тр.getBoundingClientRect().height, первая: сл[0].getBoundingClientRect().height,
    самая: Math.max(...[...сл].map((с) => с.getBoundingClientRect().height)) };
});
console.log('высоты читалки:', JSON.stringify(высоты));
if (высоты.трек - высоты.первая > 24) {
  console.log('ОЙ: под короткой страницей пустое поле ' + Math.round(высоты.трек - высоты.первая) + ' px'); плохо++;
}

// 4. Картинки уроков настоящие, а не битые ссылки.
const битые = await p.evaluate(() => [...document.querySelectorAll('[data-screen="lesson"] img')]
  .filter((и) => и.complete && и.naturalWidth === 0).map((и) => и.getAttribute('src')));
if (битые.length) { console.log('ОЙ: битые картинки:', битые.slice(0, 5)); плохо++; }

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
