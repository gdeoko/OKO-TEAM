import { chromium } from "playwright";
import { writeFileSync, readFileSync, existsSync } from "fs";
const {TAPPIO_IG_LOGIN:IGL, TAPPIO_IG_PASSWORD:IGP} = process.env;
const RES="/opt/oko-poster/ig_result.txt", CODEF="/opt/oko-poster/cfg/ig_code.txt";
const log=s=>{try{writeFileSync(RES,new Date().toISOString().slice(11,19)+" "+s+"\n",{flag:"a"});}catch(e){}};
const short=u=>String(u).replace(/\?.*/,"?..").slice(0,50);
const isHome=async p=> await p.$('a[href="/direct/inbox/"], svg[aria-label="Home"], a[href*="/accounts/edit"], a[href="/explore/"]').then(e=>!!e).catch(()=>false);
async function waitCode(p){ for(let i=0;i<60;i++){ if(existsSync(CODEF)){const c=readFileSync(CODEF,"utf8").trim(); if(/^\d{6}$/.test(c))return c;} await p.waitForTimeout(3000);} return null; }
try{
const ctx=await chromium.launchPersistentContext("/opt/oko-poster/cfg/ig_profile",{headless:true,args:["--no-sandbox","--disable-blink-features=AutomationControlled"],viewport:{width:1366,height:1400},locale:"en-US",userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"});
const p=ctx.pages()[0]||await ctx.newPage();
await p.goto("https://www.instagram.com/",{waitUntil:"domcontentloaded",timeout:45000}); await p.waitForTimeout(5000);
if(await isHome(p)){ log("ALREADY_LOGGED_IN"); }
else{
  await p.goto("https://www.instagram.com/accounts/login/",{waitUntil:"domcontentloaded",timeout:45000});
  await p.waitForSelector('input[name="email"]',{timeout:25000});
  await p.fill('input[name="email"]',IGL); await p.fill('input[name="pass"]',IGP); await p.waitForTimeout(500);
  (await p.$('button[type="submit"]'))?.click(); log("login_submitted");
  await p.waitForTimeout(9000); log("at "+short(p.url()));
  // reach code entry, then request a FRESH code
  let onCode=/codeentry|challenge|auth_platform/i.test(p.url());
  if(onCode){
    // click "Get new code" / resend
    let resent=false;
    for(const t of ["Get a new code","Get new code","Resend code","Send new code","Получить новый код","Отправить код повторно"]){
      const el=await p.$(`text=${t}`)||await p.$(`button:has-text("${t}")`)||await p.$(`a:has-text("${t}")`)||await p.$(`div[role="button"]:has-text("${t}")`);
      if(el && await el.isVisible().catch(()=>false)){ await el.click().catch(()=>{}); resent=true; log("RESENT_via "+t); break; }
    }
    if(!resent) log("RESENT_none_found");
    log("NEED_FRESH_CODE");
    const code=await waitCode(p);
    if(!code){ log("NO_CODE"); }
    else{
      let filled=false;
      for(const loc of [p.locator('input[name="verificationCode"]'),p.locator('input[autocomplete="one-time-code"]'),p.locator('input[type="tel"]').first(),p.getByRole('textbox').first(),p.locator('input[type="text"]:visible').first()]){
        try{ if(await loc.count()===0)continue; if(!await loc.isVisible({timeout:800}).catch(()=>false))continue;
          await loc.click(); await loc.fill(""); await loc.pressSequentially(code,{delay:170}); await p.waitForTimeout(600);
          const v=(await loc.inputValue().catch(()=>"")).replace(/\D/g,""); log("code_typed len="+v.length+" code="+code);
          await p.keyboard.press("Enter").catch(()=>{});
          const cb=await p.$('button:has-text("Continue")')||await p.$('button:has-text("Confirm")')||await p.$('button:has-text("Next")')||await p.$('button[type="submit"]:not([disabled])'); cb?.click().catch(()=>{});
          if(v.length>=6){filled=true;} break;
        }catch(e){}
      }
      log("filled "+filled);
      await p.waitForTimeout(9000); log("after_code "+short(p.url()));
    }
  } else log("no_code_step "+short(p.url()));
  // dismiss save-login
  for(let i=0;i<5;i++){ if(await isHome(p)){log("LOGGED_IN");break;} for(const t of ["Not now","Не сейчас","Dismiss"]){const btn=await p.$(`button:has-text("${t}")`)||await p.$(`div[role="button"]:has-text("${t}")`); if(btn&&await btn.isVisible().catch(()=>false)){await btn.click().catch(()=>{});log("dismiss "+t);await p.waitForTimeout(2500);break;}} await p.waitForTimeout(3000); }
}
const fin=await isHome(p);
log("FINAL_LOGGED_IN "+fin+" "+short(p.url()));
await ctx.storageState({path:"/opt/oko-poster/cfg/ig_session.json"});
await p.screenshot({path:"/opt/oko-poster/ig_final.jpg",type:"jpeg",quality:55});
await ctx.close(); log("DONE");
}catch(e){ log("ERROR "+String(e).slice(0,150)); }
