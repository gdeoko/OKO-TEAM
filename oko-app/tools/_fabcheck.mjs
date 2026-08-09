import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(`window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1')}catch(e){}`);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1600);
await p.evaluate(`okoSkipAuth(); showTab('chats')`);
await p.waitForTimeout(700);
console.log(JSON.stringify(await p.evaluate(`(()=>{
  const out={vh:innerHeight};
  document.querySelectorAll('.fab, [class*="fab"]').forEach(f=>{
    const cs=getComputedStyle(f), r=f.getBoundingClientRect();
    if(cs.display==='none') return;
    out[f.className]={pos:cs.position, bottom:cs.bottom, top:Math.round(r.top), rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)], parent:f.parentElement && f.parentElement.className};
  });
  // кнопки назад на вкладках
  const hdr=document.querySelector('#screen-chats .head, header, .app-head');
  out.backOnTab = !!document.querySelector('.oko-back, .ep-back, header .back, .head .back, [data-oko-back]');
  return out;
})()`),null,2));
await b.close();
