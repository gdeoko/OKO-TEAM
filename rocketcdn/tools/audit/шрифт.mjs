/* Проверка: разрешается ли Montserrat и не виснет ли document.fonts.ready */
import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
const ЗАМЕР = () => {
  const c = document.createElement("canvas").getContext("2d");
  const w = (f) => { c.font = "700 40px " + f; return c.measureText("СПРАВКА ДАЛЬШЕ").width; };
  return {
    статус: document.fonts.status,
    размерНабора: document.fonts.size,
    семейства: [...document.fonts].map(f => f.family + ":" + f.status),
    checkMontserrat: document.fonts.check("700 16px Montserrat"),
    checkВыдумка: document.fonts.check("700 16px ZzzNetTakogoShrifta"),
    ширинаMontserrat: +w("Montserrat, system-ui, sans-serif").toFixed(2),
    ширинаВыдумка: +w("ZzzNetTakogoShrifta, system-ui, sans-serif").toFixed(2),
    ширинаSystem: +w("system-ui, sans-serif").toFixed(2),
    ширинаGolos: +w("'Golos Text', system-ui, sans-serif").toFixed(2)
  };
};
const b = await браузер();
const { pg } = await страница(b, ЭКРАНЫ["ПК"]);
const доИгры = await pg.evaluate(ЗАМЕР);
const готовДо = await pg.evaluate(() => Promise.race([
  document.fonts.ready.then(() => "готов"),
  new Promise(r => setTimeout(() => r("ВИСНЕТ"), 8000))]));
console.log("ДО ПОЛЁТА  fonts.ready:", готовДо);
console.log("ДО ПОЛЁТА ", JSON.stringify(доИгры, null, 1));
await вИгру(pg);
await pg.waitForTimeout(9000);
const вИгре = await pg.evaluate(ЗАМЕР);
const готовПосле = await pg.evaluate(() => Promise.race([
  document.fonts.ready.then(() => "готов"),
  new Promise(r => setTimeout(() => r("ВИСНЕТ"), 20000))]));
console.log("В ПОЛЁТЕ   fonts.ready:", готовПосле);
console.log("В ПОЛЁТЕ  ", JSON.stringify(вИгре, null, 1));
await pg.close(); await b.close();
