// Приглашение второму родителю кладёт в буфер настоящую ссылку.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, permissions:['clipboard-read','clipboard-write'] });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
await p.evaluate(()=>shareInvite());
await p.waitForTimeout(900);
console.log('ТОСТ: ' + (await p.evaluate(()=>(document.getElementById('toast')||{}).textContent||'')).slice(0,60));
console.log('В БУФЕРЕ: ' + (await p.evaluate(()=>navigator.clipboard.readText().catch(()=>'нет доступа'))).replace(/\n/g,' | ').slice(0,140));
console.log('ОШИБОК: ' + errs.length);
await b.close();
