import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs'; import path from 'path';
const JOBS=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const OUT=process.argv[3]||'aov'; const FPS=30; const ONE=process.argv[4]==='one';
const html='http://localhost:8765/anim/glb_view.html';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--force-color-profile=srgb']});
for(const job of JOBS){
  const frames=ONE?1:Math.max(2,Math.round(job.params.dur*FPS));
  const fdir=path.join(OUT,'_g'+job.id); fs.mkdirSync(fdir,{recursive:true});
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await page.addInitScript(p=>{window.PARAMS=p;},job.params);
  await page.goto(html,{waitUntil:'load'});
  await page.waitForFunction('window.__ready===true',{timeout:60000}).catch(()=>{});
  const err=await page.evaluate(()=>window.__err||null); if(err) console.log('ERR '+job.id, err);
  for(let i=0;i<frames;i++){const t=ONE?job.params.dur*0.4:i/FPS; await page.evaluate(tt=>window.renderT(tt),t);
    await page.screenshot({path:path.join(fdir,String(i).padStart(4,'0')+'.png'),omitBackground:true});}
  await page.close();
  if(!ONE){execSync(`ffmpeg -v error -y -framerate ${FPS} -i ${fdir}/%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -auto-alt-ref 0 ${OUT}/g${job.id}.webm`);fs.rmSync(fdir,{recursive:true,force:true});}
  console.log('glb done', job.id);
}
await browser.close(); console.log('GLB RENDER DONE');
