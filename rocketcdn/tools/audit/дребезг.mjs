import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";
const имя = process.argv[2] || "телефон";
const старт = +(process.argv[3] || 8200);
const циклов = +(process.argv[4] || 2);
const э = { ...ЭКРАНЫ[имя] }; if (process.env.RC_DPR) э.dpr = +process.env.RC_DPR;
const b = await браузер();
const { pg, беды } = await страница(b, э);
const файл = "tools/audit/out/дребезг-" + имя + ".ndjson"; fs.writeFileSync(файл, "");
await pg.exposeFunction("отдай", (o) => { fs.appendFileSync(файл, JSON.stringify(o) + "\n"); console.log(JSON.stringify(o)); });
try {
await pg.evaluate(async ({ старт, циклов }) => {
  const сон = (ms) => new Promise(r => setTimeout(r, ms));
  const r = document.documentElement;
  const сн = () => { const I = window.RC_INTERIOR, st = I && I.state ? I.state() : {};
    const оп = (s) => { const e = document.querySelector(s); return e ? +(+getComputedStyle(e).opacity).toFixed(2) : null; };
    return { y: Math.round(scrollY), внутри: r.classList.contains("rc-inside") ? 1 : 0,
             люк: r.classList.contains("rc-in-hatch") ? 1 : 0, сцена: r.classList.contains("rc-stage") ? 1 : 0,
             видна: st.видна ? 1 : 0, напр: st.направление, двер: window.RC_DOOR != null ? +window.RC_DOOR.toFixed(3) : null,
             холст: оп("#rocketCanvas"), полёт: оп(".rc-flight"), обор: I&&I.yaw?+(I.yaw()*57.3).toFixed(1):null }; };
  let g = 0;
  while (scrollY < старт - 5 && g++ < 45) { scrollBy(0, Math.min(Math.round(innerHeight*0.9), старт - scrollY)); await сон(260); }
  await сон(10000);
  await window.отдай({ метка: "исходно", ...сн() });
  for (let c = 0; c < циклов; c++) {
    /* вперёд, пока не окажемся внутри */
    for (let i = 0; i < 8; i++) {
      scrollBy(0, Math.round(innerHeight * 0.1)); await сон(1200);
      const s = сн(); await window.отдай({ цикл: c, ход: "вперёд", шаг: i, ...s });
      if (s.внутри) break;
    }
    /* назад один мелкий шаг */
    for (let i = 0; i < 4; i++) {
      scrollBy(0, -Math.round(innerHeight * 0.05)); await сон(1200);
      const s = сн(); await window.отдай({ цикл: c, ход: "назад", шаг: i, ...s });
      if (!s.внутри) break;
    }
  }
}, { старт, циклов });
} catch (e) { console.log("ОБРЫВ", (e.message||"").slice(0,90)); }
console.log("БЕДЫ", JSON.stringify(беды.slice(0,6)));
await b.close();
