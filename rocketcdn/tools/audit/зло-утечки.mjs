/* Утечки при переключении языка и при круге через полёт.
   Три беды разом. Наблюдатели графиков и хуков копились на одних и
   тех же узлах. Кадровый цикл волны поднимался заново на каждый
   круг и рисовал в холст, выброшенный из документа. Место в бюджете
   контекстов WebGL возвращалось дважды: руками при разборе мира и
   ещё раз страховкой, когда приходило событие о потере контекста. */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");
const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123/?rcdbg=1";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                         "--autoplay-policy=no-user-gesture-required"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.addInitScript(() => {
  window.__счёт = { raf: {}, io: 0, ioЖивых: 0 };
  const rAF = window.requestAnimationFrame;
  window.requestAnimationFrame = function (fn) {
    const где = (new Error().stack || "").split("\n")[2] || "";
    const м = где.match(/rc-[a-z0-9]+\.js/);
    const к = м ? м[0] : "прочее";
    window.__счёт.raf[к] = (window.__счёт.raf[к] || 0) + 1;
    return rAF.call(window, fn);
  };
  const IO = window.IntersectionObserver;
  window.IntersectionObserver = function (fn, opt) {
    const o = new IO(fn, opt);
    window.__счёт.io++;
    window.__счёт.ioЖивых++;
    const dis = o.disconnect.bind(o);
    o.disconnect = function () { window.__счёт.ioЖивых--; return dis(); };
    return o;
  };
  window.IntersectionObserver.prototype = IO.prototype;
});
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await pg.waitForTimeout(6000);

let бед = 0;
const шаг = (имя, ок, что) => { if (!ок) бед++; console.log((ок ? "ЧИСТО  " : "БЕДА   ") + имя + (что ? " :: " + что : "")); };
const проход = async () => {
  for (let i = 0; i < 6; i++) { await pg.mouse.wheel(0, 900); await pg.waitForTimeout(250); }
  for (let i = 0; i < 6; i++) { await pg.mouse.wheel(0, -900); await pg.waitForTimeout(250); }
  await pg.waitForTimeout(600);
};
const снимок = () => pg.evaluate(() => ({
  волна: window.__счёт.raf["rc-viz.js"] || 0,
  дозоров: window.__счёт.ioЖивых,
  гл: window.RC_GL ? window.RC_GL.stats() : null
}));

await проход();
const до = await снимок();
for (let i = 0; i < 8; i++) {
  await pg.evaluate(() => {
    const кн = document.querySelectorAll(".hdr-act .pill button[data-lang], .hdr-act .pill button");
    const цель = [].find.call(кн, (b) => !b.classList.contains("on") && /^(RU|EN)$/.test(b.textContent.trim()));
    if (цель) цель.click();
  });
  await pg.waitForTimeout(500);
}
await pg.waitForTimeout(1200);
const серёд = await снимок();
await проход();
const после = await снимок();

const волнаДо = до.волна, волнаПосле = после.волна - серёд.волна;
шаг("циклы волны не плодятся", волнаПосле <= волнаДо * 1.6,
    `тот же проход: до ${волнаДо} заявок кадра, после восьми переключений ${волнаПосле}`);
шаг("наблюдатели не копятся", после.дозоров <= до.дозоров + 6,
    `живых наблюдателей ${до.дозоров} -> ${после.дозоров}`);

/* ── круг через полёт со сменой языка ── */
const глДо = (await снимок()).гл;
/* Ждём открытия ПО ФАКТУ, а не по таймеру.

   Стояло шесть секунд глухого ожидания, и проверка падала на первом
   же шаге: «в полёте used 3 против 3 на странице». Полёт при этом
   был исправен - отдельным замером после тех же восьми переключений
   языка он открывается и честно занимает четвёртый контекст (3 -> 4).
   Тормозила сама проверка: обёртка над requestAnimationFrame выше
   собирает стек вызовов на КАЖДЫЙ кадр, а кадров на этой странице
   много, и под софтверной отрисовкой мир не успевал собраться.

   Инструмент, который заваливает исправную сцену, хуже отсутствующего:
   он приучает не верить красному. Поэтому ждём флага «открыт» из
   самой игры и только потом меряем. */
async function дождатьсяПолёта(сек) {
  for (let т = 0; т < сек * 4; т++) {
    const есть = await pg.evaluate(() =>
      !!(window.RC_FLIGHT && window.RC_FLIGHT.state && window.RC_FLIGHT.state()["открыт"]));
    if (есть) { await pg.waitForTimeout(1200); return true; }
    await pg.waitForTimeout(250);
  }
  return false;
}

/* Сторож кадров может выключить полёт совсем.

   На третьей ступени упрощения open() выходит сразу - так задумано,
   слабой машине игру не дают. Проверка утечек про это ничего не
   знала и записывала отказ в беду. А ступень тут поднимается легко:
   отрисовка софтверная, да ещё обёртка над кадрами выше собирает
   стек на каждый вызов.

   Поэтому сначала спрашиваем ступень. Выключен полёт - говорим об
   этом прямо и не меряем того, чего нет: круг через полёт в этом
   прогоне просто не состоялся. Это честнее и красного вранья, и
   зелёного молчания. */
const среда = () => pg.evaluate(() => ({
  ступень: document.documentElement.getAttribute("data-degrade") || "0",
  упрощено: document.documentElement.classList.contains("rc-reduced"),
  без3d: document.documentElement.classList.contains("rc-no3d")
}));
let полётЖив = true;

for (let круг = 1; круг <= 3; круг++) {
  await pg.evaluate(() => window.RC_FLIGHT && window.RC_FLIGHT.open && window.RC_FLIGHT.open());
  const взлетел = await дождатьсяПолёта(30);
  const вПолёте = (await снимок()).гл;
  if (круг === 1) {
    const с = await среда();
    полётЖив = !(с.ступень === "3" || с.упрощено || с.без3d);
    if (!полётЖив) {
      console.log(`ПРОПУСК круг через полёт :: сторож кадров выключил игру ` +
                  `(ступень ${с.ступень}${с.упрощено ? ", rc-reduced" : ""}${с.без3d ? ", rc-no3d" : ""})`);
    } else {
      шаг("полёт вообще открывается", взлетел, взлетел ? "флаг «открыт» поднят" : "за тридцать секунд не открылся");
      шаг("полёт действительно занял место", вПолёте.used > глДо.used,
          `в полёте used ${вПолёте.used} против ${глДо.used} на странице`);
    }
  }
  await pg.evaluate(() => {
    const кн = document.querySelectorAll(".hdr-act .pill button");
    const цель = [].find.call(кн, (b) => !b.classList.contains("on") && /^(RU|EN)$/.test(b.textContent.trim()));
    if (цель) цель.click();
  });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => window.RC_FLIGHT && window.RC_FLIGHT.close && window.RC_FLIGHT.close());
  await pg.waitForTimeout(2500);
}
const глПосле = (await снимок()).гл;
шаг("бюджет контекстов не уезжает", глПосле && глДо && глПосле.used >= глДо.used,
    `used ${глДо ? глДо.used : "?"} -> ${глПосле ? глПосле.used : "?"} · сцен ${глДо ? глДо.scenes : "?"} -> ${глПосле ? глПосле.scenes : "?"}`);
шаг("список сцен не растёт кругами", глПосле && глДо && глПосле.scenes <= глДо.scenes + 1,
    `сцен ${глДо ? глДо.scenes : "?"} -> ${глПосле ? глПосле.scenes : "?"}`);

if (!полётЖив) {
  console.log("ИТОГ по полёту не снят: игра была выключена сторожем кадров. " +
              "Переключение языка проверено полностью.");
}
console.log(бед ? "ИТОГ: утечки остались" : "ИТОГ: круги не текут");
await b.close();
process.exit(бед ? 1 : 0);
