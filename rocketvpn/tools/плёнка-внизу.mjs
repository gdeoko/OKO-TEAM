/* ЭТО СМАЗ ПЛЁНКИ ИЛИ СЦЕНА? Один чистый тест на одной фазе.

   ── ЧТО ПРИВЕЛО СЮДА ──────────────────────────────────────────────
   Полоса низа кадра финала (средняя яркость последних трёх процентов)
   при приходе прокруткой идёт 9 -> 78 -> 9 за несколько секунд, у
   соседа там ровные 7.7 без колебаний. Вспышка есть и при прыжке, и
   при честной прокрутке, значит её видит человек.

   Шесть мерок ответили мимо, и каждая по своей причине:

     габарит пульта    рама сходится до четвёртого знака, он ни при чём
     свет рубки        перепись честная, гашение полосу не изменило
     пол зала          погашен, полоса не дрогнула
     лампа зала        погашена, размах остался 70
     перебор гашением  дал минус 68 от ПУСТОЙ группы, то есть врал
     A/B по свету      восстановление брало силы ДО пика, и каждое
                       следующее состояние шло по всё более тёмной
                       сцене: «что угодно уберу - становится ярче»

   Луч сквозь яркие пиксели назвал поверхность: обшивка рубки изнутри в
   трёх четвертях метра от глаза. Поверхность законная, значит её
   пересвечивает не предмет, а КАДР.

   Остаётся плёнка. В ней есть смаз по скорости: росчерки тянутся к
   точке схода, и кромки кадра красятся сильнее середины (rv-real.js,
   «События плёнки»). Скорость берётся у мира и гаснет своей
   постоянной, поэтому после прихода она держится секунды и спадает -
   ровно та кривая, которую мы видим. У соседа такой плёнки нет вовсе,
   поэтому у него ровно.

   ── КАК ПРОВЕРЯЕМ ─────────────────────────────────────────────────
   Одно измерение на пике, потом ЗАСТАВЛЯЕМ мир отдавать плёнке нулевую
   скорость и меряем снова, не двигая ничего больше. Сцена при этом не
   тронута ни одним телом и ни одной лампой: если полоса упадёт, дело в
   плёнке и больше нигде.

   Возврата не делаем вовсе: страница после теста не нужна, а любое
   восстановление это шанс испортить фазу - на нём и сломался
   предыдущий A/B.

   Запуск: node tools/плёнка-внизу.mjs [пк|тел] */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

function полоса(файл, h) {
  const y0 = Math.round(h * 0.97);
  return +execFileSync("python3", ["-c", `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("L")
w, h = im.size
d = list(im.crop((0, ${y0}, w, h)).getdata())
print(round(sum(d) / len(d), 1))
`, файл], { encoding: "utf8" }).trim();
}

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: экран, deviceScaleFactor: 1,
  isMobile: КТО === "тел", hasTouch: КТО === "тел"
});
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 140)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(3500);

const место = await стр.evaluate(() => {
  const к = window.RV_WORLD["кривая"] ? window.RV_WORLD["кривая"]() : null;
  if (!к || !к["станции"]) return null;
  const ф = к["станции"].filter((с) => с["имя"] === "финал")[0];
  return ф ? Math.round(ф["верх"] + ф["ход"] * 0.99) : null;
});
for (let i = 1; i <= 90; i++) {
  await стр.evaluate((y) => window.scrollTo(0, y), Math.round((место || 10000) * (i / 90)));
  await стр.evaluate(() => new Promise((г) => {
    let k = 0; (function ш() { requestAnimationFrame(() => (++k >= 2 ? г() : ш())); })();
  }));
}
await стр.evaluate(() => new Promise((г) => {
  let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 60 ? г() : ш())); })();
}));
await стр.waitForTimeout(2000);

async function кадры(н) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), н);
}

/* Что мир отдаёт плёнке прямо сейчас: это и есть скорость смаза. */
const скоростьНаПике = await стр.evaluate(() => {
  try {
    const с = window.RV_WORLD["скорость"] ? window.RV_WORLD["скорость"]() : null;
    if (typeof с === "number") return с;
    if (с && typeof с["норм"] === "number") return с["норм"];
    if (с && typeof с["доля"] === "number") return с["доля"];
    return null;
  } catch (e) { return null; }
});

await кадры(24);
await стр.screenshot({ path: "/tmp/плёнка-как-есть.png" });
const какЕсть = полоса("/tmp/плёнка-как-есть.png", экран.height);

/* Ноль скорости плёнке. Сцену не трогаем ни одним телом. */
await стр.evaluate(() => {
  const прежняя = window.RV_WORLD["скорость"];
  window.__прежняяСкорость = прежняя;
  window.RV_WORLD["скорость"] = function () { return 0; };
});
await кадры(14);
await стр.screenshot({ path: "/tmp/плёнка-без-смаза.png" });
const безСмаза = полоса("/tmp/плёнка-без-смаза.png", экран.height);
await бр.close();

console.log(`ПЛЁНКА ВНИЗУ ${КТО} ${экран.width}x${экран.height}, финал доля 0.99, приход прокруткой`);
console.log(`  скорость, которую мир отдавал плёнке на пике: ${скоростьНаПике}`);
console.log(`  полоса как есть        ${какЕсть}`);
console.log(`  полоса при нулевой скорости плёнки  ${безСмаза}`);
console.log(`  цель около 7.7, как у соседа`);
if (какЕсть - безСмаза > 15) {
  console.log("ОТВЕТ  полосу рисует смаз плёнки по скорости:");
  console.log("  скорость держится после прихода и красит кромку кадра,");
  console.log("  сцена тут не участвует ни телом, ни лампой.");
} else {
  console.log("ОТВЕТ  смаз плёнки полосу не объясняет:");
  console.log("  остаётся тональная кривая, свечение с нулевым порогом");
  console.log("  (rv-ореол.js) или порядок отрисовки.");
}
