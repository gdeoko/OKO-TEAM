// Drive Hooppy create-post form for one account + capture the publish payload.
import { chromium } from 'patchright';
import fs from 'fs';
const HS='/opt/oko-poster/cfg/hooppy_session.json';
const ACC_MATCH=process.env.ACC_MATCH||'tappio';   // text to find the account
const log=(...a)=>console.log('[drv]',...a);
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({storageState:fs.existsSync(HS)?HS:undefined,viewport:{width:1440,height:1100},locale:'ru-RU',
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'});
const p=await ctx.newPage();
const captured=[];
p.on('request',r=>{ const u=r.url(); if(r.method()==='POST'&&/posts|publish/i.test(u)){ captured.push({u,body:(r.postData()||'').slice(0,2500)}); } });
try{
  await p.goto('https://hooppy.ru/posts/create',{waitUntil:'domcontentloaded',timeout:35000});
  await p.waitForTimeout(4000);
  // dump account-picker + button structure
  const struct=await p.evaluate((m)=>{
    const accs=[...document.querySelectorAll('*')].filter(e=>e.children.length<=3 && (e.innerText||'').toLowerCase().includes(m) && (e.innerText||'').length<40).map(e=>({tag:e.tagName,cls:(e.className||'').toString().slice(0,40),txt:(e.innerText||'').trim().slice(0,30)})).slice(0,6);
    const btns=[...document.querySelectorAll('button,[role=button],a.btn,input[type=submit]')].map(e=>(e.innerText||e.value||'').trim()).filter(Boolean).slice(0,25);
    return {accs,btns};
  }, ACC_MATCH);
  log('ACC_ELEMENTS', JSON.stringify(struct.accs));
  log('BUTTONS', JSON.stringify(struct.btns));
  // click the account (by visible text)
  const accLoc=p.getByText(new RegExp(ACC_MATCH,'i')).first();
  if(await accLoc.count()){ await accLoc.click().catch(()=>{}); log('clicked account'); await p.waitForTimeout(1500); }
  // type text into the editor
  const ta=p.locator('textarea, [contenteditable="true"]').first();
  if(await ta.count()){ await ta.click().catch(()=>{}); await ta.fill?.('').catch(()=>{}); await p.keyboard.type('Тест публикации'); log('typed text'); }
  await p.waitForTimeout(1000);
  await p.screenshot({path:'/opt/oko-poster/cfg/drv.png'}).catch(()=>{});
  // click publish button
  for(const t of [/^опубликовать$/i,/^опубликовать сейчас$/i,/^публиковать$/i,/^создать$/i,/^post$/i]){
    const btn=p.getByRole('button',{name:t}).first();
    if(await btn.count()&&await btn.isVisible().catch(()=>false)){ await btn.click().catch(()=>{}); log('clicked publish', t.source); break; }
  }
  await p.waitForTimeout(6000);
  log('CAPTURED', JSON.stringify(captured));
  await p.screenshot({path:'/opt/oko-poster/cfg/drv2.png'}).catch(()=>{});
}catch(e){ log('ERR',String(e).slice(0,220)); }
finally{ await b.close(); }
