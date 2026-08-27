/* Панель в проёме люка должна быть ТА ЖЕ, что в игре.

   Заказчик ловил обратное дважды: «панель не та, которая в игре» и
   «по факту реальная панель управления с реальными размерами
   появляется только в игре, а я что просил?». В коде это выглядело
   как собственная приборка тамбура - короб, экран и пять круглых
   клавиш в гнёздах. Её убрали, на её место встал снимок рубки.

   Первая попытка держалась на паспорте кабины (`RC_CAB_FLAT`) и
   оказалась ГОНКОЙ: корабль собирается раньше, чем догружается
   паспорт. На мониторе везло, на телефоне не везло ни разу. Поэтому
   проверка гоняет три случая: обычный, без паспорта (медленная сеть)
   и телефон - и в каждом требует ровно одну рубку и ноль круглых
   колец приборки. */
import { браузер, итог } from "./общее.mjs";

const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123/?rcdbg=1";

const СЛУЧАИ = [
  { имя: "ПК",              vp: { width: 1440, height: 900 }, dpr: 1, mob: false, рвать: false, ждём: "cockpit-wide-hd" },
  { имя: "ПК без паспорта", vp: { width: 1440, height: 900 }, dpr: 1, mob: false, рвать: true,  ждём: "cockpit-wide-hd" },
  { имя: "телефон",         vp: { width: 412,  height: 800 }, dpr: 2, mob: true,  рвать: false, ждём: "cockpit-tall-hd" },
  { имя: "телефон без пасп",vp: { width: 412,  height: 800 }, dpr: 2, mob: true,  рвать: true,  ждём: "cockpit-tall-hd" }
];

const b = await браузер();
const беды = [], ошибки = [];

for (const с of СЛУЧАИ) {
  const pg = await b.newPage({ viewport: с.vp, deviceScaleFactor: с.dpr, isMobile: с.mob, hasTouch: с.mob });
  pg.on("pageerror", (e) => ошибки.push(с.имя + " PE: " + e.message.slice(0, 120)));
  if (с.рвать) await pg.route("**/gen/cab/flat.js*", (r) => r.abort());
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
  /* Корабль собирается не мгновенно, а в песочнице нет видеокарты. */
  await pg.waitForTimeout(13000);
  const из = await pg.evaluate(() => {
    const R = window.RC_ROCKET;
    if (!R) return { ракета: false };
    let сцена = null;
    for (const к in R) {
      const v = R[к];
      if (v && v.isObject3D) { let o = v; while (o.parent) o = o.parent; if (o.isScene) { сцена = o; break; } }
    }
    if (!сцена) return { ракета: true, сцена: false };
    let рубок = 0, кругов = 0, файл = "";
    сцена.traverse((o) => {
      if (!o.isMesh) return;
      const м = o.material, к = м && м.map && м.map.image;
      const src = (к && (к.currentSrc || к.src)) || "";
      if (/cockpit/.test(src)) { рубок++; файл = src.split("/").pop(); }
      /* Кольца вокруг круглых клавиш прежней приборки тамбура */
      const g = o.geometry;
      if (g && g.type === "TorusGeometry" && g.parameters && g.parameters.radius < 0.2) кругов++;
    });
    return { ракета: true, сцена: true, рубок: рубок, круглых: кругов, файл: файл || "нет" };
  });
  console.log("   " + с.имя.padEnd(17) + " рубок " + (из.рубок == null ? "-" : из.рубок) +
              " · круглых клавиш " + (из.круглых == null ? "-" : из.круглых) +
              " · " + (из.файл || "-"));
  if (!из.ракета) беды.push(с.имя + ": корабль не собрался");
  else if (!из.сцена) беды.push(с.имя + ": сцены корабля не нашлось");
  else {
    if (из.рубок !== 1) беды.push(с.имя + ": рубок в проёме " + из.рубок + ", а должна быть ровно одна");
    if (из.круглых > 0) беды.push(с.имя + ": вернулась приборка-двойник, круглых клавиш " + из.круглых);
    if (из.файл.indexOf(с.ждём) !== 0) беды.push(с.имя + ": ждали " + с.ждём + ", а стоит " + из.файл);
  }
  await pg.close();
}

await b.close();
process.exit(итог("панель в проёме одна и та же", беды, ошибки));
