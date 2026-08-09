import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:8199/index.html';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await ctx.addInitScript(`
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
    var o=document.getElementById('onboard'); if(o){o.classList.add('hidden'); o.style.display='none';}
  };
  try{ localStorage.setItem('oko-onboard-done','1'); localStorage.setItem('oko-stories-seen','1');
       localStorage.setItem('oko-tour-done','1'); localStorage.setItem('oko-tour','1');
       localStorage.setItem('okg-state-v1', JSON.stringify({off:{onboarding:1,anketa:1,videofree:1,partner:1,lesson:1,expiring:1},ob:{collapsed:true,closed:true}}));
  }catch(e){}
`);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,300)));
page.on('console', m => { if (m.type()==='error' && !/Failed to load resource|net::/.test(m.text())) console.log('CONSOLE', m.text().slice(0,200)); });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1700);
await page.evaluate(`okoSkipAuth(); showTab('chats');`);
await page.waitForTimeout(500);
await page.evaluate(`const r=document.querySelector('#chatList .ci, #chatList > *'); r&&r.click();`);
await page.waitForTimeout(700);

const dump = async (label) => {
  const d = await page.evaluate(`(()=>{
    const b=document.getElementById('okoEmBtn');
    const cb=document.querySelector('#convBody .composer');
    const conv=document.getElementById('convBody');
    const r=b?b.getBoundingClientRect():null;
    const cs=b?getComputedStyle(b):null;
    return {
      btn: b? {display:cs.display, vis:cs.visibility, op:cs.opacity, w:r.width,h:r.height,top:r.top,left:r.left, style:b.getAttribute('style')} : 'нет',
      composerCls: cb? cb.className : 'нет',
      composerDisplay: cb? getComputedStyle(cb).display : 'нет',
      composerRect: cb? {top:cb.getBoundingClientRect().top, h:cb.getBoundingClientRect().height} : null,
      composerHTML: cb? cb.innerHTML.slice(0,260) : '',
      convBody: conv? getComputedStyle(conv).display : 'нет',
      panelH: document.getElementById('okoEm')?.getBoundingClientRect().height,
      open: window.okoEmoji ? okoEmoji.isOpen() : 'нет api',
      htmlCls: document.documentElement.className,
      scrims: [...document.querySelectorAll('.okg-scrim,.sheet.open,#sheetOverlay')].map(n=>n.className)
    };
  })()`);
  console.log(label, JSON.stringify(d, null, 1));
};
await dump('A после открытия чата');
await page.click('#msgInput'); await page.waitForTimeout(300);
await dump('B после фокуса поля');
await page.click('#okoEmBtn'); await page.waitForTimeout(500);
await dump('C панель открыта');
await page.click('#msgInput'); await page.waitForTimeout(500);
await dump('D после тапа в поле');
await browser.close();
