import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня',age:8},{name:'Пётр',age:6}])); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(500);
console.log(JSON.stringify(await p.evaluate(()=>({
  карточек: document.querySelectorAll('#children .child-card').length,
  примечание: document.getElementById('childrenNote')?.hidden === false
    ? document.getElementById('childrenNote').innerText.replace(/\s+/g,' ').slice(0,140) : 'скрыто',
})), null, 1));
console.log('ОШИБОК: ' + errs.length);
await b.close();
