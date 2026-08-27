/* Шапка на ширинах, где overflow-x: clip прячет переполнение от
   scrollWidth. Смотрим правый край каждого элемента шапки против
   правого края окна. */
import { браузер, АДРЕС } from "/home/user/OKO-TEAM/rocketcdn/tools/audit/общее.mjs";
const b = await браузер();
const ШИР = [901, 920, 1000, 1024, 1053, 1080, 1120, 1240, 1440];
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
    return {
      вылет: [...new Set(вылет)].slice(0, 4),
      бургер: показ(бургер), нав: показ(нав)
    };
    function показ(э) { return э ? getComputedStyle(э).display : "нет"; }
  });
  console.log(String(w).padStart(5) + " · нав " + (с.нав || "?").padEnd(5) + " · бургер " + (с.бургер || "?").padEnd(5) +
              " · " + (с.вылет && с.вылет.length ? "ВЫЛЕТ: " + с.вылет.join(" | ") : "всё в кадре"));
  await pg.close();
}
await b.close();
