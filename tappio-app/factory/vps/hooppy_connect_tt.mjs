// Log into Hooppy and locate/attempt the TikTok connect flow.
import { chromium } from 'patchright';
const L=process.env.HOOPPY_LOGIN, P=process.env.HOOPPY_PASSWORD;
const S=n=>`/opt/oko-poster/cfg/hp_${n}.png`;
const log=(...a)=>console.log('[hp]',...a);
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1366,height:900},locale:'ru-RU',
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'});
const p=await ctx.newPage();
try{
  await p.goto('https://hooppy.ru/auth/login',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForTimeout(2500);
  const fill=async(sels,val)=>{for(const s of sels){const el=await p.$(s);if(el){await el.fill(val);return s;}}return null;};
  await fill(['input[type="email"]','input[name="email"]','input[name="login"]','input[type="text"]'],L);
  await fill(['input[type="password"]','input[name="password"]'],P);
  const btn=await p.$('button[type="submit"]')||await p.$('button:has-text("Войти")')||await p.$('form button');
  if(btn)await btn.click(); else await p.keyboard.press('Enter');
  await p.waitForTimeout(6000);
  log('after login url', p.url());
  if(p.url().includes('/auth/login')){log('LOGIN FAILED'); await p.screenshot({path:S('loginfail')}); await b.close(); process.exit(0);}
  await ctx.storageState({path:'/opt/oko-poster/cfg/hooppy_session.json'}).catch(()=>{});
  await p.screenshot({path:S('0dash')}).catch(()=>{});

  // dump nav links to find where accounts are connected
  const links=await p.evaluate(()=>[...document.querySelectorAll('a,[role=link],button')]
    .map(e=>{const t=(e.innerText||'').trim().slice(0,28);const h=e.getAttribute('href')||'';return (t||h)?`${t} | ${h}`:'';})
    .filter(Boolean));
  log('NAV', JSON.stringify([...new Set(links)].slice(0,50)));

  // try common connect routes
  for(const path of ['/accounts','/settings/accounts','/social','/projects','/dashboard/accounts','/connections','/integrations']){
    await p.goto('https://hooppy.ru'+path,{waitUntil:'domcontentloaded',timeout:20000}).catch(()=>{});
    await p.waitForTimeout(1500);
    const has=await p.evaluate(()=>/tiktok|подключ|добавить аккаунт|connect|привязать/i.test(document.body.innerText));
    log('probe', path, p.url(), has?'HAS_CONNECT_UI':'-');
    if(has){await p.screenshot({path:S('probe_'+path.replace(/\//g,'_'))}).catch(()=>{});}
  }
}catch(e){log('ERR',String(e).slice(0,220));await p.screenshot({path:S('err')}).catch(()=>{});}
finally{await b.close();}
