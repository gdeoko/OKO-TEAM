/* ПРОВЕРКА: ДОКУМЕНТ НЕ ПРОКРУЧИВАЕТСЯ, А ЛЕНТА ИДЁТ.

   Владелец просил, чтобы адресная строка браузера никогда не уезжала.
   Браузер убирает её ровно тогда, когда листают КОРНЕВОЙ прокрутчик
   документа, поэтому проверять надо не саму строку (её из страницы не
   видно), а причину: документ обязан стоять на нуле, пока лента едет.

   Три вопроса подряд, и все три должны сойтись:
     1. `window.scrollY` остаётся нулём после большой прокрутки;
     2. `scrollTop` плёнки при этом вырос;
     3. камера сдвинулась, то есть фильм читает прокрутку и идёт.

   Третий пункт не для красоты. Перенести прокрутку внутрь контейнера и
   забыть один читатель `scrollY` значит получить сайт, который листается
   и стоит на первом кадре. Ровно это и ловит замер камеры.

   Запуск: node tools/строка-не-уходит.mjs [тел|пк]
*/
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "тел";
const экран = КТО === "пк"
  ? { w: 1440, h: 900, dpr: 1, mob: false }
  : { w: 390, h: 844, dpr: 1, mob: true };

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
стр.on("console", (m) => {
  if (m.type() !== "error") return;
  const т = m.text();
  if (/ERR_CERT_|ERR_PROXY_|ERR_CONNECTION_RESET/.test(т)) return;
  беды.push("КОНС " + т.slice(0, 200));
});

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => console.log("вступления не дождались"));
await стр.waitForTimeout(1500);

function камера(с) {
  return с.evaluate(() => {
    const c = window.RV_WORLD["мир"]().cam.position;
    return [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)];
  });
}

const дверь = await стр.evaluate(() => !!window.RV_СКРОЛЛ);
const было = await камера(стр);

/* Листаем так, как листает палец: колесом по плёнке, а не программным
   переходом. Программный переход прошёл бы и на сломанной подписке. */
await стр.mouse.move(экран.w / 2, экран.h / 2);
for (let i = 0; i < 40; i++) {
  await стр.mouse.wheel(0, 300);
  await стр.waitForTimeout(40);
}
await стр.waitForTimeout(2500);

const замер = await стр.evaluate(() => ({
  окно: window.scrollY || window.pageYOffset || 0,
  док: document.documentElement.scrollTop || 0,
  тело: document.body.scrollTop || 0,
  плёнка: (document.querySelector(".rv-плёнка") || {}).scrollTop || 0,
  лента: (document.querySelector(".rv-плёнка") || {}).scrollHeight || 0,
  видно: (document.querySelector(".rv-плёнка") || {}).clientHeight || 0,
  окноВы: window.innerHeight
}));
const стало = await камера(стр);
const сдвиг = Math.hypot(стало[0] - было[0], стало[1] - было[1], стало[2] - было[2]);

console.log(`\n${КТО} ${экран.w}x${экран.h}`);
console.log(`  дверь RV_СКРОЛЛ ...... ${дверь ? "есть" : "НЕТ"}`);
console.log(`  window.scrollY ....... ${замер.окно}`);
console.log(`  documentElement ...... ${замер.док}`);
console.log(`  плёнка.scrollTop ..... ${замер.плёнка}`);
console.log(`  плёнка видно/лента ... ${замер.видно} / ${замер.лента}  (окно ${замер.окноВы})`);
console.log(`  камера сдвинулась на . ${сдвиг.toFixed(2)}`);

const итог = [];
if (!дверь) итог.push("двери RV_СКРОЛЛ нет: прокрутку никто не читает");
if (замер.окно > 0 || замер.док > 0 || замер.тело > 0)
  итог.push(`документ прокрутился (${замер.окно}/${замер.док}/${замер.тело}) - адресная строка уедет`);
if (замер.плёнка < 1000) итог.push(`плёнка почти не проехала: ${замер.плёнка}`);
if (Math.abs(замер.видно - замер.окноВы) > 2)
  итог.push(`видимая часть плёнки ${замер.видно} не равна окну ${замер.окноВы}`);
if (сдвиг < 0.5) итог.push(`камера стоит (сдвиг ${сдвиг.toFixed(2)}): фильм не читает ленту`);
if (беды.length) итог.push("ошибки страницы: " + [...new Set(беды)].slice(0, 6).join(" | "));

if (итог.length) {
  console.log("\nКРАСНОЕ:");
  for (const с of итог) console.log("   " + с);
} else {
  console.log("\nзелено: документ стоит, лента идёт, камера едет");
}
await бр.close();
process.exit(итог.length ? 1 : 0);
