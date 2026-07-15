// Open Hooppy's TikTok OAuth authorize URL, capture the flow.
import { chromium } from 'patchright';
import fs from 'fs';
const HS='/opt/oko-poster/cfg/hooppy_session.json';
const OA='https://www.tiktok.com/v2/auth/authorize/?redirect_uri=https%3A%2F%2Fhooppy.ru%2Foauth%2F14&client_key=aweoatbsettfanq2&response_type=code&scope=user.info.basic%2Cuser.info.profile%2Cvideo.upload%2Cvideo.publish';
const PROXY=process.env.PROXY||'';
const log=(...a)=>console.log('[ttoauth]',...a);
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({storageState:fs.existsSync(HS)?HS:undefined,viewport:{width:1280,height:900},locale:'en-US',timezoneId:'Europe/Rome',
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  ...(PROXY?{proxy:{server:PROXY}}:{})});
const p=await ctx.newPage();
try{
  if(PROXY)log('via',PROXY);
  await p.goto(OA,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(7000);
  log('url',p.url());
  const body=await p.evaluate(()=>document.body.innerText.slice(0,500).replace(/\n+/g,' | ')).catch(()=>'');
  log('body',body);
  await p.screenshot({path:'/opt/oko-poster/cfg/tt_oauth.png'}).catch(()=>{});
}catch(e){log('ERR',String(e).slice(0,220));await p.screenshot({path:'/opt/oko-poster/cfg/tt_oauth_err.png'}).catch(()=>{});}
finally{await b.close();}
