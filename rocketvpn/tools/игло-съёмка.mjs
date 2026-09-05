/* Съёмка igloo.inc: кадры по всей ленте плюс список всего, что сайт грузит.

   ЗАЧЕМ. Владелец требует разбора не по памяти, а по самому сайту:
   «покадрово открой всю 234 сцену igloo, прям каждый миллиметр отскриль
   и проанализируй». Снимок с шагом в сотню точек прокрутки даёт ту самую
   покадровку, а перехват сети - список моделей, текстур и звуков, по
   которому видно, из чего сцена собрана.

   ЧТО СНИМАЕТ.
     · кадры /tmp/игло/кадр-ПК-NNNNN.png и кадр-тел-NNNNN.png
     · /tmp/игло/сеть.json - каждый запрос: адрес, тип, размер
     · /tmp/игло/лента.json - высота документа, число секций, шаг съёмки

   Запуск: node tools/игло-съёмка.mjs [шагТочек] [ПК|тел|оба] */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const КУДА = process.env.IGLOO_OUT || "/tmp/игло";
const ШАГ = +(process.argv[2] || 400);
const КОГО = process.argv[3] || "оба";
const АДРЕС = "https://www.igloo.inc/";

fs.mkdirSync(КУДА, { recursive: true });

/* ── НАРУЖУ ТОЛЬКО ЧЕРЕЗ ПРОКСИ ОКРУЖЕНИЯ ─────────────────────
   В этой песочнице весь исходящий HTTPS идёт через агентский прокси, и
   curl про него знает из переменных окружения, а браузер - нет: своё
   соединение он открывает мимо и получает обрыв. Первая попытка съёмки
   на этом и легла (ERR_CONNECTION_RESET на первом же переходе).

   Отдаём адрес прокси явно и разрешаем его самоподписанный корень:
   прокси распечатывает TLS, и без этого каждая страница была бы
   ошибкой сертификата. */
const ПРОКСИ = process.env.HTTPS_PROXY || process.env.https_proxy || "";
const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  proxy: ПРОКСИ ? { server: ПРОКСИ } : undefined,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-lcd-text", "--ignore-certificate-errors"]
});

const сеть = [];

async function снять(имя, вьюпорт) {
  const ctx = await бр.newContext({ viewport: вьюпорт, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const стр = await ctx.newPage();
  стр.on("response", async (о) => {
    try {
      const з = о.request();
      сеть.push({
        кто: имя, адрес: о.url(), тип: з.resourceType(),
        код: о.status(),
        размер: +(о.headers()["content-length"] || 0)
      });
    } catch (e) {}
  });
  стр.on("pageerror", (e) => console.log("  ИСКЛ " + e.message.slice(0, 140)));

  console.log(имя + ": грузим " + АДРЕС);
  await стр.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
  /* Сцена собирается долго: на SwiftShader счёт идёт на десятки секунд.
     Ждём, пока перестанет расти высота документа - её ставит их лента. */
  let было = 0, ровно = 0;
  for (let i = 0; i < 60; i++) {
    await стр.waitForTimeout(2000);
    const h = await стр.evaluate(() => document.documentElement.scrollHeight);
    if (h === было && h > 2000) { ровно++; if (ровно >= 3) break; } else ровно = 0;
    было = h;
  }
  const лента = await стр.evaluate(() => ({
    высота: document.documentElement.scrollHeight,
    окно: window.innerHeight,
    холстов: document.querySelectorAll("canvas").length,
    секций: document.querySelectorAll("section, [data-section], .section").length
  }));
  console.log(имя + ": лента " + JSON.stringify(лента));
  fs.writeFileSync(path.join(КУДА, "лента-" + имя + ".json"),
                   JSON.stringify({ ...лента, шаг: ШАГ }, null, 1));

  const конец = Math.max(0, лента.высота - лента.окно);
  for (let y = 0; y <= конец; y += ШАГ) {
    await стр.evaluate((yy) => window.scrollTo(0, yy), y);
    /* Их лента сглажена, камера догоняет прокрутку не мгновенно. */
    await стр.waitForTimeout(2600);
    const имяФ = path.join(КУДА, "кадр-" + имя + "-" + String(y).padStart(6, "0") + ".png");
    await стр.screenshot({ path: имяФ });
    process.stdout.write(".");
  }
  console.log("\n" + имя + ": кадров " + Math.floor(конец / ШАГ + 1));
  await ctx.close();
}

if (КОГО === "оба" || КОГО === "ПК") await снять("ПК", { width: 1440, height: 900 });
if (КОГО === "оба" || КОГО === "тел") await снять("тел", { width: 390, height: 844 });

fs.writeFileSync(path.join(КУДА, "сеть.json"), JSON.stringify(сеть, null, 1));
const поТипу = {};
for (const з of сеть) поТипу[з.тип] = (поТипу[з.тип] || 0) + 1;
console.log("сеть: " + JSON.stringify(поТипу));
await бр.close();
