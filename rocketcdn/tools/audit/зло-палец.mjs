/* Телефон: выход из финала, согласие и анкета на пульте.
   Проверки написаны по бедам сплошного обхода пальцем: голограмма
   пульта запирала ход страницы внутри себя, на дне не оставалось ни
   одного видимого выхода, поворот экрана уносил вперёд и копился, а
   согласие оставалось красным после того, как его поставили. */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");
const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123/";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                         "--autoplay-policy=no-user-gesture-required"] });
let бед = 0;
const шаг = (имя, ок, что) => { if (!ок) бед++; console.log((ок ? "ЧИСТО  " : "БЕДА   ") + имя + (что ? " :: " + что : "")); };

/* ── выход из финала на телефоне ── */
for (const [w, h] of [[360, 640], [390, 844]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForTimeout(4500);
  for (let i = 0; i < 30; i++) { await pg.mouse.wheel(0, 700); await pg.waitForTimeout(110); }
  await pg.waitForTimeout(2500);
  const в = await pg.evaluate(() => {
    const т = document.getElementById("toTop");
    const s = т ? getComputedStyle(т) : null;
    const r = т ? т.getBoundingClientRect() : null;
    return {
      внутри: /rc-deep-inside/.test(document.documentElement.className),
      видна: !!(s && s.visibility === "visible" && +s.opacity > 0.2 && s.display !== "none"),
      глухая: !!(т && (т.hasAttribute("inert") || (т.closest && т.closest("[inert]")))),
      вКадре: !!(r && r.top >= 0 && r.bottom <= innerHeight),
      размер: r ? Math.round(r.width) + "x" + Math.round(r.height) : null
    };
  });
  шаг(`выход из финала виден и живой (${w}x${h})`, в.внутри && в.видна && !в.глухая && в.вКадре,
      `внутри ${в.внутри} · видна ${в.видна} · заглушена ${в.глухая} · ${в.размер}`);
  if (в.видна && !в.глухая) {
    await pg.click("#toTop");
    await pg.waitForTimeout(2200);
    const y = await pg.evaluate(() => Math.round(scrollY));
    шаг(`выход работает (${w}x${h})`, y < 200, `после нажатия y=${y}`);
  }
  /* ── ход голограммы не заперт ── */
  const ход = await pg.evaluate(() => {
    const рамка = document.querySelector(".dsk-frame");
    const список = document.querySelector(".dsk-qs");
    const п = (э) => э ? getComputedStyle(э).overscrollBehaviorY : "нет";
    return { рамка: п(рамка), список: п(список) };
  });
  шаг(`ход голограммы отдаётся странице (${w}x${h})`, ход.рамка !== "contain" && ход.список !== "contain",
      `рамка ${ход.рамка} · список ${ход.список}`);
  await pg.close();
}

/* ── поворот держит долю прочитанного ── */
{
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForTimeout(4500);
  const доля = () => pg.evaluate(() => {
    const макс = document.documentElement.scrollHeight - innerHeight;
    return макс > 0 ? +(scrollY / макс).toFixed(3) : 0;
  });
  await pg.evaluate(() => window.scrollTo(0, Math.round((document.documentElement.scrollHeight - innerHeight) * 0.62)));
  await pg.waitForTimeout(1800);
  const было = await доля();
  for (let к = 0; к < 3; к++) {
    await pg.setViewportSize({ width: 844, height: 390 });
    await pg.waitForTimeout(2400);
    await pg.setViewportSize({ width: 390, height: 844 });
    await pg.waitForTimeout(2400);
  }
  const стало = await доля();
  шаг("поворот не уносит с места", Math.abs(стало - было) < 0.06,
      `доля ${было} -> ${стало} после трёх поворотов туда и обратно`);
  await pg.close();
}

/* ── согласие перестаёт быть красным ── */
{
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForTimeout(4500);
  await pg.evaluate(() => { const к = document.querySelector(".js-callback"); if (к) к.click(); });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { const ф = document.querySelector(".modal.on form"); if (ф) ф.requestSubmit ? ф.requestSubmit() : ф.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true })); });
  await pg.waitForTimeout(900);
  const до = await pg.evaluate(() => {
    const с = document.querySelector(".modal.on .consent");
    return с ? с.className : "нет";
  });
  await pg.evaluate(() => {
    const ф = document.querySelector(".modal.on .consent input[type=checkbox]");
    if (ф) { ф.checked = true; ф.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  await pg.waitForTimeout(700);
  const после = await pg.evaluate(() => {
    const с = document.querySelector(".modal.on .consent");
    return с ? с.className : "нет";
  });
  шаг("согласие перестаёт быть красным", /bad/.test(до) && !/bad/.test(после), `${до} -> ${после}`);
  await pg.close();
}

console.log(бед ? "ИТОГ: телефон ещё не в порядке" : "ИТОГ: телефон в порядке");
await b.close();
process.exit(бед ? 1 : 0);
