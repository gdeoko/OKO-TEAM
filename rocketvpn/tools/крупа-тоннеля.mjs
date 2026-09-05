/* Кто сыплет белую крупу по кадру тоннеля.

   ЗАЧЕМ. После правки прицела композиция кадра сошлась с их кадром 014:
   два кольца, тёмные дуги внутри просвета, белое ядро в середине. Но всё
   поле у нас покрыто белыми точками, а у igloo тело тора гладкое, с
   чистой слепящей губой. Кто их сыплет - туман, снег или сама труба, по
   снимку не понять: точки мелкие и лежат поверх всего.

   МЕРА. Доля точек, которые ярче своего окружения больше чем на
   тридцать уровней (сравнение с четырьмя соседями через четыре точки).
   Ровная дымка такой разницы не даёт, белая точка даёт всегда.

   Запуск: node tools/крупа-тоннеля.mjs */
import { chromium } from "playwright";
import { PNG } from "pngjs";

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 } });
await стр.goto((process.env.RV_URL || "http://127.0.0.1:8170") + "/",
  { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 300000 }).catch(() => console.log("вступление не кончилось"));
await стр.waitForTimeout(3000);
await стр.evaluate(() => window.RV_MOTION["кПунктy"]("прокол", 0.45));
await стр.waitForTimeout(4000);

function крупа(буф) {
  const p = PNG.sync.read(буф), д = p.data, ш = p.width, в = p.height;
  let n = 0, всего = 0;
  /* Верхние восемьдесят точек это шапка сайта, к сцене отношения не имеет. */
  for (let y = 80; y < в - 4; y += 2) {
    for (let x = 4; x < ш - 4; x += 2) {
      const i = (y * ш + x) * 4;
      const с = (д[i] + д[i + 1] + д[i + 2]) / 3;
      let ок = 0;
      for (const [dx, dy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) {
        const j = ((y + dy) * ш + (x + dx)) * 4;
        ок += (д[j] + д[j + 1] + д[j + 2]) / 3;
      }
      if (с - ок / 4 > 30) n++;
      всего++;
    }
  }
  return (n / всего * 100);
}

const было = крупа(await стр.screenshot());
console.log("исходно крупы: " + было.toFixed(2) + "%");
for (const имя of ["снег шахты", "туман шахты", "труба шахты",
                   "кольцо 0", "кольцо 1", "кайма кольца 0", "кайма кольца 1"]) {
  const нашли = await стр.evaluate((к) => {
    const у = window.RV_ТРУБА && window.RV_ТРУБА["узел"] ? window.RV_ТРУБА["узел"]() : null;
    if (!у) return 0;
    window._спрятано = [];
    у.traverse((о) => {
      if ((о.name || "") === к && о.visible) { о.visible = false; window._спрятано.push(о); }
    });
    return window._спрятано.length;
  }, имя);
  if (!нашли) { console.log(`  «${имя}»: в сцене нет`); continue; }
  await стр.waitForTimeout(2500);
  const стало = крупа(await стр.screenshot());
  console.log(`  без «${имя}»: ${стало.toFixed(2)}%  (убрало ${(было - стало).toFixed(2)})`);
  await стр.evaluate(() => (window._спрятано || []).forEach((о) => { о.visible = true; }));
  await стр.waitForTimeout(800);
}
await бр.close();
