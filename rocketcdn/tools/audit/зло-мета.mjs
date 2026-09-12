/* Мета для поисковика и для человека, который переключил язык.
   Раньше заголовок вкладки не менялся никогда, а canonical с ключом
   языка указывал на русский адрес и сам отменял английскую версию. */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");
const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123/";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await pg.waitForTimeout(4000);
let бед = 0;
const шаг = (имя, ок, что) => { if (!ок) бед++; console.log((ок ? "ЧИСТО  " : "БЕДА   ") + имя + (что ? " :: " + что : "")); };
const снять = () => pg.evaluate(() => ({
  язык: document.documentElement.lang,
  заголовок: document.title,
  описание: (document.querySelector('meta[name="description"]') || {}).content || "",
  канон: (document.querySelector('link[rel="canonical"]') || {}).href || "",
  ogЗаг: (document.querySelector('meta[property="og:title"]') || {}).content || "",
  локаль: (document.querySelector('meta[property="og:locale"]') || {}).content || ""
}));
const переключить = async () => {
  await pg.evaluate(() => {
    const кн = document.querySelectorAll(".hdr-act .pill.lang button");
    const цель = [].find.call(кн, (b) => !b.classList.contains("on"));
    if (цель) цель.click();
  });
  await pg.waitForTimeout(900);
};
const ру = await снять();
await переключить();
const ан = await снять();
шаг("заголовок вкладки переводится", /Rocket CDN/.test(ан.заголовок) && ан.заголовок !== ру.заголовок,
    `${ру.заголовок} -> ${ан.заголовок}`);
шаг("описание переводится", ан.описание !== ру.описание && !/[А-Яа-яЁё]/.test(ан.описание), ан.описание.slice(0, 70));
шаг("canonical указывает на свою же версию", /\?lang=en$/.test(ан.канон) && !/lang=/.test(ру.канон),
    `${ру.канон} -> ${ан.канон}`);
шаг("og:title переводится", ан.ogЗаг === ан.заголовок, ан.ogЗаг.slice(0, 50));
шаг("og:locale переключается", ан.локаль === "en_US" && ру.локаль === "ru_RU", `${ру.локаль} -> ${ан.локаль}`);
шаг("описание влезает в выдачу", ру.описание.length <= 160 && ан.описание.length <= 160,
    `ru ${ру.описание.length} знаков, en ${ан.описание.length}`);
await переключить();
const ру2 = await снять();
шаг("возврат на русский полный", ру2.заголовок === ру.заголовок && ру2.канон === ру.канон, ру2.заголовок);
console.log(бед ? "ИТОГ: мета врёт" : "ИТОГ: мета сходится с языком");
await b.close();
process.exit(бед ? 1 : 0);
