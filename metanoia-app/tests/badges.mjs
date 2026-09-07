import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids', JSON.stringify([{name:'Соня',age:8,img:''}])); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
const пусто = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  openChild(DEMO.children[0]); await пауза(500);
  const все=[...document.querySelectorAll('#childBadges .badge-card')];
  return { всего: все.length, получено: все.filter(e=>!e.className.includes('locked')).length,
    первый: ((все[0]||{}).innerText||'').replace(/\s+/g,' ').slice(0,50) };
});
console.log('НОВЫЙ РЕБЁНОК: ' + JSON.stringify(пусто));
const после = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  // проходим пять уроков, ставим серию 7 дней, пишем сообщение
  for (let n=1;n<=5;n++) localStorage.setItem('mt_lesson_'+n, JSON.stringify({read:true,task:true,test:true,done:true,ts:Date.now()}));
  localStorage.setItem('mt_dverse_streak','7');
  localStorage.setItem('mt_msgs2', JSON.stringify({1:[{text:'Привет'}]}));
  openChild(DEMO.children[0]); await пауза(500);
  const все=[...document.querySelectorAll('#childBadges .badge-card')];
  return { получено: все.filter(e=>!e.className.includes('locked')).length,
    имена: все.filter(e=>!e.className.includes('locked')).map(e=>(e.innerText||'').split('\n')[0]) };
});
console.log('ПОСЛЕ ЗАНЯТИЙ: ' + JSON.stringify(после));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
