// Inspect Hooppy create-post form + capture the real publish API payload.
import { chromium } from 'patchright';
import fs from 'fs';
const HS='/opt/oko-poster/cfg/hooppy_session.json';
const log=(...a)=>console.log('[hf]',...a);
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({storageState:fs.existsSync(HS)?HS:undefined,viewport:{width:1366,height:1000},locale:'ru-RU',
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'});
const p=await ctx.newPage();
const posts=[];
p.on('request',r=>{ if(r.method()==='POST' && /\/api\/posts|\/posts\b/.test(r.url())){ posts.push({url:r.url(), body:(r.postData()||'').slice(0,2000)}); } });
try{
  // try create-post routes
  for(const u of ['https://hooppy.ru/posts/create','https://hooppy.ru/posts/add','https://hooppy.ru/posts/new','https://hooppy.ru/create-post']){
    await p.goto(u,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
    await p.waitForTimeout(2500);
    if(!/404|not found/i.test(await p.title().catch(()=>''))&&!p.url().includes('/auth/login')){ log('create page', p.url()); break; }
  }
  await p.waitForTimeout(3000);
  await p.screenshot({path:'/opt/oko-poster/cfg/hf_create.png'}).catch(()=>{});
  // dump form inputs / textareas / selects names
  const fields=await p.evaluate(()=>{
    const out=[];
    for(const e of document.querySelectorAll('input,textarea,select,[name],[data-name],[formcontrolname]')){
      const n=e.getAttribute('name')||e.getAttribute('formcontrolname')||e.getAttribute('data-name'); const t=e.getAttribute('type')||e.tagName.toLowerCase();
      if(n) out.push(`${n}:${t}`);
    }
    return [...new Set(out)].slice(0,60);
  });
  log('FIELDS', JSON.stringify(fields));
  // find schedule-related words in page text
  const sched=await p.evaluate(()=>{const m=document.body.innerText.match(/(расписан|сейчас|очеред|отложен|запланир|время публикац)[^\n]{0,30}/gi);return m?[...new Set(m)].slice(0,10):[];});
  log('SCHEDULE_WORDS', JSON.stringify(sched));
  log('CAPTURED_POSTS', JSON.stringify(posts));
}catch(e){log('ERR',String(e).slice(0,220));}
finally{await b.close();}
