// У каждого из 105 уроков должно собираться рабочее задание и корректный тест.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(900);
const итог = await p.evaluate(()=>{
  const виды = {}; const плохие = []; const тесты = [];
  for (let n = 1; n <= 105; n++) {
    const c = (typeof LESSONS !== 'undefined') ? (LESSONS[n] || LESSONS[String(n)]) : null;
    if (!c) { плохие.push(n + ': нет содержания'); continue; }
    let з = null;
    try { з = ЗАДАНИЯ.собрать(n, c); } catch (e) { плохие.push(n + ': задание падает — ' + e.message); continue; }
    if (!з || !з.тип) { плохие.push(n + ': задание не собралось'); continue; }
    виды[з.тип] = (виды[з.тип] || 0) + 1;
    // тест: у каждого вопроса должен быть верный ответ из списка
    (c.quiz || []).forEach((в, i) => {
      const оп = в.opts || в.options || [];
      const отв = (в.a !== undefined) ? в.a : в.answer;
      if (!оп.length) тесты.push(n + '/' + i + ': нет вариантов');
      else if (typeof отв === 'number' && (отв < 0 || отв >= оп.length)) тесты.push(n + '/' + i + ': ответ вне списка');
      else if (typeof отв === 'string' && !оп.includes(отв)) тесты.push(n + '/' + i + ': ответа нет среди вариантов');
    });
  }
  return { виды, плохие, тесты };
});
console.log('виды заданий: ' + JSON.stringify(итог.виды));
console.log('уроков с проблемой задания: ' + (итог.плохие.length ? итог.плохие.slice(0,6).join(' | ') : 'нет'));
console.log('проблем в тестах: ' + (итог.тесты.length ? итог.тесты.slice(0,6).join(' | ') : 'нет'));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
