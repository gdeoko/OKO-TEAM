import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  if (typeof openDevotional === 'function') { /* другой экран */ }
  const имена = Object.keys(window).filter(k=>/verse/i.test(k) && typeof window[k]==='function');
  const открыть = window.openDailyVerse || window.openDverse || null;
  if (открыть) открыть(); else {
    const к=[...document.querySelectorAll('button, .card, [id]')].find(e=>/стих дня/i.test((e.innerText||'')));
    if (к) к.click();
  }
  await пауза(900);
  const a=document.getElementById('dverseAudio');
  const b=document.getElementById('dverseListen');
  if (b && !b.hidden) b.click();
  await пауза(2500);
  return { функции: имена.slice(0,6), экранВидно: !document.getElementById('dailyVerse').hidden,
    адрес:(a.currentSrc||a.getAttribute('src')||'').split('/').pop(), время:+a.currentTime.toFixed(2),
    пауза:a.paused, ошибка: a.error ? a.error.code : 'нет' };
});
console.log('СТИХ ДНЯ: ' + JSON.stringify(итог));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
