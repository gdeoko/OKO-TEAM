import { chromium } from 'playwright-core';
import { CLEAN_START } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
p.on('pageerror', e => console.log('ОШИБКА:', String(e).split('\n')[0].slice(0,110)));
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate(`okoSkipAuth(); showTab('chats')`);
await p.waitForTimeout(900);
for (let i=0;i<5;i++){
  await p.evaluate(`(()=>{ if(typeof closeConv==='function') closeConv(); })()`).catch(()=>{});
  await p.evaluate(`(()=>{var r=[...document.querySelectorAll('#chatList .ci, #chatList > *')][${i}]; r&&r.click();})()`);
  await p.waitForTimeout(600);
  console.log(await p.evaluate(`(()=>{
    var st=document.getElementById('convStatus');
    return (typeof currentChat!=='undefined'&&currentChat ? currentChat.kind+' · '+currentChat.name : '-') + '  →  подпись: «' + (st?st.textContent:'?') + '»';
  })()`));
}
await b.close();
