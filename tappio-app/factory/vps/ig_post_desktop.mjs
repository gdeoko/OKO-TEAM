// Create a real IG feed post via desktop-web using the saved session (storageState).
import { chromium } from 'patchright';
import fs from 'fs';
const STATE='/opt/oko-poster/cfg/ig_state.json';
const IMG='/opt/oko-poster/cfg/tappio_post.png';
const CAP=process.env.IG_CAPTION||'three tools. one standard.\n\ntappio is coming.';
const S=n=>`/opt/oko-poster/cfg/post_${n}.png`;
const log=(...a)=>console.log('[igpost]',...a);

const b=await chromium.launch({headless:true,channel:'chromium',args:['--no-sandbox']});
const ctx=await b.newContext({
  storageState:fs.existsSync(STATE)?STATE:undefined,
  viewport:{width:1280,height:900},
  userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  locale:'en-US',timezoneId:'Europe/Rome'});
const p=await ctx.newPage();
try{
  await p.goto('https://www.instagram.com/',{waitUntil:'domcontentloaded',timeout:45000});
  await p.waitForTimeout(6000);
  log('url',p.url());
  if(/login|challenge|codeentry|auth_platform/.test(p.url())){log('BLOCKED re-challenge, aborting');await p.screenshot({path:S('blocked')});await b.close();process.exit(0);}
  // dismiss "Save login info" / notifications dialogs
  for(const t of [/not now/i,/^dismiss$/i]){const x=p.getByRole('button',{name:t}).first();if(await x.count()&&await x.isVisible().catch(()=>false)){await x.click().catch(()=>{});await p.waitForTimeout(1500);}}
  await p.screenshot({path:S('0home')}).catch(()=>{});

  // open create menu
  for(const loc of [p.getByRole('link',{name:/^create$/i}).first(),p.locator('svg[aria-label="New post"]').first(),p.getByRole('button',{name:/^create$/i}).first(),p.getByText(/^create$/i).first()]){
    if(await loc.count()===0)continue; if(!await loc.isVisible().catch(()=>false))continue;
    await loc.click().catch(()=>{}); log('clicked create'); break;
  }
  await p.waitForTimeout(2000);
  // click the "Post" submenu item
  let postClicked=false;
  for(const loc of [p.getByRole('link',{name:'Post',exact:true}).first(),p.locator('a:has-text("Post"),div[role="link"]:has-text("Post")').filter({hasText:/^Post$/}).first(),p.getByText('Post',{exact:true}).first()]){
    if(await loc.count()===0)continue; if(!await loc.isVisible().catch(()=>false))continue;
    await loc.click().catch(()=>{}); postClicked=true; log('clicked Post'); break;
  }
  log('postClicked',postClicked);
  await p.waitForTimeout(2500);
  await p.screenshot({path:S('1create')}).catch(()=>{});

  // set the file (Select from computer)
  let fileSet=false;
  const fc=p.waitForEvent('filechooser',{timeout:5000}).catch(()=>null);
  const sel=p.getByRole('button',{name:/select from computer/i}).first();
  if(await sel.count()&&await sel.isVisible().catch(()=>false)){await sel.click().catch(()=>{});}
  const chooser=await fc;
  if(chooser){await chooser.setFiles(IMG);fileSet=true;log('file via chooser');}
  if(!fileSet){const fi=p.locator('input[type=file]').first();if(await fi.count()){await fi.setInputFiles(IMG);fileSet=true;log('file via input');}}
  log('fileSet',fileSet);
  await p.waitForTimeout(4000);
  await p.screenshot({path:S('2crop')}).catch(()=>{});

  // Next (crop) -> Next (filters) -> caption
  for(let i=0;i<2;i++){
    const nx=p.getByRole('button',{name:/^next$/i}).first();
    if(await nx.count()&&await nx.isVisible().catch(()=>false)){await nx.click().catch(()=>{});log('next',i);await p.waitForTimeout(2500);}
  }
  await p.screenshot({path:S('3caption')}).catch(()=>{});

  // caption
  const capBox=p.locator('textarea[aria-label*="caption" i], div[contenteditable="true"][aria-label*="caption" i], div[role="textbox"]').first();
  if(await capBox.count()){await capBox.click().catch(()=>{});await capBox.type(CAP,{delay:20});log('caption typed');}
  else log('caption box not found');
  await p.waitForTimeout(1500);
  await p.screenshot({path:S('4ready')}).catch(()=>{});

  // Share
  const share=p.getByRole('button',{name:/^share$/i}).first();
  if(await share.count()&&await share.isVisible().catch(()=>false)){await share.click().catch(()=>{});log('SHARE clicked');}
  else log('share button not found');
  // wait for confirmation
  for(let i=0;i<24;i++){
    const txt=await p.evaluate(()=>document.body.innerText).catch(()=>'');
    if(/post has been shared|your post|shared/i.test(txt)){log('SHARED CONFIRMED');break;}
    await p.waitForTimeout(2500);
  }
  await p.waitForTimeout(2000);
  await p.screenshot({path:S('5done')}).catch(()=>{});
  log('final url',p.url());
}catch(e){log('ERR',String(e).slice(0,250));await p.screenshot({path:S('err')}).catch(()=>{});}
finally{await b.close();}
