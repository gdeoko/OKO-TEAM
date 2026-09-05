/* Снимки обхода вокруг фигуры: рубка и пуск по долям.
   Владелец: «ракета всегда в центре остаётся ровно, мы её вокруг
   облетаем, заголовки сверху по кругу». Проверяем глазами.
   Запуск: node tools/кадры-облёта.mjs [куда] */
import { chromium } from "playwright";
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const куда = process.argv[2] || "/tmp/облёт";
const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(() => window.RV_WORLD && !window.RV_WORLD["вступлениеИдёт"](), null, { timeout: 240000 }).catch(() => {});
await стр.waitForTimeout(2000);
for (const [акт, доли] of [["рубка", [0.2, 0.55, 0.9]], ["пуск", [0.2, 0.55, 0.9]]]) {
  for (const д of доли) {
    await стр.evaluate(([и, x]) => window.RV_MOTION["кПунктy"](и, x), [акт, д]);
    await стр.waitForTimeout(3200);
    const п = `${куда}-${акт}-${String(Math.round(д * 100)).padStart(2, "0")}.png`;
    await стр.screenshot({ path: п });
    console.log("снято", п);
  }
}
await бр.close();
