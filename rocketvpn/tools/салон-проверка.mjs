/* Проверка салона: доехали ли данные кабины и не осталось ли 404.

   ЗАЧЕМ. Разметка подключала `gen/cab/meta.js`, `flat.js` и `deck.js`,
   а самих файлов в репозитории не было: три скрипта молча отдавали 404,
   и имена RC_CAB_META, RC_CAB_FLAT, RC_CAB_DECK оставались пустыми.
   Соседский код кабины и панели спрашивает их при сборке, не находит и
   собирает пульт по запасным числам. Наружу это выглядит как «салон не
   такой, как на CDN», и на глаз причину не увидеть.

   Здесь всё проверяется числами: какие запросы не доехали, какие имена
   определены, что отдаёт замер кабины.

   Запуск: node tools/салон-проверка.mjs [ПК|тел] */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "ПК";
const вьюпорт = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: вьюпорт, deviceScaleFactor: 1 });

const недоехали = [];
стр.on("response", (о) => {
  if (о.status() >= 400) недоехали.push(о.status() + " " + о.url().replace(АДРЕС, ""));
});
const исключения = [];
стр.on("pageerror", (e) => исключения.push(e.message.slice(0, 160)));

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => document.documentElement.classList.contains("рв-слова-в-сцене"),
  null, { timeout: 240000 }).catch(() => исключения.push("лента не собралась за четыре минуты"));
await стр.waitForTimeout(3000);

const имена = await стр.evaluate(() => {
  const о = {};
  for (const и of ["RC_CAB_META", "RC_CAB_FLAT", "RC_CAB_DECK", "RC_CABIN",
                   "RC_PANEL", "RC_DECK", "RC_KEYS", "RC_REAL", "RC_GEO",
                   "RC_SHIP_STYLE", "RV_САЛОН_CDN"]) {
    const v = window[и];
    о[и] = (v === undefined) ? "НЕТ"
      : (typeof v === "object" && v ? ("объект, ключей " + Object.keys(v).length) : typeof v);
  }
  return о;
});

/* Виды кабины, которые паспорт вообще знает. Пустой список значит, что
   данные не доехали или доехали пустыми. */
const виды = await стр.evaluate(() => {
  try { return Object.keys(window.RC_CAB_META || {}); } catch (e) { return ["ошибка: " + e]; }
});

await бр.close();

console.log("ИМЕНА КАБИНЫ И ПАНЕЛИ");
let пусто = 0;
for (const и of Object.keys(имена)) {
  console.log("   " + и.padEnd(14) + имена[и]);
  if (имена[и] === "НЕТ") пусто++;
}
console.log("\nвиды кабины в паспорте: " + (виды.length ? виды.join(", ") : "НИ ОДНОГО"));

console.log("\nЗАПРОСЫ, КОТОРЫЕ НЕ ДОЕХАЛИ: " + (недоехали.length || "нет"));
for (const с of недоехали.slice(0, 20)) console.log("   " + с);
if (исключения.length) {
  console.log("\nИСКЛЮЧЕНИЯ: " + исключения.length);
  for (const с of исключения.slice(0, 6)) console.log("   " + с);
}

if (пусто || недоехали.length || исключения.length) {
  console.log("\nГРЯЗНО салон: данные кабины доехали не полностью");
  process.exit(1);
}
console.log("\nЧИСТО салон: паспорт кабины на месте, потерянных запросов нет");
