import { ЭКРАНЫ, браузер, страница, обрезки, наложения } from "./общее.mjs";
const b = await браузер();
for (const имя of Object.keys(ЭКРАНЫ)) {
  const { pg, беды } = await страница(b, ЭКРАНЫ[имя]);
  // отрезать секции игры/финала от проверки: работаем только по секциям вне #flight-игры.
  const о = await обрезки(pg, "main");
  const н = await наложения(pg, [".nav a",".btn",".card",".viz-card",".sec-h",".sec-p","h1","h2","h3","p","label","input","select","textarea",".field",".chip",".kpi-n",".faq-q",".case-card"], ["wrap","hs-track","hs-view"]);
  console.log("== " + имя + " " + JSON.stringify(ЭКРАНЫ[имя].vp) + " ==");
  if (беды.length) console.log("  беды:", беды.slice(0,6));
  if (о.length) { console.log("  ОБРЕЗКИ:"); о.forEach(x=>console.log("    "+JSON.stringify(x))); } else console.log("  обрезок нет");
  if (н.length) { console.log("  НАЛОЖЕНИЯ:"); н.slice(0,10).forEach(x=>console.log("    "+JSON.stringify(x))); } else console.log("  наложений нет");
  await pg.close();
}
await b.close();
