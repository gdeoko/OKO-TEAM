import { ЭКРАНЫ, браузер, страница, вИгру, проём } from "./общее.mjs";
import fs from "node:fs";
const КАДРЫ="/home/user/OKO-TEAM/rocketcdn/tools/audit/кадры"; fs.mkdirSync(КАДРЫ,{recursive:true});
const экраны=(process.argv[2]||"узкий,ПК").split(",");
const b=await браузер();
for (const имя of экраны){
  const э=ЭКРАНЫ[имя];
  const {pg}=await страница(b,э);
  if(!await вИгру(pg)){console.log("НЕ ВОШЛИ",имя);await pg.close();continue;}
  await pg.evaluate(()=>window.RC_FLIGHT._set(0)); await pg.waitForTimeout(2000);
  const w=await проём(pg);
  console.log("=== ЛЕНТА",имя,JSON.stringify(э.vp),"проём",JSON.stringify(w));
  const д=await pg.evaluate(()=>{
    const из={};
    const снять=(с)=>{const э=document.querySelector(с); if(!э) return null;
      const s=getComputedStyle(э), r=э.getBoundingClientRect();
      return {с, sw:э.scrollWidth, cw:э.clientWidth, sh:э.scrollHeight, ch:э.clientHeight,
        ov:s.overflow+"|"+s.overflowX+"|"+s.overflowY, disp:s.display,
        r:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        t:(э.innerText||"").replace(/\s+/g," ").trim().slice(0,80)};};
    из.dtop=снять(".rcf-d-top"); из.deck=снять(".rcf-deck"); из.dface=снять(".rcf-d-face");
    из.top=снять(".rcf-top"); из.hud=снять(".rcf-hud");
    из.дети=[];
    document.querySelectorAll(".rcf-d-top > *, .rcf-d-top > * > *").forEach(э=>{
      const s=getComputedStyle(э), r=э.getBoundingClientRect();
      из.дети.push({к:(э.className||"").toString().slice(0,30), tag:э.tagName,
        disp:s.display, vis:s.visibility, op:s.opacity,
        r:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,30)});
    });
    из.клавиши=[];
    document.querySelectorAll(".rcf-keys button").forEach(э=>{
      const u=э.querySelector("u"), bb=э.querySelector("b");
      const r=э.getBoundingClientRect();
      из.клавиши.push({t:(э.textContent||"").replace(/\s+/g," ").trim().slice(0,26),
        r:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        uОбрез:u?u.scrollWidth-u.clientWidth:null, uТекст:u?u.textContent.slice(0,20):null,
        bОбрез:bb?bb.scrollWidth-bb.clientWidth:null});
    });
    из.метки=[];
    document.querySelectorAll(".rch-tname").forEach(э=>{
      const s=getComputedStyle(э); if(s.display==="none") return;
      const r=э.getBoundingClientRect(); if(r.width<3) return;
      const g=э.closest(".rch-glass"); const rg=g?g.getBoundingClientRect():null;
      из.метки.push({t:э.textContent.trim(), нужно:э.scrollWidth, дано:э.clientWidth,
        обрез:э.scrollWidth-э.clientWidth,
        r:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        карта:rg?[Math.round(rg.left),Math.round(rg.top),Math.round(rg.width)]:null});
    });
    из.holo = window.RC_HOLO && RC_HOLO.state ? RC_HOLO.state() : null;
    return из;
  });
  console.log(JSON.stringify(д,null,1));
  // Крупный план карточек меток
  const обл = д.метки.length ? д.метки[0] : null;
  try{
    await pg.screenshot({path:`${КАДРЫ}/лента-${имя}.jpeg`,type:"jpeg",quality:80,timeout:120000,
      clip:{x:Math.max(0,w.л-10), y:Math.max(0,w.в-6), width:Math.min(э.vp.width-Math.max(0,w.л-10), w.п-w.л+20), height:70}});
  }catch(e){console.log("(лента не снялась)",e.message.slice(0,60));}
  await pg.close();
}
await b.close();
