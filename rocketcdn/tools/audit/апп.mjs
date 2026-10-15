const { chromium } = await import("/tmp/node_modules/playwright/index.mjs");
import fs from "fs";
const л=(s)=>process.stdout.write(new Date().toISOString().slice(11,19)+" "+s+"\n");
const мера=()=>{const из=[];document.querySelectorAll("img").forEach((im)=>{const src=im.getAttribute("src")||"";
 if(!/logo|mark|rocketvpn/i.test(src))return;const s=getComputedStyle(im),r=im.getBoundingClientRect(),п=im.parentElement;
 из.push({src,кто:(п&&п.className||"").toString().slice(0,30),disp:s.display,vis:s.visibility,
  r:[+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)],nat:[im.naturalWidth,im.naturalHeight],
  аН:im.naturalHeight?+(im.naturalWidth/im.naturalHeight).toFixed(4):null,аЭ:r.height?+(r.width/r.height).toFixed(4):null,
  cssW:s.width,cssH:s.height,fit:s.objectFit,clip:s.clipPath,готов:im.complete&&im.naturalWidth>0});});return из;};
const b=await chromium.launch({args:["--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
const из={};
for (const [имя,vp,dpr,mob,url] of [["app-тел",{width:412,height:800},2,true,"/app.html"],
                                     ["app-пк",{width:1440,height:900},1,false,"/app.html"]]) {
  const pg=await b.newPage({viewport:vp,deviceScaleFactor:dpr,isMobile:mob,hasTouch:mob});
  await pg.goto("http://127.0.0.1:8123"+url,{waitUntil:"domcontentloaded",timeout:180000});
  await pg.waitForTimeout(6000);
  из[имя]=await pg.evaluate(мера); л(имя+" снят");
  fs.writeFileSync("tools/audit/out/апп-лого.json",JSON.stringify(из,null,1));
  try{const cdp=await pg.context().newCDPSession(pg);const h=из[имя].find(x=>x.disp!=="none"&&x.r[2]>10);
   if(h){const r=await cdp.send("Page.captureScreenshot",{format:"png",clip:{x:Math.max(0,h.r[0]-12),y:Math.max(0,h.r[1]-12),width:h.r[2]+24,height:h.r[3]+24,scale:5}});
    fs.writeFileSync("tools/audit/кадры/"+имя+"-лого.png",Buffer.from(r.data,"base64"));л("кадр "+имя);}}catch(e){л("кадр не вышел");}
  await pg.close();
}
await b.close(); л("конец");
