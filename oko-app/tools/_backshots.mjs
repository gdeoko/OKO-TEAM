import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
const BASE = 'http://127.0.0.1:8199/index.html';
const OUT = 'oko-app/tools/back-shots';
const INIT = `
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
  };
  try{ localStorage.setItem('oko-onboard-done','1'); localStorage.setItem('oko-stories-seen','1');
       localStorage.setItem('oko-tour-done','1'); localStorage.setItem('oko-tour','1'); }catch(e){}
`;
const SHOTS = [
  ['academy',  `okoSkipAuth(); showTab('academy');`],
  ['ac-course',`okoSkipAuth(); showTab('academy'); acOpenCourse(0);`],
  ['ma-helper',`okoSkipAuth(); showTab('mini'); openMa('helper');`],
  ['ma-market',`okoSkipAuth(); showTab('mini'); try{openMa('market')}catch(e){}`],
  ['ton',      `okoSkipAuth(); showTab('ton');`],
  ['ads',      `okoSkipAuth(); showTab('ads');`],
  ['legal',    `okoSkipAuth(); openLegalDoc('terms');`],
  ['w2-hist',  `okoSkipAuth(); showTab('wallet'); w2Open('history');`],
  ['sheet',    `okoSkipAuth(); showTab('feed'); openSheet('npost');`],
  ['settings', `okoSkipAuth(); showTab('profile'); st2Open();`],
];
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],
});
const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true, reducedMotion:'reduce', deviceScaleFactor:2 });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
for (const [id, step] of SHOTS) {
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1100);
  try { await page.evaluate(step); } catch(e) { console.log(id, 'step err', String(e).slice(0,80)); }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${id}.png`, clip: { x:0, y:0, width:390, height:300 } });
  console.log('shot', id);
}
await browser.close();
