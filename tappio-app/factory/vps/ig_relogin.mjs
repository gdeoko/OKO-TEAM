// Ре-логин IG со stealth (patchright) -> сохраняет storageState в ig_state.json (файл постера).
// Env: TAPPIO_IG_LOGIN, TAPPIO_IG_PASSWORD, IG_CODE (6 цифр 2FA, если потребуется).
// Печатает: LOGGED_IN / NEED_2FA / CHECKPOINT / FAIL <url>.
import { chromium } from 'patchright';
import fs from 'fs';
const U=process.env.TAPPIO_IG_LOGIN, P=process.env.TAPPIO_IG_PASSWORD, CODE=(process.env.IG_CODE||'').trim();
const OUT='/opt/oko-poster/cfg/ig_state.json';
const log=(...a)=>console.log('[relogin]',...a);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1280,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US', timezoneId:'Europe/Rome'});
const p=await ctx.newPage();
const isHome=async()=>await p.$('svg[aria-label="Home"], a[href="/direct/inbox/"], a[href*="/accounts/edit"]').then(e=>!!e).catch(()=>false);
try{
  await p.goto('https://www.instagram.com/accounts/login/',{waitUntil:'domcontentloaded',timeout:45000});
  await sleep(4000);
  if(await isHome()){ log('ALREADY_HOME'); await ctx.storageState({path:OUT}); log('LOGGED_IN saved'); await b.close(); process.exit(0); }
  await p.waitForSelector('input[name="email"]',{timeout:20000}).catch(()=>{});
  await p.click('input[name="email"]').catch(()=>{});
  await p.type('input[name="email"]', U, {delay:60}).catch(()=>{});
  await p.click('input[name="pass"]').catch(()=>{});
  await p.type('input[name="pass"]', P, {delay:60}).catch(()=>{});
  await sleep(800);
  const filled=await p.evaluate(()=>({e:(document.querySelector('input[name="email"]')||{}).value?.length||0,p:(document.querySelector('input[name="pass"]')||{}).value?.length||0,btn:!!document.querySelector('button[type="submit"]'),dis:(document.querySelector('button[type="submit"]')||{}).disabled}));
  log('FILLED', JSON.stringify(filled));
  // клик по кнопке Log in
  let clicked=false;
  for(const loc of [p.getByRole('button',{name:/^log in$/i}), p.locator('button[type="submit"]').first()]){
    if(await loc.count().catch(()=>0)){ await loc.click({timeout:4000}).catch(()=>{}); clicked=true; break; }
  }
  if(!clicked){ await p.keyboard.press('Enter').catch(()=>{}); }
  log('submitted clicked='+clicked); await sleep(4000);
  const err=await p.evaluate(()=>{const el=[...document.querySelectorAll('p,div[role="alert"],span')].map(e=>e.innerText).find(t=>t&&/incorrect|problem logging|couldn|try again|wait a few|suspicious|disabled/i.test(t));return el||'';}).catch(()=>'');
  if(err) log('IG_ERROR:', err.slice(0,140));
  // 2FA-код читаем из ФАЙЛА cfg/ig_code.txt (свежий код пишет оператор), до 3 минут.
  const CODEF='/opt/oko-poster/cfg/ig_code.txt';
  try{ fs.unlinkSync(CODEF); }catch(e){}
  const readCode=()=>{ try{ const c=fs.readFileSync(CODEF,'utf8').trim(); return /^\d{6}$/.test(c)?c:''; }catch(e){ return ''; } };
  let codeDone=false;
  for(let i=0;i<45;i++){
    if(await isHome()){ await ctx.storageState({path:OUT}); log('LOGGED_IN saved'); await b.close(); process.exit(0); }
    const urlCode = /codeentry|two_factor|auth_platform|challenge|two_step/i.test(p.url());
    let ci=p.locator('input[name="verificationCode"], input[autocomplete="one-time-code"], input[aria-label*="code" i], input[inputmode="numeric"], input[type="tel"]').first();
    let hasCi = await ci.count().catch(()=>0) && await ci.isVisible().catch(()=>false);
    if(!hasCi && urlCode){ ci = p.locator('input:visible').first(); hasCi = await ci.count().catch(()=>0); }
    const onCode = urlCode || hasCi;
    if(onCode && !codeDone){
      const c = readCode() || (i===0?CODE:'');
      if(c){
        await ci.click().catch(()=>{}); await ci.fill('').catch(()=>{}); await ci.type(c,{delay:110}).catch(()=>{});
        log('code_entered', c);
        for(const t of ['Confirm','Continue','Next','Submit','Подтвердить']){const bt=await p.$(`button:has-text("${t}")`); if(bt&&await bt.isVisible().catch(()=>false)){await bt.click().catch(()=>{});break;}}
        await p.keyboard.press('Enter').catch(()=>{}); codeDone=true; await sleep(6000);
      } else if(i%3===0){ log('WAITING_CODE — жду код ИЛИ подтверждение с телефона'); }
    }
    // код НЕ нужен (подтверждение на телефоне): жмём "This was me / Continue / Confirm" и перезагружаем, ловим одобрение
    if(onCode && !codeDone){
      if(i===1){ const btns=await p.evaluate(()=>[...new Set([...document.querySelectorAll('button,[role="button"],a')].map(b=>(b.innerText||'').trim()).filter(Boolean))].slice(0,14)).catch(()=>[]); log('CODE_SCREEN btns', JSON.stringify(btns)); }
      for(const t of ['This was me','It was me','Yes, this was me','Confirm','Continue','Approve','Dismiss','OK']){
        const bt=await p.$(`button:has-text("${t}")`)||await p.$(`div[role="button"]:has-text("${t}")`)||await p.$(`a:has-text("${t}")`);
        if(bt && await bt.isVisible().catch(()=>false)){ await bt.click().catch(()=>{}); log('clicked '+t); await sleep(4000); break; }
      }
      if(i%4===3){ await p.reload({waitUntil:'domcontentloaded'}).catch(()=>{}); await sleep(3000); log('reloaded, catching approval'); }
    }
    for(const t of ['Not now','Не сейчас','Dismiss','Save info','Trust']){const btn=await p.$(`button:has-text("${t}")`)||await p.$(`div[role="button"]:has-text("${t}")`); if(btn&&await btn.isVisible().catch(()=>false)){await btn.click().catch(()=>{});await sleep(1200);}}
    log('wait', i, (onCode?'CODE_SCREEN':p.url().slice(0,45)));
    await sleep(4000);
  }
  // Ждём подтверждения входа (device approval / 2FA) до ~110с, гасим диалоги "Not now"
  for(let i=0;i<22;i++){
    for(const t of ['Not now','Не сейчас','Dismiss','Save info','Continue']){
      const btn=await p.$(`button:has-text("${t}")`)||await p.$(`div[role="button"]:has-text("${t}")`);
      if(btn && await btn.isVisible().catch(()=>false)){ await btn.click().catch(()=>{}); await sleep(1500); }
    }
    if(await isHome()){ await ctx.storageState({path:OUT}); log('LOGGED_IN saved (approved)'); await b.close(); process.exit(0); }
    log('waiting approval', i, p.url().slice(0,60));
    await sleep(5000);
  }
  const url=p.url(); log('url', url);
  if(await isHome()){ await ctx.storageState({path:OUT}); log('LOGGED_IN saved'); await b.close(); process.exit(0); }
  // 2FA?
  if(/two_factor|codeentry|challenge|auth_platform/i.test(url) || await p.$('input[name="verificationCode"]')){
    if(CODE && /^\d{6}$/.test(CODE)){
      for(const loc of [p.locator('input[name="verificationCode"]'), p.locator('input[autocomplete="one-time-code"]'), p.locator('input[type="tel"]').first()]){
        if(await loc.count().catch(()=>0)){ await loc.fill(CODE).catch(()=>{}); await p.keyboard.press('Enter').catch(()=>{}); break; }
      }
      await sleep(8000);
      if(await isHome()){ await ctx.storageState({path:OUT}); log('LOGGED_IN saved (2FA)'); await b.close(); process.exit(0); }
      log('FAIL_AFTER_2FA', p.url());
    } else { log('NEED_2FA', url); }
  } else {
    const body=(await p.evaluate(()=>document.body.innerText.slice(0,140).replace(/\s+/g,' ')).catch(()=>''))||'';
    log('CHECKPOINT_OR_FAIL', url, '|', body);
  }
  await p.screenshot({path:'/opt/oko-poster/cfg/relogin.png'}).catch(()=>{});
}catch(e){ log('ERR', String(e).slice(0,180)); }
finally{ await b.close(); }
