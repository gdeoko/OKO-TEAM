/* Как выглядит знак внутри глыбы сам по себе, без толщи льда.

   ЗАЧЕМ. Владелец дважды сказал «иконки внутри глыб льда вообще не
   видно». Замер кадра говорит, что знаки рисуются: в каждой глыбе
   11-15 процентов тёмных точек. Значит они тонут, и виноват либо сам
   знак (мелкий, слабого контраста), либо толща поверх него. Гасим лёд
   и смотрим: если знак ясный - дело в толще, если и без льда еле видно -
   дело в знаке.

   Запуск: node tools/знак-без-льда.mjs */
import { chromium } from "playwright";
import fs from "node:fs";

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 } });
await стр.goto((process.env.RV_URL || "http://127.0.0.1:8170") + "/",
  { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 300000 }).catch(() => console.log("вступление не кончилось"));
await стр.waitForTimeout(3000);
await стр.evaluate(() => window.RV_MOTION["кПунктy"]("периметр", 0.62));
await стр.waitForTimeout(4000);

const счёт = await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  let лёд = 0, знаков = 0;
  W.scene.traverse((о) => {
    /* Знак это ГРУППА, а не меш: первый заход отсеивал по isMesh и
       насчитал ноль знаков при том, что они есть и рисуются. Лёд меш,
       знак группа - проверяем оба вида узлов. */
    if (о.isMesh && /^лёд: /.test(о.name || "")) { о.visible = false; лёд++; }
    if (/^иконка: /.test(о.name || "")) знаков++;
  });
  return { лёд: лёд, знаков: знаков };
});
console.log("погашено льдин: " + счёт.лёд + ", знаков в сцене: " + счёт.знаков);
await стр.waitForTimeout(3000);
fs.writeFileSync("/tmp/кадры/знак-без-льда.png", await стр.screenshot());
console.log("кадр в /tmp/кадры/знак-без-льда.png");
await бр.close();
