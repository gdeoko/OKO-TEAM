/* Где именно встаёт вход в ракету.

   Меряем buildWorld по разделам: страница открывается с ?rcdbg=1,
   зовём RC_FLIGHT.prebuild() и забираем разбивку RC_FLIGHT.этапы().
   Ждём столько, сколько надо: видеокарты в песочнице нет, но
   разделы buildWorld считает процессор, и его время меряется честно.

   Запуск: node tools/audit/сборка-мира.mjs [экран ...]
*/
import { браузер, страница, ЭКРАНЫ } from "./общее.mjs";

const хочу = process.argv.slice(2);
const список = хочу.length ? хочу : ["ПК", "телефон"];

const b = await браузер();
for (const имя of список) {
  const э = ЭКРАНЫ[имя];
  if (!э) { console.log("нет такого экрана:", имя); continue; }
  const { pg, беды } = await страница(b, э);
  await pg.evaluate((v) => { window.RC_PREWARM = v; }, process.env.RC_PREWARM || "0");
  const итог = await pg.evaluate(async () => {
    const F = window.RC_FLIGHT;
    if (!F || !F.prebuild) return { нет: "RC_FLIGHT.prebuild недоступен" };
    /* Опыт: если заранее прогреть кэш карт RC_REAL, сколько уйдёт
       из «физматериалов»? */
    var прогрев = 0;
    if (window.RC_PREWARM === "1" && window.RC_REAL && window.RC_REAL.maps && window.THREE) {
      var тп = performance.now();
      ["hull", "deck", "glass", "panel"].forEach(function (k) {
        try { window.RC_REAL.maps(window.THREE, k); } catch (e) {}
      });
      прогрев = +(performance.now() - тп).toFixed(1);
    }
    const t0 = performance.now();
    const ок = F.prebuild();
    const всего = performance.now() - t0;
    var кэт = [];
    try {
      if (window.RC_CABIN && window.RC_CABIN["этапы"]) кэт = window.RC_CABIN["этапы"]();
    } catch (e2) {}
    return { ок: !!ок, всего: +всего.toFixed(1), этапы: F["этапы"] ? F["этапы"]() : [], салон: кэт, прогрев: прогрев };
  });
  console.log("\n══ " + имя + " " + э.vp.width + "×" + э.vp.height);
  if (итог.нет) { console.log("  " + итог.нет); }
  else {
    if (итог.прогрев) console.log("  прогрев карт RC_REAL: " + итог.прогрев + " мс");
    console.log("  prebuild целиком: " + итог.всего + " мс, собралось: " + итог.ок);
    итог.этапы
      .slice().sort((a, c) => c[1] - a[1])
      .forEach(([р, мс]) => { if (мс >= 1) console.log("    " + String(мс).padStart(8) + " мс  " + р); });
    if (итог.салон && итог.салон.length) {
      console.log("  корпус рубки по разделам:");
      итог.салон.slice().sort((a, c) => c[1] - a[1])
        .forEach(([р, мс]) => { if (мс >= 1) console.log("    " + String(мс).padStart(8) + " мс  " + р); });
    }
  }
  if (беды.length) console.log("  беды: " + беды.slice(0, 6).join(" | "));
  await pg.close();
}
await b.close();
