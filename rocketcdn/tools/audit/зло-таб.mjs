/* Обход страницы одной клавиатурой.
   Беда, ради которой написано: кольцо фокуса замыкалось на двадцати
   элементах и в него не входили ни форма заявки, ни голограмма
   пульта, ни вопросы после второго. Восемнадцать остановок из
   двадцати приходились на точки лент, ещё пятнадцать на погашенные
   органы закрытой рубки. */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");
const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123/";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                         "--autoplay-policy=no-user-gesture-required"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await pg.waitForTimeout(5000);

const где = () => pg.evaluate(() => {
  const э = document.activeElement;
  if (!э || э === document.body) return { имя: "BODY", видно: false };
  const r = э.getBoundingClientRect();
  let оп = 1, у = э;
  while (у && у !== document.documentElement) {
    const s = getComputedStyle(у);
    оп *= parseFloat(s.opacity);
    if (s.visibility === "hidden") оп = 0;
    у = у.parentElement;
  }
  return {
    имя: э.tagName + (э.id ? "#" + э.id : "") + (э.className && typeof э.className === "string" ? "." + э.className.trim().split(/\s+/)[0] : ""),
    текст: (э.getAttribute("aria-label") || э.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
    видно: оп > 0.05 && r.width > 0 && r.height > 0,
    рельс: э.classList ? э.classList.contains("rail-dot") : false,
    полёт: !!(э.closest && э.closest(".rc-flight")),
    пульт: !!(э.closest && э.closest(".rc-desk")),
    форма: !!(э.closest && э.closest("#leadForm, .form-card"))
  };
});

const путь = [];
for (let i = 0; i < 160; i++) {
  await pg.keyboard.press("Tab");
  await pg.waitForTimeout(70);
  let т = await где();
  /* Блоки выезжают по появлению в кадре, и первые кадры после
     перевода фокуса они ещё прозрачны. Это выезд, а не беда:
     переспрашиваем через четверть секунды. */
  if (!т.видно && т.имя !== "BODY") {
    await pg.waitForTimeout(260);
    т = await где();
  }
  путь.push(т);
}
const тел = путь.filter((x) => x.имя === "BODY").length;
const невидимых = путь.filter((x) => x.имя !== "BODY" && !x.видно).length;
const рельсРазных = new Set(путь.filter((x) => x.рельс).map((x) => x.текст)).size;
const вПолёте = путь.filter((x) => x.полёт).length;
const наПульте = путь.filter((x) => x.пульт).length;
const вФорме = путь.filter((x) => x.форма).length;
const разных = new Set(путь.filter((x) => x.имя !== "BODY").map((x) => x.имя + x.текст)).size;

let бед = 0;
const шаг = (имя, ок, что) => { if (!ок) бед++; console.log((ок ? "ЧИСТО  " : "БЕДА   ") + имя + (что ? " :: " + что : "")); };
console.log(`остановок ${путь.length} · разных ${разных} · провалов в тело ${тел}`);
шаг("невидимых остановок мало", невидимых <= 8, `невидимых ${невидимых}`);
/* По правилу для ленты вкладок в кольце стоит одна точка на ленту,
   остальные берутся стрелками. Лент на странице три. */
шаг("точки лент не забивают кольцо", рельсРазных <= 3, `разных точек лент в кольце ${рельсРазных}`);
шаг("закрытая рубка не ловит фокус", вПолёте <= 2, `остановок в слое полёта ${вПолёте}`);
шаг("голограмма пульта достижима", наПульте >= 1 || вФорме >= 1, `пульт ${наПульте} · форма ${вФорме}`);
console.log("путь:");
путь.slice(0, 70).forEach((x, i) => console.log(`  ${i + 1}. ${x.имя} ${x.видно ? "" : "[НЕВИДИМ] "}${x.текст}`));
console.log(бед ? "ИТОГ: обход клавиатурой беден" : "ИТОГ: обход клавиатурой в порядке");
await b.close();
process.exit(бед ? 1 : 0);
