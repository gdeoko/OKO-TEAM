import { АДРЕС, ЭКРАНЫ, браузер, вИгру, проём, обрезки, завыход, наложения } from "./общее.mjs";
import fs from "node:fs";
const КАДРЫ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/кадры";
fs.mkdirSync(КАДРЫ,{recursive:true});
const ПОДПИСИ = [".rch-tname",".rch-tag",".rch-sub",".rch-info",".rch-title",".rch-meter"];
const ПАНЕЛИ  = [".rcf-cap",".rcf-mis",".rcf-fail",".rcf-hint",".rcf-course",".rcf-top",
                 ".rcf-toast",".rcf-menu",".rcf-netlist",".rcf-help",".rcf-dos",".rcf-uni",
                 ".rcf-goal",".rcf-info",".rcf-alarm",".rcf-away",".rcf-keyhint"];
const ЯЧЕЙКИ  = [".rcf-d-cell",".rcf-d-course",".rcf-d-spd",".rcf-d-nav",".rcf-d-drive",
                 ".rcf-d-bay",".rcf-d-seen",".rcf-d-work",".rcf-d-meter",".rcf-keys button u",".rcf-keys button b"];
const КОНТ = ["rcf-hud","rcf-top","rcf-deck","rcf-d-main","rcf-d-row","rcf-d-col","rc-holo","rcf-cockpit"];
const экраны = (process.argv[2]||"ПК").split(",");
const доли = (process.argv[3]||"0,0.15,0.3,0.5,0.7,0.9").split(",").map(Number);
const рукав = +(process.argv[4]||0);
const b = await браузер();
for (const имя of экраны) {
  const э = ЭКРАНЫ[имя];
  const pg = await b.newPage({viewport:э.vp, deviceScaleFactor:э.dpr, isMobile:э.mob, hasTouch:э.mob});
  await pg.addInitScript(()=>{ try{localStorage.setItem("rc_lang","en");}catch(e){} document.documentElement.lang="en"; });
  await pg.goto(АДРЕС, {waitUntil:"domcontentloaded", timeout:120000});
  await pg.waitForTimeout(9000);
  const яз = await pg.evaluate(()=>document.documentElement.lang);
  if (!await вИгру(pg)) { console.log("НЕ ВОШЛИ", имя); await pg.close(); continue; }
  if (рукав) { await pg.evaluate(n=>window.RC_FLIGHT._jump(n), рукав); await pg.waitForTimeout(6000); }
  console.log("=== EN", имя, JSON.stringify(э.vp), "lang="+яз, "рукав", рукав, "проём", JSON.stringify(await проём(pg)));
  let сн=0;
  for (const d of доли) {
    await pg.evaluate(v=>window.RC_FLIGHT._set(v), d);
    await pg.waitForTimeout(1600);
    const о = [...await обрезки(pg,".rc-flight"), ...await обрезки(pg,".rc-holo")].filter(x=>x.бок>1||x.низ>1);
    const zv = await завыход(pg,[...ПОДПИСИ,...ПАНЕЛИ]);
    const nl = await наложения(pg,[...ПОДПИСИ,...ПАНЕЛИ,...ЯЧЕЙКИ],КОНТ);
    console.log(`-- EN ${имя} p=${d} обрез=${о.length} вылет=${zv.вылеты.length} налож=${nl.length}`);
    о.forEach(x=>console.log("   ОБРЕЗ",JSON.stringify(x)));
    zv.вылеты.forEach(x=>console.log("   ВЫЛЕТ",JSON.stringify(x)));
    nl.forEach(x=>console.log("   НАЛОЖ",JSON.stringify(x)));
    if ((о.length||zv.вылеты.length||nl.length) && сн<3) { сн++;
      try{ await pg.screenshot({path:`${КАДРЫ}/en-${имя}-r${рукав}-p${d}.jpeg`,type:"jpeg",quality:70,timeout:120000}); }catch(e){console.log("   (снимок не вышел)");} }
  }
  await pg.close();
}
await b.close();
