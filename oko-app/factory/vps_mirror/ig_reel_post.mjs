import { chromium } from 'patchright';
const PROFILE=process.env.IG_PROFILE||'/opt/oko-poster/cfg/ig_diesel_profile';
const VIDEO=process.env.IG_VIDEO||'/opt/oko-poster/cfg/reel_social.mp4';
const CAP=Buffer.from(process.env.CAPB64||'','base64').toString('utf8')||'DIESEL CARGO';
const S=n=>`/opt/oko-poster/cfg/igr_${n}.png`;
const log=(...a)=>console.log('[igreel]',...a);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ctx=await chromium.launchPersistentContext(PROFILE,{headless:true,channel:'chromium',
  viewport:{width:1280,height:1000},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',locale:'en-US',timezoneId:'Europe/Rome'});
const p=ctx.pages()[0]||await ctx.newPage();
const click=async(cands,label)=>{for(const l of cands){try{if(await l.count()&&await l.first().isVisible().catch(()=>0)){await l.first().click({timeout:5000}).catch(()=>{});log('click',label);return true;}}catch(e){}}return false;};
// JS-level click of a menu item by exact text (robust to role/tag/overlay)
const jsClick=async(texts)=>p.evaluate((texts)=>{
  const els=[...document.querySelectorAll('div[role="menuitem"],a,button,div[role="button"],span,div')];
  const el=els.find(e=>{const t=(e.textContent||'').trim();return texts.includes(t)&&e.offsetParent!==null&&t.length<20;});
  if(el){el.click();return true;}return false;
},texts).catch(()=>false);
const dismiss=async()=>{for(const t of [/not now/i,/^dismiss$/i,/allow all/i,/^ok$/i]){await click([p.getByRole('button',{name:t})],'dlg:'+t.source);await sleep(400);}await p.keyboard.press('Escape').catch(()=>{});};
try{
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:60000});await sleep(6000);
  // Session-resume "Continue as <account>" one-tap page — must submit its form to reach the feed.
  const onOnetap=async()=>p.evaluate(()=>[...document.querySelectorAll('button,div[role="button"]')].some(e=>(e.textContent||'').trim()==='Continue'&&e.offsetParent!==null)).catch(()=>false);
  for(let k=0;k<4&&await onOnetap();k++){
    const jc=await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(e=>(e.textContent||'').trim()==='Continue'&&e.offsetParent!==null);if(b){b.click();return true;}return false;}).catch(()=>false);
    if(!jc){await click([p.getByRole('button',{name:/^continue$/i})],'resume-continue');}
    log('resume-continue',k,jc?'js':'pw');
    await Promise.race([p.waitForNavigation({timeout:12000}).catch(()=>{}),p.waitForLoadState('networkidle',{timeout:12000}).catch(()=>{})]);
    await sleep(3500);
    if(await onOnetap()){await p.keyboard.press('Enter').catch(()=>{});await sleep(3500);}
  }
  if(/accounts\/suspended/.test(p.url())){log('ACCOUNT_SUSPENDED RESULT FAIL_NOFILE');await ctx.close();process.exit(2);}
  const who=await p.evaluate(()=>{const a=[...document.querySelectorAll('a')].map(x=>x.getAttribute('href')).filter(h=>h&&/^\/[a-z0-9._]+\/$/.test(h)&&!/explore|reels|direct|accounts/.test(h));return a[0]||'?';});
  log('WHO',who);
  if(/login|challenge|auth/.test(p.url())){log('BLOCKED_LOGIN RESULT FAIL_NOFILE');await ctx.close();process.exit(2);}
  await dismiss();
  // Attach file: up to 3 full-flow attempts (open create -> click Post -> detect input)
  let fileSet=false;
  for(let attempt=0;attempt<3&&!fileSet;attempt++){
    await click([p.locator('svg[aria-label="New post"]'),p.getByRole('link',{name:/^create$/i}),p.locator('a[href="#"]:has(svg[aria-label="New post"])')],'create'+attempt);
    await sleep(2500);
    for(let i=0;i<12&&!fileSet;i++){
      const fi=p.locator('input[type=file]');
      if(await fi.count()){await fi.first().setInputFiles(VIDEO).catch(e=>log('setErr',e.message));fileSet=true;log('file set (att',attempt,'iter',i+')');break;}
      // click Post submenu (playwright then JS fallback)
      const c=await click([p.getByRole('link',{name:'Post',exact:true}),p.getByText('Post',{exact:true}),p.getByRole('button',{name:/^post$/i})],'Post');
      if(!c) await jsClick(['Post','Публикация','Публикацию']);
      await sleep(1000);
    }
    if(!fileSet){await dismiss();await sleep(1000);}
  }
  log('fileSet',fileSet);
  if(!fileSet){await p.screenshot({path:S('nofile')});log('RESULT FAIL_NOFILE');await ctx.close();process.exit(3);}
  await sleep(9000);
  await click([p.getByRole('button',{name:/^ok$/i})],'ok-reel');await sleep(1500);
  await click([p.locator('svg[aria-label="Select crop"]'),p.locator('[aria-label="Select crop"]')],'crop');await sleep(1500);
  const orig=await click([p.getByRole('button',{name:/^original$/i}),p.getByText('Original',{exact:true})],'original');log('orig',orig);await sleep(1500);
  for(let i=0;i<3;i++){const c=await click([p.getByRole('button',{name:/^next$/i})],'next'+i);if(!c)break;await sleep(2800);}
  await sleep(1500);
  const cb=p.locator('div[aria-label="Write a caption..."], div[contenteditable="true"][role="textbox"], div[contenteditable="true"]').first();
  if(await cb.count()){await cb.click().catch(()=>{});await sleep(500);await p.keyboard.type(CAP.slice(0,2100),{delay:1});log('caption typed',CAP.length);}else log('NO caption box');
  await sleep(1500);
  const sh=await click([p.getByRole('button',{name:/^share$/i}),p.getByText('Share',{exact:true})],'share');log('shareClicked',sh);
  let done=false;
  for(let i=0;i<40;i++){await sleep(3000);const body=await p.evaluate(()=>document.body.innerText).catch(()=>'');
    if(/has been shared|reel has been shared|post has been shared/i.test(body)){log('SHARED at',i*3+3+'s');done=true;break;}}
  await p.screenshot({path:S('final')});
  log('RESULT',done?'SHARED_CONFIRMED':'NO_CONFIRM');
  await ctx.close();process.exit(done?0:4);
}catch(e){log('ERR',e.message,'RESULT FAIL');await ctx.close();process.exit(5);}
