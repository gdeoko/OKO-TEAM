/* Печать.
   Пока правил печати не было вовсе, из пятнадцати листов A4 семь
   выходили практически пустыми, герой и эпилог печатались белым по
   белой бумаге, а анкета заявки не попадала на бумагу ни разу:
   страница это фильм на прокрутке, а принтер её не прокручивает, и
   наблюдатели появления не срабатывают ни разу. */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");
const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123/";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await pg.waitForTimeout(6000);
await pg.emulateMedia({ media: "print" });
await pg.waitForTimeout(1500);

let бед = 0;
const шаг = (имя, ок, что) => { if (!ок) бед++; console.log((ок ? "ЧИСТО  " : "БЕДА   ") + имя + (что ? " :: " + что : "")); };

const с = await pg.evaluate(() => {
  const видно = (э) => {
    if (!э) return false;
    const s = getComputedStyle(э);
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity < 0.1) return false;
    const r = э.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  /* Знаки по листам: лист A4 при 96 точках на дюйм это 1123 точки,
     минус поля сверху и снизу. */
  const ЛИСТ = 1123 - 2 * 53;
  const всего = document.documentElement.scrollHeight;
  const листов = Math.ceil(всего / ЛИСТ);
  const знаков = new Array(листов).fill(0);
  const ход = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let у;
  while ((у = ход.nextNode())) {
    const т = (у.nodeValue || "").trim();
    if (!т) continue;
    const род = у.parentElement;
    if (!род || !видно(род)) continue;
    const r = род.getBoundingClientRect();
    const верх = r.top + scrollY;
    const л = Math.floor(верх / ЛИСТ);
    if (л >= 0 && л < листов) знаков[л] += т.length;
  }
  const слои = ["#hdr", ".drawer", ".modal", ".totop", ".mcta", ".rc-flight", ".rc-desk", "canvas", ".prog"];
  return {
    листов: листов,
    пустых: знаков.filter((n) => n < 60).length,
    поЛистам: знаков.map((n) => n).slice(0, 30),
    слоиВидны: слои.filter((сел) => видно(document.querySelector(сел))),
    анкета: видно(document.querySelector("#leadForm")),
    вопросов: [].filter.call(document.querySelectorAll("#faqList .faq-i"), видно).length,
    ответов: [].filter.call(document.querySelectorAll("#faqList .faq-a"), видно).length,
    контакты: видно(document.querySelector(".contact-list")),
    прозрачных: [].filter.call(document.querySelectorAll(".rv"), (э) => +getComputedStyle(э).opacity < 0.3).length,
    заголовок: getComputedStyle(document.querySelector(".hero h1")).webkitTextFillColor,
    фон: getComputedStyle(document.body).backgroundColor
  };
});

шаг("слоёв поверх страницы на бумаге нет", с.слоиВидны.length === 0, с.слоиВидны.join(", ") || "ни одного");
шаг("анкета печатается", с.анкета);
шаг("вопросы печатаются с ответами", с.вопросов >= 8 && с.ответов >= 8, `вопросов ${с.вопросов} · ответов ${с.ответов}`);
шаг("контакты печатаются", с.контакты);
шаг("непроявленных блоков нет", с.прозрачных === 0, `прозрачных ${с.прозрачных}`);
шаг("заголовок не белым по белому", с.заголовок === "rgb(0, 0, 0)", `${с.заголовок} на ${с.фон}`);
шаг("пустых листов мало", с.пустых <= 2, `листов ${с.листов} · почти пустых ${с.пустых} · знаков по листам ${с.поЛистам.join(",")}`);

console.log(бед ? "ИТОГ: на бумагу идёт не то" : "ИТОГ: печать читаемая");
await b.close();
process.exit(бед ? 1 : 0);
