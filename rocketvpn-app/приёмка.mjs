/* ТЕХНИЧЕСКАЯ ПРИЁМКА ПРИЛОЖЕНИЯ ROCKET VPN

   Слово владельца: «все кнопки должны быть кликабельны, полностью
   кабинет собери, чтобы всё работало на 100% идеально» и «тестируй,
   проверяй визуально, технически, все кнопки, кликайте, и анимации».

   Здесь вторая половина: каждая кнопка приложения нажимается живьём, и
   у нажатия проверяется ПОСЛЕДСТВИЕ, а не сам факт клика. Кнопка,
   которая нажалась и ничего не сделала, для человека сломана ровно так
   же, как ненажимающаяся.

   ── ПОЧЕМУ ВЕСЬ КРУГ ГОНЯЕТСЯ ТРИЖДЫ ────────────────────────────
   Тем три, и вёрстка у них общая, но общая она только пока это правда.
   Один раз уже вышло так, что затемнение бокового меню накрыло собой
   нижние вкладки, и весь экран перестал нажиматься: приёмка поймала
   это с первого прогона. Прогон по одной теме такую беду в двух
   других не увидит.

   Запуск: node приёмка.mjs [путь-к-журналу]                          */

import { appendFileSync, writeFileSync } from "node:fs";
import { chromium } from "/home/user/OKO-TEAM/rocketvpn/node_modules/playwright/index.mjs";
import { поднятьСервер } from "./сервер.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ЖУРНАЛ = process.argv[2] || "/tmp/приёмка.log";
writeFileSync(ЖУРНАЛ, "");
/* Пишем строку за строкой, а не в конце. Узел копит вывод в буфере, и
   убитый на полпути прогон уносит с собой ВСЁ, что успел напечатать:
   на руках остаётся пустой файл вместо места, где всё сломалось. */
const скажи = (с) => { appendFileSync(ЖУРНАЛ, с + "\n"); process.stdout.write(с + "\n"); };

const ТЕМЫ = ["планета", "ракета", "океан"];
/* Страница идёт по http, а не file://: 3D-сцены грузят текстуры, и с
   адреса file:// браузер их в WebGL не отдаёт (CORS, источник null). */
const сервер = await поднятьСервер(join(dirname(fileURLToPath(import.meta.url)), "планета"));
const АДРЕС = сервер.адрес + "/index.html";

/* WebGL включён программно (SwiftShader): приёмка обязана гонять кнопки
   поверх живого 3D-мира, а не поверх запасного нарисованного фона. */
const бр = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const беды = [];

for (const тема of ТЕМЫ) {
  скажи("\n═══ ТЕМА «" + тема.toUpperCase() + "» ═══");

  const ктx = await бр.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  const стр = await ктx.newPage();
  стр.on("pageerror", e => беды.push(тема + ": ОШИБКА JS: " + String(e).slice(0, 200)));
  стр.on("console", m => { if (m.type() === "error") беды.push(тема + ": КОНСОЛЬ: " + m.text().slice(0, 160)); });

  await стр.goto(АДРЕС, { waitUntil: "load" });
  await стр.waitForTimeout(2400);
  await стр.evaluate(т => window.ТЕМА(т), тема);
  await стр.waitForTimeout(700);

  const шаг = async (имя, дело) => {
    try {
      const р = await дело();
      скажи((р === false ? "ПЛОХО " : "ок    ") + имя + (typeof р === "string" ? "  " + р : ""));
      if (р === false) беды.push(тема + ": " + имя);
    } catch (e) {
      скажи("ПЛОХО " + имя + "  " + String(e).slice(0, 110));
      беды.push(тема + ": " + имя);
    }
  };

  await шаг("тема встала", async () =>
    await стр.evaluate(() => document.documentElement.getAttribute("data-тема")));
  await шаг("фон темы показан", async () => {
    const видно = await стр.evaluate(т => {
      const м = document.querySelector(".мир-" + т);
      return м ? getComputedStyle(м).display !== "none" : false;
    }, тема);
    return видно;
  });
  /* У огня герой стоит не в круге под кнопкой, а в фоне за списком:
     кнопка шириной 13.6 рем закрывала корпус целиком. Поэтому и
     смотрим разные узлы. */
  await шаг("герой темы показан", async () => await стр.evaluate(т => {
    const где = { планета: ".герой-планета", ракета: ".мир-ракета .старт", океан: ".герой-океан" }[т];
    const у = document.querySelector(где);
    if (!у) return false;
    const с = getComputedStyle(у);
    return с.display !== "none" && parseFloat(с.opacity) > 0;
  }, тема));
  await шаг("3D-мир темы живой", async () => await стр.evaluate(т =>
    window.МИР && window.МИР.жив && window.МИР.текущая() === т ? "сцена «" + т + "»" : false, тема));
  await шаг("исток следа на экране", async () => await стр.evaluate(() => {
    const и = window.МИР.источник();
    return и && и.x > 0 && и.x < innerWidth && и.y > 0 && и.y < innerHeight ? Math.round(и.x) + "," + Math.round(и.y) : false;
  }));
  await шаг("чужих миров на экране нет", async () => await стр.evaluate(т => {
    return ["планета", "ракета", "океан"]
      .filter(и => и !== т)
      .every(и => getComputedStyle(document.querySelector(".мир-" + и)).display === "none");
  }, тема));

  await шаг("строки нарисованы", async () => (await стр.locator(".ряд").count()) + " строк");
  await шаг("нижнее меню видно", async () => await стр.locator(".низ").isVisible());
  await шаг("вкладка Серверы", async () => { await стр.click('.вкладка[data-к-экрану="серверы"]'); await стр.waitForTimeout(500);
    return await стр.locator('.экран[data-экран="серверы"].тут').count() === 1; });
  await шаг("сортировка По названию", async () => { await стр.click('.чип[data-сорт="имя"]'); await стр.waitForTimeout(300);
    return (await стр.locator("#список-серверы .ряд").first().textContent()).slice(0, 20); });
  await шаг("поиск по серверам", async () => { await стр.fill("#поиск-серверы", "гер"); await стр.waitForTimeout(300);
    const н = await стр.locator("#список-серверы .ряд").count(); await стр.fill("#поиск-серверы", ""); return н + " найдено"; });
  await шаг("замер на Серверах", async () => { await стр.click("#обновить-2"); await стр.waitForTimeout(600);
    return (await стр.locator("#список-серверы .нить").count()) >= 5; });

  await шаг("вкладка Профиль", async () => { await стр.click('.вкладка[data-к-экрану="профиль"]'); await стр.waitForTimeout(500);
    return await стр.locator('.экран[data-экран="профиль"].тут').count() === 1; });
  await шаг("выбранная тема отмечена", async () =>
    await стр.locator('.тема-кнопка.выбрана[data-тема-выбор="' + тема + '"]').count() === 1);
  await шаг("тумблер в профиле", async () => { const т = стр.locator('[data-тумблер="блокировка"] .тумблер');
    await стр.click('[data-тумблер="блокировка"]'); await стр.waitForTimeout(300);
    return (await т.getAttribute("class")).includes("вкл"); });
  await шаг("переход в Подписку", async () => { await стр.click('[data-к-экрану="подписка"]'); await стр.waitForTimeout(500);
    return await стр.locator('.экран[data-экран="подписка"].тут').count() === 1; });
  await шаг("выбор тарифа", async () => { await стр.click('.тариф[data-тариф="12 месяцев"]'); await стр.waitForTimeout(300);
    return await стр.locator(".тариф.выбран").count() === 1; });
  await шаг("кнопка продлить", async () => { await стр.click("#продлить"); await стр.waitForTimeout(400);
    return (await стр.locator(".всплывашка").textContent()).length > 0; });
  await шаг("кнопка назад", async () => { await стр.click("[data-назад]"); await стр.waitForTimeout(500);
    return await стр.locator(".экран.тут").count() === 1; });

  await шаг("бургер открывает меню", async () => { await стр.click("#бургер"); await стр.waitForTimeout(500);
    return await стр.evaluate(() => document.documentElement.classList.contains("ящик-открыт")); });
  await шаг("штора закрывает меню", async () => {
    /* Тыкать надо в ВИДИМОЕ затемнение справа от ящика. Центр шторы
       лежит под самим ящиком (тот занимает 82% ширины), и клик в центр
       попадает в меню. Именно на этом приёмка поймала беду: ящик
       оставался открыт и накрывал собой нижние вкладки, после чего на
       экране переставало нажиматься вообще всё. */
    const к = await стр.locator("#штора").boundingBox();
    await стр.mouse.click(к.x + к.width * 0.94, к.y + к.height * 0.5);
    await стр.waitForTimeout(500);
    return !(await стр.evaluate(() => document.documentElement.classList.contains("ящик-открыт"))); });
  await шаг("Escape закрывает меню", async () => {
    await стр.click("#бургер"); await стр.waitForTimeout(420);
    await стр.keyboard.press("Escape"); await стр.waitForTimeout(420);
    return !(await стр.evaluate(() => document.documentElement.classList.contains("ящик-открыт"))); });
  await шаг("пункт меню ведёт на экран", async () => {
    await стр.click("#бургер"); await стр.waitForTimeout(420);
    await стр.click('.пункт[data-к-экрану="серверы"]'); await стр.waitForTimeout(520);
    const тут = await стр.locator('.экран[data-экран="серверы"].тут').count() === 1;
    const закрыт = !(await стр.evaluate(() => document.documentElement.classList.contains("ящик-открыт")));
    return тут && закрыт; });

  await шаг("на Главную", async () => { await стр.click('.вкладка[data-к-экрану="главная"]'); await стр.waitForTimeout(520);
    return await стр.locator('.экран[data-экран="главная"].тут').count() === 1; });
  await шаг("избранное по звезде", async () => { await стр.click("#список-главная .ряд:nth-child(3) [data-звезда]"); await стр.waitForTimeout(400);
    return (await стр.locator(".звезда.горит").count()) + " горит"; });
  await шаг("выбор страны", async () => { await стр.click("#список-главная .ряд:nth-child(4)"); await стр.waitForTimeout(400);
    return await стр.locator(".ряд.выбран").count() >= 1; });
  await шаг("автовыбор плиткой", async () => { await стр.click("#плитка-авто"); await стр.waitForTimeout(400);
    return await стр.locator("#тумблер-авто").count() === 1; });
  await шаг("кнопка обновить", async () => { await стр.click("#обновить"); await стр.waitForTimeout(600);
    return (await стр.locator("#список-главная .нить").count()) + " нитей следа"; });
  await шаг("след прошёл по строкам", async () => {
    await стр.evaluate(() => window.СТОП_УДАР(1));
    await стр.waitForTimeout(300);
    const горит = await стр.locator("#список-главная .ряд.заряжен").count();
    const мёртвых = await стр.locator("#список-главная .ряд.нет.заряжен").count();
    /* Живые обязаны загореться, мёртвые обязаны остаться серыми: это и
       есть «там где нет пинга остался серый силуэт, будто было, но
       погасло» - слово клиента. */
    return горит >= 6 && мёртвых === 0 ? горит + " горит, мёртвых " + мёртвых : false; });
  await шаг("подключение", async () => { await стр.click("#пуск"); await стр.waitForTimeout(2300);
    return await стр.evaluate(() => document.documentElement.classList.contains("подключено")); });
  await шаг("таймер идёт", async () => { await стр.waitForTimeout(1200);
    const т = await стр.locator("#пуск-сноска").textContent();
    return /\d\d:\d\d/.test(т) ? т : false; });
  await шаг("отключение", async () => { await стр.click("#пуск"); await стр.waitForTimeout(700);
    return !(await стр.evaluate(() => document.documentElement.classList.contains("подключено"))); });
  await шаг("веток следа нет", async () => (await стр.locator(".нить.живая, .нить.мёртвая").count()) === 0);

  await шаг("выбор темы помнится", async () => {
    await стр.click('.вкладка[data-к-экрану="профиль"]'); await стр.waitForTimeout(450);
    await стр.click('.тема-кнопка[data-тема-выбор="океан"]'); await стр.waitForTimeout(450);
    await стр.reload({ waitUntil: "load" }); await стр.waitForTimeout(1800);
    return await стр.evaluate(() => document.documentElement.getAttribute("data-тема")) === "океан"; });

  await ктx.close();
}

скажи(беды.length ? "\nБЕДЫ (" + беды.length + "):\n" + беды.join("\n") : "\nВСЁ ЗЕЛЁНОЕ, ошибок нет");
await бр.close();
сервер.закрыть();
process.exit(беды.length ? 1 : 0);
