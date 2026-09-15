import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";
const имя = process.argv[2] || "ПК";
const цели = (process.argv[3] || "10850,10980").split(",").map(Number);
const э = { ...ЭКРАНЫ[имя] }; if (process.env.RC_DPR) э.dpr = +process.env.RC_DPR;
const дир = "tools/audit/out/п-" + имя; fs.mkdirSync(дир, { recursive: true });
const b = await браузер();
const { pg, беды } = await страница(b, э);
await pg.exposeFunction("отдай", (o) => console.log(JSON.stringify(o)));
async function числа() {
  return pg.evaluate(() => { const r = document.documentElement, I = window.RC_INTERIOR, st = I && I.state ? I.state() : {};
    const оп = (s) => { const e = document.querySelector(s); return e ? +(+getComputedStyle(e).opacity).toFixed(2) : null; };
    return { y: Math.round(scrollY), акт: window.RC_SCENE && window.RC_SCENE.act, под: window.RC_APPROACH, двер: window.RC_DOOR,
             обор: I && I.yaw ? +(I.yaw()*57.3).toFixed(1) : null, con: I&&I.con?+I.con().toFixed(2):null,
             холст: оп("#rocketCanvas"), полёт: оп(".rc-flight"), ворота: оп(".rc-gate"), видна: st.видна?1:0,
             кл: ["rc-in-hatch","rc-inside","rc-stage","rc-rocket-parked"].filter(c=>r.classList.contains(c)).join("+") }; });
}
/* подвод крупными шагами */
await pg.evaluate(async (ц) => { const сон=(ms)=>new Promise(r=>setTimeout(r,ms));
  let g=0; while (scrollY < ц - 5 && g++ < 45) { scrollBy(0, Math.min(Math.round(innerHeight*0.9), ц - scrollY)); await сон(260); } }, цели[0]);
await pg.waitForTimeout(14000);
for (let i = 0; i < цели.length; i++) {
  if (i) {
    await pg.evaluate(async (ц) => { const сон=(ms)=>new Promise(r=>setTimeout(r,ms));
      let g=0; while (scrollY < ц - 5 && g++ < 40) { scrollBy(0, Math.min(Math.round(innerHeight*0.1), ц - scrollY)); await сон(900); } }, цели[i]);
    await pg.waitForTimeout(14000);
  }
  const c = await числа();
  console.log(i, JSON.stringify(c));
  await pg.screenshot({ path: дир + "/" + i + "-" + c.y + ".jpg", type: "jpeg", quality: 72 });
  console.log("снят", i);
}
console.log("БЕДЫ", JSON.stringify(беды.slice(0,6)));
await b.close();
