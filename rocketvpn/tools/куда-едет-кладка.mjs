/* КУДА ПРИЕЗЖАЕТ КЛАДКА, ЕСЛИ ПРОКРУТКУ ОСТАНОВИТЬ.

   ЗАЧЕМ. Проверка «один камень» доказала два места из трёх: на доле
   0.97 и в следующем акте кусок кладки даёт 127/25.5/143 и 127.2/25.5/143
   - один камень, дрейф между снимками 0.4 и 0.1. А на доле 0.92 та же
   кладка даёт 133.5/22/161.2 и уезжает на 12.8 уровня за две с половиной
   секунды.

   Дрейф сам по себе не порок: блоки дома идут к своим местам сглаженным
   приближением (`лерпК`), и на живой прокрутке это и выглядит плавно.
   Вопрос в том, КУДА они приезжают. Приедут к 127 - значит подмены нет
   вовсе, есть медленная усадка, и передача стены на 0.94 проходит
   незаметно. Остановятся на 133 - значит поверх кладки лежит что-то ещё,
   и надо искать дальше.

   Ответить на это может только ряд во времени, а не два снимка: два
   снимка внутри усадки показывают саму усадку. На этом я уже обожглась
   дважды - с полосой низа кадра в финале и с перебором гашением здесь
   же.

   ЧТО ДЕЛАЕТ. Встаёт на долю, останавливает прокрутку и снимает кусок
   кладки двенадцать раз с паузой, печатая ряд. Ряд, вышедший на полку,
   и есть ответ.

   Запуск: node tools/куда-едет-кладка.mjs [пк|тел] [акт] [доля] [снимков] */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const АКТ = process.argv[3] || "станция";
const ДОЛЯ = +(process.argv[4] || 0.92);
const СНИМКОВ = +(process.argv[5] || 12);
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

const КУСОК = { x0: 0.40, y0: 0.45, x1: 0.62, y1: 0.67 };

function мерка(файл) {
  const ч = execFileSync("python3", ["-c", `
import sys
from PIL import Image, ImageStat
im = Image.open(sys.argv[1]).convert("RGB")
w, h = im.size
k = im.crop((int(w * ${КУСОК.x0}), int(h * ${КУСОК.y0}),
             int(w * ${КУСОК.x1}), int(h * ${КУСОК.y1})))
s = ImageStat.Stat(k.convert("L")); c = ImageStat.Stat(k)
print(round(s.mean[0], 1), round(s.stddev[0], 1), round(c.mean[2], 1))
`, файл], { encoding: "utf8" }).trim().split(/\s+/).map(Number);
  return { яркость: ч[0], контраст: ч[1], синий: ч[2] };
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
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(3000);

await стр.evaluate(([а, д]) => window.RV_MOTION["кПунктy"](а, д), [АКТ, ДОЛЯ]);

console.log(`КУДА ЕДЕТ КЛАДКА ${КТО} ${экран.width}x${экран.height}, ${АКТ} доля ${ДОЛЯ}`);
console.log(`  цель по проверке «один камень»: яркость 127, контраст 25.5, синий 143`);
const ряд = [];
for (let i = 0; i < СНИМКОВ; i++) {
  await стр.waitForTimeout(i === 0 ? 1500 : 1800);
  const ф = `/tmp/едет-${i}.png`;
  await стр.screenshot({ path: ф });
  const ч = мерка(ф);
  ряд.push(ч);
  const пред = i ? ряд[i - 1] : null;
  console.log(`  ${String(i).padStart(2)}  яркость ${String(ч.яркость).padEnd(6)} ` +
              `контраст ${String(ч.контраст).padEnd(5)} синий ${String(ч.синий).padEnd(6)}` +
              (пред ? `  шаг ${(ч.яркость - пред.яркость).toFixed(1)}` : ""));
}
await бр.close();

const посл = ряд[ряд.length - 1];
const шагПосл = Math.abs(посл.яркость - ряд[ряд.length - 2].яркость);
console.log(`  приехало к яркости ${посл.яркость}, контраст ${посл.контраст}, синий ${посл.синий}` +
            `  (последний шаг ${шагПосл.toFixed(1)})`);
if (шагПосл > 1.5) {
  console.log("  на полку не вышло: снимков не хватило либо сцена не устаивается вовсе");
} else if (Math.abs(посл.яркость - 127) <= 6 && Math.abs(посл.синий - 143) <= 8) {
  console.log("  ОТВЕТ  усадка приезжает к тому же камню: подмены нет, есть медленное оседание");
} else {
  console.log("  ОТВЕТ  усадка встала НЕ на том камне: поверх кладки лежит что-то ещё, искать дальше");
}
