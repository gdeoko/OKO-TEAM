/* ПЛЁНКА ИЛИ СЛОЙ: откуда пятна в космосе игры. Снимок с телефона
   владельца и снимки стенда показывают в космосе мягкие светящиеся
   кляксы в двадцать-тридцать пикселей. Ни один слой точек такого
   размера не рисует: все стоят в пикселях, крупнее семи нет. Зато
   плёнка собирает ореол пирамидой до одной шестнадцатой кадра, и на
   поджатой плотности один тексель нижнего уровня это два десятка
   экранных точек. Проверяем не рассуждением, а кадром: та же точка
   маршрута с плёнкой и без, и отдельно на плотности единица.

   Запуск: node tools/кдн-игра-пост.mjs [тел|пк] [адрес] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "тел";
const АДРЕС = process.argv[3] || "http://127.0.0.1:8171/?rcdbg=1";
const экран = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: экран, deviceScaleFactor: 1, isMobile: КТО === "тел", hasTouch: КТО === "тел"
});
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 200)));
await стр.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RC_GL && window.RC_GL.ready3d, null, { timeout: 300000 });
await стр.waitForTimeout(2000);
async function кадры(n) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), n);
}
await стр.evaluate(() => window.RC_FLIGHT.open());
await стр.waitForFunction(() => document.querySelector(".rcf-brief button[data-mode=auto]"), null, { timeout: 60000 });
await кадры(20);
await стр.evaluate(() => document.querySelector(".rcf-brief button[data-mode=auto]").click());
await кадры(20);

async function холст() {
  return await стр.evaluate(() => {
    const c = document.querySelector(".rcf-cv");
    const r = window.RC_FLIGHT._cam();
    return { w: c.width, h: c.height, пост: window.RC_FLIGHT._пост() };
  });
}
for (const т of [0.1, 0.22]) {
  await стр.evaluate((v) => window.RC_FLIGHT._set(v), т);
  await кадры(60);
  await стр.screenshot({ path: `/tmp/пост-${КТО}-${т}-с-плёнкой.png` });
  console.log(`${т} с плёнкой: ` + JSON.stringify(await холст()));
  await стр.evaluate(() => window.RC_FLIGHT._пост(false));
  await кадры(20);
  await стр.screenshot({ path: `/tmp/пост-${КТО}-${т}-без-плёнки.png` });
  console.log(`${т} без плёнки: ` + JSON.stringify(await холст()));
  await стр.evaluate(() => window.RC_FLIGHT._пост(true));
  await кадры(5);
}
await бр.close();
