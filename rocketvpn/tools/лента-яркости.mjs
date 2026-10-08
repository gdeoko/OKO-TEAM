/* ЛЕНТА ЯРКОСТИ: шов и чёрный экран ловятся числом, а не глазом.

   Владелец: «после входа в ракету не было шва и вспышки какой-то,
   после чего просто чёрный экран». Такое видно ровно один раз и на
   одном устройстве, а руками его не поймать: пока доскроллишь до
   нужного места, кадр уже собрался.

   Инструмент листает ленту мелким шагом, как палец, и на каждом шаге
   снимает СРЕДНЮЮ ЯРКОСТЬ кадра. Дальше по профилю видно:
     · провал в ноль на несколько шагов подряд - чёрный экран;
     · всплеск втрое выше соседей - вспышка;
     · ступенька - шов, кадр сменился скачком.
   Печатается профиль и список подозрительных мест с долями.

   Работает на обоих сайтах: холсты собираются в один кадр по их
   размеру, а не по именам.

   Запуск: node tools/лента-яркости.mjs <адрес> [пк|тел] [от] [до] [шаг] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.argv[2] || "http://127.0.0.1:8171";
const КТО = process.argv[3] || "тел";
const ОТ = +(process.argv[4] || 0.55);
const ДО = +(process.argv[5] || 1.0);
const ШАГ = +(process.argv[6] || 0.01);
const экран = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: экран, deviceScaleFactor: 1, isMobile: КТО === "тел", hasTouch: КТО === "тел"
});
const стр = await кон.newPage();
const исключения = [];
стр.on("pageerror", (e) => исключения.push(e.message.slice(0, 140)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForLoadState("networkidle", { timeout: 180000 }).catch(() => {});
await стр.waitForTimeout(6000);

async function кадры(n) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), n);
}
async function яркость() {
  return await стр.evaluate(() => new Promise((готово) => {
    const W = innerWidth, H = innerHeight;
    const c = document.createElement("canvas");
    /* Мельчим нарочно: нам нужна средняя яркость кадра, а не картинка.
       Восьмушка по стороне это в шестьдесят четыре раза меньше работы,
       и на профиле разницы нет. */
    c.width = Math.max(8, W >> 3); c.height = Math.max(8, H >> 3);
    const x = c.getContext("2d");
    x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height);
    /* Холст WebGL отдаёт свои пиксели ТОЛЬКО внутри того кадра, в
       котором рисовал: буфер не сохраняется, и чтение следующей
       задачей возвращает пустоту. Прежний замер по этой причине
       печатал ноль на живом кадре - ошибка того же рода, что уже
       описана в приёмке: замер мерил не то, что нарисовано. */
    const холсты = [].slice.call(document.querySelectorAll("canvas")).filter((cv) => {
      const к = cv.getBoundingClientRect();
      const с = getComputedStyle(cv);
      return к.width > W * 0.8 && к.height > H * 0.8 &&
             с.visibility !== "hidden" && с.display !== "none" && +с.opacity > 0.05;
    });
    requestAnimationFrame(() => {
      for (const cv of холсты) { try { x.drawImage(cv, 0, 0, c.width, c.height); } catch (e) {} }
      const д = x.getImageData(0, 0, c.width, c.height).data;
      let s = 0;
      for (let i = 0; i < д.length; i += 4) s += д[i] * 0.2126 + д[i + 1] * 0.7152 + д[i + 2] * 0.0722;
      готово({ я: +(s / (д.length / 4)).toFixed(2), холстов: холсты.length,
               класс: (document.documentElement.className.match(/rc-(in-hatch|inside|deep-inside|stage|flying)/g) || []).join(" ") });
    });
  }));
}

const высота = await стр.evaluate(() =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
/* Подходим к началу отрезка мелкими шагами: телепорт показал бы кадр,
   которого человек никогда не увидит. */
for (let i = 1; i <= 40; i++) {
  await стр.evaluate((y) => window.scrollTo(0, y), Math.round(высота * ОТ * (i / 40)));
  await кадры(2);
}
await стр.waitForTimeout(2500);

const строки = [];
for (let д = ОТ; д <= ДО + 1e-9; д += ШАГ) {
  await стр.evaluate((y) => window.scrollTo(0, y), Math.round(высота * д));
  await кадры(4);
  const з = await яркость();
  строки.push({ доля: +д.toFixed(3), ...з });
}

console.log(`ЛЕНТА ЯРКОСТИ ${АДРЕС} ${КТО} ${экран.width}x${экран.height}, высота ${Math.round(высота)}`);
for (const с of строки) {
  const полоса = "#".repeat(Math.min(40, Math.round(с.я)));
  console.log(`  ${с.доля.toFixed(3)}  ${String(с.я).padStart(7)}  ${String(с.холстов)}  ${полоса}  ${с.класс}`);
}

const беды = [];
/* Чёрный экран: два шага подряд ниже полутора единиц яркости там, где
   соседи заметно светлее. Ноль в самом начале ленты законен. */
for (let i = 1; i < строки.length - 1; i++) {
  const а = строки[i - 1], б = строки[i], в = строки[i + 1];
  if (б.я < 1.5 && а.я > 4 && в.я > 4) беды.push(`провал в чёрное на доле ${б.доля} (${а.я} -> ${б.я} -> ${в.я})`);
  if (б.я > а.я * 3 + 6 && б.я > в.я * 3 + 6) беды.push(`вспышка на доле ${б.доля} (${а.я} -> ${б.я} -> ${в.я})`);
  if (а.я > 2 && Math.abs(б.я - а.я) > Math.max(9, а.я * 0.75)) {
    беды.push(`ступенька на доле ${б.доля}: ${а.я} -> ${б.я}`);
  }
}
if (исключения.length) беды.push("исключения: " + исключения.slice(0, 3).join(" | "));
if (беды.length) {
  console.log("ГРЯЗНО  лента яркости");
  for (const б of беды) console.log("   " + б);
} else {
  console.log("ЧИСТО  лента яркости: ни провала, ни вспышки, ни ступеньки");
}
await бр.close();
