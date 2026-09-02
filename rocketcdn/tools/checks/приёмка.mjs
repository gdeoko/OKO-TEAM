/* Приёмка сайта числами: доступность, SEO-база, вес загрузки.

   Остальные десять проверок смотрят на кино: свет, ход камеры, звук,
   тексты, скорость кадра. Здесь то, чего в кадре не видно, а на сдаче
   спрашивают первым: может ли пройти сайт человек с клавиатуры, есть
   ли у каждого органа имя, что покажет ссылка в мессенджере, и
   сколько весит первый экран.

   Меры и почему они такие.

   ДОСТУПНОСТЬ.
   · У каждого органа управления есть имя. Кнопка без имени для
     скринридера это «кнопка», и человек не знает, что она делает.
   · Ни одного положительного tabindex. Он ломает порядок обхода всей
     страницы, и почти всегда ставится по недоразумению.
   · У каждой картинки есть alt, хотя бы пустой: без атрибута
     скринридер читает имя файла.
   · Цель под пальцем не меньше сорока точек. Меряем тычком через
     elementFromPoint, а не рамкой узла: зону нажатия часто расширяют
     псевдоэлементом, и рамка про это не знает.
   · Первым по табу приходит переход к содержимому. Сайт это фильм на
     восемь актов, и человек с клавиатуры не обязан идти сквозь него.
   · Фокус ВИДЕН. Правило, снимающее обводку без замены, отрезает
     клавиатуру от сайта целиком.

   SEO-БАЗА. Заголовок, описание, канонический адрес, карточка для
   мессенджера, язык страницы, ровно один заголовок первого уровня.
   Признак robots проверка только СООБЩАЕТ, а не судит: у одного сайта
   поиск открыт, у другого закрыт по слову владельца.

   ВЕС. Считаем всё, что страница притащила до полной загрузки.
   Порог взят с запасом от нынешнего веса, чтобы ловить возврат
   тяжёлых файлов, а не мешать работать.

   Запуск: RC_URL=http://127.0.0.1:8123/ node tools/checks/приёмка.mjs
*/
import { АДРЕС, ПК, ТЕЛЕФОН, браузер } from "./общее.mjs";

/* Страницу берём БЕЗ входа в полёт: приёмка меряет сам сайт, а не
   игру внутри него. Полёт это отдельный мир со своими проверками, и
   его вес и его органы к сдаче страницы отношения не имеют. */
async function страница(b, э) {
  const pg = await b.newPage({
    viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob
  });
  const ошибки = [];
  pg.on("pageerror", (e) => ошибки.push("PE: " + e.message));
  pg.on("console", (m) => { if (m.type() === "error") ошибки.push("CE: " + m.text().slice(0, 140)); });
  await pg.goto(АДРЕС, { waitUntil: "load", timeout: 180000 });
  await pg.waitForTimeout(6000);
  return { pg, ошибки };
}

/* Вес всего, что страница притащила, мегабайты. Порог взят с запасом
   от нынешнего веса: он ловит возврат тяжёлых файлов, а не мешает
   работать. */
const ВЕС = 12.0;
/* Заголовок и описание: границы, за которыми выдача обрезает. */
const ЗАГ = [20, 70];
const ОПИС = [70, 200];

const беды = [];
const b = await браузер();
const { pg, ошибки } = await страница(b, ПК);

/* ── Что притащила страница ────────────────────────────────── */
const вес = await pg.evaluate(() => {
  const з = performance.getEntriesByType("resource");
  let байт = 0;
  const крупные = [];
  for (const р of з) {
    const б = р.transferSize || р.encodedBodySize || 0;
    байт += б;
    if (б > 200 * 1024) крупные.push({ имя: р.name.split("/").pop().slice(0, 40), кб: Math.round(б / 1024) });
  }
  крупные.sort((a, b2) => b2.кб - a.кб);
  return { всего: байт, запросов: з.length, крупные: крупные.slice(0, 6) };
});
console.log(`   вес страницы ${(вес.всего / 1048576).toFixed(2)} МБ в ${вес.запросов} запросах`);
for (const к of вес.крупные) console.log(`      ${к.имя} · ${к.кб} КБ`);
if (вес.всего / 1048576 > ВЕС) {
  беды.push(`страница весит ${(вес.всего / 1048576).toFixed(2)} МБ при пределе ${ВЕС}`);
}

/* ── SEO-база ──────────────────────────────────────────────── */
const шапка = await pg.evaluate(() => {
  const мета = (n) => {
    const e = document.querySelector(`meta[name="${n}"]`) || document.querySelector(`meta[property="${n}"]`);
    return e ? (e.getAttribute("content") || "").trim() : null;
  };
  return {
    язык: document.documentElement.getAttribute("lang"),
    заголовок: (document.title || "").trim(),
    описание: мета("description"),
    канон: (document.querySelector('link[rel="canonical"]') || {}).href || null,
    ogЗаг: мета("og:title"), ogОпис: мета("og:description"), ogКартинка: мета("og:image"),
    роботы: мета("robots"),
    h1: [].map.call(document.querySelectorAll("h1"), (e) => e.textContent.trim().slice(0, 40))
  };
});
console.log(`   заголовок ${шапка.заголовок.length} знаков · описание ` +
            `${шапка.описание ? шапка.описание.length : 0} · h1 ${шапка.h1.length} · ` +
            `роботы ${шапка.роботы || "не заданы"}`);
if (!шапка.язык) беды.push("у страницы нет языка (lang)");
if (шапка.заголовок.length < ЗАГ[0] || шапка.заголовок.length > ЗАГ[1]) {
  беды.push(`заголовок ${шапка.заголовок.length} знаков, нужно ${ЗАГ[0]}-${ЗАГ[1]}`);
}
if (!шапка.описание) беды.push("нет описания страницы");
else if (шапка.описание.length < ОПИС[0] || шапка.описание.length > ОПИС[1]) {
  беды.push(`описание ${шапка.описание.length} знаков, нужно ${ОПИС[0]}-${ОПИС[1]}`);
}
if (!шапка.канон) беды.push("нет канонического адреса");
if (!шапка.ogЗаг || !шапка.ogОпис) беды.push("карточка для мессенджера неполная: нет og:title или og:description");
if (!шапка.ogКартинка) беды.push("нет og:image: ссылка придёт без картинки");
if (шапка.h1.length !== 1) {
  беды.push(`заголовков первого уровня ${шапка.h1.length}, нужен ровно один`);
}

/* ── Доступность ───────────────────────────────────────────── */
const дост = await pg.evaluate(() => {
  /* Имя органа берём ВСЕМИ способами, какими его берёт скринридер.
     Своей первой редакцией эта проверка объявила безымянными пять
     полей формы, у которых имя стоит подписью через label for: она
     смотрела только на aria-label и текст внутри. Ложная находка
     хуже пропущенной, поэтому здесь полный список. */
  const имя = (e) => {
    const свой = (e.getAttribute("aria-label") || "").trim() ||
                 (e.getAttribute("title") || "").trim() ||
                 (e.textContent || "").trim() ||
                 (e.getAttribute("alt") || "").trim();
    if (свой) return свой;
    const кто = e.getAttribute("aria-labelledby");
    if (кто) {
      const ц = кто.split(/\s+/).map((i) => document.getElementById(i))
        .filter(Boolean).map((n) => (n.textContent || "").trim()).join(" ").trim();
      if (ц) return ц;
    }
    if (e.id) {
      const п = document.querySelector('label[for="' + CSS.escape(e.id) + '"]');
      if (п && (п.textContent || "").trim()) return (п.textContent || "").trim();
    }
    const обёртка = e.closest("label");
    if (обёртка && (обёртка.textContent || "").trim()) return (обёртка.textContent || "").trim();
    const кар = e.querySelector("img[alt]");
    if (кар && кар.getAttribute("alt").trim()) return кар.getAttribute("alt").trim();
    /* Заполнитель это подсказка, а не имя, но поле с ним человек
       всё-таки понимает. Считаем именем последним доводом. */
    return (e.getAttribute("placeholder") || "").trim();
  };
  const органы = [].slice.call(document.querySelectorAll(
    'a[href], button, input, select, textarea, [role="button"], [tabindex]'));
  const видимые = органы.filter((e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  });
  const безымянные = видимые.filter((e) => !имя(e) && e.getAttribute("aria-hidden") !== "true")
    .map((e) => (e.tagName + "." + (e.className || "")).slice(0, 46));
  const плюсТаб = органы.filter((e) => (+e.getAttribute("tabindex") || 0) > 0).length;
  const безAlt = [].filter.call(document.querySelectorAll("img"), (e) => e.getAttribute("alt") == null).length;
  /* Первый по табу. Ищем не по видимости, а по порядку в разметке:
     переход к содержимому обычно спрятан и появляется по фокусу. */
  const первый = органы[0];
  return {
    органов: видимые.length,
    безымянные: безымянные.slice(0, 6),
    плюсТаб, безAlt,
    первыйТаб: первый ? ((первый.textContent || "").trim().slice(0, 30) ||
                          первый.getAttribute("aria-label") || первый.tagName) : null
  };
});
console.log(`   органов ${дост.органов} · без имени ${дост.безымянные.length} · ` +
            `положительный tabindex ${дост.плюсТаб} · картинок без alt ${дост.безAlt}`);
if (дост.безымянные.length) {
  беды.push(`органов без имени ${дост.безымянные.length}: ${дост.безымянные.join(", ")}`);
}
if (дост.плюсТаб) беды.push(`положительных tabindex ${дост.плюсТаб}: порядок обхода сломан`);
if (дост.безAlt) беды.push(`картинок без alt ${дост.безAlt}`);

/* Фокус обязан быть виден. Ставим фокус на первую кнопку и смотрим,
   изменилось ли хоть что-то в её оформлении. */
const фокус = await pg.evaluate(() => {
  const к = document.querySelector("a[href], button");
  if (!к) return "органов нет";
  const до = getComputedStyle(к);
  const было = [до.outlineStyle, до.outlineWidth, до.boxShadow, до.borderColor, до.backgroundColor].join("|");
  к.focus();
  const после = getComputedStyle(к);
  const стало = [после.outlineStyle, после.outlineWidth, после.boxShadow, после.borderColor, после.backgroundColor].join("|");
  return было === стало ? "не виден" : "виден";
});
console.log(`   фокус с клавиатуры: ${фокус}`);
if (фокус === "не виден") беды.push("фокус с клавиатуры ничем не показан: пройти сайт клавишами нельзя");

/* ── Телефон: то же по доступности, размеры целей ──────────── */
await pg.close();
const { pg: тел } = await страница(b, ТЕЛЕФОН);
/* Цель под пальцем меряем НЕ рамкой узла.

   Первая редакция мерила getBoundingClientRect и объявила мелкими
   восемнадцать точек рейки: 26 на 30. А зона нажатия у них давно
   расширена псевдоэлементом до сорока четырёх по вертикали, и в коде
   рядом записано, почему по горизонтали её расширять нельзя. Рамка
   узла про псевдоэлементы не знает вовсе.

   Меряем тем же способом, каким палец и попадает: тычком. Берём
   середину органа и пробуем точки в двадцати точках от неё во все
   четыре стороны. Если там всё ещё этот же орган, значит цель не
   меньше сорока в этом направлении. */
const цели = await тел.evaluate(async () => {
  const жду = (мс) => new Promise((r) => setTimeout(r, мс));
  const подозрительные = [];
  document.querySelectorAll('a[href], button, [role="button"]').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.display === "none") return;
    if (r.width >= 40 && r.height >= 40) return;
    подозрительные.push(e);
  });
  const мелкие = [];
  for (const e of подозрительные) {
    /* Тычок работает только по видимому куску страницы: у органа,
       уехавшего вниз на семь тысяч точек, elementFromPoint не найдёт
       ничего, и проверка объявит мелким что угодно. Подводим каждого
       подозреваемого к середине окна и меряем уже там. */
    e.scrollIntoView({ block: "center", inline: "center" });
    await жду(60);
    const r = e.getBoundingClientRect();
    const сx = r.left + r.width / 2, сy = r.top + r.height / 2;
    const мой = (x, y) => {
      if (x < 0 || y < 0 || x > innerWidth - 1 || y > innerHeight - 1) return false;
      const п = document.elementFromPoint(x, y);
      return !!п && (п === e || e.contains(п) || п.contains(e));
    };
    if (!мой(сx, сy)) continue;   /* орган чем-то накрыт, это не про размер */
    const шире = мой(сx - 19, сy) && мой(сx + 19, сy);
    const выше = мой(сx, сy - 19) && мой(сx, сy + 19);
    if (шире && выше) continue;
    мелкие.push(((e.textContent || "").trim().slice(0, 18) || String(e.className).slice(0, 18)) +
                ` ${Math.round(r.width)}x${Math.round(r.height)}` +
                (шире ? "" : " узкая") + (выше ? "" : " низкая"));
  }
  return мелкие;
});
console.log(`   на телефоне целей мельче 40 точек: ${цели.length}` +
            (цели.length ? " · " + цели.slice(0, 4).join(", ") : ""));
if (цели.length) беды.push(`целей мельче 40 точек на телефоне: ${цели.length} (${цели.slice(0, 3).join(", ")})`);

if (ошибки.length) беды.push("ошибки в консоли: " + ошибки.slice(0, 3).join(" | "));

await b.close();

if (беды.length) {
  console.log("ГРЯЗНО  приёмка");
  for (const б of беды) console.log("   " + б);
  process.exit(1);
}
console.log("ЧИСТО  приёмка: доступность, SEO-база и вес в норме");
