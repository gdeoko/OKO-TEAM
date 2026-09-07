// Прогресс по главам на экране ребёнка считается по настоящим урокам.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids','[{"name":"Соня","age":8,"img":""}]'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
const строки = () => p.evaluate(()=>{ openChild(DEMO.children[0]);
  return [...document.querySelectorAll('#childBlocks .blockp')].map(э=>э.innerText.replace(/\s+/g,' ').trim()); });
console.log('у нового ребёнка: ' + JSON.stringify(await строки()));
await p.evaluate(()=>{ [1,2,3].forEach(n=>saveLessonState(n,{read:true,task:true,test:true,done:true,ts:Date.now()})); });
console.log('после трёх уроков: ' + JSON.stringify(await строки()));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
