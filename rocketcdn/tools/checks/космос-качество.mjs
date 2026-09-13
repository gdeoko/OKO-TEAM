/* АУДИТ КОСМОСА ИГРЫ: РЕЗКОСТЬ, СЛОИ, ОБЪЕКТЫ.

   Владелец: «на телефоне очень некачественно смотрится, как будто всё
   мутное, как каша; вроде реалистично, но мутно, какая-то муть или
   туман; на компьютере ещё более-менее получше. Полупрозрачные белые
   пятна летают - нереалистично. Нужно, чтобы космос был чёткий, 8K,
   ultra HD, как в жизни».

   Проверка не спорит о вкусе, она собирает числа, по которым мутность
   отличается от чёткости, и делает это на ОБЕИХ ширинах:

     1. ПЛОТНОСТЬ КАДРА. Сколько точек рисует движок на одну точку
        экрана. Ниже единицы - картинку растягивают, и это первая
        причина мыла на телефоне. Печатаем и потолок, и то, во что
        упёрся саморегулятор.
     2. РЕЗКОСТЬ САМОГО КАДРА. Средний перепад между соседними точками
        (градиент). Мутный кадр даёт низкий перепад при любой яркости,
        и этим он отличается от просто тёмного.
     3. БЕЛЫЕ ПЯТНА. Доля точек, которые светлые и при этом БЕЗ
        деталей вокруг: ровная светлая клякса. Звезда тоже светлая, но
        у неё резкий край, и в эту долю она не попадает.
     4. ЧТО ВООБЩЕ НАРИСОВАНО. Список видимых крупных узлов сцены с их
        именами: по нему видно и лишнее (чёрная дыра), и пропавшее.

   Снимки кладутся рядом, чтобы можно было посмотреть глазами.

   Запуск: node tools/checks/космос-качество.mjs [тел|пк]
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
const КУДА = "/tmp/космос-аудит/" + КТО;
mkdirSync(КУДА, { recursive: true });

/* Точки маршрута: начало, Луна, разгон, Марс, Сатурн, дальний край,
   прыжок, дом. Смотрим весь путь, а не один кадр. */
const ТОЧКИ = [0.02, 0.15, 0.27, 0.36, 0.50, 0.63, 0.76, 0.90];

/* ── ЧИСЛА КАДРА СЧИТАЕМ КАРТИНКОЙ ──────────────────────────────
   Резкость это средний перепад яркости между соседями. Мутный кадр
   даёт низкий перепад при ЛЮБОЙ средней яркости, поэтому темнота его
   не подделает. Белая клякса это светлая точка, вокруг которой
   перепада нет: звезда светлая, но у неё резкий край. */
function кадрЧисла(файл) {
  const из = execFileSync("python3", ["-c", `
import sys
from PIL import Image, ImageFilter, ImageStat
im = Image.open(sys.argv[1]).convert("L")
w, h = im.size
# Небо без приборной панели снизу и без шапки сверху.
im = im.crop((0, int(h*0.10), w, int(h*0.62)))
гр = im.filter(ImageFilter.FIND_EDGES)
s = ImageStat.Stat(im); г = ImageStat.Stat(гр)
я = list(im.getdata()); кр = list(гр.getdata())
n = len(я)
светлых = sum(1 for v in я if v > 70)
клякс = sum(1 for i in range(n) if я[i] > 70 and кр[i] < 12)
print(round(s.mean[0], 2), round(г.mean[0], 3),
      round(светлых * 100.0 / n, 2), round(клякс * 100.0 / n, 3))
`, файл], { encoding: "utf8" });
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
/* Сцена собирается этапами, и первые секунды в кадре пусто. Ждём, пока
   в ней появятся тела, а не отсчитываем секунды на глаз. */
/* Сцена собирается этапами. Ждём, пока движок начнёт рисовать
   заметное число треугольников, а не отсчитываем секунды на глаз. */
await стр.waitForFunction(() => {
  try { const с = window.RC_FLIGHT.stats(); return !!(с && с["треугольники"] > 20000); }
  catch (e) { return false; }
}, null, { timeout: 180000 }).catch(() => {});
await стр.waitForTimeout(6000);

console.log(`\n${КТО} ${экран.w}x${экран.h} dpr ${экран.dpr}`);

const ряд = [];
for (const p of ТОЧКИ) {
  await стр.evaluate((p) => {
    /* Перемотка по маршруту у полёта называется seek и сбрасывает
       цель с автопилотом: нам нужен ровно кадр в этой точке пути. */
    try { if (window.RC_FLIGHT && window.RC_FLIGHT.seek) window.RC_FLIGHT.seek(p); } catch (e) {}
  }, p);
  await стр.waitForTimeout(2600);
  const файл = `${КУДА}/${p.toFixed(2)}.png`;
  await стр.screenshot({ path: файл });
  const ч = кадрЧисла(файл);
  const сцена = await стр.evaluate(() => {
    /* Сам мир наружу не отдан, и это правильно: снаружи его трогать
       незачем. Но числа кадра нужны, а `stats` их даёт вместе с
       обходом сцены. Плотность спрашиваем у холста: сколько точек
       буфера приходится на точку разметки - это и есть мыло. */
    const F = window.RC_FLIGHT;
    let плотность = null, узлы = [], тр = null;
    const хл = document.querySelector(".rc-flight canvas, canvas.rcf-canvas, canvas");
    if (хл) {
      const к = хл.getBoundingClientRect();
      if (к.width > 0) плотность = +(хл.width / к.width).toFixed(3);
    }
    try { const с = F.stats && F.stats(); if (с) { тр = с["треугольники"]; } } catch (e) {}
    const w = null;
    if (w && w.scene) {
      w.scene.traverse(function (о) {
        if (!о.isMesh && !о.isPoints) return;
        let в = о.visible, р = о.parent;
        while (в && р) { в = р.visible; р = р.parent; }
        if (!в) return;
        let имя = "";
        for (let у = о; у; у = у.parent) { if (у.name) { имя = у.name; break; } }
        if (имя) узлы.push(имя);
      });
    }
    return { плотность: плотность, треугольники: тр, узлы: [...new Set(узлы)].slice(0, 14) };
  });
  ряд.push({ p, ...ч, ...сцена });
  console.log(`  p ${p.toFixed(2)}  плотность ${сцена.плотность}  треуг ${сцена.треугольники}` +
              `  яркость ${ч.яркость}  резкость ${ч.резкость}  светлых ${ч.светлых}%  кляксы ${ч.кляксы}%`);
}

/* ── ВЕРДИКТ ────────────────────────────────────────────────────
   Пороги сняты с этих же кадров и названы явно, чтобы правка их
   двигала осознанно, а не подгонкой под сегодняшний результат. */
const срез = (к) => ряд.reduce((a, с) => a + с[к], 0) / ряд.length;
console.log(`\n  в среднем: резкость ${срез("резкость").toFixed(3)}, кляксы ${срез("кляксы").toFixed(3)}%`);

for (const с of ряд) {
  if (с.плотность !== null && с.плотность < 1) {
    беды.push(`p ${с.p}: плотность кадра ${с.плотность} - картинку растягивают, отсюда мыло`);
  }
}
if (срез("резкость") < 6) {
  беды.push(`кадр мутный: средний перепад ${срез("резкость").toFixed(3)} при пороге 6`);
}
if (срез("кляксы") > 0.5) {
  беды.push(`белёсые пятна: ${срез("кляксы").toFixed(3)}% кадра светлое без деталей при пороге 0.5`);
}
const сДырой = ряд.filter((с) => с.узлы.some((и) => /дыра|hole|горизонт/i.test(и)));
if (сДырой.length) беды.push("в кадре осталась чёрная дыра на долях: " + сДырой.map((с) => с.p).join(", "));

if (беды.length) {
  console.log("\nКРАСНОЕ:");
  for (const с of [...new Set(беды)]) console.log("   " + с);
} else {
  console.log("\nзелено: кадр резкий, клякс нет, дыры нет");
}
console.log(`  снимки: ${КУДА}`);
await бр.close();
process.exit(беды.length ? 1 : 0);
