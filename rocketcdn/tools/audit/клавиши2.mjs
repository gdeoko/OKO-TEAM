import { ЭКРАНЫ, браузер, страница, вИгру } from "./жёстко.mjs";
const ЭКРАН = process.env.RC_SCR || "ПК";
const ТАП = process.env.RC_TAP === "1";

const b = await браузер();
const э = ЭКРАНЫ[ЭКРАН];
const { pg, беды } = await страница(b, э);
await вИгру(pg);
console.log("ЭКРАН " + ЭКРАН + " " + JSON.stringify(э.vp) + (ТАП ? " ТАП" : " МЫШЬ"));

/* Что вообще есть на пульте */
const список = await pg.evaluate(() => {
  const из = [];
  const кор = document.querySelector(".rc-flight") || document.body;
  for (const el of кор.querySelectorAll("button, [role='slider'], .rcf-key")) {
    из.push((el.className || "").toString());
  }
  return из;
});
console.log("всего кнопок в слое полёта:", список.length);

const КЛАВИШИ = [".rcf-navkey", ".rcf-map-key", ".rcf-scan-key", ".rcf-deploy",
                 ".rcf-fire-key", ".rcf-auto-key", ".rcf-stop-key",
                 ".rcf-zoom-in", ".rcf-zoom-out", ".rcf-shot", ".rcf-help-key",
                 ".rcf-snd-key", ".rcf-auto", ".rcf-thr"];

async function снять() {
  return pg.evaluate(() => {
    const i = window.RC_FLIGHT._interaction();
    const s = window.RC_FLIGHT._state();
    const кл = (c) => { const e = document.querySelector(c); return e ? (e.className.toString().indexOf("cur") >= 0) + "/" + (e.getAttribute("aria-pressed") || "-") : "нет"; };
    return { scan: i.scan, auto: i.auto, zoom: i.zoom, thrust: i.thrust,
             menu: i.menu, map: i.map, help: i.help, cap: (i.caption || "").slice(0, 40),
             p: s.p, v: s.v, цель: s.цель, курс: (document.querySelector(".rcf-c-goal") || {}).textContent,
             сеть: (document.querySelector(".rcf-net") || {}).textContent,
             скан: кл(".rcf-scan-key"), автоК: кл(".rcf-auto-key"), картаК: кл(".rcf-map-key"),
             досье: !!document.querySelector(".rcf-dos.on"),
             говор: (document.querySelector(".rcf-mis") || {}).textContent };
  });
}

for (const сел of КЛАВИШИ) {
  const гео = await pg.evaluate((c) => {
    const el = document.querySelector(c);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const под = document.elementFromPoint(cx, cy);
    const свой = !!(под && (под === el || el.contains(под)));
    return { есть: true, x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height),
             видно: cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.05,
             pe: cs.pointerEvents, disabled: el.disabled === true,
             вКадре: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
             свой: свой, поверх: свой ? "" : (под ? (под.className || под.tagName || "").toString().slice(0, 40) : "нет") };
  }, сел);
  if (!гео) { console.log("ОТСУТСТВУЕТ  " + сел); continue; }
  const до = await снять();
  let ошибка = "";
  try {
    if (ТАП) await pg.touchscreen.tap(гео.x, гео.y);
    else await pg.mouse.click(гео.x, гео.y);
  } catch (e) { ошибка = e.message.slice(0, 70); }
  await pg.waitForTimeout(1700);
  const после = await снять();
  const разн = [];
  for (const k of Object.keys(до)) if (JSON.stringify(до[k]) !== JSON.stringify(после[k])) разн.push(k + ": " + JSON.stringify(до[k]) + "→" + JSON.stringify(после[k]));
  console.log((разн.length ? "РАБОТАЕТ " : "МЁРТВАЯ  ") + сел.padEnd(16) +
    " xy=" + гео.x + "," + гео.y + " " + гео.w + "x" + гео.h +
    " видно=" + гео.видно + " вКадре=" + гео.вКадре + " своя=" + гео.свой +
    (гео.поверх ? " ПОВЕРХ:" + гео.поверх : "") + (ошибка ? " ОШИБКА:" + ошибка : "") +
    (разн.length ? "  " + разн.join("; ") : ""));
  /* возвращаем состояние: гасим меню/карту/справку */
  await pg.evaluate(() => {
    [".rcf-menu", ".rcf-netlist", ".rcf-help"].forEach(c => { const e = document.querySelector(c); if (e) e.classList.remove("on"); });
    const d = document.querySelector(".rcf-dos"); if (d) d.classList.remove("on");
  });
  await pg.waitForTimeout(400);
}
console.log("беды:", JSON.stringify(беды.slice(0, 8)));
await b.close();
