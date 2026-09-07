// Кнопки без подписи: экранный диктор прочитает их как «кнопка» и всё.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:390,height:844} });
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');});
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1200);
const немые = await p.evaluate(()=>{
  const плохие = [];
  document.querySelectorAll('button, a[role=button]').forEach(э=>{
    const текст = (э.innerText || '').trim();
    const метка = э.getAttribute('aria-label') || э.getAttribute('title') || '';
    if (!текст && !метка) плохие.push(э.id || э.className || э.outerHTML.slice(0,60));
  });
  return плохие;
});
console.log('кнопок без подписи: ' + немые.length);
немые.slice(0,25).forEach(э=>console.log('  ' + э));
await b.close();
