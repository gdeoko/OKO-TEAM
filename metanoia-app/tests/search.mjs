// Поиск по школе: находит ли уроки, игры и людей.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
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
  const лупа = document.querySelector('#searchBtn, [aria-label*="оиск"], .hd__search');
  if (!лупа) return 'лупы нет';
  лупа.click(); await пауза(600);
  const поле = document.querySelector('#searchInput, [data-screen="search"] input, .search input');
  if (!поле) return 'поля поиска нет';
  const ответы = {};
  for (const слово of ['Рождение', 'Крещение', 'Авраам', 'мемори', 'детектив', 'проверка', 'ыыыы']) {
    поле.value = слово;
    поле.dispatchEvent(new Event('input', {bubbles:true}));
    await пауза(700);
    const рез = document.querySelectorAll('#searchResults > *, .search__res > *, [data-screen="search"] .res-item');
    ответы[слово] = рез.length + (рез.length ? ' | ' + (рез[0].innerText||'').replace(/\s+/g,' ').slice(0,40) : '');
  }
  return ответы;
});
console.log('ПОИСК: ' + JSON.stringify(итог, null, 1));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
