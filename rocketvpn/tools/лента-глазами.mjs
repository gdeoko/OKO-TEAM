/* ЛЕНТА ГЛАЗАМИ ЧЕЛОВЕКА: листаем колесом подряд и снимаем каждый шаг.

   ЗАЧЕМ ЭТОТ ИНСТРУМЕНТ ПОЯВИЛСЯ. Набор из шестнадцати проверок
   отрапортовал «чисто», а владелец на том же сайте увидел кашу:
   две стены из разных материалов, дом, который появляется второй раз
   поверх готовой стены, чёрную полосу снизу, кнопки, уезжающие поверх
   сцены, глыбы льда в одной точке.

   Ни одна проверка этого не поймала, и причина у всех одна. Они
   ставят страницу на долю через `RV_MOTION.кПунктy` - то есть ПРЫГАЮТ
   на место и ждут, пока всё уляжется. Человек так не делает. Человек
   крутит колесо, и беды живут ровно в переходах: акт ещё не отпустил
   сцену, следующий уже показал свою, доля идёт поводком, а модули
   считают её каждый по-своему.

   Здесь всё наоборот: никаких прыжков. Колесо, шаг за шагом, снимок
   на каждом шаге. Что увидит человек - то и попадёт в кадр.

   Запуск:
     node tools/лента-глазами.mjs [тел|пк] [шагов] [пикселей за шаг] [куда]
     node tools/лента-глазами.mjs тел 60 400 /tmp/лента
*/
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";
import { mkdirSync } from "node:fs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "тел";
const ШАГОВ = +(process.argv[3] || 60);
const ЗА_ШАГ = +(process.argv[4] || 400);
const КУДА = process.argv[5] || "/tmp/лента";
const ТЕМА = process.env.RV_ТЕМА || "";

const экран = КТО === "пк"
  ? { w: 1440, h: 900, dpr: 1, mob: false }
  : { w: 390, h: 844, dpr: 2, mob: true };

mkdirSync(КУДА, { recursive: true });

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: экран.dpr, isMobile: экран.mob, hasTouch: экран.mob
});
const ошибки = [];
стр.on("pageerror", (e) => ошибки.push("ИСКЛ " + e.message.slice(0, 160)));
стр.on("console", (m) => { if (m.type() === "error") ошибки.push("КОНС " + m.text().slice(0, 160)); });

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
if (ТЕМА) {
  await стр.evaluate((т) => document.documentElement.setAttribute("data-тема", т), ТЕМА);
}
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => console.log("вступления не дождались"));
await стр.waitForTimeout(2500);

console.log(`лента ${КТО} ${экран.w}x${экран.h}${ТЕМА ? " тема " + ТЕМА : ""}, ` +
            `${ШАГОВ} шагов по ${ЗА_ШАГ} точек -> ${КУДА}`);
console.log("шаг   прокрутка  акты в кадре");

for (let i = 0; i <= ШАГОВ; i++) {
  if (i > 0) {
    /* Колесо, а не scrollTo: человек крутит, и весь поводок прокрутки
       со сглаживанием отрабатывает так, как отработает у него. */
    await стр.mouse.wheel(0, ЗА_ШАГ);
    /* Даём кадру нарисоваться. Ждём именно КАДР, а не миллисекунды:
       на программном отрисовщике кадр идёт полсекунды. */
    await стр.evaluate(() => new Promise((г) =>
      requestAnimationFrame(() => requestAnimationFrame(г))));
    await стр.waitForTimeout(500);
    /* ── ЖДЁМ, ПОКА ТЕКСТ ДОПРОЯВИТСЯ ────────────────────────────
       Появление строки идёт ПО ВРЕМЕНИ (rv-msdf.js), и шаг зажат
       десятой долей секунды на кадр - защита от прыжка времени, когда
       вкладка возвращается из фона. В песочнице видеокарты нет, кадр
       идёт около секунды, и те же три четверти секунды растягиваются на
       восемь-десять РЕАЛЬНЫХ. Снимок без ожидания ловит заголовок
       обрезанным на полуслове, и это беда снимка, а не сайта: на живой
       машине такого кадра не бывает.

       Спрашиваем сам модуль, кончилось ли у него появление. Потолок в
       двадцать секунд на случай, если строка так и не доедет: тогда
       снимок всё-таки будет, и на нём будет видно, что не доехало. */
    await стр.waitForFunction(
      () => !(window.RV_MSDF && window.RV_MSDF["показИдёт"] &&
              window.RV_MSDF["показИдёт"]()),
      null, { timeout: 20000 }
    ).catch(() => {});
  }
  const с = await стр.evaluate(() => {
    const х = window.RV_WORLD && window.RV_WORLD["ход"] ? window.RV_WORLD["ход"]() : null;
    return {
      y: Math.round(window.scrollY),
      акты: х && х["видны"] ? х["видны"].join("+") : "?",
      место: х ? х["место"] : null
    };
  });
  const имя = `${КУДА}/${КТО}-${String(i).padStart(3, "0")}.png`;
  await стр.screenshot({ path: имя });
  console.log(String(i).padStart(4), String(с.y).padStart(9), " ", с.акты);
}

if (ошибки.length) {
  console.log("\nошибки страницы:");
  for (const о of [...new Set(ошибки)].slice(0, 20)) console.log("   " + о);
}
await бр.close();
