// Пять автоматических типов заданий: собрать каждое правильно и увидеть отметку.
//
// В уроках 1-4 лежат задания самой Екатерины, и их там несколько на урок —
// это проверяет tetrad. Здесь берём уроки, где задание собирается движком:
// типы чередуются по номеру, поэтому пять подряд дают все пять видов.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking', '--disable-gpu'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r => r.abort());
await p.goto('http://127.0.0.1:8777/index.html', { waitUntil: 'load' });
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('mt_onb', '1'); localStorage.setItem('mt_auth', '1'); localStorage.setItem('mt_music_off', '1'); });
await p.reload({ waitUntil: 'load' });
await p.waitForSelector('.splash--hide', { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(600);

// Уроки без её заданий: первые пять подряд, начиная с пятого.
const уроки = await p.evaluate(() => {
  const свои = window.TASKS || {};
  const список = [];
  for (let n = 5; n <= 40 && список.length < 5; n++) if (!свои[n]) список.push(n);
  return список;
});
console.log('берём уроки: ' + уроки.join(', '));

const виды = new Set();
let плохо = 0;

for (const n of уроки) {
  const было = errs.length;
  const итог = await p.evaluate(async (n) => {
    const пауза = (мс) => new Promise(r => setTimeout(r, мс));
    if (typeof openLesson !== 'function') return { беда: 'нет openLesson' };
    openLesson(n);
    await пауза(700);
    const корень = document.querySelector('[data-screen="lesson"] .task');
    if (!корень) return { беда: 'задания нет' };
    const тип = корень.dataset.task;
    const з = (typeof ЗАДАНИЯ !== 'undefined')
      ? ЗАДАНИЯ.собрать(n, (typeof lessonContent === 'function') ? lessonContent(n) : null) : null;
    if (Array.isArray(з)) return { беда: 'здесь задания педагога, их проверяет tetrad' };
    const нажать = async (эл) => { if (эл) { эл.click(); await пауза(120); } };

    if (тип === 'order' && з) {
      for (const верный of з.верно) {
        const к = [...корень.querySelectorAll('[data-card]')].find(b => b.textContent.trim() === String(верный).trim());
        await нажать(к);
      }
    } else if (тип === 'pairs' && з) {
      for (const л of [...корень.querySelectorAll('[data-left]')]) {
        await нажать(л);
        const ждём = String(з.пары[Number(л.dataset.left)].право).trim();
        await нажать([...корень.querySelectorAll('[data-right]')].find(b => b.textContent.trim() === ждём));
      }
    } else if (тип === 'gap' && з) {
      await нажать([...корень.querySelectorAll('[data-word]')]
        .find(b => b.textContent.trim().toLowerCase() === String(з.верно).toLowerCase()));
    } else if (тип === 'rebus' && з) {
      let собрано = '';
      while (собрано !== з.верно) {
        const к = [...корень.querySelectorAll('[data-syl]')].find(b =>
          !b.classList.contains('tcard--ok') && з.верно.startsWith(собрано + b.textContent.trim()));
        if (!к) break;
        собрано += к.textContent.trim();
        await нажать(к);
      }
    } else if (тип === 'find' && з) {
      await нажать([...корень.querySelectorAll('[data-find]')]
        .find(b => b.textContent.trim() === String(з.верно).trim()));
    }
    await пауза(500);
    const s = JSON.parse(localStorage.getItem('mt_lesson_' + n) || '{}');
    const res = (корень.querySelector('.task__res') || {}).innerText || '';
    return { тип, зачтено: s.task === true, ответ: res.replace(/\s+/g, ' ').trim().slice(0, 40) };
  }, n);

  if (итог.беда) {
    console.log('урок ' + n + ': ' + итог.беда);
    плохо++;
    continue;
  }
  виды.add(итог.тип);
  console.log('урок ' + n + ': ' + итог.тип + ' → зачтено=' + итог.зачтено + ', ответ «' + итог.ответ + '»');
  if (!итог.зачтено) { console.log('ОЙ: задание не засчиталось'); плохо++; }
  if (errs.length > было) { console.log('ОЙ: ' + errs[было].slice(0, 80)); плохо++; }
}

console.log('видов заданий проверено: ' + виды.size + ' (' + [...виды].join(', ') + ')');
if (виды.size !== 5) { console.log('ОЙ: проверены не все пять видов'); плохо++; }

console.log('ОШИБОК: ' + плохо);
errs.slice(0, 3).forEach(e => console.log(e));
await b.close();
process.exit(плохо ? 1 : 0);
