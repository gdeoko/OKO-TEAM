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
const off = process.argv.includes('--off');
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await ctx.addInitScript(INIT);
if (off) await ctx.route('**/oko-back.js', r => r.fulfill({ status:200, body:'/* off */', contentType:'application/javascript' }));
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
await page.goto(BASE, { waitUntil:'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate(`okoSkipAuth(); showTab('mini'); openMa('helper');`);
await page.waitForTimeout(1000);
const a = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
await page.waitForTimeout(10000);
const b = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
console.log((off?'BEZ oko-back':'S oko-back'),
  'Script +', (b.ScriptDuration-a.ScriptDuration).toFixed(2), 's',
  '| Layout +', (b.LayoutDuration-a.LayoutDuration).toFixed(2), 's',
  '| Task +', (b.TaskDuration-a.TaskDuration).toFixed(2), 's');
await browser.close();
