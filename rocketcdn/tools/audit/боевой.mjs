/* Дымовая проверка боевого сайта после выкладки: грузим, входим в
   игру, смотрим ошибки и то, что мир собрался. */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";
const b = await браузер();
for (const имя of (process.argv.slice(2).length ? process.argv.slice(2) : ["ПК", "телефон"])) {
  const э = ЭКРАНЫ[имя];
  const { pg, беды } = await страница(b, э);
  const ок = await вИгру(pg);
  await pg.waitForTimeout(6000);
  const с = await pg.evaluate(() => {
    const F = window.RC_FLIGHT;
    const s = F && F.state ? F.state() : null;
    return {
      игра: !!(s), тел: (F && F._pick) ? F._pick().всего : null,
      клавиш: document.querySelectorAll(".rcf-key").length,
      меток: document.querySelectorAll(".rch").length,
      клип: (() => { const h = document.querySelector(".rcf-holo"); return h ? getComputedStyle(h).clipPath : null; })()
    };
  });
  console.log("== " + имя + " вход:" + ок + " " + JSON.stringify(с));
  console.log("   беды: " + (беды.length ? беды.slice(0, 5).join(" | ") : "нет"));
  await pg.close();
}
await b.close();
