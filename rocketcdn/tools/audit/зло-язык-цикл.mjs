/* Открыл полёт, закрыл, сменил язык, открыл снова.
   Смотрим: живы ли метки над телами, подшит ли холст приборов,
   не удвоился ли разгон от одного нажатия стрелки. */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";
const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);

const снять = () => pg.evaluate(() => {
  const слой = document.querySelector(".rc-holo");
  const холст = document.querySelector(".rcf-instr");
  const F = window.RC_FLIGHT;
  return {
    метокВдок: document.querySelectorAll(".rch-tag").length,
    слойВдок: !!(слой && слой.isConnected),
    холстВдок: !!(холст && холст.isConnected),
    зонНажатия: document.querySelectorAll(".rcf-phys-hit").length,
    скорость: F && F.state ? +(F.state().v || 0).toFixed(5) : null
  };
});

await вИгру(pg);
await pg.waitForTimeout(9000);
console.log("первый заход:", JSON.stringify(await снять()));

await pg.evaluate(() => { if (window.RC_FLIGHT && window.RC_FLIGHT.close) window.RC_FLIGHT.close(); });
await pg.waitForTimeout(2500);
await pg.evaluate(() => { const b = document.querySelector('button[data-lang="en"]'); if (b) b.click(); });
await pg.waitForTimeout(3000);
await вИгру(pg);
await pg.waitForTimeout(11000);
console.log("после смены языка:", JSON.stringify(await снять()));

/* Одно нажатие стрелки: насколько подскочит скорость */
const до = await pg.evaluate(() => window.RC_FLIGHT.state().v || 0);
await pg.keyboard.press("ArrowDown");
await pg.waitForTimeout(700);
const после = await pg.evaluate(() => window.RC_FLIGHT.state().v || 0);
console.log("одно нажатие стрелки подняло ход на:", (после - до).toFixed(4), "(ожидается около 0.14)");
if (беды.length) console.log("беды:", беды.slice(0, 4));
await b.close();
