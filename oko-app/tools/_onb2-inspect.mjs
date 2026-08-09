import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:390,height:844} });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0,300)));
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil:'load' });
await p.waitForTimeout(3200);
const snap = async (tag) => {
  const s = await p.evaluate(() => ({
    auth: (()=>{ const a=document.getElementById('authScreen'); return a? (a.classList.contains('hidden')?'hidden':'visible'):'none'; })(),
    splash: (()=>{ const a=document.getElementById('splash'); return a? (a.classList.contains('gone')?'gone':'visible'):'removed'; })(),
    onboard: (()=>{ const a=document.getElementById('onboard'); return a? (a.classList.contains('hidden')?'hidden':'visible'):'none'; })(),
    rg2: !!document.querySelector('#rg2Shell.open'),
    ls: Object.keys(localStorage),
    topText: (document.body.innerText||'').slice(0,300).replace(/\n+/g,' | ')
  }));
  console.log(tag, JSON.stringify(s).slice(0,700));
  await p.screenshot({ path: `/home/user/OKO-TEAM/oko-app/tools/_base-${tag}.png` });
};
await snap('01-auth');
// tap google
await p.evaluate(() => doLogin('google'));
await p.waitForTimeout(1500);
await snap('02-after-google');
await b.close();
