// DIESEL IG engagement via PERSISTENT profile. Env: IG_PROFILE, NICHE_TAG, LIKE_MAX, SAVE_MAX, COMMENT_MAX, FOLLOW_MAX.
import { chromium } from 'patchright';
const PROFILE=process.env.IG_PROFILE||'/opt/oko-poster/cfg/ig_diesel_profile';
const TAG=process.env.NICHE_TAG||'квадроцикл';
const LIKE_MAX=+(process.env.LIKE_MAX||5), SAVE_MAX=+(process.env.SAVE_MAX||3);
const COMMENT_MAX=+(process.env.COMMENT_MAX||1), FOLLOW_MAX=+(process.env.FOLLOW_MAX||1);
const COMMENTS=['🔥','Огонь техника','Красавец','Топ 🙌','Мощно','Беру на заметку 👍','Класс'];
const log=(...a)=>console.log('[engage]',...a); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rnd=(a,b)=>a+Math.floor(Math.random()*(b-a));
const ctx=await chromium.launchPersistentContext(PROFILE,{headless:true,viewport:{width:412,height:892},
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',locale:'ru-RU'});
const p=ctx.pages()[0]||await ctx.newPage();
let liked=0,saved=0,commented=0,followed=0;
try{
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:45000}); await sleep(4000);
  if(/login|challenge|codeentry|auth_platform/.test(p.url())){log('DEAD_SESSION');await ctx.close();process.exit(0);}
  await p.goto('https://www.instagram.com/explore/tags/'+encodeURIComponent(TAG)+'/',{waitUntil:'domcontentloaded',timeout:45000});
  await sleep(rnd(4000,6000));
  const links=await p.evaluate(()=>[...new Set([...document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"]')].map(a=>a.href))].slice(0,12));
  log('tag',TAG,'posts',links.length);
  for(const url of links){
    if(liked>=LIKE_MAX&&saved>=SAVE_MAX&&commented>=COMMENT_MAX&&followed>=FOLLOW_MAX) break;
    try{
      await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000}); await sleep(rnd(4000,7000));
      if(liked<LIKE_MAX){const lb=p.locator('svg[aria-label="Like"]').first();if(await lb.count()){await lb.click({timeout:4000}).catch(()=>{});liked++;log('like',liked);await sleep(rnd(1200,2500));}}
      if(saved<SAVE_MAX){const sb=p.locator('svg[aria-label="Save"]').first();if(await sb.count()){await sb.click({timeout:4000}).catch(()=>{});saved++;log('save',saved);await sleep(rnd(1000,2000));}}
      if(followed<FOLLOW_MAX){const fb=p.getByRole('button',{name:/^Подписаться$|^Follow$/}).first();if(await fb.count()){await fb.click({timeout:4000}).catch(()=>{});followed++;log('follow',followed);await sleep(rnd(1500,3000));}}
      if(commented<COMMENT_MAX){const ta=p.locator('textarea').first();if(await ta.count()){const c=COMMENTS[rnd(0,COMMENTS.length)];await ta.click({timeout:4000}).catch(()=>{});await ta.type(c,{delay:80}).catch(()=>{});const pb=p.getByRole('button',{name:/^Опубликовать$|^Post$/}).first();if(await pb.count()){await pb.click({timeout:4000}).catch(()=>{});commented++;log('comment',commented,c);await sleep(rnd(2000,4000));}}}
    }catch(e){log('post err',String(e.message||e).slice(0,40));}
  }
  log(`RESULT liked=${liked} saved=${saved} commented=${commented} followed=${followed}`);
}catch(e){log('ERR',String(e.message||e).slice(0,60));}
finally{await ctx.close();}
