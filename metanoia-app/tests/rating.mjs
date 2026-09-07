import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_name','Соня'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  openRatingScreen(); await пауза(500);
  const своя=[...document.querySelectorAll('#ratingList .lb-row')].find(e=>e.className.includes('lb-row--me'));
  const снизу=(document.querySelector('#ratingList .lb-note')||{}).textContent||'';
  return { строк: document.querySelectorAll('#ratingList .lb-row').length,
    своя: своя ? (своя.innerText||'').replace(/\s+/g,' ').slice(0,60) : 'своей строки нет',
    сноска: снизу.slice(0,60) };
});
console.log(JSON.stringify(итог, null, 1));
// прибавим зёрен и посмотрим, что число живое
const после = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  petState.зёрна = 500; savePet();
  openRatingScreen(); await пауза(400);
  const своя=[...document.querySelectorAll('#ratingList .lb-row')].find(e=>e.className.includes('lb-row--me'));
  const место=[...document.querySelectorAll('#ratingList .lb-row')].indexOf(своя)+1;
  return { своя: (своя.innerText||'').replace(/\s+/g,' ').slice(0,50), место };
});
console.log('С 500 ЗЁРНАМИ: ' + JSON.stringify(после));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
