/* ДЕРЖИТСЯ ЛИ ВЫКЛЮЧАТЕЛЬ. Проверка самого замера, а не сайта.

   Половина сцены переписывает свои поля КАЖДЫМ кадром: акт финала
   пишет силу ламп (станСила), комната пишет visible, мир пишет
   плотность по размеру окна. Выключатель, поставленный один раз,
   такой записью отменяется молча - и замер честно печатает «цена ноль»
   там, где он просто ничего не выключил.

   Поэтому перед выводами проверяем каждый выключатель: ставим, ждём
   две секунды живых кадров, читаем обратно. Не удержалось - вывод по
   этому слагаемому недействителен.

   Запуск: node tools/держится-ли.mjs
*/
import { браузер, открыть, лентаВсего, кПрокрутке, ПК } from "./checks/общее.mjs";

const b = await браузер();
try {
  const { pg } = await открыть(b, ПК);
  await pg.waitForTimeout(4000);
  const всего = await лентаВсего(pg);

  for (const д of [0.0, 0.3, 0.6, 0.8, 1.0]) {
    await кПрокрутке(pg, всего * д);
    await pg.waitForTimeout(2500);

    /* 1. ЛАМПЫ. Гасим все и через две секунды читаем силу обратно. */
    const лампы = await pg.evaluate(() => {
      const мир = window.RV_WORLD["мир"]();
      const сп = [];
      мир.scene.traverse(function (о) { if (о.isLight) сп.push(о); });
      window.__л = сп;
      let было = 0;
      for (const л of сп) { if (л.intensity > 0) было++; л.intensity = 0; }
      return { всего: сп.length, горело: было };
    });
    await pg.waitForTimeout(2000);
    const лампыПосле = await pg.evaluate(() =>
      window.__л.filter((л) => л.intensity > 0).length);

    /* 2. ПЛОТНОСТЬ. Ставим половину и читаем обратно. */
    const плот = await pg.evaluate(() => {
      const r = window.RV_WORLD["мир"]().r;
      if (!r || !r.getPixelRatio) return null;
      const было = r.getPixelRatio();
      r.setPixelRatio(было * 0.5);
      return было;
    });
    await pg.waitForTimeout(2000);
    const плотПосле = await pg.evaluate(() => {
      const r = window.RV_WORLD["мир"]().r;
      return r && r.getPixelRatio ? r.getPixelRatio() : null;
    });

    /* 3. ТОЧКИ. Гасим облака частиц и читаем обратно. */
    const точки = await pg.evaluate(() => {
      const мир = window.RV_WORLD["мир"]();
      const сп = [];
      мир.scene.traverse(function (о) { if (о.isPoints) сп.push(о); });
      window.__т = сп;
      let было = 0;
      for (const о of сп) { if (о.visible) было++; о.visible = false; }
      return { всего: сп.length, видно: было };
    });
    await pg.waitForTimeout(2000);
    const точкиПосле = await pg.evaluate(() =>
      window.__т.filter((о) => о.visible).length);

    /* Вернуть всё как было - дальше идёт следующая доля. */
    await pg.reload({ waitUntil: "domcontentloaded" });
    await pg.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"], null, { timeout: 120000 });
    await pg.waitForTimeout(3000);

    const в = (что, было, стало) =>
      что + ": гасили " + было + ", через 2с горит " + стало +
      (стало > 0 ? "  ВЫКЛЮЧАТЕЛЬ НЕ ДЕРЖИТСЯ" : "  держится");
    console.log("\n== доля " + д.toFixed(2));
    console.log("  " + в("лампы", лампы.горело, лампыПосле) + " (всего " + лампы.всего + ")");
    console.log("  точки: гасили " + точки.видно + ", через 2с видно " + точкиПосле +
      (точкиПосле > 0 ? "  ВЫКЛЮЧАТЕЛЬ НЕ ДЕРЖИТСЯ" : "  держится") + " (всего " + точки.всего + ")");
    console.log("  плотность: было " + плот + ", ставили " + (плот * 0.5) +
      ", через 2с " + плотПосле +
      (Math.abs(плотПосле - плот * 0.5) > 0.01 ? "  ВЫКЛЮЧАТЕЛЬ НЕ ДЕРЖИТСЯ" : "  держится"));
  }
  await pg.close();
} finally {
  await b.close();
}
