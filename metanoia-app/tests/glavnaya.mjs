// Главная у нового ребёнка не должна показывать чужие 12 дней и 45 очков.
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
await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(()=>({
  серия: document.getElementById('streakDays').textContent,
  очкиСегодня: document.getElementById('xpToday').textContent,
  урокНомер: document.getElementById('todayLessonNum').textContent,
  колокол: document.getElementById('bellBadge').textContent + (document.getElementById('bellBadge').hidden ? ' (скрыт)' : ''),
  чаты: document.getElementById('chatsBadge').textContent + (document.getElementById('chatsBadge').hidden ? ' (скрыт)' : ''),
})), null, 1));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
