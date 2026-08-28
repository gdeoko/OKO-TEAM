/* Шапка на ширинах, где overflow-x: clip прячет переполнение от
   scrollWidth. Смотрим правый край каждого элемента шапки против
   правого края окна. */
import { браузер, АДРЕС } from "/home/user/OKO-TEAM/rocketcdn/tools/audit/общее.mjs";
const b = await браузер();
let бед = 0;
const ШИР = [901, 1000, 1080, 1081, 1120, 1240, 1241, 1280, 1366, 1440, 1536, 1599, 1600, 1920, 2560];
for (const w of ШИР) {
  const pg = await b.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForTimeout(4000);
  const с = await pg.evaluate(() => {
    const вылет = [];
    const шапка = document.querySelector("#hdr");
    if (!шапка) return { нет: true };
    [].forEach.call(шапка.querySelectorAll("*"), (э) => {
      if (!э.offsetParent) return;
      const п = э.getBoundingClientRect();
      if (п.width < 1) return;
      const за = Math.round(п.right - innerWidth);
      if (за > 1) вылет.push((э.className && typeof э.className === "string" ? "." + э.className.split(" ")[0] : э.tagName) +
                             " за краем на " + за + "px");
    });
    const бургер = document.querySelector(".burger");
    const нав = document.querySelector(".nav");
    /* Переполнение за край окна это только половина беды. Вторая:
       строка шапки жмёт саму себя - навигация режется многоточием, а
       правый блок наезжает на неё сверху. Замер края окна этого не
       видит: всё формально «в кадре». */
    const режется = [];
    [].forEach.call(document.querySelectorAll("#hdr .nav a, #hdr .btn, #hdr .pill button"), (э) => {
      if (!э.offsetParent) return;
      if (э.scrollWidth > э.clientWidth + 1) {
        режется.push((э.textContent || "").trim().slice(0, 14) + " на " + (э.scrollWidth - э.clientWidth) + "px");
      }
    });
    const наезды = [];
    const акт = document.querySelector("#hdr .hdr-act");
    if (нав && акт) {
      const па = акт.getBoundingClientRect();
      [].forEach.call(нав.querySelectorAll("a"), (a) => {
        const р = a.getBoundingClientRect();
        const w = Math.min(р.right, па.right) - Math.max(р.left, па.left);
        const h = Math.min(р.bottom, па.bottom) - Math.max(р.top, па.top);
        if (w > 1 && h > 1) наезды.push((a.textContent || "").trim() + " под правым блоком " + Math.round(w) + "x" + Math.round(h));
      });
    }
    return {
      вылет: [...new Set(вылет)].slice(0, 4),
      режется: режется.slice(0, 3), наезды: наезды.slice(0, 3),
      бургер: показ(бургер), нав: показ(нав)
    };
    function показ(э) { return э ? getComputedStyle(э).display : "нет"; }
  });
  console.log(String(w).padStart(5) + " · нав " + (с.нав || "?").padEnd(5) + " · бургер " + (с.бургер || "?").padEnd(5) +
              " · " + (с.вылет && с.вылет.length ? "ВЫЛЕТ: " + с.вылет.join(" | ") : "в кадре") +
              (с.режется && с.режется.length ? " · РЕЖЕТСЯ: " + с.режется.join(" | ") : "") +
              (с.наезды && с.наезды.length ? " · НАЕЗД: " + с.наезды.join(" | ") : ""));
  if ((с.вылет && с.вылет.length) || (с.режется && с.режется.length) || (с.наезды && с.наезды.length)) бед++;
  await pg.close();
}
await b.close();
console.log(бед ? "БЕДА  шапка жмёт себя" : "ЧИСТО  шапка на всех ширинах");
process.exit(бед ? 1 : 0);
