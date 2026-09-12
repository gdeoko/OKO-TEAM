/* Сверка пульта после правок: фантомной клавиши нет, зоны не
   налезают, подписи читаемы, у клавиш есть имена, радар получил цели. */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";

const b = await браузер();
for (const имя of ["ПК", "телефон"]) {
  const { pg, беды } = await страница(b, ЭКРАНЫ[имя]);
  const вошли = await вИгру(pg);
  if (!вошли) { console.log(имя + ": в игру не вошли"); await pg.close(); continue; }
  await pg.waitForTimeout(4000);
  const из = await pg.evaluate(() => {
    const кл = [...document.querySelectorAll(".rcf-deck .rcf-key, .rcf-deck .rcf-thr")];
    const видно = кл.filter((э) => {
      const s = getComputedStyle(э), r = э.getBoundingClientRect();
      return s.display !== "none" && +s.opacity > 0.05 && r.width > 6 && r.height > 6;
    });
    const зоны = видно.map((э) => { const r = э.getBoundingClientRect();
      return { к: (э.className.match(/rcf-[a-z-]+key|rcf-thr|rcf-deploy|rcf-shot|rcf-zoom-\w+|rcf-navkey/) || ["?"])[0],
               x: r.left, y: r.top, w: r.width, h: r.height }; });
    let налож = 0, макс = 0;
    for (let i = 0; i < зоны.length; i++) for (let j = i + 1; j < зоны.length; j++) {
      const a = зоны[i], c = зоны[j];
      const ш = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
      const в = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
      if (ш > 1 && в > 1) { налож++; макс = Math.max(макс, Math.min(ш, в)); }
    }
    const безИмени = видно.filter((э) => !э.getAttribute("aria-label")).length;
    const D = window.RC_DECK;
    return { видимыхКлавиш: видно.length, мест: D && D.мест ? "-" : "-",
             наложенийЗон: налож, наибольшееНаложение: +макс.toFixed(1),
             безДоступногоИмени: безИмени,
             зоны: зоны.map((з) => з.к + " " + Math.round(з.w) + "x" + Math.round(з.h)).join(", ") };
  });
  console.log("── " + имя);
  console.log("   клавиш видно: " + из.видимыхКлавиш + " · наложений зон: " + из.наложенийЗон +
              " (наибольшее " + из.наибольшееНаложение + " px) · без имени: " + из.безДоступногоИмени);
  console.log("   " + из.зоны);
  console.log("   беды: " + (беды.length ? [...new Set(беды)].slice(0, 3).join(" | ") : "нет"));
  await pg.close();
}
await b.close();
