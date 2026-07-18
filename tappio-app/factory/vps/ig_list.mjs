// Список reels аккаунта (read-only) через storageState (правильный аккаунт tappio.app.pro):
// коды постов + подпись-alt, новейшие первыми. Для захвата shortcode, поиска дублей, самопроверки.
// JSON -> stdout; логи -> stderr. Env: IG_STATE, IG_USER, IG_N.
import { chromium } from 'patchright';
import fs from 'fs';
const STATE=process.env.IG_STATE||'/opt/oko-poster/cfg/ig_state.json';
const USER=process.env.IG_USER||'tappio.app.pro';
const N=+(process.env.IG_N||12);
const log=(...a)=>console.error('[list]',...a);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({
  storageState:fs.existsSync(STATE)?STATE:undefined,
  viewport:{width:1280,height:1500},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US', timezoneId:'Europe/Rome'});
const p=await ctx.newPage();
try{
  await p.goto('https://www.instagram.com/'+USER+'/reels/',{waitUntil:'domcontentloaded',timeout:60000});
  await sleep(6000);
  if(/login|challenge|codeentry|auth_platform/.test(p.url())){ log('BLOCKED_LOGIN'); console.log('[]'); await ctx.close(); await b.close(); process.exit(0); }
  for(let i=0;i<3;i++){ await p.mouse.wheel(0,1600); await sleep(1400); }
  const items=await p.evaluate(()=>{
    const seen=new Set(), out=[];
    for(const a of document.querySelectorAll('a[href*="/reel/"],a[href*="/p/"]')){
      const m=(a.getAttribute('href')||'').match(/\/(reel|p)\/([^\/]+)\//);
      if(!m) continue; const code=m[2]; if(seen.has(code)) continue; seen.add(code);
      const img=a.querySelector('img'); const alt=img?(img.getAttribute('alt')||''):'';
      out.push({code, type:m[1], alt:alt.replace(/\s+/g,' ').trim().slice(0,90)});
    }
    return out;
  });
  log('found', items.length, 'reels for', USER);
  console.log(JSON.stringify(items.slice(0,N)));
}catch(e){ log('ERR',String(e).slice(0,200)); console.log('[]'); }
finally{ await ctx.close(); await b.close(); }
