/* Что именно занимает кусок кадра. Инструмент против угадывания.

   ЗАЧЕМ. Владелец показал кадр ангара: «какой-то круглый купол вокруг
   ракеты, его убрать». Купол видно, а чей он - нет: в этом месте стоят
   разом фигура из частиц, две стены зала с текстом, силовое поле под
   фигурой, дымка, пол и оболочка подземелья. Я снял по имени первый
   подходящий предмет, и купол остался на месте - потому что это был не
   он.

   Здесь ответ берётся числом. Каждый видимый предмет сцены проецируется
   мировой коробкой на экран, и печатается его прямоугольник в точках.
   Предмет, чей прямоугольник совпал с куполом, и есть купол.

   Запуск: node tools/что-в-кадре.mjs [акт] [доля] */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const АКТ = process.argv[2] || "рубка";
const ДОЛЯ = +(process.argv[3] || 0.55);

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => {});
await стр.evaluate(([и, x]) => window.RV_MOTION["кПунктy"](и, x), [АКТ, ДОЛЯ]);
await стр.waitForTimeout(3500);

const список = await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  const T = W.T, кам = W.cam;
  кам.updateMatrixWorld(true);
  const ш = window.innerWidth, в = window.innerHeight;
  const из = [];
  const коробка = new T.Box3(), точка = new T.Vector3();
  W.scene.traverse((узел) => {
    if (!узел.isMesh && !узел.isPoints && !узел.isLine) return;
    let род = узел, виден = true;
    while (род) { if (!род.visible) { виден = false; break; } род = род.parent; }
    if (!виден) return;
    узел.updateMatrixWorld(true);
    коробка.setFromObject(узел);
    if (!isFinite(коробка.min.x) || коробка.isEmpty()) return;
    /* Проецируем ВОСЕМЬ углов коробки: одна середина сказала бы только
       где предмет, а не сколько кадра он занимает. */
    let л = 1e9, п = -1e9, вх = 1e9, н = -1e9, заСпиной = 0;
    for (let i = 0; i < 8; i++) {
      точка.set(i & 1 ? коробка.max.x : коробка.min.x,
                i & 2 ? коробка.max.y : коробка.min.y,
                i & 4 ? коробка.max.z : коробка.min.z);
      точка.applyMatrix4(кам.matrixWorldInverse);
      if (точка.z > -0.01) { заСпиной++; continue; }
      точка.applyMatrix4(кам.projectionMatrix);
      const x = (точка.x * 0.5 + 0.5) * ш, y = (0.5 - точка.y * 0.5) * в;
      if (x < л) л = x; if (x > п) п = x;
      if (y < вх) вх = y; if (y > н) н = y;
    }
    if (заСпиной === 8) return;
    из.push({
      имя: узел.name || узел.type,
      род: узел.parent && узел.parent.name ? узел.parent.name : "",
      тип: узел.isPoints ? "точки" : (узел.isLine ? "линия" : "меш"),
      л: Math.round(л), п: Math.round(п), в: Math.round(вх), н: Math.round(н),
      ш: Math.round(п - л), вы: Math.round(н - вх),
      порядок: узел.renderOrder,
      режим: узел.material && узел.material.blending != null ? узел.material.blending : -1,
      прозр: !!(узел.material && узел.material.transparent)
    });
  });
  /* Мельчайшие сверху не нужны: сортируем по площади в кадре. */
  из.sort((a, b) => (b.ш * b.вы) - (a.ш * a.вы));
  return из;
});

console.log(`акт ${АКТ} доля ${ДОЛЯ} · кадр 1440x900 · видимых предметов ${список.length}\n`);
console.log("площадь  лево прав верх  низ   ширина·высота  порядок  имя");
for (const п of список.slice(0, 25)) {
  const пл = Math.round(п.ш * п.вы / 1000);
  console.log(
    String(пл).padStart(6) + "к",
    String(п.л).padStart(5), String(п.п).padStart(4),
    String(п.в).padStart(4), String(п.н).padStart(5),
    (п.ш + "x" + п.вы).padStart(14),
    String(п.порядок).padStart(7),
    " " + п.тип + " " + п.имя + (п.род ? " (в " + п.род + ")" : ""));
}
await бр.close();
