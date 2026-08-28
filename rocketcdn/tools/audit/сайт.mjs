const { chromium } = await import("/tmp/node_modules/playwright/index.mjs");
import fs from "fs";
const л=(s)=>process.stdout.write(new Date().toISOString().slice(11,19)+" "+s+"\n");
const мера = () => { const из=[];
  document.querySelectorAll("img").forEach((im)=>{ const src=im.getAttribute("src")||"";
    if(!/logo|mark|rocketvpn/i.test(src))return;
    const s=getComputedStyle(im), r=im.getBoundingClientRect(), п=im.parentElement;
    из.push({src, кто:(п&&п.className||"").toString().slice(0,36), disp:s.display, vis:s.visibility, op:s.opacity,
      r:[+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)],
      nat:[im.naturalWidth,im.naturalHeight],
      аН: im.naturalHeight?+(im.naturalWidth/im.naturalHeight).toFixed(4):null,
      аЭ: r.height?+(r.width/r.height).toFixed(4):null,
      fit:s.objectFit, cssW:s.width, cssH:s.height, clip:s.clipPath,
      родOverflow: п?getComputedStyle(п).overflow:null,
      родR: п?[+п.getBoundingClientRect().left.toFixed(1),+п.getBoundingClientRect().top.toFixed(1),+п.getBoundingClientRect().width.toFixed(1),+п.getBoundingClientRect().height.toFixed(1)]:null,
      готов: im.complete&&im.naturalWidth>0 }); });
  return из; };
const b = await chromium.launch({ args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"] });
const из = {};
for (const [имя, vp, dpr, mob] of [["телефон",{width:412,height:800},2,true],["ПК",{width:1440,height:900},1,false]]) {
  const pg = await b.newPage({ viewport: vp, deviceScaleFactor: dpr, isMobile: mob, hasTouch: mob });
  await pg.goto("http://127.0.0.1:8123/", { waitUntil:"domcontentloaded", timeout:180000 });
  await pg.waitForTimeout(7000);
  л(имя+" загружен");
  из[имя+"-верх"] = await pg.evaluate(мера);
  л(имя+" верх снят");
  fs.writeFileSync("tools/audit/out/сайт-лого.json", JSON.stringify(из,null,1));
  await pg.evaluate(() => { const c=document.getElementById("contact"); if(c) c.scrollIntoView({block:"center"}); });
  await pg.waitForTimeout(3500);
  из[имя+"-заявка"] = await pg.evaluate(мера);
  л(имя+" заявка снята");
  fs.writeFileSync("tools/audit/out/сайт-лого.json", JSON.stringify(из,null,1));
  try { const cdp = await pg.context().newCDPSession(pg); const h = из[имя+"-верх"].find(x=>x.disp!=="none"&&x.r[2]>10);
    if (h) { const r = await cdp.send("Page.captureScreenshot",{format:"png",clip:{x:Math.max(0,h.r[0]-14),y:Math.max(0,h.r[1]-14),width:h.r[2]+28,height:h.r[3]+28,scale:5}});
      fs.writeFileSync("tools/audit/кадры/сайт-шапка-"+имя+".png",Buffer.from(r.data,"base64")); л("кадр шапки "+имя); } } catch(e){ л("кадр не вышел"); }
  await pg.close();
}
const pg2 = await b.newPage({ viewport:{width:412,height:800}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await pg2.goto("http://127.0.0.1:8123/app.html",{waitUntil:"domcontentloaded",timeout:180000});
await pg2.waitForTimeout(6000);
из["app"] = await pg2.evaluate(мера);
л("app снят");
fs.writeFileSync("tools/audit/out/сайт-лого.json", JSON.stringify(из,null,1));
try { const cdp = await pg2.context().newCDPSession(pg2); const h = из["app"].find(x=>x.disp!=="none"&&x.r[2]>10);
  if (h) { const r = await cdp.send("Page.captureScreenshot",{format:"png",clip:{x:Math.max(0,h.r[0]-14),y:Math.max(0,h.r[1]-14),width:h.r[2]+28,height:h.r[3]+28,scale:5}});
    fs.writeFileSync("tools/audit/кадры/app-лого.png",Buffer.from(r.data,"base64")); л("кадр app"); } } catch(e){ л("кадр app не вышел"); }
await b.close(); л("конец");
