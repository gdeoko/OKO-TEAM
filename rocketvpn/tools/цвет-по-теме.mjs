/* КАКИМ ЦВЕТОМ СОБРАЛИСЬ БУКВЫ ПРИ ЗАДАННОЙ ТЕМЕ.

   ЗАЧЕМ. Тема ломалась молча: слова и камень собирались набором той
   темы, которая успела встать первой, а событие «rv-тема» к этому
   моменту уже прошло. Кадром это видно сразу, но кадр в облаке стоит
   десятки минут: программный отрисовщик рисует шестьсот тысяч точек и
   дневное небо в одиночку.

   Числа отвечают на тот же вопрос за секунды. Ни одного снимка: читаем
   униформы уже собранных строк и говорим, светлые они или тёмные.

   Запуск: node tools/цвет-по-теме.mjs [светлая|тёмная] */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const ТЕМА = process.argv[2] || "светлая";

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const кон = await бр.newContext({ viewport: { width: 1440, height: 900 } });
await кон.addInitScript((т) => {
  try { localStorage.setItem("rv-тема", т); } catch (e) {}
}, ТЕМА);
const стр = await кон.newPage();
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });

/* Ждём переезда слов в объём: до него читать нечего. */
const дождались = await стр.waitForFunction(
  () => document.documentElement.classList.contains("рв-слова-в-сцене"),
  null, { timeout: 300000 }).then(() => true).catch(() => false);
console.log(`тема ${ТЕМА}, слова в сцене: ${дождались ? "да" : "НЕТ"}`);

/* Светлоту считает сам модуль слов: он один знает, какие меши его, и
   не путает их с надписями снарядов и приборов. */
const итог = await стр.evaluate(() => {
  const из = { тема: document.documentElement.getAttribute("data-тема"), слова: null, глыбы: null };
  try { из.слова = window.RV_СЛОВО3D && window.RV_СЛОВО3D["замер"](); } catch (e) {}
  /* Подписи глыб живут своим модулем и своей полярностью: набор и две
     каймы. Меряем их отдельно - именно они белели на светлом камне. */
  try {
    const W = window.RV_WORLD && window.RV_WORLD["мир"] ? window.RV_WORLD["мир"]() : null;
    if (W && W.сцена) {
      const свет = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      const я = [];
      W.сцена.traverse((о) => {
        if (!о.isMesh || !о.userData || о.userData["текст"] == null) return;
        const у = о.material && о.material.uniforms;
        if (у && у.uColor) я.push(+свет(у.uColor.value).toFixed(3));
      });
      if (я.length) из.глыбы = { штук: я.length, светлота: +(я.reduce((a, b) => a + b, 0) / я.length).toFixed(3) };
    }
  } catch (e2) {}
  return из;
});

console.log("тема на корне:", итог.тема);
const с = итог.слова;
if (!с || !с.акты || !с.акты.length) {
  console.log("замер слов пуст");
} else {
  console.log(`модуль слов говорит: тема ${с["тема"]}, поднято ${с["поднято"]}`);
  for (const а of с.акты) {
    const я = а["светлотаНабора"];
    console.log(`  ${а["акт"]}: строк ${а["строк"]}, просит «${а["проситТекст"] || "-"}», ` +
                `светлота ${я} (${я == null ? "?" : (я > 0.5 ? "СВЕТЛЫЙ" : "тёмный")})`);
  }
}
if (итог.глыбы) {
  const я = итог.глыбы.светлота;
  console.log(`подписи глыб: штук ${итог.глыбы.штук}, светлота ${я} ` +
              `(${я > 0.5 ? "СВЕТЛЫЙ" : "тёмный"})`);
}
await бр.close();
