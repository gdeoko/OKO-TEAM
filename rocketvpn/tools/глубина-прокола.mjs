/* Идёт ли камера ПО ОСИ рукава на всём акте прокола.

   ЗАЧЕМ. Сверка волны нашла живьём: RV_ТРУБА.замер().глуб идёт
   0 / -4.86 / 0.47 по долям 0.40 / 0.65 / 0.90, а обязан расти от нуля
   до 6.67. Кольца стоят на 1.65, 4.15 и 6.65, значит НИ ОДНО кольцо за
   акт не проходится: ободки и дым по глубине не зажигаются, пороги
   разлёта осколков не срабатывают, и в кадре вместо тоннеля стоит
   светлая оболочка подземелья. Замер яркости это подтвердил с другой
   стороны - гашение всех тринадцати слоёв трубы по одному меняет долю
   выбитых точек на полпроцента, то есть трубы в кадре почти нет.

   Здесь глубина, место камеры и видимость снимаются по всей ленте
   акта, чтобы правку позы можно было проверить числом.

   Запуск: node tools/глубина-прокола.mjs */
import { chromium } from "playwright";
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

console.log("доля  камера(x,y,z)          глуб  видно  свет  камZ  кольца видны");
for (const доля of [0.0, 0.15, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) {
  await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("прокол", д), доля);
  await стр.waitForTimeout(2600);
  const о = await стр.evaluate(() => {
    const W = window.RV_WORLD["мир"]();
    const п = W.cam.position;
    const з = window.RV_ТРУБА && window.RV_ТРУБА["замер"] ? window.RV_ТРУБА["замер"]() : {};
    const узел = window.RV_ТРУБА && window.RV_ТРУБА["узел"] ? window.RV_ТРУБА["узел"]() : null;
    let колец = 0;
    if (узел) узел.traverse((о) => { if (/^кольцо /.test(о.name || "") && о.visible) колец++; });
    return { к: [+п.x.toFixed(1), +п.y.toFixed(1), +п.z.toFixed(1)], з: з, колец: колец };
  });
  console.log(доля.toFixed(2).padEnd(6) +
    JSON.stringify(о.к).padEnd(22) +
    String(о.з["глуб"] == null ? "?" : о.з["глуб"]).padEnd(7) +
    String(о.з["видно"]).padEnd(7) +
    String(о.з["свет"] == null ? "?" : о.з["свет"]).padEnd(6) +
    String(о.з["камZ"] == null ? "?" : о.з["камZ"]).padEnd(6) + о.колец);
}
await бр.close();
