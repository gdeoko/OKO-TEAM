/* НЕБО ПО СЛОЯМ: гасим ровно один слой и снимаем кадр, не двигая
   корабль. Луч по кляксе на мониторе стал врать: там в кадре законные
   тела (Земля, Юпитер, галактика), и порог у точек ловит их соседей.
   Опыт честнее: корабль стоит, камера стоит, кадр отличается ровно на
   один погашенный слой.

   Слои называем по признакам, а не по именам (имён у них нет):
     небо      - сфера радиусом больше тысячи с картой (панорама);
     звёзды    - точки с шейдерным материалом (живое звёздное поле);
     пыль      - точки размером 1.6 вокруг камеры;
     галактики - спрайты и плоскости со сложением дальше тысячи;
     туманности- точки со сложением и картой размером 3.6 и 4.4.

   Запуск: node tools/кдн-небо-по-слоям.mjs [пк|тел] [адрес] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
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
await стр.waitForFunction(() => document.querySelector(".rcf-brief button[data-mode=manual]"), null, { timeout: 60000 });
await кадры(20);
await стр.evaluate(() => document.querySelector(".rcf-brief button[data-mode=manual]").click());
await кадры(20);
await стр.evaluate(() => window.RC_FLIGHT._пост(false));
await кадры(40);

/* Заливка кадра по слоям: сколько в кадре светлых точек и какова их
   средняя яркость. Сравнение до и после гашения слоя говорит, сколько
   света в кадр приносит именно он. */
async function заливка() {
  return await стр.evaluate(() => {
    const cv = document.querySelector(".rcf-cv");
    const W = innerWidth, H = innerHeight;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    return new Promise((г) => requestAnimationFrame(() => {
      x.drawImage(cv, 0, 0, W, H);
      const д = x.getImageData(0, 0, W, H).data;
      let сумма = 0, светлых = 0, ярких = 0;
      for (let i = 0; i < д.length; i += 16) {
        const l = д[i] * 0.2126 + д[i + 1] * 0.7152 + д[i + 2] * 0.0722;
        сумма += l;
        if (l > 28) светлых++;
        if (l > 90) ярких++;
      }
      const всего = д.length / 16;
      г({ средняя: +(сумма / всего).toFixed(2),
          светлых: +(100 * светлых / всего).toFixed(2),
          ярких: +(100 * ярких / всего).toFixed(2) });
    }));
  });
}

const СЛОИ = ["небо", "звёзды", "пыль", "галактики", "туманности"];
async function слой(имя, гасить) {
  return await стр.evaluate(([имя, гасить]) => {
    const cam = window.RC_FLIGHT._cam();
    let scene = cam; while (scene.parent) scene = scene.parent;
    const T = window.THREE;
    let n = 0;
    const подробно = [];
    scene.traverse((о) => {
      const м = Array.isArray(о.material) ? о.material[0] : о.material;
      if (!м) return;
      const g = о.geometry;
      let свой = false;
      if (имя === "небо") {
        свой = о.isMesh && g && g.type === "SphereGeometry" && g.parameters &&
               g.parameters.radius > 1000 && !!м.map;
      } else if (имя === "звёзды") {
        свой = о.isPoints && м.isShaderMaterial;
      } else if (имя === "пыль") {
        свой = о.isPoints && м.size >= 1.5 && м.size <= 1.7 && !м.blending;
      } else if (имя === "галактики") {
        свой = (о.isSprite || (о.isMesh && g && g.type === "PlaneGeometry")) &&
               м.blending === T.AdditiveBlending;
      } else if (имя === "туманности") {
        свой = о.isPoints && м.size >= 3 && м.size <= 5 && м.blending === T.AdditiveBlending;
      }
      if (!свой) return;
      if (гасить) {
        if (!о.visible) return;
        о.__прятал = true; о.visible = false; n++;
        подробно.push(`${g ? g.type : "?"}/${м.type}${м.size ? " size=" + м.size : ""}${g && g.parameters && g.parameters.radius ? " R=" + g.parameters.radius : ""}`);
      } else if (о.__прятал) { о.visible = true; о.__прятал = false; n++; }
    });
    return { n, подробно: подробно.slice(0, 4) };
  }, [имя, гасить]);
}

const было = await заливка();
await стр.screenshot({ path: `/tmp/небо-${КТО}-все.png` });
console.log(`${КТО}: всё как есть - ${JSON.stringify(было)}  /tmp/небо-${КТО}-все.png`);
for (const имя of СЛОИ) {
  const сн = await слой(имя, true);
  if (!сн.n) { console.log(`  ${имя}: не нашлось ни одного узла`); continue; }
  await кадры(10);
  const стало = await заливка();
  const ф = `/tmp/небо-${КТО}-без-${имя}.png`;
  await стр.screenshot({ path: ф });
  console.log(`  без «${имя}» (${сн.n} узлов: ${сн.подробно.join(", ")}):`);
  console.log(`     средняя ${было.средняя} -> ${стало.средняя},` +
              ` светлых ${было.светлых}% -> ${стало.светлых}%,` +
              ` ярких ${было.ярких}% -> ${стало.ярких}%   ${ф}`);
  await слой(имя, false);
  await кадры(6);
}
await бр.close();
