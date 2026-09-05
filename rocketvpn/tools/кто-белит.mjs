/* Кто выбивает кадр тоннеля в белое.
   Замер: у нас на доле 0.62 выше 230 лежит 35% кадра, у igloo на самом
   ярком кадре 19.5%. Правка каймы сдвинула это на полпроцента, значит
   белит что-то другое. Гасим детей трубы по одному и смотрим, на ком
   доля выбитых точек падает. */
import { chromium } from "playwright";
import { PNG } from "pngjs";
const бр = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 } });
await стр.goto("http://127.0.0.1:8170/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 300000 }).catch(() => console.log("вступление не кончилось"));
await стр.waitForTimeout(3000);
await стр.evaluate(() => window.RV_MOTION["кПунктy"]("прокол", 0.62));
await стр.waitForTimeout(5000);

const список = await стр.evaluate(() => {
  const узел = window.RV_ТРУБА && window.RV_ТРУБА["узел"] ? window.RV_ТРУБА["узел"]() : null;
  const имена = [];
  const обход = (о, путь) => {
    o: for (const р of о.children) {
      имена.push((р.name || р.type) + "|" + путь);
      if (р.children.length && р.children.length < 12) обход(р, путь + "/" + (р.name || р.type));
    }
  };
  if (узел) обход(узел, "");
  window._трубаУзел = узел;
  return { есть: !!узел, дети: имена.slice(0, 30) };
});
console.log("узел трубы:", список.есть, "детей:", список.дети.length);
console.log(список.дети.join("\n"));

function выбитых(буф) {
  const p = PNG.sync.read(буф).data;
  let n = 0, всего = 0;
  for (let i = 62 * 1440 * 4; i < p.length; i += 16) {
    const с = (p[i] + p[i + 1] + p[i + 2]) / 3;
    if (с > 230) n++;
    всего++;
  }
  return (n / всего * 100).toFixed(1);
}
console.log("исходно выбитых:", выбитых(await стр.screenshot()) + "%");

for (const имя of список.дети.slice(0, 12)) {
  const короткое = имя.split("|")[0];
  await стр.evaluate((к) => {
    window._скрыто = [];
    window._трубаУзел.traverse((о) => {
      if ((о.name || о.type) === к && о.visible) { о.visible = false; window._скрыто.push(о); }
    });
  }, короткое);
  await стр.waitForTimeout(2200);
  console.log("  без «" + короткое + "»: " + выбитых(await стр.screenshot()) + "%");
  await стр.evaluate(() => { (window._скрыто || []).forEach((о) => { о.visible = true; }); });
  await стр.waitForTimeout(800);
}
await бр.close();
