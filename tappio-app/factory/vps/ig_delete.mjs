// БЕЗОПАСНОЕ удаление одного поста/рила по shortcode (только наш аккаунт).
// Env: IG_STATE, IG_DELCODE (обязателен), IG_USER (для проверки владельца), IG_DRYRUN (стоп до подтверждения).
// Защита: удаляем только если владелец поста == IG_USER. Печатает DELETED / DRYRUN_OK / SKIP_* / ERR.
import { chromium } from 'patchright';
import fs from 'fs';
const STATE=process.env.IG_STATE||'/opt/oko-poster/cfg/ig_state.json';
const CODE=(process.env.IG_DELCODE||'').trim();
const USER=(process.env.IG_USER||'tappio.app.pro').trim();
const DRY=process.env.IG_DRYRUN;
const log=(...a)=>console.log('[del]',...a);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(!CODE){ log('SKIP_NO_CODE'); process.exit(0); }
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({
  storageState:fs.existsSync(STATE)?STATE:undefined,
  viewport:{width:1280,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US', timezoneId:'Europe/Rome'});
const p=await ctx.newPage();
async function clickAny(cands,label){
  for(const loc of cands){ try{ if(await loc.count() && await loc.first().isVisible().catch(()=>false)){ await loc.first().click({timeout:4000}).catch(()=>{}); log('clicked',label); return true; } }catch(e){} }
  return false;
}
try{
  // сам пост
  let url='https://www.instagram.com/reel/'+CODE+'/';
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000}); await sleep(5000);
  if(/login|challenge|auth_platform/.test(p.url())){ log('SKIP_BLOCKED_LOGIN'); await ctx.close(); await b.close(); process.exit(0); }
  // пост доступен?
  const body0=(await p.evaluate(()=>document.body.innerText).catch(()=>''))||'';
  if(/Sorry, this page isn|isn't available|Page Not Found/i.test(body0)){ log('SKIP_NOT_FOUND (уже удалён?)'); await ctx.close(); await b.close(); process.exit(0); }
  // проверка владельца: на странице поста имя автора должно быть наш USER
  const owner=await p.evaluate(()=>{
    const a=[...document.querySelectorAll('a[href^="/"]')].map(x=>x.getAttribute('href')).find(h=>/^\/[a-z0-9._]+\/$/.test(h)&&!/explore|reels|direct|accounts|p\/|reel\//.test(h));
    return a?a.replace(/\//g,''):'?';
  });
  log('owner',owner,'expected',USER);
  if(owner!=='?' && owner.toLowerCase()!==USER.toLowerCase()){ log('SKIP_NOT_OWNER ('+owner+') — НЕ удаляю чужой пост'); await ctx.close(); await b.close(); process.exit(0); }
  await p.screenshot({path:'/opt/oko-poster/cfg/del_0post.png'}).catch(()=>{});
  // ДИАГНОСТИКА: все svg-иконки и кнопки на странице поста (найти реальный "...")
  try{
    const d=await p.evaluate(()=>({
      svgs:[...new Set([...document.querySelectorAll('svg[aria-label]')].map(s=>s.getAttribute('aria-label')))].slice(0,40),
      btns:[...new Set([...document.querySelectorAll('button,[role="button"]')].map(b=>(b.getAttribute('aria-label')||b.innerText||'').trim()).filter(Boolean))].slice(0,30)
    }));
    log('SVGS',JSON.stringify(d.svgs)); log('BTNS',JSON.stringify(d.btns));
  }catch(e){ log('diag err',String(e).slice(0,80)); }
  // "..." More options — верхний рил в скроллере = наш. Кликаем кликабельного предка иконки "More".
  const moreClicked=await clickAny([
    p.locator('svg[aria-label="More options"]').first().locator('xpath=ancestor::*[@role="button" or self::button][1]'),
    p.locator('svg[aria-label="More"]').first().locator('xpath=ancestor::*[@role="button" or self::button][1]'),
    p.locator('svg[aria-label="More options"]').first(),
    p.locator('svg[aria-label="More"]').first(),
    p.getByRole('button',{name:/more options|^more$/i}).first()
  ],'more-options');
  await sleep(2000);
  await p.screenshot({path:'/opt/oko-poster/cfg/del_1menu.png'}).catch(()=>{});
  // дамп именно диалога/меню (portal): ищем "Delete"
  try{
    const dlg=await p.evaluate(()=>{
      const dl=[...document.querySelectorAll('[role="dialog"]')].map(d=>(d.innerText||'').replace(/\s+/g,' ').trim().slice(0,200));
      const items=[...new Set([...document.querySelectorAll('[role="dialog"] button,[role="dialog"] [role="button"],[role="menuitem"]')].map(b=>(b.innerText||'').trim()).filter(Boolean))].slice(0,20);
      return {dl,items};
    });
    log('DIALOGS',JSON.stringify(dlg.dl)); log('MENU',JSON.stringify(dlg.items));
  }catch(e){ log('menu diag err',String(e).slice(0,80)); }
  await p.screenshot({path:'/opt/oko-poster/cfg/del_1menu.png'}).catch(()=>{});
  // прямого "Delete" может не быть — сначала "Manage post" -> подменю
  if(!(await p.getByText('Delete',{exact:true}).count().catch(()=>0))){
    const mg=await clickAny([p.getByText('Manage post',{exact:true}), p.getByRole('button',{name:/manage post/i})],'manage-post');
    if(mg){ await sleep(1800); await p.screenshot({path:'/opt/oko-poster/cfg/del_1b_manage.png'}).catch(()=>{});
      try{ const it=await p.evaluate(()=>[...new Set([...document.querySelectorAll('[role="dialog"] button,[role="dialog"] [role="button"],[role="menuitem"]')].map(b=>(b.innerText||'').trim()).filter(Boolean))].slice(0,20)); log('MANAGE',JSON.stringify(it)); }catch(e){}
    }
  }
  // "Delete" в меню/подменю
  const gotDel=await clickAny([p.getByRole('button',{name:/^delete$/i}), p.getByText('Delete',{exact:true})],'delete-menu');
  await sleep(1200);
  if(!gotDel){ log('ERR_NO_DELETE_ITEM'); await p.screenshot({path:'/opt/oko-poster/cfg/del_err.png'}).catch(()=>{}); await ctx.close(); await b.close(); process.exit(0); }
  await p.screenshot({path:'/opt/oko-poster/cfg/del_2confirm.png'}).catch(()=>{});
  if(DRY){ log('DRYRUN_OK — меню Delete открыто, подтверждение НЕ нажимаю'); await ctx.close(); await b.close(); process.exit(0); }
  // подтверждение Delete (кнопка в модалке)
  await clickAny([p.getByRole('button',{name:/^delete$/i}), p.getByText('Delete',{exact:true})],'delete-confirm');
  await sleep(4000);
  // проверка: пост стал недоступен
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:40000}).catch(()=>{}); await sleep(3000);
  const body1=(await p.evaluate(()=>document.body.innerText).catch(()=>''))||'';
  const gone=/Sorry, this page isn|isn't available|Page Not Found/i.test(body1);
  log(gone?'DELETED '+CODE:'DELETE_UNCONFIRMED '+CODE);
}catch(e){ log('ERR',String(e).slice(0,200)); await p.screenshot({path:'/opt/oko-poster/cfg/del_err.png'}).catch(()=>{}); }
finally{ await ctx.close(); await b.close(); }
