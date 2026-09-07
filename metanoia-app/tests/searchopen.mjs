// Найденное должно открываться: урок, игра, проверка знаний.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_music_off','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  const открыт=()=>{ let э=''; document.querySelectorAll('[data-screen]').forEach(e=>{ if(!e.hidden && getComputedStyle(e).display!=='none') э=e.dataset.screen; }); return э; };
  const шаги={};
  const искать = async (слово)=>{
    document.querySelector('#searchBtn, [aria-label*="оиск"], .hd__search').click(); await пауза(400);
    const поле=document.getElementById('searchInput');
    поле.value=слово; поле.dispatchEvent(new Event('input',{bubbles:true})); await пауза(600);
    const первый=document.querySelector('#searchResults .sr');
    if(!первый) return 'не нашлось';
    первый.click(); await пауза(900);
    return открыт() + ' | ' + (((document.getElementById('toast')||{}).textContent)||'').slice(0,50);
  };
  шаги['первый урок'] = await искать('Пророчества');
  шаги['дальний урок'] = await искать('Крещение');
  шаги['игра'] = await искать('мемори');
  шаги['проверка знаний'] = await искать('Проверка');
  return шаги;
});
console.log(JSON.stringify(итог, null, 1));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
