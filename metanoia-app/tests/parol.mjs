// Регистрация, вход, забытый пароль и вход по ссылке из письма — через настоящий сервер.
import { chromium } from 'playwright';
const B='http://127.0.0.1:8099';
const почта = 'semya' + Date.now() + '@test.ru';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const errs=[];
async function страница(){ const p=await b.newPage({viewport:{width:390,height:844}});
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort()); return p; }

// 1. Регистрация
const p1 = await страница();
await p1.goto(B+'/_t.html',{waitUntil:'load'});
await p1.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1');});
await p1.reload({waitUntil:'load'}); await p1.waitForTimeout(1200);
await p1.click('[data-authtab="register"]');
await p1.fill('#registerForm [name="name"]','Мария');
await p1.fill('#registerForm [name="email"]',почта);
await p1.fill('#registerForm [name="password"]','Parol12345');
await p1.fill('#registerForm [name="child_name"]','Ваня');
await p1.fill('#registerForm [name="child_age"]','9');
for (const c of await p1.$$('#registerForm input[type=checkbox]')) await c.check().catch(()=>{});
await p1.click('#registerForm [type="submit"]');
await p1.waitForTimeout(4000);
console.log('РЕГИСТРАЦИЯ: ' + JSON.stringify(await p1.evaluate(()=>({
  токен: !!localStorage.getItem('mt_token'), ребёнок: localStorage.getItem('mt_child_id'),
  вошли: !document.getElementById('auth') || document.getElementById('auth').hidden }))));

// 2. Вход на чистом устройстве
const p2 = await страница();
await p2.goto(B+'/_t.html',{waitUntil:'load'});
await p2.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1');});
await p2.reload({waitUntil:'load'}); await p2.waitForTimeout(1200);
await p2.fill('#loginForm [name="email"]',почта);
await p2.fill('#loginForm [name="password"]','Parol12345');
await p2.click('#loginForm [type="submit"]');
await p2.waitForTimeout(4000);
console.log('ВХОД: ' + JSON.stringify(await p2.evaluate(()=>({
  токен: !!localStorage.getItem('mt_token'), ребёнок: localStorage.getItem('mt_child_id'),
  вошли: document.getElementById('auth').hidden }))));

// 3. Забытый пароль
const p3 = await страница();
p3.on('dialog', d=>d.accept(почта));
await p3.goto(B+'/_t.html',{waitUntil:'load'});
await p3.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1');});
await p3.reload({waitUntil:'load'}); await p3.waitForTimeout(1200);
await p3.click('#forgotBtn'); await p3.waitForTimeout(2500);
console.log('ПИСЬМО: ' + await p3.evaluate(()=>document.querySelector('.toast')?.textContent || 'тоста нет'));
console.log('ПОЧТА: ' + почта);
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await b.close();
