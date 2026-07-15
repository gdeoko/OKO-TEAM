import { chromium } from 'patchright';
import fs from 'fs';
const STATE='/opt/oko-poster/cfg/ig_state.json';
const log=(...a)=>console.log('[igchk]',...a);
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({storageState:fs.existsSync(STATE)?STATE:undefined,viewport:{width:1280,height:900},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',locale:'en-US',timezoneId:'Europe/Rome'});
const p=await ctx.newPage();
try{
  await p.goto('https://www.instagram.com/tappio.app.pro/',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForTimeout(6000);
  const info=await p.evaluate(()=>{
    const posts=[...document.querySelectorAll('a[href*="/p/"]')].map(a=>a.getAttribute('href'));
    const head=document.body.innerText.slice(0,220).replace(/\n+/g,' | ');
    return {firstPosts:[...new Set(posts)].slice(0,3),head};
  });
  log('HEAD',info.head);
  log('POSTS',JSON.stringify(info.firstPosts));
  await p.screenshot({path:'/opt/oko-poster/cfg/profile.png'}).catch(()=>{});
}catch(e){log('ERR',String(e).slice(0,200));}
finally{await b.close();}
