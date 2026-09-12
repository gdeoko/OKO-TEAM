/* НИ ОДНА НАДПИСЬ НЕ ЛЕЖИТ НА ДРУГОЙ. СЧИТАЕТСЯ ЧИСЛОМ, НЕ ГЛАЗОМ.

   ЗАЧЕМ. Владелец прислал снимок стены, и на нём три подписи глыб лежат
   друг на друге и на абзаце: «Никто не читает» поверх абзаца,
   «Сайт открывается целиком» поверх ледяной плиты, «Держит на белых
   списках» поверх кладки. Его слово: «Отскринить весь сайт тебе надо
   каждый миллиметр и посмотреть самой чтобы нигде не было наложений».

   Мерок на текст было две, и обе смотрели в сторону. `подписи-и-глыбы`
   считает, какая доля СТРОКИ накрыта льдом, - она не знает про вторую
   строку. `контраст` считает читаемость по яркости - он не знает, что
   строка стоит на другой строке. Пара надписей, наложенных друг на
   друга, обе проверки проходит зелёными.

   ЧТО ДЕЛАЕТ ЭТА. Собирает экранные рамки ВСЕГО текста в кадре - и
   объёмного (меши поля расстояний, rv-msdf.js), и разметочного (кнопки,
   карточки, колонки) - и печатает каждую пару, чьи рамки пересекаются.

   Рамка объёмной строки берётся по коробке её геометрии, то есть
   охватывает все строки одного блока целиком. Это НАМЕРЕННО грубо:
   заголовок, наехавший на абзац, ловится именно так, а разбор по
   отдельным буквам дал бы зелёное там, где человек видит кашу.

   Погашенные надписи не считаются. Поле расстояний гасит текст
   прозрачностью, а не видимостью узла, поэтому спрашиваем состояние
   показа (`userData.показ`), а не `visible`: иначе в список попадёт
   текст соседнего раздела, которого в кадре нет.

   Запуск: node tools/наложения.mjs [пк|тел] [акт] [доля[,доля...]]
           node tools/наложения.mjs пк все            все акты по пяти долям */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const АКТ = process.argv[3] || "все";
const ДОЛИ = (process.argv[4] || "0.08,0.30,0.50,0.72,0.92").split(",").map(Number);
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

/* Пересечение меньше этого по КАЖДОЙ стороне не считаем наложением:
   сглаживание поля расстояний даёт рамке запас в несколько точек, и
   строки, стоящие вплотную одна под другой, иначе краснели бы всегда.
   Четыре точки это меньше половины межстрочного пробела на телефоне. */
const ЗАПАС = 4;

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: экран, deviceScaleFactor: 1,
  isMobile: КТО === "тел", hasTouch: КТО === "тел"
});
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(3000);

const акты = АКТ === "все"
  ? await стр.evaluate(() => Array.from(document.querySelectorAll(".rv-акт[data-акт]"))
      .map((с) => с.getAttribute("data-акт")))
  : [АКТ];

await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  const T = W.T;
  /* Экранная рамка тела по коробке его геометрии. Считаем по восьми
     углам: у повёрнутой надписи проекция центра ничего не говорит о
     том, куда попали её края. */
  function рамкаТела(о) {
    if (!о.geometry) return null;
    if (!о.geometry.boundingBox) о.geometry.computeBoundingBox();
    const бб = о.geometry.boundingBox;
    if (!бб) return null;
    о.updateMatrixWorld(true);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, взяли = 0;
    for (let i = 0; i < 8; i++) {
      const т = new T.Vector3(
        (i & 1) ? бб.max.x : бб.min.x,
        (i & 2) ? бб.max.y : бб.min.y,
        (i & 4) ? бб.max.z : бб.min.z
      ).applyMatrix4(о.matrixWorld);
      const вид = т.clone().applyMatrix4(W.cam.matrixWorldInverse);
      if (вид.z > -0.01) continue;         /* за спиной камеры */
      т.project(W.cam);
      взяли++;
      const эx = (т.x * 0.5 + 0.5) * window.innerWidth;
      const эy = (0.5 - т.y * 0.5) * window.innerHeight;
      if (эx < x0) x0 = эx; if (эx > x1) x1 = эx;
      if (эy < y0) y0 = эy; if (эy > y1) y1 = эy;
    }
    if (взяли < 4) return null;
    return { x0: x0, y0: y0, x1: x1, y1: y1 };
  }

  window.__текстВКадре = function () {
    const из = [];
    /* Объёмный текст. */
    W.scene.traverse(function (о) {
      if (!о.isMesh || !о.userData || !о.userData["текст"]) return;
      let p = о, видно = true;
      while (p) { if (!p.visible) { видно = false; break; } p = p.parent; }
      if (!видно) return;
      /* Погашенный текст в кадре не участвует. Поле расстояний ведёт
         показ двумя числами и гасит прозрачностью, поэтому спрашиваем
         их, а не `visible`. */
      const п = о.userData["показ"];
      if (п && !(п.пок1 > 0.02 || п.пок2 > 0.02)) return;
      const р = рамкаТела(о);
      if (!р) return;
      if (р.x1 < 0 || р.y1 < 0 || р.x0 > window.innerWidth || р.y0 > window.innerHeight) return;
      из.push({
        вид: "объём",
        имя: String(о.userData["текст"]).replace(/\s+/g, " ").trim().slice(0, 58),
        группа: (о.userData["группа"] == null ? "" : String(о.userData["группа"])),
        путь: (function () { const ч = []; let q = о; while (q && ч.length < 3) { ч.unshift(q.name || q.type); q = q.parent; } return ч.join("/"); })(),
        x0: Math.round(р.x0), y0: Math.round(р.y0), x1: Math.round(р.x1), y1: Math.round(р.y1)
      });
    });
    /* Разметочный текст: кнопки и колонки. Берём только то, что видно и
       несёт буквы; обёртки без своего текста пропускаем, иначе каждая
       будет «накладываться» на своего же ребёнка. */
    const узлы = document.querySelectorAll(
      ".rv-кн, .rv-дело a, .rv-визитка b, .rv-визитка i, .rv-манифест p, .rv-вход span");
    узлы.forEach(function (у) {
      const ст = getComputedStyle(у);
      if (ст.display === "none" || ст.visibility === "hidden" || +ст.opacity < 0.05) return;
      const р = у.getBoundingClientRect();
      if (р.width < 2 || р.height < 2) return;
      if (р.bottom < 0 || р.right < 0 || р.top > window.innerHeight || р.left > window.innerWidth) return;
      const т = (у.textContent || "").replace(/\s+/g, " ").trim();
      if (!т) return;
      из.push({
        вид: "разметка", имя: т.slice(0, 58), группа: "", путь: у.className || у.tagName,
        x0: Math.round(р.left), y0: Math.round(р.top), x1: Math.round(р.right), y1: Math.round(р.bottom)
      });
    });
    return из;
  };
});

function перекрытие(а, б) {
  const ш = Math.min(а.x1, б.x1) - Math.max(а.x0, б.x0);
  const в = Math.min(а.y1, б.y1) - Math.max(а.y0, б.y0);
  if (ш <= ЗАПАС || в <= ЗАПАС) return null;
  return { ш: Math.round(ш), в: Math.round(в) };
}

console.log(`НАЛОЖЕНИЯ ТЕКСТА ${КТО} ${экран.width}x${экран.height}, запас ${ЗАПАС} точек`);
let грязно = 0;
for (const акт of акты) {
  for (const д of ДОЛИ) {
    const ок = await стр.evaluate(([а, дд]) => {
      try { window.RV_MOTION["кПунктy"](а, дд); return true; } catch (e) { return false; }
    }, [акт, д]);
    if (!ок) { console.log(`  ${акт} ${д}: к этой доле не встать`); continue; }
    await стр.waitForTimeout(2600);
    const тела = await стр.evaluate(() => window.__текстВКадре());
    const пары = [];
    for (let i = 0; i < тела.length; i++) {
      for (let j = i + 1; j < тела.length; j++) {
        /* Один и тот же блок в нескольких строках даёт один меш, но
           разделы акта живут отдельными мешами с номером группы, и
           разные группы В КАДРЕ НЕ БЫВАЮТ ОДНОВРЕМЕННО - если бывают,
           это и есть наложение, поэтому номер группы не исключаем. */
        const п = перекрытие(тела[i], тела[j]);
        if (п) пары.push([тела[i], тела[j], п]);
      }
    }
    if (!пары.length) { console.log(`  ${акт} ${д}: чисто (надписей в кадре ${тела.length})`); continue; }
    грязно += пары.length;
    console.log(`  ${акт} ${д}: НАЛОЖЕНИЙ ${пары.length} (надписей ${тела.length})`);
    for (const [а, б, п] of пары) {
      console.log(`      ${п.ш}x${п.в} точек:`);
      console.log(`        ${а.вид.padEnd(9)} [${а.x0},${а.y0}..${а.x1},${а.y1}] «${а.имя}»`);
      console.log(`        ${б.вид.padEnd(9)} [${б.x0},${б.y0}..${б.x1},${б.y1}] «${б.имя}»`);
    }
  }
}
await бр.close();
console.log(грязно ? `ГРЯЗНО  наложений всего ${грязно}` : "ЧИСТО  ни одна надпись не лежит на другой");
process.exit(грязно ? 1 : 0);
