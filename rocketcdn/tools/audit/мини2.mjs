import { АДРЕС, браузер } from "./общее.mjs";
import { ИНСТР } from "./лаг-инстр.mjs";
const b = await браузер();
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
pg.on("crash", () => console.log("!!! СТРАНИЦА УПАЛА"));
pg.on("close", () => console.log("!!! страница закрыта"));
await pg.addInitScript(ИНСТР);
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 180000 });
console.log("goto ок");
for (let i = 0; i < 9; i++) {
  try { await pg.waitForTimeout(1000); console.log("сек", i + 1, "жив"); }
  catch (e) { console.log("умер на сек", i + 1, e.message.slice(0, 80)); break; }
}
await b.close();
