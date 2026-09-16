/* ПЕРЕХОД ИЗ ТУННЕЛЯ К РАКЕТЕ: КАМЕРА И САМА РАКЕТА.

   Владелец: «после туннеля камера куда-то наверх дёргается и потом
   только ровно на ракету смотрит, и ракета из ниоткуда появляется.
   Давай сделай так, чтобы после туннеля ракета перед нами приземлилась,
   после текст и кнопка снизу появились, и всё это привязать к скроллу».

   Три вопроса, и на каждый нужен СВОЙ ряд чисел, иначе правка пойдёт
   наугад:

     1. ГДЕ РЫВОК. Идём по концу прокола и началу финала подряд и
        печатаем положение камеры. Рывок это скачок между соседними
        долями, заметно больший остальных шагов, - его видно в столбце
        разницы, а не на глаз.
     2. ОТКУДА БЕРЁТСЯ РАКЕТА. На каждой доле печатаем, видна ли она и
        где стоит её корень. «Из ниоткуда» это появление сразу в конечной
        точке; посадка это приход сверху за несколько долей.
     3. КОГДА ПРИХОДЯТ СЛОВА И КНОПКА. Печатаем их видимость и верхнюю
        кромку: они обязаны выходить снизу и уже ПОСЛЕ того, как ракета
        села, а не одновременно с ней.

   Запуск: node tools/стык-финала.mjs [тел|пк]
*/
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";
import { mkdirSync } from "node:fs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "тел";
const КУДА = "/tmp/стык-финала";
const экран = КТО === "пк"
  ? { w: 1440, h: 900, dpr: 1, mob: false }
  : { w: 390, h: 844, dpr: 1, mob: true };

const ПУТЬ = [
  ["прокол", 0.80], ["прокол", 0.90], ["прокол", 0.97],
  ["финал", 0.00], ["финал", 0.04], ["финал", 0.08], ["финал", 0.14],
  ["финал", 0.20], ["финал", 0.26], ["финал", 0.34]
];

mkdirSync(КУДА, { recursive: true });

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: экран.dpr, isMobile: экран.mob, hasTouch: экран.mob
});
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => console.log("вступления не дождались"));
await стр.waitForTimeout(2000);

const ряд = [];
for (const [акт, доля] of ПУТЬ) {
  await стр.evaluate(([а, д]) => window.RV_MOTION["кПунктy"](а, д), [акт, доля]);
  let было = null, тихих = 0, кругов = 0;
  while (тихих < 3 && кругов < 60) {
    const п = await стр.evaluate(() => {
      const c = window.RV_WORLD["мир"]().cam.position;
      return [c.x, c.y, c.z];
    });
    if (было) {
      const d = Math.hypot(п[0] - было[0], п[1] - было[1], п[2] - было[2]);
      тихих = d < 0.02 ? тихих + 1 : 0;
    }
    было = п; кругов++;
    await стр.waitForTimeout(250);
  }
  await стр.waitForTimeout(900);

  const з = await стр.evaluate(() => {
    const м = window.RV_WORLD["мир"]();
    const c = м.cam.position;
    let ракета = null;
    if (м && м.scene) м.scene.traverse(function (о) {
      if (ракета) return;
      if (!/ракет|корабл/i.test((о.name || "") + "")) return;
      let в = о.visible, р = о.parent;
      while (в && р) { в = р.visible; р = р.parent; }
      о.updateMatrixWorld(true);
      const п = new (о.position.constructor)();
      п.setFromMatrixPosition(о.matrixWorld);
      ракета = { имя: о.name, видна: в, y: +п.y.toFixed(2), z: +п.z.toFixed(2) };
    });
    const дело = document.querySelector('.rv-дело[data-сектор="финал:0"]');
    const rd = дело ? дело.getBoundingClientRect() : null;
    const ст = дело ? +getComputedStyle(дело).opacity : 0;
    return {
      кам: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)],
      ракета: ракета,
      кнопка: rd ? { верх: Math.round(rd.top), видно: +ст.toFixed(2) } : null
    };
  });
  await стр.screenshot({ path: `${КУДА}/${КТО}-${акт}-${доля.toFixed(2)}.png` });
  ряд.push({ акт, доля, ...з });
}

console.log(`\n${КТО} ${экран.w}x${экран.h}`);
let пред = null;
for (const з of ряд) {
  const d = пред ? Math.hypot(з.кам[0] - пред[0], з.кам[1] - пред[1], з.кам[2] - пред[2]) : 0;
  const dy = пред ? (з.кам[1] - пред[1]) : 0;
  пред = з.кам;
  const р = з.ракета;
  console.log(
    `  ${з.акт} ${з.доля.toFixed(2)}  камера ${з.кам.join(" ")}  шаг ${d.toFixed(2)} (по высоте ${dy > 0 ? "+" : ""}${dy.toFixed(2)})` +
    `  ракета ${р ? (р.видна ? "видна y" + р.y : "скрыта") : "нет"}` +
    `  кнопка ${з.кнопка ? "верх " + з.кнопка.верх + " видно " + з.кнопка.видно : "нет"}`);
}

const итог = [];
/* Рывок: шаг по высоте, заметно больший соседних. Сравниваем с медианой
   всех шагов - постоянная величина тут не годится, у актов разный ход. */
const шаги = [];
for (let i = 1; i < ряд.length; i++) шаги.push(Math.abs(ряд[i].кам[1] - ряд[i - 1].кам[1]));
const сорт = [...шаги].sort((a, b) => a - b);
const мед = сорт[Math.floor(сорт.length / 2)] || 0.01;
for (let i = 1; i < ряд.length; i++) {
  if (шаги[i - 1] > Math.max(0.6, мед * 4)) {
    итог.push(`рывок по высоте на ${ряд[i - 1].акт} ${ряд[i - 1].доля} -> ${ряд[i].акт} ${ряд[i].доля}: ` +
              `${шаги[i - 1].toFixed(2)} при медиане шага ${мед.toFixed(2)}`);
  }
}
/* Ракета обязана ПРИЕХАТЬ, а не возникнуть: её высота должна меняться
   на первых долях акта. */
const вФинале = ряд.filter((з) => з.акт === "финал" && з.ракета && з.ракета.видна);
if (вФинале.length >= 2) {
  const ys = вФинале.map((з) => з.ракета.y);
  const ход = Math.max(...ys) - Math.min(...ys);
  console.log(`\n  высота ракеты по финалу: ${ys.join(" -> ")}  ход ${ход.toFixed(2)}`);
  if (ход < 0.5) итог.push(`ракета не садится: её высота за акт меняется на ${ход.toFixed(2)}`);
}
if (итог.length) {
  console.log("\nКРАСНОЕ:");
  for (const с of итог) console.log("   " + с);
} else {
  console.log("\nзелено: перехода без рывка, ракета садится");
}
await бр.close();
process.exit(итог.length ? 1 : 0);
