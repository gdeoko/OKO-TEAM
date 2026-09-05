/* Что стоит в кадре финала на каждой доле.

   ЗАЧЕМ. Снимок доли 0.05 показал ровный серый кадр без корабля.
   Глазом отсюда не понять, чего не хватает: корабль не собрался, он вне
   кадра, он погашен, или его закрывает что-то ближе. Число отвечает
   сразу: где камера, где коробка корабля, куда она проецируется на
   экран и видно ли её вообще.

   Экранные доли: 0 это левая и верхняя кромка, 1 правая и нижняя.
   Корабль в кадре - когда прямоугольник пересекается с 0..1.

   Запуск: node tools/кадр-финала.mjs [доли через запятую] */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const доли = (process.argv[2] || "0.05,0.30,0.60,0.97").split(",").map(Number);

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
стр.on("pageerror", (e) => console.log("ИСКЛ", e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => {});
await стр.waitForTimeout(1500);

console.log("доля  глаз x,y,z             поле  виден  низ..верх       экран л,в,п,н        доля");
for (const д of доли) {
  await стр.evaluate((доля) => window.RV_MOTION["кПунктy"]("финал", доля), д);
  await стр.waitForTimeout(900);
  const r = await стр.evaluate(() => {
    const W = window.RV_WORLD["мир"]();
    const T = W.T, c = W.cam;
    const узел = window.RV_КОРАБЛЬ && window.RV_КОРАБЛЬ["узел"] && window.RV_КОРАБЛЬ["узел"]();
    const о = { гx: c.position.x, гy: c.position.y, гz: c.position.z, поле: c.fov };
    if (!узел) { о.нет = "узла корабля нет"; return о; }
    /* Видимость считаем по всей цепочке родителей: погашенный предок
       гасит и потомка, а visible самого узла об этом молчит. */
    let вид = true, п = узел;
    while (п) { if (!п.visible) { вид = false; break; } п = п.parent; }
    о.виден = вид;
    узел.updateMatrixWorld(true);
    const б = new T.Box3().setFromObject(узел);
    о.низ = +б.min.y.toFixed(2); о.верх = +б.max.y.toFixed(2);
    /* Проекция восьми углов коробки: экранный прямоугольник предмета. */
    c.updateMatrixWorld(true);
    const v = new T.Vector3();
    let л = 9, вх = 9, пр = -9, нз = -9, зa = 0;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? б.max.x : б.min.x, i & 2 ? б.max.y : б.min.y, i & 4 ? б.max.z : б.min.z);
      v.project(c);
      if (v.z > 1) зa++;
      const sx = (v.x + 1) / 2, sy = (1 - v.y) / 2;
      if (sx < л) л = sx; if (sx > пр) пр = sx;
      if (sy < вх) вх = sy; if (sy > нз) нз = sy;
    }
    о.экран = [л, вх, пр, нз].map((n) => +n.toFixed(2));
    о.заСпиной = зa;
    о.высотаВКадре = +Math.min(1, Math.max(0, нз - вх)).toFixed(2);
    return о;
  });
  console.log(
    д.toFixed(2).padEnd(5),
    (r.гx.toFixed(1) + "," + r.гy.toFixed(1) + "," + r.гz.toFixed(1)).padEnd(21),
    r.поле.toFixed(0).padStart(4),
    String(r.виден).padStart(6),
    ((r.низ == null ? "?" : r.низ) + ".." + (r.верх == null ? "?" : r.верх)).padStart(14),
    r.нет ? r.нет : (r.экран.join(",").padStart(22) + "  " + r.высотаВКадре +
                    (r.заСпиной ? "  за спиной " + r.заСпиной : ""))
  );
}
await бр.close();
