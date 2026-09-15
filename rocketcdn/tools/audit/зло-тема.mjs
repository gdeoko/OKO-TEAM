import { ЭКРАНЫ, браузер } from "./общее.mjs";
const b = await браузер();
const pg = await b.newPage({ viewport: ЭКРАНЫ["ПК"].vp });
// зайти на главную, переключить тему на светлую (это пишет localStorage)
await pg.goto("http://127.0.0.1:8123/?rcdbg=1", { waitUntil: "domcontentloaded" });
await pg.waitForTimeout(4000);
await pg.evaluate(() => {
  const b = document.querySelector('button.js-theme[data-theme="light"]');
  if (b) b.click();
});
await pg.waitForTimeout(500);
const ls = await pg.evaluate(() => localStorage.getItem("rc_theme"));
console.log("localStorage rc_theme после переключения на главной:", ls);

// теперь открыть privacy.html в той же вкладке (тот же localStorage, тот же origin)
await pg.goto("http://127.0.0.1:8123/privacy.html", { waitUntil: "domcontentloaded" });
await pg.waitForTimeout(600);
const info = await pg.evaluate(() => ({
  attr: document.documentElement.getAttribute("data-theme"),
  bg: getComputedStyle(document.body).backgroundColor
}));
console.log("privacy.html после перехода:", JSON.stringify(info));

await pg.goto("http://127.0.0.1:8123/offer.html", { waitUntil: "domcontentloaded" });
await pg.waitForTimeout(600);
const info2 = await pg.evaluate(() => ({
  attr: document.documentElement.getAttribute("data-theme"),
  bg: getComputedStyle(document.body).backgroundColor
}));
console.log("offer.html после перехода:", JSON.stringify(info2));

await pg.close();
await b.close();
