/* РЕЗКОСТЬ ПАНЕЛИ ЧИСЛОМ. Владелец про оба сайта: «почему панель
   управления в салоне и до старта игры такая некачественная?»

   «Мутно» на глаз не чинится: мылить может четыре разных места, и
   каждое лечится своим числом.

     1. ПЛОТНОСТЬ КАДРА. Холст рисуется мельче экрана и растягивается.
        Меряется как холст.width / (CSS-ширина * devicePixelRatio).
     2. ПЛОТНОСТЬ ПЕЧАТИ ЛИЦА. Пульт в салоне это снимок, запечённый в
        текстуру: если текстура мельче кадра, панель мылится ещё до
        растеризации.
     3. ИСХОДНЫЙ СНИМОК. Печь крупнее, чем снято, бессмысленно.
     4. ФИЛЬТР ТЕКСТУРЫ. Мип-уровень и анизотропия.

   Инструмент печатает все четыре и считает, где узкое место.

   Запуск: node tools/резкость-панели.mjs [тел|пк] [адрес] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "тел";
const АДРЕС = process.argv[3] || "http://127.0.0.1:8171";
const экран = КТО === "тел" ? { width: 390, height: 844, dpr: 3 } : { width: 1440, height: 900, dpr: 1 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: { width: экран.width, height: экран.height },
  deviceScaleFactor: экран.dpr, isMobile: КТО === "тел", hasTouch: КТО === "тел"
});
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForLoadState("networkidle", { timeout: 180000 }).catch(() => {});
await стр.waitForTimeout(5000);

async function кадры(n) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), n);
}
/* Доводим ленту до самого низа: там человек и стоит у пульта */
const высота = await стр.evaluate(() =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
for (let i = 1; i <= 90; i++) {
  await стр.evaluate((y) => window.scrollTo(0, y), Math.round(высота * (i / 90)));
  await кадры(2);
}
await стр.waitForTimeout(3000);
await кадры(20);

const св = await стр.evaluate(() => {
  const из = { окно: [innerWidth, innerHeight], dpr: devicePixelRatio };
  const cv = document.querySelector(".rcf-cv") ||
             document.querySelector("canvas.on") ||
             document.querySelector("canvas");
  if (cv) {
    const к = cv.getBoundingClientRect();
    из.холст = { буфер: [cv.width, cv.height], экран: [Math.round(к.width), Math.round(к.height)] };
    из.плотностьКадра = +(cv.width / Math.max(1, к.width)).toFixed(2);
    из.растягНаЭкран = +((к.width * devicePixelRatio) / Math.max(1, cv.width)).toFixed(2);
  }
  try {
    const с = window.RC_FLIGHT && window.RC_FLIGHT.state ? window.RC_FLIGHT.state() : null;
    if (с) {
      из.сцена = с["сцена"]; из.подъезд = с["подъезд"]; из.салон = с["салон"];
      из.потолокПлотности = с["потолок"] || null;
      if (с["лицоСекции"]) из.лицоСекции = с["лицоСекции"];
      if (с["холСек"]) из.лицоСекции = с["холСек"];
    }
  } catch (e) { из.состояние = "нет: " + e.message.slice(0, 80); }
  /* Ищем текстуру лица секции в самой сцене: её несёт незамкнутый
     цилиндр передней секции. */
  try {
    const cam = window.RC_FLIGHT && window.RC_FLIGHT._cam ? window.RC_FLIGHT._cam() : null;
    if (cam) {
      let scene = cam; while (scene.parent) scene = scene.parent;
      scene.traverse((о) => {
        if (из.лицо) return;
        const g = о.geometry;
        if (!о.isMesh || !g || !g.parameters || g.parameters.thetaLength === undefined) return;
        if (g.parameters.thetaLength > 6.2) return;
        const м = Array.isArray(о.material) ? о.material[0] : о.material;
        if (!м || !м.map || !м.map.image) return;
        из.лицо = { карта: [м.map.image.width, м.map.image.height],
                    анизо: м.map.anisotropy, мипы: м.map.generateMipmaps !== false,
                    фильтр: м.map.minFilter };
      });
    }
  } catch (e) {}
  return из;
});

console.log(`РЕЗКОСТЬ ПАНЕЛИ ${АДРЕС} ${КТО} ${экран.width}x${экран.height} dpr ${экран.dpr}`);
console.log(JSON.stringify(св, null, 1));
if (св.холст && св.лицо) {
  const ширинаЛицаНаЭкране = св.окно[0] * св.dpr;
  console.log(`  буфер кадра ${св.холст.буфер[0]} точек на ${ширинаЛицаНаЭкране} точек экрана` +
              ` -> растяг ${(ширинаЛицаНаЭкране / св.холст.буфер[0]).toFixed(2)}`);
  console.log(`  карта лица ${св.лицо.карта[0]}x${св.лицо.карта[1]}` +
              ` -> на буфер кадра ${(св.холст.буфер[0] / св.лицо.карта[0]).toFixed(2)}`);
}
await стр.screenshot({ path: `/tmp/резкость-${КТО}.png` });
console.log(`  снимок /tmp/резкость-${КТО}.png`);
await бр.close();
