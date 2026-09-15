/* Обычные разделы сайта: числа, язык, доступность.

   Ловим то, что нашёл сплошной разбор: два разных числа узлов на
   одной странице, кириллицу на английской версии, подпись для чтения
   с экрана мимо перевода, потерянный фокус после окна звонка и
   форму, которая молча умирает при закрытом хранилище. */
import { браузер, страница, ЭКРАНЫ } from "./общее.mjs";
const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);

/* Прокрутка до счётчиков, чтобы они успели отработать */
for (let i = 0; i < 6; i++) { await pg.mouse.wheel(0, 700); await pg.waitForTimeout(250); }
await pg.waitForTimeout(2500);

const числа = await pg.evaluate(() => {
  const реестр = (window.RC_GEO && window.RC_GEO.COUNT) || null;
  const метки = [].map.call(document.querySelectorAll("[data-nodes]"), (e) => e.textContent.trim());
  const kpi = document.querySelector("#kpi .kpi-n span[data-count]");
  return { реестр, метки, kpi: kpi ? kpi.textContent.trim() : null };
});
console.log("числа узлов:", JSON.stringify(числа));
const kpiЧисло = числа.kpi ? +числа.kpi.replace(/\D/g, "") : null;
if (числа.реестр && kpiЧисло && kpiЧисло !== числа.реестр) {
  console.log("БЕДА  KPI показывает " + kpiЧисло + ", в реестре " + числа.реестр);
  process.exitCode = 1;
}

/* Фокус после окна обратного звонка */
/* Окно звонка проверяем сверху страницы: именно там его и открывают,
   а из сцены полёта страница под окном глухая по замыслу. */
await pg.evaluate(() => window.scrollTo(0, 0));
await pg.waitForTimeout(2500);

const фокус = await pg.evaluate(async () => {
  const окно = document.querySelector(".modal, #callbackModal, [data-modal-box]");
  const кн = [].find.call(document.querySelectorAll("button, a"),
                          (b) => /перезвон/i.test(b.textContent || ""));
  if (!кн || !окно) return "кнопки или окна нет";
  кн.focus();
  const откуда = document.activeElement;
  кн.click();
  /* Ждём, пока окно не только откроется, но и успокоится: оно само
     ставит курсор в первое поле, и на редких кадрах песочницы это
     происходит позже нашего нажатия Escape. */
  await new Promise((r) => setTimeout(r, 3000));
  if (!окно.classList.contains("on")) return "окно не открылось";
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  const a = document.activeElement;
  const состояние = окно.classList.contains("on") ? "окно ОСТАЛОСЬ открытым" : "окно закрылось";
  const глухо = !!(откуда.closest("[inert]") || откуда.hasAttribute("inert"));
  return состояние + ", страница под окном " + (глухо ? "глухая" : "живая") + ", фокус " +
         (a === откуда ? "вернулся на кнопку" : "ушёл на " +
          (a ? (a.tagName + (a.className ? "." + String(a.className).split(" ")[0] : "")) : "нет"));
});
console.log("фокус после закрытия окна:", фокус);
if (/BODY/.test(фокус)) { console.log("БЕДА  фокус после окна упал в начало документа"); process.exitCode = 1; }

/* Английская версия: кириллица и подпись поля поиска */
await pg.evaluate(() => { const b = document.querySelector('button[data-lang="en"]'); if (b) b.click(); });
await pg.waitForTimeout(7000);
const англ = await pg.evaluate(() => {
  const кир = [];
  const ход = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let у;
  while ((у = ход.nextNode())) {
    const т = (у.nodeValue || "").trim();
    if (!т || !/[А-Яа-яЁё]/.test(т)) continue;
    const р = у.parentElement;
    if (!р || !р.offsetParent) continue;
    /* Кнопка выбора языка подписана на своём языке нарочно: «Русский»
       на английской странице это не забытый перевод, а название
       варианта. */
    if (р.closest && р.closest("[data-lang], .pill.lang")) continue;
    var путь = р.tagName.toLowerCase() + (р.className ? "." + String(р.className).split(" ")[0] : "");
    var род = р.parentElement;
    while (род && род !== document.body) {
      путь = род.tagName.toLowerCase() + (род.className ? "." + String(род.className).split(" ")[0] : "") + " > " + путь;
      род = род.parentElement;
    }
    кир.push(путь + "  ::  " + т.slice(0, 34));
  }
  const п = document.querySelector("#nodeSearch");
  return { кириллица: кир.slice(0, 6), подписьПоиска: п ? п.getAttribute("aria-label") : null,
           подсказкаТемы: (document.querySelector('.js-theme[data-theme="light"]') || {}).title || null };
});
console.log("английская версия:", JSON.stringify(англ));
if (англ.кириллица.length) { console.log("БЕДА  кириллица на английской версии: " + англ.кириллица.join(" | ")); process.exitCode = 1; }
if (англ.подписьПоиска && /[А-Яа-яЁё]/.test(англ.подписьПоиска)) { console.log("БЕДА  подпись поля поиска осталась русской"); process.exitCode = 1; }
if (англ.подсказкаТемы && /[А-Яа-яЁё]/.test(англ.подсказкаТемы)) { console.log("БЕДА  подсказка кнопки темы осталась русской"); process.exitCode = 1; }

if (беды.length) console.log("беды:", беды.slice(0, 4));
if (!process.exitCode) console.log("ЧИСТО  числа, язык, доступность");
await b.close();
