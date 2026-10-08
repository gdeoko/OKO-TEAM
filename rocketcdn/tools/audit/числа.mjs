import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";

const имя = process.argv[2] || "телефон";
const отY = +(process.argv[3] || -1);
const доY = +(process.argv[4] || -1);
const дв = +(process.argv[5] || 900);
const э = { ...ЭКРАНЫ[имя] }; if (process.env.RC_DPR) э.dpr = +process.env.RC_DPR;
fs.mkdirSync("tools/audit/out", { recursive: true });
const файл = "tools/audit/out/ч-" + имя + "-" + (process.argv[6] || отY) + ".ndjson";
fs.writeFileSync(файл, "");

const b = await браузер();
const t0=Date.now(); const от=()=>((Date.now()-t0)/1000).toFixed(0);
const { pg, беды } = await страница(b, э); console.log("ЗАГРУЗКА "+от());
console.log("ЭКСПОРТ пошёл "+от());
await pg.exposeFunction("отдай", (o) => { fs.appendFileSync(файл, JSON.stringify(o) + "\n"); console.log(JSON.stringify(o)); });

try {
  await pg.evaluate(async ({ доляШага, ждать, отY, доY }) => {
    const сон = (ms) => new Promise((r) => setTimeout(r, ms));
    const r = document.documentElement;
    const снять = () => {
      const I = window.RC_INTERIOR;
      const st = I && I.state ? I.state() : {};
      const F = window.RC_FLIGHT;
      const оп = (s) => { const e = document.querySelector(s); return e ? +(+getComputedStyle(e).opacity).toFixed(2) : null; };
      return {
        y: Math.round(scrollY),
        акт: window.RC_SCENE && window.RC_SCENE.act,
        k: window.RC_SCENE ? +window.RC_SCENE.k.toFixed(3) : null,
        под: typeof window.RC_APPROACH === "number" ? +window.RC_APPROACH.toFixed(3) : null,
        двер: typeof window.RC_DOOR === "number" ? +window.RC_DOOR.toFixed(3) : null,
        обор: I && I.yaw ? +(I.yaw() * 57.3).toFixed(1) : null,
        con: I && I.con ? +I.con().toFixed(3) : null,
        back: I && I.back ? +I.back().toFixed(3) : null,
        вх: I && I.enter ? +I.enter().toFixed(3) : null,
        доля: st.доля, физ: st.физическая_доля, вПорог: st.порог_вход,
        видна: st.видна ? 1 : 0, прох: st.проход, мёртв: st.мёртв ? 1 : 0,
        сцена: F ? (F.stage ? 1 : 0) : null, stageK: F && F.stageK != null ? +F.stageK.toFixed(3) : null,
        холст: оп("#rocketCanvas"), полёт: оп(".rc-flight"), ворота: оп(".rc-gate"), пульт: оп(".rc-desk"),
        деград: r.getAttribute("data-degrade"),
        кл: ["rc-in-hatch","rc-inside","rc-deep-inside","rc-approach","rc-door-open","rc-doors","rc-rocket-parked","rc-stage","rc-reduced","rc-fast"]
              .filter(c => r.classList.contains(c)).join("+")
      };
    };
    const шаг = Math.round(innerHeight * доляШага);
    const макс = document.documentElement.scrollHeight - innerHeight;
    const низ = Math.max(0, Math.round(document.getElementById("included").getBoundingClientRect().top + scrollY - innerHeight * 1.2));
    const от = отY >= 0 ? отY : низ;
    const до = доY >= 0 ? доY : макс;
    let охрана = 0;
    await window.отдай({ метка: "подвод старт", y: Math.round(scrollY), цель: от });
    while (scrollY < от - 5 && охрана++ < 45) { scrollBy(0, Math.min(Math.round(innerHeight * 0.9), от - scrollY)); await сон(260); }
    await window.отдай({ метка: "подвод конец", y: Math.round(scrollY) });
    await сон(6000);
    for (let i = 0; i < 400; i++) {
      await window.отдай(снять());
      if (scrollY >= макс - 2 || scrollY >= до) break;
      scrollBy(0, шаг);
      await сон(ждать);
    }
  }, { доляШага: 0.12, ждать: дв, отY, доY });
} catch (e) { console.log("ОБРЫВ", (e.message || "").slice(0, 120)); }
console.log("БЕДЫ " + JSON.stringify(беды.slice(0, 10)));
await b.close();
