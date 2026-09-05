/* Покадровая съёмка igloo.inc через зеркало сети.

   ЗАЧЕМ. Владелец: «покадрово открой всю 234 сцену igloo, прям каждый
   миллиметр отскриль и проанализируй», «прям сейчас открой посмотри,
   замеры сделай, открой сайт, посмотри как выглядит глыба».

   ПОЧЕМУ КОЛЕСОМ, А НЕ ПРОКРУТКОЙ. У igloo лента ВИРТУАЛЬНАЯ: высота
   документа так и остаётся в один экран, полосы прокрутки нет, а ход
   фильма они считают сами из событий колеса и касания. window.scrollTo
   на таком сайте не делает ничего - первая съёмка это и показала
   (высота 900 на всех шагах, один и тот же кадр).

   Поэтому крутим настоящим колесом мыши и снимаем после каждого шага.

   ПОЧЕМУ ЧЕРЕЗ ЗЕРКАЛО. Браузер в этой песочнице наружу не ходит:
   агентский прокси рвёт его туннель. curl через тот же прокси ходит.
   Значит каждый запрос браузера перехватываем, берём файл из кэша
   (его наполняет tools/игло-зеркало.mjs) и отдаём как ответ сервера.

   Запуск:
     node tools/игло-плёнка.mjs                    ПК, 60 шагов по 900
     node tools/игло-плёнка.mjs 120 700 ПК         шагов, точек на шаг
     node tools/игло-плёнка.mjs 60 900 тел         телефон
   Кадры: /tmp/игло/плёнка-<кто>-NNN.png */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const КУДА = process.env.IGLOO_OUT || "/tmp/игло";
const КЭШ = path.join(КУДА, "кэш");
const ШАГОВ = +(process.argv[2] || 60);
const НАШАГ = +(process.argv[3] || 900);
const КТО = process.argv[4] || "ПК";
const АДРЕС = "https://www.igloo.inc/";

fs.mkdirSync(КЭШ, { recursive: true });

function ключ(адрес) {
  let h = 5381;
  for (let i = 0; i < адрес.length; i++) h = ((h * 33) ^ адрес.charCodeAt(i)) >>> 0;
  const хвост = адрес.split("/").pop().split("?")[0].slice(-40).replace(/[^A-Za-z0-9._-]/g, "_");
  return h.toString(16) + "-" + хвост;
}

const МИМЫ = {
  ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".m4a": "audio/mp4",
  ".glb": "model/gltf-binary", ".drc": "application/octet-stream",
  ".ktx2": "application/octet-stream", ".exr": "application/octet-stream",
  ".bin": "application/octet-stream", ".wasm": "application/wasm"
};
function мим(адрес, вид) {
  if (вид === "document") return "text/html; charset=utf-8";
  if (вид === "stylesheet") return "text/css";
  if (вид === "script") return "text/javascript";
  const п = адрес.split("?")[0], у = п.lastIndexOf(".");
  return МИМЫ[у > п.lastIndexOf("/") ? п.slice(у) : ""] || "application/octet-stream";
}

let скачано = 0, изКэша = 0;
function достать(адрес) {
  const к = path.join(КЭШ, ключ(адрес));
  if (fs.existsSync(к)) { изКэша++; return fs.readFileSync(к); }
  try {
    const т = execFileSync("curl", ["-sSL", "--compressed", "--max-time", "300", "--retry", "2",
      "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      "-o", "-", адрес], { maxBuffer: 512 * 1024 * 1024, encoding: "buffer" });
    fs.writeFileSync(к, т); скачано++; return т;
  } catch (e) { return null; }
}

const ПРОПУСК = /(google-analytics|googletagmanager|doubleclick|facebook|hotjar|sentry|clarity|content-autofill|accounts\.google|optimizationguide)/i;

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-lcd-text", "--mute-audio"]
});
const вьюпорт = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const ctx = await бр.newContext({ viewport: вьюпорт, ignoreHTTPSErrors: true });
await ctx.route("**/*", async (р) => {
  const з = р.request(), а = з.url();
  if (а.startsWith("data:") || а.startsWith("blob:")) return р.continue();
  if (ПРОПУСК.test(а)) return р.abort();
  const т = достать(а);
  if (!т) return р.abort();
  await р.fulfill({ status: 200, body: т,
    headers: { "content-type": мим(а, з.resourceType()), "access-control-allow-origin": "*" } });
});

const стр = await ctx.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 160)));

console.log(КТО + ": грузим igloo через зеркало");
await стр.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 300000 });
/* Сцена собирается долго: две сотни файлов, распаковка ktx2 и draco,
   компиляция шейдеров - и всё это на программном отрисовщике. */
await стр.waitForTimeout(70000);

fs.mkdirSync(КУДА, { recursive: true });
const середина = { x: Math.round(вьюпорт.width / 2), y: Math.round(вьюпорт.height / 2) };
await стр.mouse.move(середина.x, середина.y);
await стр.screenshot({ path: path.join(КУДА, "плёнка-" + КТО + "-000.png") });
console.log("кадр 0 снят, крутим по " + НАШАГ + " на шаг, шагов " + ШАГОВ);

for (let i = 1; i <= ШАГОВ; i++) {
  /* Колесом, а не прокруткой: их лента виртуальная и слушает wheel.
     Дробим шаг на порции - один огромный wheel их сглаживание съедает
     поводком, и лента почти не двигается. */
  const порций = 6;
  for (let к = 0; к < порций; к++) {
    await стр.mouse.wheel(0, Math.round(НАШАГ / порций));
    await стр.waitForTimeout(120);
  }
  /* Ждём, пока камера догонит: у них сглаживание с заметной инерцией. */
  await стр.waitForTimeout(2400);
  await стр.screenshot({ path: path.join(КУДА, "плёнка-" + КТО + "-" + String(i).padStart(3, "0") + ".png") });
  process.stdout.write(i % 10 === 0 ? String(i) : ".");
}
console.log("\nготово: кадров " + (ШАГОВ + 1) + ", из кэша " + изКэша + ", скачано " + скачано);
await бр.close();
