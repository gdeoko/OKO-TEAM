/* Финальная сцена: замеры, которые не зависят от видеокарты.
   Прокрутку ведём внутри страницы одним заходом, без сотен
   переговоров с браузером. */
import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";
import { ИНСТР, СЛОИ } from "./лаг-инстр.mjs";

const имя = process.argv[2] || "телефон";
const э = ЭКРАНЫ[имя];
for (let п = 1; п <= 3; п++) {
  let b;
  try {
    b = await браузер();
    const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
    await pg.addInitScript(ИНСТР);
    const cdp = await pg.context().newCDPSession(pg);
    await cdp.send("Performance.enable");
    const M = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
    const Д = (a, c) => "Layout " + ((c.LayoutDuration - a.LayoutDuration) * 1000).toFixed(0) +
      " мс / " + (c.LayoutCount - a.LayoutCount) + " раз · Стиль " + ((c.RecalcStyleDuration - a.RecalcStyleDuration) * 1000).toFixed(0) +
      " мс / " + (c.RecalcStyleCount - a.RecalcStyleCount) + " раз · Скрипт " + ((c.ScriptDuration - a.ScriptDuration) * 1000).toFixed(0) +
      " мс · Задачи " + ((c.TaskDuration - a.TaskDuration) * 1000).toFixed(0) + " мс";
    await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
    await pg.waitForTimeout(9000);
    console.log("═══ ФИНАЛЬНАЯ СЦЕНА · " + имя + " " + э.vp.width + "x" + э.vp.height + " dpr" + э.dpr + " (попытка " + п + ") ═══");
    const h = await pg.evaluate(() => document.documentElement.scrollHeight);
    console.log("высота страницы: " + h + "px, окно " + э.vp.height + "px");

    for (const [сел, роль] of [["#cases", "проход к трапу"], ["#reliability", "салон"],
                               ["#faq", "справочник"], ["#contact", "пульт"], ["#epilogue", "отлёт"]]) {
      await pg.evaluate(() => window.__ЛАГсброс());
      const a = await M();
      /* прокрутка к секции ступеньками внутри страницы */
      await pg.evaluate(async (s) => {
        const цель = document.querySelector(s);
        if (!цель) return;
        for (let i = 0; i < 70; i++) {
          const t = цель.getBoundingClientRect().top - innerHeight * 0.12;
          if (Math.abs(t) < 40) break;
          window.scrollBy(0, Math.max(-innerHeight * 0.6, Math.min(innerHeight * 0.6, t)));
          await new Promise(r => setTimeout(r, 45));
        }
      }, сел);
      await pg.waitForTimeout(4000);
      const c = await M();
      const s = await pg.evaluate(() => window.__ЛАГснять());
      const сл = await pg.evaluate(СЛОИ);
      const акт = await pg.evaluate(() => document.documentElement.getAttribute("data-act"));
      const зап = s.записи.setProperty + s.записи.cssText + s.записи.styleAttr;
      console.log("\n──── " + сел + " · " + роль + " · data-act=" + акт + " ────");
      console.log("  " + Д(a, c));
      console.log("  кадров " + s.кадры + " · записей в стиль " + зап + " (за кадр " + (зап / Math.max(1, s.кадры)).toFixed(1) +
                  ") · rAF-заказов " + s.rafЗаказов + " (одновременных циклов " + (s.rafЗаказов / Math.max(1, s.кадры)).toFixed(1) + ")");
      console.log("  чтения геометрии " + JSON.stringify(s.чтения) + " · принудительный пересчёт " + s.принудительныйПересчёт);
      s.точки.slice(0, 4).forEach(([k, n]) => console.log("      " + n + "x " + k));
      console.log("  длинных задач " + s.длинныеЗадачи.length + " (>200мс: " + s.длинныеЗадачи.filter(x => x > 200).length + "), топ " + s.длинныеЗадачи.slice(0, 5));
      console.log("  СЛОИ: узлов " + сл.всегоУзлов + " · fixed " + сл.fixed +
                  " · backdrop-filter ВИДИМЫХ " + сл.backdropВидимых + " из " + сл.backdropВсего +
                  " · filter ВИДИМЫХ " + сл.filterВидимых + " из " + сл.filterВсего +
                  " · will-change " + сл.willChangeВсего + " · масок " + сл.масок + " · живых CSS-анимаций в кадре " + сл.живыхАнимаций);
      сл.backdropПримеры.slice(0, 10).forEach(x => console.log("      bd  " + x.кто + "  " + x.bf));
      сл.filterПримеры.slice(0, 8).forEach(x => console.log("      fl  " + x.кто + "  " + x.f));
      console.log("  владельцы rAF: " + s.rafВладельцы.slice(0, 12).map(([k, n]) => n + "x" + k.replace(/^assets\//, "")).join(" | "));
    }
    await b.close();
    break;
  } catch (e) {
    console.log("попытка " + п + " сорвалась: " + e.message.slice(0, 140));
    try { await b.close(); } catch (e2) {}
  }
}
