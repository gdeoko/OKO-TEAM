/* Второй заход после смены языка.

   Ловим ровно то, на что жаловался владелец: «планета не кликается»
   и «обзор залипает». Оба - следствие того, что часть состояния
   переживала пересборку мира, а часть нет. Смотрим числами: залип ли
   обзор после отпуска кнопки, остались ли в кэше вселенные от
   снесённой сцены, вернулись ли маяки сети, живы ли метки. */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";
const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);

const снять = () => pg.evaluate(() => window.RC_FLIGHT["кэши"]());
const обзорЖестом = async () => {
  await pg.mouse.move(700, 400);
  await pg.mouse.down();
  await pg.mouse.move(760, 430, { steps: 6 });
  await pg.mouse.up();
  await pg.waitForTimeout(500);
  await pg.mouse.move(500, 300, { steps: 4 });
  await pg.waitForTimeout(400);
};

await вИгру(pg);
await pg.waitForTimeout(9000);
await обзорЖестом();
const первый = await снять();
console.log("первый заход:     ", JSON.stringify(первый));

await pg.evaluate(() => window.RC_FLIGHT.close());
await pg.waitForTimeout(2200);
await pg.evaluate(() => { const b = document.querySelector('button[data-lang="en"]'); if (b) b.click(); });
await pg.waitForTimeout(3000);
await вИгру(pg);
await pg.waitForTimeout(11000);
await обзорЖестом();
const второй = await снять();
console.log("после смены языка:", JSON.stringify(второй));

if (второй.обзорЗалип) { console.log("БЕДА  отпуск кнопки не снял перетаскивание - обзор залип"); process.exitCode = 1; }
if (второй.телДляЛуча < 1) { console.log("БЕДА  тел для луча нет: клик по планете не сработает"); process.exitCode = 1; }
if (второй.меток < 1) { console.log("БЕДА  меток над телами нет"); process.exitCode = 1; }
if (второй.вселенныхВкэше > 1) { console.log("БЕДА  в кэше " + второй.вселенныхВкэше + " вселенных, часть из снесённой сцены"); process.exitCode = 1; }
if (беды.length) console.log("беды:", беды.slice(0, 4));
if (!process.exitCode) console.log("ЧИСТО  второй заход после смены языка");
await b.close();
