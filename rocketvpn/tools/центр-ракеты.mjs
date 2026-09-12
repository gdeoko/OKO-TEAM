/* ГДЕ СТОИТ РАКЕТА НА КАЖДОЙ ДОЛЕ.

   Владелец: «она всегда в центре должна быть, никогда даже на миллиметр
   из центра не уходит - ни до тоннеля, ни после, ни при обходе вокруг».

   Инструмент считает СЕРЕДИНУ ЯРКОГО ПЯТНА роя на кадре и печатает её
   смещение от середины экрана в точках. Судит не глаз и не код сцены, а
   сам кадр: рой могут увести и камера, и поза акта, и наклон мира.

   Запуск: node tools/центр-ракеты.mjs [пк|тел] [долей] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";
import fs from "node:fs";
import { PNG } from "pngjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "пк";
const ДОЛЕЙ = +(process.argv[3] || 7);
const ЭКР = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({
  viewport: ЭКР, isMobile: КТО === "тел", hasTouch: КТО === "тел", deviceScaleFactor: 1
});
await стр.goto(АДРЕС + "/", { waitUntil: "load", timeout: 120000 });
await стр.waitForFunction(() => window.RV_MOTION && window.RV_MOTION["кПунктy"], null, { timeout: 90000 });

/* Середина роя берётся ВЕСОМ ЯРКОСТИ выше фона: рой светлее воздуха,
   и его пятно на кадре это и есть то, что человек видит ракетой. */
function серединаПятна(буф) {
  const п = PNG.sync.read(буф);
  const { width: Ш, height: В, data: д } = п;
  let фон = 0, n = 0;
  for (let y = 80; y < В; y += 7) for (let x = 0; x < Ш; x += 7) {
    const i = (y * Ш + x) * 4;
    фон += (д[i] + д[i + 1] + д[i + 2]) / 3; n++;
  }
  фон /= n;
  let сx = 0, сy = 0, вес = 0, минX = 1e9, максX = -1e9;
  for (let y = 80; y < В; y++) for (let x = 0; x < Ш; x++) {
    const i = (y * Ш + x) * 4;
    const я = (д[i] + д[i + 1] + д[i + 2]) / 3;
    const w = я - фон - 18;
    if (w <= 0) continue;
    сx += x * w; сy += y * w; вес += w;
    if (x < минX) минX = x;
    if (x > максX) максX = x;
  }
  if (вес <= 0) return null;
  return { x: сx / вес, y: сy / вес, ширина: максX - минX };
}

console.log(`${КТО}: экран ${ЭКР.width}x${ЭКР.height}, середина по x = ${ЭКР.width / 2}`);
console.log("акт      доля   центр x   уход, точек   уход, %");
for (const акт of ["рубка", "пуск"]) {
  for (let i = 0; i < ДОЛЕЙ; i++) {
    const доля = 0.06 + (0.9 * i) / (ДОЛЕЙ - 1);
    await стр.evaluate(([а, д]) => window.RV_MOTION["кПунктy"](а, д), [акт, доля]);
    await стр.waitForTimeout(КТО === "пк" ? 9000 : 8000);
    const буф = await стр.screenshot();
    const с = серединаПятна(буф);
    if (!с) { console.log(`${акт.padEnd(8)} ${доля.toFixed(2)}   пятна нет`); continue; }
    const уход = с.x - ЭКР.width / 2;
    console.log(`${акт.padEnd(8)} ${доля.toFixed(2)}   ${с.x.toFixed(1).padStart(7)}   ${уход.toFixed(1).padStart(11)}   ${(100 * уход / ЭКР.width).toFixed(1).padStart(7)}`);
  }
}
await бр.close();
