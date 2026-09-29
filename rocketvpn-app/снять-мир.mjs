/* СТЕНД 3D-МИРА: снимки сцены темы с замороженным временем.

   node снять-мир.mjs <тема> [время,время,...] [папка] [--без-интерфейса] [--удар=доля] [--dpr=2]

   Живую сцену снимать нельзя - кадр всё время другой. Время
   замораживается на заданной секунде, и снимок повторяется точь-в-точь.
   Браузер без видеокарты рисует WebGL программно (SwiftShader), поэтому
   один кадр может считаться несколько секунд: это нормально.

   --без-интерфейса  прячет карточки, чтобы увидеть мир целиком
   --удар=0.6        ставит след замера на заданную долю (как раскадровка)
*/
import { chromium } from "/home/user/OKO-TEAM/rocketvpn/node_modules/playwright/index.mjs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { поднятьСервер } from "./сервер.mjs";

const КОРЕНЬ = dirname(fileURLToPath(import.meta.url));
const арг = process.argv.slice(2);
const флаги = Object.fromEntries(арг.filter(а => а.startsWith("--")).map(а => { const [к, з] = а.slice(2).split("="); return [к, з ?? true]; }));
const прочее = арг.filter(а => !а.startsWith("--"));
const тема = прочее[0] || "океан";
const времена = (прочее[1] || "2.0").split(",").map(Number);
const куда = прочее[2] || join(КОРЕНЬ, "кадры-мир");
mkdirSync(куда, { recursive: true });
const dpr = Number(флаги.dpr || 2);

const бр = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
         "--force-color-profile=srgb"]
});
const стр = await бр.newPage({ viewport: { width: Number(флаги.w || 430), height: Number(флаги.h || 932) }, deviceScaleFactor: dpr });
const беды = [];
стр.on("pageerror", e => беды.push("JS: " + String(e).slice(0, 300)));
стр.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) беды.push("консоль: " + m.text().slice(0, 300)); });
/* 404 печатаем с адресом: голое «Failed to load resource» не говорит,
   какой файл не нашёлся. Значок вкладки (favicon) не считаем. */
стр.on("response", о => { if (о.status() >= 400 && !/favicon/.test(о.url())) беды.push("нет файла " + о.status() + ": " + decodeURIComponent(о.url())); });

/* по http, а не file://: иначе браузер не отдаёт текстуры в WebGL (CORS) */
const сервер = await поднятьСервер(join(КОРЕНЬ, "планета"));
await стр.goto(сервер.адрес + "/index.html", { waitUntil: "load" });
await стр.waitForFunction(() => window.МИР && window.ЭКРАН_ГОТОВ && window.ЭКРАН_ГОТОВ(), null, { timeout: 30000 });
await стр.evaluate((т) => window.ТЕМА(т), тема);
await стр.waitForTimeout(2500);
if (флаги["без-интерфейса"]) {
  await стр.addStyleTag({ content: ".шапка,.экраны,.низ,.всплывашка{opacity:0!important}" });
}
for (const t of времена) {
  await стр.evaluate((т) => window.МИР.заморозить(т), t);
  if (флаги.удар) await стр.evaluate((д) => window.СТОП_УДАР(Number(д)), флаги.удар);
  /* кадр в программном WebGL считается долго: ждём, пока движок
     отрисует хотя бы три кадра с новым временем */
  await стр.evaluate(() => new Promise(r => { let n = 0; const f = () => (++n >= 3 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }));
  await стр.waitForTimeout(400);
  const имя = join(куда, `${тема}-t${t.toFixed(2)}${флаги["без-интерфейса"] ? "-мир" : ""}${флаги.удар ? "-удар" + флаги.удар : ""}.png`);
  await стр.screenshot({ path: имя });
  console.log("снято", имя);
}
const сведения = await стр.evaluate(() => ({ тема: МИР.текущая(), жив: МИР.жив, класс: document.documentElement.className, источник: МИР.источник(), якоря: МИР.якоря }));
console.log(JSON.stringify(сведения));
console.log(беды.length ? "ОШИБКИ:\n" + беды.join("\n") : "ошибок нет");
await бр.close();
сервер.закрыть();
