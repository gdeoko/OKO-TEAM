// На бланке и в отчёте должно стоять имя ребёнка, а не родителя.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_name','Мария');   // имя родителя, как после регистрации
  localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня',age:8,img:''},{name:'Пётр',age:6,img:''}])); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(900);
console.log('на бланке: ' + await p.evaluate(()=>именаДляСертификата()));
console.log('в отчёте: ' + await p.evaluate(()=>недельныйОтчёт().child));
// передаём устройство Петру
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(400);
const к = await p.$$('#children .child-card');
await к[1].click();
await p.waitForTimeout(2500);
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
console.log('после передачи, на бланке: ' + await p.evaluate(()=>именаДляСертификата()));
console.log('шапка профиля: ' + await p.evaluate(()=>document.querySelector('.profile-head__name').textContent));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
