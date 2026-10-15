import { АДРЕС, ЭКРАНЫ, браузер } from "./общее.mjs";
const имя = process.argv[2] || "телефон";
const э = ЭКРАНЫ[имя];
for (let п = 1; п <= 3; п++) {
  let b;
  try {
    b = await браузер();
    const pg = await b.newPage({ viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob });
    await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 200000 });
    await pg.waitForTimeout(9000);
    const r = await pg.evaluate(() => {
      const счёт = (сел) => {
        const из = { всего: 0, bd: 0, fl: 0, blur0: 0, wc: 0, mask: 0, аним: 0, примеры: [] };
        document.querySelectorAll(сел).forEach(э => {
          const s = getComputedStyle(э); из.всего++;
          const bf = s.backdropFilter || s.webkitBackdropFilter;
          if (bf && bf !== "none") { из.bd++; if (из.примеры.length < 3) из.примеры.push("bd " + bf.slice(0, 30)); }
          if (s.filter && s.filter !== "none") { из.fl++; if (/blur\(0px\)/.test(s.filter)) из.blur0++; }
          if (s.willChange && s.willChange !== "auto") из.wc++;
          if ((s.maskImage && s.maskImage !== "none") || (s.webkitMaskImage && s.webkitMaskImage !== "none")) из.mask++;
          if (s.animationName && s.animationName !== "none") из.аним++;
        });
        return из;
      };
      return {
        окно: innerWidth + "x" + innerHeight + " dpr" + devicePixelRatio,
        стёкла: счёт(".card, .viz-card, .dc"),
        салон: счёт("#reliability .cin-item"),
        голо: счёт("#reliability .cin-holo"),
        экраны: счёт("#reliability .cin-scr"),
        всеCin: счёт(".cin-item"),
        узлов: document.querySelectorAll("*").length,
        cabН: document.querySelectorAll("#relGrid .card").length,
        режим: document.documentElement.className.slice(0, 90),
        деград: document.documentElement.getAttribute("data-degrade")
      };
    });
    console.log("═══ СЛОИ · " + имя + " · " + r.окно + " ═══");
    console.log("узлов в DOM: " + r.узлов + " · классы html: " + r.режим + " · degrade=" + r.деград);
    for (const [к, v] of Object.entries(r)) {
      if (!v || typeof v !== "object") continue;
      console.log(к.padEnd(9) + " элементов " + String(v.всего).padStart(3) +
        " · backdrop-filter " + String(v.bd).padStart(3) +
        " · filter " + String(v.fl).padStart(3) + " (из них blur(0px): " + v.blur0 + ")" +
        " · will-change " + String(v.wc).padStart(3) +
        " · mask-image " + String(v.mask).padStart(3) +
        " · CSS-анимаций " + String(v.аним).padStart(3) +
        (v.примеры.length ? "   [" + v.примеры.join("; ") + "]" : ""));
    }
    console.log("карточек в кольце салона: " + r.cabН);
    await b.close();
    break;
  } catch (e) { console.log("попытка " + п + ": " + e.message.slice(0, 120)); try { await b.close(); } catch (e2) {} }
}
