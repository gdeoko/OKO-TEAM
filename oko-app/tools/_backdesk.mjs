import { chromium } from 'playwright-core';
const BASE = 'http://127.0.0.1:8199/index.html';
const INIT = `
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
  };
  try{ localStorage.setItem('oko-onboard-done','1'); localStorage.setItem('oko-stories-seen','1');
       localStorage.setItem('oko-tour-done','1'); localStorage.setItem('oko-tour','1'); }catch(e){}
`;
const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
const ctx = await browser.newContext({ viewport:{width:1440,height:900}, reducedMotion:'reduce' });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
for (const [id, step] of [['desk-academy',`okoSkipAuth(); showTab('academy');`],
                          ['desk-helper', `okoSkipAuth(); showTab('mini'); openMa('helper');`],
                          ['desk-feed',   `okoSkipAuth(); showTab('feed');`]]) {
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);
  try { await page.evaluate(step); } catch(e){}
  await page.waitForTimeout(800);
  const info = await page.evaluate(`(() => {
    const b = document.querySelector('button.oko-back.oko-hdr-back');
    if (!b) return 'нет кнопки';
    const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
    return { parent: b.parentElement.tagName + '#' + b.parentElement.id, hidden: b.hidden,
             x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
             disp: cs.display };
  })()`);
  console.log(id, JSON.stringify(info));
  await page.screenshot({ path: `oko-app/tools/back-shots/${id}.png`, clip:{x:0,y:0,width:700,height:260} });
}
await browser.close();
