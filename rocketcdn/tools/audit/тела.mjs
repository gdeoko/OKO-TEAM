import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";

const ЭКРАН = process.env.RC_SCR || "ПК";
const УНИ = +(process.env.RC_UNI || 0);
const ДОЛИ = (process.env.RC_P || "0.05,0.2,0.35,0.5,0.65,0.8").split(",").map(Number);
const ТАП = process.env.RC_TAP === "1";

const b = await браузер();
const э = ЭКРАНЫ[ЭКРАН];
const { pg, беды } = await страница(b, э);
const ok = await вИгру(pg);
console.log("вошли:", ok, "экран:", ЭКРАН, "уни:", УНИ, "тап:", ТАП);
if (!ok) { await b.close(); process.exit(1); }

if (УНИ > 0) {
  await pg.evaluate((n) => window.RC_FLIGHT._jump(n), УНИ);
  await pg.waitForTimeout(9000);
}

const отчёт = [];
for (const p of ДОЛИ) {
  await pg.evaluate((v) => { window.RC_FLIGHT._set(v); }, p);
  await pg.waitForTimeout(2600);
  const снимок = await pg.evaluate(() => {
    const s = window.RC_FLIGHT._pick();
    return { всего: s.всего, уни: s.вселенная,
             тела: s.тела.filter(t => t.видно && !t.сзади && t.x > -50 && t.x < innerWidth + 50 && t.y > -50 && t.y < innerHeight + 50),
             W: innerWidth, H: innerHeight };
  });
  console.log("\n===== p=" + p + " видимых на экране: " + снимок.тела.length + " / всего в списке " + снимок.всего + " (уни " + снимок.уни + ")");
  for (const т of снимок.тела) {
    const внутри = т.x >= 0 && т.x <= снимок.W && т.y >= 0 && т.y <= снимок.H;
    if (!внутри) { console.log("  ВНЕ КАДРА " + т.имя + " x=" + т.x + " y=" + т.y); continue; }
    // что под точкой по DOM
    const под = await pg.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return "нет";
      const бл = el.closest && el.closest(".rcf-hud, .rcf-dos, .rcf-uni, button, a");
      return (el.className || el.tagName) + (бл ? " |ЗАКРЫТО:" + (бл.className || бл.tagName) : "");
    }, [т.x, т.y]);
    await pg.evaluate(() => { const d = document.querySelector(".rcf-dos"); if (d) d.classList.remove("on"); });
    await pg.waitForTimeout(200);
    if (ТАП) await pg.touchscreen.tap(т.x, т.y);
    else { await pg.mouse.move(т.x, т.y); await pg.waitForTimeout(120); await pg.mouse.click(т.x, т.y); }
    await pg.waitForTimeout(1500);
    const рез = await pg.evaluate(() => {
      const d = document.querySelector(".rcf-dos");
      return { открыто: !!(d && d.classList.contains("on")),
               имя: d ? (d.querySelector(".rcf-dos-h") || {}).textContent : "" };
    });
    const луч = await pg.evaluate(([x, y]) => window.RC_FLIGHT._ray(x, y), [т.x, т.y]);
    const стр = (рез.открыто ? "OK   " : "НЕТ  ") + т.имя.padEnd(22) +
      " x=" + т.x + " y=" + т.y + " д=" + т.д + " масшт=" + т.масштаб +
      " лучПопад=" + луч.попаданий + (луч.первые[0] ? " перв=" + JSON.stringify(луч.первые[0].инфо).slice(0, 30) : "") +
      " досье=" + JSON.stringify(рез.имя || "") + " под=" + под;
    console.log("  " + стр);
    отчёт.push({ p, имя: т.имя, ok: рез.открыто, досье: рез.имя, луч: луч.попаданий, под });
  }
}

console.log("\n---- ИТОГ ----");
const нет = отчёт.filter(o => !o.ok);
console.log("клик не открыл досье:", нет.length, "из", отчёт.length);
[...new Set(нет.map(o => o.имя))].forEach(n => console.log("  НЕ КЛИКАЕТСЯ:", n));
console.log("беды:", беды.slice(0, 10));
await b.close();
