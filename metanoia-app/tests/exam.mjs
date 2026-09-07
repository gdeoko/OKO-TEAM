// Проверка знаний в конце главы: открывается после всех уроков главы.
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

const состав = await p.evaluate(()=>DEMO.blocks.map(b=>({
  имя: b.title || b.name || '',
  уроков: b.lessons.filter(l=>!l.exam).length,
  экзамены: b.lessons.filter(l=>l.exam).map(l=>l.n),
})));
console.log('ГЛАВЫ: ' + JSON.stringify(состав));

// закрываем все уроки первой главы
await p.evaluate(()=>{
  DEMO.blocks[0].lessons.filter(l=>!l.exam).forEach(l=>{
    localStorage.setItem('mt_lesson_'+l.n, JSON.stringify({read:true,task:true,test:true,hw:false,done:true}));
  });
});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(600);
const экз = await p.evaluate(()=>{
  const n = DEMO.blocks[0].lessons.find(l=>l.exam).n;
  const эл = [...document.querySelectorAll('.lesson-item')].find(e=>e.dataset.n === String(n) || (e.innerText||'').includes('роверка'));
  return { номер: n, класс: эл ? эл.className : 'не найден' };
});
console.log('ЭКЗАМЕН ГЛАВЫ 1: ' + JSON.stringify(экз));

// открываем и отвечаем
const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  openExam(0);
  await пауза(900);
  let открыт=''; document.querySelectorAll('[data-screen]').forEach(e=>{ if(!e.hidden && getComputedStyle(e).display!=='none') открыт=e.dataset.screen; });
  const вопросов = examState ? examState.questions.length : 0;
  // отвечаем верно на все вопросы: у каждого свой набор радиокнопок
  examState.questions.forEach((q, qi)=>{
    const и = document.querySelector(`input[name="ex${qi}"][value="${q.answer}"]`);
    if (и) и.checked = true;
  });
  document.getElementById('examCheck').click();
  await пауза(900);
  const рез = [...document.querySelectorAll('#examBody, .exam__res, .lesson-final, .gend')].map(e=>(e.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean)[0] || '';
  return { экран: открыт, вопросов, результат: рез.slice(0,110), память: localStorage.getItem('mt_exam_0') };
});
console.log('ХОД ПРОВЕРКИ: ' + JSON.stringify(итог));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
