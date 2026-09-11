/* ОЧАГ ТРЕЩИН ДОЛЖЕН БЫТЬ ПОД ГЛЫБОЙ, И ЭТО СЧИТАЕТСЯ ЧИСЛОМ.

   Владелец на живом сайте: «трещины должны появляться в месте удара
   глыбы льда, сейчас не там появляется».

   Глазом такое спорно: звёзды разломов крупные, глыба тоже, и «рядом»
   легко принять за «в точке». Число отвечает точно. Здесь у каждой
   вставшей глыбы берутся ДВЕ вещи в одних и тех же координатах экрана:

     · где стоит сама плита глыбы (её центр, спроецированный в кадр);
     · где шейдер рисует очаг разлома (точка из uHits, переведённая
       тем же путём, каким её читает шейдер: плюс положение корня
       кладки, потом проекция).

   Печатается расстояние между ними в долях полуэкрана. Ноль означает,
   что трещина расходится ровно из-под глыбы. Порог взят от размера
   самой глыбы: дальше её половины это уже «не там».

   Запуск: node tools/очаг-трещин.mjs [тел|пк] [доля-периметра] */
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
const беды = [];
стр.on("pageerror", (e) => беды.push(e.message.slice(0, 140)));
await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["мир"] && window.RV_WORLD["мир"](),
                          null, { timeout: 300000 });
await стр.waitForTimeout(4000);
await стр.evaluate((д) => window.RV_MOTION["кПунктy"]("периметр", д), ДОЛЯ);
await стр.evaluate(() => new Promise((г) => {
  let i = 0; (function ш() { requestAnimationFrame(() => (++i >= 20 ? г() : ш())); })();
}));

const из = await стр.evaluate(() => {
  const К = window.RV_КИРПИЧИ, С = window.RV_СНАРЯДЫ, T = window.THREE;
  if (!К || !С) return { нет: "модулей нет" };
  const корень = К["корень"] ? К["корень"]() : null;
  if (!корень) return { нет: "кладка не собрана" };
  const мир = window.RV_WORLD["мир"](), cam = мир.cam;
  cam.updateMatrixWorld(true);
  корень.updateWorldMatrix(true, true);
  /* Материал кладки несёт те самые числа, по которым рисует шейдер.
     Спрашиваем ЕГО, а не пересчитываем: между исходной целью снаряда и
     тем, что доехало до шейдера, и лежит вся разница, которую меряем. */
  let меш = null;
  корень.traverse((о) => { if (!меш && о.isInstancedMesh) меш = о; });
  if (!меш) return { нет: "экземпляров нет" };
  const у = (Array.isArray(меш.material) ? меш.material[0] : меш.material).uniforms;
  const из2 = { корень: [+корень.position.x.toFixed(2), +корень.position.y.toFixed(2),
                         +корень.position.z.toFixed(2)], пары: [] };
  /* Плиты глыб: у каждой своя, и стоят они в корне АКТА. Берём их
     мировое положение через матрицу, а не через position: родителей у
     них несколько. */
  const плиты = [];
  let сцена = cam; while (сцена.parent) сцена = сцена.parent;
  сцена.traverse((о) => {
    if (о.isMesh && о.material && о.material.uniforms &&
        о.material.uniforms.uFly !== undefined && о.visible) плиты.push(о);
  });
  const п = new T.Vector3();
  for (let h = 0; h < 5; h++) {
    const сила = у.uHitPow.value[h];
    if (!(сила > 0.001)) continue;
    /* Точка удара так, как её понимает шейдер: она лежит в координатах
       кладки, значит в мир переводится матрицей корня кладки. */
    п.copy(у.uHits.value[h]).applyMatrix4(корень.matrixWorld);
    const очагМир = п.clone();
    п.project(cam);
    const очаг = [+п.x.toFixed(3), +п.y.toFixed(3)];
    /* Ближайшая к очагу плита: их три, и какая чья, решаем по
       расстоянию, а не по номеру - порядок у модулей свой. */
    let лучшая = null, лучшееD = 1e9, размер = 0;
    for (const пл of плиты) {
      пл.updateWorldMatrix(true, false);
      const ц = new T.Vector3().setFromMatrixPosition(пл.matrixWorld);
      const d = ц.distanceTo(очагМир);
      if (d < лучшееD) {
        лучшееD = d; лучшая = ц;
        const g = пл.geometry;
        g.computeBoundingSphere();
        размер = g.boundingSphere ? g.boundingSphere.radius *
                 Math.max(пл.scale.x, пл.scale.y) : 1;
      }
    }
    if (!лучшая) continue;
    const цП = лучшая.clone().project(cam);
    const глыба = [+цП.x.toFixed(3), +цП.y.toFixed(3)];
    из2.пары.push({
      удар: h, сила: +сила.toFixed(2), очаг, глыба,
      мимо: +Math.hypot(очаг[0] - глыба[0], очаг[1] - глыба[1]).toFixed(3),
      вМире: +лучшееD.toFixed(2), размерГлыбы: +размер.toFixed(2),
    });
  }
  return из2;
});

console.log(`ОЧАГ ТРЕЩИН ${КТО} ${экран.width}x${экран.height}, периметр ${ДОЛЯ}`);
if (из.нет) { console.log("  " + из.нет); await бр.close(); process.exit(1); }
console.log(`  корень кладки ${JSON.stringify(из.корень)}`);
if (!из.пары.length) console.log("  ни одного удара с силой выше нуля");
for (const п of из.пары) {
  console.log(`  удар ${п.удар} сила ${п.сила}: очаг ${JSON.stringify(п.очаг)}` +
              ` глыба ${JSON.stringify(п.глыба)}  мимо ${п.мимо} полуэкрана` +
              `  (в мире ${п.вМире} при размере глыбы ${п.размерГлыбы})`);
}

/* ── СРАВНИВАЕМ НЕ ЧИСЛО С САМИМ СОБОЙ, А СВЕЧЕНИЕ С ГЛЫБОЙ ────
   Первый заход этой проверки был пустым: он брал точку из uHits,
   переводил её в мир матрицей корня кладки и сравнивал с плитой,
   которая в ту же точку и поставлена. Ноль выходил у всех трёх ударов
   всегда, при любой ошибке в шейдере - потому что мерилось одно число
   против самого себя.

   Настоящая проверка идёт по КАДРУ. Трещина светится: это тонкие
   светлые нити на сером камне. Берём вокруг каждой глыбы квадрат в
   четверть полуэкрана, считаем в нём центр тяжести самых светлых
   точек и смотрим, насколько он ушёл от середины глыбы. Если очаг
   уехал, светлого в квадрате не будет вовсе либо его центр окажется у
   кромки. */
const свеч = await стр.evaluate((пары) => new Promise((готово) => {
  const W = innerWidth, H = innerHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const холсты = [].slice.call(document.querySelectorAll("canvas")).filter((cv) => {
    const к = cv.getBoundingClientRect();
    return к.width > W * 0.8 && к.height > H * 0.8;
  });
  requestAnimationFrame(() => {
    for (const cv of холсты) { try { x.drawImage(cv, 0, 0, W, H); } catch (e) {} }
    const д = x.getImageData(0, 0, W, H).data;
    const из = [];
    for (const п of пары) {
      /* Нормальные координаты устройства в точки экрана. */
      const цx = (п.глыба[0] * 0.5 + 0.5) * W, цy = (-п.глыба[1] * 0.5 + 0.5) * H;
      const пол = Math.round(Math.min(W, H) * 0.13);
      let сум = 0, сx = 0, сy = 0, ярких = 0, фон = 0, n = 0;
      for (let y = Math.max(0, цy - пол); y < Math.min(H, цy + пол); y += 2) {
        for (let px = Math.max(0, цx - пол); px < Math.min(W, цx + пол); px += 2) {
          const i = (Math.round(y) * W + Math.round(px)) * 4;
          const l = д[i] * 0.2126 + д[i + 1] * 0.7152 + д[i + 2] * 0.0722;
          фон += l; n++;
        }
      }
      фон /= Math.max(1, n);
      /* Свечение трещины это заметный перепад над камнем вокруг. */
      const порог = фон * 1.35 + 12;
      for (let y = Math.max(0, цy - пол); y < Math.min(H, цy + пол); y += 2) {
        for (let px = Math.max(0, цx - пол); px < Math.min(W, цx + пол); px += 2) {
          const i = (Math.round(y) * W + Math.round(px)) * 4;
          const l = д[i] * 0.2126 + д[i + 1] * 0.7152 + д[i + 2] * 0.0722;
          if (l < порог) continue;
          const в = l - порог;
          сум += в; сx += px * в; сy += y * в; ярких++;
        }
      }
      из.push({
        удар: п.удар, фон: +фон.toFixed(1), порог: +порог.toFixed(1), ярких,
        центр: сум > 0 ? [+((сx / сум - цx) / пол).toFixed(2),
                          +((сy / сум - цy) / пол).toFixed(2)] : null,
      });
    }
    готово(из);
  });
}), из.пары);

for (const с of свеч) {
  console.log(`  удар ${с.удар}: светлых точек ${с.ярких} при фоне ${с.фон},` +
              ` центр свечения ${JSON.stringify(с.центр)} (доли полуквадрата от середины глыбы)`);
}

/* Вердикт. Свечение обязано быть, и его центр обязан лежать в
   середине квадрата, а не у кромки: иначе очаг рядом, а не под глыбой. */
const беды2 = [];
if (!из.пары.length) беды2.push("ударов в кадре нет, мерить нечего");
for (const с of свеч) {
  if (с.ярких < 12) {
    беды2.push(`удар ${с.удар}: вокруг глыбы свечения трещин почти нет (${с.ярких} точек)`);
    continue;
  }
  const мимо = Math.hypot(с.центр[0], с.центр[1]);
  if (мимо > 0.55) {
    беды2.push(`удар ${с.удар}: центр свечения ушёл на ${мимо.toFixed(2)} от середины глыбы`);
  }
}
if (беды.length) беды2.push("исключения: " + беды.slice(0, 2).join(" | "));
if (беды2.length) {
  console.log("ГРЯЗНО  очаг трещин");
  for (const б of беды2) console.log("   " + б);
  await бр.close();
  process.exit(1);
}
console.log("ЧИСТО  трещины расходятся из-под глыб");
await бр.close();
