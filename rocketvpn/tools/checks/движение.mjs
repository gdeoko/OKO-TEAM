/* Проверка: на прокрутке в кадре всё время что-то меняется.

   ЗАЧЕМ. Владелец сказал дословно: «когда я только начинаю скроллить, я
   долго вниз иду, но ничего на экране не меняется». Это не про красоту и
   не про скорость камеры - это про мёртвые куски ленты, где человек
   крутит колесо впустую. Замер камеры такое не ловит: камера может
   честно ехать, а кадр при этом стоять (едет по пустому туману), и
   наоборот - камера стоит, а кадр живёт (собирается стена).

   КАК МЕРЯЕТСЯ. По каждому акту снимается несколько кадров подряд с
   ровным шагом доли, и считается средняя разница соседних кадров в
   точках. Ноль означает, что за этот шаг прокрутки не изменилось
   ничего. Порог намеренно низкий: шум отрисовки и зерно плёнки дают
   около единицы, поэтому мёртвым считается шаг ниже двух.

   Запуск: node tools/checks/движение.mjs [ПК|тел] */
import { chromium } from "playwright";
import fs from "node:fs";
import { PNG } from "pngjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "ПК";
const вьюпорт = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
/* Шагов на акт. Восемь это компромисс: на четырёх мёртвый кусок в
   четверть акта проскочил бы между замерами, на шестнадцати проверка
   идёт вдвое дольше без новых находок. */
const ШАГОВ = 8;
const ПОРОГ = 2.0;

const беды = [];

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-lcd-text"]
});
const стр = await бр.newPage({ viewport: вьюпорт, deviceScaleFactor: 1 });
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 140)));

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
/* Вступление считает своё время по кадрам с потолком в десятую долю
   секунды: на программном отрисовщике оно растягивается в полминуты, и
   всё это время камера подмешана к вступительной точке. */
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 180000 }).catch(() => беды.push("вступление не кончилось за три минуты"));
await стр.waitForTimeout(1500);

const акты = await стр.evaluate(() =>
  Array.from(document.querySelectorAll(".rv-акт")).map((э) => э.getAttribute("data-акт")));

function разница(a, b) {
  const A = PNG.sync.read(a).data, B = PNG.sync.read(b).data;
  let сум = 0, n = 0;
  /* Каждая четвёртая точка: разница по всему кадру и по выборке
     совпадает до сотых, а считается вчетверо быстрее. */
  for (let i = 0; i < A.length; i += 16) {
    сум += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    n += 3;
  }
  return сум / n;
}

console.log("акт".padEnd(12) + "разницы соседних кадров по доле акта");
for (const акт of акты) {
  const кадры = [];
  for (let i = 0; i < ШАГОВ; i++) {
    const доля = i / (ШАГОВ - 1);
    const встал = await стр.evaluate(([а, д]) =>
      window.RV_MOTION && window.RV_MOTION["кПунктy"] ? window.RV_MOTION["кПунктy"](а, д) : false, [акт, доля]);
    if (!встал) { беды.push(`акт ${акт}: не встал на долю ${доля}`); break; }
    await стр.waitForTimeout(1400);
    кадры.push(await стр.screenshot());
  }
  if (кадры.length < 2) continue;
  const шаги = [];
  for (let i = 1; i < кадры.length; i++) шаги.push(разница(кадры[i - 1], кадры[i]));
  console.log(акт.padEnd(12) + шаги.map((v) => v.toFixed(1).padStart(6)).join(" "));
  for (let i = 0; i < шаги.length; i++) {
    if (шаги[i] < ПОРОГ) {
      const от = (i / (ШАГОВ - 1)).toFixed(2), до = ((i + 1) / (ШАГОВ - 1)).toFixed(2);
      беды.push(`акт ${акт}: между долями ${от} и ${до} кадр почти не меняется (${шаги[i].toFixed(1)} при пороге ${ПОРОГ})`);
    }
  }
}

await бр.close();
if (беды.length) {
  console.log("ГРЯЗНО движение: есть куски ленты, где прокрутка идёт впустую");
  for (const б of беды) console.log("   " + б);
  process.exit(1);
}
console.log("ЧИСТО движение: на всей ленте кадр меняется на каждом шаге");
