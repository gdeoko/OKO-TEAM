import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";
import { ИНСТР, СЛОИ } from "./лаг-инстр.mjs";

const имяЭкрана = process.argv[2] || "ПК";
const э = ЭКРАНЫ[имяЭкрана];

const b = await браузер();
const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
await pg.addInitScript(ИНСТР);

/* ── учёт сети ── */
const сеть = [];
pg.on("response", async (r) => {
  try {
    const h = r.headers();
    сеть.push({ url: r.url(), тип: r.request().resourceType(),
                байт: +(h["content-length"] || 0), статус: r.status(), t: Date.now() });
  } catch (e) {}
});

const cdp = await pg.context().newCDPSession(pg);
await cdp.send("Performance.enable");
const метрики = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
const дельта = (a, b) => ({
  Layout: +((b.LayoutDuration - a.LayoutDuration) * 1000).toFixed(1),
  Стиль:  +((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000).toFixed(1),
  Скрипт: +((b.ScriptDuration - a.ScriptDuration) * 1000).toFixed(1),
  Задачи: +((b.TaskDuration - a.TaskDuration) * 1000).toFixed(1),
  LayoutСчёт: b.LayoutCount - a.LayoutCount,
  СтильСчёт: b.RecalcStyleCount - a.RecalcStyleCount,
  Узлов: b.Nodes, Слушателей: b.JSEventListeners, JSпамятьМБ: +(b.JSHeapUsedSize / 1048576).toFixed(1)
});

const t0 = Date.now();
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
const tDCL = Date.now() - t0;
await pg.waitForTimeout(9000);

console.log("═══ ЭКРАН: " + имяЭкрана + " (" + э.vp.width + "x" + э.vp.height + " dpr" + э.dpr + ") ═══");
console.log("DOMContentLoaded, мс:", tDCL);

/* ── ВЕС первого экрана ── */
const первыйЭкран = сеть.slice();
const сумма = (a) => a.reduce((s, x) => s + x.байт, 0);
console.log("\n── ВЕС ПЕРВОГО ЭКРАНА ──");
console.log("файлов:", первыйЭкран.length, " байт:", сумма(первыйЭкран), "≈", (сумма(первыйЭкран) / 1048576).toFixed(2) + " МБ");
const поТипу = {};
первыйЭкран.forEach(x => { поТипу[x.тип] = поТипу[x.тип] || { n: 0, b: 0 }; поТипу[x.тип].n++; поТипу[x.тип].b += x.байт; });
console.log("по типам:", JSON.stringify(Object.fromEntries(Object.entries(поТипу).map(([k, v]) => [k, v.n + "шт/" + Math.round(v.b / 1024) + "КБ"]))));
console.log("топ-15 тяжёлых:");
[...первыйЭкран].sort((a, b) => b.байт - a.байт).slice(0, 15)
  .forEach(x => console.log("   " + Math.round(x.байт / 1024) + "КБ  " + x.url.replace(/^https?:\/\/[^/]+\//, "").replace(/\?v=\d+/, "").slice(0, 70)));
/* дубли */
const счёт = {};
первыйЭкран.forEach(x => { const u = x.url.split("?")[0]; счёт[u] = (счёт[u] || 0) + 1; });
const дубли = Object.entries(счёт).filter(([, n]) => n > 1);
console.log("ДУБЛИ загрузок:", дубли.length ? JSON.stringify(дубли.map(([u, n]) => n + "x " + u.replace(/^https?:\/\/[^/]+\//, ""))) : "нет");

/* ── СОСТОЯНИЕ ПОКОЯ: сколько главный поток занят когда ничего не делаем ── */
await pg.evaluate(() => window.__ЛАГсброс());
const m1 = await метрики(); await pg.waitForTimeout(5000); const m2 = await метрики();
const покой = await pg.evaluate(() => window.__ЛАГснять());
console.log("\n── ПОКОЙ (5 сек, верх страницы, никто не трогает) ──");
console.log("CDP:", JSON.stringify(дельта(m1, m2)));
console.log("кадров:", покой.кадры, " записей в стиль:", JSON.stringify(покой.записи),
            " => за кадр:", ((покой.записи.setProperty + покой.записи.cssText + покой.записи.styleAttr) / Math.max(1, покой.кадры)).toFixed(1));
console.log("чтения геометрии:", JSON.stringify(покой.чтения));
console.log("ПРИНУДИТЕЛЬНЫЙ ПЕРЕСЧЁТ (запись→чтение):", покой.принудительныйПересчёт);
покой.точки.forEach(([k, n]) => console.log("     " + n + "x  " + k));
console.log("rAF: заказов", покой.rafЗаказов, "вызовов", покой.rafВызовов, "=> циклов на кадр:", (покой.rafЗаказов / Math.max(1, покой.кадры)).toFixed(1));
console.log("владельцы rAF:"); покой.rafВладельцы.forEach(([k, n]) => console.log("     " + n + "x  " + k));
console.log("таймеры:", JSON.stringify(покой.таймеры));
console.log("длинные задачи:", покой.длинныеЗадачи.length, "сумма", покой.суммаДлинных, "мс, топ:", покой.длинныеЗадачи.slice(0, 8));

/* слои */
const сл = await pg.evaluate(СЛОИ);
console.log("\n── СЛОИ ──");
console.log("узлов в DOM:", сл.всегоУзлов, " fixed:", сл.fixed);
console.log("backdrop-filter: всего", сл.backdropВсего, "видимых", сл.backdropВидимых);
сл.backdropПримеры.forEach(x => console.log("     " + x.кто + "  " + x.bf));
console.log("filter: всего", сл.filterВсего, "видимых", сл.filterВидимых);
сл.filterПримеры.forEach(x => console.log("     " + x.кто + "  " + x.f));
console.log("will-change:", сл.willChangeВсего);
сл.willChangeПримеры.forEach(x => console.log("     " + x.кто + "  " + x.w));

/* ── ПРОКРУТКА сверху донизу ── */
const высота = await pg.evaluate(() => document.documentElement.scrollHeight);
console.log("\n── ПРОКРУТКА сверху донизу (высота " + высота + "px) ──");
await pg.evaluate(() => window.__ЛАГсброс());
const s1 = await метрики();
const шаг = Math.round(высота / 26);
const шагов = Math.min(26, Math.ceil(высота / шаг));
const посекции = [];
for (let i = 0; i < шагов; i++) {
  const a = await метрики();
  await pg.mouse.wheel(0, шаг);
  await pg.waitForTimeout(500);
  const b2 = await метрики();
  const y = await pg.evaluate(() => Math.round(window.scrollY));
  const d = дельта(a, b2);
  посекции.push({ y, ...d });
}
const s2 = await метрики();
const прок = await pg.evaluate(() => window.__ЛАГснять());
console.log("ИТОГО прокрутка CDP:", JSON.stringify(дельта(s1, s2)));
console.log("кадров:", прок.кадры, "записей в стиль:", JSON.stringify(прок.записи),
            "=> за кадр:", ((прок.записи.setProperty + прок.записи.cssText + прок.записи.styleAttr) / Math.max(1, прок.кадры)).toFixed(1));
console.log("чтения:", JSON.stringify(прок.чтения));
console.log("ПРИНУДИТЕЛЬНЫЙ ПЕРЕСЧЁТ:", прок.принудительныйПересчёт);
прок.точки.forEach(([k, n]) => console.log("     " + n + "x  " + k));
console.log("rAF заказов:", прок.rafЗаказов, "на кадр:", (прок.rafЗаказов / Math.max(1, прок.кадры)).toFixed(1));
прок.rafВладельцы.forEach(([k, n]) => console.log("     " + n + "x  " + k));
console.log("длинные задачи:", прок.длинныеЗадачи.length, "сумма", прок.суммаДлинных, "мс, топ:", прок.длинныеЗадачи.slice(0, 10));
console.log("сдвиг макета CLS:", прок.сдвиг);
console.log("самые дорогие участки прокрутки (Layout+Стиль, мс):");
[...посекции].sort((a, b) => (b.Layout + b.Стиль) - (a.Layout + a.Стиль)).slice(0, 10)
  .forEach(x => console.log("   y=" + x.y + "  Layout " + x.Layout + "  Стиль " + x.Стиль + "  Скрипт " + x.Скрипт + "  Задачи " + x.Задачи + "  (LayoutСчёт " + x.LayoutСчёт + ", СтильСчёт " + x.СтильСчёт + ")"));

/* сеть после прокрутки */
console.log("\n── ДОГРУЗКА при прокрутке ──");
const после = сеть.slice(первыйЭкран.length);
console.log("файлов:", после.length, "байт:", сумма(после), "≈", (сумма(после) / 1048576).toFixed(2) + " МБ");
[...после].sort((a, b) => b.байт - a.байт).slice(0, 10)
  .forEach(x => console.log("   " + Math.round(x.байт / 1024) + "КБ  " + x.url.replace(/^https?:\/\/[^/]+\//, "").slice(0, 70)));

await b.close();
