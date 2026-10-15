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
/* Порог с запасом на разброс самого замера: два прогона подряд на
   неизменном коде давали 6 и 9. Ставим 12: это ещё не беда, а
   тридцать невидимых остановок из ста шестидесяти - уже она. */
шаг("невидимых остановок мало", невидимых <= 12, `невидимых ${невидимых}`);
/* Провал в тело документа это оборванный обход: элемент под фокусом
   исчез или был заглушён. Единичные провалы у кино на прокрутке
   неизбежны - страница меняет состав по ходу движения. Сотня из ста
   шестидесяти это уже тупик, а не шум: именно так выглядел финал,
   где заглушалось всё, а взамен не оставалось ничего. */
шаг("обход не обрывается", тел <= 30, `провалов в тело ${тел} из ${путь.length}`);
/* По правилу для ленты вкладок в обходе стоит ОДНА точка на ленту,
   остальные берутся стрелками. Считаем по разметке, а не по пути:
   выбранная точка меняется вместе с прокруткой ленты, и разных
   подписей за проход набирается больше, чем остановок за раз. */
const вОбходе = await pg.evaluate(() => [].map.call(document.querySelectorAll(".rail-dots"), (л) =>
  [].filter.call(л.querySelectorAll(".rail-dot"), (т) => т.getAttribute("tabindex") !== "-1").length));
шаг("точки лент не забивают кольцо", вОбходе.every((n) => n <= 1),
    `в обходе на ленту: ${вОбходе.join(", ")} · разных подписей за проход ${рельсРазных}`);
шаг("закрытая рубка не ловит фокус", вПолёте <= 2, `остановок в слое полёта ${вПолёте}`);
/* Достижимость пульта меряем отдельно и с фиксированного места.
   Обход табом сам гонит страницу, а кино на прокрутке меняет
   состояние разделов - от прогона к прогону путь получается разный.
   Поэтому доезжаем до пульта прокруткой, а потом уже смотрим, что
   ловит фокус. */
await pg.evaluate(() => window.scrollTo(0, 0));
await pg.waitForTimeout(1200);
for (let i = 0; i < 26; i++) { await pg.mouse.wheel(0, 900); await pg.waitForTimeout(200); }
await pg.waitForTimeout(2500);
const наПульте2 = [];
for (let i = 0; i < 40; i++) {
  await pg.keyboard.press("Tab");
  await pg.waitForTimeout(90);
  наПульте2.push(await где());
}
const пультТеперь = наПульте2.filter((x) => x.пульт || x.форма).length;
шаг("голограмма пульта достижима с места", пультТеперь >= 3,
    `остановок на пульте и в форме ${пультТеперь} из 40 · по всему обходу пульт ${наПульте} форма ${вФорме}`);
console.log("путь:");
путь.slice(0, 70).forEach((x, i) => console.log(`  ${i + 1}. ${x.имя} ${x.видно ? "" : "[НЕВИДИМ] "}${x.текст}`));
/* Внутри корабля форма живёт на голограмме пульта, и дойти до неё
   с клавиатуры надо целиком: кнопка, поля, отправка. */
const доФормы = await pg.evaluate(() => {
  const к = document.querySelector(".rc-desk .dsk-b-lead");
  if (!к) return null;
  к.focus();
  return document.activeElement === к;
});
if (доФормы) {
  await pg.keyboard.press("Enter");
  await pg.waitForTimeout(900);
  const вФормеТеперь = await pg.evaluate(() => {
    const э = document.activeElement;
    const поля = document.querySelectorAll(".rc-desk input, .rc-desk textarea");
    const скрытое = э.classList.contains("vh") || э.getAttribute("aria-hidden") === "true" ||
                    э.tabIndex < 0 || э.name === "website";
    return {
      фокус: э.tagName + (э.id ? "#" + э.id : "") + (э.name ? "[" + э.name + "]" : ""),
      вПульте: !!(э.closest && э.closest(".rc-desk")),
      настоящее: !скрытое && (э.tagName === "INPUT" || э.tagName === "TEXTAREA"),
      полей: поля.length
    };
  });
  /* Проверять «фокус внутри пульта» мало: в форме первым стоит
     скрытое поле-ловушка для ботов, и фокус на нём выглядел как
     успех, а на деле человек набирал имя в ловушку, и сервер
     выбрасывал заявку, ответив «ок». Смотрим, что поле НАСТОЯЩЕЕ. */
  шаг("форма заявки открывается с клавиатуры", вФормеТеперь.вПульте && вФормеТеперь.настоящее && вФормеТеперь.полей >= 3,
      `фокус ${вФормеТеперь.фокус} · настоящее ${вФормеТеперь.настоящее} · полей ${вФормеТеперь.полей}`);
} else {
  шаг("форма заявки открывается с клавиатуры", false, "кнопки заявки на пульте нет");
}

console.log(бед ? "ИТОГ: обход клавиатурой беден" : "ИТОГ: обход клавиатурой в порядке");
await b.close();
process.exit(бед ? 1 : 0);
