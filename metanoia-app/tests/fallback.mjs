// Уроки глав 2 и 3 пока без своих обложек: должна подставляться обложка главы.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(600);
await p.evaluate(()=>document.querySelector('.nav__tab[data-tab="lessons"]').click());
await p.waitForTimeout(900);
const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  // прокручиваем до уроков второй главы, чтобы ленивые картинки загрузились
  const все=[...document.querySelectorAll('.lesson-item')];
  const второй=все.find(e=>Number(e.dataset.n)>=40 && e.className.includes("lesson-item--b2"));
  if(!второй) return 'уроков второй главы не видно';
  второй.scrollIntoView(); await пауза(1500);
  const img=второй.querySelector('img');
  return { адрес:(img.currentSrc||img.src||'').split('/').slice(-2).join('/'), ширина: img.naturalWidth };
});
console.log('ОБЛОЖКА УРОКА ВТОРОЙ ГЛАВЫ: ' + JSON.stringify(итог));
console.log('ОШИБОК: ' + errs.length);
await b.close();
