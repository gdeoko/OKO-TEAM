/* Объём карточек после прокрутки.
   Проверка на конкретную беду: переменную --rcd-k писал только
   кадровый цикл, а в тихом режиме он не заводится. Карточка,
   один раз ушедшая за кадр, получала ноль и оставалась плоской
   плиткой навсегда, а на телефоне вместе с ней гас и глянец.
   Гоняем страницу вниз до подвала и обратно, потом смотрим, что
   стоит у карточек в кадре. */
import { браузер, АДРЕС } from "/home/user/OKO-TEAM/rocketcdn/tools/audit/общее.mjs";
const b = await браузер();
let бед = 0;
for (const [имя, w, h] of [["ПК", 1440, 900], ["телефон", 390, 844]]) {
  const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pg.waitForTimeout(3500);
  /* вниз до конца и обратно наверх */
  for (let i = 0; i < 14; i++) { await pg.mouse.wheel(0, 900); await pg.waitForTimeout(120); }
  await pg.waitForTimeout(900);
  for (let i = 0; i < 14; i++) { await pg.mouse.wheel(0, -900); await pg.waitForTimeout(120); }
  await pg.waitForTimeout(1200);
  /* и снова чуть вниз, к первым карточкам */
  await pg.mouse.wheel(0, 1200);
  await pg.waitForTimeout(1200);

  const с = await pg.evaluate(() => {
    const из = [], плоские = [];
    document.querySelectorAll(".rcd").forEach((э) => {
      const п = э.getBoundingClientRect();
      if (п.bottom < 40 || п.top > innerHeight - 40 || !п.height) return;
      const k = parseFloat(getComputedStyle(э).getPropertyValue("--rcd-k"));
      из.push(isFinite(k) ? k : 1);
      if (isFinite(k) && k <= 0.02) плоские.push((э.className || "").split(" ")[0] + " k=" + k);
    });
    return { всего: из.length, плоские: плоские.slice(0, 6) };
  });
  const плохо = с.плоские.length > 0;
  if (плохо) бед++;
  console.log(`${имя}: карточек в кадре ${с.всего} · плоских ${с.плоские.length} ${с.плоские.join(" | ")}`);
  await pg.close();
}
console.log(бед ? "БЕДА: карточки остались без объёма" : "ЧИСТО: объём держится после прокрутки");
await b.close();
process.exit(бед ? 1 : 0);
