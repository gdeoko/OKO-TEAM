/* Замер лунной сцены: где в кадре стоит дом, где стена и стоит ли камера.

   Отвечает числами на три требования владельца по первым двум экранам:
     1. камера не двигается ВООБЩЕ между домом и стеной;
     2. фон (Луна, космос, Земля) не меняется;
     3. дом и стена стоят на грунте ровно, каждый в своей доле кадра.

   Считает экранные координаты габаритной коробки купола и кладки в
   долях кадра (-1 низ, +1 верх), положение камеры на каждой доле и
   разброс этих положений.

   Запуск: node tools/замер-луны.mjs            оба кадра
           node tools/замер-луны.mjs тел        только телефон */
import { chromium } from "playwright";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const ПК = { width: 1440, height: 900 };
const ТЕЛ = { width: 390, height: 844 };
const какой = process.argv[2] || "оба";

const бр = await chromium.launch({
  /* Браузер берём предустановленный: версия playwright в окружении
     новее, чем скачанная сборка, и своей она не находит. */
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome", 
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--force-device-scale-factor=1"]
});

/* Долевые точки, на которых снимаем: начало дома, середина разборки,
   собранная стена, середина обстрела. */
const ТОЧКИ = [
  ["станция", 0.00], ["станция", 0.30], ["станция", 0.70], ["станция", 0.99],
  ["периметр", 0.05], ["периметр", 0.50], ["периметр", 0.95]
];

async function снять(вьюпорт, метка) {
  const стр = await бр.newPage({ viewport: вьюпорт, deviceScaleFactor: 1 });
  const беды = [];
  стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 200)));
  стр.on("console", (m) => { if (m.type() === "error") беды.push("КОНС " + m.text().slice(0, 200)); });
  await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
  await стр.waitForTimeout(9000);

  const кадр = await стр.evaluate(() => (window.RV_ЛУННЫЙ_КАДР ? window.RV_ЛУННЫЙ_КАДР() : null));
  console.log(`\n=== ${метка} ${вьюпорт.width}x${вьюпорт.height} ===`);
  console.log("кадр:", JSON.stringify(кадр, (к, з) => (typeof з === "number" ? +з.toFixed(2) : з)));

  const строки = [];
  for (const [акт, доля] of ТОЧКИ) {
    const встал = await стр.evaluate(([а, д]) =>
      (window.RV_MOTION && window.RV_MOTION["кПунктy"] ? window.RV_MOTION["кПунктy"](а, д) : false), [акт, доля]);
    await стр.evaluate(() => new Promise((г) => {
      let n = 0;
      (function ш() { requestAnimationFrame(() => (++n >= 60 ? г() : ш())); })();
    }));
    const з = await стр.evaluate(() => {
      const W = window.RV_WORLD && window.RV_WORLD["мир"] ? window.RV_WORLD["мир"]() : null;
      if (!W || !W.cam) return null;
      const T = W.T, кам = W.cam;
      кам.updateMatrixWorld();
      /* Экранная рамка кладки по ЦЕНТРАМ КАМНЕЙ. Габаритная коробка
         группы врёт: в неё попадают и плоскость тени, и разлетевшиеся
         блоки, и она даёт рамку в шесть кадров шириной. Центры
         экземпляров это ровно то, что видно на экране. Крайние два
         процента отброшены: одиночный улетевший блок не должен решать,
         где стоит стена. */
      function рамка(имя) {
        let цель = null;
        W.scene.traverse((о) => { if (!цель && о.name === имя && о.isInstancedMesh) цель = о; });
        if (!цель) return null;
        let ро = цель;
        while (ро) { if (!ро.visible) return null; ро = ро.parent; }
        цель.updateMatrixWorld();
        const м = new T.Matrix4(), в = new T.Vector3();
        const xs = [], ys = [], мy = [];
        for (let i = 0; i < цель.count; i++) {
          цель.getMatrixAt(i, м);
          в.setFromMatrixPosition(м).applyMatrix4(цель.matrixWorld);
          мy.push(в.y);
          в.project(кам);
          xs.push(в.x); ys.push(в.y);
        }
        if (!xs.length) return null;
        xs.sort((a, b) => a - b); ys.sort((a, b) => a - b); мy.sort((a, b) => a - b);
        const к = (м2, д) => м2[Math.min(м2.length - 1, Math.max(0, Math.round(д * (м2.length - 1))))];
        return {
          низ: +к(ys, 0.02).toFixed(2), верх: +к(ys, 0.98).toFixed(2),
          лево: +к(xs, 0.02).toFixed(2), право: +к(xs, 0.98).toFixed(2),
          мирНиз: +к(мy, 0.02).toFixed(2), мирВерх: +к(мy, 0.98).toFixed(2)
        };
      }
      function коробка(имя) { return рамка(имя); }
      /* Экранная рамка ВСЕХ видимых строк акта. Ею проверяется главное
         требование владельца: «текст 1/4 сверху, не залазит на 3D ни в
         одной сцене». Числа: низ блока слов обязан быть ВЫШЕ верха
         предмета. */
      function слова() {
        let x0 = 9, x1 = -9, y0 = 9, y1 = -9, штук = 0;
        const в = new T.Vector3();
        W.scene.traverse((о) => {
          if (!о.isMesh || !о.geometry || !о.geometry.attributes || !о.geometry.attributes.centr) return;
          /* Надписи снарядов живут НА стене по сценарию - они не «слова
             акта», и мерить ими налёт значит ловить призрак. */
          let пр = о.parent, свой = false;
          while (пр) { if (пр.name === "снаряды") { свой = true; break; } пр = пр.parent; }
          if (свой) return;
          let ро = о, виден = true;
          while (ро) { if (!ро.visible) { виден = false; break; } ро = ро.parent; }
          if (!виден) return;
          const а = о.material && о.material.uniforms;
          if (а && а.uShow1 && а.uShow1.value < 0.35) return;
          о.updateMatrixWorld();
          const п = о.geometry.attributes.position;
          штук++;
          for (let i = 0; i < п.count; i += 3) {
            в.fromBufferAttribute(п, i).applyMatrix4(о.matrixWorld).project(кам);
            if (в.x < x0) x0 = в.x; if (в.x > x1) x1 = в.x;
            if (в.y < y0) y0 = в.y; if (в.y > y1) y1 = в.y;
          }
        });
        if (!штук) return null;
        return { строк: штук, низ: +y0.toFixed(2), верх: +y1.toFixed(2),
                 лево: +x0.toFixed(2), право: +x1.toFixed(2) };
      }
      return {
        кам: [+кам.position.x.toFixed(2), +кам.position.y.toFixed(2), +кам.position.z.toFixed(2)],
        поле: +кам.fov.toFixed(1),
        купол: коробка("кладка"),
        стена: коробка("кирпичи прокола"),
        слова: слова()
      };
    });
    строки.push({ акт, доля, встал, з });
    if (!з) { console.log(`${акт} ${доля}: мира нет`); continue; }
    const к = з.купол ? `дом ${з.купол.низ}..${з.купол.верх} x ${з.купол.лево}..${з.купол.право}` : "дом -";
    const с = з.стена ? `стена ${з.стена.низ}..${з.стена.верх} x ${з.стена.лево}..${з.стена.право} (мир y ${з.стена.мирНиз})` : "стена -";
    const сл = з.слова
      ? `слова ${з.слова.низ}..${з.слова.верх} x ${з.слова.лево}..${з.слова.право}` : "слова -";
    /* Налёт: насколько низ блока слов зашёл ниже верха предмета. */
    let налёт = "";
    const предмет = з.стена || з.купол;
    if (з.слова && предмет) {
      /* Пересечение ПРЯМОУГОЛЬНИКОВ, а не полос по высоте. На лежачем
         кадре слова стоят колонкой слева, предмет справа, и по высоте
         они пересекаются всегда - это раскладка, а не беда. */
      const пx = Math.min(предмет.право, з.слова.право) - Math.max(предмет.лево, з.слова.лево);
      const пy = Math.min(предмет.верх, з.слова.верх) - Math.max(предмет.низ, з.слова.низ);
      налёт = (пx > 0.03 && пy > 0.03) ? `  НАЛЁТ ${пx.toFixed(2)}x${пy.toFixed(2)}` : "  чисто";
    }
    console.log(`${акт} ${доля.toFixed(2)}${встал ? "" : " МИМО"}: кам ${з.кам.join(",")} поле ${з.поле} | ${к} | ${с} | ${сл}${налёт}`);
  }

  /* Разброс камеры: он и есть ответ на «камера стоит на месте». */
  const точки = строки.filter((с) => с.з).map((с) => с.з.кам);
  if (точки.length) {
    const ось = (i) => точки.map((т) => т[i]);
    const рз = (i) => +(Math.max(...ось(i)) - Math.min(...ось(i))).toFixed(3);
    console.log(`разброс камеры: x ${рз(0)}, y ${рз(1)}, z ${рз(2)}`);
  }
  if (беды.length) { console.log("БЕДЫ:"); for (const б of [...new Set(беды)].slice(0, 10)) console.log("  " + б); }
  else console.log("ошибок нет");
  await стр.close();
}

if (какой !== "тел") await снять(ПК, "пк");
if (какой !== "пк") await снять(ТЕЛ, "тел");
await бр.close();
