// Multi-account stealth IG login. Env: IG_LOGIN, IG_PASS, ACC (slug for paths).
import { chromium } from 'patchright';
import fs from 'fs';
const LOGIN=process.env.IG_LOGIN, PASS=process.env.IG_PASS, ACC=process.env.ACC||'acct';
const DIR=`/opt/oko-poster/cfg/ig_${ACC}_profile`;
const STATE=`/opt/oko-poster/cfg/ig_${ACC}_state.json`;
const SHOT=`/opt/oko-poster/cfg/ig_${ACC}.png`;
const log=(...a)=>console.log(`[ig:${ACC}]`,...a);
const ctx=await chromium.launchPersistentContext(DIR,{headless:true,channel:'chromium',
  viewport:{width:412,height:915},
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  locale:'en-US',timezoneId:'Europe/Rome'});
const p=ctx.pages()[0]||await ctx.newPage();
try{
  await p.goto('https://www.instagram.com/accounts/login/',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForTimeout(3500);
  for(const t of ['Allow all cookies','Only allow essential cookies','Accept']){const b=p.getByRole('button',{name:t});if(await b.count()&&await b.first().isVisible().catch(()=>false)){await b.first().click().catch(()=>{});break;}}
  await p.waitForTimeout(1200);
  const u=p.locator('input[name="username"]'), pw=p.locator('input[name="password"]');
  await u.click(); await u.pressSequentially(LOGIN,{delay:110});
  await pw.click(); await pw.pressSequentially(PASS,{delay:110});
  await p.waitForTimeout(500);
  const btn=p.getByRole('button',{name:/^Log in$/}).first();
  if(await btn.count())await btn.click(); else await pw.press('Enter');
  log('submitted'); await p.waitForTimeout(9000);
  for(let i=0;i<20;i++){const url=p.url(); if(!/\/accounts\/login\/?$/.test(url))break; await p.waitForTimeout(1500);}
  const url=p.url(); log('post url', url);
  const body=(await p.locator('body').innerText().catch(()=>'')).slice(0,300).replace(/\n+/g,' | ');
  log('body', body);
  await p.screenshot({path:SHOT}).catch(()=>{});
  await ctx.storageState({path:STATE}).catch(()=>{});
  const logged=/instagram\.com\/(\?|$|#|accounts\/onetap|direct|reels)/.test(url)&&!/login|challenge|codeentry|auth_platform/.test(url);
  const needsCode=/challenge|codeentry|auth_platform|two_factor/.test(url)||/check your email|confirm|security code|enter the code/i.test(body);
  log('RESULT', logged?'LOGGED_IN':(needsCode?'NEEDS_CODE':'NOT_LOGGED_IN'), url);
}catch(e){log('ERR',String(e).slice(0,220));await p.screenshot({path:SHOT}).catch(()=>{});}
finally{await ctx.close();}
