// Ре-логин IG со stealth (patchright) -> сохраняет storageState в ig_state.json (файл постера).
// Env: TAPPIO_IG_LOGIN, TAPPIO_IG_PASSWORD, IG_CODE (6 цифр 2FA, если потребуется).
// Печатает: LOGGED_IN / NEED_2FA / CHECKPOINT / FAIL <url>.
import { chromium } from 'patchright';
import fs from 'fs';
const U=process.env.TAPPIO_IG_LOGIN, P=process.env.TAPPIO_IG_PASSWORD, CODE=(process.env.IG_CODE||'').trim();
const OUT='/opt/oko-poster/cfg/ig_state.json';
const log=(...a)=>console.log('[relogin]',...a);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1280,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US', timezoneId:'Europe/Rome'});
const p=await ctx.newPage();
const isHome=async()=>await p.$('svg[aria-label="Home"], a[href="/direct/inbox/"], a[href*="/accounts/edit"]').then(e=>!!e).catch(()=>false);
try{
  await p.goto('https://www.instagram.com/accounts/login/',{waitUntil:'domcontentloaded',timeout:45000});
  await sleep(4000);
  if(await isHome()){ log('ALREADY_HOME'); await ctx.storageState({path:OUT}); log('LOGGED_IN saved'); await b.close(); process.exit(0); }
  await p.waitForSelector('input[name="email"]',{timeout:20000}).catch(()=>{});
  await p.fill('input[name="email"]',U).catch(()=>{});
  await p.fill('input[name="pass"]',P).catch(()=>{});
  await sleep(600);
  await (await p.$('button[type="submit"]'))?.click().catch(()=>{});
  log('submitted'); await sleep(9000);
  const url=p.url(); log('url', url);
  if(await isHome()){ await ctx.storageState({path:OUT}); log('LOGGED_IN saved'); await b.close(); process.exit(0); }
  // 2FA?
  if(/two_factor|codeentry|challenge|auth_platform/i.test(url) || await p.$('input[name="verificationCode"]')){
    if(CODE && /^\d{6}$/.test(CODE)){
      for(const loc of [p.locator('input[name="verificationCode"]'), p.locator('input[autocomplete="one-time-code"]'), p.locator('input[type="tel"]').first()]){
        if(await loc.count().catch(()=>0)){ await loc.fill(CODE).catch(()=>{}); await p.keyboard.press('Enter').catch(()=>{}); break; }
      }
      await sleep(8000);
      if(await isHome()){ await ctx.storageState({path:OUT}); log('LOGGED_IN saved (2FA)'); await b.close(); process.exit(0); }
      log('FAIL_AFTER_2FA', p.url());
    } else { log('NEED_2FA', url); }
  } else {
    const body=(await p.evaluate(()=>document.body.innerText.slice(0,140).replace(/\s+/g,' ')).catch(()=>''))||'';
    log('CHECKPOINT_OR_FAIL', url, '|', body);
  }
  await p.screenshot({path:'/opt/oko-poster/cfg/relogin.png'}).catch(()=>{});
}catch(e){ log('ERR', String(e).slice(0,180)); }
finally{ await b.close(); }
