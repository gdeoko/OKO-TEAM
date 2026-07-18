// Постинг Reels в IG через storageState (живая сессия аккаунта), а не персистентный профиль.
// Универсально: STATE, IG_VIDEO, CAPB64 задаются окружением. Для Tappio: ig_state.json.
import { chromium } from 'patchright';
import fs from 'fs';
const STATE=process.env.IG_STATE||'/opt/oko-poster/cfg/ig_state.json';
const VIDEO=process.env.IG_VIDEO||'/opt/oko-poster/cfg/spy_real.mp4';
const COVER=process.env.IG_COVER||'';   // кадр-0 (наш дизайн) как обложка рила
const CAP=Buffer.from(process.env.CAPB64||'','base64').toString('utf8') || 'tappio';
const TAG=process.env.IG_TAG||'igstate';
const S=n=>`/opt/oko-poster/cfg/${TAG}_${n}.png`;
const log=(...a)=>console.log('['+TAG+']',...a);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

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
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:60000});
  await sleep(6000);
  log('url',p.url());
  if(/login|challenge|codeentry|auth_platform|two_factor/.test(p.url())){ log('BLOCKED_LOGIN'); await p.screenshot({path:S('blocked')}); await ctx.close(); await b.close(); process.exit(0); }
  const who=await p.evaluate(()=>{const a=[...document.querySelectorAll('a')].map(x=>x.getAttribute('href')).filter(h=>h&&/^\/[a-z0-9._]+\/$/.test(h)&&!/explore|reels|direct|accounts|popular|meta/.test(h));return a[0]||'?';});
  log('WHO',who);
  for(const t of [/not now/i,/^dismiss$/i,/allow all/i]){ await clickAny([p.getByRole('button',{name:t})],'dialog:'+t.source); await sleep(800);}
  await p.screenshot({path:S('0home')}).catch(()=>{});
  await clickAny([p.locator('svg[aria-label="New post"]'), p.getByRole('link',{name:/^create$/i}), p.getByRole('button',{name:/^create$/i}), p.getByText(/^create$/i)],'create');
  await sleep(2500);
  await clickAny([p.getByRole('link',{name:'Post',exact:true}), p.getByText('Post',{exact:true})],'Post-submenu');
  await sleep(2500);
  await p.screenshot({path:S('1dialog')}).catch(()=>{});
  let fileSet=false;
  const fc=p.waitForEvent('filechooser',{timeout:8000}).catch(()=>null);
  await clickAny([p.getByRole('button',{name:/select from computer/i})],'select-file');
  const chooser=await fc;
  if(chooser){ await chooser.setFiles(VIDEO); fileSet=true; log('file via chooser'); }
  if(!fileSet){ const fi=p.locator('input[type=file]').first(); if(await fi.count()){ await fi.setInputFiles(VIDEO); fileSet=true; log('file via input'); } }
  log('fileSet',fileSet);
  await sleep(8000);
  await p.screenshot({path:S('2loaded')}).catch(()=>{});
  await clickAny([p.getByRole('button',{name:/^ok$/i})],'ok-reel'); await sleep(1500);
  await clickAny([p.locator('svg[aria-label="Select crop"]'), p.locator('[aria-label="Select crop"]'), p.getByRole('button',{name:/select crop|crop|aspect/i})],'crop-icon');
  await sleep(1200);
  const gotOrig=await clickAny([p.getByRole('button',{name:/^original$/i}), p.getByText('Original',{exact:true}), p.getByText('9:16',{exact:true})],'aspect-original');
  log('aspect-original',gotOrig);
  await sleep(1200);
  await p.screenshot({path:S('2b_crop')}).catch(()=>{});
  // Экран Edit содержит секцию "Cover photo" -> "Select from computer": грузим наш кадр-0.
  let coverDone=false;
  for(let i=0;i<3;i++){
    let hasCover=false;
    try{ hasCover=await p.evaluate(()=>[...document.querySelectorAll('span,div,button')].some(e=>/^cover photo$/i.test(((e.getAttribute&&e.getAttribute('aria-label'))||e.innerText||'').trim()))); }catch(e){}
    if(hasCover && COVER && fs.existsSync(COVER) && !coverDone){
      try{
        await p.screenshot({path:S('4a_cover_pre')}).catch(()=>{});
        const covLbl=p.getByText('Cover photo',{exact:true}).first();
        const sec=covLbl.locator('xpath=ancestor::div[2]');
        const fc2=p.waitForEvent('filechooser',{timeout:6000}).catch(()=>null);
        for(const loc of [sec.getByText(/select from computer/i).first(), p.getByText(/select from computer/i).first()]){
          if(await loc.count().catch(()=>0)){ await loc.click({timeout:3000}).catch(()=>{}); break; }
        }
        const ch2=await fc2;
        if(ch2){ await ch2.setFiles(COVER); coverDone=true; log('cover uploaded (Cover photo)'); await sleep(3500);
          await clickAny([p.getByRole('button',{name:/^done$/i}), p.getByRole('button',{name:/^apply$/i}), p.getByRole('button',{name:/^save$/i})],'cover-done'); await sleep(1200); }
        else log('cover chooser не открылся');
        await p.screenshot({path:S('4b_cover_post')}).catch(()=>{});
      }catch(e){ log('cover upload err',String(e).slice(0,140)); }
    }
    await p.screenshot({path:S('3screen'+i)}).catch(()=>{});
    const clicked=await clickAny([p.getByRole('button',{name:/^next$/i})],'next'+i);
    if(!clicked) break; await sleep(2500);
  }
  log('coverDone',coverDone);
  await sleep(1500);
  if(process.env.IG_DRYRUN){ log('DRYRUN — обложка coverDone='+coverDone+', шеринг пропущен'); await ctx.close(); await b.close(); process.exit(0); }
  const capBox=p.locator('div[aria-label="Write a caption..."], textarea[aria-label="Write a caption..."], div[contenteditable="true"]').first();
  if(await capBox.count()){ await capBox.click().catch(()=>{}); await p.keyboard.type(CAP.slice(0,2100),{delay:2}); log('caption typed'); }
  else log('NO caption box');
  await sleep(1500);
  await p.screenshot({path:S('4caption')}).catch(()=>{});
  await clickAny([p.getByRole('button',{name:/^share$/i}), p.getByText(/^share$/i)],'share');
  let done=false;
  for(let i=0;i<40;i++){ // up to ~120s (16MB reel processing)
    await sleep(3000);
    const body=(await p.evaluate(()=>document.body.innerText).catch(()=>''))||'';
    if(/reel has been shared|post has been shared|has been shared/i.test(body)){ log('SHARED confirmed at',i*3+'s'); done=true; break; }
    const dialogGone=!/New reel|Sharing|Create new post|Crop|Edit|Write a caption/i.test(body);
    if(dialogGone && i>=4){ log('dialog closed at',i*3+'s'); done=true; break; }
  }
  await sleep(4000);
  await p.screenshot({path:S('5shared')}).catch(()=>{});
  log('RESULT', (fileSet && done)?'LIKELY_SHARED':'CHECK');
}catch(e){ log('ERR', String(e).slice(0,220)); await p.screenshot({path:S('err')}).catch(()=>{}); }
finally{ await ctx.close(); await b.close(); }
