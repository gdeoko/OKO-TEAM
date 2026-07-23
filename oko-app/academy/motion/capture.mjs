import { chromium } from 'playwright'; import fs from 'fs';
const SCENE=JSON.parse(fs.readFileSync(process.env.SCENE,'utf8'));
const OUT=process.env.OUTDIR; const FPS=+(process.env.FPS||30);
fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--force-color-profile=srgb']});
const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await p.goto('http://localhost:'+process.env.PORT+'/stage.html',{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
const dur=await p.evaluate(s=>window.OKO_build(s), SCENE);
const frames=Math.round(dur*FPS);
for(let f=0; f<frames; f++){ const t=f/FPS; await p.evaluate(tt=>window.OKO_seek(tt), t); await p.screenshot({path:`${OUT}/f${String(f).padStart(5,'0')}.png`}); }
console.log('frames:',frames,'dur:',dur.toFixed(2));
await b.close(); process.exit(0);
