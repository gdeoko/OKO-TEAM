/* Снимок любой страницы по ДОЛЕ прокрутки документа.

   Нужен для сверки с соседним сайтом: у CDN своя лента и свои акты, и
   инструменты VPN туда не годятся. Здесь ничего не знается про акты,
   только про положение прокрутки.

   Прокрутка идёт мелкими шагами, как под пальцем, а не прыжком: обе
   ленты сглаживают ход камеры, и телепорт показал бы кадр, которого
   человек никогда не увидит.

   Запуск: node tools/снимок-доли.mjs <адрес> <доля> [пк|тел] [файл] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.argv[2] || "http://127.0.0.1:8171/";
const ДОЛЯ = +(process.argv[3] || 0.92);
const КТО = process.argv[4] || "пк";
const ФАЙЛ = process.argv[5] || "/tmp/снимок.png";
const экран = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const стр = await бр.newPage({ viewport: экран, deviceScaleFactor: 1, isMobile: КТО === "тел" });
const беды = [];
стр.on("pageerror", (e) => беды.push(e.message.slice(0, 120)));

await стр.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
/* Соседний сайт поднимает свой мир несколько секунд; ждём тишины сети
   и ещё запас на сборку сцены. */
await стр.waitForLoadState("networkidle", { timeout: 180000 }).catch(() => {});
await стр.waitForTimeout(6000);

const высота = await стр.evaluate(() =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
const цель = высота * ДОЛЯ;

const ШАГОВ = 60;
for (let i = 1; i <= ШАГОВ; i++) {
  await стр.evaluate((y) => window.scrollTo(0, y), Math.round(цель * (i / ШАГОВ)));
  await стр.evaluate(() => new Promise((р) => requestAnimationFrame(() => requestAnimationFrame(р))));
}
await стр.waitForTimeout(4000);
await стр.screenshot({ path: ФАЙЛ });
await бр.close();

console.log(ФАЙЛ + "   высота ленты " + Math.round(высота) + ", доля " + ДОЛЯ);
if (беды.length) console.log("исключения: " + беды.slice(0, 3).join(" | "));
