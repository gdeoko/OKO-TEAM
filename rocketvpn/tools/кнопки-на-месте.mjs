/* ГДЕ СТОИТ КНОПКА НА КАЖДОМ ШАГЕ ПРОКРУТКИ.

   Владелец: «НИ ОДНА КНОПКА на сайте не уходит наверх, она на своём
   месте с анимацией глитча появляется и так же исчезает, а у тебя они
   по всему экрану наверх лезут».

   Инструмент крутит колесо и на каждом шаге записывает верх каждой
   видимой кнопки в точках экрана. Судит кадр, а не разметка.

   Запуск: node tools/кнопки-на-месте.mjs [пк|тел] [шагов] [за шаг] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "тел";
const ШАГОВ = +(process.argv[3] || 26);
const ЗА_ШАГ = +(process.argv[4] || 700);
const ЭКР = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({
  viewport: ЭКР, isMobile: КТО === "тел", hasTouch: КТО === "тел", deviceScaleFactor: 1
});
await стр.goto(АДРЕС + "/", { waitUntil: "load", timeout: 120000 });
await стр.waitForFunction(() => window.RV_MOTION && window.RV_MOTION["кПунктy"], null, { timeout: 90000 });

/* Кнопка это то, по чему человек кликает: ссылка-кнопка и button. */
const снять = () => стр.evaluate(() => {
  const из = [];
  /* Ключ это САМ элемент, а не его надпись: «Забрать три дня без карты»
     стоит в трёх разных актах, и группировка по тексту смешивала три
     кнопки в одну с выдуманным размахом в 650 точек. */
  const все = document.querySelectorAll(".rv-акт .rv-кн, .rv-акт button.rv-кн");
  все.forEach((э, н) => {
    const r = э.getBoundingClientRect();
    const s = getComputedStyle(э);
    if (r.width < 40 || r.height < 18) return;
    /* НЕПРОЗРАЧНОСТЬ СЧИТАЕТСЯ ПО ВСЕЙ ЦЕПОЧКЕ РОДИТЕЛЕЙ.
       У самой кнопки она всегда единица: гаснет слой над ней. Первый
       заход читал только её собственную и потому считал видимыми
       кнопки, которых на экране уже нет. */
    let непр = 1;
    for (let у = э; у && у !== document.documentElement; у = у.parentElement) {
      const ст = getComputedStyle(у);
      if (ст.visibility === "hidden" || ст.display === "none") { непр = 0; break; }
      непр *= +ст.opacity;
    }
    if (непр < 0.05) return;
    if (r.bottom < 0 || r.top > innerHeight) return;
    const акт = (э.closest("[data-акт]") || {}).getAttribute
      ? э.closest("[data-акт]").getAttribute("data-акт") : "?";
    из.push({ т: акт + "#" + н + " " + (э.textContent || "").trim().slice(0, 16),
              верх: Math.round(r.top), непр: +непр.toFixed(2) });
  });
  const ст = document.querySelector('[data-акт="станция"]');
  return { y: Math.round(scrollY), кнопки: из,
           уход: ст ? ст.style.getPropertyValue("--уход") : "",
           д: ст ? ст.style.getPropertyValue("--д") : "",
           дс: ст ? ст.style.getPropertyValue("--дс") : "" };
});

console.log(`${КТО}: экран ${ЭКР.width}x${ЭКР.height}`);
console.log("прокрутка  кнопка                  верх   непрозр");
const путь = new Map();
for (let i = 0; i <= ШАГОВ; i++) {
  if (i > 0) {
    await стр.mouse.wheel(0, ЗА_ШАГ);
    await стр.evaluate(() => new Promise((г) => requestAnimationFrame(() => requestAnimationFrame(г))));
    await стр.waitForTimeout(420);
  }
  const с = await снять();
  for (const к of с.кнопки) {
    if (!путь.has(к.т)) путь.set(к.т, []);
    путь.get(к.т).push(к.верх);
    console.log(String(с.y).padStart(9), " ", к.т.padEnd(30), String(к.верх).padStart(5),
                " непр", к.непр, " уход", с.уход, " д", с.д, " дс", с.дс);
  }
}
console.log("\nразмах хода каждой кнопки по экрану:");
for (const [т, ys] of путь) {
  const мин = Math.min(...ys), макс = Math.max(...ys);
  console.log("  " + т.padEnd(30) + " от " + String(мин).padStart(5) + " до " + String(макс).padStart(5) +
              "   размах " + String(макс - мин).padStart(5) + "   кадров " + ys.length);
}
await бр.close();
