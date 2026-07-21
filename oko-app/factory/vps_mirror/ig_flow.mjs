// ig_flow.mjs <profile> <email> <passB64> <tag>
import { chromium } from 'patchright';
import fs from 'fs';
const [profile, email, passB64, tag] = process.argv.slice(2);
const pass = Buffer.from(passB64,'base64').toString('utf8');
const CF = `/opt/oko-poster/cfg`;
const log=(m)=>fs.appendFileSync(`${CF}/flow_${tag}.log`,`[${Date.now()}] ${m}\n`);
const status=(s)=>fs.writeFileSync(`${CF}/${tag}_status.txt`,s);
const ctx = await chromium.launchPersistentContext(profile,{headless:true,viewport:{width:412,height:892},
  userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36', locale:'ru-RU'});
const p = ctx.pages()[0] || await ctx.newPage();
const shot=(n)=>p.screenshot({path:`${CF}/flow_${tag}_${n}.png`}).catch(()=>{});
const clickText=async(ts)=>{for(const t of ts){const e=await p.$(`button:has-text("${t}"), div[role="button"]:has-text("${t}")`);if(e&&await e.isVisible().catch(()=>0)){await e.click().catch(()=>{});return true;}}return false;};
const findCodeInput=async()=>{
  const cands=await p.$$('input');
  for(const el of cands){
    const t=await el.getAttribute('type').catch(()=>'');
    const vis=await el.isVisible().catch(()=>false);
    if(!vis) continue;
    if(t==='hidden'||t==='checkbox'||t==='radio') continue;
    return el;
  }
  return null;
};
try{
  status('LOGGING_IN');
  await p.goto('https://www.instagram.com/accounts/login/',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForSelector('input[name="email"],input[name="username"]',{timeout:20000}).catch(()=>{});
  await p.waitForTimeout(1500);
  const eb=await p.$('input[name="email"],input[name="username"]'); const pb=await p.$('input[name="pass"],input[name="password"]');
  if(!eb||!pb){status('NO_FORM');log('no form '+p.url());await ctx.close();process.exit(0);}
  await eb.click(); await eb.type(email,{delay:55}); await pb.click(); await pb.type(pass,{delay:55});
  await p.waitForTimeout(400);
  const btn=await p.$('button[type="submit"], div[role="button"]:has-text("Войти"), button:has-text("Войти"), button:has-text("Log in")');
  if(btn) await btn.click().catch(()=>{}); else await pb.press('Enter');
  await p.waitForTimeout(9000); await shot('login'); log('after login '+p.url());
  if(/codeentry|auth_platform|challenge|two_factor/.test(p.url())){
    status('CODE_SENT');
    // dump inputs so we know the selector
    const dump=await p.$$eval('input',els=>els.map(e=>`${e.name||''}|${e.type||''}|${e.getAttribute('autocomplete')||''}|${e.getAttribute('aria-label')||''}|${e.placeholder||''}|vis${e.offsetParent!==null}`)).catch(()=>[]);
    log('INPUTS '+JSON.stringify(dump));
    log('code sent, polling '+`${CF}/${tag}_code.txt`);
    let code=null;
    for(let i=0;i<108;i++){
      try{if(fs.existsSync(`${CF}/${tag}_code.txt`)){const c=fs.readFileSync(`${CF}/${tag}_code.txt`,'utf8').replace(/\D/g,'');if(c.length>=6){code=c.slice(0,8);break;}}}catch(e){}
      await p.waitForTimeout(5000);
    }
    if(!code){status('CODE_TIMEOUT');log('timeout');await ctx.close();process.exit(0);}
    const inp=await findCodeInput();
    if(!inp){status('NO_CODE_INPUT');log('no input after dump '+p.url());await shot('noinput');await ctx.close();process.exit(0);}
    await inp.click(); await inp.type(code,{delay:120}); await shot('typed'); log('typed code');
    if(!await clickText(['Продолжить','Continue','Подтвердить'])) { await inp.press('Enter'); }
    await p.waitForTimeout(9000); await shot('submit'); log('submitted '+p.url());
  } else if(/accounts\/login/.test(p.url())){ status('LOGIN_FAILED'); log('login failed'); await ctx.close(); process.exit(0); }
  await clickText(['Сохранить данные','Save info','Сохранить']); await p.waitForTimeout(2500);
  await clickText(['Не сейчас','Not now']); await p.waitForTimeout(2500);
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:30000}); await p.waitForTimeout(4000); await shot('final');
  const html=(await p.content()).toLowerCase(); const url=p.url();
  const inFeed=/svg aria-label|создать|для вас|переключить|профиль/.test(html) && !/войти или зарегистрироваться|открыть instagram|open instagram/.test(html);
  const st=/codeentry|auth_platform/.test(url)?'STILL_CODE':(inFeed?'LOGGED_IN':'NOT_LOGGED_IN');
  status(st); log('DONE '+st+' '+url);
  await ctx.storageState({path:`${CF}/ig_${tag}_state.json`}).catch(()=>{});
  // keep context a bit so cookies flush
  await p.waitForTimeout(1500);
}catch(e){status('ERROR');log('ERR '+String(e).slice(0,180));}
finally{await ctx.close();}
