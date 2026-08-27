import { АДРЕС, ЭКРАНЫ, браузер, страница, вИгру, проём } from "./общее.mjs";

const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);
const ok = await вИгру(pg);
console.log("вошли:", ok);
await pg.waitForTimeout(3000);
console.log("проём:", JSON.stringify(await проём(pg)));
const st = await pg.evaluate(() => window.RC_FLIGHT && window.RC_FLIGHT.state());
console.log("state:", JSON.stringify(st));
// список видимых текстовых узлов в слое игры
const узлы = await pg.evaluate(() => {
  const из = [];
  document.querySelectorAll(".rc-flight *, .rc-holo *").forEach(э => {
    const s = getComputedStyle(э);
    if (s.display==="none"||s.visibility==="hidden"||+s.opacity<0.06) return;
    const r = э.getBoundingClientRect();
    if (r.width<4||r.height<4) return;
    const t = (э.textContent||"").replace(/\s+/g," ").trim();
    if (!t) return;
    const свой = [...э.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
    if (!свой) return;
    из.push({к: (э.className||"").toString().slice(0,60), t: t.slice(0,40),
      r:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
      sw: э.scrollWidth, cw: э.clientWidth, sh: э.scrollHeight, ch: э.clientHeight,
      ov: s.overflow+"/"+s.overflowX+"/"+s.overflowY, ws: s.whiteSpace, to: s.textOverflow});
  });
  return из;
});
console.log("узлов:", узлы.length);
узлы.forEach(u=>console.log(JSON.stringify(u)));
console.log("беды:", JSON.stringify(беды.slice(0,10)));
await pg.screenshot({path:"/home/user/OKO-TEAM/rocketcdn/tools/audit/кадры/recon-пк.jpeg", type:"jpeg", quality:80});
await b.close();
