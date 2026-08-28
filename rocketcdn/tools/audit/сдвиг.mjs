import fs from "node:fs";
import { ЭКРАНЫ, браузер, страница } from "./общее.mjs";
/* Меняется ли высота документа и место разделов при смене актов
   финальной сцены. Ходим прокруткой, читаем docH и верх #faq. */
const имя = process.argv[2] || "ПК";
const э = ЭКРАНЫ[имя];
const b = await браузер();
const { pg, беды } = await страница(b, э);
const файл = "tools/audit/out/сдвиг-" + имя + ".ndjson";
fs.writeFileSync(файл, "");
await pg.exposeFunction("отдай", (o) => { fs.appendFileSync(файл, JSON.stringify(o) + "\n"); console.log(JSON.stringify(o)); });
try {
await pg.evaluate(async () => {
  const сон = (ms) => new Promise(r => setTimeout(r, ms));
  const мера = () => {
    const q = (i) => { const e = document.getElementById(i); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; };
    const m = document.querySelector("main");
    return { y: Math.round(scrollY), акт: document.documentElement.getAttribute("data-act"),
             docH: document.documentElement.scrollHeight, main: m ? m.offsetHeight : null,
             minH: m ? m.style.minHeight : null,
             included: q("included"), cases: q("cases"), rel: q("reliability"),
             faq: q("faq"), contact: q("contact"), epi: q("epilogue"),
             под: typeof window.RC_APPROACH === "number" ? +window.RC_APPROACH.toFixed(2) : null,
             вПорог: window.RC_INTERIOR && window.RC_INTERIOR.state ? window.RC_INTERIOR.state().порог_вход : null };
  };
  const старт = Math.max(0, Math.round(document.getElementById("route").getBoundingClientRect().top + scrollY - innerHeight));
  let g1 = 0;
  while (scrollY < старт - 5 && g1++ < 600) { scrollBy(0, Math.round(innerHeight * 0.3)); await сон(230); }
  await сон(3000);
  for (let i = 0; i < 60; i++) {
    await window.отдай(мера());
    scrollBy(0, Math.round(innerHeight * 0.25));
    await сон(900);
    if (scrollY >= document.documentElement.scrollHeight - innerHeight - 2) break;
  }
});
} catch (e) { console.log("ОБРЫВ", (e.message||"").slice(0,100)); }
console.log("БЕДЫ", JSON.stringify(беды.slice(0,8)));
await b.close();
