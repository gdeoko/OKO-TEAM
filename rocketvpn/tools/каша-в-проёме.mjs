/* ЧТО ИМЕННО ВИДНО СКВОЗЬ ОТКРЫТЫЙ ЛЮК. Гасим по одному и смотрим.

   ЗАЧЕМ. Владелец: «в открытых дверях видно кашу в салоне салон не тот
   что внутри. Захожу и меняется что-то». Снимок финала 0.50 это
   подтверждает: сквозь проём стоят бежевый диск, светлая сфера и
   балки, а на 0.62 всё это разом исчезает и появляется настоящая
   рубка.

   Перепись кадра (`что-в-кадре`) назвала подозреваемых: «воздух
   комнаты» точками на весь кадр, два складывающих диска «комната/Mesh»,
   «пол комнаты» на семьдесят процентов кадра и площадка чужого
   корабля. Все они принадлежат ЗАЛУ, а зал гасится признаком «в
   салоне», который финал ставит только на 0.62 - то есть спустя
   четверть акта после того, как створки разошлись.

   Перепись отвечает «кто в кадре», но не отвечает «кто виден В ПРОЁМЕ»:
   диск на семьдесят процентов кадра может лежать и мимо люка.

   ЧЕМ ЭТА ПРОБА ОТЛИЧАЕТСЯ ОТ ПРЕЖНИХ. Камера СТОИТ на одной доле, и
   сравниваются снимки, а не число во времени. На горбе полосы низа я
   уже обожглась ровно этим: там сцена менялась сама, и любое гашение
   выглядело осветлением. Здесь ничего не движется: доля задана, дыхание
   в финале выключено, между снимками меняется ровно одно тело.

   Считаем ДВЕ величины на каждое гашение: среднюю яркость прямоугольника
   проёма и долю его точек, изменившихся больше чем на пять уровней.
   Первая говорит «стало темнее», вторая - «поменялось именно там».

   Запуск: node tools/каша-в-проёме.mjs [пк|тел] [доля] */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const ДОЛЯ = +(process.argv[3] || 0.50);
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

/* Прямоугольник проёма в долях кадра. Снят с снимка финала 0.50 на
   мониторе: створки разошлись, проём стоит по середине кадра от 0.38
   до 0.75 высоты и от 0.42 до 0.58 ширины. Запас внутрь, чтобы в
   рамку не попала сама обшивка. */
const ПРОЁМ = { x0: 0.44, y0: 0.39, x1: 0.57, y1: 0.72 };

/* Кого гасим, в порядке подозрения. Ищем по имени в дереве целиком:
   у части тел имя пустое, тогда берём их по имени РОДИТЕЛЯ. */
const ПОДОЗРЕВАЕМЫЕ = [
  "пол комнаты",
  "воздух комнаты",
  "комната",            /* весь зал разом: контрольная проба */
  "чужой корабль"
];

function числа(файл) {
  return execFileSync("python3", ["-c", `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("L")
w, h = im.size
x0 = int(w * ${ПРОЁМ.x0}); x1 = int(w * ${ПРОЁМ.x1})
y0 = int(h * ${ПРОЁМ.y0}); y1 = int(h * ${ПРОЁМ.y1})
d = list(im.crop((x0, y0, x1, y1)).getdata())
print(round(sum(d) / len(d), 1), len(d))
`, файл], { encoding: "utf8" }).trim().split(/\s+/).map(Number);
}

function разница(а, б) {
  return +execFileSync("python3", ["-c", `
import sys
from PIL import Image
a = Image.open(sys.argv[1]).convert("L")
b = Image.open(sys.argv[2]).convert("L")
w, h = a.size
x0 = int(w * ${ПРОЁМ.x0}); x1 = int(w * ${ПРОЁМ.x1})
y0 = int(h * ${ПРОЁМ.y0}); y1 = int(h * ${ПРОЁМ.y1})
da = list(a.crop((x0, y0, x1, y1)).getdata())
db = list(b.crop((x0, y0, x1, y1)).getdata())
n = sum(1 for p, q in zip(da, db) if abs(p - q) > 5)
print(round(100.0 * n / len(da), 1))
`, а, б], { encoding: "utf8" }).trim();
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
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(3000);

await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  window.__погасить = function (имя, да) {
    let сколько = 0;
    W.scene.traverse(function (о) {
      if (о.name !== имя) return;
      if (о.userData["__былаВидимость"] === undefined) о.userData["__былаВидимость"] = о.visible;
      о.visible = да ? о.userData["__былаВидимость"] : false;
      сколько++;
    });
    return сколько;
  };
});

async function встать() {
  await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("финал", д), ДОЛЯ);
  await стр.waitForTimeout(3200);
}

await встать();
await стр.screenshot({ path: "/tmp/каша-как-есть.png" });
const [яркКак, точек] = числа("/tmp/каша-как-есть.png");

console.log(`КАША В ПРОЁМЕ ${КТО} ${экран.width}x${экран.height}, финал доля ${ДОЛЯ}`);
console.log(`  рамка проёма ${точек} точек, яркость как есть ${яркКак}`);

for (const имя of ПОДОЗРЕВАЕМЫЕ) {
  const сколько = await стр.evaluate((и) => window.__погасить(и, false), имя);
  if (!сколько) { console.log(`  «${имя}»: такого тела в дереве нет`); continue; }
  await стр.waitForTimeout(1200);
  const файл = `/tmp/каша-без-${имя.replace(/\s+/g, "_")}.png`;
  await стр.screenshot({ path: файл });
  const [ярк] = числа(файл);
  const дол = разница("/tmp/каша-как-есть.png", файл);
  console.log(`  без «${имя}» (тел ${сколько}): яркость ${ярк} (было ${яркКак}, разница ${(ярк - яркКак).toFixed(1)}),` +
              ` изменилось точек проёма ${дол}%   ${файл}`);
  await стр.evaluate((и) => window.__погасить(и, true), имя);
  await стр.waitForTimeout(800);
}
await бр.close();
console.log("  смотреть снимки глазами: число говорит «поменялось», а не «стало правильно»");
