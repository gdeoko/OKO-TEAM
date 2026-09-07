import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');});
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
await p.evaluate(()=>{ openAbout(); });
await p.waitForTimeout(400);
console.log('подпись: ' + await p.evaluate(()=>document.querySelector('.about-ver')?.innerText.replace(/\s+/g,' ').trim() || 'нет'));
// ссылки открывают документы внутри приложения
await p.evaluate(()=>document.querySelector('.about-ver [data-doc="terms"]').click());
await p.waitForTimeout(500);
console.log('открылось: ' + await p.evaluate(()=>({адрес: location.pathname, экран: document.querySelector('.screen--active')?.dataset.screen, заголовок: document.querySelector('#privacyBody h1, #docTitle, .doc__title')?.textContent || ''})).then(JSON.stringify));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
