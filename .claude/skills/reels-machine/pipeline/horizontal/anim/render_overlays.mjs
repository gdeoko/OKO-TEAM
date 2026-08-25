import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const JOBS = JSON.parse(fs.readFileSync(process.argv[2],'utf8')); // [{id,params}]
const OUT = process.argv[3] || 'aov';
const FPS = 30;
fs.mkdirSync(OUT,{recursive:true});
const htmlPath = 'file://'+path.resolve('anim/overlay.html');

const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args:['--force-color-profile=srgb','--disable-lcd-text']});
for (const job of JOBS){
  const dur = job.params.dur;
  const frames = Math.max(2,Math.round(dur*FPS));
  const fdir = path.join(OUT,'_f'+job.id); fs.mkdirSync(fdir,{recursive:true});
  const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
  await page.addInitScript((p)=>{window.PARAMS=p;}, job.params);
  await page.goto(htmlPath,{waitUntil:'networkidle'});
  await page.waitForFunction('window.__ready===true',{timeout:5000}).catch(()=>{});
  for(let i=0;i<frames;i++){
    const t=i/FPS;
    await page.evaluate((tt)=>window.renderT(tt), t);
    await page.screenshot({path:path.join(fdir,String(i).padStart(4,'0')+'.png'),omitBackground:true});
  }
  // assemble transparent webm (vp9 alpha)
  const out=path.join(OUT,'o'+job.id+'.webm');
  execSync(`ffmpeg -v error -y -framerate ${FPS} -i ${fdir}/%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 20 -auto-alt-ref 0 ${out}`);
  fs.rmSync(fdir,{recursive:true,force:true});
  await page.close();
  console.log('rendered o'+job.id, job.params.kind, dur+'s', frames+'f');
}
await browser.close();
console.log('ALL OVERLAYS DONE');
