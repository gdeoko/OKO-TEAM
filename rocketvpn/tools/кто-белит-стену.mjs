/* ЧТО ЗАБЕЛИВАЕТ СТЕНУ В КОНЦЕ АКТА СТАНЦИИ.

   ЗАЧЕМ. Владелец: «материал снова начал меняться до этого так небыло
   ты снова вернула проблему». Замер одного и того же куска кладки:

     станция 0.92    яркость 145.3  контраст 21.3  синий 172.7
     станция 0.95    яркость 127.7  контраст 24.4  синий 143.6
     периметр 0.08   яркость 128.9  контраст 24.5  синий 144.7

   То есть тело стены НЕ меняется: на 0.95 она уже такая же, как в
   следующем акте, до третьего знака. А на 0.92 поверх неё лежит что-то
   синее и полупрозрачное: светлее на четырнадцать процентов, синее на
   двадцать, контраст ниже на тринадцать. Человек читает это сменой
   материала, и он прав - кладка на глазах меняет вид.

   Оба зонда лучом говорят, что ПЕРЕД стеной ничего нет: первое тело на
   луче - сама кладка, на 11.58 единицах. Значит виновник не режет луч,
   он складывается на кадр: прозрачная плоскость без записи глубины.

   ЧТО ДЕЛАЕТ ЭТА ПРОБА. Гасит по одному подозреваемых из акта станции и
   меряет тот же кусок кладки. Камера стоит на одной доле, между
   снимками меняется ровно одно тело, поэтому сравнение снимков честное.

   Цель названа числами выше: яркость около 128, контраст около 24.4,
   синий около 144.

   Запуск: node tools/кто-белит-стену.mjs [пк|тел] [доля] */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const ДОЛЯ = +(process.argv[3] || 0.92);
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

/* Кусок чистой кладки, тот же, на котором сняты числа выше. */
const КУСОК = { x0: 0.40, y0: 0.45, x1: 0.62, y1: 0.67 };

/* ── ПЕРЕБИРАЕМ НЕ ИМЕНА, А САМИ ТЕЛА ────────────────────────────
   Первый заход искал по именам («тень купола», «луч арки», «дымка»), и
   не нашёл НИ ОДНОГО: у виновников имя пустое, в дереве они значатся
   просто `Mesh`. Зато перепись прозрачных тел их назвала путём и
   порядком отрисовки:

     порядок  9  смеш обычное    Scene/станция/купол/Mesh
     порядок 11  смеш сложение   Scene/станция/купол/Mesh
     порядок  5  смеш сложение   Scene/rv-сетка/Mesh  прозр 0.12

   Стена рисуется на порядке 3. Значит закрыть её может только то, что
   идёт ПОСЛЕ неё, и перебирать надо именно этот список, а не догадки об
   именах. Гасим каждое такое тело по одному, ссылку держим сами - имя
   для этого не нужно вовсе. */
const ПОРЯДОК_СТЕНЫ = 3;

function мерка(файл) {
  return execFileSync("python3", ["-c", `
import sys
from PIL import Image, ImageStat
im = Image.open(sys.argv[1]).convert("RGB")
w, h = im.size
k = im.crop((int(w * ${КУСОК.x0}), int(h * ${КУСОК.y0}),
             int(w * ${КУСОК.x1}), int(h * ${КУСОК.y1})))
s = ImageStat.Stat(k.convert("L")); c = ImageStat.Stat(k)
print(round(s.mean[0], 1), round(s.stddev[0], 1), round(c.mean[2], 1))
`, файл], { encoding: "utf8" }).trim().split(/\s+/).map(Number);
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

await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  /* Ссылки на тела держим сами, по номеру в списке: имени у виновников
     нет, а путь «Scene/станция/купол/Mesh» повторяется дважды. Номер
     однозначен - именно на то тело, что напечатано в переписи. */
  window.__список = [];
  window.__собрать = function (послеПорядка) {
    window.__список = [];
    W.scene.traverse(function (о) {
      if (!о.isMesh && !о.isPoints) return;
      let p = о, видно = true;
      while (p) { if (!p.visible) { видно = false; break; } p = p.parent; }
      if (!видно) return;
      const м = Array.isArray(о.material) ? о.material[0] : о.material;
      if (!м || !м.transparent) return;
      /* Текст в объёме отбрасываем: он и должен лежать поверх кадра, а
         кусок кладки, на котором мы меряем, слов не несёт. */
      if (о.userData && о.userData["текст"]) return;
      if (о.renderOrder <= послеПорядка) return;
      window.__список.push(о);
    });
    return window.__список.map(function (о, i) {
      const м = Array.isArray(о.material) ? о.material[0] : о.material;
      return {
        н: i,
        путь: (function () { const ч = []; let q = о; while (q && ч.length < 4) { ч.unshift(q.name || q.type); q = q.parent; } return ч.join("/"); })(),
        прозр: м.opacity == null ? null : +м.opacity.toFixed(3),
        глубина: !!м.depthWrite, смеш: м.blending, порядок: о.renderOrder,
        вид: о.isPoints ? "точки" : "меш"
      };
    });
  };
  window.__погасить = function (н, да) {
    const о = window.__список[н];
    if (!о) return false;
    if (о.userData["__былаВидимость"] === undefined) о.userData["__былаВидимость"] = о.visible;
    о.visible = да ? о.userData["__былаВидимость"] : false;
    return true;
  };
});

await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("станция", д), ДОЛЯ);
await стр.waitForTimeout(3200);
await стр.screenshot({ path: "/tmp/белит-как-есть.png" });
const [я0, к0, с0] = мерка("/tmp/белит-как-есть.png");

console.log(`КТО БЕЛИТ СТЕНУ ${КТО} ${экран.width}x${экран.height}, станция доля ${ДОЛЯ}`);
console.log(`  как есть        яркость ${я0}  контраст ${к0}  синий ${с0}`);
console.log(`  цель (0.95 и периметр)  яркость 128  контраст 24.4  синий 144`);

const список = await стр.evaluate((п) => window.__собрать(п), ПОРЯДОК_СТЕНЫ);
console.log(`  прозрачных тел ПОСЛЕ стены (порядок > ${ПОРЯДОК_СТЕНЫ}): ${список.length}`);
for (const т of список) {
  console.log(`      №${String(т.н).padStart(2)} порядок ${String(т.порядок).padStart(4)} ` +
              `прозр ${String(т.прозр).padEnd(6)} глубина ${т.глубина ? "да " : "нет"} ` +
              `смеш ${т.смеш} ${т.вид.padEnd(6)} ${т.путь}`);
}

const находки = [];
for (const т of список) {
  if (!(await стр.evaluate((н) => window.__погасить(н, false), т.н))) continue;
  await стр.waitForTimeout(1100);
  const файл = `/tmp/белит-без-${т.н}.png`;
  await стр.screenshot({ path: файл });
  const [я, к, с] = мерка(файл);
  const дЯ = я - я0, дС = с - с0;
  console.log(`  без №${т.н} (${т.путь}, порядок ${т.порядок}): ` +
              `яркость ${я} (${дЯ.toFixed(1)}) контраст ${к} (${(к - к0).toFixed(1)}) синий ${с} (${дС.toFixed(1)})`);
  if (дЯ < -3 || дС < -3) находки.push({ т: т, дЯ: дЯ, дС: дС, я: я, к: к, с: с });
  await стр.evaluate((н) => window.__погасить(н, true), т.н);
  await стр.waitForTimeout(700);
}
await бр.close();

if (!находки.length) {
  console.log("  ни одно тело после стены кладку не белит:");
  console.log("  значит дело не в теле, а в проходе плёнки - свечение с нулевым");
  console.log("  порогом или тональная кривая (rv-ореол.js).");
} else {
  находки.sort((a, b) => a.дЯ - b.дЯ);
  console.log("  ВИНОВНИКИ по убыванию вклада:");
  for (const н of находки) {
    console.log(`      ${н.дЯ.toFixed(1)} яркости, ${н.дС.toFixed(1)} синего  ` +
                `порядок ${н.т.порядок} смеш ${н.т.смеш}  ${н.т.путь}`);
  }
  console.log("  цель яркость 128, синий 144: смотреть, кто доводит до неё");
}
