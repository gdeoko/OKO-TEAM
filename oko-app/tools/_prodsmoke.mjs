import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const p = await (await b.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true})).newPage();
const bad = [];
p.on('response', r => { if(r.status() >= 400) bad.push(r.status()+' '+r.url().slice(0,70)); });
p.on('pageerror', e => bad.push('JS: '+String(e).split('\n')[0].slice(0,110)));
try { await p.goto('https://okoteam.top/', {waitUntil:'domcontentloaded', timeout:60000}); }
catch(e){ console.log('НЕ ОТКРЫЛСЯ:', String(e).slice(0,120)); await b.close(); process.exit(0); }
await p.waitForTimeout(6000);
console.log(await p.evaluate(`({
  слоёвЗагружено: [...document.querySelectorAll('script[src*="media/app/"]')].length,
  окоRec: typeof window.okoRec,
  окоSocial: typeof window.okoSocial,
  a11y: !!window.__okoA11yLoaded,
  звонки: typeof window.oklCall !== 'undefined' || typeof window.clCallStart !== 'undefined',
  сборка: (document.querySelector('[data-build]')||{}).textContent || '(нет)'
})`));
console.log('проблемы:', bad.slice(0,10));
await b.close();
