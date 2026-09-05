/* Замер хода камеры в тоннеле и вокруг ракеты.

   ЗАЧЕМ. Владелец потребовал ровно три вещи и все три числовые:
   в тоннеле камера идёт ТОЛЬКО вперёд (высота не меняется, вбок не
   уезжает, кадр не крутится), после тоннеля она поднимается ВПЕРЁД И
   ВВЕРХ и смотрит ГОРИЗОНТАЛЬНО на рой частиц, а вокруг роя ходит по
   РОВНОЙ окружности. Глазами это не проверяется: спуск на полградуса за
   шаг виден только в числах.

   Что печатает по каждому шагу доли:
     x,y,z    - где стоит глаз
     курс     - куда смотрит: наклон к горизонту в градусах (ноль ровно)
     крен     - поворот кадра вокруг оси взгляда в градусах (ноль ровно)
     радиус   - расстояние до середины роя
     угол     - место на окружности обхода в градусах

   Запуск: node tools/замер-тоннеля.mjs [ПК|тел] */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const ПК = { width: 1440, height: 900 };
const ТЕЛ = { width: 390, height: 844 };
const вьюпорт = (process.argv[2] || "ПК") === "тел" ? ТЕЛ : ПК;

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: вьюпорт, deviceScaleFactor: 1 });
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 200)));
стр.on("console", (m) => { if (m.type() === "error") беды.push("КОНС " + m.text().slice(0, 200)); });

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
/* Вступление считает своё время по кадрам с потолком 0.1 секунды на
   кадр. На SwiftShader кадров два в секунду, и пять с половиной секунд
   вступления растягиваются в полминуты; пока оно идёт, камера
   подмешана к вступительной точке, и любой замер меряет не позу акта, а
   середину между ней и вступлением. Ждём конца по самому миру. */
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 180000 });
await стр.waitForTimeout(1500);

const рой = await стр.evaluate(() =>
  window.RV_КОМНАТА && window.RV_КОМНАТА["серединаФигуры"]
    ? window.RV_КОМНАТА["серединаФигуры"]() : null);
console.log("середина роя:", рой);

/* Акты идут в том же порядке, что и в плёнке: тоннель, потом две
   остановки обхода вокруг роя. */
const ПЛАН = [
  ["прокол", [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0]],
  ["рубка", [0, 0.25, 0.5, 0.75, 1.0]],
  ["пуск", [0, 0.25, 0.5, 0.75, 1.0]]
];

for (const [акт, доли] of ПЛАН) {
  console.log("\n=== " + акт + " ===");
  console.log("доля     x       y       z     курс°  крен°  радиус  угол°");
  for (const д of доли) {
    const встал = await стр.evaluate(([а, дл]) =>
      window.RV_MOTION && window.RV_MOTION["кПунктy"] ? window.RV_MOTION["кПунктy"](а, дл) : false,
      [акт, д]);
    if (!встал) { console.log(д.toFixed(2) + "  не встал"); continue; }
    await стр.waitForTimeout(1200);
    const з = await стр.evaluate((ц) => {
      const W = window.RV_WORLD && window.RV_WORLD["мир"] ? window.RV_WORLD["мир"]() : null;
      if (!W || !W.cam) return null;
      const к = W.cam;


      const э = к.matrixWorld.elements;
      /* Столбцы матрицы: 0-4-8 это ось «вправо», 4-5-6 «вверх»,
         8-9-10 «назад». Взгляд это минус третий столбец. */
      const впр = [э[0], э[1], э[2]];
      const взг = [-э[8], -э[9], -э[10]];
      const курс = Math.asin(Math.max(-1, Math.min(1, взг[1]))) * 180 / Math.PI;
      /* Крен: наклон оси «вправо» к горизонту. */
      const крен = Math.asin(Math.max(-1, Math.min(1, впр[1]))) * 180 / Math.PI;
      const p = к.position;
      let рад = null, уг = null;
      if (ц) {
        const dx = p.x - ц.x, dz = p.z - ц.z;
        рад = Math.sqrt(dx * dx + dz * dz);
        уг = Math.atan2(dx, dz) * 180 / Math.PI;
      }
      return {
        x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
        курс: +курс.toFixed(2), крен: +крен.toFixed(2),
        рад: рад == null ? null : +рад.toFixed(2),
        уг: уг == null ? null : +уг.toFixed(1)
      };
    }, рой);
    if (!з) { console.log(д.toFixed(2) + "  нет мира"); continue; }
    console.log(
      д.toFixed(2).padStart(4) + "  " +
      String(з.x).padStart(7) + " " + String(з.y).padStart(7) + " " +
      String(з.z).padStart(7) + "  " + String(з.курс).padStart(6) + " " +
      String(з.крен).padStart(6) + "  " + String(з.рад).padStart(6) + "  " +
      String(з.уг).padStart(6));
  }
}

if (беды.length) console.log("\nбеды:\n" + беды.slice(0, 12).join("\n"));
await бр.close();
