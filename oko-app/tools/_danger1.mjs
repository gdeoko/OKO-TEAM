/* Кто именно на экране диалога называется «Выйти» и что он делает. */
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(`window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-tour-done','1')}catch(e){}`);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2000);
await p.evaluate('okoSkipAuth()');
await p.evaluate(`showTab('chats'); (document.querySelector('#chatList .ci, #chatList > *')||{click(){}}).click()`);
await p.waitForTimeout(900);

const r = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('button, [role="button"], .prow, .soc-mini, .pp2-row, .st2-row').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const rc = el.getBoundingClientRect();
    if (rc.width < 8 || rc.height < 8) return;
    const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/^выйти$|^выход$/i.test(label)) return;
    let par = el.parentElement, chain = [];
    for (let i = 0; par && i < 5; par = par.parentElement, i++)
      chain.push(par.tagName.toLowerCase() + (par.id ? '#' + par.id : '') + (par.className && typeof par.className === 'string' ? '.' + par.className.trim().split(/\s+/)[0] : ''));
    out.push({
      label, tag: el.tagName, cls: el.className, id: el.id,
      onclick: el.getAttribute('onclick') || (el.onclick ? '[js-handler]' : '(нет)'),
      предки: chain.join(' < '),
      экран: rc.top + 'x' + rc.left
    });
  });
  return out;
});
console.log(JSON.stringify(r, null, 2));
await b.close();
