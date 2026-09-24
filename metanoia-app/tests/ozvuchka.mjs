// Озвучка уроков 1-14 её голосом: кнопка есть, файл настоящий, играет.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium',
  args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
const ответы=[]; p.on('response', r=>{ if(/lessons\/l\d+\.mp3/.test(r.url())) ответы.push(r.url().split('/').pop()+' '+r.status()); });
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  for (let n=1;n<=104;n++) localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(1200);

let плохо = 0;
for (const n of [1, 7, 14]) {
  const r = await p.evaluate(async (n)=>{
    const ж=(м)=>new Promise(r=>setTimeout(r,м));
    openLesson(n); await ж(800);
    const к = document.getElementById('lessonVoice');
    if (!к) return { урок:n, кнопка:'нет' };
    // Подпись урока берём именно из карточки урока, а не первую на странице.
    const подпись = document.querySelector('[data-screen="lesson"] .feed-card__meta, #lessonBody .feed-card__meta');
    к.click(); await ж(3500);
    // Плеер урока создаётся через new Audio и в разметке не лежит:
    // о том, что он играет, говорит подсветка самой кнопки.
    return { урок:n, кнопка:'есть',
             подпись: подпись ? подпись.textContent.includes('слушаем') : 'подписи нет',
             адрес: к.dataset.src,
             играет: к.classList.contains('lesson-voice--playing') };
  }, n);
  console.log(JSON.stringify(r));
  if (r.кнопка !== 'есть' || r.подпись !== true || !r.играет) плохо++;
}
await p.waitForTimeout(1500);
console.log('запросы к озвучке: ' + (ответы.length ? ответы.join(', ') : 'НЕТ'));
const битые = ответы.filter(o=>!o.endsWith('200') && !o.endsWith('206'));
console.log('ОШИБОК: ' + (плохо + errs.length + битые.length + (ответы.length ? 0 : 1)));
errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
