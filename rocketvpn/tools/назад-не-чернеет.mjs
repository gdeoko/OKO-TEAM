/* ВОЗВРАТ НАЗАД НЕ ИМЕЕТ ПРАВА ГАСИТЬ ДОМ.

   Владелец: «а ещё назад когда возвращаюсь, кирпичи чёрные становятся».
   На снимке дом стоит тёмным силуэтом: блоки различимы только по
   кромкам, тела у них нет, а грунт и звёзды рядом освещены нормально.

   Проверка воспроизводит именно его путь, а не переход прыжком: доехать
   ВПЕРЁД до следующего акта и вернуться НАЗАД на ту же долю станции.
   Прыжком такое не ловится - при прыжке модули успевают договориться за
   один кадр, а беда живёт в порядке, в котором они гасят друг друга.

   Судим по числам: яркость дома на прямом ходу и на обратном ходу в
   ОДНОЙ И ТОЙ ЖЕ точке обязана совпасть. Заодно печатаем, что с
   видимостью узлов, - силуэт получается двумя разными способами, и
   различить их можно только так.

   Запуск: node tools/назад-не-чернеет.mjs [тел|пк]
*/
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "тел";
const КУДА = "/tmp/назад";
const экран = КТО === "пк"
  ? { w: 1440, h: 900, dpr: 1, mob: false }
  : { w: 390, h: 844, dpr: 1, mob: true };

/* Куда возвращаемся. Доля 0.30 это дом ещё домом: на ней владелец и
   снял свой кадр - заголовок первого раздела, кнопки внизу. */
const ТОЧКА = 0.30;

mkdirSync(КУДА, { recursive: true });

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
await стр.waitForTimeout(2000);

async function встать(акт, доля) {
  await стр.evaluate(([а, д]) => window.RV_MOTION["кПунктy"](а, д), [акт, доля]);
  let было = null, тихих = 0, кругов = 0;
  while (тихих < 3 && кругов < 60) {
    const п = await стр.evaluate(() => {
      const c = window.RV_WORLD["мир"]().cam.position;
      return [c.x, c.y, c.z];
    });
    if (было) {
      const d = Math.hypot(п[0] - было[0], п[1] - было[1], п[2] - было[2]);
      тихих = d < 0.02 ? тихих + 1 : 0;
    }
    было = п; кругов++;
    await стр.waitForTimeout(250);
  }
  await стр.waitForTimeout(1400);
}

/* Яркость дома берём широкой полосой по его месту в кадре. Дом занимает
   середину, грунт ниже, небо выше - полоса намеренно захватывает только
   его. Верхний процентиль отделяет камень от неба между блоками. */
function домВКадре(файл) {
  const из = execFileSync("python3", ["-c", `
import sys
from PIL import Image, ImageStat
im = Image.open(sys.argv[1]).convert("L")
w, h = im.size
k = im.crop((int(w*0.15), int(h*0.36), int(w*0.85), int(h*0.68)))
s = ImageStat.Stat(k)
d = sorted(k.getdata()); n = len(d)
print(round(s.mean[0], 1), d[n*90//100])
`, файл], { encoding: "utf8" });
  const [я, п90] = из.trim().split(/\s+/).map(Number);
  return { средняя: я, камень: п90 };
}

function узлы() {
  return стр.evaluate(() => {
    const м = window.RV_WORLD["мир"]();
    const вид = {};
    if (м && м.scene) м.scene.traverse(function (о) {
      const и = (о.name || "") + "";
      if (!/кладка|обводка|кирпичн|дом|купол|стена/i.test(и)) return;
      let в = о.visible, р = о.parent;
      while (в && р) { в = р.visible; р = р.parent; }
      вид[и] = в;
    });
    return { узлы: вид, домДержит: window["RV_СТЕНА_У_ДОМА"] };
  });
}

await встать("станция", ТОЧКА);
await стр.screenshot({ path: `${КУДА}/1-прямо.png` });
const прямо = домВКадре(`${КУДА}/1-прямо.png`);
const уПрямо = await узлы();

/* Уезжаем вперёд за стык актов и возвращаемся. Именно так это делает
   человек: доехал до стены, передумал, листает обратно. */
await встать("периметр", 0.35);
await встать("станция", ТОЧКА);
await стр.screenshot({ path: `${КУДА}/2-назад.png` });
const назад = домВКадре(`${КУДА}/2-назад.png`);
const уНазад = await узлы();

console.log(`\n${КТО} ${экран.w}x${экран.h}, станция ${ТОЧКА}`);
console.log(`  прямым ходом ... средняя ${прямо.средняя}, камень ${прямо.камень}`);
console.log(`  вернулись ...... средняя ${назад.средняя}, камень ${назад.камень}`);
console.log(`  признак «дом держит стену»: прямо ${уПрямо.домДержит}, назад ${уНазад.домДержит}`);
for (const и of new Set([...Object.keys(уПрямо.узлы), ...Object.keys(уНазад.узлы)])) {
  const а = уПрямо.узлы[и], б = уНазад.узлы[и];
  console.log(`  ${и}: ${а} -> ${б}${а !== б ? "   ИЗМЕНИЛОСЬ" : ""}`);
}

const итог = [];
const падение = прямо.камень - назад.камень;
if (падение > 25) итог.push(`дом потемнел на ${падение} уровней после возврата (${прямо.камень} -> ${назад.камень})`);
if (назад.камень < 60) итог.push(`дом почти чёрный после возврата: камень ${назад.камень}`);
if (беды.length) итог.push("ошибки страницы: " + [...new Set(беды)].slice(0, 5).join(" | "));

if (итог.length) {
  console.log("\nКРАСНОЕ:");
  for (const с of итог) console.log("   " + с);
} else {
  console.log("\nзелено: возврат дом не гасит");
}
await бр.close();
process.exit(итог.length ? 1 : 0);
