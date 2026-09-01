/* Проверка: слова читаются поверх мира.

   Сайт кладёт текст прямо на живую объёмную сцену. Сцена яркая там, где
   ей положено быть яркой, и это ровно то место, где текст перестаёт
   читаться. Замер яркости этого не ловит: он говорит, что в кадре есть
   свет, и радуется. Свет в кадре и разборчивые буквы - разные вещи.

   КАК МЕРЯЕТСЯ. Честно, по стандарту: отношение яркостей краски текста и
   фона под ним. Фон берётся не из холста мира (он лежит ПОД притемнением
   и под всеми слоями, и его яркость завышена), а со снимка страницы, с
   которого этот текст на кадр убран. Два снимка одного и того же места:
   с текстом и без. Разница между ними и есть фон.

   Фон берём не средний, а СВЕТЛЫЙ: буква тонет не в средней яркости, а в
   том ярком пятне, на которое попала. Берём девяностую долю.

   ПОРОГИ ПО СТАНДАРТУ. Обычный текст 4.5, крупный (от 24 точек, либо от
   19 полужирного) - 3.0. Ниже - написано, но не читается.

   Запуск: RV_URL=http://127.0.0.1:8170 node tools/checks/контраст.mjs
*/
import { браузер, открыть, кАкту, доложить } from "./общее.mjs";

const ТЕЛЕФОН = { имя: "телефон", vp: { width: 390, height: 844 }, dpr: 2, mob: true };
const ПК = { имя: "ПК", vp: { width: 1440, height: 900 }, dpr: 1, mob: false };

const МЕСТА = [
  ["видно", 0.02], ["периметр", 0.5], ["оболочка", 0.5],
  ["прокол", 0.2], ["прокол", 0.62], ["выход", 0.2], ["выход", 0.55],
  ["рубка", 0.2], ["рубка", 0.85], ["стыковка", 0.5]
];

const беды = [];
const б = await браузер();
/* Отдельная страница только под разбор снимков. Объявлена ЗДЕСЬ, а не
   рядом со своей функцией: объявления через let не поднимаются, и вызов
   из цикла выше падал на «нельзя обратиться до объявления». */
let страницаРазбора = null;

/* Яркость по стандарту: линеаризованные каналы со своими весами. */
function яркость(r, g2, b) {
  const л = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * л(r) + 0.7152 * л(g2) + 0.0722 * л(b);
}
function отношение(я1, я2) {
  const a = Math.max(я1, я2), b2 = Math.min(я1, я2);
  return (a + 0.05) / (b2 + 0.05);
}

for (const э of [ПК, ТЕЛЕФОН]) {
  const { pg, ошибки } = await открыть(б, э, {});
  for (const [акт, д] of МЕСТА) {
    await кАкту(pg, акт, д);

    /* Что меряем: видимые куски текста этого акта. Прозрачные и
       спрятанные не берём - их на экране нет. */
    const цели = await pg.evaluate(([акт]) => {
      const а = document.querySelector(`[data-акт="${акт}"]`);
      if (!а) return [];
      const из = [];
      const узлы = а.querySelectorAll(".rv-слой .rv-над, .rv-слой .rv-заг, " +
        ".rv-слой .rv-абз, .rv-слой .rv-сноска, .rv-слой b, .rv-слой span, .rv-слой u");
      for (const у of узлы) {
        const с = getComputedStyle(у);
        if (с.display === "none" || с.visibility === "hidden") continue;
        if (parseFloat(с.opacity) < 0.9) continue;
        const r = у.getBoundingClientRect();
        if (r.width < 20 || r.height < 8) continue;
        if (r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
        if (!(у.textContent || "").trim()) continue;
        /* Прозрачность слоя-родителя умножается на краску: слой в
           середине акта непрозрачен, но проверка обязана это учесть. */
        let о = 1, п = у;
        while (п && п !== document.body) { о *= parseFloat(getComputedStyle(п).opacity); п = п.parentElement; }
        if (о < 0.9) continue;
        из.push({
          метка: у.className || у.tagName.toLowerCase(),
          текст: (у.textContent || "").trim().slice(0, 28),
          краска: с.color,
          кегль: parseFloat(с.fontSize),
          жирно: parseInt(с.fontWeight, 10) >= 600,
          x: Math.round(r.left), y: Math.round(r.top),
          w: Math.round(r.width), h: Math.round(r.height)
        });
      }
      return из;
    }, [акт]);

    if (!цели.length) continue;

    /* Фон под буквами. Гасим ТОЛЬКО БУКВЫ, краской, а не слой целиком.

       Сначала было написано «спрятать слой» - и это врало. Скрытие
       слоя убирает вместе с ним ЕГО ПОДЛОЖКУ (она нарисована
       псевдоэлементом самого слоя) и все плиты карточек. Проверка
       меряла голый мир и объявляла нечитаемым текст, который на экране
       лежит на притемнении и читается. Правки подложки при этом ничего
       не меняли в замере - вот по этому и стало понятно, что врёт
       проверка, а не сайт.

       Теперь на кадре остаётся всё, кроме глифов: подложка, плиты,
       кромки. Это и есть фон, на котором лежат буквы. Тень под буквами
       гасим тоже - она принадлежит тексту, а не фону. */
    const стиль = "rv-мерим-фон";
    await pg.evaluate(([акт, кл]) => {
      const а = document.querySelector(`[data-акт="${акт}"]`);
      if (!а) return;
      let s = document.getElementById(кл);
      if (!s) {
        s = document.createElement("style");
        s.id = кл;
        document.head.appendChild(s);
      }
      s.textContent = `[data-акт="${акт}"] .rv-слой, [data-акт="${акт}"] .rv-слой * ` +
        `{ color: transparent !important; text-shadow: none !important; }`;
    }, [акт, стиль]);
    await pg.waitForTimeout(220);
    const фон = await pg.screenshot({ type: "png" });
    await pg.evaluate(([кл]) => {
      const s = document.getElementById(кл);
      if (s) s.textContent = "";
    }, [стиль]);

    const пикс = await разобрать(фон);
    for (const ц of цели) {
      const порог = (ц.кегль >= 24 || (ц.кегль >= 19 && ц.жирно)) ? 3.0 : 4.5;
      const я = светлыйФон(пикс, ц, э.dpr);
      if (я == null) continue;
      const кр = разбор(ц.краска);
      if (!кр) continue;
      const о = отношение(яркость(кр[0], кр[1], кр[2]), я);
      if (о < порог) {
        беды.push(`${э.имя}/${акт}@${д} «${ц.текст}»: контраст ${о.toFixed(2)} ` +
                  `при пороге ${порог} (кегль ${ц.кегль})`);
      }
    }
  }
  await pg.close();
  for (const о of ошибки) беды.push(`${э.имя}: ${о}`);
  console.log("пройден " + э.имя);
}

/* Разбор PNG без сторонних пакетов: снимок отдаём браузеру обратно и
   читаем его холстом. Тащить в проект разбор PNG ради одной проверки
   дороже, чем один лишний заход в браузер. */
async function разобрать(буфер) {
  const pg = await страницаДляРазбора();
  return pg.evaluate(async (б64) => {
    const и = new Image();
    await new Promise((г, п) => { и.onload = г; и.onerror = п; и.src = "data:image/png;base64," + б64; });
    const c = document.createElement("canvas");
    c.width = и.naturalWidth; c.height = и.naturalHeight;
    const x = c.getContext("2d");
    x.drawImage(и, 0, 0);
    const d0 = x.getImageData(0, 0, c.width, c.height);
    return { w: c.width, h: c.height, data: Array.from(d0.data) };
  }, буфер.toString("base64"));
}

async function страницаДляРазбора() {
  if (!страницаРазбора) страницаРазбора = await б.newPage();
  return страницаРазбора;
}

/* Светлая доля фона под строкой. Девяностая: буква тонет не в средней
   яркости прямоугольника, а в самом ярком месте, на которое попала. */
function светлыйФон(п, ц, dpr) {
  const x0 = Math.max(0, Math.round(ц.x * dpr)), y0 = Math.max(0, Math.round(ц.y * dpr));
  const x1 = Math.min(п.w, Math.round((ц.x + ц.w) * dpr));
  const y1 = Math.min(п.h, Math.round((ц.y + ц.h) * dpr));
  if (x1 <= x0 || y1 <= y0) return null;
  const я = [];
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * п.w + x) * 4;
      я.push(яркость(п.data[i], п.data[i + 1], п.data[i + 2]));
    }
  }
  if (!я.length) return null;
  я.sort((a, b2) => a - b2);
  return я[Math.floor(я.length * 0.90)];
}

function разбор(цвет) {
  const м = String(цвет).match(/rgba?\(([^)]+)\)/);
  if (!м) return null;
  const ч = м[1].split(",").map((v) => parseFloat(v));
  return [ч[0], ч[1], ч[2]];
}

await б.close();
доложить("контраст: слова читаются поверх мира", беды);
