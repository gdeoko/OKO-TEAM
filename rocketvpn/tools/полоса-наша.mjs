/* Полоса яркости НАШЕЙ ленты, теми же мерками, что у igloo.

   ЗАЧЕМ. `полоса-игло.mjs` считает, какие числа их фильм держит от
   начала до конца. Этот считает то же по нашему и печатает обе полосы
   рядом. Сравнивать по одному кадру бессмысленно: у любого фильма есть
   тёмные места и светлые, и попасть в чужое среднее можно случайно.

   Кадры берутся РАВНОМЕРНО ПО ПРОКРУТКЕ, а не по актам: у соседей
   плёнка снята так же, и только тогда сравнение честное.

   Запуск: node tools/полоса-наша.mjs [сколько кадров] [ширина x высота] */
import { chromium } from "playwright";
import { PNG } from "pngjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const СКОЛЬКО = +(process.argv[2] || 40);
const [Ш, В] = (process.argv[3] || "1440x900").split("x").map(Number);

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: Ш, height: В }, deviceScaleFactor: 1 });
стр.on("pageerror", (e) => console.log("ИСКЛ", e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => console.log("вступления не дождались"));
await стр.waitForTimeout(1500);

const лента = await стр.evaluate(() =>
  (document.documentElement.scrollHeight || 0) - (window.innerHeight || 0));

function мерка(буфер) {
  const п = PNG.sync.read(буфер);
  const д = п.data;
  let сумма = 0, чёрн = 0, ярк = 0, всего = 0, разм = 0;
  /* Шапку не считаем, как и у них: она чёрная у всех и к фильму
     отношения не имеет. */
  const с0 = Math.round(п.height * 0.08) * п.width * 4;
  for (let i = с0; i < д.length; i += 4) {
    const r = д[i], g = д[i + 1], b = д[i + 2];
    const я = (r * 299 + g * 587 + b * 114) / 1000;
    сумма += я;
    if (я < 24) чёрн++;
    if (я > 230) ярк++;
    разм += Math.max(r, g, b) - Math.min(r, g, b);
    всего++;
  }
  return { ярк: сумма / всего, чёрн: чёрн / всего * 100,
           ярких: ярк / всего * 100, размах: разм / всего };
}

const строки = [];
console.log("лента", лента, "точек, кадров", СКОЛЬКО);
console.log("доля ленты   y      акт        ярк   чёрн%  ярких%  размах");
for (let i = 0; i < СКОЛЬКО; i++) {
  const доля = i / (СКОЛЬКО - 1);
  const y = Math.round(лента * доля);
  await стр.evaluate((v) => window.scrollTo(0, v), y);
  /* Ход камеры сглажен двумя подтяжками с постоянными времени 0.214 и
     0.103 секунды: раньше секунды кадр ещё едет к своему месту. */
  await стр.waitForTimeout(1100);
  const акт = await стр.evaluate(() => {
    try {
      const в = window.RV_WORLD["ход"]()["видны"];
      return (в && в.length) ? в.join("+") : "-";
    } catch (e) { return "?"; }
  });
  const м = мерка(await стр.screenshot({ type: "png" }));
  строки.push(м);
  console.log(
    доля.toFixed(3).padEnd(12), String(y).padEnd(6), акт.padEnd(10),
    м.ярк.toFixed(0).padStart(4), м.чёрн.toFixed(2).padStart(6),
    м.ярких.toFixed(2).padStart(7), м.размах.toFixed(1).padStart(7));
}

function полоса(ключ) {
  const в = строки.map((м) => м[ключ]).sort((a, b) => a - b);
  const кв = (p) => в[Math.min(в.length - 1, Math.round((в.length - 1) * p))];
  return [в[0], кв(0.1), кв(0.5), кв(0.9), в[в.length - 1]];
}
/* Полоса igloo снята инструментом полоса-игло.mjs по их же зеркалу и
   вписана сюда числами: зеркало живёт в /tmp и переживает не каждую
   сессию, а сверять надо всегда. */
const ИГЛО = {
  ярк: [131.00, 139.27, 155.14, 175.47, 184.33],
  чёрн: [0.00, 0.00, 0.00, 0.00, 0.03],
  ярких: [0.15, 0.17, 1.82, 10.99, 17.36],
  размах: [15.44, 17.54, 18.76, 22.60, 27.03]
};
console.log("\nПОЛОСЫ (мин / 10% / середина / 90% / макс)");
console.log("мерка   чья         мин      10%      сер      90%     макс");
for (const к of ["ярк", "чёрн", "ярких", "размах"]) {
  const н = полоса(к);
  console.log(к.padEnd(7), "наша ", н.map((v) => v.toFixed(2).padStart(8)).join(""));
  console.log("".padEnd(7), "игло ", ИГЛО[к].map((v) => v.toFixed(2).padStart(8)).join(""));
}
await бр.close();
