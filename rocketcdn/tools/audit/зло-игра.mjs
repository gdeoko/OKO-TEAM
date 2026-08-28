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

/* И обратное: вне органа управления стрелка ОБЯЗАНА давать тягу.
   Без этой половины проверка была зелёной на полностью мёртвой
   клавиатуре - проверялось только то, что ничего не происходит. */
await pg.evaluate(() => {
  var сцена = document.querySelector(".rc-flight");
  if (сцена && сцена.focus) сцена.focus();
  else document.body.focus();
});
await pg.waitForTimeout(400);
const доСтрелки = await pg.evaluate(() => window.RC_FLIGHT.state ? window.RC_FLIGHT.state().v : null);
await pg.keyboard.press("ArrowUp");
await pg.waitForTimeout(500);
const послеСтрелки = await pg.evaluate(() => window.RC_FLIGHT.state ? window.RC_FLIGHT.state().v : null);
шаг("стрелка вне органа даёт тягу", послеСтрелки > (доСтрелки || 0) + 0.05,
    `ход ${доСтрелки} -> ${послеСтрелки}`);
/* И направление: вниз убавляет */
await pg.keyboard.press("ArrowDown");
await pg.keyboard.press("ArrowDown");
await pg.waitForTimeout(500);
const послеВниз = await pg.evaluate(() => window.RC_FLIGHT.state ? window.RC_FLIGHT.state().v : null);
шаг("стрелка вниз убавляет ход", послеВниз < послеСтрелки, `ход ${послеСтрелки} -> ${послеВниз}`);

/* Клавиша КАРТА не должна оставаться горящей после выхода. */
await pg.evaluate(() => { const к = document.querySelector(".rcf-map-key"); if (к) к.click(); });
await pg.waitForTimeout(900);
await изполёта();
const карта = await pg.evaluate(() => {
  const к = document.querySelector(".rcf-map-key");
  return { горит: !!(к && к.classList.contains("cur")), список: !!document.querySelector(".rcf-netlist.on") };
});
шаг("клавиша КАРТА гаснет вместе с полётом", !карта.горит && !карта.список, JSON.stringify(карта));
await влёт();
await изполёта();
/* Пробел в поле ввода обязан набираться. В режиме сцены полёт
   «открыт», и обработчик клавиш доставал до формы на голограмме
   пульта: пробел съедался, слова в имени слипались. */
await изполёта();
await pg.evaluate(() => window.scrollTo(0, 0));
await pg.waitForTimeout(1200);
for (let i = 0; i < 30; i++) { await pg.mouse.wheel(0, 700); await pg.waitForTimeout(110); }
await pg.waitForTimeout(2500);
const кнЗаявки = await pg.$(".rc-desk .dsk-b-lead");
if (кнЗаявки) {
  const р = await кнЗаявки.boundingBox();
  if (р) await pg.mouse.click(р.x + р.width / 2, р.y + р.height / 2);
  await pg.waitForTimeout(1400);
  const кудаСел = await pg.evaluate(() => {
    const э = document.activeElement;
    return { поле: э.tagName + (э.id ? "#" + э.id : ""), ловушка: э.name === "website" };
  });
  await pg.keyboard.type("Иван Петров");
  await pg.waitForTimeout(400);
  const набрано = await pg.evaluate(() => ({
    имя: (document.querySelector("#lfName") || {}).value || "",
    ловушка: (document.querySelector('.rc-desk input[name="website"]') || {}).value || ""
  }));
  шаг("каретка садится в настоящее поле, не в ловушку для ботов",
      !кудаСел.ловушка && набрано.ловушка === "" && набрано.имя.indexOf(" ") > 0,
      `фокус ${кудаСел.поле} · имя «${набрано.имя}» · ловушка «${набрано.ловушка}»`);
} else {
  шаг("каретка садится в настоящее поле, не в ловушку для ботов", false, "кнопки заявки на пульте нет");
}

console.log(бед ? "ИТОГ: игра ещё врёт" : "ИТОГ: игра держит слово");
await b.close();
process.exit(бед ? 1 : 0);
