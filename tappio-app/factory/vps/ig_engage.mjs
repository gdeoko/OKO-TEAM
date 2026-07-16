// Осторожная ежедневная активность IG через storageState (без фанатизма, человеческий темп).
// env: IG_STATE, IG_TAG (хэштег ниши), LIKE_MAX, FOLLOW_MAX. Лимиты строго, логирует что сделал.
import { chromium } from 'patchright';
import fs from 'fs';
const STATE=process.env.IG_STATE||'/opt/oko-poster/cfg/ig_state.json';
const TAG=process.env.NICHE_TAG||'hiddencamera';
const LIKE_MAX=parseInt(process.env.LIKE_MAX||'4');
const FOLLOW_MAX=parseInt(process.env.FOLLOW_MAX||'1');
const log=(...a)=>console.log('[igengage]',...a);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a));

const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({storageState:fs.existsSync(STATE)?STATE:undefined,viewport:{width:1280,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US',timezoneId:'Europe/Rome'});
const p=await ctx.newPage();
let liked=0, followed=0;
try{
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:45000}); await sleep(5000);
  if(/login|challenge|codeentry/.test(p.url())){ log('BLOCKED_LOGIN'); await b.close(); process.exit(0); }
  const who=await p.evaluate(()=>{const a=[...document.querySelectorAll('a')].map(x=>x.getAttribute('href')).filter(h=>h&&/^\/[a-z0-9._]+\/$/.test(h)&&!/explore|reels|direct|accounts|popular|meta/.test(h));return a[0]||'?';});
  log('WHO',who);
  // хэштег ниши
  await p.goto('https://www.instagram.com/explore/tags/'+TAG+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await sleep(rnd(4000,6000));
  // собрать ссылки на посты
  const links=await p.evaluate(()=>[...document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"]')].map(a=>a.href).slice(0,12));
  log('found posts',links.length);
  for(const url of links){
    if(liked>=LIKE_MAX) break;
    try{
      await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000}); await sleep(rnd(3000,6000));
      // лайк
      const likeBtn=p.locator('svg[aria-label="Like"]').first();
      if(await likeBtn.count() && await likeBtn.isVisible().catch(()=>false)){
        await likeBtn.click({timeout:4000}).catch(()=>{}); liked++; log('liked',liked,url.slice(0,50)); await sleep(rnd(2500,5000));
      }
      // подписка (изредка, до FOLLOW_MAX)
      if(followed<FOLLOW_MAX){
        const fb=p.getByRole('button',{name:/^follow$/i}).first();
        if(await fb.count() && await fb.isVisible().catch(()=>false)){
          await fb.click({timeout:4000}).catch(()=>{}); followed++; log('followed',followed); await sleep(rnd(3000,6000));
        }
      }
    }catch(e){ log('skip',String(e).slice(0,60)); }
    await sleep(rnd(2000,4000));
  }
  log('RESULT liked='+liked+' followed='+followed);
}catch(e){ log('ERR',String(e).slice(0,150)); }
finally{ await b.close(); }
