import { ПК, браузер, открыть } from "./checks/общее.mjs";
const b = await браузер();
const { pg } = await открыть(b, ПК, {});
const с = await pg.evaluate(() => performance.getEntriesByType("resource").map(р => ({
  и: decodeURIComponent(р.name.split("/").slice(3).join("/")).split("?")[0],
  кб: Math.round((р.transferSize || р.encodedBodySize || 0) / 1024)
})).sort((a, b) => b.кб - a.кб));
let s = 0; for (const x of с) s += x.кб;
for (const x of с.slice(0, 40)) console.log(String(x.кб).padStart(6), x.и);
console.log("итого", s, "КБ в", с.length, "запросах");
await b.close();
