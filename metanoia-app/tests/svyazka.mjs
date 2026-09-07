// Испорченная связка ребёнка не должна ронять приложение.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня',age:8,img:'',лид:'k1'},{name:'Пётр',age:6,img:'',лид:'k2'}]));
  localStorage.setItem('mt_active_kid','k1');
  localStorage.setItem('mt_bucket_k2','это не json{{{');   // испорчено
  localStorage.setItem('mt_lesson_1','{"read":true,"task":true,"test":true,"done":true,"ts":1}'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(400);
const к = await p.$$('#children .child-card');
await к[1].click();
await p.waitForTimeout(2500);
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
console.log('после переключения на испорченную связку: ' + JSON.stringify(await p.evaluate(()=>({
  активный: localStorage.getItem('mt_active_kid'),
  урок1: localStorage.getItem('mt_lesson_1'),
  экран: document.querySelector('.screen--active')?.dataset.screen,
  связкаСони: !!localStorage.getItem('mt_bucket_k1') }))));
// возвращаемся, прогресс Сони должен быть цел
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="profile"]').click());
await p.waitForTimeout(400);
const к2 = await p.$$('#children .child-card');
await к2[0].click();
await p.waitForTimeout(2500);
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
console.log('обратно к Соне: урок1 = ' + await p.evaluate(()=>localStorage.getItem('mt_lesson_1')));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
