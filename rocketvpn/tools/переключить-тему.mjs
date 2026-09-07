/* ЧТО СТАНОВИТСЯ С НАБОРОМ, КОГДА ЧЕЛОВЕК ЖМЁТ СОЛНЫШКО.

   ЗАЧЕМ ИМЕННО ТАК. Загрузить страницу СРАЗУ в светлой теме в облаке не
   выходит: рисует программный отрисовщик, рой это девятьсот тысяч точек,
   вершины считаются процессором, и сборке атласа букв ничего не остаётся
   (подробности - docs/ПРИЁМКА.md). А в тёмной теме страница собирается
   нормально, это доказали все замеры луны.

   Значит грузим тёмную, дожидаемся переезда слов в объём и ПЕРЕКЛЮЧАЕМ
   тему тем же событием, которым её переключает шапка сайта. Это ровно
   тот путь, по которому идёт живой человек, нажавший солнышко.

   Что проверяем:
     · станция и периметр - днём набор ТЁМНЫЙ (фон у них дневной);
     · прокол, рубка, пуск, финал - набор СВЕТЛЫЙ в обеих темах, потому
       что фон у них подземный и от темы не зависит (data-текст);
     · подписи глыб переворачиваются вместе со своей каймой.

   Запуск: node tools/переключить-тему.mjs */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const кон = await бр.newContext({ viewport: { width: 1440, height: 900 } });
await кон.addInitScript(() => {
  try { localStorage.setItem("rv-тема", "тёмная"); } catch (e) {}
});
const стр = await кон.newPage();
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });

const дошли = await стр.waitForFunction(
  () => document.documentElement.classList.contains("рв-слова-в-сцене"),
  null, { timeout: 420000 }).then(() => true).catch(() => false);
console.log(`слова в сцене: ${дошли ? "да" : "НЕТ"}`);
if (!дошли) { await бр.close(); process.exit(1); }

/* Один и тот же замер до и после переключения. */
async function снять() {
  return стр.evaluate(() => {
    const из = { тема: document.documentElement.getAttribute("data-тема"), акты: [], глыбы: null };
    try {
      const з = window.RV_СЛОВО3D && window.RV_СЛОВО3D["замер"]();
      if (з && з.акты) {
        for (const а of з.акты) {
          из.акты.push({ акт: а["акт"], просит: а["проситТекст"] || "", я: а["светлотаНабора"] });
        }
      }
    } catch (e) {}
    try {
      const W = window.RV_WORLD && window.RV_WORLD["мир"] ? window.RV_WORLD["мир"]() : null;
      if (W && W.сцена) {
        const свет = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
        const я = [];
        W.сцена.traverse((о) => {
          if (!о.isMesh || !о.userData || о.userData["текст"] == null) return;
          const у = о.material && о.material.uniforms;
          if (у && у.uColor) я.push(свет(у.uColor.value));
        });
        if (я.length) из.глыбы = +(я.reduce((a, b) => a + b, 0) / я.length).toFixed(3);
      }
    } catch (e2) {}
    return из;
  });
}

function печать(з) {
  console.log(`\n--- тема ${з.тема} ---`);
  for (const а of з.акты) {
    const с = а.я == null ? "?" : (а.я > 0.5 ? "СВЕТЛЫЙ" : "тёмный");
    console.log(`  ${а.акт.padEnd(10)} просит «${(а.просит || "-").padEnd(8)}» светлота ${а.я} ${с}`);
  }
  if (з.глыбы != null) {
    console.log(`  подписи глыб: светлота ${з.глыбы} ${з.глыбы > 0.5 ? "СВЕТЛЫЙ" : "тёмный"}`);
  }
}

печать(await снять());

/* Переключаем тем же путём, что шапка сайта: атрибут плюс событие. */
await стр.evaluate(() => {
  document.documentElement.setAttribute("data-тема", "светлая");
  window.dispatchEvent(new CustomEvent("rv-тема", { detail: "светлая" }));
});
await стр.waitForTimeout(1500);
печать(await снять());

await бр.close();
