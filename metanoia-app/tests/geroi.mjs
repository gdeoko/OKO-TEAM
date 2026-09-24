// Помощники школы, словарь «Наши открытия» и повторение прошлого урока.
// Всё из её презентации к уроку 1: три героя, шесть слов, четыре вопроса.
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
const внутри = (сел) => p.evaluate((с) => {
  const э = document.querySelector('[data-screen="lesson"]');
  return [...э.querySelectorAll(с)].map((x) => x.textContent.trim());
}, сел);

// 1. Урок 1: знакомство, три помощника на своих местах, словарь, «Вспомни».
await p.evaluate(() => openLesson(1));
await p.waitForTimeout(900);
const урок1 = await p.evaluate(() => {
  const э = document.querySelector('[data-screen="lesson"]');
  const помощники = [...э.querySelectorAll('.pomosh')];
  return {
    знакомство: !!э.querySelector('.znak'),
    имён: [...э.querySelectorAll('.znak__name')].map((x) => x.textContent.trim()),
    помощников: помощники.map((x) => ({
      кто: x.querySelector('.pomosh__name').textContent.trim(),
      место: [...x.classList].find((c) => c.startsWith('pomosh--')),
      портрет: !!x.querySelector('.pomosh__face'),
    })),
    словарь: [...э.querySelectorAll('.slovar__w')].map((x) => x.textContent.trim()),
    вспомни: э.querySelectorAll('.vspomni__list li').length,
    повторение: !!э.querySelector('.povtor'),
  };
});
console.log('урок 1:', JSON.stringify(урок1, null, 1));
if (!урок1.знакомство) { console.log('ОЙ: нет знакомства с героями'); плохо++; }
if (урок1.имён.join(',') !== 'Милана,Еммануил,Эван') { console.log('ОЙ: не те имена'); плохо++; }
if (урок1.помощников.length !== 3) { console.log('ОЙ: помощников не трое'); плохо++; }
const места = урок1.помощников.map((x) => x.место).join(',');
if (места !== 'pomosh--начало,pomosh--середина,pomosh--конец') {
  console.log('ОЙ: помощники не в начале, середине и конце:', места); плохо++;
}
if (урок1.помощников.some((x) => !x.портрет)) { console.log('ОЙ: у кого-то нет портрета'); плохо++; }
if (урок1.словарь.length !== 6) { console.log('ОЙ: в словаре не шесть слов'); плохо++; }
if (!урок1.словарь.includes('Пророчество')) { console.log('ОЙ: нет слова «Пророчество»'); плохо++; }
if (урок1.вспомни !== 4) { console.log('ОЙ: вопросов «Вспомни» не четыре'); плохо++; }
if (урок1.повторение) { console.log('ОЙ: в первом уроке нечего повторять'); плохо++; }

// 2. Вопрос Еммануила не повторяется в беседе ниже.
const вопросы = await внутри('.lq');
const еммануил = (await внутри('.pomosh--середина .pomosh__say'))[0] || '';
console.log('вопрос Еммануила:', JSON.stringify(еммануил));
if (!еммануил) { console.log('ОЙ: Еммануил молчит'); плохо++; }
if (вопросы.some((в) => в === еммануил)) { console.log('ОЙ: вопрос задан дважды'); плохо++; }

// 3. Знакомство только на первом уроке.
await p.evaluate(() => openLesson(2));
await p.waitForTimeout(800);
const вУроке2 = await p.evaluate(() => {
  const э = document.querySelector('[data-screen="lesson"]');
  return { знакомство: !!э.querySelector('.znak'), повторение: !!э.querySelector('.povtor') };
});
if (вУроке2.знакомство) { console.log('ОЙ: знакомство вылезло во второй урок'); плохо++; }
if (вУроке2.повторение) { console.log('ОЙ: повторяем непройденный урок'); плохо++; }

// 4. Прошли урок 1 — во втором появилось повторение его словаря.
await p.evaluate(() => {
  localStorage.setItem('mt_lesson_1',
    JSON.stringify({ read: true, task: true, test: true, done: true, ts: Date.now() }));
});
await p.evaluate(() => openLesson(2));
await p.waitForTimeout(800);
const повтор = await p.evaluate(() => {
  const э = document.querySelector('[data-screen="lesson"]');
  return {
    есть: !!э.querySelector('.povtor'),
    шапка: (э.querySelector('.povtor__t') || {}).textContent || '',
    слов: э.querySelectorAll('.povtor__w').length,
  };
});
console.log('повторение в уроке 2:', JSON.stringify(повтор));
if (!повтор.есть) { console.log('ОЙ: повторения нет'); плохо++; }
if (!повтор.шапка.includes('урок 1')) { console.log('ОЙ: повторяем не тот урок'); плохо++; }
if (повтор.слов !== 6) { console.log('ОЙ: повторяем не все слова'); плохо++; }

// 5. Портреты — настоящие файлы, а не битые ссылки.
const битые = await p.evaluate(() => {
  const снимки = [...document.querySelectorAll('[data-screen="lesson"] img')];
  return снимки.filter((и) => и.complete && и.naturalWidth === 0).map((и) => и.getAttribute('src'));
});
if (битые.length) { console.log('ОЙ: битые картинки:', битые); плохо++; }

if (errs.length) { console.log('ОШИБКИ СТРАНИЦЫ:', errs.slice(0, 3)); плохо++; }
console.log('ОШИБОК: ' + плохо);
await b.close();
process.exit(плохо ? 1 : 0);
