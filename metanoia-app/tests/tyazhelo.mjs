// Большая переписка не должна мешать прогрессу уехать на сервер.
import { chromium } from 'playwright';
const B='http://127.0.0.1:8099';
const почта = 'tyazh' + Date.now() + '@test.ru';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const errs=[];
const p = await b.newPage({viewport:{width:390,height:844}});
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console', m=>{ if(/снимок великоват/.test(m.text())) console.log('предупреждение: ' + m.text()); });
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto(B+'/_t.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1');});
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1200);
await p.click('[data-authtab="register"]');
await p.fill('#registerForm [name="name"]','Мария');
await p.fill('#registerForm [name="email"]',почта);
await p.fill('#registerForm [name="password"]','Parol12345');
await p.fill('#registerForm [name="child_name"]','Соня');
for (const c of await p.$$('#registerForm input[type=checkbox]')) await c.check().catch(()=>{});
await p.click('#registerForm [type="submit"]'); await p.waitForTimeout(4000);
// набиваем переписку: пять записей по 100 КБ, вместе больше предела снимка
await p.evaluate(()=>{
  for (let i=1;i<=5;i++) localStorage.setItem('mt_msgs_big'+i, 'ф'.repeat(100000));
  localStorage.setItem('mt_lesson_4', JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()}));
});
await p.waitForTimeout(7000);
const токен = await p.evaluate(()=>localStorage.getItem('mt_token'));
const ребёнок = await p.evaluate(()=>localStorage.getItem('mt_child_id'));
console.log('ушло: ' + await p.evaluate(()=>!!localStorage.getItem('mt_sync_at')));
const r = await fetch(B+'/api/v1/progress/'+ребёнок, { headers:{ Authorization:'Bearer '+токен } });
const d = await r.json();
const keys = (d.data && d.data.state && d.data.state.keys) || {};
console.log('на сервере: урок4=' + !!keys.mt_lesson_4 + ', тяжёлых записей=' + Object.keys(keys).filter(k=>k.startsWith('mt_msgs_big')).length);
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
