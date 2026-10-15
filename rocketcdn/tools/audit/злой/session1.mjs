import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница, вИгру } from "../общее.mjs";

const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);
const ok = await вИгру(pg);
await pg.waitForTimeout(2500);
async function ev(fn, ...args) { return pg.evaluate(fn, ...args); }

await ev(() => { window.RC_FLIGHT._set(0.02); });
await pg.waitForTimeout(3500);
await ev(() => { const b = document.querySelector('.rcf-stop-key'); if (b) b.click(); });
await pg.waitForTimeout(800);

const pick1 = await ev(() => window.RC_FLIGHT._pick());
const earth = pick1.тела.find(t => /earth|земл/i.test(t.имя) && t.видно && !t.сзади);
console.log("EARTH", JSON.stringify(earth));

const before = await ev(() => { try { return JSON.parse(localStorage.getItem('rcdn.explored2')||'{}'); } catch(e){return {};} });
console.log("KEYS-ДО", JSON.stringify(Object.keys(before)));

await pg.mouse.click(earth.x, earth.y);
await pg.waitForTimeout(500);

const after = await ev(() => { try { return JSON.parse(localStorage.getItem('rcdn.explored2')||'{}'); } catch(e){return {};} });
console.log("KEYS-ПОСЛЕ", JSON.stringify(Object.keys(after)));
const added = Object.keys(after).filter(k => !before[k]);
console.log("ДОБАВЛЕНО", JSON.stringify(added));

await b.close();
