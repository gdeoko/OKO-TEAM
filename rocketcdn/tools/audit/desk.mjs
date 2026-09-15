import { ЭКРАНЫ, браузер, страница } from "./hard.mjs";
const ЭКРАН = process.env.RC_SCR || "ПК";
const ТАП = process.env.RC_TAP === "1";
const b = await браузер();
const э = ЭКРАНЫ[ЭКРАН];
const { pg, беды } = await страница(b, э);
console.log("ФИНАЛ И ФОРМЫ · " + ЭКРАН + " " + JSON.stringify(э.vp) + (ТАП ? " ТАП" : " МЫШЬ"));

/* Прокрутка шагами до раздела контактов */
async function доРаздела(id) {
  for (let i = 0; i < 300; i++) {
    const r = await pg.evaluate((s) => { const e = document.getElementById(s); if (!e) return null; return { top: e.getBoundingClientRect().top, h: innerHeight, y: scrollY, max: document.documentElement.scrollHeight }; }, id);
    if (!r) return false;
    if (Math.abs(r.top - r.h * 0.2) < 60) return true;
    const d = Math.max(-r.h * 0.6, Math.min(r.h * 0.6, r.top - r.h * 0.2));
    await pg.mouse.wheel(0, Math.round(d));
    await pg.waitForTimeout(280);
    if (Math.abs(d) < 14) return true;
  }
  return true;
}
console.log("доехали до #contact:", await доРаздела("contact"));
await pg.waitForTimeout(6000);

const пульт = await pg.evaluate(() => {
  const l = document.querySelector(".rc-desk");
  if (!l) return { есть: false };
  const r = l.getBoundingClientRect();
  return { есть: true, on: l.classList.contains("dsk-on"), состояние: l.getAttribute("data-state"),
           x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
           вопросов: document.querySelectorAll(".dsk-q").length,
           кнопки: [...document.querySelectorAll(".dsk-b")].map(e => (e.textContent || "").trim().slice(0, 22)) };
});
console.log("пульт-голограмма:", JSON.stringify(пульт));

async function ткнуть(сел, инд) {
  const г = await pg.evaluate(([c, i]) => {
    const e = document.querySelectorAll(c)[i || 0];
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const под = document.elementFromPoint(cx, cy);
    return { x: Math.round(cx), y: Math.round(cy), w: Math.round(r.width), h: Math.round(r.height),
             вКадре: r.top >= 0 && r.bottom <= innerHeight,
             своя: !!(под && (под === e || e.contains(под))),
             поверх: (под && !(под === e || e.contains(под))) ? (под.className || под.tagName).toString().slice(0, 40) : "" };
  }, [сел, инд || 0]);
  if (!г) return { нет: сел };
  try { if (ТАП) await pg.touchscreen.tap(г.x, г.y); else await pg.mouse.click(г.x, г.y); }
  catch (e) { г.ошибка = e.message.slice(0, 60); }
  await pg.waitForTimeout(1800);
  return г;
}
const состояние = () => pg.evaluate(() => {
  const l = document.querySelector(".rc-desk");
  const слот = document.querySelector(".dsk-slot");
  return { состояние: l ? l.getAttribute("data-state") : null,
           заголовок: (document.querySelector(".dsk-title") || {}).textContent,
           ответ: (document.querySelector(".dsk-a") || {}).textContent ? "есть" : "нет",
           вСлоте: слот ? [...слот.children].map(e => e.id || e.tagName) : null,
           модалка: !!document.querySelector("#cbModal.on"),
           cbВМодалке: !!document.querySelector("#cbModal #cbForm"),
           leadДома: !!document.querySelector("#contact #leadForm") };
});

console.log("\n--- ВОПРОСЫ НА ПУЛЬТЕ ---");
if (пульт.вопросов > 0) {
  const в = await ткнуть(".dsk-q", 0);
  console.log("  вопрос 1:", JSON.stringify(в), "→", JSON.stringify(await состояние()));
  const н = await ткнуть(".dsk-back", 0);
  console.log("  назад:", JSON.stringify(н), "→", JSON.stringify((await состояние()).состояние));
}

console.log("\n--- КНОПКА «ПЕРЕЗВОНИТЕ МНЕ» НА ПУЛЬТЕ ---");
const зв = await ткнуть(".dsk-b-call", 0);
console.log("  нажатие:", JSON.stringify(зв));
console.log("  состояние:", JSON.stringify(await состояние()));
const поля1 = await pg.evaluate(() => {
  const f = document.querySelector(".dsk-slot #cbForm") || document.querySelector("#cbForm");
  if (!f) return { нет: true };
  const r = f.getBoundingClientRect();
  return { вСлоте: !!f.closest(".dsk-slot"), видно: getComputedStyle(f).display !== "none",
           x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
           поля: [...f.querySelectorAll("input,textarea,select")].map(e => e.name + ":" + e.type + (e.offsetWidth ? "" : " НЕВИДИМО")),
           кнопка: (f.querySelector("button[type=submit]") || {}).textContent };
});
console.log("  форма звонка:", JSON.stringify(поля1));
/* проверка полей: жмём отправку пустой формы */
if (!поля1.нет) {
  const о = await ткнуть(".dsk-slot #cbForm button[type=submit]", 0);
  await pg.waitForTimeout(1500);
  const пров = await pg.evaluate(() => {
    const f = document.querySelector("#cbForm");
    return { сообщение: (f.querySelector(".form-msg") || {}).textContent,
             класс: (f.querySelector(".form-msg") || {}).className,
             плохих: f.querySelectorAll(".field.bad").length,
             ариа: [...f.querySelectorAll("[aria-invalid]")].map(e => e.name) };
  });
  console.log("  отправка пустой:", JSON.stringify(о), "→", JSON.stringify(пров));
  /* заполняем и проверяем, что проверка снимается (НЕ отправляем) */
  await pg.evaluate(() => {
    const f = document.querySelector("#cbForm");
    const n = f.querySelector("[name=name]"), p = f.querySelector("[name=contact]"), c = f.querySelector("[name=consent]");
    n.value = "Проверка"; n.dispatchEvent(new Event("input", { bubbles: true }));
    p.value = "+7 900 000 00 00"; p.dispatchEvent(new Event("input", { bubbles: true }));
    c.checked = true;
  });
  const вал = await pg.evaluate(() => {
    const f = document.querySelector("#cbForm");
    let ok = true;
    f.querySelectorAll("[required]").forEach(el => { if (el.type === "checkbox" ? !el.checked : !(el.value || "").trim()) ok = false; });
    return { заполнено: ok, плохих: f.querySelectorAll(".field.bad").length };
  });
  console.log("  после заполнения:", JSON.stringify(вал), " (отправку не жмём)");
}

console.log("\n--- КНОПКА «ОТПРАВИТЬ ЗАЯВКУ» НА ПУЛЬТЕ ---");
await ткнуть(".dsk-back", 0);
await pg.waitForTimeout(800);
const зя = await ткнуть(".dsk-b-lead", 0);
console.log("  нажатие:", JSON.stringify(зя), "→", JSON.stringify(await состояние()));
const поля2 = await pg.evaluate(() => {
  const f = document.querySelector(".dsk-slot #leadForm") || document.querySelector("#leadForm");
  if (!f) return { нет: true };
  const r = f.getBoundingClientRect();
  return { вСлоте: !!f.closest(".dsk-slot"), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
           вКадре: r.top >= 0 && r.bottom <= innerHeight,
           поля: [...f.querySelectorAll("input,textarea,select")].map(e => e.name + ":" + e.type + (e.offsetWidth ? "" : " НЕВИДИМО")),
           кнопка: (f.querySelector("button[type=submit]") || {}).textContent };
});
console.log("  форма заявки:", JSON.stringify(поля2));
if (!поля2.нет) {
  const о = await ткнуть("#leadForm button[type=submit]", 0);
  await pg.waitForTimeout(1500);
  const пров = await pg.evaluate(() => {
    const f = document.querySelector("#leadForm");
    return { сообщение: (f.querySelector(".form-msg") || {}).textContent, класс: (f.querySelector(".form-msg") || {}).className,
             плохих: f.querySelectorAll(".field.bad").length };
  });
  console.log("  отправка пустой:", JSON.stringify(о), "→", JSON.stringify(пров));
}

console.log("\n--- МОДАЛКА ЗВОНКА (js-callback вне пульта) ---");
const мк = await pg.evaluate(() => {
  const шт = [...document.querySelectorAll(".js-callback")];
  return шт.map(e => { const r = e.getBoundingClientRect(); return { где: (e.closest("[id]") || {}).id || (e.parentNode.className || ""), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), вКадре: r.top >= 0 && r.bottom <= innerHeight }; });
});
console.log("  кнопок js-callback:", JSON.stringify(мк));
await pg.evaluate(() => { const b = [...document.querySelectorAll(".js-callback")].find(e => e.getBoundingClientRect().height > 0); if (b) b.click(); });
await pg.waitForTimeout(1800);
console.log("  после клика:", JSON.stringify(await состояние()));
const вМод = await pg.evaluate(() => {
  const m = document.querySelector("#cbModal");
  if (!m) return null;
  return { on: m.classList.contains("on"), видимость: getComputedStyle(m).visibility,
           формаВнутри: !!m.querySelector("#cbForm"),
           полей: m.querySelectorAll("input,textarea,select").length,
           текст: (m.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90) };
});
console.log("  модалка:", JSON.stringify(вМод));
console.log("беды:", JSON.stringify(беды.slice(0, 10)));
await b.close();
