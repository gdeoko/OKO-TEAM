/* Ловим сам слой плиты и спрашиваем у него, сколько мест он насчитал */
import { ЭКРАНЫ, браузер, страница, вИгру } from "./общее.mjs";
const b = await браузер();
try {
  const { pg } = await страница(b, ЭКРАНЫ["ПК"]);
  await pg.evaluate(() => {
    const orig = window.RC_DECK["создать"];
    window.RC_DECK["создать"] = function () {
      const d = orig.apply(this, arguments);
      window.__плита = d;
      return d;
    };
  });
  const ок = await вИгру(pg);
  await pg.waitForTimeout(9000);
  const d = await pg.evaluate(() => {
    const p = window.__плита;
    if (!p) return { нет: "слой не пойман" };
    const мест = p["мест"]();
    const из = [];
    for (let i = 0; i < мест; i++) {
      const q = p["место"](i);
      if (!q) { из.push(null); continue; }
      const cx = (q[0].x+q[1].x+q[2].x+q[3].x)/4, cy = (q[0].y+q[1].y+q[2].y+q[3].y)/4;
      из.push([Math.round(cx), Math.round(cy)]);
    }
    return { вошли: true, мест, центры: из,
             полос: RC_CAB_DECK["широкая"]["полосы"].length,
             KEYS: RC_KEYS.KEYS.length };
  });
  console.log(JSON.stringify(d, null, 1));
  await pg.close();
} catch (e) { console.log("ОШИБКА:", e.message); }
await b.close();
