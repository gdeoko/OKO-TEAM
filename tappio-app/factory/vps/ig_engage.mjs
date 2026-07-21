// Осторожная ежедневная активность IG через storageState (1 раз в день, человеческий темп, без фанатизма).
// Лайки + СОХРАНЕНИЯ + редкий короткий КОММЕНТ + подписка. Env: IG_STATE, NICHE_TAG,
// LIKE_MAX(8), SAVE_MAX(5), COMMENT_MAX(2), FOLLOW_MAX(3). Логирует что сделал.
import { chromium } from 'patchright';
import fs from 'fs';
const STATE=process.env.IG_STATE||'/opt/oko-poster/cfg/ig_state.json';
const TAG=process.env.NICHE_TAG||'hiddencamera';
const LIKE_MAX=+(process.env.LIKE_MAX||8), SAVE_MAX=+(process.env.SAVE_MAX||5);
const COMMENT_MAX=+(process.env.COMMENT_MAX||2), FOLLOW_MAX=+(process.env.FOLLOW_MAX||3);
const COMMENTS=['🔥','Great tip','Super useful','Needed this 🙌','Underrated','Saving this','👏'];
const log=(...a)=>console.log('[igengage]',...a);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a));
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({storageState:fs.existsSync(STATE)?STATE:undefined,viewport:{width:1280,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US',timezoneId:'Europe/Rome'});
const p=await ctx.newPage();
let liked=0, saved=0, commented=0, followed=0;
try{
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:45000}); await sleep(5000);
  if(/login|challenge|codeentry|auth_platform/.test(p.url())){ log('BLOCKED_LOGIN'); await b.close(); process.exit(0); }
  await p.goto('https://www.instagram.com/explore/tags/'+TAG+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await sleep(rnd(4000,6000));
  const links=await p.evaluate(()=>[...new Set([...document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"]')].map(a=>a.href))].slice(0,14));
  log('tag',TAG,'posts',links.length);
  for(const url of links){
    if(liked>=LIKE_MAX && saved>=SAVE_MAX && commented>=COMMENT_MAX && followed>=FOLLOW_MAX) break;
    try{
      await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000}); await sleep(rnd(4000,7000)); // «смотрим» ролик
      if(liked<LIKE_MAX){ const lb=p.locator('svg[aria-label="Like"]').first();
        if(await lb.count() && await lb.isVisible().catch(()=>false)){ await lb.click({timeout:4000}).catch(()=>{}); liked++; log('liked',liked); await sleep(rnd(1500,3500)); } }
      if(saved<SAVE_MAX){ const sb=p.locator('svg[aria-label="Save"]').first();
        if(await sb.count() && await sb.isVisible().catch(()=>false)){ await sb.click({timeout:4000}).catch(()=>{}); saved++; log('saved',saved); await sleep(rnd(1500,3000)); } }
      if(commented<COMMENT_MAX && Math.random()<0.5){
        const cf=p.locator('textarea[aria-label="Add a comment…"], textarea[placeholder*="comment" i]').first();
        if(await cf.count() && await cf.isVisible().catch(()=>false)){
          await cf.click().catch(()=>{}); const c=COMMENTS[rnd(0,COMMENTS.length)];
          await p.keyboard.type(c,{delay:90}); await sleep(600);
          const post=p.getByRole('button',{name:/^post$/i}).first();
          if(await post.count()){ await post.click({timeout:4000}).catch(()=>{}); commented++; log('commented',commented,c); await sleep(rnd(2500,5000)); }
        }
      }
      if(followed<FOLLOW_MAX){ const fb=p.getByRole('button',{name:/^follow$/i}).first();
        if(await fb.count() && await fb.isVisible().catch(()=>false)){ await fb.click({timeout:4000}).catch(()=>{}); followed++; log('followed',followed); await sleep(rnd(3000,6000)); } }
    }catch(e){ log('skip',String(e).slice(0,50)); }
    await sleep(rnd(3000,6000)); // человеческие паузы между постами
  }
  log('RESULT liked='+liked+' saved='+saved+' commented='+commented+' followed='+followed);
}catch(e){ log('ERR',String(e).slice(0,150)); }
finally{ await b.close(); }
