import { ЭКРАНЫ, браузер, страница, вИгру, проём, обрезки, завыход, наложения } from "./общее.mjs";
import fs from "node:fs";

const ПОДПИСИ = [".rch-tname",".rch-tag",".rch-sub",".rch-info",".rch-title",".rch-meter"];
const ПАНЕЛИ  = [".rcf-cap",".rcf-mis",".rcf-fail",".rcf-hint",".rcf-course",".rcf-top",
                 ".rcf-toast",".rcf-menu",".rcf-netlist",".rcf-help",".rcf-dos",".rcf-uni",
                 ".rcf-goal",".rcf-info",".rcf-alarm",".rcf-away"];
const ЯЧЕЙКИ  = [".rcf-d-cell",".rcf-d-course",".rcf-d-spd",".rcf-d-nav",".rcf-d-drive",
                 ".rcf-d-bay",".rcf-d-seen",".rcf-d-work",".rcf-d-meter"];
const КОНТ = ["rcf-hud","rcf-top","rcf-deck","rcf-d-main","rcf-d-row","rcf-d-col","rc-holo","rcf-cockpit"];

const экраны = (process.argv[2]||"ПК").split(",");
const доли = (process.argv[3]||"0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1").split(",").map(Number);
const рукав = +(process.argv[4]||0);
const ЛОГ = [];
const КАДРЫ = "/home/user/OKO-TEAM/rocketcdn/tools/audit/кадры";
fs.mkdirSync(КАДРЫ, {recursive:true});

const b = await браузер();
for (const имя of экраны) {
  const э = ЭКРАНЫ[имя];
  const { pg, беды } = await страница(b, э);
  const ok = await вИгру(pg);
  if (!ok) { console.log("НЕ ВОШЛИ", имя); await pg.close(); continue; }
  if (рукав) { await pg.evaluate((n)=>window.RC_FLIGHT._jump(n), рукав); await pg.waitForTimeout(6000); }
  let снимков = 0;
  const w = await проём(pg);
  console.log("=== ЭКРАН", имя, JSON.stringify(э.vp), "рукав", рукав, "проём", JSON.stringify(w));
  for (const d of доли) {
    await pg.evaluate((v)=>window.RC_FLIGHT._set(v), d);
    await pg.waitForTimeout(1600);
    const о1 = await обрезки(pg, ".rc-flight");
    const о2 = await обрезки(pg, ".rc-holo");
    const zv = await завыход(pg, [...ПОДПИСИ, ...ПАНЕЛИ]);
    const nl = await наложения(pg, [...ПОДПИСИ, ...ПАНЕЛИ, ...ЯЧЕЙКИ], КОНТ);
    const зап = {экран:имя, vp:э.vp, рукав, доля:d,
      обрезки:[...о1,...о2].filter(x=>x.бок>1||x.низ>1),
      вылеты: zv.вылеты, наложения: nl};
    ЛОГ.push(зап);
    const есть = зап.обрезки.length||зап.вылеты.length||зап.наложения.length;
    process.stdout.write("");console.log(`-- ${имя} p=${d} обрез=${зап.обрезки.length} вылет=${зап.вылеты.length} налож=${зап.наложения.length}`);
    зап.обрезки.forEach(x=>console.log("   ОБРЕЗ", JSON.stringify(x)));
    зап.вылеты.forEach(x=>console.log("   ВЫЛЕТ", JSON.stringify(x)));
    зап.наложения.forEach(x=>console.log("   НАЛОЖ", JSON.stringify(x)));
    if (есть && снимков < 4) { снимков++;
      try { await pg.screenshot({path:`${КАДРЫ}/${имя}-r${рукав}-p${d}.jpeg`, type:"jpeg", quality:70, timeout:120000}); }
      catch(e){ console.log("   (снимок не вышел)"); } }
  }
  if (беды.length) console.log("беды:", JSON.stringify([...new Set(беды)].slice(0,6)));
  await pg.close();
}
fs.writeFileSync(`/home/user/OKO-TEAM/rocketcdn/tools/audit/лог-${экраны.join("_")}-r${рукав}.json`, JSON.stringify(ЛОГ,null,1));
await b.close();
