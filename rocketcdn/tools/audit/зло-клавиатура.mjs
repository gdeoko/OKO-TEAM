/* Обход страницы клавишей Tab. Фокус считается видимым, если при
   получении фокуса у элемента ИЛИ у его потомка меняется хоть что-то
   заметное: обводка, тень, цвет рамки, фон. Мерить один outline мало -
   половина остановок рисует фокус тенью на внутреннем значке. */
import { браузер, страница, ЭКРАНЫ } from "./общее.mjs";
const b = await браузер();
const { pg } = await страница(b, ЭКРАНЫ["ПК"]);

const снимок = () => pg.evaluate(() => {
  const e = document.activeElement;
  if (!e || e === document.body) return null;
  const кто = (el) => { const s = getComputedStyle(el);
    return [s.outlineStyle, s.outlineWidth, s.boxShadow, s.borderColor, s.backgroundColor].join("|"); };
  const дети = [...e.querySelectorAll("*")].slice(0, 4).map(кто);
  const r = e.getBoundingClientRect();
  return {
    ключ: e.tagName + "." + (e.className || "").toString().slice(0, 22),
    имя: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 26),
    стиль: кто(e), дети: дети,
    видим: r.width > 0 && r.height > 0
  };
});

const плохие = [];
for (let i = 0; i < 45; i++) {
  await pg.keyboard.press("Tab");
  const вФокусе = await снимок();
  if (!вФокусе || !вФокусе.видим) continue;
  /* Тот же элемент без фокуса: снимаем стиль после blur */
  const без = await pg.evaluate(() => {
    const e = document.activeElement;
    if (!e || e === document.body) return null;
    const кто = (el) => { const s = getComputedStyle(el);
      return [s.outlineStyle, s.outlineWidth, s.boxShadow, s.borderColor, s.backgroundColor].join("|"); };
    e.blur();
    const свой = кто(e);
    const дети = [...e.querySelectorAll("*")].slice(0, 4).map(кто);
    e.focus();
    return { стиль: свой, дети: дети };
  });
  if (!без) continue;
  const изменилось = вФокусе.стиль !== без.стиль ||
    вФокусе.дети.some((с, k) => с !== без.дети[k]);
  if (!изменилось) плохие.push(вФокусе.ключ + " «" + вФокусе.имя + "»");
}
console.log("остановок без ЛЮБОГО признака фокуса:", плохие.length);
плохие.forEach((п) => console.log("   " + п));
await b.close();
