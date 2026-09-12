/* КАКАЯ ИМЕННО САМОСВЕТЯЩАЯСЯ ПОЛОСА РУБКИ ЛЕЖИТ В НИЖНЕЙ КРОМКЕ.

   ── ЧТО УЖЕ ДОКАЗАНО ──────────────────────────────────────────────
   Полоса низа кадра финала (средняя яркость последних трёх процентов)
   идёт горбом 8.7 -> 78.8 -> 9.5 при приходе прокруткой, у соседа там
   ровные 7.7. Сравнения делались правильно только после того, как
   выяснилось главное: сравнивать надо КРИВЫЕ целиком, а не два снимка
   внутри горба.

   Честные A/B по кривым:

     погашена «комната»            горб на месте, размах 70.1
     погашена «Орбита за окном»    горб на месте, размах 69.3
     погашена «финал»              горба нет, размах 0.1
     все 17 ламп в ноль            горб на месте, размах 66.4
     погашены самосветящиеся       ГОРБА НЕТ, размах 4.5

   Значит светит не освещённая геометрия, а материал, которому лампы не
   нужны (MeshBasic), и он внутри рубки. Их тридцать две.

   ── ЧТО ДЕЛАЕТ ЭТА ПРОБА ──────────────────────────────────────────
   На пике горба проецирует каждую из них и оставляет те, чья экранная
   коробка задевает нижние три процента кадра. Их должно остаться
   единицы, и тогда виновник называется по имени, цвету и прозрачности.

   Запуск: node tools/кто-в-кромке.mjs [пк|тел] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

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

const место = await стр.evaluate(() => {
  const к = window.RV_WORLD["кривая"] ? window.RV_WORLD["кривая"]() : null;
  if (!к || !к["станции"]) return null;
  const ф = к["станции"].filter((с) => с["имя"] === "финал")[0];
  return ф ? Math.round(ф["верх"] + ф["ход"] * 0.99) : null;
});
for (let i = 1; i <= 90; i++) {
  await стр.evaluate((y) => window.scrollTo(0, y), Math.round((место || 10000) * (i / 90)));
  await стр.evaluate(() => new Promise((г) => {
    let k = 0; (function ш() { requestAnimationFrame(() => (++k >= 2 ? г() : ш())); })();
  }));
}

async function кадры(н) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), н);
}

/* Снимаем дважды: на пике и в покое. Пик по замеру кривой приходится
   на шестую-седьмую пробу по четыре кадра после отсчёта, покой к
   двенадцатой. Сравниваем не яркость кадра, а СВОЙСТВА тел, поэтому
   фаза здесь безопасна: ничего не двигаем. */
await кадры(60);
await стр.waitForTimeout(2000);

await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  const T = W.T;
  window.__кромка = function (низДоли) {
    let салон = null;
    W.scene.traverse((о) => { if (!салон && о.name === "салон") салон = о; });
    const из = [];
    (салон || W.scene).traverse((о) => {
      if (!о.isMesh || !о.geometry) return;
      const м = Array.isArray(о.material) ? о.material[0] : о.material;
      if (!м || !/Basic/.test(м.type || "")) return;
      let p = о, видно = true;
      while (p) { if (!p.visible) { видно = false; break; } p = p.parent; }
      if (!видно) return;
      о.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(о);
      if (box.isEmpty()) return;
      let верх = 1e9, низ = -1e9, лево = 1e9, право = -1e9, углов = 0;
      for (let i = 0; i < 8; i++) {
        const т = new T.Vector3(
          (i & 1) ? box.max.x : box.min.x,
          (i & 2) ? box.max.y : box.min.y,
          (i & 4) ? box.max.z : box.min.z
        );
        const вид = т.clone().applyMatrix4(W.cam.matrixWorldInverse);
        if (вид.z > -0.01) continue;
        т.project(W.cam);
        углов++;
        const эy = 0.5 - т.y * 0.5, эx = т.x * 0.5 + 0.5;
        if (эy < верх) верх = эy;
        if (эy > низ) низ = эy;
        if (эx < лево) лево = эx;
        if (эx > право) право = эx;
      }
      if (углов < 4) return;
      if (низ < низДоли) return;          /* кромки не касается */
      из.push({
        имя: о.name || о.type,
        путь: (function () { const ч = []; let q = о; while (q && ч.length < 4) { ч.unshift(q.name || q.type); q = q.parent; } return ч.join("/"); })(),
        геом: о.geometry.type,
        цвет: м.color ? "#" + м.color.getHexString() : null,
        прозр: м.opacity != null ? +м.opacity.toFixed(3) : null,
        смеш: м.blending,
        верх: +верх.toFixed(3), низ: +низ.toFixed(3),
        лево: +лево.toFixed(3), право: +право.toFixed(3)
      });
    });
    return из;
  };
});

await кадры(24);
const наПике = await стр.evaluate(() => window.__кромка(0.97));
await кадры(90);
const вПокое = await стр.evaluate(() => window.__кромка(0.97));
await бр.close();

const покойПо = new Map();
for (const т of вПокое) покойПо.set(т.путь + "|" + т.геом + "|" + т.верх, т);

console.log(`КТО В КРОМКЕ ${КТО} ${экран.width}x${экран.height}, финал доля 0.99`);
console.log(`  самосветящихся в нижних трёх процентах: на пике ${наПике.length}, в покое ${вПокое.length}`);
for (const т of наПике) {
  const б = покойПо.get(т.путь + "|" + т.геом + "|" + т.верх);
  const дП = б && б.прозр != null && т.прозр != null ? +(т.прозр - б.прозр).toFixed(3) : null;
  console.log(`  ${т.геом.padEnd(16)} ${String(т.цвет).padEnd(9)} прозр ${String(т.прозр).padEnd(6)}` +
              (дП != null ? ` (в покое ${б.прозр}, разница ${дП})` : " (в покое не найдено)") +
              ` смеш ${т.смеш}  кадр y ${т.верх}..${т.низ} x ${т.лево}..${т.право}  ${т.путь}`);
}
if (!наПике.length) {
  console.log("  ни одна самосветящаяся не задевает кромку:");
  console.log("  значит горб даёт не их геометрия, а их ОРЕОЛ - свечение");
  console.log("  с нулевым порогом разносит яркое пятно за границы тела.");
}
