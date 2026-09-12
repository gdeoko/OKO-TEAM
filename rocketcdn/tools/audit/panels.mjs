import { ЭКРАНЫ, браузер, страница, вИгру } from "./hard.mjs";
const ЭКРАН = process.env.RC_SCR || "ПК";
const ТАП = process.env.RC_TAP === "1";
const b = await браузер();
const э = ЭКРАНЫ[ЭКРАН];
const { pg, беды } = await страница(b, э);
await вИгру(pg);
console.log("ПАНЕЛИ · " + ЭКРАН + " " + JSON.stringify(э.vp) + (ТАП ? " ТАП" : " МЫШЬ"));

async function ткнуть(сел) {
  const г = await pg.evaluate((c) => {
    const e = document.querySelector(c);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const под = document.elementFromPoint(cx, cy);
    return { x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height),
             вКадре: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
             своя: !!(под && (под === e || e.contains(под))),
             поверх: (под && !(под === e || e.contains(под))) ? (под.className || под.tagName).toString().slice(0, 40) : "" };
  }, сел);
  if (!г) return { нет: true };
  try { if (ТАП) await pg.touchscreen.tap(г.x, г.y); else await pg.mouse.click(г.x, г.y); }
  catch (e) { г.ошибка = e.message.slice(0, 60); }
  await pg.waitForTimeout(1600);
  return г;
}
const сост = () => pg.evaluate(() => ({
  досье: !!document.querySelector(".rcf-dos.on"),
  досьеСкрыт: document.querySelector(".rcf-dos") ? document.querySelector(".rcf-dos").hidden : null,
  имя: (document.querySelector(".rcf-dos-h") || {}).textContent,
  видео: (() => { const v = document.querySelector(".rcf-dos-vid"); return v ? { on: v.dataset.on, display: getComputedStyle(v).display, src: (v.querySelector("source") || {}).src || "" } : null; })(),
  факты: (document.querySelector(".rcf-dos-facts") || {}).textContent,
  справка: !!document.querySelector(".rcf-help.on"),
  меню: !!document.querySelector(".rcf-menu.on"),
  карта: !!document.querySelector(".rcf-netlist.on"),
  полёт: !!(window.RC_FLIGHT.state().открыт),
  звукТекст: (document.querySelector(".rcf-snd-key") || {}).textContent
}));

console.log("\n--- ДОСЬЕ ---");
for (const имя of ["ЗЕМЛЯ", "СОЛНЦЕ", "АСТЕРОИДНЫЙ", "КОМЕТА", "RC-SAT", "МЛЕЧНЫЙ", "ЧЁРНАЯ", "ДЫРА", "МЕРКУРИЙ", "ВЕНЕРА", "ЮПИТЕР", "УРАН", "НЕПТУН", "САТУРН", "МАРС", "ЛУНА"]) {
  const r = await pg.evaluate((n) => window.RC_FLIGHT._dos(n), имя);
  await pg.waitForTimeout(1200);
  const s = await сост();
  console.log("  _dos(" + имя + ") → " + JSON.stringify(r) + "  открыто=" + s.досье + " загл=" + JSON.stringify(s.имя) + " видео=" + JSON.stringify(s.видео && s.видео.on) + " факты=" + JSON.stringify((s.факты || "").replace(/\s+/g, " ").slice(0, 50)));
  await pg.evaluate(() => { const d = document.querySelector(".rcf-dos"); if (d) d.classList.remove("on"); });
  await pg.waitForTimeout(300);
}

console.log("\n--- КРЕСТИК ДОСЬЕ ---");
await pg.evaluate(() => window.RC_FLIGHT._dos("ЗЕМЛЯ"));
await pg.waitForTimeout(1500);
console.log("  до:", JSON.stringify(await сост()));
const кx = await ткнуть(".rcf-dos-x");
console.log("  крестик:", JSON.stringify(кx));
console.log("  после:", JSON.stringify(await сост()));

console.log("\n--- СПРАВКА ---");
console.log("  до:", (await сост()).справка);
const с1 = await ткнуть(".rcf-help-key");
console.log("  открыть:", JSON.stringify(с1), "→ справка =", (await сост()).справка);
const зв = await ткнуть(".rcf-snd-key");
await pg.waitForTimeout(1000);
console.log("  звук в справке:", JSON.stringify(зв), "текст =", JSON.stringify((await сост()).звукТекст));
const с2 = await ткнуть(".rcf-help-x");
console.log("  закрыть:", JSON.stringify(с2), "→ справка =", (await сост()).справка);

console.log("\n--- КАРТА СЕТИ ---");
const к1 = await ткнуть(".rcf-map-key");
const пк = await pg.evaluate(() => { const e = document.querySelector(".rcf-netlist"); if (!e) return null; const r = e.getBoundingClientRect(); return { on: e.classList.contains("on"), текст: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80), w: Math.round(r.width), h: Math.round(r.height) }; });
console.log("  карта:", JSON.stringify(к1), JSON.stringify(пк));
await ткнуть(".rcf-map-key");

console.log("\n--- ВЫХОД ИЗ ПОЛЁТА ---");
const в = await ткнуть(".rcf-close");
await pg.waitForTimeout(2500);
console.log("  крестик выхода:", JSON.stringify(в), "→ полёт =", (await сост()).полёт);
console.log("беды:", JSON.stringify(беды.slice(0, 8)));
await b.close();
