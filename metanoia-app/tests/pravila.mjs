// У каждого чата есть закреплённая строка с правилом или подсказкой.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1500);
const итог=[];
for (let i=0;i<5;i++) {
  const r = await p.evaluate(async (i)=>{
    document.querySelector('.nav__tab[data-tab="chats"]').click();
    await new Promise(r=>setTimeout(r,400));
    const строки=[...document.querySelectorAll('.chat-item')];
    if (!строки[i]) return { чат:i, имя:'нет', закреп:'нет' };
    const имя = строки[i].innerText.split('\n')[0];
    строки[i].click(); await new Promise(r=>setTimeout(r,700));
    const з = document.querySelector('#cvPinned, .cv-pinned, .chat-pinned');
    return { чат:i, имя, закреп: з && !з.hidden ? (з.innerText||'').trim().slice(0,60) : 'нет' };
  }, i);
  итог.push(r);
  console.log(JSON.stringify(r));
}
const без = итог.filter(r=>r.закреп==='нет').map(r=>r.имя);
console.log('без закрепа: ' + (без.length? без.join(', ') : 'нет'));
console.log('ОШИБОК: ' + (без.length + errs.length));
errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
