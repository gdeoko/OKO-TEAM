import { браузер, страница, ЭКРАНЫ, обрезки, наложения, итог } from "./общее.mjs";

const селекторыОбрезки = "header, nav, .hero, .btn, .form-card, .field, .contact-list, .legal, .sec-h, .sec-p, .card, table, th, td";
const селекторыНал = [".hdr-act", ".nav a", ".btn", ".pill", ".mcta .btn", ".form-card .field", ".legal a"];

let плохо = 0;
const b = await браузер();
for (const имя of ["телефон","узкий","планшет","ноутбук","ПК","широкий"]) {
  const э = ЭКРАНЫ[имя];
  const { pg, беды } = await страница(b, э);
  await pg.waitForTimeout(2500);
  const обр = await обрезки(pg, null);
  const нал = await наложения(pg, селекторыНал, ["hdr-act"]);
  const свои = [...беды];
  обр.forEach(o => svой(o));
  function svой(o){ свои.push("ОБРЕЗКА " + JSON.stringify(o)); }
  нал.forEach(n => свои.push("НАЛОЖЕНИЕ " + JSON.stringify(n)));
  await pg.screenshot({ path: `tools/audit/tmp/злой/index-${имя}.png`, fullPage: false }).catch(()=>{});
  плохо += итог("index @ " + имя, свои, []);
  await pg.close();
}
await b.close();
process.exit(плохо ? 1 : 0);
