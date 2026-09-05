/* Отвечает ли ракета из частиц на касание, свайп и прокрутку.

   ЗАЧЕМ. Владелец: «на прикосновение, скролл, свайп по модели реагирует
   свечение и частицы, как у igloo 1:1». Механика отклика в
   rv-частицы.js есть, подписка на события там же есть - но между ними
   стоит виденРой(), который молча отказывает, если рой не проявлен.
   Молчаливый отказ на живом сайте выглядит как «ничего не происходит»,
   и по коду этого не увидеть.

   Замер честный: шлём настоящие события в страницу и смотрим, поехали
   ли числа роя (номер движения и сила толчка), а не «есть ли
   обработчик».

   Запуск: node tools/отклик-роя.mjs */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 } });
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => {});

const беды = [];
for (const [акт, доля] of [["рубка", 0.5], ["пуск", 0.4]]) {
  await стр.evaluate(([а, д]) => window.RV_MOTION["кПунктy"](а, д), [акт, доля]);
  await стр.waitForTimeout(6000);

  const до = await стр.evaluate(() => {
    const з = window.RV_ЧАСТИЦЫ["замер"]();
    return { номер: з["отклик"], сила: з["сила"], альфа: з["альфа"], собрано: з["собрано"] };
  });
  if (!до.собрано) { беды.push(`${акт}: рой не собран`); continue; }
  if (до.альфа < 0.2) { беды.push(`${акт}: рой не проявлен (альфа ${до.альфа}), отклика не будет`); }

  /* Считаем звуковые поводы: у igloo отклик всегда со звуком. */
  await стр.evaluate(() => {
    window.__рой = 0;
    window.addEventListener("rv:рой", () => { window.__рой++; });
  });

  /* Касание точно по середине фигуры на экране. */
  const серед = await стр.evaluate(() => {
    const W = window.RV_WORLD["мир"]();
    const ф = window.RV_КОМНАТА["серединаФигуры"]();
    const т = new W.T.Vector3(ф.x, ф.y, ф.z).project(W.cam);
    return { x: Math.round((т.x * 0.5 + 0.5) * innerWidth), y: Math.round((0.5 - т.y * 0.5) * innerHeight) };
  });

  await стр.mouse.move(серед.x, серед.y);
  await стр.mouse.down();
  await стр.mouse.up();
  await стр.waitForTimeout(600);
  const посл = await стр.evaluate(() => {
    const з = window.RV_ЧАСТИЦЫ["замер"]();
    return { номер: з["отклик"], сила: з["сила"], звуков: window.__рой };
  });

  const сменился = посл.номер !== до.номер;
  console.log(`${акт.padEnd(7)} касание: движение ${до.номер} -> ${посл.номер}` +
              ` ${сменился ? "ОТВЕТИЛ" : "НЕ ОТВЕТИЛ"} · сила ${посл.сила} · звуков ${посл.звуков}`);
  if (!сменился) беды.push(`${акт}: касание по фигуре не вызвало отклика`);
  if (!посл.звуков) беды.push(`${акт}: отклик без звукового повода rv:рой`);

  /* Прокрутка: у роя своя придержка в треть секунды, поэтому ждём. */
  await стр.waitForTimeout(500);
  const доКр = посл.номер;
  await стр.evaluate(() => window.dispatchEvent(new Event("scroll")));
  await стр.waitForTimeout(500);
  const покр = await стр.evaluate(() => window.RV_ЧАСТИЦЫ["замер"]()["отклик"]);
  const крСменился = покр !== доКр;
  console.log(`${акт.padEnd(7)} прокрутка: движение ${доКр} -> ${покр} ${крСменился ? "ОТВЕТИЛ" : "НЕ ОТВЕТИЛ"}`);
  if (!крСменился) беды.push(`${акт}: прокрутка не вызвала отклика роя`);
}

await бр.close();
if (беды.length) {
  console.log("\nГРЯЗНО отклик роя");
  for (const б of беды) console.log("   " + б);
  process.exit(1);
}
console.log("\nЧИСТО отклик роя: фигура отвечает на касание и прокрутку, со звуком");
