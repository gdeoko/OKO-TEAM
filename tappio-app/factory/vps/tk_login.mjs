// Stealth TikTok login via patchright (no proxy). Saves session on success.
import { chromium } from 'patchright';
import fs from 'fs';
const LOGIN=process.env.TK_LOGIN, PASS=process.env.TK_PASSWORD;
const DIR='/opt/oko-poster/cfg/tk_profile';
const CODEF='/opt/oko-poster/cfg/tk_code.txt';
const S=n=>`/opt/oko-poster/cfg/tk_${n}.png`;
const log=(...a)=>console.log('[tk]',...a);

const ctx=await chromium.launchPersistentContext(DIR,{headless:true,channel:'chromium',
  viewport:{width:1280,height:900},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US',timezoneId:'Europe/Rome'});
const p=ctx.pages()[0]||await ctx.newPage();
try{
  await p.goto('https://www.tiktok.com/login/phone-or-email/email',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(6000);
  await p.screenshot({path:S('0load')}).catch(()=>{});
  log('url',p.url());
  // cookie banner
  for(const t of [/allow all/i,/accept all/i,/^accept$/i]){const b=p.getByRole('button',{name:t}).first();if(await b.count()&&await b.isVisible().catch(()=>false)){await b.click().catch(()=>{});await p.waitForTimeout(1200);break;}}

  const user=p.locator('input[name="username"], input[type="text"]').first();
  const pass=p.locator('input[type="password"]').first();
  if(await user.count()===0){log('NO LOGIN FORM');}
  await user.click(); await user.pressSequentially(LOGIN,{delay:110});
  await pass.click(); await pass.pressSequentially(PASS,{delay:110});
  await p.waitForTimeout(700);
  await p.screenshot({path:S('1filled')}).catch(()=>{});
  const btn=p.getByRole('button',{name:/^log in$/i}).first();
  if(await btn.count()) await btn.click().catch(()=>{}); else await pass.press('Enter');
  log('submitted'); await p.waitForTimeout(8000);
  await p.screenshot({path:S('2after')}).catch(()=>{});
  let body=await p.evaluate(()=>document.body.innerText.slice(0,400).replace(/\n+/g,' | ')).catch(()=>'');
  log('body',body); log('url',p.url());

  // captcha?
  if(/captcha|puzzle|drag|verify to continue|slide/i.test(body)){log('CAPTCHA present');}

  // email code challenge -> poll file (user provides code from tappio.app@gmail.com)
  if(/code|verification|verify/i.test(body)){
    log('CODE challenge, awaiting', CODEF);
    let code=null;
    for(let i=0;i<72;i++){ if(fs.existsSync(CODEF)){const c=fs.readFileSync(CODEF,'utf8').replace(/\D/g,'');if(c.length>=4){code=c;break;}} await p.waitForTimeout(5000);}
    if(code){log('got code',code);
      const ci=p.locator('input[name="code"], input[placeholder*="code" i], input[type="text"]').first();
      if(await ci.count()){await ci.click();await ci.fill('');await ci.pressSequentially(code,{delay:150});}
      const sb=p.getByRole('button',{name:/log in|verify|confirm|next/i}).first();
      if(await sb.count()&&await sb.isVisible().catch(()=>false)) await sb.click().catch(()=>{});
      await p.waitForTimeout(8000);
    } else log('no code arrived');
  }

  await p.screenshot({path:S('3done')}).catch(()=>{});
  await ctx.storageState({path:'/opt/oko-poster/cfg/tk_state.json'}).catch(()=>{});
  const url=p.url();
  const ok=/tiktok\.com\/(foryou|@|$|\?)/.test(url) && !/login/.test(url);
  log('RESULT', ok?'LOGGED_IN':'NOT_LOGGED_IN', url);
}catch(e){log('ERR',String(e).slice(0,250));await p.screenshot({path:S('err')}).catch(()=>{});}
finally{await ctx.close();}
