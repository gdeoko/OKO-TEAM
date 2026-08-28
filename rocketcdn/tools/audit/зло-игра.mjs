/* Игра: язык, панели, звук и клавиатура.
   Проверки написаны по бедам, найденным сплошным прохождением:
   английская рубка оставалась русской, меню КУРС теряло три цели
   после первой смены языка, открытая панель переживала выход и
   встречала на повторном заходе, один заход в игру включал звук
   навсегда, пробел на клавише пульта разгонял корабль вместо
   нажатия, а на упоре маршрута рычаг показывал 85 процентов при
   неподвижном корабле. */
const { chromium } = await import(process.env.RC_PW || "/tmp/node_modules/playwright/index.mjs");
const АДРЕС = process.env.RC_URL || "http://127.0.0.1:8123/?rcdbg=1";
const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader",
                                         "--autoplay-policy=no-user-gesture-required"] });
const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
await pg.goto(АДРЕС, { waitUntil: "domcontentloaded", timeout: 120000 });
await pg.waitForTimeout(5000);

let бед = 0;
const шаг = (имя, ок, что) => { if (!ок) бед++; console.log((ок ? "ЧИСТО  " : "БЕДА   ") + имя + (что ? " :: " + что : "")); };
const влёт = async () => {
  await pg.evaluate(() => window.RC_FLIGHT.open());
  await pg.waitForTimeout(6000);
};
const изполёта = async () => {
  await pg.evaluate(() => window.RC_FLIGHT.close());
  await pg.waitForTimeout(2000);
};
const язык = async (к) => {
  await pg.evaluate((к) => {
    const кн = document.querySelectorAll(".hdr-act .pill.lang button");
    const цель = [].find.call(кн, (b) => b.textContent.trim() === к);
    if (цель) цель.click();
  }, к);
  await pg.waitForTimeout(1500);
};

/* ── звук: заход в игру не должен включать его навсегда ── */
const звукДо = await pg.evaluate(() => !!(window.RC_SOUND && window.RC_SOUND.on));
await влёт();
await изполёта();
const звукПосле = await pg.evaluate(() => ({
  звук: !!(window.RC_SOUND && window.RC_SOUND.on),
  классы: document.documentElement.className.match(/snd-on|music-on/g) || []
}));
шаг("звук не остаётся включённым после игры", звукДо === звукПосле.звук && !звукПосле.классы.length,
    `до ${звукДо} · после ${звукПосле.звук} · классы ${звукПосле.классы.join(",") || "нет"}`);

/* ── панель не переживает выход ── */
await влёт();
await pg.evaluate(() => { const к = document.querySelector(".rcf-navkey"); if (к) к.click(); });
await pg.waitForTimeout(900);
await изполёта();
const панельПосле = await pg.evaluate(() => ({
  меню: !!document.querySelector(".rcf-menu.on"),
  справка: !!document.querySelector(".rcf-help.on")
}));
шаг("открытая панель не переживает выход", !панельПосле.меню && !панельПосле.справка,
    JSON.stringify(панельПосле));

/* ── язык внутри полёта ── */
await влёт();
const целейДо = await pg.evaluate(() => document.querySelectorAll(".rcf-nav [data-goal]").length);
await язык("EN");
const ан = await pg.evaluate(() => {
  const help = document.querySelector(".rcf-help");
  const пункты = help ? [].map.call(help.querySelectorAll("li i"), (i) => i.textContent.trim()) : [];
  return {
    целей: document.querySelectorAll(".rcf-nav [data-goal]").length,
    справка: пункты.join(","),
    кириллицаВСправке: help ? /[А-Яа-яЁё]/.test(help.textContent) : null
  };
});
шаг("цели курса не пропадают при смене языка", ан.целей === целейДо, `было ${целейДо} · стало ${ан.целей}`);
шаг("справка переводится", !ан.кириллицаВСправке, ан.справка.slice(0, 60));
await язык("RU");
await pg.waitForTimeout(1200);

/* ── пробел на клавише пульта нажимает её, а не разгоняет ── */
await pg.evaluate(() => { if (window.RC_FLIGHT._set) window.RC_FLIGHT._set(0.3); });
await pg.waitForTimeout(600);
const проба = await pg.evaluate(() => {
  const стоп = document.querySelector(".rcf-stop-key");
  if (!стоп) return { нет: true };
  стоп.focus();
  return { фокус: document.activeElement === стоп };
});
if (!проба.нет) {
  const доV = await pg.evaluate(() => window.RC_FLIGHT.state ? window.RC_FLIGHT.state().v : null);
  await pg.keyboard.press("Space");
  await pg.waitForTimeout(500);
  const послеV = await pg.evaluate(() => window.RC_FLIGHT.state ? window.RC_FLIGHT.state().v : null);
  шаг("пробел на клавише не разгоняет корабль", !(послеV > (доV || 0) + 0.05),
      `ход ${доV} -> ${послеV}`);
}
await изполёта();
console.log(бед ? "ИТОГ: игра ещё врёт" : "ИТОГ: игра держит слово");
await b.close();
process.exit(бед ? 1 : 0);
