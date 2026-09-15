/* Вёрстка на всех экранах и в обеих темах.

   Считаем то, что видно глазу: не вылезает ли страница за свою ширину,
   нет ли текста мельче девяти точек, нет ли зон нажатия меньше 34
   точек. Ходим прокруткой, а не по якорям: прыжок ломает сцену. */
import { браузер, страница, ЭКРАНЫ } from "./общее.mjs";

const ЭКР = ["узкий", "телефон", "лежачий", "планшет", "четыре", "ноутбук", "ПК", "широкий"];
const b = await браузер();
let бед = 0;

const СНЯТЬ = () => {
  const путь = (э) => э.tagName.toLowerCase() +
    (э.className && typeof э.className === "string" && э.className ? "." + э.className.split(" ")[0] : "");
  const кор = document.documentElement;
  const мелко = [];
  const тесно = [];
  const узлы = document.querySelectorAll("body *");
  for (let i = 0; i < узлы.length; i++) {
    const э = узлы[i];
    if (!э.offsetParent) continue;
    const п = э.getBoundingClientRect();
    if (п.width < 1 || п.height < 1) continue;
    if (п.top > innerHeight + 40 || п.bottom < -40) continue;
    const с = getComputedStyle(э);
    if (с.visibility === "hidden" || с.opacity === "0") continue;
    let свой = "";
    for (let k = 0; k < э.childNodes.length; k++) {
      if (э.childNodes[k].nodeType === 3) свой += э.childNodes[k].nodeValue;
    }
    if (свой.trim().length > 1) {
      const кегль = parseFloat(с.fontSize) || 0;
      if (кегль > 0 && кегль < 9) мелко.push(путь(э) + " " + кегль.toFixed(1) + "px");
    }
    const нажимаемый = э.tagName === "BUTTON" || э.tagName === "A" || э.getAttribute("role") === "button";
    if (нажимаемый && с.pointerEvents !== "none") {
      const м = Math.min(п.width, п.height);
      if (м < 34) тесно.push(путь(э) + " " + Math.round(п.width) + "x" + Math.round(п.height));
    }
  }
  return {
    вылет: Math.max(0, кор.scrollWidth - кор.clientWidth),
    мелко: мелко.slice(0, 6),
    тесно: тесно.slice(0, 6)
  };
};

for (const имя of ЭКР) {
  for (const тема of ["dark", "light"]) {
    const { pg } = await страница(b, ЭКРАНЫ[имя]);
    await pg.evaluate((t) => {
      document.documentElement.setAttribute("data-theme", t);
      try { localStorage.setItem("rc_theme", t); } catch (e) {}
    }, тема);
    await pg.waitForTimeout(1800);
    let вылет = 0;
    const мелкие = new Map(), тесные = new Map();
    for (let ш = 0; ш < 20; ш++) {
      const с = await pg.evaluate(СНЯТЬ);
      if (с.вылет > вылет) вылет = с.вылет;
      с.мелко.forEach((x) => мелкие.set(x, 1));
      с.тесно.forEach((x) => тесные.set(x, 1));
      await pg.mouse.wheel(0, Math.round(ЭКРАНЫ[имя].vp.height * 0.6));
      await pg.waitForTimeout(300);
    }
    console.log(имя.padEnd(9) + тема.padEnd(6) + " вылет " + вылет + "px · мелкий кегль " +
                мелкие.size + " · тесные зоны " + тесные.size);
    if (вылет > 2) { console.log("   БЕДА вылет по горизонтали " + вылет + "px"); бед++; }
    if (мелкие.size) { console.log("   мелко: " + [...мелкие.keys()].slice(0, 4).join(" | ")); бед++; }
    if (тесные.size) { console.log("   тесно: " + [...тесные.keys()].slice(0, 4).join(" | ")); бед++; }
    await pg.close();
  }
}
console.log(бед ? "БЕД: " + бед : "ЧИСТО  вёрстка на всех экранах и в обеих темах");
await b.close();
