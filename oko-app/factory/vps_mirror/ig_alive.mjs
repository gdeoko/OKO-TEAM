// IG session health by PERSISTENT profile. ALIVE / DEAD / CHECKPOINT. Env: IG_PROFILE.
import { chromium } from 'patchright';
const PROFILE=process.env.IG_PROFILE||'/opt/oko-poster/cfg/ig_diesel_profile';
const ctx=await chromium.launchPersistentContext(PROFILE,{headless:true,viewport:{width:412,height:892},
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',locale:'ru-RU'});
const p=ctx.pages()[0]||await ctx.newPage();
try{
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>{});
  await new Promise(r=>setTimeout(r,5000));
  const url=p.url();
  if(/suspended|challenge|checkpoint|подтвердите|disabled|integrity/.test(url)) console.log('CHECKPOINT '+url.replace('https://www.instagram.com',''));
  else if(/accounts\/login|codeentry|auth_platform/.test(url)) console.log('DEAD '+url.replace('https://www.instagram.com',''));
  else console.log('ALIVE '+url.replace('https://www.instagram.com',''));
}catch(e){console.log('DEAD '+String(e).slice(0,50));}
finally{await ctx.close();}
