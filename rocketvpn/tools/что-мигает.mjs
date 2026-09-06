/* ЧТО МИГАЕТ В НЕПОДВИЖНОМ КАДРЕ.

   ЗАЧЕМ. Владелец: «абсолютно на всём сайте какой-то круг синего цвета
   постоянно моргает мерцает, нужно этот круг вообще нафиг удалить».
   Круг видно ему, а мне по имени предмета не видно ничего: мигать в
   сцене может пыль, маяк, ореол кольца, поле фигуры, приборная
   разметка. Гадать по именам я уже пробовал и один раз снял не тот
   предмет.

   Здесь ответ берётся числом. Прокрутка СТОИТ, снимается несколько
   кадров подряд, и считается разница между ними по точкам. Всё, что
   меняется при неподвижной камере, и есть мерцание. Дальше место
   мерцания сопоставляется с экранными коробками видимых предметов, и
   печатается тот, кто это место закрывает.

   Запуск: node tools/что-мигает.mjs [акт] [доля] [кадров] */
import { chromium } from "playwright";
import { PNG } from "pngjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const АКТ = process.argv[2] || "станция";
const ДОЛЯ = +(process.argv[3] || 0.5);
const КАДРОВ = +(process.argv[4] || 6);

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 720, height: 900 }, deviceScaleFactor: 1 });
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => {});
await стр.evaluate(([и, x]) => window.RV_MOTION["кПунктy"](и, x), [АКТ, ДОЛЯ]);

/* ── СНАЧАЛА КАМЕРА ДОЛЖНА ВСТАТЬ ─────────────────────────────────
   Первая редакция ждала четыре секунды и насчитала мерцание на
   четверти кадра. Это было не мерцание: сглаживание прокрутки igloo
   подтягивает камеру долями остатка, и на программном отрисовщике
   последние единицы она добирает десятками кадров. Двигалась камера, а
   не предметы.

   Ждём, пока камера перестанет ехать: три замера подряд со сдвигом
   меньше сотой единицы. Только после этого всё, что меняется в кадре,
   действительно мерцает само. */
{
  let было = null, тихих = 0, кругов = 0;
  while (тихих < 3 && кругов < 200) {
    const п = await стр.evaluate(() => {
      const c = window.RV_WORLD["мир"]().cam.position;
      return [c.x, c.y, c.z];
    });
    if (было) {
      const d = Math.hypot(п[0] - было[0], п[1] - было[1], п[2] - было[2]);
      тихих = d < 0.01 ? тихих + 1 : 0;
    }
    было = п; кругов++;
    await стр.waitForTimeout(250);
  }
  console.log(`камера встала за ${кругов} замеров`);
}

const кадры = [];
for (let i = 0; i < КАДРОВ; i++) {
  кадры.push(PNG.sync.read(await стр.screenshot()));
  await стр.waitForTimeout(400);
}

/* Средняя яркость каждого кадра. Если мерцает ВЕСЬ кадр разом - это не
   предмет в сцене, а конвейер после сцены: два прохода отделки в
   очередь дают именно такую картину. */
console.log("средняя яркость кадров: " + кадры.map((к) => {
  let с = 0;
  for (let p = 0; p < к.width * к.height; p++) {
    с += (к.data[p * 4] + к.data[p * 4 + 1] + к.data[p * 4 + 2]) / 3;
  }
  return (с / (к.width * к.height)).toFixed(1);
}).join(" "));

/* Карта размаха: для каждой точки разница между самым светлым и самым
   тёмным кадром. Камера стоит, значит всё ненулевое здесь - мерцание. */
const { width: W, height: H } = кадры[0];
const размах = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  let мин = 999, макс = -1, синьМакс = 0, красМакс = 0;
  for (const к of кадры) {
    const я = (к.data[p * 4] + к.data[p * 4 + 1] + к.data[p * 4 + 2]) / 3;
    if (я < мин) мин = я;
    if (я > макс) { макс = я; синьМакс = к.data[p * 4 + 2]; красМакс = к.data[p * 4]; }
  }
  размах[p] = Math.min(255, Math.round(макс - мин));
  /* Синева отмечается отдельным разрядом: владелец говорит про синий
     круг, и надо отличить его от белой пыли. */
  if (размах[p] > 8 && синьМакс > красМакс + 18) размах[p] |= 0; /* пометка ниже */
}

let всего = 0, сумX = 0, сумY = 0, макс = 0, мx = 0, мy = 0;
let синих = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = y * W + x;
  if (размах[p] <= 8) continue;
  всего++; сумX += x; сумY += y;
  if (размах[p] > макс) { макс = размах[p]; мx = x; мy = y; }
  let сМ = 0, кМ = 0;
  for (const к of кадры) { сМ = Math.max(сМ, к.data[p * 4 + 2]); кМ = Math.max(кМ, к.data[p * 4]); }
  if (сМ > кМ + 18) синих++;
}

console.log(`акт ${АКТ} доля ${ДОЛЯ}, кадров ${КАДРОВ}, поле ${W}x${H}`);
console.log(`мерцающих точек ${всего} (${(всего / (W * H) * 100).toFixed(2)}% кадра), ` +
            `из них синих ${синих} (${всего ? (синих / всего * 100).toFixed(0) : 0}%)`);
if (всего) {
  console.log(`середина мерцания ${Math.round(сумX / всего)},${Math.round(сумY / всего)} · ` +
              `самая яркая точка ${мx},${мy} размах ${макс}`);
}

/* Кто закрывает самую мерцающую точку. */
const кто = await стр.evaluate(([x, y]) => {
  const W = window.RV_WORLD, м = W["мир"]();
  const кам = м.cam, сц = м.scene;
  const из = [];
  сц.traverse((о) => {
    if (!о.visible || !о.geometry) return;
    let в = о;
    while (в) { if (!в.visible) return; в = в.parent; }
    const г = о.geometry;
    if (!г.boundingBox) г.computeBoundingBox();
    const бб = г.boundingBox;
    if (!бб) return;
    const ш = innerWidth, в2 = innerHeight;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < 8; i++) {
      const p = new (о.position.constructor)(
        i & 1 ? бб.max.x : бб.min.x,
        i & 2 ? бб.max.y : бб.min.y,
        i & 4 ? бб.max.z : бб.min.z);
      о.localToWorld(p); p.project(кам);
      const sx = (p.x * 0.5 + 0.5) * ш, sy = (-p.y * 0.5 + 0.5) * в2;
      if (p.z > 1) continue;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    if (x1 < x0) return;
    if (x < x0 || x > x1 || y < y0 || y > y1) return;
    из.push({
      имя: о.name || о.type,
      площадь: Math.round((x1 - x0) * (y1 - y0)),
      коробка: [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)],
      материал: о.material && о.material.type,
      цвет: о.material && о.material.color ? "#" + о.material.color.getHexString() : null
    });
  });
  из.sort((a, b) => a.площадь - b.площадь);
  return из.slice(0, 12);
}, [мx, мy]).catch((e) => [{ имя: "ошибка: " + e.message }]);

console.log("\nкто закрывает самую мерцающую точку (от мелких к крупным):");
for (const о of кто) console.log("   " + JSON.stringify(о));
await бр.close();
