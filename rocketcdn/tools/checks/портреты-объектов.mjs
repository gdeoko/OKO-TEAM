/* ПОРТРЕТ КАЖДОГО ОБЪЕКТА КОСМОСА, КРУПНЫМ ПЛАНОМ.

   Владелец: «всё, что можешь, реалистичность доделать в объектах,
   которые в космосе - кометы, метеориты, разные спутники, космические
   корабли, всё, что там есть, нужно ультрареалистичным сделать».

   Судить об этом по общему кадру нельзя: спутник в нём занимает
   двадцать точек, и любая халтура в нём выглядит одинаково. Поэтому
   проверка ставит камеру вплотную к каждому объекту и снимает его
   портрет - дальше на снимок смотрят глазами.

   Заодно печатает числа, по которым видно грубую работу без глаз:
   сколько у объекта узлов, треугольников и материалов. Спутник из
   трёх коробок и спутник из двадцати деталей отличаются числом ещё
   до того, как их увидишь.

   Запуск: node tools/checks/портреты-объектов.mjs [тел|пк]
*/
const { chromium } = await import(process.env.RC_PW ||
  await Promise.any([
    import("/tmp/node_modules/playwright/index.mjs").then(() => "/tmp/node_modules/playwright/index.mjs"),
    import("/tmp/node_modules/playwright-core/index.mjs").then(() => "/tmp/node_modules/playwright-core/index.mjs")
  ]));
import { mkdirSync } from "node:fs";

const { БРАУЗЕР } = await import("../../../rocketvpn/tools/браузер.mjs");

const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123";
const КТО = process.argv[2] || "пк";
const экран = КТО === "пк"
  ? { w: 1440, h: 900, dpr: 2, mob: false }
  : { w: 390, h: 844, dpr: 3, mob: true };
const КУДА = "/tmp/портреты/" + КТО;
mkdirSync(КУДА, { recursive: true });

/* Имя узла в мире и с какого расстояния на него смотреть. Положительное
   число это дальность в РАДИУСАХ объекта: у Юпитера и у спутника разный
   размер, а кадр должен выйти одинаковым.

   Отрицательное это дальность в единицах мира напрямую, и она нужна
   там, где габарит обманывает. У кометы хвост длиной в сотню единиц,
   и коробка вокруг неё на порядок больше самого ядра: кадр «в двух
   радиусах» уводил камеру за край хвоста, и в нём не было видно ни
   ядра, ни хвоста. */
const ОБЪЕКТЫ = [
  ["sat", 2.2], ["comet", -22], ["earth", 2.6], ["moon", 3.0],
  ["mars", 3.0], ["saturn", 2.4], ["jupiter", 2.6], ["sun", 3.2],
  ["belt1", 1.2], ["milky", 1.6]
];

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({
  viewport: { width: экран.w, height: экран.h },
  deviceScaleFactor: экран.dpr, isMobile: экран.mob, hasTouch: экран.mob
});
const беды = [];
стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 160)));

/* Признак отладки открывает служебные ходы сборки, в том числе тот,
   которым тут двигают камеру. Наружу он закрыт нарочно. */
await стр.goto(АДРЕС + "/?flight=1&rcdbg=1", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(() => window.RC_FLIGHT && window.RC_FLIGHT.open, null, { timeout: 120000 })
  .catch(() => беды.push("полёт не поднялся"));
await стр.waitForTimeout(1500);
await стр.evaluate(() => { try { window.RC_FLIGHT.open(); } catch (e) {} });
await стр.waitForFunction(() => {
  try { const с = window.RC_FLIGHT.stats(); return !!(с && с["треугольники"] > 2000); }
  catch (e) { return false; }
}, null, { timeout: 180000 }).catch(() => беды.push("сцена не собралась"));
await стр.evaluate(() => {
  const б = document.querySelector('.rcf-brief [data-mode="manual"]');
  if (б) б.click();
});
await стр.waitForTimeout(2500);
/* Кадр останавливаем: иначе цикл полёта увезёт камеру обратно на
   маршрут раньше, чем снимок будет сделан, и портреты выйдут все
   одинаковые - вид с борта. */
await стр.evaluate(() => { try { window.RC_FLIGHT._замереть(true); } catch (e) {} });

console.log(`\n${КТО} ${экран.w}x${экран.h} dpr ${экран.dpr}`);

for (const [имя, даль] of ОБЪЕКТЫ) {
  const з = await стр.evaluate(([имя, даль]) => {
    const F = window.RC_FLIGHT;
    const W = F._мир ? F._мир() : null;
    if (!W) return { нет: "мир наружу не отдан" };
    const узел = W[имя];
    if (!узел) return { нет: "узла нет в мире" };
    const T = window.THREE;
    узел.updateMatrixWorld(true);
    const к = new T.Box3().setFromObject(узел);
    if (к.isEmpty()) return { нет: "узел пустой" };
    const ц = к.getCenter(new T.Vector3());
    const р = к.getSize(new T.Vector3()).length() * 0.5;
    /* Считаем состав: по нему халтура видна числом. */
    let мешей = 0, треуг = 0, матов = new Set();
    узел.traverse(function (о) {
      if (!о.isMesh && !о.isPoints && !о.isSprite) return;
      мешей++;
      if (о.material) матов.add(о.material.uuid);
      const г = о.geometry;
      if (г && г.index) треуг += г.index.count / 3;
      else if (г && г.attributes && г.attributes.position && о.isMesh) треуг += г.attributes.position.count / 3;
    });
    /* Смотрим в НАЧАЛО узла, а не в середину его коробки. У кометы
       начало это ядро, а середина коробки лежит посреди хвоста. */
    const цель = узел.getWorldPosition(new T.Vector3());
    const аим = даль < 0 ? цель : ц;
    /* Ставим камеру сбоку и чуть сверху: прямо в лоб любой предмет
       читается плоско, а три четверти показывают объём. */
    const d = даль < 0 ? -даль : Math.max(2, р * даль);
    W.cam.position.set(аим.x + d * 0.72, аим.y + d * 0.34, аим.z + d * 0.60);
    W.cam.lookAt(аим);
    W.cam.updateMatrixWorld(true);
    return { мешей, треуг: Math.round(треуг), матов: матов.size, радиус: +р.toFixed(2) };
  }, [имя, даль]);

  if (з && з.нет) { console.log(`  ${имя.padEnd(9)} ${з.нет}`); беды.push(`${имя}: ${з.нет}`); continue; }
  /* Кадр стоит, поэтому рисуем его руками - иначе на холсте останется
     то, что нарисовали до остановки. */
  await стр.evaluate(() => { try { window.RC_FLIGHT._кадр(); } catch (e) {} });
  await стр.waitForTimeout(250);
  await стр.screenshot({ path: `${КУДА}/${имя}.png` });
  console.log(`  ${имя.padEnd(9)} узлов ${String(з.мешей).padStart(4)}  треугольников ${String(з.треуг).padStart(7)}` +
              `  материалов ${String(з.матов).padStart(3)}  радиус ${з.радиус}`);
}

if (беды.length) {
  console.log("\nКРАСНОЕ:");
  for (const с of [...new Set(беды)]) console.log("   " + с);
}
console.log(`  снимки: ${КУДА}`);
await бр.close();
process.exit(беды.length ? 1 : 0);
