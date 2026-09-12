import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";

const имя = process.argv[2] || "телефон";
const шагДоля = +(process.argv[3] || 0.05);   /* доля экрана за один шаг */
const ждать = +(process.argv[4] || 500);
const э = { ...ЭКРАНЫ[имя] }; if (process.env.RC_DPR) э.dpr = +process.env.RC_DPR;
fs.mkdirSync("tools/audit/out", { recursive: true });
const файл = "tools/audit/out/зло1-" + имя + ".ndjson";
fs.writeFileSync(файл, "");

const b = await браузер();
const t0 = Date.now(); const от = () => ((Date.now() - t0) / 1000).toFixed(0);
const { pg, беды } = await страница(b, э); console.log("ЗАГРУЗКА " + от());
await pg.exposeFunction("отдай", (o) => { fs.appendFileSync(файл, JSON.stringify(o) + "\n"); console.log(JSON.stringify(o)); });

try {
  await pg.evaluate(async ({ шагДоля, ждать }) => {
    const сон = (ms) => new Promise((r) => setTimeout(r, ms));
    const r = document.documentElement;
    const оп = (s) => { const e = document.querySelector(s); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
    const снять = (метка) => {
      const I = window.RC_INTERIOR, F = window.RC_FLIGHT;
      return {
        метка, t: Date.now(),
        y: Math.round(scrollY),
        акт: window.RC_SCENE && window.RC_SCENE.act,
        двер: typeof window.RC_DOOR === "number" ? +window.RC_DOOR.toFixed(3) : null,
        под: typeof window.RC_APPROACH === "number" ? +window.RC_APPROACH.toFixed(3) : null,
        обор: I && I.yaw ? +(I.yaw() * 57.3).toFixed(2) : null,
        con: I && I.con ? +I.con().toFixed(3) : null,
        вх: I && I.enter ? +I.enter().toFixed(3) : null,
        холст: оп("#rocketCanvas"),
        полёт: оп(".rc-flight"),
        ворота: оп(".rc-gate"),
        воротаКарта: оп(".rc-gate-card"),
        пультОп: оп(".rc-desk"),
        кл: ["rc-in-hatch","rc-inside","rc-deep-inside","rc-approach","rc-door-open",
             "rc-gate-out","rc-doors","rc-rocket-parked","rc-stage","rc-flying"]
              .filter(c => r.classList.contains(c)).join("+"),
        пультЕсть: !!document.querySelector(".rc-desk")
      };
    };
    const шаг = Math.max(4, Math.round(innerHeight * шагДоля));
    const макс = document.documentElement.scrollHeight - innerHeight;
    await сон(6000);
    await window.отдай(снять("старт"));
    let охрана = 0;
    while (scrollY < макс - 2 && охрана++ < 900) {
      scrollBy(0, шаг);
      await сон(ждать);
      const s = снять("шаг" + охрана);
      await window.отдай(s);
      /* прекращаем плотный замер, когда добрались до пульта и он погас на вход-в-игру порог */
      if (s.акт === "console" && s.под != null && s.под > 0.98) break;
      if (охрана > 260) break;
    }
    await window.отдай(снять("конец-подвода"));
  }, { шагДоля, ждать });
} catch (e) { console.log("ОБРЫВ", (e.message || "").slice(0, 160)); }

/* Плотность холста до входа в игру */
const dprДо = await pg.evaluate(() => {
  const c = document.getElementById("rocketCanvas") || document.querySelector("canvas");
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { буфер: c.width, css: r.width, отношение: +(c.width / Math.max(1, r.width)).toFixed(3) };
});
console.log("ДО-ИГРЫ-ХОЛСТ", JSON.stringify(dprДо));

const ок = await вИгру(pg);
console.log("вИгру", ок);
await pg.waitForTimeout(4000);
const dprПосле = await pg.evaluate(() => {
  const cs = document.querySelectorAll("canvas");
  let best = null;
  cs.forEach((c) => { const rc = c.getBoundingClientRect(); if (rc.width > 100) best = c; });
  if (!best) return null;
  const r = best.getBoundingClientRect();
  return { буфер: best.width, css: r.width, отношение: +(best.width / Math.max(1, r.width)).toFixed(3) };
});
console.log("ПОСЛЕ-ИГРЫ-ХОЛСТ", JSON.stringify(dprПосле));
await pg.screenshot({ path: "tools/audit/out/зло1-" + имя + "-игра.jpg", type: "jpeg", quality: 70 });

console.log("БЕДЫ", JSON.stringify(беды.slice(0, 10)));
await b.close();
