/* Панель: набранное не должно пропадать.
   Три беды разом. Тексты пересобирались из последнего сохранённого
   набора при поиске и при галочке «только изменённые». Карточки
   обнулялись при смене группы и языка. Сводка по сети считалась по
   базовому реестру и не видела своих правок. */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");
const АДРЕС = "http://127.0.0.1:8126/admin.html";
const b = await chromium.launch({ args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded" });
await pg.fill("#key", "test2026");
await pg.press("#key", "Enter");
await pg.waitForTimeout(1500);
let бед = 0;
const шаг = (имя, ок, что) => { if (!ок) бед++; console.log((ок ? "ЧИСТО  " : "БЕДА   ") + имя + (что ? " :: " + что : "")); };

/* ── тексты ── */
await pg.click('#tabs [data-p="content"]').catch(() => {});
await pg.waitForTimeout(700);
const поле = await pg.$("#cFields [data-k]");
if (!поле) { console.log("нет полей текстов, проверка пропущена"); }
else {
  const ключ = await поле.getAttribute("data-k");
  await поле.fill("МОЙ НОВЫЙ ЗАГОЛОВОК");
  await pg.fill("#cFind", "а");
  await pg.waitForTimeout(400);
  await pg.fill("#cFind", "");
  await pg.waitForTimeout(400);
  const стало = await pg.$eval(`#cFields [data-k="${ключ}"]`, (e) => e.value).catch(() => "");
  шаг("текст пережил поиск", стало === "МОЙ НОВЫЙ ЗАГОЛОВОК", стало);
  /* галочка «только изменённые» */
  if (await pg.$("#cOnly")) {
    await pg.$eval(`#cFields [data-k="${ключ}"]`, (e) => { e.value = "ВТОРАЯ ПРАВКА"; e.dispatchEvent(new Event("input", { bubbles: true })); });
    await pg.click("#cOnly");
    await pg.waitForTimeout(400);
    const п2 = await pg.$eval(`#cFields [data-k="${ключ}"]`, (e) => e.value).catch(() => "");
    шаг("текст пережил галочку", п2 === "ВТОРАЯ ПРАВКА", п2);
    await pg.click("#cOnly");
  }
}

/* ── карточки ── */
await pg.waitForTimeout(400);
const ПОЛЕ = '#bList input[data-f="h"], #bList textarea[data-f="h"]';
const карточка = await pg.$(ПОЛЕ);
if (!карточка) { console.log("нет карточек, проверка пропущена"); }
else {
  await карточка.fill("НОВОЕ НАЗВАНИЕ ПРОДУКТА");
  await карточка.dispatchEvent("input");
  await pg.waitForTimeout(200);
  const группы = await pg.$$("#bGroup button");
  await группы[1].click();
  await pg.waitForTimeout(400);
  await группы[0].click();
  await pg.waitForTimeout(400);
  const стало = await pg.$eval(ПОЛЕ, (e) => e.value).catch(() => "");
  шаг("карточка пережила смену группы", стало === "НОВОЕ НАЗВАНИЕ ПРОДУКТА", стало);
}

/* ── сеть ── */
await pg.click('#tabs [data-p="net"]').catch(() => {});
await pg.waitForTimeout(900);
/* Правку ставим руками через форму: без неё сводка сходится сама
   собой и проверка ничего не доказывает. Файл data/nodes.json
   восстанавливает вызывающий скрипт. */
const прячем = await pg.evaluate(() => window.RC_GEO.NODES[3][0]);
await pg.fill("#nName", "Проверкаград");
await pg.fill("#nEn", "Testville");
await pg.fill("#nLat", "57.81");
await pg.fill("#nLon", "28.33");
await pg.click("#nAdd");
await pg.waitForTimeout(800);
await pg.fill("#hName", прячем);
await pg.click("#hAdd");
await pg.waitForTimeout(900);
const было = await pg.$eval("#netStats .stat .v", (e) => +e.textContent);
const баз = await pg.evaluate(() => window.RC_GEO.NODES.length);
const вспискe = await pg.evaluate(() => /Проверкаград/.test(document.getElementById("netList").textContent));
const спрятанВидно = await pg.evaluate((имя) => document.getElementById("netList").textContent.indexOf(имя) >= 0, прячем);
шаг("сводка сети считает правки", было === баз + 1 - 1, `панель ${было} · реестр ${баз} + свой 1 - скрытый 1`);
шаг("свой город виден в списке сети", вспискe);
шаг("скрытый город ушёл из списка сети", !спрятанВидно, прячем);

/* ── слишком длинное имя города ── */
/* Поле теперь режет ввод на 60 знаках, поэтому длинное имя заводим
   мимо него: так же оно пришло бы от чужого клиента. */
await pg.evaluate(() => {
  var э = document.getElementById("nName");
  э.removeAttribute("maxlength");
  э.value = "Ч".repeat(65);
});
await pg.fill("#nLat", "10");
await pg.fill("#nLon", "10");
await pg.click("#nAdd");
await pg.waitForTimeout(700);
const тост = await pg.evaluate(() => (document.querySelector(".toast, #toast") || {}).textContent || "");
const осталось = (await pg.inputValue("#nName")).length;
шаг("длинное имя не пропадает молча", /60/.test(тост) && осталось === 65, `тост «${тост}» · в поле ${осталось} знаков`);
const ограничение = await pg.getAttribute("#nEn", "maxlength");
шаг("поле города режет ввод на 60", ограничение === "60", "maxlength=" + ограничение);

/* ── прибираем за собой ── */
await pg.evaluate(async () => {
  var pass = localStorage.getItem("rc_admin_pass") || "";
  await fetch("api.php?action=nodes_save", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pass: pass, add: "[]", hide: "[]" })
  });
});

/* ── выгрузка CSV после возврата по пропуску ── */
await pg.reload({ waitUntil: "domcontentloaded" });
await pg.waitForTimeout(1500);
const секрет = await pg.evaluate(() => {
  var f = document.createElement("form");
  document.body.appendChild(f);
  var поймали = null;
  var прежний = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () {
    поймали = [].map.call(this.querySelectorAll("input"), (i) => i.name + "=" + (i.value ? "есть" : "пусто")).join(",");
  };
  document.getElementById("csv").click();
  HTMLFormElement.prototype.submit = прежний;
  return поймали;
});
шаг("выгрузка CSV шлёт живой секрет", /=(есть)/.test(секрет || ""), секрет);

console.log(бед ? "ИТОГ: беды остались" : "ИТОГ: панель держит правки");
await b.close();
process.exit(бед ? 1 : 0);
