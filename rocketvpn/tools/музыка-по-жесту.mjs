/* ПОЙДЁТ ЛИ МУЗЫКА ОТ НАСТОЯЩЕГО ЖЕСТА.

   ЗАЧЕМ. Владелец: «звук не включается; как только я прикоснулся к
   экрану, сделал свайп, скролл, касание, клик - что угодно, звук
   должен сразу включаться, музыка на фоне».

   Проверка звука включает его вызовом из `page.evaluate`, то есть МИМО
   жеста. Звуковой контекст от такого вызова поднимается, а элемент
   `audio` - не всегда: у него своя политика автоигры. Поэтому она
   докладывает «музыка не играет» и на здоровом сайте, и на больном
   одинаково.

   Здесь жест настоящий: щелчок мыши по холсту и колесо. После него
   спрашиваем ровно то, что слышит человек: состояние контекста,
   громкость шины, играет ли дорожка и где её головка.

   Запуск: node tools/музыка-по-жесту.mjs [клик|колесо|касание] */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const ЖЕСТ = process.argv[2] || "клик";

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  /* Снимаем поблажку Playwright: он по умолчанию разрешает автоигру
     без жеста, и тогда проверка не отличит рабочую ловушку от
     сломанной. Нам нужна политика настоящего браузера. */
  ignoreDefaultArgs: ["--autoplay-policy=no-user-gesture-required"]
});
const стр = await бр.newPage({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
  isMobile: true, hasTouch: true
});
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => {});
await стр.waitForTimeout(1500);

async function снимок(метка) {
  const с = await стр.evaluate(() => {
    const з = window.RV_SOUND && window.RV_SOUND["замер"] ? window.RV_SOUND["замер"]() : null;
    return з || { нет: true };
  });
  console.log(метка.padEnd(16), JSON.stringify({
    состояние: с["состояние"], шина: с["шина"],
    музыка: с["музыка"]
  }));
  return с;
}

await снимок("до жеста");

if (ЖЕСТ === "колесо") await стр.mouse.wheel(0, 600);
else if (ЖЕСТ === "касание") await стр.touchscreen.tap(195, 500);
else await стр.mouse.click(195, 500);

/* Дорожка почти в пять мегабайт: она идёт потоком, и первые её кадры
   приходят не мгновенно. Ждём до десяти секунд и смотрим, тронулась ли
   головка - именно это значит «играет», а не флаг. */
let играет = false;
for (let i = 0; i < 20; i++) {
  await стр.waitForTimeout(500);
  const с = await стр.evaluate(() => {
    const з = window.RV_SOUND && window.RV_SOUND["замер"] ? window.RV_SOUND["замер"]() : null;
    return з && з["музыка"] ? з["музыка"] : null;
  });
  if (с && с["играет"] && с["позиция"] > 0) { играет = true; break; }
}

const итог = await снимок("после " + ЖЕСТ);
console.log(играет && итог["состояние"] === "running"
  ? "ЧИСТО  музыка пошла от жеста «" + ЖЕСТ + "»"
  : "ГРЯЗНО музыка не пошла от жеста «" + ЖЕСТ + "»");
await бр.close();
process.exit(играет ? 0 : 1);
