/* ОДИН КАМЕНЬ НА ВЕСЬ ФИЛЬМ: проверка стыка двух кладок.

   ЗАЧЕМ. Стен в фильме две. Дом собирает свою (объект «кладка»,
   rv-act-станция.js), акт периметра свою (объект «кирпичи прокола»,
   rv-кирпичи.js). На стыке актов они стоят в одной плоскости, и любое
   расхождение читается как подмена материала - владелец писал об этом
   не один десяток раз.

   Расхождений было три, и каждое ловилось только глазом:
     размер камня   разные сетки           поймано и сведено раньше
     развёртка      у дома не было uv      фотоскан не читался вовсе
     форма камня    скол только у прокола  дом шёл рядом одинаковых плит

   Числа проверки берутся у живой сцены и у самой картинки, а не у
   исходника: материал можно уравнять в коде и разойтись в кадре.

   Запуск: node tools/checks/кирпич.mjs [адрес] */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { БРАУЗЕР } from "../браузер.mjs";

const АДРЕС = process.env.RV_URL || process.argv[2] || "http://127.0.0.1:8170";
/* Пороги. Размер камня обязан совпасть точно (это одно число из одной
   сетки), поверхность меряется картинкой и имеет право разойтись на
   четверть: у дома светятся швы, и совсем ровно не будет никогда. */
const ПОРОГ_РАЗМЕРА = 0.02;
const ПОРОГ_ЗЕРНА = 0.35;
const ПОРОГ_СВЕТЛОТЫ = 12;

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 } });
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => {});
await стр.waitForTimeout(1500);

async function встать(акт, доля) {
  await стр.evaluate(([и, x]) => window.RV_MOTION["кПунктy"](и, x), [акт, доля]);
  let было = null, тихих = 0, кругов = 0;
  while (тихих < 3 && кругов < 60) {
    const п = await стр.evaluate(() => {
      const c = window.RV_WORLD["мир"]().cam.position; return [c.x, c.y, c.z];
    });
    if (было) {
      const d = Math.hypot(п[0] - было[0], п[1] - было[1], п[2] - было[2]);
      тихих = d < 0.02 ? тихих + 1 : 0;
    }
    было = п; кругов++;
    await стр.waitForTimeout(250);
  }
}

/* Размер камня и развёртка спрашиваются у сцены. Размер меряется по
   МИРОВОЙ матрице экземпляра: местный масштаб ничего не значит, купол
   стоит в своей группе со своим множителем. */
async function камень() {
  return стр.evaluate(() => {
    const мир = window.RV_WORLD["мир"](), T = мир.T, из = [];
    мир.scene.traverse((о) => {
      if (!о.isInstancedMesh) return;
      if (!/^(кладка|кирпичи прокола)$/.test(о.name || "")) return;
      let p = о, видно = true;
      while (p) { if (!p.visible) { видно = false; break; } p = p.parent; }
      if (!видно) return;
      о.updateMatrixWorld();
      const m = new T.Matrix4(), s = new T.Vector3(), поз = new T.Vector3(), q = new T.Quaternion();
      let ш = 0, в = 0, n = 0;
      const шаг = Math.max(1, Math.floor(о.count / 12));
      for (let i = 0; i < о.count; i += шаг) {
        о.getMatrixAt(i, m); m.premultiply(о.matrixWorld); m.decompose(поз, q, s);
        ш += s.x; в += s.y; n++;
      }
      из.push({
        имя: о.name, ширина: +(ш / n).toFixed(3), высота: +(в / n).toFixed(3),
        развёртка: !!о.geometry.attributes.uv,
        фотоскан: !!(о.material.uniforms && о.material.uniforms.tBlok && о.material.uniforms.tBlok.value),
        доляТекстуры: о.material.uniforms && о.material.uniforms.uTex ? о.material.uniforms.uTex.value : null
      });
    });
    return из;
  });
}

/* Поверхность меряется по картинке: зерно (средний перепад яркости
   между соседями) и светлота. Один и тот же кусок кадра у обеих стен -
   середина экрана, где стена и стоит. */
function поверхность(файл) {
  const из = execFileSync("python3", ["-c", `
import sys, statistics
from PIL import Image
im = Image.open(sys.argv[1]).convert("L").crop((350, 380, 1050, 560))
w, h = im.size
d = list(im.getdata())
g = [abs(d[y*w+x+1]-d[y*w+x-1]) + abs(d[(y+1)*w+x]-d[(y-1)*w+x])
     for y in range(1, h-1, 2) for x in range(1, w-1, 2)]
print(round(sum(g)/len(g), 2), round(statistics.median(d), 1))
`, файл], { encoding: "utf8" }).trim().split(/\s+/).map(Number);
  return { зерно: из[0], светлота: из[1] };
}

const места = [["станция", 0.92, "/tmp/кирпич-дом.png"], ["периметр", 0.08, "/tmp/кирпич-периметр.png"]];
const собрано = [];
for (const [акт, доля, файл] of места) {
  await встать(акт, доля);
  const к = await камень();
  await стр.screenshot({ path: файл });
  собрано.push({ акт: акт, камень: к[0] || null, кадр: поверхность(файл) });
}
await бр.close();

const красное = [];
for (const с of собрано) {
  if (!с.камень) { красное.push(`${с.акт}: кладки в кадре нет вовсе`); continue; }
  if (!с.камень.развёртка) красное.push(`${с.акт}: у сетки нет развёртки - фотоскан не читается, камень выйдет пластиком`);
  if (!с.камень.фотоскан) красное.push(`${с.акт}: фотоскан не доехал`);
  if (с.камень.доляТекстуры !== 1) красное.push(`${с.акт}: доля фотоскана ${с.камень.доляТекстуры}, а не 1`);
}
if (собрано.length === 2 && собрано[0].камень && собрано[1].камень) {
  const [а, б] = собрано;
  const дШ = Math.abs(а.камень.ширина - б.камень.ширина) / Math.max(а.камень.ширина, б.камень.ширина);
  const дВ = Math.abs(а.камень.высота - б.камень.высота) / Math.max(а.камень.высота, б.камень.высота);
  if (дШ > ПОРОГ_РАЗМЕРА || дВ > ПОРОГ_РАЗМЕРА) {
    красное.push(`размер камня разошёлся: дом ${а.камень.ширина}x${а.камень.высота}, ` +
                 `периметр ${б.камень.ширина}x${б.камень.высота}`);
  }
  const дЗ = Math.abs(а.кадр.зерно - б.кадр.зерно) / Math.max(а.кадр.зерно, б.кадр.зерно);
  if (дЗ > ПОРОГ_ЗЕРНА) {
    красное.push(`зерно поверхности разошлось: дом ${а.кадр.зерно}, периметр ${б.кадр.зерно} ` +
                 `(на ${Math.round(дЗ * 100)}%)`);
  }
  const дС = Math.abs(а.кадр.светлота - б.кадр.светлота);
  if (дС > ПОРОГ_СВЕТЛОТЫ) {
    красное.push(`светлота разошлась: дом ${а.кадр.светлота}, периметр ${б.кадр.светлота}`);
  }
}
for (const б of беды) красное.push(б);

for (const с of собрано) {
  console.log(`${с.акт}: камень ${с.камень ? с.камень.ширина + "x" + с.камень.высота : "нет"}, ` +
              `развёртка ${с.камень && с.камень.развёртка ? "есть" : "НЕТ"}, ` +
              `зерно ${с.кадр.зерно}, светлота ${с.кадр.светлота}`);
}
if (красное.length) {
  console.log("\nКРАСНОЕ кирпич:");
  for (const с of красное) console.log("  " + с);
  process.exit(1);
}
console.log("\nЧИСТО кирпич: обе кладки из одного камня");
