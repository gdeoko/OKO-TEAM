/* СВЕТЛАЯ ТЕМА ПО ВСЕЙ ЛЕНТЕ: по одному кадру на акт.

   ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. Общий съёмщик (tools/весь-фильм.mjs) умеет тему
   доводом, но ставит её ПОСЛЕ загрузки страницы: сперва грузится ночной
   мир, потом ему сообщают, что теперь день. На программном отрисовщике
   этот второй проход занимает столько же, сколько первый, и прогон
   встаёт на час без единого кадра. Я это поймала прогоном 53 минуты с
   пустой папкой.

   Здесь тема ставится ДО первого байта страницы, через addInitScript: в
   localStorage кладётся ключ rv-тема, и сайт просыпается уже дневным.
   Меню читает его при старте (assets/rv-меню.js, ТЕМА_КЛЮЧ), значит
   второго прохода нет вовсе.

   Запуск: node tools/светлая-лента.mjs [пк|тел] [куда] */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КТО = process.argv[2] || "пк";
const КУДА = process.argv[3] || "/tmp/светлая";
const экран = КТО === "пк"
  ? { w: 1440, h: 900, моб: false }
  : { w: 390, h: 844, моб: true };

mkdirSync(КУДА, { recursive: true });

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: 1, isMobile: экран.моб, hasTouch: экран.моб
});
/* Тема кладётся до загрузки страницы, а не после неё. */
await кон.addInitScript(() => {
  try { localStorage.setItem("rv-тема", "светлая"); } catch (e) {}
});
const стр = await кон.newPage();

const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 160)));

await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
/* ── ЖДЁМ ПЕРЕЕЗДА СЛОВ В СЦЕНУ, А НЕ ПРОСТО ПЛЁНКИ ────────────────
   Первый заход ждал только RV_MOTION и снимал кадр раньше времени: на
   снимке стоял РАЗМЕТОЧНЫЙ текст акта - крупный заголовок слева,
   абзац, обе сноски, - то есть то состояние, которое человек видит
   долю секунды до переезда слов в объём. Судить по нему о теме нельзя:
   это другой текст, другими стилями, в другом месте кадра.

   Признак переезда сайт ставит сам, классом на корне (rv-слово3d кладёт
   «рв-слова-в-сцене»). Ждём его, и только потом ставим долю. */
await стр.waitForFunction(
  () => window.RV_MOTION && window.RV_MOTION["кПунктy"] &&
        document.documentElement.classList.contains("рв-слова-в-сцене"),
  null, { timeout: 300000 }).catch(() => console.log("переезда слов не дождались"));
await стр.waitForTimeout(4000);

const акты = await стр.evaluate(() =>
  [...document.querySelectorAll(".rv-акт[data-акт]")].map((с) => с.getAttribute("data-акт")));
console.log(`светлая ${КТО} ${экран.w}x${экран.h}, актов ${акты.length} -> ${КУДА}`);

let н = 0;
for (const акт of акты) {
  const доля = акт === "станция" ? 0.9 : 0.5;
  await стр.evaluate(([а, д]) => {
    if (window.RV_MOTION && window.RV_MOTION["кПунктy"]) window.RV_MOTION["кПунктy"](а, д);
  }, [акт, доля]);
  /* Тридцать кадров вместо шестидесяти: тема проверяется цветом, а не
     точным положением камеры, и лишние полминуты на акт тут не нужны. */
  await стр.evaluate(() => new Promise((г) => {
    let n = 0;
    (function ш() { requestAnimationFrame(() => (++n >= 30 ? г() : ш())); })();
  }));
  const имя = `${КУДА}/${String(++н).padStart(2, "0")}-${акт}.png`;
  await стр.screenshot({ path: имя });
  console.log(`  ${имя}`);
}

if (беды.length) { console.log("БЕДЫ:"); for (const б of [...new Set(беды)].slice(0, 8)) console.log("  " + б); }
await бр.close();
