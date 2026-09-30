/* КТО ГЛАДКИЙ: сверка материалов иглу, дома и стены периметра.

   Владелец сказал «подмена стены осталась», и прошлая проверка мерила
   не там: она сверяла стык актов, где обе кладки почти сошлись.
   Здесь спрашиваем САМИ МАТЕРИАЛЫ: приехали ли карты, какая доля
   подмеса, какой масштаб развёртки и есть ли она вообще.

   Запуск: node tools/кто-гладкий.mjs */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 200)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
  null, { timeout: 300000 });
await стр.waitForTimeout(3000);

async function свод(акт, доля) {
  await стр.evaluate(([а, д]) => window.RV_MOTION["кПунктy"](а, д), [акт, доля]);
  await стр.evaluate(() => new Promise((г) => {
    let n = 0; (function ш() { requestAnimationFrame(() => (++n >= 60 ? г() : ш())); })();
  }));
  return стр.evaluate(() => {
    var W = window.RV_WORLD["мир"]();
    var T = W.T;
    var из = [];
    W.scene.traverse(function (о) {
      if (!о.visible || !о.material || !о.geometry) return;
      var м = о.material;
      if (!м.uniforms || !м.uniforms.tBlok) return;
      var г = о.geometry;
      var шт = о.isInstancedMesh ? о.count : 1;
      if (шт < 8) return;
      var б = г.boundingBox;
      if (!б) { г.computeBoundingBox(); б = г.boundingBox; }
      /* Размер камня в МИРЕ: сетка у всех кладок единичная коробка, а
         настоящий размер лежит в матрице экземпляра и в масштабе узла.
         По одной геометрии кладки не различить, и прошлая проверка на
         этом и споткнулась. */
      var камни = [];
      if (о.isInstancedMesh) {
        о.updateMatrixWorld(true);
        var м4 = new T.Matrix4(), кв = new T.Quaternion();
        for (var и = 0; и < Math.min(шт, 400); и++) {
          о.getMatrixAt(и, м4);
          м4.premultiply(о.matrixWorld);
          var мс = new T.Vector3();
          м4.decompose(new T.Vector3(), кв, мс);
          камни.push([Math.abs(мс.x), Math.abs(мс.y), Math.abs(мс.z)]);
        }
      }
      function середина(к) {
        var а = камни.map(function (с) { return с[к]; }).sort(function (x, y) { return x - y; });
        return а.length ? +а[а.length >> 1].toFixed(3) : null;
      }
      из.push({
        камень: камни.length ? [середина(0), середина(1), середина(2)] : null,
        имя: о.name || о.type,
        штук: шт,
        развёртка: !!г.attributes.uv,
        uTex: м.uniforms.uTex ? м.uniforms.uTex.value : null,
        цвет: !!(м.uniforms.tBlok && м.uniforms.tBlok.value),
        норм: !!(м.uniforms.tBlokN && м.uniforms.tBlokN.value),
        orm: !!(м.uniforms.tBlokO && м.uniforms.tBlokO.value),
        блок: [+(б.max.x - б.min.x).toFixed(3), +(б.max.y - б.min.y).toFixed(3)],
        масштаб: [+о.scale.x.toFixed(3), +о.scale.y.toFixed(3)],
        uIntro: м.uniforms.uIntro ? +(+м.uniforms.uIntro.value).toFixed(3) : null,
        uStena: м.uniforms.uStena ? +(+м.uniforms.uStena.value).toFixed(3) : null
      });
    });
    return из;
  });
}

for (const [а, д] of [["станция", 0.10], ["станция", 0.50], ["станция", 0.92], ["периметр", 0.50]]) {
  const с = await свод(а, д);
  console.log("=== " + а + " " + д);
  for (const к of с) console.log("   " + JSON.stringify(к));
}

await бр.close();
