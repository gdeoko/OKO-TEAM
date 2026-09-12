import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";
const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);
await pg.evaluate(() => {
  const btn = document.querySelector('button[data-lang="en"]');
  if (btn) btn.click();
});
await pg.waitForTimeout(600);
const данные = await pg.evaluate(() => {
  const opts = [...document.querySelectorAll("#lfTopic option")].map(o => o.textContent.trim());
  const navTexts = [...document.querySelectorAll(".nav a")].map(a => a.textContent.trim());
  const drawerTexts = [...document.querySelectorAll(".drawer a")].map(a => a.textContent.trim());
  return { opts, navTexts, drawerTexts, htmlLang: document.documentElement.lang };
});
console.log(JSON.stringify(данные, null, 2));
if (беды.length) console.log("беды:", беды);
await pg.close();
await b.close();
