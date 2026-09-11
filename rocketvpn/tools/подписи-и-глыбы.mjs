/* ПОДПИСЬ НЕ ДОЛЖНА ЛЕЖАТЬ ПОД ГЛЫБОЙ, И ЭТО СЧИТАЕТСЯ ЧИСЛОМ.

   На снимке владельца слово «открывается» закрыто ледяной плитой: у
   глыбы яркая кромка и плотное тело, и подпись под ней пропадает.
   Глазом такое ловится только на том устройстве, где совпало, а
   совпадает оно от поворота глыбы и ширины кадра.

   Здесь у каждой глыбы и у каждой подписи берётся прямоугольник на
   экране, и считается доля подписи, накрытая любой глыбой. Ноль
   означает, что текст чист. Порог низкий: даже десятая часть слова под
   камнем делает строку нечитаемой.

   Запуск: node tools/подписи-и-глыбы.mjs [тел|пк] [доля-периметра] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "тел";
const ДОЛЯ = +(process.argv[3] || 0.66);
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "тел" ? { width: 390, height: 844 } : { width: 1440, height: 900 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({
  viewport: экран, deviceScaleFactor: 1, isMobile: КТО === "тел", hasTouch: КТО === "тел"
});
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 140)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(4000);
await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("периметр", д), ДОЛЯ);
await стр.evaluate(() => new Promise((г) => {
  let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 20 ? г() : ш())); })();
}));

const из = await стр.evaluate(() => {
  const T = window.THREE, мир = window.RV_WORLD["мир"](), cam = мир.cam;
  cam.updateMatrixWorld(true);
  let сцена = cam; while (сцена.parent) сцена = сцена.parent;
  сцена.updateMatrixWorld(true);
  const короб = new T.Box3(), п = new T.Vector3();
  function виден(о) { for (let у = о; у; у = у.parent) if (!у.visible) return false; return true; }
  /* Прямоугольник тела на экране в долях кадра. Считаем по углам его
     же габаритной коробки: точнее не нужно, а дешевле не бывает. */
  function рамка(о) {
    try { короб.setFromObject(о); } catch (e) { return null; }
    if (короб.isEmpty()) return null;
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9, спереди = 0;
    for (let b = 0; b < 8; b++) {
      п.set(b & 1 ? короб.max.x : короб.min.x,
            b & 2 ? короб.max.y : короб.min.y,
            b & 4 ? короб.max.z : короб.min.z).project(cam);
      if (п.z > -1 && п.z < 1) спереди++;
      x0 = Math.min(x0, п.x); x1 = Math.max(x1, п.x);
      y0 = Math.min(y0, п.y); y1 = Math.max(y1, п.y);
    }
    return спереди ? { x0, x1, y0, y1 } : null;
  }
  const глыбы = [], подписи = [];
  сцена.traverse((о) => {
    if (!о.isMesh || !виден(о)) return;
    const имя = о.name || "";
    if (имя.indexOf("лёд:") === 0) {
      const р = рамка(о);
      if (р) глыбы.push({ имя, р });
    } else if (имя.indexOf("текст:") === 0 && о.parent &&
               о.parent.name === "выноска") {
      /* Берём ТОЛЬКО подписи глыб: заголовки акта живут у камеры и к
         камню отношения не имеют. */
      const р = рамка(о);
      if (р) подписи.push({ имя, р });
    }
  });
  /* Доля подписи, накрытая глыбами. Считаем объединение накрытий сеткой
     по самой подписи: прямоугольники могут перекрываться между собой, и
     складывать их площади значило бы посчитать одно место дважды. */
  const свод = подписи.map((т) => {
    const Ш = 40, В = 14;
    let накрыто = 0;
    for (let j = 0; j < В; j++) {
      for (let i = 0; i < Ш; i++) {
        const x = т.р.x0 + (т.р.x1 - т.р.x0) * ((i + 0.5) / Ш);
        const y = т.р.y0 + (т.р.y1 - т.р.y0) * ((j + 0.5) / В);
        for (const г of глыбы) {
          if (x >= г.р.x0 && x <= г.р.x1 && y >= г.р.y0 && y <= г.р.y1) { накрыто++; break; }
        }
      }
    }
    return { подпись: т.имя.replace("текст: ", ""),
             доляПодНожом: +(накрыто / (Ш * В)).toFixed(3),
             рамка: [+т.р.x0.toFixed(2), +т.р.y0.toFixed(2), +т.р.x1.toFixed(2), +т.р.y1.toFixed(2)] };
  });
  return { глыб: глыбы.length, глыбы: глыбы.map((г) => ({
    имя: г.имя, рамка: [+г.р.x0.toFixed(2), +г.р.y0.toFixed(2), +г.р.x1.toFixed(2), +г.р.y1.toFixed(2)] })), свод };
});

console.log(`ПОДПИСИ И ГЛЫБЫ ${КТО} ${экран.width}x${экран.height}, периметр ${ДОЛЯ}`);
for (const г of из.глыбы) console.log(`  глыба ${г.имя.padEnd(16)} ${JSON.stringify(г.рамка)}`);
for (const с of из.свод) {
  console.log(`  подпись «${с.подпись}» ${JSON.stringify(с.рамка)}` +
              `  под камнем ${Math.round(с.доляПодНожом * 100)}%`);
}
const беды = из.свод.filter((с) => с.доляПодНожом > 0.06);
if (беды.length) {
  console.log("ГРЯЗНО  подпись под глыбой");
  for (const б of беды) {
    console.log(`   «${б.подпись}»: ${Math.round(б.доляПодНожом * 100)}% строки закрыто камнем`);
  }
  await бр.close();
  process.exit(1);
}
console.log("ЧИСТО  ни одна подпись не закрыта глыбой");
await бр.close();
