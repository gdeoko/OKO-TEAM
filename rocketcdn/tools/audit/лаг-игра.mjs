import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";
import { ИНСТР, СЛОИ } from "./лаг-инстр.mjs";

const имя = process.argv[2] || "ПК";
const э = ЭКРАНЫ[имя];
const b = await браузер();
const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
await pg.addInitScript(ИНСТР);
const сеть = [];
pg.on("response", r => { try { сеть.push({ u: r.url(), b: +(r.headers()["content-length"] || 0), t: r.request().resourceType() }); } catch (e) {} });

const cdp = await pg.context().newCDPSession(pg);
await cdp.send("Performance.enable");
await cdp.send("Profiler.enable");
const M = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m => [m.name, m.value]));
const Д = (a, c) => ({
  Layout: +((c.LayoutDuration - a.LayoutDuration) * 1000).toFixed(0),
  Стиль: +((c.RecalcStyleDuration - a.RecalcStyleDuration) * 1000).toFixed(0),
  Скрипт: +((c.ScriptDuration - a.ScriptDuration) * 1000).toFixed(0),
  Задачи: +((c.TaskDuration - a.TaskDuration) * 1000).toFixed(0),
  Lсчёт: c.LayoutCount - a.LayoutCount, Ссчёт: c.RecalcStyleCount - a.RecalcStyleCount,
  Узлы: c.Nodes, Слуш: c.JSEventListeners, МБ: +(c.JSHeapUsedSize / 1048576).toFixed(1)
});

/* Разбор профиля: собственное время по функциям */
function разбор(prof) {
  const узлы = new Map(prof.nodes.map(n => [n.id, n]));
  const своё = new Map();
  const шаг = prof.timeDeltas, ид = prof.samples;
  for (let i = 0; i < ид.length; i++) {
    const n = узлы.get(ид[i]); if (!n) continue;
    const cf = n.callFrame;
    const ключ = (cf.functionName || "(аноним)") + "  " +
      (cf.url || "").replace(/^https?:\/\/[^/]+\//, "").replace(/\?v=\d+/, "") + ":" + (cf.lineNumber + 1);
    своё.set(ключ, (своё.get(ключ) || 0) + (шаг[i] || 0));
  }
  return [...своё.entries()].map(([k, v]) => [k, Math.round(v / 1000)])
    .sort((a, c) => c[1] - a[1]);
}

await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.waitForTimeout(9000);
console.log("═══ ИГРА · " + имя + " " + э.vp.width + "x" + э.vp.height + " dpr" + э.dpr + " ═══");
const доСети = сеть.length, доБайт = сеть.reduce((s, x) => s + x.b, 0);

/* ══ ВХОД В РАКЕТУ ══ */
await pg.evaluate(() => window.__ЛАГсброс());
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
const a1 = await M();
const тВход = await pg.evaluate(async () => {
  /* Замер непрерывной занятости главного потока: до вызова ставим
     метку, внутри open() поток занят и таймер не тикает. */
  const t0 = performance.now();
  let ок = false;
  if (window.RC_FLIGHT && window.RC_FLIGHT.open) { window.RC_FLIGHT.open(); ок = true; }
  else { const k = document.querySelector(".js-flight"); if (k) { k.click(); ок = true; } }
  const t1 = performance.now();
  return { ок, синхронно: Math.round(t1 - t0) };
});
await pg.waitForTimeout(13000);
const c1 = await M();
const { profile } = await cdp.send("Profiler.stop");
const вход = await pg.evaluate(() => window.__ЛАГснять());
console.log("\n──── ВХОД В РАКЕТУ (RC_FLIGHT.open + сборка мира) ────");
console.log("вошли:", тВход.ок, "  НЕПРЕРЫВНАЯ СИНХРОННАЯ РАБОТА open(): " + тВход.синхронно + " мс");
console.log("CDP за вход+13с:", JSON.stringify(Д(a1, c1)));
console.log("длинные задачи (мс, по убыванию):", вход.длинныеЗадачи.slice(0, 14));
console.log("  сумма", вход.суммаДлинных, "мс, задач", вход.длинныеЗадачи.length,
            ", свыше 200мс:", вход.длинныеЗадачи.filter(x => x > 200).length,
            ", свыше 1000мс:", вход.длинныеЗадачи.filter(x => x > 1000).length);
console.log("записи в стиль:", JSON.stringify(вход.записи), " чтения:", JSON.stringify(вход.чтения),
            " принуд.пересчёт:", вход.принудительныйПересчёт);
console.log("кадров:", вход.кадры, " rAF-заказов:", вход.rafЗаказов);
console.log("\nПРОФИЛЬ ВХОДА · собственное время функций (мс), топ-30:");
разбор(profile).slice(0, 30).forEach(([k, v]) => { if (v >= 1) console.log("   " + String(v).padStart(6) + "  " + k); });

/* догрузка */
const пБайт = сеть.reduce((s, x) => s + x.b, 0);
console.log("\n── ДОГРУЗКА при входе в игру ──");
console.log("файлов:", сеть.length - доСети, " байт:", пБайт - доБайт, "≈", ((пБайт - доБайт) / 1048576).toFixed(2) + " МБ");
сеть.slice(доСети).sort((x, y) => y.b - x.b).slice(0, 12)
  .forEach(x => console.log("   " + Math.round(x.b / 1024) + "КБ  " + x.u.replace(/^https?:\/\/[^/]+\//, "").replace(/\?v=\d+/, "").slice(0, 70)));

/* закрыть брифинг */
await pg.evaluate(() => {
  const b2 = document.querySelector(".rcf-brief-btns button[data-mode='manual']") ||
             document.querySelector(".rcf-brief-btns button") || document.querySelector(".rcf-brief .rcf-go");
  if (b2) b2.click();
  const br = document.querySelector(".rcf-brief"); if (br) br.classList.add("off");
});
await pg.waitForTimeout(2000);

const сл = await pg.evaluate(СЛОИ);
console.log("\n── СЛОИ В ИГРЕ ──");
console.log("узлов:", сл.всегоУзлов, " fixed:", сл.fixed,
            " backdrop-filter видимых:", сл.backdropВидимых, "/", сл.backdropВсего,
            " filter видимых:", сл.filterВидимых, "/", сл.filterВсего, " will-change:", сл.willChangeВсего);
сл.backdropПримеры.forEach(x => console.log("   bd " + x.кто + "  " + x.bf));
сл.filterПримеры.forEach(x => console.log("   fl " + x.кто + "  " + x.f));

/* ══ ПОЛЁТ ══ */
async function участок(титул, действие, сек) {
 try {
  await pg.evaluate(() => window.__ЛАГсброс());
  await cdp.send("Profiler.start");
  const a = await M();
  await действие();
  await pg.waitForTimeout(сек);
  const c = await M();
  const { profile: p } = await cdp.send("Profiler.stop");
  const s = await pg.evaluate(() => window.__ЛАГснять());
  const зап = s.записи.setProperty + s.записи.cssText + s.записи.styleAttr;
  console.log("\n──── " + титул + " ────");
  console.log("CDP:", JSON.stringify(Д(a, c)));
  console.log("кадров " + s.кадры + ", записей в стиль " + зап + " (за кадр " + (зап / Math.max(1, s.кадры)).toFixed(1) + ")" +
              ", rAF-заказов " + s.rafЗаказов + " (циклов на кадр " + (s.rafЗаказов / Math.max(1, s.кадры)).toFixed(1) + ")");
  console.log("чтения " + JSON.stringify(s.чтения) + ", принуд.пересчёт " + s.принудительныйПересчёт);
  s.точки.slice(0, 5).forEach(([k, n]) => console.log("     " + n + "x " + k));
  console.log("длинных задач " + s.длинныеЗадачи.length + ", сумма " + s.суммаДлинных + " мс, топ " + s.длинныеЗадачи.slice(0, 8));
  console.log("профиль, топ-14 по своему времени (мс):");
  разбор(p).slice(0, 14).forEach(([k, v]) => { if (v >= 1) console.log("   " + String(v).padStart(6) + "  " + k); });
  return s;
 } catch (e) { console.log("\n──── " + титул + " ──── СОРВАЛОСЬ: " + e.message.slice(0,120)); return null; }
}

await участок("ПОЛЁТ (тяга вперёд 8 сек)", async () => {
  await pg.keyboard.down("KeyW");
  await pg.waitForTimeout(6000);
  await pg.keyboard.up("KeyW");
}, 6000);

await участок("ОТКРЫТИЕ ПАНЕЛЕЙ (курс/меню/сеть)", async () => {
  await pg.evaluate(() => {
    const кн = [".rcf-course", ".rcf-course-btn", ".rcf-nav-btn", ".rcf-net-btn", "[data-open]"];
    кн.forEach(s => { const e = document.querySelector(s); if (e) e.click(); });
  });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    const m = document.querySelector(".rcf-menu, .rcf-course-menu, .rcf-uni");
    if (m) m.classList.add("on");
  });
}, 5000);

await участок("ПРЫЖОК В ДРУГОЙ РУКАВ (uni 1)", async () => {
  await pg.evaluate(() => {
    const b3 = document.querySelector('[data-uni="1"]');
    if (b3) b3.click();
    else if (window.RC_FLIGHT && window.RC_FLIGHT.uni) window.RC_FLIGHT.uni(1);
  });
}, 12000);

/* ══ ПАМЯТЬ: 5 циклов вход-выход ══ */
console.log("\n──── ПАМЯТЬ: 5 циклов выход↔вход ────");
const снять = async () => { const m = await M(); return { Узлы: m.Nodes, Слуш: m.JSEventListeners, МБ: +(m.JSHeapUsedSize / 1048576).toFixed(1),
  three: await pg.evaluate(() => { try { return { объектов: (window.RC_FLIGHT && window.RC_FLIGHT.W3 && window.RC_FLIGHT.W3.scene) ? window.RC_FLIGHT.W3.scene.children.length : -1,
    инфо: (window.__rcRenderer && window.__rcRenderer.info) ? window.__rcRenderer.info.memory : null }; } catch (e) { return null; } }) }; };
console.log("исход:", JSON.stringify(await снять()));
for (let i = 1; i <= 5; i++) {
  await pg.evaluate(() => { if (window.RC_FLIGHT && window.RC_FLIGHT.close) window.RC_FLIGHT.close(); });
  await pg.waitForTimeout(3000);
  await pg.evaluate(() => { if (window.RC_FLIGHT && window.RC_FLIGHT.open) window.RC_FLIGHT.open(); });
  await pg.waitForTimeout(6000);
  await pg.evaluate(() => { const br = document.querySelector(".rcf-brief"); if (br) br.classList.add("off"); });
  console.log("цикл " + i + ": " + JSON.stringify(await снять()));
}
await b.close();
