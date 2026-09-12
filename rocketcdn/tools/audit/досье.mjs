import { ЭКРАНЫ, браузер, страница, вИгру, обрезки, завыход, наложения } from "./общее.mjs";
import fs from "node:fs";
const КАДРЫ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/кадры";
fs.mkdirSync(КАДРЫ,{recursive:true});
const экраны = (process.argv[2]||"ПК").split(",");
const имена = (process.argv[3]||"ЗЕМЛЯ,ЛУНА,МАРС,ЮПИТЕР,САТУРН,НЕПТУН,УРАН,ВЕНЕРА,МЕРКУРИЙ,СОЛНЦЕ,АСТЕРОИДНЫЙ,КОМЕТА,RC-SAT,ЧЁРНАЯ").split(",");
const b = await браузер();
for (const имя of экраны) {
  const э = ЭКРАНЫ[имя];
  const { pg } = await страница(b, э);
  if (!await вИгру(pg)) { console.log("НЕ ВОШЛИ", имя); await pg.close(); continue; }
  console.log("=== ДОСЬЕ", имя, JSON.stringify(э.vp));
  for (const н of имена) {
    const т = await pg.evaluate((x)=>window.RC_FLIGHT._dos(x), н);
    if (!т) { console.log("--", н, "НЕ НАЙДЕНО"); continue; }
    await pg.waitForTimeout(1800);
    const карта = await pg.evaluate(()=>{
      const d = document.querySelector(".rcf-dos");
      if (!d || !d.classList.contains("on")) return {нет:true};
      const из = [];
      d.querySelectorAll("*").forEach(э=>{
        const s=getComputedStyle(э); if(s.display==="none"||s.visibility==="hidden") return;
        const r=э.getBoundingClientRect(); if(r.width<4||r.height<4) return;
        const свой=[...э.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
        if(!свой) return;
        из.push({к:(э.className||"").toString().slice(0,40),
          t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,50),
          бок:э.scrollWidth-э.clientWidth, низ:э.scrollHeight-э.clientHeight,
          ov:s.overflow+"/"+s.overflowY, r:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]});
      });
      const in_ = d.querySelector(".rcf-dos-in");
      const ri = in_?in_.getBoundingClientRect():null;
      return {узлы:из, окно:in_?{sw:in_.scrollWidth,cw:in_.clientWidth,sh:in_.scrollHeight,ch:in_.clientHeight,
        r:[Math.round(ri.left),Math.round(ri.top),Math.round(ri.width),Math.round(ri.height)]}:null,
        vp:[innerWidth,innerHeight]};
    });
    const о = await обрезки(pg, ".rcf-dos");
    const плохо = карта.нет || о.length || (карта.окно && (карта.окно.sh-карта.окно.ch>2 || карта.окно.sw-карта.окно.cw>2));
    console.log("--", имя, н, "=>", т, JSON.stringify(карта.окно), "обрез:", о.length);
    о.forEach(x=>console.log("   ОБРЕЗ", JSON.stringify(x)));
    (карта.узлы||[]).filter(u=>u.бок>1||u.низ>1).forEach(u=>console.log("   УЗЕЛ", JSON.stringify(u)));
    if (плохо) await pg.screenshot({path:`${КАДРЫ}/дос-${имя}-${н.replace(/[^A-Za-zА-Яа-яЁё0-9-]/g,"_")}.jpeg`,type:"jpeg",quality:72});
    await pg.evaluate(()=>{const x=document.querySelector(".rcf-dos-x");if(x)x.click();
      const d=document.querySelector(".rcf-dos");if(d)d.classList.remove("on");});
    await pg.waitForTimeout(900);
  }
  await pg.close();
}
await b.close();
