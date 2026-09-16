import { браузер, страница, ЭКРАНЫ, обрезки, наложения, итог } from "./общее.mjs";

const секции = ["#hero","#products","#infra","#adv","#how","#cases","#faq","#contact","#epilogue"];
const селНал = [".nav a", ".btn", ".pill", ".mcta .btn", ".form-card .field", ".legal a", ".card", ".sec-h", ".sec-p"];

let плохо = 0;
const b = await браузер();
for (const имя of ["телефон","ПК","широкий","узкий"]) {
  const э = ЭКРАНЫ[имя];
  const { pg, беды } = await страница(b, э);
  const свои = [...беды];
  for (const s of секции) {
    const ок = await pg.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.scrollIntoView({ block: "start" });
      return true;
    }, s);
    if (!ок) { свои.push("НЕТ СЕКЦИИ " + s); continue; }
    await pg.waitForTimeout(2200);
    const обр = await обрезки(pg, null);
    const нал = await наложения(pg, селНал, ["hdr-act"]);
    обр.forEach(o => свои.push(`ОБРЕЗКА[${s}] ` + JSON.stringify(o)));
    нал.forEach(n => свои.push(`НАЛОЖЕНИЕ[${s}] ` + JSON.stringify(n)));
    await pg.screenshot({ path: `tools/audit/tmp/злой/скролл-${имя}-${s.replace('#','')}.png` }).catch(()=>{});
  }
  плохо += итог("index-скролл @ " + имя, свои, []);
  await pg.close();
}
await b.close();
process.exit(плохо ? 1 : 0);
