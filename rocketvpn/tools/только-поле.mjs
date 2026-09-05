/* Что рисует силовое поле кольца, когда в кадре нет ничего другого.

   ЗАЧЕМ. Замер вклада слоёв дал полю один уровень яркости при недоборе
   в шестьдесят семь. При этом проверено: униформы открыты (uAlpha 1,
   uVhod 1), диск размерен по их пропорции (0.811 внешнего радиуса),
   нормаль смотрит навстречу камере, режим складывающий, проверка
   глубины выключена. Значит надо смотреть не на числа вокруг, а на сами
   точки, которые слой кладёт в кадр.

   Гасим в узле трубы всё, кроме полей, и снимаем. Если кадр пустой -
   поле не рисует вовсе; если на нём есть пояс - оно рисует, но его
   съедает что-то поверх.

   Запуск: node tools/только-поле.mjs */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import fs from "node:fs";

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

function поясы(буф, метка) {
  const p = PNG.sync.read(буф), д = p.data, ш = p.width, в = p.height;
  const шап = 80, h = в - шап, cy = шап + h / 2, cx = ш / 2;
  const rmax = Math.min(h / 2, cx);
  const сум = new Array(16).fill(0), n = new Array(16).fill(0);
  for (let y = шап; y < в; y += 2) {
    for (let x = 0; x < ш; x += 2) {
      const r = Math.sqrt((y - cy) ** 2 + (x - cx) ** 2) / rmax * 16;
      const i = Math.floor(r);
      if (i < 0 || i > 15) continue;
      const j = (y * ш + x) * 4;
      сум[i] += (д[j] + д[j + 1] + д[j + 2]) / 3; n[i]++;
    }
  }
  console.log(метка.padEnd(22) + сум.map((s, i) => (n[i] ? s / n[i] : 0).toFixed(0).padStart(4)).join(""));
}

поясы(await стр.screenshot(), "всё как есть");

/* Гасим всё, кроме полей. */
await стр.evaluate(() => {
  const у = window.RV_ТРУБА["узел"]();
  window._спрятал = [];
  у.traverse((о) => {
    if (!о.isMesh && !о.isInstancedMesh) return;
    if (/^поле кольца /.test(о.name || "")) return;
    if (о.visible) { о.visible = false; window._спрятал.push(о); }
  });
  /* И весь остальной мир, чтобы за полем стояла чернота. */
  const W = window.RV_WORLD["мир"]();
  W.scene.traverse((о) => {
    if (!о.isMesh && !о.isInstancedMesh && !о.isPoints) return;
    let п = о, вТрубе = false;
    while (п) { if (п === у) { вТрубе = true; break; } п = п.parent; }
    if (вТрубе) return;
    if (о.visible) { о.visible = false; window._спрятал.push(о); }
  });
  return window._спрятал.length;
});
await стр.waitForTimeout(3000);
const буф = await стр.screenshot();
fs.writeFileSync("/tmp/кадры/только-поле.png", буф);
поясы(буф, "только поля");
console.log("кадр записан в /tmp/кадры/только-поле.png");
await бр.close();
