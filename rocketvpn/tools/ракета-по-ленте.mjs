/* РАКЕТА ПО ЛЕНТЕ: размер, центр, материал и камера в одних числах.

   Владелец по снимкам: «камера не ровно на неё выходит, и высота,
   размер, материал и цвет ракеты постоянно меняется - считай камера
   гуляет туда-сюда».

   Замер отвечает на это прямо. На каждой доле снимаем:
     что видно   каменная сборка или металлический корабль
     высота      габарит предмета на экране, в точках
     центр x     смещение середины предмета от середины кадра
     камера      где стоит глаз и куда смотрит

   Скачок высоты назад (было крупнее, стало мельче) это отъезд камеры.
   Смещение центра это и есть «не ровно на неё выходит».

   Запуск: node tools/ракета-по-ленте.mjs [от] [до] [шагов]
*/
import { браузер, открыть, лентаВсего, кПрокрутке, ПК, ТЕЛЕФОН } from "./checks/общее.mjs";

const ОТ = Number(process.argv[2] || 0.60);
const ДО = Number(process.argv[3] || 1.00);
const ШАГОВ = Number(process.argv[4] || 40);

async function устояться(pg) {
  await pg.waitForTimeout(500);
  await pg.evaluate(() => new Promise((г) => {
    let n = 0;
    (function ш() { requestAnimationFrame(() => (++n >= 6 ? г() : ш())); })();
  })).catch(() => {});
}

const b = await браузер();
try {
  for (const э of [ПК, ТЕЛЕФОН]) {
    const { pg } = await открыть(b, э);
    await устояться(pg);
    const всего = await лентаВсего(pg);
    console.log("\n=== " + э.имя + " " + э.vp.width + "x" + э.vp.height + " ===");
    console.log("доля   что      высота  ширина  центр x  камера                 взгляд");
    for (let i = 0; i <= ШАГОВ; i++) {
      const д = ОТ + (ДО - ОТ) * (i / ШАГОВ);
      await кПрокрутке(pg, всего * д);
      await устояться(pg);
      const р = await pg.evaluate((ш) => {
        const мир = window.RV_WORLD["мир"](), T = window.THREE, cam = мир.cam;
        /* Ищем ПРЕДМЕТ РАКЕТЫ: каменную сборку и корабль финала.
           Стена и зал сюда не идут - у них свои имена. */
        function рамка(узел) {
          if (!узел) return null;
          let вид = узел.visible, у = узел.parent;
          while (у) { if (!у.visible) вид = false; у = у.parent; }
          if (!вид) return null;
          узел.updateMatrixWorld(true);
          let б; try { б = new T.Box3().setFromObject(узел); } catch (e) { return null; }
          if (!б || б.isEmpty()) return null;
          const xs = [], ys = [];
          for (let k = 0; k < 8; k++) {
            const v = new T.Vector3(k & 1 ? б.max.x : б.min.x, k & 2 ? б.max.y : б.min.y,
                                    k & 4 ? б.max.z : б.min.z).project(cam);
            xs.push((v.x * 0.5 + 0.5) * ш);
            ys.push((1 - v.y) * 0.5 * 900);
          }
          return {
            в: Math.round(Math.max(...ys) - Math.min(...ys)),
            ш: Math.round(Math.max(...xs) - Math.min(...xs)),
            цx: Math.round((Math.min(...xs) + Math.max(...xs)) / 2 - ш / 2)
          };
        }
        let камень = null, металл = null;
        мир.scene.traverse(function (о) {
          const и = о.name || "";
          if (!камень && /ракета.*кирпич|кирпич.*ракет|сборка/i.test(и)) камень = рамка(о);
          if (!металл && и === "финал") металл = рамка(о);
        });
        /* Сборка каменной ракеты живёт в модуле RV_СБОРКА - спросим его
           напрямую, если по имени не нашлось. */
        if (!камень) {
          try {
            const з = window.RV_СБОРКА && window.RV_СБОРКА["замер"] ? window.RV_СБОРКА["замер"]() : null;
            if (з && з["видно"]) камень = { в: -1, ш: -1, цx: 0 };
          } catch (e) {}
        }
        const х = window.RV_WORLD["ход"]();
        return { камень: камень, металл: металл, кам: х["камера"], взгляд: х["взгляд"] };
      }, э.vp.width);
      const п = р.металл || р.камень;
      const кто = р.металл ? "металл " : (р.камень ? "камень " : "нет    ");
      console.log(д.toFixed(3).padStart(5), кто,
        String(п ? п.в : "-").padStart(7), String(п ? п.ш : "-").padStart(7),
        String(п ? п.цx : "-").padStart(8), " ",
        JSON.stringify(р.кам).padEnd(22), JSON.stringify(р.взгляд));
    }
    await pg.close();
  }
} finally {
  await b.close();
}
