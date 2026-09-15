import { браузер, страница, ЭКРАНЫ, вИгру } from "../общее.mjs";

const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);
const ok = await вИгру(pg);
console.log("вИгру:", ok);
await pg.waitForTimeout(2000);

// ── Проверка 1: капшн орбиты при смене курса без выхода с прежней орбиты
const r1 = await pg.evaluate(async () => {
  const out = {};
  window.RC_FLIGHT._go("earth");
  // ждём прибытия на орбиту Земли по капшну
  for (let i = 0; i < 80; i++) {
    const t = (document.querySelector(".rcf-cap") || {}).textContent || "";
    if (t.indexOf("ОРБИТА") >= 0 && t.indexOf("ЗЕМЛ") >= 0) { out.arrivedEarth = t; break; }
    await new Promise(r => setTimeout(r, 250));
  }
  out.capAfterEarth = (document.querySelector(".rcf-cap") || {}).textContent || "";
  const pick1 = window.RC_FLIGHT._pick();
  out.earthDistBefore = (pick1.тела.find(x => x.имя.indexOf("ЗЕМЛ") >= 0) || {}).д;
  out.marsDistBefore = (pick1.тела.find(x => x.имя.indexOf("МАРС") >= 0) || {}).д;

  window.RC_FLIGHT._go("mars");
  // капшн сразу после клика по новому курсу
  out.capImmediateAfterMarsClick = (document.querySelector(".rcf-cap") || {}).textContent || "";
  await new Promise(r => setTimeout(r, 3000));
  out.capAfter3s = (document.querySelector(".rcf-cap") || {}).textContent || "";
  const pick2 = window.RC_FLIGHT._pick();
  out.earthDistAfter3s = (pick2.тела.find(x => x.имя.indexOf("ЗЕМЛ") >= 0) || {}).д;
  out.marsDistAfter3s = (pick2.тела.find(x => x.имя.indexOf("МАРС") >= 0) || {}).д;
  out.state = window.RC_FLIGHT.state();
  return out;
});
console.log("ПРОВЕРКА 1 (орбита не сброшена при смене курса):", JSON.stringify(r1, null, 1));

await pg.close(); await b.close();
