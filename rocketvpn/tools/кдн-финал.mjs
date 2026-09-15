/* ФИНАЛ CDN НА ТЕЛЕФОНЕ. Владелец прислал снимок с телефона: финальная
   сцена сайта CDN внутри ракеты вышла тёмным экраном, на котором едва
   читается размытое «ГОТОВ К СТАРТУ». Это карточка брифинга полёта,
   значит мир игры под ней не нарисовался или его накрыл слой.

   Инструмент проходит ленту CDN пальцем до конца, снимает кадры на
   трёх долях и печатает, что стоит между человеком и космосом: классы
   обёртки полёта, прозрачность брифинга и затемнения, размеры холстов,
   потерю контекста WebGL, исключения и ошибки консоли, и кто лежит под
   пальцем в середине экрана. Глазом на чёрном не разобрать, чей это
   чёрный.

   Запуск: node tools/кдн-финал.mjs [тел|пк] [адрес] */
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
стр.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") беды.push(m.type() + " " + m.text().slice(0, 200));
});
await стр.addInitScript(() => {
  window.__потериКонтекста = [];
  document.addEventListener("webglcontextlost", (e) => {
    window.__потериКонтекста.push((e.target && e.target.className) || "canvas");
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
async function доДоли(доля, шагов) {
  const высота = await стр.evaluate(() =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
  const от = await стр.evaluate(() => window.scrollY);
  const цель = высота * доля;
  for (let i = 1; i <= шагов; i++) {
    await стр.evaluate((y) => window.scrollTo(0, y), Math.round(от + (цель - от) * (i / шагов)));
    await кадры(2);
  }
  return высота;
}
async function состояние() {
  return await стр.evaluate(() => {
    const из = { y: Math.round(scrollY), высота: document.documentElement.scrollHeight };
    const о = (сел) => document.querySelector(сел);
    const св = (эл) => {
      if (!эл) return null;
      const с = getComputedStyle(эл), к = эл.getBoundingClientRect();
      return { класс: (эл.className || "").toString().slice(0, 120), opacity: с.opacity, vis: с.visibility,
               display: с.display, filter: с.filter, z: с.zIndex,
               прям: [Math.round(к.left), Math.round(к.top), Math.round(к.width), Math.round(к.height)] };
    };
    из.wrap = св(о(".rcf-wrap"));
    из.brief = св(o_(".rcf-brief"));
    function o_(s) { return о(s); }
    из.card = св(о(".rcf-brief-card"));
    из.fade = св(о(".rcf-fade"));
    из.холсты = [].map.call(document.querySelectorAll("canvas"), (c) => {
      const с = getComputedStyle(c), к = c.getBoundingClientRect();
      return { кл: (c.className || "").toString().slice(0, 40), w: c.width, h: c.height,
               экр: [Math.round(к.width), Math.round(к.height)], op: с.opacity, vis: с.visibility, disp: с.display };
    });
    из.потери = window.__потериКонтекста;
    try { из.gl = window.RC_GL ? { ready3d: !!window.RC_GL.ready3d, слой: window.RC_GL["слой"] && window.RC_GL["слой"]() } : "нет RC_GL"; } catch (e) { из.gl = "ошибка " + e.message; }
    /* Кто под пальцем: цепочка предков с их прозрачностью и фильтром */
    const т = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    const цепь = [];
    let у = т, n = 0;
    while (у && у !== document.documentElement && n++ < 12) {
      const с = getComputedStyle(у);
      цепь.push(`${у.tagName.toLowerCase()}${у.id ? "#" + у.id : ""}.${(у.className || "").toString().split(" ").slice(0, 3).join(".")} op=${с.opacity} f=${с.filter} bg=${с.backgroundColor}`);
      у = у.parentElement;
    }
    из.подПальцем = цепь;
    из.body = (document.body.className || "").slice(0, 200);
    из.html = (document.documentElement.className || "").slice(0, 200);
    return из;
  });
}

for (const [доля, шагов] of [[0.88, 80], [0.96, 30], [1.0, 20]]) {
  const высота = await доДоли(доля, шагов);
  await стр.waitForTimeout(3500);
  await кадры(20);
  const ф = `/tmp/кдн-${КТО}-${доля}.png`;
  await стр.screenshot({ path: ф });
  const с = await состояние();
  console.log(`\n== доля ${доля} (высота ${Math.round(высота)}) -> ${ф}`);
  console.log(JSON.stringify(с, null, 1));
}
if (беды.length) {
  console.log("\nБЕДЫ (" + беды.length + "):");
  for (const б of беды.slice(0, 25)) console.log("  " + б);
}
await бр.close();
