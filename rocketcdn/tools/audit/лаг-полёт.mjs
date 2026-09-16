/* В игре: полёт, панели, прыжок в рукав, и утечка за 5 циклов.
   Меряем только то, что не зависит от видеокарты. */
import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";
import { ИНСТР, СЛОИ } from "./лаг-инстр.mjs";
const имя = process.argv[2] || "ПК";
const э = ЭКРАНЫ[имя];
for (let п = 1; п <= 2; п++) {
  let b;
  try {
    b = await браузер();
    const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
    await pg.addInitScript(ИНСТР);
    const cdp = await pg.context().newCDPSession(pg);
    await cdp.send("Performance.enable");
    const M = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
    await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 200000 });
    await pg.waitForTimeout(9000);
    console.log("═══ ПОЛЁТ · " + имя + " (попытка " + п + ") ═══");
    await pg.evaluate(() => { if (window.RC_FLIGHT) window.RC_FLIGHT.open(); });
    await pg.waitForTimeout(13000);
    await pg.evaluate(() => {
      const b2 = document.querySelector(".rcf-brief-btns button") || document.querySelector(".rcf-brief .rcf-go");
      if (b2) b2.click();
      const br = document.querySelector(".rcf-brief"); if (br) br.classList.add("off");
    });
    await pg.waitForTimeout(2000);
    const сл = await pg.evaluate(СЛОИ);
    console.log("СЛОИ В ИГРЕ: узлов " + сл.всегоУзлов + " · fixed " + сл.fixed +
      " · backdrop-filter ВИДИМЫХ " + сл.backdropВидимых + "/" + сл.backdropВсего +
      " · filter ВИДИМЫХ " + сл.filterВидимых + "/" + сл.filterВсего + " · will-change " + сл.willChangeВсего + " · масок " + сл.масок + " · живых CSS-анимаций " + сл.живыхАнимаций);
    сл.backdropПримеры.slice(0, 10).forEach(x => console.log("   bd " + x.кто + "  " + x.bf));

    async function участок(титул, действие, сек) {
      try {
        await pg.evaluate(() => window.__ЛАГсброс());
        const a = await M();
        await действие();
        await pg.waitForTimeout(сек);
        const c = await M();
        const s = await pg.evaluate(() => window.__ЛАГснять());
        const зап = s.записи.setProperty + s.записи.cssText + s.записи.styleAttr;
        console.log("\n──── " + титул + " ────");
        console.log("  Layout " + ((c.LayoutDuration - a.LayoutDuration) * 1000).toFixed(0) + " мс /" + (c.LayoutCount - a.LayoutCount) +
          " · Стиль " + ((c.RecalcStyleDuration - a.RecalcStyleDuration) * 1000).toFixed(0) + " мс /" + (c.RecalcStyleCount - a.RecalcStyleCount) +
          " · Скрипт " + ((c.ScriptDuration - a.ScriptDuration) * 1000).toFixed(0) + " мс · Задачи " + ((c.TaskDuration - a.TaskDuration) * 1000).toFixed(0) + " мс");
        console.log("  кадров " + s.кадры + " · записей в стиль " + зап + " (за кадр " + (зап / Math.max(1, s.кадры)).toFixed(1) +
          ") · rAF-заказов " + s.rafЗаказов + " (одновременных циклов " + (s.rafЗаказов / Math.max(1, s.кадры)).toFixed(1) + ")");
        console.log("  чтения " + JSON.stringify(s.чтения) + " · принуд.пересчёт " + s.принудительныйПересчёт);
        s.точки.slice(0, 4).forEach(([k, n]) => console.log("      " + n + "x " + k));
        console.log("  длинных задач " + s.длинныеЗадачи.length + " (>200мс " + s.длинныеЗадачи.filter(x => x > 200).length + "), топ " + s.длинныеЗадачи.slice(0, 6));
        console.log("  владельцы rAF: " + s.rafВладельцы.slice(0, 10).map(([k, n]) => n + "x" + k.replace(/^assets\//, "")).join(" | "));
      } catch (e) { console.log("\n──── " + титул + " ──── сорвалось: " + e.message.slice(0, 100)); }
    }

    await участок("ПОЛЁТ · тяга вперёд", async () => {
      await pg.keyboard.down("KeyW"); await pg.waitForTimeout(5000); await pg.keyboard.up("KeyW");
    }, 4000);

    await участок("ОТКРЫТИЕ ПАНЕЛЕЙ (курс/меню)", async () => {
      await pg.evaluate(() => {
        [".rcf-course-btn", ".rcf-course", ".rcf-nav-btn", ".rcf-net-btn", ".rcf-menu-btn"].forEach(s => {
          const e = document.querySelector(s); if (e) e.click();
        });
      });
    }, 5000);

    await участок("ПРЫЖОК В ДРУГОЙ РУКАВ", async () => {
      await pg.evaluate(() => { const x = document.querySelector('[data-uni="1"]'); if (x) x.click(); });
    }, 12000);

    console.log("\n──── ПАМЯТЬ: 5 циклов выход↔вход ────");
    const снять = async () => {
      const m = await M();
      const t = await pg.evaluate(() => {
        let об = -1;
        try { const W = window.RC_FLIGHT && window.RC_FLIGHT.W3; if (W && W.scene) { об = 0; W.scene.traverse(() => об++); } } catch (e) {}
        return { сцена: об, холсты: document.querySelectorAll("canvas").length };
      });
      return "узлов " + m.Nodes + " · слушателей " + m.JSEventListeners + " · память " + (m.JSHeapUsedSize / 1048576).toFixed(1) +
             " МБ · объектов three " + t.сцена + " · холстов " + t.холсты;
    };
    console.log("исход:  " + await снять());
    for (let i = 1; i <= 5; i++) {
      await pg.evaluate(() => { if (window.RC_FLIGHT && window.RC_FLIGHT.close) window.RC_FLIGHT.close(); });
      await pg.waitForTimeout(2500);
      await pg.evaluate(() => { if (window.RC_FLIGHT && window.RC_FLIGHT.open) window.RC_FLIGHT.open(); });
      await pg.waitForTimeout(4000);
      await pg.evaluate(() => { const br = document.querySelector(".rcf-brief"); if (br) br.classList.add("off"); });
      console.log("цикл " + i + ": " + await снять());
    }
    await b.close();
    break;
  } catch (e) {
    console.log("попытка " + п + " сорвалась: " + e.message.slice(0, 140));
    try { await b.close(); } catch (e2) {}
  }
}
