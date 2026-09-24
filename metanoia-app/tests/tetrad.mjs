// Рабочая тетрадь Екатерины в уроках 1-4: её задания, её ситуации, её миссия.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  for (let n=1;n<=104;n++) localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})); });
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1500);
let плохо = 0;
for (const n of [1,2,3,4]) {
  const r = await p.evaluate(async (n)=>{
    openLesson(n); await new Promise(r=>setTimeout(r,800));
    const t = document.getElementById('lessonTask');
    return {
      урок: n,
      заданий: t ? t.querySelectorAll('.task').length : 0,
      сердце: !!document.querySelector('.wb-heart'),
      ситуаций: document.querySelectorAll('.wb-sit').length,
      миссия: (document.querySelector('.wb-missiya__name')||{}).textContent || 'нет',
      шагов: document.querySelectorAll('.wb-missiya__steps li').length,
    };
  }, n);
  console.log(JSON.stringify(r));
  if (r.заданий < 2 || !r.сердце || r.ситуаций !== 3 || r.миссия === 'нет' || r.шагов !== 4) плохо++;
}
// Задания урока 2 надо пройти руками: три блока подряд, очко только за все три.
const пройдено = await p.evaluate(async ()=>{
  const ж=(м)=>new Promise(r=>setTimeout(r,м));
  localStorage.setItem('mt_lesson_2', JSON.stringify({read:true,task:false,test:false,done:false,ts:Date.now()}));
  openLesson(2); await ж(800);
  const t = document.getElementById('lessonTask');
  const блоки = [...t.querySelectorAll('.task-step .task')];
  // 1. порядок: жмём карточки в правильной последовательности
  const порядок = ['Гавриил принёс весть','Захария не может говорить','Родился сын','Имя ему Иоанн','Захария славит Бога'];
  for (const текст of порядок) {
    const к=[...блоки[0].querySelectorAll('[data-card]')].find(b=>b.textContent.trim()===текст);
    к.click(); await ж(60);
  }
  // 2. пары: кто сказал
  const пары=[['ГАВРИИЛ','«Не бойся, Захария»'],['ЕЛИЗАВЕТА','«Имя ему Иоанн»'],['ЗАХАРИЯ','«Благословен Господь!»']];
  for (const [кто, что] of пары) {
    [...блоки[1].querySelectorAll('[data-left]')].find(b=>b.textContent.trim()===кто).click(); await ж(60);
    [...блоки[1].querySelectorAll('[data-right]')].find(b=>b.textContent.trim()===что).click(); await ж(60);
  }
  // 3. ребус: имя по слогам
  for (const слог of ['ио','ан','н']) {
    [...блоки[2].querySelectorAll('[data-syl]')].find(b=>b.textContent.trim()===слог && !b.classList.contains('tcard--ok')).click();
    await ж(60);
  }
  await ж(400);
  return { сделано: блоки.filter(б=>б.classList.contains('task--done')).length,
           вПамяти: JSON.parse(localStorage.getItem('mt_lesson_2')).task };
});
console.log('урок 2, блоков пройдено: ' + пройдено.сделано + ' из 3 | отметка в памяти: ' + пройдено.вПамяти);
if (пройдено.сделано !== 3 || !пройдено.вПамяти) плохо++;

// Урок 5 не из тетради: там наше задание и обычное домашнее, блоков тетради быть не должно.
const пятый = await p.evaluate(async ()=>{
  openLesson(5); await new Promise(r=>setTimeout(r,700));
  return { сердце: !!document.querySelector('.wb-heart'), миссия: !!document.querySelector('.wb-missiya'),
           задание: !!document.querySelector('#lessonTask .task') };
});
console.log('урок 5 (не из тетради): ' + JSON.stringify(пятый));
if (пятый.сердце || пятый.миссия || !пятый.задание) плохо++;
console.log('ОШИБОК: ' + (плохо + errs.length));
errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
