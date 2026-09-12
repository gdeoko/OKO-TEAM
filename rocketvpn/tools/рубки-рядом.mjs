/* ДВЕ РУБКИ ОДНОЙ МЕРКОЙ. Владелец: «почему не скопировать и вставить?»

   Салон у нас УЖЕ скопирован целиком - rc-cabin.js лежит в обоих
   сайтах одним файлом. Не скопирована камера, и не могла быть: у
   соседа рубка ставится ПОД камеру полёта, у нас камеру ведёт лента
   актов, а рубка стоит в мире. Один и тот же кадр приходится получать
   с двух сторон.

   Пока сверять было нечем, наш код повторял их формулы пересказом в
   комментариях. Пересказ разошёлся на четверть метра (щит у нас стоит
   не на обшивке), и это дало три круга подгонки по снимкам.

   Здесь обе стороны отвечают ОДНИМИ И ТЕМИ ЖЕ тремя числами, и каждое
   можно поправить формулой, а не подбором:

     · высота глаза над настилом;
     · расстояние от глаза до стены с панелью;
     · наклон взгляда.

   Числа местные, в единицах салона: узел финала у нас ужат, мировые
   единицы разные, а местные те же - салон собирает их же файл.

   Запуск: node tools/рубки-рядом.mjs [пк|тел] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const ДОЛЯ = +(process.argv[3] || 0.99);
const VPN = process.env.RV_URL || "http://127.0.0.1:8170";
const CDN = process.env.RC_URL || "http://127.0.0.1:8171";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

/* Пороги. Высота и дистанция в единицах салона (обшивка радиусом
   3.05), поэтому сотая доля это сантиметр с небольшим - глазом такое
   не читается, а вдвое больше уже сдвигает пульт в кадре. Наклон в
   градусах: полградуса при поле 72 это меньше процента высоты кадра. */
const ДОП_ВЫСОТА = 0.02;
const ДОП_ДИСТАНЦИЯ = 0.03;
const ДОП_НАКЛОН = 0.5;

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});

async function снять(адрес, готов, довести, читать) {
  const кон = await бр.newContext({
    viewport: экран, deviceScaleFactor: 1,
    isMobile: КТО === "тел", hasTouch: КТО === "тел"
  });
  const стр = await кон.newPage();
  стр.on("pageerror", (e) => console.log("  ИСКЛ " + e.message.slice(0, 120)));
  await стр.goto(адрес + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await стр.waitForFunction(готов, null, { timeout: 300000 });
  await стр.waitForTimeout(3500);
  await довести(стр);
  const из = await стр.evaluate(читать);
  await кон.close();
  return из;
}

const впн = await снять(
  VPN,
  () => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
  async (стр) => {
    await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("финал", д), ДОЛЯ);
    await стр.evaluate(() => new Promise((г) => {
      let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 20 ? г() : ш())); })();
    }));
  },
  () => (window.RV_ФИНАЛ && window.RV_ФИНАЛ["замерРубки"])
    ? window.RV_ФИНАЛ["замерРубки"]() : { нет: "нет замерРубки" }
);

const кдн = await снять(
  CDN,
  () => window.RC_GL && window.RC_GL.ready3d,
  async (стр) => {
    /* Досюда доезжаем прокруткой: финал у соседа это конец ленты. */
    const высота = await стр.evaluate(() =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    for (let i = 1; i <= 90; i++) {
      await стр.evaluate((y) => window.scrollTo(0, y), Math.round(высота * (i / 90)));
      await стр.evaluate(() => new Promise((г) => {
        let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 2 ? г() : ш())); })();
      }));
    }
  },
  () => (window.RC_FLIGHT && window.RC_FLIGHT["замерРубки"])
    ? window.RC_FLIGHT["замерРубки"]() : { нет: "нет замерРубки" }
);

console.log(`РУБКИ РЯДОМ ${КТО} ${экран.width}x${экран.height}, VPN доля ${ДОЛЯ}`);
if (!впн || впн.нет || !кдн || кдн.нет) {
  console.log("  VPN: " + JSON.stringify(впн));
  console.log("  CDN: " + JSON.stringify(кдн));
  console.log("ГРЯЗНО  рубку не спросить");
  await бр.close();
  process.exit(1);
}

const беды = [];
function строка(имя, ключ, доп, ед) {
  const а = впн[ключ], б = кдн[ключ];
  const р = +(а - б).toFixed(4);
  const плохо = Math.abs(р) > доп;
  console.log(`  ${имя.padEnd(22)} VPN ${String(а).padEnd(9)} CDN ${String(б).padEnd(9)}` +
              ` разница ${(р > 0 ? "+" : "") + р}${ед}` + (плохо ? "  ← за порогом " + доп : ""));
  if (плохо) беды.push(`${имя}: ${а} против ${б}, разница ${р}${ед} при пороге ${доп}`);
}
строка("глаз над настилом", "глазНадНастилом", ДОП_ВЫСОТА, "");
строка("глаз до стены панели", "глазДоСтеныПанели", ДОП_ДИСТАНЦИЯ, "");
строка("наклон взгляда", "тангажГрадусов", ДОП_НАКЛОН, "°");
console.log(`  ${"поле объектива".padEnd(22)} VPN ${впн["поле"]}      CDN ${кдн["поле"]}`);
console.log(`  ${"радиус обшивки".padEnd(22)} VPN ${впн["радиусОбшивки"]}   CDN ${кдн["радиусОбшивки"]}`);

if (беды.length) {
  console.log("ГРЯЗНО  рубки стоят по-разному");
  for (const б of беды) console.log("   " + б);
  await бр.close();
  process.exit(1);
}
console.log("ЧИСТО  глаз стоит в рубке одинаково");
await бр.close();
