import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking'] });
const p = await b.newPage({ viewport:{width:900,height:1200} });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
for (const f of ['policy.html','terms.html']) {
  await p.goto('http://127.0.0.1:8777/'+f, {waitUntil:'load'});
  await p.waitForTimeout(600);
  const s = await p.evaluate(()=>({ заголовок: document.title, разделов: document.querySelectorAll('section').length, ширина: document.body.scrollWidth }));
  console.log(f + ': ' + JSON.stringify(s));
  await p.screenshot({path:'shot-'+f.replace('.html','')+'.png'});
}
console.log('ОШИБОК: ' + errs.length);
await b.close();
