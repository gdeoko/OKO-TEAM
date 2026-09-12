import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
const b = await браузер();
const { pg } = await страница(b, ЭКРАНЫ["ПК"]);
await вИгру(pg);
await pg.waitForTimeout(7000);
const d = await pg.evaluate(() => {
  const вид = RC_DECK["какой"](innerWidth, innerHeight);
  const план = RC_CAB_DECK[вид];
  const cv = document.querySelector(".rcf-instr");
  return {
    вид, полос: план["полосы"].length,
    местВПолосах: план["полосы"].map(p => p["мест"]),
    ключиВПолосах: план["полосы"].map(p => p["ключи"] === undefined ? "нет" : p["ключи"]),
    KEYSдлина: RC_KEYS.KEYS.length,
    KEYSимена: RC_KEYS.KEYS.map(k => k["имя"]),
    холст: cv ? [cv.width, cv.height, getComputedStyle(cv).display, getComputedStyle(cv).mixBlendMode] : null,
    последняяПолоса: план["полосы"][план["полосы"].length-1]["угол"],
    предпоследняя: план["полосы"][план["полосы"].length-2]["угол"]
  };
});
console.log(JSON.stringify(d, null, 1));
await pg.close(); await b.close();
