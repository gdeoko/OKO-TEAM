import { браузер } from "./общее.mjs";
console.log("t0", Date.now()%100000);
const b = await браузер();
console.log("браузер", Date.now()%100000);
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto("http://127.0.0.1:8123/?rcdbg=1", { waitUntil: "domcontentloaded", timeout: 120000 });
console.log("goto", Date.now()%100000);
await b.close();
