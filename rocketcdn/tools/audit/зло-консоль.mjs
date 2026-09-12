import { браузер } from "./общее.mjs";
const b = await браузер();
const СТРАНИЦЫ = ["app.html", "admin.html", "splash.html", "splash-lk.html", "offer.html", "privacy.html"];
for (const путь of СТРАНИЦЫ) {
  const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const беды = [];
  pg.on("pageerror", (e) => беды.push("JS: " + e.message.slice(0, 200)));
  pg.on("console", (m) => { if (m.type() === "error") беды.push("КОНС: " + m.text().slice(0, 200)); });
  pg.on("response", (r) => { if (r.status() >= 400) беды.push(r.status() + " " + r.url().slice(-70)); });
  pg.on("requestfailed", (r) => беды.push("СОРВАЛСЯ " + r.url().slice(-70)));
  try {
    await pg.goto("http://127.0.0.1:8123/" + путь, { waitUntil: "domcontentloaded", timeout: 30000 });
    await pg.waitForTimeout(3500);
  } catch (e) { беды.push("НАВИГАЦИЯ: " + e.message.slice(0, 150)); }
  console.log("== " + путь + " ==");
  if (беды.length) беды.forEach(x => console.log("  " + x)); else console.log("  чисто");
  await pg.close();
}
await b.close();
