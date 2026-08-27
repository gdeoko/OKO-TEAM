/* Смена языка на странице: что переживают заголовок раздела
   надёжности, боковой ход слоёв и слова экранов рубки.

   Беда была такая: салон уносит .sec-head внутрь #relGrid, а сборщик
   блоков на смене языка стирает содержимое сетки целиком. Заголовок
   исчезал навсегда, а новые карточки не попадали под наблюдение
   бокового хода. */
import { браузер, страница, ЭКРАНЫ } from "./общее.mjs";
const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);

const снять = () => pg.evaluate(() => {
  const rel = document.querySelector("#reliability");
  const h = rel ? rel.querySelector(".sec-head") : null;
  return {
    язык: document.documentElement.lang,
    заголовокЖив: !!(h && h.isConnected),
    заголовокТекст: h ? (h.textContent || "").trim().slice(0, 42) : "",
    карточек: document.querySelectorAll("#relGrid .card").length,
    слоёвПодНаблюдением: document.querySelectorAll(".w3-lay").length,
    словаЭкранов: (window.RC_CABIN && window.RC_CABIN.экраны)
      ? window.RC_CABIN.экраны().map((э) => э.tag).slice(0, 3) : null
  };
});

/* Прокруткой до раздела, чтобы салон успел его разобрать */
for (let i = 0; i < 14; i++) {
  await pg.mouse.wheel(0, 700);
  await pg.waitForTimeout(260);
}
await pg.waitForTimeout(2500);
const до = await снять();
console.log("до смены языка:  ", JSON.stringify(до));

for (const язык of ["en", "ru", "en"]) {
  await pg.evaluate((l) => {
    const b = document.querySelector('button[data-lang="' + l + '"]');
    if (b) b.click();
  }, язык);
  await pg.waitForTimeout(2600);
  const п = await снять();
  console.log("после ->" + язык + ":     ", JSON.stringify(п));
  if (!п.заголовокЖив) { console.log("БЕДА  заголовок раздела надёжности пропал после смены языка"); process.exitCode = 1; }
  if (п.карточек < 4) { console.log("БЕДА  карточек надёжности осталось " + п.карточек); process.exitCode = 1; }
  if (п.слоёвПодНаблюдением < до.слоёвПодНаблюдением) {
    console.log("БЕДА  слоёв бокового хода было " + до.слоёвПодНаблюдением + ", стало " + п.слоёвПодНаблюдением);
    process.exitCode = 1;
  }
}
if (беды.length) console.log("беды:", беды.slice(0, 5));
if (!process.exitCode) console.log("ЧИСТО  заголовок, карточки и слои переживают смену языка");
await b.close();
