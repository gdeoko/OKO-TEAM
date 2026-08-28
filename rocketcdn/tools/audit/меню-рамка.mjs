/* Уголковая рамка меню обязана стоять на месте, когда список едет.

   Меряем: высоту рамки против видимой высоты панели, прокручиваемость
   внутренней коробки и то, что после прокрутки рамка не сдвинулась.
   Запуск: node tools/audit/меню-рамка.mjs [экран ...] */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";

const b = await браузер();
for (const имя of (process.argv.slice(2).length ? process.argv.slice(2) : ["узкий", "телефон", "ПК"])) {
  const э = ЭКРАНЫ[имя];
  const { pg } = await страница(b, э);
  await вИгру(pg);
  await pg.waitForTimeout(5000);
  await pg.evaluate(() => {
    const k = document.querySelector(".rcf-navkey");
    if (k) k.click();
  });
  await pg.waitForTimeout(2500);
  const с = await pg.evaluate(() => {
    const m = document.querySelector(".rcf-menu");
    const in_ = document.querySelector(".rcf-menu-in");
    if (!m || !in_) return { нет: !m ? "меню" : "внутренней коробки" };
    const пр = (el) => { const s = getComputedStyle(el, "::after"); return { h: s.height, top: s.top }; };
    const до = m.getBoundingClientRect();
    return {
      панель: [Math.round(до.width), Math.round(до.height)],
      рамка: пр(m),
      едет: in_.scrollHeight > in_.clientHeight + 1,
      нутро: [in_.clientHeight, in_.scrollHeight],
      панельЕдет: m.scrollHeight > m.clientHeight + 1
    };
  });
  /* Прокручиваем список и смотрим, стоит ли рамка */
  const после = await pg.evaluate(async () => {
    const in_ = document.querySelector(".rcf-menu-in");
    const m = document.querySelector(".rcf-menu");
    if (!in_ || !m) return null;
    in_.scrollTop = in_.scrollHeight;
    await new Promise((r) => setTimeout(r, 600));
    const s = getComputedStyle(m, "::after");
    return { сдвинули: in_.scrollTop, рамка: { h: s.height, top: s.top } };
  });
  console.log("== " + имя + " " + JSON.stringify(с) + " | после: " + JSON.stringify(после));
  await pg.close();
}
await b.close();
