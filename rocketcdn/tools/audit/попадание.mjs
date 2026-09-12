/* Честная проверка попадания: проекция и луч считаются В ОДНОМ
   вызове, без единого кадра между ними. Так видно, врёт ли сама
   геометрия подбора или дело в том, что корабль летит и за полторы
   секунды ожидания цель уезжает.

   Потом - настоящий клик мышью по той же точке, СРАЗУ, без выдержки.
   Запуск: node tools/audit/попадание.mjs [экран] */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";

const имя = process.argv[2] || "ПК";
const э = ЭКРАНЫ[имя];
const b = await браузер();
const { pg, беды } = await страница(b, э);
await вИгру(pg);
await pg.waitForTimeout(4000);

for (const p of [0.05, 0.2, 0.35]) {
  await pg.evaluate((v) => { window.RC_FLIGHT._set(v); }, p);
  await pg.waitForTimeout(2500);
  /* Гасим ход: корабль стоит, цель не уезжает между замерами */
  await pg.evaluate(() => {
    const k = document.querySelector(".rcf-stop-key");
    if (k) k.click();
  });
  await pg.waitForTimeout(1200);

  const мгновенно = await pg.evaluate(() => {
    const F = window.RC_FLIGHT;
    const s = F._pick();
    const из = [];
    for (const т of s.тела) {
      if (!т.видно || т.сзади) continue;
      if (т.x < 0 || т.x > innerWidth || т.y < 0 || т.y > innerHeight) continue;
      const r = F._ray(т.x, т.y);
      из.push({ имя: т.имя, x: т.x, y: т.y, д: т.д, попал: r.попаданий,
                первый: r.первые[0] ? r.первые[0].инфо.split(" · ")[0] : "" });
    }
    return из;
  });
  console.log("\n-- доля " + p + " (проекция и луч в один вызов)");
  for (const о of мгновенно) {
    console.log("   " + (о.попал && о.первый === о.имя ? "ЛУЧ ОК " : "ЛУЧ НЕТ") +
      " " + о.имя.padEnd(22) + " xy=" + о.x + "," + о.y + " д=" + о.д +
      " попаданий=" + о.попал + " первый=" + JSON.stringify(о.первый));
  }

  /* А теперь настоящим кликом, сразу после проекции */
  for (const о of мгновенно.slice(0, 5)) {
    await pg.evaluate(() => { const d = document.querySelector(".rcf-dos"); if (d) d.classList.remove("on"); });
    const точка = await pg.evaluate((и) => {
      const s = window.RC_FLIGHT._pick();
      const т = s.тела.find((t) => t.имя === и);
      return т ? [т.x, т.y] : null;
    }, о.имя);
    if (!точка) continue;
    await pg.mouse.move(точка[0], точка[1]);
    await pg.mouse.click(точка[0], точка[1]);
    await pg.waitForTimeout(900);
    const r = await pg.evaluate(() => {
      const d = document.querySelector(".rcf-dos");
      return { открыт: !!(d && d.classList.contains("on")),
               имя: (document.querySelector(".rcf-dos-h") || {}).textContent || "" };
    });
    console.log("   КЛИК " + (r.открыт ? "ОК " : "НЕТ") + " " + о.имя.padEnd(22) +
      " досье=" + JSON.stringify(r.имя));
  }
}
console.log("\nбеды: " + JSON.stringify(беды.slice(0, 8)));
await b.close();
