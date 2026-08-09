import { chromium } from 'playwright-core';
import { CLEAN_START } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2500);
await p.evaluate(`okoSkipAuth()`);
for (const n of [2,3,4,5]) {
  const r = await p.evaluate(`(()=>{ try{ adsStep(${n}); return 'ок'; }catch(e){ return 'ПАДЕНИЕ: ' + (e.stack||String(e)).split('\\n').slice(0,4).join(' | '); } })()`);
  console.log('adsStep(' + n + '):', String(r).slice(0, 300));
}
await b.close();
