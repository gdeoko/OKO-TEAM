/* ЧТО НА САМОМ ДЕЛЕ СТОИТ В КАДРЕ. Разбор по слагаемым.

   Замер цены света (tools/цена-света.mjs) показал, что живой свет не
   стоит НИЧЕГО: гашение всех источников меняет время кадра на -10..+7
   процентов, то есть в пределах разброса между двумя замерами одного и
   того же. Значит кадр съедает что-то другое, и запекание света это
   день работы ради нуля.

   Здесь снимаем слагаемые по одному. Порядок тот же: замерить при
   живом, выключить одно, замерить снова, вернуть. Разница это цена.

   Слагаемые:
     плёнка     весь послепроходный конвейер (ореол, тон, зерно)
     точки      облака частиц (пыль, рой, звёзды)
     плотность  разрешение холста: считаем в половину и смотрим
     сцена      вся отрисовка целиком (пустая сцена как пол замера)

   Отрисовщик программный, абсолютные числа выше живых. Смотрим ДОЛЮ.

   Запуск: node tools/цена-кадра.mjs [шагов]
*/
import { браузер, открыть, лентаВсего, кПрокрутке, ТЕЛЕФОН, ПК } from "./checks/общее.mjs";

const ШАГОВ = Number(process.argv[2] || 5);
const ПРОГРЕВ = 12, СЧЁТ = 24;

async function времяКадра(pg) {
  return pg.evaluate(([п, с]) => new Promise((готово) => {
    const т = [];
    let n = 0, прошлое = performance.now();
    (function шаг() {
      requestAnimationFrame(() => {
        const т2 = performance.now();
        if (++n > п) т.push(т2 - прошлое);
        прошлое = т2;
        if (т.length >= с) {
          т.sort((a, b) => a - b);
          готово(Math.round(т[Math.floor(т.length / 2)] * 10) / 10);
        } else шаг();
      });
    })();
  }), [ПРОГРЕВ, СЧЁТ]);
}

/* Каждое слагаемое умеет выключиться и вернуться. Возврат обязателен:
   следующий замер идёт по той же странице.

   Живут они В СТРАНИЦЕ, а не здесь: между двумя замерами надо помнить
   исходное значение, а всё, что уходит в evaluate, каждый раз приезжает
   заново. Поэтому кладём их один раз в `window.__слаг` и дальше только
   зовём по имени. */
const СЛАГАЕМЫЕ = {
  /* Пост считает ПЛЁНКА, и зовут её `плёнка.render(scene, cam, часы)`
     (rv-world.js:2988). Выключить её значит нарисовать ту же сцену
     напрямую рисовальщиком `W.r`: тогда из кадра уходит только
     послепроходный конвейер, а геометрия и материалы остаются. */
  "плёнка": (выкл) => {
    const мир = window.RV_WORLD["мир"]();
    if (!мир || !мир["плёнка"] || !мир.r) return false;
    const п = мир["плёнка"];
    if (!window.__постБыл) window.__постБыл = п.render;
    п.render = выкл
      ? function (сц, к) { мир.r.render(сц, к); }
      : window.__постБыл;
    return true;
  },
  /* Пол замера: не рисуем вовсе. Всё, что остаётся, это счёт сцены -
     ход камеры, доли актов, шейдерные переменные, обход дерева. */
  "без отрисовки": (выкл) => {
    const мир = window.RV_WORLD["мир"]();
    if (!мир || !мир["плёнка"]) return false;
    const п = мир["плёнка"];
    if (!window.__постБыл2) window.__постБыл2 = п.render;
    п.render = выкл ? function () {} : window.__постБыл2;
    return true;
  },
  "точки": (выкл) => {
    const мир = window.RV_WORLD["мир"]();
    if (!window.__точки) {
      window.__точки = [];
      мир.scene.traverse(function (о) {
        if (о.isPoints) window.__точки.push({ о: о, в: о.visible });
      });
    }
    for (const п of window.__точки) п.о.visible = выкл ? false : п.в;
    return window.__точки.length > 0;
  },
  /* Рисовальщик лежит в `W.r`, а не в `W.renderer`: прежний замер по
     чужому имени молча отвечал «нет» и печатал прочерк там, где должно
     было стоять число. */
  "плотность": (выкл) => {
    const мир = window.RV_WORLD["мир"]();
    const r = мир && мир.r;
    if (!r || !r.getPixelRatio) return false;
    if (!window.__плот) window.__плот = r.getPixelRatio();
    r.setPixelRatio(выкл ? window.__плот * 0.5 : window.__плот);
    if (мир["плёнка"] && мир["плёнка"].размер) {
      const п = выкл ? 0.5 : 1;
      мир["плёнка"].размер(Math.round(window.innerWidth * window.__плот * п),
                           Math.round(window.innerHeight * window.__плот * п));
    }
    return true;
  }
};

const b = await браузер();
try {
  for (const э of [ПК, ТЕЛЕФОН]) {
    const { pg } = await открыть(b, э);
    await pg.waitForTimeout(4000);
    /* Кладём слагаемые в страницу одной строкой. */
    await pg.evaluate((свод) => {
      window.__слаг = {};
      for (const имя of Object.keys(свод)) window.__слаг[имя] = new Function("выкл", свод[имя]);
    }, Object.fromEntries(Object.entries(СЛАГАЕМЫЕ).map(([и, ф]) => {
      const т = ф.toString();
      return [и, "return (" + т + ")(выкл);"];
    })));
    const всего = await лентаВсего(pg);
    console.log("\n=== " + э.имя + " " + э.vp.width + "x" + э.vp.height + " ===");
    console.log("доля   кадр     плёнка       точки    плотность/2  без отрисовки");
    for (let i = 0; i <= ШАГОВ; i++) {
      const д = i / ШАГОВ;
      await кПрокрутке(pg, всего * д);
      await pg.waitForTimeout(2500);
      const база = await времяКадра(pg);
      const строка = [];
      for (const имя of Object.keys(СЛАГАЕМЫЕ)) {
        const есть = await pg.evaluate(([и, в]) => {
          const ф = window.__слаг[и];
          return ф(в);
        }, [имя, true]).catch(() => false);
        if (!есть) { строка.push("нет".padStart(12)); continue; }
        const без = await времяКадра(pg);
        await pg.evaluate(([и, в]) => window.__слаг[и](в), [имя, false]);
        const цена = база - без;
        строка.push((Math.round(100 * цена / база) + "% (" + Math.round(цена) + "мс)").padStart(12));
      }
      console.log(д.toFixed(2).padStart(5), (база + "мс").padStart(8), строка.join(" "));
    }
    await pg.close();
  }
} finally {
  await b.close();
}
