import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница, вИгру } from "../общее.mjs";

const b = await браузер();
const { pg, беды } = await страница(b, ЭКРАНЫ["ПК"]);

// --- A: EN toggle before entering flight ---
await pg.evaluate(() => { const btn = document.querySelector('button[data-lang="en"]'); if (btn) btn.click(); });
await pg.waitForTimeout(600);
console.log("LANG-ATTR", await pg.evaluate(() => document.documentElement.lang));

const ok = await вИгру(pg);
console.log("вИгру", ok);
await pg.waitForTimeout(2500);
async function ev(fn, ...args) { return pg.evaluate(fn, ...args); }

// открыть меню КУРС, посмотреть тексты (EN)
await ev(() => { const b = document.querySelector('.rcf-course-key, .rcf-nav-key, button[aria-label*="course" i], button[aria-label*="Course" i]'); });
const menuBtnInfo = await ev(() => {
  const all = [...document.querySelectorAll('.rcf-key')].map(b => ({cls:b.className, aria:b.getAttribute('aria-label'), txt:(b.textContent||'').trim().slice(0,30)}));
  return all;
});
fs.writeFileSync("tools/audit/злой/keys-en.json", JSON.stringify(menuBtnInfo, null, 1));
console.log("КЛАВИШИ-EN", JSON.stringify(menuBtnInfo.slice(0,14)));

await b.close();
