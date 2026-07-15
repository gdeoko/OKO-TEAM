// TikTok web login via QR code — bypasses password rate-limit & email code.
import { chromium } from 'patchright';
const DIR='/opt/oko-poster/cfg/tk_profile_qr';
const log=(...a)=>console.log('[tkqr]',...a);
const ctx=await chromium.launchPersistentContext(DIR,{headless:true,channel:'chromium',
  viewport:{width:1280,height:900},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US',timezoneId:'Europe/Rome'});
const p=ctx.pages()[0]||await ctx.newPage();
try{
  await p.goto('https://www.tiktok.com/login',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(6000);
  for(const t of [/allow all/i,/accept all/i,/^accept$/i]){const b=p.getByRole('button',{name:t}).first();if(await b.count()&&await b.isVisible().catch(()=>false)){await b.click().catch(()=>{});await p.waitForTimeout(1000);break;}}
  await p.screenshot({path:'/opt/oko-poster/cfg/tkqr_0login.png'}).catch(()=>{});
  // find & click "Use QR code"
  let qr=false;
  for(const loc of [p.getByText(/use qr code/i).first(),p.getByRole('link',{name:/qr code/i}).first(),p.getByText(/qr code/i).first()]){
    if(await loc.count()===0)continue; if(!await loc.isVisible().catch(()=>false))continue;
    await loc.click().catch(()=>{}); qr=true; log('clicked QR'); break;
  }
  log('qr_option',qr);
  await p.waitForTimeout(4000);
  await p.screenshot({path:'/opt/oko-poster/cfg/tkqr_1qr.png'}).catch(()=>{});
  const body=await p.evaluate(()=>document.body.innerText.slice(0,300).replace(/\n+/g,' | ')).catch(()=>'');
  log('body',body);
  // poll for login success up to 8 min; keep a fresh QR screenshot every ~15s
  let ok=false;
  for(let i=0;i<96;i++){
    const u=p.url();
    if(!/login/.test(u) && /tiktok\.com/.test(u)){ok=true;log('LOGIN detected url',u);break;}
    const li=await p.evaluate(()=>!!document.querySelector('[data-e2e="profile-icon"],a[href*="/@"]')).catch(()=>false);
    if(li){ok=true;log('LOGIN detected via profile icon');break;}
    if(i%3===0){ await p.screenshot({path:'/opt/oko-poster/cfg/tkqr_live.png'}).catch(()=>{}); }
    await p.waitForTimeout(5000);
  }
  await p.screenshot({path:'/opt/oko-poster/cfg/tkqr_2after.png'}).catch(()=>{});
  await ctx.storageState({path:'/opt/oko-poster/cfg/tk_state.json'}).catch(()=>{});
  log('RESULT', ok?'LOGGED_IN':'TIMEOUT', p.url());
}catch(e){log('ERR',String(e).slice(0,250));await p.screenshot({path:'/opt/oko-poster/cfg/tkqr_err.png'}).catch(()=>{});}
finally{await ctx.close();}
