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
for (let круг = 1; круг <= 3; круг++) {
  await pg.evaluate(() => window.RC_FLIGHT && window.RC_FLIGHT.open && window.RC_FLIGHT.open());
  await pg.waitForTimeout(6000);
  const вПолёте = (await снимок()).гл;
  if (круг === 1) шаг("полёт действительно занял место", вПолёте.used > глДо.used,
                      `в полёте used ${вПолёте.used} против ${глДо.used} на странице`);
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

console.log(бед ? "ИТОГ: утечки остались" : "ИТОГ: круги не текут");
await b.close();
process.exit(бед ? 1 : 0);
