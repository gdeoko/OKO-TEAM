import { ЭКРАНЫ, браузер, страница, вИгру } from "./hard.mjs";
const ЭКРАН = process.env.RC_SCR || "ПК";
const ТАП = process.env.RC_TAP === "1";
const b = await браузер();
const э = ЭКРАНЫ[ЭКРАН];
const { pg, беды } = await страница(b, э);
await вИгру(pg);
console.log("###### " + ЭКРАН + " " + JSON.stringify(э.vp) + (ТАП ? " ПАЛЬЦЕМ" : " МЫШЬЮ"));

/* Полный список того, что вообще может подобрать луч */
const реестр = await pg.evaluate(() => {
  const p = window.RC_FLIGHT._pick();
  return { всего: p.всего, имена: p.тела.map(t => t.имя) };
});
console.log("\n=== ЧТО ВООБЩЕ ЕСТЬ В СПИСКЕ ПОДБОРА (W3.pickables) ===");
console.log("всего: " + реестр.всего);
реестр.имена.forEach((n, i) => console.log("  " + i + ". " + n));

const итог = [];
for (const p of [0.05, 0.2, 0.35, 0.5, 0.65, 0.8]) {
  await pg.evaluate((v) => window.RC_FLIGHT._set(v), p);
  await pg.waitForTimeout(2500);
  const сн = await pg.evaluate(() => {
    const s = window.RC_FLIGHT._pick();
    return { тела: s.тела.filter(t => t.видно && !t.сзади && t.x >= 0 && t.x <= innerWidth && t.y >= 0 && t.y <= innerHeight),
             скрытые: s.тела.filter(t => !t.видно).map(t => t.имя) };
  });
  console.log("\n-- p=" + p + " в кадре " + сн.тела.length);
  for (const т of сн.тела) {
    await pg.evaluate(() => { const d = document.querySelector(".rcf-dos"); if (d) d.classList.remove("on"); });
    if (ТАП) await pg.touchscreen.tap(т.x, т.y);
    else { await pg.mouse.move(т.x, т.y); await pg.mouse.click(т.x, т.y); }
    await pg.waitForTimeout(1500);
    const r = await pg.evaluate(([x, y]) => {
      const d = document.querySelector(".rcf-dos");
      const el = document.elementFromPoint(x, y);
      const бл = el && el.closest && el.closest(".rcf-hud, .rcf-dos, .rcf-uni, button, a");
      return { о: !!(d && d.classList.contains("on")),
               имя: (document.querySelector(".rcf-dos-h") || {}).textContent,
               луч: window.RC_FLIGHT._ray(x, y),
               перекрыт: бл ? ((бл.className || бл.tagName) + "").slice(0, 22) : "" };
    }, [т.x, т.y]);
    console.log("   " + (r.о ? "OK  " : "НЕТ ") + (т.имя || "?").slice(0, 26).padEnd(27) +
      " xy=" + т.x + "," + т.y + " д=" + т.д + " лучПопад=" + r.луч.попаданий +
      " досье=" + JSON.stringify(r.имя || "") + (r.перекрыт ? " ПЕРЕКРЫТ:" + r.перекрыт : ""));
    итог.push({ имя: т.имя, ok: r.о });
  }
}
console.log("\n########## ИТОГ ##########");
const нет = итог.filter(o => !o.ok);
console.log("не открыли досье: " + нет.length + " из " + итог.length);
console.log("НЕ КЛИКАЮТСЯ: " + [...new Set(нет.map(o => o.имя))].join(" | "));
console.log("кликаются:    " + [...new Set(итог.filter(o => o.ok).map(o => o.имя))].join(" | "));
console.log("беды: " + JSON.stringify(беды.slice(0, 10)));
await b.close();
