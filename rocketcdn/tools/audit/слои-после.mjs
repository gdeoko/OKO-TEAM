/* Сколько слоёв и записей осталось после правок: стёкла, пустые
   фильтры, вечные анимации по top/left. Меряем на телефоне и ПК,
   в покое и в финальной сцене. */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";

const мера = (pg) => pg.evaluate(() => {
  let стекло = 0, фильтр = 0, пустых = 0, willch = 0, маски = 0;
  document.querySelectorAll("*").forEach((э) => {
    const s = getComputedStyle(э), r = э.getBoundingClientRect();
    const видно = s.display !== "none" && s.visibility !== "hidden" && r.width > 2 && r.height > 2;
    if (!видно) return;
    const bf = s.backdropFilter || s.webkitBackdropFilter;
    if (bf && bf !== "none") стекло++;
    const f = s.filter;
    if (f && f !== "none") { фильтр++; if (/blur\(0px\)/.test(f)) пустых++; }
    if (s.willChange && s.willChange !== "auto") willch++;
    const m = s.maskImage || s.webkitMaskImage;
    if (m && m !== "none") маски++;
  });
  /* Вечные анимации, двигающие раскладку */
  let поTop = 0;
  for (const л of document.styleSheets) {
    let пр; try { пр = л.cssRules; } catch (e) { continue; }
    for (const п of пр) {
      if (п.type !== CSSRule.KEYFRAMES_RULE) continue;
      for (const к of п.cssRules) {
        const t = к.style;
        if (t && (t.top || t.left || t.bottom || t.right)) { поTop++; break; }
      }
    }
  }
  return { стекло, фильтр, пустыхФильтров: пустых, willChange: willch, маски, анимацийПоРаскладке: поTop,
           узлов: document.querySelectorAll("*").length, ступень: document.documentElement.dataset.degrade || "нет" };
});

const b = await браузер();
for (const имя of ["телефон", "ПК"]) {
  const { pg } = await страница(b, ЭКРАНЫ[имя]);
  console.log("── " + имя + " · верх страницы:", JSON.stringify(await мера(pg)));
  /* Финальная сцена: доходим прокруткой */
  await pg.evaluate(() => {
    const э = document.querySelector("#reliability");
    if (э) scrollTo(0, scrollY + э.getBoundingClientRect().top - innerHeight * 0.5);
  });
  await pg.waitForTimeout(8000);
  console.log("   " + имя + " · салон:      ", JSON.stringify(await мера(pg)));
  await pg.close();
}
await b.close();
