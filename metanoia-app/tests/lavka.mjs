// Обмен баллов в лавке должен доходить до родителя, а не исчезать.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids','[{"name":"Соня","age":8,"img":""}]');
  localStorage.setItem('mt_pet', JSON.stringify({вид:'lamb', зёрна:900}));});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(900);
await p.evaluate(()=>openShop());
await p.waitForTimeout(600);
const доступно = await p.evaluate(()=>[...document.querySelectorAll('#shopGrid [data-merch]')].filter(b=>!b.disabled).length);
console.log('можно обменять: ' + доступно + ' из ' + await p.evaluate(()=>document.querySelectorAll('#shopGrid [data-merch]').length));
await p.evaluate(()=>document.querySelector('#shopGrid [data-merch]:not([disabled])').click());
await p.waitForTimeout(700);
console.log('сказали ребёнку: ' + await p.evaluate(()=>document.querySelector('.reward__sub, .reward p, .toast')?.textContent?.slice(0,90) || 'ничего'));
console.log('записано: ' + await p.evaluate(()=>localStorage.getItem('mt_merch')));
await p.evaluate(()=>{ document.querySelectorAll('.reward, .reward--on').forEach(э=>э.remove());
  document.querySelector('.nav__tab[data-tab="profile"]').click(); });
await p.waitForTimeout(600);
console.log('в профиле родителя: ' + await p.evaluate(()=>{
  const б=document.getElementById('wishBlock');
  return б.hidden ? 'блок скрыт' : document.getElementById('wishes').innerText.replace(/\s+/g,' ').trim().slice(0,120); }));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
