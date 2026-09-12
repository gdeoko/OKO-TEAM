/* Курс, справка и досье: целиком ли они на экране и не режется ли
   текст внутри. Заказчик писал "все окна внутри обрезаны и не
   понятные", и проверять это на глаз бесполезно: отсечение по
   контуру проёма не видно в геометрии элемента. */
import { браузер, вПолёт, ТЕЛЕФОН, ПК, итог } from "./общее.mjs";

const b = await браузер();
const беды = [];
const всеОшибки = [];

for (const э of [ТЕЛЕФОН, ПК]) {
  const { pg, ошибки } = await вПолёт(b, э);

  const панель = async (кнопка, сел, имя) => {
    if (кнопка) {
      await pg.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, кнопка);
      await pg.waitForTimeout(1500);
    }
    const r = await pg.evaluate(s => {
      const p = document.querySelector(s);
      if (!p) return { нет: true };
      const rr = p.getBoundingClientRect();
      const обрез = [];
      p.querySelectorAll("*").forEach(e => {
        const cs = getComputedStyle(e);
        if (e.scrollWidth > e.clientWidth + 2 && !/auto|scroll|visible/.test(cs.overflowX))
          обрез.push((e.className || "").toString().slice(0, 22) + " «" + (e.textContent || "").trim().slice(0, 18) + "»");
      });
      return {
        заЭкраном: rr.top < -1 || rr.bottom > innerHeight + 1 || rr.left < -1 || rr.right > innerWidth + 1,
        обрез: обрез.slice(0, 4)
      };
    }, сел);
    if (r.нет) { беды.push(э.имя + ": " + имя + " не открылась"); return; }
    console.log("  ", э.имя.padEnd(8), имя.padEnd(10), r.заЭкраном ? "ЗА ЭКРАНОМ" : "на экране",
                r.обрез.length ? "| обрез: " + r.обрез.join("; ") : "");
    if (r.заЭкраном) беды.push(э.имя + ": " + имя + " уходит за экран");
    if (r.обрез.length) беды.push(э.имя + ": " + имя + " режет текст: " + r.обрез.join("; "));
    if (кнопка) {
      await pg.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, кнопка);
      await pg.waitForTimeout(800);
    }
  };

  await панель(".rcf-navkey", ".rcf-menu", "курс");
  await панель(".rcf-help-key", ".rcf-help-in", "справка");
  await pg.evaluate(() => window.RC_FLIGHT._dos("ЧЁРНАЯ ДЫРА"));
  await pg.waitForTimeout(1800);
  await панель(null, ".rcf-dos-in", "досье");
  const заг = await pg.evaluate(() => {
    const h = document.querySelector(".rcf-dos-h");
    return h ? { т: h.textContent.trim(), обрез: h.scrollWidth > h.clientWidth + 2 } : null;
  });
  if (заг && заг.обрез) беды.push(э.имя + ": заголовок досье обрезан: " + заг.т);

  всеОшибки.push(...ошибки);
  await pg.close();
}

await b.close();
process.exit(итог("панели", беды, всеОшибки));
