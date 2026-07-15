import { chromium } from 'patchright';
const cards={
 ekat:`<!doctype html><html><head><meta charset=utf8><style>
 @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;800&family=Montserrat:wght@500;600&display=swap');
 *{margin:0;box-sizing:border-box}
 body{width:1080px;height:1920px;background:linear-gradient(160deg,#f7efe2 0%,#efe0c9 45%,#e7d3b3 100%);color:#3a2f22;
  font-family:Montserrat,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative;overflow:hidden}
 .halo{position:absolute;top:340px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,#fff6e0 0%,rgba(255,246,224,0) 70%)}
 .rays{position:absolute;top:120px;font-size:160px;color:#d9b877}
 .k{font-family:'Playfair Display';font-weight:800;font-size:104px;line-height:1.05;margin:0 60px;color:#2e2519}
 .sub{margin-top:38px;font-weight:600;font-size:46px;letter-spacing:1px;color:#7a6game}
 .sub{color:#6f5b3c}
 .line{margin-top:54px;width:120px;height:4px;background:#c49a52;border-radius:4px}
 .h{margin-top:46px;font-family:'Playfair Display';font-weight:600;font-size:40px;color:#8a6f45}
 </style></head><body>
 <div class=rays>✦</div><div class=halo></div>
 <div class=k>Воспитание<br>с любовью и верой</div>
 <div class=sub>тепло дома · спокойствие · опора</div>
 <div class=line></div>
 <div class=h>@mama_s_bogom</div>
 </body></html>`,
 diesel:`<!doctype html><html><head><meta charset=utf8><style>
 @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Montserrat:wght@500;700&display=swap');
 *{margin:0;box-sizing:border-box}
 body{width:1080px;height:1920px;background:radial-gradient(120% 80% at 50% 0%,#1a1e24 0%,#0c0e12 60%);color:#fff;
  font-family:Montserrat,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;position:relative;overflow:hidden}
 .stripes{position:absolute;inset:0;background:repeating-linear-gradient(45deg,#f5b70011 0 40px,transparent 40px 80px);opacity:.5}
 .glow{position:absolute;bottom:-160px;width:640px;height:640px;border-radius:50%;background:#f5b70022;filter:blur(90px)}
 .tag{font-family:Oswald;font-weight:700;font-size:40px;letter-spacing:8px;color:#f5b700}
 .k{font-family:Oswald;font-weight:700;font-size:118px;line-height:1;margin:22px 50px 0;text-transform:uppercase}
 .sub{margin-top:34px;font-weight:500;font-size:44px;color:#c7ccd4;margin-left:60px;margin-right:60px}
 .bar{margin-top:52px;padding:20px 46px;background:#f5b700;color:#111;font-family:Oswald;font-weight:700;font-size:44px;letter-spacing:2px;border-radius:8px}
 </style></head><body>
 <div class=stripes></div><div class=glow></div>
 <div class=tag>DIESEL · CARGO</div>
 <div class=k>Спецтехника<br>из Китая</div>
 <div class=sub>подбор · выкуп · доставка под ключ</div>
 <div class=bar>dieselcompany.pro</div>
 </body></html>`
};
const b=await chromium.launch({headless:true,channel:'chromium'});
for(const [k,html] of Object.entries(cards)){
  const pg=await (await b.newContext({viewport:{width:1080,height:1920},deviceScaleFactor:1})).newPage();
  await pg.setContent(html,{waitUntil:'networkidle'}); await pg.waitForTimeout(1200);
  await pg.screenshot({path:`/opt/oko-poster/cfg/${k}_card.png`});
  console.log('rendered',k);
}
await b.close();
