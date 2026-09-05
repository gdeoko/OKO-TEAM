/* Приёмка по списку владельца: каждая жалоба проверяется числом.

   ЗАЧЕМ. Список Даниэля длинный, правки идут волнами, и «вроде сделали»
   после третьей волны уже ничего не значит. Здесь каждая его претензия
   переведена в измеримое условие, и прогон отвечает по каждой отдельно:
   ЧИСТО или ГРЯЗНО, с числом.

   Проверки намеренно грубые по порогам: они ловят возврат беды, а не
   спорят о вкусе. Тонкая сверка с igloo живёт в других инструментах
   (снимок.mjs, глубина-прокола.mjs, кто-белит.mjs, checks/*).

   Запуск:
     node tools/приёмка-списка.mjs            оба кадра
     node tools/приёмка-списка.mjs тел        только телефон
   Кадры для разбора ложатся в /tmp/приёмка. */
import { chromium } from "playwright";
import fs from "node:fs";
import { PNG } from "pngjs";

const АДРЕС = process.env.RV_URL || "http://127.0.0.1:8170";
const КУДА = "/tmp/приёмка";
const ХРОМ = process.env.RV_CHROME || "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome";
const КОГО = process.argv[2] || "оба";

fs.mkdirSync(КУДА, { recursive: true });

const КАДРЫ = [
  { имя: "ПК", вьюпорт: { width: 1440, height: 900 }, плот: 1 },
  { имя: "тел", вьюпорт: { width: 390, height: 844 }, плот: 2 }
].filter((к) => КОГО === "оба" || к.имя === КОГО);

const итог = [];
function пункт(кадр, жалоба, чисто, число) {
  итог.push({ кадр: кадр, жалоба: жалоба, чисто: чисто, число: число });
}

/* Яркость и доля тёмного по снимку. Верхние точки шапки сайта из счёта
   выбрасываются: шапка тёмная по вёрстке, к сцене отношения не имеет. */
function свет(буф, шапка) {
  const p = PNG.sync.read(буф);
  const д = p.data, ш = p.width;
  let сум = 0, n = 0, чёрных = 0, ярких = 0, мин = 255;
  const с0 = шапка != null && шапка < p.height ? шапка : 0;
  for (let y = с0; y < p.height; y++) {
    for (let x = 0; x < ш; x += 2) {
      const i = (y * ш + x) * 4;
      const с = (д[i] + д[i + 1] + д[i + 2]) / 3;
      сум += с; n++;
      if (с < 40) чёрных++;
      if (с > 230) ярких++;
      if (с < мин) мин = с;
    }
  }
  return { ярк: сум / n, чёрных: чёрных / n * 100, ярких: ярких / n * 100, мин: мин };
}
const бр = await chromium.launch({
  executablePath: ХРОМ,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-lcd-text", "--autoplay-policy=no-user-gesture-required"]
});

for (const к of КАДРЫ) {
  const стр = await бр.newPage({ viewport: к.вьюпорт, deviceScaleFactor: к.плот });
  const беды = [];
  стр.on("pageerror", (e) => беды.push("ИСКЛ " + e.message.slice(0, 160)));
  стр.on("console", (m) => { if (m.type() === "error") беды.push("КОНС " + m.text().slice(0, 160)); });

  await стр.goto(АДРЕС + "/", { waitUntil: "domcontentloaded", timeout: 90000 });

  /* ── «на стартовой загрузке нельзя скроллить, пока камера не
       отпустится» ──────────────────────────────────────────────── */
  const замокБыл = await стр.evaluate(() =>
    document.documentElement.classList.contains("рв-замок"));
  пункт(к.имя, "лента заперта на загрузке", замокБыл, "замок " + замокБыл);

  await стр.waitForFunction(
    () => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](),
    null, { timeout: 300000 }).catch(() => беды.push("вступление не кончилось"));
  await стр.waitForTimeout(2500);

  const замокСнят = await стр.evaluate(() =>
    !document.documentElement.classList.contains("рв-замок"));
  пункт(к.имя, "замок снят после вступления", замокСнят, "снят " + замокСнят);

  /* ── «зачем в начале какой-то кружок на экране справа» ───────── */
  const кружок = await стр.evaluate(() => {
    const все = Array.from(document.querySelectorAll("body *"));
    return все.filter((э) => {
      const с = getComputedStyle(э);
      if (с.display === "none" || с.visibility === "hidden" || +с.opacity < 0.05) return false;
      const р = э.getBoundingClientRect();
      const кругл = parseFloat(с.borderRadius) >= Math.min(р.width, р.height) * 0.45;
      return кругл && р.width > 24 && р.width < 240 &&
             Math.abs(р.width - р.height) < 6 && р.left > window.innerWidth * 0.55;
    }).map((э) => э.className || э.tagName);
  });
  пункт(к.имя, "нет кружка справа на старте", кружок.length === 0,
        кружок.length ? кружок.join(",") : "нет");

  const акты = await стр.evaluate(() =>
    Array.from(document.querySelectorAll(".rv-акт")).map((э) => э.getAttribute("data-акт")));

  /* ── «текст занимает верхнюю четверть и не залезает на 3D ни в
       одной сцене» ────────────────────────────────────────────────
     Слова живут в объёме (rv-слово3d.js), поэтому спрашиваем не
     разметку, а сам модуль: он знает экранные рамки своих строк. */
  for (const акт of акты) {
    const встал = await стр.evaluate(([а]) =>
      window.RV_MOTION && window.RV_MOTION["кПунктy"] ? window.RV_MOTION["кПунктy"](а, 0.45) : false, [акт]);
    if (!встал) { пункт(к.имя, `акт ${акт}: встать на середину`, false, "не встал"); continue; }
    await стр.waitForTimeout(2600);

    /* Слова живут буквами в объёме, а не разметкой, поэтому их место
       на экране считается проекцией самой геометрии. Меш строки зовётся
       «текст: ...» (rv-msdf.js), узел раздела - «слова: <акт>». */
    const о = await стр.evaluate(() => {
      const W = window.RV_WORLD && window.RV_WORLD["мир"] ? window.RV_WORLD["мир"]() : null;
      if (!W) return null;
      const T = W.T, кам = W.cam;
      кам.updateMatrixWorld(true);
      const в = new T.Vector3();
      let верх = -9, низ = 9, строк = 0;
      W.scene.traverse((о) => {
        if (!о.isMesh || !/^текст: /.test(о.name || "")) return;
        let п = о, видно = true;
        while (п) { if (!п.visible) { видно = false; break; } п = п.parent; }
        if (!видно) return;
        if (!о.geometry.boundingBox) о.geometry.computeBoundingBox();
        const бб = о.geometry.boundingBox;
        if (!бб) return;
        строк++;
        for (let i = 0; i < 8; i++) {
          в.set(i & 1 ? бб.max.x : бб.min.x, i & 2 ? бб.max.y : бб.min.y, i & 4 ? бб.max.z : бб.min.z);
          о.localToWorld(в); в.project(кам);
          if (в.y > верх) верх = в.y;
          if (в.y < низ) низ = в.y;
        }
      });
      return { строк: строк, верх: верх, низ: низ };
    });
    const сверху = await стр.evaluate((а) => {
      const с = document.querySelector('.rv-акт[data-акт="' + а + '"]');
      return !!(с && с.getAttribute("data-слова") === "сверху");
    }, акт);
    if (о && о.строк > 0 && сверху) {
      /* Верхняя четверть кадра это NDC y от +1 до +0.5. Владелец:
         «текст размер 1/4 часть сверху, не залазит на 3D ни в одной
         сцене». Запас в одну десятую NDC на выносные элементы букв. */
      пункт(к.имя, `акт ${акт}: слова в верхней четверти`, о.низ >= 0.40,
            `низ строк NDC ${о.низ.toFixed(2)}, строк ${о.строк}`);
    } else if (о) {
      пункт(к.имя, `акт ${акт}: слова подняты`, о.строк > 0, `строк ${о.строк}`);
    }

    const буф = await стр.screenshot();
    fs.writeFileSync(`${КУДА}/${к.имя}-${акт}.png`, буф);
    /* Шапка меряется в ТОЧКАХ СНИМКА, а не в точках вёрстки: на
       телефоне плотность экрана два, и пятьдесят четыре точки вёрстки
       это сто восемь точек снимка. */
    const св = свет(буф, (к.имя === "тел" ? 54 : 62) * к.плот);
    /* Полоса igloo: 143-189 средней, чёрного нет. Порог намеренно
       широкий - ловим провал в ночь, а не спорим об оттенке. */
    пункт(к.имя, `акт ${акт}: кадр не проваливается в ночь`, св.ярк > 70,
          `ярк ${св.ярк.toFixed(0)}`);
    пункт(к.имя, `акт ${акт}: чёрного меньше четверти кадра`, св.чёрных < 25,
          `чёрных ${св.чёрных.toFixed(1)}%`);
    пункт(к.имя, `акт ${акт}: кадр не выбит в белое`, св.ярких < 40,
          `ярких ${св.ярких.toFixed(1)}%`);
  }

  /* ── «почему на ПК светло и чётко, а на телефоне темно» ───────
     Считается снаружи цикла, по двум готовым наборам снимков. */

  /* ── «включить звук, как только я начал скроллить или тыкнул» и
       «убери звук на клик в любом месте» ────────────────────────── */
  const звук = await стр.evaluate(() => {
    const S = window.RV_SOUND;
    if (!S || !S["замер"]) return null;
    return S["замер"]();
  });
  пункт(к.имя, "модуль звука отвечает", !!звук, звук ? "есть" : "нет");

  if (беды.length) пункт(к.имя, "консоль чистая", false, беды.slice(0, 3).join(" | "));
  else пункт(к.имя, "консоль чистая", true, "0 ошибок");

  await стр.close();
}

await бр.close();

/* ── Телефон против монитора по свету ──────────────────────────
   Владелец: «почему на ПК светло и чётко, а на телефоне темно и
   размазанно». Считаем по одинаковым актам разницу средней яркости. */
if (КОГО === "оба") {
  const пары = fs.readdirSync(КУДА).filter((ф) => ф.startsWith("ПК-"));
  for (const ф of пары) {
    const акт = ф.slice(3, -4);
    const т = `${КУДА}/тел-${акт}.png`;
    if (!fs.existsSync(т)) continue;
    const a = свет(fs.readFileSync(`${КУДА}/${ф}`), 62);
    const b = свет(fs.readFileSync(т), 108);
    const разн = Math.abs(a.ярк - b.ярк) / Math.max(1, a.ярк) * 100;
    пункт("оба", `акт ${акт}: телефон не темнее монитора`, разн < 18,
          `ПК ${a.ярк.toFixed(0)} тел ${b.ярк.toFixed(0)}, разница ${разн.toFixed(0)}%`);
  }
}

let грязно = 0;
console.log("приёмка по списку владельца\n");
for (const п of итог) {
  const метка = п.чисто ? "ЧИСТО " : "ГРЯЗНО";
  if (!п.чисто) грязно++;
  console.log(`${метка} [${п.кадр}] ${п.жалоба}  ${п.число}`);
}
console.log(`\nвсего ${итог.length}, грязных ${грязно}`);
process.exit(грязно ? 1 : 0);
