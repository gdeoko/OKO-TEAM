/* Нажатие по телу: точное и с промахом.

   Жалоба владельца была «некоторые планеты не нажимаются». Разбор
   показал две причины и обе проверяются здесь.

   Первая: спрайт. Ядро галактики это плоский квадрат со светящимся
   пятном посередине, у Млечного Пути стороной сто восемьдесят
   единиц мира. Луч видел весь квадрат, человек - только пятно, и
   нажатие рядом с галактикой открывало галактику, а тело за ней
   она перехватывала.

   Вторая: тела едут по экрану на сорок-четыреста семьдесят точек за
   полсекунды, и палец целится в то, что видел мгновение назад.

   Меряем в ОДНОМ кадре: замер экранных точек и само нажатие идут
   без обмена с браузером, иначе тело успевает уехать и проверка
   меряет собственную задержку, а не сайт.

   Порог берём ДОЛЕЙ, а не числом попаданий: сколько тел окажется в
   кадре, зависит от того, где на маршруте застал корабль, и от
   прогона к прогону меняется (видели 16 и 24). Абсолютный порог на
   таком счёте ловил бы сам разброс.

   Снято живьём: точное нажатие 17 из 22 и 22 из 24, промах на 34
   точки 14 из 16 и 16 из 24. До правки промах давал 5 из 24, то
   есть каждый пятый. Пороги стоят между этими числами.

   Запуск: node tools/audit/зло-тычок.mjs   (сервер на 127.0.0.1:8123) */
/* Playwright лежит вне репозитория: путь тот же, что у соседних
   проверок, и его можно переопределить через RC_PW. */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");

const URL = "http://127.0.0.1:8123/?rcdbg=1";
const ТОЧНО_ДОЛЯ = 0.70;
const ПРОМАХ_ДОЛЯ = 0.55;
const МИНИМУМ_ТЕЛ = 10;

const браузер = await chromium.launch();
const стр = await браузер.newPage({ viewport: { width: 1440, height: 900 } });
const ошибки = [];
стр.on("pageerror", (e) => ошибки.push(String(e).slice(0, 160)));
await стр.goto(URL, { waitUntil: "load" });
await стр.waitForTimeout(2500);
await стр.evaluate(() => window.RC_FLIGHT.open());
await стр.waitForTimeout(6000);

const открыта = await стр.evaluate(
  () => !!(window.RC_FLIGHT && window.RC_FLIGHT._pick && window.RC_FLIGHT._pick())
);
if (!открыта) {
  console.log("БЕДА: игра не открылась, мерить нечего");
  if (ошибки.length) console.log("  ошибки:", ошибки.slice(0, 3).join(" | "));
  await браузер.close();
  process.exit(1);
}

async function прогон(смещение) {
  let всего = 0, верных = 0, чужих = 0, мимо = 0;
  for (const место of [0.10, 0.32, 0.58, 0.82]) {
    await стр.evaluate((v) => window.RC_FLIGHT._set(v), место);
    await стр.waitForTimeout(1500);
    const ряд = await стр.evaluate((см) => {
      const тела = window.RC_FLIGHT._pick().тела.filter(
        (t) => t.видно && !t.сзади && t.x > 110 && t.x < 1330 && t.y > 110 && t.y < 790
      );
      const из = [];
      for (const т of тела.slice(0, 9)) {
        const X = т.x + см, Y = т.y - см;
        const цель = document.elementFromPoint(X, Y);
        if (!цель) continue;
        const оп = { bubbles: true, cancelable: true, clientX: X, clientY: Y,
                     pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0 };
        цель.dispatchEvent(new PointerEvent("pointerdown", оп));
        window.dispatchEvent(new PointerEvent("pointerup", оп));
        const д = document.querySelector(".rcf-dos");
        const открыт = д && !д.hasAttribute("hidden");
        из.push({ жали: т.имя,
                  открылось: открыт ? (д.querySelector(".rcf-dos-h") || {}).textContent.trim() : null });
        const x = document.querySelector(".rcf-dos-x");
        if (x) x.click();
      }
      return из;
    }, смещение);
    for (const q of ряд) {
      всего++;
      if (q.открылось === null) { мимо++; continue; }
      const a = String(q.жали).toUpperCase(), c = String(q.открылось).toUpperCase();
      if (c.indexOf(a.slice(0, 5)) >= 0 || a.indexOf(c.slice(0, 5)) >= 0) верных++;
      else чужих++;
    }
  }
  return { всего, верных, чужих, мимо };
}

const точно = await прогон(0);
const промах = await прогон(34);
await браузер.close();

console.log(`точно в центр   всего ${точно.всего} · верных ${точно.верных} · чужих ${точно.чужих} · мимо ${точно.мимо}`);
console.log(`промах 34 точки всего ${промах.всего} · верных ${промах.верных} · чужих ${промах.чужих} · мимо ${промах.мимо}`);

const дТочно = точно.всего ? точно.верных / точно.всего : 0;
const дПромах = промах.всего ? промах.верных / промах.всего : 0;
console.log(`доли: точно ${(дТочно * 100).toFixed(0)}% при пороге ${(ТОЧНО_ДОЛЯ * 100).toFixed(0)}% · промах ${(дПромах * 100).toFixed(0)}% при пороге ${(ПРОМАХ_ДОЛЯ * 100).toFixed(0)}%`);

let бед = 0;
if (точно.всего < МИНИМУМ_ТЕЛ || промах.всего < МИНИМУМ_ТЕЛ) {
  console.log(`БЕДА: тел в кадре меньше ${МИНИМУМ_ТЕЛ}, проверка ничего не доказывает`);
  бед++;
}
if (дТочно < ТОЧНО_ДОЛЯ) { console.log(`БЕДА: точное нажатие открывает верное досье в ${(дТочно * 100).toFixed(0)}% случаев`); бед++; }
if (дПромах < ПРОМАХ_ДОЛЯ) { console.log(`БЕДА: нажатие мимо на 34 точки попадает в ${(дПромах * 100).toFixed(0)}% случаев`); бед++; }
if (ошибки.length) { console.log("БЕДА: ошибки страницы:", ошибки.slice(0, 3).join(" | ")); бед++; }

console.log(бед ? "есть беды" : "ЧИСТО  нажатие по телам");
process.exit(бед ? 1 : 0);
