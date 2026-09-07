// Пройденный урок открывает следующий, и это видно сразу, без перезагрузки.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids','[{"name":"Соня","age":8,"img":""}]');});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
const состояния = () => p.evaluate(()=>[...document.querySelectorAll('.lesson-item')].slice(0,3).map(э=>э.dataset.state));
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(600);
console.log('до урока: ' + JSON.stringify(await состояния()));
// проходим первый урок изнутри экрана урока
await p.evaluate(()=>document.querySelector('.lesson-item').click());
await p.waitForTimeout(800);
await p.evaluate(()=>{ saveLessonState(1, {read:true, task:true, test:true, done:true, ts:Date.now()}); });
// ребёнок нажимает «назад» из урока
await p.click('#lessonBack');
await p.waitForTimeout(800);
console.log('после урока, кнопкой назад: ' + JSON.stringify(await состояния()));
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(600);
console.log('после перезагрузки: ' + JSON.stringify(await состояния()));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
