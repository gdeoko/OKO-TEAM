import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
const имя = process.argv[2] || "ПК";
const э = { ...ЭКРАНЫ[имя] }; if (process.env.RC_DPR) э.dpr = +process.env.RC_DPR;
const дир = "tools/audit/out/с-" + имя; fs.mkdirSync(дир, { recursive: true });
const b = await браузер();
const { pg, беды } = await страница(b, э);
const числа = () => pg.evaluate(() => { const r = document.documentElement, I = window.RC_INTERIOR;
  const оп = (s) => { const e = document.querySelector(s); return e ? +(+getComputedStyle(e).opacity).toFixed(2) : null; };
  const F = window.RC_FLIGHT;
  return { y: Math.round(scrollY), акт: window.RC_SCENE && window.RC_SCENE.act,
           обор: I&&I.yaw?+(I.yaw()*57.3).toFixed(1):null, con: I&&I.con?+I.con().toFixed(2):null, back: I&&I.back?+I.back().toFixed(2):null,
           пульт: оп(".rc-desk"), полёт: оп(".rc-flight"), холст: оп("#rocketCanvas"),
           клСлоя: (function(){const e=document.querySelector(".rc-flight");return e?e.className:null;})(),
           кл: ["rc-in-hatch","rc-inside","rc-stage","rc-flying","rc-rocket-parked"].filter(c=>r.classList.contains(c)).join("+") }; });
await pg.evaluate(async () => { const сон=(ms)=>new Promise(r=>setTimeout(r,ms));
  const макс = () => document.documentElement.scrollHeight - innerHeight;
  let g=0; while (scrollY < макс() - 5 && g++ < 60) { scrollBy(0, Math.round(innerHeight*0.9)); await сон(280); } });
await pg.waitForTimeout(15000);
console.log("ДО", JSON.stringify(await числа()));
await pg.screenshot({ path: дир + "/0-до-старта.jpg", type: "jpeg", quality: 72 });
console.log("снят до");
const ок = await вИгру(pg);
console.log("вИгру", ок);
await pg.waitForTimeout(6000);
console.log("ПОСЛЕ", JSON.stringify(await числа()));
await pg.screenshot({ path: дир + "/1-игра.jpg", type: "jpeg", quality: 72 });
console.log("БЕДЫ", JSON.stringify(беды.slice(0,8)));
await b.close();
