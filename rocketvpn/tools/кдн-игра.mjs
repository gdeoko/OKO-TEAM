/* КТО РИСУЕТ ПЯТНА В КОСМОСЕ ИГРЫ. Владелец прислал снимок игры с
   телефона: небо в крупных мягких светящихся кляксах. Слоёв, которые
   умеют так светить, в игре десятки: точки с затуханием по дальности,
   спрайты свечения, короны, туманности. Глазом по снимку не понять,
   какой из них раздулся.

   Инструмент входит в полёт на стенде CDN с телефонным экраном,
   включает автополёт, ставит корабль в несколько точек маршрута и в
   каждой считает, во сколько ПИКСЕЛЕЙ на экране выходит каждый
   светящийся слой: у точек с затуханием это size * (высота/2) / глубина,
   у спрайта - его масштаб, спроецированный камерой. Печатает верх
   списка по каждой точке и снимает кадр.

   Запуск: node tools/кдн-игра.mjs [тел|пк] [адрес] */
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
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 200)));
стр.on("console", (m) => { if (m.type() === "error") беды.push("console " + m.text().slice(0, 200)); });

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
await кадры(30);
await стр.screenshot({ path: `/tmp/игра-${КТО}-бриф.png` });
await стр.evaluate(() => document.querySelector(".rcf-brief button[data-mode=auto]").click());
await кадры(30);

const ТОЧКИ = [0.02, 0.10, 0.22, 0.38, 0.55, 0.72];
for (const т of ТОЧКИ) {
  await стр.evaluate((v) => window.RC_FLIGHT._set(v), т);
  await кадры(70);
  const ф = `/tmp/игра-${КТО}-${т}.png`;
  await стр.screenshot({ path: ф });
  const свод = await стр.evaluate(() => {
    const cam = window.RC_FLIGHT._cam();
    if (!cam) return "камеры нет";
    let scene = cam; while (scene.parent) scene = scene.parent;
    const T = window.THREE;
    const h = innerHeight;
    const tanF = Math.tan((cam.fov * Math.PI / 180) / 2);
    const из = [];
    const камПоз = new T.Vector3(); cam.getWorldPosition(камПоз);
    const мир = new T.Vector3();
    scene.traverse((о) => {
      if (!о.visible) return;
      let у = о.parent, видно = true;
      while (у) { if (!у.visible) { видно = false; break; } у = у.parent; }
      if (!видно) return;
      const м = о.material;
      if (!м) return;
      let имя = о.name || "";
      let р = о.parent, ш = 0;
      while (!имя && р && ш++ < 4) { imя_(р); р = р.parent; }
      function imя_(x) { if (x.name) имя = x.name; }
      if (о.isSprite) {
        о.getWorldPosition(мир);
        const глуб = мир.distanceTo(камПоз);
        const мс = new T.Vector3(); о.getWorldScale(мс);
        const пикс = мс.y * (h / 2) / (глуб * tanF);
        из.push({ вид: "спрайт", имя, пикс: +пикс.toFixed(1), глуб: Math.round(глуб), масштаб: +мс.y.toFixed(1), op: м.opacity });
      } else if (о.isPoints) {
        const g = о.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        const bs = g.boundingSphere;
        if (!bs) return;
        о.localToWorld(мир.copy(bs.center));
        const мс = new T.Vector3(); о.getWorldScale(мс);
        const рад = bs.radius * Math.max(мс.x, мс.y, мс.z);
        const глуб = мир.distanceTo(камПоз);
        const ближ = Math.max(1, глуб - рад);
        let пикс;
        if (м.isShaderMaterial) {
          пикс = null;
        } else if (м.sizeAttenuation) {
          пикс = м.size * (h / 2) / ближ;
        } else {
          пикс = м.size;
        }
        из.push({ вид: "точки" + (м.isShaderMaterial ? "(шейдер)" : m_(м)), имя, пикс: пикс === null ? null : +пикс.toFixed(1),
                  глуб: Math.round(глуб), рад: Math.round(рад), n: g.attributes.position.count, op: м.opacity, size: м.size });
        function m_(м) { return м.sizeAttenuation ? "+зат" : ""; }
      } else if (о.isMesh && м.transparent && м.blending === T.AdditiveBlending) {
        о.getWorldPosition(мир);
        const глуб = мир.distanceTo(камПоз);
        const g = о.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        const мс = new T.Vector3(); о.getWorldScale(мс);
        const рад = (g.boundingSphere ? g.boundingSphere.radius : 0) * Math.max(мс.x, мс.y, мс.z);
        const пикс = рад * 2 * (h / 2) / (Math.max(1, глуб - рад) * tanF);
        из.push({ вид: "меш+адд", имя, пикс: +пикс.toFixed(1), глуб: Math.round(глуб), рад: Math.round(рад), op: м.opacity });
      }
    });
    из.sort((a, b) => (b.пикс || 0) - (a.пикс || 0));
    return { камера: [Math.round(камПоз.x), Math.round(камПоз.y), Math.round(камПоз.z)], поле: +cam.fov.toFixed(1),
             верх: из.slice(0, 16), всего: из.length };
  });
  console.log(`\n== точка ${т} -> ${ф}`);
  console.log(JSON.stringify(свод, null, 0).replace(/\},\{/g, "},\n{"));
}
if (беды.length) {
  console.log("\nБЕДЫ (" + беды.length + "):");
  for (const б of беды.slice(0, 20)) console.log("  " + б);
}
await бр.close();
