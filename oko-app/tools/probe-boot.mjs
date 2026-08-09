/* Дымовой тест: приложение поднимается без ошибок, все вкладки открываются. */
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(`window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1')}catch(e){}`);
const p = await c.newPage();
const errs = [], net404 = [];
p.on('pageerror', e => errs.push(String(e).slice(0,200)));
p.on('console', m => { if (m.type()==='error') errs.push('console: ' + m.text().slice(0,200)); });
p.on('response', r => { if (r.status()===404) net404.push(new URL(r.url()).pathname); });
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1800);
const tabs = ['feed','chats','mini','wallet','profile','partner','academy','games','ads','ton'];
for (const t of tabs){ await p.evaluate(`okoSkipAuth(); showTab('${t}')`); await p.waitForTimeout(320); }
const mas = ['system','factory','video','market','helper','socials'];
for (const m of mas){ await p.evaluate(`showTab('mini'); try{openMa('${m}')}catch(e){}`); await p.waitForTimeout(320); }
console.log(JSON.stringify({
  errors: [...new Set(errs)].slice(0,12),
  missing: [...new Set(net404)],
  tabsOk: await p.evaluate(`!!document.querySelector('main > .screen.active')`)
}, null, 2));
await b.close();
