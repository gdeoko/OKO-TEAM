/* ПОДИУМ И КОРАБЛЬ В КАДРЕ: где они на экране на выходе из туннеля.

   Владелец решил, как должен выглядеть стык: «каменную вообще убрать,
   пусть подиум стоит на месте, когда с туннеля выходим камера едет
   прям, ракета просто сверху на готовый подиум перед нами прилетает,
   уже сразу металлическая».

   Первая же сборка по его слову вскрыла две беды, и обе видны только
   числом на экране, а не в мире:
     - подиум уезжает под нижний край, потому что камера целится выше;
     - ракета приходит уже севшей, потому что посадка укладывается в
       сотую долю ленты и пролетает между двумя кадрами замера.

   Замер печатает по каждой доле: рамку подиума и рамку корпуса в
   точках экрана, их низ и верх относительно кадра, и высоту подъёма
   корабля над местом посадки. Числа сразу говорят, что чинить.

   Запуск: node tools/подиум-в-кадре.mjs [от] [до] [шагов]
*/
import { браузер, открыть, лентаВсего, кПрокрутке, ПК, ТЕЛЕФОН } from "./checks/общее.mjs";

const ОТ = Number(process.argv[2] || 0.66);
const ДО = Number(process.argv[3] || 0.76);
const ШАГОВ = Number(process.argv[4] || 20);

async function устояться(pg) {
  await pg.waitForTimeout(420);
  await pg.evaluate(() => new Promise((г) => {
    let n = 0;
    (function ш() { requestAnimationFrame(() => (++n >= 5 ? г() : ш())); })();
  })).catch(() => {});
}

const b = await браузер();
try {
  for (const э of [ПК, ТЕЛЕФОН]) {
    const { pg } = await открыть(b, э);
    await устояться(pg);
    const всего = await лентаВсего(pg);
    console.log("\n=== " + э.имя + " " + э.vp.width + "x" + э.vp.height + " ===");
    console.log("доля   подиум: верх   низ   центрx | корпус: верх   низ  выс | подъём");
    for (let i = 0; i <= ШАГОВ; i++) {
      const д = ОТ + (ДО - ОТ) * (i / ШАГОВ);
      await кПрокрутке(pg, всего * д);
      await устояться(pg);
      const р = await pg.evaluate((вп) => {
        const мир = window.RV_WORLD["мир"](), T = window.THREE, cam = мир.cam;
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
            xs.push((v.x * 0.5 + 0.5) * вп.w);
            ys.push((1 - v.y) * 0.5 * вп.h);
          }
          return {
            верх: Math.round(Math.min(...ys)), низ: Math.round(Math.max(...ys)),
            цx: Math.round((Math.min(...xs) + Math.max(...xs)) / 2 - вп.w / 2),
            в: Math.round(Math.max(...ys) - Math.min(...ys))
          };
        }
        /* ── ПЛОЩАДКУ ИЩЕМ ВНУТРИ ФИНАЛА, А НЕ ПО ВСЕЙ СЦЕНЕ ────────
           Первый заход брал первую попавшуюся «площадку» из всей сцены
           и мерил ЧУЖУЮ: корабль зала и корабль финала собирает один и
           тот же модуль (rv-корабль.js), площадка у обоих называется
           одинаково, а зал в дереве стоит раньше.

           Числа от этого врали в одну сторону и очень убедительно:
           замер печатал подиум на экранной строке 890 при кадре в 900
           точек, то есть «подиум ушёл под нижний край». На самом деле
           подиум финала стоял на 653..843, ровно в кадре. */
        let подиум = null, корпус = null, финал = null;
        мир.scene.traverse(function (о) { if (о.name === "финал" && !финал) финал = о; });
        if (финал) финал.traverse(function (о) {
          if (о.name === "площадка" && !подиум) подиум = о;
          if (!корпус && /^снаружи$/i.test(о.name || "")) корпус = о;
        });
        return {
          п: рамка(подиум), к: рамка(корпус),
          подъём: финал ? Number((финал.position.y).toFixed(2)) : null
        };
      }, { w: э.vp.width, h: э.vp.height });
      const п = р.п, к = р.к;
      console.log(
        д.toFixed(3).padStart(5),
        String(п ? п.верх : "-").padStart(12),
        String(п ? п.низ : "-").padStart(6),
        String(п ? п.цx : "-").padStart(8), " |",
        String(к ? к.верх : "-").padStart(12),
        String(к ? к.низ : "-").padStart(6),
        String(к ? к.в : "-").padStart(5),
        String(р.подъём === null ? "-" : р.подъём).padStart(8)
      );
    }
    await pg.close();
  }
} finally {
  await b.close();
}
