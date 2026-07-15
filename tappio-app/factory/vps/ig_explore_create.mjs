// Explore the logged-in IG mobile-web UI to locate the create-post affordance.
import { chromium } from 'patchright';
const DIR='/opt/oko-poster/cfg/ig_patchright_profile';
const log=(...a)=>console.log('[igx]',...a);
const ctx=await chromium.launchPersistentContext(DIR,{headless:true,channel:'chromium',
  viewport:{width:412,height:915},
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  locale:'en-US',timezoneId:'Europe/Rome'});
const p=ctx.pages()[0]||await ctx.newPage();
try{
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForTimeout(6000);
  log('url',p.url());
  await p.screenshot({path:'/opt/oko-poster/cfg/ig_home.png'}).catch(()=>{});
  // dump nav/link affordances with aria-labels
  const els=await p.evaluate(()=>{
    const out=[];
    for(const e of document.querySelectorAll('a,[role=link],[role=button],button,svg[aria-label],[aria-label]')){
      const al=e.getAttribute('aria-label'); const href=e.getAttribute('href');
      const t=(e.innerText||'').trim().slice(0,20);
      if(al||href||t) out.push([al||'',href||'',t].join(' | '));
    }
    return [...new Set(out)].slice(0,60);
  });
  log('AFFORD', JSON.stringify(els,null,0));
  // does a hidden file input exist anywhere?
  const fi=await p.locator('input[type=file]').count();
  log('file_inputs', fi);
}catch(e){log('ERR',String(e).slice(0,200));}
finally{await ctx.close();}
