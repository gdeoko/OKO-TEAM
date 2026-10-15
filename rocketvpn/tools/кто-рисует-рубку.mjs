/* КТО РИСУЕТ РУБКУ. Гасим по одному слою и смотрим, что пропало.

   Спор идёт вокруг одного: светлая рубка в кадре это ЛИЦО ПЕРЕДНЕЙ
   СЕКЦИИ (снимок кокпита, наклеенный на стену) или ОБЪЁМНАЯ геометрия
   рубки. От ответа зависит, чем её приближать: раскладкой снимка или
   камерой. Замеры снимка и подтяжки не сдвинули кадр ни на точку, а
   догадки стоят дороже пробы.

   Проба простая: снять кадр как есть, потом погасить переднюю секцию и
   снять снова. Пропала светлая рубка - виновата секция.

   Запуск: node tools/кто-рисует-рубку.mjs [пк|тел] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "пк";
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
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
  null, { timeout: 300000 });
await стр.waitForTimeout(2500);
await стр.evaluate(() => window.RV_MOTION["кПунктy"]("финал", 0.87));

async function кадры(n) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), n);
}
await кадры(90);
await стр.screenshot({ path: `/tmp/кто-${КТО}-как-есть.png` });

/* Гасим лицо секции. Узел лежит в сборке рубки, зал держит её ссылкой. */
const снято = await стр.evaluate(() => {
  try {
    const М = window.RV_ФИНАЛ && window.RV_ФИНАЛ["замер"] ? 1 : 0;
    const W = window.RV_WORLD["мир"]();
    let нашли = 0;
    W.scene.traverse((о) => {
      /* Переднюю секцию отличаем по её сетке: это НЕЗАМКНУТЫЙ цилиндр,
         у него в параметрах есть thetaLength меньше полного круга. */
      const г = о.geometry;
      if (!г || !г.parameters || г.parameters.thetaLength === undefined) return;
      if (г.parameters.thetaLength > 6.2) return;
      if (!о.visible) return;
      о.visible = false; нашли++;
    });
    return нашли;
  } catch (e) { return "ошибка " + e.message.slice(0, 90); }
});
await кадры(30);
await стр.screenshot({ path: `/tmp/кто-${КТО}-без-секции.png` });
console.log(`${КТО}: погашено незамкнутых цилиндров ${снято}`);
console.log(`/tmp/кто-${КТО}-как-есть.png  /tmp/кто-${КТО}-без-секции.png`);
await бр.close();
