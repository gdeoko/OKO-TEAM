import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await p.goto('http://localhost:8856/etalon/cover.html',{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(400);
await p.screenshot({path:process.env.MM+'/etalon/cover_m1_0.png'});
await b.close(); process.exit(0);
