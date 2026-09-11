/* ЧТО ВООБЩЕ СТОИТ В КАДРЕ. Перепись видимых тел, а не догадки.

   Владелец: «ещё какой-то круг везде появляется, убери лишние круги,
   очертания, невидимые наложения и тд». Искать такое чтением кода
   долго: акт большой, тел в нём десятки, и половина гасится в трёх
   разных местах. Быстрее спросить саму сцену.

   Инструмент обходит ВСЁ дерево мира на заданной доле заданного акта и
   печатает каждое видимое тело, которое попадает в кадр: имя, вид
   геометрии, размер на экране в долях кадра, прозрачность, смешивание,
   порядок отрисовки и путь по дереву. Сортировка по площади на экране,
   поэтому первым идёт то, что закрывает собой больше всего.

   Так находится и большой полупрозрачный клин поверх стены, и кольцо,
   которое забыли погасить, и плоскость-заглушка с нулевой
   непрозрачностью, которая при этом пишет глубину.

   Запуск: node tools/что-в-кадре.mjs [тел|пк] [акт] [доля] [сколько] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "тел";
const АКТ = process.argv[3] || "периметр";
const ДОЛЯ = +(process.argv[4] || 0.66);
const СКОЛЬКО = +(process.argv[5] || 26);
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: экран, deviceScaleFactor: 1, isMobile: КТО === "тел", hasTouch: КТО === "тел"
});
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 140)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(4000);
await стр.evaluate(([и, x]) => window.RV_MOTION["кПунктy"](и, x), [АКТ, ДОЛЯ]);
await стр.evaluate(() => new Promise((г) => {
  let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 20 ? г() : ш())); })();
}));

const список = await стр.evaluate(() => {
  const T = window.THREE, мир = window.RV_WORLD["мир"](), cam = мир.cam;
  cam.updateMatrixWorld(true);
  let сцена = cam; while (сцена.parent) сцена = сцена.parent;
  сцена.updateMatrixWorld(true);
  const из = [];
  const короб = new T.Box3(), п = new T.Vector3();
  /* Тело считается видимым, только если видимы ВСЕ его родители: один
     погашенный узел выше по дереву прячет всю ветку, и спрашивать
     visible у самого тела недостаточно. */
  function виденЦеликом(о) {
    for (let у = о; у; у = у.parent) if (!у.visible) return false;
    return true;
  }
  function путь(о) {
    const ч = [];
    for (let у = о; у && у.parent; у = у.parent) ч.unshift(у.name || у.type);
    return ч.slice(-4).join("/");
  }
  сцена.traverse((о) => {
    if (!(о.isMesh || о.isPoints || о.isLine || о.isLineSegments || о.isSprite)) return;
    if (!виденЦеликом(о)) return;
    const м = Array.isArray(о.material) ? о.material[0] : о.material;
    if (!м) return;
    /* Совсем прозрачное в кадре не видно, но ЗАПИСАТЬ его надо: оно и
       есть то самое «невидимое наложение», если при этом пишет глубину
       и режет собой то, что за ним. */
    const альфа = м.opacity == null ? 1 : м.opacity;
    let габарит = null;
    try {
      короб.setFromObject(о);
      if (короб.isEmpty()) return;
    } catch (e) { return; }
    /* Восемь углов коробки в кадр: по ним и площадь, и то, попало ли
       тело в кадр вообще. */
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9, спереди = 0;
    for (let b = 0; b < 8; b++) {
      п.set(b & 1 ? короб.max.x : короб.min.x,
            b & 2 ? короб.max.y : короб.min.y,
            b & 4 ? короб.max.z : короб.min.z).project(cam);
      if (п.z > -1 && п.z < 1) спереди++;
      x0 = Math.min(x0, п.x); x1 = Math.max(x1, п.x);
      y0 = Math.min(y0, п.y); y1 = Math.max(y1, п.y);
    }
    if (!спереди) return;
    /* Площадь пересечения с кадром в долях кадра: рамка это [-1..1]. */
    const пx = Math.max(0, Math.min(1, x1) - Math.max(-1, x0));
    const пy = Math.max(0, Math.min(1, y1) - Math.max(-1, y0));
    const доля = (пx * пy) / 4;
    if (доля < 0.0008) return;
    габарит = [+(x1 - x0).toFixed(2), +(y1 - y0).toFixed(2)];
    из.push({
      имя: о.name || "", вид: о.isPoints ? "точки"
           : (о.isLineSegments || о.isLine) ? "линии" : (о.isSprite ? "спрайт" : "меш"),
      гео: о.geometry ? о.geometry.type : "?",
      доляКадра: +доля.toFixed(3), габарит,
      альфа: +альфа.toFixed(2), прозр: !!м.transparent,
      глубину: м.depthWrite !== false, тест: м.depthTest !== false,
      смешение: м.blending === T.AdditiveBlending ? "сложение"
                : (м.blending === T.MultiplyBlending ? "умножение" : "обычное"),
      порядок: о.renderOrder || 0, мат: м.type, путь: путь(о),
    });
  });
  из.sort((а, б) => б.доляКадра - а.доляКадра);
  return из;
});

console.log(`ЧТО В КАДРЕ ${КТО} ${экран.width}x${экран.height}, акт «${АКТ}» доля ${ДОЛЯ}`);
console.log(`  тел в кадре ${список.length}, показываю ${Math.min(СКОЛЬКО, список.length)}`);
console.log("  доля  габарит      альфа гл  смешение   порядок  что");
for (const т of список.slice(0, СКОЛЬКО)) {
  console.log(`  ${String(т.доляКадра).padEnd(5)} ${JSON.stringify(т.габарит).padEnd(12)}` +
              ` ${String(т.альфа).padEnd(5)} ${т.глубину ? "да" : "нет"}` +
              ` ${т.смешение.padEnd(10)} ${String(т.порядок).padEnd(7)}` +
              ` ${т.вид}/${т.гео} ${т.имя ? "«" + т.имя + "» " : ""}${т.путь}`);
}

/* Подозрительное называем отдельно: то, что закрывает собой полкадра и
   при этом прозрачно, и то, что невидимо глазом, но пишет глубину. */
console.log("  ── подозрительное ──");
let подозрений = 0;
for (const т of список) {
  if (т.доляКадра > 0.25 && т.прозр && т.альфа < 0.9) {
    подозрений++;
    console.log(`  клин на ${Math.round(т.доляКадра * 100)}% кадра при альфе ${т.альфа}: ` +
                `${т.вид}/${т.гео} ${т.путь}`);
  }
  if (т.альфа < 0.04 && т.глубину) {
    подозрений++;
    console.log(`  невидимо, но пишет глубину (режет собой всё за ним): ` +
                `${т.вид}/${т.гео} ${т.путь}`);
  }
}
if (!подозрений) console.log("  ничего");
await бр.close();
