/* ЧТО СТОИТ ПО КРАЯМ КАДРА. Луч из камеры через сетку точек экрана,
   и по каждой - имя предмета, в который он попал.

   Снимок финала 0.87 на мониторе показал рубку в середине кадра и
   чёрные поля слева и справа, а внизу светлую дугу. Глазом не понять,
   что это: неосвещённая стена салона, дыра в обшивке или чужая
   геометрия зала, просвечивающая мимо пола. Луч отвечает именем.

   Запуск: node tools/что-по-краям.mjs [акт] [доля] [пк|тел] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const АКТ = process.argv[2] || "финал";
const ДОЛЯ = +(process.argv[3] || 0.87);
const КТО = process.argv[4] || "пк";
const экран = КТО === "пк" ? { w: 1440, h: 900, моб: false } : { w: 390, h: 844, моб: true };

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
await стр.evaluate(([а, д]) => window.RV_MOTION["кПунктy"](а, д), [АКТ, ДОЛЯ]);
await стр.evaluate(() => new Promise((г) => {
  let n = 0; (function ш() { requestAnimationFrame(() => (++n >= 90 ? г() : ш())); })();
}));

const сетка = await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"](), T = W.T;
  function mm_прозрачна(м) {
    if (!м) return false;
    if (м.depthWrite === false) return true;
    if (м.transparent && (м.opacity === undefined || м.opacity < 0.98)) return true;
    return false;
  }
  const луч = new T.Raycaster();
  луч.far = 4000;
  const строки = [];
  const доли = [0.04, 0.12, 0.22, 0.35, 0.5, 0.65, 0.78, 0.88, 0.96];
  for (const y of [0.12, 0.3, 0.5, 0.7, 0.88]) {
    const строка = [];
    for (const x of доли) {
      луч.setFromCamera(new T.Vector2(x * 2 - 1, 1 - y * 2), W.cam);
      const п = луч.intersectObjects(W.scene.children, true);
      let имя = "пусто", д = null;
      /* Прозрачные и не пишущие глубину слои луч ловит наравне со
         стенами, хотя глазом сквозь них всё видно: оболочка подземелья
         накрывает камеру и отвечала на КАЖДЫЙ луч расстоянием ноль.
         Спрашиваем первую НЕПРОЗРАЧНУЮ поверхность - ту, которую
         человек и видит. */
      for (const h of п) {
        const м = h.object.material;
        const мм = Array.isArray(м) ? м[0] : м;
        if (мм && (mm_прозрачна(мм) || h.distance < 0.02)) continue;
        let о = h.object, видно = о.visible, у = о;
        while (видно && у) { if (!у.visible) видно = false; у = у.parent; }
        if (!видно) continue;
        о = h.object;
        имя = о.name || о.type;
        /* Безымянной детали спрашиваем родителя: у сборок имя живёт на
           узле, а не на каждом меше. */
        let р = о.parent, шаг = 0;
        while ((!имя || имя === "Mesh" || имя === "Object3D") && р && шаг < 5) {
          if (р.name) { имя = р.name; break; }
          р = р.parent; шаг++;
        }
        д = +h.distance.toFixed(2);
        break;
      }
      строка.push(`${имя}${д === null ? "" : "@" + д}`);
    }
    строки.push(`y=${y}: ` + строка.join(" | "));
  }
  const c = W.cam.position;
  return { строки, камера: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)],
           поле: +W.cam.fov.toFixed(1) };
});

console.log(`${АКТ} ${ДОЛЯ} ${КТО}: камера ${сетка.камера.join(", ")}, поле ${сетка.поле}`);
for (const с of сетка.строки) console.log("  " + с);
await бр.close();
