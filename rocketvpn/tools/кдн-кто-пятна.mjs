/* КТО РИСУЕТ ПЯТНА: гасим слои по роду и смотрим, когда кляксы
   пропадут. Сравнение «с плёнкой / без» показало, что пятна живут в
   самой сцене, а не в свечении. По размерам точек виновного не найти:
   все слои точек стоят в пикселях и крупнее семи нет. Значит
   спрашиваем кадр: прячем разом все точки, потом все спрайты, потом
   все прозрачные меши, потом инстансы, и по снимкам видно, с каким
   родом кляксы ушли. Дальше внутри рода тем же способом по одному.

   Запуск: node tools/кдн-кто-пятна.mjs [тел|пк] [точка] [адрес] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "тел";
const ТОЧКА = +(process.argv[3] || 0.1);
const АДРЕС = process.argv[4] || "http://127.0.0.1:8171/?rcdbg=1";
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
/* Ручное управление: корабль стоит, кадр от снимка к снимку тот же */
await стр.evaluate(() => document.querySelector(".rcf-brief button[data-mode=manual]").click());
await кадры(20);
await стр.evaluate((v) => window.RC_FLIGHT._set(v), ТОЧКА);
await стр.evaluate(() => window.RC_FLIGHT._пост(false));
await кадры(60);

const РОДЫ = ["точки", "спрайты", "прозрачные меши", "инстансы", "линии"];
async function спрятать(род, да) {
  return await стр.evaluate(([род, да]) => {
    const cam = window.RC_FLIGHT._cam();
    let scene = cam; while (scene.parent) scene = scene.parent;
    const имена = [];
    scene.traverse((о) => {
      let свой = false;
      if (род === "точки" && о.isPoints) свой = true;
      if (род === "спрайты" && о.isSprite) свой = true;
      if (род === "прозрачные меши" && о.isMesh && !о.isInstancedMesh && о.material && о.material.transparent) свой = true;
      if (род === "инстансы" && о.isInstancedMesh) свой = true;
      if (род === "линии" && (о.isLine || о.isLineSegments)) свой = true;
      if (!свой) return;
      if (!да) {
        if (!о.visible) return;
        о.__былоВидно = true; о.visible = false;
        let имя = о.name, р = о.parent, ш = 0;
        while (!имя && р && ш++ < 4) { имя = р.name; р = р.parent; }
        имена.push((имя || "?") + "/" + (о.geometry ? о.geometry.type : "") +
                   (о.material && о.material.map ? "+карта" : "") +
                   (о.material && о.material.size ? " size=" + о.material.size : ""));
      } else if (о.__былоВидно) { о.visible = true; о.__былоВидно = false; }
    });
    return имена;
  }, [род, да]);
}
await стр.screenshot({ path: `/tmp/пятна-${КТО}-все.png` });
console.log(`все -> /tmp/пятна-${КТО}-все.png`);
for (const род of РОДЫ) {
  const сп = await спрятать(род, false);
  await кадры(12);
  const ф = `/tmp/пятна-${КТО}-без-${род.replace(/ /g, "_")}.png`;
  await стр.screenshot({ path: ф });
  console.log(`\nбез: ${род} (${сп.length}) -> ${ф}\n  ` + сп.slice(0, 40).join("\n  "));
  await спрятать(род, true);
  await кадры(4);
}
await бр.close();
