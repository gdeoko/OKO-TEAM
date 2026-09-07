// Escape закрывает окна, из которых иначе можно не выбраться.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');
  localStorage.setItem('mt_kids','[{"name":"Соня","age":8,"img":"","лид":"k1"}]');});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
const окна = [
  ['стих дня', ()=>openDailyVerse(), '#dailyVerse'],
  ['добавить ребёнка', ()=>openAddChild(), '#addChild'],
  ['конец игры', ()=>завершитьИгру('memory', 10, 'Тест', 'Тест'), '#gameEnd'],
  ['уведомления', ()=>document.getElementById('bellBtn').click(), '#notifPanel'],
];
for (const [имя, действие, сел] of окна) {
  await p.evaluate(действие).catch(()=>{});
  await p.waitForTimeout(500);
  const открыто = await p.evaluate((с)=>{ const э=document.querySelector(с); return !!э && !э.hidden; }, сел);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  const закрыто = await p.evaluate((с)=>{ const э=document.querySelector(с); return !э || э.hidden; }, сел);
  console.log(`${имя}: открылось=${открыто}, Escape закрыл=${закрыто}`);
}
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
