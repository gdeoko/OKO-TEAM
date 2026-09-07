// Сертификат должен открываться только после проверки знаний главы.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_name','Мария'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);
const чисто = await p.evaluate(()=>{ openCertificates(); return [...document.querySelectorAll('#certGrid .cert-card')].map(e=>e.className.includes('earned')?'получен':'закрыт'); });
console.log('БЕЗ ПРОВЕРКИ ЗНАНИЙ: ' + JSON.stringify(чисто));
const после = await p.evaluate(()=>{
  localStorage.setItem('mt_exam_0', JSON.stringify({pct:90, ts: Date.parse('2026-09-05')}));
  openCertificates();
  const карточки=[...document.querySelectorAll('#certGrid .cert-card')].map(e=>e.className.includes('earned')?'получен':'закрыт');
  document.querySelector('#certGrid [data-cert="b1"]').click();
  const svg=(document.querySelector('#certStage')||{}).innerHTML||'';
  const имя=(svg.match(/>([^<>]{2,30})</g)||[]).filter(x=>/Мария/.test(x));
  return { карточки, имяНаБланке: имя.length>0, естьДата: /сентября 2026/.test(svg) };
});
console.log('ПОСЛЕ ПРОВЕРКИ: ' + JSON.stringify(после));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
