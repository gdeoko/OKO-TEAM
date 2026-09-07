// Проверка работы без сети: приложение должно открыться из памяти телефона.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
const рег = await p.evaluate(async ()=>{ const r = await navigator.serviceWorker.ready; return !!r.active; });
console.log('РАБОТНИК ЗАПУЩЕН: ' + рег);
await p.reload({waitUntil:'load'});
await p.waitForTimeout(2500);
// имитируем отсутствие сети
await ctx.setOffline(true);
await p.reload({waitUntil:'load'}).catch(e=>console.log('перезагрузка без сети: ' + e.message.slice(0,60)));
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
const видно = await p.evaluate(()=>({
  уроки: !!document.querySelector('.nav__tab[data-tab="lessons"]'),
  шапка: (document.querySelector('h1,h2,.hd__title')||{}).textContent || '',
  стили: getComputedStyle(document.body).backgroundColor,
}));
console.log('БЕЗ СЕТИ: ' + JSON.stringify(видно));
await p.screenshot({path:'shot-offline.png'});
console.log('ОШИБКИ: ' + errs.length); errs.slice(0,4).forEach(e=>console.log(e));
await b.close();
