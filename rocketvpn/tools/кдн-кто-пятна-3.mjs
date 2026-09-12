/* КТО РИСУЕТ ПЯТНА, ТРЕТИЙ ЗАХОД. Без холста клякс нет, без мешей
   клякс нет, без прозрачных мешей они есть: значит их рисуют
   НЕПРОЗРАЧНЫЕ меши. Печатаем все видимые непрозрачные меши с их
   размером на экране (по описанной сфере), картой и цветом, и гасим те,
   что выходят от 6 до 90 пикселей: кляксы ровно такого размера.

   Запуск: node tools/кдн-кто-пятна-3.mjs [тел|пк] [адрес] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "тел";
const АДРЕС = process.argv[3] || "http://127.0.0.1:8171/?rcdbg=1";
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
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 200)));
await стр.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RC_GL && window.RC_GL.ready3d, null, { timeout: 300000 });
await стр.waitForTimeout(2000);
async function кадры(n) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), n);
}
await стр.evaluate(() => window.RC_FLIGHT.open());
await стр.waitForFunction(() => document.querySelector(".rcf-brief button[data-mode=auto]"), null, { timeout: 60000 });
await кадры(20);
await стр.evaluate(() => document.querySelector(".rcf-brief button[data-mode=manual]").click());
await кадры(20);
await стр.evaluate(() => window.RC_FLIGHT._пост(false));
await кадры(50);
await стр.screenshot({ path: `/tmp/пятна3-${КТО}-все.png` });

const список = await стр.evaluate(() => {
  const cam = window.RC_FLIGHT._cam();
  let scene = cam; while (scene.parent) scene = scene.parent;
  const T = window.THREE;
  const камПоз = new T.Vector3(); cam.getWorldPosition(камПоз);
  const tanF = Math.tan((cam.fov * Math.PI / 180) / 2);
  const h = innerHeight;
  const мир = new T.Vector3(), мс = new T.Vector3();
  const из = [];
  scene.traverse((о) => {
    if (!о.isMesh || о.isInstancedMesh) return;
    let у = о, видно = true;
    while (у) { if (!у.visible) { видно = false; break; } у = у.parent; }
    if (!видно) return;
    const м = Array.isArray(о.material) ? о.material[0] : о.material;
    if (!м || м.transparent) return;
    const g = о.geometry;
    if (!g) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere) return;
    о.localToWorld(мир.copy(g.boundingSphere.center));
    о.getWorldScale(мс);
    const рад = g.boundingSphere.radius * Math.max(мс.x, мс.y, мс.z);
    const глуб = мир.distanceTo(камПоз);
    const пикс = рад * 2 * (h / 2) / (Math.max(0.5, глуб - рад) * tanF);
    let имя = о.name, р = о.parent, ш = 0;
    while (!имя && р && ш++ < 4) { имя = р.name; р = р.parent; }
    из.push({ имя: имя || "?", гео: g.type, мат: м.type, карта: !!м.map,
              цвет: м.color ? "#" + м.color.getHexString() : "", emis: м.emissive ? "#" + м.emissive.getHexString() : "",
              пикс: +пикс.toFixed(1), глуб: Math.round(глуб), рад: +рад.toFixed(2), уКамеры: !!(о.parent && о.parent === cam) });
    о.__кандидат = пикс >= 6 && пикс <= 90;
  });
  из.sort((a, b) => b.пикс - a.пикс);
  return из;
});
console.log("непрозрачных мешей: " + список.length);
for (const с of список) if (с.пикс >= 4 && с.пикс <= 200) console.log("  " + JSON.stringify(с));

const погашено = await стр.evaluate(() => {
  const cam = window.RC_FLIGHT._cam();
  let scene = cam; while (scene.parent) scene = scene.parent;
  let n = 0;
  scene.traverse((о) => { if (о.__кандидат && о.visible) { о.visible = false; n++; } });
  return n;
});
await кадры(12);
await стр.screenshot({ path: `/tmp/пятна3-${КТО}-без-кандидатов.png` });
console.log(`погашено кандидатов 6..90 px: ${погашено} -> /tmp/пятна3-${КТО}-без-кандидатов.png`);
await бр.close();
