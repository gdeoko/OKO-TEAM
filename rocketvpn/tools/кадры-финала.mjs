/* Снимки финала по долям: смотреть глазами обязательно.
   Числа хода камеры дважды пропускали пустой кадр, и оба раза это
   ловил снимок. Запуск: node tools/кадры-финала.mjs [доли] [куда] */
import { chromium } from "playwright";
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const доли = (process.argv[2] || "0,0.3,0.55,0.7,0.88,1").split(",").map(Number);
const куда = process.argv[3] || "/tmp/финал";
const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(() => window.RV_WORLD && !window.RV_WORLD["вступлениеИдёт"](), null, { timeout: 240000 }).catch(() => {});
await стр.waitForTimeout(2000);
for (const д of доли) {
  await стр.evaluate((доля) => window.RV_MOTION["кПунктy"]("финал", доля), д);
  await стр.waitForTimeout(3500);
  const п = `${куда}-${String(Math.round(д * 100)).padStart(3, "0")}.png`;
  await стр.screenshot({ path: п });
  console.log("снято", п);
}
await бр.close();
