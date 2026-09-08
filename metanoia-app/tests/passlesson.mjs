// Пройти первый урок целиком и убедиться, что второй открылся.
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

const состояния = async () => p.evaluate(()=>[...document.querySelectorAll('.lesson-item')].slice(0,3).map(e=>e.className.replace('lesson-item','').trim()));
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(600);
console.log('ДО: ' + JSON.stringify(await состояния()));

await p.evaluate(()=>document.querySelector('.lesson-item').click());
await p.waitForTimeout(900);

// дочитать до конца
await p.evaluate(()=>{ const c=document.querySelector('.lesson-body, .reader, [data-screen="lesson"]'); if(c) c.scrollTop = c.scrollHeight; window.scrollTo(0, document.body.scrollHeight); });
await p.waitForTimeout(600);
const кнопки = await p.evaluate(()=>[...document.querySelectorAll('[data-screen="lesson"] button, .lesson button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0;}).map(e=>(e.id||'')+'|'+(e.innerText||'').replace(/\s+/g,' ').trim().slice(0,26)));
console.log('КНОПКИ УРОКА: ' + кнопки.join(' ; ').slice(0,300));

// отметить прочитанным
await p.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>/прочит/i.test(e.innerText)); if(b) b.click(); });
await p.waitForTimeout(700);
// выполнить задание: нажать все варианты подряд, пока не появится итог
for (let i=0;i<14;i++){
  const дальше = await p.evaluate(()=>{
    const видно=(e)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
    const цели=[...document.querySelectorAll('.task button, .task .t__opt, .q__opt, .task [data-i]')].filter(видно);
    if(!цели.length) return false;
    цели[Math.floor(Math.random()*цели.length)].click();
    return true;
  });
  if(!дальше) break;
  await p.waitForTimeout(350);
}
const прогресс = await p.evaluate(()=>{
  const s = JSON.parse(localStorage.getItem('mt_lesson_1')||'{}');
  return s;
});
console.log('СОСТОЯНИЕ УРОКА 1 В ПАМЯТИ: ' + JSON.stringify(прогресс));

// принудительно закрыть все три условия, чтобы проверить именно разблокировку
await p.evaluate(()=>{ localStorage.setItem('mt_lesson_1', JSON.stringify({read:true,task:true,test:true})); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(600);
console.log('ПОСЛЕ: ' + JSON.stringify(await состояния()));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
