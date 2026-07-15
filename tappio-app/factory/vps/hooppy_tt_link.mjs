// Click TikTok connect in Hooppy, capture the exact OAuth URL + redirect chain + state.
import { chromium } from 'patchright';
import fs from 'fs';
const HS='/opt/oko-poster/cfg/hooppy_session.json';
const log=(...a)=>console.log('[ttlink]',...a);
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({storageState:fs.existsSync(HS)?HS:undefined,viewport:{width:1280,height:900},locale:'ru-RU',
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'});
const p=await ctx.newPage();
const chain=[];
p.on('framenavigated',f=>{ if(f===p.mainFrame()) chain.push(f.url()); });
try{
  await p.goto('https://hooppy.ru/accounts/connect',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForTimeout(3000);
  if(p.url().includes('/auth/login')){log('SESSION EXPIRED');await b.close();process.exit(0);}
  // grab the TikTok anchor href exactly
  const href=await p.evaluate(()=>{
    const a=[...document.querySelectorAll('a')].find(x=>/tiktok\.com\/v2\/auth\/authorize/i.test(x.href));
    return a?a.href:null;
  });
  log('TT_HREF', href);
  // click it and follow the chain to see if Hooppy injects state before TikTok
  const a=p.locator('a[href*="tiktok.com/v2/auth/authorize"]').first();
  if(await a.count()){ await a.click().catch(()=>{}); await p.waitForTimeout(7000); }
  log('LANDED', p.url());
  log('CHAIN', JSON.stringify(chain.slice(0,6)));
  log('HAS_STATE', /[?&]state=/.test(href||'') || chain.some(u=>/[?&]state=/.test(u)) ? 'YES':'NO');
  await p.screenshot({path:'/opt/oko-poster/cfg/tt_link.png'}).catch(()=>{});
}catch(e){log('ERR',String(e).slice(0,220));}
finally{await b.close();}
