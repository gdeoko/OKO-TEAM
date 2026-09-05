/* Короткий разбор кадра финала: где камера, где корабль и на сколько
   градусов прицел разошёлся с направлением на него.

   ЗАЧЕМ ИМЕННО УГОЛ. Проекция коробки на экран врёт, когда часть углов
   уходит за дальнюю плоскость: числа получаются правдоподобные и
   бессмысленные. Угол между курсом камеры и направлением на середину
   корабля не врёт никогда - он либо меньше половины поля зрения (тогда
   корабль в кадре), либо больше (тогда нет).

   Запуск: node tools/диаг-финала.mjs [доли через запятую] */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const доли = (process.argv[2] || "0.02,0.30,0.60,0.97").split(",").map(Number);

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 } });
стр.on("pageerror", (e) => console.log("ИСКЛ", e.message.slice(0, 200)));
стр.on("crash", () => console.log("СТРАНИЦА УПАЛА"));
стр.on("console", (m) => {
  if (m.type() !== "error") return;
  const т = m.text();
  if (!/ERR_CERT|ERR_PROXY/.test(т)) console.log("КОНС", т.slice(0, 200));
});

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => console.log("вступления не дождались"));
console.log("вступление кончилось");

console.log("доля  глаз                центр корабля      даль  угол  поле  в кадре");
for (const д of доли) {
  try {
    await стр.evaluate((x) => window.RV_MOTION["кПунктy"]("финал", x), д);
    await стр.waitForTimeout(1000);
    const r = await стр.evaluate(() => {
      const W = window.RV_WORLD["мир"]();
      const T = W.T, c = W.cam;
      const у = window.RV_КОРАБЛЬ && window.RV_КОРАБЛЬ["узел"] && window.RV_КОРАБЛЬ["узел"]();
      if (!у) return { нет: 1 };
      у.updateMatrixWorld(true);
      const б = new T.Box3().setFromObject(у);
      const ц = б.getCenter(new T.Vector3());
      const вп = new T.Vector3();
      c.getWorldDirection(вп);
      const к = ц.clone().sub(c.position);
      const даль = к.length();
      к.normalize();
      const угол = Math.acos(Math.max(-1, Math.min(1, вп.dot(к)))) * 180 / Math.PI;
      /* Половина поля по вертикали: корабль в кадре, когда его середина
         ближе к курсу, чем эта половина. */
      const пол = c.fov / 2;
      return {
        глаз: [+c.position.x.toFixed(1), +c.position.y.toFixed(1), +c.position.z.toFixed(1)],
        центр: [+ц.x.toFixed(1), +ц.y.toFixed(1), +ц.z.toFixed(1)],
        даль: +даль.toFixed(1), угол: +угол.toFixed(1), поле: +c.fov.toFixed(0),
        вКадре: угол < пол
      };
    });
    if (r.нет) { console.log(д.toFixed(2), "узла корабля нет"); continue; }
    console.log(
      д.toFixed(2).padEnd(5),
      r.глаз.join(",").padEnd(19),
      r.центр.join(",").padEnd(18),
      String(r.даль).padStart(5),
      String(r.угол).padStart(5),
      String(r.поле).padStart(5),
      r.вКадре ? "да" : "НЕТ"
    );
  } catch (e) {
    console.log(д.toFixed(2), "БЕДА", String(e).slice(0, 200));
  }
}
await бр.close();
