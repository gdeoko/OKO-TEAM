/* КТО ИМЕННО ДЕЛАЕТ КАШУ В КАДРЕ КОСМОСА.

   Владелец: «полупрозрачные белые пятна летают, нереалистично, из-за
   этого как каша смотрится; на телефоне очень некачественно, мутно».

   Прошлая проверка мерила кадр целиком и краснела всегда, потому что
   мерила не то: брифинг «ГОТОВ К СТАРТУ» не был закрыт, и в полосу
   замера попадали пульт, табло и панель с кнопками. Ровная светлая
   плашка это по любым числам «светлое без деталей», то есть клякса.

   Здесь иначе. Брифинг закрывается, полёт идёт, замер берётся ТОЛЬКО
   с окна кабины (там, где видно небо), и каждый слой неба гасится по
   очереди: панорама, живые звёзды, туманности, галактический объём,
   пыль у стекла. Доля пятен без слоя против доли со слоем и называет
   виновника числом, а не на глаз.

   Запуск: node tools/checks/кто-мутит.mjs [тел|пк]
*/
const { chromium } = await import(process.env.RC_PW ||
  await Promise.any([
    import("/tmp/node_modules/playwright/index.mjs").then(() => "/tmp/node_modules/playwright/index.mjs"),
    import("/tmp/node_modules/playwright-core/index.mjs").then(() => "/tmp/node_modules/playwright-core/index.mjs")
  ]));
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const { БРАУЗЕР } = await import("../../../rocketvpn/tools/браузер.mjs");

const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123";
const КТО = process.argv[2] || "тел";
const экран = КТО === "пк"
  ? { w: 1440, h: 900, dpr: 2, mob: false }
  : { w: 390, h: 844, dpr: 3, mob: true };
const КУДА = "/tmp/кто-мутит/" + КТО;
mkdirSync(КУДА, { recursive: true });

const СЛОИ = ["панорама", "звёзды", "туманности", "объём", "пыль", "млечный", "подложки", "свечение"];

/* ── ЧИСЛА КАДРА ────────────────────────────────────────────────
   Клякса это светлая точка, вокруг которой перепада нет. Звезда тоже
   светлая, но у неё резкий край, и в кляксы она не попадает. Резкость
   это средний перепад: мутный кадр даёт низкий перепад при любой
   яркости, поэтому темнота его не подделает. */
function числа(файл, окно) {
  const из = execFileSync("python3", ["-c", `
import sys
from PIL import Image, ImageFilter, ImageStat
im = Image.open(sys.argv[1]).convert("L")
w, h = im.size
x0, y0, x1, y1 = [float(v) for v in sys.argv[2].split(",")]
im = im.crop((int(w*x0), int(h*y0), int(w*x1), int(h*y1)))
гр = im.filter(ImageFilter.FIND_EDGES)
s = ImageStat.Stat(im); г = ImageStat.Stat(гр)
я = im.tobytes(); кр = гр.tobytes()
n = len(я)
клякс = sum(1 for i in range(n) if я[i] > 70 and кр[i] < 12)
светлых = sum(1 for v in я if v > 70)
print(round(s.mean[0], 2), round(г.mean[0], 3),
      round(светлых * 100.0 / n, 3), round(клякс * 100.0 / n, 3))
`, файл, окно.join(",")], { encoding: "utf8" });
  const [яркость, резкость, светлых, кляксы] = из.trim().split(/\s+/).map(Number);
  return { яркость, резкость, светлых, кляксы };
}

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: экран.dpr, isMobile: экран.mob, hasTouch: экран.mob
});
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 160)));

await стр.goto(АДРЕС + "/?flight=1", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(() => window.RC_FLIGHT && window.RC_FLIGHT.open, null, { timeout: 120000 })
  .catch(() => беды.push("полёт не поднялся"));
await стр.waitForTimeout(1500);
await стр.evaluate(() => { try { window.RC_FLIGHT.open(); } catch (e) {} });
await стр.waitForFunction(() => {
  try { const с = window.RC_FLIGHT.stats(); return !!(с && с["треугольники"] > 2000); }
  catch (e) { return false; }
}, null, { timeout: 180000 }).catch(() => беды.push("сцена не собралась"));

/* Брифинг держит кадр и закрывает половину окна. Пока он открыт,
   меряется вёрстка, а не космос. */
await стр.evaluate(() => {
  const б = document.querySelector('.rcf-brief [data-mode="manual"]');
  if (б) б.click();
});
/* Кадр ставится намертво. Автопилот везёт корабль дальше, и снимки
   «со слоем» и «без слоя» оказывались сняты из РАЗНЫХ точек: разница
   между ними тогда говорит про место, а не про слой. `seek` заодно
   снимает автопилот, поэтому корабль стоит там, куда его поставили. */
const ТОЧКА = +(process.env.RC_P || 0.12);
await стр.evaluate((p) => { try { window.RC_FLIGHT.seek(p); } catch (e) {} }, ТОЧКА);
await стр.waitForTimeout(4000);

/* ── ГДЕ ИМЕННО СМОТРИМ ──────────────────────────────────────────
   Окно кабины спрашиваем у самой страницы: рамка пульта нарисована
   разметкой, и её место на телефоне и на мониторе разное. Берём
   середину окна с запасом от краёв, чтобы в полосу не попали ни
   рама, ни табло. */
const окно = await стр.evaluate(() => {
  const хл = document.querySelector(".rcf-wrap canvas, canvas");
  if (!хл) return [0.12, 0.18, 0.88, 0.50];
  const к = хл.getBoundingClientRect();
  const W = window.innerWidth, H = window.innerHeight;
  return [
    (к.left + к.width * 0.12) / W, (к.top + к.height * 0.16) / H,
    (к.left + к.width * 0.88) / W, (к.top + к.height * 0.46) / H
  ];
});
console.log(`\n${КТО} ${экран.w}x${экран.h} dpr ${экран.dpr}`);
console.log(`  окно замера ${окно.map((ч) => ч.toFixed(3)).join(" ")}`);

const слоиЕсть = await стр.evaluate(() => window.RC_FLIGHT["слой"]("?", true));
if (!Array.isArray(слоиЕсть)) беды.push("замерного ключа «слой» в сборке нет");

async function снять(метка) {
  const файл = `${КУДА}/${метка}.png`;
  await стр.screenshot({ path: файл });
  return { файл, ...числа(файл, окно) };
}

const всё = await снять("всё");
console.log(`  всё на месте        яркость ${всё.яркость}  резкость ${всё.резкость}` +
            `  светлых ${всё.светлых}%  кляксы ${всё.кляксы}%`);

const вклад = [];
for (const имя of СЛОИ) {
  await стр.evaluate((и) => window.RC_FLIGHT["слой"](и, false), имя);
  await стр.waitForTimeout(900);
  const б = await снять("без-" + имя);
  await стр.evaluate((и) => window.RC_FLIGHT["слой"](и, true), имя);
  await стр.waitForTimeout(500);
  const дк = +(всё.кляксы - б.кляксы).toFixed(3);
  const др = +(б.резкость - всё.резкость).toFixed(3);
  вклад.push({ имя, дк, др, кляксы: б.кляксы, резкость: б.резкость });
  console.log(`  без «${имя}»`.padEnd(22) +
              `кляксы ${String(б.кляксы).padStart(7)} (снял ${дк >= 0 ? "+" : ""}${дк})` +
              `  резкость ${String(б.резкость).padStart(7)} (${др >= 0 ? "+" : ""}${др})`);
}

вклад.sort((a, b) => b.дк - a.дк);
console.log("\n  главные виновники пятен: " +
            вклад.slice(0, 3).map((в) => `${в.имя} ${в.дк}`).join(", "));

if (всё.кляксы > 1.2) {
  беды.push(`пятен ${всё.кляксы}% кадра при пороге 1.2, больше всех даёт «${вклад[0].имя}» (${вклад[0].дк})`);
}
if (всё.резкость < 8) {
  беды.push(`кадр мутный: перепад ${всё.резкость} при пороге 8`);
}

if (беды.length) {
  console.log("\nКРАСНОЕ:");
  for (const с of [...new Set(беды)]) console.log("   " + с);
} else {
  console.log("\nзелено: кадр резкий, белёсых пятен нет");
}
console.log(`  снимки: ${КУДА}`);
await бр.close();
process.exit(беды.length ? 1 : 0);
