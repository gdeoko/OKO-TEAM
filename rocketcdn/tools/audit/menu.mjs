import { ЭКРАНЫ, браузер, страница, вИгру } from "./hard.mjs";
const ЭКРАН = process.env.RC_SCR || "ПК";
const ТАП = process.env.RC_TAP === "1";
const b = await браузер();
const э = ЭКРАНЫ[ЭКРАН];
const { pg, беды } = await страница(b, э);
await вИгру(pg);
console.log("МЕНЮ ЦЕЛЕЙ · ЭКРАН " + ЭКРАН + " " + JSON.stringify(э.vp) + (ТАП ? " ТАП" : " МЫШЬ"));

async function открытьМеню() {
  const было = await pg.evaluate(() => !!document.querySelector(".rcf-menu.on"));
  if (!было) {
    const г = await pg.evaluate(() => { const e = document.querySelector(".rcf-navkey"); const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; });
    if (ТАП) await pg.touchscreen.tap(г[0], г[1]); else await pg.mouse.click(г[0], г[1]);
    await pg.waitForTimeout(1200);
  }
  return pg.evaluate(() => !!document.querySelector(".rcf-menu.on"));
}

console.log("меню открылось:", await открытьМеню());

const пункты = await pg.evaluate(() => {
  const из = [];
  document.querySelectorAll(".rcf-menu button").forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const под = document.elementFromPoint(cx, cy);
    из.push({ i, текст: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 26),
              goal: el.getAttribute("data-goal"), uni: el.getAttribute("data-uni"),
              sys: el.getAttribute("data-sys"), pl: el.getAttribute("data-pl"),
              x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height),
              вКадре: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
              видно: cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05,
              своя: !!(под && (под === el || el.contains(под))),
              поверх: (под && !(под === el || el.contains(под))) ? (под.className || под.tagName).toString().slice(0, 34) : "" });
  });
  return из;
});
console.log("пунктов в меню:", пункты.length);
пункты.forEach(п => console.log("  #" + п.i + " " + JSON.stringify(п.текст) + " goal=" + п.goal + " uni=" + п.uni + " sys=" + п.sys + "/" + п.pl +
  " xy=" + п.x + "," + п.y + " " + п.w + "x" + п.h + " вКадре=" + п.вКадре + " видно=" + п.видно + " своя=" + п.своя + (п.поверх ? " ПОВЕРХ:" + п.поверх : "")));

async function снять() {
  return pg.evaluate(() => {
    const s = window.RC_FLIGHT.state();
    return { p: s.p, цель: s.цель, уни: s.вселенная,
             курс: (document.querySelector(".rcf-c-goal") || {}).textContent,
             меню: !!document.querySelector(".rcf-menu.on"),
             говор: (document.querySelector(".rcf-mis") || {}).textContent };
  });
}

for (const п of пункты) {
  await открытьМеню();
  await pg.waitForTimeout(600);
  const г = await pg.evaluate((i) => { const el = document.querySelectorAll(".rcf-menu button")[i]; if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), r.top >= 0 && r.bottom <= innerHeight]; }, п.i);
  if (!г) { console.log("пункт исчез #" + п.i); continue; }
  const до = await снять();
  let ош = "";
  try { if (ТАП) await pg.touchscreen.tap(г[0], г[1]); else await pg.mouse.click(г[0], г[1]); }
  catch (e) { ош = e.message.slice(0, 60); }
  await pg.waitForTimeout(2200);
  const после = await снять();
  const разн = [];
  for (const k of Object.keys(до)) if (JSON.stringify(до[k]) !== JSON.stringify(после[k])) разн.push(k + " " + JSON.stringify(до[k]) + "→" + JSON.stringify(после[k]));
  console.log((разн.length ? "СРАБОТАЛ  " : "НИЧЕГО    ") + JSON.stringify(п.текст).padEnd(24) +
    " goal=" + п.goal + " uni=" + п.uni + (ош ? " ОШИБКА:" + ош : "") + "  " + разн.join("; "));
  /* возврат домой если прыгнули */
  const у = await pg.evaluate(() => window.RC_FLIGHT.state().вселенная);
  if (у !== 0) { await pg.evaluate(() => window.RC_FLIGHT._jump(0)); await pg.waitForTimeout(6000); }
}
console.log("беды:", JSON.stringify(беды.slice(0, 8)));
await b.close();
