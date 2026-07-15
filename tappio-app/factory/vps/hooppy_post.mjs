// Full Hooppy create-post drive for one TikTok account + capture API calls.
import { chromium } from 'patchright';
import fs from 'fs';
const HS='/opt/oko-poster/cfg/hooppy_session.json';
const VIDEO=process.env.VIDEO||'/opt/oko-poster/cfg/tappio_tt.mp4';
const CAPTION=process.env.CAPTION||'Test';
const ACCTXT=process.env.ACCTXT||'tappio';
const log=(...a)=>console.log('[post]',...a);
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({storageState:fs.existsSync(HS)?HS:undefined,viewport:{width:1440,height:1100},locale:'ru-RU',
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'});
const p=await ctx.newPage();
const reqs=[];
p.on('request',r=>{const u=r.url();if(r.method()==='POST'&&/hooppy\.ru\/api\//i.test(u)){reqs.push({u:u.replace('https://api.hooppy.ru','').replace('https://hooppy.ru',''),body:(r.postData()||'').slice(0,700)});}});
p.on('response',async r=>{const u=r.url();if(r.request().method()==='POST'&&/hooppy\.ru\/api\/(media|upload|attachment|posts)/i.test(u)){const t=await r.text().catch(()=>'');log('RESP',r.status(),u.replace('https://api.hooppy.ru',''),t.slice(0,200).replace(/\s+/g,' '));}});
try{
  await p.goto('https://hooppy.ru/posts/create',{waitUntil:'domcontentloaded',timeout:35000});
  await p.waitForTimeout(4000);
  // 1) caption
  const ed=p.locator('[contenteditable="true"], textarea').first();
  if(await ed.count()){await ed.click().catch(()=>{}); await p.keyboard.type(CAPTION); log('typed');}
  // 2) upload video: file input may be hidden; try direct setInputFiles on any file input (even hidden)
  let up=false;
  let fis=await p.locator('input[type="file"]').all();
  log('file inputs found', fis.length);
  for(const f of fis){ try{ await f.setInputFiles(VIDEO); up=true; log('video set (direct)'); break; }catch(e){} }
  if(!up){ // click media/image toolbar button to spawn chooser
    const fc=p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null);
    for(const t of ['img','image','video','media']){ const bt=p.locator(`[title*="${t}" i],[aria-label*="${t}" i]`).first(); if(await bt.count()&&await bt.isVisible().catch(()=>false)){await bt.click().catch(()=>{});break;} }
    const ch=await fc; if(ch){await ch.setFiles(VIDEO);up=true;log('video set (chooser)');}
  }
  log('uploaded?',up);
  await p.waitForTimeout(12000);  // wait upload/transcode
  await p.screenshot({path:'/opt/oko-poster/cfg/post_1.png'}).catch(()=>{});
  // 3) select account: click the TikTok account icon in the social selector area
  let picked=false;
  for(const loc of [p.locator('img[src*="tiktokcdn"],img[src*="tiktok"]').first(), p.locator(`a[href*="${ACCTXT}"]`).first(), p.getByText(new RegExp(ACCTXT,'i')).first()]){
    if(await loc.count()===0)continue; if(!await loc.isVisible().catch(()=>false))continue;
    await loc.click().catch(()=>{}); picked=true; log('clicked account icon'); break;
  }
  if(!picked){ // fallback: click "+" to open picker
    const plus=p.getByText(/^\+$/).first();
    if(await plus.count()&&await plus.isVisible().catch(()=>false)){await plus.click().catch(()=>{});log('clicked +');await p.waitForTimeout(2500);
      const a=p.getByText(new RegExp(ACCTXT,'i')).first(); if(await a.count()){await a.click().catch(()=>{});picked=true;log('picked in modal');}}
  }
  log('picked?',picked); await p.waitForTimeout(1500);
  // close modal if any (confirm)
  for(const t of [/^выбрать$/i,/^добавить$/i,/^ок$/i,/^готово$/i]){const bx=p.getByRole('button',{name:t}).first();if(await bx.count()&&await bx.isVisible().catch(()=>false)){await bx.click().catch(()=>{});await p.waitForTimeout(1500);break;}}
  await p.screenshot({path:'/opt/oko-poster/cfg/post_3.png'}).catch(()=>{});
  // 4) click Создать
  const cr=p.getByRole('button',{name:/^создать$/i}).first();
  if(await cr.count()){await cr.click().catch(()=>{}); log('clicked Создать');}
  await p.waitForTimeout(8000);
  await p.screenshot({path:'/opt/oko-poster/cfg/post_4.png'}).catch(()=>{});
  log('REQS', JSON.stringify(reqs));
  const body=await p.evaluate(()=>document.body.innerText.slice(0,200).replace(/\s+/g,' ')).catch(()=>'');
  log('final body', body);
}catch(e){log('ERR',String(e).slice(0,220));}
finally{await b.close();}
