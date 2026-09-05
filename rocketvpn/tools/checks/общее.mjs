/* Общая часть живых проверок Rocket VPN.

   Отдельно от родственного проекта намеренно: там проверки заточены под
   космос и пульт, здесь под створ, плёнку и акты. Общее у них только
   намерение - проверка выдаёт ЧИСТО или ГРЯЗНО, а не впечатление.

   Ключ считается ЗДЕСЬ, потому что сайт закрыт и без ключа проверять
   нечего. Секрет стенда - слово «стенд»; боевой секрет живёт в
   окружении и в репозиторий не попадает никогда. */
import { createHmac } from "node:crypto";

const { chromium } = await import(process.env.RV_PW ||
  await Promise.any([
    import("/tmp/node_modules/playwright/index.mjs").then(() => "/tmp/node_modules/playwright/index.mjs"),
    import("/tmp/node_modules/playwright-core/index.mjs").then(() => "/tmp/node_modules/playwright-core/index.mjs")
  ]).catch(() => "/tmp/node_modules/playwright/index.mjs"));

export const БАЗА = process.env.RV_URL || "http://127.0.0.1:8170";
export const СЕКРЕТ = process.env.RV_SITE_SECRET || "стенд";

export const ТЕЛЕФОН = { имя: "телефон", vp: { width: 412, height: 915 }, dpr: 2, mob: true };
export const ПК = { имя: "ПК", vp: { width: 1440, height: 900 }, dpr: 1, mob: false };

export function ключ(сдвигСек = 0) {
  const метка = Math.floor(Date.now() / 1000) + сдвигСек;
  const подпись = createHmac("sha256", СЕКРЕТ).update("rv|" + метка).digest("hex").slice(0, 24);
  return метка + "." + подпись;
}

export function адрес(параметры = {}) {
  const п = new URLSearchParams();
  if (!("k" in параметры)) п.set("k", ключ());
  for (const [к, з] of Object.entries(параметры)) if (з !== null) п.set(к, з);
  const хвост = п.toString();
  return БАЗА + "/" + (хвост ? "?" + хвост : "");
}

export async function браузер() {
  return chromium.launch({
    executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
  });
}

/* Открыть страницу и дождаться, пока плёнка соберётся. Возвращает
   страницу и живой список ошибок: он копится дальше сам, проверке
   остаётся прочитать его в конце. */
export async function открыть(b, э, параметры = {}) {
  const pg = await b.newPage({
    viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob
  });
  const ошибки = [];
  pg.on("pageerror", e => ошибки.push("ИСКЛ: " + e.message.slice(0, 140)));
  /* ── ЧУЖОЙ ДОМЕН В ПЕСОЧНИЦЕ НЕ ОШИБКА САЙТА ──────────────────
     Счётчик заходов (rv-track.js) и отправка анкеты (rv-меню.js) идут
     на соседний rocketcdn.ru. Из песочницы весь HTTPS ходит через
     прокси со своим удостоверением, браузеру оно незнакомо, и каждый
     такой вызов падает с ERR_CERT_AUTHORITY_INVALID. Проверка считала
     это бедой и красила ГРЯЗНО ровно те прогоны, где с сайтом всё в
     порядке: на боевом домене запрос доходит.

     Гасим ТОЛЬКО отказ по удостоверению и только его: любая другая
     сетевая беда (404 на своём файле, разбор ответа, исключение в
     обработчике) как считалась, так и считается. Ошибка сайта на чужом
     домене никуда не девается - она приходит исключением, а не строкой
     про сертификат.

     Причина стоит в самом тексте сообщения («Failed to load resource:
     net::ERR_CERT_AUTHORITY_INVALID»), поэтому и спрашиваем текст, а не
     заводим второй список запросов и не гадаем о порядке событий. */
  pg.on("console", m => {
    if (m.type() !== "error") return;
    const т = m.text();
    if (/ERR_CERT_|ERR_PROXY_/.test(т)) return;
    ошибки.push("КОНС: " + т.slice(0, 140));
  });
  await pg.goto(адрес(параметры), { waitUntil: "domcontentloaded", timeout: 90000 });
  /* Объёмному слою нужно собрать сцену: на песочнице без видеокарты это
     секунды, а не миллисекунды. Меньше ждать нельзя, дальше всё
     посыплется. */
  await pg.waitForTimeout(6000);
  return { pg, ошибки };
}

/* Довести до нужного акта без прокрутки на глазах. */
export async function кАкту(pg, имя, доля = 0.5) {
  await pg.evaluate(([и, д]) => {
    if (window.RV_MOTION && window.RV_MOTION["кПунктy"]) window.RV_MOTION["кПунктy"](и, д);
  }, [имя, доля]);
  await pg.waitForTimeout(1800);
}

export function доложить(имя, беды) {
  if (!беды.length) {
    console.log("ЧИСТО  " + имя);
    process.exit(0);
  }
  console.log("ГРЯЗНО " + имя);
  for (const б of беды) console.log("   " + б);
  process.exit(1);
}
