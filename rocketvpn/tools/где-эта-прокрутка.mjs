/* ГДЕ ЭТА ПРОКРУТКА. Проверки печатают беду в пикселях страницы
   («на y=20608»), а править надо акт и долю. Этот инструмент переводит
   одно в другое и заодно показывает позу камеры в этой точке.

   Запуск: node tools/где-эта-прокрутка.mjs <y> [пк|тел] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const Y = +(process.argv[2] || 20608);
const КТО = process.argv[3] || "пк";
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

const свод = await стр.evaluate((y) => {
  const из = { высота: document.documentElement.scrollHeight, окно: innerHeight, акты: [] };
  const секции = document.querySelectorAll("[data-акт]");
  for (const с of секции) {
    const к = с.getBoundingClientRect();
    const верх = к.top + scrollY, низ = верх + к.height;
    из.акты.push({
      имя: с.getAttribute("data-акт"),
      верх: Math.round(верх), низ: Math.round(низ),
      /* Доля внутри акта считается так же, как её считает ядро: путь
         от верха секции до её низа минус окно. */
      доля: +((y - верх) / Math.max(1, к.height - innerHeight)).toFixed(3)
    });
  }
  try {
    const п = window.RV_WORLD["проба"] ? window.RV_WORLD["проба"](y) : null;
    if (п) {
      из.камера = п["камера"];
      из.взгляд = п["взгляд"];
      из.доВзгляда = п["доВзгляда"];
      из.поле = п["поле"];
    }
  } catch (e) { из.проба = "нет: " + e.message.slice(0, 80); }
  return из;
}, Y);

console.log(`y=${Y} из ${свод.высота} (окно ${свод.окно})`);
for (const а of свод.акты) {
  const тут = Y >= а.верх && Y <= а.низ ? " <<< ЗДЕСЬ" : "";
  console.log(`  ${а.имя}: ${а.верх}..${а.низ}, доля ${а.доля}${тут}`);
}
if (свод.камера) {
  console.log(`  камера ${JSON.stringify(свод.камера)} взгляд ${JSON.stringify(свод.взгляд)} ` +
              `до ${свод.доВзгляда} поле ${свод.поле}`);
} else {
  console.log("  " + (свод.проба || "пробы нет"));
}
await бр.close();
