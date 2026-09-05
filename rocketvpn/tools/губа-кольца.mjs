/* Сколько яркости даёт каждый слой в поясе внутренней губы кольца.

   ЗАЧЕМ. Профиль по кольцевым поясам показал главное отличие от igloo:
   у них на кадре 014 в поясах 9-13 стоит яркая полоса с пиком 243 -
   слепящая внутренняя губа тора, - а у нас там ровный спад с подъёмом
   до 176. Недобор 67 уровней. Кто обязан эту полосу давать и сколько он
   даёт на деле, по снимку не видно: слоёв в кольце четыре и они лежат
   друг на друге.

   МЕРА. Средняя яркость в поясах 9-13 от середины кадра, с гашением
   каждого слоя по очереди. Падение и есть вклад слоя.

   Запуск: node tools/губа-кольца.mjs */
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

function губа(буф) {
  const p = PNG.sync.read(буф), д = p.data, ш = p.width, в = p.height;
  const шап = 80, h = в - шап;
  const cy = шап + h / 2, cx = ш / 2, rmax = Math.min(h / 2, cx);
  let сум = 0, n = 0;
  for (let y = шап; y < в; y += 2) {
    for (let x = 0; x < ш; x += 2) {
      const r = Math.sqrt((y - cy) * (y - cy) + (x - cx) * (x - cx)) / rmax * 16;
      if (r < 9 || r >= 14) continue;
      const i = (y * ш + x) * 4;
      сум += (д[i] + д[i + 1] + д[i + 2]) / 3; n++;
    }
  }
  return сум / n;
}

const было = губа(await стр.screenshot());
console.log("яркость пояса губы (пояса 9-13): " + было.toFixed(0) + "   у igloo на 014 там 193..243");
for (const имя of ["поле кольца 0", "поле кольца 1", "поле кольца 2",
                   "кольцо 0", "кольцо 1", "дым кольца 1", "следы кольца 1",
                   "труба шахты", "свет подземелья"]) {
  const нашли = await стр.evaluate((к) => {
    const у = window.RV_ТРУБА["узел"]();
    window._с = [];
    у.traverse((о) => { if ((о.name || "") === к && о.visible) { о.visible = false; window._с.push(о); } });
    return window._с.length;
  }, имя);
  if (!нашли) { console.log(`  «${имя}»: в кадре нет`); continue; }
  await стр.waitForTimeout(2400);
  const стало = губа(await стр.screenshot());
  console.log(`  без «${имя}»: ${стало.toFixed(0)}   вклад ${(было - стало).toFixed(0)}`);
  await стр.evaluate(() => (window._с || []).forEach((о) => { о.visible = true; }));
  await стр.waitForTimeout(700);
}
await бр.close();
