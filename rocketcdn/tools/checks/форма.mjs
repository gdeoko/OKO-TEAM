/* Форма заявки: пустое, кривое, годное.

   Это денежный путь сайта. Кино вокруг него проверено десятком
   проверок, а сама форма до сих пор ни одной: считалось, что она
   простая. Простое и ломается тише всего.

   Три состояния, и все три обязаны быть видны человеку.

   ПУСТО. Отправка пустой формы не уходит на сервер и показывает, ЧТО
   именно не заполнено. Форма стоит с novalidate, то есть браузерных
   пузырей нет по замыслу: значит подписи обязан рисовать сайт.

   КРИВО. Телефон или почта с явной ошибкой бракуются так же. Поле
   получает aria-invalid и подпись, связанную с ним через
   aria-describedby - иначе чтение с экрана не понимает даже, что поле
   забраковано.

   ГОДНО. Заполненная форма перестаёт ругаться: метки ошибок снимаются
   со всех полей. Саму отправку не делаем - на стенде некуда, да и
   слать заявку с проверки нельзя.

   Плюс ловушка для роботов: скрытое поле website обязано остаться
   пустым и невидимым. Если оно попало в обход по табу или стало
   видно, его заполнит живой человек, и его заявка молча пропадёт.

   Запуск: RC_URL=http://127.0.0.1:8123/ node tools/checks/форма.mjs
*/
import { АДРЕС, ПК, браузер } from "./общее.mjs";

const беды = [];
const b = await браузер();
const pg = await b.newPage({ viewport: ПК.vp, deviceScaleFactor: 1 });
const ошибки = [];
pg.on("pageerror", (e) => ошибки.push("PE: " + e.message));
pg.on("console", (m) => { if (m.type() === "error") ошибки.push("CE: " + m.text().slice(0, 140)); });

await pg.goto(АДРЕС, { waitUntil: "load", timeout: 180000 });
await pg.waitForTimeout(4000);

const есть = await pg.$("#leadForm");
if (!есть) {
  беды.push("формы заявки на странице нет");
} else {
  await pg.evaluate(() => document.querySelector("#leadForm").scrollIntoView({ block: "center" }));
  await pg.waitForTimeout(1200);

  /* ── Ловушка для роботов ─────────────────────────────────── */
  const ловушка = await pg.evaluate(() => {
    const п = document.querySelector('#leadForm input[name="website"]');
    if (!п) return { есть: false };
    const r = п.getBoundingClientRect();
    return {
      есть: true, значение: п.value, таб: п.getAttribute("tabindex"),
      /* Больше четырёх точек, а не больше одной. Спрятанное поле
         стоит один на один, и на дробном масштабе браузер отдаёт его
         рамку как 1,0125 - проверка первой редакции объявила ловушку
         видимой ровно из-за этих сотых. Настоящее видимое поле здесь
         в полсотни точек высотой, запас разделяет их с избытком. */
      видно: r.width > 4 && r.height > 4,
      спрятано: п.getAttribute("aria-hidden") === "true"
    };
  });
  if (!ловушка.есть) {
    беды.push("в форме нет скрытого поля-ловушки: заявки будут забиты роботами");
  } else {
    console.log(`   ловушка: пусто=${ловушка.значение === ""} видно=${ловушка.видно} ` +
                `tabindex=${ловушка.таб} спрятано от чтения=${ловушка.спрятано}`);
    if (ловушка.значение !== "") беды.push("поле-ловушка приехало заполненным");
    if (ловушка.видно) беды.push("поле-ловушка видно человеку: он его заполнит и заявка пропадёт");
    if (ловушка.таб !== "-1") беды.push("поле-ловушка стоит в обходе по табу");
  }

  /* ── Пусто ───────────────────────────────────────────────── */
  const пусто = await pg.evaluate(() => {
    const ф = document.querySelector("#leadForm");
    const кн = ф.querySelector('button[type="submit"], button:not([type])');
    if (кн) кн.click();
    return null;
  });
  await pg.waitForTimeout(900);
  const состояние = async () => await pg.evaluate(() => {
    const ф = document.querySelector("#leadForm");
    const бракованные = [].map.call(ф.querySelectorAll('[aria-invalid="true"]'),
      (e) => e.getAttribute("name") || e.id);
    /* Подпись обязана быть связана с полем, а не просто лежать рядом:
       иначе чтение с экрана её не прочитает. */
    const связаны = бракованные.every((имя) => {
      const п = ф.querySelector('[name="' + имя + '"], #' + имя);
      if (!п) return false;
      const кто = п.getAttribute("aria-describedby");
      if (!кто) return false;
      return кто.split(/\s+/).some((i) => {
        const у = document.getElementById(i);
        return у && (у.textContent || "").trim().length > 0;
      });
    });
    return { бракованные, связаны, ушла: !!ф.getAttribute("data-ушла") };
  });
  const п = await состояние();
  console.log(`   пустая форма: забраковано полей ${п.бракованные.length} ` +
              `(${п.бракованные.join(", ") || "ни одного"}), подписи связаны с полями: ${п.связаны}`);
  if (!п.бракованные.length) {
    беды.push("пустая форма отправляется без единой пометки: человек не узнает, чего не хватает");
  } else if (!п.связаны) {
    беды.push("подпись ошибки не связана с полем через aria-describedby: чтение с экрана её не прочитает");
  }

  /* ── Криво ───────────────────────────────────────────────── */
  await pg.evaluate(() => {
    const ф = document.querySelector("#leadForm");
    const имя = ф.querySelector('[name="name"]');
    const связь = ф.querySelector('[name="contact"]');
    const согл = ф.querySelector('[name="consent"]');
    if (имя) { имя.value = "Даниэль"; имя.dispatchEvent(new Event("input", { bubbles: true })); }
    if (связь) { связь.value = "не-почта-и-не-телефон"; связь.dispatchEvent(new Event("input", { bubbles: true })); }
    if (согл) { согл.checked = true; согл.dispatchEvent(new Event("change", { bubbles: true })); }
    const кн = ф.querySelector('button[type="submit"], button:not([type])');
    if (кн) кн.click();
  });
  await pg.waitForTimeout(900);
  const к = await состояние();
  console.log(`   кривая связь: забраковано ${к.бракованные.length} (${к.бракованные.join(", ") || "ни одного"})`);
  if (!к.бракованные.includes("contact")) {
    беды.push("почта из одних букв без собаки проходит как связь: заявку будет некуда вернуть");
  }

  /* ── Годно ───────────────────────────────────────────────── */
  await pg.evaluate(() => {
    const ф = document.querySelector("#leadForm");
    const связь = ф.querySelector('[name="contact"]');
    if (связь) { связь.value = "daniel@okoteam.top"; связь.dispatchEvent(new Event("input", { bubbles: true })); }
  });
  await pg.waitForTimeout(700);
  const г = await состояние();
  console.log(`   годная связь: осталось забракованных ${г.бракованные.length}`);
  if (г.бракованные.includes("contact")) {
    беды.push("правильная почта осталась забракованной: пометка не снимается после исправления");
  }
}

if (ошибки.length) беды.push("ошибки в консоли: " + ошибки.slice(0, 3).join(" | "));

await b.close();

if (беды.length) {
  console.log("ГРЯЗНО  форма заявки");
  for (const б of беды) console.log("   " + б);
  process.exit(1);
}
console.log("ЧИСТО  форма заявки: пустое и кривое видно, годное проходит");
