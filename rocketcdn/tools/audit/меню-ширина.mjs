/* Кто именно шире коробки внутри меню. Печатает ширины самой коробки
   и каждого ребёнка, чтобы не гадать. */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";
const b = await браузер();
for (const имя of (process.argv.slice(2).length ? process.argv.slice(2) : ["телефон"])) {
  const э = ЭКРАНЫ[имя];
  const { pg } = await страница(b, э);
  await вИгру(pg);
  await pg.waitForTimeout(5000);
  await pg.evaluate(() => { const k = document.querySelector(".rcf-navkey"); if (k) k.click(); });
  await pg.waitForTimeout(2500);
  const с = await pg.evaluate(() => {
    const in_ = document.querySelector(".rcf-menu-in");
    const m = document.querySelector(".rcf-menu");
    if (!in_) return { нет: true };
    const cs = getComputedStyle(in_);
    const дети = [...in_.children].map((e) => ({
      кл: (e.className || "").toString().slice(0, 16),
      cw: e.clientWidth, sw: e.scrollWidth, w: Math.round(e.getBoundingClientRect().width)
    }));
    return {
      панель: { cw: m.clientWidth, sw: m.scrollWidth, w: Math.round(m.getBoundingClientRect().width) },
      коробка: { cw: in_.clientWidth, sw: in_.scrollWidth, pad: cs.paddingLeft + "/" + cs.paddingRight,
                 box: cs.boxSizing, ovx: cs.overflowX, ovy: cs.overflowY },
      дети: дети
    };
  });
  console.log("== " + имя + " " + JSON.stringify(с, null, 1));
  await pg.close();
}
await b.close();
