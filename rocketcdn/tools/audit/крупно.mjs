import { ЭКРАНЫ, браузер, страница, вИгру, проём } from "./общее.mjs";
import fs from "node:fs";
const К="/home/user/OKO-TEAM/rocketcdn/tools/audit/кадры"; fs.mkdirSync(К,{recursive:true});
const b=await браузер();
/* 1. узкий: крупный план обрезанной метки */
{
  const э=ЭКРАНЫ["узкий"]; const {pg}=await страница(b,э);
  if(await вИгру(pg)){
    for (const d of [0,0.3]) {
      await pg.evaluate(v=>window.RC_FLIGHT._set(v), d); await pg.waitForTimeout(2500);
      const м=await pg.evaluate(()=>{
        const из=[]; document.querySelectorAll(".rch-tname").forEach(э=>{
          const r=э.getBoundingClientRect(); if(r.width<3) return;
          const g=э.closest(".rch-glass"); const rg=g?g.getBoundingClientRect():null;
          из.push({t:э.textContent.trim(),обрез:э.scrollWidth-э.clientWidth,
            r:[Math.round(r.left),Math.round(r.top)], g:rg?[Math.round(rg.left),Math.round(rg.top),Math.round(rg.width),Math.round(rg.height)]:null});
        }); return из;});
      console.log("узкий p="+d, JSON.stringify(м));
      const ц=м.find(x=>x.обрез>3);
      if(ц&&ц.g){ try{ await pg.screenshot({path:`${К}/крупно-узкий-p${d}.jpeg`,type:"jpeg",quality:92,timeout:120000,
        clip:{x:Math.max(0,ц.g[0]-8),y:Math.max(0,ц.g[1]-8),width:Math.min(360-Math.max(0,ц.g[0]-8),ц.g[2]+30),height:Math.min(70,ц.g[3]+16)}});}catch(e){console.log("нет кадра",e.message.slice(0,50));} }
    }
  }
  await pg.close();
}
/* 2. лежачий: клавиши пульта и досье */
{
  const э=ЭКРАНЫ["лежачий"]; const {pg}=await страница(b,э);
  if(await вИгру(pg)){
    await pg.evaluate(()=>window.RC_FLIGHT._set(0)); await pg.waitForTimeout(2000);
    const кл=await pg.evaluate(()=>{
      const из=[]; document.querySelectorAll(".rcf-keys button, .rcf-key").forEach(э=>{
        const s=getComputedStyle(э); if(s.display==="none"||s.visibility==="hidden") return;
        const r=э.getBoundingClientRect();
        const низ=r.bottom-innerHeight, прав=r.right-innerWidth, лев=-r.left, верх=-r.top;
        const в=Math.max(низ,прав,лев,верх);
        из.push({t:(э.innerText||"").replace(/\s+/g," ").trim().slice(0,14),
          r:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
          заЭкран:Math.round(в)});
      }); return {vp:[innerWidth,innerHeight], кл:из};});
    console.log("лежачий клавиши", JSON.stringify(кл));
    await pg.evaluate(()=>window.RC_FLIGHT._dos("ЗЕМЛЯ")); await pg.waitForTimeout(2200);
    const дос=await pg.evaluate(()=>{const i=document.querySelector(".rcf-dos-in"); if(!i) return null;
      const r=i.getBoundingClientRect(); const h=i.querySelector(".rcf-dos-h");
      const rh=h?h.getBoundingClientRect():null;
      return {r:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
        sh:i.scrollHeight, ch:i.clientHeight, надЭкраном:Math.round(-r.top),
        загол:rh?[Math.round(rh.left),Math.round(rh.top),Math.round(rh.width),Math.round(rh.height)]:null,
        vp:[innerWidth,innerHeight]};});
    console.log("лежачий досье", JSON.stringify(дос));
    try{ await pg.screenshot({path:`${К}/крупно-лежачий-досье.jpeg`,type:"jpeg",quality:80,timeout:120000}); }catch(e){}
  }
  await pg.close();
}
await b.close();
