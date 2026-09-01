/* Проверка: всё помещается и ничего не пусто - на любом экране.

   Три беды, которые видно глазами и почти не видно по коду:
     1. текст вылезает за свою коробку или за кромку экрана;
     2. кадр пустой: акт есть, а смотреть в нём нечего;
     3. содержимое налезает друг на друга или уезжает под кромку.

   Проверка обходит СЕМЬ размеров экрана - от узкого телефона до
   широкого монитора - и в каждом проходит все акты по трём долям хода.
   Числа берутся из живого дерева: прямоугольники элементов, их
   прокрутка и видимая площадь. Впечатление тут не участвует.

   Запуск:
     RV_URL=http://127.0.0.1:8170 node tools/checks/посадка.mjs
     RV_ONE=узкий node tools/checks/посадка.mjs   # только один размер
*/
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { браузер, открыть, кАкту, доложить } from "./общее.mjs";

const КУДА = (process.env.RV_СНИМКИ || join(tmpdir(), "rv-посадка")) + "/";
mkdirSync(КУДА, { recursive: true });

/* Ряд намеренно кончается на 360: это не «редкий случай», а половина
   живых телефонов в России. И начинается на 1920: широкий монитор ломает
   вёрстку не реже узкого телефона, только в другую сторону. */
const ЭКРАНЫ = [
  { имя: "узкий",    vp: { width: 360, height: 640 }, dpr: 3, mob: true },
  { имя: "телефон",  vp: { width: 412, height: 915 }, dpr: 2, mob: true },
  { имя: "крупный",  vp: { width: 430, height: 932 }, dpr: 3, mob: true },
  { имя: "планшет",  vp: { width: 768, height: 1024 }, dpr: 2, mob: true },
  { имя: "альбом",   vp: { width: 1024, height: 600 }, dpr: 2, mob: true },
  { имя: "ноутбук",  vp: { width: 1440, height: 900 }, dpr: 1, mob: false },
  { имя: "монитор",  vp: { width: 1920, height: 1080 }, dpr: 1, mob: false }
];

const АКТЫ = ["видно", "периметр", "оболочка", "прокол", "выход", "рубка", "стыковка"];
const ДОЛИ = [0.15, 0.5, 0.85];

const беды = [];
const б = await браузер();

function вид0(э) { return э.vp.height; }

/* Яркость общего холста мира. Два кадра запаса, а не один: первый может
   прийтись на кадр, в котором ядро ещё не рисовало, и буфер окажется
   пуст не потому, что сцена чёрная. */
async function свет(pg) {
  return pg.evaluate(() => new Promise((готово) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = document.getElementById("rvМир");
      if (!c) return готово(null);
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      if (!gl) return готово(null);
      const ш = gl.drawingBufferWidth, в = gl.drawingBufferHeight;
      const бук = new Uint8Array(ш * в * 4);
      gl.readPixels(0, 0, ш, в, gl.RGBA, gl.UNSIGNED_BYTE, бук);
      let s = 0, n = 0, mx = 0;
      for (let i = 0; i < бук.length; i += 4 * 37) {
        const v = (бук[i] + бук[i + 1] + бук[i + 2]) / 3 * (бук[i + 3] / 255);
        s += v; if (v > mx) mx = v; n++;
      }
      готово({ средняя: Math.round(s / n * 100) / 100, макс: Math.round(mx) });
    }));
  }));
}
const только = process.env.RV_ONE;

/* Один замер: что происходит в кадре прямо сейчас. Всё считается в
   браузере одним заходом, потому что каждый переход туда-обратно это
   кадр, за который мир успевает сдвинуться. */
async function замер(pg) {
  return pg.evaluate(() => {
    const вид = { ш: innerWidth, в: innerHeight };
    const идёт = document.querySelector(".rv-акт.rv-идёт") ||
                 [...document.querySelectorAll(".rv-акт")].find((э) => {
                   const r = э.getBoundingClientRect();
                   return r.top <= вид.в * 0.5 && r.bottom >= вид.в * 0.5;
                 });
    if (!идёт) return { нет: true };
    const имя = идёт.getAttribute("data-акт");
    const кадр = идёт.querySelector(".rv-кадр");
    const кр = кадр ? кадр.getBoundingClientRect() : идёт.getBoundingClientRect();

    const вылезло = [];
    const обрезано = [];
    const мелко = [];
    let видимых = 0, площадь = 0;

    const слой = идёт.querySelector(".rv-слой");
    const узлы = слой ? [...слой.querySelectorAll("*")] : [];
    for (const э of узлы) {
      const с = getComputedStyle(э);
      if (с.display === "none" || с.visibility === "hidden") continue;
      const о = parseFloat(с.opacity);
      const r = э.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const виден = о > 0.05;
      if (виден) { видимых++; площадь += r.width * r.height; }
      const метка = э.tagName.toLowerCase() +
        (э.id ? "#" + э.id : "") +
        (э.className && typeof э.className === "string"
          ? "." + э.className.trim().split(/\s+/).slice(0, 2).join(".") : "");

      /* 1. За кромку экрана. Полупрозрачное на входе не считаем: оно
         законно сдвинуто и вот-вот встанет на место. */
      if (виден && о > 0.6) {
        if (r.left < -1 || r.right > вид.ш + 1) {
          вылезло.push(`${метка} по ширине ${Math.round(r.left)}..${Math.round(r.right)} при ${вид.ш}`);
        }
      }
      /* 2. Текст не помещается в свою коробку. Смотрим только на те,
         кому обрезка запрещена: скрытая прокрутка это и есть срез. */
      const прокр = с.overflow + с.overflowY + с.overflowX;
      if (виден && прокр.indexOf("visible") < 0 && э.scrollHeight > э.clientHeight + 3 && э.clientHeight > 0) {
        обрезано.push(`${метка} текст ${э.scrollHeight} в коробке ${э.clientHeight}`);
      }
      /* 3. Слишком мелкий шрифт: ниже 12 пикселей на телефоне читать
         нечем. */
      if (виден && э.childElementCount === 0 && (э.textContent || "").trim().length > 3) {
        const кегль = parseFloat(с.fontSize);
        if (кегль < 11.5) мелко.push(`${метка} кегль ${кегль.toFixed(1)}`);
      }
    }

    /* 4. Слова не должны уезжать под кромку окна.

       Меряем не коробку слоя (она равна кадру всегда и ничего не
       говорит), а СОДЕРЖИМОЕ: объединённый прямоугольник видимых
       детей. И только когда кадр стоит в окне: у актов ростом в один
       экран липкости нет вовсе, кадр законно уезжает вместе с
       прокруткой, и придираться там не к чему. */
    let уехал = null;
    const кадрВОкне = кр.top <= 2 && кр.bottom >= вид.в - 2;
    if (слой && кадрВОкне) {
      let верх = Infinity, низ = -Infinity, есть = false;
      for (const д of слой.children) {
        const с2 = getComputedStyle(д);
        if (с2.display === "none" || с2.visibility === "hidden") continue;
        if (parseFloat(с2.opacity) < 0.6) continue;
        const r = д.getBoundingClientRect();
        if (r.height < 1) continue;
        есть = true;
        if (r.top < верх) верх = r.top;
        if (r.bottom > низ) низ = r.bottom;
      }
      if (есть && (верх < -2 || низ > вид.в + 2)) {
        уехал = `слова ${Math.round(верх)}..${Math.round(низ)} при высоте окна ${вид.в}`;
      }
      /* Пустота снизу. Слова прижаты к верху, а нижняя половина кадра
         не занята ничем: экран читается недоделанным. Меряем только
         на середине акта, когда всё уже проявилось. */
      if (есть) {
        var подСловами = вид.в - низ;
        var надСловами = верх;
      }
    }

    /* 5. Пустой кадр: нечего смотреть ни в разметке, ни в холсте. */
    const холст = идёт.querySelector(".rv-холст");
    return {
      имя, видимых,
      доляПлощади: Math.round(площадь / (вид.ш * вид.в) * 1000) / 1000,
      вылезло, обрезано, мелко, уехал,
      надСловами: typeof надСловами === "number" ? Math.round(надСловами) : null,
      подСловами: typeof подСловами === "number" ? Math.round(подСловами) : null,
      холстЕсть: !!холст,
      ширинаДок: document.documentElement.scrollWidth,
      ширинаВид: вид.ш
    };
  });
}

for (const э of ЭКРАНЫ) {
  if (только && э.имя !== только) continue;
  const { pg, ошибки } = await открыть(б, э, {});

  /* Горизонтальная прокрутка страницы целиком. Она либо есть, либо нет,
     и если есть - это всегда беда: сайт вертикальный. */
  const шир = await pg.evaluate(() => ({
    док: document.documentElement.scrollWidth,
    тело: document.body.scrollWidth,
    вид: innerWidth
  }));
  if (шир.док > шир.вид + 1) {
    беды.push(`${э.имя}: страница шире экрана (${шир.док} при ${шир.вид}) - есть боковая прокрутка`);
  }

  for (const акт of АКТЫ) {
    for (const д of ДОЛИ) {
      await кАкту(pg, акт, д);
      const з = await замер(pg);
      if (з.нет) { беды.push(`${э.имя}/${акт}@${д}: акт не встал в кадр`); continue; }
      const где = `${э.имя}/${акт}@${д}`;
      for (const в of з.вылезло) беды.push(`${где}: вылезло за экран - ${в}`);
      for (const о of з.обрезано) беды.push(`${где}: обрезан текст - ${о}`);
      for (const м of з.мелко) беды.push(`${где}: мелкий шрифт - ${м}`);
      if (з.уехал) беды.push(`${где}: ${з.уехал}`);
      /* Пусто - это когда на середине акта смотреть НЕЧЕГО. Считать
         узлы разметки для этого мало: половина актов сайта показывает
         объёмную сцену, а слова в них уведены намеренно (в «Рубке»
         кадр в середине принадлежит щиту целиком). Такой акт по узлам
         пуст, а на экране полон.

         Поэтому при малом числе узлов смотрим ЯРКОСТЬ общего холста
         мира. Читаем буфер рисования в том же кадре, в котором ядро
         его нарисовало: через drawImage нельзя, у холста не хранится
         буфер, и копия выходит пустой всегда. */
      if (д === 0.5 && з.видимых < 2 && !з.холстЕсть) {
        const ярко = await свет(pg);
        if (!ярко || ярко.средняя < 0.6 || ярко.макс < 60) {
          беды.push(`${где}: пустой экран - узлов ${з.видимых}, ` +
            `мир ${ярко ? "средняя " + ярко.средняя + ", макс " + ярко.макс : "не прочитан"}`);
        }
      }
      /* Перекос по вертикали: слова жмутся к одному краю, у другого
         пустует больше трети экрана. Кино так кадр не строит. */
      if (д === 0.5 && з.подСловами !== null) {
        const перекос = Math.abs(з.подСловами - з.надСловами);
        if (перекос > вид0(э) * 0.34) {
          беды.push(`${где}: слова прижаты к краю - сверху ${з.надСловами}, снизу ${з.подСловами}`);
        }
      }
      if (д === 0.5) {
        await pg.screenshot({ path: `${КУДА}${э.имя}-${акт}.png` });
      }
    }
  }

  /* Подвал: он не акт, но у него та же беда с шириной. */
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pg.waitForTimeout(900);
  const подвал = await pg.evaluate(() => {
    const п = document.querySelector(".rv-подвал");
    if (!п) return { нет: true };
    const беды = [];
    for (const э of п.querySelectorAll("*")) {
      const r = э.getBoundingClientRect();
      if (r.width < 1) continue;
      if (r.left < -1 || r.right > innerWidth + 1) {
        беды.push(э.tagName.toLowerCase() + "." + String(э.className).slice(0, 24) +
                  ` ${Math.round(r.left)}..${Math.round(r.right)} при ${innerWidth}`);
      }
    }
    return { беды, высота: Math.round(п.getBoundingClientRect().height) };
  });
  if (подвал.нет) беды.push(`${э.имя}: подвала нет вовсе`);
  else for (const б2 of подвал.беды) беды.push(`${э.имя}/подвал: вылезло - ${б2}`);
  await pg.screenshot({ path: `${КУДА}${э.имя}-подвал.png` });

  await pg.close();
  for (const о of ошибки) беды.push(`${э.имя}: ${о}`);
  console.log("пройден " + э.имя);
}

await б.close();
console.log("снимки: " + КУДА);
доложить("посадка: всё помещается и ничего не пусто", беды);
