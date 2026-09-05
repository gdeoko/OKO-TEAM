/* Замер ДВУХ РАКЕТ: где и какого размера каждая.

   ЗАЧЕМ. Владелец: «камера летит вроде ровно к ракете сверху, и потом
   вправо куда-то уходит, и ракета в другом месте появляется сразу, шов
   есть». Ракет в мире действительно две: рой в комнате (rv-комната.js,
   он же становится цельным после победы) и корабль финала
   (rv-финал.js). Стоят они в разных точках и разного размера, и человек
   облетает одну, а заходит в другую.

   Печатает мировую коробку каждой: середину, полуширину, высоту, низ и
   верх. По этим числам считается, куда и во сколько раз переставить
   корабль финала, чтобы он встал НА МЕСТО роя.

   Запуск: node tools/две-ракеты.mjs */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const стр = await бр.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
await стр.waitForFunction(
  () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
  null, { timeout: 240000 }).catch(() => {});

/* Обе сцены собираются лениво. Провозим ленту по обоим актам, иначе
   мерить будет нечего. */
for (const [имя, доля] of [["пуск", 0.5], ["финал", 0.5]]) {
  await стр.evaluate(([и, д]) => window.RV_MOTION["кПунктy"](и, д), [имя, доля]);
  await стр.waitForTimeout(1500);
}
await стр.waitForTimeout(1500);

const итог = await стр.evaluate(() => {
  const W = window.RV_WORLD["мир"]();
  const T = W.T;
  function коробка(узел) {
    if (!узел) return null;
    const б = new T.Box3();
    /* Считаем по ВИДИМЫМ мешам: у групп в родителях лежат ещё пол,
       дымка и цилиндр текста, и коробка группы вышла бы вшестеро
       больше самого предмета. */
    б.makeEmpty();
    узел.updateMatrixWorld(true);
    узел.traverse(function (о) {
      if (!о.isMesh && !о.isInstancedMesh && !о.isPoints) return;
      if (!о.geometry) return;
      if (!о.geometry.boundingBox) о.geometry.computeBoundingBox();
      const к = о.geometry.boundingBox.clone().applyMatrix4(о.matrixWorld);
      б.union(к);
    });
    if (б.isEmpty()) return null;
    const с = б.getCenter(new T.Vector3()), р = б.getSize(new T.Vector3());
    return {
      центр: [+с.x.toFixed(2), +с.y.toFixed(2), +с.z.toFixed(2)],
      размер: [+р.x.toFixed(2), +р.y.toFixed(2), +р.z.toFixed(2)],
      низ: +б.min.y.toFixed(2), верх: +б.max.y.toFixed(2)
    };
  }
  const о = {};
  const комн = window.RV_КОМНАТА && window.RV_КОМНАТА["узел"] && window.RV_КОМНАТА["узел"]();
  if (комн) {
    о["комната"] = { место: [комн.position.x, комн.position.y, комн.position.z] };
    /* Рой и цельный корабль лежат внутри комнаты отдельными узлами. */
    комн.traverse(function (у) {
      if (у.name && /рой|фигура|ракета|корабл/i.test(у.name)) {
        о["комната:" + у.name] = коробка(у);
      }
    });
    о["комната вся"] = коробка(комн);
  }
  const фин = window.RV_ФИНАЛ && window.RV_ФИНАЛ["узел"] && window.RV_ФИНАЛ["узел"]();
  if (фин) {
    фин.visible = true;
    let вн = фин;
    while (вн.parent && вн.parent !== W.scene) вн = вн.parent;
    о["финал корень"] = { место: [вн.position.x, вн.position.y, вн.position.z] };
    фин.traverse(function (у) {
      if (у.name && /снаружи|корабл/i.test(у.name)) о["финал:" + у.name] = коробка(у);
    });
    о["финал весь"] = коробка(фин);
  }
  return о;
});

console.log(JSON.stringify(итог, null, 2));
await бр.close();
