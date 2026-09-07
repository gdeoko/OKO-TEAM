// Второе устройство: вход почтой, оба ребёнка на месте, прогресс у каждого свой.
import { chromium } from 'playwright';
const B='http://127.0.0.1:8099';
const почта = process.argv[2];
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const errs=[];
const p = await b.newPage({viewport:{width:390,height:844}});
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto(B+'/_t.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); sessionStorage.clear(); localStorage.setItem('mt_onb','1');});
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1200);
await p.fill('#loginForm [name="email"]',почта);
await p.fill('#loginForm [name="password"]','Parol12345');
await p.click('#loginForm [type="submit"]');
await p.waitForTimeout(7000);
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(1200);
const снять = () => p.evaluate(()=>({
  дети: памятьЧитать('mt_kids',[]).map(k=>k.name+'/'+(k.sid||'нет')),
  активный: (памятьЧитать('mt_kids',[]).find(k=>String(k.лид)===localStorage.getItem('mt_active_kid'))||{}).name,
  урок1: !!localStorage.getItem('mt_lesson_1'), урок5: !!localStorage.getItem('mt_lesson_5'),
}));
console.log('вошли: ' + JSON.stringify(await снять()));
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(600);
const карточки = await p.$$('#children .child-card');
console.log('карточек на втором устройстве: ' + карточки.length);
if (карточки.length > 1) {
  await p.evaluate(()=>document.querySelectorAll('.reward, .reward--on').forEach(э=>э.remove()));
  await карточки[1].click();
  await p.waitForTimeout(4000);
  await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1200);
  console.log('передали второму: ' + JSON.stringify(await снять()));
}
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await b.close();
