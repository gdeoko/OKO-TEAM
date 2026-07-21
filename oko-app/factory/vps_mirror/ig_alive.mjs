// Проверка живой IG-сессии по ПЕРСИСТ-ПРОФИЛЮ (как постер). ALIVE <who> / DEAD. Env: IG_PROFILE.
import { chromium } from 'patchright';
const PROFILE=process.env.IG_PROFILE||'/opt/oko-poster/cfg/ig_diesel_profile';
const ctx=await chromium.launchPersistentContext(PROFILE,{headless:true,viewport:{width:412,height:892},
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',locale:'ru-RU'});
const p=ctx.pages()[0]||await ctx.newPage();
try{
  await p.goto('https://www.instagram.com/accounts/edit/',{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>{});
  await new Promise(r=>setTimeout(r,5000));
  const url=p.url();
  const loggedOut=/accounts\/login/.test(url);
  console.log(loggedOut?'DEAD':('ALIVE '+url.replace('https://www.instagram.com','')));
}catch(e){console.log('DEAD '+String(e).slice(0,60));}
finally{await ctx.close();}
