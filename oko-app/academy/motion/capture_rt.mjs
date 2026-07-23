import { chromium } from 'playwright'; import fs from 'fs';
const SCENE=JSON.parse(fs.readFileSync(process.env.SCENE,'utf8'));
const OUTDIR=process.env.OUTDIR; fs.mkdirSync(OUTDIR,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--force-color-profile=srgb']});
const t0=Date.now();
const ctx=await b.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:OUTDIR,size:{width:1920,height:1080}}});
const p=await ctx.newPage();
await p.goto('http://localhost:'+process.env.PORT+'/stage.html',{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
const dur=await p.evaluate(s=>window.OKO_build(s), SCENE);
const offset=(Date.now()-t0)/1000;           // сколько записалось ДО старта проигрывания
await p.evaluate(()=>window.OKO_play());
await p.waitForTimeout(80);
const vid=p.video(); await ctx.close();
const path=await vid.path();
fs.writeFileSync(OUTDIR+'/meta.json', JSON.stringify({webm:path,dur,offset}));
console.log('WEBM:'+path+' dur:'+dur.toFixed(2)+' offset:'+offset.toFixed(2));
await b.close(); process.exit(0);
