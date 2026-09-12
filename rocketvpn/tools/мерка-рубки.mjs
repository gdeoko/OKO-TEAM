/* МЕРКА РУБКИ: числа, по которым собран проём, снимок кокпита и место
   голограммы. Снимок финала на мониторе показал рубку в середине кадра
   и чёрные поля по бокам, а панель - залезающей на пульт. Глазом не
   различить, что виновато: узкий проём, обрезка снимка или коробка
   голограммы, которая считается от ЧУЖОЙ рамы.

   Запуск: node tools/мерка-рубки.mjs [пк|тел] */
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
await стр.evaluate(() => new Promise((г) => {
  let n = 0; (function ш() { requestAnimationFrame(() => (++n >= 90 ? г() : ш())); })();
}));

const св = await стр.evaluate(() => {
  const из = { окно: [innerWidth, innerHeight] };
  const сл = document.querySelector(".rc-desk");
  if (сл) {
    const с = getComputedStyle(сл);
    из.коробка = {
      x0: с.getPropertyValue("--cab-x0").trim(),
      y0: с.getPropertyValue("--cab-y0").trim(),
      w: с.getPropertyValue("--cab-win-w").trim(),
      h: с.getPropertyValue("--cab-win-h").trim(),
      классы: сл.className
    };
    const рам = сл.querySelector(".dsk-frame");
    if (рам) {
      const к = рам.getBoundingClientRect();
      из.рамкаНаЭкране = [Math.round(к.left), Math.round(к.top),
                          Math.round(к.right), Math.round(к.bottom)];
    }
  }
  try {
    const ф = window.RV_ФИНАЛ && window.RV_ФИНАЛ["замер"] ? window.RV_ФИНАЛ["замер"]() : null;
    if (ф && ф["местоУПульта"]) из.местоУПульта = ф["местоУПульта"];
  } catch (e) {}
  try {
    из.проёмРубки = window.RV_ФИНАЛ && window.RV_ФИНАЛ["окно"] ? window.RV_ФИНАЛ["окно"](true) : null;
  } catch (e) { из.проёмОшибка = e.message.slice(0, 120); }
  try {
    if (window.RC_PANEL && window.RC_PANEL.last) {
      из.рамаИгры = window.RC_PANEL.last.safe || null;
    }
  } catch (e) {}
  const W = window.RV_WORLD["мир"]();
  из.поле = +W.cam.fov.toFixed(1);
  из.отношение = +(innerWidth / innerHeight).toFixed(3);
  /* Проём рубки в мире: рёбра цилиндра на ±half от носа, от y0 до y1.
     Проецируем их камерой мира и берём ВПИСАННЫЙ прямоугольник. */
  try {
    let салон = null;
    W.scene.traverse((о) => { if (о.name === "салон" && !салон) салон = о; });
    const с = window.RC_CABIN;
    из.салонЕсть = !!салон;
    if (салон && с) {
      из.рубка = { R: с.R, eye: с.eye, winHalf: с.winHalf };
      const T = W.T, R = с.R, half = с.winHalf;
      let гр = null;
      салон.traverse((о) => { if (!гр && о.name === "корабль CDN") гр = о; });
      из.узелРубки = гр ? гр.name : "не найден";
    }
  } catch (e) { из.рубкаОшибка = e.message.slice(0, 120); }
  return из;
});

console.log(КТО + ": " + JSON.stringify(св, null, 1));
await бр.close();
