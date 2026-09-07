// Пять типов заданий: собрать каждое правильно и увидеть отметку.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_music_off','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);

// Открываем уроки 1..5: типы заданий чередуются, так проверим все пять.
for (let n = 1; n <= 5; n++) {
  const было = errs.length;
  const итог = await p.evaluate(async (n) => {
    const пауза = (мс) => new Promise(r => setTimeout(r, мс));
    // открываем урок напрямую, минуя замки
    if (typeof openLesson === 'function') openLesson(n); else return 'нет openLesson';
    await пауза(700);
    const корень = document.querySelector('.task');
    if (!корень) return 'задания нет';
    const тип = корень.dataset.task;
    const з = (typeof ЗАДАНИЯ !== 'undefined') ? ЗАДАНИЯ.собрать(n, (typeof lessonContent === 'function') ? lessonContent(n) : null) : null;
    const нажать = async (эл) => { if (эл) { эл.click(); await пауза(120); } };

    if (тип === 'order' && з) {
      for (const верный of з.верно) {
        const к = [...корень.querySelectorAll('[data-card]')].find(b => b.textContent.trim() === String(верный).trim());
        await нажать(к);
      }
    } else if (тип === 'pairs' && з) {
      const левые = [...корень.querySelectorAll('[data-left]')];
      for (const л of левые) {
        await нажать(л);
        const ждём = String(з.пары[Number(л.dataset.left)].право).trim();
        const пара = [...корень.querySelectorAll('[data-right]')].find(b => b.textContent.trim() === ждём);
        await нажать(пара);
      }
    } else if (тип === 'gap' && з) {
      const к = [...корень.querySelectorAll('[data-word]')].find(b => b.textContent.trim().toLowerCase() === String(з.верно).toLowerCase());
      await нажать(к);
    } else if (тип === 'rebus' && з) {
      // склеиваем слово из кусков в правильном порядке
      let собрано = '';
      while (собрано !== з.верно) {
        const к = [...корень.querySelectorAll('[data-syl]')].find(b =>
          !b.classList.contains('tcard--ok') && з.верно.startsWith(собрано + b.textContent.trim()));
        if (!к) break;
        собрано += к.textContent.trim();
        await нажать(к);
      }
    } else if (тип === 'find' && з) {
      const к = [...корень.querySelectorAll('[data-find]')].find(b => b.textContent.trim() === String(з.верно).trim());
      await нажать(к);
    }
    await пауза(500);
    const s = JSON.parse(localStorage.getItem('mt_lesson_' + n) || '{}');
    const res = (корень.querySelector('.task__res') || {}).innerText || '';
    return тип + ' → зачтено=' + (s.task === true) + ', ответ «' + res.replace(/\s+/g, ' ').trim().slice(0, 40) + '»';
  }, n);
  console.log('урок ' + n + ': ' + итог + (errs.length > было ? ' ОШИБКА: ' + errs[было].slice(0, 60) : ''));
}
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
