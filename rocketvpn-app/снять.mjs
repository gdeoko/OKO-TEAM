/* СБОРЩИК КАДРОВ ТЕМЫ

   Снимает готовый экран в нужных размерах и отдельно раскадровку
   удара молнии. Размеры берутся списком, потому что клиент смотрит
   макет на своём телефоне, а показывает его коллеге на мониторе, и
   один кадр 1080x1920 на Pro Max выглядит растянутым.

   Кадры снимаются с настоящей плотностью точек (deviceScaleFactor),
   а не увеличением готовой картинки. Разница в этом и есть весь ответ
   на «при увеличении расплывается»: здесь каждый пиксель отрисован, а
   не размножен из соседнего.

   Запуск:
     node снять.mjs                  все размеры + раскадровка
     node снять.mjs 1080x1920        один размер
*/
import { chromium } from "/home/user/OKO-TEAM/rocketvpn/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { поднятьСервер } from "./сервер.mjs";

const КОРЕНЬ = dirname(fileURLToPath(import.meta.url));
/* по http: с file:// браузер не отдаёт текстуры 3D-сцен (CORS) */
const сервер = await поднятьСервер(join(КОРЕНЬ, "планета"));
const СТРАНИЦА = сервер.адрес + "/index.html";
const КУДА = join(КОРЕНЬ, "кадры");
mkdirSync(КУДА, { recursive: true });

/* Логический размер один на все выдачи: раскладка считается от высоты
   окна, поэтому меняется только плотность и пропорция, а не вёрстка. */
const РАЗМЕРЫ = [
  { имя: "1290x2796", w: 430, h: 932, dpr: 3 },   /* iPhone 15/16 Pro Max */
  { имя: "1179x2556", w: 393, h: 852, dpr: 3 },   /* iPhone 15/16 Pro */
  { имя: "1080x1920", w: 360, h: 640, dpr: 3 },   /* Android 16:9 */
  { имя: "1440x3120", w: 360, h: 780, dpr: 4 }    /* Android плотный */
];

/* Три темы снимаются одним прогоном: клиент выбирает из них глазами,
   и показывать ему надо все три в одном письме, а не по одной. */
const ТЕМЫ = ["планета", "ракета", "океан"];

const один = process.argv[2];
const список = один ? РАЗМЕРЫ.filter((р) => р.имя === один) : РАЗМЕРЫ;
if (!список.length) { console.log("нет такого размера"); process.exit(1); }

const бр = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--force-color-profile=srgb", "--font-render-hinting=none",
         "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});

for (const р of список) {
  const стр = await бр.newPage({
    viewport: { width: р.w, height: р.h },
    deviceScaleFactor: р.dpr
  });
  await стр.goto(СТРАНИЦА, { waitUntil: "load", timeout: 60000 });

  /* Ждём метку сборщика, а не секунды: шрифты и разметка на слабой
     машине доходят дольше, и снимок по таймеру ловит полупустой лист. */
  await стр.waitForFunction(() => window.ЭКРАН_ГОТОВ && window.ЭКРАН_ГОТОВ(), null, { timeout: 30000 });
  await стр.waitForTimeout(700);

  for (const т of ТЕМЫ) {
    await стр.evaluate((и) => window.ТЕМА(и), т);
    await стр.waitForTimeout(600);
    await стр.screenshot({ path: join(КУДА, т + "-" + р.имя + ".png") });
    console.log("снято  " + т + "-" + р.имя + ".png");
  }
  await стр.evaluate(() => window.ТЕМА("планета"));
  await стр.waitForTimeout(500);

  /* Раскадровка удара только для главного размера: двенадцать кадров
     от первой искры до последней строки. */
  if (р.имя === "1290x2796") {
    /* ── РАСКАДРОВКА СНИМАЕТСЯ ПО ОСТАНОВКАМ, А НЕ НА ХОДУ ───────
       Разряд идёт 880 миллисекунд, а один снимок на тройной плотности
       с размытиями снимается дольше. Два захода подряд сняли пустой
       список, хотя живая проба в тот же момент показывала четыре
       пробитых строки. Ставим удар на заданную долю и снимаем: кадры
       выходят одинаковые от прогона к прогону. */
    const ДОЛИ = [0.06, 0.16, 0.26, 0.36, 0.46, 0.56, 0.66, 0.76, 0.86, 0.94, 1.0];
    for (const т of ТЕМЫ) {
      await стр.evaluate((и) => window.ТЕМА(и), т);
      await стр.waitForTimeout(600);
      for (let i = 0; i < ДОЛИ.length; i++) {
        const ок = await стр.evaluate((д) => window.СТОП_УДАР(д), ДОЛИ[i]);
        if (!ок) { console.log("след не поставился, тема " + т); break; }
        await стр.waitForTimeout(140);
        await стр.screenshot({ path: join(КУДА, "след-" + т + "-" + String(i).padStart(2, "0") + ".png") });
      }
      console.log("снято  раскадровка следа «" + т + "», " + ДОЛИ.length + " кадров");
    }
  }

  await стр.close();
}

await бр.close();
сервер.закрыть();
