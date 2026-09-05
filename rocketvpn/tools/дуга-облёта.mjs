/* Азимут камеры вокруг ракеты по всему обходу.

   ЗАЧЕМ. Проверка хода нашла разворот взгляда в 2751 градус на сотню
   точек на стыке пуска с финалом и три длинных куска полёта боком. Обе
   беды об одном: камера идёт вокруг ракеты не по дуге, а рывками.

   Разобрать это по коду позы нельзя: узлы считаются от вектора «вбок»,
   знак которого живёт в ядре, и вывод «ангар идёт от нуля до
   пятидесяти» может оказаться ровно наоборот. Меряем.

   Печатает на каждой доле азимут камеры вокруг середины зала (ноль это
   направление на +Z, растёт по часовой) и радиус. Ровный обход это
   азимут, идущий в ОДНУ сторону без скачков, при постоянном радиусе.

   Запуск: node tools/дуга-облёта.mjs */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
/* Середина зала обхода: та же точка, что стоит в позах ангара и пуска
   полем «на». Спрашивать её у комнаты нельзя - там своя середина
   фигуры, поднятая над дном. */
const ЦЕНТР = { x: 0, z: -4 };

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 } });
стр.on("pageerror", (e) => console.log("ИСКЛ", e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => console.log("вступления не дождались"));
await стр.waitForTimeout(1200);

console.log("акт      доля   азимут°  радиус  высота   мимо цели°");
for (const [акт, доли] of [["рубка", [0.9, 1]],
                           ["пуск", [0, 0.5, 0.86, 0.9, 0.94, 0.97, 1]],
                           ["финал", [0, 0.02, 0.05, 0.1, 0.2, 0.35]]]) {
  for (const д of доли) {
    await стр.evaluate(([и, x]) => window.RV_MOTION["кПунктy"](и, x), [акт, д]);
    await стр.waitForTimeout(800);
    const r = await стр.evaluate((ц) => {
      const W = window.RV_WORLD["мир"]();
      const T = W.T, c = W.cam;
      const dx = c.position.x - ц.x, dz = c.position.z - ц.z;
      const аз = Math.atan2(dx, dz) * 180 / Math.PI;
      const в = new T.Vector3();
      c.getWorldDirection(в);
      const рад = Math.sqrt(dx * dx + dz * dz);
      /* НА СКОЛЬКО ВЗГЛЯД МИМО ЦЕЛИ. Азимут точки взгляда тут не
         годится: когда луч попадает В САМУ середину, проекция ложится
         на неё, и atan2 почти нулевого вектора отдаёт шум - первый
         заход показал -163 градуса ровно там, где камера смотрела
         точно на ракету. Угол между курсом и направлением на середину
         фигуры не врёт никогда. */
      const ф = (window.RV_КОМНАТА && window.RV_КОМНАТА["серединаФигуры"])
        ? window.RV_КОМНАТА["серединаФигуры"]() : { x: ц.x, y: c.position.y, z: ц.z };
      const к = new T.Vector3(ф.x - c.position.x, ф.y - c.position.y, ф.z - c.position.z);
      к.normalize();
      const мимо = Math.acos(Math.max(-1, Math.min(1, в.dot(к)))) * 180 / Math.PI;
      return { аз: аз, рад: рад, y: c.position.y, азВ: мимо };
    }, ЦЕНТР);
    console.log(
      акт.padEnd(8), д.toFixed(2).padEnd(6),
      r.аз.toFixed(1).padStart(7), r.рад.toFixed(1).padStart(7),
      r.y.toFixed(1).padStart(7), r.азВ.toFixed(1).padStart(12));
  }
}
await бр.close();
