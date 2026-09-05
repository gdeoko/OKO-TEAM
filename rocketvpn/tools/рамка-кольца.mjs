/* Где на экране стоит кольцо тоннеля и какую часть кадра занимает.

   ЗАЧЕМ. Числа цвета сошлись с igloo, а кадр нет. На их кадре 014 тор
   стоит РОВНО ПО ЦЕНТРУ и занимает около восьмидесяти процентов высоты
   кадра; у нас он мельче и уходит в левый верх. Спорить об этом по
   снимку бессмысленно, поэтому здесь считается проекция самих колец в
   координатах кадра: середина, размах, доля высоты.

   Запуск: node tools/рамка-кольца.mjs */
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

console.log("доля  кольцо  серединаNDC(x,y)  размахNDC(ш,в)  доля высоты кадра");
for (const доля of [0.2, 0.3, 0.45, 0.62, 0.8]) {
  await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("прокол", д), доля);
  await стр.waitForTimeout(2600);
  const о = await стр.evaluate(() => {
    const W = window.RV_WORLD["мир"]();
    const T = W.T, кам = W.cam;
    кам.updateMatrixWorld(true);
    const узел = window.RV_ТРУБА && window.RV_ТРУБА["узел"] ? window.RV_ТРУБА["узел"]() : null;
    if (!узел) return null;
    const в = new T.Vector3();
    const строки = [];
    узел.traverse((о) => {
      if (!/^кольцо /.test(о.name || "")) return;
      let п = о, видно = true;
      while (п) { if (!п.visible) { видно = false; break; } п = п.parent; }
      if (!видно) return;
      let мнx = 9, мкx = -9, мнy = 9, мкy = -9, есть = false;
      о.traverse((м) => {
        if (!м.isMesh && !м.isInstancedMesh) return;
        if (!м.geometry.boundingBox) м.geometry.computeBoundingBox();
        const бб = м.geometry.boundingBox;
        if (!бб) return;
        есть = true;
        for (let i = 0; i < 8; i++) {
          в.set(i & 1 ? бб.max.x : бб.min.x, i & 2 ? бб.max.y : бб.min.y, i & 4 ? бб.max.z : бб.min.z);
          м.localToWorld(в); в.project(кам);
          if (в.x < мнx) мнx = в.x; if (в.x > мкx) мкx = в.x;
          if (в.y < мнy) мнy = в.y; if (в.y > мкy) мкy = в.y;
        }
      });
      if (есть) строки.push({ имя: о.name, cx: (мнx + мкx) / 2, cy: (мнy + мкy) / 2,
                              ш: мкx - мнx, в: мкy - мнy });
    });
    return строки;
  });
  if (!о || !о.length) { console.log(доля.toFixed(2) + "  колец в кадре нет"); continue; }
  for (const с of о) {
    console.log(доля.toFixed(2).padEnd(6) + с.имя.padEnd(8) +
      `(${с.cx.toFixed(2)}, ${с.cy.toFixed(2)})`.padEnd(18) +
      `(${с.ш.toFixed(2)}, ${с.в.toFixed(2)})`.padEnd(16) +
      (с.в / 2 * 100).toFixed(0) + "%");
  }
}
await бр.close();
