/* ВЕСЬ ФИЛЬМ ОДНИМ ПРОГОНОМ: снимок на каждой доле каждого акта.

   ЗАЧЕМ. После правок по списку владельца надо посмотреть ленту целиком
   и на телефоне, и на мониторе, а не выборочно. Инструмент проходит все
   акты подряд, на каждом снимает несколько долей и складывает снимки
   так, чтобы их можно было листать по порядку.

   Он НЕ судит. Судит глаз: числа тут только в именах файлов.

   Запуск:
     node tools/весь-фильм.mjs [тел|пк] [куда] [долей на акт] [светлая]
*/
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "тел";
const КУДА = process.argv[3] || "/tmp/фильм";
const ДОЛЕЙ = +(process.argv[4] || 4);
/* ── ТЕМА ЧЕТВЁРТЫМ ДОВОДОМ, А НЕ ПЕРЕМЕННОЙ ОКРУЖЕНИЯ ──────────
   Оболочка не принимает имя переменной кириллицей: `RV_ТЕМА=светлая`
   она читает как команду с таким именем и отвечает «command not
   found». Довод в строке запуска этой беды не знает. */
const ТЕМА = process.argv[5] || "";

const экран = КТО === "пк"
  ? { w: 1440, h: 900, dpr: 1, mob: false }
  : { w: 390, h: 844, dpr: 1, mob: true };

mkdirSync(КУДА, { recursive: true });

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: экран.dpr, isMobile: экран.mob, hasTouch: экран.mob
});
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 160)));
стр.on("console", (m) => {
  if (m.type() !== "error") return;
  const т = m.text();
  if (/ERR_CERT_|ERR_PROXY_|ERR_CONNECTION_RESET/.test(т)) return;
  беды.push("КОНС " + т.slice(0, 160));
});

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
if (ТЕМА) {
  await стр.evaluate((т) => {
    document.documentElement.setAttribute("data-тема", т);
    window.dispatchEvent(new CustomEvent("rv-тема", { detail: т }));
  }, ТЕМА);
}
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => console.log("вступления не дождались"));
await стр.waitForTimeout(2000);

const акты = await стр.evaluate(() =>
  [...document.querySelectorAll(".rv-акт[data-акт]")].map((с) => с.getAttribute("data-акт")));

console.log(`фильм ${КТО} ${экран.w}x${экран.h}${ТЕМА ? " тема " + ТЕМА : ""}, ` +
            `${акты.length} актов по ${ДОЛЕЙ} долей -> ${КУДА}`);

let н = 0;
for (const акт of акты) {
  for (let i = 0; i < ДОЛЕЙ; i++) {
    const доля = ДОЛЕЙ === 1 ? 0.5 : (0.08 + (0.84 * i) / (ДОЛЕЙ - 1));
    await стр.evaluate(([и, x]) => window.RV_MOTION["кПунктy"](и, x), [акт, доля]);
    /* Ждём, пока камера встанет: сглаживание прокрутки igloo подтягивает
       её долями остатка, и на программном отрисовщике это секунды. */
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
    /* Камера встала - но строка может ещё проявляться. Показ ведёт
       rv-msdf.js, и на программном отрисовщике потолок кадра растягивает
       его на секунды: снимок ловил «Стен» вместо «Стена стоит». */
    await стр.waitForFunction(
      () => !(window.RV_MSDF && window.RV_MSDF["показИдёт"] && window.RV_MSDF["показИдёт"]()),
      null, { timeout: 30000, polling: 200 }).catch(() => {});
    await стр.waitForTimeout(700);
    const имя = `${КУДА}/${String(н).padStart(2, "0")}-${акт}-${доля.toFixed(2)}.png`;
    await стр.screenshot({ path: имя });
    console.log(`  ${акт} ${доля.toFixed(2)}  камера встала за ${кругов}`);
    н++;
  }
}

if (беды.length) {
  console.log("\nошибки страницы:");
  for (const б of [...new Set(беды)].slice(0, 20)) console.log("   " + б);
} else {
  console.log("\nошибок страницы нет");
}
await бр.close();
