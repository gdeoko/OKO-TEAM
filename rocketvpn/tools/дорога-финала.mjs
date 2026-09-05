/* Замер ДОРОГИ ФИНАЛА: где стоит камера на каждой доле акта.

   ЗАЧЕМ. Снимок доли 0.30 на мониторе показал вместо подхода к ракете
   тёмную гнутую стену во весь кадр. Глазом отсюда не понять, что
   случилось: камера уже внутри, камера уткнулась в обшивку снаружи или
   корабль просто не там, куда смотрит поза. Число отвечает сразу.

   Печатает на каждую долю: мировую точку глаза, точку взгляда, место
   корабля, расстояние глаза до оси корабля и до его наружной обшивки
   (радиус 3.45), и радиус зала изнутри (3.05). Отрицательный зазор до
   обшивки означает, что глаз ВНУТРИ корпуса.

   Запуск: node tools/дорога-финала.mjs [доли через запятую] */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const доли = (process.argv[2] || "0,0.15,0.30,0.45,0.60,0.75,0.90,1").split(",").map(Number);

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => {});
await стр.waitForTimeout(2000);

console.log("доля   глаз x,y,z                взгляд x,y,z             до оси  до обшивки  поле");
for (const д of доли) {
  await стр.evaluate((доля) => window.RV_MOTION["кПунктy"]("финал", доля), д);
  await стр.waitForTimeout(700);
  const r = await стр.evaluate(() => {
    const W = window.RV_WORLD["мир"]();
    const узел = window.RV_ФИНАЛ["узел"]();
    const о = узел ? узел.position : { x: 0, y: 0, z: 0 };
    const c = W.cam;
    const в = new W.T.Vector3();
    c.getWorldDirection(в);
    /* Расстояние до ОСИ корабля: ось вертикальная, значит меряем в
       плоскости пола, без высоты. */
    const dx = c.position.x - о.x, dz = c.position.z - о.z;
    return {
      гx: c.position.x, гy: c.position.y, гz: c.position.z,
      вx: в.x, вy: в.y, вz: в.z,
      ох: о.x, оy: о.y, оz: о.z,
      ось: Math.sqrt(dx * dx + dz * dz),
      поле: c.fov
    };
  });
  console.log(
    д.toFixed(2).padEnd(6),
    (r.гx.toFixed(1) + "," + r.гy.toFixed(1) + "," + r.гz.toFixed(1)).padEnd(24),
    (r.вx.toFixed(2) + "," + r.вy.toFixed(2) + "," + r.вz.toFixed(2)).padEnd(24),
    r.ось.toFixed(2).padStart(6),
    (r.ось - 3.45).toFixed(2).padStart(10),
    r.поле.toFixed(1).padStart(5)
  );
}
console.log("\nкорабль стоит в", await стр.evaluate(() => {
  const у = window.RV_ФИНАЛ["узел"]();
  return у ? [у.position.x, у.position.y, у.position.z].join(",") : "нет узла";
}));
await бр.close();
