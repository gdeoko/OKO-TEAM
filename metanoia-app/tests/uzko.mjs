import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-gpu'] });
const p = await b.newPage({ viewport:{width:320,height:640} });
await p.route(u=>!u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1');});
await p.reload({waitUntil:'load'}); await p.waitForTimeout(1200);
let шире = 0;
for (const т of ['home','lessons','games','chats','profile']) {
  await p.evaluate((т)=>document.querySelector(`.nav__tab[data-tab="${т}"]`).click(), т);
  await p.waitForTimeout(400);
  const r = await p.evaluate(()=>({ширина: document.documentElement.scrollWidth, окно: window.innerWidth}));
  if (r.ширина > r.окно + 1) шире++;
  console.log(`${т}: страница ${r.ширина} при окне ${r.окно}` + (r.ширина > r.окно + 1 ? '  ← горизонтальная прокрутка' : ''));
}
// Замечание только тогда, когда страница шире окна: это и есть боковая
// прокрутка, из-за которой на маленьком телефоне уезжают кнопки.
console.log('ОШИБОК: ' + шире);
await b.close();
