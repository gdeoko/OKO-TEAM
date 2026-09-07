// Сертификат принадлежит тому ребёнку, который сдал проверку.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня',age:8,img:''},{name:'Пётр',age:6,img:''}])); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
const бланки = () => p.evaluate(()=>({
  имя: именаДляСертификата(),
  карточки: certРазмечен().map(c=>c.earned ? 'получен' : 'закрыт'),
}));
await p.evaluate(()=>localStorage.setItem('mt_exam_0', JSON.stringify({pct:90, ts:Date.now()})));
console.log('Соня сдала: ' + JSON.stringify(await бланки()));
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(400);
const к = await p.$$('#children .child-card');
await к[1].click();
await p.waitForTimeout(2500);
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
console.log('у Петра: ' + JSON.stringify(await бланки()));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
