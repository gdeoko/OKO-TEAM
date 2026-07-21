// Быстрая проверка: жива ли IG-сессия (залогинен ли) — НЕ по роликам (новый аккаунт пуст).
// Печатает ALIVE <who> или DEAD. Env: IG_STATE.
import { chromium } from 'patchright';
import fs from 'fs';
const STATE=process.env.IG_STATE||'/opt/oko-poster/cfg/ig_state.json';
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({storageState:fs.existsSync(STATE)?STATE:undefined,
  viewport:{width:1280,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US'});
const p=await ctx.newPage();
try{
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>{});
  await new Promise(r=>setTimeout(r,5000));
  const home=await p.$('svg[aria-label="Home"], a[href="/direct/inbox/"], a[href*="/accounts/edit"]').then(e=>!!e).catch(()=>false);
  const who=await p.evaluate(()=>{const a=[...document.querySelectorAll('a')].map(x=>x.getAttribute('href')).find(h=>h&&/^\/[a-z0-9._]+\/$/.test(h)&&!/explore|reels|direct|accounts|popular/.test(h));return a?a.replace(/\//g,''):'?';}).catch(()=>'?');
  console.log(home ? ('ALIVE '+who) : 'DEAD');
}catch(e){ console.log('DEAD'); }
finally{ await ctx.close(); await b.close(); }
