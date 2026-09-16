/* ЧТО ЧЕЛОВЕК ВИДИТ В ЯРКОЙ ПОЛОСЕ НИЗА: ЛУЧ СКВОЗЬ ЕЁ ПИКСЕЛИ.

   ── ПОЧЕМУ ИМЕННО ЛУЧ ─────────────────────────────────────────────
   Вспышку в низу кадра финала я искал пятью разными мерками, и четыре
   из них ответили мимо:

     габарит пульта      рама сходится до четвёртого знака, он ни при чём
     свет рубки          перепись честная, гашение ничего не изменило
     пол зала            погашен, полоса не изменилась
     перебор гашением    дал минус 68 от ПУСТОЙ группы, то есть врал
     свойства на пике    назвал лампу зала, гашение не помогло

   Последняя ошибка поучительна: в том сравнении я опознавал тела по
   пути из имён родителей, а путь не уникален - «финал: вход в
   ракету/салон/Group/Group/Mesh» повторяется шесть раз. Значит часть
   строк сравнивала РАЗНЫЕ тела между собой, и доверять такому списку
   нельзя.

   Луч не опознаёт ничего заранее. Он идёт из камеры через тот самый
   пиксель, который светится, и упирается в то самое тело, которое
   человек там видит. Ошибиться нечем: ни имён, ни путей, ни сравнений.

   ── КАК МЕРИМ ─────────────────────────────────────────────────────
   Приходим прокруткой, ждём пик (он на шестой-седьмой пробе от начала
   отсчёта, это из замера полосы), снимаем кадр, находим в нижних трёх
   процентах самые яркие точки и пускаем через каждую луч. Печатаем, во
   что попали, с полным путём, цветом материала и расстоянием.

   Запуск: node tools/луч-в-полосу.mjs [пк|тел] */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: экран, deviceScaleFactor: 1,
  isMobile: КТО === "тел", hasTouch: КТО === "тел"
});
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 140)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(3500);

const место = await стр.evaluate(() => {
  const к = window.RV_WORLD["кривая"] ? window.RV_WORLD["кривая"]() : null;
  if (!к || !к["станции"]) return null;
  const ф = к["станции"].filter((с) => с["имя"] === "финал")[0];
  return ф ? Math.round(ф["верх"] + ф["ход"] * 0.99) : null;
});
for (let i = 1; i <= 90; i++) {
  await стр.evaluate((y) => window.scrollTo(0, y), Math.round((место || 10000) * (i / 90)));
  await стр.evaluate(() => new Promise((г) => {
    let k = 0; (function ш() { requestAnimationFrame(() => (++k >= 2 ? г() : ш())); })();
  }));
}

/* Лучемёт кладём в страницу. Видимые сетки собираем сами: встроенный
   лучемёт невидимые объекты не отсеивает, и луч цеплялся бы за
   выключенные акты. */
await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  const T = W.T;
  const луч = new T.Raycaster();
  луч.far = 4000;
  window.__вКого = function (доляX, доляY) {
    const цели = [];
    W.scene.traverseVisible((о) => { if (о.isMesh && о.geometry) цели.push(о); });
    луч.setFromCamera({ x: доляX * 2 - 1, y: 1 - доляY * 2 }, W.cam);
    const поп = луч.intersectObjects(цели, false);
    const из = [];
    for (const п of поп) {
      if (п.distance <= 0.02) continue;
      const о = п.object;
      const путь = (function () {
        const ч = []; let q = о;
        while (q) { ч.unshift(q.name || q.type); q = q.parent; }
        return ч.join("/");
      })();
      const м = Array.isArray(о.material) ? о.material[0] : о.material;
      из.push({
        путь: путь,
        геом: о.geometry.type,
        даль: +п.distance.toFixed(2),
        цвет: м && м.color ? m_цвет(м) : null,
        прозр: м && м.opacity != null ? +м.opacity.toFixed(3) : null,
        смеш: м ? м.blending : null,
        мат: м ? м.type : null
      });
      if (из.length >= 4) break;
    }
    function m_цвет(м) { return "#" + м.color.getHexString(); }
    return из;
  };
});

function яркиеТочки(файл, w, h) {
  const y0 = Math.round(h * 0.97);
  const из = execFileSync("python3", ["-c", `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("L")
w, h = im.size
y0 = ${y0}
куски = im.crop((0, y0, w, h))
d = list(куски.getdata())
ш = w
лучшие = sorted(range(len(d)), key=lambda i: -d[i])[:400]
# берём восемь самых ярких, разнесённых по ширине
взяты = []
for i in лучшие:
    x = i % ш; y = y0 + i // ш
    if all(abs(x - bx) > ш // 12 for bx, by, bv in взяты):
        взяты.append((x, y, d[i]))
    if len(взяты) >= 8: break
for x, y, v in взяты:
    print(x, y, v)
`, файл], { encoding: "utf8" }).trim();
  return из.split("\n").filter(Boolean).map((л) => l_разбор(л));
  function l_разбор(л) { const ч = л.trim().split(/\s+/).map(Number); return { x: ч[0], y: ч[1], яркость: ч[2] }; }
}

/* Ждём пик. Отсчёт тот же, что в полоса-во-времени: шестьдесят кадров,
   две секунды покоя, потом пик приходится на шестую-седьмую пробу по
   четыре кадра. Берём двадцать четыре кадра - это середина подъёма. */
await стр.evaluate(() => new Promise((г) => {
  let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 60 ? г() : ш())); })();
}));
await стр.waitForTimeout(2000);
await стр.evaluate(() => new Promise((г) => {
  let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 24 ? г() : ш())); })();
}));
await стр.screenshot({ path: "/tmp/луч-пик.png" });
const точки = яркиеТочки("/tmp/луч-пик.png", экран.width, экран.height);

console.log(`ЛУЧ В ПОЛОСУ ${КТО} ${экран.width}x${экран.height}, финал доля 0.99, пик вспышки`);
console.log(`  самых ярких точек в нижних трёх процентах: ${точки.length}`);
for (const т of точки) {
  const попал = await стр.evaluate(([dx, dy]) => window.__вКого(dx, dy),
                                   [т.x / экран.width, т.y / экран.height]);
  console.log(`  точка x=${т.x} y=${т.y} яркость ${т.яркость}:`);
  if (!попал.length) { console.log("      луч не попал ни во что: это небо или постобработка"); continue; }
  for (const п of попал) {
    console.log(`      ${String(п.даль).padStart(8)}  ${String(п.геом).padEnd(16)} ` +
                `${String(п.цвет).padEnd(9)} прозр ${String(п.прозр).padEnd(6)} ${п.путь}`);
  }
}
await бр.close();
