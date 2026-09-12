/* Акт сцены и эпизод в кадре обязаны совпадать.

   Что ломалось. Акт выбирался по одному правилу - какая секция ближе
   к середине экрана, - а вход в салон случается по другому: корабль
   распахивает люк и вешает на документ rc-in-hatch. Правила разные,
   и на длинной секции «надёжность» они расходились: замер до правки
   дал 200 точек на мониторе и 240 на телефоне, на которых фон, звук
   и карточки уже жили салоном, а в кадре человек ещё шёл к трапу.

   Что проверяем. Прокруткой шагом в сорок точек ищем ДВЕ отметки:
   где документ впервые называет акт «cabin» и где впервые появляется
   rc-in-hatch. Разрыв между ними обязан укладываться в один шаг.

   И обратный ход: из салона наружу акт обязан вернуться. Сторож умеет
   задержать акт, и если он задержит навсегда, фильм встанет.

   Запуск: RC_URL=http://127.0.0.1:8123/ node tools/checks/акт-и-эпизод.mjs
*/
import { АДРЕС, ПК, ТЕЛЕФОН, браузер } from "./общее.mjs";

const ШАГ = 40;
const ДОПУСК = ШАГ;   /* разрыв в один шаг это точность самого замера */

const беды = [];
const b = await браузер();

for (const э of [ПК, ТЕЛЕФОН]) {
  const pg = await b.newPage({
    viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob
  });
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
  /* Миру нужно собраться: на песочнице без видеокарты это секунды. */
  await pg.waitForTimeout(7000);

  const H = await pg.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  let актНа = null, люкНа = null;

  for (let y = 0; y <= H; y += ШАГ) {
    await pg.evaluate((v) => scrollTo(0, v), y);
    await pg.waitForTimeout(70);
    const с = await pg.evaluate(() => ({
      акт: document.documentElement.getAttribute("data-act"),
      люк: document.documentElement.classList.contains("rc-in-hatch")
    }));
    if (актНа === null && с.акт === "cabin") актНа = y;
    if (люкНа === null && с.люк) люкНа = y;
    if (актНа !== null && люкНа !== null) break;
  }

  if (актНа === null) {
    беды.push(`${э.имя}: акт «салон» не наступил ни разу за всю страницу`);
  } else if (люкНа === null) {
    беды.push(`${э.имя}: люк не открылся ни разу, входа в салон нет`);
  } else {
    const разрыв = люкНа - актНа;
    console.log(`   ${э.имя.padEnd(9)} акт cabin с y=${актНа} · люк с y=${люкНа} · разрыв ${разрыв}`);
    if (разрыв > ДОПУСК) {
      беды.push(`${э.имя}: салон объявлен за ${разрыв} точек до входа в люк`);
    }
    if (разрыв < -ДОПУСК) {
      беды.push(`${э.имя}: человек вошёл в люк за ${-разрыв} точек до акта «салон»`);
    }
  }

  /* Обратный ход. Поднимаемся от точки входа наверх и ждём, что акт
     перестанет быть салоном. Не перестал у самого верха - сторож
     держит кадр навсегда, и это хуже прежнего разрыва. */
  if (актНа !== null) {
    let вышел = null;
    for (let y = Math.min(H, актНа + 600); y >= 0; y -= ШАГ * 2) {
      await pg.evaluate((v) => scrollTo(0, v), y);
      await pg.waitForTimeout(70);
      const а = await pg.evaluate(() => document.documentElement.getAttribute("data-act"));
      if (а !== "cabin") { вышел = y; break; }
    }
    if (вышел === null) беды.push(`${э.имя}: из салона не выйти прокруткой вверх, акт застрял`);
    else console.log(`   ${э.имя.padEnd(9)} обратный ход: салон отпустил кадр на y=${вышел}`);
  }

  await pg.close();
}

await b.close();

if (беды.length) {
  console.log("ГРЯЗНО  акт и эпизод");
  for (const б of беды) console.log("   " + б);
  process.exit(1);
}
console.log("ЧИСТО  акт сцены совпадает с эпизодом в кадре");
