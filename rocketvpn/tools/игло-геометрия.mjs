/* Разбор моделей igloo.inc: что за формы и каких они размеров.

   ЗАЧЕМ. Владелец: «размер этого домика он должен быть как у igloo,
   размеры и положения и формы и текстуры и цвет», «глыбы нужны формы
   такой же разнообразнее сделать как у igloo». Спорить о размерах по
   снимкам бессмысленно - у них есть настоящие модели, и в них есть
   настоящие числа.

   Их модели лежат в формате Draco (.drc). Распаковать их можно ИХ ЖЕ
   распаковщиком: draco_decoder.wasm и обёртка скачаны вместе с сайтом.
   Работает всё в браузере, потому что распаковщик собран под него.

   ВЫДАЁТ /tmp/игло/геометрия.json: по каждой модели - число вершин и
   треугольников, набор атрибутов, габаритная коробка, середина, размер
   по осям, и первые вершины для сверки.

   Запуск: node tools/игло-геометрия.mjs */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ФАЙЛЫ = "/tmp/игло/файлы";
const КУДА = "/tmp/игло";

const модели = [];
(function обход(п) {
  for (const и of fs.readdirSync(п)) {
    const пп = path.join(п, и);
    const с = fs.statSync(пп);
    if (с.isDirectory()) обход(пп);
    else if (и.endsWith(".drc")) модели.push(пп);
  }
})(path.join(ФАЙЛЫ, "assets/geometries"));
модели.sort();
console.log("моделей найдено: " + модели.length);

const бр = await chromium.launch({
  executablePath: process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
});
const ctx = await бр.newContext({ ignoreHTTPSErrors: true });

/* Страница пустая и локальная: распаковщик работает без сети. */
const обёртка = fs.readFileSync(path.join(ФАЙЛЫ, "assets/libs/draco/draco_wasm_wrapper.js"), "utf8");
const васм = fs.readFileSync(path.join(ФАЙЛЫ, "assets/libs/draco/draco_decoder.wasm"));

await ctx.route("**/*", async (р) => {
  const а = р.request().url();
  if (а.endsWith("draco_decoder.wasm")) {
    return р.fulfill({ status: 200, headers: { "content-type": "application/wasm" }, body: васм });
  }
  return р.fulfill({ status: 200, headers: { "content-type": "text/html" }, body: "<html><body></body></html>" });
});

const стр = await ctx.newPage();
стр.on("pageerror", (e) => console.log("ИСКЛ " + e.message.slice(0, 200)));
стр.on("console", (m) => { if (m.type() === "error") console.log("КОНС " + m.text().slice(0, 200)); });
await стр.goto("https://мест/", { waitUntil: "domcontentloaded" });
await стр.addScriptTag({ content: обёртка });

const готов = await стр.evaluate(async () => {
  return await new Promise((годно) => {
    /* Обёртка объявляет DracoDecoderModule; путь к wasm подставляем сами. */
    window.DracoDecoderModule({
      locateFile: (ф) => "https://мест/" + ф
    }).then((м) => { window._draco = м; годно(true); }).catch(() => годно(false));
  });
});
console.log("распаковщик поднялся: " + готов);
if (!готов) { await бр.close(); process.exit(1); }

const итог = [];
for (const путь of модели) {
  const байты = Array.from(fs.readFileSync(путь));
  const о = await стр.evaluate((б) => {
    const d = window._draco;
    const буф = new d.DecoderBuffer();
    буф.Init(new Int8Array(б), б.length);
    const дек = new d.Decoder();
    const тип = дек.GetEncodedGeometryType(буф);
    let гео, ок;
    if (тип === d.TRIANGULAR_MESH) { гео = new d.Mesh(); ок = дек.DecodeBufferToMesh(буф, гео); }
    else { гео = new d.PointCloud(); ок = дек.DecodeBufferToPointCloud(буф, гео); }
    if (!ок.ok()) { d.destroy(гео); d.destroy(дек); d.destroy(буф); return { беда: ок.error_msg() }; }

    const вершин = гео.num_points();
    const треуг = тип === d.TRIANGULAR_MESH ? гео.num_faces() : 0;
    const имена = { 0: "POSITION", 1: "NORMAL", 2: "COLOR", 3: "TEX_COORD", 4: "GENERIC" };
    const атрибуты = [];
    for (let т = 0; т <= 4; т++) {
      const и = дек.GetAttributeId(гео, т);
      if (и < 0) continue;
      const а = дек.GetAttribute(гео, и);
      атрибуты.push({ вид: имена[т], компонент: а.num_components() });
    }

    /* Габариты по положению. */
    const идП = дек.GetAttributeId(гео, 0);
    const атрП = дек.GetAttribute(гео, идП);
    const массив = new d.DracoFloat32Array();
    дек.GetAttributeFloatForAllPoints(гео, атрП, массив);
    const н = массив.size();
    let мин = [1e9, 1e9, 1e9], макс = [-1e9, -1e9, -1e9];
    const первые = [];
    for (let i = 0; i + 2 < н; i += 3) {
      const x = массив.GetValue(i), y = массив.GetValue(i + 1), z = массив.GetValue(i + 2);
      if (x < мин[0]) мин[0] = x; if (y < мин[1]) мин[1] = y; if (z < мин[2]) мин[2] = z;
      if (x > макс[0]) макс[0] = x; if (y > макс[1]) макс[1] = y; if (z > макс[2]) макс[2] = z;
      if (первые.length < 12) первые.push([+x.toFixed(4), +y.toFixed(4), +z.toFixed(4)]);
    }
    d.destroy(массив); d.destroy(гео); d.destroy(дек); d.destroy(буф);
    const кругло = (a) => a.map((v) => +v.toFixed(4));
    return {
      вершин: вершин, треугольников: треуг, атрибуты: атрибуты,
      мин: кругло(мин), макс: кругло(макс),
      размер: кругло([макс[0] - мин[0], макс[1] - мин[1], макс[2] - мин[2]]),
      середина: кругло([(макс[0] + мин[0]) / 2, (макс[1] + мин[1]) / 2, (макс[2] + мин[2]) / 2]),
      первые: первые
    };
  }, байты);
  const имя = путь.replace(ФАЙЛЫ + "/assets/geometries/", "");
  итог.push({ модель: имя, ...о });
  console.log(имя.padEnd(34) + " " +
    (о.беда ? "БЕДА " + о.беда :
      "вершин " + String(о.вершин).padStart(7) +
      "  треуг " + String(о.треугольников).padStart(7) +
      "  размер " + JSON.stringify(о.размер) +
      "  середина " + JSON.stringify(о.середина)));
}

fs.writeFileSync(path.join(КУДА, "геометрия.json"), JSON.stringify(итог, null, 1));
console.log("записано в " + path.join(КУДА, "геометрия.json"));
await бр.close();
