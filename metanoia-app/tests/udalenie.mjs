// Удаление аккаунта описано и страницей сайта, и экраном в приложении.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8777/udalenie.html',{waitUntil:'load'});
console.log('страница: ' + JSON.stringify({ заголовок: await p.title(), разделов: await p.locator('section').count(), ширина: await p.evaluate(()=>document.documentElement.scrollWidth) }));
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1400);
const внутри = await p.evaluate(()=>{ openDoc('delete'); const b=document.getElementById('privacyBody');
  return { заголовок: b.querySelector('h1').textContent, частей: b.querySelectorAll('.doc__part').length }; });
console.log('в приложении: ' + JSON.stringify(внутри));
const ссылка = await p.evaluate(()=>{ openAbout(); return !!document.querySelector('[data-doc="delete"]'); });
console.log('ссылка в «о школе»: ' + ссылка);
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
