/* КТО РИСУЕТ ПЯТНА, ВТОРОЙ ЗАХОД. Гашение точек, спрайтов, прозрачных
   мешей и инстансов кляксы не сняло. Остаются: непрозрачные меши (в
   том числе лицо передней секции салона, оно висит на камере), сама
   разметка поверх холста и холст целиком. Три кадра: без холста, без
   всех мешей, без всего, что висит на камере.

   Запуск: node tools/кдн-кто-пятна-2.mjs [тел|пк] [адрес] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "тел";
const АДРЕС = process.argv[3] || "http://127.0.0.1:8171/?rcdbg=1";
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
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 200)));
await стр.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RC_GL && window.RC_GL.ready3d, null, { timeout: 300000 });
await стр.waitForTimeout(2000);
async function кадры(n) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), n);
}
await стр.evaluate(() => window.RC_FLIGHT.open());
await стр.waitForFunction(() => document.querySelector(".rcf-brief button[data-mode=auto]"), null, { timeout: 60000 });
await кадры(20);
await стр.evaluate(() => document.querySelector(".rcf-brief button[data-mode=manual]").click());
await кадры(20);
await стр.evaluate(() => window.RC_FLIGHT._пост(false));
await кадры(50);
await стр.screenshot({ path: `/tmp/пятна2-${КТО}-все.png` });

/* 1. Без холста: остаётся только разметка */
await стр.evaluate(() => { document.querySelector(".rcf-cv").style.visibility = "hidden"; });
await кадры(3);
await стр.screenshot({ path: `/tmp/пятна2-${КТО}-без-холста.png` });
await стр.evaluate(() => { document.querySelector(".rcf-cv").style.visibility = ""; });

/* 2. Без всего, что висит на камере (салон) */
const наКамере = await стр.evaluate(() => {
  const cam = window.RC_FLIGHT._cam();
  const из = [];
  cam.children.forEach((о) => { из.push(о.name || о.type); о.__б = о.visible; о.visible = false; });
  return из;
});
await кадры(12);
await стр.screenshot({ path: `/tmp/пятна2-${КТО}-без-камерного.png` });
await стр.evaluate(() => { window.RC_FLIGHT._cam().children.forEach((о) => { о.visible = о.__б !== false; }); });
console.log("на камере: " + наКамере.join(", "));

/* 3. Без всех мешей сцены (любой материал), точки и спрайты остаются */
const мешей = await стр.evaluate(() => {
  const cam = window.RC_FLIGHT._cam();
  let scene = cam; while (scene.parent) scene = scene.parent;
  let n = 0;
  scene.traverse((о) => { if (о.isMesh && о.visible) { о.__б2 = true; о.visible = false; n++; } });
  return n;
});
await кадры(12);
await стр.screenshot({ path: `/tmp/пятна2-${КТО}-без-мешей.png` });
console.log("мешей погашено: " + мешей);
/* 4. Только разметка поверх: список слоёв в обёртке с их прозрачностью */
const слои = await стр.evaluate(() => {
  const w = document.querySelector(".rc-flight");
  return [].map.call(w.children, (э) => {
    const с = getComputedStyle(э);
    return `${э.tagName.toLowerCase()}.${(э.className || "").toString().split(" ")[0]} op=${с.opacity} disp=${с.display} vis=${с.visibility}`;
  });
});
console.log("слои обёртки:\n  " + слои.join("\n  "));
await бр.close();
