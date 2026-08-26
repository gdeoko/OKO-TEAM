/**
 * Аттестация конкурсной работы руками живого аккаунта Gemini.
 *
 * Зачем. Подписка Google уже оплачена, а разбор через API жёг платную квоту:
 * к девяти утра дневной лимит кончался, и весь рабочий день ни оценка, ни
 * чат-бот не имели мозга. Здесь тот же браузер, в котором сидит владелец:
 * вход сделан, профиль постоянный, расхода нет.
 *
 *   node gemini_grade.mjs <файл-с-промптом> <куда-положить.txt> <медиа1[,медиа2]> [ждать-сек]
 *
 * Медиа — конкурсная запись и/или дорожка звука, уже подготовленные сайтом
 * (core/ai_grader.php, ag_prepare_media). Ответ ожидается строгим JSON — его
 * разбирает та же ag_parse_json, что и ответ API.
 *
 * Грабли те же, что у соседних драйверов, и лечатся так же:
 *  1. Своя вкладка на запуск, закрывается за собой — в браузере живут другие
 *     проекты, они лезут в общую вкладку и затирают работу друг друга.
 *  2. Витрина «Gemini не поддерживается в вашей стране» — не отказ, а случайность
 *     балансировщика: лечится повтором захода, а не выводами.
 *  3. Длинный промпт печатать по буквам нельзя: Angular не видит текст и прячет
 *     кнопку отправки. keyboard.insertText кладёт всё одним событием.
 *  4. Файл цепляем через input[type=file] напрямую: диалог выбора в headless
 *     ловится ненадёжно.
 */
import pkg from "/opt/oko-poster/node_modules/playwright-core/index.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const { chromium } = pkg;

const CDP = process.env.CHROME_CDP || "http://127.0.0.1:9222";
const [промптФайл, куда, медиаСписок, ждатьАрг] = process.argv.slice(2);
if (!промптФайл || !куда) {
  console.log("как звать: node gemini_grade.mjs <промпт.txt> <ответ.txt> <медиа1[,медиа2]> [сек]");
  process.exit(2);
}
const промпт = readFileSync(промптФайл, "utf8").trim();
const медиа = (медиаСписок || "").split(",").map(s => s.trim()).filter(s => s && existsSync(s));
const ждать = Number(ждатьАрг || 600);
const лог = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* Подключаемся с запасом по времени: в браузере агента живут другие проекты, и
   на десятке открытых вкладок стандартных 30 секунд не хватает — драйвер падал
   с TimeoutError ещё до того, как что-то сделал. */
const b = await chromium.connectOverCDP({ endpointURL: CDP, timeout: 180000 });
const ctx = b.contexts()[0];
const p = await ctx.newPage();
p.setDefaultTimeout(120000);
let код = 0;
async function уйти(к) { await p.close().catch(() => {}); process.exit(к); }
for (const с of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(с, () => { p.close().catch(() => {}); process.exit(130); });

try {
  let вошли = false;
  for (let заход = 1; заход <= 8 && !вошли; заход++) {
    await p.keyboard.press("Escape").catch(() => {});
    await p.goto("https://gemini.google.com/app",
                 { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(5000);
    вошли = (await p.locator('button[aria-label*="Загрузка и инструменты"]').count()) > 0
         || (await p.locator("rich-textarea, div.ql-editor").count()) > 0;
    if (!вошли) лог("заход", заход, "дал витрину:", p.url());
  }
  if (!вошли) { лог("в приложение не пустило"); await уйти(3); }
  await p.evaluate(() => { window.name = "ОКО-РАБОТА"; }).catch(() => {});

  for (const имя of ["ОК", "Понятно", "Принять", "Продолжить", "Got it", "Закрыть"]) {
    const к = p.locator(`button:has-text("${имя}")`).first();
    if (await к.count() && await к.isVisible().catch(() => false)) {
      await к.click({ delay: 50 }).catch(() => {});
      await p.waitForTimeout(800);
    }
  }

  /* Файлы цепляем ДО текста: пока запись загружается, поле ввода свободно, и
     промпт ляжет целиком. Обратный порядок иногда стирал набранное.

     ПОЛЯ input НА СТРАНИЦЕ НЕТ, пока не нажат «плюс». Слепой поиск
     input[type=file] находил ноль — первый прогон отвалился ровно на этом.
     Порядок такой: открыть меню загрузки, нажать «Загрузить файлы», поймать
     системное окно выбора (Playwright отдаёт файлы сам). Поле input остаётся
     запасным путём — на случай, если меню поменяют. */
  if (медиа.length) {
    /* ЕДИНСТВЕННЫЙ РАБОЧИЙ ПУТЬ ДЛЯ ЗАПИСИ — ПУНКТ «Загрузить файлы».
     *
     * Поля input[type=file], которые появляются на странице сами, принимают
     * ТОЛЬКО документы и код: в их accept на тысячу знаков нет ни mp4, ни mp3,
     * ни jpg. Первый прогон честно клал туда ролик, поле его молча не брало, и
     * драйвер полчаса ждал миниатюру, которой неоткуда взяться.
     *
     * Правильно: открыть «Загрузка и инструменты», нажать «Загрузить файлы» и
     * перехватить системное окно выбора — Playwright отдаёт файлы сам. Проверено
     * живьём: шестисекундный ролик появляется чипом «0:06». */
    /* Кнопку ждём, а не проверяем разово: поле ввода появляется раньше панели
       инструментов, и на медленной странице драйвер отваливался с «кнопки нет»,
       хотя через секунду она была. */
    const менюКн = p.locator('button[aria-label*="Загрузка и инструменты"], button[aria-label*="Add files"]').first();
    let естьКн = false;
    for (let ж = 0; ж < 40 && !естьКн; ж++) {
      естьКн = (await менюКн.count()) > 0 && await менюКн.isVisible().catch(() => false);
      if (!естьКн) await p.waitForTimeout(1000);
    }
    if (!естьКн) { лог("кнопки загрузки нет"); await уйти(4); }
    /* Меню открывается не всегда с первого нажатия: тяжёлая страница, и клик
       иногда уходит раньше, чем навешан обработчик. Жмём и ждём сам пункт, а не
       фиксированную паузу — на паузе в две секунды драйвер уже отваливался. */
    const пункт = p.getByText("Загрузить файлы", { exact: true }).first();
    let открылось = false;
    for (let попытка = 1; попытка <= 3 && !открылось; попытка++) {
      await менюКн.click({ delay: 80 }).catch(() => {});
      for (let ж = 0; ж < 15 && !открылось; ж++) {
        await p.waitForTimeout(700);
        открылось = (await пункт.count()) > 0 && await пункт.isVisible().catch(() => false);
      }
      if (!открылось) лог("меню не открылось, попытка", попытка);
    }
    if (!открылось) { лог("пункта «Загрузить файлы» нет"); await уйти(4); }
    try {
      const [выбор] = await Promise.all([
        p.waitForEvent("filechooser", { timeout: 30000 }),
        пункт.click({ delay: 60 }),
      ]);
      await выбор.setFiles(медиа);
      лог("файлов отдано:", медиа.length);
    } catch (e) { лог("окно выбора не пришло:", String(e).slice(0, 90)); await уйти(4); }

    /* Ждём, пока запись доедет. Признак — чип вложения: у ролика это его
       длительность, у прочего имя файла. Уйдёт запрос раньше — модель разберёт
       пустоту и выдаст правдоподобную оценку несуществующей работы. */
    let доехало = false;
    for (let ж = 0; ж < 75 && !доехало; ж++) {
      доехало = await p.evaluate(() =>
        [...document.querySelectorAll('[class*=attachment], [class*=file-preview], [data-test-id*=file]')]
          .some(e => (e.innerText || '').trim().length > 0)
        || [...document.querySelectorAll('img')].some(и => (и.src || '').startsWith('blob:') && и.naturalWidth > 30)
      ).catch(() => false);
      if (!доехало) await p.waitForTimeout(4000);
    }
    if (!доехало) { лог("вложение не доехало за 5 минут"); await уйти(5); }
    лог("вложение доехало");
  }

  const поле = p.locator('div.ql-editor[contenteditable="true"], rich-textarea div[contenteditable="true"]').first();
  await поле.waitFor({ state: "visible", timeout: 60000 });
  await поле.click({ timeout: 20000 });
  await p.keyboard.insertText(промпт);
  await p.waitForTimeout(1500);
  let влезло = (await поле.innerText().catch(() => "")).length;
  if (влезло < промпт.length * 0.6) {
    await p.evaluate(t => {
      const e = document.querySelector('div.ql-editor[contenteditable="true"]');
      if (!e) return;
      e.focus();
      document.execCommand("insertText", false, t);
    }, промпт);
    await p.waitForTimeout(1500);
    влезло = (await поле.innerText().catch(() => "")).length;
  }
  лог("промпт в поле, знаков", влезло, "из", промпт.length);
  if (влезло < промпт.length * 0.5) throw new Error("промпт не вставился");

  const БЫЛО = await p.evaluate(() =>
    document.querySelectorAll("model-response, message-content").length);

  const отправить = p.locator('button[aria-label*="Отправить"], button[aria-label*="Send"]').first();
  if (await отправить.count()) await отправить.click({ timeout: 15000 }).catch(() => {});
  else await p.keyboard.press("Enter");
  лог("отправлено, жду до", ждать, "с");

  const срок = Date.now() + ждать * 1000;
  let ответ = "", прошлый = "", устоялось = 0;
  while (Date.now() < срок) {
    await p.waitForTimeout(3000);
    const сейчас = await p.evaluate(было => {
      const у = document.querySelectorAll("model-response, message-content");
      if (у.length <= было) return "";
      return у[у.length - 1].innerText || "";
    }, БЫЛО).catch(() => "");
    if (сейчас && сейчас === прошлый) {
      const пишет = await p.evaluate(() =>
        !!document.querySelector('button[aria-label*="Остановить"], button[aria-label*="Stop"]')
      ).catch(() => false);
      if (!пишет && ++устоялось >= 2) { ответ = сейчас; break; }
    } else устоялось = 0;
    прошлый = сейчас;
  }
  if (!ответ) ответ = прошлый;
  if (!ответ.trim()) { лог("ответа нет"); код = 2; }
  else {
    writeFileSync(куда, ответ.trim(), "utf8");
    лог("сохранено", куда, ответ.trim().length, "знаков");
  }
} catch (e) {
  лог("ОШИБКА", String(e).slice(0, 200));
  if (код !== 3) код = 1;
}
await уйти(код);
