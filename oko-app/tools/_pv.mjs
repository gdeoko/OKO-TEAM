import { chromium } from 'playwright-core';
import { CLEAN_START, CLOSE_OVERLAYS } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate(`okoSkipAuth(); showTab('chats')`);
await p.waitForTimeout(1000);
const чаты = await p.evaluate(`(()=>[...document.querySelectorAll('#chatList .ci, #chatList > *')].map(function(e){return (e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40);}).slice(0,8))()`);
console.log('чаты:', чаты);
for (let i = 0; i < Math.min(4, чаты.length); i++) {
  await p.evaluate(`(()=>{ if(typeof closeConv==='function') closeConv(); })()`).catch(()=>{});
  await p.evaluate(`(()=>{var r=[...document.querySelectorAll('#chatList .ci, #chatList > *')][${i}]; r&&r.click();})()`);
  await p.waitForTimeout(700);
  await p.evaluate(`(()=>{ if(typeof openProfile==='function') openProfile(); })()`).catch(()=>{});
  await p.waitForTimeout(900);
  console.log(i, JSON.stringify(await p.evaluate(`(()=>{
    var pv = document.getElementById('profileView');
    var видна = pv && pv.offsetParent !== null && (pv.innerHTML||'').length > 20;
    var t = document.body.innerText;
    return { шторкаЯдра: !!видна,
             фейкВидим: /Медиа 24|Файлы 8|Ссылки 12|34\\.2к|\\+840|6\\.2%/.test(t),
             чат: (typeof currentChat!=='undefined'&&currentChat) ? (currentChat.kind+':'+currentChat.name) : '-' };
  })()`)));
  await p.keyboard.press('Escape').catch(()=>{});
  await p.waitForTimeout(300);
}
await b.close();
