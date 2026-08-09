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
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],
});
const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, reducedMotion:'reduce' });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('  PAGEERROR', String(e).slice(0,160)));

const DUMP = `(() => {
  const out = { epHeads: [], epCancels: [], allBack: [] };
  document.querySelectorAll('.ep-head').forEach(b => {
    const r = b.getBoundingClientRect();
    out.epHeads.push({ parent: b.parentElement ? (b.parentElement.id || b.parentElement.className) : '',
      html: b.innerHTML.slice(0, 200).replace(/\\s+/g,' '), w: Math.round(r.width), h: Math.round(r.height) });
  });
  document.querySelectorAll('.ep-cancel').forEach(b => {
    const r = b.getBoundingClientRect();
    out.epCancels.push({ cls: b.className, oko: b.dataset.okoBack || '', w: Math.round(r.width), h: Math.round(r.height),
      x: Math.round(r.left), y: Math.round(r.top), disp: getComputedStyle(b).display });
  });
  document.querySelectorAll('button.oko-back').forEach(b => {
    const r = b.getBoundingClientRect();
    if (r.width > 0) out.allBack.push({ cls: b.className, x: Math.round(r.left), y: Math.round(r.top) });
  });
  return out;
})()`;

for (const [name, step] of [
  ['editprof', `okoSkipAuth(); showTab('profile'); openEdit();`],
  ['search',   `okoSkipAuth(); openSearch();`],
]) {
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);
  try { await page.evaluate(step); } catch(e){ console.log('step err', String(e).slice(0,120)); }
  await page.waitForTimeout(800);
  console.log('==', name, JSON.stringify(await page.evaluate(DUMP), null, 1).slice(0, 2600));
}
await browser.close();
