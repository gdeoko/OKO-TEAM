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
    /* Фон считаем ДО прикрепления. Признак «есть элемент вложения» срабатывал
       в ту же секунду, что и отдача файла: на странице такие элементы уже
       лежали. Запрос уходил до того, как запись доехала, и по видео ответа не
       было вовсе. Ждём именно ПРИРОСТ к тому, что было. */
    const фон = await p.evaluate(() =>
      document.querySelectorAll('[class*=attachment],[class*=file-preview],[data-test-id*=file]').length
    ).catch(() => 0);

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

    /* Ждём, пока запись доедет: прирост элементов вложения к фону И тишина по
       индикаторам загрузки. Видео едет дольше картинки, поэтому срок щедрый —
       лучше подождать, чем разобрать пустоту и выдать оценку несуществующей
       работы. */
    let доехало = false, было = "";
    for (let ж = 0; ж < 120 && !доехало; ж++) {
      const st = await p.evaluate(ф => {
        const чипов = document.querySelectorAll('[class*=attachment],[class*=file-preview],[data-test-id*=file]').length;
        const грузится = document.querySelectorAll('[role=progressbar]:not([aria-hidden="true"])').length;
        return { чипов, грузится };
      }, фон).catch(() => null);
      if (st) {
        было = "чипов " + st.чипов + " (было " + фон + "), индикаторов " + st.грузится;
        if (st.чипов > фон) доехало = true;
      }
      if (!доехало) await p.waitForTimeout(3000);
    }
    if (!доехало) { лог("вложение не доехало:", было); await уйти(5); }
    лог("вложение доехало —", было);
    /* Дать приложению закрепить вложение за запросом: чип появляется чуть
       раньше, чем файл действительно привязан. */
    await p.waitForTimeout(5000);
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

  /* Считаем ответы ДО отправки: приложение иногда держит в разметке пустые
     оболочки, и «просто взять последний» даёт вчерашний ответ соседнего чата. */
  const ОТВЕТОВ = () => p.evaluate(() =>
    document.querySelectorAll("model-response, message-content, [data-response-index]").length);
  const БЫЛО = await ОТВЕТОВ();
  лог("ответов на странице до отправки:", БЫЛО);

  /* ЗАПРОС С ВИДЕО НЕ УХОДИТ, ПОКА ЗАПИСЬ НЕ ОБРАБОТАНА.
   *
   * Чип вложения появляется сразу, а приложение ещё несколько минут готовит
   * ролик — всё это время кнопка отправки нажимается вхолостую. В журнале это
   * выглядело так: «отправлено», и дальше пять минут «ответов 0». Ждём, пока
   * индикаторы обработки погаснут, и убеждаемся, что запрос действительно
   * ушёл: иначе жмём ещё раз, потом пробуем Enter. */
  const отправить = p.locator('button[aria-label*="Отправить"], button[aria-label*="Send"]').first();

  if (медиа.length) {
    /* Ждём именно ВИДИМЫЙ индикатор: скрытый progressbar висит в разметке
       постоянно, и проверка «их ноль» не срабатывала никогда — драйвер стоял
       шесть минут на пустом месте. Заодно смотрим на кнопку отправки: пока
       запись готовится, она недоступна. */
    let готово = false;
    for (let ж = 0; ж < 100 && !готово; ж++) {
      готово = await p.evaluate(() => {
        const видимых = [...document.querySelectorAll('[role=progressbar]')]
          .filter(e => e.offsetParent !== null).length;
        const кн = document.querySelector('button[aria-label*="Отправить"], button[aria-label*="Send"]');
        const можно = kн => kн && !kн.disabled && kн.getAttribute('aria-disabled') !== 'true';
        return видимых === 0 && можно(кн);
      }).catch(() => false);
      if (!готово) await p.waitForTimeout(3000);
    }
    лог(готово ? "запись обработана, кнопка активна" : "обработка затянулась — пробую отправить как есть");
  }

  /* ПОВТОРНОЕ НАЖАТИЕ ОТМЕНЯЕТ ОТВЕТ, А НЕ ПОВТОРЯЕТ ОТПРАВКУ.
   *
   * На время генерации кнопка на том же месте превращается в «Остановить».
   * Драйвер, не дождавшись признака отправки за двадцать секунд, жал ещё раз —
   * и сам обрывал ответ. В журнале это выглядело как «мост не дал разбор», а в
   * чате оставалось «Вы остановили генерацию ответа». Поэтому перед каждым
   * повтором смотрим, не идёт ли уже генерация: идёт — значит запрос ушёл. */
  const идётОтвет = () => p.evaluate(() =>
    !!document.querySelector('button[aria-label*="Остановить"], button[aria-label*="Stop"]')
  ).catch(() => false);

  let ушло = false;
  for (let попытка = 1; попытка <= 3 && !ушло; попытка++) {
    if (await идётОтвет()) { ушло = true; break; }
    if (await отправить.count()) await отправить.click({ timeout: 15000 }).catch(() => {});
    else await p.keyboard.press("Enter");
    for (let ж = 0; ж < 15 && !ушло; ж++) {
      await p.waitForTimeout(2000);
      ушло = await идётОтвет()
          || (await ОТВЕТОВ()) > БЫЛО
          || await p.evaluate(() => document.querySelectorAll("user-query, [class*=user-query]").length > 0).catch(() => false);
    }
    if (!ушло) лог("запрос не ушёл, попытка", попытка);
  }
  лог(ушло ? "запрос ушёл, жду ответ до " + ждать + " с" : "отправить не удалось — жду на всякий случай");

  const срок = Date.now() + ждать * 1000;
  let ответ = "", прошлый = "", устоялось = 0, тик = 0;
  while (Date.now() < срок) {
    await p.waitForTimeout(3000);
    /* Берём последний НЕПУСТОЙ ответ, а не просто последний: приложение держит
       в разметке пустые оболочки, и «последний» стабильно давал ноль знаков —
       драйвер ждал ответ, который уже был на экране. */
    const сейчас = await p.evaluate(было => {
      const у = [...document.querySelectorAll("model-response, message-content, [data-response-index]")];
      if (у.length <= было) return "";
      const тексты = у.map(e => (e.innerText || "").trim()).filter(t => t.length > 0);
      return тексты.length ? тексты[тексты.length - 1] : "";
    }, БЫЛО).catch(() => "");
    /* Раз в минуту говорим, что происходит: молчаливое ожидание в пять минут
       неотличимо от зависшего драйвера, и разбираться потом не по чему. */
    if (++тик % 20 === 0) {
      лог("жду ответ:", Math.round((срок - Date.now()) / 1000) + "с осталось,",
          "ответов", await ОТВЕТОВ(), "накоплено знаков", (сейчас || "").length);
    }
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
