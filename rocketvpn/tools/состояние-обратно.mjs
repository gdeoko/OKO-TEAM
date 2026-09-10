/* Диагностика: ЧТО именно расходится при обратной прокрутке.

   Проверка `checks/обратно.mjs` говорит, что кадр разный, но не говорит
   чем. Этот инструмент снимает на тех же контрольных точках СОСТОЯНИЕ
   сцены числами: какие акты считают себя видимыми, какая у каждого доля,
   что стоит в глобальных флагах, сколько узлов в сцене и сколько срывов.

   Потом печатает пары «вниз против вверх» и подсвечивает расхождения.
   Это даёт точный адрес беды вместо разглядывания картинок.

   Запуск: node tools/состояние-обратно.mjs [ПК|тел] */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "ПК";
const вьюпорт = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const ТОЧКИ = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90];
const ШАГОВ_МЕЖДУ = 10;

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: вьюпорт, deviceScaleFactor: 1 });

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => document.documentElement.classList.contains("рв-слова-в-сцене"),
  null, { timeout: 240000 }).catch(() => {});
await стр.waitForFunction(
  () => !(window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && window.RV_WORLD["вступлениеИдёт"]()),
  null, { timeout: 240000 }).catch(() => {});
await стр.waitForTimeout(2000);

const высота = await стр.evaluate(() =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight));

async function ехать(куда) {
  await стр.evaluate((y) => window.scrollTo(0, y), Math.round(куда));
  await стр.evaluate(() => new Promise((р) => requestAnimationFrame(() => requestAnimationFrame(р))));
}

/* Снимок состояния. Всё берётся из живых объектов мира, ничего не
   выдумывается: если поля нет, в отчёт уходит прочерк. */
async function снятьСостояние() {
  await стр.waitForTimeout(1200);
  return await стр.evaluate(() => {
    const о = {};
    const W = window.RV_WORLD;
    const м = (W && W["мир"]) ? W["мир"]() : null;

    o: {
      if (!м) { о["мир"] = "нет"; break o; }
      о["узлов"] = м.scene ? м.scene.children.length : -1;
      о["ступень"] = м["ступень"];
      const c = м.cam;
      if (c) {
        о["камера"] = [c.position.x, c.position.y, c.position.z]
          .map((v) => Math.round(v * 10) / 10).join(",");
      }
    }

    /* Акты: имя, считает ли себя видимым, доля. */
    const акты = {};
    try {
      const A = м && м["акты"] ? м["акты"] : {};
      for (const имя in A) {
        if (!Object.prototype.hasOwnProperty.call(A, имя)) continue;
        const a = A[имя];
        const доля = window.RV_MOTION && window.RV_MOTION["доля"]
          ? window.RV_MOTION["доля"](имя) : null;
        акты[имя] = {
          "виден": !!(a && a["виден"]),
          "доля": доля == null ? null : Math.round(доля * 1000) / 1000
        };
      }
    } catch (e) { акты["ошибка"] = String(e).slice(0, 80); }
    о["акты"] = акты;

    /* Глобальные флаги, которые решают, кто рисует стену и что видно. */
    const флаги = {};
    for (const имя of ["RV_СТЕНА_У_ДОМА"]) {
      флаги[имя] = (имя in window) ? window[имя] : "нет";
    }
    о["флаги"] = флаги;

    try { о["срывы"] = W && W["срывы"] ? W["срывы"]() : null; } catch (e) {}

    /* Видимые группы верхнего уровня сцены: имя и видимость. Это
       показывает, какой акт реально что-то рисует. */
    try {
      const гр = [];
      if (м && м.scene) {
        for (const д of м.scene.children) {
          if (д && д.visible && д.name) гр.push(д.name);
        }
      }
      о["видимые"] = гр.sort().join(" ");
    } catch (e) {}

    return о;
  });
}

const вниз = {}, вверх = {};
await ехать(0);
await стр.waitForTimeout(1500);

let было = 0;
for (const т of ТОЧКИ) {
  const цель = высота * т;
  for (let i = 1; i <= ШАГОВ_МЕЖДУ; i++) await ехать(было + (цель - было) * (i / ШАГОВ_МЕЖДУ));
  было = цель;
  вниз[т] = await снятьСостояние();
}
for (let i = 1; i <= ШАГОВ_МЕЖДУ; i++) await ехать(было + (высота - было) * (i / ШАГОВ_МЕЖДУ));
было = высота;
await стр.waitForTimeout(1500);
for (const т of [...ТОЧКИ].reverse()) {
  const цель = высота * т;
  for (let i = 1; i <= ШАГОВ_МЕЖДУ; i++) await ехать(было + (цель - было) * (i / ШАГОВ_МЕЖДУ));
  было = цель;
  вверх[т] = await снятьСостояние();
}
await бр.close();

function строкаАктов(с) {
  const a = с["акты"] || {};
  return Object.keys(a).sort().map((и) => {
    const x = a[и];
    if (!x || typeof x !== "object") return и + "=?";
    return и + (x["виден"] ? "*" : " ") + (x["доля"] == null ? "" : x["доля"].toFixed(2));
  }).join("  ");
}

console.log("Состояние сцены на контрольных точках. Звёздочка значит «акт считает себя видимым».\n");
for (const т of ТОЧКИ) {
  const н = вниз[т], в = вверх[т];
  if (!н || !в) continue;
  const одинаково = строкаАктов(н) === строкаАктов(в) &&
    String(н["видимые"]) === String(в["видимые"]) &&
    JSON.stringify(н["флаги"]) === JSON.stringify(в["флаги"]);
  console.log("── доля ленты " + т.toFixed(2) + (одинаково ? "" : "   <== СОСТОЯНИЕ РАСХОДИТСЯ"));
  console.log("   вниз : " + строкаАктов(н));
  console.log("   вверх: " + строкаАктов(в));
  if (JSON.stringify(н["флаги"]) !== JSON.stringify(в["флаги"])) {
    console.log("   флаги вниз : " + JSON.stringify(н["флаги"]));
    console.log("   флаги вверх: " + JSON.stringify(в["флаги"]));
  }
  if (String(н["видимые"]) !== String(в["видимые"])) {
    const A = new Set(String(н["видимые"]).split(" ").filter(Boolean));
    const B = new Set(String(в["видимые"]).split(" ").filter(Boolean));
    const тольковниз = [...A].filter((x) => !B.has(x));
    const тольковверх = [...B].filter((x) => !A.has(x));
    if (тольковниз.length) console.log("   рисуется ТОЛЬКО на пути вниз : " + тольковниз.join(" "));
    if (тольковверх.length) console.log("   рисуется ТОЛЬКО на пути вверх: " + тольковверх.join(" "));
  }
  if (н["камера"] !== в["камера"]) {
    console.log("   камера вниз : " + н["камера"]);
    console.log("   камера вверх: " + в["камера"]);
  }
  if (н["узлов"] !== в["узлов"]) {
    console.log("   узлов в сцене: вниз " + н["узлов"] + ", вверх " + в["узлов"]);
  }
}

const пс = вниз[ТОЧКИ[ТОЧКИ.length - 1]];
console.log("\nсрывы на последней точке: " + JSON.stringify(пс && пс["срывы"]));
