/* ЧТО СТОИТ В ТОЧКЕ КАДРА. Сетка «что-по-краям» называет группу, а не
   деталь: в финале всё отвечает «салон», и тёмный прямоугольник справа
   внизу на мониторе остаётся безымянным. Здесь луч через одну точку и
   полный паспорт попадания: имя детали и цепочка родителей, тип сетки,
   материал, цвет, есть ли карта, прозрачность, расстояние.

   Запуск: node tools/что-в-точке.mjs <акт> <доля> <пк|тел> <x> <y> [x y ...]
   x и y в долях кадра от левого верхнего угла. */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const [АКТ, ДОЛЯ, КТО, ...ТОЧКИ] = process.argv.slice(2);
const экран = КТО === "тел" ? { w: 390, h: 844, моб: true } : { w: 1440, h: 900, моб: false };
const пары = [];
for (let i = 0; i + 1 < ТОЧКИ.length; i += 2) пары.push([+ТОЧКИ[i], +ТОЧКИ[i + 1]]);

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: 1, isMobile: экран.моб, hasTouch: экран.моб
});
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
  null, { timeout: 300000 });
await стр.waitForTimeout(2500);
await стр.evaluate(([а, д]) => window.RV_MOTION["кПунктy"](а, +д), [АКТ, ДОЛЯ]);
await стр.evaluate(() => new Promise((г) => {
  let n = 0; (function ш() { requestAnimationFrame(() => (++n >= 90 ? г() : ш())); })();
}));
await стр.screenshot({ path: `/tmp/точка-${АКТ}-${КТО}.png` });

const ответ = await стр.evaluate((пары) => {
  const W = window.RV_WORLD["мир"](), T = W.T;
  const луч = new T.Raycaster();
  луч.far = 4000;
  const из = [];
  for (const [x, y] of пары) {
    луч.setFromCamera(new T.Vector2(x * 2 - 1, 1 - y * 2), W.cam);
    const п = луч.intersectObjects(W.scene.children, true);
    const строки = [];
    let n = 0;
    for (const h of п) {
      const о = h.object;
      let видно = true, у = о;
      while (видно && у) { if (!у.visible) видно = false; у = у.parent; }
      if (!видно) continue;
      const м = Array.isArray(о.material) ? о.material[0] : о.material;
      const цепь = [];
      let р = о, ш = 0;
      while (р && ш++ < 6) { цепь.push(р.name || р.type); р = р.parent; }
      строки.push(`${цепь.join(" < ")} · ${о.geometry ? о.geometry.type : "?"} · ${м ? м.type : "?"}` +
        (м && м.color ? " #" + м.color.getHexString() : "") +
        (м && м.map ? " +карта" : "") +
        (м && м.emissive ? " emis#" + м.emissive.getHexString() : "") +
        (м && м.transparent ? ` прозр op=${м.opacity}` : "") +
        (м && м.depthWrite === false ? " noDepth" : "") +
        ` @${h.distance.toFixed(2)}` + (о.renderOrder ? ` order=${о.renderOrder}` : ""));
      if (++n >= 5) break;
    }
    из.push({ точка: [x, y], попадания: строки });
  }
  return из;
}, пары);
for (const о of ответ) {
  console.log(`(${о.точка.join(", ")}):`);
  for (const с of о.попадания) console.log("   " + с);
}
console.log(`снимок /tmp/точка-${АКТ}-${КТО}.png`);
await бр.close();
