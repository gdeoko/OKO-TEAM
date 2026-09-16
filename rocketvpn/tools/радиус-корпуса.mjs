/* РАДИУС ТЕЛА КОРПУСА, А НЕ ГАБАРИТ С ОПЕРЕНИЕМ.

   ЗАЧЕМ. Рубка меньше корпуса, в который вставлена, в 5.57 раза, и
   сквозь проём люка человек видит её снаружи (разбор в ПРИЁМКА.md).
   Лечится масштабом, и множитель нельзя взять как отношение габаритных
   коробок: в коробку корпуса 12.806 входят стабилизаторы, которые
   торчат далеко за обшивку. Посадить рубку по кончикам плавников значит
   сделать её вдвое больше нужного.

   ЧТО ДЕЛАЕТ. Обходит корпус по телам и считает для каждого радиус в
   плоскости XZ от оси ракеты - отдельно для каждого тела, с именем и
   путём. Тело обшивки узнаётся по двум признакам сразу: оно круглое в
   сечении (радиус почти одинаков по всем углам) и высокое. Плавник даёт
   большой радиус лишь в узком секторе углов, и по этому признаку
   отсеивается.

   Радиус считаем по ВЕРШИНАМ, а не по коробке: коробка круглого тела и
   коробка плавника выглядят одинаково, а по вершинам видно, занимает ли
   тело весь круг.

   Запуск: node tools/радиус-корпуса.mjs [пк|тел] [доля] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "пк";
const ДОЛЯ = +(process.argv[3] || 0.20);
const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const экран = КТО === "пк" ? { width: 1440, height: 900 } : { width: 390, height: 844 };

const бр = await chromium.launch({
  executablePath: БРАУЗЕР,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});
const кон = await бр.newContext({ viewport: экран, deviceScaleFactor: 1 });
const стр = await кон.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 160)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 180000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(2500);
await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("финал", д), ДОЛЯ);
await стр.waitForTimeout(3000);

const из = await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  const T = W.T;
  /* Ось ракеты: центр узла «снаружи» по X и Z. */
  let снаружи = null, финал = null;
  W.scene.traverse(function (о) {
    if (!снаружи && о.name === "снаружи") снаружи = о;
    if (!финал && о.name === "финал") финал = о;
  });
  if (!снаружи) return { нет: "узел «снаружи» не найден" };
  снаружи.updateMatrixWorld(true);
  const ось = new T.Vector3();
  снаружи.getWorldPosition(ось);

  const СЕКТОРОВ = 24;
  const тела = [];
  снаружи.traverse(function (о) {
    if (!о.isMesh || !о.geometry || !о.geometry.attributes || !о.geometry.attributes.position) return;
    let p = о, видно = true;
    while (p) { if (!p.visible) { видно = false; break; } p = p.parent; }
    const поз = о.geometry.attributes.position;
    const N = poz_len(поз);
    if (!N) return;
    о.updateMatrixWorld(true);
    /* Наибольший радиус в каждом секторе углов: круглое тело заполнит
       все двадцать четыре, плавник два или три. */
    const макс = new Array(СЕКТОРОВ).fill(0);
    let низ = 1e9, верх = -1e9, общийМакс = 0;
    const шаг = Math.max(1, Math.floor(N / 4000));
    const в = new T.Vector3();
    for (let i = 0; i < N; i += шаг) {
      в.fromBufferAttribute(поз, i).applyMatrix4(о.matrixWorld);
      const dx = в.x - ось.x, dz = в.z - ось.z;
      const р = Math.sqrt(dx * dx + dz * dz);
      if (р > общийМакс) общийМакс = р;
      if (в.y < низ) низ = в.y;
      if (в.y > верх) верх = в.y;
      let сек = Math.floor((Math.atan2(dz, dx) + Math.PI) / (2 * Math.PI) * СЕКТОРОВ);
      if (сек < 0) сек = 0; if (сек >= СЕКТОРОВ) сек = СЕКТОРОВ - 1;
      if (р > макс[сек]) макс[сек] = р;
    }
    /* Круглость: медиана секторных радиусов к наибольшему. У цилиндра
       это около единицы, у плавника мало. */
    const ряд = макс.slice().sort(function (a, b) { return a - b; });
    const медиана = ряд[Math.floor(СЕКТОРОВ / 2)];
    тела.push({
      имя: о.name || о.type,
      путь: (function () { const ч = []; let q = о; while (q && ч.length < 4) { ч.unshift(q.name || q.type); q = q.parent; } return ч.join("/"); })(),
      видно: видно,
      радиусМакс: +общийМакс.toFixed(3),
      радиусМедиана: +медиана.toFixed(3),
      круглость: +(общийМакс > 0 ? медиана / общийМакс : 0).toFixed(3),
      высота: +(верх - низ).toFixed(3),
      вершин: N
    });
    function poz_len(a) { return a.count || 0; }
  });
  return { ось: [+ось.x.toFixed(2), +ось.y.toFixed(2), +ось.z.toFixed(2)], тела: тела };
});
await бр.close();

if (из.нет) { console.log("нет: " + из.нет); process.exit(1); }

console.log(`РАДИУС ТЕЛА КОРПУСА ${КТО} ${экран.width}x${экран.height}, финал доля ${ДОЛЯ}`);
console.log(`  ось ракеты ${из.ось.join(", ")}`);
из.тела.sort((a, b) => b.радиусМакс - a.радиусМакс);
for (const т of из.тела) {
  console.log(`  ${т.видно ? "виден" : "скрыт"}  радиус макс ${String(т.радиусМакс).padEnd(7)} ` +
              `медиана ${String(т.радиусМедиана).padEnd(7)} круглость ${String(т.круглость).padEnd(6)} ` +
              `высота ${String(т.высота).padEnd(7)} вершин ${String(т.вершин).padEnd(6)} ${т.путь}`);
}
/* Обшивка это самое круглое и высокое из видимых. Порог круглости 0.8:
   у цилиндра она около единицы, у плавника заметно ниже. */
const обшивка = из.тела
  .filter((т) => т.видно && т.круглость >= 0.8)
  .sort((a, b) => b.радиусМакс - a.радиусМакс)[0];
if (!обшивка) {
  console.log("  круглого тела среди видимых нет: смотреть список глазами");
  process.exit(1);
}
console.log(`  ОБШИВКА: ${обшивка.путь}`);
console.log(`  радиус тела ${обшивка.радиусМакс} мировых, поперечник ${(обшивка.радиусМакс * 2).toFixed(3)}`);
/* Рубка: R_БОРТ 3.45 местных на масштаб узла финала. */
console.log(`  для сравнения: борт рубки 3.45 местных x 0.377 = ${(3.45 * 0.377).toFixed(3)} мировых,` +
            ` поперечник ${(3.45 * 0.377 * 2).toFixed(3)}`);
console.log(`  МНОЖИТЕЛЬ ПОСАДКИ = ${(обшивка.радиусМакс / (3.45 * 0.377)).toFixed(4)}`);
