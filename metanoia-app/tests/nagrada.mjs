import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
await p.evaluate(()=>{ MAGIC.rewardModal({title:'Первое', subtitle:'раз'}); MAGIC.rewardModal({title:'Второе', subtitle:'два'}); });
await p.waitForTimeout(600);
console.log('окон на экране: ' + await p.evaluate(()=>document.querySelectorAll('.reward').length)
  + ', заголовок: ' + await p.evaluate(()=>document.querySelector('.reward__title')?.textContent));
console.log('фокус на кнопке: ' + await p.evaluate(()=>document.activeElement?.className));
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
console.log('после Escape окон: ' + await p.evaluate(()=>document.querySelectorAll('.reward').length));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
