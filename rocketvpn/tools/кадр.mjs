/* ОДИН КАДР ПО АДРЕСУ «АКТ + ДОЛЯ». Самый дешёвый способ посмотреть
   на конкретное место ленты, не снимая её целиком.

   Полный прогон на шесть актов идёт в облаке десятки минут, и когда
   правишь одно место, ждать все шесть незачем.

   Запуск: node tools/кадр.mjs <акт> <доля> [пк|тел] [тёмная|светлая] [файл] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const АКТ = process.argv[2] || "финал";
const ДОЛЯ = +(process.argv[3] || 0.92);
const КТО = process.argv[4] || "пк";
const ТЕМА = process.argv[5] || "тёмная";
const ФАЙЛ = process.argv[6] || `/tmp/кадр-${АКТ}-${ДОЛЯ}.png`;
const экран = КТО === "пк" ? { w: 1440, h: 900, моб: false } : { w: 390, h: 844, моб: true };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: 1, isMobile: экран.моб, hasTouch: экран.моб
});
await кон.addInitScript((т) => {
  try { localStorage.setItem("rv-тема", т); } catch (e) {}
}, ТЕМА);
const стр = await кон.newPage();
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 200)));

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(
  () => window.RV_MOTION && window.RV_MOTION["кПунктy"] &&
        document.documentElement.classList.contains("рв-слова-в-сцене"),
  null, { timeout: 300000 }).catch(() => console.log("переезда слов не дождались"));
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => {});
await стр.waitForTimeout(2000);

await стр.evaluate(([а, д]) => {
  if (window.RV_MOTION && window.RV_MOTION["кПунктy"]) window.RV_MOTION["кПунктy"](а, д);
}, [АКТ, ДОЛЯ]);
/* Девяносто кадров: строки проявляются двумя скоростями, и на
   программном отрисовщике тридцати не хватает. */
await стр.evaluate(() => new Promise((г) => {
  let n = 0; (function ш() { requestAnimationFrame(() => (++n >= 90 ? г() : ш())); })();
}));
await стр.waitForTimeout(500);
await стр.screenshot({ path: ФАЙЛ });
console.log(ФАЙЛ);

/* Заодно спрашиваем мир, не сорвалась ли у него работа молча. */
const срывы = await стр.evaluate(() => {
  try { return window.RV_WORLD["срывы"] ? window.RV_WORLD["срывы"]() : null; } catch (e) { return null; }
});
if (срывы) console.log("срывы:", JSON.stringify(срывы));
if (беды.length) { console.log("БЕДЫ:"); for (const б of [...new Set(беды)].slice(0, 5)) console.log("  " + б); }
await бр.close();
