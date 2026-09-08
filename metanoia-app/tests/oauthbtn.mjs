// Кнопки входа через Google и Телеграм говорят понятное, а не «этап 1-бэк».
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('mt_onb','1');});
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1200);
for (const вид of ['google','telegram']) {
  await p.click(`[data-oauth="${вид}"]`); await p.waitForTimeout(700);
  console.log(вид + ': ' + await p.evaluate(()=>document.querySelector('.toast')?.textContent||'тоста нет'));
  await p.waitForTimeout(2600);
}
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
