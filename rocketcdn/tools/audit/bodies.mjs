import { ЭКРАНЫ, браузер, страница, вИгру } from "./hard.mjs";

const ЭКРАН = process.env.RC_SCR || "ПК";
const УНИ = +(process.env.RC_UNI || 0);
const ДОЛИ = (process.env.RC_P || "0.05,0.2,0.35,0.5,0.65,0.8").split(",").map(Number);
const ТАП = process.env.RC_TAP === "1";

const b = await браузер();
const э = ЭКРАНЫ[ЭКРАН];
const { pg, беды } = await страница(b, э);
await вИгру(pg);
console.log("ЭКРАН", ЭКРАН, "УНИ", УНИ, "ТАП", ТАП, "vp", JSON.stringify(э.vp));

if (УНИ > 0) {
  await pg.evaluate((n) => window.RC_FLIGHT._jump(n), УНИ);
  await pg.waitForFunction((n) => {
    const p = window.RC_FLIGHT._pick();
    return p && p.вселенная === n && p.тела.filter(t => t.видно).length > 3;
  }, УНИ, { timeout: 180000, polling: 1000 });
  await pg.waitForTimeout(6000);
}

const отчёт = [];
for (const p of ДОЛИ) {
  await pg.evaluate((v) => { window.RC_FLIGHT._set(v); }, p);
  await pg.waitForTimeout(3000);
  const снимок = await pg.evaluate(() => {
    const s = window.RC_FLIGHT._pick();
    return { всего: s.всего, уни: s.вселенная, W: innerWidth, H: innerHeight,
             тела: s.тела.filter(t => t.видно && !t.сзади && t.x >= 0 && t.x <= innerWidth && t.y >= 0 && t.y <= innerHeight) };
  });
  console.log("\n== p=" + p + "  видно в кадре: " + снимок.тела.length + " / список " + снимок.всего + " (уни " + снимок.уни + ")");
  for (const т of снимок.тела) {
    const под = await pg.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return "нет";
      const бл = el.closest && el.closest(".rcf-hud, .rcf-dos, .rcf-uni, button, a");
      return (typeof el.className === "string" && el.className ? el.className : el.tagName) + (бл ? " |ПЕРЕКРЫТО:" + (бл.className || бл.tagName) : "");
    }, [т.x, т.y]);
    await pg.evaluate(() => { const d = document.querySelector(".rcf-dos"); if (d) d.classList.remove("on"); });
    await pg.waitForTimeout(300);
    try {
      if (ТАП) await pg.touchscreen.tap(т.x, т.y);
      else { await pg.mouse.move(т.x, т.y); await pg.waitForTimeout(200); await pg.mouse.click(т.x, т.y); }
    } catch (e) { console.log("  клик сорвался", т.имя, e.message.slice(0, 60)); continue; }
    await pg.waitForTimeout(1800);
    const рез = await pg.evaluate(() => {
      const d = document.querySelector(".rcf-dos");
      const h = d && d.querySelector(".rcf-dos-h");
      return { открыто: !!(d && d.classList.contains("on")), имя: h ? h.textContent : "" };
    });
    const луч = await pg.evaluate(([x, y]) => window.RC_FLIGHT._ray(x, y), [т.x, т.y]);
    console.log("  " + (рез.открыто ? "OK  " : "НЕТ ") + (т.имя || "?").slice(0, 24).padEnd(25) +
      " xy=" + т.x + "," + т.y + " д=" + т.д + " м=" + т.масштаб +
      " луч=" + луч.попаданий + " досье=" + JSON.stringify(рез.имя || "") + " под=" + под);
    отчёт.push({ p, имя: т.имя, ok: рез.открыто, под });
  }
}
console.log("\n---- ИТОГ " + ЭКРАН + " уни" + УНИ + (ТАП ? " ТАП" : "") + " ----");
const нет = отчёт.filter(o => !o.ok);
console.log("не открыли досье: " + нет.length + " из " + отчёт.length);
[...new Set(нет.map(o => o.имя))].forEach(n => console.log("  НЕ КЛИКАЕТСЯ: " + n));
[...new Set(отчёт.filter(o=>o.ok).map(o => o.имя))].forEach(n => console.log("  кликается: " + n));
console.log("беды:", JSON.stringify(беды.slice(0, 8)));
await b.close();
