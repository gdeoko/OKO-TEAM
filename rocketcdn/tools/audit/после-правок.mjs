/* Короткая сверка после правок: страница цела, игра открывается,
   метки и титры на месте, слоёв стало меньше. Один прогон, чтобы не
   грузить машину. */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";

const мера = (pg) => pg.evaluate(() => {
  let стекло = 0, пустых = 0, фильтр = 0, маски = 0;
  document.querySelectorAll("*").forEach((э) => {
    const s = getComputedStyle(э), r = э.getBoundingClientRect();
    if (s.display === "none" || s.visibility === "hidden" || r.width < 3 || r.height < 3) return;
    const bf = s.backdropFilter || s.webkitBackdropFilter;
    if (bf && bf !== "none") стекло++;
    const f = s.filter;
    if (f && f !== "none") { фильтр++; if (/blur\(0px\)/.test(f)) пустых++; }
    const m = s.maskImage || s.webkitMaskImage;
    if (m && m !== "none") маски++;
  });
  let поРаскладке = 0;
  for (const л of document.styleSheets) {
    let пр; try { пр = л.cssRules; } catch (e) { continue; }
    for (const п of пр) {
      if (п.type !== CSSRule.KEYFRAMES_RULE) continue;
      for (const к of п.cssRules) {
        const t = к.style;
        if (t && (t.top || t.left || t.bottom || t.right)) { поРаскладке++; break; }
      }
    }
  }
  return { стекло, фильтров: фильтр, пустыхФильтров: пустых, маски, анимацийПоРаскладке: поРаскладке,
           ступень: document.documentElement.dataset.degrade || "нет" };
});

const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["телефон"]);
console.log("верх страницы:", JSON.stringify(await мера(pg)));
const вошли = await вИгру(pg);
console.log("в игру вошли:", вошли);
console.log("в игре:      ", JSON.stringify(await мера(pg)));
const живо = await pg.evaluate(() => ({
  титр: (document.querySelector(".rcf-cap") || {}).textContent || "нет",
  меток: document.querySelectorAll(".rc-holo .rch-body").length,
  клавиш: document.querySelectorAll(".rcf-deck .rcf-key").length
}));
console.log("живое:       ", JSON.stringify(живо));
console.log("беды:", беды.length ? [...new Set(беды)].slice(0, 5) : "нет");
await b.close();
