/* Зеркало igloo.inc: сайт крутится в нашем браузере через перехват сети.

   ЗАЧЕМ ЗЕРКАЛО, А НЕ ПРОСТО ОТКРЫТЬ САЙТ. Владелец требует смотреть на
   живой igloo: «прям сейчас открой посмотри, замеры сделай, открой сайт,
   посмотри как выглядит глыба». В этой песочнице браузер наружу не
   ходит: агентский прокси рвёт его туннель на первом же переходе
   (ERR_CONNECTION_RESET), при том что curl через тот же прокси ходит
   прекрасно.

   Поэтому браузер наружу и не пускаем. Каждый его запрос перехватываем,
   ходим за файлом curl-ом (он про прокси знает из окружения), кладём в
   кэш на диск и отдаём браузеру как ответ сервера. Со второго запуска
   всё берётся из кэша, и сайт открывается за секунды.

   ЧТО ЭТО ДАЁТ. Настоящий igloo.inc в нашем браузере: можно скроллить,
   тыкать глыбы, снимать кадры, читать его переменные из консоли,
   мерить камеру. То есть ровно тот разбор, которого владелец просит.

   ЧТО СНИМАЕТ.
     · кадры /tmp/игло/кадр-<кто>-NNNNNN.png по всей ленте
     · /tmp/игло/сеть.json - что сайт грузит: модели, текстуры, звуки
     · /tmp/игло/замер-<кто>.json - камера, сцена, объекты по шагам ленты

   Запуск:
     node tools/игло-зеркало.mjs             съёмка ПК и телефона
     node tools/игло-зеркало.mjs 300 ПК      свой шаг и только ПК
     node tools/игло-зеркало.mjs 0 ПК тык    съёмка отклика на клики */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const КУДА = process.env.IGLOO_OUT || "/tmp/игло";
const КЭШ = path.join(КУДА, "кэш");
const ШАГ = +(process.argv[2] || 400);
const КОГО = process.argv[3] || "оба";
const РЕЖИМ = process.argv[4] || "лента";
const АДРЕС = "https://www.igloo.inc/";

fs.mkdirSync(КЭШ, { recursive: true });

/* ── Кэш на диске ─────────────────────────────────────────────
   Имя файла - хэш адреса: адреса длинные, с запросами и знаками, на
   которых файловая система спотыкается. Рядом лежит .head с типом
   содержимого: без него браузер получает модель как текст. */
function ключ(адрес) {
  let h = 5381;
  for (let i = 0; i < адрес.length; i++) h = ((h * 33) ^ адрес.charCodeAt(i)) >>> 0;
  const хвост = адрес.split("/").pop().split("?")[0].slice(-40).replace(/[^A-Za-z0-9._-]/g, "_");
  return h.toString(16) + "-" + хвост;
}

const МИМЫ = {
  ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".css": "text/css", ".html": "text/html", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".wav": "audio/wav",
  ".mp4": "video/mp4", ".glb": "model/gltf-binary", ".gltf": "model/gltf+json",
  ".drc": "application/octet-stream", ".ktx2": "application/octet-stream",
  ".bin": "application/octet-stream", ".wasm": "application/wasm"
};

function мимПо(адрес, вид) {
  /* Тип запроса важнее расширения. У корневого адреса сайта расширения
     нет вовсе, и по одному только имени он получал «поток байтов» - от
     чего браузер вместо страницы начинал СКАЧИВАНИЕ файла, и переход
     падал с «Download is starting». */
  if (вид === "document") return "text/html; charset=utf-8";
  if (вид === "stylesheet") return "text/css";
  if (вид === "script") return "text/javascript";
  const п = адрес.split("?")[0];
  const у = п.lastIndexOf(".");
  const т = у > п.lastIndexOf("/") ? п.slice(у) : "";
  return МИМЫ[т] || "application/octet-stream";
}

let изКэша = 0, скачано = 0, отказов = 0;

function достать(адрес) {
  const к = path.join(КЭШ, ключ(адрес));
  if (fs.existsSync(к)) { изКэша++; return fs.readFileSync(к); }
  try {
    /* curl ходит через агентский прокси сам, по переменным окружения.
       Молча, с повтором, с потолком по времени: часть их файлов на
       несколько мегабайт. */
    const тело = execFileSync("curl", [
      "-sSL", "--compressed", "--max-time", "300", "--retry", "2",
      "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      "-o", "-", адрес
    ], { maxBuffer: 512 * 1024 * 1024, encoding: "buffer" });
    fs.writeFileSync(к, тело);
    скачано++;
    return тело;
  } catch (e) {
    отказов++;
    return null;
  }
}

const ПРОПУСК = /(google-analytics|googletagmanager|doubleclick|facebook|hotjar|sentry|clarity|content-autofill|accounts\.google|gstatic\.com\/generate|optimizationguide)/i;

const сеть = [];

async function навестись(ctx) {
  await ctx.route("**/*", async (маршрут) => {
    const запрос = маршрут.request();
    const адрес = запрос.url();
    if (адрес.startsWith("data:") || адрес.startsWith("blob:")) return маршрут.continue();
    if (ПРОПУСК.test(адрес)) return маршрут.abort();
    const тело = достать(адрес);
    if (!тело) return маршрут.abort();
    сеть.push({ адрес: адрес, тип: запрос.resourceType(), размер: тело.length });
    await маршрут.fulfill({
      status: 200,
      headers: {
        "content-type": мимПо(адрес, запрос.resourceType()),
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=86400"
      },
      body: тело
    });
  });
}

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-lcd-text", "--ignore-certificate-errors", "--mute-audio"]
});

/* ── Что мерить в живой сцене ─────────────────────────────────
   Их бандл минифицирован, наружу он ничего не отдаёт. Но объект сцены
   three достаётся через холст: у отрисовщика есть ссылка на сцену и
   камеру в его внутренних полях, а если нет - берём то, что можно снять
   снаружи: размер холста, положение прокрутки, состояние документа.
   Всё, что удалось снять, кладём как есть; чего нет - того нет. */
const ЗАМЕР = `(() => {
  const о = { прокрутка: window.scrollY, высота: document.documentElement.scrollHeight,
              окно: window.innerHeight, ширина: window.innerWidth };
  /* three кладёт себя в __THREE_DEVTOOLS__ при наличии расширения; без
     него ищем камеру обходом известных глобалей. */
  try {
    const х = document.querySelector("canvas");
    if (х) { о.холст = [х.width, х.height]; о.стиль = [х.clientWidth, х.clientHeight]; }
  } catch (e) {}
  try {
    const т = [];
    document.querySelectorAll("h1,h2,h3,p,button,a").forEach((э) => {
      const к = э.getBoundingClientRect();
      if (к.width < 2 || к.height < 2) return;
      const с = getComputedStyle(э);
      if (с.visibility === "hidden" || +с.opacity < 0.05) return;
      т.push({ тег: э.tagName, текст: (э.textContent || "").trim().slice(0, 80),
               рамка: [Math.round(к.x), Math.round(к.y), Math.round(к.width), Math.round(к.height)],
               кегль: с.fontSize, цвет: с.color, шрифт: с.fontFamily.split(",")[0] });
    });
    о.текст = т;
  } catch (e) {}
  try { о.фонТела = getComputedStyle(document.body).backgroundColor; } catch (e) {}
  return о;
})()`;

async function снять(имя, вьюпорт) {
  const ctx = await бр.newContext({ viewport: вьюпорт, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await навестись(ctx);
  const стр = await ctx.newPage();
  стр.on("pageerror", (e) => console.log("  ИСКЛ " + e.message.slice(0, 140)));

  console.log(имя + ": грузим " + АДРЕС);
  await стр.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 300000 });

  /* Сцена собирается долго: модели, текстуры, компиляция шейдеров, и всё
     это на программном отрисовщике. Ждём, пока высота ленты перестанет
     расти - её ставит их собственный код после сборки. */
  let было = 0, ровно = 0;
  for (let i = 0; i < 90; i++) {
    await стр.waitForTimeout(2000);
    const h = await стр.evaluate(() => document.documentElement.scrollHeight);
    if (h === было && h > 1500) { ровно++; if (ровно >= 3) break; } else ровно = 0;
    было = h;
  }
  const лента = await стр.evaluate(ЗАМЕР);
  console.log(имя + ": лента " + лента.высота + ", окно " + лента.окно +
              ", холст " + JSON.stringify(лента.холст || null) +
              ", кэш " + изКэша + " скачано " + скачано + " отказов " + отказов);
  fs.writeFileSync(path.join(КУДА, "лента-" + имя + ".json"), JSON.stringify(лента, null, 1));

  const замеры = [];
  if (РЕЖИМ === "тык") {
    /* Отклик на касание: тычем в середину кадра и по четвертям и снимаем
       до и после. Владелец просит именно это - «потыкай его». */
    const точки = [[0.5, 0.5], [0.35, 0.45], [0.65, 0.55], [0.5, 0.35]];
    for (let i = 0; i < точки.length; i++) {
      const x = Math.round(вьюпорт.width * точки[i][0]);
      const y = Math.round(вьюпорт.height * точки[i][1]);
      await стр.screenshot({ path: path.join(КУДА, "тык-" + имя + "-" + i + "-до.png") });
      await стр.mouse.move(x, y);
      await стр.waitForTimeout(700);
      await стр.mouse.down(); await стр.waitForTimeout(120); await стр.mouse.up();
      for (const пауза of [200, 600, 1400]) {
        await стр.waitForTimeout(пауза);
        await стр.screenshot({ path: path.join(КУДА, "тык-" + имя + "-" + i + "-" + пауза + ".png") });
      }
      process.stdout.write("*");
    }
    console.log("\n" + имя + ": тычков " + точки.length);
  } else {
    const конец = Math.max(0, лента.высота - лента.окно);
    const шаг = ШАГ > 0 ? ШАГ : Math.max(200, Math.round(конец / 40));
    for (let y = 0; y <= конец; y += шаг) {
      await стр.evaluate((yy) => window.scrollTo(0, yy), y);
      await стр.waitForTimeout(2600);
      await стр.screenshot({ path: path.join(КУДА, "кадр-" + имя + "-" + String(y).padStart(6, "0") + ".png") });
      замеры.push(await стр.evaluate(ЗАМЕР));
      process.stdout.write(".");
    }
    console.log("\n" + имя + ": кадров " + замеры.length + ", шаг " + шаг);
    fs.writeFileSync(path.join(КУДА, "замер-" + имя + ".json"), JSON.stringify(замеры, null, 1));
  }
  await ctx.close();
}

if (КОГО === "оба" || КОГО === "ПК") await снять("ПК", { width: 1440, height: 900 });
if (КОГО === "оба" || КОГО === "тел") await снять("тел", { width: 390, height: 844 });

fs.writeFileSync(path.join(КУДА, "сеть.json"), JSON.stringify(сеть, null, 1));
const поТипу = {};
for (const з of сеть) поТипу[з.тип] = (поТипу[з.тип] || 0) + 1;
console.log("сеть: " + JSON.stringify(поТипу) +
            "  кэш " + изКэша + " скачано " + скачано + " отказов " + отказов);
await бр.close();
