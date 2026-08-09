import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0,300)));
await p.addInitScript(`try{ localStorage.setItem('oko-auth','tg'); localStorage.setItem('oko-onboarded','1'); localStorage.setItem('oko-stories-seen','1'); localStorage.setItem('oko-tour-done','1'); localStorage.setItem('oko-tour','1'); }catch(e){}`);
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil:'load' });
await p.waitForTimeout(2600);
const out = await p.evaluate(() => {
  const r = {};
  r.svc = [...document.querySelectorAll('#maGrid .svc')].map(b=>b.id + ' :: ' + b.textContent.trim() + ' :: ' + (b.getAttribute('onclick')||'js'));
  r.nav = [...document.querySelectorAll('nav button, .tabbar button, footer button')].map(b=>(b.getAttribute('onclick')||'')+' | '+b.textContent.trim()).slice(0,20);
  r.screens = [...document.querySelectorAll('main > .screen')].map(s=>s.id);
  r.openMa = (()=>{ try{ return String(openMa).slice(0,400); }catch(e){ return 'n/a'; } })();
  r.maViews = [...document.querySelectorAll('#screen-mini .ma-view')].map(v=>v.id);
  return r;
});
console.log(JSON.stringify(out, null, 1).slice(0, 8000));
await b.close();
