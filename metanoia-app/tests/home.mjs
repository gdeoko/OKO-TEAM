import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(2000);
const снять = ()=>p.evaluate(()=>({
  дней: (document.getElementById('streakDays')||{}).textContent,
  зёрна: (document.getElementById('xpToday')||{}).textContent,
}));
console.log('НОВЫЙ ДЕНЬ: ' + JSON.stringify(await снять()));
await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  addSeeds(3, 'за проверку'); addSeeds(2, 'за стих');
  localStorage.setItem('mt_dverse_streak','4');
  animateHomeStats(); await пауза(1300);
});
console.log('ПОСЛЕ ЗАНЯТИЙ: ' + JSON.stringify(await снять()));
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(2200);
console.log('ПОСЛЕ ПЕРЕЗАПУСКА: ' + JSON.stringify(await снять()));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
