/* СТЕНД ВСЕХ ЭКРАНОВ: каждый раздел в каждой теме и время суток.

   node снять-всё.mjs [папка] [--w=430 --h=932 --dpr=2] [--темы=планета,океан] [--поры=утро]

   Пять видов (главная, серверы, профиль, подписка, меню) на шесть фонов:
   тридцать кадров одним прогоном. По ним идёт разбор оформления и
   приёмка: смотреть надо все разделы, а не одну главную, иначе
   профиль и подписка отстают от неё на полгода.

   Видео на стенде не играет (сборка Chromium без H.264), вместо него
   стоит постер, то есть первый кадр того же клипа. Для оформления это
   честный кадр: интерфейс лежит поверх него так же, как поверх видео.
   Кроме снимков печатает то, что глазом не мерить: ошибки страницы и
   файлы, которых нет. */
import { chromium } from "/home/user/OKO-TEAM/rocketvpn/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { поднятьСервер } from "./сервер.mjs";

const КОРЕНЬ = dirname(fileURLToPath(import.meta.url));
const арг = process.argv.slice(2);
const флаги = Object.fromEntries(арг.filter(а => а.startsWith("--")).map(а => { const [к, з] = а.slice(2).split("="); return [к, з ?? true]; }));
const куда = арг.find(а => !а.startsWith("--")) || join(КОРЕНЬ, "кадры-всё");
mkdirSync(куда, { recursive: true });
const ТЕМЫ = (флаги.темы || "планета,океан,ракета").split(",");
const ПОРЫ = (флаги.поры || "утро,вечер").split(",");
const ВИДЫ = ["главная", "серверы", "профиль", "подписка", "меню"];

const сервер = await поднятьСервер(join(КОРЕНЬ, "планета"));
const бр = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--force-color-profile=srgb", "--font-render-hinting=none"] });
const беды = [];

for (const пора of ПОРЫ) {
  const ктx = await бр.newContext({ viewport: { width: Number(флаги.w || 430), height: Number(флаги.h || 932) },
    deviceScaleFactor: Number(флаги.dpr || 2) });
  const стр = await ктx.newPage();
  стр.on("pageerror", e => беды.push(пора + ": JS " + String(e).slice(0, 200)));
  стр.on("response", о => { if (о.status() >= 400) беды.push(пора + ": нет файла " + о.status() + " " + decodeURIComponent(о.url()).split("/").slice(-2).join("/")); });
  await стр.goto(сервер.адрес + "/index.html?пора=" + encodeURIComponent(пора), { waitUntil: "load" });
  await стр.waitForFunction(() => window.ЭКРАН_ГОТОВ && window.ЭКРАН_ГОТОВ(), null, { timeout: 30000 });
  /* Замер пингов уже прошёл: строки со значками и числами, как у человека
     через секунду после открытия, а не пустой список загрузки. */
  await стр.waitForTimeout(2600);

  for (const тема of ТЕМЫ) {
    await стр.evaluate(т => window.ТЕМА(т), тема);
    await стр.waitForTimeout(900);
    for (const вид of ВИДЫ) {
      if (вид === "меню") {
        await стр.evaluate(() => window.К_ЭКРАНУ("главная"));
        await стр.click("#бургер");
      } else {
        await стр.evaluate(в => window.К_ЭКРАНУ(в), вид);
      }
      await стр.waitForTimeout(700);
      /* Список снимается в том состоянии, в каком человек на него
         смотрит: после замера, со значками и числами в цветах этой
         темы и поры. Замер идёт живьём и успевает угаснуть: подвод до
         0.3 с, спуск 0.7, держит 0.14, тает 0.38. Заодно кадр
         проверяет, что след за собой ничего не оставляет. */
      if (вид === "главная" || вид === "серверы") {
        await стр.evaluate(() => window.УДАРИТЬ());
        await стр.waitForTimeout(1800);
      }
      const имя = join(куда, `${тема}-${пора}-${вид}.png`);
      await стр.screenshot({ path: имя });
      if (вид === "меню") { await стр.click("#закрыть-ящик"); await стр.waitForTimeout(400); }
    }
    console.log("снято", тема, пора);
  }
  await ктx.close();
}
await бр.close();
сервер.закрыть();
console.log(беды.length ? "БЕДЫ:\n" + [...new Set(беды)].join("\n") : "ошибок нет");
