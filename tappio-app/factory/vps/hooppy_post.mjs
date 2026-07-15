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
  // 2a) reveal media section: toggle the photo attachment (label for attachment_type_photos)
  for(const loc of [p.locator('label[for="attachment_type_photos"]').first(), p.locator('label[for*="photos"]').first(), p.locator('input[name="attachment_type_photos"]').first()]){
    if(await loc.count()===0)continue;
    await loc.click({force:true}).catch(()=>{}); log('toggled photos'); break;
  }
  await p.waitForTimeout(2500);
  await p.screenshot({path:'/opt/oko-poster/cfg/post_0.png'}).catch(()=>{});
  // 2b) upload video via "Выбрать с устройства"
  let up=false;
  const fc=p.waitForEvent('filechooser',{timeout:6000}).catch(()=>null);
  const dev=p.getByText(/выбрать с устройства/i).first();
  if(await dev.count()){ await dev.scrollIntoViewIfNeeded().catch(()=>{}); await dev.click().catch(()=>{}); log('clicked Выбрать с устройства'); }
  else log('no device button');
  const ch=await fc;
  if(ch){ await ch.setFiles(VIDEO); up=true; log('video set (chooser)'); }
  else { const fi=p.locator('input[type="file"]').first(); if(await fi.count()){ await fi.setInputFiles(VIDEO).catch(()=>{}); up=true; log('video set (input)'); } }
  log('uploaded?',up);
  await p.waitForTimeout(15000);  // wait upload/transcode
  await p.screenshot({path:'/opt/oko-poster/cfg/post_1.png'}).catch(()=>{});
  // 3) select TikTok network: find the tiktok IMG icon (nuxt svg) near "Выбор соц. сетей" and click it
  let picked=false;
  const findIcon=async()=>await p.evaluate(()=>{
    const lbl=[...document.querySelectorAll('label,div,span,p')].find(e=>/Выбор соц\. сетей/.test((e.textContent||'').trim())&&(e.textContent||'').trim().length<25);
    const ay=lbl?lbl.getBoundingClientRect().bottom:0;
    const img=[...document.querySelectorAll('img')].find(e=>{const b=e.getBoundingClientRect();return b.top>=ay-5&&b.top<ay+140&&/_nuxt/.test(e.src)&&b.width<80;});
    if(!img)return null; const b=img.getBoundingClientRect(); return {x:b.x+b.width/2,y:b.y+b.height/2};
  });
  let ic=await findIcon();
  if(ic){ await p.mouse.click(ic.x, ic.y); log('clicked TT net @', Math.round(ic.x), Math.round(ic.y)); await p.waitForTimeout(2800); }
  else log('TT icon not found');
  await p.screenshot({path:'/opt/oko-poster/cfg/post_2.png'}).catch(()=>{});
  // a "TikTok" section with "+" appears; click the LAST visible "+" (in that section)
  let plusClicked=false;
  const pluses=await p.getByText(/^\+$/).all();
  for(let i=pluses.length-1;i>=0;i--){ if(await pluses[i].isVisible().catch(()=>false)){ await pluses[i].click().catch(()=>{}); plusClicked=true; log('clicked +'); await p.waitForTimeout(2800); break; } }
  await p.screenshot({path:'/opt/oko-poster/cfg/post_3.png'}).catch(()=>{});
  // pick the account in the modal/list
  for(const loc of [p.getByText(new RegExp(ACCTXT,'i')).first(), p.locator(`a[href*="${ACCTXT}"]`).first(), p.locator('img[src*="tiktokcdn"]').first(), p.getByText(/@?tappio\.app/i).first()]){
    if(await loc.count()===0)continue; if(!await loc.isVisible().catch(()=>false))continue;
    await loc.click().catch(()=>{}); picked=true; log('picked account'); break;
  }
  for(const t of [/^выбрать$/i,/^добавить$/i,/^готово$/i,/^ок$/i,/^сохранить$/i,/^применить$/i]){const bx=p.getByRole('button',{name:t}).first();if(await bx.count()&&await bx.isVisible().catch(()=>false)){await bx.click().catch(()=>{});await p.waitForTimeout(1500);break;}}
  log('picked?',picked,'plus?',plusClicked); await p.waitForTimeout(1500);
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
