/* ЧТО ИМЕННО РАЗГОРАЕТСЯ И ГАСНЕТ В НИЗУ КАДРА ФИНАЛА.

   ── ЧТО УЖЕ ИЗМЕРЕНО ──────────────────────────────────────────────
   Полоса низа кадра (средняя яркость последних трёх процентов высоты)
   ведёт себя так (tools/полоса-во-времени.mjs, 14 снимков подряд):

     VPN прыжком      9 .. 78.9 .. 7.9    размах 71
     VPN прокруткой   9 .. 77.8 .. 9.3    размах 68.8
     CDN              7.9 ровно           размах 0

   Вспышка есть на ОБОИХ приходах, значит её видит человек, а не
   инструмент: это настоящий дефект. На кадре пика видно яркую
   бирюзовую лужу под пультом, в покое её нет.

   ── ПОЧЕМУ НЕ ПЕРЕБОР ГАШЕНИЕМ ────────────────────────────────────
   Проба `кто-внизу.mjs` гасит тела по одному и меряет полосу. На
   ПОСТОЯННОЙ картинке это точный метод, а здесь он врёт: пока идёт
   перебор, полоса сама меняется от времени, и разность «с телом и без»
   смешивается с разностью «раньше и позже». Живой пример из того
   прогона: гашение ПУСТОЙ группы (ноль детей) дало минус 68 единиц,
   чего не может быть.

   ── КАК МЕРИМ ЗДЕСЬ ───────────────────────────────────────────────
   Снимаем СОСТОЯНИЕ СЦЕНЫ дважды: на пике вспышки и в покое, и
   сравниваем свойства каждого тела и каждой лампы - прозрачность,
   свечение, цвет, силу, видимость. Что гаснет, то и рисовало.

   Рендеринг тут не участвует вовсе, поэтому обе пробы берутся из
   одного прогона и сравнивать можно честно. Пик находим не на глаз: он
   стоит на шестой-седьмой пробе от начала отсчёта, и это из замера
   выше, а не из догадки.

   Запуск: node tools/что-гаснет.mjs [пк|тел] */
import { chromium } from "playwright";
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

/* Приходим прокруткой, как человек: вспышка есть и так, и это уже
   измерено, а прыжок добавил бы к ней свой разгон. */
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

await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  /* Снимок состояния: всё видимое ниже узла финала и зала. Берём
     только то, что может СВЕТИТЬ полосу: прозрачность, свечение, цвет
     материала, сила лампы. Геометрию не трогаем - она не мигает. */
  window.__снимокСцены = function () {
    const из = [];
    W.scene.traverse((о) => {
      let p = о, видно = true;
      while (p) { if (!p.visible) { видно = false; break; } p = p.parent; }
      if (!видно) return;
      const путь = (function () {
        const ч = []; let q = о;
        while (q && ч.length < 5) { ч.unshift(q.name || q.type); q = q.parent; }
        return ч.join("/");
      })();
      if (о.isLight) {
        из.push({ что: путь, вид: "лампа", сила: +(о.intensity || 0).toFixed(4),
                  цвет: о.color ? о.color.getHexString() : null });
        return;
      }
      const м = о.material;
      if (!м) return;
      const список = Array.isArray(м) ? м : [м];
      for (let i = 0; i < список.length; i++) {
        const мм = список[i];
        if (!мм) continue;
        из.push({
          что: путь + (список.length > 1 ? ("#" + i) : ""),
          вид: мм.type || "материал",
          прозр: +(мм.opacity != null ? мм.opacity : 1).toFixed(4),
          свеч: мм.emissiveIntensity != null ? +mm_число(мм.emissiveIntensity) : null,
          цвет: мм.color ? мм.color.getHexString() : null,
          излуч: мм.emissive ? мм.emissive.getHexString() : null,
          /* Однородные значения шейдера, которыми у нас гасят и жгут:
             uBright, uOpacity, uGlow и всё, что похоже на силу. */
          одн: (function () {
            if (!мм.uniforms) return null;
            const о2 = {};
            for (const к in мм.uniforms) {
              if (!Object.prototype.hasOwnProperty.call(мм.uniforms, к)) continue;
              const з = мм.uniforms[к] && мм.uniforms[к].value;
              if (typeof з === "number") о2[к] = +з.toFixed(4);
            }
            return о2;
          })()
        });
      }
    });
    function mm_число(v) { return (typeof v === "number" ? v : 0).toFixed(4); }
    return из;
  };
});

async function проба(кадров) {
  await стр.evaluate((н) => new Promise((г) => {
    let k = 0; (function ш() { requestAnimationFrame(() => (++k >= н ? г() : ш())); })();
  }), кадров);
  return стр.evaluate(() => window.__снимокСцены());
}

/* Пик стоит примерно на шестой пробе по четыре кадра от начала
   отсчёта, покой - к четырнадцатой. Числа из замера полосы. */
await стр.evaluate(() => new Promise((г) => {
  let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 60 ? г() : ш())); })();
}));
await стр.waitForTimeout(2000);
const пик = await проба(24);
const покой = await проба(90);
await бр.close();

const покойПо = new Map();
for (const т of покой) покойПо.set(т.что, т);

function число(x) { return typeof x === "number" ? x : null; }
const разошлись = [];
for (const а of пик) {
  const б = покойПо.get(а.что);
  if (!б) { разошлись.push({ что: а.что, чем: "тело исчезло к покою", было: "видно", стало: "нет" }); continue; }
  if (а.вид === "лампа") {
    const д = (число(а.сила) || 0) - (число(б.сила) || 0);
    if (Math.abs(д) > 0.02) разошлись.push({ что: а.что, чем: "сила лампы", было: а.сила, стало: б.сила, д: +д.toFixed(3) });
    continue;
  }
  const дП = (число(а.прозр) || 0) - (число(б.прозр) || 0);
  if (Math.abs(дП) > 0.02) разошлись.push({ что: а.что, чем: "прозрачность", было: а.прозр, стало: б.прозр, д: +дП.toFixed(3) });
  if (а.цвет !== б.цвет) разошлись.push({ что: а.что, чем: "цвет", было: а.цвет, стало: б.цвет });
  if (а.излуч !== б.излуч) разошлись.push({ что: а.что, чем: "излучение", было: а.излуч, стало: б.излуч });
  if (а.одн && б.одн) {
    for (const к in а.одн) {
      if (!Object.prototype.hasOwnProperty.call(а.одн, к)) continue;
      const д = а.одн[к] - (б.одн[к] != null ? б.одн[к] : а.одн[к]);
      if (Math.abs(д) > 0.02) {
        разошлись.push({ что: а.что, чем: "шейдер " + к, было: а.одн[к], стало: б.одн[к], д: +д.toFixed(3) });
      }
    }
  }
}
/* Сортируем по величине падения: гаснет сильнее всех то, что и рисовало
   полосу. Знак важен - нас интересует именно ПАДЕНИЕ от пика к покою. */
разошлись.sort((x, y) => (y.д || 0) - (x.д || 0));

console.log(`ЧТО ГАСНЕТ ${КТО} ${экран.width}x${экран.height}, финал доля 0.99, приход прокруткой`);
console.log(`  тел на пике ${пик.length}, в покое ${покой.length}, разошлось ${разошлись.length}`);
for (const р of разошлись.slice(0, 25)) {
  console.log(`  ${String(р.д == null ? "" : р.д).padStart(8)}  ${р.чем.padEnd(18)} ` +
              `${String(р.было).padEnd(10)} -> ${String(р.стало).padEnd(10)} ${р.что}`);
}
if (!разошлись.length) {
  console.log("  между пиком и покоем не изменилось ничего:");
  console.log("  значит полосу двигает не свойство тела, а сам кадр -");
  console.log("  постобработка, положение камеры или порядок отрисовки.");
}
