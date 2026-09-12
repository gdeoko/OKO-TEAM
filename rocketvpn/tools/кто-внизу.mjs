/* КТО СВЕТИТ В НИЗУ КАДРА. Гасим тела по одному и смотрим, от кого
   полоса гаснет.

   ── ЗАЧЕМ ЭТО, А НЕ СОСТАВ КАДРА ──────────────────────────────────
   Три круга поисков ушли впустую, потому что я сравнивал
   характеристики того, что ЗАРАНЕЕ считал виновным: сперва габарит
   пульта, потом свет в рубке. Оба замера сделаны честно, и оба
   оказались ни при чём - рубка проецируется точка в точку с
   соседской, рама сходится до четвёртого знака, перепись света нашла
   лишнюю лампу, а гашение её ничего не изменило.

   `что-в-кадре.mjs` отвечает на вопрос «что тут есть», и он назвал пол
   зала - тот правда светил, яркость низа упала со 120 до 104.6. Но
   «что есть» не равно «кто светит»: в кадре тридцать четыре тела, у
   половины проекция считается коробкой и врёт на телах, которые
   охватывают камеру.

   Эта проба отвечает ровно на нужный вопрос и не оставляет догадкам
   места: гасит тело, меряет полосу, возвращает тело назад. Кто гасит
   полосу - тот её и рисовал. Ошибиться тут нечем.

   ── КАК МЕРИМ ─────────────────────────────────────────────────────
   Полоса та же, которой мерит `два-финала.mjs`: средняя яркость
   последних трёх процентов высоты кадра. Иначе числа не сравнить с
   теми, по которым беду и нашли (VPN 104.6 против CDN 7.1).

   Порядок перебора - от крупных к мелким по вкладу: сначала гасим
   каждое тело верхнего уровня, и только внутри виновного идём глубже.
   Гасить лист за листом по всей сцене значит четыреста прогонов.

   Запуск: node tools/кто-внизу.mjs [пк|тел] [доля] */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const ДОЛЯ = +(process.argv[3] || 0.99);
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

function низПолосы(файл, h) {
  const y0 = Math.round(h * 0.97);
  const из = execFileSync("python3", ["-c", `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("L")
w, h = im.size
d = list(im.crop((0, ${y0}, w, h)).getdata())
print(round(sum(d) / len(d), 1))
`, файл], { encoding: "utf8" }).trim();
  return +из;
}

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: экран, deviceScaleFactor: 1,
  isMobile: КТО === "тел", hasTouch: КТО === "тел"
});
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 140)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(3500);
await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("финал", д), ДОЛЯ);
await стр.evaluate(() => new Promise((г) => {
  let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 30 ? г() : ш())); })();
}));

/* Список того, что можно погасить, и переключатель по номеру. Список
   собирается ОДИН раз: сцена не меняется, пока мы её гасим, а собирать
   заново значит получить другие номера после каждого шага. */
await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  window.__гасим = { узлы: [], было: [] };
  window.__набрать = function (родитель) {
    const с = window.__гасим;
    с.узлы = []; с.было = [];
    const корень = родитель || W.scene;
    for (const о of корень.children) {
      if (!о.visible) continue;
      с.узлы.push(о);
      с.было.push(true);
    }
    return с.узлы.map((о, i) => ({
      н: i,
      имя: о.name || (о.type + " без имени"),
      вид: о.type,
      детей: (о.children || []).length
    }));
  };
  window.__гасить = function (н, да) {
    const о = window.__гасим.узлы[н];
    if (о) о.visible = !да;
  };
  window.__вглубь = function (н) {
    const о = window.__гасим.узлы[н];
    return о ? window.__набрать(о) : [];
  };
});

async function снять(файл) {
  await стр.evaluate(() => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 5 ? г() : ш())); })();
  }));
  await стр.screenshot({ path: файл });
  return низПолосы(файл, экран.height);
}

async function перебрать(имяУровня, список) {
  const какЕсть = await снять("/tmp/кто-внизу-база.png");
  console.log(`  ${имяУровня}: полоса как есть ${какЕсть}`);
  const из = [];
  for (const т of список) {
    await стр.evaluate((н) => window.__гасить(н, true), т.н);
    const п = await снять(`/tmp/кто-внизу-${т.н}.png`);
    await стр.evaluate((н) => window.__гасить(н, false), т.н);
    из.push(Object.assign({ полоса: п, ушло: +(какЕсть - п).toFixed(1) }, т));
  }
  из.sort((a, b) => b.ушло - a.ушло);
  for (const т of из) {
    console.log(`    ${String(т.ушло).padStart(7)}  погасили «${т.имя}»` +
                ` (${т.вид}, детей ${т.детей}) -> полоса ${т.полоса}`);
  }
  return { база: какЕсть, из: из };
}

console.log(`КТО СВЕТИТ ВНИЗУ ${КТО} ${экран.width}x${экран.height}, финал доля ${ДОЛЯ}`);
console.log("  полоса это средняя яркость последних трёх процентов высоты,");
console.log("  та же, которой мерит два-финала.mjs (VPN 104.6 против CDN 7.1).");

const верх = await стр.evaluate(() => window.__набрать(null));
const первый = await перебрать("верхний уровень", верх);

/* Внутрь идём только у того, кто съел больше половины полосы: иначе
   это не он, а перебор его детей скажет то же самое дважды. */
const главный = первый.из[0];
if (главный && главный.ушло > (первый.база - 10) * 0.5 && главный.детей > 0) {
  console.log(`  внутрь «${главный.имя}»: у него ${главный.детей} детей`);
  const дети = await стр.evaluate((н) => window.__вглубь(н), главный.н);
  await перебрать("внутри " + главный.имя, дети);
}

await бр.close();
