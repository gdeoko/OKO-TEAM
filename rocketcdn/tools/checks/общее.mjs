/* Общая часть живых проверок: поднять браузер, войти в полёт,
   закрыть брифинг. Вынесено, чтобы каждая проверка занималась своим
   делом, а не повторяла двадцать строк подготовки. */
/* Playwright в песочнице лежит вне репозитория, поэтому путь берём
   из переменной, а не из имени пакета: голый импорт здесь не
   разрешается. На машине, где playwright установлен как зависимость,
   достаточно задать RC_PW=playwright. */
/* Сначала полный пакет, затем core: в облачной песочнице стоит
   playwright-core, а бинарь берётся из PLAYWRIGHT_BROWSERS_PATH */
const { chromium } = await import(process.env.RC_PW ||
  await Promise.any([
    import("/tmp/node_modules/playwright/index.mjs").then(() => "/tmp/node_modules/playwright/index.mjs"),
    import("/tmp/node_modules/playwright-core/index.mjs").then(() => "/tmp/node_modules/playwright-core/index.mjs")
  ]).catch(() => "/tmp/node_modules/playwright/index.mjs"));

/* ── ПРИЗНАК rcdbg ПРИКЛЕИВАЕТСЯ САМ ──────────────────────────────
   Умолчание несло `?rcdbg=1`, а `RC_URL` из окружения - нет, и набор
   проверок (`все.sh`) зовёт все проверки одним адресом без него.
   Из-за этого проверка колпачков краснела словами «слой пульта не отдал
   лица колпачков»: служебный доступ `RC_FLIGHT._пульт()` открыт только
   по этому признаку и молча отдавал пустоту. Дефекта в продукте не было
   вовсе - яркость на наведении и нажатии росла как положено.

   Проверка, которая работает только когда звонящий помнит про флаг,
   однажды будет запущена без него. Поэтому признак приклеивается здесь,
   один раз на все проверки, и забыть его больше нельзя. */
function сПризнаком(адрес) {
  try {
    const u = new URL(адрес);
    if (!u.searchParams.has("rcdbg")) u.searchParams.set("rcdbg", "1");
    return u.toString();
  } catch (e) {
    /* Не разобрался адрес - отдаём как есть: лучше проверить по кривому
       адресу и увидеть это в выводе, чем упасть на разборе строки. */
    return адрес;
  }
}

export const АДРЕС = сПризнаком(process.env.RC_URL || "http://127.0.0.1:8123/");

export const ТЕЛЕФОН = { имя: "телефон", vp: { width: 412, height: 800 }, dpr: 2, mob: true };
export const ПК = { имя: "ПК", vp: { width: 1440, height: 900 }, dpr: 1, mob: false };

export async function браузер() {
  return chromium.launch({
    executablePath: process.env.RC_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
  });
}

/* Открыть страницу и довести до игры. Возвращает страницу и живой
   список ошибок: он копится дальше сам, проверке остаётся его
   прочитать в конце. */
export async function вПолёт(b, э) {
  const pg = await b.newPage({
    viewport: э.vp, deviceScaleFactor: э.dpr, isMobile: э.mob, hasTouch: э.mob
  });
  const ошибки = [];
  pg.on("pageerror", e => ошибки.push("PE: " + e.message));
  pg.on("console", m => { if (m.type() === "error") ошибки.push("CE: " + m.text().slice(0, 160)); });
  await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
  /* Слою нужно собрать мир: на песочнице без видеокарты это секунды,
     а не миллисекунды. Меньше ждать нельзя, дальше всё посыплется. */
  await pg.waitForTimeout(10000);
  await pg.evaluate(() => window.RC_FLIGHT.open());
  await pg.waitForTimeout(13000);
  await pg.evaluate(() => {
    const b2 = document.querySelector(".rcf-brief .rcf-go, .rcf-brief button");
    if (b2) b2.click();
  });
  await pg.waitForTimeout(1200);
  return { pg, ошибки };
}

/* Прямоугольник проёма рубки в точках экрана. По нему меряется всё,
   что не имеет права заезжать на раму. */
export async function проём(pg) {
  return pg.evaluate(() => {
    const h = document.querySelector(".rc-flight");
    const cs = getComputedStyle(h);
    const д = k => parseFloat(cs.getPropertyValue(k)) / 100;
    return {
      л: innerWidth * д("--cab-wx"),
      п: innerWidth * (д("--cab-wx") + д("--cab-ww")),
      в: innerHeight * д("--cab-wy"),
      н: innerHeight * (д("--cab-wy") + д("--cab-wh"))
    };
  });
}

export function итог(имя, беды, ошибки) {
  const плохо = беды.length || ошибки.length;
  console.log((плохо ? "ПЛОХО  " : "ЧИСТО  ") + имя);
  беды.forEach(б => console.log("   ", б));
  ошибки.slice(0, 6).forEach(о => console.log("   ", о));
  return плохо ? 1 : 0;
}
