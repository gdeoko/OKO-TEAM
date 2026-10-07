// «Наши открытия» и «Вспомни» есть у каждого из 105 уроков.
// Раньше блок работал ровно в одном уроке из ста пяти: её презентация есть
// только к первому. Словарь урока 1 остаётся её, из `shkola.js`, и новый
// файл его не перебивает.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.route((u) => !u.href.startsWith('http://127.0.0.1'), (r) => r.abort());
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => {
  localStorage.clear(); localStorage.setItem('mt_onb', '1'); localStorage.setItem('mt_auth', '1');
  localStorage.setItem('mt_kids', JSON.stringify([{ лид: 1, name: 'Соня', age: 8, img: 'assets/img/avatars/star.jpg' }]));
  localStorage.setItem('mt_active_kid', '1');
  for (let n = 1; n <= 105; n++) {
    localStorage.setItem('mt_lesson_' + n, JSON.stringify({ read: true, task: true, test: true, done: true, ts: Date.now() }));
  }
});
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(1200);
let плохо = 0;

// 1. Охват: словарь и вопросы у всех 105 уроков.
const свод = await p.evaluate(() => {
  const нетСловаря = [], нетВопросов = [], мало = [], пусто = [], кривые = [];
  for (let n = 1; n <= 105; n++) {
    const с = window.SLOVAR[n];
    const в = window.VSPOMNI[n];
    if (!с) { нетСловаря.push(n); continue; }
    if (!в) { нетВопросов.push(n); continue; }
    if (с.length < 4) мало.push(n);
    if (в.length < 3) мало.push(n);
    с.forEach((x) => {
      if (!x.слово || !x.коротко || !x.толкование) пусто.push(n);
      // Толкование короче слова или длиннее абзаца — значит, что-то не то.
      if (x.толкование && (x.толкование.length < 25 || x.толкование.length > 220)) кривые.push(n + ':' + x.слово);
    });
  }
  return { нетСловаря, нетВопросов, мало, пусто, кривые, первый: !!window.SLOVAR[1] };
});
console.log('охват:', JSON.stringify({ нет: свод.нетСловаря.length, мало: свод.мало.length, кривых: свод.кривые.length }));
if (свод.нетСловаря.length) { console.log('ОЙ: без словаря:', свод.нетСловаря.slice(0, 10)); плохо++; }
if (свод.нетВопросов.length) { console.log('ОЙ: без «Вспомни»:', свод.нетВопросов.slice(0, 10)); плохо++; }
if (свод.мало.length) { console.log('ОЙ: слишком коротко:', свод.мало.slice(0, 10)); плохо++; }
if (свод.пусто.length) { console.log('ОЙ: пустые поля:', свод.пусто.slice(0, 10)); плохо++; }
if (свод.кривые.length) { console.log('ОЙ: странная длина толкования:', свод.кривые.slice(0, 6)); плохо++; }
if (!свод.первый) { console.log('ОЙ: пропал её словарь урока 1'); плохо++; }

// 2. Словарь первого урока остался её, со слайдов: шесть слов, первое «Пророк».
const первый = await p.evaluate(() => ({
  слов: window.SLOVAR[1].length, первое: window.SLOVAR[1][0].слово,
  вопросов: window.VSPOMNI[1].length,
}));
console.log('урок 1 (её словарь):', JSON.stringify(первый));
if (первый.слов !== 6 || первый.первое !== 'Пророк' || первый.вопросов !== 4) {
  console.log('ОЙ: её словарь первого урока перебили'); плохо++;
}

// 3. На экране: словарь рисуется, вопросы рисуются, повторение берёт прошлый урок.
for (const n of [3, 16, 60, 105]) {
  await p.evaluate((н) => openLesson(н), n);
  await p.waitForTimeout(700);
  const вид = await p.evaluate(() => {
    const э = document.querySelector('[data-screen="lesson"]');
    return {
      слов: э.querySelectorAll('.slovar__w').length,
      вспомни: э.querySelectorAll('.vspomni__list li').length,
      повтор: э.querySelectorAll('.povtor__w').length,
      шапка: (э.querySelector('.povtor__t') || {}).textContent || '',
    };
  });
  console.log('урок ' + n + ':', JSON.stringify(вид));
  if (вид.слов < 4) { console.log('ОЙ: в уроке ' + n + ' нет словаря на экране'); плохо++; }
  if (вид.вспомни < 3) { console.log('ОЙ: в уроке ' + n + ' нет вопросов «Вспомни»'); плохо++; }
  if (вид.повтор < 4) { console.log('ОЙ: в уроке ' + n + ' не повторяется прошлый урок'); плохо++; }
  if (!вид.шапка.includes(String(n - 1))) { console.log('ОЙ: в уроке ' + n + ' повторяем не тот урок: ' + вид.шапка); плохо++; }
}

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
