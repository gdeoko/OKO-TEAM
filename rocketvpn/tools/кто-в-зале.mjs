/* КТО В ЗАЛЕ: что стоит на площадке в каждой точке ленты.

   На дне шахты два корпуса: каменная ракета, сложенная из кирпичей
   тоннеля, и металлический корабль CDN. В кадре обязан быть ровно один,
   и переход между ними идёт в первую десятую финала. Снимок прокола
   0.90 показал оба разом, и этот замер отвечает, чьих рук дело.

   Запуск: node tools/кто-в-зале.mjs */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 } });
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
  null, { timeout: 300000 });
await стр.waitForTimeout(2500);

for (const [а, д] of [["прокол", 0.50], ["прокол", 0.90], ["прокол", 0.99],
                      ["финал", 0.02], ["финал", 0.10], ["финал", 0.30]]) {
  await стр.evaluate(([и, x]) => window.RV_MOTION["кПунктy"](и, x), [а, д]);
  await стр.evaluate(() => new Promise((г) => {
    let n = 0; (function ш() { requestAnimationFrame(() => (++n >= 90 ? г() : ш())); })();
  }));
  const св = await стр.evaluate(() => {
    const W = window.RV_WORLD["мир"]();
    let камень = null, металл = null;
    W.scene.traverse((о) => {
      let п = о, видно = о.visible;
      while (видно && п) { if (!п.visible) видно = false; п = п.parent; }
      if (о.name === "кирпичи ракеты") камень = видно;
      if (о.name === "ракета-объём") металл = видно;
    });
    /* Высоты в МИРЕ: каменная ракета обязана стоять НА площадке, а не
       висеть над ней. Числа по коробкам предметов, а не на глаз. */
    const коробка = (имя) => {
      let б = null;
      W.scene.traverse((о) => {
        if (о.name !== имя) return;
        о.updateMatrixWorld(true);
        const к = new W.T.Box3().setFromObject(о);
        if (isFinite(к.min.y)) б = [+к.min.y.toFixed(2), +к.max.y.toFixed(2)];
      });
      return б;
    };
    return {
      камень: камень,
      металл: металл,
      низКамня: коробка("кирпичи ракеты"),
      площадка: коробка("площадка"),
      корабльCDN: коробка("корабль CDN"),
      превращение: window.RV_КОМНАТА && window.RV_КОМНАТА["победа"]
        ? +window.RV_КОМНАТА["победа"]().toFixed(3) : null,
      сбор: window.RV_СБОРКА && window.RV_СБОРКА["замер"] ? window.RV_СБОРКА["замер"]() : null
    };
  });
  console.log(`${а} ${д}: камень=${св.камень} металл=${св.металл} ` +
              `превращение=${св.превращение} сбор=${св.сбор && св.сбор["сбор"]} ` +
              `альфа=${св.сбор && св.сбор["альфа"]} ` +
              `кладка=${JSON.stringify(св.низКамня)} площадка=${JSON.stringify(св.площадка)} ` +
              `корабль=${JSON.stringify(св.корабльCDN)}`);
}
await бр.close();
