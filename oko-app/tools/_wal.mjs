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
const t = (m) => console.log(`[${((Date.now()-T0)/1000).toFixed(1)}s] ${m}`);
const T0 = Date.now();
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],
});
const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, reducedMotion:'reduce' });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR', String(e).slice(0,120)));
t('launched');
await page.goto(BASE, { waitUntil:'domcontentloaded', timeout: 60000 });
t('goto done');
await page.waitForTimeout(1000);
await page.evaluate(`okoSkipAuth(); showTab('wallet');`);
t('showTab wallet done');
await page.waitForTimeout(700);
t('waited');
const n = await page.evaluate(`document.querySelectorAll('button,a').length`, { timeout: 30000 });
t('buttons on page: ' + n);
const r = await page.evaluate(`(() => {
  const t0 = performance.now();
  let c = 0;
  document.querySelectorAll('button.oko-back').forEach(el => { c++; getComputedStyle(el); });
  return { c, ms: +(performance.now()-t0).toFixed(1) };
})()`, { timeout: 30000 });
t('oko-back buttons: ' + JSON.stringify(r));
const s = await page.evaluate(`(() => {
  const t0 = performance.now();
  const VW=innerWidth, VH=innerHeight;
  const shown = el => { let n=el; while(n&&n.nodeType===1){ const cs=getComputedStyle(n);
    if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return false; n=n.parentElement;}
    const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
  let k=0; document.querySelectorAll('button, a').forEach(el=>{ if(shown(el)) k++; });
  return { k, ms:+(performance.now()-t0).toFixed(1) };
})()`, { timeout: 60000 });
t('shown scan: ' + JSON.stringify(s));
await browser.close();
t('closed');
