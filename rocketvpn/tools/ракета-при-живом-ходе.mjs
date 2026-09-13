/* ЕСТЬ ЛИ РАКЕТА В ФИНАЛЕ, КОГДА ЛЕНТУ ЛИСТАЮТ, А НЕ ПРЫГАЮТ.

   ЗАЧЕМ. Сборщик кадров (`tools/весь-фильм.mjs`) ставит камеру прыжком:
   зовёт `RV_MOTION.кПунктy` и снимает. На финале 0.08 и 0.50 он показал
   пустое звёздное поле без корабля - и это может значить две совершенно
   разные вещи.

   Либо в ленте дыра, и человек, долиставший до финала, увидит то же
   самое. Либо корабль собирается ПО ХОДУ прокола, а прыжок этот ход
   пропускает, и тогда пусто только у сборщика.

   Отличить их можно ровно одним способом: доехать до того же места
   колесом, как доезжает палец, и посмотреть. Прыжком тут проверять
   нечего - прыжок и есть подозреваемый.

   Запуск: node tools/ракета-при-живом-ходе.mjs [тел|пк] [доля финала]
*/
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";
import { mkdirSync } from "node:fs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "тел";
const ДОЛЯ = +(process.argv[3] || 0.08);
const КУДА = "/tmp/живой-ход";
const экран = КТО === "пк"
  ? { w: 1440, h: 900, dpr: 1, mob: false }
  : { w: 390, h: 844, dpr: 1, mob: true };

mkdirSync(КУДА, { recursive: true });

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: экран.dpr, isMobile: экран.mob, hasTouch: экран.mob
});
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => console.log("вступления не дождались"));
await стр.waitForTimeout(1500);

/* Куда ехать. Считаем ТЕМ ЖЕ способом, что и плёнка, но ехать будем
   колесом: цель нужна только чтобы знать, когда остановиться. */
const цель = await стр.evaluate((доля) => {
  const с = document.querySelector('.rv-акт[data-акт="финал"]');
  const п = document.querySelector(".rv-плёнка");
  const к = с.getBoundingClientRect();
  const вы = п.clientHeight;
  const ход = Math.max(вы * 0.6, к.height - вы);
  return Math.round(п.scrollTop + к.top + ход * доля);
}, ДОЛЯ);

console.log(`${КТО} ${экран.w}x${экран.h}, финал ${ДОЛЯ}, цель ${цель}`);

await стр.mouse.move(экран.w / 2, экран.h / 2);
let круг = 0;
for (;;) {
  const где = await стр.evaluate(() => document.querySelector(".rv-плёнка").scrollTop);
  if (где >= цель - 40 || круг > 600) break;
  await стр.mouse.wheel(0, Math.min(400, цель - где));
  await стр.waitForTimeout(30);
  круг++;
}
/* Камера догоняет ленту сглаживанием, а корабль ещё и собирается. */
await стр.waitForTimeout(6000);

const итог = await стр.evaluate(() => {
  const п = document.querySelector(".rv-плёнка");
  const м = window.RV_WORLD["мир"]();
  let видимых = 0, всего = 0;
  /* Считаем узлы корабля в сцене: пустой кадр и кадр без корабля
     различаются именно здесь, а не по яркости точек. */
  m: {
    if (!м || !м.scene) break m;
    м.scene.traverse(function (о) {
      const имя = (о.name || "") + "";
      if (!/ракет|корабл|обшив|люк|салон|корпус/i.test(имя)) return;
      всего++;
      let в = о.visible, р = о.parent;
      while (в && р) { в = р.visible; р = р.parent; }
      if (в) видимых++;
    });
  }
  return { где: п.scrollTop, узлов: всего, видимых: видимых };
});
console.log(`  доехали до ${итог.где}`);
console.log(`  узлов корабля в сцене ${итог.узлов}, из них видимых ${итог.видимых}`);

const файл = `${КУДА}/${КТО}-финал-${ДОЛЯ}.png`;
await стр.screenshot({ path: файл });
console.log(`  снимок ${файл}`);
await бр.close();
