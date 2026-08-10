import { chromium } from 'playwright-core';
import { CLEAN_START } from './clean-start.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(CLEAN_START);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3000);
console.log(await p.evaluate(`(()=>{
  const имена = Object.getOwnPropertyNames(window).filter(k=>{
    try{ return typeof window[k]==='function' && /(open|show|goto|view|page)/i.test(k); }catch(e){ return false; }
  });
  return имена.map(k=>k+'/'+window[k].length).sort().join('  ');
})()`));
await b.close();
