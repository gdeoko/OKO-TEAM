/* Проверка марки после правки: не режется ли, где стоит по высоте
   стекла, не заезжает ли на раму, стоят ли обе марки по одной линии.
   Запуск: node tools/audit/лого-проверка.mjs [экран ...] */
import { браузер, страница, ЭКРАНЫ, вИгру } from "./общее.mjs";

const список = process.argv.slice(2).length ? process.argv.slice(2) : ["ПК", "телефон"];
const b = await браузер();
for (const имя of список) {
  const э = ЭКРАНЫ[имя];
  const { pg } = await страница(b, э);
  const ок = await вИгру(pg);
  await pg.waitForTimeout(6000);
  const r = await pg.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const h = q(".rcf-holo"), v = q(".rc-vpn-projector");
    const cs = h && getComputedStyle(h);
    const W0 = q(".rcf-wrap") || document.documentElement;
    const S = getComputedStyle(W0);
    const внутри = h ? W0.contains(h) : null;
    const внутриV = v ? W0.contains(v) : null;
    const дол = (n) => parseFloat(S.getPropertyValue(n));
    const H = innerHeight, W = innerWidth;
    const dy = дол("--cab-dy") / 100 * H;
    const wy = дол("--cab-wy") / 100 * H, wh = дол("--cab-wh") / 100 * H;
    const rb = h && h.getBoundingClientRect();
    const vb = v && v.getBoundingClientRect();
    return {
      есть: !!h, вОбёртке: внутри, vpnВОбёртке: внутриV, клип: cs ? cs.clipPath : null,
      марка: rb ? [+rb.left.toFixed(1), +rb.top.toFixed(1), +rb.width.toFixed(1), +rb.height.toFixed(1)] : null,
      низМарки: rb ? +rb.bottom.toFixed(1) : null,
      кромкаСтекла: +dy.toFixed(1),
      верхОкна: +wy.toFixed(1), низВписанного: +(wy + wh).toFixed(1),
      центрПоСтеклу: rb ? +(((rb.top + rb.bottom) / 2 - wy) / (dy - wy) * 100).toFixed(1) : null,
      vpnКлип: v ? getComputedStyle(v).clipPath : null,
      низVPN: vb ? +vb.bottom.toFixed(1) : null,
      экран: [W, H]
    };
  });
  console.log("\n══ " + имя + " вход:" + ок);
  console.log(JSON.stringify(r, null, 1));
  await pg.close();
}
await b.close();
