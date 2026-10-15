/* КТО РИСУЕТ ПЯТНА, ЧЕТВЁРТЫЙ ЗАХОД: ЛУЧ В САМУ КЛЯКСУ. Гашение по
   семействам не сошлось: корабль в ручном режиме за полминуты между
   снимками уводит взгляд, и «пропавшая» клякса могла просто уйти из
   кадра. Здесь всё делается за одну секунду в одном кадре: снимок
   холста читается в самой странице, кляксы находятся по яркости
   (мягкие пятна площадью от 120 точек, не Земля и не приборы), и в
   каждую летит луч. Луч ловит меши и спрайты как есть, точки - с
   порогом в мировых единицах. Печатается семейство, сетка, материал,
   карта, размер и расстояние.

   Запуск: node tools/кдн-кто-пятна-4.mjs [тел|пк] [адрес] */
import { chromium } from "playwright";
import { БРАУЗЕР } from "./браузер.mjs";

const КТО = process.argv[2] || "тел";
const АДРЕС = process.argv[3] || "http://127.0.0.1:8171/?rcdbg=1";
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
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 200)));
await стр.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await стр.waitForFunction(() => window.RC_GL && window.RC_GL.ready3d, null, { timeout: 300000 });
await стр.waitForTimeout(2000);
async function кадры(n) {
  await стр.evaluate((к) => new Promise((г) => {
    let i = 0; (function ш() { requestAnimationFrame(() => (++i >= к ? г() : ш())); })();
  }), n);
}
await стр.evaluate(() => window.RC_FLIGHT.open());
await стр.waitForFunction(() => document.querySelector(".rcf-brief button[data-mode=auto]"), null, { timeout: 60000 });
await кадры(20);
await стр.evaluate(() => document.querySelector(".rcf-brief button[data-mode=manual]").click());
await кадры(20);
await стр.evaluate(() => window.RC_FLIGHT._пост(false));
await кадры(50);

const итог = await стр.evaluate(async () => {
  const cam = window.RC_FLIGHT._cam();
  let scene = cam; while (scene.parent) scene = scene.parent;
  const T = window.THREE;
  const cv = document.querySelector(".rcf-cv");
  /* Снимок холста тем же кадром: рисуем холст WebGL на 2D-холст.
     Буфер после кадра может быть пуст (preserveDrawingBuffer нет),
     поэтому просим ещё один кадр и читаем сразу в rAF. */
  const W = innerWidth, H = innerHeight;
  const c2 = document.createElement("canvas"); c2.width = W; c2.height = H;
  const x2 = c2.getContext("2d");
  await new Promise((г) => requestAnimationFrame(() => { x2.drawImage(cv, 0, 0, W, H); г(); }));
  const img = x2.getImageData(0, 0, W, H).data;
  /* Проём рубки: по паспорту кабины, иначе берём середину кадра */
  let x0 = W * 0.1, x1 = W * 0.9, y0 = H * 0.16, y1 = H * 0.78;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = img[i * 4] * 0.2126 + img[i * 4 + 1] * 0.7152 + img[i * 4 + 2] * 0.0722;
  /* Мягкие пятна: точка ярче 28, и в круге радиуса 5 вокруг неё
     средняя яркость выше 22 - у острой звезды такое не выходит */
  const метка = new Uint8Array(W * H);
  const пятна = [];
  const стек = [];
  for (let y = y0 | 0; y < y1; y++) for (let x = x0 | 0; x < x1; x++) {
    const i = y * W + x;
    if (метка[i] || lum[i] < 28) continue;
    /* заливка компоненты */
    let n = 0, sx = 0, sy = 0, mx = 0, minx = x, maxx = x, miny = y, maxy = y;
    стек.length = 0; стек.push(i); метка[i] = 1;
    while (стек.length) {
      const j = стек.pop(); const jy = (j / W) | 0, jx = j - jy * W;
      n++; sx += jx; sy += jy; if (lum[j] > mx) mx = lum[j];
      if (jx < minx) minx = jx; if (jx > maxx) maxx = jx; if (jy < miny) miny = jy; if (jy > maxy) maxy = jy;
      for (const d of [-1, 1, -W, W]) {
        const k = j + d; if (k < 0 || k >= W * H || метка[k] || lum[k] < 28) continue;
        const ky = (k / W) | 0; if (ky < y0 || ky >= y1) continue;
        метка[k] = 1; стек.push(k);
      }
    }
    const bw = maxx - minx + 1, bh = maxy - miny + 1;
    const круглость = n / (bw * bh);
    if (n >= 120 && n <= 6000 && bw >= 9 && bh >= 9 && круглость > 0.45 && mx < 250) {
      пятна.push({ x: Math.round(sx / n), y: Math.round(sy / n), w: bw, h: bh, макс: Math.round(mx) });
    }
  }
  пятна.sort((a, b) => b.w * b.h - a.w * a.h);
  const луч = new T.Raycaster();
  луч.params.Points = { threshold: 6 };
  луч.params.Sprite = {};
  const из = [];
  for (const п of пятна.slice(0, 10)) {
    луч.setFromCamera(new T.Vector2((п.x / W) * 2 - 1, 1 - (п.y / H) * 2), cam);
    const хиты = луч.intersectObjects(scene.children, true);
    const стр = [];
    let k = 0;
    for (const h of хиты) {
      const о = h.object;
      let у = о, видно = true;
      while (у) { if (!у.visible) { видно = false; break; } у = у.parent; }
      if (!видно) continue;
      const м = Array.isArray(о.material) ? о.material[0] : о.material;
      let имя = о.name, р = о.parent, ш = 0;
      while (!имя && р && ш++ < 4) { имя = р.name; р = р.parent; }
      стр.push(`${о.isPoints ? "точки" : о.isSprite ? "спрайт" : о.isMesh ? "меш" : о.type}:${имя || "?"}/${о.geometry ? о.geometry.type : ""}/${м ? м.type : ""}` +
        (м && м.map ? "+карта" : "") + (м && м.size ? " size=" + м.size : "") +
        (м && м.transparent ? " прозр" : " НЕПРОЗР") + (о.parent === cam ? " уКамеры" : "") +
        ` @${h.distance.toFixed(1)}` + (h.index != null ? " idx=" + h.index : ""));
      if (++k >= 4) break;
    }
    из.push({ пятно: п, хиты: стр });
  }
  return { всегоПятен: пятна.length, из, cam: [cam.position.x, cam.position.y, cam.position.z].map((v) => Math.round(v)) };
});
await стр.screenshot({ path: `/tmp/пятна4-${КТО}.png` });
console.log(`пятен найдено ${итог.всегоПятен}, камера ${итог.cam.join(", ")}  снимок /tmp/пятна4-${КТО}.png`);
for (const з of итог.из) {
  console.log(`пятно (${з.пятно.x},${з.пятно.y}) ${з.пятно.w}x${з.пятно.h} макс ${з.пятно.макс}:`);
  for (const с of з.хиты) console.log("   " + с);
  if (!з.хиты.length) console.log("   луч ничего не задел");
}
await бр.close();
