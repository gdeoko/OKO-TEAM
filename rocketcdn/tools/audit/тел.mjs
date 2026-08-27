const { chromium } = await import("/tmp/node_modules/playwright/index.mjs");
import fs from "fs";
const л = (s) => { process.stdout.write(new Date().toISOString().slice(11,19) + " " + s + "\n"); };
л("старт");
const b = await chromium.launch({ args:["--use-gl=swiftshader","--enable-unsafe-swiftshader","--autoplay-policy=no-user-gesture-required"] });
л("браузер");
const pg = await b.newPage({ viewport:{width:412,height:800}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
await pg.goto("http://127.0.0.1:8123/?rcdbg=1", { waitUntil:"domcontentloaded", timeout:180000 });
л("грузится");
await pg.waitForTimeout(9000);
л("выдержка");
const ок = await pg.evaluate(() => { if (window.RC_FLIGHT && window.RC_FLIGHT.open) { window.RC_FLIGHT.open(); return true; }
  const k = document.querySelector(".js-flight"); if (k) { k.click(); return true; } return false; });
л("в игру: " + ок);
await pg.waitForTimeout(13000);
await pg.evaluate(() => { const b2 = document.querySelector(".rcf-brief-btns button[data-mode='manual']") ||
  document.querySelector(".rcf-brief-btns button") || document.querySelector(".rcf-brief .rcf-go");
  if (b2) b2.click(); const br = document.querySelector(".rcf-brief"); if (br) br.classList.add("off"); });
await pg.waitForTimeout(3000);
л("брифинг закрыт");
const д = await pg.evaluate(() => {
  const w = document.querySelector(".rc-flight"); const cs = w ? getComputedStyle(w) : null;
  const сн = (c) => { const e = document.querySelector(c); if (!e) return null; const s = getComputedStyle(e), r = e.getBoundingClientRect();
    const im = e.tagName==="IMG"?e:e.querySelector("img");
    return { r:[+r.left.toFixed(1),+r.top.toFixed(1),+r.width.toFixed(1),+r.height.toFixed(1)], op:s.opacity, pe:s.pointerEvents,
      right:s.right, bottom:s.bottom, клип:s.clipPath.slice(0,120),
      img: im?{nat:[im.naturalWidth,im.naturalHeight], r:[+im.getBoundingClientRect().left.toFixed(1),+im.getBoundingClientRect().top.toFixed(1),+im.getBoundingClientRect().width.toFixed(1),+im.getBoundingClientRect().height.toFixed(1)], fit:getComputedStyle(im).objectFit}:null }; };
  return { классы: w?w.className:null,
    перем: cs?["--cab-wx","--cab-wy","--cab-ww","--cab-wh","--cab-dy"].reduce((o,k)=>(o[k]=cs.getPropertyValue(k).trim(),o),{}):null,
    holo: сн(".rcf-holo"), vpn: сн(".rc-vpn-projector"), vw:innerWidth, vh:innerHeight };
});
л("замер: " + JSON.stringify(д));
fs.writeFileSync("tools/audit/out/тел-замер.json", JSON.stringify(д,null,1));
try {
  const cdp = await pg.context().newCDPSession(pg);
  const h = д.holo.r;
  let r = await cdp.send("Page.captureScreenshot", { format:"png", clip:{ x:Math.max(0,h[0]-26), y:Math.max(0,h[1]-26), width:h[2]+52, height:h[3]+52, scale:6 } });
  fs.writeFileSync("tools/audit/кадры/холо-телефон.png", Buffer.from(r.data,"base64"));
  л("кадр холо снят");
  r = await cdp.send("Page.captureScreenshot", { format:"png", clip:{ x:0, y:д.vh*0.45, width:д.vw, height:д.vh*0.55, scale:1.6 } });
  fs.writeFileSync("tools/audit/кадры/низ-телефон.png", Buffer.from(r.data,"base64"));
  л("кадр низа снят");
} catch(e) { л("кадр не вышел " + e.message.slice(0,80)); }
await b.close();
л("конец");
