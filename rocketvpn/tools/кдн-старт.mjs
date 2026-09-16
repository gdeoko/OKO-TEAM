/* СТАРТ ПОЛЁТА ИЗ ФИНАЛА CDN. Владелец нажал «Начать полёт» на
   телефоне и получил тёмный экран с едва видимой карточкой «ГОТОВ К
   СТАРТУ». Стенд с прокруткой до конца показывает здоровый салон, то
   есть беда живёт в самом переходе из сцены в полёт: там разом
   возвращаются двадцать одно дальнее тело, плотность кадра поднимается
   до потолка и включается плёнка.

   Инструмент доходит до конца ленты, нажимает кнопку полёта на
   голограмме и снимает кадры через 0.5, 2, 5 и 10 секунд, печатая по
   каждому: классы обёртки полёта, прозрачность брифинга, размер холста,
   потерю контекста, исключения. Так видно, в какую секунду и что
   именно гаснет.

   Запуск: node tools/кдн-старт.mjs [тел|пк] [адрес] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "тел";
const АДРЕС = process.argv[3] || "http://127.0.0.1:8171/";
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
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 200)));
стр.on("console", (m) => { if (m.type() === "error") беды.push("console " + m.text().slice(0, 200)); });
await стр.addInitScript(() => {
  window.__потериКонтекста = [];
  document.addEventListener("webglcontextlost", (e) => {
    const c = e.target;
    window.__потериКонтекста.push((c && (c.className || c.id)) || "canvas");
  }, true);
});

await стр.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForLoadState("networkidle", { timeout: 180000 }).catch(() => {});
await стр.waitForTimeout(6000);

async function кадры(n) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), n);
}
const высота = await стр.evaluate(() =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
for (let i = 1; i <= 90; i++) {
  await стр.evaluate((y) => window.scrollTo(0, y), Math.round(высота * (i / 90)));
  await кадры(2);
}
await стр.waitForTimeout(4000);
await кадры(20);

async function состояние() {
  return await стр.evaluate(() => {
    const о = (сел) => document.querySelector(сел);
    const св = (эл) => {
      if (!эл) return null;
      const с = getComputedStyle(эл), к = эл.getBoundingClientRect();
      return { класс: (эл.className || "").toString().slice(0, 140), op: с.opacity, vis: с.visibility,
               прям: [Math.round(к.left), Math.round(к.top), Math.round(к.width), Math.round(к.height)] };
    };
    const cv = о(".rcf-cv");
    return {
      y: Math.round(scrollY),
      wrap: св(о(".rc-flight")),
      brief: св(о(".rcf-brief")),
      fade: св(о(".rcf-fade")),
      desk: св(о(".rc-desk")),
      холст: cv ? { w: cv.width, h: cv.height, op: getComputedStyle(cv).opacity } : null,
      потери: window.__потериКонтекста,
      html: (document.documentElement.className || "").slice(0, 220)
    };
  });
}
console.log("до нажатия: " + JSON.stringify(await состояние()));
const кнопка = await стр.$(".rc-desk .dsk-b-fly");
if (!кнопка) { console.log("кнопки полёта на голограмме НЕТ"); await бр.close(); process.exit(1); }
await кнопка.click();
for (const [мс, метка] of [[500, "0.5с"], [1500, "2с"], [3000, "5с"], [5000, "10с"]]) {
  await стр.waitForTimeout(мс);
  await кадры(3);
  const ф = `/tmp/старт-${КТО}-${метка}.png`;
  await стр.screenshot({ path: ф });
  console.log(`\n== ${метка} -> ${ф}\n` + JSON.stringify(await состояние()));
}
if (беды.length) {
  console.log("\nБЕДЫ (" + беды.length + "):");
  for (const б of беды.slice(0, 20)) console.log("  " + б);
}
await бр.close();
