// IG session health by PERSISTENT profile. ALIVE / DEAD / CHECKPOINT. Env: IG_PROFILE.
// v2 (28.07): DOM-aware — распознаёт "Continue as"/saved-login сплэш (URL="/" но сессия протухла) как DEAD.
import { chromium } from 'patchright';
const PROFILE=process.env.IG_PROFILE||'/opt/oko-poster/cfg/ig_diesel_profile';
const ctx=await chromium.launchPersistentContext(PROFILE,{headless:true,viewport:{width:412,height:892},
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',locale:'ru-RU'});
const p=ctx.pages()[0]||await ctx.newPage();
try{
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:45000}).catch(()=>{});
  await new Promise(r=>setTimeout(r,5500));
  const url=p.url(); const u=url.replace('https://www.instagram.com','');
  if(/suspended|challenge|checkpoint|подтвердите|disabled|integrity/.test(url)){console.log('CHECKPOINT '+u);}
  else if(/accounts\/login|codeentry|auth_platform/.test(url)){console.log('DEAD '+u);}
  else{
    const st=await p.evaluate(()=>{
      const feed=!!document.querySelector('svg[aria-label="New post"],svg[aria-label="Home"],svg[aria-label="Главная"],a[href="/explore/"]');
      const t=document.body.innerText||'';
      const splash=/Use another profile|Create new account|Continue as|Войти с помощью|Продолжить как/i.test(t)
        || ([...document.querySelectorAll('*')].some(e=>(e.textContent||'').trim()==='Continue'&&e.offsetParent!==null) && !feed);
      return {feed,splash};
    }).catch(()=>({feed:false,splash:false}));
    if(st.feed) console.log('ALIVE '+u);
    else if(st.splash) console.log('DEAD saved-login-splash '+u);  // сессия протухла: нужен ручной вход
    else console.log('DEAD no-feed '+u);
  }
}catch(e){console.log('DEAD '+String(e).slice(0,50));}
finally{await ctx.close();}
