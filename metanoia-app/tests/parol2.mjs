// Переход по ссылке из письма: новый пароль и сразу вход.
import { chromium } from 'playwright';
const ключ = process.argv[2];
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('dialog', d=>d.accept('SvezhiyParol7'));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8099/_t.html?reset=' + ключ,{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1');});
await p.goto('http://127.0.0.1:8099/_t.html?reset=' + ключ,{waitUntil:'load'});
await p.waitForTimeout(5000);
console.log('ПОСЛЕ ССЫЛКИ: ' + JSON.stringify(await p.evaluate(()=>({
  токен: !!localStorage.getItem('mt_token'),
  ребёнок: localStorage.getItem('mt_child_id'),
  вошли: document.getElementById('auth').hidden,
  адрес: location.search || '(чистый)',
  тост: document.querySelector('.toast')?.textContent || '' }))));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
