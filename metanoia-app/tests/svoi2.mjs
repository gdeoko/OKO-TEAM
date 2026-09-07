// Двое детей + настоящий сервер: у каждого свой прогресс и своя строка в базе.
import { chromium } from 'playwright';
const B='http://127.0.0.1:8099';
const почта = 'semya' + Date.now() + '@test.ru';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const errs=[];
const стр = async () => { const p=await b.newPage({viewport:{width:390,height:844}});
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort()); return p; };

const p1 = await стр();
await p1.goto(B+'/_t.html',{waitUntil:'load'});
await p1.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1');});
await p1.reload({waitUntil:'load'}); await p1.waitForTimeout(1200);
await p1.click('[data-authtab="register"]');
await p1.fill('#registerForm [name="name"]','Мария');
await p1.fill('#registerForm [name="email"]',почта);
await p1.fill('#registerForm [name="password"]','Parol12345');
await p1.fill('#registerForm [name="child_name"]','Соня');
await p1.fill('#registerForm [name="child_age"]','8');
for (const c of await p1.$$('#registerForm input[type=checkbox]')) await c.check().catch(()=>{});
await p1.click('#registerForm [type="submit"]'); await p1.waitForTimeout(4000);
console.log('после регистрации: ' + JSON.stringify(await p1.evaluate(()=>({
  дети: памятьЧитать('mt_kids',[]).map(k=>k.name+'/'+(k.sid||'нет')),
  текущий: localStorage.getItem('mt_child_id') }))));

// добавляем второго ребёнка через интерфейс
await p1.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p1.waitForTimeout(400);
await p1.evaluate(()=>{ openAddChild(); });
await p1.waitForTimeout(300);
await p1.fill('#addkName','Пётр');
await p1.evaluate(()=>saveChild());
await p1.waitForTimeout(3000);
await p1.evaluate(()=>document.querySelectorAll('.reward, .reward--on').forEach(э=>э.remove()));
console.log('после второго ребёнка: ' + JSON.stringify(await p1.evaluate(()=>({
  дети: памятьЧитать('mt_kids',[]).map(k=>k.name+'/'+(k.sid||'нет')),
  текущий: localStorage.getItem('mt_child_id') }))));

// Соня проходит урок 1
await p1.evaluate(()=>localStorage.setItem('mt_lesson_1', JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})));
await p1.waitForTimeout(4500);
// передаём Петру
await p1.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p1.waitForTimeout(500);
await p1.evaluate(()=>document.querySelectorAll('.reward, .reward--on').forEach(э=>э.remove()));
await p1.waitForTimeout(300);
const к = await p1.$$('#children .child-card');
await к[1].click();
await p1.waitForTimeout(3500);
await p1.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p1.waitForTimeout(1200);
console.log('у Петра: ' + JSON.stringify(await p1.evaluate(()=>({
  активный: (памятьЧитать('mt_kids',[]).find(k=>String(k.лид)===localStorage.getItem('mt_active_kid'))||{}).name,
  серверныйНомер: localStorage.getItem('mt_child_id'),
  урок1: !!localStorage.getItem('mt_lesson_1') }))));
await p1.evaluate(()=>localStorage.setItem('mt_lesson_5', JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()})));
await p1.waitForTimeout(4500);
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
console.log('ПОЧТА: ' + почта);
await b.close();
