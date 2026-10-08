/* ОДИН РЕЗКИЙ БРОСОК НЕ ОБЯЗАН ПРОМАТЫВАТЬ ВЕСЬ ФИЛЬМ.

   Владелец: «я сейчас быстро пролистал вниз один раз, и у меня всё
   пропустило: от дома сразу резко всё произошло и сразу экран последний
   с панелью управления. Пролетел мигом весь сайт».

   Проверяем ровно это: делаем ОДИН короткий и очень быстрый бросок
   пальцем и смотрим, на сколько экранов уехала лента, когда всё
   успокоилось. Один жест имеет право сдвинуть ленту на экран с
   небольшим; лента длиной в двадцать четыре экрана за взмах кончаться
   не должна.

   Второй вопрос сразу здесь же: лента обязана ДВИГАТЬСЯ. Ограничитель,
   который держит ленту на месте, чинит жалобу способом хуже самой
   жалобы, и отличить одно от другого можно только числом снизу.

   Запуск: node tools/бросок-не-проматывает.mjs [тел|пк]
*/
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "тел";
const экран = КТО === "пк"
  ? { w: 1440, h: 900, dpr: 1, mob: false }
  : { w: 390, h: 844, dpr: 1, mob: true };

/* Сколько экранов имеет право проехать ОДИН жест. Верх с запасом: жест
   это длина пальца плюс довыкат, и придираться к десятым тут не к чему.
   Низ отделяет работающую ленту от заклинившей. */
const ПОТОЛОК_ЭКРАНОВ = 3.0;
const ПОЛ_ЭКРАНОВ = 0.35;

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: экран.dpr, isMobile: экран.mob, hasTouch: экран.mob
});
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 200)));

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => console.log("вступления не дождались"));
await стр.waitForTimeout(1500);

const где = () => стр.evaluate(() => (document.querySelector(".rv-плёнка") || {}).scrollTop || 0);

/* ── БРОСОК ПАЛЬЦЕМ ────────────────────────────────────────────────
   Playwright не умеет жест одним вызовом, поэтому шлём события касания
   сами. Важна СКОРОСТЬ: между точками по восемь миллисекунд, как у
   настоящего резкого взмаха. Медленный жест этой проверке ничего не
   скажет - он и на родной прокрутке не проматывал ничего. */
async function бросок(откуда, докуда, шагов) {
  await стр.evaluate(async ([x, y0, y1, n]) => {
    const цель = document.querySelector(".rv-плёнка");
    const точка = (y) => [new Touch({ identifier: 1, target: цель, clientX: x, clientY: y })];
    const пусть = (имя, y) => цель.dispatchEvent(new TouchEvent(имя, {
      bubbles: true, cancelable: true,
      touches: имя === "touchend" ? [] : точка(y),
      changedTouches: точка(y)
    }));
    пусть("touchstart", y0);
    for (let i = 1; i <= n; i++) {
      const y = y0 + ((y1 - y0) * i) / n;
      пусть("touchmove", y);
      await new Promise((r) => setTimeout(r, 8));
    }
    пусть("touchend", y1);
  }, [экран.w / 2, откуда, докуда, шагов]);
}

const было = await где();
await бросок(экран.h * 0.82, экран.h * 0.18, 8);
/* Довыкат и сглаживание камеры: ждём, пока лента перестанет двигаться. */
let стоит = 0, прежде = -1;
for (let i = 0; i < 60 && стоит < 4; i++) {
  const сейчас = await где();
  стоит = сейчас === прежде ? стоит + 1 : 0;
  прежде = сейчас;
  await стр.waitForTimeout(120);
}
const стало = await где();
const лента = await стр.evaluate(() => {
  const п = document.querySelector(".rv-плёнка");
  return { всего: п.scrollHeight, видно: п.clientHeight };
});
const экранов = (стало - было) / экран.h;
const всегоЭкранов = (лента.всего - лента.видно) / экран.h;

console.log(`\n${КТО} ${экран.w}x${экран.h}`);
console.log(`  вся лента ............ ${всегоЭкранов.toFixed(1)} экранов`);
console.log(`  один бросок увёз на .. ${экранов.toFixed(2)} экрана (${стало - было} точек)`);

const итог = [];
if (экранов > ПОТОЛОК_ЭКРАНОВ)
  итог.push(`один бросок увёз на ${экранов.toFixed(2)} экрана при потолке ${ПОТОЛОК_ЭКРАНОВ}: сцены пролетают`);
if (экранов < ПОЛ_ЭКРАНОВ)
  итог.push(`один бросок увёз всего на ${экранов.toFixed(2)} экрана: лента не листается`);
if (беды.length) итог.push("ошибки страницы: " + [...new Set(беды)].slice(0, 5).join(" | "));

if (итог.length) {
  console.log("\nКРАСНОЕ:");
  for (const с of итог) console.log("   " + с);
} else {
  console.log("\nзелено: лента идёт и одним броском не кончается");
}
await бр.close();
process.exit(итог.length ? 1 : 0);
