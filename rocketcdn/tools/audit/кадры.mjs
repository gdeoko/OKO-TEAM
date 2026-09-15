import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";

/* Снимки финальной сцены: подвод прокруткой в самой странице,
   снимок из узла. Точки задаются долями от начала «посадки» до дна. */
const имя = process.argv[2] || "телефон";
const шагов = +(process.argv[3] || 26);
const э = ЭКРАНЫ[имя];
const дир = "tools/audit/out/к-" + имя;
fs.mkdirSync(дир, { recursive: true });

const b = await браузер();
const { pg, беды } = await страница(b, э);

/* Куда идём: от «посадки» минус экран до самого дна */
const гр = await pg.evaluate(() => ({
  от: Math.max(0, Math.round(document.getElementById("included").getBoundingClientRect().top + scrollY - innerHeight)),
  до: document.documentElement.scrollHeight - innerHeight
}));
const шаг = Math.round((гр.до - гр.от) / (шагов - 1));

/* подвод к началу */
await pg.evaluate(async (ц) => {
  const сон = (ms) => new Promise(r => setTimeout(r, ms));
  while (scrollY < ц - 5) { scrollBy(0, Math.min(Math.round(innerHeight * 0.3), ц - scrollY)); await сон(260); }
  await сон(2500);
}, гр.от);

const лог = [];
for (let i = 0; i < шагов; i++) {
  const c = await pg.evaluate(() => {
    const r = document.documentElement, I = window.RC_INTERIOR, st = I && I.state ? I.state() : {};
    return { y: Math.round(scrollY), акт: window.RC_SCENE && window.RC_SCENE.act,
             k: window.RC_SCENE ? +window.RC_SCENE.k.toFixed(2) : null,
             под: typeof window.RC_APPROACH === "number" ? +window.RC_APPROACH.toFixed(2) : null,
             двер: typeof window.RC_DOOR === "number" ? +window.RC_DOOR.toFixed(2) : null,
             обор: I && I.yaw ? +(I.yaw() * 57.3).toFixed(0) : null,
             con: I && I.con ? +I.con().toFixed(2) : null, back: I && I.back ? +I.back().toFixed(2) : null,
             холст: (function(){ const c = document.getElementById("rocketCanvas"); return c ? +(+getComputedStyle(c).opacity).toFixed(2) : null; })(),
             слой: (function(){ const c = document.querySelector(".rc-flight"); return c ? +(+getComputedStyle(c).opacity).toFixed(2) : null; })(),
             кл: ["rc-in-hatch","rc-inside","rc-stage","rc-rocket-parked","rc-deep-inside","rc-door-open","rc-doors"].filter(c=>r.classList.contains(c)).join("+") };
  });
  const n = String(i).padStart(2, "0");
  await pg.screenshot({ path: дир + "/" + n + ".jpg", type: "jpeg", quality: 60 });
  c.n = n; лог.push(c);
  console.log(n, JSON.stringify(c));
  if (i < шагов - 1) {
    await pg.evaluate(async ({ ш }) => {
      const сон = (ms) => new Promise(r => setTimeout(r, ms));
      const мелк = Math.max(20, Math.round(ш / 4));
      for (let q = 0; q < 4; q++) { scrollBy(0, мелк); await сон(300); }
      await сон(900);
    }, { ш: шаг });
  }
}
fs.writeFileSync(дир + "/лог.json", JSON.stringify(лог, null, 1));
console.log("БЕДЫ", JSON.stringify(беды.slice(0, 10)));
await b.close();
