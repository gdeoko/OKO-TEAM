/* Быстрый снимок стенда глыбы (tools/просмотр/глыба-стенд.html).

   ЗАЧЕМ. Боевой снимок акта поднимается минут десять: вступление на
   программном отрисовщике идёт кадрами по полсекунды. Материал льда так
   не настроишь. Здесь только три глыбы на подложке цвета кладки акта
   ПЕРИМЕТР, и кадр выходит за десяток секунд.

   Печатает габариты сеток, долю плоской зоны, долю знака в теле и
   замер яркости по кускам кадра - те же числа, по которым сверяемся с
   igloo.

   Запуск: node tools/глыба-снимок.mjs [время в секундах через запятую] */
import { chromium } from "playwright";
import fs from "node:fs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8181";
const КУДА = process.env.RV_SHOTS || "/tmp/кадры-глыба";
const времена = (process.argv[2] || "0,2.4,5.1").split(",").map(Number);

fs.mkdirSync(КУДА, { recursive: true });

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-lcd-text", "--force-device-scale-factor=1"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 200)));
стр.on("console", (m) => { if (m.type() === "error") беды.push("КОНС " + m.text().slice(0, 300)); });

await стр.goto(АДРЕС + "/tools/просмотр/глыба-стенд.html", { waitUntil: "load", timeout: 60000 });
await стр.waitForFunction(() => window["готово"] === true, null, { timeout: 60000 });

console.log(JSON.stringify(await стр.evaluate(() => window["замерГеометрии"]()), null, 1));

for (const t of времена) {
  await стр.evaluate((v) => window["кадр"](v), t);
  await стр.waitForTimeout(400);
  const имя = `${КУДА}/стенд-${String(t).replace(".", "")}.png`;
  await стр.screenshot({ path: имя });
  console.log("снят " + имя);
}

if (беды.length) {
  console.log("БЕДЫ:");
  for (const б of [...new Set(беды)].slice(0, 8)) console.log("  " + б);
} else {
  console.log("ошибок нет");
}
await бр.close();
