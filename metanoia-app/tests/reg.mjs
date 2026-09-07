// Настоящая регистрация: согласия обязательны, ребёнок заводится.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
await p.click('[data-authtab="register"]');
await p.waitForTimeout(400);
await p.fill('#registerForm input[name="name"]','Мария');
await p.fill('#registerForm input[name="email"]','mama@example.ru');
await p.fill('#registerForm input[name="password"]','Prover12345');
await p.fill('#registerForm input[name="child_name"]','Соня');
const возраст = await p.$('#registerForm input[name="child_age"]');
if (возраст) await возраст.fill('8');
// пробуем без согласий
await p.click('#registerForm button[type="submit"]');
await p.waitForTimeout(900);
console.log('БЕЗ СОГЛАСИЙ: вошли=' + await p.evaluate(()=>localStorage.getItem('mt_auth')) +
  ', сказали «' + (await p.evaluate(()=>(document.getElementById('toast')||{}).textContent||'')).slice(0,70) + '»');
// ставим согласия
const флажков = await p.evaluate(()=>{
  const ф=[...document.querySelectorAll('#registerForm input[type=checkbox]')];
  ф.slice(0,2).forEach(x=>{ if(!x.checked) x.click(); });
  return ф.length;
});
console.log('ФЛАЖКОВ: ' + флажков);
await p.click('#registerForm button[type="submit"]');
await p.waitForTimeout(1500);
console.log('ПОСЛЕ СОГЛАСИЙ: ' + JSON.stringify(await p.evaluate(()=>({
  вошли: localStorage.getItem('mt_auth'),
  имя: localStorage.getItem('mt_name'),
  дети: localStorage.getItem('mt_kids'),
  экран: document.getElementById('auth').hidden ? 'приложение' : 'всё ещё вход',
  тост: ((document.getElementById('toast')||{}).textContent||'').slice(0,70),
}))));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await p.screenshot({path:'shot-reg.png'});
await b.close();
