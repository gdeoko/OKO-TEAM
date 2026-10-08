import { ЭКРАНЫ, браузер, страница, вИгру } from "./hard.mjs";
const ЭКРАН = process.env.RC_SCR || "ПК";
const b = await браузер();
const э = ЭКРАНЫ[ЭКРАН];
const { pg, беды } = await страница(b, э);
await вИгру(pg);
console.log("РУКАВА · " + ЭКРАН + " " + JSON.stringify(э.vp));

const итог = [];
for (const n of [1, 2, 3]) {
  await pg.evaluate((k) => window.RC_FLIGHT._jump(k), n);
  try {
    await pg.waitForFunction((k) => {
      const p = window.RC_FLIGHT._pick();
      return p && p.вселенная === k;
    }, n, { timeout: 120000, polling: 1000 });
  } catch (e) { console.log("рукав " + n + ": прыжок не состоялся " + e.message.slice(0, 60)); continue; }
  await pg.waitForTimeout(9000);
  /* Подлетаем к первой системе рукава, иначе всё в точке */
  const сис = await pg.evaluate(() => {
    const btns = [...document.querySelectorAll(".rcf-nav button[data-sys]")];
    return btns.map(e => ({ t: (e.textContent || "").trim().slice(0, 20), sys: e.getAttribute("data-sys"), pl: e.getAttribute("data-pl") }));
  });
  console.log("\n########## РУКАВ " + n + " · кнопок систем/планет в меню: " + сис.length);
  console.log("  " + JSON.stringify(сис.slice(0, 30)));

  for (const цель of [null, 0]) {
    if (цель !== null) {
      await pg.evaluate(() => {
        const b = document.querySelector(".rcf-nav button[data-sys]");
        if (b) b.click();
      });
      await pg.waitForTimeout(12000);
    }
    const снимок = await pg.evaluate(() => {
      const s = window.RC_FLIGHT._pick();
      return { всего: s.всего, уни: s.вселенная,
               тела: s.тела.filter(t => t.видно && !t.сзади && t.x >= 0 && t.x <= innerWidth && t.y >= 0 && t.y <= innerHeight) };
    });
    console.log("  -- " + (цель === null ? "сразу после прыжка" : "после подлёта к 1-й системе") +
      ": в кадре " + снимок.тела.length + " / список " + снимок.всего + " (уни " + снимок.уни + ")");
    for (const т of снимок.тела) {
      const под = await pg.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return "нет";
        const бл = el.closest && el.closest(".rcf-hud, .rcf-dos, .rcf-uni, button, a");
        return (typeof el.className === "string" && el.className ? el.className : el.tagName) + (бл ? " |ПЕРЕКРЫТО" : "");
      }, [т.x, т.y]);
      await pg.evaluate(() => { const d = document.querySelector(".rcf-dos"); if (d) d.classList.remove("on"); });
      await pg.waitForTimeout(250);
      await pg.mouse.move(т.x, т.y);
      await pg.waitForTimeout(200);
      await pg.mouse.click(т.x, т.y);
      await pg.waitForTimeout(1700);
      const рез = await pg.evaluate(() => {
        const d = document.querySelector(".rcf-dos");
        const h = d && d.querySelector(".rcf-dos-h");
        return { о: !!(d && d.classList.contains("on")), имя: h ? h.textContent : "" };
      });
      console.log("    " + (рез.о ? "OK  " : "НЕТ ") + (т.имя || "?").slice(0, 26).padEnd(27) +
        " xy=" + т.x + "," + т.y + " д=" + т.д + " досье=" + JSON.stringify(рез.имя || "") + " под=" + под);
      итог.push({ рукав: n, имя: т.имя, ok: рез.о });
    }
  }
}
console.log("\n---- ИТОГ ПО РУКАВАМ ----");
const нет = итог.filter(o => !o.ok);
console.log("не открыли досье: " + нет.length + " из " + итог.length);
[...new Set(нет.map(o => o.имя))].forEach(x => console.log("  НЕ КЛИКАЕТСЯ: " + x));
console.log("беды:", JSON.stringify(беды.slice(0, 8)));
await b.close();
