import { chromium } from 'playwright';
import { execSync } from 'child_process';
import fs from 'fs';
const WD="/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad/reel02";
const F="/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts";
const b64=p=>fs.readFileSync(p).toString('base64');
const M9=b64(`${F}/montserrat-v31-cyrillic_latin-900.ttf`), M7=b64(`${F}/montserrat-v31-cyrillic_latin-700.ttf`), PF=b64(`${F}/PlayfairDisplay-Bold.ttf`);
const logo=b64(`${WD}/work/logo_t.png`);
const JOBS=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const OUT=`${WD}/ov`; const FPS=30;
const HTML=(body,css)=>`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'M9';src:url(data:font/ttf;base64,${M9})}
@font-face{font-family:'M7';src:url(data:font/ttf;base64,${M7})}
@font-face{font-family:'PF';src:url(data:font/ttf;base64,${PF})}
*{margin:0;padding:0;box-sizing:border-box} html,body{width:1080px;height:1920px;overflow:hidden;background:transparent}
body{position:relative;font-family:'M9';color:#FAF8F5} .LOGO{content:url(data:image/png;base64,${logo})}
${css}</style></head><body>${body}</body></html>`;
const E=`function eoc(x){return 1-Math.pow(1-x,3)} function eox(x){return x>=1?1:1-Math.pow(2,-10*x)} function eio(x){return x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2} function eob(x){const c=1.70158,c3=c+1;return 1+c3*Math.pow(x-1,3)+c*Math.pow(x-1,2)} function cl(a,b,x){return Math.max(a,Math.min(b,x))} function seg(t,a,b){return cl(0,1,(t-a)/(b-a))}`;
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--force-color-profile=srgb']});
for(const job of JOBS){
  const dur=job.dur, frames=Math.max(2,Math.round(dur*FPS));
  const page=await browser.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
  await page.setContent(HTML(job.body, job.css||''));
  await page.addScriptTag({content:`${E}\nwindow.renderT=${job.render}`});
  const fdir=`${OUT}/_f${job.id}`; fs.mkdirSync(fdir,{recursive:true});
  for(let i=0;i<frames;i++){ await page.evaluate(t=>window.renderT(t), i/FPS); await page.screenshot({path:`${fdir}/${String(i).padStart(4,'0')}.png`,omitBackground:true}); }
  const out=`${OUT}/o${job.id}.webm`;
  execSync(`ffmpeg -v error -y -framerate ${FPS} -i ${fdir}/%04d.png -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 24 -auto-alt-ref 0 ${out}`);
  fs.rmSync(fdir,{recursive:true,force:true});
  console.log('OK o'+job.id, job.kind, dur+'s', frames+'f');
  await page.close();
}
await browser.close();
console.log('DONE');
