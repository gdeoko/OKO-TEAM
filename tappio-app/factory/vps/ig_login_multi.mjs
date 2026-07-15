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
  let url=p.url(); log('post url', url);
  let body=(await p.locator('body').innerText().catch(()=>'')).slice(0,300).replace(/\n+/g,' | ');
  log('body', body);
  await p.screenshot({path:SHOT}).catch(()=>{});

  // code challenge (email / WhatsApp / SMS): poll per-account code file
  const CODEF=`/opt/oko-poster/cfg/ig_${ACC}_code.txt`;
  if(/challenge|codeentry|auth_platform|two_factor/.test(url)||/check your|enter the code|security code|confirm/i.test(body)){
    log('NEEDS_CODE — awaiting', CODEF);
    let code=null;
    for(let i=0;i<96;i++){ if(fs.existsSync(CODEF)){const c=fs.readFileSync(CODEF,'utf8').replace(/\D/g,'');if(c.length>=6){code=c;break;}} await p.waitForTimeout(5000);}
    if(code){ log('got code', code); let filled=false;
      for(const loc of [p.locator('input[name="verificationCode"]'),p.locator('input[autocomplete="one-time-code"]'),p.locator('input[type="tel"]').first(),p.locator('input[inputmode="numeric"]').first(),p.getByRole('textbox').first()]){
        if(await loc.count()===0)continue; if(!await loc.isVisible({timeout:800}).catch(()=>false))continue;
        await loc.click(); await loc.fill(''); await loc.pressSequentially(code,{delay:170});
        const v=(await loc.inputValue()).replace(/\D/g,''); if(v.length>=6){filled=true;break;}
      }
      if(filled){ let cl=false;
        for(const t of [/^continue$/i,/^confirm$/i,/^next$/i]){const btn2=p.getByRole('button',{name:t}).first();if(await btn2.count()&&await btn2.isVisible().catch(()=>false)){await btn2.click().catch(()=>{});cl=true;break;}}
        if(!cl)await p.keyboard.press('Enter');
        await p.waitForTimeout(9000);
        for(const t of [/not now/i,/save info/i]){const btn3=p.getByRole('button',{name:t}).first();if(await btn3.count()&&await btn3.isVisible().catch(()=>false)){await btn3.click().catch(()=>{});await p.waitForTimeout(2000);break;}}
      }
      url=p.url(); log('after code url', url);
    } else log('no code arrived');
  }
  await p.screenshot({path:SHOT}).catch(()=>{});
  await ctx.storageState({path:STATE}).catch(()=>{});
  const logged=/instagram\.com\/(\?|$|#|accounts\/onetap|direct|reels)/.test(url)&&!/login|challenge|codeentry|auth_platform/.test(url);
  log('RESULT', logged?'LOGGED_IN':'NOT_LOGGED_IN', url);
}catch(e){log('ERR',String(e).slice(0,220));await p.screenshot({path:SHOT}).catch(()=>{});}
finally{await ctx.close();}
