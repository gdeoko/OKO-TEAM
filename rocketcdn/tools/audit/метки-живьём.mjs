/* Есть ли на экране подписи тел и не режутся ли они. */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";
const b = await браузер();
for (const имя of (process.argv.slice(2).length ? process.argv.slice(2) : ["ПК"])) {
  const э = ЭКРАНЫ[имя];
  const { pg } = await страница(b, э);
  await вИгру(pg);
  await pg.waitForTimeout(12000);
  const с = await pg.evaluate(() => {
    const карт = [...document.querySelectorAll(".rch")];
    const видимых = карт.filter((e) => !e.classList.contains("off"));
    const режет = [];
    for (const e of видимых) {
      const t = e.querySelector(".rch-tname");
      if (!t) continue;
      if (t.scrollWidth > t.clientWidth + 1) режет.push([t.textContent.trim(), t.scrollWidth, t.clientWidth]);
    }
    return { всего: карт.length, видимых: видимых.length, режет: режет,
             имена: видимых.slice(0, 8).map((e) => (e.querySelector(".rch-tname") || {}).textContent || "") };
  });
  console.log("== " + имя + " " + JSON.stringify(с));
  await pg.close();
}
await b.close();
