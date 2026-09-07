/* Проверка находки про depthWrite у кольца комнаты, с замороженным временем. */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import fs from "node:fs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const ВЬЮ = { width: 390, height: 844 };
const КУДА = "/tmp/пров";
fs.mkdirSync(КУДА, { recursive: true });

const бр = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-lcd-text", "--force-device-scale-factor=1"]
});
const стр = await бр.newPage({ viewport: ВЬЮ, deviceScaleFactor: 1 });
стр.on("pageerror", (e) => console.log("ИСКЛ", e.message.slice(0, 200)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 300000 }).catch(() => console.log("вступление не кончилось"));
await стр.waitForTimeout(3000);

await стр.evaluate(() => {
  window.__найти = function (имя) {
    var W = window.RV_WORLD["мир"](); var р = null;
    W.scene.traverse(function (о) { if (о.name === имя) р = о; });
    return р;
  };
  window.__видноЦепь = function (о) {
    var п = о; while (п) { if (!п.visible) return false; п = п.parent; } return true;
  };
  window.__заморозить = function () {
    var W = window.RV_WORLD["мир"]();
    var t = W.часы;
    try { delete W.часы; } catch (e) {}
    Object.defineProperty(W, "часы", { get: function () { return t; }, set: function () {}, configurable: true });
    return t;
  };
});

function читать(буф) { return PNG.sync.read(буф); }
function разн(pa, pb, x0, x1, y0, y1) {
  let изм = 0, сум = 0, макс = 0, всего = 0;
  for (let y = Math.max(0, y0); y <= Math.min(pa.height - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(pa.width - 1, x1); x++) {
      const i = (y * pa.width + x) * 4;
      const d = Math.max(Math.abs(pa.data[i] - pb.data[i]), Math.abs(pa.data[i + 1] - pb.data[i + 1]), Math.abs(pa.data[i + 2] - pb.data[i + 2]));
      всего++;
      if (d > 3) { изм++; сум += d; if (d > макс) макс = d; }
    }
  }
  return { всего, изм, макс, ср: изм ? +(сум / изм).toFixed(1) : 0 };
}

const доли = [0.10, 0.55, 0.90];
for (const доля of доли) {
  await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("рубка", д), доля);
  await стр.waitForFunction(() => !window.RV_MSDF || !window.RV_MSDF["показИдёт"] || !window.RV_MSDF["показИдёт"](), null, { timeout: 120000 }).catch(() => {});
  await стр.waitForTimeout(4000);
  const t = await стр.evaluate(() => window.__заморозить());
  await стр.waitForTimeout(2500);

  const геом = await стр.evaluate(() => {
    const W = window.RV_WORLD["мир"](); const T = W.T, кам = W.cam;
    кам.updateMatrixWorld(true); W.scene.updateMatrixWorld(true);
    const о = window.__найти("кольцо комнаты");
    const г = о.geometry.attributes.position; const v = new T.Vector3();
    let sx0 = 1e9, sx1 = -1e9, sy0 = 1e9, sy1 = -1e9;
    for (let i = 0; i < г.count; i++) {
      v.fromBufferAttribute(г, i).applyMatrix4(о.matrixWorld);
      const п = v.clone().project(кам);
      sx0 = Math.min(sx0, п.x); sx1 = Math.max(sx1, п.x); sy0 = Math.min(sy0, п.y); sy1 = Math.max(sy1, п.y);
    }
    return { x0: Math.round((sx0 + 1) / 2 * innerWidth), x1: Math.round((sx1 + 1) / 2 * innerWidth),
             y0: Math.round((1 - sy1) / 2 * innerHeight), y1: Math.round((1 - sy0) / 2 * innerHeight) };
  });

  // A1 / A2 - шум при замороженном времени
  const a1 = читать(await стр.screenshot());
  await стр.waitForTimeout(2500);
  const a2 = читать(await стр.screenshot());
  // B - без записи глубины у обруча
  await стр.evaluate(() => { const о = window.__найти("кольцо комнаты"); о.material.depthWrite = false; о.material.needsUpdate = true; });
  await стр.waitForTimeout(2500);
  const b = читать(await стр.screenshot());
  // C - обруч вовсе спрятан
  await стр.evaluate(() => { const о = window.__найти("кольцо комнаты"); о.material.depthWrite = true; о.material.needsUpdate = true; о.visible = false; });
  await стр.waitForTimeout(2500);
  const c = читать(await стр.screenshot());
  await стр.evaluate(() => { const о = window.__найти("кольцо комнаты"); о.visible = true; });

  fs.writeFileSync(`${КУДА}/a-${доля}.png`, PNG.sync.write(a2));
  fs.writeFileSync(`${КУДА}/b-${доля}.png`, PNG.sync.write(b));

  const полоса = [геом.x0 - 6, геом.x1 + 6, геом.y0 - 6, геом.y1 + 6];
  const весь = [0, 389, 0, 843];
  console.log("=== доля", доля, "часы", t, "квад на экране", JSON.stringify(геом));
  console.log("  шум A1/A2  весь кадр", JSON.stringify(разн(a1, a2, ...весь)), " полоса", JSON.stringify(разн(a1, a2, ...полоса)));
  console.log("  A2 vs B(dw=0) весь", JSON.stringify(разн(a2, b, ...весь)), " полоса", JSON.stringify(разн(a2, b, ...полоса)));
  console.log("  A2 vs C(скрыт) весь", JSON.stringify(разн(a2, c, ...весь)), " полоса", JSON.stringify(разн(a2, c, ...полоса)));

  // где именно легли изменения A2 vs B
  let бх0 = 1e9, бх1 = -1e9, бy0 = 1e9, бy1 = -1e9, n = 0;
  for (let y = 0; y < a2.height; y++) for (let x = 0; x < a2.width; x++) {
    const i = (y * a2.width + x) * 4;
    const d = Math.max(Math.abs(a2.data[i] - b.data[i]), Math.abs(a2.data[i + 1] - b.data[i + 1]), Math.abs(a2.data[i + 2] - b.data[i + 2]));
    if (d > 3) { n++; if (x < бх0) бх0 = x; if (x > бх1) бх1 = x; if (y < бy0) бy0 = y; if (y > бy1) бy1 = y; }
  }
  console.log("  коробка изменений A2/B:", n ? `x ${бх0}..${бх1} y ${бy0}..${бy1} точек ${n}` : "нет");
}

await бр.close();
