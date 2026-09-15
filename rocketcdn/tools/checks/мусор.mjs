/* Мусорный номер рукава на входе.

   Номер приходит снаружи - из кнопки меню, из служебного хода, из
   пробоя - и однажды уже уходил в NaN: UNIVERSES[NaN] это undefined,
   а дальше по коду идут .name и .sys, и слой падал на каждом кадре.
   Проверка кормит вход всем, чем можно, и смотрит, что рукав остался
   осмысленным, а ошибок нет. */
import { браузер, вПолёт, ТЕЛЕФОН, итог } from "./общее.mjs";

const МУСОР = [NaN, -3, 99, undefined, null, "2", 1.7, "", {}, []];

const b = await браузер();
const { pg, ошибки } = await вПолёт(b, ТЕЛЕФОН);
const беды = [];

const всего = await pg.evaluate(() => window.RC_FLIGHT.state()["вселенная"] !== undefined);
if (!всего) беды.push("состояние не отдаёт номер рукава");

for (const м of МУСОР) {
  await pg.evaluate(v => { try { window.RC_FLIGHT.jump(v); } catch (e) {} }, м);
  await pg.waitForTimeout(2600);
  const u = await pg.evaluate(() => window.RC_FLIGHT.state()["вселенная"]);
  console.log("  ", "передали", JSON.stringify(м) === undefined ? "undefined" : JSON.stringify(м),
              "-> рукав", u);
  if (!(Number.isInteger(u) && u >= 0 && u <= 3)) беды.push("рукав вышел за границы: " + u);
}

await b.close();
process.exit(итог("мусор на входе", беды, ошибки));
