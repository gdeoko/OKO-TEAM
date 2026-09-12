/* Есть ли на экране подписи тел и не режутся ли они. */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";
const b = await браузер();
for (const имя of (process.argv.slice(2).length ? process.argv.slice(2) : ["ПК"])) {
  const э = ЭКРАНЫ[имя];
  const { pg } = await страница(b, э);
  await вИгру(pg);
  await pg.waitForTimeout(12000);
  const с = await pg.evaluate(() => {
    const карт = [...document.querySelectorAll(".rch-tag")];
    const видимых = карт.filter((e) => !e.classList.contains("off"));
    const режет = [];
    for (const e of видимых) {
      const t = e.querySelector(".rch-tname");
      if (!t) continue;
      /* Меряем ПО СТРОКАМ настоящего текста, а не по scrollWidth:
         в scrollWidth попадают цветные двойники заголовка, они лежат
         абсолютом поверх и раньше не переносились - число выходило
         про них, а не про подпись. */
      var стр = t.getClientRects().length;
      var кор = t.getBoundingClientRect();
      var влез = стр > 0 && стр <= 2;
      if (!влез) режет.push([t.textContent.trim(), "строк:" + стр, Math.round(кор.width)]);
    }
    return { всего: карт.length, видимых: видимых.length, режет: режет,
             имена: видимых.slice(0, 8).map((e) => (e.querySelector(".rch-tname") || {}).textContent || "") };
  });
  console.log("== " + имя + " " + JSON.stringify(с));
  await pg.close();
}
await b.close();
