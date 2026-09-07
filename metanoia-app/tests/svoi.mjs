// У каждого ребёнка свой прогресс на одном устройстве.
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
await p.waitForTimeout(900);

const состояние = () => p.evaluate(()=>({
  активный: (памятьЧитать('mt_kids',[]).find(k=>String(k.лид)===String(localStorage.getItem('mt_active_kid')))||{}).name,
  урок1: !!localStorage.getItem('mt_lesson_1'),
  урок2: !!localStorage.getItem('mt_lesson_2'),
  зёрна: (JSON.parse(localStorage.getItem('mt_pet')||'{}').зёрна)||0,
  связки: Object.keys(localStorage).filter(k=>k.startsWith('mt_bucket_')).length,
}));
console.log('старт: ' + JSON.stringify(await состояние()));

// Соня проходит первый урок и набирает зёрна
await p.evaluate(()=>{ localStorage.setItem('mt_lesson_1', JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()}));
  localStorage.setItem('mt_pet', JSON.stringify({вид:'lamb', зёрна:40})); });
console.log('Соня позанималась: ' + JSON.stringify(await состояние()));

// передаём устройство Петру
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(400);
const карточки = await p.$$('#children .child-card');
console.log('карточек: ' + карточки.length);
await карточки[1].click();
await p.waitForTimeout(2500);
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(900);
console.log('после передачи Петру: ' + JSON.stringify(await состояние()));

// Пётр проходит второй урок
await p.evaluate(()=>{ localStorage.setItem('mt_lesson_2', JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()}));
  localStorage.setItem('mt_pet', JSON.stringify({вид:'lamb', зёрна:7})); });
console.log('Пётр позанимался: ' + JSON.stringify(await состояние()));

// возвращаем Соне
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(400);
const к2 = await p.$$('#children .child-card');
await к2[0].click();
await p.waitForTimeout(2500);
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(900);
console.log('обратно к Соне: ' + JSON.stringify(await состояние()));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await b.close();
