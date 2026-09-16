import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";
import { ИНСТР, СЛОИ } from "./лаг-инстр.mjs";

const имя = process.argv[2] || "телефон";
const э = ЭКРАНЫ[имя];
const b = await браузер();
const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
await pg.addInitScript(ИНСТР);
const cdp = await pg.context().newCDPSession(pg);
await cdp.send("Performance.enable");
const M = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
const Д = (a, c) => ({
  Layout: +((c.LayoutDuration - a.LayoutDuration) * 1000).toFixed(0),
  Стиль: +((c.RecalcStyleDuration - a.RecalcStyleDuration) * 1000).toFixed(0),
  Скрипт: +((c.ScriptDuration - a.ScriptDuration) * 1000).toFixed(0),
  Задачи: +((c.TaskDuration - a.TaskDuration) * 1000).toFixed(0),
  Lсчёт: c.LayoutCount - a.LayoutCount, Ссчёт: c.RecalcStyleCount - a.RecalcStyleCount,
  Узлы: c.Nodes, Слуш: c.JSEventListeners, МБ: +(c.JSHeapUsedSize / 1048576).toFixed(1)
});
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.waitForTimeout(9000);
console.log("═══ ФИНАЛЬНАЯ СЦЕНА · " + имя + " " + э.vp.width + "x" + э.vp.height + " dpr" + э.dpr + " ═══");

const секции = ["#cases", "#reliability", "#faq", "#contact", "#epilogue"];
const роли = { "#cases": "проход к трапу (walk)", "#reliability": "салон (cabin)",
               "#faq": "бортовой справочник (manual)", "#contact": "пульт (console)",
               "#epilogue": "отлёт/люк (egress)" };

/* доходим прокруткой шагами до каждой секции, замеряем В ПУТИ и НА МЕСТЕ */
async function доСекции(сел) {
  for (let i = 0; i < 400; i++) {
    const r = await pg.evaluate((s) => {
      const e = document.querySelector(s); if (!e) return null;
      return { top: e.getBoundingClientRect().top, y: window.scrollY, h: window.innerHeight };
    }, сел);
    if (!r) return false;
    if (Math.abs(r.top - r.h * 0.15) < 40) return true;
    const d = Math.max(-r.h * 0.7, Math.min(r.h * 0.7, r.top - r.h * 0.15));
    await pg.mouse.wheel(0, Math.round(d));
    await pg.waitForTimeout(260);
    if (Math.abs(d) < 12) return true;
  }
  return true;
}

for (const с of секции) {
  await pg.evaluate(() => window.__ЛАГсброс());
  const a = await M();
  await доСекции(с);
  const c = await M();
  const путь = await pg.evaluate(() => window.__ЛАГснять());
  /* стояние на месте 5 сек */
  await pg.evaluate(() => window.__ЛАГсброс());
  const a2 = await M();
  await pg.waitForTimeout(5000);
  const c2 = await M();
  const стоя = await pg.evaluate(() => window.__ЛАГснять());
  const акт = await pg.evaluate(() => document.documentElement.getAttribute("data-act"));
  const сл = await pg.evaluate(СЛОИ);
  console.log("\n──── " + с + "  " + (роли[с] || "") + "   data-act=" + акт + " ────");
  console.log(" ПУТЬ  CDP:", JSON.stringify(Д(a, c)));
  console.log("       кадров " + путь.кадры + ", записей в стиль " +
    (путь.записи.setProperty + путь.записи.cssText + путь.записи.styleAttr) +
    " (за кадр " + ((путь.записи.setProperty + путь.записи.cssText + путь.записи.styleAttr) / Math.max(1, путь.кадры)).toFixed(1) + ")" +
    ", rAF-заказов " + путь.rafЗаказов + " (циклов на кадр " + (путь.rafЗаказов / Math.max(1, путь.кадры)).toFixed(1) + ")");
  console.log("       чтения " + JSON.stringify(путь.чтения) + ", принуд.пересчёт " + путь.принудительныйПересчёт);
  путь.точки.slice(0, 5).forEach(([k, n]) => console.log("         " + n + "x " + k));
  console.log("       длинных задач " + путь.длинныеЗадачи.length + ", сумма " + путь.суммаДлинных + " мс, топ " + путь.длинныеЗадачи.slice(0, 5));
  console.log(" СТОЯ  CDP:", JSON.stringify(Д(a2, c2)));
  console.log("       кадров " + стоя.кадры + ", записей " +
    (стоя.записи.setProperty + стоя.записи.cssText + стоя.записи.styleAttr) +
    " (за кадр " + ((стоя.записи.setProperty + стоя.записи.cssText + стоя.записи.styleAttr) / Math.max(1, стоя.кадры)).toFixed(1) + ")" +
    ", rAF " + стоя.rafЗаказов + " (на кадр " + (стоя.rafЗаказов / Math.max(1, стоя.кадры)).toFixed(1) + ")");
  console.log("       длинных " + стоя.длинныеЗадачи.length + " сумма " + стоя.суммаДлинных + " топ " + стоя.длинныеЗадачи.slice(0, 5));
  стоя.rafВладельцы.slice(0, 12).forEach(([k, n]) => console.log("         rAF " + n + "x " + k));
  console.log("       backdrop-filter видимых: " + сл.backdropВидимых + " из " + сл.backdropВсего +
              ", filter видимых: " + сл.filterВидимых + " из " + сл.filterВсего +
              ", will-change: " + сл.willChangeВсего + ", узлов: " + сл.всегоУзлов + ", fixed: " + сл.fixed);
  сл.backdropПримеры.slice(0, 8).forEach(x => console.log("         bd " + x.кто + "  " + x.bf));
  сл.filterПримеры.slice(0, 6).forEach(x => console.log("         fl " + x.кто + "  " + x.f));
}
await b.close();
