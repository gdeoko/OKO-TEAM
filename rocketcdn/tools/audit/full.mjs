import { ЭКРАНЫ, браузер, страница, вИгру } from "./hard.mjs";
const ЭКРАН = process.env.RC_SCR || "ПК";
const ТАП = process.env.RC_TAP === "1";
const ЧАСТИ = (process.env.RC_PART || "клавиши,меню,панели,тела,рукава").split(",");
const P = (process.env.RC_P || "0.05,0.2,0.35,0.5,0.65,0.8").split(",").map(Number);

const b = await браузер();
const э = ЭКРАНЫ[ЭКРАН];
const { pg, беды } = await страница(b, э);
await вИгру(pg);
console.log("###### ЭКРАН " + ЭКРАН + " " + JSON.stringify(э.vp) + (ТАП ? " ПАЛЬЦЕМ" : " МЫШЬЮ") + " ######");

async function жать(x, y) {
  if (ТАП) await pg.touchscreen.tap(x, y);
  else { await pg.mouse.move(x, y); await pg.waitForTimeout(150); await pg.mouse.click(x, y); }
}
async function гео(сел, инд) {
  return pg.evaluate(([c, i]) => {
    const e = document.querySelectorAll(c)[i || 0];
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const под = document.elementFromPoint(cx, cy);
    return { x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height),
             display: cs.display, vis: cs.visibility, op: +cs.opacity, pe: cs.pointerEvents,
             вКадре: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
             своя: !!(под && (под === e || e.contains(под))),
             поверх: (под && !(под === e || e.contains(под))) ? (под.className || под.tagName).toString().slice(0, 34) : "" };
  }, [сел, инд || 0]);
}
const сост = () => pg.evaluate(() => {
  const s = window.RC_FLIGHT.state();
  const i = window.RC_FLIGHT._interaction();
  return { p: +s.p.toFixed(3), v: +s.v.toFixed(4), уни: s.вселенная, цель: s.цель,
           scan: i.scan, auto: i.auto, zoom: i.zoom, thr: i.thrust,
           меню: i.menu, карта: i.map, справка: i.help,
           курс: (document.querySelector(".rcf-c-goal") || {}).textContent,
           сеть: (document.querySelector(".rcf-net") || {}).textContent,
           откр: (document.querySelector(".rcf-prog") || {}).textContent,
           досье: !!document.querySelector(".rcf-dos.on"),
           говор: ((document.querySelector(".rcf-mis") || {}).textContent || "").slice(0, 34),
           звук: (document.querySelector(".rcf-snd-key") || {}).textContent };
});
function разница(a, b2) {
  const r = [];
  for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b2[k])) r.push(k + " " + JSON.stringify(a[k]) + "→" + JSON.stringify(b2[k]));
  return r;
}
async function сброс() {
  await pg.evaluate(() => {
    [".rcf-menu", ".rcf-netlist", ".rcf-help", ".rcf-dos"].forEach(c => { const e = document.querySelector(c); if (e) e.classList.remove("on"); });
  });
  await pg.waitForTimeout(400);
}

/* ── 1. КЛАВИШИ ПУЛЬТА ─────────────────────────────────── */
if (ЧАСТИ.includes("клавиши")) {
  console.log("\n===== КЛАВИШИ ПУЛЬТА =====");
  const все = await pg.evaluate(() => [...document.querySelectorAll(".rc-flight button, .rc-flight [role='slider']")]
    .map(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      return { к: (e.className || "").toString().split(" ").filter(x => x.indexOf("rcf-") === 0).join("."),
               т: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 14),
               d: cs.display, v: cs.visibility, o: +cs.opacity, w: Math.round(r.width), h: Math.round(r.height) }; }));
  console.log("кнопок в слое полёта: " + все.length);
  все.forEach(e => console.log("   " + (e.d === "none" || e.v === "hidden" || e.o < 0.05 || e.w < 2 ? "СКРЫТА " : "видна  ") +
    (e.к || "?").padEnd(28) + " " + JSON.stringify(e.т).padEnd(16) + " display=" + e.d + " " + e.w + "x" + e.h));

  const КЛ = [".rcf-navkey", ".rcf-map-key", ".rcf-scan-key", ".rcf-deploy", ".rcf-auto-key",
              ".rcf-stop-key", ".rcf-shot", ".rcf-fire-key", ".rcf-zoom-in", ".rcf-zoom-out",
              ".rcf-help-key", ".rcf-thr", ".rcf-auto", ".rcf-close"];
  for (const c of КЛ) {
    if (c === ".rcf-close") continue;
    const г = await гео(c);
    if (!г) { console.log("НЕТ В РАЗМЕТКЕ " + c); continue; }
    if (г.display === "none" || г.w < 2) { console.log("СКРЫТА CSS/JS  " + c.padEnd(15) + " display=" + г.display + " " + г.w + "x" + г.h + " → нажать нельзя"); continue; }
    const до = await сост();
    await жать(г.x, г.y);
    await pg.waitForTimeout(1600);
    const по = await сост();
    const р = разница(до, по);
    console.log((р.length ? "РАБОТАЕТ " : "МЁРТВАЯ  ") + c.padEnd(15) +
      " xy=" + г.x + "," + г.y + " " + г.w + "x" + г.h + " вКадре=" + г.вКадре + " своя=" + г.своя +
      (г.поверх ? " ПОВЕРХ:" + г.поверх : "") + "   " + р.join("; "));
    await сброс();
  }
}

/* ── 2. МЕНЮ ЦЕЛЕЙ ─────────────────────────────────────── */
if (ЧАСТИ.includes("меню")) {
  console.log("\n===== МЕНЮ ЦЕЛЕЙ =====");
  const открыть = async () => {
    const есть = await pg.evaluate(() => !!document.querySelector(".rcf-menu.on"));
    if (!есть) { const г = await гео(".rcf-navkey"); if (г) await жать(г.x, г.y); await pg.waitForTimeout(1100); }
    return pg.evaluate(() => !!document.querySelector(".rcf-menu.on"));
  };
  console.log("меню открывается: " + await открыть());
  const пункты = await pg.evaluate(() => [...document.querySelectorAll(".rcf-menu button")].map((e, i) => {
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const под = document.elementFromPoint(cx, cy);
    return { i, т: (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 26),
             goal: e.getAttribute("data-goal"), uni: e.getAttribute("data-uni"),
             sys: e.getAttribute("data-sys"), pl: e.getAttribute("data-pl"),
             locked: e.classList.contains("locked"),
             x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height),
             d: cs.display, вКадре: r.top >= 0 && r.bottom <= innerHeight,
             своя: !!(под && (под === e || e.contains(под))),
             поверх: (под && !(под === e || e.contains(под))) ? (под.className || под.tagName).toString().slice(0, 30) : "" };
  }));
  console.log("пунктов: " + пункты.length);
  пункты.forEach(п => console.log("   #" + п.i + " " + JSON.stringify(п.т).padEnd(28) + " goal=" + п.goal + " uni=" + п.uni + " sys=" + п.sys + "/" + п.pl +
    " " + п.w + "x" + п.h + " вКадре=" + п.вКадре + " своя=" + п.своя + (п.locked ? " ЗАКРЫТ" : "") + (п.поверх ? " ПОВЕРХ:" + п.поверх : "")));
  for (const п of пункты) {
    await открыть();
    await pg.waitForTimeout(500);
    const г = await pg.evaluate((i) => { const e = document.querySelectorAll(".rcf-menu button")[i]; if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), вКадре: r.top >= 0 && r.bottom <= innerHeight }; }, п.i);
    if (!г) { console.log("  пункт #" + п.i + " исчез"); continue; }
    const до = await сост();
    if (!г.вКадре) { console.log("  ЗА КАДРОМ #" + п.i + " " + JSON.stringify(п.т) + " y=" + г.y); }
    await жать(г.x, г.y);
    await pg.waitForTimeout(2200);
    const по = await сост();
    const р = разница(до, по);
    console.log("  " + (р.length ? "СРАБОТАЛ " : "НИЧЕГО   ") + JSON.stringify(п.т).padEnd(28) + " goal=" + п.goal + " uni=" + п.uni + "  " + р.join("; "));
    const у = await pg.evaluate(() => window.RC_FLIGHT.state().вселенная);
    if (у !== 0) { await pg.evaluate(() => window.RC_FLIGHT._jump(0)); await pg.waitForTimeout(7000); }
    await сброс();
  }
}

/* ── 3. ПАНЕЛИ ─────────────────────────────────────────── */
if (ЧАСТИ.includes("панели")) {
  console.log("\n===== ПАНЕЛИ =====");
  for (const имя of ["ЗЕМЛЯ", "СОЛНЦЕ", "АСТЕРОИДНЫЙ", "КОМЕТА", "RC-SAT", "МЛЕЧНЫЙ", "МЕРКУРИЙ", "ВЕНЕРА", "ЮПИТЕР", "УРАН", "НЕПТУН", "САТУРН", "МАРС", "ЛУНА"]) {
    const r = await pg.evaluate((n) => window.RC_FLIGHT._dos(n), имя);
    await pg.waitForTimeout(1100);
    const s = await pg.evaluate(() => {
      const d = document.querySelector(".rcf-dos");
      return { откр: !!(d && d.classList.contains("on")), загл: (document.querySelector(".rcf-dos-h") || {}).textContent,
               текст: ((document.querySelector(".rcf-dos-p") || {}).textContent || "").slice(0, 40),
               видео: (document.querySelector(".rcf-dos-vid") || {}).dataset ? document.querySelector(".rcf-dos-vid").dataset.on : null,
               факты: ((document.querySelector(".rcf-dos-facts") || {}).textContent || "").replace(/\s+/g, " ").slice(0, 46) };
    });
    console.log("  _dos(" + имя + "): найдено=" + JSON.stringify(r) + " откр=" + s.откр + " загл=" + JSON.stringify(s.загл) + " видео=" + s.видео + " факты=" + JSON.stringify(s.факты));
    await pg.evaluate(() => { const d = document.querySelector(".rcf-dos"); if (d) d.classList.remove("on"); });
    await pg.waitForTimeout(250);
  }
  await pg.evaluate(() => window.RC_FLIGHT._dos("ЗЕМЛЯ"));
  await pg.waitForTimeout(1500);
  const гx = await гео(".rcf-dos-x");
  console.log("  крестик досье: " + JSON.stringify(гx));
  if (гx) { await жать(гx.x, гx.y); await pg.waitForTimeout(1600); }
  console.log("  досье после крестика: " + (await pg.evaluate(() => !!document.querySelector(".rcf-dos.on"))));

  const гс = await гео(".rcf-help-key");
  if (гс && гс.display !== "none") {
    await жать(гс.x, гс.y); await pg.waitForTimeout(1600);
    console.log("  справка открылась: " + (await pg.evaluate(() => !!document.querySelector(".rcf-help.on"))));
    const гз = await гео(".rcf-snd-key");
    console.log("  кнопка звука в справке: " + JSON.stringify(гз));
    if (гз && гз.display !== "none") { const т1 = (await сост()).звук; await жать(гз.x, гз.y); await pg.waitForTimeout(1800); console.log("    текст звука " + JSON.stringify(т1) + " → " + JSON.stringify((await сост()).звук)); }
    const гx2 = await гео(".rcf-help-x");
    console.log("  крестик справки: " + JSON.stringify(гx2));
    if (гx2) { await жать(гx2.x, гx2.y); await pg.waitForTimeout(1500); }
    console.log("  справка после крестика: " + (await pg.evaluate(() => !!document.querySelector(".rcf-help.on"))));
  } else console.log("  СПРАВКА: клавиши нет или она скрыта → " + JSON.stringify(гс));
  await сброс();
}

/* ── 4. ТЕЛА В КОСМОСЕ ─────────────────────────────────── */
const итог = [];
async function телаНаТочке(метка) {
  const сн = await pg.evaluate(() => {
    const s = window.RC_FLIGHT._pick();
    return { всего: s.всего, уни: s.вселенная,
             все: s.тела,
             видимые: s.тела.filter(t => t.видно && !t.сзади && t.x >= 0 && t.x <= innerWidth && t.y >= 0 && t.y <= innerHeight) };
  });
  console.log("\n-- " + метка + " : в кадре " + сн.видимые.length + " из " + сн.всего + " (уни " + сн.уни + ")");
  for (const т of сн.видимые) {
    const под = await pg.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return "нет";
      const бл = el.closest && el.closest(".rcf-hud, .rcf-dos, .rcf-uni, button, a");
      return (typeof el.className === "string" && el.className ? el.className.slice(0, 24) : el.tagName) + (бл ? " |ПЕРЕКРЫТО:" + ((бл.className || бл.tagName) + "").slice(0, 20) : "");
    }, [т.x, т.y]);
    await pg.evaluate(() => { const d = document.querySelector(".rcf-dos"); if (d) d.classList.remove("on"); });
    await pg.waitForTimeout(250);
    await жать(т.x, т.y);
    await pg.waitForTimeout(1700);
    const рез = await pg.evaluate(() => {
      const d = document.querySelector(".rcf-dos");
      return { о: !!(d && d.classList.contains("on")), имя: (document.querySelector(".rcf-dos-h") || {}).textContent };
    });
    const луч = await pg.evaluate(([x, y]) => window.RC_FLIGHT._ray(x, y), [т.x, т.y]);
    console.log("   " + (рез.о ? "OK  " : "НЕТ ") + (т.имя || "?").slice(0, 26).padEnd(27) +
      " xy=" + т.x + "," + т.y + " д=" + т.д + " м=" + т.масштаб + " луч=" + луч.попаданий +
      " досье=" + JSON.stringify(рез.имя || "") + " под=" + под);
    итог.push({ где: метка, имя: т.имя, ok: рез.о });
  }
  /* Кого вообще не удалось увидеть в кадре */
  const невидимые = сн.все.filter(t => !сн.видимые.includes(t));
  if (невидимые.length) console.log("   (вне кадра/невидимы: " + невидимые.map(t => (t.имя || "?") + (t.видно ? "" : "[скрыт]") + (t.сзади ? "[сзади]" : "")).join(", ").slice(0, 300) + ")");
}

if (ЧАСТИ.includes("тела")) {
  console.log("\n===== ТЕЛА СОЛНЕЧНОЙ СИСТЕМЫ =====");
  for (const p of P) {
    await pg.evaluate((v) => window.RC_FLIGHT._set(v), p);
    await pg.waitForTimeout(3000);
    await телаНаТочке("p=" + p);
  }
}

if (ЧАСТИ.includes("рукава")) {
  console.log("\n===== ЧУЖИЕ РУКАВА =====");
  for (const n of [1, 2, 3]) {
    await pg.evaluate((k) => window.RC_FLIGHT._jump(k), n);
    try {
      await pg.waitForFunction((k) => window.RC_FLIGHT._pick() && window.RC_FLIGHT._pick().вселенная === k, n, { timeout: 120000, polling: 1000 });
    } catch (e) { console.log("рукав " + n + ": прыжок не состоялся"); continue; }
    await pg.waitForTimeout(9000);
    const сис = await pg.evaluate(() => [...document.querySelectorAll(".rcf-nav button")].map(e => ((e.textContent || "").trim().slice(0, 18)) + "[" + e.getAttribute("data-sys") + "/" + e.getAttribute("data-pl") + "]"));
    console.log("\n### РУКАВ " + n + " · кнопок в меню курса: " + сис.length + " → " + сис.join(" "));
    await телаНаТочке("рукав " + n + " после прыжка");
    await pg.evaluate(() => { const b2 = document.querySelector(".rcf-nav button[data-sys]"); if (b2) b2.click(); });
    await pg.waitForTimeout(14000);
    await телаНаТочке("рукав " + n + " у 1-й системы");
  }
}

console.log("\n########## ИТОГ " + ЭКРАН + (ТАП ? " ПАЛЬЦЕМ" : "") + " ##########");
const нет = итог.filter(o => !o.ok);
console.log("клик не открыл досье: " + нет.length + " из " + итог.length);
console.log("НЕ КЛИКАЮТСЯ: " + [...new Set(нет.map(o => o.имя))].join(" | "));
console.log("кликаются:    " + [...new Set(итог.filter(o => o.ok).map(o => o.имя))].join(" | "));
console.log("беды: " + JSON.stringify(беды.slice(0, 10)));
await b.close();
