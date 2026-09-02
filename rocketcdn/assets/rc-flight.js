/* ═══════════════════════════════════════════════════════════
   Rocket CDN · демо-полёт: космос от первого лица

   Заказчик попросил отдельный режим «полетать»: сесть в ракету,
   облететь Землю, пройти мимо Луны и Марса, над кольцами Сатурна,
   обогнуть чёрную дыру, прыгнуть через гиперпространство и
   вернуться домой. Не видео, а настоящий трёхмерный мир: им
   управляет сам человек.

   Правила мира:
   - Ведёт прокрутка. Колесо, палец, стрелки - это тяга корабля.
     Остановился - корабль плывёт по инерции и замирает. Никакого
     автопилота, кроме плавного доворота камеры к цели.
   - Мышь и палец по горизонтали - взгляд. Камера отклоняется на
     четверть оборота и мягко возвращается: смотреть по сторонам
     можно, потеряться нельзя.
   - Панель корабля чуть видна снизу кадра: присутствие в кабине
     есть, но девяносто процентов кадра - космос. Так просил
     клиент, слово в слово.
   - Земля и Луна - настоящие снимки NASA на сферах. Марс и Сатурн
     дальше и мельче, им хватает процедурной живописи: полосы и
     шум в нужной палитре, нарисованные на холсте при старте.
   - Чёрная дыра - шейдер: тонкий горячий диск, провал в центре.
   - Выход в любой момент: крестик, Esc, кнопка в конце маршрута.
     Страница под полётом стоит нетронутой и ждёт.

   Пока полёт открыт, остальные сцены сайта спят: событие rc:flight
   останавливает ракету, рубку и глобус, чтобы весь кадровый
   бюджет достался космосу. Закрыли - всё просыпается на месте.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
/* Режим приёмки: включается признаком в адресе и открывает пару
   служебных ходов. В обычной сборке они молчат. */
var DBG = false;
try { DBG = /[?&]rcdbg=1/.test(location.search); } catch (e) {}


/* Preserve one horizontal cockpit framing on tall phones. A fixed
   84° vertical lens made a 390×844 viewport crop much more of the
   ship than 390×650, so the same physical console ran off both
   edges. Landscape keeps the cinematic 72° lens. */
function baseViewFov(w, h) {
  if (h <= w) return 72;
  var aspect = w / Math.max(1, h);
  var halfHorizontal = 28.4 * Math.PI / 180;
  var vertical = Math.atan(Math.tan(halfHorizontal) / aspect) * 360 / Math.PI;
  return Math.max(84, Math.min(103, vertical));
}
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var RU = doc.documentElement.lang !== "en";

/* ── Один мир, два продукта ───────────────────────────────────
   Заказчик (переписка 27.08): «Можно ли убрать упоминания узлов CDN
   и вместо них сделать узлы VPN? Будто у нас в космосе узлы
   установлены и ВПН работает по всей галактике» и «Чёрную дыру можно
   назвать РКН, дыра зла, поглощающая все свободы в сети».

   Космос при этом остаётся ОДИН. Делать вторую копию полёта под VPN
   значило бы чинить каждую находку дважды, а расходятся два продукта
   только словами: сеть доставки против сети обхода. Поэтому здесь
   лежит словарь, и он один на весь файл.

   Что показывать, решает `RC_VPN.mode()` - тот самый переключатель,
   что уже стоит в кабине. На rocketcdn.ru он по умолчанию «cdn», и
   сайт говорит ровно то, что говорил. Переключили на «vpn» (руками в
   кабине или заранее, когда полёт переедет на сайт VPN) - те же тела,
   тот же маршрут, другая речь.

   Английский держим рядом с русским: у сайта две версии. */
/* Речь собирается функцией, а не один раз при загрузке файла.

   Пока это был готовый объект, язык в нём застывал тем, с которым
   страница открылась: в режиме сцены оверлей живёт всё время, пока
   человек листает, и титры над окном оставались русскими на
   английской версии до перезагрузки. Теперь на смену языка речь
   пересобирается - это два десятка строк, не геометрия. */
function строитьСлова() { return {
  cdn: {
    сеть:        RU ? "Rocket CDN" : "Rocket CDN",
    полёт:       RU ? "Полёт по сети Rocket CDN" : "Rocket CDN network flight",
    земля:       RU ? "ЗЕМЛЯ · " + УЗЛОВ() + " точек присутствия Rocket CDN"
                    : "EARTH · " + УЗЛОВ() + " Rocket CDN points of presence",
    земляИнфо:   RU ? "ЗЕМЛЯ · диаметр 12 742 км · единственная планета с CDN"
                    : "EARTH · 12,742 km wide · the only planet with a CDN",
    земляДосье:  RU ? "Единственная планета с Rocket CDN. Отсюда расходится вся сеть."
                    : "The only planet with Rocket CDN.",
    спутник:     RU ? "СПУТНИК RC-SAT · ретранслятор Rocket CDN на низкой орбите"
                    : "RC-SAT · Rocket CDN relay in low orbit",
    дыраТитул:   RU ? "ЧЁРНАЯ ДЫРА" : "BLACK HOLE",
    дыраПодпись: RU ? "ГОРИЗОНТ СОБЫТИЙ" : "EVENT HORIZON",
    дыраПуть:    RU ? "ЧЁРНАЯ ДЫРА · так выглядит сайт без CDN"
                    : "BLACK HOLE · a site with no CDN looks like this",
    дыраИнфо:    RU ? "Дальше не возвращаются даже пакеты. Держим дистанцию."
                    : "Not even packets come back.",
    дыраСнимок:  RU ? "ЧЁРНАЯ ДЫРА · первый снимок - M87*, 2019"
                    : "BLACK HOLE · first image - M87*, 2019",
    замкнута:    RU ? "Сеть Rocket CDN замкнута во всех рукавах. Так же она работает и у нас: контент доходит до человека с ближайшего узла, где бы он ни был."
                    : "The Rocket CDN network is complete.",
    марка:       "ROCKET CDN"
  },
  vpn: {
    сеть:        RU ? "RocketVPN" : "RocketVPN",
    полёт:       RU ? "Полёт по сети RocketVPN" : "RocketVPN network flight",
    земля:       RU ? "ЗЕМЛЯ · " + УЗЛОВ() + " узлов RocketVPN по всей галактике"
                    : "EARTH · " + УЗЛОВ() + " RocketVPN nodes across the galaxy",
    земляИнфо:   RU ? "ЗЕМЛЯ · диаметр 12 742 км · отсюда поднялась сеть RocketVPN"
                    : "EARTH · 12,742 km wide · where the RocketVPN network started",
    земляДосье:  RU ? "Отсюда поднялась сеть RocketVPN. Дальше узлы стоят по всей галактике, и свободный канал есть везде."
                    : "Where RocketVPN started. Nodes now stand across the galaxy.",
    спутник:     RU ? "СПУТНИК RC-SAT · узел RocketVPN на низкой орбите"
                    : "RC-SAT · RocketVPN node in low orbit",
    /* Название заказчика дословно. «РКН» на метке, расшифровка - в
       подписи под ней: длинная строка на метке тела не помещается и
       поехала бы за кромку окна. */
    дыраТитул:   RU ? "РКН" : "RKN",
    дыраПодпись: RU ? "ДЫРА ЗЛА" : "PIT OF EVIL",
    дыраПуть:    RU ? "РКН · дыра зла, поглощающая все свободы в сети"
                    : "RKN · the pit of evil that swallows every freedom online",
    дыраИнфо:    RU ? "Поглощает свободы в сети целиком: отсюда не возвращается ни один пакет. Обходим стороной."
                    : "It swallows every freedom online. Not a single packet comes back. We go around.",
    дыраСнимок:  RU ? "РКН · дыра зла, из которой не возвращается ничего"
                    : "RKN · the pit from which nothing returns",
    замкнута:    RU ? "Сеть RocketVPN замкнута во всех рукавах. Так же она работает и у нас: свободный канал находится с ближайшего узла, где бы человек ни был."
                    : "The RocketVPN network is complete.",
    марка:       "ROCKETVPN"
  }
}; }
var СЛОВА = строитьСлова();

/* Речь берём по продукту. Переключатель может ещё не загрузиться -
   тогда говорим как CDN: это состояние по умолчанию у обоих сайтов. */
function СЛ(ключ) {
  var м = "cdn";
  try { if (g.RC_VPN && g.RC_VPN.mode && g.RC_VPN.mode() === "vpn") м = "vpn"; } catch (eСЛ) {}
  var н = СЛОВА[м] || СЛОВА.cdn;
  return н[ключ] != null ? н[ключ] : СЛОВА.cdn[ключ];
}

/* Продукт можно щёлкнуть прямо в полёте, и часть речи к этому моменту
   уже вшита в мир: подпись тела лежит в его userData, ярлык слоя - в
   атрибуте. Титры и списки берут слово сами, эти три - нет, поэтому
   переписываем их по событию переключателя. Мир при этом не
   пересобирается: меняются строки, не геометрия. */
/* Переписать слова, вшитые в мир. Зовётся и при смене продукта, и при
   смене языка: и то и другое меняет строки, но не геометрию. */
function словаМира() {
  try {
    if (ui && ui.wrap) ui.wrap.setAttribute("aria-label", СЛ("полёт"));
    if (!W3) return;
    if (W3.earth && W3.earth.userData) {
      var зБ = W3.earth.userData.info ? W3.earth : (W3.earth.children || [])[0];
      if (зБ && зБ.userData) зБ.userData.info = СЛ("земляИнфо");
    }
    if (W3.hole && W3.hole.children && W3.hole.children[0]) {
      W3.hole.children[0].userData.info = СЛ("дыраСнимок");
    }
    if (W3.sat) {
      var сБ = W3.sat.userData && W3.sat.userData.info ? W3.sat : (W3.sat.children || [])[0];
      if (сБ && сБ.userData) сБ.userData.info = СЛ("спутник");
    }
    /* Список меток пересобирается, когда меняется рукав. Просим ту же
       пересборку: сбрасываем запомненный рукав, и следующий кадр
       соберёт метки заново - уже новыми словами. */
    holoUni = -1;
  } catch (eПр) {}
}
addEventListener("rc:product", словаМира);

/* Язык игры раньше решался один раз, при загрузке файла: человек
   переключал сайт на английский, а кабина, названия целей и
   подсказки оставались русскими до перезагрузки. Теперь на смену
   языка мы пересобираем оверлей - при закрытой игре это незаметно,
   а в полёте ждём выхода, чтобы не рвать кадр. */
var langDirty = false;

/* Перевод на лету, без пересборки.

   Полная пересборка ждёт выхода из полёта - и правильно: рвать кадр
   посреди игры нельзя. Но в режиме сцены оверлей открыт всё время,
   пока человек просто листает страницу, и ждать «выхода» бессмысленно:
   на английской версии он часами видел русский пульт, русские имена
   планет и русский заголовок меню. Здесь меняются только строки,
   геометрия не трогается вовсе. */
function переводНаЛету() {
  if (!ui || !ui.wrap) return;
  try {
    ui.wrap.setAttribute("aria-label", СЛ("полёт"));
    var шапки = ui.wrap.querySelectorAll(".rcf-menu-h");
    if (шапки[0]) {
      var и0 = шапки[0].querySelector("i");
      if (и0) и0.textContent = RU ? "СОЛНЕЧНАЯ СИСТЕМА" : "SOLAR SYSTEM";
    }
    if (шапки[1]) {
      var и1 = шапки[1].querySelector("i");
      if (и1) и1.textContent = RU ? "РЕАЛЬНЫЕ ЭКЗОСИСТЕМЫ" : "REAL EXOPLANET SYSTEMS";
      var с1 = шапки[1].querySelector("span");
      if (с1) с1.textContent = RU ? "каталог NASA · прыжок через Млечный Путь" : "NASA catalog · Milky Way jump";
    }
    if (ui.nav) {
      ui.nav.setAttribute("aria-label", RU ? "Навигация" : "Navigation");
      systemNav();
    }
    /* Справка «КАК ЛЕТАТЬ» переводится на месте, а не пересобирается:
       в последней её строке живёт кнопка звука со своим обработчиком,
       и перезапись разметки его бы потеряла. Раньше панель не
       переводилась вовсе - вся инструкция оставалась русской. */
    if (ui.help) {
      var загСпр = ui.help.querySelector("b");
      if (загСпр) загСпр.textContent = RU ? "КАК ЛЕТАТЬ" : "HOW TO FLY";
      var крестСпр = ui.help.querySelector(".rcf-help-x");
      if (крестСпр) крестСпр.setAttribute("aria-label", RU ? "Закрыть" : "Close");
      var строки = ui.help.querySelectorAll("li");
      var данные = строкиСправки();
      for (var сси = 0; сси < строки.length && сси < данные.length; сси++) {
        var иС = строки[сси].querySelector("i");
        if (иС) иС.textContent = данные[сси].и;
        if (данные[сси].кнопка) continue;
        var спС = строки[сси].querySelector("span");
        if (спС) спС.textContent = данные[сси].т;
      }
      var кнЗв = ui.help.querySelector(".rcf-snd-key");
      if (кнЗв) {
        var вклЗв = кнЗв.getAttribute("aria-pressed") === "true";
        кнЗв.textContent = вклЗв ? (RU ? "выключить" : "turn off") : (RU ? "включить" : "turn on");
      }
    }
    /* Лица клавиш: имена берём из общего списка команд, по классу.
       Списка два быть не может - на этом уже разъехались подсказки. */
    var КЛАССЫ = ["rcf-navkey", "rcf-scan-key", "rcf-deploy", "rcf-help-key",
                  "rcf-auto-key", "rcf-stop-key", "rcf-thr", "rcf-map-key",
                  "rcf-shot", "rcf-zoom-in", "rcf-zoom-out"];
    for (var кки = 0; кки < КЛАССЫ.length; кки++) {
      var кнК = ui.wrap.querySelector("." + КЛАССЫ[кки]);
      if (!кнК) continue;
      var бК = кнК.querySelector("b");
      var имК = capName(кки);
      if (бК && имК) бК.textContent = имК;
    }
    /* Кнопка снимка в широкой ленте живёт отдельным классом */
    var кнСн = ui.wrap.querySelector(".rcf-fire-key b");
    if (кнСн) кнСн.textContent = RU ? "КАДР" : "FRAME";

    /* Режим ведения и шкалы состояния */
    if (ui.cMode) {
      var рК = (ui.cMode.textContent || "").trim();
      var авто = рК === "АВТО" || рК === "AUTO";
      ui.cMode.textContent = авто ? (RU ? "АВТО" : "AUTO") : (RU ? "РУЧНОЙ" : "MANUAL");
    }
    var шкЭ = ui.wrap.querySelector(".rcf-bar-en b");
    if (шкЭ) шкЭ.textContent = RU ? "ЗАРЯД" : "PWR";
    var шкК = ui.wrap.querySelector(".rcf-bar-hull b");
    if (шкК) шкК.textContent = RU ? "КОРПУС" : "HULL";

    /* Лента над пультом: подписи ячеек */
    var ЛЕНТА = RU
      ? { "СЕТЬ": "СЕТЬ", "ОТКРЫТО": "ОТКРЫТО", "КУРС": "КУРС", "ХОД": "ХОД" }
      : { "СЕТЬ": "NET", "ОТКРЫТО": "SEEN", "КУРС": "COURSE", "ХОД": "SPD" };
    var ОБРАТНО = { "NET": "СЕТЬ", "SEEN": "ОТКРЫТО", "COURSE": "КУРС", "SPD": "ХОД" };
    var ячейки = ui.wrap.querySelectorAll(".rcf-d-cell > i");
    for (var яи = 0; яи < ячейки.length; яи++) {
      var было = (ячейки[яи].textContent || "").trim();
      var ключ = ОБРАТНО[было] || было;
      if (ЛЕНТА[ключ]) ячейки[яи].textContent = ЛЕНТА[ключ];
    }
    var едХ = ui.wrap.querySelectorAll(".rcf-speed > span");
    for (var еи = 0; еи < едХ.length; еи++) едХ[еи].textContent = RU ? "км/с" : "km/s";

    /* Карточка брифинга: она показывается перед стартом и держится в
       разметке всё время, поэтому язык в ней тоже обязан меняться. */
    var бр = ui.wrap.querySelector(".rcf-brief-card");
    if (бр) {
      var брБ = бр.querySelector("b"), брП = бр.querySelector("p");
      if (брБ) брБ.textContent = RU ? "ГОТОВ К СТАРТУ" : "READY FOR LAUNCH";
      if (брП) брП.textContent = RU
        ? "Маршрут: Земля → Луна → Марс → Сатурн → Млечный Путь. Курс, тяга и системы корабля уже встроены в нижний пульт."
        : "Route: Earth → Moon → Mars → Saturn → Milky Way. Course, thrust and ship systems are built into the lower console.";
      var брА = бр.querySelector('button[data-mode="auto"]');
      var брР = бр.querySelector('button[data-mode="manual"]');
      if (брА) {
        брА.childNodes[0].nodeValue = RU ? "Автополёт" : "Autopilot";
        var спА = брА.querySelector("span");
        if (спА) спА.textContent = RU ? "смотреть как кино" : "watch as a movie";
      }
      if (брР) {
        брР.childNodes[0].nodeValue = RU ? "Ручное управление" : "Manual";
        var спР = брР.querySelector("span");
        if (спР) спР.textContent = RU ? "колесо и свайп - тяга" : "scroll to thrust";
      }
    }
    var зкр = ui.wrap.querySelector(".rcf-close");
    if (зкр) зкр.setAttribute("aria-label", RU ? "Выйти из полёта" : "Exit flight");

    /* Условие открытия рукава */
    var нужды = ui.wrap.querySelectorAll(".rcf-uni-need");
    for (var ни = 0; ни < нужды.length; ни++) {
      var uu2 = UNIVERSES[ни + (UNIVERSES.length - нужды.length)];
      if (!uu2 || !uu2.need) continue;
      var есть2 = netCount();
      нужды[ни].textContent = есть2 >= uu2.need
        ? (RU ? "сеть развёрнута: " : "network deployed: ") + есть2
        : (RU ? "узлов сети: " : "network nodes: ") + есть2 + " из " + uu2.need;
    }

    /* Список рукавов: подписи и описания */
    var рук = ui.wrap.querySelector(".rcf-uni");
    if (рук) {
      var кн = рук.querySelectorAll("button");
      for (var уи = 0; уи < кн.length && уи < UNIVERSES.length; уи++) {
        var б = кн[уи].querySelector("b"), сп = кн[уи].querySelector("span");
        if (б) б.textContent = имяУни(UNIVERSES[уи]);
        if (сп) сп.textContent = оУни(UNIVERSES[уи]);
      }
    }
    /* Слова, вшитые в сам мир: подписи тел, из которых собираются
       титры и метки. Без этого титры возвращались русскими сразу же -
       следующий кадр читал их из userData. */
    словаМира();
    /* Титры перепишет следующий кадр: держать старую фразу до конца
       её времени показа значит держать её на чужом языке. */
    if (ui.cap) { ui.cap.textContent = ""; ui.cap._t = ""; ui.cap._hold = 0; }
    var подск = ui.wrap.querySelector(".rcf-hint");
    if (подск) {
      подск.textContent = matchMedia("(pointer: coarse)").matches
        ? (RU ? "Палец вверх - тяга, вбок - обзор на 360, щипок - приблизить"
              : "Swipe up to thrust, sideways to look, pinch to zoom")
        : (RU ? "Колесо - тяга, перетаскивание - обзор, shift+колесо - приблизить"
              : "Wheel to thrust, drag to look, shift+wheel to zoom");
    }
    /* Имена клавиш для чтения с экрана и подсказки над ними */
    подсказкиКлавиш.готово = false;
    var клв = ui.wrap.querySelectorAll(".rcf-key, .rcf-mini");
    for (var ки = 0; ки < клв.length; ки++) клв[ки].removeAttribute("aria-label");
    имена(клв);
    keyHintFrame.idx = -1;
    /* Метки над телами пересоберутся следующим кадром */
    holoUni = -1;
    /* Лица клавиш нарисованы в холсте плиты, и язык им задаётся один
       раз при выборе вида. Пока это не сбрасывали, английский
       посетитель, переключивший язык в полёте, видел в разметке
       COURSE и SCAN, а на самой плите по-прежнему КУРС и СКАН. */
    deckSize.вид = "";
    deckLayer();
  } catch (eПЛ) {}
}

function relang() {
  RU = doc.documentElement.lang !== "en";
  СЛОВА = строитьСлова();
  SOLAR_SCI = строитьНауку();
  ЧТОДЕЛАЕТ = строитьЧтоДелает();
  if (F.open) { langDirty = true; переводНаЛету(); return; }
  langDirty = false;
  if (!ui.wrap) return;

  /* Мир нарисован в холст внутри оверлея: снося оверлей, обязаны
     забыть и мир, иначе следующий заход будет рисовать в холст,
     которого больше нет, - чёрный кадр без единой ошибки. */
  if (F.built) {
    F.built = false;
    var холст = ui.cv || null;
    /* Сначала отдаём карте всё дерево мира: планеты, корабль, салон,
       линии сети. renderer.dispose() освобождает только свои буферы,
       геометрию и текстуры three.js не трогает никто. Замер показывал
       около девятисот неотпущенных узлов за круг «полетал, переключил
       язык, вышел». */
    if (W3 && W3.scene) { try { убратьДерево(W3.scene); } catch (eМир) {} }
    if (W3 && W3.r) {
      try { W3.r.dispose(); } catch (e) {}
      try {
        var lose = W3.r.getContext().getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
      } catch (e2) {}
    }
    W3 = null;
    /* Место в бюджете возвращаем ИМЕНЕМ холста. Иначе страховка в
       rc-gl отдаст его второй раз, когда придёт событие о потере
       контекста, и счётчик уедет вниз на круг. */
    if (F.glSlot && g.RC_GL) { F.glSlot = false; g.RC_GL.give(холст); }
    /* И снимаем саму страховку: холст сейчас уйдёт вместе с оверлеем,
       а запись о нём держала бы его до конца жизни страницы. */
    if (холст && g.RC_GL && g.RC_GL.drop) { try { g.RC_GL.drop(холст); } catch (e3) {} }
  }
  if (ui.wrap.parentNode) ui.wrap.parentNode.removeChild(ui.wrap);
  ui = {};
  /* Вместе с обёрткой обязаны забыться и ВСЕ кэши, которые на неё
     ссылаются. Иначе следующий заход рисует в узлы, которых больше
     нет в документе, - без единой ошибки в консоли, просто пусто.

     Путь до беды обычный: открыл полёт, закрыл, переключил язык,
     открыл снова.

     holoReady держал слой меток: он подшивался в обёртку один раз за
     жизнь страницы, и после пересборки метки над планетами и узлами
     писались в отсоединённый узел - над телами не появлялось ничего.

     deck держал холст приборов: подсветка клавиш, радар и шкалы
     рисовались в отсоединённый холст, а панель выглядела голым
     металлом.

     physicalControlsFrame.nodes держал список кнопок: новые кнопки
     не получали ни признака зоны нажатия, ни координат, а в этом
     режиме именно они единолично отвечают за место и размер зоны.

     подсказкиКлавиш.готово держал имена клавиш.

     cabin держал салон целиком - вместе с экранами стен, на которых
     слова запечены в текстуры. Сцены, в которую он был добавлен,
     после сноса уже нет, а cabinBuild() при непустом cabin выходит
     первой же строкой и второй раз салон не собирает. */
  cabin = null;
  holoReady = false;
  holoIds = {};
  holoUni = -1;
  deck = null;
  deckSize = { w: 0, h: 0, d: 0, вид: "" };
  physicalControlsFrame.nodes = null;
  подсказкиКлавиш.готово = false;
  var fab = doc.querySelector(".rcf-fab");
  if (fab) {
    var lbl = fab.querySelector("span");
    if (lbl) lbl.textContent = RU ? "Полёт" : "Flight";
  }
}

doc.addEventListener("rc:lang", relang);
addEventListener("rc:lang", relang);

/* Подписи по маршруту: где мы и почему это про CDN */
var CAPTIONS = [
  { p: 0.00, ключ: "земля" },
  { p: 0.15, t: RU ? "ЛУНА · 384 000 км · пинг 2,6 с" : "MOON · 384,000 km · ping 2.6 s" },
  { p: 0.27, t: RU ? "РАЗГОН · контент идёт с ближайшего узла" : "ACCELERATION · content ships from the nearest node" },
  { p: 0.36, t: RU ? "МАРС · 225 млн км · без кеша сюда" : "MARS · 225M km · no cache out here" },
  { p: 0.50, t: RU ? "САТУРН · 1,4 млрд км от ваших пользователей" : "SATURN · 1.4B km from your users" },
  { p: 0.63, ключ: "дыраПуть" },
  { p: 0.76, t: RU ? "ГИПЕРПРЫЖОК · Rocket доставляет быстрее" : "HYPERJUMP · Rocket delivers faster" },
  { p: 0.90, t: RU ? "ДОМА · заявка - и ваш контент на сверхскорости" : "HOME · one request away from lightspeed content" }
];

var F = {
  open: false, built: false,
  p: 0, v: 0, look: { x: 0, y: 0, tx: 0, ty: 0 },
  last: 0, raf: null, shake: 0,
  /* Автопилот выключен по умолчанию. Владелец сказал прямо: «убери
     автоматический запуск полёта, это же игра, а не экскурсия» -
     корабль стоит и ждёт руки, пока человек сам не даст тягу или не
     выберет кино в брифинге. */
  auto: false, goal: null,
  /* Режим сцены. Кабина игры служит финалом сайта: тот же корпус, то
     же остекление, тот же космос за ним - «та панель (рамка), которая
     в игре, 1:1 она же в ракете». В этом режиме мир построен и
     нарисован, но корабль стоит: ни тяги, ни приборов, ни управления,
     а страница под ним продолжает листаться. Скролл доводит кадр до
     ракурса старта, и оттуда игра начинается без единой склейки. */
  stage: false, stageK: 0,
  /* ── Бортовые системы ──────────────────────────────────────
     Ресурсы у корабля появились не ради счётчиков. Без них игра
     была катанием: лететь можно куда угодно, разворачивать узлы
     бесконечно, и ни одно решение ничего не стоило.

     Теперь стоит. Энергия уходит на прыжок, развёртывание и
     сканирование, а копится у светил - у звезды панели набирают
     заряд быстрее всего. Целостность падает при опасных сближениях.
     Это и есть цена решений: лететь ли к дыре, тратить ли заряд на
     дальний узел или приберечь его на прыжок. */
  en: 100, enMax: 100, hull: 100, warn: 0,
  /* away - мы в чужой вселенной: там нет режиссёрской дуги, движение
     идёт облётами систем и планет, и маршрут родной системы не
     должен утягивать камеру обратно */
  away: false
};

var ui = {};      /* DOM оверлея */
var W3 = null;    /* всё трёхмерное */

/* Журнал исследователя: что уже открыто наведением. Живёт в
   localStorage - вернувшись на сайт, человек продолжает свой
   список, а не начинает заново. */
/* Версия ключа поднята: до неё сканер писал в журнал латинский id
   («mars»), а наведение - первое слово подписи («МАРС»). Одно тело
   считалось дважды, счётчик открытий врал. Старые смешанные журналы
   не читаем, они бы так и остались кривыми. */
var LOG_KEY = "rcdn.explored2";
var explored = {};
try { explored = JSON.parse(localStorage.getItem(LOG_KEY) || "{}") || {}; } catch (e) { explored = {}; }
/* Видно ли тело на самом деле: прячут чаще всего родительскую
   группу, а не сам меш */
/* Тело в список для луча. Кладём в полный список, а рабочий
   пересобирается под текущий рукав в applyUniverse. */
function вЛуч(о) {
  if (!W3 || !о) return;
  if (!W3.pickablesAll) W3.pickablesAll = (W3.pickables || []).slice();
  W3.pickablesAll.push(о);
  if (W3.pickables) W3.pickables.push(о);
}

function подобратьТелаЛуча() {
  if (!W3) return;
  if (!W3.pickablesAll) W3.pickablesAll = (W3.pickables || []).slice();
  var из = W3.pickablesAll, вышло = [];
  for (var i = 0; i < из.length; i++) if (видимоЛи(из[i])) вышло.push(из[i]);
  W3.pickables = вышло;
}

function видимоЛи(o) {
  while (o) { if (o.visible === false) return false; o = o.parent; }
  return true;
}
/* Ключ журнала для тела, по которому попали лучом */
function меткаТела(o) {
  while (o) { if (o.userData && o.userData.mark) return o.userData.mark; o = o.parent; }
  return "";
}
function noteExplored(name) {
  if (explored[name]) return;
  explored[name] = 1;
  try { localStorage.setItem(LOG_KEY, JSON.stringify(explored)); } catch (e) {}
  paintProgress();
  var total = TOTAL_MARKS(), got = Object.keys(explored).length;
  if (got >= total && g.RC_SOUND && g.RC_SOUND.uiConfirm) { try { g.RC_SOUND.uiConfirm(); } catch (e) {} }
}
/* Сколько всего объектов можно открыть. Считаем честно: родные тела
   маршрута плюс все планеты чужих вселенных - иначе счётчик замирал
   на «10/10», хотя миров стало втрое больше. */
function TOTAL_MARKS() {
  /* Родной сектор: Солнце, восемь планет, Луна, дыра, комета,
     спутник, пояс и три галактические цели. Прежние 11 обрезали
     журнал на 11/11, хотя сканер честно видел семнадцать объектов. */
  var n = 17;
  for (var u = 1; u < UNIVERSES.length; u++) {
    for (var s = 0; s < UNIVERSES[u].sys.length; s++) n += UNIVERSES[u].sys[s].planets.length;
  }
  return n;
}

/* Сколько всего мест, где можно развернуть узел. Считаем ровно те,
   на орбите которых включается кнопка: одиннадцать тел родного маршрута,
   звёздные системы чужих вселенных и их планеты. Раньше знаменатель
   у «Сети» брался от «Исследовано» - множества разные, и счётчик мог
   уйти за свой же предел, а «сеть развёрнута полностью» достигалась
   только через это переполнение. */
/* Число точек присутствия берём из реестра, вместе с правками из
   панели. Цифра руками расходилась с сайтом на всё, что владелец
   добавил или скрыл: в шапке 219, в титрах полёта 218. */
function УЗЛОВ() {
  return (g.RC_GEO && g.RC_GEO.COUNT) || 218;
}

function NET_TOTAL() {
  var n = 11;                        /* Земля, Луна, Марс, Сатурн, дыра */
  for (var u = 1; u < UNIVERSES.length; u++) {
    n += UNIVERSES[u].sys.length;
    for (var s = 0; s < UNIVERSES[u].sys.length; s++) {
      n += UNIVERSES[u].sys[s].planets.length;
    }
  }
  return n;
}

function paintProgress() {
  if (!ui.prog) return;
  var got = Object.keys(explored).length, total = TOTAL_MARKS();
  ui.prog.textContent = Math.min(got, total) + "/" + total;
  ui.prog.classList.toggle("full", got >= total);
}

/* Три вселенные: своя окраска неба, туманностей, звёзд и солнца.
   Мир один, но за гипер-вспышкой он оживает в другом свете - и его
   хочется исследовать заново. */
/* ── Вселенные и их звёздные системы ─────────────────────────
   Клиент попросил: «млечный путь, 3-4 вселенные, в каждой куча
   систем планет, по которым можно путешествовать». Родная у нас
   собрана вручную (Земля, Луна, Марс, Сатурн, дыра) - это фильм
   про продукт, там каждая сцена на своём месте. Остальные вселенные
   строятся из описаний ниже: у каждой системы своя звезда и свой
   набор планет, а их вид генерируется по семени, поэтому мир
   повторяется от захода к заходу и его можно узнавать.

   sys[] у родной вселенной пуст: её тела уже есть в сцене. */
/* Подпись вселенной на языке страницы. Названия и описания задаются
   один раз, при загрузке файла, и раньше застывали на том языке, с
   которым страница открылась: в режиме сцены оверлей живёт всё время,
   пока человек листает, и на английской версии список рукавов
   оставался русским. */
function имяУни(u) { return (RU ? u.nameRu : u.nameEn) || u.name || ""; }
function оУни(u)   { return (RU ? u.aboutRu : u.aboutEn) || u.about || ""; }

var UNIVERSES = [
  { name: RU ? "СОЛНЕЧНАЯ СИСТЕМА" : "SOLAR SYSTEM", nameRu: "СОЛНЕЧНАЯ СИСТЕМА", nameEn: "SOLAR SYSTEM", tag: "SOL",
    sky: 0x9db4cc, amb: 0x3a4a68, neb: [0x42b2dc, 0x8a59f6], sun: 0xfff2dc,
    stars: [0xcfe9f5, 0x8fb7ff, 0xffe9c9],
    about: RU ? "8 планет, Луна, Солнце и Млечный Путь" : "8 planets, Moon, Sun and Milky Way", aboutRu: "8 планет, Луна, Солнце и Млечный Путь", aboutEn: "8 planets, Moon, Sun and Milky Way",
    source: "NASA Solar System Exploration",
    sys: [] },

  /* Дальние зоны — не выдуманные параллельные вселенные, а реальные
     каталожные системы нашей Галактики. Это важная поправка к
     реализму: подтверждённых планет из других вселенных наука не
     знает, зато NASA Exoplanet Archive содержит тысячи миров
     Млечного Пути. В игре оставляем четыре навигационных пространства,
     но подписываем их честно — как сектора и поля наблюдений. */
  { name: RU ? "МЕСТНЫЙ РУКАВ · EXO-1" : "LOCAL ARM · EXO-1", nameRu: "МЕСТНЫЙ РУКАВ · EXO-1", nameEn: "LOCAL ARM · EXO-1", tag: "EXO-1",
    sky: 0x8da9d8, amb: 0x344868, neb: [0x477fd4, 0x8059d8], sun: 0xe5efff,
    stars: [0xe9f4ff, 0xa8c8ff, 0xffdcc6],
    about: RU ? "реальные системы в пределах 50 световых лет" : "real systems within 50 light-years", aboutRu: "реальные системы в пределах 50 световых лет", aboutEn: "real systems within 50 light-years",
    source: "NASA Exoplanet Archive",
    sys: [
      { id: "proxima", name: "PROXIMA CENTAURI", star: 0xff8d72, seed: 1741,
        at: [520, 120, -420],
        planets: [
          { kind: "terran", r: 51, dist: 220, tint: 0xb87458, clouds: true,
            name: "PROXIMA b", info: RU ? "подтверждённый мир · 4,24 светового года · орбита 11,2 суток" : "confirmed · 4.24 light-years · 11.2-day orbit" },
          { kind: "rocky", r: 31, dist: 355, tint: 0x8b7468,
            name: "PROXIMA d", info: RU ? "субземля у красного карлика · орбита 5,1 суток" : "sub-Earth · 5.1-day orbit" }
        ] },
      { id: "trappist", name: "TRAPPIST-1", star: 0xff7a62, seed: 9032,
        at: [-620, -80, -980],
        planets: [
          { kind: "rocky", r: 43, dist: 190, tint: 0x9d7867,
            name: "TRAPPIST-1 e", info: RU ? "землеразмерная каменная планета в обитаемой зоне" : "Earth-sized rocky world in the habitable zone" },
          { kind: "ice", r: 46, dist: 330, tint: 0x8daab9, clouds: true,
            name: "TRAPPIST-1 f", info: RU ? "одна из семи подтверждённых планет системы" : "one of seven confirmed planets" },
          { kind: "ocean", r: 50, dist: 510, tint: 0x557f9c, clouds: true,
            name: "TRAPPIST-1 g", info: RU ? "внешняя часть обитаемой зоны · около 40 световых лет" : "outer habitable zone · about 40 light-years" }
        ] },
      { id: "lhs1140", name: "LHS 1140", star: 0xff9a78, seed: 4488,
        at: [180, 260, -1520],
        planets: [
          { kind: "terran", r: 58, dist: 220, tint: 0x648c9f, clouds: true,
            name: "LHS 1140 b", info: RU ? "суперземля в обитаемой зоне красного карлика" : "habitable-zone super-Earth" },
          { kind: "rocky", r: 34, dist: 390, tint: 0x927b6d,
            name: "LHS 1140 c", info: RU ? "внутренняя каменная планета подтверждённой системы" : "confirmed inner rocky planet" }
        ] }
    ] },

  { name: RU ? "ПОЛЕ KEPLER · EXO-2" : "KEPLER FIELD · EXO-2", nameRu: "ПОЛЕ KEPLER · EXO-2", nameEn: "KEPLER FIELD · EXO-2", tag: "EXO-2",
    sky: 0xb08ca8, amb: 0x583852, neb: [0xc06ac7, 0x6f66d9], sun: 0xffd8bf,
    stars: [0xffeee2, 0xd2c5ff, 0x9fc9ff],
    about: RU ? "реальные многопланетные системы телескопа Kepler" : "real multi-planet Kepler systems", aboutRu: "реальные многопланетные системы телескопа Kepler", aboutEn: "real multi-planet Kepler systems",
    source: "NASA Exoplanet Archive",
    sys: [
      { id: "kepler90", name: "KEPLER-90", star: 0xffd6a8, seed: 7711,
        at: [480, -160, -520],
        planets: [
          { kind: "rocky", r: 38, dist: 180, tint: 0xb48b70,
            name: "KEPLER-90 d", info: RU ? "одна из восьми подтверждённых планет системы" : "one of eight confirmed planets" },
          { kind: "gas", r: 78, dist: 360, tint: 0xd6b58a,
            name: "KEPLER-90 g", info: RU ? "газовый гигант во внешней части системы" : "outer-system gas giant" },
          { kind: "gas", r: 92, dist: 570, tint: 0xc89470, rings: true,
            name: "KEPLER-90 h", info: RU ? "самая дальняя из восьми известных планет" : "outermost of eight known planets" }
        ] },
      { id: "kepler62", name: "KEPLER-62", star: 0xffc98f, seed: 2205,
        at: [-540, 140, -1120],
        planets: [
          { kind: "lava", r: 32, dist: 170, tint: 0xb86a4f,
            name: "KEPLER-62 b", info: RU ? "горячая внутренняя суперземля" : "hot inner super-Earth" },
          { kind: "terran", r: 52, dist: 340, tint: 0x6b9f82, clouds: true,
            name: "KEPLER-62 e", info: RU ? "суперземля в обитаемой зоне" : "habitable-zone super-Earth" },
          { kind: "ice", r: 55, dist: 540, tint: 0x93b9ce, clouds: true,
            name: "KEPLER-62 f", info: RU ? "внешняя суперземля в обитаемой зоне" : "outer habitable-zone super-Earth" }
        ] },
      { id: "kepler186", name: "KEPLER-186", star: 0xffa47e, seed: 6613,
        at: [260, -280, -1680],
        planets: [
          { kind: "rocky", r: 34, dist: 190, tint: 0x9a7568,
            name: "KEPLER-186 c", info: RU ? "короткопериодическая каменная планета" : "short-period rocky world" },
          { kind: "desert", r: 41, dist: 350, tint: 0xb28c68,
            name: "KEPLER-186 e", info: RU ? "четвёртая подтверждённая планета системы" : "fourth confirmed planet in the system" },
          { kind: "terran", r: 47, dist: 540, tint: 0x6e9278, clouds: true,
            name: "KEPLER-186 f", info: RU ? "первая землеразмерная планета, найденная в обитаемой зоне" : "first Earth-size planet found in a habitable zone" }
        ] }
    ] },

  /* Финальный сектор: ещё девять реальных каталожных миров, а не
     перекрашенная копия. Раньше он был закрыт шестью узлами сети -
     замок снят, лететь можно сразу. */
  { name: RU ? "ПОЛЕ TESS · EXO-3" : "TESS FIELD · EXO-3", nameRu: "ПОЛЕ TESS · EXO-3", nameEn: "TESS FIELD · EXO-3", tag: "EXO-3",
    sky: 0x79b8b0, amb: 0x27554f, neb: [0x31c9a2, 0x428bdc], sun: 0xd7fff2,
    stars: [0xe1fff7, 0x8fe8d2, 0xc9e2ff],
    about: RU ? "реальные миры TESS · девять каталожных планет" : "real TESS worlds · nine catalogued planets", aboutRu: "реальные миры TESS · девять каталожных планет", aboutEn: "real TESS worlds · nine catalogued planets",
    source: "NASA Exoplanet Archive",
    need: 6,
    sys: [
      { id: "toi700", name: "TOI-700", star: 0xff9a78, seed: 3312,
        at: [420, 180, -560],
        planets: [
          { kind: "rocky", r: 38, dist: 190, tint: 0x9e796a,
            name: "TOI-700 c", info: RU ? "подтверждённая внутренняя планета системы TESS" : "confirmed inner TESS planet" },
          { kind: "terran", r: 49, dist: 350, tint: 0x629589, clouds: true,
            name: "TOI-700 d", info: RU ? "землеразмерная планета в обитаемой зоне" : "Earth-size habitable-zone planet" },
          { kind: "terran", r: 45, dist: 520, tint: 0x78a598, clouds: true,
            name: "TOI-700 e", info: RU ? "землеразмерная планета на внутреннем краю обитаемой зоны" : "Earth-size world near the inner habitable zone" }
        ] },
      { id: "toi270", name: "TOI-270", star: 0xff8d72, seed: 8844,
        at: [-480, -120, -1260],
        planets: [
          { kind: "rocky", r: 41, dist: 180, tint: 0x987469,
            name: "TOI-270 b", info: RU ? "каменистая суперземля · орбита 3,4 суток" : "rocky super-Earth · 3.4-day orbit" },
          { kind: "gas", r: 61, dist: 340, tint: 0x6ca6ad,
            name: "TOI-270 c", info: RU ? "мини-нептун · орбита 5,7 суток" : "mini-Neptune · 5.7-day orbit" },
          { kind: "gas", r: 57, dist: 520, tint: 0x5d8fa8,
            name: "TOI-270 d", info: RU ? "мини-нептун · орбита 11,4 суток" : "mini-Neptune · 11.4-day orbit" }
        ] },
      { id: "cancri55", name: "55 CANCRI", star: 0xffd5a3, seed: 2917,
        at: [260, 250, -1740],
        planets: [
          { kind: "lava", r: 47, dist: 180, tint: 0xd65f3b,
            name: "55 CANCRI e", info: RU ? "ультрагорячая суперземля с орбитой менее суток" : "ultra-hot super-Earth with a sub-day orbit" },
          { kind: "gas", r: 70, dist: 380, tint: 0xb39777,
            name: "55 CANCRI f", info: RU ? "газовый гигант в многопланетной системе" : "gas giant in a multi-planet system" },
          { kind: "gas", r: 94, dist: 610, tint: 0xc4a083, rings: true,
            name: "55 CANCRI d", info: RU ? "дальняя планета системы у солнцеподобной звезды" : "outer planet around a Sun-like star" }
        ] }
    ] }
];
var uniIdx = 0;

/* Пометка «на стекле открыто окно». Правила, которые гасят метки и
   задание под меню, справкой и досье, написаны через :has(). В
   Safari он появился только в версии 15.4, и на телефонах постарше
   фон под окном не тускнел. Класс на слое делает то же самое
   везде - это запасной путь, а не замена. */
function modalMark() {
  if (!ui.wrap) return;
  var on = (ui.menu && ui.menu.classList.contains("on")) ||
           (ui.help && ui.help.classList.contains("on")) ||
           (ui.dos && ui.dos.classList.contains("on"));
  ui.wrap.classList.toggle("rcf-modal", !!on);
}

/* ── Оверлей ─────────────────────────────────────────────────
   DOM собирается один раз при первом открытии: кнопка полёта не
   должна ничего стоить тем, кто её не нажал. */
/* Замок страницы на время полёта. Список тот же, что у окна
   обратного звонка: прямые дети body, кроме самого оверлея. */
function inertPage(on) {
  var kids = doc.body ? doc.body.children : [];
  for (var i = 0; i < kids.length; i++) {
    var el = kids[i];
    if (el === ui.wrap || el.tagName === "SCRIPT") continue;
    /* Окна сайта не глушим. Полёт закрывал ВСЁ, кроме себя, и окно
       обратного звонка, открытое поверх сцены, приходило мёртвым:
       поля не принимали ввод, кнопка не нажималась. Закрытое окно
       и так не ловит ни фокус, ни чтение с экрана - оно скрыто
       по видимости. */
    if (el.classList && el.classList.contains("modal")) continue;
    /* Помечаем то, что закрыли мы. Слепое снятие возвращало в поле
       зрения чтения с экрана слои-канвасы и закрытую шторку, которые
       несут эти признаки прямо в разметке, и вдобавок отменяло
       чужое окно, если оно открыто поверх. */
    if (on) {
      if (!el.hasAttribute("inert")) { el.setAttribute("inert", ""); el.setAttribute("data-rcf-inert", ""); }
      if (!el.hasAttribute("aria-hidden")) { el.setAttribute("aria-hidden", "true"); el.setAttribute("data-rcf-ah", ""); }
    } else {
      if (el.hasAttribute("data-rcf-inert")) { el.removeAttribute("inert"); el.removeAttribute("data-rcf-inert"); }
      if (el.hasAttribute("data-rcf-ah")) { el.removeAttribute("aria-hidden"); el.removeAttribute("data-rcf-ah"); }
    }
  }
}

/* Слой полёта живёт в двух совершенно разных состояниях, и путать
   их нельзя.

   Режим сцены - это задник финала страницы: космос и корпус рубки за
   голограммой пульта. Управления в нём нет, страница под ним живая и
   листается. Роль диалога с aria-modal тут врала дважды: чтение с
   экрана прятало ВЕСЬ сайт за невидимым окном, а пятнадцать погашенных
   органов управления оставались в обходе клавиатурой. Человек с
   клавиатуры упирался в них и не понимал, куда попал.

   Полёт - настоящее полноэкранное окно: страница под ним заглушена,
   и роль диалога тут честная. */
function модальность(вкл) {
  var w = ui.wrap;
  if (!w) return;
  if (вкл) {
    w.removeAttribute("inert");
    w.removeAttribute("aria-hidden");
    w.setAttribute("role", "dialog");
    w.setAttribute("aria-modal", "true");
  } else {
    w.removeAttribute("aria-modal");
    w.setAttribute("role", "presentation");
    /* Заглушать слой целиком нельзя: в режиме сцены внутри него живёт
       рабочий проектор RocketVPN и его голограмма, и они человеку
       нужны. Погашенные органы управления убирает из обхода видимость
       в стилях (.rc-flight.rcf-stage в rc-flight.css), а закрытый
       слой целиком и так visibility: hidden. */
    w.removeAttribute("inert");
    w.removeAttribute("aria-hidden");
  }
}

/* Цели родной системы. Список ОДИН на весь файл: он строится и при
   сборке окна, и заново при смене языка и при возврате из чужого
   рукава. Пока их было два, второй отставал: пояс, комета и спутник
   стояли только в первом, и после первой же смены языка три цели
   пропадали из меню КУРС навсегда - долететь до них можно было
   только кликом по голограмме.

   Строится каждый раз заново: подписи зависят от языка. */
function целиСистемы() {
  return [
    { id: "sun", t: RU ? "Солнце" : "Sun" },
    { id: "mercury", t: RU ? "Меркурий" : "Mercury" },
    { id: "venus", t: RU ? "Венера" : "Venus" },
    { id: "earth", t: RU ? "Земля" : "Earth" },
    { id: "moon", t: RU ? "Луна" : "Moon" },
    { id: "mars", t: RU ? "Марс" : "Mars" },
    { id: "jupiter", t: RU ? "Юпитер" : "Jupiter" },
    { id: "saturn", t: RU ? "Сатурн" : "Saturn" },
    { id: "uranus", t: RU ? "Уран" : "Uranus" },
    { id: "neptune", t: RU ? "Нептун" : "Neptune" },
    { id: "hole", t: RU ? "Дыра" : "Hole" },
    /* Пояс, комета и спутник тоже цели маршрута. Метки на них висят
       и курс по ним ставится. */
    { id: "belt", t: RU ? "Пояс астероидов" : "Asteroid belt" },
    { id: "comet", t: RU ? "Комета" : "Comet" },
    { id: "sat", t: RU ? "Спутник" : "Satellite" },
    { id: "galaxy", t: RU ? "Галактика" : "Galaxy" },
    { id: "home", t: RU ? "Домой" : "Home" }
  ];
}

function buildUI() {
  if (ui.wrap) return;
  var w = doc.createElement("div");
  w.className = "rc-flight";
  /* Полёт занимает весь экран, значит это диалог: без роли чтение с
     экрана считает его обычным куском страницы и продолжает водить
     фокус по разделам сайта под ним */
  /* Рождается слой задником: пока полёт не открыт, окном он не
     является. Переключает состояние функция модальность(). */
  w.setAttribute("role", "presentation");
  /* Чтобы фокус можно было поставить на саму сцену: она диалог, и
     когда закрывается окно поверх неё, вернуть фокус больше некуда -
     страница под сценой глухая. */
  w.setAttribute("tabindex", "-1");
  w.setAttribute("aria-label", СЛ("полёт"));
  /* Цели навигации: по ним корабль умеет долетать сам. Отметки p
     подставляются после сборки мира из честных позиций на дуге. */
  /* Полная система: все восемь планет, Солнце, Луна и дыра.
     «Почему в солнечной системе нету подлёта ко всем 8 планетам
     существующим плюс солнце?» - теперь есть, и к каждому телу
     ведёт своя кнопка. Ряд прокручивается, если не влезает. */
  var NAV = целиСистемы();
  /* Ряд из тринадцати кнопок не помещался никуда: на телефоне было
     видно две, и до Млечного Пути и чужих рукавов человек просто не
     мог добраться. Владелец сказал прямо: «я так и не понял, как
     перейти в Млечный путь и в другие вселенные, панель управления
     и кнопки меню недоработанные, всё обрезано».

     Поэтому вместо ряда - одна кнопка курса и меню под ней. В меню
     всё сразу: тела системы, дальние цели и рукава чужих вселенных,
     разложенные сеткой. Ничего не обрезается ни на каком экране. */
  var navHtml = "";
  for (var ni = 0; ni < NAV.length; ni++) {
    navHtml += '<button type="button" data-goal="' + NAV[ni].id + '">' + NAV[ni].t + "</button>";
  }

  /* Строка условия для рукава: сколько узлов нужно и сколько есть.
     Одна на разметку и на обновление, чтобы текст не разъезжался. */
  /* Строка под кнопкой рукава. Раньше она сообщала УСЛОВИЕ входа -
     сколько узлов нужно и сколько есть. Условия больше нет, лететь
     можно сразу, поэтому строка сообщает состояние сети: это всё
     ещё цель, за которую в кадре хвалят, но уже не пропуск. */
  function нуженУзел(uu) {
    var есть = netCount();
    if (есть >= uu.need) {
      return (RU ? "сеть развёрнута: " : "network deployed: ") + есть;
    }
    return (RU ? "узлов сети: " : "network nodes: ") + есть + " из " + uu.need;
  }
  var uniHtml = "";
  for (var ui2 = 0; ui2 < UNIVERSES.length; ui2++) {
    /* Закрытые вселенные показываем сразу: цель должна быть видна,
       иначе её незачем достигать. Разница только в состоянии кнопки */
    var uu = UNIVERSES[ui2];
    /* Закрытых кнопок больше нет: рукава открыты все и всегда. */
    var locked = false;
    /* Условие открытия пишем прямо в кнопке, а не только всплывающей
       строкой по нажатию. Заказчик до третьего рукава так и не дошёл:
       он нажал, ничего не открылось, и он решил, что рукавов просто
       нет - «полёт застревает на 2 вселенной, 3-4 вообще нету».
       Всплывающая подсказка была, но она выходила ПОД открытым меню
       и до глаз не доходила. */
    uniHtml += '<button type="button" data-uni="' + ui2 + '"' + (locked ? ' class="locked"' : '') + '><b>' +
      имяУни(uu) + '</b><span>' + оУни(uu) + "</span>" +
      (uu.need ? '<u class="rcf-uni-need">' + нуженУзел(uu) + "</u>" : "") +
      "</button>";
  }

  w.innerHTML =
    '<canvas class="rcf-cv"></canvas>' +
    /* Оптика остекления. Слой стоит МЕЖДУ космосом и кабиной: это
       эффекты стекла и объектива, а не наклейка поверх корабля -
       корпус кабины обязан остаться резким и без виньетки.
       Всё внутри рисует CSS по трём переменным, которые кадр
       обновляет: --rcf-warp (разгон), --rcf-glow и --rcf-gx/--rcf-gy
       (блик от светила). Никакого постпроцессинга. */
    '<div class="rcf-fx" aria-hidden="true"><i class="rcf-glare"></i></div>' +
    /* Голограмма подсказки: наведи на клавишу и увидишь, что даст
       нажатие. Это прямой ответ на замечание заказчика «хуй
       поймёшь что за кнопки и зачем они»: подпись на клавише
       называет команду, голограмма объясняет последствие. Живёт
       она на стекле, а не на раме - окно у нас и есть экран. */
    '<div class="rcf-keyhint" aria-hidden="true"><b></b><span></span></div>' +
    /* Справка на стекле.

       Клавиша справки в пульте есть, но команд больше, чем ниш на
       плите, и лишним ставится display:none - в жертву попала именно
       она. На телефоне прочитать правила было негде вовсе, а заказчик
       написал прямо: «нету типо настроек инструкций каких-то».

       Ставим отдельную кнопку на стекло, рядом с приборами: места в
       ряду клавиш она не занимает, режется тем же контуром окна и
       открывает ту же панель «КАК ЛЕТАТЬ». */
    '<div class="rcf-hud">' +
      /* Верхняя полоса стекла собрана колонкой, а не разложена
         абсолютными координатами.

         Было именно так: у титула свой top, у задания свой, у плашки
         аварии третий, и все три попадали в одну полосу 34..81
         пикселя. На телефоне заказчика это выглядело как каша из
         наложенных карточек: «ОСМОТРЕТЬСЯ» лежало поверх названия
         тела, а красная плашка аварии поверх них обоих. Подвинуть
         один top значило сломать другой, потому что величины разные
         на каждой ширине.

         Колонка снимает вопрос целиком: элементы идут друг за другом
         и наложиться не могут в принципе, на любом экране. */
      '<div class="rcf-top">' +
        '<div class="rcf-cap" aria-live="polite"></div>' +
      /* Приборная плита собрана одним узлом: слева счётчики, в
         середине навигация и пуск узла, справа скорость. Раньше всё
         это висело по углам кадра отдельными наклейками, и владелец
         сказал прямо: «кнопки развернуть узел, сканировать и так
         далее - все они наклеены не красиво, не часть интерфейса, ещё
         и криво». Теперь это одна панель, и она стоит в нише пульта
         на самой картинке кабины. */
      /* Боковые стойки: слева заряд, справа целостность корпуса.
         Столбики стоят на скошенных боковинах, где на самом рисунке
         кабины идут приборные панели. */
      /* Текущее задание: одна строка с целью и полоской прогресса.
         Стоит у левого борта, где на корпусе кабины идёт вертикальная
         приборная панель. */
        '<div class="rcf-fail" role="status"></div>' +
        '<div class="rcf-trow">' +
          '<div class="rcf-mis"></div>' +
          '<div class="rcf-netlist" aria-hidden="true"></div>' +
        '</div>' +
      '</div>' +
      '<div class="rcf-help" role="dialog" aria-modal="false">' +
        '<div class="rcf-help-in">' +
          '<button type="button" class="rcf-help-x" aria-label="' + (RU ? "Закрыть" : "Close") + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
          '<b>' + (RU ? "КАК ЛЕТАТЬ" : "HOW TO FLY") + '</b>' +
          '<ul>' + строкиСправки().map(function (с) {
            return '<li><i>' + с.и + '</i><span>' + (с.кнопка
              ? '<button type="button" class="rcf-snd-key" aria-pressed="false">' +
                (RU ? "включить" : "turn on") + '</button>'
              : с.т) + '</span></li>';
          }).join("") + '</ul>' +
        '</div>' +
      '</div>' +
      /* Содержимое меню лежит в своей коробке, и прокручивается
         именно она. Раньше прокручивалась сама панель, а уголковая
         рамка и развёртка строк стоят в ней абсолютом: в
         прокручиваемой коробке абсолют считается от ВСЕЙ высоты
         содержимого, и прямоугольник рамки уезжал в середину панели -
         на кадре узкого экрана он стоит вокруг заголовка «РЕАЛЬНЫЕ
         ЭКЗОСИСТЕМЫ» посреди списка. Теперь рамка принадлежит панели,
         а ездит только список. */
      '<div class="rcf-menu" role="menu">' +
        '<div class="rcf-menu-in">' +
          '<div class="rcf-menu-h"><i>' + (RU ? "СОЛНЕЧНАЯ СИСТЕМА" : "SOLAR SYSTEM") + '</i></div>' +
          '<div class="rcf-nav" role="group" aria-label="' + (RU ? "Навигация" : "Navigation") + '">' + navHtml + '</div>' +
          '<div class="rcf-menu-h"><i>' + (RU ? "РЕАЛЬНЫЕ ЭКЗОСИСТЕМЫ" : "REAL EXOPLANET SYSTEMS") + '</i>' +
            '<span>' + (RU ? "каталог NASA · прыжок через Млечный Путь" : "NASA catalog · Milky Way jump") + '</span></div>' +
          '<div class="rcf-uni">' + uniHtml + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="rcf-track"><i></i></div>' +
      '<div class="rcf-hint">' + (matchMedia("(pointer: coarse)").matches
        ? (RU ? "Палец вверх - тяга, вбок - обзор на 360, щипок - приблизить"
              : "Swipe up to thrust, sideways to look, pinch to zoom")
        : (RU ? "Колесо - тяга. Тяните мышь - обзор на 360. Shift с колесом - приблизить"
              : "Wheel to thrust, drag to look, shift+wheel to zoom")) + '</div>' +
      '<div class="rcf-info" role="status"></div>' +
      /* Досье объекта: голограмма на стекле, ровно та же по духу, что
         и панель вопросов в финале сайта. «По точкам планет добавить
         возможность нажатия сканирования, и выходит видео/фото карты
         Земли голограммой... всё это внутри корабля, голограммы на
         стекле, как в панели управления». */
      '<div class="rcf-dos" hidden>' +
        '<div class="rcf-dos-in">' +
          '<button type="button" class="rcf-dos-x" aria-label="' + (RU ? "Закрыть досье" : "Close") + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
          '<b class="rcf-dos-h"></b>' +
          '<div class="rcf-dos-wrap">' +
            '<video class="rcf-dos-vid" muted playsinline loop preload="none"></video>' +
            '<canvas class="rcf-dos-map" width="640" height="360"></canvas>' +
          '</div>' +
          '<p class="rcf-dos-p"></p>' +
          '<div class="rcf-dos-facts"></div>' +
        '</div>' +
      '</div>' +
      '<div class="rcf-lock" aria-hidden="true"><b></b><b></b><b></b><b></b><span></span></div>' +
    '</div>' +
        /* ── Панель управления: нижний борт корабля ──────────
           Не карточка поверх кадра, а сам борт: непрозрачный металл
           во всю ширину, и в него вшиты все приборы. Верхняя строка
           панели - табло (сеть, открытые объекты, курс, дистанция,
           режим, заряд и корпус), нижняя - физические клавиши,
           ползунок тяги и скорость. Владелец сформулировал точно:
           «кнопки должны быть частью панели, реальной панели, а не
           карточки поверх картинки». */
        /* ── ПУЛЬТ КОРАБЛЯ ──────────────────────────────────
           Не полоса поверх кадра, а сама консоль. Панель встроена в
           нишу пульта на рисунке кабины и наклонена перспективой,
           как настоящая приборная доска: клавиши лежат НА плоскости
           консоли, между её экранами. Владелец повторил трижды -
           «кнопки должны быть частью панели, а не наклейкой».

           Три блока, как на любом реальном пульте:
             левый  - навигация (радар, курс, карта сети);
             центр  - работа (скан, узел, залп, авто, стоп);
             правый - ход (рычаг тяги, скорость, обзор, снимок).
           Железо всех гнёзд рисует deckSkin одной текстурой. */
        '<div class="rcf-deck">' +
          '<div class="rcf-d-face">' +
            /* Верхняя лента: бортовое табло */
            '<div class="rcf-d-top">' +
              '<span class="rcf-d-cell"><i>' + (RU ? "СЕТЬ" : "NET") + '</i><span class="rcf-net">0/' + NET_TOTAL() + '</span></span>' +
              '<span class="rcf-d-cell rcf-d-seen"><i>' + (RU ? "ОТКРЫТО" : "SEEN") + '</i><span class="rcf-prog">0/' + TOTAL_MARKS() + '</span></span>' +
              '<span class="rcf-d-cell rcf-d-course"><i>' + (RU ? "КУРС" : "COURSE") + '</i>' +
                '<span class="rcf-c-goal">—</span><u class="rcf-c-dist">—</u>' +
                '<em class="rcf-c-mode">' + (RU ? "РУЧНОЙ" : "MANUAL") + '</em></span>' +
              '<span class="rcf-d-cell rcf-d-spd"><i>' + (RU ? "ХОД" : "SPD") + '</i><span class="rcf-speed"><b>0</b><span>' + (RU ? "км/с" : "km/s") + '</span></span></span>' +
              '<span class="rcf-d-cell rcf-bars">' +
                '<span class="rcf-d-meter rcf-bar-en"><b>' + (RU ? "ЗАРЯД" : "PWR") + '</b><s><i></i></s><u>100</u></span>' +
                '<span class="rcf-d-meter rcf-bar-hull"><b>' + (RU ? "КОРПУС" : "HULL") + '</b><s><i></i></s><u>100</u></span>' +
              '</span>' +
              /* Снимок на портрете живёт здесь, в ленте.

                 На плите портрета восемь гнёзд, а команд одиннадцать,
                 и снимок в них не помещался: на телефоне кадр было не
                 снять вовсе. Отбирать гнездо у курса, скана, узла,
                 справки, автопилота, стопа, тяги или сети ради него
                 неправильно - все восемь нужны в полёте. Лента же
                 стоит на стекле и места под маленький значок в ней
                 хватает. На широком экране кнопка скрыта: там снимок
                 лежит в своём гнезде на плите. */
              '<button type="button" class="rcf-d-shot" aria-label="' +
                (RU ? "СНИМОК. Снять кадр того, что перед носом" : "Shot. Capture what is ahead") + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
                'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M3.4 8.2h3.1l1.5-2.4h8l1.5 2.4h3.1v10.2H3.4z"/>' +
                '<circle cx="12" cy="13.1" r="3.5"/></svg>' +
              '</button>' +
            '</div>' +
            '<div class="rcf-d-main">' +
              /* ЛЕВЫЙ БЛОК: куда идём */
              '<div class="rcf-d-bay rcf-d-nav">' +
                '<canvas class="rcf-radar" width="220" height="220" aria-hidden="true"></canvas>' +
                '<div class="rcf-d-col">' +
                  '<button type="button" class="rcf-key rcf-navkey" aria-expanded="false" aria-label="' + (RU ? "КУРС. Список всех тел и прыжок в другие рукава" : "Course. Every body plus the jump to other arms") + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>' +
                    '<b>' + (RU ? "КУРС" : "COURSE") + '</b></button>' +
                  '<button type="button" class="rcf-key rcf-map-key" title="' + (RU ? "Карта сети" : "Network map") + '" aria-label="' + (RU ? "Карта сети" : "Network map") + '">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    '<path d="M9 4L3.5 6.2v13.3L9 17.3l6 2.4 5.5-2.2V4.2L15 6.4z"/><path d="M9 4v13.3M15 6.4v13.3"/></svg>' +
                    '<b>' + (RU ? "СЕТЬ" : "NET") + '</b></button>' +
                '</div>' +
              '</div>' +
              /* ЦЕНТР: работа с миром */
              '<div class="rcf-d-bay rcf-d-work">' +
                '<button type="button" class="rcf-key rcf-scan-key" data-scan aria-pressed="false" aria-label="' + (RU ? "СКАН. Снять карту тела, к которому подошли" : "Scan. Map the body you are next to") + '">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                  '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>' +
                  '<path d="M3 12h18"/></svg>' +
                  '<b>' + (RU ? "СКАН" : "SCAN") + '</b></button>' +
                '<button type="button" class="rcf-key rcf-deploy" aria-label="' + (RU ? "УЗЕЛ. Поставить узел на орбите тела" : "Node. Put a node in the body orbit") + '">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                  '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>' +
                  '<path d="M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>' +
                  '<b>' + (RU ? "УЗЕЛ" : "NODE") + '</b></button>' +
                '<button type="button" class="rcf-key rcf-fire-key" data-act="shot" aria-label="' + (RU ? "СНИМОК. Снять кадр того, что перед носом" : "Shot. Capture what is ahead") + '">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                  '<path d="M3.4 8.2h3.1l1.5-2.4h8l1.5 2.4h3.1v10.2H3.4z"/>' +
                  '<circle cx="12" cy="13.1" r="3.5"/></svg>' +
                  '<b>' + (RU ? "СНИМОК" : "SHOT") + '</b></button>' +
                '<button type="button" class="rcf-key rcf-auto-key" data-autokey aria-pressed="false" aria-label="' + (RU ? "АВТО. Автопилот ведёт корабль сам" : "Auto. Autopilot flies the ship") + '">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                  '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="4"/></svg>' +
                  '<b>' + (RU ? "АВТО" : "AUTO") + '</b></button>' +
                '<button type="button" class="rcf-key rcf-stop-key" aria-label="' + (RU ? "СТОП. Погасить ход до нуля" : "Stop. Kill the thrust") + '">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                  '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/></svg>' +
                  '<b>' + (RU ? "СТОП" : "STOP") + '</b></button>' +
              '</div>' +
              /* ПРАВЫЙ БЛОК: ход корабля */
              '<div class="rcf-d-bay rcf-d-drive">' +
                '<div class="rcf-thr" role="slider" aria-label="' + (RU ? "Тяга" : "Thrust") +
                  '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">' +
                  '<i class="rcf-thr-fill"></i>' +
                  '<b>' + (RU ? "ТЯГА" : "THRUST") + '</b>' +
                '</div>' +
                '<div class="rcf-d-col">' +
                  '<div class="rcf-speed"><b>0</b><span>' + (RU ? "км/с" : "km/s") + '</span></div>' +
                  '<div class="rcf-d-row">' +
                    '<button type="button" class="rcf-key rcf-mini rcf-zoom-in" title="' + (RU ? "Приблизить" : "Zoom in") + '" aria-label="' + (RU ? "Приблизить" : "Zoom in") + '">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
                      'stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/>' +
                      '<path d="M15.4 15.4L21 21M10.5 7.6v5.8M7.6 10.5h5.8"/></svg></button>' +
                    '<button type="button" class="rcf-key rcf-mini rcf-zoom-out" title="' + (RU ? "Отдалить" : "Zoom out") + '" aria-label="' + (RU ? "Отдалить" : "Zoom out") + '">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
                      'stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/>' +
                      '<path d="M15.4 15.4L21 21M7.6 10.5h5.8"/></svg></button>' +
                    '<button type="button" class="rcf-key rcf-mini rcf-shot" title="' + (RU ? "Снимок из кабины" : "Snapshot") + '" aria-label="' + (RU ? "Снимок из кабины" : "Snapshot") + '">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
                      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                      '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/></svg></button>' +
                    '<button type="button" class="rcf-key rcf-mini rcf-help-key" title="' + (RU ? "Справка" : "Help") + '" aria-label="' + (RU ? "Справка" : "Help") + '">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
                      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                      '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.4"/>' +
                      '<path d="M12 17.2h.01"/></svg></button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
    '<div class="rcf-holo" aria-hidden="true"><img src="assets/mark.webp" alt=""><i></i></div>' +
    '<button type="button" class="rcf-auto" aria-pressed="false">' +
      '<i></i><span>' + (RU ? "Автопилот" : "Autopilot") + '</span>' +
    '</button>' +
    '<div class="rcf-brief">' +
      '<div class="rcf-brief-card">' +
        '<b>' + (RU ? "ГОТОВ К СТАРТУ" : "READY FOR LAUNCH") + '</b>' +
        '<p>' + (RU ? "Маршрут: Земля → Луна → Марс → Сатурн → Млечный Путь. Курс, тяга и системы корабля уже встроены в нижний пульт." : "Route: Earth → Moon → Mars → Saturn → Milky Way. Course, thrust and ship systems are built into the lower console.") + '</p>' +
        '<div class="rcf-brief-btns">' +
          '<button type="button" data-mode="auto">' + (RU ? "Автополёт" : "Autopilot") + '<span>' + (RU ? "смотреть как кино" : "watch as a movie") + '</span></button>' +
          '<button type="button" data-mode="manual">' + (RU ? "Ручное управление" : "Manual") + '<span>' + (RU ? "колесо и свайп - тяга" : "scroll to thrust") + '</span></button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<button type="button" class="rcf-close" aria-label="' + (RU ? "Выйти из полёта" : "Exit flight") + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>' +
    '<div class="rcf-fade"></div>';
  doc.body.appendChild(w);
  ui.wrap = w;
  ui.cv = w.querySelector(".rcf-cv");
  /* Узла .rcf-cab в разметке нет с тех пор, как кабина стала
     объёмной: плоская рама живёт в ui.cabFrame и подставляется
     отдельно. Ссылку не заводим - она годами была пустой, а код
     вокруг неё делал вид, что работает. */
  ui.hud = w.querySelector(".rcf-hud");
  ui.cap = w.querySelector(".rcf-cap");
  ui.nav = w.querySelector(".rcf-nav");
  ui.bar = w.querySelector(".rcf-track i");
  ui.hint = w.querySelector(".rcf-hint");
  ui.keyhint = w.querySelector(".rcf-keyhint");
  /* Подсказка по клавише от самих клавиш, а не от трёхмерных
     колпачков.

     Прежняя версия читала наведение на колпачки рубки, а в готовой
     рубке колпачки запечены в саму картинку, объектов нет, и функция
     выходила по первой строке. На телефоне подсказка не появлялась
     ни разу - именно поэтому заказчик и написал, что по кнопкам не
     понять, что они делают.

     Здесь мы идём от разметки: у каждой клавиши уже есть имя, к нему
     добавлено объяснение последствия. Нажал - прочитал. */
  setTimeout(function () { подсказкиКлавиш(w); }, 0);
  ui.keyhintName = ui.keyhint ? ui.keyhint.querySelector("b") : null;
  ui.keyhintText = ui.keyhint ? ui.keyhint.querySelector("span") : null;
  /* Скорость показана в двух местах: в отсеке хода и в ленте
     табло (на телефоне отсек ужимается). Пишем в обе. */
  ui.speedAll = w.querySelectorAll(".rcf-speed b");
  ui.speed = ui.speedAll[0];
  ui.auto = w.querySelector(".rcf-auto");
  ui.info = w.querySelector(".rcf-info");
  ui.mis = w.querySelector(".rcf-mis");
  ui.fail = w.querySelector(".rcf-fail");
  ui.netList = w.querySelector(".rcf-netlist");
  ui.help = w.querySelector(".rcf-help");
  var helpKey = w.querySelector(".rcf-help-key");
  if (helpKey) {
    helpKey.addEventListener("click", function () {
      var on = !ui.help.classList.contains("on");
      if (on) звукПодпись();
      ui.help.classList.toggle("on", on);
      helpKey.classList.toggle("cur", on);
      modalMark();
      if (g.RC_SOUND) { try { (g.RC_SOUND.uiClick || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
    });
  }
  /* Отдельной кнопки справки на стекле больше нет. Она появлялась,
     пока клавиша СПРАВКА не помещалась на плиту: команд было больше,
     чем ниш, и лишним ставился display:none. Теперь справка стоит
     четвёртой в ряду и видна на телефоне, а круглое «?» в углу
     проёма только ложилось на подпись о теле и добавляло на экран
     ещё одну надпись - ровно то, на что жаловались.  */
  /* Звук переключается тем же ходом, что и в шапке сайта: общий
     на весь сайт, чтобы состояние не разъезжалось между страницей
     и полётом. */
  var sndKey = w.querySelector(".rcf-snd-key");
  function звукПодпись() {
    if (!sndKey) return;
    var вкл = !!(g.RC_SOUND && g.RC_SOUND.on);
    sndKey.textContent = вкл ? (RU ? "выключить" : "turn off") : (RU ? "включить" : "turn on");
    sndKey.setAttribute("aria-pressed", вкл ? "true" : "false");
    sndKey.classList.toggle("cur", вкл);
  }
  if (sndKey) {
    sndKey.addEventListener("click", function () {
      if (g.RC_SOUND && g.RC_SOUND.toggle) { try { g.RC_SOUND.toggle(); } catch (eЗв) {} }
      звукПодпись();
      /* Включение поднимает аудиоконтекст, и флаг встаёт не в тот же
         тик: без второй сверки подпись оставалась «включить» на уже
         включённом звуке. Замер показал ровно это. */
      setTimeout(звукПодпись, 280);
    });
    звукПодпись();
  }
  var helpX = w.querySelector(".rcf-help-x");
  if (helpX) helpX.addEventListener("click", function () {
    ui.help.classList.remove("on");
    if (helpKey) helpKey.classList.remove("cur");
    modalMark();
  });
  var stopKey = w.querySelector(".rcf-stop-key");
  if (stopKey) {
    stopKey.addEventListener("click", function () {
      /* Полная остановка: тяга в ноль, цель снята, рычаг опущен.
         Орбиту не трогаем - на ней стоять и надо. */
      F.v = 0;
      F.thr = 0;
      F.goal = null;
      F.goalId = null;
      F.goalName = null;
      courseText(null);
      if (F.auto) setAuto(false);
      if (ui.thrFill) ui.thrFill.style.width = "0%";
      if (F.paintThrottle) F.paintThrottle();
      say(RU ? "ПОЛНАЯ ОСТАНОВКА" : "FULL STOP", 1600);
      if (g.RC_SOUND && g.RC_SOUND.brake) { try { g.RC_SOUND.brake(); } catch (e) {} }
    });
  }
  ui.bars = w.querySelector(".rcf-bars");
  ui.enTx = w.querySelector(".rcf-bar-en u");
  ui.huTx = w.querySelector(".rcf-bar-hull u");
  ui.cGoal = w.querySelector(".rcf-c-goal");
  ui.cDist = w.querySelector(".rcf-c-dist");
  ui.cMode = w.querySelector(".rcf-c-mode");
  ui.cCell = w.querySelector(".rcf-d-course");
  ui.radar = w.querySelector(".rcf-radar");
  ui.thr = w.querySelector(".rcf-thr");
  var shotBtn = w.querySelector(".rcf-shot");
  if (shotBtn) shotBtn.addEventListener("click", shoot);
  var shotTop = w.querySelector(".rcf-d-shot");
  if (shotTop) shotTop.addEventListener("click", function () { shoot(); });
  ui.thrFill = w.querySelector(".rcf-thr-fill");
  bindThrottle();
  ui.dos = w.querySelector(".rcf-dos");
  ui.dosH = w.querySelector(".rcf-dos-h");
  ui.dosMap = w.querySelector(".rcf-dos-map");
  ui.dosVid = w.querySelector(".rcf-dos-vid");
  ui.dosP = w.querySelector(".rcf-dos-p");
  ui.dosF = w.querySelector(".rcf-dos-facts");
  w.querySelector(".rcf-dos-x").addEventListener("click", function () { dosClose(); });
  ui.brief = w.querySelector(".rcf-brief");
  ui.uni = w.querySelector(".rcf-uni");
  ui.menu = w.querySelector(".rcf-menu");
  ui.navKey = w.querySelector(".rcf-navkey");
  ui.navKeyTx = w.querySelector(".rcf-navkey u");
  if (ui.navKey) {
    ui.navKey.addEventListener("click", function () {
      var on = !ui.menu.classList.contains("on");
      ui.menu.classList.toggle("on", on);
      ui.navKey.setAttribute("aria-expanded", on ? "true" : "false");
      ui.navKey.classList.toggle("cur", on);
      modalMark();
      if (g.RC_SOUND) { try { (g.RC_SOUND.uiClick || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
    });
  }
  ui.autoKey = w.querySelector(".rcf-auto-key");
  /* Клавиши панели слушают клики напрямую: прежний делегат висел на
     списке целей, и СКАН с АВТО были мёртвыми - главная жалоба
     «функционала нет вообще» начиналась с этого */
  if (ui.autoKey) ui.autoKey.addEventListener("click", function () {
    setAuto(!F.auto);
    deckSkinSoon();
    if (g.RC_SOUND && g.RC_SOUND.key) { try { g.RC_SOUND.key(); } catch (e) {} }
  });
  ui.scanKey = w.querySelector(".rcf-scan-key");
  if (ui.scanKey) ui.scanKey.addEventListener("click", function () {
    F.scan = !F.scan;
    ui.scanKey.setAttribute("aria-pressed", F.scan ? "true" : "false");
    ui.scanKey.classList.toggle("cur", F.scan);
    if (!F.scan && ui.lock) ui.lock.classList.remove("on");
    deckSkinSoon();
    if (g.RC_SOUND && g.RC_SOUND.key) { try { g.RC_SOUND.key(); } catch (e) {} }
    if (F.scan) { if (g.RC_SOUND && g.RC_SOUND.scan) { try { g.RC_SOUND.scan(); } catch (e) {} } }
  });
  ui.prog = w.querySelector(".rcf-prog");
  ui.net = w.querySelector(".rcf-net");
  ui.deploy = w.querySelector(".rcf-deploy");
  ui.deploy.addEventListener("click", function () { deployNode(); });
  /* Остальные клавиши пульта. Все слушают клик напрямую: делегат
     на списке целей их не видел, и половина пульта была мертва. */
  var fireK = w.querySelector(".rcf-fire-key");
  if (fireK) fireK.addEventListener("click", function () { shoot(); });
  /* Второго слушателя на СТОП здесь больше нет. Их было два - этот
     и тот, что выше по файлу, - оба гасили ход и оба писали своё
     сообщение: «ПОЛНАЯ ОСТАНОВКА» и «ПОЛНЫЙ СТОП» затирали друг
     друга, и рычаг опускал только один из них. Остался верхний: он
     полнее, опускает рычаг и даёт звук тормоза. */
  var mapK = w.querySelector(".rcf-map-key");
  if (mapK) mapK.addEventListener("click", function () {
    if (ui.netList) ui.netList.classList.toggle("on");
    mapK.classList.toggle("cur", ui.netList && ui.netList.classList.contains("on"));
    deckSkinSoon();
  });
  var zIn = w.querySelector(".rcf-zoom-in");
  if (zIn) zIn.addEventListener("click", function () {
    F.zoom = Math.min(1, (F.zoom || 0) + 0.22);
  });
  var zOut = w.querySelector(".rcf-zoom-out");
  if (zOut) zOut.addEventListener("click", function () {
    F.zoom = Math.max(0, (F.zoom || 0) - 0.22);
  });
  ui.lock = w.querySelector(".rcf-lock");
  ui.lockCap = ui.lock.querySelector("span");
  ui.scanKey = w.querySelector(".rcf-scan-key");
  ui.fade = w.querySelector(".rcf-fade");
  ui.fx = w.querySelector(".rcf-fx");

  /* The cockpit shell is rendered by RC_CABIN in the WebGL scene.
     No image is warmed or faded in here: that fade was a scene swap. */

  ui.brief.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-mode]");
    if (!b) return;
    ui.brief.classList.add("off");
    setAuto(b.getAttribute("data-mode") === "auto");
    F.brief = false;
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (err) {} }
  });
  w.querySelector(".rcf-close").addEventListener("click", close);
  ui.auto.addEventListener("click", function () {
    setAuto(!F.auto);
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
  });
  ui.uni.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-uni]");
    if (!b) return;
    var want = parseInt(b.getAttribute("data-uni"), 10);
    var uw = UNIVERSES[want];
    /* Кнопки без разбираемого номера быть не должно, но если она
       появится, прыгать по ней нельзя: uniIdx уйдёт в NaN и слой
       начнёт падать на каждом кадре. */
    if (!uw) return;
    /* ── Закрытых рукавов больше нет ──────────────────────────
       Здесь стоял замок: последний рукав открывался за шесть узлов
       сети. Замысел понятен - дать цель, - но на деле он отрезал от
       человека половину космоса, а космос тут и есть содержание.
       Заказчик сказал прямо: «убрать ограничения, чтобы можно было
       посмотреть весь космос абсолютно весь без ограничений, все
       галактики, вселенные, Млечный путь, все планеты».

       Поле need в описаниях рукавов оставлено намеренно: по нему
       по-прежнему считается поздравление «открыт новый рукав» в тот
       момент, когда узлов набралось столько же. Достижение осталось
       достижением, но перестало быть пропуском. */
    /* Прыгаем: закрываем ОБЩЕЕ меню курса - список рукавов теперь
       живёт внутри него, и прежний remove с внутреннего блока меню
       не убирал */
    if (ui.menu) ui.menu.classList.remove("on");
    if (ui.navKey) { ui.navKey.setAttribute("aria-expanded", "false"); ui.navKey.classList.remove("cur"); }
    modalMark();
    if (want !== uniIdx) jumpUniverse(want);
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiClick || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (err) {} }
  });
  ui.nav.addEventListener("click", function (e) {
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiClick || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (err) {} }
    /* Взялся за приборы - карта миссии больше не нужна. Раньше она
       оставалась висеть поперёк кадра поверх выбранного курса. */
    if (F.brief) { F.brief = false; if (ui.brief) ui.brief.classList.add("off"); }
    var ak = e.target.closest("button[data-autokey]");
    if (ak) {
      setAuto(!F.auto);
      return;
    }
    var sc = e.target.closest("button[data-scan]");
    if (sc) {
      F.scan = !F.scan;
      sc.setAttribute("aria-pressed", F.scan ? "true" : "false");
      sc.classList.toggle("cur", F.scan);
      if (!F.scan && ui.lock) ui.lock.classList.remove("on");
      return;
    }
    /* Кнопки систем и планет чужой вселенной: у них своя навигация,
       маршрутной кривой там нет */
    var sy = e.target.closest("button[data-sys]");
    if (sy) {
      var pa = sy.getAttribute("data-pl");
      goSystem(parseInt(sy.getAttribute("data-sys"), 10),
               pa === null ? undefined : parseInt(pa, 10));
      if (ui.menu) ui.menu.classList.remove("on");
      if (ui.navKey) { ui.navKey.setAttribute("aria-expanded", "false"); ui.navKey.classList.remove("cur"); }
      modalMark();
      var all = ui.nav.querySelectorAll("button");
      for (var q = 0; q < all.length; q++) all[q].classList.remove("cur");
      sy.classList.add("cur");
      return;
    }
    var b = e.target.closest("button[data-goal]");
    if (!b) return;
    /* Цель выбрана - меню закрывается: держать его открытым поверх
       кадра незачем, курс уже задан */
    if (ui.menu) { ui.menu.classList.remove("on"); }
    if (ui.navKey) { ui.navKey.setAttribute("aria-expanded", "false"); ui.navKey.classList.remove("cur"); }
    modalMark();
    goTo(b.getAttribute("data-goal"));
  });
  bindControls();
}

/* Compatibility no-op for old call sites. The cockpit is geometry;
   loading a portrait/wide image would reintroduce the seam. */
function cabSrc() {
  return;
}

/* ── Досье объекта: скан на стекле ───────────────────────────
   Нажатие по телу в кадре снимает с него карту. Не подпись в углу,
   а настоящий разбор: развёртка поверхности, снятая с той же
   текстуры, которой планета нарисована в мире, поверх неё сетка
   координат, отметки узлов сети и бегущая строка сканера.

   Для Земли это буквально карта мира голограммой - то, что владелец
   и просил: «ближе подлетать к Земле, видеть города, раскрывать типа
   карты мира, какие-то фотки голограммой показывать».

   Досье не отдельный экран: оно живёт в остеклении кабины, тем же
   материалом, что и панель вопросов в финале сайта. */
var dosT = 0, dosName = "";

/* Научный слой бортового справочника. Размеры и периоды здесь —
   свойства реальных тел, а не расстояние в условных единицах
   игровой сцены. Это отделяет физику мира от режиссёрского масштаба:
   Юпитер может стоять ближе ради красивого облёта, но досье всё
   равно показывает его настоящий диаметр и орбитальный период. */
/* Таблицы, зависящие от языка, СТРОЯТСЯ, а не пишутся один раз.
   Раньше они считались при разборе файла по значению RU и оставались
   русскими на всей английской странице: досье планет, подписи клавиш
   для чтения с экрана и подсказки над ними. */
function строитьНауку() {
  /* Единица длины тоже переводится: в русском досье стояло
     «ДИАМЕТР 116 460 km». */
  var КМ = RU ? " км" : " km";
  return {
  "СОЛНЦЕ":   { en: "SUN",       type: RU ? "звезда G2V" : "G2V star", diameter: "1 392 700" + КМ,  period: RU ? "оборот ~25-35 суток" : "~25-35 day rotation", text: RU ? "Фотосфера, грануляция, пятна и корона; в ней сосредоточено 99,86% массы системы." : "Photosphere, granulation, sunspots and corona; 99.86% of the Solar System's mass." },
  "МЕРКУРИЙ": { en: "MERCURY",   type: RU ? "каменная планета" : "rocky planet", diameter: "4 879" + КМ,  period: RU ? "88 земных суток" : "88 Earth days", text: RU ? "Ближайшая к Солнцу планета: почти без атмосферы, с резко контрастными температурами." : "Closest planet to the Sun, with almost no atmosphere and extreme temperatures." },
  "ВЕНЕРА":   { en: "VENUS",     type: RU ? "каменная планета" : "rocky planet", diameter: "12 104" + КМ,  period: RU ? "224,7 суток" : "224.7 days", text: RU ? "Плотная атмосфера CO₂ и облака серной кислоты создают сильнейший парниковый эффект." : "A dense CO₂ atmosphere and sulfuric-acid clouds drive an extreme greenhouse effect." },
  "ЗЕМЛЯ":    { en: "EARTH",     type: RU ? "каменная планета" : "rocky planet", diameter: "12 742" + КМ,  period: RU ? "365,26 суток" : "365.26 days", text: RU ? "Океанический мир с азотно-кислородной атмосферой, магнитосферой и единственной известной биосферой." : "An ocean world with a nitrogen-oxygen atmosphere, magnetosphere and the only known biosphere." },
  "ЛУНА":     { en: "MOON",      type: RU ? "естественный спутник" : "natural satellite", diameter: "3 475" + КМ,  period: RU ? "27,3 суток" : "27.3 days", text: RU ? "Приливно захваченный спутник Земли; средняя дистанция до Земли 384 400 км." : "Earth's tidally locked satellite, at a mean distance of 384,400 km." },
  "МАРС":     { en: "MARS",      type: RU ? "каменная планета" : "rocky planet", diameter: "6 779" + КМ,  period: RU ? "687 суток" : "687 days", text: RU ? "Холодный пустынный мир с тонкой атмосферой CO₂, полярными шапками и крупнейшим вулканом системы." : "A cold desert world with a thin CO₂ atmosphere, polar caps and the Solar System's largest volcano." },
  "ЮПИТЕР":   { en: "JUPITER",   type: RU ? "газовый гигант" : "gas giant", diameter: "139 820" + КМ,  period: RU ? "11,86 года" : "11.86 years", text: RU ? "Крупнейшая планета системы; Большое красное пятно это долговечный атмосферный вихрь." : "The largest planet; the Great Red Spot is a long-lived atmospheric vortex." },
  "САТУРН":   { en: "SATURN",    type: RU ? "газовый гигант" : "gas giant", diameter: "116 460" + КМ,  period: RU ? "29,45 года" : "29.45 years", text: RU ? "Система колец состоит главным образом из частиц водяного льда размером от пыли до глыб." : "Its rings are made mostly of water-ice particles ranging from dust to boulders." },
  "УРАН":     { en: "URANUS",    type: RU ? "ледяной гигант" : "ice giant", diameter: "50 724" + КМ,  period: RU ? "84 года" : "84 years", text: RU ? "Ось вращения наклонена примерно на 98°, поэтому планета фактически вращается на боку." : "Its axial tilt is about 98°, so the planet effectively rotates on its side." },
  "НЕПТУН":   { en: "NEPTUNE",   type: RU ? "ледяной гигант" : "ice giant", diameter: "49 244" + КМ,  period: RU ? "164,8 года" : "164.8 years", text: RU ? "Самая дальняя планета; в атмосфере наблюдаются самые быстрые ветры Солнечной системы." : "The farthest planet, with the fastest winds observed in the Solar System." }
}; }
var SOLAR_SCI = строитьНауку();
function solarScience(name) {
  var up = String(name || "").toUpperCase();
  for (var k in SOLAR_SCI) {
    if (up === k || up === SOLAR_SCI[k].en) return SOLAR_SCI[k];
  }
  return null;
}

/* Снять со всех панелей признак открытости. Зовём на выходе из
   полёта и перед финальной карточкой. */
function сброситьПанели() {
  /* Досье гасим его же ходом: класс on снимает только вид, а кадр
     развёртки тела глохнет по признаку hidden, который ставит
     dosClose. Без него под невидимой карточкой финала продолжала
     чертиться карта планеты шестьдесят раз в секунду. */
  dosClose();
  var спис = [ui.menu, ui.help, ui.dos, ui.netList];
  for (var i = 0; i < спис.length; i++) if (спис[i]) спис[i].classList.remove("on");
  if (ui.navKey) { ui.navKey.classList.remove("cur"); ui.navKey.setAttribute("aria-expanded", "false"); }
  /* Подсветку снимаем со ВСЕХ клавиш, которые её ставят. Клавиша
     КАРТА оставалась горящей после выхода и встречала так следующий
     заход - тот самый дефект, ради которого функция и написана. */
  var подсвеченные = ui.wrap ? ui.wrap.querySelectorAll(".rcf-help-key.cur, .rcf-map-key.cur, .rcf-key.cur") : [];
  for (i = 0; i < подсвеченные.length; i++) подсвеченные[i].classList.remove("cur");
  if (g.RC_VPN && g.RC_VPN.close) { try { g.RC_VPN.close(); } catch (eВ) {} }
  modalMark();
}

/* Закрыть верхнюю открытую панель полёта. Возвращает true, если
   что-то закрыли: тогда Escape дальше не идёт. Порядок разбора -
   сверху вниз по тому, что перекрывает что. */
function закрытьВерхнее() {
  var холо = doc.querySelector(".rc-vpn-holo.on");
  if (холо && g.RC_VPN && g.RC_VPN.close) {
    try {
      g.RC_VPN.close();
      вернутьФокус(".rcf-key, .rcf-mini");
      return true;
    } catch (eВ) {}
  }
  if (ui.dos && ui.dos.classList.contains("on")) { dosClose(); вернутьФокус(".rcf-key, .rcf-mini"); return true; }
  if (ui.help && ui.help.classList.contains("on")) {
    ui.help.classList.remove("on");
    var кс = ui.wrap && ui.wrap.querySelector(".rcf-help-key");
    if (кс) { кс.classList.remove("cur"); try { кс.focus({ preventScroll: true }); } catch (eС) {} }
    modalMark();
    return true;
  }
  if (ui.menu && ui.menu.classList.contains("on")) {
    ui.menu.classList.remove("on");
    if (ui.navKey) {
      ui.navKey.setAttribute("aria-expanded", "false");
      ui.navKey.classList.remove("cur");
      try { ui.navKey.focus({ preventScroll: true }); } catch (eН) {}
    }
    modalMark();
    return true;
  }
  if (ui.netList && ui.netList.classList.contains("on")) {
    ui.netList.classList.remove("on");
    modalMark();
    return true;
  }
  return false;
}

/* Фокус после закрытия панели должен встать на живой орган рубки, а
   не провалиться в тело документа. */
function вернутьФокус(сел) {
  if (!ui.wrap) return;
  var э = ui.wrap.querySelector(сел);
  try { (э || ui.wrap).focus({ preventScroll: true }); } catch (eФ) {}
}

function dosClose() {
  if (!ui.dos) return;
  if (ui.dos.classList.contains("on") && g.RC_SOUND && g.RC_SOUND.panelOut) {
    try { g.RC_SOUND.panelOut(); } catch (eЗ) {}
  }
  ui.dos.classList.remove("on");
  dosStop();
  if (ui.dosVid) { try { ui.dosVid.pause(); } catch (eV3) {} }
  modalMark();
  dosName = "";
  if (dosT) { clearTimeout(dosT); dosT = 0; }
  dosT = setTimeout(function () { dosT = 0; if (ui.dos) ui.dos.hidden = true; }, 340);
}

/* Развёртка поверхности. Источник - карта самого тела: у планет это
   тот же canvas, которым они покрашены в мире, поэтому досье и
   объект не могут разойтись. Если карты нет (звезда, галактика),
   рисуем спектральную полосу - и это честно: снимать с них нечего. */
/* ── Живая порода тела ───────────────────────────────────────
   Заказчик описал это дословно: кусок породы планеты висит в
   воздухе, и он оживлён видео. Так и сделано: кадр рисует кабинет
   (фотореальный обломок коры с настоящей стратиграфией на срезе),
   Runway его оживляет, ffmpeg складывает маятник вперёд-назад -
   получается бесшовная петля из пяти секунд без единого стыка.

   Ролик лежит под холстом досье, а холст рисует поверх него только
   приборную обвязку: сетку координат, отметки узлов, луч сканера и
   уголки рамки. Поэтому это не «видео вместо карты», а показания
   прибора по живому образцу.

   Развёртка остаётся запасным путём: у тела без ролика холст
   по-прежнему рисует её карту и крутит по долготе. */
var ПОВЕРХНОСТЬ = {
 "55 CANCRI": "star",
 "ASTEROID": "asteroid",
 "COMET": "comet",
 "RC-SAT": "sat",
 "55 CANCRI D": "gas",
 "55 CANCRI E": "lava",
 "55 CANCRI F": "gas",
 "BLACK": "hole",
 "EARTH": "earth",
 "JUPITER": "jupiter",
 "KEPLER-186": "star",
 "KEPLER-186 C": "rocky",
 "KEPLER-186 E": "desert",
 "KEPLER-186 F": "terran",
 "KEPLER-62": "star",
 "KEPLER-62 B": "lava",
 "KEPLER-62 E": "terran",
 "KEPLER-62 F": "ice",
 "KEPLER-90": "star",
 "KEPLER-90 D": "rocky",
 "KEPLER-90 G": "gas",
 "KEPLER-90 H": "gas",
 "LHS 1140": "star",
 "LHS 1140 B": "terran",
 "LHS 1140 C": "rocky",
 "MARS": "mars",
 "MERCURY": "mercury",
 "MOON": "moon",
 "NEPTUNE": "neptune",
 "NETWORK NODE": "earth",
 "NODE": "sat",
 "PROXIMA B": "terran",
 "PROXIMA CENTAURI": "star",
 "PROXIMA D": "rocky",
 "SATURN": "saturn",
 "SUN": "sun",
 "TOI-270": "star",
 "TOI-270 B": "rocky",
 "TOI-270 C": "gas",
 "TOI-270 D": "gas",
 "TOI-700": "star",
 "TOI-700 C": "rocky",
 "TOI-700 D": "terran",
 "TOI-700 E": "terran",
 "TRAPPIST-1": "star",
 "TRAPPIST-1 E": "rocky",
 "TRAPPIST-1 F": "ice",
 "TRAPPIST-1 G": "ocean",
 "URANUS": "uranus",
 "VENUS": "venus",
 "АСТЕРОИДНЫЙ": "asteroid",
 "ВЕНЕРА": "venus",
 "ЗЕМЛЯ": "earth",
 "КОМЕТА": "comet",
 "ЛУНА": "moon",
 "МАРС": "mars",
 "МЕРКУРИЙ": "mercury",
 "НЕПТУН": "neptune",
 "САТУРН": "saturn",
 "СПУТНИК": "sat",
 "СОЛНЦЕ": "sun",
 "УРАН": "uranus",
 "УЗЕЛ": "sat",
 "УЗЕЛ СЕТИ": "earth",
 "ЧЁРНАЯ": "hole",
 /* На сайте VPN та же дыра зовётся РКН - поиск обязан знать оба
    имени, иначе досье по ней перестанет открываться после смены
    продукта. */
 "РКН": "hole",
 "RKN": "hole",
 "ЮПИТЕР": "jupiter"
};

/* Имя тела в досье приходит как в подписи: «МАРС», «TRAPPIST-1 E»,
   «ЧЁРНАЯ ДЫРА», «УЗЕЛ СЕТИ · Москва». Ищем сперва целиком, потом по
   ДВУМ первым словам и только потом по одному.

   Два слова здесь не украшение. Узлов в игре два разных вида, и оба
   начинаются одинаково: «УЗЕЛ СЕТИ · Москва» стоит на земле, а
   «УЗЕЛ RC-10» висит на орбите. По одному первому слову они
   сливаются, и наземному узлу доставалась бы обшивка спутника. */
function породаДля(name) {
  var n = String(name || "").toUpperCase().trim();
  if (ПОВЕРХНОСТЬ[n]) return ПОВЕРХНОСТЬ[n];
  var слова = n.split(/[\s·]+/).filter(Boolean);
  if (слова.length > 1) {
    var два = слова[0] + " " + слова[1];
    if (ПОВЕРХНОСТЬ[два]) return ПОВЕРХНОСТЬ[два];
  }
  return ПОВЕРХНОСТЬ[слова[0]] || null;
}

function dosPaint(obj, name, фаза) {
  var cv = ui.dosMap;
  if (!cv) return;
  var x = cv.getContext("2d"), W = cv.width, H = cv.height, i;
  фаза = фаза || 0;
  x.clearRect(0, 0, W, H);
  /* Есть ролик породы - карту тела не рисуем вовсе: под холстом
     идёт видео, и закрашивать его нечем. */
  var сВидео = !!(ui.dosVid && ui.dosVid.dataset && ui.dosVid.dataset.on === "1");
  var map = obj && obj.material && obj.material.map;
  var img = map && map.image;
  var drew = сВидео;
  if (!сВидео && img && (img.width || img.naturalWidth)) {
    try {
      /* Развёртка ЕДЕТ: тело поворачивается под сканером.

         Заказчик сказал про эту карту коротко: «поверхность картинкой,
         нужно зацикленное видео». Видеофайлом это не решается - тел в
         игре за полсотни, и на каждое пришлось бы качать ролик. Но
         развёртка по долготе замкнута сама на себя: правый её край
         продолжается левым. Значит достаточно рисовать её дважды со
         сдвигом, и получается честная бесконечная петля без единого
         байта загрузки. И она всегда совпадает с самим телом, потому
         что берётся с его же карты. */
      /* Карта замкнута по долготе, и это проверено, а не принято на
         веру: разница крайних столбцов у всех тел от нуля до
         тринадцати из 255. Значит достаточно рисовать её дважды со
         сдвигом - шва на стыке нет, петля честная.

         Зеркалить вторую копию пробовал: шов от этого не менялся,
         зато на Земле половину цикла материки шли отражёнными. То,
         что я принял за шов на замере, оказалось самой контрастной
         чертой карты - терминатором. Она и ехала вместе с
         развёрткой, как ей и положено. */
      var сдв = (фаза % 1) * W;
      x.drawImage(img, -сдв, 0, W, H);
      x.drawImage(img, W - сдв, 0, W, H);
      drew = true;
    } catch (e) {}
  }
  /* Галактика: рисуем спираль, а не тянем её спрайт.

     У галактик нет и не может быть «поверхности», ролика для них
     тоже нет. Прежде в карту шла material.map самого объекта, а это
     мягкое световое пятно: растянутое на весь кадр и подкрашенное
     цианом, оно давало ровный белёсый прямоугольник. Заказчик
     справедливо принял это за поломку.

     Спираль считается прямо здесь: ядро, две логарифмические ветви
     из множества звёзд, пылевые прожилки поперёк рукавов и звёздная
     пыль по полю. Ветви медленно проворачиваются вместе с развёрткой,
     то есть карта живая, как и у остальных тел. */
  var галактика = /^(МЛЕЧНЫЙ|MILKY|МЕСТНЫЙ|LOCAL ARM|ПОЛЯ KEPLER|KEPLER AND TESS|ГАЛАКТИКА|GALAXY)/
    .test(String(name || "").toUpperCase());
  if (галактика && !сВидео) {
    var гц = W * 0.5, гy = H * 0.5, гR = Math.min(W, H) * 0.62;
    var фон = x.createLinearGradient(0, 0, 0, H);
    фон.addColorStop(0, "#03070f");
    фон.addColorStop(0.55, "#060d1c");
    фон.addColorStop(1, "#02060d");
    x.fillStyle = фон; x.fillRect(0, 0, W, H);
    /* Звёздная пыль поля. Своя простая случайность, чтобы картинка
       не прыгала между кадрами развёртки. */
    var сид = 20260827;
    function сл() { сид = (сид * 1103515245 + 12345) & 0x7fffffff; return сид / 0x7fffffff; }
    for (i = 0; i < 520; i++) {
      var зx = сл() * W, зy = сл() * H, зя = 0.06 + Math.pow(сл(), 2.4) * 0.5;
      x.fillStyle = "rgba(214,232,246," + зя.toFixed(2) + ")";
      x.fillRect(зx, зy, 1, 1);
    }
    /* Гало вокруг ядра */
    var гало = x.createRadialGradient(гц, гy, 0, гц, гy, гR);
    гало.addColorStop(0, "rgba(255,246,224,.95)");
    гало.addColorStop(0.10, "rgba(255,226,170,.55)");
    гало.addColorStop(0.34, "rgba(150,190,240,.20)");
    гало.addColorStop(1, "rgba(90,140,220,0)");
    x.fillStyle = гало; x.fillRect(0, 0, W, H);
    /* Две ветви. Галактика лежит к нам под углом, поэтому по высоте
       она сжата: круглая спираль анфас выглядит наклейкой. */
    var кр = 0.42;
    for (var ветвь = 0; ветвь < 2; ветвь++) {
      var сдвиг = ветвь * Math.PI;
      for (i = 0; i < 1400; i++) {
        var t = i / 1400;
        var рад = гR * (0.10 + t * 0.92);
        var уг = сдвиг + t * 3.05 + фаза * 0.9 + (сл() - 0.5) * 0.30;
        var зx2 = гц + Math.cos(уг) * рад;
        var зy2 = гy + Math.sin(уг) * рад * кр;
        if (зx2 < -4 || зx2 > W + 4 || зy2 < -4 || зy2 > H + 4) continue;
        var я2 = (1 - t * 0.72) * (0.20 + сл() * 0.8);
        var гол = сл() < 0.72;
        x.fillStyle = гол
          ? "rgba(178,214,255," + (я2 * 0.85).toFixed(3) + ")"
          : "rgba(255,232,196," + (я2 * 0.9).toFixed(3) + ")";
        var рм = сл() < 0.06 ? 1.8 : 0.9;
        x.fillRect(зx2, зy2, рм, рм);
      }
      /* Пылевая прожилка идёт по внутреннему краю ветви */
      x.strokeStyle = "rgba(4,8,16,.5)";
      x.lineWidth = Math.max(1.5, гR * 0.035);
      x.beginPath();
      for (var d = 0; d <= 60; d++) {
        var td = d / 60;
        var рд = гR * (0.16 + td * 0.86);
        var уд = сдвиг + td * 3.05 + фаза * 0.9 - 0.17;
        var дx = гц + Math.cos(уд) * рд, дy = гy + Math.sin(уд) * рд * кр;
        if (d === 0) x.moveTo(дx, дy); else x.lineTo(дx, дy);
      }
      x.stroke();
    }
    /* Ядро поверх всего: плотное и тёплое */
    var ядро = x.createRadialGradient(гц, гy, 0, гц, гy, гR * 0.19);
    ядро.addColorStop(0, "rgba(255,252,238,.98)");
    ядро.addColorStop(0.45, "rgba(255,224,166,.6)");
    ядро.addColorStop(1, "rgba(255,200,130,0)");
    x.fillStyle = ядро;
    x.save(); x.translate(гц, гy); x.scale(1, кр + 0.28); x.translate(-гц, -гy);
    x.fillRect(0, 0, W, H);
    x.restore();
    drew = true;
  }
  if (!drew) {
    var gr = x.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, "#071a2c");
    gr.addColorStop(0.5, "#0d3d63");
    gr.addColorStop(1, "#1b1030");
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    for (i = 0; i < 400; i++) {
      x.fillStyle = "rgba(207,233,245," + (0.1 + Math.random() * 0.5).toFixed(2) + ")";
      x.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
    }
  }
  /* Голограмма, а не фотография: карта уходит в циан и развёртку.
     Поверх видео тон не кладём - порода должна остаться породой. */
  if (сВидео || галактика) { x.globalCompositeOperation = "source-over"; }
  else {
  x.globalCompositeOperation = "multiply";
  x.fillStyle = "rgba(120,200,240,.85)";
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "screen";
  x.fillStyle = "rgba(20,70,110,.5)";
  x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = "source-over";
  }

  /* Сетка координат */
  x.strokeStyle = "rgba(159,224,246,.28)";
  x.lineWidth = 1;
  for (i = 1; i < 8; i++) {
    x.beginPath(); x.moveTo(W * i / 8, 0); x.lineTo(W * i / 8, H); x.stroke();
  }
  for (i = 1; i < 4; i++) {
    x.beginPath(); x.moveTo(0, H * i / 4); x.lineTo(W, H * i / 4); x.stroke();
  }
  /* Отметки узлов сети: у Земли они настоящие, у прочих тел это
     точки, которые ещё предстоит развернуть. Едут вместе с
     развёрткой - они на поверхности, а не на стекле прибора. */
  var marks = name.indexOf("ЗЕМЛ") === 0 || name.indexOf("EARTH") === 0 ? 16 : 6;
  for (i = 0; i < marks; i++) {
    var mx = (W * (0.08 + (i * 0.137) % 0.84) - (фаза % 1) * W + W) % W;
    var my = H * (0.2 + ((i * 0.31) % 0.6));
    x.strokeStyle = "rgba(207,233,245,.85)";
    x.beginPath(); x.arc(mx, my, 5, 0, 6.283); x.stroke();
    x.fillStyle = "rgba(66,178,220,.9)";
    x.beginPath(); x.arc(mx, my, 2, 0, 6.283); x.fill();
  }
  /* Развёртка строк - тот же приём, что у голограммы пульта. Поверх
     видео строки реже и слабее: порода не должна тонуть в них. */
  x.fillStyle = сВидео ? "rgba(5,12,21,.10)" : "rgba(5,12,21,.22)";
  for (i = 0; i < H; i += (сВидео ? 4 : 3)) x.fillRect(0, i, W, 1);
  /* Луч сканера идёт поперёк развёртки: без него петля читается
     прокруткой картинки, а с ним - работой прибора. */
  var лx = ((фаза * 2.1) % 1) * W;
  var лг = x.createLinearGradient(лx - W * 0.16, 0, лx + W * 0.03, 0);
  лг.addColorStop(0, "rgba(159,224,246,0)");
  лг.addColorStop(0.72, "rgba(159,224,246,.10)");
  лг.addColorStop(1, "rgba(207,233,245,.34)");
  x.fillStyle = лг;
  x.fillRect(Math.max(0, лx - W * 0.16), 0, W * 0.19, H);
  x.strokeStyle = "rgba(207,233,245,.55)";
  x.lineWidth = 1;
  x.beginPath(); x.moveTo(лx, 0); x.lineTo(лx, H); x.stroke();

  /* Уголки рамки */
  x.strokeStyle = "rgba(66,178,220,.9)"; x.lineWidth = 2;
  var c = 22;
  var corners = [[0,0,1,1],[W,0,-1,1],[0,H,1,-1],[W,H,-1,-1]];
  for (i = 0; i < 4; i++) {
    var q = corners[i];
    x.beginPath();
    x.moveTo(q[0] + q[2] * c, q[1]);
    x.lineTo(q[0], q[1]);
    x.lineTo(q[0], q[1] + q[3] * c);
    x.stroke();
  }
}

var dosRaf = 0, dosT0 = 0;

/* Досье живёт, пока открыто: развёртка едет, луч сканера идёт. */
function dosLive(obj, name) {
  dosStop();
  dosT0 = 0;
  var шаг = function (ts) {
    /* Класс видимости ставится на следующем кадре после открытия, и
       проверять его сразу нельзя: петля глохла, не начавшись. Ждём
       появления, а гаснем только когда досье реально закрыли. */
    if (!ui.dos || ui.dos.hidden) { dosRaf = 0; return; }
    if (!dosT0) dosT0 = ts;
    dosPaint(obj, name, (ts - dosT0) / 40000);
    dosRaf = requestAnimationFrame(шаг);
  };
  dosRaf = requestAnimationFrame(шаг);
}

function dosStop() {
  if (dosRaf) { cancelAnimationFrame(dosRaf); dosRaf = 0; }
}

function dosOpen(obj, info) {
  if (!ui.dos || !info) return;
  var parts = info.split(" · ");
  var name = parts[0] || info;
  var science = solarScience(name);
  if (dosName === name && ui.dos.classList.contains("on")) return;
  dosName = name;
  if (dosT) { clearTimeout(dosT); dosT = 0; }
  ui.dos.hidden = false;
  ui.dosH.textContent = name;
  ui.dosP.textContent = science ? science.text :
    (parts.slice(1).join(" · ") || (RU ? "Данных в бортовом справочнике нет." : "No data on board."));
  /* Порода тела: если для него снят ролик, включаем его под холстом.
     preload="none" в разметке - файл тянется только при открытии
     досье, а не при загрузке страницы. */
  if (ui.dosVid) {
    var ид = породаДля(name);
    if (ид) {
      /* Два формата на элементе, а не один.

         WebM с VP9 играет Chrome, Firefox и Android, MP4 с H.264 -
         Safari и айфон. Ставим оба: браузер берёт первый, который
         умеет. Вес у них почти одинаковый, по четверти мегабайта на
         тело, и тянутся они только при открытии досье. */
      if (ui.dosVid.dataset.ид !== ид) {
        ui.dosVid.dataset.ид = ид;
        ui.dosVid.innerHTML = "";
        var д = БАЗА_АКТИВОВ + "gen/surf/" + ид;
        var и1 = doc.createElement("source"); и1.type = "video/webm"; и1.src = д + ".webm";
        var и2 = doc.createElement("source"); и2.type = "video/mp4";  и2.src = д + ".mp4";
        ui.dosVid.appendChild(и1); ui.dosVid.appendChild(и2);
        try { ui.dosVid.load(); } catch (eL) {}
      }
      ui.dosVid.dataset.on = "1";
      ui.dosVid.style.display = "block";
      try { ui.dosVid.currentTime = 0; var пр = ui.dosVid.play(); if (пр && пр.catch) пр.catch(function () {}); } catch (eV) {}
    } else {
      ui.dosVid.dataset.on = "0";
      ui.dosVid.style.display = "none";
      try { ui.dosVid.pause(); } catch (eV2) {}
    }
  }
  /* Досье открывается стеклянным подъёмом: панель, которая
     появляется молча, читается картинкой, а не прибором */
  if (g.RC_SOUND && g.RC_SOUND.panelIn) { try { g.RC_SOUND.panelIn(); } catch (eЗ) {} }
  dosPaint(obj, name, 0);
  /* Петля жизни развёртки. Крутится, только пока досье открыто:
     закрыли - гасим, иначе прибор считает кадры за спиной у человека.
     Скорость такая, что полный оборот занимает около сорока секунд:
     тело поворачивается, а не мельтешит. */
  dosLive(obj, name);

  /* Три показателя: удаление, состояние узла и доля исследованного.
     Числа берём из самого мира, а не выдумываем: расстояние честно
     считается от камеры. */
  var facts = "";
  var dist = null;
  try {
    if (obj && W3 && obj.getWorldPosition) {
      var wp = new g.THREE.Vector3();
      obj.getWorldPosition(wp);
      dist = Math.round(W3.cam.position.distanceTo(wp) * 106);
    }
  } catch (e) {}
  if (dist !== null) {
    facts += '<span><i>' + (RU ? "УДАЛЕНИЕ" : "RANGE") + '</i><b>' +
      (dist > 9999 ? (dist / 1000).toFixed(1) + (RU ? " тыс. км" : "k km") : dist + (RU ? " км" : " km")) + '</b></span>';
  }
  var inNet = !!net[name];
  facts += '<span><i>' + (RU ? "УЗЕЛ СЕТИ" : "NETWORK") + '</i><b class="' + (inNet ? "ok" : "") + '">' +
    (inNet ? (RU ? "развёрнут" : "deployed") : (RU ? "не развёрнут" : "not deployed")) + '</b></span>';
  facts += '<span><i>' + (RU ? "ИССЛЕДОВАНО" : "EXPLORED") + '</i><b>' +
    Object.keys(explored).length + " / " + TOTAL_MARKS() + '</b></span>';
  if (science) {
    facts += '<span><i>' + (RU ? "КЛАСС" : "CLASS") + '</i><b>' + science.type + '</b></span>';
    facts += '<span><i>' + (RU ? "ДИАМЕТР" : "DIAMETER") + '</i><b>' + science.diameter + '</b></span>';
    facts += '<span><i>' + (RU ? "ПЕРИОД" : "PERIOD") + '</i><b>' + science.period + '</b></span>';
  }
  ui.dosF.innerHTML = facts;

  requestAnimationFrame(function () { if (ui.dos) { ui.dos.classList.add("on"); modalMark(); } });
  noteExplored(name);
  if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
}

/* ── Автопилот и навигация ───────────────────────────────────
   Автопилот держит крейсерскую тягу: корабль сам плывёт по всему
   маршруту, человек только смотрит по сторонам. Любое своё усилие
   на тяге отключает автопилот - управление отдано человеку.
   Кнопки навигации ведут к цели в обе стороны и сами тормозят
   у места назначения. */
function setAuto(on) {
  F.auto = !!on;
  if (on) {
    F.goal = null;
    F.goalId = null;
    F.goalName = null;
    courseText(null);
    if (F.orbit) { F.rejoin = 1; F.orbit = null; }
  }
  if (ui.auto) ui.auto.setAttribute("aria-pressed", F.auto ? "true" : "false");
  if (ui.autoKey) {
    ui.autoKey.setAttribute("aria-pressed", F.auto ? "true" : "false");
    ui.autoKey.classList.toggle("cur", F.auto);
  }
}

function manual() {
  if (F.auto) setAuto(false);
  F.goal = null;
  F.goalId = null;
  F.goalName = null;
  courseText(null);
  if (F.orbit) F.rejoin = 1;
  F.orbit = null;
  if (F.brief) { F.brief = false; if (ui.brief) ui.brief.classList.add("off"); }
  hideHint();
}

/* Пределы обзора. По горизонту предела нет вовсе - это и есть
   обещанные 360 градусов, угол просто держим в отрезке от минус до
   плюс пи, чтобы возврат на курс шёл коротким путём, а не через
   полный оборот. По вертикали упор нужен: за макушкой и под килем
   картинка переворачивается, и человек теряет горизонт. */
function clampLook() {
  while (F.look.tx > Math.PI) { F.look.tx -= Math.PI * 2; F.look.x -= Math.PI * 2; }
  while (F.look.tx < -Math.PI) { F.look.tx += Math.PI * 2; F.look.x += Math.PI * 2; }
  F.look.ty = Math.max(-1.05, Math.min(1.05, F.look.ty));
}

/* ── Звёздные системы чужих вселенных ────────────────────────
   Родная система собрана вручную и всегда в сцене. Чужие строятся
   по описанию при первом прыжке и дальше просто показываются и
   прячутся: пересобирать десяток планет на каждый прыжок дорого,
   а память на этом объёме не жмёт.

   Планеты рисует rc-planets (процедурная генерация по семени). Если
   модуля нет, ставим простые шары в цвет системы: игра обязана
   работать и без него. */
var built = {};                 /* uniIdx -> THREE.Group со всей вселенной */

function makeBody(T, pl, seed, starPos) {
  var P = g.RC_PLANETS;
  if (P && P.make) {
    try {
      var made = P.make(pl.kind, {
        radius: pl.r, seed: seed, tint: pl.tint, rings: !!pl.rings,
        clouds: !!pl.clouds, atmosphere: true,
        /* Мельче сетка текстур везде, не только на телефоне: на
           облёте разницы с полным разрешением глазом не видно, а
           генерация втрое быстрее - вселенная собирается без пауз */
        detail: "low"
      });
      /* Светило системы задаёт терминатор, кайму атмосферы, ночные
         огни и тень колец. Передаём именно НАПРАВЛЕНИЕ на звезду:
         планета стоит на своей орбите, звезда в центре системы, а
         значит направление - это обратный вектор её положения. */
      if (made.setSun && starPos) {
        try { made.setSun(-starPos.x, -starPos.y, -starPos.z); } catch (e0) {}
      }
      return made;
    } catch (e) {}
  }
  /* Запасной вариант: шар в цвет с лёгким блеском */
  var m = new T.Mesh(
    new T.SphereGeometry(pl.r, 40, 28),
    new T.MeshPhongMaterial({ color: pl.tint || 0x8899aa, shininess: 6 })
  );
  var gr = new T.Group(); gr.add(m);
  return { group: gr, radius: pl.r, update: function () {} };
}

/* Сборка вселенной идёт порциями. Каждая процедурная планета - это
   доли секунды на генерацию текстур; десяток подряд вешал вкладку
   почти на тринадцать секунд, и прыжок выглядел зависанием. Теперь
   в первом заходе ставим звёзды и орбиты (это дёшево), а планеты
   выходят по одной между кадрами - система на глазах наполняется
   мирами, и это читается как прибытие, а не как фриз. */
var buildQ = [], buildBusy = false;
function buildStep() {
  if (!buildQ.length) { buildBusy = false; return; }
  buildBusy = true;
  var job = buildQ.shift();
  try { job(); } catch (e) {}
  /* Между планетами отдаём кадр отрисовке: иначе порционность
     ничего не даёт и мы снова считаем всё в одном кадре */
  requestAnimationFrame(function () { setTimeout(buildStep, 0); });
}
function buildLater(fn) {
  buildQ.push(fn);
  if (!buildBusy) buildStep();
}

function buildUniverse(i) {
  if (built[i]) return built[i];
  var T = g.THREE, u = UNIVERSES[i];
  var root = new T.Group();
  root.visible = false;
  var live = [];
  /* Список тел рукава по порядку обхода. Пустой у дома: там дуга
     срежиссирована руками и трогать её нельзя. */
  var тур = [];

  for (var s = 0; s < (u.sys || []).length; s++) {
    var sys = u.sys[s];
    var sg = new T.Group();
    sg.position.set(sys.at[0], sys.at[1], sys.at[2]);

    /* Звезда системы: свет, диск и корона. Процедурную звезду даёт
       rc-planets (грануляция, пятна, потемнение к краю); если её
       нет, остаётся спрайт-гало, и система всё равно освещена. */
    /* Затухание ноль, а не 1.6, и без предела дальности.

       В three r160 точечный свет считает физически: сила падает как
       единица на расстояние в степени затухания. Здесь стояло
       затухание 1.6 при пределе 2600, а планеты системы стоят на
       орбитах 180-610 единиц. Замер калибровочным белым шаром: под
       этим светом диск даёт светлоту 10.7 - ровно столько же, сколько
       даёт одна фоновая заливка. То есть звезда системы не освещала
       свои планеты ВООБЩЕ, и весь рукав держался на домашнем солнце,
       которое светит совсем с другой стороны.

       Отсюда и «планеты в других галактиках мутные, просто круги с
       цветом, некоторые слишком тёмные». Ноль затухания даёт ту же
       силу по всей системе и правильное направление от каждой
       планеты к своей звезде. Сила снижена с 2.4 до 1.5: без
       затухания прежняя пересветила бы диски. */
    var star = new T.PointLight(sys.star, 1.5, 0, 0);
    sg.add(star);
    var madeStar = null;
    if (g.RC_PLANETS && g.RC_PLANETS.star) {
      try {
        madeStar = g.RC_PLANETS.star({ radius: 78, seed: sys.seed, tint: sys.star, light: false, corona: 1.25 });
        sg.add(madeStar.group);
        live.push(madeStar);
        /* Сама звезда тоже отзывается на нажатие. Планеты системы в
           список подбора кладут, а звезду - нет: самое крупное и
           заметное тело рукава молчало на клик. */
        (function (мс, с) {
          var тело = null;
          мс.group.traverse(function (о) { if (!тело && о.isMesh) тело = о; });
          if (!тело) return;
          тело.userData.info = RU
            ? с.name + " · звезда системы"
            : с.name + " · system star";
          тело.userData.mark = с.id + "-star";
          вЛуч(тело);
        })(madeStar, sys);
      } catch (e1) { madeStar = null; }
    }
    if (!madeStar) {
      var core = new T.Sprite(new T.SpriteMaterial({
        map: glowSprite(128, "rgba(255,255,255,1)", "rgba(255,220,160,0)"),
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
        color: new T.Color(sys.star)
      }));
      core.scale.setScalar(120);
      sg.add(core);
    }

    for (var pi = 0; pi < sys.planets.length; pi++) {
      /* Планета стоит на своей орбите: угол разведён по индексу,
         чтобы система не выстроилась в линию */
      var ang = (pi / sys.planets.length) * 6.283 + (sys.seed % 10) * 0.31;
      var pl = sys.planets[pi];
      var px = Math.cos(ang) * pl.dist, py = (pi % 2 ? 1 : -1) * pl.dist * 0.06, pz = Math.sin(ang) * pl.dist;

      /* Линия орбиты дешёвая - ставим сразу, чтобы система читалась
         системой уже в момент прибытия */
      var oGeo = new T.BufferGeometry();
      var opts = [], N = 96;
      for (var k = 0; k <= N; k++) {
        var a = (k / N) * 6.283;
        opts.push(new T.Vector3(Math.cos(a) * pl.dist, 0, Math.sin(a) * pl.dist));
      }
      oGeo.setFromPoints(opts);
      sg.add(new T.Line(oGeo, new T.LineBasicMaterial({
        color: sys.star, transparent: true, opacity: 0.12, depthWrite: false, blending: T.AdditiveBlending
      })));

      /* А сама планета рождается отдельным заходом: генерация её
         текстур - это доли секунды, и десяток подряд вешал вкладку */
      (function (pl, pi, px, py, pz, sg, sys) {
        buildLater(function () {
          var made = makeBody(T, pl, (sys.seed || 1) + pi * 977, new T.Vector3(px, py, pz));
          made.group.position.set(px, py, pz);
          /* Помечаем группу планеты: искать её по порядку среди детей
             нельзя - там же лежит звезда и линии орбит, и индексы
             разъезжались (курс на «Лиловый гигант» вёл к звезде). */
          made.group.userData.planet = pi;
          made.group.userData.info = pl.name + " · " + pl.info;
          /* Узел, поставленный здесь в прошлый заход, возвращается
             вместе с планетой. netRestore знает только тела
             Солнечной, и сеть, развёрнутая в чужом рукаве, после
             возвращения на сайт жила только в счётчике: меток в мире
             не было. Ставим метку тут, где мировые координаты
             планеты уже известны. */
          if (net[pl.name]) {
            try {
              var мп = new T.Vector3();
              made.group.updateWorldMatrix(true, false);
              мп.setFromMatrixPosition(made.group.matrixWorld);
              netMark(мп, pl.name);
            } catch (eУз) {}
          }
          /* Мир проявляется, а не возникает: короткий рост от нуля */
          made.group.scale.setScalar(0.01);
          made.group.userData.grow = 0;
          sg.add(made.group);
          live.push(made);
          /* Тур рукава: по этим телам потом строится дуга полёта и
             расписание взглядов. Держим сам узел планеты, а не его
             положение: планета идёт по орбите, и точка устареет. */
          тур.push({ узел: made.group, система: sg, имя: pl.name, r: pl.r || 44 });

          /* Планеты чужих вселенных попадают и в сканер, и под
             наведение: иначе прибор в чужом рукаве слепнет.

             Брать children[0] нельзя. Первый ребёнок собранной
             планеты - это пустая группа наклона оси, а у группы
             метода raycast нет вовсе: луч по списку без обхода вглубь
             такой объект просто не видит. Отсюда «не на всех работает
             планетах клики» - в чужих рукавах не работал НИ ОДИН.
             Ищем первый настоящий меш: обход идёт вглубь, и шар тела
             попадается раньше оболочек атмосферы. */
          var solid = null;
          made.group.traverse(function (о) { if (!solid && о.isMesh) solid = о; });
          if (solid) {
            solid.userData.info = made.group.userData.info;
            вЛуч(solid);
            made.group.userData.mark = sys.id + "-" + pi;
            if (W3.scanTargets) W3.scanTargets.push({ o: made.group, name: pl.name, key: sys.id + "-" + pi, uni: i });
          }
        });
      })(pl, pi, px, py, pz, sg, sys);
    }
    sg.userData.sys = sys;
    root.add(sg);
  }

  W3.scene.add(root);
  built[i] = { root: root, live: live, uni: u, тур: тур };
  return built[i];
}

/* ── Дуга и взгляд для чужого рукава ─────────────────────────
   Дома маршрут срежиссирован руками: каждая контрольная точка
   поставлена так, чтобы Луна прошла под днищем, а кольца Сатурна по
   борту. В чужих рукавах такой дуги не было вовсе - корабль летел
   по ДОМАШНЕЙ, мимо тех мест, где в Солнечной системе стоят Марс и
   Сатурн, а здесь пустота. Заказчик описал это точно: «в других
   вселенных она не облетает планеты, не приближается, просто
   отворачивается в сторону космоса и смотрит в пустоту».

   Строим дугу по телам самого рукава. Режиссуры руками тут быть не
   может - систем и планет в каждом рукаве своё число и стоят они
   по своим данным, - поэтому правило простое и одно на всех:

     заход  выходим сбоку и выше тела на расстоянии, с которого
            планета уже крупная, но ещё видна целиком;
     проход идём мимо на дистанции пролёта, тело проходит по борту;
     сход   отходим в сторону следующего тела.

   Дистанции считаются от радиуса тела, а не числом: планеты рукава
   разного размера, и одна и та же дистанция для сорокапятки и для
   шестидесятки даёт совсем разный кадр.

   Взгляд ведём не по точке, а по САМОМУ УЗЛУ планеты: она идёт по
   орбите, и записанная точка через полвитка показывает в пустое
   место. Расписание взглядов поэтому хранит объект, а не координату
   (см. поле «узел» ниже и его разбор в кадре). */
function маршрутРукава(pack) {
  var T = g.THREE;
  var тур = pack && pack.тур ? pack.тур : null;
  if (!тур || !тур.length) return null;

  var точки = [], взгляды = [], мир = new T.Vector3();
  /* Стартуем поодаль от первого тела: вход в рукав не должен
     начинаться вплотную к планете. */
  тур[0].узел.updateWorldMatrix(true, false);
  мир.setFromMatrixPosition(тур[0].узел.matrixWorld);
  точки.push(new T.Vector3(мир.x + 520, мир.y + 180, мир.z + 620));

  for (var i = 0; i < тур.length; i++) {
    var т = тур[i];
    т.узел.updateWorldMatrix(true, false);
    мир.setFromMatrixPosition(т.узел.matrixWorld);
    var R = т.r || 44;
    /* Сторона облёта чередуется: иначе весь рукав пролетается по
       одной дуге и читается одинаковым виражом. */
    var знак = (i % 2) ? -1 : 1;
    var заход = R * 6.2, пролёт = R * 3.1, верх = R * 1.9;
    точки.push(new T.Vector3(мир.x + заход * знак, мир.y + верх, мир.z + заход * 0.55));
    точки.push(new T.Vector3(мир.x + пролёт * знак * 0.35, мир.y + верх * 0.55, мир.z - пролёт));
    точки.push(new T.Vector3(мир.x - заход * знак * 0.7, мир.y + верх * 0.3, мир.z - заход));
    взгляды.push({ узел: т.узел, доля: 0 });
  }
  /* Хвост: уходим в сторону, чтобы кривая не заканчивалась рывком. */
  точки.push(new T.Vector3(мир.x - 700, мир.y + 260, мир.z - 900));

  var путь = new T.CatmullRomCurve3(точки);
  /* Доли взглядов расставляем по местам их тел на кривой: у каждого
     тела три точки, первая из которых стоит после стартовой. */
  var n = точки.length - 1;
  for (i = 0; i < взгляды.length; i++) {
    /* Середина тройки точек этого тела - там, где оно крупнее всего */
    взгляды[i].доля = Math.min(0.985, (1 + i * 3 + 1) / n);
  }
  /* Первый и последний взгляд дублируем на края, иначе на въезде и
     на выезде смотреть не на что. */
  var расп = [{ узел: взгляды[0].узел, p: 0 }];
  for (i = 0; i < взгляды.length; i++) {
    расп.push({ узел: взгляды[i].узел, p: взгляды[i].доля });
  }
  расп.push({ узел: взгляды[взгляды.length - 1].узел, p: 1 });
  /* Доли обязаны идти по возрастанию: разбор взгляда в кадре ищет
     пару соседних точек и делит на их разность. */
  for (i = 1; i < расп.length; i++) {
    if (расп[i].p <= расп[i - 1].p) расп[i].p = Math.min(1, расп[i - 1].p + 0.01);
  }
  return { path: путь, looks: расп };
}

/* Тела родной вселенной: прячем их, пока мы в чужой, иначе Земля
   висит посреди фиолетового рукава */
function showHome(on) {
  if (!W3) return;
  var list = [W3.earth, W3.moon, W3.mars, W3.saturn, W3.hole, W3.comet,
              W3.sat, W3.belt1, W3.belt2, W3.sun, W3.sunGlow, W3.corIn,
              W3.corOut, W3.mercury, W3.venus, W3.jupiter, W3.uranus,
              W3.neptune];
  for (var i = 0; i < list.length; i++) if (list[i]) list[i].visible = on;
  /* Узлы-реле CDN тоже домашние. Их в списке не было, и цепочка из
     шести маяков «УЗЕЛ RC-10 · ближайший к вам сервер сети» висела
     во всех чужих рукавах, отзываясь на нажатие своим досье. */
  if (W3.relaySprites) {
    for (var ri = 0; ri < W3.relaySprites.length; ri++) {
      if (W3.relaySprites[ri]) W3.relaySprites[ri].visible = on;
    }
  }
  if (W3.relayLine) W3.relayLine.visible = on;
}

/* A galaxy is a destination, not wallpaper. Keeping every arm live
   at once made the Solar System render two invisible transparent
   particle fields and broke the spatial logic of the jump. */
function showGalaxyField(i) {
  if (!W3) return;
  if (W3.milky) W3.milky.visible = i === 0;
  if (W3.gal2) W3.gal2.visible = i === 1;
  if (W3.gal3) W3.gal3.visible = i >= 2;
}

function applyUniverse(i) {
  if (!W3) return;
  var T = g.THREE, u = UNIVERSES[i % UNIVERSES.length];

  /* Показываем ту вселенную, в которую прыгнули, и прячем прочие */
  for (var b in built) if (built.hasOwnProperty(b)) built[b].root.visible = (+b === i);
  if (i > 0) buildUniverse(i).root.visible = true;
  showHome(i === 0);
  showGalaxyField(i);
  /* Список тел для луча пересобираем под текущий рукав. Тела чужих
     рукавов остаются в сцене скрытыми, и список рос с каждым
     прыжком: 24 дома, 34 после первого рукава, 46 после второго, и
     домой он уже не сжимался. Клики отсеивали скрытые по видимости,
     но каждый клик и каждый кадр перебирали вдвое больше объектов, и
     рост ничем не ограничивался. */
  подобратьТелаЛуча();
  /* ── Дуга и взгляд под этот рукав ─────────────────────────
     Дома возвращаем срежиссированные руками; в чужом рукаве ставим
     построенные по его собственным телам. Без этого корабль летел
     по домашней дуге мимо мест, где в Солнечной стоят Марс и
     Сатурн, а здесь пустота. */
  if (i === 0) {
    if (W3.путьДома) { W3.path = W3.путьДома; W3.looks = W3.взглядыДома; }
  } else {
    if (!W3.путьДома) { W3.путьДома = W3.path; W3.взглядыДома = W3.looks; }
    var м = маршрутРукава(built[i]);
    if (м) { W3.path = м.path; W3.looks = м.looks; }
  }
  W3.sky.material.color.set(u.sky);
  W3.amb.color.set(u.amb);
  W3.sunGlow.material.color = new T.Color(u.sun);
  for (var k = 0; k < W3.nebSprites.length; k++) {
    W3.nebSprites[k].material.color = new T.Color(u.neb[k % 2]);
  }
  for (k = 0; k < W3.starMats.length; k++) {
    W3.starMats[k].color.set(u.stars[k]);
  }
}

/* ── Навигация в чужой вселенной ─────────────────────────────
   В родной системе корабль идёт по срежиссированной дуге: там
   каждая сцена стоит на своём месте. В чужих вселенных дуги нет -
   там свобода: список систем, перелёт к выбранной и облёт её
   планет. Панель навигации в этот момент показывает не Землю с
   Луной, а системы текущей вселенной. */
function systemNav() {
  if (!ui.nav) return;
  var u = UNIVERSES[uniIdx], html = "";
  if (uniIdx === 0) {
    /* Родная система в полном составе: прежние семь кнопок прятали
       шесть тел, к которым уже можно летать */
    var NAV = целиСистемы();
    for (var i = 0; i < NAV.length; i++) {
      html += '<button type="button" data-goal="' + NAV[i].id + '">' + NAV[i].t + "</button>";
    }
  } else {
    for (var s = 0; s < u.sys.length; s++) {
      html += '<button type="button" data-sys="' + s + '">' + u.sys[s].name + "</button>";
      for (var p = 0; p < u.sys[s].planets.length; p++) {
        html += '<button type="button" class="rcf-pl" data-sys="' + s + '" data-pl="' + p + '">' +
                u.sys[s].planets[p].name + "</button>";
      }
    }
    /* Из чужого рукава дорога одна - домой: кнопка «Галактика» здесь
       вела в никуда, маршрутной кривой в рукаве нет */
    html += '<button type="button" data-goal="home">' + (RU ? "Домой, в Солнечную" : "Home") + "</button>";
  }
  /* Дубли СКАН и АВТО в меню не нужны: настоящие клавиши живут на
     панели и слушают клики напрямую. Дубли перехватывали ссылки
     ui.scanKey/autoKey, и клавиши панели умирали. */
  ui.nav.innerHTML = html;
}

/* Перелёт к системе или к её планете. Внутри чужой вселенной
   маршрутной кривой нет, поэтому цель - это всегда облёт: центр,
   радиус и высота над плоскостью. */
function goSystem(si, pi) {
  if (!W3 || uniIdx === 0) return;
  var pack = built[uniIdx];
  if (!pack) return;
  var sysGroup = pack.root.children[si];
  if (!sysGroup) return;
  var sys = UNIVERSES[uniIdx].sys[si];

  var T = g.THREE;
  var c = new T.Vector3(), name, r, y;
  if (pi === undefined || pi === null) {
    c.copy(sysGroup.position);
    name = sys.name;
    /* Облёт всей системы: радиус чуть больше внешней орбиты, чтобы
       в кадр попадали и звезда, и планеты */
    var far = 0;
    for (var k = 0; k < sys.planets.length; k++) far = Math.max(far, sys.planets[k].dist);
    /* На телефоне окно рубки занимает три четверти и без того узкого
       кадра: система, честно влезавшая в экран, целиком уходила за
       стойки, и сразу после прыжка ткнуть было не во что. Отходим
       дальше - вся система оказывается в проёме. */
    r = far * (innerHeight > innerWidth ? 1.85 : 1.25);
    y = far * 0.3;
  } else {
    var pl = sys.planets[pi];
    var pg2 = null;
    for (var q = 0; q < sysGroup.children.length; q++) {
      if (sysGroup.children[q].userData && sysGroup.children[q].userData.planet === pi) {
        pg2 = sysGroup.children[q]; break;
      }
    }
    if (!pg2) return;
    c.copy(sysGroup.position).add(pg2.position);
    name = pl.name;
    /* Три с небольшим радиуса: планета заполняет кадр, но целиком
       помещается в окно кокпита и её видно шаром, а не стеной */
    /* A portrait viewport has a much narrower horizontal FOV than a
       desktop cockpit. Keep the complete limb inside the glazing on
       phones instead of cropping every large world at both sides. */
    r = pl.r * (innerHeight > innerWidth ? 4.5 : 3.4);
    y = pl.r * 0.8;
  }
  /* Пришли на орбиту - автопилот своё отработал. Если вёл именно он,
     человека надо предупредить: в кино-режиме маршрут доводил до
     чужого рукава и там молча выключался, а человек, выбравший
     «смотреть как кино», оставался стоять на орбите незнакомой
     звезды без единого слова о том, что делать дальше. */
  var велАвтопилот = F.auto;
  F.away = true;
  F.auto = false;
  F.goal = null;
  F.goalId = null;
  F.goalName = name;
  F.orbit = { c: c, r: r, y: y, a: null, name: name };
  courseText(name);
  noteExplored(name);
  if (велАвтопилот) {
    say((RU ? "АВТОПИЛОТ ДОВЁЛ · " : "AUTOPILOT DONE · ") + name +
        (RU ? " · дальше вручную: КУРС выберет цель, УЗЕЛ развернёт сеть"
            : " · manual from here: COURSE picks a target, NODE deploys the network"), 5200);
    /* Указателей автопилота два: значок на стекле и клавиша на плите.
       Гасить надо оба, иначе клавиша АВТО остаётся горящей при
       выключенном автопилоте, и человек видит режим, которого нет. */
    if (ui.auto) ui.auto.setAttribute("aria-pressed", "false");
    if (ui.autoKey) {
      ui.autoKey.classList.remove("cur");
      ui.autoKey.setAttribute("aria-pressed", "false");
    }
  } else {
    say((RU ? "КУРС · " : "COURSE · ") + name, 2200);
  }
  if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
}

/* Прыжок между вселенными: белая вспышка, за ней мир уже другой */
var uniBusy = false;
function jumpUniverse(want) {
  if (uniBusy || !W3) return;
  /* Номер рукава приходит снаружи: из кнопки меню, из служебного
     хода приёмки, из пробоя. Раньше он ложился в uniIdx как есть, и
     одного мусорного значения хватало, чтобы весь слой начал падать:
     UNIVERSES[NaN] это undefined, а дальше по коду идут .name и
     .sys. Журнал ошибок с боевого сайта показал ровно эту пару -
     "Cannot read properties of undefined (reading 'name')" и
     "(reading 'sys')". Держим номер в границах списка. */
  var н = (want === undefined) ? (uniIdx + 1) % UNIVERSES.length : Math.round(+want);
  if (!isFinite(н)) return;
  if (н < 0) н = 0;
  if (н >= UNIVERSES.length) н = UNIVERSES.length - 1;
  F.jumps = (F.jumps || 0) + 1;
  uniBusy = true;
  uniIdx = н;
  if (ui.fade) { ui.fade.style.transition = "opacity .45s"; ui.fade.style.opacity = "1"; }
  if (g.RC_SOUND) { try { (g.RC_SOUND.hyper || g.RC_SOUND.chime).call(g.RC_SOUND); } catch (e) {} }
  F.shake = 1;
  setTimeout(function () {
    applyUniverse(uniIdx);
    if (ui.cap) {
      ui.cap._t = UNIVERSES[uniIdx].name;
      ui.cap._hold = performance.now() + 3200;
      ui.cap.textContent = UNIVERSES[uniIdx].name;
      заново(ui.cap, "in");
    }
    /* Панель навигации перестраивается под новую вселенную, и
       корабль сразу оказывается у первой её системы: прыжок должен
       заканчиваться видом на новый мир, а не на пустоту */
    systemNav();
    if (uniIdx > 0) {
      /* Помним, где уже были: по этому следу пробой выбирает
         следующий рукав, а не гоняет по одному и тому же */
      F.былиВ = F.былиВ || {};
      F.былиВ[uniIdx] = 1;
      F.ластРукав = uniIdx;
      /* Телефон стоит вертикально, и по горизонтали кадр видит
         градусов пятнадцать, из которых на проём приходится
         одиннадцать. Система шириной под шестьдесят в него не
         помещается никак: после прыжка человек оказывался перед
         звездой, а все планеты уходили за стойки, и ткнуть было не
         во что. Приходим сразу к первому миру системы - он занимает
         кадр и с ним можно работать. На широком экране система
         помещается целиком, там прилёт остаётся общим планом. */
      goSystem(0, innerHeight > innerWidth ? 0 : undefined);
      F.away = true;
    } else {
      F.away = false;
      F.orbit = null;
      F.rejoin = 1;
      /* Курс на чужой мир дома не имеет смысла: в табло оставалось
         «PROXIMA b», хотя корабль уже в Солнечной */
      F.goal = null;
      F.goalId = null;
      F.goalName = null;
      courseText(null);
      /* Возврат домой - это выход ИЗ туннеля, а не повторный вход в
         него. Пока корабль оставался внутри зоны прыжка, пробой
         срабатывал сразу же и снова уносил в чужой рукав: маршрут
         замыкался в круг, дойти до конца было нельзя. Ставим
         корабль сразу за зоной, на домашний участок. */
      if (W3 && W3.at && F.p > W3.at.jump0 && F.p < W3.at.jump1) {
        F.p = Math.min(1, W3.at.jump1 + 0.012);
        F.jBang = false;
        F.jFlash = 0;
      }
    }
    if (ui.fade) ui.fade.style.opacity = "0";
    setTimeout(function () { uniBusy = false; }, 700);
  }, 480);
}

/* Откуда берём файлы активов. Сцена грузится из assets/, но путь
   надо брать от собственного тега, а не писать жёстко: страница
   может лежать не в корне. */
var БАЗА_АКТИВОВ = (function () {
  try {
    var т = document.querySelector('script[src*="rc-gl.js"], script[src*="rc-flight.js"]');
    if (т && т.src) return т.src.replace(/[?#].*$/, "").replace(/[^/]+$/, "");
  } catch (e) {}
  return "assets/";
})();

var GOAL_NAMES = {
  earth: RU ? "ЗЕМЛЯ" : "EARTH", moon: RU ? "ЛУНА" : "MOON",
  sun: RU ? "СОЛНЦЕ" : "SUN", mercury: RU ? "МЕРКУРИЙ" : "MERCURY",
  venus: RU ? "ВЕНЕРА" : "VENUS", jupiter: RU ? "ЮПИТЕР" : "JUPITER",
  uranus: RU ? "УРАН" : "URANUS", neptune: RU ? "НЕПТУН" : "NEPTUNE",
  mars: RU ? "МАРС" : "MARS", saturn: RU ? "САТУРН" : "SATURN",
  /* Имя дыры зависит от продукта, а словарь спрашивает переключатель.
     Свойство считается в момент чтения: список собирается при загрузке
     файла, когда RC_VPN ещё может не подняться, а щёлкнуть продукт
     можно и прямо в полёте. */
  get hole() { return СЛ("дыраТитул"); },
  galaxy: RU ? "ГАЛАКТИКА" : "GALAXY", home: RU ? "ДОМОЙ" : "HOME",
  /* Пояс, комета и спутник: по ним ставят курс с голограмм, а имени
     у них не было - в табло курса выходило пусто. */
  belt: RU ? "АСТЕРОИДНЫЙ ПОЯС" : "ASTEROID BELT",
  comet: RU ? "КОМЕТА RC/2026" : "COMET RC/2026",
  sat: RU ? "СПУТНИК RC-SAT" : "SATELLITE RC-SAT"
};

/* Радиус орбиты и высота для каждого тела: подобраны по размеру */
/* Радиусы подобраны так, чтобы тело заполняло кадр, а не висело
   точкой вдали: клиент просил «подлетали к планетам, облетали их».
   Нижняя граница - зона обхода (1.8 радиуса плюс запас), иначе
   собственный манёвр уклонения начнёт отталкивать от цели. */
var ORBITS = {
  earth: { r: 128, y: 30 }, moon: { r: 42, y: 10 }, mars: { r: 68, y: 16 },
  saturn: { r: 168, y: 48 }, hole: { r: 200, y: 32 },
  /* Остальные тела системы: к каждому можно выйти на виток */
  sun: { r: 460, y: 90 }, mercury: { r: 34, y: 8 }, venus: { r: 62, y: 14 },
  jupiter: { r: 250, y: 60 }, uranus: { r: 140, y: 34 }, neptune: { r: 132, y: 30 }
};

/* Курс должен появляться в табло в тот же клик, а не ждать
   очередного 220-миллисекундного цикла телеметрии. На быстром
   переходе «Галактика → EXO» прежняя задержка выглядела как
   непринятая команда: в строке оставалось «—», хотя корабль уже
   менял траекторию. */
function courseText(name) {
  var value = name || "—";
  if (ui.cGoal) ui.cGoal.textContent = value;
  if (ui.navKeyTx) ui.navKeyTx.textContent = value === "—" ? (RU ? "не задан" : "none") : value;
}

function goTo(id) {
  if (!W3 || !W3.at) return;
  /* Из чужого рукава «Домой» - это прыжок в родную систему */
  if (uniIdx !== 0 && id === "home") { jumpUniverse(0); return; }
  if (id === "galaxy") {
    /* Галактика - точка на маршруте, а выбор рукава живёт в общем
       меню курса: два разных списка на одну задачу только путали */
    var pg = (W3.at.jump0 + W3.at.jump1) / 2;
    F.goalId = id;
    F.auto = false;
    F.goal = pg;
    F.goalName = RU ? "МЛЕЧНЫЙ ПУТЬ" : "MILKY WAY";
    courseText(F.goalName);
    hideHint();
    return;
  }
  var p = id === "earth" ? 0.02
        : id === "home" ? 0.985
        : id === "galaxy" ? (W3.at.jump0 + W3.at.jump1) / 2
        : W3.at[id];
  /* Признак цели ставим ТОЛЬКО когда цель нашлась. Раньше он
     присваивался первой строкой, до проверки, и несуществующая цель
     оставляла в состоянии корабля мусор: курс никуда не ведёт, а
     панель показывает, что ведёт. */
  if (p === undefined) return;
  F.goalId = id;
  F.auto = false;
  if (ui.auto) ui.auto.setAttribute("aria-pressed", "false");
  F.goal = p;
  F.goalName = GOAL_NAMES[id] || null;
  courseText(F.goalName);
  hideHint();
}

/* ── Процедурные текстуры ────────────────────────────────────
   Марс, Сатурн и кольца рисуются на холсте: до них в кадре далеко,
   а лишние мегабайты и лишние запросы полёту ни к чему. */
/* ── Карта планеты ───────────────────────────────────────────
   «Планеты не все реалистичные» - справедливо: ровный градиент с
   парой полос и точками читается крашеным шаром, а не миром.

   Настоящую поверхность делают три вещи, и все три здесь есть:
     - фрактальный шум в несколько октав, а не случайные пятна: он
       даёт материки у каменных планет и вихри у газовых;
     - широтная зональность - полярные шапки, экваториальный пояс,
       разная яркость по широте;
     - мелкая деталь поверх крупной, чтобы поверхность не рассыпалась
       на пиксели при подлёте вплотную.

   Тип задаётся снаружи: rocky - каменная с кратерами, gas -
   газовый гигант с поясами и вихрями, ice - ледяная с прожилками. */
function fbm2(x, y, oct, seed) {
  var v = 0, a = 0.5, f = 1;
  for (var i = 0; i < oct; i++) {
    /* Дешёвый градиентный шум на синусах: без таблиц и без выделений
       памяти в цикле, а рисунок получается неповторяющимся */
    var sx = x * f + seed * 7.3, sy = y * f + seed * 3.1;
    v += a * (Math.sin(sx) * Math.cos(sy * 1.37) +
              Math.sin(sx * 2.11 + sy * 0.71) * 0.6 +
              Math.cos(sy * 1.83 - sx * 0.53) * 0.4) / 2;
    a *= 0.52; f *= 2.07;
  }
  return v;
}

function paintPlanet(w, h, base, bands, noise, kind, seed) {
  kind = kind || "rocky";
  seed = seed || 1;
  var c = doc.createElement("canvas");
  c.width = w; c.height = h;
  var x = c.getContext("2d");

  /* Основа: широтный градиент из переданной палитры */
  var grd = x.createLinearGradient(0, 0, 0, h);
  for (var i = 0; i < base.length; i++) grd.addColorStop(base[i][0], base[i][1]);
  x.fillStyle = grd; x.fillRect(0, 0, w, h);

  var img = x.getImageData(0, 0, w, h);
  var d = img.data;
  var SX = kind === "gas" ? 3.2 : 6.5;      /* газовые вытянуты по долготе */
  var SY = kind === "gas" ? 14 : 6.5;
  for (var py = 0; py < h; py++) {
    var lat = py / h;                        /* 0 - северный полюс */
    var polar = Math.pow(Math.abs(lat - 0.5) * 2, 2.6);
    for (var px = 0; px < w; px++) {
      var u = px / w;
      var n = fbm2(u * SX * Math.PI * 2, lat * SY, kind === "gas" ? 4 : 5, seed);
      var k;
      if (kind === "gas") {
        /* ── Пояса газового гиганта ──────────────────────────
           Прежде здесь был только шум с контрастом в четверть, и
           Сатурн вблизи выходил гладким бежевым шаром - заказчик
           назвал это «крашеными шарами». У настоящего гиганта
           главное не пятна, а ЗОНАЛЬНЫЕ ПОЯСА: чередование светлых
           зон и тёмных лент по широте, потому что атмосфера
           разложена на струйные течения.

           Пояса задаём суммой гармоник по широте - так же, как в
           большом генераторе миров (rc-planets), только дешевле.
           Ленты не прямые: их широту ведёт по долготе медленная
           волна, отчего границы гуляют, как на снимках Кассини.

           Долготную деталь гасим к полюсам. Развёртка там сходится
           в точку, и любая мелочь по долготе превращается в лучи из
           полюса - ровно те швы, что видно на кадре. */
        var шир = (lat - 0.5) * 2;                  /* -1 полюс .. +1 полюс */
        var ТАУ = Math.PI * 2;
        var волна = Math.sin(u * ТАУ * 2 + шир * 3.1) * 0.020
                  + Math.sin(u * ТАУ * 3 - шир * 5.3) * 0.012;
        var ш2 = шир + волна;
        var пояс = Math.sin(ш2 * 8.5 + 0.7) * 0.55
                 + Math.sin(ш2 * 17.0 + 2.1) * 0.28
                 + Math.sin(ш2 * 27.5 + 4.3) * 0.14
                 + Math.sin(ш2 * 41.0 + 1.6) * 0.07;
        /* Ближе к полюсу пояса сходят на нет: там струйные течения
           распадаются в вихревую шапку, лент не видно. */
        пояс *= 1 - polar * 0.75;
        var мелочь = (n + fbm2(u * 9 * Math.PI * 2 + Math.sin(lat * 9) * 2.2,
                               lat * 26, 3, seed + 5) * 0.45) * (1 - polar * 0.92);
        /* Контраст поясов. Прежние 0.17 читались только на схеме, а
           вблизи шар оставался ровным. У настоящего Сатурна разница
           между зоной и лентой заметна глазом сразу. */
        k = пояс * 0.26 + мелочь * 0.15;
        /* Полярная шапка гиганта чуть темнее и холоднее */
        k -= polar * 0.10;
      } else {
        /* Контраст рельефа. У каменных он выше: на настоящей
           поверхности светлые нагорья и тёмные равнины отличаются
           заметно, и без этого шар выходит ровно-оранжевым. */
        k = n * 0.46;
        /* Полярные шапки: у каменных и ледяных светлеет к полюсам */
        k += polar * 0.30;
      }
      var o = (py * w + px) * 4;
      var m = 1 + k;
      d[o] = Math.max(0, Math.min(255, d[o] * m));
      d[o + 1] = Math.max(0, Math.min(255, d[o + 1] * m));
      d[o + 2] = Math.max(0, Math.min(255, d[o + 2] * m * (kind === "ice" ? 1.03 : 1)));
    }
  }
  x.putImageData(img, 0, 0);

  /* Кратеры каменных: кольцевой вал и тень внутри */
  if (kind === "rocky") {
    for (i = 0; i < noise; i++) {
      var cx = Math.random() * w, cy = h * 0.08 + Math.random() * h * 0.84;
      /* Размер кратера по степенному закону: мелких на порядок
         больше, чем крупных - как на настоящей поверхности. Прежняя
         степень давала слишком много одинаково крупных лунок. */
      var r = 1.2 + Math.pow(Math.random(), 3.6) * (w * 0.018);
      var g2 = x.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
      g2.addColorStop(0, "rgba(0,0,0,.16)");
      g2.addColorStop(0.72, "rgba(0,0,0,.07)");
      g2.addColorStop(0.92, "rgba(255,255,255,.12)");
      g2.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g2;
      x.beginPath(); x.arc(cx, cy, r, 0, 6.283); x.fill();
    }
  }
  /* Вихри газовых: вытянутые овалы вдоль поясов */
  if (kind === "gas") {
    for (i = 0; i < bands; i++) {
      var vx = Math.random() * w, vy = h * 0.12 + Math.random() * h * 0.76;
      var rx = w * (0.01 + Math.random() * 0.045), ry = rx * (0.24 + Math.random() * 0.3);
      var lite = Math.random() > 0.45;
      var g3 = x.createRadialGradient(vx, vy, 0, vx, vy, rx);
      g3.addColorStop(0, lite ? "rgba(255,244,224,.30)" : "rgba(60,32,16,.28)");
      g3.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g3;
      x.save(); x.translate(vx, vy); x.scale(1, ry / rx); x.translate(-vx, -vy);
      x.beginPath(); x.arc(vx, vy, rx, 0, 6.283); x.fill();
      x.restore();
    }
  }
  /* Прожилки ледяных: тонкие светлые трещины */
  if (kind === "ice") {
    x.strokeStyle = "rgba(226,244,255,.22)";
    for (i = 0; i < bands; i++) {
      x.lineWidth = 0.6 + Math.random();
      x.beginPath();
      var lx = Math.random() * w, ly = Math.random() * h;
      x.moveTo(lx, ly);
      for (var st = 0; st < 5; st++) {
        lx += (Math.random() - 0.5) * w * 0.13;
        ly += (Math.random() - 0.5) * h * 0.09;
        x.lineTo(lx, ly);
      }
      x.stroke();
    }
  }

  var t = new g.THREE.CanvasTexture(c);
  t.anisotropy = 8;
  if (g.THREE.SRGBColorSpace) t.colorSpace = g.THREE.SRGBColorSpace;
  return t;
}

function paintRing() {
  /* Кольца с честной структурой: широкая щель Кассини на двух
     третях радиуса, узкая щель Энке ближе к краю и спад плотности
     к обоим краям. Прежняя ровная гребёнка без щелей читалась
     полосатым блином. */
  var c = doc.createElement("canvas");
  c.width = 512; c.height = 32;
  var x = c.getContext("2d");
  for (var i = 0; i < 512; i++) {
    var d = i / 512;
    var a = 0.10 + 0.72 * Math.pow(Math.abs(Math.sin(d * 40) * Math.sin(d * 9)), 1.4);
    /* Щель Кассини: почти пустой пояс */
    var cas = Math.abs(d - 0.66) / 0.035;
    if (cas < 1) a *= 0.06 + 0.20 * cas;
    /* Щель Энке: тонкая */
    var enc = Math.abs(d - 0.905) / 0.012;
    if (enc < 1) a *= 0.15 + 0.4 * enc;
    if (d < 0.06 || d > 0.97) a *= d < 0.06 ? d / 0.06 : (1 - d) / 0.03;
    var tone = 205 + Math.round(30 * Math.sin(d * 23));
    x.fillStyle = "rgba(" + tone + "," + (tone - 22) + "," + (tone - 50) + "," + a.toFixed(3) + ")";
    x.fillRect(i, 0, 1, 32);
  }
  var t = new g.THREE.CanvasTexture(c);
  return t;
}

/* ── Небо ────────────────────────────────────────────────────
   Клиент просил детализированный и реалистичный космос. Картинка
   панорамы даёт общий тон, но она одна на все вселенные и в ней нет
   ни пылевых прожилок Млечного Пути, ни разницы в цвете звёзд.

   Рисуем небо сами: полоса Галактики с рукавами и тёмными полосами
   пыли (именно они делают её узнаваемой), шумовые скопления,
   несколько тысяч звёзд по спектральным классам и мягкие
   туманности. Всё на холсте, без единого запроса к сети - и
   перекрашивается под вселенную одним множителем цвета. */
/* Слабое железо. Признак нужен нескольким функциям сразу (небо,
   мир, звёзды), поэтому живёт на уровне модуля. Раньше он был
   объявлен внутри сборки мира, а читался и в текстуре неба - при
   первом же обращении сборка падала с «tiny is not defined», ошибку
   глотал try/catch, и кнопка «Начать полёт» выглядела мёртвой. */
var tiny = false, qualityHint = 0, particleBudget = false;
try {
  qualityHint = parseInt(root.getAttribute("data-quality-hint") || g.RC_QUALITY_HINT || "0", 10) || 0;
  tiny = qualityHint >= 2 || (navigator.deviceMemory || 4) <= 2 ||
         (navigator.hardwareConcurrency || 4) <= 2;
  /* A narrow high-DPR screen is fill-rate limited even when the CPU
     reports eight cores. Keep all planets, materials and motion, but
     spend fewer transparent star fragments; the procedural sky map
     preserves the apparent density between the real parallax stars. */
  particleBudget = tiny || innerWidth < 760 || qualityHint >= 1;
} catch (eTiny) { tiny = false; particleBudget = innerWidth < 760; }

/* Цвет чёрного тела по температуре: приближение планковского локуса,
   то самое, по которому строят таблицы цветовой температуры для
   света. Считается при сборке, в кадре не стоит ничего, а цвет
   получается не «на глаз», а по шкале.

   Функция вынесена на уровень файла нарочно. Копия жила внутри
   сборки звёздного поля, а панорама неба и галактики красились
   вручную подобранными тройками - оттого у них и было по три-четыре
   цвета на весь объект. Одна шкала на всё небо означает, что звезда
   в точках, звезда в панораме и звезда в рукаве спирали одной
   температуры выглядят одинаково, а это и есть достоверность. */
function планкТон(K) {
  var t = K / 100, r, gg, b;
  if (t <= 66) { r = 255; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); }
  if (t <= 66) { gg = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { gg = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) { b = 255; }
  else if (t <= 19) { b = 0; }
  else { b = 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  r = Math.max(0, Math.min(255, r));
  gg = Math.max(0, Math.min(255, gg));
  b = Math.max(0, Math.min(255, b));
  /* Нормируем по самому яркому каналу: яркость несёт величина, а
     тройка отвечает только за оттенок. Без этого красные карлики
     выходили бы темнее положенного дважды - и по величине, и по
     цвету. */
  var м = Math.max(r, Math.max(gg, b)) || 1;
  return [r / м, gg / м, b / м];
}

/* Доли спектральных классов взяты для ВИДИМОГО неба, а не для всех
   звёзд подряд: глазом видны горячие и яркие, поэтому голубых и
   белых среди них заметно больше, чем в галактике. Температуры -
   настоящие границы классов. Таблица одна на звёздное поле и на
   панораму: разойтись они не должны. */
var КЛАССЫ_НЕБА = [
  [0.10, 11000, 26000, 0],   /* O и B - голубовато-белые */
  [0.22, 7600, 11000, 0],    /* A - белые с голубизной */
  [0.24, 6100, 7600, 1],     /* F - белые тёплые */
  [0.20, 5300, 6100, 1],     /* G - жёлтые, как наше Солнце */
  [0.17, 3900, 5300, 2],     /* K - оранжевые */
  [0.07, 2600, 3900, 2]      /* M - красные */
];

function skyTexture(mob) {
  /* Размер скромный: текстура натянута на сферу радиусом 4200, и в
     кадр попадает малая её доля - каждый нарисованный пиксель на
     экране растягивается в несколько. Крупная сетка тут не нужна,
     нужна мягкость. */
  /* Разрешение панорамы поднято.

     Она натянута на сферу радиусом 4200, и в кадр при поле зрения 72
     градуса попадает около четырёхсот текселей по высоте на тысячу с
     лишним экранных пикселей: каждый тексель растягивался в два с
     половиной пикселя, а сверху ложилось ещё полтора пикселя
     размытия. Итого фон был размыт на четыре пикселя по построению -
     это и есть та муть, на которую жаловался заказчик.

     На телефоне оставляем прежний размер: там и памяти меньше, и
     экран мельче. */
  var W = tiny ? 1024 : (mob ? 2048 : 4096), H = W / 2;
  var c = doc.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");

  /* Своё зерно: небо обязано быть одинаковым от захода к заходу,
     иначе созвездия перемешиваются при каждом открытии игры */
  /* Генератор поменян с линейного на сдвиговый, и это не придирка.

     Линейный конгруэнтный даёт числа хорошие поодиночке и плохие
     парами: соседние значения ложатся на небольшое число прямых.
     Пока их сотни, этого не видно; на четырнадцати тысячах пылинок,
     где x и y берутся подряд, небо покрывалось правильной РЕШЁТКОЙ -
     приёмка увидела её сразу и приняла за наложение из вёрстки.
     Сдвиговый xorshift такой связи между соседними значениями не
     имеет, и звёздная пыль ложится честно россыпью. */
  var seed = 20260819;
  function rnd() {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;  seed >>>= 0;
    return seed / 4294967296;
  }

  x.fillStyle = "#010308";
  x.fillRect(0, 0, W, H);

  /* ── Осевая линия Млечного Пути ──────────────────────────────
     Плоскость диска на равнопромежуточной развёртке - большой круг,
     а большой круг на такой развёртке рисуется синусоидой. Вторая
     гармоника малой амплитуды добавлена нарочно: в чистой синусоиде
     глаз читает формулу, а не небо. Значения тут в долях высоты, а
     не в точках: то же поле считается и на мелком холсте дымки, и
     на полном - при звёздах, и делить их на две системы координат
     значит однажды разъехаться. */
  var midY = 0.52, tilt = 0.105;
  function осьВ(u) {
    return midY + Math.sin(u * 6.283185 + 0.55) * tilt +
                  Math.sin(u * 18.85 + 2.10) * 0.013;
  }
  /* Ширина полосы зависит от долготы, и это не украшение. В сторону
     центра галактики мы смотрим сквозь балдж и весь диск - полоса
     широкая и яркая; в противоположную сторону смотрим наружу, к
     краю диска - полоса узкая и тусклая. Прежняя постоянная ширина
     (H*0.07..0.17 по всей долготе) и делала из неё ленту. Центр
     оставлен на u=0.32, где он и стоял. */
  function ширинаВ(u) {
    var d = u - 0.32;
    if (d > 0.5) d -= 1; else if (d < -0.5) d += 1;
    return 0.030 + 0.072 * Math.exp(-(d * d) / 0.090);
  }
  /* ── Шум для облаков газа ────────────────────────────────────
     Готовый fbm2 из соседнего кода сюда не годится, и это видно
     глазом: он собран из трёх синусов с постоянными направлениями,
     поэтому даёт не облака, а КОСЫЕ ПОЛОСЫ под одним и тем же углом.
     На шаре планеты это сходит за течения в атмосфере, на полнеба -
     нет. Плюс он считает шесть тригонометрических функций на октаву,
     а тут сотня тысяч точек.

     Здесь решётчатый шум на целочисленном хеше: ни одной
     тригонометрии, направления равноправны, и главное - он ЗАМКНУТ
     по долготе. Панорама смыкается сама с собой, и без замыкания на
     шве u=0/1 стоял бы видимый стык: слева одно облако, справа
     другое. Замыкание даётся тем, что решётка по x берётся по
     модулю своего периода. */
  function хешШ(i, j) {
    var н = (i * 374761393 + j * 668265263) | 0;
    н = (н ^ (н >> 13)) | 0;
    н = (н * 1274126177) | 0;
    return ((н ^ (н >> 16)) >>> 0) / 4294967296;
  }
  function значШ(x, y, п) {
    var i0 = Math.floor(x), j0 = Math.floor(y);
    var fx = x - i0, fy = y - j0;
    /* Сглаживающая кривая 3t^2-2t^3: у неё нулевая производная в
       узлах решётки. Без неё на стыках ячеек видны ромбы. */
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var i1 = i0 + 1;
    i0 = ((i0 % п) + п) % п; i1 = ((i1 % п) + п) % п;
    var a = хешШ(i0, j0), b = хешШ(i1, j0);
    var c2 = хешШ(i0, j0 + 1), d = хешШ(i1, j0 + 1);
    var в = a + (b - a) * fx;
    return в + (c2 + (d - c2) * fx - в) * fy;
  }
  /* Фрактальная сумма: крупные облака плюс всё более мелкая рвань.
     Возвращает 0..1. Сдвиг между полями обязан быть ЦЕЛЫМ - дробный
     сдвинул бы решётку относительно периода и вернул шов. */
  function шумНеба(u, v, реш, окт, сдв) {
    var s = 0, ам = 0.5, ч = 1, вес = 0, о, п;
    for (о = 0; о < окт; о++) {
      п = Math.round(реш * ч);
      s += ам * значШ(u * п + сдв, v * п * 0.5 + сдв * 3, п);
      вес += ам; ам *= 0.5; ч *= 2;
    }
    return s / вес;
  }

  /* ── Дымка диска: клочья вместо ровной полосы ─────────────────
     Было: тысяча восемьсот круглых мазков ТРЁХ заранее назначенных
     цветов с прозрачностью 0.030..0.075, поверх - восемьсот тёмных
     клякс наугад. Три цвета на весь Млечный Путь, ровный гауссов
     профиль поперёк и случайные пятна вдоль - это и читается как
     нарисованное.

     Стало: поле яркости считается фрактальным шумом в четыре октавы
     на мелком холсте и растягивается на панораму. Мелкий холст тут
     не экономия, а замысел. Во-первых, облака межзвёздного газа -
     структура крупная, мелких деталей у неё нет. Во-вторых, у
     растянутого растра не бывает ни ступенек, ни дизеринга, тогда
     как сотни полупрозрачных градиентов давали на восьмибитном
     холсте правильную решётку - ту самую, которую приёмка искала
     сперва в вёрстке, потом в зерне плёнки.

     Цвет берётся по планковской шкале и плывёт вдоль полосы: к
     центру теплее (старое население балджа плюс покраснение на
     пыли), к краю холоднее (молодые голубые звёзды рукавов). Это
     тридцать два оттенка вместо трёх. */
  var МW = tiny ? 192 : 384, МH = МW >> 1;
  var ЛУТ = [], лi, лт;
  for (лi = 0; лi < 32; лi++) {
    лт = планкТон(3400 + лi * 200);
    ЛУТ.push([лт[0] * 255, лт[1] * 255, лт[2] * 255]);
  }
  /* Карта поглощения остаётся жить после отрисовки дымки: по ней
     потом гасятся звёзды. Тёмная прожилка обязана быть ДЫРОЙ в
     звёздном поле, а не серым мазком поверх него - именно этим
     пылевое облако на снимках и отличается от кляксы. */
  var экстМап = new Float32Array(МW * МH);
  var дым = doc.createElement("canvas");
  дым.width = МW; дым.height = МH;
  var xд = дым.getContext("2d");
  var им = xд.createImageData(МW, МH), дн = им.data;
  var мx, мy, мi;
  for (мy = 0; мy < МH; мy++) {
    var vv = (мy + 0.5) / МH;
    for (мx = 0; мx < МW; мx++) {
      var uu = (мx + 0.5) / МW;
      var шр = ширинаВ(uu);
      var dv = vv - осьВ(uu);
      /* Поперёк полосы плотность падает по гауссиане: у звёздного
         диска экспоненциальная шкала высот, и в проекции это она. */
      var проф = Math.exp(-(dv * dv) / (2 * шр * шр));
      /* Две группы октав: крупные облака и рваный край. Без второй
         полоса выходит ватной, без первой - шумной. Итог возводим в
         степень: у степени больше единицы низ шкалы уезжает к нулю,
         и вместо ровного свечения получаются РАЗДЕЛЬНЫЕ облака с
         тёмными промежутками - как в настоящем Млечном Пути. */
      var н1 = шумНеба(uu, vv, 6, 4, 11);
      var н2 = шумНеба(uu, vv, 18, 3, 37);
      var клоч = н1 * 0.72 + н2 * 0.28;
      клоч = Math.pow(клоч < 0 ? 0 : клоч, 2.4) * 6.2;
      /* Пыль лежит слоем ВДВОЕ тоньше светящегося диска, поэтому
         тёмная прожилка всегда уже полосы и всегда идёт вдоль неё.
         Отсюда сам собой получается Великий Разрыв: полоса разрезана
         по длине, а не запятнана кляксами. */
      var пшр = шр * 0.34;
      var пыльП = Math.exp(-(dv * dv) / (2 * пшр * пшр));
      var пн = шумНеба(uu, vv, 9, 4, 91);
      var экс = пыльП * Math.max(0, пн * 2.6 - 0.45);
      экстМап[мy * МW + мx] = экс;
      /* Закон Бугера: свет гаснет по экспоненте от толщи пыли. Это
         та же формула, по которой краснеет закат. */
      var я = проф * клоч * Math.exp(-экс * 1.55);
      var d0 = uu - 0.32;
      if (d0 > 0.5) d0 -= 1; else if (d0 < -0.5) d0 += 1;
      var К = 8600 - 3000 * Math.exp(-(d0 * d0) / 0.12) - 1500 * Math.min(1, экс);
      var кид = (К - 3400) / 200 | 0;
      if (кид < 0) кид = 0; else if (кид > 31) кид = 31;
      var тн = ЛУТ[кид];
      var ал = я * 0.55;
      if (ал > 0.74) ал = 0.74;
      мi = (мy * МW + мx) * 4;
      дн[мi] = тн[0]; дн[мi + 1] = тн[1]; дн[мi + 2] = тн[2];
      дн[мi + 3] = (ал * 255) | 0;
    }
  }
  xд.putImageData(им, 0, 0);
  /* Растягиваем в два приёма. Браузер увеличивает билинейно, и один
     прыжок сразу в девять раз оставляет гранёные скаты на облаках -
     сетку мелкого холста видно. Промежуточный шаг эту огранку
     сглаживает, а стоит один лишний drawImage. */
  x.imageSmoothingEnabled = true;
  try { x.imageSmoothingQuality = "high"; } catch (eСг) {}
  var сред = doc.createElement("canvas");
  сред.width = МW * 3; сред.height = МH * 3;
  var xс = сред.getContext("2d");
  xс.imageSmoothingEnabled = true;
  xс.drawImage(дым, 0, 0, МW * 3, МH * 3);
  x.drawImage(сред, 0, 0, W, H);

  var i, gr;

  /* Балдж: сгущение к центру полосы. Он ПРИПЛЮСНУТ поперёк диска -
     у настоящей спирали балдж вытянут вдоль плоскости, и круглое
     пятно, которое стояло здесь раньше, читалось наклейкой. */
  var цx = W * 0.32, цy = осьВ(0.32) * H;
  x.save();
  x.translate(цx, цy);
  x.scale(1, 0.44);
  var балдж = x.createRadialGradient(0, 0, 0, 0, 0, W * 0.115);
  балдж.addColorStop(0, "rgba(255,236,200,.20)");
  балдж.addColorStop(0.34, "rgba(240,214,178,.10)");
  балдж.addColorStop(0.70, "rgba(206,190,176,.035)");
  балдж.addColorStop(1, "rgba(200,190,180,0)");
  x.fillStyle = балдж;
  x.fillRect(-W * 0.12, -W * 0.12, W * 0.24, W * 0.24);
  x.restore();

  /* Туманности в фирменных цветах: небо перекликается с сайтом */
  var NEB = [[0.13, 0.30, "66,178,220"], [0.62, 0.68, "138,89,246"],
             [0.82, 0.26, "66,178,220"], [0.44, 0.78, "196,120,255"]];
  for (i = 0; i < NEB.length; i++) {
    var nx = NEB[i][0] * W, ny = NEB[i][1] * H, nr = W * 0.05;
    /* Тридцать мазков вместо девяноста, и каждый втрое заметнее.
       Плотность та же, а вот беда уходит: прозрачность в полторы
       сотых на восьмибитном холсте меньше одной ступени яркости, и
       браузер раскладывает такой градиент УПОРЯДОЧЕННЫМ дизерингом.
       Его узор - правильная решётка, и панорама растягивает её на
       весь кадр. Приёмка приняла эту решётку за наложение из
       вёрстки и искала её сперва в CSS, потом в зерне плёнки. */
    for (var q = 0; q < 30; q++) {
      var ox = nx + (rnd() - 0.5) * nr * 2.0, oy = ny + (rnd() - 0.5) * nr * 1.4;
      var orr = nr * (0.10 + rnd() * 0.30);
      gr = x.createRadialGradient(ox, oy, 0, ox, oy, orr);
      gr.addColorStop(0, "rgba(" + NEB[i][2] + "," + (0.042 + rnd() * 0.060).toFixed(3) + ")");
      gr.addColorStop(1, "rgba(" + NEB[i][2] + ",0)");
      x.fillStyle = gr;
      x.beginPath(); x.arc(ox, oy, orr, 0, 6.283); x.fill();
    }
  }

  /* Панорама уходит под лёгкое размытие целиком. Текстура натянута
     на сферу радиусом 4200, в кадр попадает малая её доля, и каждый
     её тексель растягивается на экране в десяток пикселей: любая
     ступенька и любой остаток дизеринга вырастают вместе с ним.
     Полтора пикселя размытия на самой карте на экране не видны -
     она и так мягкая по замыслу, - а решётку снимают начисто. */
  try {
    var мяг = doc.createElement("canvas");
    мяг.width = W; мяг.height = H;
    var xм = мяг.getContext("2d");
    /* Размытие поджато с полутора пикселей до трёх четвертей: на
       вчетверо более подробной карте решётку дизеринга снимает и
       такое, а мылить фон больше нечем. */
    xм.filter = "blur(" + (W >= 4096 ? 0.75 : 1.2) + "px)";
    xм.drawImage(c, 0, 0);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.filter = "none";
    x.clearRect(0, 0, W, H);
    x.drawImage(мяг, 0, 0);
  } catch (eБ) {}

  /* ── Звёзды панорамы ─────────────────────────────────────────
     Было: семь тысяч точек ОДНОГО цвета (226,236,255) с яркостью
     0.05..0.29, то есть меньше шести раз от самой тусклой до самой
     яркой, и все внутри полосы. Небо из такого выходит равномерной
     крупой - одна ступень яркости, один оттенок, ноль глубины.

     Настоящее небо устроено наоборот: тусклых на порядки больше,
     чем ярких, а разница по блеску между самой яркой и самой
     слабой видимой звездой - тысячи раз. Светимость берём степенным
     законом, цвет - по планковской шкале и по долям спектральных
     классов, тем же двум таблицам, по которым красится живое
     звёздное поле. Глубину даёт карта пыли: под тёмной прожилкой
     звёзды гаснут, и облако становится ДЫРОЙ в звёздном поле, как
     на снимках, а не мазком поверх.

     Рисуем ПОСЛЕ размытия и в режиме сложения. Раньше размытие шло
     последним и съедало точки заодно с дизерингом, а свет,
     положенный поверх непрозрачной краской, гасил дымку под собой
     вместо того, чтобы к ней прибавиться. */
  var ТОНЫ = [], тi;
  for (тi = 0; тi < 48; тi++) ТОНЫ.push(планкТон(2600 + тi * 500));
  /* Плотность режем на мелких картах. На развёртке в 4096 один
     тексель приходится примерно на один пиксель экрана, и точка
     остаётся точкой; на 2048 она растягивается вдвое, на 1024 -
     вчетверо, и та же россыпь превращается в снег. Числу звёзд это
     менять нельзя (рисунок неба обязан совпадать), а вот яркость
     слабых - можно. */
  var плот = W >= 4096 ? 1 : (W >= 2048 ? 0.66 : 0.44);
  var зв = tiny ? 5000 : (mob ? 9500 : 16000);
  x.globalCompositeOperation = "lighter";
  for (i = 0; i < зв; i++) {
    var сu = rnd(), сv;
    if (rnd() < 0.62) {
      /* Население диска жмётся к плоскости. Гауссово отклонение
         собираем суммой трёх равномерных: центральная предельная
         теорема даёт колокол, а логарифма и корня, как в
         преобразовании Бокса-Мюллера, тут не нужно. */
      сv = осьВ(сu) + (rnd() + rnd() + rnd() - 1.5) * 0.86 * ширинаВ(сu);
    } else {
      /* Гало раскидано ровно по СФЕРЕ, а не по развёртке: равномерно
         по v звёзды сбиваются к полюсам панорамы, и на потолке
         кабины это видно сразу. */
      сv = Math.acos(1 - 2 * rnd()) / 3.14159265;
    }
    if (сv < 0.002 || сv > 0.998) continue;
    var кx = сu * МW | 0, кy = сv * МH | 0;
    if (кx >= МW) кx = МW - 1;
    if (кy >= МH) кy = МH - 1;
    /* Степенной закон: показатель 3.2 означает, что звёзд ярче
       половины шкалы примерно каждая десятая, а ярче четырёх пятых -
       каждая двадцатая. Именно такое соотношение и читается небом. */
    var я2 = Math.pow(rnd(), 3.2) * Math.exp(-экстМап[кy * МW + кx] * 1.9);
    var тк = rnd(), сум = 0, кл = КЛАССЫ_НЕБА[0], ки;
    for (ки = 0; ки < КЛАССЫ_НЕБА.length; ки++) {
      сум += КЛАССЫ_НЕБА[ки][0];
      if (тк <= сум) { кл = КЛАССЫ_НЕБА[ки]; break; }
    }
    var тид = (кл[1] + (кл[2] - кл[1]) * rnd() - 2600) / 500 | 0;
    if (тид < 0) тид = 0; else if (тид > 47) тид = 47;
    var тон = ТОНЫ[тид];
    /* Слабые звёзды глаз видит обесцвеченными: на пороге
       чувствительности цвет пропадает первым. */
    var нас = 0.30 + я2 * 0.70;
    var кR = (255 * (1 + (тон[0] - 1) * нас)) | 0;
    var кG = (255 * (1 + (тон[1] - 1) * нас)) | 0;
    var кB = (255 * (1 + (тон[2] - 1) * нас)) | 0;
    var пx = сu * W, пy = сv * H;
    var цвет = "rgba(" + кR + "," + кG + "," + кB + ",";
    if (я2 < 0.30) {
      /* Тусклое большинство - одна точка, и по ЦЕЛЫМ координатам:
         дробные canvas размазывает по двум пикселям, звезда тускнеет
         вдвое и стоит вдвое дороже. */
      x.fillStyle = цвет + ((0.05 + я2 * 1.05) * плот).toFixed(3) + ")";
      x.fillRect(пx | 0, пy | 0, 1, 1);
    } else if (я2 < 0.90) {
      /* Средние получают слабый ореол три на три: так работает
         рассеяние в атмосфере и в оптике, у яркой точки всегда есть
         подсветка вокруг. Крестов не рисуем - дифракционные лучи
         в этой сборке нарочно сведены к полупроценту звёзд. */
      x.fillStyle = цвет + (0.10 * плот).toFixed(3) + ")";
      x.fillRect((пx | 0) - 1, (пy | 0) - 1, 3, 3);
      x.fillStyle = цвет + (0.34 + я2 * 0.66).toFixed(3) + ")";
      x.fillRect(пx | 0, пy | 0, 1, 1);
    } else {
      /* Единицы самых ярких получают настоящий ореол, и его диаметр
         растёт с блеском - ровно так же, как размер кружка звезды на
         фотографии растёт с выдержкой. */
      var рад = 1.7 + я2 * 4.6;
      gr = x.createRadialGradient(пx, пy, 0, пx, пy, рад);
      gr.addColorStop(0, цвет + "1)");
      gr.addColorStop(0.30, цвет + "0.36)");
      gr.addColorStop(1, цвет + "0)");
      x.fillStyle = gr;
      x.beginPath(); x.arc(пx, пy, рад, 0, 6.283); x.fill();
    }
  }
  x.globalCompositeOperation = "source-over";

  var tex = new g.THREE.CanvasTexture(c);
  tex.colorSpace = g.THREE.SRGBColorSpace || tex.colorSpace;
  tex.anisotropy = 8;
  return tex;
}

function glowSprite(size, inner, outer) {
  var c = doc.createElement("canvas");
  c.width = c.height = size;
  var x = c.getContext("2d");
  var gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  x.fillStyle = gr; x.fillRect(0, 0, size, size);
  return new g.THREE.CanvasTexture(c);
}

/* ── Мир ─────────────────────────────────────────────────────ы */
/* ── Секундомер сборки мира ──────────────────────────────────
   Владелец пишет одно и то же с самого начала: «вход в ракету
   абсолютно всегда зависает». Сборку мира мы уже сдвинули вперёд,
   в проход к трапу, но она как была одним синхронным куском, так и
   осталась - просто встала раньше. Чинить кусок вслепую нельзя:
   надо знать, какой из двадцати разделов съедает секунды.

   Замер живёт только под ?rcdbg=1 и в боевом кадре не стоит ничего.
   Разбивку забирают через RC_FLIGHT.этапы(). */
var ЭТАП_Т = 0, ЭТАПЫ = [];
function этап(имя) {
  if (!DBG) return;
  var т = performance.now();
  if (ЭТАП_Т) ЭТАПЫ.push([имя, +(т - ЭТАП_Т).toFixed(1)]);
  ЭТАП_Т = т;
}

function buildWorld() {
  var T = g.THREE;
  ЭТАПЫ = []; ЭТАП_Т = DBG ? performance.now() : 0;
  этап("старт");
  /* Мир собирается в НОВУЮ сцену, значит всё, что помнило узлы
     старой, обязано забыться здесь же.

     built держал собранные вселенные. Группы оставались в снесённой
     сцене, и повторный прыжок в тот же рукав приводил корабль в
     пустоту: вспышка есть, звук есть, а тел нет, и ни навести, ни
     отсканировать нечего.

     netNodes держал маяки сети. netRestore выходит первой строкой,
     если список не пуст, поэтому после пересборки ни один узел
     игрока в кадр не возвращался: счётчик на пульте показывал
     «5 из 11», кнопка УЗЕЛ отвечала «узел уже стоит», а в космосе
     не было ни одного маяка и ни одной линии.

     Путь до беды тот же самый: смена языка или потеря контекста. */
  built = {};
  netNodes = [];
  netLine = null;
  netBeam = null;
  netBeamT = 0;
  traf = null;
  trafN = 0;
  trafSeg = [];
  /* Узкий экран и слабое железо - разные вещи. Раньше по флагу mob
     в игре резалось всё подряд: вдвое меньше звёзд, вдвое грубее
     сферы планет, вполовину короче астероидные пояса. Владелец
     сравнил телефон с монитором и потребовал одинаковой картины -
     отличаться могут только раскладка и размеры. Поэтому количество
     и детализацию режем только на действительно слабом железе (tiny
     объявлен выше), а бюджет телефона добираем разрешением буфера. */
  var mob = innerWidth < 760;
  /* Сглаживание нужно и на телефоне: без него кромки планет и
     корпуса кабины пилятся, и картинка сразу читается дешевле, чем
     на мониторе. Отключаем только на действительно слабом железе. */
  /* Игра занимает весь экран, значит на время полёта она и есть
     главная сцена: берём место в общем бюджете контекстов и, если
     не хватило, просим вспомогательные уступить. Без этого учёта
     мы держали четвёртый контекст сверх потолка, и на iOS браузер
     молча отбирал его у нас - холст чернел навсегда. */
  if (g.RC_GL && g.RC_GL.take) { try { g.RC_GL.take(true); } catch (e) {} }

  var r = new T.WebGLRenderer({ canvas: ui.cv, antialias: !tiny, alpha: false, powerPreference: "high-performance" });
  /* Плотность пикселей. Числа 1.2 на телефоне хватало, пока пульт
     жил отдельным слоем разметки и его резкость от кадра не
     зависела. Сейчас пульт рисуется внутри кадра, и низкая
     плотность мылит именно его - клавиши, подписи, деления ленты.
     Стартовое число берём игровым: в игре пульт живёт слоем
     разметки и от плотности кадра не зависит, а космос полутора
     точек не замечает. Подъезд к пульту в салоне поднимет её до
     двойки сам - там пульт рисуется внутри кадра. */
  r.setPixelRatio(Math.min(g.devicePixelRatio || 1, tiny ? 1.0 : (mob ? 1.35 : 1.8)));
  r.setClearColor(0x02050c, 1);
  этап("слой WebGL");

  /* Страховка на случай, если контекст всё же отберут: выходим из
     полёта на страницу и забываем собранный мир, чтобы следующий
     заход построил его заново, а не показывал чёрный кадр. */
  if (g.RC_GL && g.RC_GL.guard) {
    try {
      g.RC_GL.guard(ui.cv, function () {
        F.built = false;
        /* Место уже вернула сама страховка, второй раз не отдаём */
        F.glSlot = false;
        if (F.open) close();
      }, function () {
        if (ui.cv) ui.cv.style.opacity = "";
      });
    } catch (e2) {}
  }
  F.glSlot = true;

  var scene = new T.Scene();
  var FOV0 = baseViewFov(innerWidth, innerHeight);
  var cam = new T.PerspectiveCamera(FOV0, 1, 0.1, 9000);

  /* Рассеянный свет придавлен с 0.85 до 0.16.

     Ровный свет со всех сторон - это отсутствие света. Он поднимает
     теневые стороны до уровня освещённых, и объём исчезает: планета
     показывает материки там, где у неё ночь, металл теряет блик,
     углы перестают темнеть. Именно поэтому кадр читался макетом.

     Заполнение теперь даёт окружение (scene.environment): оно
     цветное и направленное, то есть тень от Земли синеватая, а от
     бортовых ламп тёплая, как в жизни. */
  /* Заполняющий свет поджат с 0.34 до 0.15. Ровный синий подлив со
     всех сторон поднимал теневые половины: настоящей чёрной ночи не
     было ни у одного тела, и объём пропадал - шар выглядел
     подсвеченным изнутри. В комментарии рядом уже стояло 0.16, а в
     коде жило 0.34: правку когда-то откатили, а текст остался. */
  var amb = new T.AmbientLight(0x3a4a68, 0.15);
  scene.add(amb);
  /* Светило стояло за спиной у камеры, и Земля из окна была всегда
     дневная - зелёно-синий шар, который заказчик справедливо назвал
     школьным глобусом. На всех присланных референсах солнце за
     планетой: к нам обращена ночная сторона с огнями городов, по
     краю идёт тонкий раскалённый ободок атмосферы, а кабина тонет
     в тени и держится на своих лампах. Это же и физически честнее:
     корабль на ночной стороне орбиты.

     Уводим солнце за Землю и вбок, чтобы получить не затмение, а
     серп: часть диска остаётся в свету, терминатор проходит по
     кадру. По этому же вектору каждый кадр считаются и огни
     городов, и закатный поясок (см. earthSunFrame). */
  /* ── Почему здесь точечный свет, а не направленный ────────
     Направленный свет светит ОДНИМ направлением на всю сцену: он
     считается бесконечно далёким, и его положение задаёт только
     наклон лучей. Для настоящего Солнца это неверно вдвойне.
     Во-первых, оно не бесконечно далеко: диск стоит в 2600 единицах,
     а планеты разбросаны на сотни - направление на светило у Меркурия
     и у Сатурна разное. Во-вторых, направленный свет целится в начало
     координат, и тело, стоящее в стороне, получает свет под чужим
     углом.

     Отсюда чёрные шары. Замер по Венере: снимок у неё яркий, среднее
     166/90/28, а в кадре она читалась чёрным диском - к камере на
     подлёте была повёрнута та половина, которую этот единственный
     наклон не освещал вовсе. То же самое ловилось на телах чужих
     систем.

     Точечный свет с нулевым затуханием и без предела дальности даёт
     ровно то, что нужно: сила та же по всей сцене, а НАПРАВЛЕНИЕ у
     каждого тела своё, от него к светилу. Ламп при этом не
     прибавляется - эта заменяет прежнюю, и кадр не дорожает.

     Ноль затухания здесь не упрощение, а осознанный выбор: настоящее
     падение силы с расстоянием на масштабе сцены увело бы дальние
     планеты в темноту, а мы показываем систему целиком, а не считаем
     светимость. */
  var sun = new T.PointLight(0xfff2dc, 1.6, 0, 0);
  /* Светило было ЗА планетой, и в окно смотрела только ночная
     сторона. Пока карта огней была бракованной, этого не замечали:
     её ровная синева подсвечивала весь шар, и он читался дневным.
     Починили карту - и вылезла правда: чёрный диск с золотой
     сеткой. Владелец сказал прямо: «земля стала не естественным
     тёмным, сделай реалистично».

     Уводим светило вперёд и вбок. Теперь освещена та половина, что
     смотрит в окно, а терминатор проходит по диску: слева день с
     океаном и облаками, справа ночь с огнями городов. Это и есть
     вид с орбиты, а не силуэт на просвет. */
  /* Единственная точка истины про то, где стоит светило. Ею
     пользуются и свет, и диск, и корона, и блик, и всё, что считает
     направление на солнце. Раньше числа были вписаны в трёх местах
     и разошлись. */
  var СОЛНЦЕ = new T.Vector3(2600, 1000, 1750);

  /* Свет идёт ОТТУДА ЖЕ, где в кадре стоит солнце.

     Здесь было (-2350, 900, 1650), а сам диск солнца, корона и блик
     стоят в (2600, 1000, 1750). Знак по X противоположный: планеты
     освещались с той стороны, где солнца в кадре нет вообще. Хвост
     кометы считался от блика, ночная сторона Земли от этого света -
     два разных направления в одном кадре, и ни одно не совпадало с
     тем, что видит глаз. Это и есть первая причина, по которой
     картинка читалась нарисованной. */
  sun.position.set(СОЛНЦЕ.x, СОЛНЦЕ.y, СОЛНЦЕ.z);
  scene.add(sun);

  var L = new T.TextureLoader();

  /* Карты планет лежат в двух видах: webp вдвое легче исходного
     снимка при той же картинке, а jpg/png остаётся запасным путём
     для браузеров без webp. Вход в игру на телефоне стоил 2,4 МБ
     одних только текстур - теперь 1,1 МБ. */
  var WEBP = (function () {
    try {
      var c = doc.createElement("canvas");
      c.width = c.height = 1;
      return c.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch (e) { return false; }
  })();

  /* Предел анизотропии берём у самого железа, а не числом из головы.

     Стояла четвёрка, и на кромке диска Земли висел мягкий белый
     КВАДРАТ. Приёмка сперва приняла его за сломанный спрайт, потом
     за отражение окружения; оказалось проще и хуже. На кромке шара
     текстура сжимается почти в нуль, и при скользящем угле выбирается
     очень грубый уровень мип-карты: солнечный серп вместо дуги
     разваливается в один размытый тексель. Четырёх выборок туда не
     хватает, шестнадцати хватает. Карта у железа спрашивается сама -
     где потолок ниже, возьмём его. */
  var АНИЗО = 4;
  try { АНИЗО = Math.max(4, Math.min(16, r.capabilities.getMaxAnisotropy())); } catch (eA) {}

  function tex(p) {
    var src = p;
    if (WEBP) src = p.replace(/\.(jpg|png)$/, ".webp");
    /* Промахнулись мимо webp - молча возвращаемся к исходнику,
       игра не имеет права остаться без карты планеты */
    /* Загрузчику текстур нельзя передавать null вместо колбэка: он
       зовёт его напрямую, без проверки, и падает с «e is not a
       function» прямо на входе в игру. Пустая функция вместо null. */
    var noop = function () {};
    var t = L.load(src, noop, noop, src === p ? noop : function () {
      var f = L.load(p);
      f.anisotropy = АНИЗО;
      t.image = f.image;
      t.needsUpdate = true;
    });
    t.anisotropy = АНИЗО;
    /* Карта цвета обязана жить в sRGB. Без этой строки загрузчик
       three отдаёт её линейной, и снимок выцветает: Земля выходила
       молочной, а Марс и Сатурн, которые грузятся другой функцией,
       жили в другой гамме и не сходились с ней по тону. */
    if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  /* Карта тела со страховкой. Снимок ставим ТОЛЬКО когда он
     действительно доехал: три.js держит у материала пустую текстуру,
     пока файл грузится, и шар всё это время чёрный. На быстром канале
     это незаметно, на мобильном - планета угольная. Пока снимка нет,
     работает цвет материала, а карта встаёт по факту загрузки. */
  function картаТела(путь, мат) {
    var src = путь;
    if (!WEBP) src = путь.replace(/\.webp$/, ".jpg");
    L.load(src,
      function (t) {
        t.colorSpace = T.SRGBColorSpace || t.colorSpace;
        t.anisotropy = АНИЗО;
        mat_поставить(мат, t);
      },
      null,
      function () {
        /* Не доехал webp - пробуем исходник. Не доехал и он - тело
           остаётся своего цвета, и это честнее чёрного шара. */
        if (src === путь) return;
        L.load(путь, function (t2) {
          t2.colorSpace = T.SRGBColorSpace || t2.colorSpace;
          t2.anisotropy = АНИЗО;
          mat_поставить(мат, t2);
        }, null, function () {});
      });
    return null;
  }
  function mat_поставить(мат, t) {
    if (!мат) return;
    мат.map = t;
    if (мат.emissive && мат.emissiveIntensity) мат.emissiveMap = t;
    /* Цвет НЕ сбрасываем в белый, а домножаем на него карту.

       Здесь стоял setRGB(1,1,1), и подкраска тела пропадала в тот
       миг, когда доезжал снимок. У Марса это било сильнее всего:
       карта Viking серая по построению (замер среднего даёт 123/97/96
       при почти одинаковом разбросе по каналам), и рыжая планета
       выходила чёрно-белой.

       Но и оставлять оттенок как есть нельзя: он подбирался как
       самостоятельный цвет тела, а не как множитель, и снимок под
       ним потемнел бы вдвое. Осветляем его к белому на три четверти:
       от карты остаётся её яркость, от оттенка - лёгкий тон. */
    if (мат.color) {
      мат.color.setRGB(
        мат.color.r + (1 - мат.color.r) * 0.75,
        мат.color.g + (1 - мат.color.g) * 0.75,
        мат.color.b + (1 - мат.color.b) * 0.75
      );
    }
    мат.needsUpdate = true;
    /* Рельеф из самой карты.

       У планет не было ни карты нормалей, ни карты высот: свет падал
       на идеально гладкий шар, и на терминаторе, где тени и должны
       выдавать рельеф, не происходило ничего. Это и есть главный
       признак крашеного шара, о котором говорил заказчик.

       Отдельного файла рельефа у нас нет и качать его не на что, но
       он и не нужен: у каменных тел яркость снимка почти повторяет
       высоту - светлое это освещённые склоны и выбросы, тёмное это
       дно кратеров и низины. Берём производную яркости оператором
       Собеля и получаем честную карту нормалей из того, что уже
       загружено, без единого лишнего байта. */
      try { рельефИзКарты(мат, t); } catch (eР) {}
  }
  /* Карта нормалей из карты цвета. Считается один раз на тело, на
     уменьшенной копии: рельеф это низкая частота, полное разрешение
     тут только тратит время. */
  function рельефИзКарты(мат, t) {
    if (!t || !t.image || мат.normalMap || мат.__безРельефа) return;
    var им = t.image;
    var ш = им.width || им.naturalWidth, в = им.height || им.naturalHeight;
    if (!ш || !в) return;
    var W = Math.min(1024, ш), H = Math.max(2, Math.round(W * в / ш));
    var c = doc.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(им, 0, 0, W, H);
    var д;
    try { д = x.getImageData(0, 0, W, H); } catch (e) { return; }
    var п = д.data;
    var я = new Float32Array(W * H);
    for (var i = 0, j = 0; i < п.length; i += 4, j++) {
      я[j] = (п[i] * 0.299 + п[i + 1] * 0.587 + п[i + 2] * 0.114) / 255;
    }
    var out = x.createImageData(W, H);
    var о = out.data;
    /* Сила рельефа: у газовых гигантов полосы это не горы, им
       достаточно намёка, у каменных тел рельеф настоящий. */
    var сила = мат.__рельефСила || 2.6;
    for (var y = 0; y < H; y++) {
      var y0 = y > 0 ? y - 1 : y, y1 = y < H - 1 ? y + 1 : y;
      for (var xx = 0; xx < W; xx++) {
        var x0 = xx > 0 ? xx - 1 : W - 1, x1 = xx < W - 1 ? xx + 1 : 0;
        var л = я[y * W + x0], пр = я[y * W + x1];
        var вв = я[y0 * W + xx], нз = я[y1 * W + xx];
        var dx = (пр - л) * сила;
        var dy = (нз - вв) * сила;
        /* Нормаль в касательном пространстве: длину держим единичной,
           иначе освещение поедет по яркости. */
        var дл = Math.sqrt(dx * dx + dy * dy + 1);
        var к = (y * W + xx) * 4;
        о[к] = Math.round((-dx / дл * 0.5 + 0.5) * 255);
        о[к + 1] = Math.round((dy / дл * 0.5 + 0.5) * 255);
        о[к + 2] = Math.round((1 / дл * 0.5 + 0.5) * 255);
        о[к + 3] = 255;
      }
    }
    x.putImageData(out, 0, 0);
    var нт = new T.CanvasTexture(c);
    нт.wrapS = t.wrapS; нт.wrapT = t.wrapT;
    нт.anisotropy = АНИЗО;
    мат.normalMap = нт;
    мат.normalScale = new T.Vector2(мат.__нормМасштаб || 0.85, мат.__нормМасштаб || 0.85);
    мат.needsUpdate = true;
  }

  /* Небо: панорама Млечного Пути на дальней сфере + звёзды точками.
     Панорама даёт глубину и «дорогое» небо, точки - искры и
     параллакс, которого у панорамы нет. */
  var sky = new T.Mesh(
    new T.SphereGeometry(4200, 48, 28),
    new T.MeshBasicMaterial({ map: skyTexture(mob), side: T.BackSide, color: 0xd8e2ee })
  );
  scene.add(sky);

  /* Точка звезды: почти без размытия. Прежний мягкий ореол на
     шестидесяти четырёх пикселях и делал небо мутным. */
  var starDot = (function () {
    var sN = 32, c = doc.createElement("canvas");
    c.width = c.height = sN;
    var x = c.getContext("2d");
    var gr = x.createRadialGradient(sN / 2, sN / 2, 0, sN / 2, sN / 2, sN / 2);
    gr.addColorStop(0.00, "rgba(255,255,255,1)");
    gr.addColorStop(0.28, "rgba(255,255,255,.92)");
    gr.addColorStop(0.52, "rgba(255,255,255,.22)");
    gr.addColorStop(1.00, "rgba(255,255,255,0)");
    x.fillStyle = gr;
    x.fillRect(0, 0, sN, sN);
    return new T.CanvasTexture(c);
  })();
  /* Оболочки звёзд собраны в группу, и группа едет за камерой:
     прибитые к началу координат, они редели и растягивались на
     дальнем конце маршрута - у дыры небо стояло полупустым */
  var starShell = new T.Group();
  scene.add(starShell);
  этап("небо");
  /* ── Звёздное небо ───────────────────────────────────────────
     Заказчик про космос сказал дважды и одинаково: «просто белые
     точки на чёрном фоне, вообще нету реализма красоты и глубины».

     Так и было устроено: четыре слоя Points, и внутри слоя ВСЕ звёзды
     одного размера и одного цвета. Настоящее небо устроено ровно
     наоборот, и различий там три.

     Первое - величина. Ярких звёзд единицы, слабых тысячи, и закон
     этот степенной, а не равномерный. Второе - цвет. Белых звёзд на
     небе почти нет: есть голубоватые горячие, белые, желтоватые,
     оранжевые и красные, и доли у них известны. Третье - как звезда
     ложится на матрицу. Это не диск и не пятно, а острое ядро с
     тонким ореолом, а у самых ярких ещё и крест лучей от оправы
     объектива.

     Всё три теперь есть, и всё три считает шейдер, поэтому поле одно
     вместо четырёх: и честнее, и дешевле.

     Подкраска вселенных сохранена. Каждая вселенная задаёт три цвета,
     и они ложатся на три группы по температуре, а не заливают небо
     одним тоном.

     Второй заход по той же жалобе («звёзды должны иметь свечение,
     весь космос иметь глубину, объём») добавил к этому ещё четыре
     вещи, и все четыре - бесплатные, потому что считаются один раз
     при сборке или одной строчкой в вершинном шейдере.

     Расстояние. Прежде звезда получала видимую яркость напрямую, а
     на каком расстоянии она стоит, не значило ничего: слой был почти
     плоским, и все звёзды в нём были одинаково далеко. Теперь у
     звезды есть СВЕТИМОСТЬ и есть расстояние, а видимая яркость
     считается по закону обратных квадратов. Слой стал вдвое толще,
     поэтому у неба появилась глубина и в яркости, и в размере точки:
     дальняя звезда той же светимости и тусклее, и мельче.

     Параллакс внутри поля. Оболочка едет за камерой на поводке, и
     раньше все звёзды ехали вместе, то есть друг относительно друга
     стояли намертво. Теперь у каждой звезды свой множитель отставания,
     обратный расстоянию: ближние отстают заметно, дальние почти нет.
     Глаз читает это как объём, а поле при этом не редеет, потому что
     отставание ограничено сотнями единиц при радиусе в тысячи.

     Цвет по Планку. Шесть заданных руками троек RGB заменены честной
     кривой чёрного тела: у класса берётся его настоящий диапазон
     температур, а цвет считается по приближению планковского локуса.
     Разница видна на K и M: они перестали быть «розоватыми» и стали
     оранжевыми, какими их и видит глаз.

     Мерцание. Одна синусоида на 2.1 - это качание, а не мерцание.
     Настоящая сцинтилляция идёт на двух временах сразу, быстрым
     дрожанием поверх медленного. И главное: мерцание теперь меняет
     только ЯРКОСТЬ. Раньше оно множило и размер точки, то есть
     звезда на глазах раздувалась и опадала - ровно тот «детский»
     приём, который убрали с фона сайта в rc-space.js. */
  var starScale = tiny ? 0.43 : (particleBudget ? 0.55 : (qualityHint ? 0.72 : 1));
  var starMats = (function () {
    var n = Math.round(17000 * starScale);
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(n * 3);
    var aMag = new Float32Array(n);
    var aCol = new Float32Array(n * 3);
    var aGrp = new Float32Array(n);
    var aPh = new Float32Array(n);
    var aPar = new Float32Array(n);
    /* Шкала цвета и доли спектральных классов лежат на уровне файла:
       по ним же красятся панорама неба и звёзды спиральных галактик.
       Копия, стоявшая здесь, ровно этим и была плоха - звезда одной
       температуры выходила в точках одного цвета, а в панораме
       другого, потому что там цвета подбирали руками. */
    var планк = планкТон;
    var КЛАССЫ = КЛАССЫ_НЕБА;
    /* Ближняя и дальняя стенки слоя. Отношение почти два с
       половиной: по обратным квадратам это шесть раз по яркости -
       столько глубины глаз уже читает. */
    var БЛИЖЕ = 1350, ДАЛЬШЕ = 3200;
    var сид = 4021977;
    function сл() {
      сид ^= сид << 13; сид >>>= 0;
      сид ^= сид >>> 17;
      сид ^= сид << 5;  сид >>>= 0;
      return сид / 4294967296;
    }
    for (var i = 0; i < n; i++) {
      /* Ровное распределение по сфере: через косинус широты, иначе
         звёзды сбиваются к полюсам сферы и это видно. */
      var z = сл() * 2 - 1;
      var r = Math.sqrt(Math.max(0, 1 - z * z));
      var a = сл() * 6.283185;
      /* Расстояние: степень меньше единицы гонит больше звёзд к
         дальней стенке. Так и в жизни - объёма на дальнем радиусе
         больше, и звёзд там больше. */
      var d = БЛИЖЕ + (ДАЛЬШЕ - БЛИЖЕ) * Math.pow(сл(), 0.62);
      pos[i * 3] = Math.cos(a) * r * d;
      pos[i * 3 + 1] = z * d;
      pos[i * 3 + 2] = Math.sin(a) * r * d;
      /* Светимость по степенному закону: ярких единицы. Видимая
         яркость из неё же, но по закону обратных квадратов - вот
         откуда у слоя берётся глубина. */
      var сила = Math.pow(сл(), 3.1);
      /* Полоса Млечного Пути гуще: звезда рядом с плоскостью диска
         получает прибавку и чаще попадает в заметные. Прибавка идёт
         в СВЕТИМОСТЬ, а не в готовую величину: прежняя добавка к
         величине сбивала в кучу у верхнего края каждую десятую
         звезду неба, и «самых ярких» становились тысячи. */
      var широта = Math.abs(z);
      if (широта < 0.22 && сл() < 0.5) сила *= 1.5 + сл() * 1.2;
      var спад = (БЛИЖЕ / d) * (БЛИЖЕ / d);
      /* Мягкое насыщение вместо обрезки по единице. Обрезка сбивает
         все пересветы ровно в 1.0, и «самая яркая звезда неба»
         становится не одной, а сотнями одинаковых. */
      var m = 1 - Math.exp(-сила * спад * 3.4);
      aMag[i] = m;
      /* Отставание от камеры обратно расстоянию: ближняя звезда
         сдвигается заметно, дальняя почти стоит. Множитель мал
         нарочно - честный параллакс на таких дистанциях пронёс бы
         половину неба мимо борта за один перегон. */
      aPar[i] = 0.24 * (БЛИЖЕ / d - БЛИЖЕ / ДАЛЬШЕ) / (1 - БЛИЖЕ / ДАЛЬШЕ);
      var t = сл(), сум = 0, кл = КЛАССЫ[0];
      for (var ки = 0; ки < КЛАССЫ.length; ки++) {
        сум += КЛАССЫ[ки][0];
        if (t <= сум) { кл = КЛАССЫ[ки]; break; }
      }
      var тон = планк(кл[1] + (кл[2] - кл[1]) * сл());
      /* Слабые звёзды глаз видит обесцвеченными: на пороге
         чувствительности цвет пропадает первым. */
      var нас = 0.35 + m * 0.65;
      aCol[i * 3] = 1 + (тон[0] - 1) * нас;
      aCol[i * 3 + 1] = 1 + (тон[1] - 1) * нас;
      aCol[i * 3 + 2] = 1 + (тон[2] - 1) * нас;
      aGrp[i] = кл[3];
      aPh[i] = сл() * 6.283185;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("aMag", new T.BufferAttribute(aMag, 1));
    geo.setAttribute("aCol", new T.BufferAttribute(aCol, 3));
    geo.setAttribute("aGrp", new T.BufferAttribute(aGrp, 1));
    geo.setAttribute("aPh", new T.BufferAttribute(aPh, 1));
    geo.setAttribute("aPar", new T.BufferAttribute(aPar, 1));

    var уни = {
      uT: { value: 0 },
      /* Плотность берём У РЕНДЕРЕРА, а не у экрана. Буфер рисуется с
         поджатой плотностью (на телефоне до 1.2), и звезда, посчитанная
         по экранным 3, выходила втрое крупнее задуманного - снова
         пятно вместо точки. */
      uPx: { value: Math.min(2, (r && r.getPixelRatio ? r.getPixelRatio() : (g.devicePixelRatio || 1))) },
      /* Отставание оболочки от камеры, обрезанное по длине. Каждая
         звезда берёт от него свою долю через aPar - отсюда параллакс
         ВНУТРИ поля. Обрезка обязательна: маршрут уходит на тысячи
         единиц от начала координат, а без потолка ближние звёзды
         улетели бы за спину. */
      uPar: { value: new T.Vector3(0, 0, 0) },
      uTint0: { value: new T.Color(0xcfe9f5) },
      uTint1: { value: new T.Color(0xffffff) },
      uTint2: { value: new T.Color(0xffe9c9) }
    };
    var мат = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: уни,
      vertexShader: [
        "attribute float aMag;",
        "attribute vec3 aCol;",
        "attribute float aGrp;",
        "attribute float aPh;",
        "attribute float aPar;",
        "uniform float uT;",
        "uniform float uPx;",
        "uniform vec3 uPar;",
        "uniform vec3 uTint0;",
        "uniform vec3 uTint1;",
        "uniform vec3 uTint2;",
        "varying vec3 vCol;",
        "varying float vMag;",
        "varying float vTop;",
        "void main() {",
        /* Параллакс внутри поля: ближняя звезда отстаёт от камеры
           сильнее дальней. Одна строчка на вершину, и небо перестаёт
           быть жёсткой сферой вокруг головы. */
        "  vec3 sp = position + uPar * aPar;",
        "  vec4 mv = modelViewMatrix * vec4(sp, 1.0);",
        "  gl_Position = projectionMatrix * mv;",
        /* Мерцание на двух временах: медленное качание и быстрое
           дрожание поверх него. Одна синусоида читается заводным
           маятником, две - живой сцинтилляцией.

           Оно множит только ЯРКОСТЬ. Раньше тот же множитель шёл и
           в размер точки, то есть звезда пульсировала в объёме -
           именно этот приём убрали с фона сайта как «детский». */
        "  float tw = 1.0 + (sin(uT * 2.3 + aPh) * 0.62 +",
        "                    sin(uT * 6.7 + aPh * 2.7) * 0.38) * 0.14 * aMag;",
        /* Размер точки идёт от величины. Потолок держим жёстко:
           звезда крупнее нескольких пикселей уже не звезда, а пятно.
           Исключение - те доли процента, у которых есть крест лучей:
           им нужна площадка, иначе крест некуда рисовать. */
        "  vTop = smoothstep(0.88, 0.97, aMag);",
        "  float px = (0.7 + pow(aMag, 2.1) * 2.3 + vTop * 2.3) * uPx;",
        "  gl_PointSize = clamp(px, 0.7, 5.3 * uPx);",
        "  vec3 tint = aGrp < 0.5 ? uTint0 : (aGrp < 1.5 ? uTint1 : uTint2);",
        "  vCol = aCol * tint;",
        "  vMag = aMag * tw;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "precision mediump float;",
        "varying vec3 vCol;",
        "varying float vMag;",
        "varying float vTop;",
        "void main() {",
        "  vec2 p = gl_PointCoord * 2.0 - 1.0;",
        "  float d = length(p);",
        "  if (d > 1.0) discard;",
        /* Ядро острое, ореол широкий и слабый: так свет звезды и
           ложится на матрицу. Один гауссов колокол давал мягкое
           пятно, поэтому их два с разной шириной. */
        /* ВНИМАНИЕ: имена внутри шейдера только латиницей. Кириллица
           здесь уже ломала сборку однажды: GLSL её не принимает, а
           падает молча - экран просто чёрный. */
        "  float core = exp(-d * d * 34.0);",
        "  float halo = exp(-d * d * 7.0) * 0.13;",
        /* Крест лучей от оправы объектива. Он есть только у самых
           ярких: у слабых его нет и в жизни. Порог поднят - прежний
           рисовал крест каждой восьмой звезде неба, и небо выходило
           колючим, как ёлочная гирлянда. Теперь их доли процента:
           три-четыре десятка на всё небо, как на настоящем снимке. */
        "  float ray = 0.0;",
        "  if (vTop > 0.0) {",
        "    float hx = exp(-abs(p.y) * 24.0) * exp(-abs(p.x) * 1.4);",
        "    float vy = exp(-abs(p.x) * 24.0) * exp(-abs(p.y) * 1.4);",
        "    ray = (hx + vy) * 0.26 * vTop;",
        "  }",
        "  float a = (core + halo + ray) * (0.16 + vMag * 0.92);",
        /* Порог отбрасывания поднят с 0.004 до 0.009. Одна ступень
           восьмибитной яркости это 0.0039, и всё, что ниже двух
           ступеней, на чёрном небе не видно вовсе, а фрагмент стоит
           столько же, сколько видимый. У слабых звёзд под порог
           уходит вся кайма пятна, и заливка поля падает. */
        "  if (a < 0.009) discard;",
        /* Ядро самых ярких выбелено: перегруженный пиксель матрицы
           теряет цвет и уходит в белый. */
        "  vec3 col = mix(vCol, vec3(1.0), core * vMag * 0.7);",
        "  gl_FragColor = vec4(col, a);",
        "}"
      ].join("\n")
    });
    var поле = new T.Points(geo, мат);
    поле.frustumCulled = false;
    starShell.add(поле);
    /* Наружу отдаём три «материала» с ключом color: смена вселенной
       красит небо через них, и тот код менять не пришлось. */
    function ручка(им) {
      return { color: уни[им].value, material: мат };
    }
    var р = [ручка("uTint0"), ручка("uTint1"), ручка("uTint2")];
    р.поле = поле;
    р.уни = уни;
    return р;
  })();

  /* Солнце: далёкий слепящий блик, как на съёмке с орбиты */
  var sunGlow = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(256, "rgba(255,246,225,1)", "rgba(255,190,110,0)"),
    transparent: true, opacity: 0.62, depthWrite: false, blending: T.AdditiveBlending
  }));
  sunGlow.position.copy(СОЛНЦЕ);
  /* Блик поджат с 900 до 430. Он задуман как слепящее пятно с
     дальнего расстояния, но стоит в одной точке с диском и с двумя
     слоями короны: вблизи все три складывались в молочный шар шире
     кадра, и сама звезда в нём тонула. Диаметр диска 380, значит
     блик радиусом 430 - это ореол чуть шире звезды, а не туман на
     полкадра. Издали его добирает свечение плёнки. */
  sunGlow.scale.setScalar(430);
  scene.add(sunGlow);

  этап("туманности");
  /* ── Volumetric nebulae ────────────────────────────────
     The previous four Sprite objects always faced the camera, so a
     turn exposed them as flat translucent stains. These clouds are
     curved 3D filaments made from many restrained particles. Their
     points keep world coordinates and cross one another under camera
     translation; fixed screen size prevents a near particle becoming
     a soft white disc on mobile. */
  var nebT = glowSprite(256, "rgba(66,178,220,.32)", "rgba(66,178,220,0)");
  var nebV = glowSprite(256, "rgba(138,89,246,.28)", "rgba(138,89,246,0)");
  /* Each row is a physical centre and volume radius, not a billboard
     scale. The clouds remain separated from the flight corridor. */
  var nebs = [[-1400, 500, -2400, 1300, nebT], [1900, -300, -1500, 1050, nebV], [600, 800, 2200, 1200, nebT], [-2100, -600, 1400, 950, nebV]];
  var nebSprites = [];
  var seedN = 63017;
  function rndN() { seedN = (seedN * 1664525 + 1013904223) >>> 0; return seedN / 4294967296; }
  /* Облако из точек ОДИНАКОВОЙ яркости - это ровная дымка, и глаз
     читает её пеленой, а не телом. У настоящей туманности яркость
     скачет на порядок: есть светлые узлы, где газ плотный, и есть
     провалы, где его выдуло звёздным ветром. Раздаём яркость по
     вершинам - оттенок остаётся за материалом, поэтому подкраска
     вселенной работает по-прежнему, а стоит это ровно ноль:
     цвет вершины идёт тем же потоком, что и её место. */
  for (var i = 0; i < nebs.length; i++) {
    var nNeb = tiny ? 90 : (particleBudget ? 145 : 250);
    var ng = new T.BufferGeometry(), np = new Float32Array(nNeb * 3);
    var nc = new Float32Array(nNeb * 3);
    var radN = nebs[i][3], phaseN = i * 1.73;
    for (var ni = 0; ni < nNeb; ni++) {
      var uN = rndN() * 2 - 1;
      var spineX = uN * radN * .48;
      var spineY = Math.sin(uN * 3.2 + phaseN) * radN * .12;
      var spineZ = Math.cos(uN * 2.45 - phaseN) * radN * .16;
      var widthN = radN * (.045 + Math.abs(uN) * .055);
      var ga = rndN() + rndN() + rndN() - 1.5;
      var gb = rndN() + rndN() + rndN() - 1.5;
      var gc = rndN() + rndN() + rndN() - 1.5;
      np[ni * 3] = spineX + ga * widthN;
      np[ni * 3 + 1] = spineY + gb * widthN * .72;
      np[ni * 3 + 2] = spineZ + gc * widthN;
      /* Три источника разброса сразу, и все три про физику.
         Ближе к оси - плотнее газ; узлы вдоль оси - сгустки; и
         степенной хвост поверх, потому что светимость газа идёт
         по плотности не линейно. */
      var кОси = Math.sqrt(ga * ga + gb * gb + gc * gc) / 1.6;
      var ядро = Math.exp(-кОси * кОси * 0.9);
      var узел = .55 + .45 * Math.sin(uN * 9.1 + phaseN * 2.3) * Math.sin(uN * 3.7 - phaseN);
      /* Множитель 1.9 держит СРЕДНЮЮ яркость облака на прежнем
         уровне: три множителя выше в среднем дают около 0.41, и без
         поправки туманности просто потускнели бы втрое, а задача
         была не потушить их, а разложить по узлам и провалам. */
      var я = Math.min(2.6, (.16 + ядро * .84) * узел *
                            (.45 + Math.pow(rndN(), 1.8) * 1.35) * 1.9);
      nc[ni * 3] = я; nc[ni * 3 + 1] = я; nc[ni * 3 + 2] = я;
    }
    ng.setAttribute("position", new T.BufferAttribute(np, 3));
    ng.setAttribute("color", new T.BufferAttribute(nc, 3));
    var cloud = new T.Points(ng, new T.PointsMaterial({
      map: nebs[i][4], color: i % 2 ? 0x8a59f6 : 0x42b2dc, vertexColors: true,
      /* Туманности поджаты вдвое. Заказчик назвал космос мутным, и
         эти четыре облака и были мутью: тысяча мягких пятен по семь
         пикселей, сложенных по яркости, застилали половину неба
         синеватой дымкой. В жизни туманность с такого расстояния
         глазом почти не видна - она различима на длинной выдержке,
         а не как пелена поверх звёзд. Оставляем намёк на объём. */
      /* Пятно поджато ещё немного. Узлы и провалы теперь несёт
         яркость вершины, и держать прежний размер незачем: он был
         подобран, когда все точки светили одинаково и облако
         вытягивало объём только количеством пикселей. Заливка
         туманностей падает на четверть, а видно их не хуже. */
      size: tiny ? 3.6 : 4.4, sizeAttenuation: false,
      transparent: true, opacity: .042, depthWrite: false,
      blending: T.AdditiveBlending
    }));
    cloud.position.set(nebs[i][0], nebs[i][1], nebs[i][2]);
    cloud.rotation.set((i - 1.5) * .18, i * .43, (i % 2 ? -.24 : .21));
    scene.add(cloud);
    nebSprites.push(cloud);
  }

  этап("Земля");
  /* ── Земля ── */
  var earth = new T.Group();
  var eBody = new T.Mesh(
    new T.SphereGeometry(60, tiny ? 48 : 64, tiny ? 36 : 48),
    (function () {
      /* Земля переехала с Phong на Standard, и вместе с этим
         починилась ночная сторона.

         Огни городов лежали в карте свечения с постоянной силой,
         то есть горели и там, где сейчас полдень. На кадре это
         читалось как мутная плёнка поверх океанов, а ночной
         стороны не было вовсе: планета выглядела школьным
         глобусом. На всех девяти референсах заказчика Земля
         показана ровно наоборот - тёмный шар с золотой сеткой
         огней по побережьям и тонкий голубой ободок атмосферы.

         Чиним по-честному: подмешиваем в шейдер множитель по
         углу между нормалью и направлением на солнце. Где солнце
         светит - огней нет, на терминаторе они разгораются,
         на ночной стороне горят в полную силу. Плюс вода теперь
         бликует, а суша нет: шероховатость берём из той же
         дневной карты, где океан тёмный.

         Карты в webp: те же снимки весят на полтора мегабайта
         меньше, и вход в игру на телефоне не ждёт загрузку двух
         мегабайт текстур. */
      var dayMap = tex("assets/space/earth-day.webp");
      var m = new T.MeshStandardMaterial({
        map: dayMap,
        roughnessMap: dayMap,
        roughness: 1.0,
        metalness: 0.0,
        /* Карта огней - маска яркости, цвет ей даёт emissive. Прежняя
           была браком: ярчайшая её точка тянула на 134 из 255 и была
           серой, огней городов в ней не было почти совсем, зато весь
           океан был залит ровным синим. Этот синий, умноженный на
           золото свечения, и красил воду в зелёный - планета выходила
           не Землёй, а болотом.

           Теперь карта собрана из ночного снимка NASA VIIRS DNB
           (dnb_land_ocean_ice.2012.3600x1800, общественное достояние):
           вычтен синий пол океана, погашены полярные шапки (белое там
           лунный свет на льду, не огни), кривой оставлены города и
           намёк на материки. Океан в ней чёрный по-настоящему.

           Сила свечения снижена с 2.35: прежняя карта нигде не
           доходила до полной яркости, и множитель добирал её силой.
           У честной карты города дают единицу сами. */
        emissiveMap: tex("assets/space/earth-night.webp"),
        emissive: new T.Color(0xffc978),
        emissiveIntensity: 1.7,
        /* Окружение планету почти не трогает. Панорама сцены яркая и
           светит со всех сторон разом: с полной силой она поднимала
           теневую половину до уровня освещённой, и Земля выходила
           дневной в любом положении корабля - сколько ни двигай
           светило. Форму шара должно задавать одно солнце, как в
           жизни, а окружение оставим металлу корабля.

           Ноль, а не пять сотых. На кромке диска висел мягкий белый
           КВАДРАТ - приёмка сперва приняла его за сломанный спрайт.
           Это отражение: океан гладкий (шероховатость 0.18), он
           отражал панораму окружения, а на такой гладкости панорама
           берётся с грубого уровня мип-карты - один яркий тексель
           солнца и разворачивался в квадрат. Проверено поворотом:
           пятно почти не ехало вместе с поверхностью, значит
           отражение, а не текстура. Пять сотых картине не давали
           ничего, квадрат давали. Блик от самого светила остаётся,
           он и должен быть единственным. */
        envMapIntensity: 0.0
      });
      m.onBeforeCompile = function (sh) {
        sh.uniforms.uSunDir = { value: new T.Vector3(0.82, 0.28, 0.50).normalize() };
        m.userData.sh = sh;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vSunN;")
          .replace("#include <begin_vertex>",
            "#include <begin_vertex>\nvSunN = normalize(mat3(modelMatrix) * normal);");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>",
            "#include <common>\nvarying vec3 vSunN;\nuniform vec3 uSunDir;")
          /* Океан гладкий, суша матовая: на дневной карте вода
             тёмная, поэтому яркость и есть шероховатость */
          .replace("#include <roughnessmap_fragment>",
            "#include <roughnessmap_fragment>\n" +
            "float landLum = dot(texture2D(roughnessMap, vRoughnessMapUv).rgb, vec3(0.299,0.587,0.114));\n" +
            /* Вода не зеркало. При 0.18 солнце собиралось в точку и
               било пересветом, у настоящего океана блик широкий и
               размазан рябью. 0.34 - и он растекается пятном, как на
               снимках с МКС. */
            "roughnessFactor = mix(0.34, 0.92, smoothstep(0.10, 0.42, landLum));")
          /* Огни городов только там, где ночь */
          /* Огни городов только там, где ночь.

             Границы у smoothstep идут по возрастанию, а результат
             инвертируется отдельно. Обратный порядок (0.14, -0.22)
             спецификация оставляет неопределённым: на одних
             драйверах он давал ноль, на других единицу, и ночная
             сторона то не зажигалась вовсе, то светила по всему
             шару. */
          /* Дневная карта гаснет там, где ночь.

             Одного направленного света мало: общий рассеянный свет
             сцены поднимает теневую половину, и материки видны там,
             где у планеты глубокая ночь. В жизни ночная сторона не
             освещена ничем, кроме собственных огней, поэтому гасим
             сам цвет поверхности по тому же углу, по которому
             зажигаются города. Терминатор при этом остаётся мягким,
             а не режет шар пополам линейкой. */
          .replace("#include <map_fragment>",
            "#include <map_fragment>\n" +
            "float sunN = dot(normalize(vSunN), uSunDir);\n" +
            "diffuseColor.rgb *= mix(0.045, 1.0, smoothstep(-0.30, 0.16, sunN));")
          .replace("#include <emissivemap_fragment>",
            "#include <emissivemap_fragment>\n" +
            "float sunDot = dot(normalize(vSunN), uSunDir);\n" +
            "totalEmissiveRadiance *= 1.0 - smoothstep(-0.22, 0.14, sunDot);");
      };
      return m;
    })()
  );
  earth.add(eBody);
  /* Атмосфера: подсвеченный ободок изнутри наружу */
  var atmMat = new T.ShaderMaterial({
      transparent: true, side: T.BackSide, depthWrite: false,
      /* У Земли рассеяние заметнее всего: плотная атмосфера, и на
         терминаторе идёт настоящий закатный поясок. Считаем так же,
         как у прочих планет, только ярче. */
      blending: T.AdditiveBlending,
      uniforms: { uSun: { value: new T.Vector3(1, 0.35, 0.6).normalize() } },
      vertexShader:
        "varying vec3 vN; varying vec3 vW;" +
        "void main(){ vN = normalize(normalMatrix * normal);" +
        "  vW = normalize(mat3(modelMatrix) * normal);" +
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
        "varying vec3 vN; varying vec3 vW; uniform vec3 uSun;" +
        "void main(){" +
        /* Ободок стал ДЫМКОЙ, а не обводкой. Прежняя степень 3.2
           собирала свет в узкое кольцо, и на тёмном шаре оно читалось
           нарисованным контуром - владелец так и сказал: «с какой-то
           обводкой». Показатель ниже, порог шире: свет размазывается
           от кромки внутрь, как настоящая атмосфера на просвет.

           И гасим дымку на ночной стороне вчетверо сильнее прежнего.
           Кольцо было видно даже там, где солнца нет вовсе, - а
           рассеивать нечего, если нечего рассеивать. */
        /* Оболочка рисуется ЗАДНЕЙ стороной, поэтому в кадр попадает
           только колечко за силуэтом шара. У самой внешней кромки
           оболочки нормаль смотрит вбок (произведение уходит в ноль),
           у внутренней - ОТ нас (сторона-то задняя). Значит яркость
           ведём по произведению без переворота знака: у самой внешней
           кромки оно ноль, к поверхности растёт. Густо у шара, в ноль
           к внешнему краю - как и ведёт себя воздух на просвет.

           Знак здесь легко перепутать, я перепутала: с переворотом
           дымка гасилась в ноль по всей оболочке и пропадала вовсе.
           А прежняя запись через порог 0.86 делала ровную полосу с
           обрубленным наружным краем - ту самую обводку. */
        "  float edge = clamp(dot(vN, vec3(0.0,0.0,-1.0)), 0.0, 1.0);" +
        "  float rim = pow(edge, 1.35);" +
        "  float lit = clamp(dot(vW, uSun) * 0.5 + 0.5, 0.0, 1.0);" +
        "  float term = pow(1.0 - abs(dot(vW, uSun)), 7.0);" +
        "  vec3 col = mix(vec3(0.10,0.26,0.52), vec3(0.34,0.66,1.0), lit);" +
        "  col = mix(col, vec3(1.0,0.60,0.34), term * 0.7);" +
        /* Плотнее прежнего: с широкой оболочкой и правильным ходом
           света кромке уже не грозит стать полосой, а голубая дымка
           по краю - то, по чему Землю и узнают с орбиты. */
        "  gl_FragColor = vec4(col, rim * 1.35 * (0.05 + lit * 0.95));" +
        "}"
    });
  /* Ободок атмосферы отдельным материалом: его направление на
     солнце обновляется каждый кадр вместе с ночной стороной, иначе
     закатный поясок стоит на месте, пока планета поворачивается. */
  /* Оболочка шире: было 61.9 при шаре 60, то есть кольцо в три
     сотых радиуса. Такая полоска и читалась ОБВОДКОЙ - у неё просто
     не было места, чтобы растаять. Теперь 67.5, и свету есть куда
     сойти на нет. */
  var atm = new T.Mesh(new T.SphereGeometry(67.5, 64, 44), atmMat);
  earth.add(atm);
  var clouds = new T.Mesh(
    new T.SphereGeometry(61.2, tiny ? 48 : 64, tiny ? 36 : 48),
    new T.MeshLambertMaterial({
      map: tex("assets/space/clouds.webp"),
      transparent: true, opacity: 0.55, depthWrite: false
    })
  );
  earth.add(clouds);
  scene.add(earth);

  /* ── Остальная Солнечная система ────────────────────────
     «Где 4 вселенные, почему в солнечной системе нету подлёта ко
     всем 8 планетам существующим плюс солнце?» - вопрос прямой и
     справедливый. Маршрут вёл мимо Земли, Луны, Марса и Сатурна, а
     остальные тела в мире попросту отсутствовали.

     Теперь система полная. Планеты стоят не по маршруту, а вокруг
     него - к каждой можно долететь вручную, и каждая читается
     собственным телом с высоты. Размеры сжаты относительно
     настоящих (иначе Юпитер занял бы полкадра там, где нужен
     Сатурн), но порядок сохранён: газовые гиганты крупно, каменные
     мелко.

     Все они процедурные - ни одного лишнего килобайта на загрузку. */
  var atmShells = [];
  var solarLive = [];

  этап("атмосфера");
  /* ── Ободок атмосферы ────────────────────────────────────────
     Один на все тела. Раньше он был вписан в makePlanet, и когда у
     Земли починили обводку, у соседей она осталась: правку пришлось
     бы повторять в каждом месте. Теперь место одно.

     Про саму обводку. Оболочка рисуется ЗАДНЕЙ стороной, значит в
     кадр попадает только колечко за силуэтом тела. Прежняя запись
     через порог 0.72 давала ровную полосу с обрубленным наружным
     краем - глаз читал её нарисованным контуром, владелец так и
     сказал: «с какой-то обводкой». Оболочку раздвигаем (было 1.075
     радиуса, стало 1.12: свету нужно место, чтобы сойти на нет), а
     яркость ведём по произведению нормали на взгляд без переворота
     знака - у внешней кромки ноль, к поверхности гуще. */
  function атмосфера(r, цвет, тепло) {
    return new T.Mesh(
      new T.SphereGeometry(r * 1.12, tiny ? 26 : 44, tiny ? 18 : 30),
      new T.ShaderMaterial({
        transparent: true, side: T.BackSide, depthWrite: false,
        blending: T.AdditiveBlending,
        uniforms: {
          uC: { value: new T.Color(цвет) },
          uWarm: { value: new T.Color(тепло || 0xffb37a) },
          uSun: { value: new T.Vector3(1, 0.35, 0.6).normalize() }
        },
        vertexShader:
          "varying vec3 vN; varying vec3 vW;" +
          "void main(){ vN = normalize(normalMatrix * normal);" +
          "  vW = normalize(mat3(modelMatrix) * normal);" +
          "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "varying vec3 vN; varying vec3 vW; uniform vec3 uC; uniform vec3 uWarm; uniform vec3 uSun;" +
          "void main(){" +
          "  float edge = clamp(dot(vN, vec3(0.0,0.0,-1.0)), 0.0, 1.0);" +
          "  float rim = pow(edge, 1.35);" +
          "  float lit = clamp(dot(vW, uSun) * 0.5 + 0.5, 0.0, 1.0);" +
          /* Терминатор: узкая полоса на границе света и тени */
          "  float term = pow(1.0 - abs(dot(vW, uSun)), 8.0);" +
          "  vec3 col = mix(uC * 0.35, uC, lit);" +
          "  col = mix(col, uWarm, term * 0.65);" +
          "  gl_FragColor = vec4(col, rim * 1.15 * (0.05 + lit * 0.95));" +
          "}"
      })
    );
  }
  function makePlanet(r, pos, base, bands, noise, opt) {
    opt = opt || {};
    /* ── Настоящий снимок вместо рисунка ───────────────────────
       Землю в окне узнают сразу, а соседние планеты выглядели
       нарисованными - и не потому, что рисовали плохо. У Земли лежат
       настоящие карты со снимков, у остальных карта считалась кодом.
       Владелец сказал прямо: «всё в космосе так же реалистично
       сделай, как в жизни».

       Если для тела есть снимок, строим его как Землю: карта в
       diffuse, свет от одного светила, шероховатость поверхности - и
       никакого процедурного слоя. Нет снимка - всё идёт по-старому,
       ни одна планета не остаётся без тела. */
    if (opt.карта) {
      /* Цвет держим ВСЕГДА, даже когда есть снимок. Материал без
         картинки уходит в чёрный: приёмка поймала Сатурна угольным
         шаром, пока его карта ещё качалась. С цветом худшее, что
         может случиться, - планета своего оттенка вместо снимка, а
         не дыра в кадре. */
      var оттенок = new T.Color((base[Math.floor(base.length * 0.5)] || base[0])[1]);
      var мт = new T.MeshStandardMaterial({
        color: оттенок,
        map: null,
        roughness: opt.шерох == null ? 0.92 : opt.шерох,
        metalness: 0.0,
        /* Окружение сюда не пускаем по той же причине, что и у Земли:
           панорама светит со всех сторон и поднимает теневую половину
           до уровня освещённой - шар выходит плоским. */
        envMapIntensity: 0.0
      });
      if (opt.emis) {
        мт.emissiveMap = мт.map;
        мт.emissive = new T.Color(opt.emis);
        мт.emissiveIntensity = opt.emisI || 0.5;
      }
      картаТела(opt.карта, мт);
      var снимок = new T.Mesh(new T.SphereGeometry(r, tiny ? 36 : 64, tiny ? 24 : 44), мт);
      снимок.position.set(pos[0], pos[1], pos[2]);
      if (opt.наклон) снимок.rotation.z = opt.наклон;
      scene.add(снимок);
      if (opt.info) снимок.userData.info = opt.info;
      if (opt.atm) {
        var аш = атмосфера(r, opt.atm, opt.warm);
        снимок.add(аш);
        снимок.userData.atm = аш;
        atmShells.push({ mesh: аш, body: снимок });
      }
      return снимок;
    }
    /* Use the same procedural material system as the exoplanets for
       the home Solar System. Its colour, bump, specular, atmosphere
       and cloud maps are derived from one seeded 3D height field, so
       surface relief follows the terminator instead of looking like
       paint on a smooth ball. Low detail still means a 512px material
       set and independent cloud motion; it protects the first frame,
       not the realism or the game logic. */
    if (g.RC_PLANETS && g.RC_PLANETS.make) {
      try {
        var rcKind = opt.rcKind || opt.kind || "rocky";
        var midPal = base[Math.floor(base.length * .5)] || base[0];
        var tintHex = new T.Color(midPal[1]).getHex();
        var made = g.RC_PLANETS.make(rcKind, {
          radius: r, seed: (opt.seed || 1) * 977 + 41, tint: tintHex,
          rings: false, moons: 0, detail: "low",
          atmosphere: !!opt.atm,
          clouds: rcKind === "gas" || rcKind === "toxic"
        });
        made.group.position.set(pos[0], pos[1], pos[2]);
        made.group.userData.info = opt.info || "";
        made.group.userData.pick = made.body;
        made.group.userData.rcPlanet = made;
        if (made.body) made.body.userData.info = opt.info || "";
        scene.add(made.group);
        if (made.setSunPosition) made.setSunPosition(sunBody.position);
        solarLive.push(made);
        return made.group;
      } catch (ePlanet) {
        /* Keep the previous colour-map sphere as a safe fallback. */
      }
    }
    var body = new T.Mesh(
      new T.SphereGeometry(r, tiny ? 24 : 42, tiny ? 16 : 30),
      new T.MeshPhongMaterial({
        map: paintPlanet(tiny ? 512 : 1024, tiny ? 256 : 512, base, bands, noise, opt.kind, opt.seed),
        shininess: opt.shine || 6,
        emissive: new T.Color(opt.emis || 0x000000),
        emissiveIntensity: opt.emisI || 0
      })
    );
    body.position.set(pos[0], pos[1], pos[2]);
    scene.add(body);
    if (opt.info) body.userData.info = opt.info;
    if (opt.atm) {
      /* Атмосфера считается честно, а не ровным ободком по контуру.
         Две вещи делают её живой: рассеяние ярче там, куда падает
         свет (сторона, повёрнутая к звезде, светится сильнее), и
         тёплый подмес у терминатора - это тот самый красный поясок,
         по которому глаз узнаёт закат с орбиты. Направление на
         светило приходит извне, поэтому у каждой планеты ободок
         повёрнут в свою сторону, а не одинаково у всех. */
      var a = атмосфера(r, opt.atm, opt.warm);
      body.add(a);
      body.userData.atm = a;
      atmShells.push({ mesh: a, body: body });
    }
    return body;
  }

  /* Солнце телом, а не только бликом: до него можно дойти, и у него
     есть поверхность - кипящая, с пятнами и протуберанцами */
  этап("Солнце");
  /* ── Солнце ─────────────────────────────────────────────
     «Солнце вообще не реалистичное» - справедливо: шар, покрашенный
     градиентом, звездой не выглядит никогда. У настоящей звезды нет
     ни поверхности, ни края: есть кипящая гранулой фотосфера,
     потемнение к лимбу и корона, которая ярче самого диска у края.

     Всё три вещи собраны шейдером. Гранулы - шум, который медленно
     ползёт; потемнение к лимбу - честная зависимость от угла
     наблюдения; пятна - редкие тёмные провалы. Ни одной текстуры:
     звезда живая и не повторяется. */
  var sunBody = new T.Mesh(
    new T.SphereGeometry(190, tiny ? 36 : 56, tiny ? 26 : 40),
    new T.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uMap: { value: null }, uHas: { value: 0 } },
      vertexShader:
        "varying vec3 vN; varying vec3 vP;" +
        "void main(){ vN = normalize(normalMatrix * normal); vP = position;" +
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
        "varying vec3 vN; varying vec3 vP; uniform float uT;" +
        "uniform sampler2D uMap; uniform float uHas;" +
        /* Шум-основа: три октавы дают ячейки конвекции.

           Хэш БЕЗ синуса. На fract(sin(dot(...))) держалась вся
           грануляция, а он опирается на точность sin от больших
           аргументов, которой у видеокарт нет: вместо шума выходил
           правильный узор, и звезда читалась плоским пятном. Ровно на
           этом же сгорело зерно плёнки. */
        "float h(vec3 p){ vec3 q = fract(p * 0.1031);" +
        "  q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }" +
        "float n3(vec3 p){" +
        "  vec3 i = floor(p), f = fract(p);" +
        "  f = f*f*(3.0-2.0*f);" +
        "  float a = mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y)," +
        "                mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z);" +
        "  return a;" +
        "}" +
        "void main(){" +
        "  vec3 q = normalize(vP) * 7.0;" +
        "  float g = n3(q + vec3(0.0, uT * 0.06, 0.0)) * 0.55" +
        "          + n3(q * 2.7 - vec3(uT * 0.09)) * 0.3" +
        "          + n3(q * 6.1 + vec3(uT * 0.13)) * 0.15;" +
        /* Потемнение к лимбу: край диска у звезды всегда темнее */
        "  float mu = clamp(-dot(vN, vec3(0.0,0.0,-1.0)), 0.0, 1.0);" +
        "  float limb = 0.42 + 0.58 * pow(mu, 0.55);" +
        /* Пятна: редкие глубокие провалы яркости */
        "  float sp = smoothstep(0.74, 0.86, n3(q * 1.5 + vec3(11.0, uT * 0.02, 3.0)));" +
        "  float br = (0.72 + g * 0.75) * limb * (1.0 - sp * 0.55);" +
        "  vec3 hot = vec3(1.0, 0.97, 0.86);" +
        "  vec3 mid = vec3(1.0, 0.78, 0.36);" +
        "  vec3 cold = vec3(0.92, 0.44, 0.12);" +
        "  vec3 col = mix(cold, mid, clamp(br, 0.0, 1.0));" +
        "  col = mix(col, hot, clamp((br - 0.85) * 3.0, 0.0, 1.0));" +
        /* Настоящая фотосфера поверх счёта. Снимок даёт то, чего
           формулой не набрать: рисунок ячеек, факелы у пятен, живую
           неровность яркости. Шум остаётся - он двигает картинку,
           иначе звезда стоит мёртвой. Пока снимок не доехал, uHas
           равен нулю и всё работает по-старому. */
        "  if (uHas > 0.5) {" +
        "    vec3 d = normalize(vP);" +
        "    vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);" +
        "    vec3 ph = texture2D(uMap, uv).rgb;" +
        "    col = mix(col, ph * (0.70 + br * 0.85), 0.86);" +
        "  }" +
        "  gl_FragColor = vec4(col * (0.9 + br * 0.6) * limb, 1.0);" +
        "}"
    })
  );
  /* Снимок фотосферы кладём в шейдер по факту загрузки: пока его
     нет, звезда живёт на одном счёте и в кадре не чернеет. */
  (function () {
    var м = sunBody.material;
    /* Запасного sun.jpg на сервере нет и никогда не было: у Солнца,
       планет и колец лежит только webp, как и у всей остальной сцены.
       Ветка на jpg давала браузеру без webp честный 404 и Солнце без
       текстуры вместо запасной картинки. */
    L.load("assets/space/sun.webp", function (t) {
      t.colorSpace = T.SRGBColorSpace || t.colorSpace;
      t.wrapS = T.RepeatWrapping;
      t.anisotropy = АНИЗО;
      м.uniforms.uMap.value = t;
      м.uniforms.uHas.value = 1;
      м.needsUpdate = true;
    }, null, function () {});
  })();
  sunBody.position.copy(СОЛНЦЕ);
  sunBody.userData.info = RU ? "СОЛНЦЕ · 1,39 млн км · источник всей энергии системы"
                             : "SUN · 1.39M km wide";
  scene.add(sunBody);
  /* Корона: сложение поверх поверхности, чтобы край не был резаным */
  /* Корона в два слоя: плотный ободок у самой поверхности и
     широкое гало вокруг. Один слой давал ровный жёлтый круг, и
     звезда читалась плоской наклейкой. */
  /* Корона спрайтами со спадом к краю: сферы с равномерной
     прозрачностью рисовали вокруг звезды плоские жёлтые кольца -
     владелец справедливо назвал такое солнце нереалистичным.
     У настоящей короны яркость падает от лимба наружу. */
  var corIn = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(256, "rgba(255,236,190,.9)", "rgba(255,180,90,0)"),
    transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending
  }));
  /* Корона поджата. Диск звезды 190 радиуса, а ближнее гало стояло
     на 560 и дальнее на 1150 - вокруг Солнца горело пятно в шесть
     его поперечников, и диск в нём тонул. У настоящей звезды корона
     вне затмения почти не видна: у лимба тонкий ободок, дальше спад.
     Владелец сказал коротко: «солнце не похоже». */
  corIn.scale.setScalar(250);
  corIn.position.copy(sunBody.position);
  scene.add(corIn);
  var corOut = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(256, "rgba(255,190,110,.5)", "rgba(255,140,60,0)"),
    transparent: true, opacity: 0.34, depthWrite: false, blending: T.AdditiveBlending
  }));
  corOut.scale.setScalar(430);
  corOut.position.copy(sunBody.position);
  scene.add(corOut);

  var mercury = makePlanet(12, [470, 200, 690],
    [[0, "#c9b7a3"], [0.5, "#8e7d6d"], [1, "#5a4e44"]], 6, 700,
    { kind: "rocky", seed: 3, карта: "assets/space/mercury.webp", шерох: 0.96,
      info: RU ? "МЕРКУРИЙ · год длиннее суток · без атмосферы" : "MERCURY · no atmosphere" });
  var venus = makePlanet(28, [190, 110, 360],
    [[0, "#f9e9c2"], [0.45, "#e0bf7a"], [1, "#a87f46"]], 26, 60,
    { kind: "gas", rcKind: "toxic", seed: 8, atm: 0xf0d79a, warm: 0xffd9a0,
      карта: "assets/space/venus.webp", шерох: 0.88,
      info: RU ? "ВЕНЕРА · 460 градусов · сутки длиннее года" : "VENUS · 460 C" });
  var jupiter = makePlanet(122, [1130, -50, -1180],
    [[0, "#efdfc4"], [0.22, "#c99f6e"], [0.44, "#e8d3ae"], [0.62, "#a97648"], [0.8, "#e2c9a4"], [1, "#c9a276"]], 44, 40,
    { kind: "gas", seed: 17, atm: 0xe8cfa6, warm: 0xffc98a,
      карта: "assets/space/jupiter.webp", шерох: 0.90,
      info: RU ? "ЮПИТЕР · Большое красное пятно старше телескопа" : "JUPITER" });
  /* Большое красное пятно: узнаваемая примета, без неё Юпитер
     читается просто полосатым шаром */
  var spot = new T.Mesh(
    new T.SphereGeometry(118 * 0.99, 20, 16, 0.6, 0.55, 1.35, 0.34),
    new T.MeshPhongMaterial({ color: 0xd06a44, shininess: 4 })
  );
  var jSpin = jupiter.userData && jupiter.userData.rcPlanet && jupiter.userData.rcPlanet.spinGroup;
  (jSpin || jupiter).add(spot);
  var uranus = makePlanet(66, [1790, 390, -1430],
    [[0, "#dbf5f7"], [0.5, "#9fd8e0"], [1, "#74aebd"]], 22, 40,
    { kind: "ice", seed: 23, atm: 0x9fe0ee, warm: 0xbfe8f5,
      карта: "assets/space/uranus.webp", шерох: 0.86, наклон: 1.7,
      info: RU ? "УРАН · лежит на боку · ось наклонена на 98 градусов" : "URANUS" });
  uranus.rotation.z = 1.7;
  var neptune = makePlanet(62, [2090, 250, -1930],
    [[0, "#8fb4f6"], [0.5, "#3f68c4"], [1, "#22407f"]], 30, 40,
    { kind: "gas", seed: 31, atm: 0x6f9bf0, warm: 0x9fc0ff,
      карта: "assets/space/neptune.webp", шерох: 0.88,
      info: RU ? "НЕПТУН · ветер до 2100 км/ч · самый быстрый в системе" : "NEPTUNE" });

  /* Пояс астероидов между Марсом и Юпитером: облако мелких точек по
     дуге. Точками, а не телами - их тысячи, и каждая отдельным
     объектом стоила бы кадра. */
  var beltGeo = new T.BufferGeometry();
  var bn = tiny ? 900 : (particleBudget ? 1400 : 2600);
  var bp = new Float32Array(bn * 3);
  var bc = new Float32Array(bn * 3);
  /* Пояс из точек ОДНОГО цвета читается плоским кольцом пыли: у
     кольца нет ни ближней стороны, ни дальней. Даём каждой крупинке
     две вещи, и обе честные.

     Первая - тип. Настоящий пояс на три четверти углистый (почти
     чёрный, альбедо около 0.05), примерно на шестую часть каменный
     (сероватый с рыжиной), остальное металлический (светлее всех).
     Вторая - сторона. Крупинка, повёрнутая к Солнцу, освещена, а
     та, что за поясом, тонет в тени: считаем это один раз при
     сборке по НАСТОЯЩЕМУ положению светила.

     Обе - в цвет вершины, то есть в кадре они не стоят ничего.
     Пояс поворачивается за час с лишним на оборот, так что
     запечённая сторона света от него не убегает. */
  var ЛУЧ = СОЛНЦЕ.clone().sub(new T.Vector3(880, -110, -1020)).normalize();
  for (var bi = 0; bi < bn; bi++) {
    var ba = Math.random() * Math.PI * 2;
    var br = 320 + Math.random() * 190;
    var bx = Math.cos(ba) * br, by = (Math.random() - 0.5) * 80, bz = Math.sin(ba) * br;
    bp[bi * 3] = 880 + bx;
    bp[bi * 3 + 1] = -110 + by;
    bp[bi * 3 + 2] = -1020 + bz;
    var бдл = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
    var сторона = (bx * ЛУЧ.x + by * ЛУЧ.y + bz * ЛУЧ.z) / бдл;
    var свет = 0.32 + 0.68 * (0.5 + 0.5 * сторона);
    var тип = Math.random();
    var кр, зл, си;
    if (тип < 0.75) { кр = 0.42; зл = 0.40; си = 0.38; }        /* углистые */
    else if (тип < 0.92) { кр = 0.78; зл = 0.66; си = 0.52; }   /* каменные */
    else { кр = 0.86; зл = 0.86; си = 0.90; }                   /* металлические */
    var шум = 0.7 + Math.random() * 0.6;
    bc[bi * 3] = кр * свет * шум;
    bc[bi * 3 + 1] = зл * свет * шум;
    bc[bi * 3 + 2] = си * свет * шум;
  }
  beltGeo.setAttribute("position", new T.BufferAttribute(bp, 3));
  beltGeo.setAttribute("color", new T.BufferAttribute(bc, 3));
  /* Астероиды не светятся: тёмный мелкий гравий, читается роем
     камней, а не бежевой пылью */
  var belt = new T.Points(beltGeo, new T.PointsMaterial({
    color: 0xe8eef4, size: 1.0, sizeAttenuation: false, map: starDot,
    vertexColors: true,
    transparent: true, opacity: 0.52, depthWrite: false
  }));
  scene.add(belt);

  этап("Луна");
  /* ── Луна ── */
  var moon = new T.Mesh(
    new T.SphereGeometry(16, 40, 28),
    /* Луна была на Phong с бликом. Реголит это пыль: она не блестит
       вообще, зеркальной составляющей у неё нет. Плюс карта светлее
       настоящей вдвое (среднее 139 из 255 против альбедо 0.12), и
       Луна выходила ярче земной суши. Standard, шероховатость в
       единицу, карта приглушена множителем. */
    new T.MeshStandardMaterial({
      map: tex("assets/space/moon.webp"),
      color: 0x9aa0a6,
      roughness: 1.0,
      metalness: 0.0,
      envMapIntensity: 0.0
    })
  );
  moon.position.set(300, 40, -190);
  scene.add(moon);
  /* Маршрут проходит с теневой стороны Луны - без своего света она
     встречала корабль чёрным диском */
  /* Здесь стоял отдельный фонарь у Луны, светивший не оттуда, откуда
     солнце. Он поднимал её теневую половину и убивал терминатор -
     самую узнаваемую черту лунного диска. Луну освещает то же солнце,
     что и всё остальное. */

  /* Узлы-реле CDN: цепочка светящихся маяков вдоль перегона
     Луна-Марс. Пустой кусок пути превращается в кадр про продукт:
     «контент идёт с ближайшего узла» - вот эти узлы. */
  var relayTex = glowSprite(64, "rgba(159,224,246,1)", "rgba(66,178,220,0)");
  var relayPts = [], relaySprites = [];
  for (var ri = 0; ri < 6; ri++) {
    var rt = ri / 5;
    var rp = new T.Vector3(350 + rt * 210, 20 - rt * 145, -250 - rt * 420);
    rp.x += (ri % 2 ? 34 : -30); rp.y += (ri % 3 - 1) * 26;
    var rs = new T.Sprite(new T.SpriteMaterial({ map: relayTex, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending }));
    rs.position.copy(rp);
    rs.scale.setScalar(9);
    rs.userData.info = RU ? "УЗЕЛ RC-" + (ri + 1) + "0 · ближайший к вам сервер сети" : "NODE RC-" + (ri + 1) + "0";
    /* Реле сети это не открываемое тело: журнал исследователя считает
       планеты и галактики, а знаменатель шести узлов не знает. Без
       этой пометки нажатие СКАН у Земли мгновенно поднимало счётчик
       «ОТКРЫТО» с 0/42 на 1/42, не подлетев ни к чему. */
    rs.userData["реле"] = true;
    scene.add(rs);
    relayPts.push(rp);
    relaySprites.push(rs);
  }
  /* Линия связи между узлами: тонкая, едва заметная */
  var relayGeo = new T.BufferGeometry().setFromPoints(relayPts);
  var relayLine = new T.Line(relayGeo, new T.LineBasicMaterial({ color: 0x42b2dc, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false }));
  scene.add(relayLine);

  этап("Марс");
  /* ── Марс ── */
  /* Марс снимком, а не рисунком: мозаика «Викингов» (MDIM21, NASA,
     общественное достояние). На нарисованной карте не было ни долины
     Маринер, ни Фарсиды, ни полярных шапок - шар читался крашеным
     оранжевым. Свет считается как у Земли: Standard, шероховатость
     под пыль, окружение не пускаем. */
  var mars = new T.Mesh(
    new T.SphereGeometry(30, 44, 30),
    (function () {
      var м = new T.MeshStandardMaterial({
        color: new T.Color(0xb0603a),
        roughness: 0.95, metalness: 0.0, envMapIntensity: 0.0
      });
      картаТела("assets/space/mars.webp", м);
      return м;
    })()
  );
  mars.position.set(620, -170, -820);
  scene.add(mars);

  этап("Сатурн");
  /* ── Сатурн ── */
  var saturn = new T.Group();
  saturn.add(new T.Mesh(
    new T.SphereGeometry(46, 48, 34),
    (function () {
      var м = new T.MeshStandardMaterial({
      /* Сатурн снимком. Прежняя карта считалась кодом, и полосы у
         неё шли ровными лентами - у настоящего Сатурна они разной
         ширины, с завихрениями на границах и с шестиугольником у
         полюса. Он в кино подходит вплотную и занимает пол-кадра,
         поэтому разницу видно сразу. */
        color: new T.Color(0xd8bb86),
        roughness: 0.9, metalness: 0.0, envMapIntensity: 0.0
      });
      картаТела("assets/space/saturn.webp", м);
      return м;
    })()
  ));
  var ringGeo = new T.RingGeometry(60, 116, 96, 1);
  /* UV кольца по радиусу, чтобы полосатая текстура легла кругами */
  (function () {
    var pos = ringGeo.attributes.position, uv = ringGeo.attributes.uv, v = new T.Vector3();
    for (var k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      uv.setXY(k, (v.length() - 60) / 56, 0.5);
    }
  })();
  /* Кольца Сатурна теперь знают, где солнце.

     Стоял MeshBasicMaterial - материал, который вообще не реагирует
     на свет. Кольца одинаково светились на дневной и на ночной
     стороне и не темнели в тени планеты. Тень колец на диске и тень
     диска на кольцах это самая узнаваемая деталь любого настоящего
     снимка Сатурна, и её не было.

     Полноценные тени в сцене не включены (это дорого на телефоне),
     поэтому тень планеты на кольцах считается аналитически прямо в
     шейдере: если луч от точки кольца к солнцу проходит ближе оси,
     чем радиус планеты, точка в тени. Одно пересечение луча со
     сферой, без единого лишнего прохода. */
  var ringMatS = new T.ShaderMaterial({
    transparent: true, side: T.DoubleSide, depthWrite: false,
    uniforms: {
      uMap: { value: paintRing() },
      uSun: { value: new T.Vector3(1, 0.2, 0.3).normalize() },
      /* Радиус самой планеты: по нему шейдер отмеряет ширину её
         тени на кольце. Сфера Сатурна построена радиусом 46. */
      uR: { value: 46.0 }
    },
    vertexShader: [
      "varying vec2 vUv;",
      "varying vec3 vLocal;",
      "void main() {",
      "  vUv = uv;",
      "  vLocal = position;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "precision mediump float;",
      "uniform sampler2D uMap;",
      "uniform vec3 uSun;",
      "uniform float uR;",
      "varying vec2 vUv;",
      "varying vec3 vLocal;",
      "void main() {",
      "  vec4 t = texture2D(uMap, vUv);",
      "  if (t.a < 0.01) discard;",
      /* Тень планеты: расстояние от точки кольца до оси, идущей на
         солнце. Ближе радиуса планеты и позади неё - тень. */
      "  vec3 p = vLocal;",
      "  float along = dot(p, uSun);",
      "  vec3 across = p - uSun * along;",
      "  float d = length(across);",
      "  float shade = 1.0;",
      "  if (along < 0.0) {",
      "    shade = smoothstep(uR * 0.86, uR * 1.14, d);",
      "    shade = 0.18 + shade * 0.82;",
      "  }",
      /* Лёд рассеивает свет вперёд: на просвет кольцо ярче, чем в
         отражении. Это тоже видно на снимках. */
      "  float graze = abs(dot(normalize(p), uSun));",
      "  float thru = 0.75 + pow(1.0 - graze, 2.2) * 0.55;",
      "  gl_FragColor = vec4(t.rgb * shade * thru, t.a * 0.94);",
      "}"
    ].join("\n")
  });
  var ring = new T.Mesh(ringGeo, ringMatS);
  ring.rotation.x = Math.PI / 2.25;
  saturn.add(ring);
  saturn.position.set(1560, 260, -1060);
  saturn.rotation.z = 0.12;
  scene.add(saturn);

  этап("дыра");
  /* ── Чёрная дыра ──
     Тонкий горячий диск, нарисованный шейдером: полосы, вращение,
     оранжевое пламя к центру и провал посередине. Плюс чёрное ядро
     и тёплое гало вокруг. */
  var hole = new T.Group();
  hole.add(new T.Mesh(new T.SphereGeometry(26, 40, 28), new T.MeshBasicMaterial({ color: 0x000000 })));
  var diskGeo = new T.RingGeometry(30, 105, tiny ? 110 : 160, 1);
  (function () {
    var pos = diskGeo.attributes.position, uv = diskGeo.attributes.uv, v = new T.Vector3();
    for (var k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      uv.setXY(k, (v.length() - 30) / 75, Math.atan2(v.y, v.x) / 6.28318 + 0.5);
    }
  })();
  var diskMat = new T.ShaderMaterial({
    transparent: true, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uT: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "varying vec2 vUv; uniform float uT;" +
      "float n(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }" +
      "void main(){" +
      "  float rad = vUv.x; float ang = vUv.y * 6.28318;" +
      "  float swirl = sin(ang * 3.0 + uT * 1.4 - rad * 14.0) * 0.5 + 0.5;" +
      "  float grain = n(vec2(floor(rad * 60.0), floor((ang + uT * 0.35) * 30.0)));" +
      "  float heat = (1.0 - rad);" +
      "  vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.85, 0.55), heat * heat);" +
      "  col = mix(col, vec3(0.55, 0.30, 0.95), rad * 0.35);" +
      "  float a = heat * (0.35 + swirl * 0.5 + grain * 0.25);" +
      "  a *= smoothstep(0.0, 0.12, rad) * smoothstep(1.0, 0.72, rad);" +
      "  gl_FragColor = vec4(col * (0.7 + heat), a);" +
      "}"
  });
  var disk = new T.Mesh(diskGeo, diskMat);
  disk.rotation.x = Math.PI / 2.5;
  hole.add(disk);
  /* Фотонная сфера: свет, обёрнутый вокруг горизонта. Тонкий
     ярко-белый обруч у самого ядра - как на снимке M87*. */
  var photon = new T.Mesh(
    new T.TorusGeometry(28.5, 0.7, 10, 90),
    new T.MeshBasicMaterial({ color: 0xffe8c9, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })
  );
  photon.rotation.x = Math.PI / 2.5;
  hole.add(photon);
  /* ── Линзирование ──────────────────────────────────────
     Главная примета чёрной дыры на снимках - не сам диск, а его
     обратная сторона, поднятая гравитацией над горизонтом. Свет
     оттуда огибает шар и приходит к нам сверху и снизу, из-за чего
     диск выглядит замкнутой аркой, а не плоским кольцом.

     Честно считать ход луча здесь нечем: это второй проход по всем
     пикселям, а сцена живёт на телефоне. Но результат воспроизводим
     точно - вторым диском тем же шейдером, повёрнутым поперёк
     первого. Глаз читает ровно то же самое: свет, загнутый вокруг
     горизонта. */
  var arc = new T.Mesh(diskGeo, diskMat);
  arc.rotation.x = Math.PI / 2.5;
  arc.rotation.y = Math.PI / 2;
  hole.add(arc);

  /* Провал вокруг горизонта: у самой дыры фон гаснет, а не просто
     закрывается чёрным шаром. Тень падает мягко, по френелю. */
  var lens = new T.Mesh(
    new T.SphereGeometry(74, 32, 24),
    new T.ShaderMaterial({
      transparent: true, side: T.BackSide, depthWrite: false,
      uniforms: {},
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader:
        "varying vec3 vN;" +
        "void main(){" +
        "  float f = pow(clamp(dot(vN, vec3(0.0,0.0,-1.0)) + 0.35, 0.0, 1.0), 2.2);" +
        "  gl_FragColor = vec4(0.0, 0.0, 0.0, f * 0.86);" +
        "}"
    })
  );
  hole.add(lens);

  var halo = new T.Sprite(new T.SpriteMaterial({ map: glowSprite(256, "rgba(255,140,50,.32)", "rgba(255,80,20,0)"), transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending }));
  halo.scale.setScalar(380);
  hole.add(halo);
  hole.position.set(2140, -160, -2380);
  scene.add(hole);

  этап("прыжок");
  /* ── Гиперпрыжок: светящиеся следы ──────────────────────────
     Здесь стояли LineSegments с LineBasicMaterial. В WebGL это всегда
     линия толщиной ровно в один пиксель, одной яркости по всей длине
     и без сглаживания. На телефоне заказчика прыжок и выглядел как
     веер белых палок с лесенкой по краю: «скачок ужасно выглядит
     вообще, прям хуета полная».

     Толщину линии в WebGL задать нельзя, поэтому каждый след теперь
     не линия, а вытянутый четырёхугольник, повёрнутый плашмя к
     камере. Шейдер даёт ему то, чего у линии не было и быть не могло:

       поперёк - мягкий спад от раскалённого ядра к прозрачным краям,
                 то есть край размыт, а не нарезан пикселями;
       вдоль   - голова яркая, хвост уходит в ноль, след читается
                 летящим, а не приклеенным;
       вразнобой - у каждого следа своя яркость, своя ширина и своя
                 длина, поэтому пучок имеет глубину;
       цвет    - ядро белёсое, края уходят в цвет прыжка. */
  var jump = (function () {
    var n = tiny ? 200 : (particleBudget ? 260 : 380);
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(n * 4 * 3);
    var aSide = new Float32Array(n * 4);
    var aAlong = new Float32Array(n * 4);
    var aSeed = new Float32Array(n * 4);
    var idx = new Uint16Array(n * 6);
    for (var k = 0; k < n; k++) {
      var a = Math.random() * 6.283;
      /* Ближе к центру кадра следов гуще: там и находится точка, из
         которой они разбегаются. Ровное распределение по радиусу
         давало пустую середину. */
      var rr = 10 + Math.pow(Math.random(), 0.72) * 250;
      var z0 = -Math.random() * 900;
      var len = 70 + Math.random() * 230;
      /* Дальние следы тоньше ближних: это и создаёт глубину пучка. */
      var wid = (0.8 + Math.random() * 2.6) * (0.55 + rr / 260 * 0.6);
      var cx = Math.cos(a) * rr, cy = Math.sin(a) * rr;
      /* Ширину откладываем поперёк луча, то есть по касательной: на
         экране след идёт от центра наружу, и его толщина должна расти
         вбок от этого направления. */
      var tx = -Math.sin(a) * wid, ty = Math.cos(a) * wid;
      var b = k * 4, p = b * 3;
      pos[p] = cx - tx;      pos[p + 1] = cy - ty;      pos[p + 2] = z0;
      pos[p + 3] = cx + tx;  pos[p + 4] = cy + ty;      pos[p + 5] = z0;
      pos[p + 6] = cx + tx;  pos[p + 7] = cy + ty;      pos[p + 8] = z0 - len;
      pos[p + 9] = cx - tx;  pos[p + 10] = cy - ty;     pos[p + 11] = z0 - len;
      aSide[b] = -1; aSide[b + 1] = 1; aSide[b + 2] = 1; aSide[b + 3] = -1;
      aAlong[b] = 0; aAlong[b + 1] = 0; aAlong[b + 2] = 1; aAlong[b + 3] = 1;
      var sd = Math.random();
      aSeed[b] = aSeed[b + 1] = aSeed[b + 2] = aSeed[b + 3] = sd;
      var i6 = k * 6;
      idx[i6] = b; idx[i6 + 1] = b + 1; idx[i6 + 2] = b + 2;
      idx[i6 + 3] = b; idx[i6 + 4] = b + 2; idx[i6 + 5] = b + 3;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("aSide", new T.BufferAttribute(aSide, 1));
    geo.setAttribute("aAlong", new T.BufferAttribute(aAlong, 1));
    geo.setAttribute("aSeed", new T.BufferAttribute(aSeed, 1));
    geo.setIndex(new T.BufferAttribute(idx, 1));
    var mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      side: T.DoubleSide,
      uniforms: {
        uOpacity: { value: 0 },
        uColor: { value: new T.Color(0x9fd8ef) },
        uHeat: { value: 0 }
      },
      vertexShader: [
        "attribute float aSide;",
        "attribute float aAlong;",
        "attribute float aSeed;",
        "varying float vSide;",
        "varying float vAlong;",
        "varying float vSeed;",
        "varying float vRad;",
        "void main() {",
        "  vSide = aSide; vAlong = aAlong; vSeed = aSeed;",
        "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        /* Угол от оси взгляда. У точки схода полос сотни ореолов
           складывались друг с другом и заливали кадр молочной
           дымкой - тем самым «мутным космосом». В жизни там ничего
           яркого нет: полосы сходятся В ТОЧКУ, а не в пятно. */
        "  vRad = length(mv.xy) / max(1.0, abs(mv.z));",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "precision mediump float;",
        "uniform float uOpacity;",
        "uniform float uHeat;",
        "uniform vec3 uColor;",
        "varying float vSide;",
        "varying float vAlong;",
        "varying float vSeed;",
        "varying float vRad;",
        "void main() {",
        /* Поперёк следа: единица в середине, ноль по краям. Степень
           даёт узкое раскалённое ядро и широкий мягкий ореол. */
        "  float w = 1.0 - abs(vSide);",
        "  w = clamp(w, 0.0, 1.0);",
        "  float core = pow(w, 5.0);",
        "  float halo = pow(w, 1.35);",
        /* Вдоль: голова яркая, хвост в ноль. К середине прыжка хвост
           тянется дальше - свет мимо стекла идёт быстрее. */
        "  float tail = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.55 - uHeat * 0.5);",
        /* Голова чуть подсвечена отдельно: у настоящего следа она
           самая яркая точка, а не просто край. */
        "  float head = pow(clamp(1.0 - vAlong, 0.0, 1.0), 9.0) * 0.55;",
        /* Ореол ужат: он и давал дымку, складываясь сам с собой на
           сотне полос. Ядро осталось прежним, след стал резче. */
        "  float a = (halo * 0.34 + core * 0.95) * (tail + head) * uOpacity * (0.4 + vSeed * 0.6);",
        "  a *= smoothstep(0.0, 0.11, vRad);",
        "  if (a < 0.004) discard;",
        "  vec3 col = mix(uColor, vec3(1.0), core * (0.55 + uHeat * 0.35));",
        "  gl_FragColor = vec4(col * (0.55 + core * 0.85), a);",
        "}"
      ].join("\n")
    });
    var mesh = new T.Mesh(geo, mat);
    mesh.frustumCulled = false;
    /* Обновляющий код правит .opacity и .color, как у обычного
       материала. Держим этот же вид наружу, чтобы прыжок оставался
       одной понятной ручкой. */
    Object.defineProperty(mat, "opacity", {
      get: function () { return mat.uniforms.uOpacity.value; },
      set: function (v) { mat.uniforms.uOpacity.value = v; }
    });
    Object.defineProperty(mat, "color", {
      get: function () { return mat.uniforms.uColor.value; }
    });
    Object.defineProperty(mat, "heat", {
      get: function () { return mat.uniforms.uHeat.value; },
      set: function (v) { mat.uniforms.uHeat.value = v; }
    });
    return mesh;
  })();
  scene.add(jump);

  этап("галактики");
  /* ── Галактики ──────────────────────────────────────────────
     Три спирали из частиц: Млечный Путь по курсу прыжка и две
     дальние вселенные по сторонам. Каждая - несколько тысяч точек
     по логарифмической спирали с гауссовым разбросом; ядро теплее,
     рукава в цвет вселенной. */
  этап("спираль");
  /* ── Спиральная галактика ────────────────────────────────
     «Млечный путь не такой выглядит, как в реальности, нету
     чёткости, реализма и детализации» - и правда: три ровных рукава
     из одинаковых точек читались схемой, а не звёздным островом.

     Настоящая галактика устроена сложнее, и три вещи решают всё:
       - логарифмическая спираль, а не дуга постоянной кривизны;
       - разброс звёзд поперёк рукава, растущий к краю диска;
       - три населения по цвету и размеру - голубые гиганты в
         рукавах, жёлтое ядро, красная пыль между рукавами.
     Плюс тёмные прожилки: без пыли диск светится ровно и выглядит
     нарисованным. */
  function spiralGalaxy(px, py, pz, scale, colA, colB, tiltX, tiltZ) {
    /* ── Что здесь было плоского, числами ────────────────────
       Одиннадцать тысяч точек и ровно ЧЕТЫРЕ цвета на них: ядро
       0xffe9c4, рукав colA, рукав colB и «пыль» 0x1c2836. Размер у
       всех одинаковый: массив siz заполнялся, но в геометрию не
       клался ни разу, а материалу задан size 1.3 без ослабления по
       дальности - то есть все звёзды галактики были одной величины.
       Прозрачность одна на всех, 0.95. Рукава набирались по остатку
       k % ARMS, поэтому в каждом ровно четверть звёзд и плотность
       вдоль рукава постоянная - ни узлов, ни разрывов. Между
       рукавами не было НИЧЕГО: диск состоял только из четырёх полос.
       Пыль складывалась в режиме сложения, то есть тёмные точки не
       гасили свет, а слабо СВЕТИЛИСЬ синим - прямо наоборот замыслу.

       Что сделано.
       Цвет - по планковской шкале, непрерывно, по температуре, и
       температура зависит от места: балдж старый и жёлтый, рукава
       молодые и голубые, между рукавами промежуточное население.
       Величина - двумя облаками точек разного размера, потому что
       PointsMaterial умеет только один размер на объект; ярких мало
       и они крупнее, как и положено. Яркость непрерывная, она
       сидит в цвете вершины (сложение light-on-light именно так и
       работает). Плотность вдоль рукава модулируется - получаются
       области звездообразования и разрывы. Пыль сделана не точками,
       а ВЫЧЕТОМ плотности по внутренней кромке рукава: тёмная
       прожилка в галактике это отсутствие звёзд, а не тёмная
       краска. Добавлена перемычка-бар: спирали с баром - самый
       частый тип, и наш Млечный Путь такой же. */
    var n = tiny ? 4200 : (particleBudget ? 5200 : 11000);
    /* Свой генератор, а не Math.random: галактика обязана быть
       одинаковой от захода к заходу, иначе рисунок рукавов
       перемешивается при каждом открытии. Сдвиговый - у линейного
       соседние значения ложатся на прямые, а здесь координата и
       угол берутся подряд. */
    var сид = 1911 + Math.round(scale) * 7 + Math.round(Math.abs(px));
    function сл() {
      сид ^= сид << 13; сид >>>= 0;
      сид ^= сид >>> 17;
      сид ^= сид << 5;  сид >>>= 0;
      return сид / 4294967296;
    }
    var cA = new T.Color(colA), cB = new T.Color(colB);
    /* Оттенок вселенной, заданный снаружи, не выбрасываем: он держит
       три рукава сети разными на глаз. Он подмешивается к
       физическому цвету, а не заменяет его. */
    var смесь = new T.Color();
    var ARMS = 4, TW = 2.35;
    /* Точки раскладываются в два облака: тусклая масса и редкие
       яркие. Иначе величина у всех одна - PointsMaterial задаёт
       размер на весь объект, а не на вершину. */
    var посТ = [], цвТ = [], посЯ = [], цвЯ = [];
    var k;
    for (k = 0; k < n; k++) {
      /* Радиус: степень меньше единицы сгущает звёзды к ядру ровно
         так, как в настоящем диске */
      var tt = Math.pow(сл(), 0.58);
      var rad = tt * scale;
      var вРукаве = сл() < 0.80;
      var ang, плотн = 1;
      if (вРукаве) {
        var arm = (сл() * ARMS | 0) * (6.28318 / ARMS);
        /* Логарифмическая закрутка: чем дальше от ядра, тем сильнее
           отстаёт рукав */
        ang = arm + Math.log(1 + tt * 9) * TW;
        /* Разброс поперёк рукава: у ядра плотно, к краю шире */
        var jit = (сл() - 0.5) * (0.10 + tt * 0.42);
        ang += jit;
        /* Узлы звездообразования. Настоящий рукав это не ровная
           лента, а цепочка ярких сгущений с провалами между ними -
           по ним рукав и читается рукавом. Косинус по длине рукава
           даёт эти сгущения, вторая частота ломает регулярность. */
        плотн = 0.45 + 0.55 * Math.abs(Math.cos(tt * 11.0 + arm * 2.1)) +
                0.30 * Math.abs(Math.sin(tt * 27.0 + arm * 5.7));
        /* Пылевая полоса идёт по ВНУТРЕННЕЙ кромке рукава - там,
           где газ тормозит на спиральной волне плотности. Звёзды за
           ней не пропадают, но видно их хуже: гасим яркость по
           знаку отклонения от оси рукава. */
        if (jit < -0.04) плотн *= 0.30 + 0.70 * Math.exp(-(jit + 0.04) * (jit + 0.04) / 0.010);
      } else {
        /* Межрукавное население: старые звёзды, размазанные по всему
           диску. Без него диск это четыре полосы на пустоте, а не
           диск. Их пятая часть и они тусклее. */
        ang = сл() * 6.28318;
        плотн = 0.30;
      }
      /* Перемычка. У большинства спиралей, и у нашей в том числе,
         внутренняя часть вытянута в бар, а не кругла. Сжимаем
         внутренние радиусы поперёк оси бара - круг становится
         эллипсом, и с любого ракурса это видно. */
      var cx0 = Math.cos(ang) * rad, cz0 = Math.sin(ang) * rad;
      if (tt < 0.34) {
        var сила = 1 - tt / 0.34;
        var ба = 0.62;
        var бx = cx0 * Math.cos(ба) + cz0 * Math.sin(ба);
        var бz = -cx0 * Math.sin(ба) + cz0 * Math.cos(ба);
        бz *= 1 - 0.62 * сила;
        бx *= 1 + 0.30 * сила;
        cx0 = бx * Math.cos(ба) - бz * Math.sin(ба);
        cz0 = бx * Math.sin(ба) + бz * Math.cos(ба);
      }
      /* Толщина диска: балдж у ядра, тонкий блин к краю. Именно эта
         разница и делает галактику ПЛОСКОЙ на просвет. */
      var thick = scale * (0.055 * Math.exp(-tt * 3.4) + 0.008);
      var rr = 1 + (сл() - 0.5) * 0.06;
      var вy = (сл() + сл() + сл() - 1.5) * thick;

      /* ── Цвет и яркость ──────────────────────────────────
         Температура по месту: балдж - старое красное население
         (около 4200 K), рукава - молодые голубые сверхгиганты (до
         18000 K), между рукавами промежуточное. Разброс внутри
         населения обязателен, иначе снова получится один цвет на
         область. */
      var базК = tt < 0.16 ? 4200 + сл() * 1800
               : вРукаве ? 5200 + Math.pow(сл(), 2.2) * 13000
                         : 4400 + сл() * 2600;
      var тон = планкТон(базК);
      /* Светимость степенным законом: ярких единицы, тусклых тьма.
         Тот же закон, что и у звёзд неба, и по той же причине -
         иначе все точки одинаковы. */
      var я = Math.pow(сл(), 2.6) * плотн;
      if (tt < 0.16) я = 0.35 + я * 0.65;   /* балдж плотный и яркий */
      смесь.setRGB(тон[0], тон[1], тон[2]);
      /* Оттенок рукава вселенной подмешиваем на треть: узнаваемость
         рукава остаётся, физика цвета не ломается. */
      var уц = сл() > 0.5 ? cA : cB;
      смесь.r = смесь.r * 0.68 + уц.r * 0.32;
      смесь.g = смесь.g * 0.68 + уц.g * 0.32;
      смесь.b = смесь.b * 0.68 + уц.b * 0.32;
      /* Яркая или тусклая. Порог считан, а не подобран: светимость
         идёт как степень 2.6 от равномерного, средняя плотность в
         рукаве около 0.79, поэтому выше 0.55 оказывается примерно
         одна точка из девяти. Столько ярких звёзд и различимо в
         диске настоящей спирали; при пороге 0.42 крупных выходило
         вдвое больше, и диск начинал зернить. */
      var вЯркие = я > 0.55;
      var П = вЯркие ? посЯ : посТ, Ц = вЯркие ? цвЯ : цвТ;
      П.push(cx0 * rr, вy, cz0 * rr);
      var ая = вЯркие ? 0.55 + я * 0.45 : 0.10 + я * 1.35;
      Ц.push(смесь.r * ая, смесь.g * ая, смесь.b * ая);
    }

    function облако(П, Ц, размер) {
      var г = new T.BufferGeometry();
      г.setAttribute("position", new T.BufferAttribute(new Float32Array(П), 3));
      г.setAttribute("color", new T.BufferAttribute(new Float32Array(Ц), 3));
      /* Размер звезды галактики с ослаблением по дальности раздувал
         её в полтора десятка экранных пикселей при подлёте: спираль
         превращалась в горсть светящихся клякс. Ослабление снято,
         размер задан в пикселях - галактика остаётся россыпью точек
         с любого расстояния, как ей и положено. */
      return new T.Points(г, new T.PointsMaterial({
        size: размер, sizeAttenuation: false, map: starDot, vertexColors: true,
        transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending
      }));
    }
    var pts = облако(посТ, цвТ, 1.1);
    var ярк = облако(посЯ, цвЯ, 2.5);

    /* Ядро: тёплое свечение и балдж вокруг него */
    /* Ядро было втрое крупнее и почти непрозрачным: на подлёте оно
       заливало кадр ровным белым шаром, а рукава за ним не читались
       вовсе. Владелец увидел ровно это - «скачок вообще не красивый»
       и «космос мутный». Балдж настоящей спирали ярче диска, но не
       перекрывает его: делаем меньше и глуше, а плотность звёзд у
       ядра поднята - светиться должны они, а не спрайт поверх. */
    var core = new T.Sprite(new T.SpriteMaterial({
      map: glowSprite(128, "rgba(255,240,214,.95)", "rgba(255,206,140,0)"),
      transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending
    }));
    core.scale.setScalar(scale * 0.19);
    /* ── Гало диска ──────────────────────────────────────────
       Здесь стоял СПРАЙТ, а спрайт всегда развёрнут лицом к камере.
       Значит мягкое свечение диска было ровным КРУГОМ независимо от
       того, под каким углом мы смотрим на галактику: сколько её ни
       наклоняй, она оставалась круглым пятном - ровно то, на что
       жаловался заказчик.

       Ставим плоскость В ПЛОСКОСТИ ДИСКА. Тогда свечение сжимается
       в эллипс вместе с диском, при взгляде с ребра сходит в
       полоску, и объём читается сразу. Двусторонняя - галактику
       видно и снизу.

       Заливки это не прибавляет, и размер подобран именно из этого.
       Спрайт был шириной 1.05 радиуса и всегда стоял к камере
       плашмя. Плоскость в диске при наклонении 68 градусов сжата на
       экране в 0.4 раза, поэтому при ширине 1.6 радиуса площадь
       выходит 1.6*1.6*0.4/(1.05*1.05) = 0.93 от прежней - чуть
       меньше, а не больше. */
    var glow = new T.Mesh(
      new T.PlaneGeometry(scale * 1.6, scale * 1.6),
      new T.MeshBasicMaterial({
        map: glowSprite(256, "rgba(150,190,255,.09)", "rgba(90,130,220,0)"),
        transparent: true, opacity: 0.5, depthWrite: false, side: T.DoubleSide,
        blending: T.AdditiveBlending
      })
    );
    /* Плоскость в THREE стоит в XY, а диск галактики лежит в XZ:
       кладём её на бок один раз при сборке. */
    glow.rotation.x = -Math.PI / 2;
    var gr = new T.Group();
    gr.add(pts); gr.add(core); gr.add(glow); gr.add(ярк);
    gr.position.set(px, py, pz);
    gr.rotation.x = tiltX; gr.rotation.z = tiltZ;
    /* Кадру нужны ссылки: у самого ядра спрайт гасится совсем, иначе
       на подлёте он снова станет шаром */
    gr.userData.ядро = core;
    gr.userData.гало = glow;
    gr.userData.радиус = scale;
    scene.add(gr);
    return gr;
  }
  /* Что расскажет бортовой справочник при наведении на объект */
  eBody.userData.info = СЛ("земляИнфо");
  moon.userData.info = RU ? "ЛУНА · 384 400 км · первая цель космических миссий, 1959" : "MOON · 384,400 km · first space target, 1959";
  mars.userData.info = RU ? "МАРС · в телескоп впервые разглядел Галилей, 1610" : "MARS · first seen through a telescope by Galileo, 1610";
  saturn.userData.info = RU ? "САТУРН · кольца открыл Гюйгенс, 1655" : "SATURN · rings discovered by Huygens, 1655";
  hole.children[0].userData.info = СЛ("дыраСнимок");
  /* Новые тела тоже отзываются на нажатие: по каждому можно снять
     карту, иначе половина системы остаётся немой */
  function planetPick(o) { return o && o.userData && o.userData.pick ? o.userData.pick : o; }
  var pickables = [eBody, moon, mars, saturn.children[0], hole.children[0],
                   sunBody, planetPick(mercury), planetPick(venus), planetPick(jupiter),
                   planetPick(uranus), planetPick(neptune)];
  for (var rj = 0; rj < relaySprites.length; rj++) pickables.push(relaySprites[rj]);
  /* Кольца Сатурна тоже тело: по ним нажимают чаще, чем по шару -
     они крупнее и заметнее, а подбирался только шар. */
  if (saturn.children[1]) {
    saturn.children[1].userData.info = saturn.userData.info;
    pickables.push(saturn.children[1]);
  }
  saturn.children[0].userData.info = RU ? "САТУРН · кольца открыл Гюйгенс, 1655" : "SATURN · rings discovered by Huygens, 1655";

  /* Комета: ядро со свечением и хвост из частиц. Ходит по вытянутому
     эллипсу между Марсом и Сатурном, хвост всегда от солнца. */
  var comet = new T.Group();
  var cometCore = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(64, "rgba(220,244,255,1)", "rgba(160,220,255,0)"),
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  }));
  cometCore.scale.setScalar(26);
  cometCore.userData.info = RU ? "КОМЕТА RC/2026 · хвост всегда смотрит от солнца" : "COMET RC/2026 · the tail always points away from the sun";
  comet.add(cometCore);
  /* ── Хвосты кометы ────────────────────────────────────────
     У кометы их ДВА, и это главное, чем настоящая комета отличается
     от нарисованной. Ионный хвост - газ, сдутый солнечным ветром:
     он идёт строго по прямой от Солнца, узкий, длинный и голубой,
     потому что светится ионизованный угарный газ. Пылевой -
     тяжёлая крошка, она отстаёт по орбите, поэтому хвост широкий,
     заметно короче, изогнутый и тёплого цвета, он просто отражает
     солнечный свет.

     Здесь был один прямой конус белых крупинок, то есть ни тот и ни
     другой. Разделяем те же девяносто точек на две группы и красим
     по вершинам: точек столько же, вызов один, а комета из значка
     превращается в комету. Яркость гасим по длине - настоящий хвост
     к концу растворяется, а не обрывается. */
  var cometTail = (function () {
    var n = 90, geo = new T.BufferGeometry();
    var posA = new Float32Array(n * 3), colA = new Float32Array(n * 3);
    var ИОН = 58;
    for (var k = 0; k < n; k++) {
      var ион = k < ИОН;
      var d = ион ? k / ИОН : (k - ИОН) / (n - ИОН);
      var я, кр, зл, си;
      if (ион) {
        posA[k * 3] = -d * 195 + (Math.random() - 0.5) * d * 8;
        posA[k * 3 + 1] = (Math.random() - 0.5) * d * 8;
        posA[k * 3 + 2] = (Math.random() - 0.5) * d * 8;
        я = (1 - d * 0.82) * (0.7 + Math.random() * 0.6);
        кр = 0.52; зл = 0.76; си = 1.00;
      } else {
        /* Изгиб пылевого хвоста квадратичен по длине: чем дальше
           крупинка отстала, тем сильнее её снесло с прямой. */
        posA[k * 3] = -d * 140 + (Math.random() - 0.5) * d * 24;
        posA[k * 3 + 1] = (Math.random() - 0.5) * d * 30;
        posA[k * 3 + 2] = d * d * 46 + (Math.random() - 0.5) * d * 30;
        я = Math.pow(1 - d, 1.4) * (0.7 + Math.random() * 0.6);
        кр = 1.00; зл = 0.90; си = 0.74;
      }
      я = Math.max(0.05, я);
      colA[k * 3] = кр * я; colA[k * 3 + 1] = зл * я; colA[k * 3 + 2] = си * я;
    }
    geo.setAttribute("position", new T.BufferAttribute(posA, 3));
    geo.setAttribute("color", new T.BufferAttribute(colA, 3));
    /* Размер частицы хвоста был подобран под вид издалека, и на
       близком пролёте каждая крупинка раздувалась в белый шар на
       полкадра - хвост читался цепочкой мыльных пузырей. Мельче и
       ярче: издали хвост тот же, вблизи это россыпь льда, как на
       снимках Чурюмова-Герасименко. */
    return new T.Points(geo, new T.PointsMaterial({
      color: 0xffffff, size: 3.2, sizeAttenuation: true, map: starDot,
      vertexColors: true,
      transparent: true, opacity: 0.72, depthWrite: false, blending: T.AdditiveBlending
    }));
  })();
  comet.add(cometTail);
  scene.add(comet);
  pickables.push(cometCore);

  /* Спутник на орбите Земли: корпус и две солнечные панели */
  var sat = new T.Group();
  var satBody = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 2.8),
    new T.MeshPhongMaterial({ color: 0xd8e2ec, shininess: 60, emissive: 0x22303e }));
  satBody.userData.info = СЛ("спутник");
  sat.add(satBody);
  var panelMat = new T.MeshPhongMaterial({ color: 0x1d4d8f, shininess: 90, side: T.DoubleSide, emissive: 0x0d2038 });
  var p1 = new T.Mesh(new T.PlaneGeometry(5.6, 1.8), panelMat); p1.position.x = 4; sat.add(p1);
  var p2 = new T.Mesh(new T.PlaneGeometry(5.6, 1.8), panelMat); p2.position.x = -4; sat.add(p2);
  scene.add(sat);
  pickables.push(satBody);

  /* ── Наклоны спиралей ────────────────────────────────────────
     Заказчик требует видеть галактику ПОД УГЛОМ, а не круглым
     пятном. Наклон тут не на глаз: нормаль диска считается из этих
     двух углов, и её угол с направлением на камеру - это и есть
     наклонение, которым астрономы описывают, насколько галактика
     повёрнута к нам. Ноль - плашмя, девяносто - с ребра.

     Было: у Млечного Пути 39 градусов, у местного рукава 36 - обе
     смотрели почти плашмя, оттого и «круглое пятно». Стало 68 и 64:
     диск виден вытянутым эллипсом, рукава расходятся по перспективе,
     а гало (теперь плоскость в плоскости диска, а не спрайт лицом к
     камере) сжимается вместе с ним. Третья спираль стояла под 63
     градусами и уже была права - её не трогаем. */
  var milky = spiralGalaxy(1150, 80, -2080, 950, 0x9fd8ef, 0x8fb7ff, 0.34, 0.3);
  var gal2 = spiralGalaxy(-2800, -500, -1600, 680, 0xb08cff, 0x8a59f6, 0.55, 0.9);
  /* Все три спирали холодные: белые и голубоватые рукава, тёплое
     только ядро. Прежняя оранжевая читалась грязным пятном. */
  var gal3 = spiralGalaxy(3400, 700, -400, 620, 0xd8e8f6, 0x9fb8d8, 0.75, 0.55);
  /* Only the current arm is physically present. Rendering all three
     transparent galaxies behind Earth cost tens of thousands of
     fragments and also contradicted the navigation: other arms are
     reached through a jump, not visible beside the Solar System. */
  gal2.visible = false;
  gal3.visible = false;
  milky.children[1].userData.info = RU ? "МЛЕЧНЫЙ ПУТЬ · спиральная галактика · наша Солнечная система находится в рукаве Ориона" : "MILKY WAY · barred spiral galaxy · the Solar System lies in the Orion Spur";
  gal2.children[1].userData.info = RU ? "МЕСТНЫЙ РУКАВ · PROXIMA · TRAPPIST-1 · LHS 1140" : "LOCAL ARM · PROXIMA · TRAPPIST-1 · LHS 1140";
  gal3.children[1].userData.info = RU ? "ПОЛЯ KEPLER И TESS · подтверждённые экзопланетные системы" : "KEPLER AND TESS FIELDS · confirmed exoplanet systems";
  pickables.push(milky.children[1], gal2.children[1], gal3.children[1]);

  этап("объём");
  /* ── World-locked galactic volume ───────────────────────
     The far sky sphere supplies astronomical scale, but it cannot
     translate relative to the cockpit. A sparse oblique volume of
     actual 3D points occupies the Local/Orion arm in world space.
     During a camera move its nearer grains cross the farther ones:
     the Milky Way is therefore a place the ship moves through, not
     a photograph glued behind the planets. Fixed pixel-size points
     also guarantee that no grain can swell into the white blobs the
     mobile audit exposed. */
  var galacticVolume = (function () {
    var nG = tiny ? 950 : (particleBudget ? 1650 : 3200);
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(nG * 3), col = new Float32Array(nG * 3);
    var cCold = new T.Color(0x6f9fc1), cBlue = new T.Color(0xa7c9df), cDim = new T.Color(0x35495e);
    var seedG = 81641;
    function rg() { seedG = (seedG * 1664525 + 1013904223) >>> 0; return seedG / 4294967296; }
    for (var gv = 0; gv < nG; gv++) {
      var along = (rg() - .5) * 7600;
      var across = (rg() + rg() + rg() - 1.5) * 820;
      var thick = (rg() + rg() + rg() - 1.5) * 240;
      /* Thirty-degree Orion-arm tilt in all three axes. */
      pos[gv * 3] = along * .82 + across * .48;
      pos[gv * 3 + 1] = thick + along * .10;
      pos[gv * 3 + 2] = along * -.46 + across * .86 - 850;
      var rollG = rg(), cc = rollG > .88 ? cBlue : (rollG < .22 ? cDim : cCold);
      var fadeG = .42 + rg() * .58;
      col[gv * 3] = cc.r * fadeG; col[gv * 3 + 1] = cc.g * fadeG; col[gv * 3 + 2] = cc.b * fadeG;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    var pts = new T.Points(geo, new T.PointsMaterial({
      size: 1.15, sizeAttenuation: false, map: starDot, vertexColors: true,
      transparent: true, opacity: .40, depthWrite: false, blending: T.AdditiveBlending
    }));
    pts.frustumCulled = false;
    scene.add(pts);
    return pts;
  })();

  этап("пыль");
  /* ── Пыль у стекла ──
     Куб мелких частиц, вечно висящий вокруг камеры: кадр никогда
     не бывает мёртвым, а скорость читается кожей. Частицы
     заворачиваются по модулю куба относительно камеры - облако
     бесконечно, а точек всего три сотни. */
  var dust = (function () {
    var nD = tiny ? 160 : (particleBudget ? 220 : 320), SIDE = 140;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(nD * 3);
    var dcol = new Float32Array(nD * 3);
    for (var k = 0; k < nD * 3; k++) pos[k] = (Math.random() - 0.5) * SIDE;
    /* Триста одинаково ярких точек одного цвета глаз читает сеткой,
       а не пылью: одинаковость выдаёт рисунок. Межпланетная пыль
       разная и по размеру, и по составу - ледяная светится холодно,
       силикатная тепло, и яркость у них разнится на порядок. Всё
       это ложится в цвет вершины и не стоит ни одной операции в
       кадре. */
    for (var dk = 0; dk < nD; dk++) {
      var dя = 0.20 + Math.pow(Math.random(), 2.2) * 1.70;
      var dт = Math.random();
      var dr = dт > 0.72 ? 1.00 : 0.72, dg = dт > 0.72 ? 0.94 : 0.86, db = dт > 0.72 ? 0.82 : 1.00;
      dcol[dk * 3] = dr * dя; dcol[dk * 3 + 1] = dg * dя; dcol[dk * 3 + 2] = db * dя;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("color", new T.BufferAttribute(dcol, 3));
    /* Размер в пикселях, а не в мире. Пыль висит вокруг камеры, и
       частица, случайно оказавшаяся в паре единиц от стекла, при
       честном размере раздувалась в мутный шар на четверть кадра -
       в замерах такие пятна закрывали Сатурн целиком. Микрочастице
       объём не нужен: её работа - нестись мимо и давать скорость. */
    var pts = new T.Points(geo, new T.PointsMaterial({
      color: 0xaac6d8, size: 1.6, sizeAttenuation: false, map: starDot,
      vertexColors: true,
      transparent: true, opacity: 0.5, depthWrite: false
    }));
    pts.frustumCulled = false;
    pts.userData.side = SIDE;
    scene.add(pts);
    return pts;
  })();

  этап("шлейф");
  /* ── Шлейф двигателя ──
     Двигатель у нас за спиной, самого факела из кабины не видно -
     зато видно, что он выбрасывает. Раскалённая крошка и искры
     обгоняют корабль по бортам и уходят назад: именно это движение
     мимо стекла и читается как «мы разгоняемся», а не цифра на
     табло. Частицы живут в системе координат камеры и ползут к
     зрителю по локальной оси Z, поэтому мировых координат считать
     не нужно вовсе - только одно число на кадр.

     Цвет раздаём вершинам: свежая искра почти белая, остывающая
     оранжевая, догорающая тёмно-красная. Один общий цвет превращает
     шлейф в конфетти. */
  var washN = tiny ? 90 : (particleBudget ? 140 : 220);
  var wash = (function () {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(washN * 3);
    var col = new Float32Array(washN * 3);
    var hotC = new T.Color(0xfff0d2), midC = new T.Color(0xff9a44), lowC = new T.Color(0xc8422a);
    for (var k = 0; k < washN; k++) {
      var a = Math.random() * 6.283;
      /* Кольцом вокруг оси взгляда: в самой середине кадра искр быть
         не должно, там смотрят на цель */
      var rr = 5 + Math.pow(Math.random(), 0.6) * 46;
      pos[k * 3] = Math.cos(a) * rr;
      pos[k * 3 + 1] = Math.sin(a) * rr * 0.72;
      pos[k * 3 + 2] = -Math.random() * 120;
      var h = Math.random();
      var c = h > 0.78 ? hotC : (h > 0.34 ? midC : lowC);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    /* Размер в пикселях, а не в мире. При sizeAttenuation искра,
       проходящая в паре единиц от стекла, раздувается на пол-экрана
       мутным пятном - на дистанции в пять единиц точка размером
       полтора мира занимает под двести пикселей. Здесь важен не
       честный размер, а росчерк у края кадра. */
    var pts = new T.Points(geo, new T.PointsMaterial({
      size: 2.2, sizeAttenuation: false, map: starDot, vertexColors: true,
      transparent: true, opacity: 0, depthWrite: false, depthTest: false,
      blending: T.AdditiveBlending
    }));
    pts.frustumCulled = false;
    pts.renderOrder = 6;
    /* Пока двигатель молчит, шлейфа нет и в списке отрисовки: точки
       с нулевой прозрачностью всё равно стоили бы вызова */
    pts.visible = false;
    scene.add(pts);
    return pts;
  })();

  этап("пояс");
  /* ── Астероидный пояс ──
     Камни рассыпаны трубой вокруг отрезка будущего маршрута между
     Марсом и Сатурном: корабль проходит сквозь пояс, камни висят
     вокруг и медленно дрейфуют. Два слоя точек - крупные ближе,
     мелкая пыль дальше. */
  /* Тот же приём, что и на дальнем поясе: тип камня и сторона света
     запекаются в цвет вершины при сборке. Здесь он важнее - через
     этот пояс корабль проходит НАСКВОЗЬ, и ровная серая крупа вокруг
     стекла была самым плоским местом всего полёта. */
  function beltLayer(nPts, size, spread, color) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(nPts * 3);
    var col = new Float32Array(nPts * 3);
    /* Отрезок пути: прямая от окрестности Марса к Сатурну */
    var A = new T.Vector3(760, -120, -900), B = new T.Vector3(1350, 210, -1000);
    var осьЛуч = СОЛНЦЕ.clone().sub(A.clone().lerp(B, 0.5)).normalize();
    for (var k = 0; k < nPts; k++) {
      var tt = Math.random();
      var cx = A.x + (B.x - A.x) * tt, cy = A.y + (B.y - A.y) * tt, cz = A.z + (B.z - A.z) * tt;
      var a = Math.random() * 6.283, rr = 40 + Math.pow(Math.random(), 0.5) * spread;
      var ox = Math.cos(a) * rr, oy = (Math.random() - 0.5) * spread * 0.7, oz = Math.sin(a) * rr;
      pos[k * 3] = cx + ox;
      pos[k * 3 + 1] = cy + oy;
      pos[k * 3 + 2] = cz + oz;
      var дл = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
      var сторона = (ox * осьЛуч.x + oy * осьЛуч.y + oz * осьЛуч.z) / дл;
      var свет = 0.30 + 0.70 * (0.5 + 0.5 * сторона);
      var тип = Math.random();
      var кр2, зл2, си2;
      if (тип < 0.75) { кр2 = 0.44; зл2 = 0.42; си2 = 0.40; }
      else if (тип < 0.92) { кр2 = 0.80; зл2 = 0.68; си2 = 0.54; }
      else { кр2 = 0.88; зл2 = 0.88; си2 = 0.92; }
      var шум2 = 0.7 + Math.random() * 0.6;
      col[k * 3] = кр2 * свет * шум2;
      col[k * 3 + 1] = зл2 * свет * шум2;
      col[k * 3 + 2] = си2 * свет * шум2;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    var pts = new T.Points(geo, new T.PointsMaterial({
      /* Belt grains are positional cues, not luminous stars. Fixed
         pixel size keeps a near grain from blooming into a white
         translucent disc across a planet during an orbital shot. */
      color: color, size: size, sizeAttenuation: false, map: starDot,
      vertexColors: true,
      transparent: true, opacity: 0.58, depthWrite: false
    }));
    scene.add(pts);
    return pts;
  }
  /* Цвет материала поднят: он теперь не сам цвет камня, а множитель
     поверх запечённого. Средний по вершинам около трети, поэтому без
     подъёма пояс потемнел бы втрое. */
  var belt1 = beltLayer(tiny ? 500 : (particleBudget ? 700 : 1100), 1.0, 230, 0xe4e6e8);
  var belt2 = beltLayer(tiny ? 260 : (particleBudget ? 360 : 600), 1.55, 160, 0xf0e6d8);

  /* ── По поясу можно нажать ────────────────────────────────
     Пояс это россыпь точек, а луч подбора бьёт по точкам с порогом в
     одну единицу - попасть в такую крупинку нельзя. Замер это и
     показал: голограмма «АСТЕРОИДНЫЙ ПОЯС» висит, а клик по ней не
     делает ничего. Заказчик писал ровно про это: «астероиды и тд, и
     при клике видео».

     Ставим невидимое тело подбора - шар по размеру самого пояса, в
     его середине. Он ничего не рисует (visible = false рейкаст не
     останавливает, поэтому гасим материал прозрачностью и снимаем
     запись в буфер глубины), но нажатие ловит честно, и досье
     открывается по поясу так же, как по планете. */
  var beltPick = new T.Mesh(
    new T.SphereGeometry(190, 12, 8),
    new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  beltPick.position.set(1055, 45, -950);
  beltPick.renderOrder = -1;
  beltPick.userData.info = RU
    ? "АСТЕРОИДНЫЙ ПОЯС · миллионы обломков между Марсом и Юпитером"
    : "ASTEROID BELT · millions of fragments between Mars and Jupiter";
  beltPick.userData.mark = "belt";
  /* Мягкое тело: уступает дорогу всем настоящим. Шар в триста единиц
     стоит ровно на линии взгляда к внешней системе, и первый же
     замер после его появления показал, что он забирает себе нажатия
     по Сатурну, Юпитеру, Урану, Нептуну и дыре. Пояс отзывается
     только тогда, когда за ним нет никого другого. */
  beltPick.userData["мягкий"] = true;
  scene.add(beltPick);
  pickables.push(beltPick);

  /* Points describe the enormous belt; these instanced rocks are the
     nearby bodies the camera can actually pass. Every instance owns
     a position, asymmetric scale and angular velocity. They cast a
     changing silhouette in cabin light while remaining one draw call
     on mobile. */
  var rockField = (function () {
    var count = tiny ? 10 : (particleBudget ? 18 : 34);
    /* Икосаэдр с одним разбиением - это почти шар: восемьдесят
       треугольников, разложенных ровно. Проходя мимо, глаз читает
       мячик, а не обломок. Разбиение НЕ поднимаем (треугольники
       здесь и так не бесплатны) - вместо этого один раз при сборке
       смещаем вершины по трём синусоидам от их же направления.
       Форма становится рваной, счёт треугольников тот же, кадр не
       узнаёт об этом вовсе.

       Плоские нормали к этому в пару: у камня грани настоящие, и
       блик по ним должен ломаться, а не переливаться. */
    var камень = new T.IcosahedronGeometry(1, 1);
    (function () {
      var поз = камень.getAttribute("position");
      var цвета = new Float32Array(поз.count * 3);
      var i, x, y, z, дл, к;
      for (i = 0; i < поз.count; i++) {
        x = поз.getX(i); y = поз.getY(i); z = поз.getZ(i);
        дл = Math.sqrt(x * x + y * y + z * z) || 1;
        /* Размах смещения держим в пределах трети радиуса: дальше
           начинаются иглы, а габарит камня уезжает от того, по
           которому считался зазор маршрута. */
        к = 1 + 0.17 * Math.sin(x * 4.1 + 1.3) * Math.sin(y * 3.3 - 0.7)
              + 0.11 * Math.sin(z * 6.2 + 2.1)
              - 0.07 * Math.sin(x * 9.4 - y * 7.1 + z * 5.5);
        поз.setXYZ(i, x / дл * к, y / дл * к, z / дл * к);
        /* Пятнистость поверхности: у настоящего астероида светлые
           свежие сколы соседствуют с потемневшим от космоса грунтом.
           Ровно окрашенный камень читается пластмассой.

           Атрибут цвета обязателен ещё и технически: цвет ЭКЗЕМПЛЯРА
           доезжает до пикселя только когда у материала включены
           цвета вершин, а без самого атрибута камни вышли бы
           чёрными. */
        var п = 0.80 + 0.28 * Math.sin(x * 7.7 + y * 5.1 - z * 6.3)
                     + 0.10 * Math.sin(x * 17.3 - y * 13.9 + z * 15.1);
        цвета[i * 3] = п * 1.04;
        цвета[i * 3 + 1] = п;
        цвета[i * 3 + 2] = п * 0.94;
      }
      поз.needsUpdate = true;
      камень.setAttribute("color", new T.BufferAttribute(цвета, 3));
      камень.computeVertexNormals();
    })();
    var mesh = new T.InstancedMesh(
      камень,
      /* Цвет материала поднят: он теперь множитель над цветом породы
         и пятнистостью, а не сам цвет камня. Средняя яркость на
         пикселе осталась прежней, разброс между камнями появился.

         Признака flatShading здесь нарочно НЕТ, хотя грани нужны
         именно плоские. Икосаэдр не индексирован, и computeVertexNormals
         на неиндексированной сетке кладёт всем трём вершинам нормаль
         самой грани - то есть грани уже плоские. Флаг сверх этого не
         добавил бы ничего к виду, зато включил бы в шейдере расчёт
         нормали через производные экрана, а это лишняя работа на
         каждый пиксель камня. */
      new T.MeshPhongMaterial({ color: 0xb0a89e, shininess: 6, specular: 0x4a453f,
                                vertexColors: true }),
      count
    );
    var A = new T.Vector3(760, -120, -900), B = new T.Vector3(1350, 210, -1000);
    var items = [], mm = new T.Matrix4(), qq = new T.Quaternion(), ee = new T.Euler(), ss = new T.Vector3();
    var цв = new T.Color();
    var seedR = 27191;
    function rr() { seedR = (seedR * 1664525 + 1013904223) >>> 0; return seedR / 4294967296; }
    for (var ri = 0; ri < count; ri++) {
      var tR = .08 + rr() * .84;
      var pR = A.clone().lerp(B, tR);
      var aR = rr() * 6.283, dR = 42 + rr() * 150;
      pR.x += Math.cos(aR) * dR; pR.y += (rr() - .5) * 126; pR.z += Math.sin(aR) * dR;
      var baseR = 1.2 + Math.pow(rr(), 1.8) * 7.5;
      var itR = { p: pR, rx: rr() * 6.283, ry: rr() * 6.283, rz: rr() * 6.283,
        sx: (rr() - .5) * .28, sy: (rr() - .5) * .23, sz: (rr() - .5) * .19,
        s: new T.Vector3(baseR * (.7 + rr() * .7), baseR * (.55 + rr() * .65), baseR * (.65 + rr() * .8)) };
      ee.set(itR.rx, itR.ry, itR.rz); qq.setFromEuler(ee); ss.copy(itR.s); mm.compose(itR.p, qq, ss);
      mesh.setMatrixAt(ri, mm);
      /* Камни разной породы: три четверти углистые и почти чёрные,
         шестая часть каменных с рыжиной, остальное металлические и
         светлые. Тридцать четыре одинаково серых булыжника читались
         декорацией из одной формы. Цвет экземпляра рисуется тем же
         одним вызовом, что и вся россыпь. */
      var пор = rr();
      if (пор < 0.75) цв.setRGB(0.34, 0.32, 0.30);
      else if (пор < 0.92) цв.setRGB(0.62, 0.50, 0.38);
      else цв.setRGB(0.72, 0.72, 0.76);
      var я2 = 0.72 + rr() * 0.56;
      цв.multiplyScalar(я2);
      mesh.setColorAt(ri, цв);
      items.push(itR);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.items = items;
    mesh.userData.matrix = mm; mesh.userData.quaternion = qq; mesh.userData.euler = ee;
    scene.add(mesh);
    return mesh;
  })();

  этап("маршрут");
  /* ── Маршрут ──
     Кривая проходит через все сцены и заворачивает домой. Взгляд
     ведут точки интереса: у каждого отрезка своя цель, между ними
     камера плавно переводит глаза. */
  var path = new T.CatmullRomCurve3([
    new T.Vector3(0, 8, 150),
    new T.Vector3(120, 26, 60),
    new T.Vector3(96, 18, -120),
    new T.Vector3(-60, 4, -150),
    new T.Vector3(-130, 22, 10),
    new T.Vector3(-40, 34, 170),
    new T.Vector3(180, 52, 60),          /* отход от Земли */
    /* The Catmull curve bows inward between control points. The old
       nominal 80-unit clearance became 43 at the actual spline and
       entered the conservative collision envelope. Raise the fly-by
       over the lunar north pole: the Moon still fills the window but
       the hull now clears its safety corridor as well as its surface. */
    new T.Vector3(318, 105, -78),
    new T.Vector3(430, -10, -400),
    /* К Марсу дуга шла напролом: замер показал сближение до 14
       единиц при радиусе планеты 30, то есть корабль проходил
       НАСКВОЗЬ. Клиент это и заметил. Теперь маршрут огибает Марс
       сверху по дуге, планета крупно проходит под днищем. */
    new T.Vector3(500, -60, -620),       /* заход на Марс сверху */
    new T.Vector3(610, -55, -770),       /* проход над полюсом */
    new T.Vector3(700, -90, -900),       /* сход с Марса */
    new T.Vector3(1000, 40, -960),
    new T.Vector3(1400, 320, -930),      /* заход на Сатурн сверху */
    /* Здесь дуга проседала прямо в корпус Сатурна (13 единиц при
       радиусе 46). Точка над планетой держит корабль выше колец:
       кольца проходят под нами во всю ширину кадра, как и задумано */
    new T.Vector3(1570, 430, -1020),     /* проход над кольцами */
    new T.Vector3(1720, 290, -1250),     /* сход, кольца по борту */
    new T.Vector3(1900, -40, -1900),     /* подход к дыре */
    new T.Vector3(2260, -80, -2180),     /* дуга вокруг дыры */
    new T.Vector3(2300, -160, -2560),
    new T.Vector3(1860, -120, -2720),
    new T.Vector3(1000, 60, -1900),      /* гиперпрыжок домой */
    new T.Vector3(300, 90, -800),
    new T.Vector3(-60, 50, -290),
    new T.Vector3(-230, 30, -60),
    new T.Vector3(-170, 10, 170)         /* торможение: Земля по борту */
  ], false, "catmullrom", 0.12);

  /* Подписи и цели взгляда стояли на глазок и разъехались с фактом:
     кривая не тратит равные доли пути на равные куски пространства.
     Считаем честно: где дуга подходит к объекту ближе всего, там
     его сцена и есть. */
  function nearestP(target) {
    var best = 0, bd = 1e12;
    for (var k = 0; k <= 400; k++) {
      var pp = k / 400;
      var d = path.getPointAt(pp).distanceToSquared(target);
      if (d < bd) { bd = d; best = pp; }
    }
    return best;
  }
  var AT = {
    moon: nearestP(moon.position),
    mars: nearestP(mars.position),
    saturn: nearestP(saturn.position),
    hole: nearestP(hole.position),
    /* Новые тела стоят в стороне от режиссёрской дуги, поэтому их
       отметка - ближайшая точка маршрута. Корабль подходит на
       дистанцию видимости, а дальше выходит на виток вокруг тела. */
    sun: nearestP(sunBody.position),
    mercury: nearestP(mercury.position),
    venus: nearestP(venus.position),
    jupiter: nearestP(jupiter.position),
    uranus: nearestP(uranus.position),
    neptune: nearestP(neptune.position)
  };
  /* Пояс, комета и спутник тоже цели курса.

     На них показывают голограммы и по ним ставят задачу («астероиды
     и тд, и при клике видео»), но в этой таблице их не было: goTo
     выходил на первой же проверке, и клик по метке не делал ничего,
     а мусорная цель при этом оставалась в состоянии корабля. Теперь
     каждой есть куда лететь.

     Пояс - труба вдоль отрезка от окрестности Марса к Сатурну,
     берём её середину. Комета ходит по эллипсу, отмечаем её место
     на момент сборки: корабль выходит в эту область, комета к тому
     времени рядом. Спутник висит на низкой орбите Земли, значит
     его точка это сама Земля. */
  AT.belt = nearestP(new T.Vector3(1055, 45, -950));
  AT.comet = nearestP(comet.position);
  AT.sat = 0.03;
  AT.jump0 = Math.min(0.86, AT.hole + 0.05);
  AT.jump1 = Math.min(0.9, AT.jump0 + 0.27);

  var LOOKS = [
    { p: 0.00, at: new T.Vector3(0, 0, 0) },            /* Земля */
    { p: Math.max(0.08, AT.moon - 0.06), at: moon.position },
    { p: AT.moon + 0.03, at: moon.position },
    { p: AT.mars - 0.05, at: mars.position },
    { p: AT.mars + 0.03, at: mars.position },
    { p: AT.saturn - 0.05, at: saturn.position },
    { p: AT.saturn + 0.03, at: saturn.position },
    { p: AT.hole - 0.085, at: hole.position },
    { p: AT.hole + 0.03, at: hole.position },
    { p: AT.jump0 + 0.04, at: milky.position }, /* Млечный Путь - прыжок идёт сквозь его рукав */
    { p: AT.jump1, at: new T.Vector3(300, 90, -800) },  /* по ходу прыжка */
    /* Домой камера разворачивается сразу за прыжком, а не через
       восемь процентов маршрута. Пока Земля появлялась только на
       0.94, весь участок после туннеля человек летел в пустоту с
       подписью «ДОМА» над ней - и написал ровно это: «в пустоте
       где-то останавливается». */
    { p: Math.min(0.94, AT.jump1 + 0.02), at: new T.Vector3(0, 0, 0) }
  ];

  /* Подписи встают на те же честные отметки. Сцены могут стоять
     тесно, поэтому после расстановки наводим монотонность: каждая
     следующая подпись не раньше предыдущей плюс шаг. */
  CAPTIONS[1].p = Math.max(0.06, AT.moon - 0.045);
  CAPTIONS[2].p = AT.moon + 0.04;
  CAPTIONS[3].p = AT.mars - 0.04;
  CAPTIONS[4].p = AT.saturn - 0.05;
  CAPTIONS[5].p = AT.hole - 0.05;
  CAPTIONS[6].p = AT.jump0;
  CAPTIONS.splice(7, 0, { p: AT.jump0 + 0.09,
    t: RU ? "МЛЕЧНЫЙ ПУТЬ · 200 млрд звёзд, ваши пользователи ближе" : "MILKY WAY · 200B stars, your users are closer" });
  CAPTIONS.splice(8, 0, { p: AT.jump0 + 0.19,
    t: RU ? "ДРУГОЙ РУКАВ ГАЛАКТИКИ · дом уже виден" : "ANOTHER GALACTIC ARM · home is in sight" });
  CAPTIONS[9].p = AT.jump1 + 0.02;
  for (var ci = 1; ci < CAPTIONS.length; ci++) {
    if (CAPTIONS[ci].p < CAPTIONS[ci - 1].p + 0.03) CAPTIONS[ci].p = CAPTIONS[ci - 1].p + 0.03;
  }

  /* Той же монотонности требует и график взгляда */
  for (var li = 1; li < LOOKS.length; li++) {
    if (LOOKS[li].p < LOOKS[li - 1].p + 0.015) LOOKS[li].p = LOOKS[li - 1].p + 0.015;
  }

  /* Цели сканера: что прибор умеет вести. Имя короткое - оно
     горит над рамкой захвата. */
  var scanTargets = [
    { o: earth, name: RU ? "ЗЕМЛЯ" : "EARTH", key: "earth" },
    { o: moon, name: RU ? "ЛУНА" : "MOON", key: "moon" },
    { o: mars, name: RU ? "МАРС" : "MARS", key: "mars" },
    { o: saturn, name: RU ? "САТУРН" : "SATURN", key: "saturn" },
    { o: hole, name: СЛ("дыраТитул"), key: "hole" },
    { o: comet, name: RU ? "КОМЕТА RC/2026" : "COMET RC/2026", key: "comet" },
    { o: sat, name: "RC-SAT", key: "sat" },
    { o: belt1, name: RU ? "АСТЕРОИДНЫЙ ПОЯС" : "ASTEROID BELT", key: "belt" },
    { o: milky, name: RU ? "МЛЕЧНЫЙ ПУТЬ" : "MILKY WAY", key: "milky" },
    { o: gal2, name: RU ? "ПОЛЕ KEPLER" : "KEPLER FIELD", key: "gal2" },
    { o: gal3, name: RU ? "ПОЛЕ TESS" : "TESS FIELD", key: "gal3" },
    { o: sunBody, name: RU ? "СОЛНЦЕ" : "SUN", key: "sun" },
    { o: mercury, name: RU ? "МЕРКУРИЙ" : "MERCURY", key: "mercury" },
    { o: venus, name: RU ? "ВЕНЕРА" : "VENUS", key: "venus" },
    { o: jupiter, name: RU ? "ЮПИТЕР" : "JUPITER", key: "jupiter" },
    { o: uranus, name: RU ? "УРАН" : "URANUS", key: "uranus" },
    { o: neptune, name: RU ? "НЕПТУН" : "NEPTUNE", key: "neptune" }
  ];
  /* Один ключ на тело для обоих приборов: сканер берёт его из
     списка, наведение - с самого объекта. Иначе Марс попадал в
     журнал дважды под разными именами. */
  for (var см = 0; см < scanTargets.length; см++) {
    scanTargets[см].o.userData.mark = scanTargets[см].key;
  }

  этап("тела");
  /* ── Твёрдые тела ────────────────────────────────────────────
     Клиент прислал замечание: «чтобы ракета сквозь планеты не
     летала». Здесь перечень того, во что можно упереться: центр,
     радиус корпуса и радиус, с которого начинается манёвр обхода.
     Кольца Сатурна тоже считаются препятствием - сквозь них
     корабль пролетать не должен, он их огибает сверху.
     Дыра особая: у неё не отбойник, а притяжение с точкой невозврата. */
  var bodies = [
    { o: earth,  r: 60, name: RU ? "ЗЕМЛЯ" : "EARTH" },
    { o: moon,   r: 16, name: RU ? "ЛУНА" : "MOON" },
    { o: mars,   r: 30, name: RU ? "МАРС" : "MARS" },
    { o: saturn, r: 46, ring: 116, name: RU ? "САТУРН" : "SATURN" },
    { o: hole,   r: 30, hole: true, name: СЛ("дыраТитул") }
  ,
    /* Новые тела системы: сквозь Солнце и гигантов корабль тоже не
       летает - обходит, как Марс и Сатурн */
    { o: sunBody, r: 205, name: RU ? "СОЛНЦЕ" : "SUN" },
    { o: mercury, r: 15, name: RU ? "МЕРКУРИЙ" : "MERCURY" },
    { o: venus, r: 32, name: RU ? "ВЕНЕРА" : "VENUS" },
    { o: jupiter, r: 130, name: RU ? "ЮПИТЕР" : "JUPITER" },
    { o: uranus, r: 70, name: RU ? "УРАН" : "URANUS" },
    { o: neptune, r: 66, name: RU ? "НЕПТУН" : "NEPTUNE" }];

  /* Оптика и шлейф - украшение, а не механика. На просьбе меньше
     движения и на упрощённых режимах страницы их просто нет: игра
     обязана остаться играбельной, а не красивой любой ценой.
     Порог тот же, что у фонового космоса: со второй ступени
     упрощения страница уже призналась, что не тянет. */
  var wantFx = !reduced &&
    (parseInt(root.getAttribute("data-degrade") || "0", 10) || 0) < 2;

  этап("реализм");
  /* ── Слой реализма ────────────────────────────────────────
     Сцена получает окружение: панораму с солнцем, Землёй и полосой
     Галактики. Без неё металлу нечего отражать, и любая обшивка
     выглядит залитой цветом. Композер поверх даёт то, чем кадр
     кино отличается от вывода отладчика: кривую, свечение ламп,
     виньетку и зерно. На слабом устройстве свечение отпадает само,
     мир при этом остаётся - выключать 3D ради скорости нельзя. */
  var post = null;
  if (g.RC_REAL) {
    try {
      var envTex = g.RC_REAL.env(T, r, true);
      if (envTex) { scene.environment = envTex; }
      /* Экспозиция чуть ниже единицы и глубокая виньетка: на
         референсах кадр тёмный, свет собран в пятна, а не размазан
         по всей площади. Ровно освещённая сцена читается макетом. */
      post = g.RC_REAL.post(T, r, {
        exposure: 1.14, bloom: 0.66, bloomLow: 0.40,
        threshold: 0.66, vignette: 1.22, grain: 0.020, aberration: 2.2
      });
    } catch (eReal) { post = null; }
  }

  этап("конец");
  if (DBG) { try { console.table(ЭТАПЫ); } catch (eТ) {} }

  return {
    fx: wantFx, post: post, sunLight: sun,
    r: r, scene: scene, cam: cam, path: path, looks: LOOKS, at: AT, fov0: FOV0, scanTargets: scanTargets,
    bodies: bodies,
    milky: milky, gal2: gal2, gal3: gal3,
    comet: comet, sat: sat, belt1: belt1, belt2: belt2, rockField: rockField,
    galacticVolume: galacticVolume, dust: dust, wash: wash, washN: washN,
    nebSprites: nebSprites, starMats: starMats, sunGlow: sunGlow, amb: amb, mob: mob,
    earth: earth, atmMat: atmMat, clouds: clouds, moon: moon, mars: mars, saturn: saturn, hole: hole,
    /* pickablesAll это полный список тел, включая скрытые рукава;
       pickables - рабочий, под текущий рукав. Новый мир начинает с
       чистого полного списка, иначе в нём остались бы ссылки на
       разобранную сцену. */
    diskMat: diskMat, jump: jump, sky: sky, pickables: pickables, pickablesAll: null,
    /* Позиция светила: по ней бортовые панели набирают заряд */
    sunPos: sunGlow.position, corIn: corIn, corOut: corOut,
    starShell: starShell,
    /* Оболочки атмосфер и точка солнца отдаются наружу: кадр
       обновляет по ним направление на светило. */
    atmShells: atmShells,
    /* Узлы-реле отдаём наружу: их надо гасить в чужих рукавах. */
    relaySprites: relaySprites, relayLine: relayLine,
    ringMat: ringMatS,
    "СОЛНЦЕ": СОЛНЦЕ,
    sunMat: sunBody.material,
    sun: sunBody, mercury: mercury, venus: venus, solarLive: solarLive,
    jupiter: jupiter, uranus: uranus, neptune: neptune, belt: belt,
    tmpA: new T.Vector3(), tmpB: new T.Vector3(), tmpQ: new T.Quaternion(), tmpM: new T.Matrix4()
  };
}

/* ── Управление ──────────────────────────────────────────────ы */
/* Обзор мышью: состояние жеста живёт на уровне модуля.

   Оконный pointerup вешается один раз за жизнь страницы, а
   pointerdown и pointermove - на обёртку, которая пересобирается
   после каждой смены языка. Пока эти переменные были внутри
   bindControls, они раздваивались: нажатие писало в новые, отпуск
   читал старые. Обзор залипал навсегда, а нажатие по планете
   считалось от чужой точки и досье не открывалось - «планета не
   кликается» ровно оттуда. */
var drag = false, dX = 0, dY = 0;
var downX = 0, downY = 0, downOK = false;

function bindControls() {
  var w = ui.wrap;

  w.addEventListener("wheel", function (e) {
    /* В режиме финальной сцены это всё ещё прокрутка сайта. Обёртка
       не должна съедать колесо даже если жест начался за кадр до
       переключения stage. */
    if (F.stage) return;
    /* Колесо внутри открытой панели листает панель, а не гонит
       корабль. У касания эта защита была с самого начала, у колеса
       её не было: на ноутбуке 1024x600 в меню КУРС четыре карточки
       вселенных обрезаны снизу, и добраться до них было нечем -
       ровно то, на что жаловался владелец словами «я так и не понял,
       как перейти в Млечный путь». В справке тем же способом
       отрезались СТОП, ВЫХОД и ЗВУК. */
    if (вПанели(e)) return;

    /* Выход из финала тем же движением, каким вошли.

     В финале игра включается сама - так и задумано, заказчик просил
     бесшовный стык: «отдалились, появилась надпись старта, дальше
     врубается игра». Но обратного жеста не было вовсе. Приёмка
     показала беду ровно так: доехав до низа, колесо вверх не делает
     НИЧЕГО, сорок попыток подряд прокрутка стоит на месте. Выйти
     можно было только крестиком, если его заметить.

     Теперь настойчивая прокрутка вверх возвращает на страницу.
     Настойчивая - значит накопленная: один случайный щелчок колеса
     полёт не закроет, нужно осознанное движение вверх подряд. Вниз
     копить нечего, там человек ускоряет корабль.

     Только для входа из финала: тот, кто нажал «Полёт» посреди
     страницы, выходит крестиком - он никуда и не прокручивался. */
    if (e.deltaY < 0 && F["изФинала"]) {
      F["вверхНакоп"] = (F["вверхНакоп"] || 0) + (-e.deltaY);
      if (F["вверхНакоп"] > 260) {
        F["вверхНакоп"] = 0;
        e.preventDefault();
        close();
        /* Ставим человека чуть выше стыка, чтобы он увидел страницу,
           а не тот же кадр, из которого только что вышел. */
        try {
          var док = doc.documentElement.scrollHeight - innerHeight;
          scrollTo(0, Math.max(0, док - innerHeight * 1.15));
        } catch (eS) {}
        return;
      }
    } else if (e.deltaY > 0) {
      F["вверхНакоп"] = 0;
    }

    e.preventDefault();
    /* С шифтом колесо приближает, а не разгоняет. Зум нужен там,
       где тяга бесполезна: разглядеть кольца Сатурна с орбиты, не
       врезаясь в них. Держим его отдельно от объектива сцены -
       обратно он всегда возвращается сам. */
    /* В салоне приближения нет вовсе. Владелец: «функция приближения
       в салоне не нужна, она только в игре». Там кадр ведёт прокрутка
       страницы, и второй, независимый от неё зум ломал и подъезд, и
       ощущение помещения. */
    if (e.shiftKey && !F.stage) {
      F.zoom = Math.max(0, Math.min(1, (F.zoom || 0) - e.deltaY * 0.0012));
      return;
    }
    F.v += e.deltaY * 0.0001;
    manual();
  }, { passive: false });

  /* ── Свободный обзор ────────────────────────────────
     «Добавь возможность на 360 крутить пальцем или мышкой в космосе
     смотреть, чтобы обзор был» - дословно. Обзор здесь двух родов,
     и путать их нельзя:

       лёгкий - курсор просто ходит по экрану, картинка отзывается
                на пару градусов. Это ощущение живой камеры.
       полный - палец ведут по стеклу или мышь тянут с зажатой
                кнопкой. Тогда угол копится без предела: можно
                обернуться назад и посмотреть, откуда прилетели.

     Полный обзор не сбрасывается сам по себе - человек сам решает,
     когда вернуться на курс. Возвращает его тяга: дал газ - взгляд
     плавно сходится к направлению полёта, как у настоящего пилота.

     Жест на телефоне делится по первому движению: повели больше
     вверх-вниз - это тяга, больше вбок - это обзор. Иначе каждый
     свайп разгонял бы корабль заодно с поворотом головы. */
  var tY = null, tX = null, tAxis = 0, tSum = 0, pinch = 0;
  function pinchDist(e) {
    var a = e.touches[0], b = e.touches[1];
    var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  /* Палец, начавший движение внутри прокручиваемой панели, ведёт
     список, а не корабль. Без этой проверки свайп по меню КУРСа
     разгонял корабль, а список стоял на месте. */
  function вПанели(e) {
    var t = e.target;
    return !!(t && t.closest && t.closest(".rcf-menu, .rcf-dos-in, .rcf-help-in"));
  }
  w.addEventListener("touchstart", function (e) {
    if (F.stage || вПанели(e)) { tY = tX = null; tAxis = 0; pinch = 0; return; }
    /* Два пальца - щипок: приближает, а не разгоняет. Тот же зум,
       что на ПК даёт шифт с колесом. */
    if (e.touches.length > 1) { pinch = pinchDist(e); return; }
    pinch = 0;
    if (e.touches.length) { tY = e.touches[0].clientY; tX = e.touches[0].clientX; tAxis = 0; tSum = 0; }
  }, { passive: true });
  w.addEventListener("touchmove", function (e) {
    if (F.stage || вПанели(e)) return;

    /* Выход из финала жестом. Блок здесь был, но читал e.deltaY -
       свойство КОЛЕСА, которого у касания нет. Оба сравнения с
       undefined всегда ложны, и выйти с телефона можно было только
       крестиком, хотя комментарий обещал обратное. Считаем по
       самому касанию, ниже, там где уже известен ход пальца. */

    e.preventDefault();
    if (e.touches.length > 1) {
      var d2 = pinchDist(e);
      /* Щипок приближает только в игре: в салоне зума нет */
      if (pinch && !F.stage) F.zoom = Math.max(0, Math.min(1, (F.zoom || 0) + (d2 - pinch) * 0.004));
      pinch = d2;
      hideHint();
      return;
    }
    if (!e.touches.length) return;
    var y = e.touches[0].clientY, x = e.touches[0].clientX;
    if (tY !== null) {
      var dy = tY - y, dx = x - tX;
      tSum += Math.abs(dx) + Math.abs(dy);
      /* Ось выбираем один раз за жест и только когда движение
         стало заметным: на первых двух пикселях направление случайно */
      if (!tAxis && tSum > 14) tAxis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 1 : 2;
      if (tAxis === 1) {
        F.look.tx += dx * 0.006;
        F.look.ty += dy * 0.0022;
        F.free = true;
        clampLook();
      } else if (tAxis === 2) {
        F.v += dy * 0.00016;
        manual();
        /* Палец ведут вниз - человек тянет страницу назад, туда,
           откуда пришёл. Тем же движением и гасится ход. Один
           случайный сдвиг полёт не закроет: нужен осознанный
           жест, набранный подряд. Только для входа из финала -
           тот, кто нажал «Полёт» посреди страницы, выходит
           крестиком, он никуда не прокручивался. */
        if (F["изФинала"]) {
          if (dy < 0) {
            F["вверхНакоп"] = (F["вверхНакоп"] || 0) + (-dy);
            if (F["вверхНакоп"] > 300) {
              F["вверхНакоп"] = 0;
              close();
              try {
                var док2 = doc.documentElement.scrollHeight - innerHeight;
                scrollTo(0, Math.max(0, док2 - innerHeight * 1.15));
              } catch (eS2) {}
              return;
            }
          } else if (dy > 0) {
            F["вверхНакоп"] = 0;
          }
        }
      }
    }
    tY = y; tX = x;
    hideHint();
  }, { passive: false });
  w.addEventListener("touchend", function () { tY = tX = null; tAxis = 0; pinch = 0; }, { passive: true });

  w.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    F.mx = (e.clientX / innerWidth) * 2 - 1;
    F.my = -(e.clientY / innerHeight) * 2 + 1;
    if (drag) {
      F.look.tx += (e.clientX - dX) * 0.005;
      F.look.ty += (e.clientY - dY) * 0.0032;
      dX = e.clientX; dY = e.clientY;
      F.free = true;
      clampLook();
      hideHint();
      return;
    }
    /* Пока кнопка не зажата, свободный угол не трогаем: иначе,
       обернувшись назад, человек терял бы обзор от любого
       движения мыши */
    /* Доворот вслед за мышью замирает, как только курсор встал на
       тело. Раньше он работал всегда, и получалась ловушка: человек
       ведёт курсор к планете, камера доворачивается в ту же сторону,
       планета уезжает. От центра к краю кадра выходило до
       четырнадцати градусов, при поле зрения под сотню это около
       двухсот точек сдвига - в мелкое тело попасть было нельзя в
       принципе. Теперь на подлёте к телу картинка встаёт, и
       прицелиться можно.

       Заодно убавлен размах: половина радиана по горизонту это
       двадцать восемь градусов на ширину экрана, слишком много для
       живого кадра. Оставляем чуть больше половины - обзор
       по-прежнему ведётся мышью, но не борется с рукой. */
    if (!F.free && !F["наТеле"]) {
      F.look.tx = (e.clientX / innerWidth - 0.5) * 0.28;
      F.look.ty = (e.clientY / innerHeight - 0.5) * 0.17;
    }
  }, { passive: true });
  /* На тачскрине справочник вызывает касание */
  /* Нажатие и перетаскивание - разные жесты одной кнопки. Досье
     открывает только чистое нажатие: если между нажатием и отпуском
     палец прошёл больше нескольких пикселей, это был обзор, и карту
     снимать не надо. */
  w.addEventListener("pointerdown", function (e) {
    F.mx = (e.clientX / innerWidth) * 2 - 1;
    F.my = -(e.clientY / innerHeight) * 2 + 1;
    downX = e.clientX; downY = e.clientY;
    downOK = !(e.target.closest && e.target.closest(".rcf-hud, .rcf-dos, .rcf-uni, button, a"));
    if (e.pointerType !== "touch" && downOK) {
      drag = true; dX = e.clientX; dY = e.clientY;
      w.classList.add("rcf-drag");
    }
  }, { passive: true });
  /* Оконные слушатели вешаются ОДИН раз за жизнь страницы.

     bindControls зовётся из buildUI, а buildUI пересобирается после
     каждой смены языка. Снятия у этих подписок не было, и они
     копились: после «открыл, закрыл, сменил язык, открыл» одно
     нажатие стрелки исполняло разгон дважды, потом трижды. Тело
     обработчиков смотрит только в F и ui, а те живут дольше обёртки,
     поэтому одной подписки хватает навсегда. */
  if (!bindControls.окноГотово) {
    bindControls.окноГотово = true;
  addEventListener("pointerup", function (e) {
    drag = false;
    if (ui.wrap) ui.wrap.classList.remove("rcf-drag");
    if (!downOK || !F.open) return;
    var moved = Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY);
    if (moved > 7) return;
    F.mx = (e.clientX / innerWidth) * 2 - 1;
    F.my = -(e.clientY / innerHeight) * 2 + 1;
    /* Считаем тут же. Флаг оставляем на случай, если мир ещё не
       собран: тогда сработает прежний путь через кадр. */
    if (!нажатиеПоТелу(e.clientX, e.clientY)) F.pick = true;
  }, { passive: true });

  addEventListener("keydown", function (e) {
    if (!F.open) return;
    /* Escape над открытым окном сайта принадлежит окну: раньше одно
       нажатие закрывало и окно, и сцену, а фокус после этого уходил
       в начало документа. */
    if (e.key === "Escape") {
      var окно = doc.querySelector(".modal.on");
      if (окно) return;
      /* Escape закрывает то, что открыто сверху, а не всё сразу.
         Раньше одно нажатие над открытой справкой выкидывало из
         полёта целиком, а сама справка оставалась включённой и
         встречала человека при следующем заходе. */
      if (закрытьВерхнее()) { e.preventDefault(); return; }
      close();
      return;
    }
    /* Рычаг тяги - штатное клавиатурное управление, у него свой
       обработчик стрелок. Нажатие с него всплывает на окно, и оба
       срабатывали на одно нажатие: рычаг прибавлял тягу, окно тут же
       вычитало ход. Корабль дёргался назад на «прибавить», а полоска
       показывала обратное тому, что он делает. */
    var где = e.target && e.target.closest ? e.target : null;
    /* Пробел принадлежит тому, что в фокусе: на кнопке он её нажимает.
       Раньше пробел на клавише СТОП не нажимал её, а прибавлял ход -
       человек жал «остановиться», и корабль разгонялся. */
    /* Пробел отдаём и полям ввода: в режиме сцены полёт «открыт», и
       обработчик доставал до формы на голограмме пульта - пробел в
       имени просто не набирался, слова слипались. */
    var наКнопке = где && где.closest("button, a[href], [role='button'], input, textarea, select, [contenteditable]");
    /* Стрелки забирает только то, что само их разбирает: рычаг тяги
       и поля ввода. Отдавать их каждой кнопке нельзя - фокус в полёте
       почти всегда стоит на кнопке (сам вход ставит его на крестик), и
       тяга с клавиатуры получалась мёртвой на тринадцати остановках
       обхода из пятнадцати, вопреки строке в справке про стрелки. */
    var стрелкиНеНаши = где && где.closest(".rcf-thr, input, select, textarea");
    /* Стрелки идут в ту же сторону, что и рычаг: вверх прибавить ход,
       вниз убавить. Раньше окно и рычаг понимали их наоборот - вверх
       вне рычага давало задний ход, вверх на рычаге прибавляло тягу,
       и человек не мог понять, что делает его же клавиша. */
    if (e.key === " ") {
      if (наКнопке) return;
      F.v += 0.14; e.preventDefault(); manual();
      return;
    }
    if (стрелкиНеНаши) return;
    if (e.key === "ArrowUp" || e.key === "PageUp") {
      F.v += 0.14; e.preventDefault(); manual();
    }
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      F.v -= 0.14; e.preventDefault(); manual();
    }
  });

  addEventListener("resize", function () { size(); cabSrc(); }, { passive: true });
  }
}

/* ── Кто на самом деле под курсором ──────────────────────────
   Две беды ловятся здесь, обе владелец назвал одним словом
   «планеты не нажимаются».

   Первая: спрайт. Ядро галактики это плоский квадрат со
   светящимся пятном посередине, и квадрат у Млечного Пути
   размером сто восемьдесят единиц мира. Луч видит весь квадрат,
   человек - только пятно в его середине, поэтому нажатие в пустоту
   рядом с галактикой открывало галактику, а тело ЗА ней перехватывал
   тот же квадрат. Считаем спрайт задетым, только если луч прошёл
   близко к его середине.

   Вторая: тела едут. Замер дал ход в сорок-четыреста семьдесят
   девять пикселей за полсекунды, а палец и мышь целятся в то, что
   видели мгновение назад. Точный луч в такой картине промахивается
   честно и бесполезно. Поэтому, если луч не нашёл ничего, берём
   ближайшее к курсору тело в пределах пальца - так же, как это
   делает любая карта с точками. */
var _вспВ = null, _вспЭ = null;
function лучЗадел(луч, o) {
  /* Не спрайт - обычное пересечение, ему верим как есть */
  if (!o.isSprite) return true;
  var T = g.THREE;
  if (!_вспВ) _вспВ = new T.Vector3();
  o.getWorldPosition(_вспВ);
  /* Половина квадрата это его натуральный радиус, а светится в нём
     примерно две трети - на остальном спрайт уже прозрачный. */
  var r = Math.max(o.scale.x, o.scale.y) * 0.5 * 0.62;
  if (!(r > 0)) return true;
  return луч.ray.distanceToPoint(_вспВ) <= r;
}

/* Ближайшее к точке экрана тело, если луч не попал ни в кого */
function телоРядом(px, py) {
  var T = g.THREE, сп = (W3 && W3.pickables) || [];
  if (!сп.length || !W3.cam) return null;
  if (!_вспЭ) _вспЭ = new T.Vector3();
  /* Допуск с палец: на телефоне он же и есть пятно касания */
  var допуск = Math.max(38, Math.min(innerWidth, innerHeight) * 0.055);
  var лучший = null, лучшееD = допуск + 1, лучшаяГл = 0;
  for (var i = 0; i < сп.length; i++) {
    var o = сп[i];
    if (!o || !o.userData || !o.userData.info) continue;
    if (o.userData["мягкий"]) continue;
    if (!видимоЛи(o)) continue;
    o.getWorldPosition(_вспЭ);
    _вспЭ.project(W3.cam);
    /* z вне отрезка [-1,1] это «за спиной» либо за дальней кромкой */
    if (_вспЭ.z < -1 || _вспЭ.z > 1) continue;
    var sx = (_вспЭ.x * 0.5 + 0.5) * innerWidth;
    var sy = (-_вспЭ.y * 0.5 + 0.5) * innerHeight;
    var d = Math.sqrt((sx - px) * (sx - px) + (sy - py) * (sy - py));
    if (d > допуск) continue;
    /* Ближе к курсору важнее; на равном расстоянии выигрывает то,
       что ближе к кораблю - за дальним человек не целился. */
    if (d < лучшееD - 2 || (Math.abs(d - лучшееD) <= 2 && _вспЭ.z < лучшаяГл)) {
      лучший = o; лучшееD = d; лучшаяГл = _вспЭ.z;
    }
  }
  return лучший;
}

/* ── Нажатие по телу считается СРАЗУ ─────────────────────────
   Раньше нажатие только поднимало флаг, а луч пускал кадр - и не
   ближайший, а тот, в котором подошла очередь дорогой проверки
   пересечений (восемь раз в секунду). Всё это время камеру
   доворачивала мышь, и луч уходил уже из другого ракурса: замер
   живыми кликами дал попадание луча из точки клика и при этом
   закрытое досье. Человек видит это как «планета не кликается».

   Считаем здесь же, в обработчике отпускания: камера ровно та, в
   которой нарисован кадр перед глазами, а курсор ровно там, куда
   нажали. Между тем, что видно, и тем, что подбирается, не остаётся
   ни одного кадра. */
function нажатиеПоТелу(px, py) {
  if (!W3 || !W3.cam || !g.THREE) return false;
  var T = g.THREE;
  if (!нажатиеПоТелу.луч) нажатиеПоТелу.луч = new T.Raycaster();
  нажатиеПоТелу.луч.setFromCamera(
    { x: (px / innerWidth) * 2 - 1, y: -(py / innerHeight) * 2 + 1 }, W3.cam);
  var hits = нажатиеПоТелу.луч.intersectObjects(W3.pickables || [], false);
  var инфо = null, кто = null, мИнфо = null, мКто = null;
  for (var i = 0; i < hits.length; i++) {
    var o = hits[i].object;
    if (!видимоЛи(o)) continue;
    if (!o.userData || !o.userData.info) continue;
    if (!лучЗадел(нажатиеПоТелу.луч, o)) continue;
    /* Мягкие оболочки (пояс) уступают настоящим телам */
    if (o.userData["мягкий"]) { if (!мИнфо) { мИнфо = o.userData.info; мКто = o; } continue; }
    инфо = o.userData.info; кто = o; break;
  }
  /* Порядок разбора важен. Сначала точное попадание в настоящее
     тело, потом ближайшее к курсору настоящее тело, и только затем
     мягкая оболочка вроде пояса астероидов. Пока оболочка стояла
     второй, она забирала нажатие себе: замер живыми кликами дал
     «жали ЛУНА - открылся АСТЕРОИДНЫЙ ПОЯС» дважды подряд. */
  if (!инфо) {
    var рядом = телоРядом(px, py);
    if (рядом) { кто = рядом; инфо = рядом.userData.info; }
  }
  if (!инфо && мИнфо) { инфо = мИнфо; кто = мКто; }
  if (!инфо) { dosClose(); return false; }
  dosOpen(кто, инфо);
  F.infoUntil = (g.performance && g.performance.now ? performance.now() : 0) + 4200;
  hideHint();
  if (!(кто.userData && кто.userData["реле"])) {
    noteExplored(меткаТела(кто) || инфо.split(" · ")[0]);
  }
  return true;
}

var hintHidden = false, hintT = 0;
function hideHint() {
  if (hintT) { clearTimeout(hintT); hintT = 0; }
  if (hintHidden || !ui.hint) return;
  hintHidden = true;
  ui.hint.classList.add("off");
}

/* ── Плотность кадра меняется только здесь ───────────────────
   Раньше её ставили в трёх местах прямым setPixelRatio. Это тихая
   ошибка: цели постобработки считают свой размер от плотности
   рендерера и пересчитываются только в size(), а size() при смене
   плотности никто не звал. Значит сцена рисовалась в буфер прежнего
   размера, а сводилась на холст нового - кадр растягивался ровно на
   отношение плотностей. Заметить это на глаз тем труднее, чем ближе
   отношение к единице, но на переходе салон-игра оно доходило до
   1.35 против 2.0.

   Здесь пересчитываются и холст, и цели, и делается это одним
   вызовом. Поле зрения и геометрия пульта не трогаются нарочно:
   они от плотности не зависят, а пересобирать их на каждой ступени
   регулятора значило бы платить за плавность рывками. */
function плотность(v) {
  if (!W3 || !W3.r) return;
  var нов = Math.max(0.5, Math.min(4, v || 1));
  if (Math.abs(W3.r.getPixelRatio() - нов) < 0.005) return;
  W3.r.setPixelRatio(нов);
  W3.r.setSize(innerWidth, innerHeight, false);
  if (W3.post) { try { W3.post.setSize(innerWidth, innerHeight); } catch (eП) {} }
}

function size() {
  if (!W3 || !F.open) return;
  deckSkinSoon();
  var w = innerWidth, h = innerHeight;
  W3.r.setSize(w, h, false);
  if (W3.post) { try { W3.post.setSize(w, h); } catch (e) {} }
  W3.cam.aspect = w / h;
  W3.fov0 = baseViewFov(w, h);
  W3.cam.fov = W3.fov0;
  W3.cam.updateProjectionMatrix();
  cabGeom();
}

/* ── Приборы садятся в ниши корпуса ──────────────────────────
   На рисунке кабины уже нарисованы консоли: левая, центральная,
   правая и боковые стойки. Раньше приборы висели по углам кадра
   сами по себе, и владелец сказал прямо: «кнопки развернуть узел,
   сканировать и так далее - все они наклеены не красиво, не часть
   интерфейса, ещё и криво».

   Здесь рисунок и разметка договариваются о местах. Доли ниш
   замерены по самому файлу; корпус выводится по object-fit: cover,
   поэтому доли пересчитываются в кадр с учётом обрезки и уходят в
   CSS-переменные. Приборы встают в ниши на любом экране, а не
   «примерно снизу». */
function cabGeom() {
  if (!ui.wrap) return;
  /* Границы берём у настоящей рамы, а не у пропорций отменённого
     рисунка кабины. rc-console строит раму по долям кадра и знает
     свои кромки точно, поэтому голограмма ложится ровно внутрь
     стекла на любом экране.

     Требование заказчика дословно: «все окна надписи и тд = как на
     окне, окно = экран с голограммами». Значит ни одно всплывающее
     окно не имеет права заехать на раму - ни на телефоне, ни на
     широком мониторе. */
  var C = g.RC_PANEL;
  var last = C && C.last;
  /* Берём вписанный прямоугольник, а не габарит проёма: проём
     восьмиугольный, и по габариту всплывающее окно заезжало бы на
     срезанные углы рамы. */
  var sf = last ? last.safe : { l: -0.78, r: 0.78, b: -0.66, t: 0.90 };
  var ib = last ? last.inner.b : -0.66;
  var pad = 0.012;
  var wx = (1 + sf.l) / 2 + pad;
  var ww = (sf.r - sf.l) / 2 - pad * 2;
  var wy = (1 - sf.t) / 2 + pad;
  var wh = (sf.t - sf.b) / 2 - pad * 2;
  /* Доля кадра сверху вниз, а не доля NDC.

     Тут стоял (1 + ib) / 2, и это переворачивало плиту: нижняя
     кромка проёма лежит в NDC на минус 0.6, что в долях кадра
     сверху даёт 0.8, а формула давала 0.2. Приборная плита
     разметки садилась на пятую часть сверху и растягивалась во всю
     ширину поперёк окна - та самая лента, которая шла по космосу и
     заезжала на стойки. */
  var dy = (1 - ib) / 2;
  var dh = 1 - dy;
  var S = ui.wrap.style;
  S.setProperty("--cab-wx", (wx * 100).toFixed(2) + "%");
  S.setProperty("--cab-wy", (wy * 100).toFixed(2) + "%");
  S.setProperty("--cab-ww", (ww * 100).toFixed(2) + "%");
  S.setProperty("--cab-wh", (wh * 100).toFixed(2) + "%");
  /* Отдельная пара для слоёв разметки.

     Остекление в альбомной ориентации честно уходит выше кадра:
     стекло выше экрана, и доля сверху получается отрицательной. Раме
     это ничего не портит, а вот слой приборов, метки тел и карточки
     шли за ней и оказывались над верхней кромкой - на 900 на 412
     подписи ЛУНА и МАРС стояли целиком за кадром, а «КАК ЛЕТАТЬ»
     начиналась срезанной.

     Поэтому разметке отдаём прижатый к кадру верх и высоту, ужатую
     ровно на столько же: нижняя кромка остаётся там, где была. */
  var hy = Math.max(0, wy);
  var hh = Math.max(0.2, wy + wh - hy);
  S.setProperty("--cab-hy", (hy * 100).toFixed(2) + "%");
  S.setProperty("--cab-hh", (hh * 100).toFixed(2) + "%");
  S.setProperty("--cab-dx", "0%");
  S.setProperty("--cab-dy", (dy * 100).toFixed(2) + "%");
  S.setProperty("--cab-dw", "100%");
  S.setProperty("--cab-dh", (dh * 100).toFixed(2) + "%");
  /* Контур проёма готовой строкой: слои, растянутые на весь кадр
     (метки тел, титры), режутся по нему и не выходят на раму. */
  if (last && last.clip) {
    S.setProperty("--cab-clip", last.clip);
    doc.documentElement.style.setProperty("--cab-clip", last.clip);
  }
}

/* ── Кадр ────────────────────────────────────────────────────ы */
/* ── Манёвр обхода ───────────────────────────────────────────
   «Чтобы ракета сквозь планеты не летала» - дословная просьба
   клиента. Маршрут проложен по дуге и местами проходит близко к
   телам; при ручном отклонении в них можно и въехать.

   Отбойник тут не годится: жёсткий упор в невидимую стену читается
   поломкой. Поэтому корабль ОБХОДИТ: если он входит в опасный
   радиус, набирается боковое смещение по нормали от центра тела, и
   траектория выгибается дугой вокруг планеты. За опасной зоной
   смещение само стекает, и корабль возвращается на курс.

   Кольца Сатурна считаются отдельно: сквозь них проходить нельзя,
   но и отбрасывать далеко не нужно - корабль поднимается над
   плоскостью колец, как это делают настоящие зонды. */
/* ── Перезапуск анимации без пересчёта раскладки ──────────────
   Чтобы CSS-анимация проиграла заново, её надо снять и поставить, а
   между этим заставить браузер признать снятие. Обычно для этого
   читают размер узла (`void el.offsetWidth`) - и это НАМЕРЕННЫЙ
   синхронный пересчёт раскладки. Замер прокрутки главной поймал 67
   таких пересчётов, и 34 из них дали два места здесь, причём одно
   стоит прямо в кадровом цикле и срабатывает на каждой смене титра.

   Тот же результат даёт запись анимации: сбрасываем её время в ноль
   через Web Animations, и браузер начинает заново, ничего не считая.
   Старым движкам оставляем прежний путь - там лучше лишний пересчёт,
   чем застывшая надпись. */
function заново(эл, класс) {
  if (!эл) return;
  эл.classList.remove(класс);
  var сброшено = false;
  try {
    if (эл.getAnimations) {
      var а = эл.getAnimations();
      for (var i = 0; i < а.length; i++) { а[i].cancel(); }
      сброшено = true;
    }
  } catch (eЗ) {}
  if (!сброшено) void эл.offsetWidth;
  эл.classList.add(класс);
}

/* Короткое сообщение на табло поверх обычных титров. Держится
   заданное время, потом титры сцены возвращаются сами. */
function say(text, ms) {
  if (!ui.cap) return;
  ui.cap._t = text;
  ui.cap._hold = performance.now() + (ms || 1400);
  ui.cap.textContent = text;
  заново(ui.cap, "in");
}

var dodge = null, dodgeWarn = 0;
function avoid(w3, dt) {
  var T = g.THREE;
  if (!dodge) dodge = new T.Vector3();
  var bs = w3.bodies || [], cam = w3.cam, hit = null, worst = 0;

  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    var c = b.o.position;
    var d = cam.position.distanceTo(c);
    /* Зона обхода: корпус планеты плюс запас на габарит корабля и
       на то, чтобы манёвр начинался заранее, а не в упор */
    /* Зона обхода подобрана так, чтобы штатные близкие пролёты
       остались красивыми: над Луной корабль проходит в двух с
       половиной её радиусах, и никакой манёвр там не нужен. Обход
       включается только когда дело идёт к настоящему столкновению. */
    var safe = b.r * 1.8 + 10;
    if (b.hole) safe = b.r * 2.2 + 40;      /* у дыры отходим дальше */
    if (d >= safe || d < 0.001) continue;

    var push = (safe - d) / safe;           /* 0 у края зоны, 1 в центре */
    if (push > worst) { worst = push; hit = b; }

    /* Направление обхода: от центра тела к кораблю. Если корабль
       идёт точно в центр, нормаль вырождается - тогда уводим вбок
       по вектору «вправо от курса», иначе манёвра не получится. */
    w3.tmpB.copy(cam.position).sub(c);
    if (w3.tmpB.lengthSq() < 1) w3.tmpB.set(1, 0.35, 0);
    w3.tmpB.normalize();
    /* Подъём над плоскостью: обход красивее выглядит по дуге вверх,
       а у Сатурна это ещё и уход от колец */
    w3.tmpB.y += b.ring ? 0.55 : 0.22;
    w3.tmpB.normalize();

    var want = (safe - d) * (b.ring ? 1.15 : 1.0);
    dodge.addScaledVector(w3.tmpB, want * Math.min(1, dt * 4.5));
    /* Скорость гасим тем сильнее, чем глубже зашли: манёвр требует
       времени, а не пролёта насквозь */
    F.v *= 1 - Math.min(0.6, push * 0.8) * Math.min(1, dt * 3);
  }

  /* Кольца Сатурна: тонкий диск, в который можно въехать сбоку,
     даже не приблизившись к самой планете. Считаем по расстоянию
     до плоскости и по радиусу в этой плоскости. */
  for (i = 0; i < bs.length; i++) {
    if (!bs[i].ring) continue;
    var s = bs[i].o.position;
    w3.tmpA.copy(cam.position).sub(s);
    var above = Math.abs(w3.tmpA.y);
    var flat = Math.sqrt(w3.tmpA.x * w3.tmpA.x + w3.tmpA.z * w3.tmpA.z);
    if (flat < bs[i].ring + 20 && above < 22) {
      var lift = (22 - above) * Math.min(1, dt * 5);
      dodge.y += (w3.tmpA.y >= 0 ? lift : -lift);
      if (!hit) { hit = bs[i]; worst = Math.max(worst, 0.4); }
    }
  }

  /* Смещение стекает само: за пределами зоны корабль возвращается
     на маршрут, и следующий заход по той же дуге снова честный */
  dodge.multiplyScalar(1 - Math.min(1, dt * 1.1));
  if (dodge.lengthSq() > 1e-4) cam.position.add(dodge);

  /* Предупреждение на табло: манёвр видно, а не только чувствуется.
     Один сигнал на заход - повторное пиканье каждый кадр раздражает. */
  if (hit && worst > 0.12) {
    if (!dodgeWarn) {
      dodgeWarn = 1;
      say(RU ? "МАНЁВР ОБХОДА · " + hit.name : "AVOIDANCE · " + hit.name, 1600);
      if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND, 220); } catch (e) {} }
    }
    F.shake = Math.max(F.shake, worst * 0.5);
  } else if (dodgeWarn && worst < 0.05) dodgeWarn = 0;
}

/* ── Развёртывание сети ──────────────────────────────────────
   Игра должна быть про продукт, а не просто про красивый космос.
   Rocket CDN - это сеть узлов рядом с людьми, поэтому здесь у игры
   появляется цель: долететь до мира и развернуть на нём узел.

   Механика простая и честная: встал на орбиту тела - кнопка на
   пульте оживает; нажал - с корабля уходит луч, на планете
   загорается узел, между узлами протягиваются линии связи. Счётчик
   на табло показывает, сколько миров уже в сети. Список хранится
   между заходами, как и журнал исследователя. */
var NET_KEY = "rcdn.net";
var net = {};
try { net = JSON.parse(localStorage.getItem(NET_KEY) || "{}") || {}; } catch (e) { net = {}; }

var netNodes = [], netLine = null, netBeam = null, netBeamT = 0;

function netCount() { return Object.keys(net).length; }

function netPaint() {
  if (!ui.net) return;
  var n = netCount(), total = NET_TOTAL();
  ui.net.textContent = Math.min(n, total) + "/" + total;
  ui.net.classList.toggle("full", n >= total);
}

/* Кнопка развёртывания живёт на пульте и включается только там, где
   есть что разворачивать: на орбите тела, которое ещё не в сети */
function netButton() {
  if (!ui.deploy) return;
  var here = F.orbit && F.orbit.name;
  var can = !!here && !net[here];
  ui.deploy.classList.toggle("on", can);
  /* Правим ТОЛЬКО подпись: textContent затирал иконку и превращал
     клавишу в пустой прямоугольник */
  var dc = ui.deploy.querySelector("b");
  if (dc) dc.textContent = RU ? "УЗЕЛ" : "NODE";
  ui.deploy.setAttribute("title", can
    ? (RU ? "Развернуть узел сети: " : "Deploy node: ") + here
    : (RU ? "Узел ставится на орбите тела" : "Deploy in orbit"));
}

/* ── Убрать объект из сцены НАСОВСЕМ ─────────────────────────
   scene.remove снимает объект с дерева, но его геометрия, материал и
   текстура остаются в памяти видеокарты: three.js их сам не
   освобождает. Линия сети, луч развёртывания и точки трафика
   пересобираются на каждый новый узел и на каждую аварию, а спрайты
   узлов рисуются каждый своей текстурой на своём холсте. За сессию с
   десятком узлов набирались десятки неосвобождённых наборов.

   Снимаем и освобождаем одним ходом, чтобы не забыть половину. */
/* Снять узел со сцены и отдать его память карте.

   Дерево обходим целиком: у салона под группой лежат десятки сеток
   со своими текстурами, и снять одну вершину мало - видеопамять
   отдаёт только явный dispose на каждой. */
function убратьДерево(о) {
  if (!о) return;
  try { if (о.parent) о.parent.remove(о); } catch (e) {}
  var список = [];
  try { о.traverse(function (у) { список.push(у); }); } catch (e2) { список = [о]; }
  for (var i = 0; i < список.length; i++) освободить(список[i]);
}

function освободить(о) {
  try {
    if (о.geometry && о.geometry.dispose) о.geometry.dispose();
    var м = о.material;
    var сп = м ? (м.length ? м : [м]) : [];
    for (var i = 0; i < сп.length; i++) {
      var мм = сп[i];
      if (!мм) continue;
      var карты = ["map", "alphaMap", "emissiveMap", "normalMap", "roughnessMap",
                   "metalnessMap", "aoMap", "bumpMap", "envMap", "lightMap"];
      for (var к = 0; к < карты.length; к++) {
        var т = мм[карты[к]];
        /* Общую карту не трогаем: её держит модуль, который пережил
           снос, и следующая сборка возьмёт ту же самую. Освободим -
           и на второй заезд стены останутся голыми. */
        if (т && т.dispose && !т.__общая) т.dispose();
      }
      if (мм.dispose) мм.dispose();
    }
  } catch (e) {}
}

function убрать(о) {
  if (!о) return;
  try { if (о.parent) о.parent.remove(о); } catch (e) {}
  try {
    if (о.geometry && о.geometry.dispose) о.geometry.dispose();
    var м = о.material;
    var сп = м ? (м.length ? м : [м]) : [];
    for (var i = 0; i < сп.length; i++) {
      var мм = сп[i];
      if (!мм) continue;
      if (мм.map && мм.map.dispose) мм.map.dispose();
      if (мм.dispose) мм.dispose();
    }
  } catch (e2) {}
}

function netMark(pos, name) {
  var T = g.THREE;
  if (!W3) return;
  var s = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(64, "rgba(159,224,246,1)", "rgba(66,178,220,0)"),
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    opacity: 0.8
  }));
  s.position.copy(pos);
  /* Метка узла мельче прежней втрое. Раньше она была размером с
     половину планеты и закрывала собой то самое тело, на котором
     стоит: в кадре оставалось белое пятно вместо Земли. */
  s.scale.setScalar(6);
  s.userData.info = (RU ? "УЗЕЛ СЕТИ · " : "NETWORK NODE · ") + name;
  /* Свой узел это не открываемое тело: в журнал исследователя он не
     идёт, как и реле сети. */
  s.userData["реле"] = true;
  W3.scene.add(s);
  /* Поставленный узел можно ткнуть. Описание у него было, а в списке
     подбора его не было: человек ставит узел, тыкает в него и не
     получает ничего. */
  вЛуч(s);
  netNodes.push({ s: s, p: pos.clone(), name: name });

  /* Линии связи между узлами: сеть должна выглядеть сетью */
  if (netNodes.length > 1) {
    if (netLine) убрать(netLine);
    var pts = [];
    for (var i = 0; i < netNodes.length; i++) {
      for (var j = i + 1; j < netNodes.length; j++) {
        /* Соединяем только соседей: полный граф на десятке узлов
           превращается в паутину поперёк всего неба */
        if (netNodes[i].p.distanceTo(netNodes[j].p) > 1400) continue;
        pts.push(netNodes[i].p, netNodes[j].p);
      }
    }
    if (pts.length) {
      var geo = new g.THREE.BufferGeometry().setFromPoints(pts);
      netLine = new g.THREE.LineSegments(geo, new g.THREE.LineBasicMaterial({
        color: 0x42b2dc, transparent: true, opacity: 0.34, depthWrite: false, blending: g.THREE.AdditiveBlending
      }));
      W3.scene.add(netLine);
    }
  }
}

function deployNode() {
  if (!W3) return;
  /* Отказ теперь ГОВОРИТ, почему.

     Здесь стояли три молчаливых выхода подряд: не на орбите - тишина,
     узел уже стоит - тишина. Человек жмёт клавишу, и не происходит
     ничего: ни слова, ни звука. Замер приёмки записал УЗЕЛ в мёртвые
     клавиши именно поэтому. Кнопка обязана отвечать всегда, даже
     когда ответ - «пока нельзя». */
  if (!F.orbit || !F.orbit.name) {
    say(RU ? "УЗЕЛ СТАВИТСЯ ТОЛЬКО НА ОРБИТЕ · ПОДОЙДИТЕ К ТЕЛУ"
           : "NODE NEEDS AN ORBIT · APPROACH A BODY", 1900);
    if (g.RC_SOUND && g.RC_SOUND.deny) { try { g.RC_SOUND.deny(); } catch (e) {} }
    return;
  }
  var name = F.orbit.name;
  if (net[name]) {
    say((RU ? "УЗЕЛ УЖЕ СТОИТ · " : "NODE ALREADY HERE · ") + name, 1700);
    return;
  }
  /* Узел стоит заряда: это и делает выбор выбором - на дальний
     рубеж или на прыжок, но не на всё сразу */
  if (!spend(14, RU ? "развёртывание узла" : "node deploy")) return;
  net[name] = 1;
  try { localStorage.setItem(NET_KEY, JSON.stringify(net)); } catch (e) {}

  /* Луч развёртывания: от корабля к телу, живёт полсекунды */
  var T = g.THREE;
  if (netBeam) убрать(netBeam);
  var geo = new T.BufferGeometry().setFromPoints([W3.cam.position.clone(), F.orbit.c.clone()]);
  netBeam = new T.Line(geo, new T.LineBasicMaterial({
    color: 0x9fe0f6, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending
  }));
  W3.scene.add(netBeam);
  netBeamT = 0.65;

  netMark(F.orbit.c, name);
  trafBuild();
  netPaint();
  netButton();

  /* Узел закрыл висящий запрос - это и есть победа в игре: трафик
     пришёл туда, где его ждали */
  var closed = req && req.name === name;
  if (closed) { req = null; F.served = (F.served || 0) + 1; }
  say((closed ? (RU ? "ЗАПРОС ЗАКРЫТ · " : "REQUEST SERVED · ")
              : (RU ? "УЗЕЛ РАЗВЁРНУТ · " : "NODE DEPLOYED · ")) + name + " · " +
      (RU ? "в сети " : "in network ") + netCount(), 2600);
  /* Развёртка узла - главное достижение в игре. Три ноты вверх и
     щелчок фиксатора: это награда, и звучать она обязана наградой. */
  if (g.RC_SOUND) {
    try {
      if (g.RC_SOUND.node) g.RC_SOUND.node();
      else {
        (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND);
        setTimeout(function () { if (g.RC_SOUND.blip) g.RC_SOUND.blip(880); }, 180);
      }
    } catch (e2) {}
  }
  if (netCount() >= NET_TOTAL()) {
    setTimeout(function () {
      say(RU ? "СЕТЬ РАЗВЁРНУТА ПОЛНОСТЬЮ · ВСЕ МИРЫ НА СВЯЗИ" : "NETWORK COMPLETE", 4200);
    }, 2800);
  }

  /* Порог открытия новых рукавов: сообщаем ровно в тот момент,
     когда очередная вселенная стала доступна, и обновляем меню */
  for (var ui3 = 0; ui3 < UNIVERSES.length; ui3++) {
    var uu2 = UNIVERSES[ui3];
    if (uu2.need && netCount() === uu2.need) {
      setTimeout(function (nm) {
        return function () {
          say((RU ? "ОТКРЫТ НОВЫЙ РУКАВ · " : "NEW ARM UNLOCKED · ") + nm, 4000);
          if (g.RC_SOUND && g.RC_SOUND.hyper) { try { g.RC_SOUND.hyper(); } catch (e4) {} }
        };
      }(uu2.name), 2900);
    }
  }
  if (ui.uni) {
    var btns = ui.uni.querySelectorAll("button[data-uni]");
    for (var bi2 = 0; bi2 < btns.length; bi2++) {
      var uv = UNIVERSES[parseInt(btns[bi2].getAttribute("data-uni"), 10)];
      btns[bi2].classList.toggle("locked", !!(uv && uv.need && netCount() < uv.need));
      var стр = btns[bi2].querySelector(".rcf-uni-need");
      if (стр && uv && uv.need) {
        var т = netCount() >= uv.need
          ? (RU ? "открыт" : "unlocked")
          : (RU ? "нужно узлов сети: " : "nodes needed: ") + uv.need +
            " · " + (RU ? "развёрнуто " : "deployed ") + netCount();
        if (стр.textContent !== т) стр.textContent = т;
      }
    }
  }
}

/* ── Запросы на трафик ───────────────────────────────────────
   Сеть без нагрузки - просто точки на карте. Чтобы игра говорила о
   продукте, миру нужен спрос: время от времени на каком-нибудь теле
   без узла случается всплеск трафика. Табло сообщает, откуда
   запрос, метка этого мира начинает пульсировать, и у человека
   появляется понятная задача - долететь и развернуть узел.

   Наказания нет намеренно: это витрина, а не соревнование. Не
   успел - запрос уходит, но ничего не отнимается. */
var req = null;               /* {name, until, sys, pl} */
var reqNext = 0;

function reqPick() {
  /* Ищем мир без узла: в родной системе это тела маршрута, в чужой -
     планеты текущего рукава */
  var list = [];
  if (uniIdx === 0) {
    /* Солнца в этом списке не было, а узел на нём ставится и в
       знаменатель сети оно входит: всплеск трафика не приходил
       туда никогда, и «сеть развёрнута полностью» с этой стороны
       было недостижимо. */
    var names = [GOAL_NAMES.earth, GOAL_NAMES.moon, GOAL_NAMES.mars, GOAL_NAMES.saturn,
                 GOAL_NAMES.sun, GOAL_NAMES.mercury, GOAL_NAMES.venus, GOAL_NAMES.jupiter,
                 GOAL_NAMES.uranus, GOAL_NAMES.neptune, GOAL_NAMES.hole];
    for (var i = 0; i < names.length; i++) if (!net[names[i]]) list.push({ name: names[i] });
  } else {
    var u = UNIVERSES[uniIdx];
    for (var s = 0; s < u.sys.length; s++) {
      for (var p = 0; p < u.sys[s].planets.length; p++) {
        var nm = u.sys[s].planets[p].name;
        if (!net[nm]) list.push({ name: nm, sys: s, pl: p });
      }
    }
  }
  if (!list.length) return null;
  /* Псевдослучайный выбор по времени: своего генератора здесь не
     нужно, важно лишь чтобы цель менялась */
  return list[Math.floor((performance.now() / 997) % list.length)];
}

function reqTick(ts) {
  if (F.brief) return;
  if (req && ts > req.until) {
    say((RU ? "ЗАПРОС УШЁЛ · " : "REQUEST LOST · ") + req.name, 2200);
    req = null;
    reqNext = ts + 18000;
    return;
  }
  if (req || ts < reqNext) return;
  var pick = reqPick();
  if (!pick) { reqNext = ts + 30000; return; }
  req = { name: pick.name, sys: pick.sys, pl: pick.pl, until: ts + 62000 };
  say((RU ? "ЗАПРОС ТРАФИКА · " : "TRAFFIC SURGE · ") + pick.name +
      (RU ? " · нужен узел" : " · node needed"), 3400);
  if (g.RC_SOUND && g.RC_SOUND.radar) { try { g.RC_SOUND.radar(); } catch (e) {} }
}

/* ── Голограммы: связка сцены и слоя меток ───────────────────
   Метка заводится один раз на объект и дальше только переставляется.
   Что показываем: тела текущей вселенной, узлы сети и галактики.
   Далёкое прячем - двадцать подписей на экране это уже не кино, а
   таблица. */
var holoReady = false, holoIds = {};
function holoSetup() {
  if (holoReady || !g.RC_HOLO || !ui.wrap) return;
  holoReady = true;
  try {
    /* Метки объектов живут на стекле, а не поверх всей кабины: слой
       вкладывается в приборы окна и обрезается его границами. Иначе
       подпись планеты вылезала на корпус, чего в корабле быть не
       может. */
    g.RC_HOLO.init(ui.hud || ui.wrap);
    /* Подписка на нажатие по метке - ОДИН раз за жизнь страницы.
       Слой меток снятия подписки не знает, а holoSetup заходит сюда
       заново после каждой смены языка (holoReady сбрасывается, чтобы
       слой подшился в новую обёртку). Подписчики копились, и один
       клик по метке исполнялся дважды: курс ставился дважды, досье
       открывалось дважды, щелчок звучал сдвоенно. Тело обработчика
       смотрит только в holoIds и в общие функции, они живут дольше
       обёртки, поэтому одной подписки хватает навсегда. */
    if (holoSetup.подписан) return;
    holoSetup.подписан = true;
    g.RC_HOLO.onPick(function (id) {
      /* Клик по голограмме - это курс на объект. Ровно то, чего
         ждёшь от метки в кабине: ткнул и полетел.

         И досье заодно. Метка висит ровно НА теле и перехватывает
         нажатие раньше сцены: замер живыми кликами показал, что луч
         в планету попадает, а карточка не открывается - нажатие
         забрала подпись. Человек читает это как «планета не
         кликается», и он прав: он целился в планету. Теперь один
         клик делает обе вещи - ставит курс и показывает, что это
         за тело. */
      var rec = holoIds[id];
      if (!rec) return;
      if (rec.sys !== undefined) goSystem(rec.sys, rec.pl);
      else if (rec.goal) goTo(rec.goal);
      if (rec.o && rec.info) {
        try {
          /* Заголовок досье собирается из первой доли строки до
             разделителя. У записи метки в info лежит целая фраза без
             имени («Полосы облаков, вихри и Большое красное пятно»),
             и в шапку карточки попадала она. Берём подпись самого
             тела, а к фразе приставляем имя метки. */
          dosOpen(rec.o, (rec.o.userData && rec.o.userData.info) ||
                         ((rec.title ? rec.title + " · " : "") + rec.info));
          F.infoUntil = (g.performance && g.performance.now ? performance.now() : 0) + 4200;
          if (!(rec.o.userData && rec.o.userData["реле"])) {
            noteExplored(меткаТела(rec.o) || String(rec.info).split(" · ")[0]);
          }
        } catch (eД) {}
      }
      if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
    });
  } catch (e) { holoReady = false; }
}

function holoList(w3) {
  /* Список меток пересобираем при смене вселенной: в чужом рукаве
     свои планеты, и Земля там не при чём */
  var out = [];
  if (uniIdx === 0) {
    out.push({ id: "h-earth", o: w3.earth, title: RU ? "ЗЕМЛЯ" : "EARTH",
               sub: RU ? "ДОМ · " + УЗЛОВ() + " УЗЛОВ" : "HOME · " + УЗЛОВ() + " NODES", kind: "planet", goal: "earth",
               info: СЛ("земляДосье") });
    out.push({ id: "h-moon", o: w3.moon, title: RU ? "ЛУНА" : "MOON",
               sub: RU ? "РЕЗЕРВ · 384 400 КМ" : "BACKUP", kind: "station", goal: "moon",
               info: RU ? "Точка ретрансляции: сигнал доходит за 1,3 секунды." : "Relay point: 1.3 s of light travel." });
    out.push({ id: "h-mars", o: w3.mars, title: RU ? "МАРС" : "MARS",
               sub: RU ? "ХОЛОДНЫЙ КЭШ" : "COLD CACHE", kind: "planet", goal: "mars",
               info: RU ? "Дальний рубеж сети. Задержка до Земли - 3 до 22 минут." : "Far edge of the network." });
    out.push({ id: "h-mercury", o: w3.mercury, title: RU ? "МЕРКУРИЙ" : "MERCURY",
               sub: RU ? "БЕЗ АТМОСФЕРЫ" : "AIRLESS", kind: "planet", goal: "mercury",
               info: RU ? "Обожжённый каменный мир у самого Солнца." : "A scorched rocky world nearest the Sun." });
    out.push({ id: "h-venus", o: w3.venus, title: RU ? "ВЕНЕРА" : "VENUS",
               sub: RU ? "460 °C · 92 БАР" : "460 C · 92 BAR", kind: "warn", goal: "venus",
               info: RU ? "Облака серной кислоты · давление в 92 раза выше земного." : "Sulphuric-acid clouds · 92 times Earth's pressure." });
    out.push({ id: "h-jupiter", o: w3.jupiter, title: RU ? "ЮПИТЕР" : "JUPITER",
               sub: RU ? "ГАЗОВЫЙ ГИГАНТ" : "GAS GIANT", kind: "planet", goal: "jupiter",
               info: RU ? "Полосы облаков, вихри и Большое красное пятно." : "Cloud bands, vortices and the Great Red Spot." });
    out.push({ id: "h-uranus", o: w3.uranus, title: RU ? "УРАН" : "URANUS",
               sub: RU ? "ОСЬ 98°" : "98 DEG TILT", kind: "planet", goal: "uranus",
               info: RU ? "Ледяной гигант вращается почти лёжа на боку." : "An ice giant rotating almost on its side." });
    out.push({ id: "h-neptune", o: w3.neptune, title: RU ? "НЕПТУН" : "NEPTUNE",
               sub: RU ? "ВЕТЕР 2100 КМ/Ч" : "2100 KM/H WINDS", kind: "planet", goal: "neptune",
               info: RU ? "Самые быстрые ветры среди планет Солнечной системы." : "The fastest planetary winds in the Solar System." });
    out.push({ id: "h-saturn", o: w3.saturn, title: RU ? "САТУРН" : "SATURN",
               sub: RU ? "КОЛЬЦА · 282 000 КМ" : "RINGS", kind: "planet", goal: "saturn",
               info: RU ? "Кольца шириной в семь Земель, толщиной в десять метров." : "Rings seven Earths wide, ten metres thick." });
    out.push({ id: "h-hole", o: w3.hole, title: СЛ("дыраТитул"),
               sub: СЛ("дыраПодпись"), kind: "warn", goal: "hole",
               info: СЛ("дыраИнфо") });
    /* Солнце, пояс, комета и спутник вели себя как декорация: сканер
       их брал, а досье по ним не открывалось - в списке меток их
       просто не было. Поверхности для всех четырёх сняты вместе с
       прочими, и без этих строк они лежали бы мёртвым грузом.
       Заказчик просил именно это: «50+ планет, астероиды и тд, и при
       клике видео». */
    out.push({ id: "h-sun", o: w3.sun, title: RU ? "СОЛНЦЕ" : "SUN",
               sub: RU ? "5500 °C НА ПОВЕРХНОСТИ" : "5500 C SURFACE", kind: "warn", goal: "sun",
               info: RU ? "Кипящая грануляция, пятна и протуберанцы. Ближе не подходим." : "Boiling granulation, spots and prominences. We keep our distance." });
    out.push({ id: "h-belt", o: w3.belt1, title: RU ? "АСТЕРОИДНЫЙ ПОЯС" : "ASTEROID BELT",
               sub: RU ? "МЕЖДУ МАРСОМ И ЮПИТЕРОМ" : "MARS TO JUPITER", kind: "warn", goal: "belt",
               info: RU ? "Обломки несостоявшейся планеты: щебень, пыль и редкие глыбы." : "Debris of a planet that never formed: rubble, dust and rare boulders." });
    out.push({ id: "h-comet", o: w3.comet, title: RU ? "КОМЕТА RC/2026" : "COMET RC/2026",
               sub: RU ? "ХВОСТ ВСЕГДА ОТ СОЛНЦА" : "TAIL AWAY FROM THE SUN", kind: "station", goal: "comet",
               info: RU ? "Тёмное ядро изо льда и пыли. Подходя к Солнцу, оно вскипает хвостом." : "A dark nucleus of ice and dust. Near the Sun it boils into a tail." });
    out.push({ id: "h-sat", o: w3.sat, title: "RC-SAT",
               sub: RU ? "УЗЕЛ НА ОРБИТЕ" : "ORBITAL NODE", kind: "station", goal: "sat",
               info: RU ? "Свой спутник сети: солнечные панели, золотая изоляция, антенна на Землю." : "Our own network satellite: solar arrays, gold insulation, an antenna aimed at Earth." });
  } else {
    var pack = built[uniIdx];
    if (!pack) return out;
    var u = UNIVERSES[uniIdx];
    for (var s = 0; s < u.sys.length; s++) {
      var sg = pack.root.children[s];
      if (!sg) continue;
      out.push({ id: "h-s" + s, o: sg, title: u.sys[s].name,
                 sub: RU ? "ЗВЁЗДНАЯ СИСТЕМА" : "STAR SYSTEM", kind: "gate", sys: s,
                 info: (RU ? "Планет в системе: " : "Planets: ") + u.sys[s].planets.length });
      var groups = [];
      for (var c = 0; c < sg.children.length; c++) {
        if (sg.children[c].userData && sg.children[c].userData.planet !== undefined) {
          groups[sg.children[c].userData.planet] = sg.children[c];
        }
      }
      for (var p = 0; p < u.sys[s].planets.length; p++) {
        if (!groups[p]) continue;
        var pl = u.sys[s].planets[p];
        out.push({ id: "h-p" + s + "-" + p, o: groups[p], title: pl.name,
                   sub: u.sys[s].name, kind: "planet", sys: s, pl: p, info: pl.info });
      }
    }
  }
  return out;
}

var holoUni = -1, holoFull = false;

/* Сколько миров чужой вселенной уже родилось. Планеты досыпаются
   порциями (buildLater), поэтому в момент прыжка их в группе ещё
   нет: список меток, собранный тогда же, оказывался пустым и больше
   не пересобирался - в чужом рукаве не было ни одной подписи.
   Считаем, пока вселенная не соберётся целиком, потом перестаём. */
function holoGrown() {
  var pack = built[uniIdx], u = UNIVERSES[uniIdx];
  if (!pack || !pack.root || !u) return -1;
  var n = 0;
  for (var s = 0; s < pack.root.children.length; s++) {
    var sg = pack.root.children[s];
    for (var c = 0; c < sg.children.length; c++) {
      if (sg.children[c].userData && sg.children[c].userData.planet !== undefined) n++;
    }
  }
  return n;
}

function holoTotal() {
  var u = UNIVERSES[uniIdx], n = 0;
  if (!u || !u.sys) return 0;
  for (var s = 0; s < u.sys.length; s++) n += u.sys[s].planets.length;
  return n;
}

var holoSeen = -1;
function holoFrame(w3, ts) {
  /* В салоне подписей объектов быть не должно: мы ещё не в полёте,
     а сидим в корабле, и метки «ЛУНА», «МАРС» поверх стен читаются
     чужим слоем поверх помещения. Они зажигаются вместе с
     остальными приборами - в момент старта. */
  if (F.stage) {
    if (holoReady && g.RC_HOLO && g.RC_HOLO.clear) { try { g.RC_HOLO.clear(); } catch (e) {} }
    return;
  }
  /* В туннеле подписей быть не должно. Мимо стекла несётся свет, а
     поверх него висели серые карточки «ЛУНА» и «RC-SAT» - тел этих
     в кадре уже нет, есть только их проекция где-то позади. Кадр от
     этого читался не прыжком, а интерфейсом поверх прыжка. */
  if (!F.away && W3 && W3.at && F.p > W3.at.jump0 + 0.02 && F.p < W3.at.jump1 - 0.01) {
    if (holoReady && g.RC_HOLO && g.RC_HOLO.clear) { try { g.RC_HOLO.clear(); } catch (eТ) {} }
    return;
  }
  holoSetup();
  if (!holoReady) return;

  /* Пересобрать нужно и при смене вселенной, и когда в ней прибыло
     миров: метка привязана к конкретной группе, а группы приходят
     не разом */
  var grew = false;
  if (uniIdx !== 0 && !holoFull) {
    var have = holoGrown();
    if (have !== holoSeen) { holoSeen = have; grew = true; }
    if (have >= holoTotal() && have > 0) holoFull = true;
  }
  if (holoUni !== uniIdx || grew) {
    if (holoUni !== uniIdx) { holoFull = false; holoSeen = -1; }
    holoUni = uniIdx;
    try { g.RC_HOLO.clear(); } catch (e) {}
    holoIds = {};
    var list = holoList(w3);
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      holoIds[it.id] = it;
      try {
        g.RC_HOLO.add(it.id, { title: it.title, subtitle: it.sub, info: it.info, kind: it.kind });
      } catch (e2) {}
    }
  }

  var cam = w3.cam;
  /* На телефоне экран узкий: держим в кадре только ближайшие метки,
     иначе подписи перекрывают и друг друга, и вид из окна */
  var limit = innerWidth < 760 ? 3 : 8, shown = 0;
  /* Куда уже поставлены метки. rc-holo умеет разводить карточки по
     вертикали, но когда два мира проецируются в одну и ту же точку
     (соседние планеты чужой системы с большой дистанции), разводить
     нечего: подписи ложатся друг на друга. Такие метки честнее не
     показывать вовсе - долететь всё равно можно по кнопке в пульте. */
  /* ── Чужие панели, на которые метку ставить нельзя ──
     Заказчик прислал кадр: подпись «УРАН» лежит на чипе «СЕТЬ
     ПУСТА», «САТУРН» уходит под карточку подсказки, «НЕПТУН»
     наезжает на строку состояния. Разведение меток между собой было,
     а вот про постоянные панели рубки они не знали ничего.

     Снимаем их прямоугольники и держим метки в стороне. Снимаем не
     каждый кадр: панели стоят на месте, а съём геометрии заставляет
     браузер пересчитать вёрстку. Раз в полсекунды с запасом хватает. */
  /* Прямоугольник проёма окна в пикселях кадра. Кабина публикует его
     долями в переменных --cab-*, здесь переводим в пиксели и держим
     полсекунды: окно стоит на месте, а съём стилей заставляет браузер
     пересчитывать вёрстку. */
  function холстРамки(w) {
    holoFrame._рамкаT = ts;
    if (!ui.wrap) { holoFrame._рамка = null; return; }
    var cs = getComputedStyle(ui.wrap);
    var дол = function (имя) {
      var v = parseFloat(cs.getPropertyValue(имя));
      return isFinite(v) ? v / 100 : NaN;
    };
    var wx = дол("--cab-wx"), wy = дол("--cab-wy"), ww = дол("--cab-ww"), wh = дол("--cab-wh");
    if (!isFinite(wx) || !isFinite(ww) || ww <= 0.05) {
      holoFrame._рамка = null;
      if (DBG) g.__рамкаОшибка = { wx: wx, wy: wy, ww: ww, wh: wh };
      return;
    }
    var r = ui.wrap.getBoundingClientRect();
    holoFrame._рамка = [ r.left + wx * r.width, r.top + wy * r.height,
                         r.left + (wx + ww) * r.width, r.top + (wy + wh) * r.height ];
    /* Тем же числом живёт и перекидывание карточки на другую сторону
       выноски: у правой кромки окна подпись уходит влево, а не под
       стойку рубки. Без этого клип по краю ничего не решал - карточка
       просто обрезалась в другом месте. */
    /* Границы отдаём с запасом внутрь: у самой кромки остекления идёт
       скругление и блик стойки, и подпись впритык к ней всё равно
       читается плохо. */
    /* Отдаём ВСЕ четыре кромки. Раньше уходили только левая и
       правая, и метка у нижнего края окна вставала под кромку
       остекления и обрезалась клипом слоя - заказчик назвал это
       «невидимым слоем, который снизу режет все надписи». Запас
       внутрь по вертикали больше: сверху идёт козырёк, снизу
       приборная полка, и подпись впритык к ним не читается. */
    try {
      g.RC_HOLO.bounds(holoFrame._рамка[0] + 10, holoFrame._рамка[2] - 10,
                       holoFrame._рамка[1] + 14, holoFrame._рамка[3] - 14);
    } catch (eБ) {}
    if (DBG) g.__рамка = holoFrame._рамка;
  }
  /* Рамки нет - отдаём кадр целиком.

     Это не мелочь. Границы включают в слое меток и выбор стороны
     выноски, и отказ показывать карточку, которая не помещается.
     Пока границы уходили только при собранной кабине, в прокрутке с
     плоской рубкой не работало ни то, ни другое: штатная проверка
     ловила подпись САТУРНа, вылезшую за проём на 167 точек. Кадр как
     запасная граница честнее отсутствия границ. */
  if (!holoFrame._рамка) {
    try {
      var пз = Math.max(14, innerWidth * 0.04);
      g.RC_HOLO.bounds(пз, innerWidth - пз, пз, innerHeight - пз);
    } catch (eБ2) {}
  }
  if (!holoFrame._зона) { holoFrame._зона = []; holoFrame._зонаT = 0; }
  var зона = holoFrame._зона;
  if (ui.wrap && (!holoFrame._зонаT || ts - holoFrame._зонаT > 500)) {
    holoFrame._зонаT = ts;
    зона.length = 0;
    var панели = ui.wrap.querySelectorAll(
      ".rcf-netlist, .rcf-hint, .rcf-cap, .rcf-close, .rcf-holo, .rcf-brief-card, " +
      ".rcf-info, .rcf-mis, .rc-vpn-projector, .rcf-goal, .rcf-toast");
    for (var пи = 0; пи < панели.length; пи++) {
      var пэ = панели[пи], пс = getComputedStyle(пэ);
      if (пс.display === "none" || пс.visibility === "hidden" || +пс.opacity < 0.06) continue;
      var пр = пэ.getBoundingClientRect();
      if (пр.width < 24 || пр.height < 10) continue;
      зона.push([пр.left - 8, пр.top - 6, пр.right + 8, пр.bottom + 6]);
    }
  }
  /* Прямоугольник самой метки: карточка висит вправо от точки
     крепления, поэтому влево от неё почти ничего нет. */
  function крыло(x, y, d) {
    var k = 1 - d * 0.35;
    return [x - 12, y - 26 * k, x + 232 * k, y + 26 * k];
  }
  function бьётся(a, b) {
    return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
  }
  function наПанели(x, y, d) {
    var r = крыло(x, y, d);
    for (var зи = 0; зи < зона.length; зи++) if (бьётся(r, зона[зи])) return true;
    return false;
  }

  if (!holoFrame._px) { holoFrame._px = []; holoFrame._py = []; }
  var pxs = holoFrame._px, pys = holoFrame._py, pn = 0;
  /* Порог не круглый, а по форме карточки: она вытянута вправо на
     две сотни пикселей и высотой в три десятка. Круг радиусом в
     полсотни пропускал пары, стоящие в строку, - их подписи и
     наезжали друг на друга. */
  var gapX = 190, gapY = 46;
  var order = [];
  for (var oid in holoIds) {
    if (!holoIds.hasOwnProperty(oid) || !holoIds[oid].o) continue;
    w3.tmpA.setFromMatrixPosition(holoIds[oid].o.matrixWorld);
    order.push([oid, cam.position.distanceTo(w3.tmpA)]);
  }
  order.sort(function (a, b) { return a[1] - b[1]; });

  for (var oi = 0; oi < order.length; oi++) {
    var id = order[oi][0];
    var rec = holoIds[id];
    if (!rec.o) continue;
    w3.tmpA.setFromMatrixPosition(rec.o.matrixWorld);
    var dist = cam.position.distanceTo(w3.tmpA);
    w3.tmpA.project(cam);
    /* Прячем то, что за спиной, за краем кадра или слишком далеко:
       метка имеет смысл, пока объект в кадре и до него можно долететь */
    /* Предел видимости подобран по читаемости, а не по дальности.
       Карточка ужимается пропорционально глубине, и на двух с
       половиной тысячах единиц от неё оставалась полоска с
       нечитаемым текстом - в кадре висел пустой прямоугольник.
       Дальше этого рубежа метку честнее не показывать вовсе. */
    var vis = w3.tmpA.z < 1 && dist < 1900 &&
              w3.tmpA.x > -1.05 && w3.tmpA.x < 1.05 && w3.tmpA.y > -1.05 && w3.tmpA.y < 1.05;
    /* On orbit the planet is the subject of the shot. Foreign labels
       projected across its disc read as UI corruption (a distant
       black-hole marker used to sit on Jupiter). Keep only the active
       body's hologram until the pilot leaves the orbit. */
    if (F.orbit) {
      if (uniIdx === 0 && F.goalId && rec.goal !== F.goalId) vis = false;
      else if (uniIdx !== 0 && rec.title !== F.orbit.name) vis = false;
    }
    var sx = (w3.tmpA.x * 0.5 + 0.5) * innerWidth;
    var sy = (-w3.tmpA.y * 0.5 + 0.5) * innerHeight;
    /* Крупное тело вплотную: его центр уходит за край кадра, а сама
       планета занимает пол-экрана. Метку в этом случае не прячем, а
       прижимаем к краю - иначе подпись у Земли пропадала именно
       тогда, когда Земля перед носом. Поля берём с запасом под
       рамку кокпита. */
    /* Поля берём под переплёт кабины: на телефоне рамка съедает по
       седьмой части ширины с каждой стороны, и метка, прижатая к
       краю кадра, уходила под стойку - подпись обрывалась.

       Справа поле особое. Карточка голограммы висит НА выноске
       вправо от точки крепления и занимает свои 214 пикселей плюс
       рычаг; на четырёхсотпиксельном экране метка, поставленная
       по центру планеты, уезжала половиной текста за кадр -
       «ЗЕМЛЯ» обрывалась ровно посередине. Считаем правое поле по
       фактической ширине карточки, а не симметрично левому. */
    var narrow = innerWidth < 760;
    /* Поля считаем по ПРОЁМУ ОКНА, а не по размеру экрана.

       Здесь была настоящая причина обрезанных подписей. Метки режутся
       контуром остекления (--cab-clip), а прижимались они к краю
       кадра. На телефоне заказчика окно кончается на 354 пикселе при
       ширине экрана 412, и карточка, честно уместившаяся в экран,
       уходила под стойку рубки: «АСТЕРОИ», «ЛУНА РЕЗЕРВ · 384 4»,
       «Точка ретрансляц», «ЗВЁЗДНАЯ СИСТ» - всё это оборвано ровно по
       кромке проёма.

       Границы проёма кабина публикует сама (--cab-wx и далее), берём
       их. Кабины нет - остаётся кадр целиком, как и было. */
    var рамка = holoFrame._рамка;
    if (!рамка || ts - (holoFrame._рамкаT || 0) > 600) {
      холстРамки(w3);
      рамка = holoFrame._рамка;
    }
    var л0 = рамка ? рамка[0] : 0;
    var п0 = рамка ? рамка[2] : innerWidth;
    var в0 = рамка ? рамка[1] : 0;
    var н0 = рамка ? рамка[3] : innerHeight;
    var шир = п0 - л0;
    var padX = л0 + Math.max(14, шир * (narrow ? 0.05 : 0.04));
    var padY = в0 + Math.max(58, (н0 - в0) * (narrow ? 0.12 : 0.11));
    /* Правое поле особое: карточка висит выноской вправо и занимает
       свои две сотни пикселей. Отмеряем их от правой кромки проёма. */
    /* Правое поле держим скромным: если карточка не помещается, её
       перекинет влево сам rc-holo по переданным границам. Раньше тут
       резервировалась вся ширина карточки, и метки сбивались в узкую
       полосу у левого борта. */
    var правКрай = п0 - Math.max(28, шир * 0.10);
    if (правКрай < padX + 30) правКрай = padX + 30;
    /* ── Метка привязана к телу и никуда не отводится ─────────
       Здесь стоял прижим точки привязки к проёму, а ниже - поиск
       свободного места шагами до 146 точек по вертикали. Обе правки
       двигали САМО ПЕРЕКРЕСТЬЕ, то есть тот конец выноски, который
       обязан стоять на планете. Заказчик увидел ровно это: «точка от
       планеты должна идти, а она идёт откуда-то снизу или справа, не
       от самой планеты».

       Выноска существует затем, чтобы связать подпись с телом. Если
       подпись мешает соседке, поднимать надо ПОЛКУ (это делает
       разведение в rc-holo через --h-lh), а не перекрестье: полка
       уезжает, выноска тянется, связь остаётся. Если подпись некуда
       поставить совсем - её честнее не показывать.

       Точку оставляем как есть: это проекция центра тела. */
    /* Запас считаем по САМОМУ перекрестью, а не по карточке.

       Перекрестье стоит точно на теле, и вокруг него лежат два
       мягких слоя: ореол (inset -10) и его размытие в пять точек.
       Пока запас был четырнадцать, планета, чей центр проецировался
       у самой кромки, честно получала подпись - и её ореол вылезал
       за проём на два-три десятка точек. Штатная проверка меток
       ловила это то на Юпитере, то на Сатурне, от прогона к
       прогону. Тридцать четыре точки покрывают оба слоя с запасом.

       Тело у кромки при этом не пропадает бесследно: подпись к нему
       вернётся, как только оно отойдёт от края кадра. */
    var ЗАПАС = 34;
    var вОкне = sx >= л0 + ЗАПАС && sx <= п0 - ЗАПАС &&
                sy >= в0 + ЗАПАС && sy <= н0 - ЗАПАС;
    /* Глубина метки: ноль вплотную, дальше метка мельчает. Потолок
       держим на 0.55 - при большей глубине rc-holo ужимает карточку
       больше чем на треть, и подпись перестаёт читаться. Пусть
       дальняя метка будет просто чуть меньше ближней. */
    var depth = Math.max(0, Math.min(0.55, (dist - 120) / 2600));
    /* ── Кого показываем ──────────────────────────────────────
       Заказчик: «чтобы подпись появлялась только когда мы подлетаем
       к планете, а то сейчас я вижу 6-7 разных подписей от всех
       планет сразу».

       Показываем тело, только если оно ДЕЙСТВИТЕЛЬНО близко: глубина
       0.34 это примерно тысяча единиц дистанции, дальше подпись всё
       равно ужимается и читается плохо, а места занимает столько же.
       Плюс прежние условия: тело в кадре, не за брифингом, и лимит
       на число подписей не исчерпан.

       Место больше не ищем: точка привязки принадлежит телу. Если
       подпись легла бы на чужую панель или вплотную к уже стоящей -
       не показываем эту, а не двигаем перекрестье. */
    var on = vis && !F.brief && shown < limit && вОкне && depth <= 0.34;
    if (on && наПанели(sx, sy, depth)) on = false;
    if (on) {
      for (var pj = 0; pj < pn; pj++) {
        var gdx = pxs[pj] - sx, gdy = pys[pj] - sy;
        if (gdx < 0) gdx = -gdx;
        if (gdy < 0) gdy = -gdy;
        if (gdx < gapX && gdy < gapY) { on = false; break; }
      }
    }
    if (on) { pxs[pn] = sx; pys[pn] = sy; pn++; shown++; }
    try { g.RC_HOLO.place(id, sx, sy, depth, on); } catch (e3) {}

    /* Мир, откуда пришёл запрос трафика, подсвечиваем той же
       подсветкой, что и захват сканера: цель должна быть видна
       глазом, а не только в титрах */
    var wanted = !!(req && rec.title === req.name);
    if (wanted !== rec.lit) {
      rec.lit = wanted;
      try { g.RC_HOLO.hover(id, wanted); } catch (e4) {}
    }
  }
}

/* Physical response of the WebGL console. Accessible DOM buttons are
   only transparent hit targets; their actual alloy caps live in
   RC_CABIN and depress under the pilot's finger. */
function physicalControlsFrame(ts, dt) {
  if (!cabin || !cabin.controlCaps || !ui.wrap) return;
  if (!physicalControlsFrame.nodes) {
    physicalControlsFrame.nodes = [
      /* Тот же порядок, что и в deckFrame: зум последний. */
      ui.wrap.querySelector(".rcf-navkey"),
      ui.wrap.querySelector(".rcf-scan-key"),
      ui.wrap.querySelector(".rcf-deploy"),
      ui.wrap.querySelector(".rcf-help-key"),
      ui.wrap.querySelector(".rcf-auto-key"),
      ui.wrap.querySelector(".rcf-stop-key"),
      ui.wrap.querySelector(".rcf-thr"),
      ui.wrap.querySelector(".rcf-map-key"),
      ui.wrap.querySelector(".rcf-shot"),
      ui.wrap.querySelector(".rcf-zoom-in"),
      ui.wrap.querySelector(".rcf-zoom-out")
    ];
  }
  for (var pi = 0; pi < cabin.controlCaps.length; pi++) {
    var cap3 = cabin.controlCaps[pi], el3 = physicalControlsFrame.nodes[pi];
    if (!cap3) continue;
    var active = false;
    if (el3) {
      active = el3.matches(":active") || el3.classList.contains("cur") ||
        el3.classList.contains("live") || el3.getAttribute("aria-pressed") === "true" ||
        el3.getAttribute("aria-expanded") === "true";
    }
    /* Ход клавиши считает сам пульт.

       Здесь стояло движение по вертикали на четыре сантиметра, и это
       было верно, пока крышки лежали на горизонтальной полке. Теперь
       они смотрят в лицо пилоту, и «вниз» для них - это от него, а не
       к настилу. Направление знает геометрия, поэтому отсюда уходит
       только сам признак нажатия. */
    cap3.userData["нажата"] = active ? 1 : 0;
    if (cap3.material && cap3.material.emissive) {
      /* Свечение клавиши тянем интенсивностью, а не цветом. Лицо
         клавиши это снимок с собственным рисунком, и подмена цвета
         свечения красит его целиком - иконка теряет форму. */
      var base3 = cap3.userData.baseEmissive || 0.30;
      var goalE = active ? base3 * 2.6 : base3 + Math.sin(ts * 0.0014 + cap3.userData.ph) * 0.045;
      cap3.material.emissiveIntensity += (goalE - cap3.material.emissiveIntensity) * Math.min(1, dt * 12);
    }
    /* The mesh owns appearance; the DOM owns semantics and touch.
       Project the latter onto the former so there is never a second,
       separately laid-out button row on top of the console. */
    if (el3 && W3 && W3.cam) {
      if (!physicalControlsFrame.p) {
        physicalControlsFrame.p = new g.THREE.Vector3();
        physicalControlsFrame.a = new g.THREE.Vector3();
        physicalControlsFrame.b = new g.THREE.Vector3();
        physicalControlsFrame.c = new g.THREE.Vector3();
        physicalControlsFrame.d = new g.THREE.Vector3();
      }
      cap3.updateWorldMatrix(true, false);
      var pp = physicalControlsFrame.p, pa = physicalControlsFrame.a;
      var pb = physicalControlsFrame.b, pc = physicalControlsFrame.c, pd = physicalControlsFrame.d;
      cap3.getWorldPosition(pp); pp.project(W3.cam);
      var hw3 = cap3.userData.halfW || 0.1625;
      var hh3 = cap3.userData.halfH || 0.17;
      pa.set(-hw3, 0, 0); cap3.localToWorld(pa); pa.project(W3.cam);
      pb.set(hw3, 0, 0); cap3.localToWorld(pb); pb.project(W3.cam);
      pc.set(0, -hh3, 0); cap3.localToWorld(pc); pc.project(W3.cam);
      pd.set(0, hh3, 0); cap3.localToWorld(pd); pd.project(W3.cam);
      var sx3 = (pp.x * 0.5 + 0.5) * innerWidth;
      var sy3 = (-pp.y * 0.5 + 0.5) * innerHeight;
      var sw3 = Math.abs(pb.x - pa.x) * innerWidth * 0.5;
      var sh3 = Math.abs(pd.y - pc.y) * innerHeight * 0.5;
      var minHit3 = cap3.userData.hit || 40;
      var px3 = sx3.toFixed(2) + "px", py3 = sy3.toFixed(2) + "px";
      var pw3 = Math.max(minHit3, sw3 * 1.12).toFixed(2) + "px";
      var ph3 = Math.max(minHit3, sh3 * 1.22).toFixed(2) + "px";
      /* Пишем только изменившееся. Раньше сюда уходили семь свойств на
         каждую из восьми клавиш каждый кадр - пятьдесят шесть записей
         в стиль, из которых менялись две-три. Каждая запись помечает
         стиль дерева устаревшим, и на телефоне это видно кадрами.
         Прошлое значение держим на самом узле: сравнение строк дешевле
         чтения стиля, а чтение стиля вдобавок заставляет браузер
         досчитывать раскладку. */
      var пам = el3._physPrev || (el3._physPrev = {});
      if (пам.x !== px3) { el3.style.setProperty("--rcf-phys-x", px3); пам.x = px3; }
      if (пам.y !== py3) { el3.style.setProperty("--rcf-phys-y", py3); пам.y = py3; }
      if (пам.w !== pw3) { el3.style.setProperty("--rcf-phys-w", pw3); пам.w = pw3; }
      if (пам.h !== ph3) { el3.style.setProperty("--rcf-phys-h", ph3); пам.h = ph3; }
      /* Inline important owns the final projection. Legacy layout
         rules intentionally hide or translate map/zoom controls on
         small screens; once those controls have physical meshes,
         applying those old transforms would displace the hit volume.
         Эти три не меняются никогда после первой установки, поэтому
         ставим их один раз и больше не трогаем. */
      if (!пам.готово || !el3.classList.contains("rcf-phys-hit")) {
        el3.classList.add("rcf-phys-hit");
        el3.style.setProperty("display", "block", "important");
        el3.style.setProperty("position", "fixed", "important");
        el3.style.setProperty("transform", "translate(-50%, -50%)", "important");
        el3.style.setProperty("--rcf-phys-x", px3);
        el3.style.setProperty("--rcf-phys-y", py3);
        el3.style.setProperty("--rcf-phys-w", pw3);
        el3.style.setProperty("--rcf-phys-h", ph3);
        пам.x = px3; пам.y = py3; пам.w = pw3; пам.h = ph3;
        пам.готово = 1;
      }
    }
  }
  if (cabin.syncControlGlyphs) cabin.syncControlGlyphs();
  frameMeasure();
  keyHintFrame();
  /* Живые приборы рамы: лестница тяги, дежурные диоды, дыхание
     световодов. Неподвижная рама читается декорацией, сколько её
     ни фактурь. */
  if (cabin.console3 && cabin.console3.update) {
    cabin.console3.update(ts, dt, { speed: Math.max(0, Math.min(1, (F.v || 0) / 1.6)) });
  }
}

/* Приборы плоской плиты идут отдельным заходом: у неё нет объёмных
   крышек, и вся жизнь пульта рисуется светом в её нишах. */
function deckTick(ts, dt) {
  if (!ui || !ui.wrap) return;
  var кл = ui.wrap.classList;
  /* Приборы нужны не только в игре, но и в финале.

     Здесь стояла проверка ровно на игру, и из-за неё в финале пульт
     оставался с пустыми гнёздами - приёмка увидела «все клавиши и
     экраны пустые чёрные прямоугольники». Я сперва решил, что в
     финале пульт объёмный и слой приборов туда не годится. Обошёл
     сцену от корня и убедился, что это не так: в нижней части кадра
     двадцать четыре меша, и все до одного - стены, цилиндры комнаты
     и сферы планеты. Пульт в финале это та же плоская картинка
     кабины (ui.cabFrame), что и в игре, и слой приборов под неё как
     раз и написан.

     Выравнивание держится само: в разметке слой повторяет ту же
     пару переменных (--rcf-cabs и --rcf-cabo), которой живёт сама
     картинка. Пока они одни на двоих, приборы не могут уехать от
     ниш ни на одной доле подъезда. */
  if (!кл.contains("rcf-native-cab") && !кл.contains("rcf-stage")) return;
  try { deckFrame(ts, dt); } catch (e) {}
}

/* Голограмма подсказки над клавишей.

   Держим её на стекле и всегда ВНУТРИ проёма: заезжать на раму
   всплывающему нельзя, это прямое требование заказчика. Если
   подсказка не помещается над клавишей, она уходит вбок к
   середине - но за кромку стекла не выходит никогда. */

/* Что произойдёт при нажатии. Ключ - класс клавиши. */
/* Строки справки «КАК ЛЕТАТЬ». Список ОДИН: по нему панель и
   собирается, и переводится на лету при смене языка. Раньше разметка
   писалась прямо в сборке окна и в полёте не переводилась вовсе -
   английский посетитель читал русскую инструкцию. */
function строкиСправки() {
  return [
    { и: RU ? "ХОД" : "THRUST",
      т: RU ? "Тяните рычаг справа, крутите колесо или ведите пальцем вверх. С клавиатуры - стрелки вверх и вниз"
            : "Drag the lever, use the wheel or swipe up. From the keyboard - the up and down arrows" },
    { и: RU ? "ОБЗОР" : "LOOK",
      т: RU ? "Зажмите и тяните мышь, на телефоне - палец вбок. Обзор на все 360"
            : "Drag the mouse or swipe sideways for a full 360 look" },
    { и: RU ? "ЗУМ" : "ZOOM",
      т: RU ? "Shift с колесом, на телефоне - щипок двумя пальцами"
            : "Shift with the wheel, or pinch on a phone" },
    { и: RU ? "КУРС" : "COURSE",
      т: RU ? "Кнопка «Курс» внизу: все планеты системы и прыжок в другие рукава"
            : "The Course key: every body plus the jump to other arms" },
    { и: RU ? "СКАН" : "SCAN",
      т: RU ? "Нажмите по телу в окне - корабль снимет с него карту"
            : "Tap a body to scan it" },
    { и: RU ? "УЗЛЫ" : "NODES",
      т: RU ? "На орбите тела разверните узел сети. Узлы держат трафик и открывают новые рукава"
            : "In orbit deploy a node. Nodes carry traffic and unlock arms" },
    /* Три клавиши оставались без объяснения, и заказчик спрашивал про
       них прямо: «для чего какая кнопка вообще не понятно». */
    { и: RU ? "АВТО" : "AUTO",
      т: RU ? "Автопилот ведёт корабль по маршруту сам. Любая ручная команда его выключает"
            : "Autopilot flies the route. Any manual input turns it off" },
    { и: RU ? "СТОП" : "STOP",
      т: RU ? "Гасит ход до нуля. Рядом КАДР сохраняет вид из окна себе на устройство"
            : "Kills the thrust. Next to it, SHOT saves the view to your device" },
    { и: RU ? "ВЫХОД" : "EXIT",
      т: RU ? "Крестик в углу или настойчивая прокрутка вверх возвращают на страницу"
            : "The corner cross or a firm scroll up returns to the page" },
    /* Единственная настройка, которая нужна прямо в полёте:
       переключатель звука живёт в шапке сайта, а шапка на время
       полёта спрятана. */
    { и: RU ? "ЗВУК" : "SOUND", кнопка: true }
  ];
}

function строитьЧтоДелает() { return {
  "rcf-navkey":   RU ? "Список всех тел и прыжок в другие рукава" : "Every body plus the jump to other arms",
  "rcf-map-key":  RU ? "Карта сети: где уже стоят ваши узлы" : "Network map: where your nodes stand",
  "rcf-scan-key": RU ? "Снять карту тела, к которому подошли" : "Scan the body you are next to",
  "rcf-deploy":   RU ? "Развернуть узел сети. Работает на орбите тела" : "Deploy a node. Works in orbit",
  "rcf-fire-key": RU ? "Сохранить кадр из окна себе на устройство" : "Save the view to your device",
  "rcf-auto-key": RU ? "Автопилот ведёт корабль сам" : "Autopilot flies the ship",
  "rcf-stop-key": RU ? "Погасить ход до нуля" : "Kill the thrust",
  "rcf-zoom-in":  RU ? "Приблизить вид" : "Zoom in",
  "rcf-zoom-out": RU ? "Отдалить вид" : "Zoom out",
  "rcf-fit-key":  RU ? "Вернуть обычный кадр" : "Reset the view",
  "rcf-help-key": RU ? "Как летать: управление и правила" : "How to fly: controls and rules",
  "rcf-shot":     RU ? "Сохранить кадр из окна себе на устройство" : "Save the view to your device",
  "rcf-thr":      RU ? "Тяга: тянуть вбок или стрелками" : "Thrust: drag sideways or use the arrows"
}; }
var ЧТОДЕЛАЕТ = строитьЧтоДелает();
function имена(клавиши) {
  for (var ки = 0; ки < клавиши.length; ки++) {
    var кн = клавиши[ки];
    if (кн.getAttribute("aria-label")) continue;
    var подпись = ((кн.querySelector("b") || {}).textContent || "").trim();
    var что = "";
    for (var кк in ЧТОДЕЛАЕТ) {
      if (ЧТОДЕЛАЕТ.hasOwnProperty(кк) && кн.classList.contains(кк)) { что = ЧТОДЕЛАЕТ[кк]; break; }
    }
    var имяК = подпись && что ? подпись + " · " + что : (подпись || что);
    if (имяК) кн.setAttribute("aria-label", имяК);
  }
}

/* ── Куда встаёт подсказка клавиши ────────────────────────────
   Правило одно на оба пути показа - нажатие пальцем по разметке и
   обход клавиш в кадре, - и держать его в двух местах нельзя: оно
   разъезжается, что и произошло.

   Первое. «Пульт» это не одна коробка .rcf-deck. На портрете
   клавиши вынесены НИЖЕ её прямоугольника (замер на 412x800: плита
   651..731, клавиша СЕТЬ 730..765), на широком экране наоборот -
   плита выше клавиш. Поэтому верх пульта берётся как минимум из
   верха плиты и верхов всех видимых клавиш, и считается заново:
   раскладка меняется от поворота экрана и от ширины окна.

   Второе. Карточка привязана в стилях НИЖНЕЙ кромкой
   (translate(-50%, -100%)). Путь по разметке отдавал сюда ЦЕНТР, и
   карточка садилась на пол-высоты ниже задуманного - ровно те
   тысячи квадратных точек наложения на пульт, которые видно на
   телефоне и не видно на мониторе (на мониторе плита ниже, и запаса
   хватало). Здесь отдаётся именно НИЗ, а высота в расчёт не входит
   вовсе: сколько бы строк ни набралось, низ стоит там, где сказано.

   Зазор в двадцать шесть точек, а не впритык: у карточки есть
   свечение по контуру (box-shadow), в прямоугольник оно не входит,
   и без запаса подсветка ложится на верхний ряд клавиш. */
var ЗАЗОР_ПОДСКАЗКИ = 26;
function верхПульта() {
  var верх = innerHeight;
  if (!ui.wrap) return верх;
  var плита = ui.wrap.querySelector(".rcf-deck");
  if (плита) {
    var рп = плита.getBoundingClientRect();
    if (рп.height > 4 && рп.top < верх) верх = рп.top;
  }
  /* Список клавиш кэшируем: укладка считается в кадре, и
     querySelectorAll по всему слою шестьдесят раз в секунду не нужен
     никому. Ключ кэша - число детей слоя: панели приходят и уходят,
     и по нему видно, что разметку пересобрали. */
  if (!верхПульта.клавиши || верхПульта.счёт !== ui.wrap.childElementCount) {
    верхПульта.клавиши = ui.wrap.querySelectorAll(".rcf-key");
    верхПульта.счёт = ui.wrap.childElementCount;
  }
  var кл = верхПульта.клавиши, i, рк;
  for (i = 0; i < кл.length; i++) {
    рк = кл[i].getBoundingClientRect();
    if (рк.height > 4 && рк.top < верх) верх = рк.top;
  }
  return верх;
}
/* Кладёт карточку центром по горизонтали в sx и нижней кромкой над
   пультом. Возвращать нечего: значения уходят прямо в стили. */
function положитьПодсказку(sx) {
  if (!ui.keyhint) return;
  var кw = ui.keyhint.offsetWidth || 210;
  /* Слева и справа держим внутри проёма остекления: слой режется
     контуром окна, и карточка, влезшая в экран, всё равно уходила
     бы под стойку рубки половиной текста. */
  var л = 8, п = innerWidth - 8;
  if (ui.wrap) {
    var cs = getComputedStyle(ui.wrap);
    var wx = parseFloat(cs.getPropertyValue("--cab-wx"));
    var ww = parseFloat(cs.getPropertyValue("--cab-ww"));
    if (isFinite(wx) && isFinite(ww) && ww > 5) {
      л = innerWidth * wx / 100 + 8;
      п = innerWidth * (wx + ww) / 100 - 8;
    }
  }
  var x = sx;
  if (п - л > кw) {
    if (x - кw / 2 < л) x = л + кw / 2;
    if (x + кw / 2 > п) x = п - кw / 2;
  } else {
    x = (л + п) / 2;
  }
  var y = верхПульта() - ЗАЗОР_ПОДСКАЗКИ;
  /* За верх кадра не выпускаем: на очень узком экране плита стоит
     высоко, и подсказке нужно место хотя бы на строку. */
  if (y < 84) y = 84;
  ui.keyhint.style.setProperty("--kh-x", x.toFixed(1) + "px");
  ui.keyhint.style.setProperty("--kh-y", y.toFixed(1) + "px");
}

function подсказкиКлавиш(w) {
  if (!w) return;
  var клавиши = w.querySelectorAll(".rcf-key");
  if (!клавиши.length) return;
  /* Имена ставим ВСЕГДА, даже если всплывающей подсказки нет и даже
     на повторном заходе: раньше и то и другое висело на одном
     выходе по `готово`, и стоило подсказке не найтись - клавиши
     оставались безымянными. Основные имена теперь стоят прямо в
     разметке, здесь страховка на случай новых клавиш. */
  имена(клавиши);
  if (!ui.keyhint || подсказкиКлавиш.готово) return;
  подсказкиКлавиш.готово = true;

  /* Заодно даём клавишам доступное имя.

     Название клавиши лежит внутри в теге b, но на плите этот тег
     скрыт: лицо клавиши рисует холст, а разметка нужна только ради
     нажатия. Для чтения с экрана это значит, что пять клавиш - меню
     целей, скан, узел, автопилот и стоп - вообще безымянные: замер
     дал `видимых букв нет` у всех пяти, и aria-label стоял только у
     карты, зума, снимка и справки.

     Имя и что клавиша делает у нас уже есть здесь же, рядом. Берём
     их и ставим один раз при сборке. */
  var таймер = 0;
  var показать = function (кн) {
    var имя = (кн.querySelector("b") || {}).textContent || кн.getAttribute("aria-label") || "";
    var текст = "";
    for (var к in ЧТОДЕЛАЕТ) {
      if (ЧТОДЕЛАЕТ.hasOwnProperty(к) && кн.classList.contains(к)) { текст = ЧТОДЕЛАЕТ[к]; break; }
    }
    if (!текст) текст = кн.getAttribute("title") || "";
    if (!имя && !текст) return;
    if (ui.keyhintName) ui.keyhintName.textContent = имя;
    if (ui.keyhintText) ui.keyhintText.textContent = текст;
    /* Место считает общая укладка: над ВСЕМ пультом, а не над своей
       клавишей. Своё место было и здесь, и в обходе кадра, и они
       разошлись - тот путь ставил над пультом, этот над клавишей и
       по центру вместо низа. На портрете клавиши стоят ниже коробки
       плиты, и карточка садилась прямо на бортовое табло. */
    var r = кн.getBoundingClientRect();
    положитьПодсказку(r.left + r.width / 2);
    ui.keyhint.classList.add("on");
  };
  var спрятать = function (задержка) {
    if (таймер) clearTimeout(таймер);
    таймер = setTimeout(function () {
      таймер = 0;
      ui.keyhint.classList.remove("on");
    }, задержка || 1500);
  };
  for (var i = 0; i < клавиши.length; i++) {
    (function (кн) {
      кн.addEventListener("pointerdown", function () {
        if (таймер) { clearTimeout(таймер); таймер = 0; }
        показать(кн);
      }, { passive: true });
      кн.addEventListener("pointerup", function () { спрятать(1600); }, { passive: true });
      кн.addEventListener("pointercancel", function () { спрятать(400); }, { passive: true });
      кн.addEventListener("pointerleave", function () { спрятать(200); }, { passive: true });
      кн.addEventListener("mouseenter", function () {
        if (таймер) { clearTimeout(таймер); таймер = 0; }
        показать(кн);
      });
    })(клавиши[i]);
  }
}

/* Отметка времени для пересчёта атмосферных оболочек. */
var атмКадр = { t: 0 };

function keyHintFrame() {
  if (!ui.keyhint || !cabin || !cabin.controlCaps) return;
  var nodes = physicalControlsFrame.nodes;
  if (!nodes) return;
  /* Подсказка живёт и на пальце, а не только на мыши.

     Она выбирала клавишу по :hover и :focus-visible. На телефоне
     ни того, ни другого нет, поэтому подсказка не появлялась ни
     разу - а именно на телефоне заказчик и не понял, что делают
     кнопки. Теперь нажатие пальцем показывает её и держит ещё
     полторы секунды после отпускания: успеть прочитать. */
  if (!keyHintFrame.слушает) {
    keyHintFrame.слушает = true;
    keyHintFrame.тач = -1;
    for (var ки = 0; ки < nodes.length; ки++) {
      (function (эл, идx) {
        if (!эл) return;
        эл.addEventListener("pointerdown", function (ev) {
          if (ev.pointerType === "mouse") return;
          keyHintFrame.тач = идx;
          if (keyHintFrame.таймер) { clearTimeout(keyHintFrame.таймер); keyHintFrame.таймер = 0; }
        }, { passive: true });
        var отпустить = function () {
          if (keyHintFrame.таймер) clearTimeout(keyHintFrame.таймер);
          keyHintFrame.таймер = setTimeout(function () {
            keyHintFrame.тач = -1;
            keyHintFrame.таймер = 0;
          }, 1500);
        };
        эл.addEventListener("pointerup", отпустить, { passive: true });
        эл.addEventListener("pointercancel", отпустить, { passive: true });
      })(nodes[ки], ки);
    }
  }
  var over = -1, i;
  if (keyHintFrame.тач >= 0 && nodes[keyHintFrame.тач]) over = keyHintFrame.тач;
  for (i = 0; over < 0 && i < nodes.length; i++) {
    var el = nodes[i];
    if (!el) continue;
    try {
      if (el.matches(":hover") || el.matches(":focus-visible")) { over = i; break; }
    } catch (e) {}
  }
  if (over < 0) {
    if (keyHintFrame.on) { ui.keyhint.classList.remove("on"); keyHintFrame.on = false; }
    return;
  }
  var cap = cabin.controlCaps[over];
  if (!cap) return;
  if (keyHintFrame.idx !== over) {
    keyHintFrame.idx = over;
    if (ui.keyhintName) ui.keyhintName.textContent = capName(over);
    /* Строка «что делает» берётся из той же таблицы, по которой
       собираются имена для чтения с экрана. Раньше читалось
       cap.userData.hint, а туда никто ничего не кладёт: подсказка
       снизу была пуста всегда. */
    if (ui.keyhintText) {
      var узел = nodes[over], что = "";
      for (var кл in ЧТОДЕЛАЕТ) {
        if (ЧТОДЕЛАЕТ.hasOwnProperty(кл) && узел && узел.classList.contains(кл)) { что = ЧТОДЕЛАЕТ[кл]; break; }
      }
      ui.keyhintText.textContent = что;
    }
  }
  /* Кладём по проекции самой клавиши, а не по разметке: клавиша это
     железо в мире, и подсказка обязана стоять над ней, а не над её
     двойником из разметки. */
  if (!keyHintFrame.v) keyHintFrame.v = new g.THREE.Vector3();
  var v = keyHintFrame.v;
  cap.getWorldPosition(v);
  v.project(W3.cam);
  var sx = (v.x * 0.5 + 0.5) * innerWidth;
  /* ── Подсказка встаёт над ВСЕМ пультом, а не над своей клавишей ──
     Здесь стояло sy - h2 * 1.15, то есть «над самой клавишей». Для
     верхнего ряда это верно, а для нижнего означает «поверх
     верхнего ряда»: подсказка ложилась прямо на соседние клавиши и
     закрывала их подписи. Заказчик прислал такой кадр и написал:
     «никакие надписи не должны заходить на панель управления, и на
     кнопки не должно накладываться... надпись КУРС появляется и её
     невозможно убрать, она перекрывает кнопки интерфейса».

     Сам расчёт верхней кромки пульта уехал в положитьПодсказку:
     он нужен обоим путям показа, а две копии одного правила уже
     один раз разошлись. Отсюда остаётся только горизонталь - по
     проекции самой клавиши, чтобы карточка стояла над той, о
     которой рассказывает. */
  положитьПодсказку(sx);
  if (!keyHintFrame.on) { ui.keyhint.classList.add("on"); keyHintFrame.on = true; }
}

/* Имя команды для подсказки. Список ровно один - тот, по которому
   печатаются лица клавиш (RC_KEYS.KEYS). Своя копия здесь уже была,
   и она отстала на две позиции: наведение на СПРАВКУ показывало
   «ЗАЛП» (команды с таким именем в игре нет), на КАДР - «БЛИЖЕ».
   Ровно об этом предупреждает комментарий в rc-keys.js. */
function capName(i) {
  var ru = doc.documentElement.lang !== "en";
  var список = (g.RC_KEYS && g.RC_KEYS.KEYS) || null;
  if (!список || !список[i]) return "";
  return ru ? список[i]["имя"] : список[i].en;
}

function frame(ts) {
  if (!F.open) return;
  F.raf = requestAnimationFrame(frame);
  /* В режиме сцены кадр стоит: камера едет только за прокруткой, и
     тридцати кадров хватает с запасом. Полные шестьдесят жгли
     телефон ровно там, где человек читает вопросы. */
  if (F.stage) {
    /* Shared cadence keeps the premium finale at 60 fps when the
       device can sustain it, instead of forcing a 30 fps ceiling. */
    var stageMin = g.RC_MOTION ? g.RC_MOTION.minFrame() : 16;
    if (F._stageT && ts - F._stageT < stageMin - 1) return;
    F._stageT = ts;
  }
  var dt = F.last ? Math.min(0.05, (ts - F.last) / 1000) : 0.016;
  F.last = ts;
  var T = g.THREE, w3 = W3;

  /* Тяга и инерция. В гиперпрыжке корабль сам держит ход: прыжок
     не должен обрываться на полпути из-за уставшего пальца. */
  /* Зона гиперпрыжка живёт только на маршруте родной системы. В
     чужом рукаве маршрутной кривой нет, а F.p остаётся там, где его
     бросили: без этой проверки в чужой вселенной внезапно включался
     звёздный туннель и корабль сам набирал крейсерскую тягу. */
  /* В режиме сцены корабль стоит у Земли: ни разгона, ни автопилота,
     ни целей. Двигается только доля подъезда, и её ведёт прокрутка
     страницы, а не тяга. */
  if (F.stage) { F.v = 0; F.p = 0; F.goal = null; F.auto = false; F.orbit = null; F.brief = false; }
  var jumpZone = !F.away &&
    (W3.at ? (F.p > W3.at.jump0 && F.p < W3.at.jump1) : (F.p > 0.74 && F.p < 0.86));
  if (jumpZone && F.v < 0.11) F.v += (0.11 - F.v) * Math.min(1, dt * 2);

  if (F.goal !== null && F.goal !== undefined) {
    /* Навигация к цели: тяга по расстоянию, у места сама тормозит.
       Работает в обе стороны - к Марсу можно и вернуться. */
    var dp = F.goal - F.p;
    if (Math.abs(dp) < 0.006) {
      F.goal = null; F.v *= 0.3;
      /* Прибыли к телу - выходим на орбиту вокруг него */
      var ob = ORBITS[F.goalId];
      var tgt = F.goalId && w3[F.goalId === "hole" ? "hole" : F.goalId];
      if (ob && tgt) {
        /* Имя берём читаемое: оно уходит и в титры, и на кнопку
           развёртывания узла, где «moon» вместо «ЛУНА» смотрелось
           отладочным мусором */
        var fitR = ob.r * (innerHeight > innerWidth ? 1.72 : 1);
        F.orbit = { c: tgt.position, r: fitR, y: ob.y, a: null,
                    name: GOAL_NAMES[F.goalId] || F.goalId };
        /* Выход на виток - событие, а не подтверждение нажатия.
           Тёплый разлив вместо общего «готово». */
        if (g.RC_SOUND) { try { (g.RC_SOUND.arrive || g.RC_SOUND.uiConfirm).call(g.RC_SOUND); } catch (e2) {} }
      }
    }
    else {
      var wantV = Math.max(-0.14, Math.min(0.14, dp * 1.1 + (dp > 0 ? 0.02 : -0.02)));
      F.v += (wantV - F.v) * Math.min(1, dt * 3);
    }
  } else if (F.auto && !F.brief && F.p < 0.999) {
    /* Автопилот: спокойная крейсерская, чтобы просто смотреть кино */
    var cruise = jumpZone ? 0.11 : 0.03;
    F.v += (cruise - F.v) * Math.min(1, dt * 0.55);
  } else {
    /* Ручной режим. Ползунок тяги держит ход: отпустил на половине -
       идём на половине, как у настоящего РУД. Колесо и свайп дают
       импульс поверх, который сам стекает к уровню ползунка. */
    var thr = F.thr || 0;
    var hold = thr * thr * 0.26;
    F.v = hold + (F.v - hold) * Math.pow(0.14, dt);
  }
  F.v = Math.max(-0.2, Math.min(0.3, F.v));
  /* Camera mass. The ship follows the collision-safe spline exactly,
     while the pilot's head and optical rig lag acceleration by less
     than one world unit. This creates a cinematic sense of weight
     without moving the hull through a planet or introducing scroll
     latency. A critically damped approach prevents the old snap on
     throttle release. */
  var prevV = F._prevV === undefined ? F.v : F._prevV;
  var accelV = (F.v - prevV) / Math.max(.008, dt);
  F._prevV = F.v;
  var surgeGoal = F.stage ? 0 : Math.max(-.72, Math.min(.72, -accelV * 2.1));
  F.camSurge = (F.camSurge || 0) + (surgeGoal - (F.camSurge || 0)) * Math.min(1, dt * 4.6);
  F.p += F.v * dt;
  /* На упоре маршрута гасим и рычаг. Раньше обнулялся только ход:
     корабль стоит, а рычаг показывает 85 процентов и полоска залита
     на те же 85 - по приборам двигатель работает, по кадру корабль
     не движется. */
  if (F.p < 0 || F.p > 1) {
    F.p = F.p < 0 ? 0 : 1;
    F.v = 0;
    if (F.thr) { F.thr = 0; if (F.paintThrottle) { try { F.paintThrottle(); } catch (eР) {} } }
  }

  /* Подсветка текущей цели в навигации */
  if (ui.nav && w3.at && (frame._navT || 0) < ts - 300) {
    frame._navT = ts;
    var seg = "earth";
    if (F.p > 0.06 && F.p <= (w3.at.mars + w3.at.moon) / 2) seg = "moon";
    else if (F.p > (w3.at.mars + w3.at.moon) / 2 && F.p <= (w3.at.saturn + w3.at.mars) / 2) seg = "mars";
    else if (F.p > (w3.at.saturn + w3.at.mars) / 2 && F.p <= (w3.at.hole + w3.at.saturn) / 2) seg = "saturn";
    else if (F.p > (w3.at.hole + w3.at.saturn) / 2 && F.p <= w3.at.jump0) seg = "hole";
    else if (F.p > w3.at.jump0 && F.p <= w3.at.jump1) seg = "galaxy";
    else if (F.p > w3.at.jump1) seg = "home";
    if (frame._seg !== seg) {
      frame._seg = seg;
      var bs = ui.nav.querySelectorAll("button");
      for (var bi = 0; bi < bs.length; bi++) {
        bs[bi].classList.toggle("cur", bs[bi].getAttribute("data-goal") === seg);
      }
    }
  }

  /* Камера по кривой - или по орбите вокруг выбранного тела */
  if (F.orbit) {
    var o = F.orbit;
    if (o.a === null) {
      /* Первый кадр орбиты: угол берём из фактического положения,
         чтобы вход был без телепорта */
      o.a = Math.atan2(w3.cam.position.z - o.c.z, w3.cam.position.x - o.c.x);
      o.blend = 0;
    }
    o.a += dt * 0.16;
    o.blend = Math.min(1, (o.blend || 0) + dt * 0.7);
    w3.tmpB.set(o.c.x + Math.cos(o.a) * o.r, o.c.y + o.y, o.c.z + Math.sin(o.a) * o.r);

    /* Подлёт и сам виток - разные движения. Раньше на оба работал
       один лерп: от соседней системы он тянул камеру часами, и
       корабль будто застревал на полпути. Теперь пока до точки
       витка далеко, идём настоящим ходом с разгоном, и только у
       цели переходим на плавное круговое движение. */
    var far = w3.cam.position.distanceTo(w3.tmpB);
    o._far = far > 60;
    if (far > 60) {
      w3.tmpA.copy(w3.tmpB).sub(w3.cam.position).normalize();
      /* Скорость растёт с дистанцией: перелёт между системами не
         должен занимать минуту, а подход к планете - быть рывком */
      var step = Math.min(far - 20, (70 + far * 1.35) * dt);
      /* Доводка у цели. Раньше ход обрывался ступенькой ровно на
         шестидесяти единицах: корабль нёсся и вдруг вставал на
         круговое движение. Последние двести единиц гасим плавной
         кривой - подлёт заканчивается, а не прерывается. */
      if (far < 260) {
        var ease = far / 260;
        step *= 0.22 + 0.78 * ease * ease * (3 - 2 * ease);
      }
      w3.cam.position.addScaledVector(w3.tmpA, step);
      F.warpV = step / Math.max(dt, 0.001);       /* для табло скорости */
    } else {
      w3.cam.position.lerp(w3.tmpB, o.blend * Math.min(1, dt * 3));
      F.warpV = 0;
    }
  } else if (!F.away) {
    var pos = w3.path.getPointAt(F.p);
    if (F.rejoin > 0) {
      /* Сошли с орбиты: догоняем маршрут плавно, не телепортом */
      F.rejoin -= dt * 0.45;
      w3.cam.position.lerp(pos, Math.min(1, dt * 2.2));
    } else {
      w3.cam.position.copy(pos);
    }
    avoid(w3, dt);
  }

  /* Планеты чужих вселенных живут своей жизнью: вращение, облака,
     пульсация лавы. Обновляем только видимую вселенную - остальные
     стоят на паузе и ничего не стоят. */
  var pack = built[uniIdx];
  if (pack && pack.root.visible) {
    for (var pu = 0; pu < pack.live.length; pu++) {
      var body = pack.live[pu];
      if (body.update) body.update(dt, w3.cam.position);
      /* ── Направление на звезду пересчитываем КАЖДЫЙ кадр ──────
         При сборке оно задавалось один раз, обратным вектором
         положения планеты в системе. Это верно ровно в тот миг:
         дальше планета идёт по орбите, а направление остаётся
         прежним. Через четверть витка освещённой оказывается не та
         половина, через половину - планета к своей звезде повёрнута
         ночью и в кадре читается чёрным кругом. Заказчик так и
         сказал: «планеты в других галактиках мутные, просто круги,
         некоторые слишком тёмные».

         setSunPosition берёт МИРОВОЕ положение планеты сам и считает
         направление от неё к звезде - то есть остаётся верным на
         всей орбите. Звезда стоит в начале своей системы, поэтому
         мировая точка звезды это положение узла системы. */
      if (body.setSunPosition && body.group && body.group.parent) {
        if (!body._звезда) body._звезда = new T.Vector3();
        body.group.parent.getWorldPosition(body._звезда);
        try { body.setSunPosition(body._звезда); } catch (eЗв) {}
      }
      /* Свежесобранный мир разворачивается из точки: планета не
         должна возникать в кадре вспышкой, она проявляется */
      var ud = body.group && body.group.userData;
      if (ud && ud.grow !== undefined && ud.grow < 1) {
        ud.grow = Math.min(1, ud.grow + dt * 1.6);
        var e = 1 - Math.pow(1 - ud.grow, 3);
        body.group.scale.setScalar(0.01 + e * 0.99);
      }
    }
  }

  /* Цель взгляда: между точками интереса */
  var L = w3.looks, a = L[0], b = L[L.length - 1];
  for (var i = 0; i < L.length - 1; i++) {
    if (F.p >= L[i].p && F.p <= L[i + 1].p) { a = L[i]; b = L[i + 1]; break; }
  }
  var k = (F.p - a.p) / Math.max(0.0001, b.p - a.p);
  k = k * k * (3 - 2 * k);
  /* Точка взгляда может быть задана двумя способами. Дома это
     готовый вектор: тела Солнечной стоят на своих местах, и вектор
     живой - он принадлежит самому телу. В чужом рукаве это УЗЕЛ
     планеты: она идёт по орбите внутри своей системы, и её мировое
     положение надо спрашивать каждый кадр. Записанная координата
     через полвитка показывала бы в пустое место. */
  if (a.узел || b.узел) {
    if (!w3.взглядA) { w3.взглядA = new T.Vector3(); w3.взглядB = new T.Vector3(); }
    if (a.узел) { a.узел.updateWorldMatrix(true, false); w3.взглядA.setFromMatrixPosition(a.узел.matrixWorld); }
    else w3.взглядA.copy(a.at);
    if (b.узел) { b.узел.updateWorldMatrix(true, false); w3.взглядB.setFromMatrixPosition(b.узел.matrixWorld); }
    else w3.взглядB.copy(b.at);
    w3.tmpA.copy(w3.взглядA).lerp(w3.взглядB, k);
  } else {
    w3.tmpA.copy(a.at).lerp(b.at, k);
  }
  if (F.orbit) w3.tmpA.copy(F.orbit.c);
  w3.tmpM.lookAt(w3.cam.position, w3.tmpA, w3.cam.up);
  w3.tmpQ.setFromRotationMatrix(w3.tmpM);
  /* Ориентация автопилота живёт отдельно от взгляда человека.
     Раньше повороты мыши применялись к тому же кватерниону, что и
     сглаживание курса: на тяжёлых кадрах ручной наклон накапливался
     быстрее, чем курс успевал его возвращать, и камера утыкалась в
     пол. Теперь курс сходится сам по себе, а взгляд - только
     насадка на кадр. */
  if (!w3.baseQ) w3.baseQ = w3.cam.quaternion.clone();
  w3.baseQ.slerp(w3.tmpQ, Math.min(1, dt * 3.2));
  w3.cam.quaternion.copy(w3.baseQ);

  /* Взгляд человека поверх автопилота.

     Если человек развернулся свободным обзором и после этого дал
     тягу, взгляд сам сходится к направлению полёта - тем быстрее,
     чем сильнее газ. Так и ведёт себя пилот: осмотрелся, взялся за
     ручку - смотрит по курсу. Без этого возврата единственным
     способом выпрямиться было бы столь же аккуратно докрутить
     мышь обратно, а это работа, а не игра. */
  if (F.free) {
    var pull = Math.abs(F.v) * 2.4;
    if (F.goal || F.auto || F.orbit) pull = Math.max(pull, 0.9);
    if (pull > 0.01) {
      var kk = Math.min(1, dt * pull);
      F.look.tx += (0 - F.look.tx) * kk;
      F.look.ty += (0 - F.look.ty) * kk;
      if (Math.abs(F.look.tx) < 0.02 && Math.abs(F.look.ty) < 0.02) {
        F.look.tx = F.look.ty = 0;
        F.free = false;
      }
    }
  }
  F.look.x += (F.look.tx - F.look.x) * Math.min(1, dt * 5);
  F.look.y += (F.look.ty - F.look.y) * Math.min(1, dt * 5);
  w3.cam.rotateY(-F.look.x);
  w3.cam.rotateX(-F.look.y);
  /* Отвернулись сильно - рамка кабины уходит: смотреть на переплёт
     остекления, когда голова повёрнута назад, неоткуда. Доля идёт в
     CSS, гасит рамку сама вёрстка. */
  /* Панель не имеет права исчезать совсем. Владелец поймал это:
     «в какой-то момент панель управления вообще исчезает». Корпус
     корабля никуда не девается оттого, что пилот повернул голову -
     он лишь уходит из поля зрения по краям. Поэтому доля отворота
     ограничена: рамка бледнеет, но остаётся. */
  var away = Math.min(0.42, Math.max(0, (Math.abs(F.look.x) - 0.85) / 1.1));
  if (Math.abs(away - (F.awayPub || 0)) > 0.02) {
    F.awayPub = away;
    ui.wrap.style.setProperty("--rcf-away", away.toFixed(2));
  }
  /* Портрет: окно кокпита выше середины экрана, и цель, посаженная
     в геометрический центр, пряталась под нижнюю раму. Лёгкий
     наклон камеры вниз поднимает цель в стекло. */
  if (innerHeight > innerWidth) w3.cam.rotateX(-0.042);

  /* В режиме сцены постановку кадра целиком ведёт салон: камера
     стоит внутри корабля, обходит его взглядом и подступает к
     остеклению. Всё, что насчитано выше - маршрут, взгляд, крен,
     тряска - к салону отношения не имеет, поэтому положение и
     поворот переписываются здесь начисто. */
  if (F.stage && cabin) stageCam(dt);

  /* Apply the inertial offset in camera-local coordinates after the
     autopilot orientation is solved. The physical cabin is attached
     to this camera, so frame, console and pilot move as one rigid
     assembly and the outside world alone supplies the parallax. */
  if (!F.stage && Math.abs(F.camSurge || 0) > .0005) {
    w3.tmpB.set(0, -Math.abs(F.camSurge) * .035, F.camSurge);
    w3.tmpB.applyQuaternion(w3.cam.quaternion);
    w3.cam.position.add(w3.tmpB);
    w3.cam.rotateX(-F.camSurge * .006);
  }

  var speed = Math.abs(F.v);

  /* Крен в вираж. Настоящий пилот не поворачивает плашмя: он кладёт
     корабль на борт и тянет. Раньше камера ходила строго по
     горизонту, и любой доворот выглядел движением мыши, а не
     манёвром. Крен берём от бокового взгляда и от кругового хода на
     орбите, доводим лениво - резкий крен читается сбоем. */
  var bankT = -F.look.x * 0.20 + (F.orbit && !F.orbit._far ? 0.055 : 0);
  F.bank = (F.bank || 0) + (bankT - F.bank) * Math.min(1, dt * 1.6);
  if (F.bank > 0.0004 || F.bank < -0.0004) w3.cam.rotateZ(F.bank);

  /* Тряска: прыжок, близость дыры и собственная тяга. Тягу считаем
     отдельно и мягче - на разгоне корабль должен дрожать, но не
     мешать целиться. */
  var nearHole = Math.max(0, 1 - w3.cam.position.distanceTo(w3.hole.position) / 500);
  var thrust = Math.min(0.34, speed * 1.9);
  /* Дрожь корпуса к пробою нарастает вдвое: машина работает на
     пределе, и кадр обязан это показывать */
  var jShake = jumpZone ? (0.7 + (F.jFlash || 0) * 1.5) : 0;
  F.shake += (jShake + nearHole * 0.7 + thrust - F.shake) * Math.min(1, dt * 3);
  if (F.shake > 0.02) {
    w3.cam.rotateZ(Math.sin(ts * 0.021) * 0.004 * F.shake);
    w3.cam.position.x += Math.sin(ts * 0.037) * 0.5 * F.shake;
    w3.cam.position.y += Math.cos(ts * 0.029) * 0.5 * F.shake;
  }

  /* Поле зрения дышит от скорости */
  /* Объектив на прыжке. Раньше он просто раскрывался - и разгон
     читался «поехали быстрее». Настоящий пробой сначала СЖИМАЕТ
     кадр (длинный фокус, стенки туннеля сходятся), а на выходе
     разжимает его с перелётом - именно этот рывок и ощущается как
     «выскочили». */
  var jf = 0;
  if (jumpZone && w3.at) {
    var jp = Math.max(0, Math.min(1, (F.p - w3.at.jump0) / Math.max(0.001, w3.at.jump1 - w3.at.jump0)));
    jf = jp < 0.74 ? -22 * (jp / 0.74) : 30 * Math.pow(1 - (jp - 0.74) / 0.26, 2);
  }
  /* Зум держится, пока им пользуются, и медленно стекает обратно:
     кадр не должен остаться увеличенным навсегда, но и сбрасываться
     рывком, едва отпустили пальцы, тоже не должен. */
  if (F.zoom > 0.001) F.zoom = Math.max(0, F.zoom - dt * 0.06);
  var fovGoal = (W3.fov0 || 72) * (1 - (F.zoom || 0) * 0.55) + speed * 46 + jf;
  w3.cam.fov += (fovGoal - w3.cam.fov) * Math.min(1, dt * 4);
  w3.cam.updateProjectionMatrix();

  /* Живой мир */
  w3.earth.rotation.y += dt * 0.02;
  if (w3.clouds) w3.clouds.rotation.y += dt * 0.009;
  w3.moon.rotation.y += dt * 0.012;
  w3.mars.rotation.y += dt * 0.022;
  w3.saturn.rotation.y += dt * 0.03;
  if (w3.solarLive) {
    for (var sli = 0; sli < w3.solarLive.length; sli++) {
      if (w3.solarLive[sli] && w3.solarLive[sli].update) {
        w3.solarLive[sli].update(dt, w3.cam.position);
      }
    }
  }
  w3.hole.rotation.y += dt * 0.14;
  w3.diskMat.uniforms.uT.value = ts * 0.001;
  /* Небо больше не вращается.

     Панорама крутилась на 0.0025 рад/с, а звёздное поле стояло:
     полоса Млечного Пути из панорамы медленно уезжала относительно
     сгущения звёзд, и через несколько минут два неба расходились.
     В космосе фон вокруг корабля и не вращается: поворачивается сам
     корабль. Галактики тоже остановлены - оборот за десять минут у
     объекта, до которого миллионы лет лёта, глаз читает как
     заводную игрушку. */
  if (w3.nebSprites) {
    for (var nbi = 0; nbi < w3.nebSprites.length; nbi++) {
      var nb = w3.nebSprites[nbi];
      nb.rotation.y += dt * (nbi % 2 ? -.0011 : .0008);
      nb.rotation.z += dt * (nbi % 2 ? .00035 : -.00028);
    }
  }
  if (w3.belt1) { w3.belt1.rotation.y += dt * 0.0012; w3.belt2.rotation.y -= dt * 0.0009; }

  /* Nearby belt rocks rotate independently. Updating at ~15 Hz is
     visually continuous at their angular speed and avoids rebuilding
     instance matrices on every 60 Hz frame. */
  if (w3.rockField && ts - (frame._rockT || 0) > 66) {
    frame._rockT = ts;
    var rf = w3.rockField, its = rf.userData.items;
    var rm = rf.userData.matrix, rq = rf.userData.quaternion, re = rf.userData.euler;
    for (var rfi = 0; rfi < its.length; rfi++) {
      var ir = its[rfi];
      ir.rx += ir.sx * .066; ir.ry += ir.sy * .066; ir.rz += ir.sz * .066;
      re.set(ir.rx, ir.ry, ir.rz); rq.setFromEuler(re);
      rm.compose(ir.p, rq, ir.s); rf.setMatrixAt(rfi, rm);
    }
    rf.instanceMatrix.needsUpdate = true;
  }

  /* Пыль заворачивается вокруг камеры: частица, отставшая больше
     чем на полкуба, перекладывается на другую сторону */
  if (w3.dust && ts - (frame._dustT || 0) > 120) {
    frame._dustT = ts;
    var dp = w3.dust.geometry.attributes.position, half = w3.dust.userData.side / 2;
    var cxp = w3.cam.position.x, cyp = w3.cam.position.y, czp = w3.cam.position.z;
    for (var di = 0; di < dp.count; di++) {
      var vx = dp.getX(di), vy = dp.getY(di), vz = dp.getZ(di);
      var moved = false;
      if (vx - cxp > half) { vx -= half * 2; moved = true; } else if (cxp - vx > half) { vx += half * 2; moved = true; }
      if (vy - cyp > half) { vy -= half * 2; moved = true; } else if (cyp - vy > half) { vy += half * 2; moved = true; }
      if (vz - czp > half) { vz -= half * 2; moved = true; } else if (czp - vz > half) { vz += half * 2; moved = true; }
      if (moved) dp.setXYZ(di, vx, vy, vz);
    }
    dp.needsUpdate = true;
  }

  /* ── Регулятор плавности ──────────────────────────────────
     Прежний страж был односторонним и срабатывал слишком поздно.
     Порог стоял на 55 мс - это восемнадцать кадров в секунду, то
     есть он молчал ровно в той полосе, где человек уже видит
     дёрганье, но картинка ещё не разваливается. Обратно он не
     отпускал никогда: одна тяжёлая секунда на сборке сцены роняла
     качество до конца сеанса.

     Хуже того, первая же его ступень могла плотность ПОДНЯТЬ:
     стояло max(1, devicePixelRatio * 0.75), и на телефоне с
     плотностью три это давало 2.25 при рабочем потолке 1.35.
     Страж, который в ответ на тормоза добавляет заливки.

     Здесь замкнутая обратная связь. Считаем медиану по последним
     сорока кадрам - не среднее: одиночный выброс на сборке
     текстуры не должен двигать качество, а медиана его не
     замечает.

     Пороги нельзя задавать числом в миллисекундах, и это главное
     место, где легко ошибиться. Время между кадрами держит развёртка
     экрана: на шестидесяти герцах ровный, ничем не загруженный кадр
     приходит через 16.7 мс, и быстрее не станет никогда, сколько бы
     запаса ни было у видеокарты. Порог «быстро» ниже шага развёртки
     означает, что регулятор не поднимется НИ РАЗУ ни на одном
     обычном экране. Поэтому считаем от самого шага: держим
     наименьшую виденную медиану как оценку развёртки и меряем
     относительно неё.

       медиана хуже 24 мс или полутора шагов - убавляем плотность;
       медиана в пределах 12 процентов от шага - прибавляем;
       между ними не трогаем ничего.

     Так регулятор читает не скорость, а запас: «кадры приходят
     ровно по развёртке, значит можно попробовать больше точек».
     Если после прибавки кадры поплыли - следующий шаг вернёт назад.
     Это подъём в гору с проверкой, а не расчёт по железу, которого
     мы не знаем.

     Полоса нечувствительности между порогами нужна, иначе
     регулятор начнёт качаться вокруг цели, и зритель увидит
     дыхание резкости. Шаги разные нарочно: вниз 15 процентов
     (спасать плавность надо быстро), вверх 8 (возвращать качество
     можно не спеша). Вниз разрешаем через секунду с четвертью,
     вверх через четыре: после понижения нужно дать кадру устояться,
     иначе регулятор начнёт ходить туда-обратно на границе. После
     каждого решения окно замера очищается - иначе следующее
     принималось бы по кадрам, снятым при прежней плотности.

     Пол 0.72 и потолок из stageLite: ниже пола картинка становится
     мылом, выше потолка резкость уже не растёт, а заливка растёт.

     Украшения снимаем только когда упёрлись в пол и всё равно не
     тянем. Их не возвращаем: плотность меняется незаметно, а
     появление и исчезновение шлейфа или облаков заметно очень. */
  /* В салоне регулятор молчит, и это не исключение ради удобства.
     Там кадр ведёт прокрутка: камера едет по странице, картинка
     почти стоит, и плавность в привычном смысле ни на что не
     влияет. Зато панель в проёме обязана совпасть с игровой один в
     один - это условие бесшовного перехода, и оно проверяется
     попиксельно. Понижение плотности его ломает: замер показал рост
     расхождения по пульту с 0.54 до 2.16 из 255, как только
     регулятор туда дотянулся.

     В игре наоборот: кадр движется, и плавность важнее половины
     точки плотности. Поэтому регулятор работает ровно там. */
  var окно = frame._окно || (frame._окно = []);
  окно.push(dt);
  if (окно.length > 40) окно.shift();
  if (F.stage) окно.length = 0;
  else if (окно.length >= 24 && ts - (frame._плT || 0) > 1250) {
    var сорт = окно.slice().sort(function (a, b) { return a - b; });
    var мед = сорт[сорт.length >> 1];
    /* Шаг развёртки: наименьшая виденная медиана. Ниже шести
       миллисекунд не опускаем - это уже не экран, а сбой замера. */
    frame._шаг = Math.max(0.006, Math.min(frame._шаг || 0.0167, мед));
    var шаг = frame._шаг;
    var тек = w3.r.getPixelRatio();
    var пол = 0.72, пот = w3["потолокПл"] || тек;
    var нов = 0;
    if (мед > Math.max(0.024, шаг * 1.5) && тек > пол) нов = Math.max(пол, тек * 0.85);
    else if (мед < шаг * 1.12 && тек < пот && ts - (frame._внизT || 0) > 4000)
      нов = Math.min(пот, тек * 1.08);
    if (нов && Math.abs(нов - тек) > 0.02) {
      if (нов < тек) frame._внизT = ts;
      плотность(нов);
      frame._плT = ts;
      окно.length = 0;
    } else if (мед > Math.max(0.030, шаг * 1.9) && тек <= пол + 0.01) {
      /* Пол достигнут, а кадр всё равно тяжёлый: дальше платит не
         резкость, а украшения. Сначала шлейф и оптика остекления,
         потом облака Земли - по одной ступени за раз. */
      frame._плT = ts;
      окно.length = 0;
      frame._deg = (frame._deg || 0) + 1;
      if (frame._deg === 1) {
        w3.fx = false;
        if (w3.wash) w3.wash.visible = false;
        if (ui.wrap) { ui.wrap.style.setProperty("--rcf-warp", "0"); ui.wrap.style.setProperty("--rcf-glow", "0"); }
      } else if (frame._deg === 2 && w3.clouds) w3.clouds.visible = false;
      else if (frame._deg === 3 && w3.post) w3.post.enabled = false;
    }
  }

  /* Комета: эллипс между Марсом и Сатурном, хвост от солнца */
  if (w3.comet) {
    var ca = ts * 0.000021;
    w3.comet.position.set(950 + Math.cos(ca) * 520, -40 + Math.sin(ca * 1.7) * 90, -860 + Math.sin(ca) * 300);
    w3.tmpB.copy(w3.comet.position).sub(w3.sunGlow.position).normalize();
    w3.comet.lookAt(w3.tmpA.copy(w3.comet.position).add(w3.tmpB));
    w3.comet.rotateY(Math.PI / 2);
  }
  /* Спутник: низкая орбита Земли с наклоном */
  if (w3.sat) {
    var sa = ts * 0.00011;
    w3.sat.position.set(Math.cos(sa) * 76, 18 + Math.sin(sa * 2) * 12, Math.sin(sa) * 76);
    w3.sat.rotation.y = sa + 1.2;
  }

  /* Кнопка развёртывания и луч: состояние кнопки меняется редко,
     поэтому проверяем её десять раз в секунду, а не в каждом кадре */
  if (ts - (frame._netT || 0) > 100) {
    frame._netT = ts;
    netButton();
    reqTick(ts);
  }
  if (netBeamT > 0) {
    netBeamT -= dt;
    if (netBeam) {
      netBeam.material.opacity = Math.max(0, netBeamT / 0.65) * 0.95;
      if (netBeamT <= 0) { убрать(netBeam); netBeam = null; }
    }
  }
  /* Узлы дышат: сеть живая, по ней идёт трафик */
  for (var nn = 0; nn < netNodes.length; nn++) {
    netNodes[nn].s.scale.setScalar(6 + Math.sin(ts * 0.003 + nn) * 1.5);
  }

  /* ── Голограммы над объектами ──────────────────────────────
     Клиент просил: «текст = голограммы, реагирующие на клики,
     касания, наведение, красиво растворяются и появляются». Метки
     рисует rc-holo, а игра каждый кадр говорит ему, где объект на
     экране и насколько он далёк. Считаем не чаще двадцати раз в
     секунду: чаще глазу не нужно, а проекций тут два десятка. */
  if (g.RC_HOLO && ts - (frame._holoT || 0) > 48) {
    frame._holoT = ts;
    holoFrame(w3, ts);
  }

  /* Сканер: находит цель ближе всех к центру кадра, ведёт её
     рамкой захвата и пишет дистанцию. Заодно пополняет журнал
     исследователя. Работает в своём темпе - двенадцать раз в
     секунду, дешевле рейкаста. */
  if (F.scan && ui.lock && ts - (frame._scanT || 0) > 84) {
    frame._scanT = ts;
    /* Радиус поиска цели. Было 0.55 в долях полукадра - это почти
       четверть неба, и прицел ловил тело, до которого корабль ещё и
       не повёрнут. Треть - это примерно то, что человек считает
       «навёл». */
    var bestT = null, bestD = 0.30, sx = 0, sy = 0, bd = 0;
    for (var si = 0; si < (w3.scanTargets || []).length; si++) {
      var tg = w3.scanTargets[si];
      /* Цели чужих вселенных считаются только там, где они видны:
         иначе прибор ведёт объект из другого рукава сквозь всё небо */
      if (tg.uni !== undefined && tg.uni !== uniIdx) continue;
      if (tg.uni === undefined && uniIdx !== 0) continue;
      /* И просто по факту видимости. Фильтр по вселенной не ловит
         тела, спрятанные внутри своей: галактические поля дома
         скрыты, но uni у них не задан - сканер вёл их сквозь всё
         небо, рамка захвата вставала на пустое место и писала «ПОЛЕ
         KEPLER». Зеркально в рукаве, где поле как раз видно, оно
         пропускалось. */
      if (!видимоЛи(tg.o)) continue;
      w3.tmpA.setFromMatrixPosition(tg.o.matrixWorld).project(w3.cam);
      if (w3.tmpA.z > 1) continue;                  /* за спиной */
      var dxn = w3.tmpA.x, dyn = w3.tmpA.y;
      var dc = Math.sqrt(dxn * dxn + dyn * dyn);
      if (dc < bestD) {
        bestD = dc; bestT = tg;
        sx = (dxn * 0.5 + 0.5) * innerWidth;
        sy = (-dyn * 0.5 + 0.5) * innerHeight;
        bd = w3.cam.position.distanceTo(w3.tmpB.setFromMatrixPosition(tg.o.matrixWorld));
      }
    }
    if (bestT) {
      /* Писк только на смену цели: на каждый кадр захвата он
         превращался бы в непрерывный зуммер */
      if (frame._lockOn !== bestT.key && g.RC_SOUND && g.RC_SOUND.lock) {
        try { g.RC_SOUND.lock(); } catch (eЗ) {}
      }
      frame._lockOn = bestT.key;
      ui.lock.classList.add("on");
      /* ── Рамка захвата стоит по центру ОСТЕКЛЕНИЯ ──────────────
         Раньше она вставала прямо на экранную проекцию тела. Тело
         могло оказаться где угодно в пределах полукруга поиска, и
         рамка выскакивала то снизу, то справа, а на панель
         управления налезала запросто. Заказчик описал оба следствия:
         «квадратик где-то снизу справа появляется, а должен быть в
         центре» и «никакие надписи не должны заходить на панель
         управления».

         Прицел на то и прицел, чтобы стоять в одном месте: наводишь
         корабль - тело входит в прицел. Поэтому рамка садится в
         центр ПРОЁМА, а не кадра: у проёма центр выше середины
         экрана, потому что низ занимает пульт, и рамка по центру
         кадра половиной лежала бы на приборах.

         Радиус поиска цели при этом ужат (см. bestD выше): прицел
         обязан показывать то, на что корабль действительно наведён,
         а не то, что попало в четверть неба. */
      var рм = holoFrame._рамка;
      var цx = рм ? (рм[0] + рм[2]) / 2 : innerWidth / 2;
      var цy = рм ? (рм[1] + рм[3]) / 2 : innerHeight / 2;
      /* ── И вторая, более старая ошибка: чужие координаты ───────
         Рамка лежит в слое, у которого своё начало отсчёта, а
         координаты ей давали ЭКРАННЫЕ. Замер: слой начинается в
         точке 34 на 146, и рамка вставала ровно на столько же
         правее и ниже, чем нужно. Это и есть «квадратик где-то снизу
         справа»: прибор честно считал место тела, а рисовал его со
         сдвигом в размер рамы рубки.

         Ошибка была и до правки центрирования - просто там она
         означала, что прицел показывает не на то тело, на которое
         навёлся. Приводим к системе отсчёта слоя. */
      var род = ui.lock.offsetParent;
      if (род) {
        var рр = род.getBoundingClientRect();
        цx -= рр.left; цy -= рр.top;
      }
      ui.lock.style.left = цx + "px";
      ui.lock.style.top = цy + "px";
      /* Масштаб мира: радиус Земли 60 единиц = 6371 км, то есть
         единица - около ста километров. Дистанции получаются
         орбитальные, как и вся сцена. */
      var tkm = bd * 106 / 1000;
      ui.lockCap.textContent = bestT.name + " · " + (tkm >= 1000
        ? ((tkm / 1000).toFixed(1) + (RU ? " млн км" : "M km"))
        : (Math.round(tkm) + (RU ? " тыс. км" : "K km")));
      noteExplored(bestT.key);
    } else {
      frame._lockOn = "";
      ui.lock.classList.remove("on");
    }
  }

  /* Бортовой справочник: навёл на планету или галактику - корабль
     говорит, что это и когда открыто. Дорогую проверку пересечений
     гоняем восемь раз в секунду, не каждый кадр. */
  /* Нажатие обслуживаем В ТОТ ЖЕ КАДР, не дожидаясь очереди.
     Проверка пересечений идёт восемь раз в секунду, и нажатие
     могло пролежать до ста двадцати миллисекунд. Всё это время
     камеру доворачивает мышь, и луч уходил уже из другого ракурса:
     замер живыми кликами дал двадцать один клик по телу и ноль
     верных досье, причём луч из точки клика не попадал в тело
     вообще. Отсюда и «некоторые планеты не кликаются». */
  if (ui.info && (F.mx !== undefined) && (F.pick || ts - (frame._pickT || 0) > 120)) {
    frame._pickT = ts;
    if (!frame._ray) frame._ray = new T.Raycaster();
    frame._ray.setFromCamera({ x: F.mx, y: F.my }, w3.cam);
    var hits = frame._ray.intersectObjects(w3.pickables || [], false);
    var info = null, hitObj = null;
    /* Мягкие тела - невидимые оболочки вроде пояса астероидов. Они
       нужны, чтобы по россыпи точек вообще можно было нажать, но
       забирать нажатие у настоящей планеты за ними им нельзя.
       Держим их про запас и берём, только если больше ничего нет. */
    var мягИнфо = null, мягКто = null;
    for (var hi = 0; hi < hits.length; hi++) {
      var кто = hits[hi].object;
      /* three.js рейкастом спрятанные объекты НЕ отсеивает: он бьёт
         по списку как есть. Отсюда жалоба «кликаю на планету чужого
         рукава, открывается описание Земли» - Земля лежала невидимой
         ровно на той же линии взгляда. Проверяем видимость сами, и
         обязательно по всей ветке вверх: прячут обычно группу. */
      if (!видимоЛи(кто)) continue;
      if (!лучЗадел(frame._ray, кто)) continue;
      if (кто.userData && кто.userData.info) {
        if (кто.userData["мягкий"]) {
          if (!мягИнфо) { мягИнфо = кто.userData.info; мягКто = кто; }
          continue;
        }
        info = кто.userData.info; hitObj = кто; break;
      }
    }
    if (!info && мягИнфо) { info = мягИнфо; hitObj = мягКто; }
    /* Нажали по телу - снимаем с него карту. Наведение по-прежнему
       только подписывает; досье открывает именно нажатие, иначе оно
       выскакивало бы от каждого движения мыши. */
    if (F.pick && info && hitObj) {
      dosOpen(hitObj, info);
      F.infoUntil = ts + 4200;
      hideHint();
    }
    else if (F.pick && !info) dosClose();
    /* A phone has no hover. Treating the resting centre reticle as a
       mouse made the Earth card open by itself and collide with the
       control hint. Mobile cards now exist only after a real tap and
       remain long enough to read. Desktop keeps deliberate hover. */
    /* Курсор стоит на теле - запоминаем: пока это так, свободный
       доворот от мыши замирает, иначе цель уезжает из-под курсора. */
    F["наТеле"] = !!info;
    var shownInfo = info && (innerWidth >= 760 || ts < (F.infoUntil || 0)) ? info : null;
    if (shownInfo !== frame._info) {
      frame._info = shownInfo;
      if (shownInfo) {
        ui.info.textContent = shownInfo;
        ui.info.classList.add("on");
        if (ui.cap && ui.cap.parentNode) ui.cap.parentNode.classList.add("has-info");
        if (!(hitObj && hitObj.userData && hitObj.userData["реле"])) {
          noteExplored(меткаТела(hitObj) || shownInfo.split(" · ")[0]);
        }
        if (g.RC_SOUND) { try { (g.RC_SOUND.uiHover || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
      }
      else {
        ui.info.classList.remove("on");
        if (ui.cap && ui.cap.parentNode) ui.cap.parentNode.classList.remove("has-info");
      }
    }
    F.pick = false;
  }

  /* Стримы прыжка едут за камерой и светятся только в прыжке.
     Полосы ещё и НЕСУТСЯ: раньше пучок был приклеен к камере
     намертво, и в гиперпрыжке звёздный туннель стоял на месте -
     светилось, но не летело. Теперь он ползёт вдоль своей оси и
     заворачивается по кругу, а к середине прыжка растягивается
     вдвое: полоса тем длиннее, чем быстрее идёт свет мимо. */
  /* Время для мерцания звёзд. Дрожание еле заметное и только у
     ярких, но без него небо стоит намертво и читается наклейкой. */
  if (w3.starMats && w3.starMats.уни) w3.starMats.уни.uT.value = ts * 0.001;

  /* Атмосферные оболочки узнают, где солнце.

     Массив собирался и НИКОГДА не читался: у Венеры, Юпитера, Урана
     и Нептуна направление на светило навсегда оставалось тем, что
     вписали при сборке - (1, 0.35, 0.6). Закатный поясок и
     подсвеченная кромка смотрели в произвольную сторону, не
     совпадающую ни со светом, ни с самим солнцем в кадре. Считаем
     раз в несколько кадров: тела движутся медленно, а нормализация
     вектора на каждую оболочку каждый кадр не нужна. */
  /* Раз в восьмую долю секунды: медленное и дорогое. Оболочки
     атмосфер могут и не собраться, а ядра галактик есть всегда,
     поэтому условие тут только по времени. */
  if (!атмКадр.t || ts - атмКадр.t > 120) {
    атмКадр.t = ts;
    /* Ядро галактики гаснет по мере подлёта. Спрайт ядра это
       упрощение, честное только издали: вблизи никакого светящегося
       шара нет, есть плотная россыпь звёзд балджа. Пока спрайт
       оставался на месте, полёт сквозь Млечный Путь упирался в белую
       кляксу во весь проём. */
    var галактики = [w3.milky, w3.gal2, w3.gal3];
    for (var ги = 0; ги < 3; ги++) {
      var га = галактики[ги];
      if (!га || !га.userData || !га.userData.ядро) continue;
      var рад = га.userData.радиус || 900;
      var дг = w3.cam.position.distanceTo(га.position);
      var к = Math.max(0, Math.min(1, (дг - рад * 0.55) / (рад * 1.4)));
      га.userData.ядро.material.opacity = 0.5 * к;
      if (га.userData.гало) га.userData.гало.material.opacity = 0.42 * (0.35 + 0.65 * к);
    }
    /* Кольцам Сатурна направление на солнце нужно по той же причине:
       по нему шейдер кладёт тень планеты на кольцо. */
    if (w3.ringMat && w3.ringMat.uniforms && w3.saturn) {
      w3.ringMat.uniforms.uSun.value
        .copy(w3.СОЛНЦЕ || w3.sun.position)
        .sub(w3.saturn.position).normalize();
    }
    for (var аи = 0; аи < (w3.atmShells ? w3.atmShells.length : 0); аи++) {
      var об = w3.atmShells[аи];
      if (!об || !об.mesh || !об.mesh.material || !об.mesh.material.uniforms) continue;
      var у = об.mesh.material.uniforms.uSun;
      if (!у) continue;
      var центр = об.body && об.body.position ? об.body.position : об.mesh.position;
      у.value.copy(w3.СОЛНЦЕ || w3.sun.position).sub(центр).normalize();
    }
  }

  var jm = w3.jump.material;
  jm.opacity += ((jumpZone ? 0.85 : 0) - jm.opacity) * Math.min(1, dt * 3);
  if (jm.opacity > 0.01) {
    var jk = 0;
    if (w3.at) {
      jk = (F.p - w3.at.jump0) / Math.max(0.001, w3.at.jump1 - w3.at.jump0);
      jk = jk < 0 ? 0 : jk > 1 ? 1 : jk;
      /* Фаза туннеля: к концу прыжка полосы уходят из циана в
         фиолет - видно, что летим уже по другому рукаву */
      jm.color.setRGB(0.62 - jk * 0.2, 0.85 - jk * 0.35, 0.94);
      /* Накал ведёт и белизну ядра, и длину хвоста: к пробою след
         вытягивается и выгорает добела, после выхода успокаивается. */
      if ("heat" in jm) jm.heat = Math.pow(Math.sin(Math.min(1, jk * 1.12) * Math.PI), 0.8);
    }
    F.jz = ((F.jz || 0) + dt * (420 + jk * 1500)) % 300;
    /* Растяжение полос идёт не ровной синусоидой, а с изломом на
       трёх четвертях: свет мимо стекла разгоняется до самого выхода
       и только там обрывается. Прежняя гладкая дуга читалась
       «полетели и вернулись», а не «пробили пространство». */
    var stretch = 1 + Math.pow(Math.sin(Math.min(1, jk * 1.18) * Math.PI), 0.7) * 3.4;
    w3.jump.position.copy(w3.cam.position);
    w3.jump.quaternion.copy(w3.cam.quaternion);
    w3.jump.scale.set(1 - jk * 0.35, 1 - jk * 0.35, stretch);
    w3.jump.translateZ(F.jz);
  }

  /* ── Прыжок как событие ──────────────────────────────────
     «Скачок эффект доработать реалистичнее между Млечным Путём и
     вселенными» - и правда, раньше это были только полосы. Настоящий
     переход собран из четырёх вещей, и все они идут по одной доле:

       разгон   - кадр сжимается, объектив уходит в длинный фокус,
                  корпус начинает бить дрожью;
       пробой   - на трёх четвертях идёт вспышка, короткая и злая;
       выход    - кадр разжимается обратно с перелётом, звёзды
                  успокаиваются, вспышка гаснет;
       звук     - нарастающий гул, обрыв на вспышке, тишина после.

     Ни один из этих слоёв сам по себе не работает: сжатие без
     вспышки читается лагом, вспышка без сжатия - морганием. */
  var jNow = jumpZone ? Math.max(0, Math.min(1,
    (F.p - (w3.at ? w3.at.jump0 : 0.585)) /
    Math.max(0.001, (w3.at ? w3.at.jump1 - w3.at.jump0 : 0.27)))) : -1;
  if (jNow >= 0) {
    /* Вспышка пробоя: узкое окно у трёх четвертей пути */
    var flash = Math.max(0, 1 - Math.abs(jNow - 0.74) / 0.07);
    F.jFlash = flash * flash;
    if (ui.fade) {
      ui.fade.style.transition = "none";
      ui.fade.style.background =
        "radial-gradient(circle at 50% 50%, rgba(226,244,255," + (F.jFlash * 0.95).toFixed(3) +
        "), rgba(150,200,255," + (F.jFlash * 0.5).toFixed(3) + ") 45%, rgba(10,20,40,0) 78%)";
      ui.fade.style.opacity = F.jFlash > 0.01 ? "1" : "0";
    }
    /* Звук пробоя ровно один раз за прыжок */
    if (F.jFlash > 0.5 && !F.jBang) {
      F.jBang = true;
      if (g.RC_SOUND) {
        try {
          if (g.RC_SOUND.hyper) g.RC_SOUND.hyper();
          else if (g.RC_SOUND.blip) g.RC_SOUND.blip(90, 0.9, "sawtooth", 0.05);
        } catch (e) {}
      }
      /* Пробой не декорация: на вспышке корабль реально уходит в
         первый открытый чужой рукав. Раньше туннель, вспышка и
         надпись были, а прыжка НЕ БЫЛО - владелец назвал это
         «других вселенных по факту нету», и был прав. */
      /* Раньше здесь брался первый попавшийся открытый рукав, а
         первый открытый всегда один и тот же - EXO-1. Сколько ни
         прыгай, попадаешь в него же: владелец так и написал,
         «полёт застревает на 2 вселенной, 3-4 вообще нету».
         Теперь пробой ведёт туда, где ещё не были, а когда обойдены
         все - в следующий по кругу от прошлого. */
      var открытые = [];
      for (var qi = 1; qi < UNIVERSES.length; qi++) {
        var uu3 = UNIVERSES[qi];
        if (!uu3.need || netCount() >= uu3.need) открытые.push(qi);
      }
      var nxt = 0;
      if (открытые.length) {
        F.былиВ = F.былиВ || {};
        for (var qk = 0; qk < открытые.length; qk++) {
          if (!F.былиВ[открытые[qk]]) { nxt = открытые[qk]; break; }
        }
        if (!nxt) {
          var пред = открытые.indexOf(F.ластРукав || 0);
          nxt = открытые[(пред + 1) % открытые.length];
        }
      }
      if (nxt > 0 && uniIdx === 0) {
        /* Имя рукава уже содержит слово «рукав»: получалось
           «ПРОБОЙ · РУКАВ МЕСТНЫЙ РУКАВ · EXO-1» */
        say((RU ? "ПРОБОЙ · " : "BREACH · ") + UNIVERSES[nxt].name, 2800);
        setTimeout(function () { jumpUniverse(nxt); }, 480);
      } else {
        say(RU ? "ПРОБОЙ · МЛЕЧНЫЙ ПУТЬ ПОЗАДИ" : "BREACH · MILKY WAY BEHIND", 2600);
      }
    }
  } else if (F.jBang || F.jFlash) {
    F.jBang = false;
    F.jFlash = 0;
    if (ui.fade) { ui.fade.style.background = ""; ui.fade.style.opacity = "0"; }
  }

  /* ── Шлейф двигателя ──
     Искры ползут к зрителю по локальной оси Z и заворачиваются в
     начало трубы. Тяжёлого здесь нет: один проход по массиву
     координат, и то только когда шлейф вообще виден. */
  if (w3.wash && W3.fx) {
    var wm = w3.wash.material;
    /* Порог по тяге: на дрейфе шлейфа быть не должно, двигатель
       выключен. Иначе корабль как будто вечно жжёт топливо. */
    var wantW = Math.min(0.80, Math.max(0, speed - 0.008) * 6.5 + (jumpZone ? 0.5 : 0));
    wm.opacity += (wantW - wm.opacity) * Math.min(1, dt * 4);
    if (wm.opacity > 0.012) {
      w3.wash.visible = true;
      w3.wash.position.copy(w3.cam.position);
      w3.wash.quaternion.copy(w3.cam.quaternion);
      var wp = w3.wash.geometry.attributes.position;
      var adv = (26 + speed * 900 + (F.warpV || 0) * 0.05) * dt;
      var arr = wp.array;
      for (var wi = 2; wi < arr.length; wi += 3) {
        arr[wi] += adv;
        if (arr[wi] > 14) arr[wi] -= 134;        /* заворот трубы */
      }
      wp.needsUpdate = true;
      /* На разгоне искра крупнеет: точка одного размера при любой
         скорости выдаёт, что это спрайт, а не след */
      wm.size = 2 + Math.min(3.4, speed * 11);
    } else if (w3.wash.visible) {
      w3.wash.visible = false;
    }
  }

  /* Пыль у стекла густеет и вытягивается с ходом: ощущение скорости
     даёт не цифра, а то, что мимо начинает нестись вещество */
  if (w3.dust) {
    var dm = w3.dust.material;
    dm.opacity = 0.30 + Math.min(0.52, speed * 3.4 + (F.warpV || 0) * 0.0004);
    dm.size = 1.6 + Math.min(2.4, speed * 8);
  }

  /* ── Блик от светила ──
     Пролёт мимо звезды. Когда она попадает в поле зрения, в
     остеклении вспыхивает засветка - тем сильнее, чем ближе к
     оптической оси. Считаем один скалярный продукт и отдаём CSS
     три числа: ни одного лишнего прохода по кадру. */
  if (ui.fx && W3.fx && ts - (frame._glareT || 0) > 60) {
    frame._glareT = ts;
    var src = w3.sunGlow.position;
    if (uniIdx !== 0 && built[uniIdx]) {
      /* В чужом рукаве светило своё: берём ближайшую систему */
      var pk2 = built[uniIdx].root, bestSD = 1e18;
      for (var gi = 0; gi < pk2.children.length; gi++) {
        var sd = w3.cam.position.distanceToSquared(pk2.children[gi].position);
        if (sd < bestSD) { bestSD = sd; src = pk2.children[gi].position; }
      }
    }
    w3.tmpA.copy(src).sub(w3.cam.position).normalize();
    w3.cam.getWorldDirection(w3.tmpB);
    var axis = w3.tmpA.dot(w3.tmpB);
    var glow = 0, gx = 50, gy = 50;
    if (axis > 0.35) {
      w3.tmpA.copy(src).project(w3.cam);
      if (w3.tmpA.z < 1) {
        gx = (w3.tmpA.x * 0.5 + 0.5) * 100;
        gy = (-w3.tmpA.y * 0.5 + 0.5) * 100;
        /* Восьмая степень: засветка вспыхивает только когда светило
           почти в кадре, а не тлеет всё время */
        glow = Math.pow((axis - 0.35) / 0.65, 2.2);
        var dstar = w3.cam.position.distanceTo(src);
        glow *= Math.min(1, 2600 / Math.max(200, dstar));
      }
    }
    F.glow = (F.glow || 0) + (glow - (F.glow || 0)) * 0.35;
    var st2 = ui.wrap.style;
    st2.setProperty("--rcf-glow", F.glow.toFixed(3));
    st2.setProperty("--rcf-gx", gx.toFixed(1) + "%");
    st2.setProperty("--rcf-gy", gy.toFixed(1) + "%");
  }

  /* Панель кабины чуть оседает на разгоне: перегрузка.
     Тем же числом живёт оптика остекления: виньетка поджимается, по
     краям кадра расходится цвет. Это не постпроцессинг, а две
     заливки в CSS - разгон читается, кадр не дорожает. */
  if (ui.wrap) {
    ui.wrap.style.setProperty("--rcf-g", (speed * 5).toFixed(3));
    var warp = Math.min(1, speed * 4.2 + (jumpZone ? 0.55 : 0) + nearHole * 0.4 +
                           Math.min(0.35, (F.warpV || 0) * 0.0006));
    F.warp = (F.warp || 0) + (warp - (F.warp || 0)) * Math.min(1, dt * 4);
    ui.wrap.style.setProperty("--rcf-warp", F.warp.toFixed(3));
  }

  /* HUD */
  var cap = CAPTIONS[0];
  for (i = CAPTIONS.length - 1; i >= 0; i--) { if (F.p >= CAPTIONS[i].p) { cap = CAPTIONS[i]; break; } }
  /* У двух титров текст зависит от продукта: на сайте VPN Земля это
     узлы VPN, а чёрная дыра - РКН. Берём слово в момент показа, а не
     при сборке списка: переключатель продукта может щёлкнуть прямо
     в полёте, и титр обязан догнать. */
  if (cap["ключ"]) cap = { t: СЛ(cap["ключ"]) };
  /* Пока идёт перелёт к цели, титул честно говорит, куда летим */
  if (F.goal !== null && F.goal !== undefined && F.goalName) {
    cap = { t: (RU ? "КУРС → " : "COURSE → ") + F.goalName };
  }
  if (F.orbit && F.goalName) {
    cap = { t: (RU ? "ОРБИТА · " : "ORBIT · ") + F.goalName + (RU ? " · листайте, чтобы продолжить путь" : "") };
  }
  /* В чужой вселенной титры родной системы не к месту: там свои
     объекты, и подпись обязана говорить, где мы сейчас. Правило
     идёт последним - иначе цель, оставшаяся от родной системы,
     перебивала название рукава, в который мы только что прыгнули. */
  if (F.away) {
    cap = { t: UNIVERSES[uniIdx].name + (F.orbit && F.orbit.name ? " · " + F.orbit.name : "") };
  }
  if (ui.cap._t !== cap.t && !(ui.cap._hold && ts < ui.cap._hold)) {
    ui.cap._t = cap.t;
    ui.cap.textContent = cap.t;
    заново(ui.cap, "in");
  }
  ui.bar.style.width = (F.p * 100).toFixed(1) + "%";
  /* На перелёте между системами табло показывает настоящий ход:
     иначе при варпе счётчик стоял на месте, хотя мимо летит космос */
  /* Погасив ход, пилот видел на табло 8 км/с и считал прибор
     сломанным. Семь и девять - это первая космическая, она честна
     на витке и в полёте, но не тогда, когда корабль стоит. */
  var естьХод = speed > 0.0004 || (F.warpV || 0) > 1 || !!F.orbit;
  var spdV = естьХод ? Math.round(7.9 + speed * 6200 + (F.warpV || 0) * 0.9) : 0;
  if (spdV !== F._spdPub) {
    F._spdPub = spdV;
    var sv = String(spdV);
    for (var qi2 = 0; qi2 < ui.speedAll.length; qi2++) ui.speedAll[qi2].textContent = sv;
  }

  /* Звук идёт за тягой */
  if (g.RC_SOUND && g.RC_SOUND.flightLevel && !F.stage && ts - (F._sndT || 0) > 120) {
    F._sndT = ts;
    try { g.RC_SOUND.flightLevel(Math.min(1, 0.25 + speed * 4 + (jumpZone ? 0.35 : 0))); } catch (e) {}
  }

  /* Небо бесконечно: панорама едет за камерой, и на дальнем конце
     маршрута фон не редеет. */
  if (w3.sky) w3.sky.position.copy(w3.cam.position);

  /* Звёзды - на поводке, а не приклеены.

     Оболочка точек ехала за камерой ровно, точка в точку. Плотность
     от этого держалась, но пропадало главное: звёзды стояли на месте
     относительно кадра, и в окне не было НИ ОДНОГО признака, что
     корабль движется. Заказчик написал про космос «нет глубины», и
     это одна из двух причин, вторая была муть панорамы.

     Теперь оболочка тянется за камерой с запаздыванием: пока корабль
     не отошёл дальше длины поводка, звёзды остаются на месте и честно
     смещаются относительно планет - это и есть параллакс. Отошёл
     дальше - поводок дотягивает оболочку ровно настолько, чтобы
     расстояние не росло. Плотность неба сохраняется на всём маршруте,
     а движение видно.

     Длина поводка меньше внутреннего радиуса поля (1430) втрое с
     лишним: смещение заметно глазу и при этом ни одна звезда не может
     оказаться за спиной. */
  if (w3.starShell) {
    var шп = w3.starShell.position, цп = w3.cam.position;
    var одх = цп.x - шп.x, оду = цп.y - шп.y, одз = цп.z - шп.z;
    var отст = Math.sqrt(одх * одх + оду * оду + одз * одз);
    var ПОВОДОК = 420;
    if (отст > ПОВОДОК) {
      var доля = (отст - ПОВОДОК) / отст;
      шп.x += одх * доля; шп.y += оду * доля; шп.z += одз * доля;
    }
    /* Поводок двигает ВСЁ поле разом, то есть звёзды смещаются
       относительно планет, но друг относительно друга стоят. Второй
       слой параллакса живёт в вершинном шейдере: каждая звезда
       отстаёт на свою долю пройденного пути, обратную расстоянию.
       Путь обрезаем, иначе ближние звёзды уехали бы за спину. */
    if (w3.starMats && w3.starMats["уни"] && w3.starMats["уни"].uPar) {
      var пх = w3.cam.position.x, пу = w3.cam.position.y, пз = w3.cam.position.z;
      var пд = Math.sqrt(пх * пх + пу * пу + пз * пз);
      /* Восемьсот единиц потолка на ближней стенке в 1350 дают
         предельный увод около восьми градусов: рисунок созвездий за
         перегон заметно поворачивается - именно это и читается
         глубиной, - но небо не переворачивается. */
      var кп = пд > 800 ? -800 / пд : -1;
      w3.starMats["уни"].uPar.value.set(пх * кп, пу * кп, пз * кп);
    }
  }

  /* Фотосфера кипит: время идёт в шейдер звезды */
  if (w3.sunMat && w3.sunMat.uniforms) w3.sunMat.uniforms.uT.value = ts * 0.001;

  if (!F.stage) {
    powerFrame(w3, dt);
    projFrame(w3, dt);
    barsFrame(ts);
    courseFrame(w3, ts);
    missionFrame(ts);
    trafFrame(dt);
    failTick(ts);
    failPaint();
    netList();
    pilotCard();
    radarFrame(w3, ts);
  }

  physicalControlsFrame(ts, dt);
  /* Приборы плоской плиты живут отдельно от объёмных крышек: у неё их
     нет вовсе, и заход выше уходит на первой же строке. Ставить вызов
     внутрь него значило бы, что на плоской раме пульт не оживёт. */
  deckTick(ts, dt);
  earthSunFrame(w3);
  if (w3.post) w3.post.render(w3.scene, w3.cam, ts);
  else w3.r.render(w3.scene, w3.cam);
}

/* ── Куда светит солнце на Земле ─────────────────────────────
   Ночная сторона обязана совпадать с настоящим светилом сцены, а
   не с числом, вбитым в шейдер. Иначе корабль летит вокруг
   планеты, тени на корпусе едут, а огни городов стоят на месте -
   и весь кадр разваливается.

   Берём вектор от планеты к солнцу в мировых координатах и отдаём
   его шейдеру. Тот же вектор красит ободок атмосферы, поэтому
   закатный поясок ложится ровно на терминатор. */
function earthSunFrame(w3) {
  if (!w3 || !w3.earth || !w3.sunPos) return;
  var body = w3.earth.children && w3.earth.children[0];
  var mat = body && body.material;
  var sh = mat && mat.userData && mat.userData.sh;
  if (!sh && !w3.atmMat) return;
  if (!earthSunFrame.v) {
    earthSunFrame.v = new g.THREE.Vector3();
    earthSunFrame.e = new g.THREE.Vector3();
  }
  var v = earthSunFrame.v, e = earthSunFrame.e;
  w3.earth.getWorldPosition(e);
  /* Направление берём у настоящего источника света сцены. Раньше
     брали позицию декоративного шара солнца, а освещает планету
     направленный свет, стоящий в другом месте: ночная сторона
     считалась от одного вектора, а тени ложились от другого, и на
     кадре Земля выходила дневной при любом положении корабля. */
  var src = w3.sunLight ? w3.sunLight.position : w3.sunPos;
  v.copy(src).normalize();
  if (sh && sh.uniforms.uSunDir) sh.uniforms.uSunDir.value.copy(v);
  if (w3.atmMat && w3.atmMat.uniforms && w3.atmMat.uniforms.uSun) {
    w3.atmMat.uniforms.uSun.value.copy(v);
  }
}

/* ── Вход и выход ────────────────────────────────────────────ы */
function open() {
  /* Из режима сцены игра не открывается заново - она просыпается.
     Мир, камера и кабина уже в кадре, добавляются только приборы,
     управление и ход корабля. Именно поэтому между сайтом и игрой
     нет ни вспышки, ни перезагрузки, ни смены картинки. */
  var fromStage = F.stage;
  if (F.open && !fromStage) return;
  /* Полёта в этих режимах нет вовсе: слой спрятан стилями, и
     открывать его значит запереть страницу под невидимым окном.
     Стили прячут и все кнопки входа, но кнопку могут нажать и мимо
     них - из адреса, с клавиатуры, из чужого кода.

     МОЛЧА не отказываем. Владелец жаловался словами «вход в ракету
     ВСЕГДА зависает»: на третьей ступени упрощения кнопка «Полёт в
     открытый космос» оставалась видимой и нажималась, а игра не
     открывалась и не говорила ничего - тридцать пять секунд тишины
     читаются как зависание. Кнопка теперь скрыта, а если до отказа
     всё же дошли, человек слышит причину. */
  /* Отказываем только по ПРИГОВОРАМ, а не по показанию счётчика.

     Здесь третьим условием стояла ступень упрощения 3. Она
     транзиентная: поднимается после трёх секунд тяжёлых кадров и
     сама опускается после семи спокойных. Человек, дошедший до
     пульта, попадал в неё почти наверняка - и получал отказ там, где
     ничего непоправимого нет.

     У самого полёта есть регулятор плавности: он меряет кадр на
     настоящем устройстве и снимает плотность ступенями, а в крайнем
     случае убирает украшения. Тяжёлое устройство игра обслуживает
     сама. Отказ оставляем двум настоящим приговорам: человек
     попросил меньше движения, либо объёмного слоя нет вовсе. */
  if (root.classList.contains("rc-reduced") || root.classList.contains("rc-no3d")) {
    отказПолёта();
    return;
  }
  if (!g.THREE) {
    /* Объёмный слой ещё не доехал: дожидаемся и пробуем снова */
    var once = function () { removeEventListener("rc:3d", once); open(); };
    addEventListener("rc:3d", once);
    if (g.RC_GL && !g.RC_GL.want3d) return;   /* этому устройству не положено */
    return;
  }
  /* Корпус кабины ждём так же, как объёмный слой. Без него класс
     объёмной рубки вставал на пустое место, раскладка клавиш
     переезжала, а рамы вокруг не было - тот самый кадр «панель
     управления пропала». Пробуем снова, когда модуль доедет. */
  if (!g.RC_CABIN) {
    if (!open._ждуКабину) {
      open._ждуКабину = setInterval(function () {
        if (!g.RC_CABIN) return;
        clearInterval(open._ждуКабину);
        open._ждуКабину = 0;
        open();
      }, 220);
    }
    return;
  }
  buildUI();
  if (!F.built) {
    try { W3 = buildWorld(); } catch (e) {
      /* Молчаливое проглатывание однажды стоило нам всей игры:
         сборка мира падала, кнопка «Начать полёт» выглядела мёртвой,
         а в консоли было пусто. Пишем в консоль тоже - проверка
         обязана видеть такие падения. */
      try { console.error("rc-flight: мир не собрался -", e); } catch (e2) {}
      if (g.RC_track) g.RC_track("jserr", "flight: " + (e.message || e), true);
      return;
    }
    F.built = true;
    netRestore();
  }

  /* Direct launch and scroll launch use the same physical cabin.
     Previously a direct launch skipped RC_CABIN and exposed the
     cockpit image; that made two entry paths lead to two ships. */
  cabinBuild();
  F.open = true;
  /* Запоминаем, откуда пришли: сюда вернём фокус на выходе. */
  var кто = doc.activeElement;
  F.открыл = (кто && кто !== doc.body && кто !== doc.documentElement && кто.isConnected)
    ? кто
    : (doc.querySelector(".rcf-fab") || doc.querySelector(".rcf-cta-btn") || null);
  модальность(true);
  /* Фокус внутрь окна: без него чтение с экрана остаётся на
     странице, которую мы только что заглушили. */
  setTimeout(function () {
    if (!F.open || !ui.wrap) return;
    var первый = ui.wrap.querySelector(".rcf-close");
    try { (первый || ui.wrap).focus({ preventScroll: true }); } catch (eФ) {}
  }, 60);
  if (fromStage) {
    F.stage = false;
    F.stageK = 0;
    ui.wrap.classList.remove("rcf-stage");
    root.classList.remove("rc-stage");
    /* Салон уходит из сцены ровно в тот кадр, когда его корпус в
       проёме совпал с плоской рамкой полёта: подмены не видно, а
       геометрия комнаты больше не тратит ни кадра. */
    if (cabin && cabin.console3 && cabin.console3.group) cabin.console3.group.visible = true;
    if (stageWallMesh) {
      stageWallMesh.visible = false;
      var бт = stageWallMesh.userData.борта || [];
      for (var бi = 0; бi < бт.length; бi++) бт[бi].visible = false;
    }
    cabinFlightMode();
    cabFrameLayer();
    deckLayer();
    /* Класс ставим ТОЛЬКО когда корпус собран. Иначе раскладка
       клавиш уезжала в объёмную, а рамы вокруг не было. */
    if (cabin) ui.wrap.classList.add("rcf-native-cab");
  } else {
    F.p = 0; F.v = 0; F.last = 0;
    cabinFlightMode();
    cabFrameLayer();
    deckLayer();
    /* Класс ставим ТОЛЬКО когда корпус собран. Иначе раскладка
       клавиш уезжала в объёмную, а рамы вокруг не было. */
    if (cabin) ui.wrap.classList.add("rcf-native-cab");
  }

  /* Возвращаемся домой. Раньше выход из чужой вселенной оставлял
     uniIdx и F.away как есть: человек заходил снова, читал брифинг
     про Землю, Луну и Марс, а вокруг были пески RV-2, и в панели не
     было ни «Земли», ни «Домой». Маршрут начинается от Земли -
     значит и мир должен быть родной. */
  if (uniIdx !== 0 && !uniBusy) {
    uniIdx = 0;
    F.away = false;
    F.orbit = null;
    if (W3) { try { applyUniverse(0); } catch (e) {} }
    try { systemNav(); } catch (e2) {}
  }
  /* Карта миссии нужна тому, кто нажал «Полёт» посреди страницы:
     он ещё не в корабле, и ему надо объяснить, куда он попал.

     А вот из финала стык обязан быть бесшовным. Клиент описал его
     дословно: «отдалились, появилась надпись старта - и всё,
     дальше врубается игра». Мы в этот момент уже сидим в той же
     кабине, перед тем же остеклением: показывать поверх кадра
     карточку с двумя кнопками значит рвать сцену ровно там, где
     она должна склеиться. Поэтому в акте отлёта брифинга нет -
     корабль просто трогается на автопилоте. */
  var seamless = fromStage || root.getAttribute("data-act") === "egress";
  /* Запоминаем, как вошли: из финала прокруткой или кнопкой посреди
     страницы. От этого зависит, чем выходить. */
  F["изФинала"] = !!seamless;
  F["вверхНакоп"] = 0;
  /* Бесшовный старт из финала: сайтовая кабина стоит на своём
     масштабе, и игра обязана принять кадр в том же виде. Готовность
     рамки проверяем ещё раз - между сборкой интерфейса и открытием
     могла смениться ориентация, а с ней и картинка. */
  ui.wrap.classList.toggle("rcf-seam", seamless);
  F.brief = !seamless;
  F.orbit = null;
  F.goal = null;
  F.goalId = null;
  F.goalName = null;
  courseText(null);
  if (ui.brief) ui.brief.classList.toggle("off", seamless);
  F.scan = false;
  if (ui.scanKey) { ui.scanKey.classList.remove("cur"); ui.scanKey.setAttribute("aria-pressed", "false"); }
  if (ui.lock) ui.lock.classList.remove("on");
  paintProgress();
  netPaint();
  netButton();
  /* Автопилот не включается сам: «убери автоматический запуск полёта,
     это же игра, а не экскурсия». Кино включается кнопкой. */
  setAuto(false);
  if (!fromStage) { F.look.x = F.look.y = F.look.tx = F.look.ty = 0; F.free = false; }
  hintHidden = false;
  if (ui.hint) ui.hint.classList.remove("off");
  /* Подсказка про управление своё говорит один раз. Раньше она
     висела посреди окна, пока человек её не «отработает» - а если он
     просто смотрел в космос, надпись оставалась поперёк кадра всю
     дорогу и перекрывала планеты. Семи секунд хватает прочитать; тот,
     кто взялся за управление раньше, гасит её сам. */
  if (hintT) clearTimeout(hintT);
  hintT = setTimeout(function () { hintT = 0; hideHint(); }, 7000);

  root.classList.add("rc-flying");
  салонВПолёте(true);
  ui.wrap.classList.add("on");
  deckSkinSoon();
  /* Страница под полётом перестаёт существовать для клавиатуры и
     чтения с экрана: иначе Tab уводит из кабины в список городов */
  inertPage(true);
  size();

  /* Сцены сайта спят, музыка встаёт в полный рост */
  try { dispatchEvent(new CustomEvent("rc:flight", { detail: { on: true } })); } catch (e) {}
  if (g.RC_MUSIC && g.RC_MUSIC.boost) { try { g.RC_MUSIC.boost(true); } catch (e) {} }
  if (g.RC_SOUND && g.RC_SOUND.flight) { try { g.RC_SOUND.flight(true); } catch (e) {} }
  /* Записи рубки заказываем на входе: пока человек оглядывается, файлы
     успевают доехать до первого нажатия клавиши. */
  if (g.RC_SOUND && g.RC_SOUND.прогревРубки) { try { g.RC_SOUND.прогревРубки(); } catch (e) {} }
  if (g.RC_SOUND && g.RC_SOUND.ignite) { try { g.RC_SOUND.ignite(0.7); } catch (e) {} }
  stageLite(false);
  if (g.RC_track) g.RC_track("flight", "open");

  /* Из режима сцены цикл уже работает: второй rAF-контур давал
     двойной рендер каждого кадра - «всё лагает после старта» */
  if (!F.raf) F.raf = requestAnimationFrame(frame);
}

function close() {
  if (!F.open) return;
  F.open = false;
  F.stage = false;
  F.stageK = 0;
  if (F.raf) { cancelAnimationFrame(F.raf); F.raf = null; }
  /* Досье живёт собственным кадром, и глохнет он только по скрытому
     окну карточки. Пока его тут не закрывали, страница после выхода
     из игры продолжала чертить развёртку тела шестьдесят раз в
     секунду - у галактик это полтысячи звёзд на кадр. Телефон грелся
     на странице, где игры уже нет. */
  dosClose();
  салонВПолёте(false);
  root.classList.remove("rc-flying", "rc-stage");
  ui.wrap.classList.remove("on", "rcf-stage", "rcf-native-cab");
  /* Панели закрываем вместе с полётом. Раньше состояние оставалось:
     человек выходил с открытым КУРСом, а следующий заход начинался с
     меню во весь проём, под которым пряталась карточка «ГОТОВ К
     СТАРТУ» с обеими кнопками. Пока не догадаешься нажать клавишу,
     которую не нажимал, стартовать было нельзя. */
  сброситьПанели();
  cabinDrop();
  inertPage(false);
  модальность(false);
  /* Фокус обязан вернуться туда, откуда полёт открыли. Раньше после
     выхода он падал в body: человек с клавиатуры оказывался в начале
     страницы и заново шёл через всё меню. Кнопку помним сами -
     программное нажатие фокус на кнопку не ставит, а на телефоне и в
     части браузеров его не ставит и настоящее нажатие. */
  var назад = F.открыл;
  F.открыл = null;
  if (назад && назад.isConnected && назад.focus) {
    try { назад.focus({ preventScroll: true }); } catch (eФ) { try { назад.focus(); } catch (eФ2) {} }
    /* Вёрстка после выхода перестраивается ещё кадр: если фокус
       сбило, ставим ещё раз. */
    requestAnimationFrame(function () {
      if (doc.activeElement === doc.body && назад.isConnected) {
        try { назад.focus({ preventScroll: true }); } catch (eФ3) {}
      }
    });
  }
  try { dispatchEvent(new CustomEvent("rc:flight", { detail: { on: false } })); } catch (e) {}
  if (g.RC_MUSIC && g.RC_MUSIC.boost) { try { g.RC_MUSIC.boost(false); } catch (e) {} }
  if (g.RC_SOUND && g.RC_SOUND.flight) { try { g.RC_SOUND.flight(false); } catch (e) {} }
  if (g.RC_track) g.RC_track("flight", "close p=" + F.p.toFixed(2));
  /* Язык переключили в полёте - пересобираем кабину теперь */
  if (langDirty) setTimeout(relang, 420);
}

/* Сказать, почему полёта не будет. Всплывающая подсказка сайта, а
   если её нет - строка под кнопкой. */
function отказПолёта() {
  var текст = RU
    ? "Полёт на этом устройстве отключён: не хватает мощности видеокарты. Всё остальное на сайте работает."
    : "Flight is off on this device: not enough GPU power. Everything else on the site works.";
  try {
    if (g.RC_TOAST && g.RC_TOAST.say) { g.RC_TOAST.say(текст); return; }
  } catch (eТ) {}
  var было = doc.querySelector(".rcf-no-fly");
  if (было) { было.textContent = текст; return; }
  var где = doc.querySelector("#flight") || doc.querySelector("#epilogue") || doc.body;
  var э = doc.createElement("p");
  э.className = "rcf-no-fly";
  э.setAttribute("role", "status");
  э.textContent = текст;
  где.appendChild(э);
  setTimeout(function () { if (э.parentNode) э.parentNode.removeChild(э); }, 9000);
}

/* Приглашение в полёт после успешной заявки. Не окно и не
   перехват кадра: строка с кнопкой прямо под формой, там, где
   человек сейчас смотрит. Появляется один раз. */
function offerFlight() {
  var box = doc.querySelector("#contact .form-card");
  if (!box || doc.querySelector(".rcf-after")) return;
  var el = doc.createElement("div");
  el.className = "rcf-after";
  el.innerHTML =
    "<b>" + (RU ? "Заявка принята" : "Request received") + "</b>" +
    "<span>" + (RU
      ? "Инженер свяжется с вами в ближайшее время. А пока - можно облететь сеть."
      : "An engineer will contact you. Meanwhile, you can fly the network.") + "</span>" +
    '<button type="button" class="rcf-after-btn">' +
      (RU ? "Облететь сеть" : "Fly the network") + "</button>";
  box.appendChild(el);
  var b = el.querySelector(".rcf-after-btn");
  if (b) b.addEventListener("click", function () { open(); });
  requestAnimationFrame(function () { el.classList.add("on"); });
}

/* ── Кнопки запуска ──────────────────────────────────────────
   Плавающая кнопка появляется после первого экрана и живёт до
   конца страницы: клиент просил вход в полёт из любого места. */
function launchers() {
  var btns = [].slice.call(doc.querySelectorAll(".js-flight"));
  btns.forEach(function (b) { b.addEventListener("click", open); });

  var fab = doc.createElement("button");
  fab.type = "button";
  fab.className = "rcf-fab js-flight";
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>' +
    '<path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>' +
    '<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>' +
    '<span>' + (RU ? "Полёт" : "Flight") + '</span>';
  fab.addEventListener("click", open);
  doc.body.appendChild(fab);

  var seen = false;
  addEventListener("scroll", function () {
    var show = (g.scrollY || 0) > innerHeight * 0.6;
    if (show !== seen) { seen = show; fab.classList.toggle("on", show); }
  }, { passive: true });

  /* Заявка отправлена. Раньше отсюда через полторы секунды сам
     собой открывался полёт во весь экран - и человек, только что
     оставивший рабочую заявку в рабочее время, получал игру, которой
     не просил. Приёмка справедливо назвала это ошибкой: кульминация
     тратилась на развлечение вместо подтверждения.

     Теперь предлагаем, а не запускаем: на экране пульта появляется
     приглашение с кнопкой. Захочет - полетит. */
  var form = doc.querySelector("#contact form");
  if (form) form.addEventListener("submit", function () {
    var msg = form.querySelector(".form-msg");
    var tries = 0;
    var wait = setInterval(function () {
      if (++tries > 40) { clearInterval(wait); return; }
      if (msg && msg.className.indexOf("ok") >= 0) {
        clearInterval(wait);
        setTimeout(offerFlight, 1200);
      }
    }, 250);
  });
}

/* ── Цепочка заданий ─────────────────────────────────────────
   «Функционал после подлёта какой-то добавь, ну логика игры, зачем
   мы подлетаем, что делаем» - вопрос по существу. Раньше игра
   умела всё сразу и не просила ничего: лети куда хочешь,
   разворачивай что хочешь, конца нет.

   Теперь есть цепочка. Каждый шаг объясняет, зачем мы летим к
   очередному телу, и открывает следующий. Задания не выдуманы
   поверх игры - они собраны из того, что в ней и так происходит:
   осмотреть тело, развернуть узел, закрыть запрос трафика, уйти в
   другой рукав. Просто теперь это порядок, а не набор кнопок.

   Прогресс живёт вместе с остальным журналом исследователя: закрыл
   вкладку, вернулся - продолжаешь с того же места. */
function netCountAll() { return Object.keys(net).length; }

var MISSIONS = [
  {
    id: "look",
    t: RU ? "Осмотреться" : "Look around",
    h: RU ? "Наведитесь на любое тело и нажмите по нему - корабль снимет карту"
          : "Tap any body to scan it",
    done: function () { return Object.keys(explored).length >= 2; },
    now: function () { return Object.keys(explored).length; },
    goalN: 2
  },
  {
    id: "first",
    t: RU ? "Первый узел сети" : "First network node",
    h: RU ? "Выйдите на орбиту любого тела и разверните узел"
          : "Enter orbit and deploy a node",
    done: function () { return netCountAll() >= 1; },
    now: netCountAll, goalN: 1
  },
  {
    id: "three",
    t: RU ? "Опорная тройка" : "Three nodes",
    h: RU ? "Три узла держат сеть при отказе любого одного"
          : "Three nodes keep the network alive",
    done: function () { return netCountAll() >= 3; },
    now: netCountAll, goalN: 3
  },
  {
    id: "req",
    t: RU ? "Закрыть запрос трафика" : "Serve a traffic surge",
    h: RU ? "Когда придёт запрос, разверните узел на названном теле"
          : "Deploy a node where the surge asks",
    done: function () { return F.served >= 1; },
    now: function () { return F.served || 0; }, goalN: 1
  },
  {
    id: "system",
    t: RU ? "Своя система" : "Own the system",
    h: RU ? "Шесть узлов - и Солнечная система ваша целиком"
          : "Six nodes across the system",
    done: function () { return netCountAll() >= 6; },
    now: netCountAll, goalN: 6
  },
  {
    id: "jump",
    t: RU ? "Открыть экзопланетный сектор" : "Reach an exoplanet sector",
    h: RU ? "Гиперпрыжок через Млечный Путь: выберите сектор в меню «Курс»"
          : "Use Course to hyperjump through the Milky Way",
    done: function () { return uniIdx !== 0 || (F.jumps || 0) >= 1; },
    now: function () { return (F.jumps || 0); }, goalN: 1
  },
  {
    id: "all",
    t: RU ? "Сеть без границ" : "Network everywhere",
    h: RU ? "Развернуть узлы во всех открытых мирах" : "Deploy nodes everywhere",
    done: function () { return netCountAll() >= NET_TOTAL(); },
    now: netCountAll, goalN: 0
  }
];

function missionNow() {
  for (var i = 0; i < MISSIONS.length; i++) {
    if (!MISSIONS[i].done()) return MISSIONS[i];
  }
  return null;
}

var misT = 0, misId = "";
function missionFrame(ts) {
  if (!ui.mis || ts - misT < 500) return;
  misT = ts;
  var m = missionNow();
  if (!m) {
    if (misId !== "done") {
      misId = "done";
      ui.mis.innerHTML = '<b>' + (RU ? "СЕТЬ ЗАМКНУТА" : "NETWORK COMPLETE") + '</b>' +
        '<span>' + (RU ? "Все миры на связи. Дальше - свободный полёт." : "All worlds online.") + '</span>';
      ui.mis.classList.add("full");
    }
    return;
  }
  var need = m.goalN || NET_TOTAL();
  var have = Math.min(need, m.now());
  var key = m.id + ":" + have;
  if (key === misId) return;
  var first = misId === "";
  misId = key;
  ui.mis.classList.remove("full");
  /* Смена задания - тоже включение проекции: контент не подменяется
     тихо, изображение рвётся и собирается заново */
  заново(ui.mis, "rcf-flick");
  ui.mis.innerHTML =
    '<b>' + esc(m.t) + '</b>' +
    '<span>' + esc(m.h) + '</span>' +
    '<i><u style="width:' + Math.round(have / need * 100) + '%"></u></i>' +
    '<em>' + have + " / " + need + '</em>';
  if (!first && g.RC_SOUND && g.RC_SOUND.uiHover) { try { g.RC_SOUND.uiHover(); } catch (e) {} }
}

function esc(v) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ── Курсовая строка ─────────────────────────────────────────
   Куда идём, сколько осталось и в каком режиме. Расстояние честное:
   считается от камеры до цели и переводится в километры по тому же
   масштабу, в котором построен мир (Земля - шестьдесят единиц на
   двенадцать с половиной тысяч километров). */
var courseT = 0;
var KM_PER_UNIT = 12742 / 120;          /* диаметр Земли на её размер в мире */
function courseFrame(w3, ts) {
  if (!ui.cGoal || ts - courseT < 220) return;
  courseT = ts;
  var name = "—", dist = "—";
  var tgt = null;
  if (F.orbit && F.orbit.name) { name = F.orbit.name; tgt = F.orbit.c; }
  else if (F.goalId || F.goalName) {
    name = F.goalName || GOAL_NAMES[F.goalId] || F.goalId;
    var o = w3[F.goalId === "hole" ? "hole" : F.goalId];
    if (o) tgt = o.position;
  }
  if (tgt) {
    var d = w3.cam.position.distanceTo(tgt) * KM_PER_UNIT;
    dist = d > 1e6 ? (d / 1e6).toFixed(1) + (RU ? " млн км" : "M km")
         : d > 1e3 ? Math.round(d / 1e3) + (RU ? " тыс. км" : "k km")
         : Math.round(d) + (RU ? " км" : " km");
  }
  /* Пока курс не задан, в табло стояли два прочерка подряд: «КУРС — —
     РУЧНОЙ». На телефоне это читается как поломка, заказчик так и
     сказал - прочерк вместо значения. Теперь пустой курс говорит
     словами, а расстояние в этом случае не показывается вовсе:
     показывать нечего. */
  var пусто = name === "—";
  ui.cGoal.textContent = пусто ? (RU ? "не задан" : "none") : name;
  if (ui.cCell) ui.cCell.classList.toggle("is-empty", пусто);
  if (ui.navKeyTx) ui.navKeyTx.textContent = пусто ? (RU ? "не задан" : "none") : name;
  ui.cDist.textContent = dist;
  ui.cMode.textContent = F.auto ? (RU ? "АВТОПИЛОТ" : "AUTOPILOT")
                       : F.orbit ? (RU ? "ОРБИТА" : "ORBIT")
                       : (RU ? "РУЧНОЙ" : "MANUAL");
}

/* ── Карточка пилота ─────────────────────────────────────────
   Игра должна чем-то заканчиваться, иначе она не игра, а катание.
   Когда сеть замкнута, корабль выдаёт лист с итогом: сколько миров
   открыто, сколько узлов развёрнуто, сколько запросов закрыто и
   аварий отбито. Это и есть повод сохранить кадр и показать его
   кому-то - тот самый след, ради которого стоило летать.

   Лист собирается один раз и лежит, пока его не закроют: пересчёт
   на каждом кадре здесь не нужен, итог уже подведён. */
var pilotShown = false;

function pilotCard() {
  if (pilotShown || !ui.wrap) return;
  if (netCount() < NET_TOTAL()) return;
  pilotShown = true;
  /* Награда за всю игру не должна вылезать из-под открытой панели.
     Меню, справка и досье стоят слоем 30, карточка финала слоем 8: из
     под меню КУРС торчали две кнопки и обрывок слова. Закрываем всё
     открытое, слой карточки поднят в стилях. */
  сброситьПанели();

  var el = doc.createElement("div");
  el.className = "rcf-pilot";
  var rank = RU ? "КОМАНДИР СЕТИ" : "NETWORK COMMANDER";
  el.innerHTML =
    '<div class="rcf-pilot-in">' +
      '<i>' + (RU ? "ПОЛЁТ ЗАВЕРШЁН" : "MISSION COMPLETE") + '</i>' +
      '<b>' + rank + '</b>' +
      '<div class="rcf-pilot-g">' +
        '<span><u>' + netCount() + '</u>' + (RU ? "узлов сети" : "nodes") + '</span>' +
        '<span><u>' + Object.keys(explored).length + '</u>' + (RU ? "объектов открыто" : "explored") + '</span>' +
        '<span><u>' + (F.served || 0) + '</u>' + (RU ? "запросов закрыто" : "surges served") + '</span>' +
        '<span><u>' + (F.saved || 0) + '</u>' + (RU ? "аварий отбито" : "outages fixed") + '</span>' +
      '</div>' +
      '<p>' + (RU
        ? СЛ("замкнута") : СЛ("замкнута")) + '</p>' +
      '<div class="rcf-pilot-b">' +
        '<button type="button" data-act="shot">' + (RU ? "Сохранить кадр" : "Save frame") + '</button>' +
        '<button type="button" data-act="close">' + (RU ? "Продолжить полёт" : "Keep flying") + '</button>' +
      '</div>' +
    '</div>';
  ui.wrap.appendChild(el);
  el.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!b) return;
    if (b.getAttribute("data-act") === "shot") { shoot(); return; }
    el.classList.remove("on");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  });
  requestAnimationFrame(function () { el.classList.add("on"); });
  if (g.RC_SOUND && g.RC_SOUND.uiConfirm) { try { g.RC_SOUND.uiConfirm(); } catch (e) {} }
  if (g.RC_track) g.RC_track("flight", "complete " + netCount());
}

/* ── Консоль сети ────────────────────────────────────────────
   Счётчик «сеть 4/34» говорил, сколько узлов развёрнуто, но не
   говорил каких - а это и есть главный результат игры. Список на
   правой консоли показывает построенную сеть целиком: где узел
   стоит, где идёт авария, куда просят трафик.

   Список короткий и сам себя обновляет только при изменениях:
   каждый кадр перебирать разметку незачем. */
var netListKey = "";
function netList() {
  if (!ui.netList) return;
  var names = Object.keys(net);
  var key = names.join(",") + "|" + (fail ? fail.name : "") + "|" + (req ? req.name : "");
  if (key === netListKey) return;
  netListKey = key;
  if (!names.length) {
    ui.netList.innerHTML = '<i>' + (RU ? "СЕТЬ ПУСТА" : "NO NODES") + '</i>';
    return;
  }
  var h = '<i>' + (RU ? "УЗЛЫ СЕТИ" : "NODES") + '</i>';
  /* Больше шести строк на консоли не помещается, а сеть может
     вырасти до трёх десятков: показываем последние - те, что
     человек только что построил, и отдельной строкой остаток. */
  var show = names.slice(-6);
  for (var i = 0; i < show.length; i++) {
    var nm = show[i];
    var cls = fail && fail.name === nm ? "down" : (req && req.name === nm ? "want" : "ok");
    h += '<span class="' + cls + '">' + nm + '</span>';
  }
  if (names.length > show.length) {
    h += '<span class="more">+' + (names.length - show.length) + '</span>';
  }
  заново(ui.netList, "rcf-flick");
  ui.netList.innerHTML = h;
}

/* ── Восстановление сети после возвращения ───────────────────
   Журнал узлов живёт в браузере, а метки в сцене - нет: закрыл
   вкладку, вернулся, и счётчик показывал прежнюю сеть, а в кадре её
   не было. Развёрнутые узлы обязаны стоять там же, где их
   оставили, иначе прогресс существует только на бумаге.

   Ставим их сразу после сборки мира, по именам из журнала. */
function netRestore() {
  if (!W3 || !netNodes) return;
  if (netNodes.length) return;
  var map = {
    earth: W3.earth, moon: W3.moon, mars: W3.mars, saturn: W3.saturn,
    sun: W3.sun, mercury: W3.mercury, venus: W3.venus,
    jupiter: W3.jupiter, uranus: W3.uranus, neptune: W3.neptune,
    hole: W3.hole
  };
  var any = false;
  for (var key in map) {
    if (!map[key]) continue;
    var nm = GOAL_NAMES[key];
    if (!nm || !net[nm]) continue;
    netMark(map[key].position, nm);
    any = true;
  }
  if (any) trafBuild();
}

/* ── Трафик между узлами ─────────────────────────────────────
   Линии связи показывали, что узлы соединены, но сеть от этого не
   выглядела работающей: связь есть, а движения по ней нет. Между
   тем вся игра про доставку контента, и трафик - её главное
   содержание.

   Теперь по линиям идут пакеты: светящиеся точки бегут от узла к
   узлу и вспыхивают на прибытии. Дороже это не стоит почти ничего -
   одна точечная система на всю сеть, координаты которой
   пересчитываются раз в кадр из уже посчитанных отрезков.

   Чем больше узлов, тем плотнее движение: сеть, которую человек
   построил, видно по её нагрузке. */
var traf = null, trafN = 0, trafSeg = [];

function trafBuild() {
  var T = g.THREE;
  if (!W3) return;
  if (traf) { убрать(traf); traf = null; }
  trafSeg = [];
  for (var i = 0; i < netNodes.length; i++) {
    for (var j = i + 1; j < netNodes.length; j++) {
      if (netNodes[i].p.distanceTo(netNodes[j].p) > 1400) continue;
      trafSeg.push([netNodes[i].p, netNodes[j].p]);
    }
  }
  if (!trafSeg.length) return;
  /* По три пакета на связь: меньше не читается движением, больше
     превращается в сплошную нитку */
  trafN = Math.min(96, trafSeg.length * 3);
  var pos = new Float32Array(trafN * 3);
  var geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  traf = new T.Points(geo, new T.PointsMaterial({
    color: 0xbfe9ff, size: 7, sizeAttenuation: true,
    map: glowSprite(32, "rgba(220,245,255,1)", "rgba(120,200,240,0)"),
    transparent: true, opacity: 0.95, depthWrite: false,
    blending: T.AdditiveBlending
  }));
  traf.userData.t = new Float32Array(trafN);
  traf.userData.seg = new Uint16Array(trafN);
  for (var k = 0; k < trafN; k++) {
    traf.userData.seg[k] = k % trafSeg.length;
    traf.userData.t[k] = Math.random();
  }
  traf.frustumCulled = false;
  W3.scene.add(traf);
}

function trafFrame(dt) {
  if (!traf || !trafSeg.length) return;
  var pos = traf.geometry.attributes.position.array;
  var tt = traf.userData.t, sg = traf.userData.seg;
  for (var k = 0; k < trafN; k++) {
    tt[k] += dt * (0.14 + (k % 5) * 0.035);
    if (tt[k] > 1) {
      tt[k] -= 1;
      /* На прибытии пакет уходит на другую связь: движение по сети
         должно выглядеть маршрутизацией, а не каруселью */
      sg[k] = (sg[k] + 1 + (k % 3)) % trafSeg.length;
    }
    var a = trafSeg[sg[k]][0], b = trafSeg[sg[k]][1];
    var u = tt[k];
    pos[k * 3] = a.x + (b.x - a.x) * u;
    pos[k * 3 + 1] = a.y + (b.y - a.y) * u;
    pos[k * 3 + 2] = a.z + (b.z - a.z) * u;
  }
  traf.geometry.attributes.position.needsUpdate = true;
}

/* ── Происшествия в сети ─────────────────────────────────────
   Запросы трафика показывали, куда нужен узел, но ничем не грозили:
   не успел - и ладно. Напряжения в игре от этого не было совсем.

   Авария другое дело. Развёрнутый узел падает, сеть теряет
   участок, и до него надо долететь и поднять его заново - за
   отведённое время. Не успел - узел выбывает, счётчик сети падает,
   и его придётся разворачивать с нуля.

   Аварии начинаются, только когда в сети есть что ронять: на
   пустой сети это была бы не игра, а наказание за то, что ещё не
   успел начать. */
var fail = null, failNext = 0;

function failPick() {
  var keys = Object.keys(net);
  if (keys.length < 2) return null;
  return keys[Math.floor((performance.now() / 1301) % keys.length)];
}

function failTick(ts) {
  if (F.stage || F.brief) return;

  /* Идёт авария: следим за временем и за тем, дошли ли мы */
  if (fail) {
    if (F.orbit && F.orbit.name === fail.name) {
      /* Пришли вовремя - узел поднят, заряд не тратится: это
         восстановление, а не новое строительство */
      say((RU ? "УЗЕЛ ПОДНЯТ · " : "NODE RESTORED · ") + fail.name, 2600);
      if (g.RC_SOUND) { try { (g.RC_SOUND.node || g.RC_SOUND.uiConfirm).call(g.RC_SOUND); } catch (e) {} }
      F.saved = (F.saved || 0) + 1;
      fail = null;
      failNext = ts + 52000;
      netPaint();
      return;
    }
    if (ts > fail.until) {
      /* Не успели: узел выбывает из сети */
      delete net[fail.name];
      try { localStorage.setItem(NET_KEY, JSON.stringify(net)); } catch (e) {}
      /* Метка узла уходит из мира вместе с записью: раньше спрайт
         оставался висеть, и сеть на глаз не менялась */
      for (var fi = netNodes.length - 1; fi >= 0; fi--) {
        if (netNodes[fi].name === fail.name) {
          if (W3) убрать(netNodes[fi].s);
          netNodes.splice(fi, 1);
        }
      }
      trafBuild();
      say((RU ? "УЗЕЛ ПОТЕРЯН · " : "NODE LOST · ") + fail.name, 3200);
      if (g.RC_SOUND) { try { (g.RC_SOUND.alarm || g.RC_SOUND.blip).call(g.RC_SOUND, 140, 0.7, "sawtooth", 0.04); } catch (e) {} }
      fail = null;
      failNext = ts + 64000;
      netPaint();
      netButton();
      return;
    }
    /* Обратный отсчёт на табло аварии */
    if (ui.fail) {
      var left = Math.max(0, Math.round((fail.until - ts) / 1000));
      ui.fail.textContent = (RU ? "АВАРИЯ · " : "OUTAGE · ") + fail.name + " · " + left + (RU ? " с" : "s");
    }
    return;
  }

  if (ts < failNext) return;
  var pick = failPick();
  if (!pick) { failNext = ts + 30000; return; }
  fail = { name: pick, until: ts + 46000 };
  say((RU ? "АВАРИЯ НА УЗЛЕ · " : "NODE DOWN · ") + pick +
      (RU ? " · выйдите на его орбиту" : " · reach its orbit"), 4200);
  if (g.RC_SOUND) { try { (g.RC_SOUND.alarm || g.RC_SOUND.blip).call(g.RC_SOUND, 320, 0.5, "square", 0.03); } catch (e) {} }
}

function failPaint() {
  if (!ui.fail) return;
  var on = !!fail;
  if (on !== ui.fail.classList.contains("on")) ui.fail.classList.toggle("on", on);
  if (ui.wrap) ui.wrap.classList.toggle("rcf-outage", on);
}

/* ── Снимок из кабины ────────────────────────────────────────
   Кнопка на правой консоли: кадр из окна вместе с корпусом корабля
   и показателями, готовый к сохранению. Стоит она дёшево, а даёт
   человеку то, ради чего он и полетел - свою картинку из космоса.

   Кадр собираем заново, а не тянем из буфера: без сохранения буфера
   рисования браузер отдаёт пустой холст, а включать сохранение ради
   одной кнопки значит платить памятью в каждом кадре. Поэтому
   рисуем сцену тут же и сразу снимаем. */
function shoot() {
  if (!W3 || !F.open) return;
  var T = g.THREE;
  try {
    /* Снимок собираем тем же путём, что и кадр на экране: иначе
       человек сохранит картинку без плёнки и не узнает её. */
    if (W3.post) W3.post.render(W3.scene, W3.cam, performance.now());
    else W3.r.render(W3.scene, W3.cam);
    var src = W3.r.domElement;
    var W = src.width, H = src.height;
    var c = doc.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");
    x.drawImage(src, 0, 0);
    /* Корпус кабины поверх: снимок должен выглядеть так же, как
       кадр, который человек видел */
    /* Раму на снимок берём ту, что реально стоит в кадре. Узла
       .rcf-cab в разметке нет с тех пор, как кабина стала объёмной:
       обещание «снимок выглядит так же, как кадр, который человек
       видел» не выполнялось, сохранялся голый космос без рамы.
       Плоская рама живёт в ui.cabFrame. */
    var рама = (ui.cabFrame && ui.cabFrame.complete && ui.cabFrame.naturalWidth) ? ui.cabFrame : null;
    if (рама) {
      var iw = рама.naturalWidth, ih = рама.naturalHeight;
      var sc = Math.max(W / iw, H / ih);
      x.drawImage(рама, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc);
    }
    /* Подпись: где сняли и сколько узлов в сети на тот момент */
    var pad = Math.round(W * 0.03);
    x.font = "700 " + Math.round(W * 0.017) + "px 'Golos Text', system-ui, sans-serif";
    x.fillStyle = "rgba(226,238,252,.95)";
    x.textBaseline = "bottom";
    /* Пустой курс табло пишет словами «не задан», а не прочерком:
       сравнение с прочерком не срабатывало никогда, и на сохранённом
       кадре внизу стояло «ROCKET CDN · не задан · УЗЛОВ 0/45», да ещё
       и в имени файла. Смотрим на тот же признак, что ставит табло. */
    var курс = ui.cGoal ? ui.cGoal.textContent : "";
    var безЦели = !курс || курс === "—" ||
                  (ui.cCell && ui.cCell.classList.contains("is-empty"));
    var where = безЦели ? (RU ? "ОТКРЫТЫЙ КОСМОС" : "DEEP SPACE") : курс;
    x.fillText(СЛ("марка") + " · " + where + " · " +
      (RU ? "УЗЛОВ " : "NODES ") + netCount() + "/" + NET_TOTAL(), pad, H - pad);

    var url = c.toDataURL("image/png");
    var a = doc.createElement("a");
    a.href = url;
    a.download = "rocketcdn-" + where.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-") + ".png";
    doc.body.appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 400);
    say(RU ? "СНИМОК СОХРАНЁН" : "SNAPSHOT SAVED", 1800);
    /* Затвор, а не общее «готово»: снимок обязан звучать снимком */
    if (g.RC_SOUND) { try { (g.RC_SOUND.shutter || g.RC_SOUND.uiConfirm).call(g.RC_SOUND); } catch (e) {} }
    if (g.RC_track) g.RC_track("flight", "shot");
  } catch (e) {
    say(RU ? "СНИМОК НЕ УДАЛСЯ" : "SNAPSHOT FAILED", 1800);
  }
}

/* ── Проекция цели над пультом ───────────────────────────────
   Маленький шар текущей цели крутится над приборной нишей, в двух
   обручах, как в рубке из кино. Это не украшение: пока цель далеко,
   она в кадре точкой, и понять, куда идёшь, нельзя. Проекция
   показывает её крупно и всё время.

   Собрана из самого мира: берём карту того же тела, к которому идём,
   поэтому проекция не может показать не то. Висит она на камере,
   значит держится в кадре при любом манёвре - как настоящий прибор,
   а не как объект, мимо которого пролетают. */
var proj = null, projFor = "";

function projBuild(w3) {
  if (proj || !w3) return;
  var T = g.THREE;
  proj = new T.Group();
  var ball = new T.Mesh(
    new T.SphereGeometry(0.055, 22, 16),
    new T.MeshBasicMaterial({ color: 0x8fd8f2, transparent: true, opacity: 0.9 })
  );
  proj.add(ball);
  proj.userData.ball = ball;
  /* Два обруча под углом: по ним читается объём и вращение */
  var ringMat = new T.MeshBasicMaterial({
    color: 0x5fc8ef, transparent: true, opacity: 0.5,
    blending: T.AdditiveBlending, depthWrite: false
  });
  var r1 = new T.Mesh(new T.TorusGeometry(0.082, 0.0022, 4, 44), ringMat);
  r1.rotation.x = Math.PI / 2.2;
  proj.add(r1);
  var r2 = new T.Mesh(new T.TorusGeometry(0.098, 0.0018, 4, 44), ringMat);
  r2.rotation.x = Math.PI / 2.6;
  r2.rotation.z = 0.6;
  proj.add(r2);
  proj.userData.rings = [r1, r2];
  /* Конус проектора снизу: проекция стоит над панелью, а не висит
     в воздухе сама по себе */
  var cone = new T.Mesh(
    new T.ConeGeometry(0.075, 0.16, 18, 1, true),
    new T.MeshBasicMaterial({
      color: 0x5fc8ef, transparent: true, opacity: 0.13,
      side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false
    })
  );
  cone.position.y = -0.115;
  cone.rotation.x = Math.PI;
  proj.add(cone);
  /* Ниже и мельче: проекция стоит над плитой приборов, а не висит
     посреди остекления поверх настоящей цели */
  proj.position.set(0, -0.34, -0.86);
  proj.scale.setScalar(0.72);
  proj.renderOrder = 20;
  w3.cam.add(proj);
  if (!w3.cam.parent) w3.scene.add(w3.cam);
}

function projFrame(w3, dt) {
  if (F.stage) { if (proj) proj.visible = false; return; }
  projBuild(w3);
  if (!proj) return;
  /* Цель: та, к которой идём, или та, вокруг которой кружим */
  var id = F.goalId || (F.orbit && F.orbit.name ? "orbit" : "");
  var body = null;
  if (F.orbit && F.orbit.name) {
    for (var k in GOAL_NAMES) {
      if (GOAL_NAMES[k] === F.orbit.name) { id = k; break; }
    }
  }
  if (id && id !== "galaxy" && id !== "home") body = w3[id === "hole" ? "hole" : id];
  proj.visible = !!body;
  if (!body) { projFor = ""; return; }

  if (projFor !== id) {
    projFor = id;
    /* Карту берём у самого тела: если у него сложная группа, ищем
       первый меш с картой - так проекция всегда показывает то же,
       что видно за стеклом */
    var src = body.material && body.material.map ? body.material.map : null;
    if (!src && body.children) {
      for (var c = 0; c < body.children.length; c++) {
        if (body.children[c].material && body.children[c].material.map) {
          src = body.children[c].material.map; break;
        }
      }
    }
    var bm = proj.userData.ball.material;
    bm.map = src || null;
    bm.color.set(src ? 0xffffff : 0x8fd8f2);
    bm.opacity = src ? 0.92 : 0.85;
    bm.needsUpdate = true;
  }
  proj.userData.ball.rotation.y += dt * 0.55;
  proj.userData.rings[0].rotation.z += dt * 0.4;
  proj.userData.rings[1].rotation.z -= dt * 0.28;
}

/* ── Бортовые системы: расход и восполнение ──────────────────
   Энергия копится от светил: чем ближе звезда, тем быстрее заряд.
   Это не условность, а понятная логика - панели корабля работают
   от света. У чёрной дыры наоборот: корпус нагружается приливом, и
   целостность падает. Оба процесса медленные, чтобы решение
   «подойти ближе» имело цену, но не убивало за секунду.

   Числа держим в узде: заряд не уходит в минус и не переливается
   через край, целостность не опускается ниже четверти - игра не
   должна заканчиваться тупиком, из которого нет выхода. */
function powerFrame(w3, dt) {
  if (F.stage) return;
  var cam = w3.cam.position;
  var gain = 0.55;                       /* фон: реактор корабля */

  /* Свет звезды. Солнце стоит далеко и ярко, у чужих систем свои
     светила - берём ближайшее из тех, что в кадре мира. */
  var srcPos = w3.sunPos;
  if (uniIdx !== 0) {
    /* В чужом рукаве панели заряжает его звезда: берём ближайшую
       систему текущей вселенной */
    var pk2 = built[uniIdx];
    if (pk2 && pk2.root && pk2.root.children.length) {
      var bd2 = 1e9, bo2 = null;
      for (var ps = 0; ps < pk2.root.children.length; ps++) {
        var dd2 = cam.distanceTo(pk2.root.children[ps].position);
        if (dd2 < bd2) { bd2 = dd2; bo2 = pk2.root.children[ps]; }
      }
      if (bo2) srcPos = bo2.position;
    }
  }
  if (srcPos) {
    var d = cam.distanceTo(srcPos);
    if (d < 2600) gain += (1 - d / 2600) * 3.4;
  }
  /* Дыра: приливная нагрузка на корпус */
  var risk = 0;
  if (w3.hole) {
    var dh = cam.distanceTo(w3.hole.position);
    if (dh < 420) {
      risk = 1 - dh / 420;
      F.hull = Math.max(25, F.hull - risk * risk * 9 * dt);
      gain -= risk * 2.2;
    }
  }
  F.warn = risk;
  F.en = Math.max(0, Math.min(F.enMax, F.en + gain * dt));
  /* Целостность восстанавливается сама, но втрое медленнее, чем
     теряется: ремонт всегда дороже поломки */
  if (risk < 0.02 && F.hull < 100) F.hull = Math.min(100, F.hull + 1.1 * dt);
}

/* Списать заряд. Возвращает false, если не хватило - тогда
   действие не выполняется, а на табло идёт короткое сообщение.
   Молчаливого отказа быть не должно: человек обязан понимать,
   почему кнопка не сработала. */
function spend(cost, what) {
  if (F.en >= cost) { F.en -= cost; return true; }
  say((RU ? "НЕ ХВАТАЕТ ЗАРЯДА · " : "NOT ENOUGH POWER · ") +
      Math.round(F.en) + "/" + cost + (what ? " · " + what : ""), 2200);
  if (g.RC_SOUND) { try { (g.RC_SOUND.deny || g.RC_SOUND.blip).call(g.RC_SOUND, 180, 0.35, "sawtooth", 0.02); } catch (e) {} }
  return false;
}

/* Отрисовка бортовых стоек. Столбики стоят на скошенных боковинах
   корпуса - там, где на рисунке кабины и нарисованы приборы. */
var barsT = 0;
function barsFrame(ts) {
  if (!ui.bars || ts - barsT < 160) return;
  barsT = ts;
  var en = F.en / F.enMax, hu = F.hull / 100;
  ui.bars.style.setProperty("--en", (en * 100).toFixed(1) + "%");
  ui.bars.style.setProperty("--hull", (hu * 100).toFixed(1) + "%");
  ui.bars.classList.toggle("low", en < 0.22);
  ui.bars.classList.toggle("hurt", hu < 0.6);
  if (ui.enTx) ui.enTx.textContent = Math.round(F.en);
  if (ui.huTx) ui.huTx.textContent = Math.round(F.hull);
  /* Сигнальная лампа сближения: горит, когда корпус под нагрузкой */
  if (ui.wrap) ui.wrap.classList.toggle("rcf-alarm", F.warn > 0.25);
}

/* ── Скин панели: железо рисуется одним холстом ──────────────
   Требование владельца буквально: «кнопки должны быть не наклейкой,
   а частью панели управления». Значит корпуса клавиш, паз тяги,
   обод радара и стекло табло обязаны быть нарисованы В САМОЙ
   панели - одной текстурой, с общим металлом, общими бликами и
   общей фаской.

   Как это устроено. DOM-кнопки остаются прозрачными зонами нажатия
   (плюс чёткие SVG-иконки), а их «железо» рисует этот холст: он
   спрашивает у каждой кнопки её фактическое место и рисует корпус
   ровно там. Рисунок и зона нажатия не могут разъехаться - у них
   один источник координат. Пересборка только на resize, в кадре
   этот код не живёт. */
function deckSkin() {
  var deck = ui.wrap && ui.wrap.querySelector(".rcf-deck");
  var face = deck && deck.querySelector(".rcf-d-face");
  if (!face) return;
  /* Пульт стал трёхмерным (блок P6I в rc-flight.css): железо гнёзд,
     клавиши и обод радара рисует RC_CABIN, а здешнюю подложку CSS
     гасит правилом background-image: none !important. Холст всё
     равно собирался и гнал toDataURL - двенадцать-четырнадцать тысяч
     символов PNG в инлайновый стиль при каждом входе в полёт и
     каждом повороте экрана, и всё это в никуда. Рисунок ниже
     оставлен как справка по геометрии гнёзд; работать он перестал.
     Вернётся плоский пульт - убрать этот выход и правило в CSS. */
  if (face.style.backgroundImage) {
    face.style.backgroundImage = "";
    face.style.backgroundSize = "";
  }
  return;
  /* Меряем в СОБСТВЕННЫХ координатах плоскости, а не экранных:
     панель наклонена перспективой, и getBoundingClientRect вернул бы
     уже спроецированный прямоугольник - рисунок железа разъехался бы
     с зонами нажатия. offsetLeft/offsetTop дают геометрию до
     трансформации, поэтому текстура ложится точно под клавиши. */
  var w = face.offsetWidth, h = face.offsetHeight;
  if (w < 20 || h < 20) return;
  var dpr = Math.min(2, g.devicePixelRatio || 1);
  var c = doc.createElement("canvas");
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  var x = c.getContext("2d");
  x.scale(dpr, dpr);

  function ownX(el) {
    var v = 0;
    while (el && el !== face) { v += el.offsetLeft; el = el.offsetParent; }
    return v;
  }
  function ownY(el) {
    var v = 0;
    while (el && el !== face) { v += el.offsetTop; el = el.offsetParent; }
    return v;
  }
  function rr(px, py, pw, ph, r) {
    r = Math.min(r, pw / 2, ph / 2);
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + pw, py, px + pw, py + ph, r);
    x.arcTo(px + pw, py + ph, px, py + ph, r);
    x.arcTo(px, py + ph, px, py, r);
    x.arcTo(px, py, px + pw, py, r);
    x.closePath();
  }

  /* ── Корпус консоли ─────────────────────────────────────
     Металл темнеет к дальнему краю: плоскость уходит от зрителя,
     и верх обязан быть в тени, иначе панель читается плоской
     наклейкой, а не физической поверхностью. */
  /* Корпус целиком НЕ заливаем: панель встраивается в уже
     нарисованную консоль кабины, и сплошная плита закрыла бы её
     экраны. Железо рисуем только там, где стоят приборы. */
  var i;
  /* Ниши отсеков и их обвязка */
  var bays = face.querySelectorAll(".rcf-d-bay");
  for (i = 0; i < bays.length; i++) {
    var bx = ownX(bays[i]), bw = bays[i].offsetWidth;
    var by = ownY(bays[i]), bh = bays[i].offsetHeight;
    /* Отсек - металлическая вставка в консоль: плита с фаской,
       шлифовкой и тенью под ней. Именно она делает клавиши частью
       корабля, а не наклейкой поверх картинки. */
    var pad = 11;
    var pg2 = x.createLinearGradient(0, by - pad, 0, by + bh + pad);
    pg2.addColorStop(0, "rgba(28,48,68,.97)");
    pg2.addColorStop(0.42, "rgba(19,35,52,.97)");
    pg2.addColorStop(1, "rgba(9,19,32,.97)");
    rr(bx - pad, by - pad, bw + pad * 2, bh + pad * 2, 13);
    x.fillStyle = pg2;
    x.fill();
    x.strokeStyle = "rgba(4,10,18,.95)";
    x.lineWidth = 1.4;
    x.stroke();
    /* Шлифовка внутри вставки */
    x.save();
    rr(bx - pad, by - pad, bw + pad * 2, bh + pad * 2, 13);
    x.clip();
    for (var li = by - pad; li < by + bh + pad; li += 2) {
      x.fillStyle = "rgba(255,255,255," + (0.005 + 0.013 * Math.abs(Math.sin(li * 1.7))).toFixed(3) + ")";
      x.fillRect(bx - pad, li, bw + pad * 2, 1);
    }
    x.restore();
    /* Верхняя фаска и нижнее ребро */
    x.fillStyle = "rgba(200,228,248,.20)";
    x.fillRect(bx - pad + 4, by - pad + 1, bw + pad * 2 - 8, 1);
    x.fillStyle = "rgba(190,220,245,.10)";
    x.fillRect(bx - pad + 4, by + bh + pad - 2, bw + pad * 2 - 8, 1);
    /* Винты по углам отсека */
    var sc2 = [[bx - pad + 5, by - pad + 5], [bx + bw + pad - 5, by - pad + 5],
               [bx - pad + 5, by + bh + pad - 5], [bx + bw + pad - 5, by + bh + pad - 5]];
    for (var si = 0; si < sc2.length; si++) {
      x.fillStyle = "rgba(6,13,22,.95)";
      x.beginPath(); x.arc(sc2[si][0], sc2[si][1], 2.1, 0, 6.283); x.fill();
      x.fillStyle = "rgba(180,210,235,.18)";
      x.beginPath(); x.arc(sc2[si][0] - 0.6, sc2[si][1] - 0.7, 0.9, 0, 6.283); x.fill();
    }
  }

  /* ── Стекло табло ──────────────────────────────────────── */
  var top = face.querySelector(".rcf-d-top");
  if (top) {
    var ty = ownY(top), th = top.offsetHeight;
    var mg = x.createLinearGradient(0, ty, 0, ty + th);
    mg.addColorStop(0, "rgba(2,7,14,.9)");
    mg.addColorStop(1, "rgba(6,16,28,.78)");
    x.fillStyle = mg;
    rr(10, ty, w - 20, th, 7);
    x.fill();
    x.strokeStyle = "rgba(66,178,220,.24)";
    x.lineWidth = 1;
    x.stroke();
    x.fillStyle = "rgba(200,230,250,.06)";
    x.fillRect(12, ty + 1, w - 24, 2);
  }

  /* ── Гнёзда клавиш ─────────────────────────────────────── */
  function keyCap(px, py, pw, ph, on, warm) {
    /* Гнездо: тёмный паз под кэпом */
    rr(px - 2.5, py - 2.5, pw + 5, ph + 5, 11);
    x.fillStyle = "rgba(3,9,16,.9)";
    x.fill();
    /* Кэп: металл, верх ярче, низ в тени - клавиша выступает */
    var kg = x.createLinearGradient(0, py, 0, py + ph);
    if (on) {
      kg.addColorStop(0, warm ? "#4a3524" : "#27506c");
      kg.addColorStop(0.52, warm ? "#33241a" : "#173b57");
      kg.addColorStop(1, warm ? "#1d140e" : "#0d2438");
    } else {
      kg.addColorStop(0, "#26405a");
      kg.addColorStop(0.52, "#182d44");
      kg.addColorStop(1, "#0e1e30");
    }
    rr(px, py, pw, ph, 9);
    x.fillStyle = kg;
    x.fill();
    x.strokeStyle = on
      ? "rgba(" + (warm ? "255,170,110" : "120,210,245") + ",.85)"
      : "rgba(5,11,19,.95)";
    x.lineWidth = on ? 1.3 : 1;
    x.stroke();
    /* Блик по верхней фаске и тень у основания */
    x.fillStyle = "rgba(207,233,245,.22)";
    x.fillRect(px + 3, py + 1, pw - 6, 1);
    x.fillStyle = "rgba(0,0,0,.45)";
    x.fillRect(px + 3, py + ph - 2, pw - 6, 2);
    if (on) {
      /* Подсвеченная клавиша светит в паз вокруг себя */
      x.save();
      x.shadowColor = warm ? "rgba(255,170,110,.9)" : "rgba(66,178,220,.9)";
      x.shadowBlur = 14;
      rr(px, py, pw, ph, 9);
      x.strokeStyle = "rgba(0,0,0,0)";
      x.stroke();
      x.restore();
    }
  }

  var keys = face.querySelectorAll(".rcf-key");
  for (i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (!k.offsetWidth) continue;
    keyCap(ownX(k), ownY(k), k.offsetWidth, k.offsetHeight,
      k.classList.contains("cur") ||
      k.getAttribute("aria-pressed") === "true" ||
      k.getAttribute("aria-expanded") === "true",
      k.classList.contains("rcf-fire-key"));
  }

  /* ── Паз рычага тяги ───────────────────────────────────── */
  var thr = face.querySelector(".rcf-thr");
  if (thr && thr.offsetWidth) {
    var tx = ownX(thr), ty2 = ownY(thr), tw = thr.offsetWidth, th2 = thr.offsetHeight;
    rr(tx - 2.5, ty2 - 2.5, tw + 5, th2 + 5, 11);
    x.fillStyle = "rgba(3,9,16,.9)";
    x.fill();
    rr(tx, ty2, tw, th2, 9);
    x.fillStyle = "#060f1b";
    x.fill();
    x.strokeStyle = "rgba(5,11,19,.95)";
    x.lineWidth = 1;
    x.stroke();
    /* Насечки хода по верхней кромке паза */
    for (i = 1; i < 8; i++) {
      x.fillStyle = "rgba(130,175,205,.26)";
      x.fillRect(tx + tw * i / 8, ty2 + 3, 1, 4);
    }
    x.fillStyle = "rgba(0,0,0,.5)";
    x.fillRect(tx + 3, ty2 + 1, tw - 6, 2);
  }

  /* ── Обод радара ───────────────────────────────────────── */
  var rad = face.querySelector(".rcf-radar");
  if (rad && rad.offsetWidth) {
    var cx = ownX(rad) + rad.offsetWidth / 2;
    var cy = ownY(rad) + rad.offsetHeight / 2;
    var rr2 = rad.offsetWidth / 2;
    x.fillStyle = "rgba(3,9,16,.92)";
    x.beginPath(); x.arc(cx, cy, rr2 + 7, 0, 6.283); x.fill();
    var ring = x.createLinearGradient(0, cy - rr2, 0, cy + rr2);
    ring.addColorStop(0, "#33526f");
    ring.addColorStop(0.5, "#1c3247");
    ring.addColorStop(1, "#0a1725");
    x.strokeStyle = ring;
    x.lineWidth = 5.5;
    x.beginPath(); x.arc(cx, cy, rr2 + 4, 0, 6.283); x.stroke();
    x.strokeStyle = "rgba(66,178,220,.45)";
    x.lineWidth = 1;
    x.beginPath(); x.arc(cx, cy, rr2 + 1.4, 0, 6.283); x.stroke();
    /* Насечки по ободу - как на настоящем компасе */
    for (i = 0; i < 12; i++) {
      var a2 = i * Math.PI / 6;
      x.strokeStyle = "rgba(160,200,225,.3)";
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(cx + Math.cos(a2) * (rr2 + 2), cy + Math.sin(a2) * (rr2 + 2));
      x.lineTo(cx + Math.cos(a2) * (rr2 + 6), cy + Math.sin(a2) * (rr2 + 6));
      x.stroke();
    }
  }

  face.style.backgroundImage = "url(" + c.toDataURL("image/png") + ")";
  face.style.backgroundSize = "100% 100%";
}
var skinT = 0;
function deckSkinSoon() {
  clearTimeout(skinT);
  skinT = setTimeout(deckSkin, 120);
}

/* ── Рычаг тяги ──────────────────────────────────────────────
   Настоящая ручка, а не кнопка. Тянут её пальцем или мышью, и
   корабль набирает ход ровно настолько, насколько её сдвинули.
   Разница с колесом принципиальная: колесо это интерфейс, ручка -
   орган управления. Человек за ней чувствует машину.

   Ручка не пружинит обратно: отпустил на половине - идём на
   половине. Ноль внизу, полный ход вверху; можно уйти и в минус,
   это торможение. */
function bindThrottle() {
  var el = ui.thr;
  if (!el) return;
  /* Своё имя, чтобы не затенять модульное состояние обзора мышью */
  var тянут = false;

  function setFromY(clientX) {
    /* Рычаг лежит горизонтально: в плите высотой в десятую долю
       кадра вертикальному ходу просто нет места, а горизонтальный
       читается как ползунок тяги на настоящих пультах */
    var r = el.getBoundingClientRect();
    var t = (clientX - r.left) / Math.max(1, r.width);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    F.thr = t;
    /* Ход корабля берём не линейно: у самой ручки должен быть
       чувствительный участок на малых значениях, иначе первый же
       сантиметр отправляет корабль в разгон */
    F.v = t * t * 0.26;
    manual();
    paintThrottle();
  }
  function paintThrottle() {
    var t = F.thr || 0;
    if (ui.thrFill) ui.thrFill.style.width = (t * 100).toFixed(1) + "%";
    el.setAttribute("aria-valuenow", Math.round(t * 100));
    el.classList.toggle("live", t > 0.02);
  }
  F.paintThrottle = paintThrottle;

  el.addEventListener("pointerdown", function (e) {
    тянут = true;
    try { el.setPointerCapture(e.pointerId); } catch (er) {}
    setFromY(e.clientX);
    e.preventDefault();
  });
  el.addEventListener("pointermove", function (e) { if (тянут) setFromY(e.clientX); });
  el.addEventListener("pointerup", function () { тянут = false; });
  el.addEventListener("pointercancel", function () { тянут = false; });
  el.addEventListener("keydown", function (e) {
    var d = 0;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") d = 0.08;
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") d = -0.08;
    else return;
    e.preventDefault();
    F.thr = Math.max(0, Math.min(1, (F.thr || 0) + d));
    F.v = F.thr * F.thr * 0.26;
    manual();
    paintThrottle();
  });
}

/* ── Радар системы ───────────────────────────────────────────
   Обзор сверху: корабль в середине, тела на своих орбитах, цель
   подсвечена. Считаем от настоящих позиций мира, поэтому радар не
   может соврать. Рисуем восемь раз в секунду - чаще незачем, а
   каждый кадр это лишний проход по холсту. */
var radarT = 0;
function radarFrame(w3, ts) {
  var cv = ui.radar;
  if (!cv || ts - radarT < 120) return;
  radarT = ts;
  var x = cv.getContext("2d");
  var W = cv.width, H = cv.height, R = W / 2 - 6;
  var cx = W / 2, cy = H / 2, i;
  x.clearRect(0, 0, W, H);

  /* Сетка: концентрические круги и перекрестье */
  x.strokeStyle = "rgba(95,200,239,.22)"; x.lineWidth = 1;
  for (i = 1; i <= 3; i++) {
    x.beginPath(); x.arc(cx, cy, R * i / 3, 0, Math.PI * 2); x.stroke();
  }
  x.beginPath();
  x.moveTo(cx - R, cy); x.lineTo(cx + R, cy);
  x.moveTo(cx, cy - R); x.lineTo(cx, cy + R);
  x.stroke();

  /* Развёртка: луч обегает круг */
  var a = (ts * 0.0009) % (Math.PI * 2);
  var sg = x.createConicGradient ? null : null;
  x.save();
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.clip();
  x.strokeStyle = "rgba(120,225,255,.55)"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(cx, cy);
  x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  x.stroke();
  x.restore();

  /* Тела системы. Масштаб логарифмический: иначе Земля и дыра не
     помещаются на один экран - между ними тысячи единиц. */
  var bodies;
  if (uniIdx === 0) {
    bodies = [
      { o: w3.sun, c: "#ffd166", n: "С" },
      { o: w3.earth, c: "#5fd0ef", n: "З" },
      { o: w3.moon, c: "#c8d8e6", n: "Л" },
      { o: w3.mars, c: "#e08a5a", n: "М" },
      { o: w3.jupiter, c: "#e0b98a", n: "Ю" },
      { o: w3.saturn, c: "#e6c98a", n: "Ст" },
      { o: w3.hole, c: "#a974f5", n: "Д" }
    ];
  } else {
    /* В чужом рукаве радар показывает ЕГО системы, а не родную:
       прежний список рисовал Землю, которой в кадре нет */
    bodies = [];
    var pk = built[uniIdx];
    if (pk && pk.root) {
      for (var bs = 0; bs < pk.root.children.length && bodies.length < 7; bs++) {
        bodies.push({ o: pk.root.children[bs], c: "#9fd8ef", n: String(bs + 1) });
      }
    }
  }
  var cam = w3.cam.position;
  for (i = 0; i < bodies.length; i++) {
    var b = bodies[i];
    if (!b.o) continue;
    var dx = b.o.position.x - cam.x, dz = b.o.position.z - cam.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.001) continue;
    var rr = Math.log10(1 + d) / Math.log10(1 + 4200) * R;
    if (rr > R) rr = R;
    var ang = Math.atan2(dx, -dz);
    var px = cx + Math.sin(ang) * rr, py = cy - Math.cos(ang) * rr;
    x.fillStyle = b.c;
    x.beginPath(); x.arc(px, py, 4.2, 0, Math.PI * 2); x.fill();
    x.fillStyle = "rgba(226,238,252,.75)";
    x.font = "600 10px 'Golos Text', system-ui, sans-serif";
    x.fillText(b.n, px + 6, py + 3.5);
  }

  /* Корабль в середине, нос по курсу */
  var dir = w3.tmpB.set(0, 0, -1).applyQuaternion(w3.cam.quaternion);
  var ha = Math.atan2(dir.x, -dir.z);
  x.save();
  x.translate(cx, cy);
  x.rotate(ha);
  x.fillStyle = "#eaf6ff";
  x.beginPath();
  x.moveTo(0, -8); x.lineTo(5, 6); x.lineTo(0, 3); x.lineTo(-5, 6);
  x.closePath(); x.fill();
  x.restore();
}

/* ── Салон корабля внутри мира игры ──────────────────────────
   Строится один раз и стоит вокруг точки, с которой начинается
   полёт. Собственной сцены у салона нет и быть не может: именно
   две сцены и порождали подмену, которую владелец назвал сменой
   «нарисованного на такое».

   Место салона выведено из финала, а не подобрано: в конце
   подъезда камера обязана оказаться ровно в точке старта полёта,
   на расстоянии CAM_WIN от остекления. Отсюда центр помещения
   лежит позади этой точки на (радиус минус CAM_WIN), а его ноль
   азимута смотрит туда же, куда камера в первом кадре полёта.
   Тогда последний кадр салона и первый кадр игры - один и тот же
   кадр, и склеивать нечего. */
var cabin = null;
/* От глаз до остекления в финале. Было 1.42, и на телефоне с
   вертикальным полем зрения под сто градусов нижняя кромка проёма
   уходила ниже настила - окно физически не могло закрыть кадр, и
   рама пульта не сходилась по низу. С 0.86 проём закрывает кадр на
   любом устройстве. Значение общее с rc-console: оба модуля строят
   геометрию от одной точки проектирования. */
var CAM_WIN = (g.RC_PANEL && g.RC_PANEL.CAM_WIN) || 0.86;

function cabinBuild() {
  if (cabin || !W3 || !g.RC_CABIN) return cabin;
  var T = g.THREE;
  /* RC_CABIN is the shell. There is deliberately no portrait/wide
     image option anymore; camera aspect changes projection only, not
     the physical ship around it. */
  /* Отмечаем, был ли готов модуль пульта в момент сборки: без пульта
     салон собирается пустым, и понять это потом можно только так */
  cabinBuild.былПульт = !!g.RC_PANEL;
  cabinBuild.когда = (g.performance && g.performance.now) ? Math.round(g.performance.now()) : 0;
  cabin = g.RC_CABIN.build(T, {
    tiny: innerWidth < 760,
    aspect: innerWidth / Math.max(1, innerHeight),
    /* Раму пульта строит проекция, поэтому ей нужно то же самое
       поле зрения, с которым потом будет рендериться кадр. Иначе
       рама встанет по чужим долям и её кромка уедет с экрана. */
    fov: W3.fov0,
    /* Дистанция панели: по ней же режется проём, иначе окно и
       панель разойдутся и сквозь стекло покажется обшивка */
    dПан: панельD(innerWidth, innerHeight, W3.fov0 || 72),
    /* Плотность, с которой кадр реально рисуется. Лицо секции - это
       пульт, и печь его мельче кадра значит мылить панель до всякой
       растеризации. Число берём тем же выражением, что и потолок
       плотности в stageLite: там оно решает, сколько точек будет у
       кадра, здесь - сколько их будет у текстуры. */
    "плотность": Math.min(g.devicePixelRatio || 1, tiny ? 1.0 : 2.0),
    /* Размеры кадра нужны передней секции: она кладёт снимок той же
       cover-раскладкой, что и игра */
    width: innerWidth,
    height: innerHeight,
    /* Наклон взгляда в кресле. Маршрут в первой точке идёт с
       подъёмом, и камера смотрит выше горизонта - а секция считала
       проекцию по горизонтали. Замер: верх кадра уезжал на 53 точки
       вверх, низ на 49. Без этого числа стык с игрой не сходится. */
    pitch: (function () {
      var т0 = W3.path.getPointAt(0);
      var цель = (W3.looks && W3.looks[0] && W3.looks[0].at)
        ? W3.looks[0].at : new T.Vector3(0, 0, 0);
      var д = new T.Vector3().subVectors(цель, т0);
      var дл = Math.max(1e-6, д.length());
      return Math.asin(Math.max(-1, Math.min(1, д.y / дл)));
    })()
  });

  /* Куда смотрит камера в первом кадре полёта */
  var p0 = W3.path.getPointAt(0);
  var look0 = (W3.looks && W3.looks[0] && W3.looks[0].at) ? W3.looks[0].at : new T.Vector3(0, 0, 0);
  var dir = new T.Vector3().subVectors(look0, p0);
  var yaw0 = Math.atan2(dir.x, -dir.z);        /* азимут этого направления */
  var flat = new T.Vector3(dir.x, 0, dir.z).normalize();

  cabin.group.rotation.y = yaw0;
  /* ── Кресло пилота отодвинуто от стекла ───────────────────
     Панель обязана лежать В ПЛОСКОСТИ СТЕНЫ: только тогда она
     затыкает вырез обшивки ровно и по краям не выглядывает космос.
     Раньше её растили, отодвигая от стены наружу, - и вырез,
     оказавшись между зрителем и панелью, стал виден шире неё.
     Звёзды по краям панели брались отсюда.

     Растим иначе: панель остаётся на стене, а КРЕСЛО отодвигаем
     вглубь рубки. Тогда до стены от пилота дальше, панель на стене
     крупнее, и она по-прежнему заполняет кадр целиком в конце
     подъезда - размер кадра на этой дистанции и есть её размер. */
  var back = Math.max(0.35, cabin.R - панельD(innerWidth, innerHeight, W3.fov0 || 72));
  cabin.center = new T.Vector3(
    p0.x - flat.x * back,
    p0.y - cabin.eye,                          /* пол под глазами */
    p0.z - flat.z * back
  );
  cabin.group.position.copy(cabin.center);
  cabin.yaw0 = yaw0;
  cabin.p0 = p0.clone();
  /* Ориентация камеры в финале - та же, что в первом кадре полёта */
  /* Наклон взгляда в финале. Помещение стоит ровно по азимуту, но
     маршрут в первой точке идёт с подъёмом, и камера смотрит выше
     горизонта. Рама пульта собирается по долям кадра от оси
     взгляда, поэтому этот наклон обязан дойти до неё: без него
     верхняя балка уходила из кадра, а нижняя подтягивалась. */
  var pitch0 = Math.asin(Math.max(-1, Math.min(1, dir.y / Math.max(1e-6, dir.length()))));
  if (cabin.console3 && cabin.console3.setPitch) cabin.console3.setPitch(pitch0);
  cabin.pitch0 = pitch0;
  var m = new T.Matrix4().lookAt(p0, look0, new T.Vector3(0, 1, 0));
  cabin.q1 = new T.Quaternion().setFromRotationMatrix(m);
  cabin.qTmp = new T.Quaternion();
  cabin.eTmp = new T.Euler(0, 0, 0, "YXZ");
  cabin.vTmp = new T.Vector3();
  W3.scene.add(cabin.group);
  /* Салон собирается ПОЗЖЕ входа в полёт: замер показал, что на
     момент open() узла ещё нет, и погасить в нём нечего. Поэтому
     решение о том, что видно, принимается и здесь тоже - сразу
     после сборки, если полёт уже идёт. */
  if (root.classList.contains("rc-flying")) салонВПолёте(true);
  return cabin;
}

/* ── Плоская рама рубки в полёте ─────────────────────────────
   Кадр рубки показывается обычной картинкой поверх холста, а не
   натягивается на объёмную сетку.

   Так было 17-19 августа, и заказчику с его клиентом это нравилось.
   Потом раму перевели в объём, и она потеряла резкость: сетка
   пересэмплирует снимок дважды, кромка окна режется по клеткам, а
   материал кладёт свой свет поверх запечённого. Здесь браузер
   масштабирует кадр один раз своим фильтром - он остаётся ровно
   таким, каким снят.

   Геометрию окна (куда класть всплывающие окна, чем отсекать
   голограммы) по-прежнему считает rc-panel: источник обязан быть
   один, иначе окно у разметки и окно на картинке разъезжаются. */
/* ── Приборы пульта ──────────────────────────────────────────
   Плита приходит с пустыми нишами, и слой светится в них: навигатор,
   обзор, состояние, подсветка клавиш. Свет складывается с металлом
   (режим screen), поэтому приборы выходят частью панели.

   Смысл и касание остаются за разметкой: настоящие кнопки .rcf-*
   встают невидимыми поверх нарисованных мест теми же числами, что
   считает слой. Так у клавиши есть имя для чтения с экрана и палец
   попадает туда, куда смотрит глаз, а второго ряда кнопок поверх
   пульта не появляется. */
var deck = null;
var deckSize = { w: 0, h: 0, d: 0, вид: "" };

function deckLayer() {
  if (!ui || !ui.wrap || !g.RC_DECK || !g.RC_CAB_FLAT || !g.RC_CAB_DECK) return null;
  var вид = g.RC_DECK["какой"](innerWidth, innerHeight);
  var meta = g.RC_CAB_FLAT[вид] || g.RC_CAB_FLAT["широкая"];
  var план = g.RC_CAB_DECK[вид] || g.RC_CAB_DECK["широкая"];
  if (!meta || !план) return null;
  if (!deck) {
    deck = g.RC_DECK.создать();
    /* Сначала тела клавиш, потом свет: колпачок заслоняет дно ниши,
       свет ложится на его лицо. */
    if (deck["тело"]) ui.wrap.appendChild(deck["тело"]);
    ui.wrap.appendChild(deck.canvas);
  }
  /* Плотность режем двумя с половиной: холст размером с экран и так
     не дешёвый, а разницы между двумя и тремя точками на глаз нет. */
  var dpr = Math.min(2.5, g.devicePixelRatio || 1);
  if (deckSize.вид !== вид) {
    deck.вид(meta, план, doc.documentElement.lang !== "en");
    deckSize.вид = вид;
  }
  if (deckSize.w !== innerWidth || deckSize.h !== innerHeight || deckSize.d !== dpr) {
    deck.размер(innerWidth, innerHeight, dpr);
    deckSize.w = innerWidth; deckSize.h = innerHeight; deckSize.d = dpr;
    /* Привязку кадра пересчитываем вместе с размером: она зависит от
       того, насколько экран шире снимка, и при повороте телефона
       меняется. */
    if (ui.cabFrame) {
      var пк = g.RC_DECK["покрытие"](meta, innerWidth, innerHeight);
      ui.cabFrame.style.objectPosition = "50% " + (пк["доля"] * 100).toFixed(2) + "%";
    }
  }
  return deck;
}

function deckFrame(ts, dt) {
  var d = deckLayer();
  if (!d) return;
  var мест = d.мест();
  var nodes = physicalControlsFrame.nodes;
  if (!nodes && ui.wrap) {
    physicalControlsFrame.nodes = nodes = [
      /* Порядок = очерёдность на пульт. Первые занимают ниши, лишние
         остаются без места. Приближение и отдаление стоят последними
         намеренно: колесо мыши и щипок делают то же самое, и если
         паре не хватит ниши, человек ничего не теряет. Раньше
         последними были кадр и справка, и на плите с десятью нишами
         они висели над пультом двумя одинокими наклейками - заказчик
         это и назвал «кнопки криво, не единым целым». */
      /* Порядок обязан совпадать с KEYS в rc-keys.js: подпись на
         плите берётся оттуда по номеру ниши. Разошлись они молча -
         на плите писалось «БЛИЖЕ», а нажатие сохраняло снимок.
         Заказчик так и сказал: «для чего какая кнопка вообще не
         понятно».

         Справка стоит четвёртой, среди тех, что попадают на плиту
         телефона: «нету типо настроек инструкций каких-то» - значит
         инструкция обязана быть под рукой, а не в конце очереди.
         Прежний ЗАЛП оттуда ушёл: он делал ровно то же, что КАДР,
         то есть сохранял снимок, и был вторым таким же. */
      ui.wrap.querySelector(".rcf-navkey"), ui.wrap.querySelector(".rcf-scan-key"),
      ui.wrap.querySelector(".rcf-deploy"), ui.wrap.querySelector(".rcf-help-key"),
      ui.wrap.querySelector(".rcf-auto-key"), ui.wrap.querySelector(".rcf-stop-key"),
      ui.wrap.querySelector(".rcf-thr"), ui.wrap.querySelector(".rcf-map-key"),
      ui.wrap.querySelector(".rcf-shot"),
      ui.wrap.querySelector(".rcf-zoom-in"), ui.wrap.querySelector(".rcf-zoom-out")
    ];
  }

  /* Живые числа. Прибор, показывающий выдумку, хуже отсутствующего:
     заказчик такое замечает сразу. Берём то, чем управляет полёт. */
  var кам = W3 && W3.cam;
  var курс = 0, тангаж = 0, крен = 0;
  if (кам) {
    курс = ((-кам.rotation.y * 180 / Math.PI) % 360 + 360) % 360;
    тангаж = Math.max(-1, Math.min(1, кам.rotation.x * 1.6));
    крен = Math.max(-0.5, Math.min(0.5, кам.rotation.z));
  }
  /* ── Радару нужны цели ───────────────────────────────────────
     Радар крутил развёртку и рисовал кольца, но отметок в нём не было
     НИ РАЗУ: поле `метки` заводилось пустым один раз и больше не
     писалось ниоткуда. Прибор выглядел живым и не показывал ничего -
     заказчик назвал приборы детскими, и по этому он прав.

     Берём то, что и так посчитано для меток на стекле: тела, которые
     сейчас в мире. Для каждого считаем направление относительно носа
     корабля и удалённость в долях дальности обзора. Восьми отметок
     достаточно: радар размером с ноготь, больше на нём не разобрать. */
  var метки = [];
  if (кам && W3 && holoIds) {
    if (!deckFrame.вп) deckFrame.вп = new g.THREE.Vector3();
    var вп = deckFrame.вп;
    var носК = -кам.rotation.y;
    /* Дальность обзора считаем от того, что вокруг, а не жёстким
       числом. С постоянными девятьюстами единицами радар пустовал
       почти весь маршрут: между планетами расстояния в тысячи, всё
       уходило за круг и прибор показывал одну развёртку без единой
       отметки. Берём восемь ближайших тел и растягиваем круг по
       самому дальнему из них - тогда на радаре всегда есть картина,
       а взаимное расположение читается верно. */
    var рядом = [];
    for (var хи in holoIds) {
      if (!holoIds.hasOwnProperty(хи)) continue;
      var зп = holoIds[хи];
      if (!зп || !зп.o) continue;
      try { зп.o.getWorldPosition(вп); } catch (eР) { continue; }
      вп.sub(кам.position);
      var дист = вп.length();
      if (!isFinite(дист) || дист < 0.5) continue;
      /* Ноль на радаре смотрит вверх, поэтому угол отсчитываем от
         направления взгляда и поворачиваем на четверть круга. */
      рядом.push({ a: Math.atan2(вп.x, -вп.z) - носК - Math.PI / 2, д: дист });
    }
    рядом.sort(function (a, b) { return a.д - b.д; });
    if (рядом.length > 8) рядом.length = 8;
    var круг = 300;
    for (var ри = 0; ри < рядом.length; ри++) if (рядом[ри].д > круг) круг = рядом[ри].д;
    for (var ри2 = 0; ри2 < рядом.length; ри2++) {
      метки.push({ a: рядом[ри2].a, r: Math.max(0.08, Math.min(0.96, рядом[ри2].д / круг)) });
    }
  }

  d["данные"]({
    метки: метки,
    курс: курс, тангаж: тангаж, крен: крен,
    скорость: Math.max(0, Math.min(1, (F.v || 0) / 0.30)),
    высота: Math.max(0, Math.min(1, F.p || 0)),
    тяга: Math.max(0, Math.min(1, F.thr || 0)),
    щит: F.enMax ? Math.max(0, Math.min(1, F.en / F.enMax)) : 1,
    корпус: Math.max(0, Math.min(1, (F.hull == null ? 100 : F.hull) / 100))
  });

  /* ── Насколько зону нажатия можно раздувать ──────────────────
     Зона всегда была не меньше сорока точек. На мониторе это почти
     совпадало с нишей, а на телефоне ниши всего 17-21 точки высотой,
     и зоны соседних рядов НАЛЕЗАЛИ друг на друга: замер дал от 2,5
     точек на телефоне до 10,9 на узком экране, а в положении лёжа
     перекрывались вообще все соседи по горизонтали. Палец попадает в
     одну клавишу, срабатывает другая - и это ровно та жалоба, что
     кнопки нажимаются не те.

     Считаем шаг сетки: наименьшее расстояние между центрами соседних
     ниш по каждой оси. Зона не имеет права быть шире этого шага, тогда
     пересечься ей не с чем. Внутри этого потолка по-прежнему тянемся к
     сорока точкам - палец меньше сорока не бывает, но и чужую клавишу
     он теперь не достанет. */
  var плт = deckSize.d || 1;
  var шагX = Infinity, шагY = Infinity;
  var центры = [];
  for (var ци = 0; ци < мест; ци++) {
    var цq = d["место"](ци);
    if (!цq) { центры.push(null); continue; }
    центры.push({ x: (цq[0].x + цq[1].x + цq[2].x + цq[3].x) / 4 / плт,
                  y: (цq[0].y + цq[1].y + цq[2].y + цq[3].y) / 4 / плт });
  }
  /* Потолок считаем КАЖДОЙ клавише по её собственным соседям, а не
     одним числом на всю плиту. Общий минимум был слишком строг: две
     тесно стоящие клавиши в одном углу опускали потолок всем
     остальным, и на узком экране зона выходила в двадцать восемь
     точек даже там, где места хватало на сорок. Пересечься клавиша
     по-прежнему ни с кем не может: её потолок - расстояние до
     ближайшего соседа по той же оси. */
  var своиX = [], своиY = [];
  for (var а = 0; а < центры.length; а++) {
    своиX.push(Infinity); своиY.push(Infinity);
  }
  for (а = 0; а < центры.length; а++) {
    if (!центры[а]) continue;
    for (var б = а + 1; б < центры.length; б++) {
      if (!центры[б]) continue;
      var дх = Math.abs(центры[а].x - центры[б].x);
      var ду = Math.abs(центры[а].y - центры[б].y);
      /* Соседом по оси считаем того, кто на другой оси примерно рядом:
         иначе шаг посчитается по диагонали и потолок выйдет ложным. */
      if (дх > 1 && ду < дх) {
        шагX = Math.min(шагX, дх);
        своиX[а] = Math.min(своиX[а], дх); своиX[б] = Math.min(своиX[б], дх);
      }
      if (ду > 1 && дх < ду) {
        шагY = Math.min(шагY, ду);
        своиY[а] = Math.min(своиY[а], ду); своиY[б] = Math.min(своиY[б], ду);
      }
    }
  }
  if (!isFinite(шагX)) шагX = 999;
  if (!isFinite(шагY)) шагY = 999;

  for (var i = 0; i < мест; i++) {
    var el = nodes && nodes[i];
    if (!el) continue;
    /* Ниша появилась после смены размера окна - возвращаем кнопку */
    if (el.style.display === "none") el.style.removeProperty("display");
    var жив = el.matches(":active") || el.classList.contains("cur") ||
              el.classList.contains("live") ||
              el.getAttribute("aria-pressed") === "true" ||
              el.getAttribute("aria-expanded") === "true";
    if (жив) d["нажать"](i);
    var q = d["место"](i);
    if (!q) continue;
    /* Слой считает места в точках УСТРОЙСТВА: холст живёт в них, иначе
       на телефоне выйдет мыло. Разметка же меряет в точках CSS. Без
       деления на плотность области нажатия уезжали в два с половиной
       раза дальше нужного, то есть за экран: на телефоне пульт было
       видно, а нажать нельзя. Приёмка это и показала - восемь клавиш
       из восьми за кадром. */
    var пл = deckSize.d || 1;
    var cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4 / пл;
    var cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4 / пл;
    var шир = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y) / пл;
    var выс = Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y) / пл;
    /* Пишем только изменившееся: см. пояснение у второго такого места
       в physicalControlsFrame. На плоской плите места клавиш стоят и
       вовсе неподвижно, поэтому после первого кадра отсюда не уходит
       ни одной записи в стиль. */
    var пам2 = el._physPrev || (el._physPrev = {});
    var px2 = cx.toFixed(2) + "px", py2 = cy.toFixed(2) + "px";
    /* Зазор в точку между соседями: касание по самой кромке не должно
       засчитываться сразу двум клавишам. */
    var мойX = isFinite(своиX[i]) ? своиX[i] : шагX;
    var мойY = isFinite(своиY[i]) ? своиY[i] : шагY;
    var потолX = Math.max(шир, мойX - 1);
    var потолY = Math.max(выс, мойY - 1);
    var pw2 = Math.min(Math.max(40, шир), потолX).toFixed(2) + "px";
    var ph2 = Math.min(Math.max(40, выс), потолY).toFixed(2) + "px";
    if (пам2.x !== px2) { el.style.setProperty("--rcf-phys-x", px2); пам2.x = px2; }
    if (пам2.y !== py2) { el.style.setProperty("--rcf-phys-y", py2); пам2.y = py2; }
    if (пам2.w !== pw2) { el.style.setProperty("--rcf-phys-w", pw2); пам2.w = pw2; }
    if (пам2.h !== ph2) { el.style.setProperty("--rcf-phys-h", ph2); пам2.h = ph2; }
    /* Признак и три неподвижных свойства ставим один раз - но ТОЛЬКО
       пока они на месте. Ниже по ходу есть цикл, который снимает их с
       клавиш, которым не хватило ниши.

       Честно: проверка поворотом экрана (`tools/checks/клавиши.mjs`,
       узкий → широкий → узкий → широкий) показала, что клавиша
       возвращается на плиту и без этой оговорки - её держат правила
       самой плиты. Это страховка, а не починка: сравнение с классом
       стоит доли микросекунды, а цена ошибки здесь - пульт без
       рабочих клавиш, за который заказчик ругал уже дважды. */
    if (!пам2.готово || !el.classList.contains("rcf-phys-hit")) {
      el.classList.add("rcf-phys-hit");
      el.style.setProperty("display", "block", "important");
      el.style.setProperty("position", "fixed", "important");
      el.style.setProperty("transform", "translate(-50%, -50%)", "important");
      el.style.setProperty("--rcf-phys-x", px2);
      el.style.setProperty("--rcf-phys-y", py2);
      el.style.setProperty("--rcf-phys-w", pw2);
      el.style.setProperty("--rcf-phys-h", ph2);
      пам2.x = px2; пам2.y = py2; пам2.w = pw2; пам2.h = ph2;
      пам2.готово = 1;
    }
  }
  /* Команды, которым на этой плите места не хватило, остаются в меню
     полёта: втискивать двенадцать клавиш в две ниши телефона значит
     вернуть ту самую мелкую кашу, за которую пульт уже ругали.

     Пока мест НОЛЬ, не трогаем ничего. Ноль здесь значит не «мест не
     нашлось», а «слой ещё не рисовал кадр»: места считаются в самом
     рисовании, ниже по ходу. Без этой проверки первый же заход снимал
     все двенадцать кнопок разом, и если следующего кадра не
     случалось, пульт оставался без единой рабочей клавиши. Приёмка
     поймала это на 1920: рама есть, холст есть, клавиш ноль. */
  /* Команде не хватило ниши - её кнопка не висит над пультом
     наклейкой, а уходит совсем. Пульт либо целое, либо ничто:
     две одиноких плитки на раме ломают всю картину.

     Пары уходят ВМЕСТЕ. Приближение и отдаление - одна пара, и на
     плите с десятью нишами отдаление не помещалось, а приближение
     оставалось: на пульте висело «БЛИЖЕ» без «ДАЛЬШЕ». Половина пары
     хуже, чем её отсутствие: человек видит одну кнопку и ищет вторую.
     Поэтому если хоть один из пары не поместился, снимаем обоих. */
  var порог = мест;
  if (мест && nodes) {
    var ПАРЫ = [["rcf-zoom-in", "rcf-zoom-out"]];
    for (var пи = 0; пи < ПАРЫ.length; пи++) {
      var а = -1, б = -1;
      for (var ни = 0; ни < nodes.length; ни++) {
        if (!nodes[ни]) continue;
        if (nodes[ни].classList.contains(ПАРЫ[пи][0])) а = ни;
        if (nodes[ни].classList.contains(ПАРЫ[пи][1])) б = ни;
      }
      if (а >= 0 && б >= 0 && (а < порог) !== (б < порог)) {
        порог = Math.min(порог, Math.min(а, б));
      }
    }
  }
  for (var j = порог; мест && nodes && j < nodes.length; j++) {
    var e2 = nodes[j];
    if (!e2) continue;
    if (e2.classList.contains("rcf-phys-hit")) {
      e2.classList.remove("rcf-phys-hit");
      e2.style.removeProperty("position");
      e2.style.removeProperty("transform");
      /* Память о прошлом кадре больше не описывает клавишу: она снята
         с плиты. Чистим, чтобы при возвращении всё поставилось заново
         от нуля, а не «как было». */
      e2._physPrev = null;
    }
    e2.style.display = "none";
  }
  d["кадр"](Math.min(0.05, dt || 0.016));
}

/* ── Панель, вшитая в стену салона ───────────────────────────
   Требование владельца дословно: «панель должна быть частью
   корабля, вшитая в свой угол, я захожу и вижу её сразу, поворачиваюсь
   на 360 - она остаётся где была, приближаюсь - она не меняется,
   она физически не должна быть другой или ездить по экрану».

   Прежняя сборка была прибита к КАДРУ: картинка кабины, свет
   приборов и тела клавиш ехали с камерой и проявлялись к подъезду -
   владелец видел прозрачную панель поверх любой карточки. Теперь
   панель запекается в ОДНУ текстуру (картинка кабины + ниши, тела и
   свет клавиш - тем же кодом, что рисует их в игре) и натягивается
   на плоскость, стоящую В МИРЕ салона у стены сектора остекления.

   Геометрия стыка: плоскость стоит на луче взгляда финальной точки
   p0 на расстоянии CAM_WIN и по размеру ровно заполняет фрустум из
   p0. Значит в конце подъезда (камера в p0, взгляд по q1) панель
   занимает кадр один в один - и первый кадр игры показывает ту же
   картину тем же снимком. Подмены нет по построению. */
/* ── Насколько панель велика ─────────────────────────────────
   Доля кадра, которую занимает панель при обороте, равна отношению
   её дистанции D к расстоянию до зрителя. Пока D равнялась отходу
   камеры от остекления (0.86 м), панель давала треть кадра, и
   владелец сказал: «всё равно мелкая, как будто картина на стене
   висит; панель должна быть вместо стены, на полную плоскость».

   Значит D надо растить. Ограничителей ровно два, оба физические.

   Первый - проём. Панель показывает мир через своё окно, и это окно
   обязано попасть в вырез обшивки, иначе сквозь стекло будет видна
   стена. Вырез не может быть шире сорока градусов в каждую сторону:
   дальше начинаются секторы с настенными экранами.

   Второй - высота. Панель выше помещения перекрыла бы и потолок, и
   настил, и вместо рубки остался бы один снимок во весь кадр.

   Берём наименьшее из двух - панель выходит настолько большой,
   насколько позволяет сама рубка. */
function панельD(W, H, fovDeg) {
  var fovV = fovDeg * Math.PI / 180;
  var тан = Math.tan(fovV / 2);
  var Hк = 2 * 0.86 * тан;                 /* запасной прежний размер */
  try {
    var вид = g.RC_DECK["какой"](W, H);
    var meta = g.RC_CAB_FLAT[вид] || g.RC_CAB_FLAT["широкая"];
    var пк = g.RC_DECK["покрытие"](meta, W, H);
    var кб = meta["коробка"];
    var Rст = (g.RC_PANEL && g.RC_PANEL.R_WALL) || 3.05;
    var Hкомн = 4.2;
    /* Предел по дуге: ширина окна снимка на радиусе обшивки */
    var хорда = 2 * Rст * Math.sin(0.70);          /* сорок градусов */
    var долW = Math.max(0.05, (кб.r - кб.l)) * (пк.dw / H);
    var поДуге = хорда / долW;
    /* Предел по высоте помещения: сам снимок не выше рубки */
    var поВысоте = Hкомн * 1.02 / (пк.dh / H);
    Hк = Math.max(2 * 0.86 * тан, Math.min(поДуге, поВысоте));
    /* ── Кадр обязан помещаться между настилом и потолком ──────
       Замер на телефоне: поле зрения там сто градусов, и при
       дистанции полтора метра нижняя кромка кадра приходится на
       минус двадцать сантиметров - НИЖЕ ПОЛА рубки. Стена туда не
       достаёт, настил перекрывает луч, и в нижней полосе кадра
       вместо консоли виден пол: именно поэтому второй ряд клавиш
       пропадал, а стык с игрой расходился на шестьдесят единиц из
       двухсот пятидесяти пяти.

       Дистанцию ограничивает сама рубка: от кромки кадра до настила
       и до потолка нужен запас. Тогда всё, что ниже кадра, просто за
       его кромкой - и пола в кадре нет вовсе. */
    var Eгл = (g.RC_PANEL && g.RC_PANEL.EYE) || 1.62;
    var Hкомн2 = 4.2, зазор = 0.06;
    var поНизу = (Eгл - зазор) / тан;
    var поВерху = (Hкомн2 - Eгл - зазор) / тан;
    var Dмакс = Math.min(1.55, поНизу, поВерху);
    if ((Hк / 2) / тан > Dмакс) Hк = 2 * Dмакс * тан;
  } catch (eП) {}
  return (Hк / 2) / тан;
}

/* ── Панель салона: DOM, приколоченный к МИРУ ────────────────
   Панель обязана быть двумя вещами сразу, и это противоречие решается
   здесь.

   Первое: она часть корабля. Стоит в своём углу у остекления, при
   обороте на 360 остаётся на месте, при подъезде приближается. Значит
   её место задаёт мир, а не экран.

   Второе: она обязана быть РЕЗКОЙ. Замер показал, почему в салоне она
   мылилась: весь трёхмерный кадр рисуется через WebGL с плотностью
   1.15-1.35, а телефон отдаёт 3. Кадр 556 точек в ширину растягивался
   на 1236 настоящих - размазывало всё, включая любую сколь угодно
   резкую текстуру на плоскости. В игре та же панель резкая ровно
   потому, что она НЕ в WebGL: это обычная картинка в DOM, и браузер
   рисует её в полное разрешение экрана.

   Поэтому панель остаётся картинкой в DOM (резкость игры), но её
   положение считает камера сцены. Берём прямоугольник кадра игры в
   мировых координатах - он висит на луче взгляда из точки пилота на
   дистанции остекления, - проецируем его четыре угла текущей камерой
   и накладываем на элемент проективное преобразование matrix3d по
   этим углам. Получается ровно то, что просил владелец: предмет,
   стоящий в корабле, а не наклейка, едущая с глазами.

   Бесшовность выходит сама: в конце подъезда камера приходит в точку
   пилота, углы прямоугольника ложатся на углы кадра, матрица
   становится единичной - и последний кадр салона совпадает с первым
   кадром игры пиксель в пиксель. */
/* ── Панель салона одним запечённым слоем ────────────────────
   Панель собиралась из трёх слоёв разметки: снимок кабины, холст
   приборов и холст тел клавиш. Два из них полноэкранные, у одного
   режим наложения screen, и все три каждый кадр получали новую
   проективную матрицу. Браузер на это отвечает пересчётом стиля и
   композитингом трёх полноэкранных слоёв с наложением - на каждый
   кадр оборота. Отсюда и рывки, на которые владелец показал первым
   пунктом: «очень сильно лагает последняя сцена».

   В салоне ничего из этих трёх слоёв не двигается друг относительно
   друга: приборы стоят, клавиши не нажимаются, снимок один. Значит
   их можно свести в ОДИН холст один раз - и возить по кадру только
   его. Кадр становится втрое дешевле, а резкость остаётся: холст
   печётся в разрешении исходного снимка, а не кадра.

   Печём кроп ровно по cover-раскладке: элемент по-прежнему равен
   кадру, и матрица для него считается та же, что раньше. */
var bakeEl = null, bakeKey = "";
function stageBake() {
  if (!ui || !ui.wrap || !g.RC_DECK || !g.RC_CAB_FLAT || !g.RC_CAB_DECK) return;
  var W = innerWidth, H = innerHeight;
  var вид = g.RC_DECK["какой"](W, H);
  var meta = g.RC_CAB_FLAT[вид] || g.RC_CAB_FLAT["широкая"];
  var план = g.RC_CAB_DECK[вид] || g.RC_CAB_DECK["широкая"];
  if (!meta || !план) return;
  var ru = doc.documentElement.lang !== "en";
  var ключ = вид + "|" + W + "x" + H + "|" + (ru ? "ru" : "en");
  if (bakeKey === ключ && bakeEl) return;

  if (!bakeEl) {
    bakeEl = doc.createElement("canvas");
    bakeEl.className = "rcf-cabbake";
    bakeEl.setAttribute("aria-hidden", "true");
    ui.wrap.appendChild(bakeEl);
  }
  var пк = g.RC_DECK["покрытие"](meta, W, H);
  var k = пк.k || 1;
  /* Внутреннее разрешение холста - разрешение снимка, а не кадра:
     иначе панель мылится ровно так же, как мылил её WebGL */
  var cw = Math.max(2, Math.round(W / k));
  var ch = Math.max(2, Math.round(H / k));
  bakeEl.width = cw; bakeEl.height = ch;
  var x = bakeEl.getContext("2d");
  var im = new Image();
  im.decoding = "async";
  im.onload = function () {
    x.clearRect(0, 0, cw, ch);
    x.save();
    x.scale(1 / k, 1 / k);
    x.drawImage(im, пк.ox, пк.oy, пк.dw, пк.dh);
    x.restore();
    try {
      var d2 = g.RC_DECK.создать();
      d2.вид(meta, план, ru);
      d2.размер(W, H, 1 / k);
      d2.кадр(0.016);
      if (d2["тело"]) x.drawImage(d2["тело"], 0, 0, cw, ch);
      x.globalCompositeOperation = "screen";
      x.drawImage(d2.canvas, 0, 0, cw, ch);
      x.globalCompositeOperation = "source-over";
    } catch (eB) {}

    /* ── Срезаем чужую рубку ──────────────────────────────
       На снимке кокпита есть СВОИ пол, потолок и боковины. В кадре
       они ложатся поверх пола, потолка и стен настоящей комнаты - и
       панель читается криво вклеенным скриншотом. Владелец сказал
       это дословно: «залазит кусок на пол, кусок на стену, кусок на
       потолок; как будто школьник скриншот сделал и вклеил криво».

       Оставляем от снимка ровно то, чего в комнате нет: проём с
       рамой и приборную консоль под ним. Всё остальное - лишнее
       повторение помещения, и оно уходит. Края растворяем, чтобы не
       осталось прямой линии реза: у настоящей консоли нет кромки,
       она уходит в полумрак рубки. */
    try {
      var кб = meta["коробка"];
      var сдX = пк.ox / k, шп = meta.w, вп = meta.h;
      var л = сдX + (кб.l - 0.055) * шп;
      var п = сдX + (кб.r + 0.055) * шп;
      var сдY = пк.oy / k;
      var в = сдY + (кб.t - 0.045) * вп;
      var н = сдY + вп;                    /* до низа снимка: там консоль */
      var мк = doc.createElement("canvas");
      мк.width = cw; мк.height = ch;
      var мx = мк.getContext("2d");
      мx.fillStyle = "#fff";
      мx.fillRect(л, в, п - л, н - в);
      мx.globalCompositeOperation = "destination-out";
      var пер = Math.round(шп * 0.045);
      function растворить(gx0, gy0, gx1, gy1, rx, ry, rw, rh) {
        var г = мx.createLinearGradient(gx0, gy0, gx1, gy1);
        г.addColorStop(0, "rgba(0,0,0,1)");
        г.addColorStop(1, "rgba(0,0,0,0)");
        мx.fillStyle = г;
        мx.fillRect(rx, ry, rw, rh);
      }
      растворить(л, 0, л + пер, 0, л, в, пер, н - в);
      растворить(п, 0, п - пер, 0, п - пер, в, пер, н - в);
      растворить(0, в, 0, в + пер, л, в, п - л, пер);
      /* Низ консоли тоже без прямого реза: у настоящего пульта нет
         кромки поперёк настила, он уходит в полумрак под собой */
      var перН = Math.round(вп * 0.10);
      растворить(0, н, 0, н - перН, л, н - перН, п - л, перН);
      мx.globalCompositeOperation = "source-over";
      x.globalCompositeOperation = "destination-in";
      x.drawImage(мк, 0, 0);
      x.globalCompositeOperation = "source-over";
    } catch (eМ) {}
    bakeKey = ключ;
  };
  im.src = meta["файл"];
}

function stagePanel() {
  if (!cabin || !W3 || !ui || !ui.wrap || !g.THREE) return;
  var T = g.THREE, cam = W3.cam;
  var W = innerWidth, H = innerHeight;
  var D = панельD(W, H, W3.fov0 || 72);
  var fovV = (W3.fov0 || 72) * Math.PI / 180;
  var Hк = 2 * D * Math.tan(fovV / 2);
  var Wк = Hк * (W / H);

  var q = cabin.q1;
  if (!stagePanel._v) {
    stagePanel._v = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
    stagePanel._d = new T.Vector3();
    stagePanel._r = new T.Vector3();
    stagePanel._u = new T.Vector3();
    stagePanel._c = new T.Vector3();
    stagePanel._t = new T.Vector3();
  }
  var dir = stagePanel._d.set(0, 0, -1).applyQuaternion(q);
  var rt = stagePanel._r.set(1, 0, 0).applyQuaternion(q);
  var up = stagePanel._u.set(0, 1, 0).applyQuaternion(q);
  var ctr = stagePanel._c.copy(cabin.p0).addScaledVector(dir, D);

  /* Углы по часовой от левого верхнего */
  var знак = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  var px = [], i, v;
  cam.updateMatrixWorld();
  for (i = 0; i < 4; i++) {
    v = stagePanel._v[i].copy(ctr)
      .addScaledVector(rt, знак[i][0] * Wк / 2)
      .addScaledVector(up, знак[i][1] * Hк / 2);
    /* Сначала в систему камеры: угол за спиной проецировать нельзя,
       деление на отрицательную глубину вывернет картинку наизнанку */
    var vc = stagePanel._t.copy(v).applyMatrix4(cam.matrixWorldInverse);
    if (vc.z > -0.02) { панельПрочь(); return; }
    v.project(cam);
    px.push([(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]);
  }

  /* Единичный квадрат на четырёхугольник (Хекберт), затем перевод из
     координат элемента: u = x/W, v = y/H */
  var x0 = px[0][0], y0 = px[0][1], x1 = px[1][0], y1 = px[1][1];
  var x2 = px[2][0], y2 = px[2][1], x3 = px[3][0], y3 = px[3][1];
  var dx1 = x1 - x2, dy1 = y1 - y2;
  var dx2 = x3 - x2, dy2 = y3 - y2;
  var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  var den = dx1 * dy2 - dx2 * dy1;
  if (!isFinite(den) || Math.abs(den) < 1e-6) { панельПрочь(); return; }
  var gк = (sx * dy2 - dx2 * sy) / den;
  var hк = (dx1 * sy - sx * dy1) / den;
  var a = x1 - x0 + gк * x1, b = x3 - x0 + hк * x3, cc = x0;
  var d = y1 - y0 + gк * y1, e = y3 - y0 + hк * y3, f = y0;
  a /= W; d /= W; gк /= W;
  b /= H; e /= H; hк /= H;
  var m = "matrix3d(" +
    a.toFixed(6) + "," + d.toFixed(6) + ",0," + gк.toFixed(8) + "," +
    b.toFixed(6) + "," + e.toFixed(6) + ",0," + hк.toFixed(8) + "," +
    "0,0,1,0," +
    cc.toFixed(3) + "," + f.toFixed(3) + ",0,1)";
  /* Пишем матрицу ПРЯМО на слой, а не переменной на обёртке: запись
     переменной в родителя метит на пересчёт всё его поддерево, а там
     вся разметка рубки. Один элемент - одна композиция. */
  if (bakeEl && stagePanel._m !== m) {
    stagePanel._m = m;
    bakeEl.style.transform = m;
  }
  if (stagePanel._on !== 1) {
    stagePanel._on = 1;
    if (bakeEl) bakeEl.style.opacity = "1";
    заглушкаОкна(false);
  }
}
function панельПрочь() {
  if (stagePanel._on === 0) return;
  stagePanel._on = 0;
  if (bakeEl) bakeEl.style.opacity = "0";
  заглушкаОкна(true);
}

/* ── Заглушка проёма ────────────────────────────────────────
   Панель рисуется в разметке и на скользящих углах гаснет: когда
   один из её углов уходит за спину камеры, проективная матрица
   выворачивается, и честнее её убрать. Но проём в обшивке остаётся,
   и в него видно космос - в кадре это дыра в борту там, где должна
   стоять консоль.

   Затыкаем плитой в плоскости стены. Она тёмная, без деталей, и
   включается ровно тогда, когда панели нет: подмены не видно,
   потому что случается это у самой кромки кадра. */
function заглушкаОкна(показать) {
  if (!cabin || !W3 || !g.THREE) return;
  var T = g.THREE;
  if (!cabin.winFill) {
    if (!показать) return;
    var D = панельD(innerWidth, innerHeight, W3.fov0 || 72);
    var fovV = (W3.fov0 || 72) * Math.PI / 180;
    var Hз = 2 * D * Math.tan(fovV / 2) * 1.06;
    var Wз = Hз * (innerWidth / Math.max(1, innerHeight));
    var м = new T.Mesh(
      new T.PlaneGeometry(Wз, Hз),
      new T.MeshBasicMaterial({ color: 0x070d15, fog: false })
    );
    var dir = new T.Vector3(0, 0, -1).applyQuaternion(cabin.q1);
    м.position.copy(cabin.p0).addScaledVector(dir, D);
    м.quaternion.copy(cabin.q1);
    cabin.group.updateMatrixWorld(true);
    cabin.group.worldToLocal(м.position);
    м.quaternion.premultiply(
      cabin.group.getWorldQuaternion(new T.Quaternion()).invert());
    м.renderOrder = 2;
    cabin.group.add(м);
    cabin.winFill = м;
  }
  if (cabin.winFill.visible !== !!показать) cabin.winFill.visible = !!показать;
}

var stageWallMesh = null, stageWallSize = { w: 0, h: 0 };
function stageWall() {
  if (!cabin || !W3 || !g.THREE || !g.RC_DECK || !g.RC_CAB_FLAT || !g.RC_CAB_DECK) return;
  var T = g.THREE;
  var W = innerWidth, H = innerHeight;
  if (stageWallMesh && stageWallSize.w === W && stageWallSize.h === H) return;
  var вид = g.RC_DECK["какой"](W, H);
  var meta = g.RC_CAB_FLAT[вид] || g.RC_CAB_FLAT["широкая"];
  var план = g.RC_CAB_DECK[вид] || g.RC_CAB_DECK["широкая"];
  if (!meta || !план) return;

  var img = new Image();
  img.decoding = "async";
  img.onload = function () {
    if (!cabin || !W3) return;
    /* ── Печём в СОБСТВЕННОМ разрешении снимка ────────────────
       Панель в салоне была мутной, и вот почему. Холст пёкся в
       размере кадра, помноженном на плотность, ограниченную двойкой
       (Math.min(2, devicePixelRatio)). На телефоне с плотностью три
       это 824x1830 точек текстуры, растянутых на экран в 1236x2745
       настоящих точек - каждый пиксель размазан на полтора. Вдобавок
       снимок клался в холст уже уменьшенным по cover: из 1536x2499
       исходных точек оставалось 562x915.

       Теперь печём в размере САМОГО СНИМКА (потолок по длинной
       стороне - две тысячи с небольшим, чтобы не раздувать
       видеопамять). Текстура получает все точки исходника, и
       плотность экрана ей больше не указ: панель одинаково резкая и
       на плотности один, и на плотности три.

       Снимок кабины уже СПЛОШНОЙ и непрозрачный (углы alpha=255),
       прозрачно ТОЛЬКО окно (центр alpha=0). Значит плоскость сама по
       себе - твёрдая консоль с дырой окна. */
    var LONG = 2048;
    var нат = Math.min(1, LONG / Math.max(meta.w, meta.h));
    var BW = Math.max(2, Math.round(meta.w * нат));
    var BH = Math.max(2, Math.round(meta.h * нат));
    var c = doc.createElement("canvas");
    c.width = BW;
    c.height = BH;
    var x = c.getContext("2d");
    x.drawImage(img, 0, 0, BW, BH);
    /* Ниши, тела и свет клавиш - тем же модулем, что в игре, чтобы
       консоль в салоне и панель в игре были один в один. Рисуем их в
       ПРОСТРАНСТВЕ СНИМКА: покрытие(meta, BW, BH) при совпадающих
       пропорциях даёт ox=oy=0 и k=нат, то есть доли разметки ложатся
       прямо на пиксели снимка - без второго пересчёта через кадр. */
    try {
      var d2 = g.RC_DECK.создать();
      d2.вид(meta, план, doc.documentElement.lang !== "en");
      d2.размер(BW, BH, 1);
      d2.кадр(0.016);
      if (d2["тело"]) x.drawImage(d2["тело"], 0, 0, BW, BH);
      x.globalCompositeOperation = "screen";
      x.drawImage(d2.canvas, 0, 0, BW, BH);
      x.globalCompositeOperation = "source-over";
    } catch (eD) {}

    var tex = new T.CanvasTexture(c);
    if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    /* Уменьшение честное: из глубины салона панель занимает малую
       долю кадра, и без пирамиды уменьшений её кромки кипят. */
    tex.generateMipmaps = true;
    if (T.LinearMipmapLinearFilter) tex.minFilter = T.LinearMipmapLinearFilter;
    try {
      tex.anisotropy = (W3.r && W3.r.capabilities)
        ? W3.r.capabilities.getMaxAnisotropy() : 8;
    } catch (eA) { tex.anisotropy = 8; }

    /* ── Размер и место плоскости ─────────────────────────────
       Плоскость показывает ВЕСЬ снимок, а не его cover-кроп. Размер
       подобран так, чтобы из точки пилота p0 кроп заполнял кадр ровно
       по кромку: то есть последний кадр салона и первый кадр игры -
       одна и та же картинка, а лишнее поле снимка просто уходит за
       кромку. Из глубины салона это поле видно, и панель читается
       консолью целиком, а не прямоугольником по размеру экрана. */
    var D = (g.RC_PANEL && g.RC_PANEL.CAM_WIN) || 0.86;
    var fovV = (W3.fov0 || 72) * Math.PI / 180;
    var Hк = 2 * D * Math.tan(fovV / 2);          /* высота кадра на D */
    var ед = Hк / H;                              /* мировых единиц на точку кадра */
    var пк = g.RC_DECK["покрытие"](meta, W, H);
    var Wm = пк.dw * ед;
    var Hm = пк.dh * ед;
    /* Cover прижимает снимок по вертикали не по центру (пульт обязан
       остаться в кадре), поэтому центр снимка смещён относительно
       центра кадра - переносим это смещение в мир. */
    var сдвВниз = ((пк.oy + пк.dh / 2) - H / 2) * ед;
    if (stageWallMesh) {
      try {
        stageWallMesh.parent && stageWallMesh.parent.remove(stageWallMesh);
        stageWallMesh.geometry.dispose();
        stageWallMesh.material.map && stageWallMesh.material.map.dispose();
        stageWallMesh.material.dispose();
      } catch (eR) {}
      stageWallMesh = null;
    }
    var mesh = new T.Mesh(
      new T.PlaneGeometry(Wm, Hm),
      new T.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false })
    );
    mesh.userData.борта = [];
    var dir = new T.Vector3(0, 0, -1).applyQuaternion(cabin.q1);
    var вверх = new T.Vector3(0, 1, 0).applyQuaternion(cabin.q1);
    var посадка = cabin.p0.clone().addScaledVector(dir, D)
      .addScaledVector(вверх, -сдвВниз);
    mesh.position.copy(посадка);
    mesh.quaternion.copy(cabin.q1);
    mesh.renderOrder = 5;
    cabin.group.updateMatrixWorld(true);
    cabin.group.worldToLocal(mesh.position);
    var qInv = cabin.group.getWorldQuaternion(new T.Quaternion()).invert();
    mesh.quaternion.premultiply(qInv);
    cabin.group.add(mesh);
    stageWallMesh = mesh;
    stageWallSize.w = W; stageWallSize.h = H;
  };
  img.src = meta["файл"];
}

function cabFrameLayer() {
  if (!ui || !ui.wrap) return;
  var M = g.RC_CAB_FLAT;
  if (!M) return;
  var meta = M[(g.RC_DECK && g.RC_DECK["какой"]) ? g.RC_DECK["какой"](innerWidth, innerHeight)
                : (innerHeight > innerWidth ? "высокая" : "широкая")] || M["широкая"];
  if (!meta) return;
  if (!ui.cabFrame) {
    var el = doc.createElement("img");
    el.className = "rcf-cabframe";
    el.alt = "";
    el.setAttribute("aria-hidden", "true");
    el.decoding = "async";
    ui.wrap.appendChild(el);
    ui.cabFrame = el;
  }
  if (ui.cabFrame.getAttribute("src") !== meta["файл"]) {
    ui.cabFrame.setAttribute("src", meta["файл"]);
  }
  /* Привязка кадра по вертикали считается там же, где геометрия ниш:
     иначе картинка и разметка приборов разъедутся ровно на широком
     мониторе, где сдвиг и нужен. */
  if (g.RC_DECK && g.RC_DECK["покрытие"]) {
    var п = g.RC_DECK["покрытие"](meta, innerWidth, innerHeight);
    ui.cabFrame.style.objectPosition = "50% " + (п["доля"] * 100).toFixed(2) + "%";
  }
}

/* ── Салон в полёте: рисуем только то, что видно ──────────────
   В игре камера стоит в кресле пилота, пульт рисуется слоем
   разметки поверх холста, а помещение остаётся за спиной и по
   бокам - вне поля зрения. Каждый его меш при этом стоил бы вызова
   отрисовки и прохода по четырём лампам салона в кадре, где рядом
   считается космос.

   Штатно это уже делает cabinFlightMode при переходе из салона:
   замер в игре показывает 67 мешей и ноль видимых. Здесь закрыт
   другой случай - прямой вход кнопкой «Начать полёт», когда салона
   на момент входа ещё нет и гасить в нём нечего. Тогда решение
   принимается сразу после сборки: сборка спрашивает, идёт ли уже
   полёт, и если да - гасит. Без этого помещение рисовалось бы
   невидимым за слоем разметки.

   Ни одна матрица не трогается: салон остаётся там же, где стоял,
   камера там же, где стояла. Список погашенного храним, чтобы
   вернуть ровно то, что было видно - часть мешей салон гасит
   своими правилами, и включать всё подряд нельзя. */
function салонВПолёте(вкл) {
  if (!cabin || !cabin.group) return;
  if (вкл) {
    if (cabin.полётСкрыл) return;
    var оставить = [];
    if (cabin["передняя"]) оставить.push(cabin["передняя"]);
    if (cabin.console3 && cabin.console3.group) {
      cabin.console3.group.traverse(function (o) { оставить.push(o); });
    }
    var спис = [];
    cabin.group.traverse(function (o) {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      if (оставить.indexOf(o) >= 0) return;
      /* Родитель мог быть погашен целиком - тогда меш и так не
         рисуется, и в список его класть незачем. */
      if (!o.visible) return;
      o.visible = false;
      спис.push(o);
    });
    cabin.полётСкрыл = спис;
    return;
  }
  if (!cabin.полётСкрыл) return;
  for (var i = 0; i < cabin.полётСкрыл.length; i++) cabin.полётСкрыл[i].visible = true;
  cabin.полётСкрыл = null;
}

function cabinFlightMode() {
  if (!cabin || !W3 || cabin.flightMode) return;
  cabin.flightMode = true;
  /* Подвешиваем салон к камере ЯВНЫМИ числами, а не сохранением
     мирового положения.

     Было attach: он оставляет салон там, где тот стоял в мире, и
     дальше салон едет с камерой. Это верно ровно в одном случае -
     если в момент привязки камера уже стоит в пилотском кресле.
     При прямом запуске («Начать полёт» с сайта) она там не стоит:
     кадр ещё не считался. Салон прилипал со случайным сдвигом, и в
     игре рубки не было вовсе - тот самый разрыв между сайтом и
     игрой, о котором говорил заказчик.

     Здесь сдвиг задан из тех же констант, по которым построена
     рама: глаз пилота на высоте EYE, до остекления CAM_WIN. Салон
     садится ровно так, как задумано, при любом входе.

     Наклон рамы обнуляем: в полёте направление взгляда задаёт сама
     камера, и поправка, нужная при подъезде в салоне, здесь увела
     бы раму вверх. */
  var C = g.RC_PANEL;
  if (cabin.console3 && cabin.console3.setPitch) cabin.console3.setPitch(0);
  /* Радиус остекления зовётся R_WALL. Здесь стояло C.R - имя из
     прошлой рамы, которой больше нет. Оно молча давало undefined,
     сдвиг по глубине становился NaN, и весь салон вылетал из
     мира: рама была собрана, лежала в сцене, была видима, а на
     экране её не было. Приёмка это и показала - мировое положение
     оболочки NaN при исправной камере. */
  var rWall = C && C.R_WALL ? C.R_WALL : (C && C.R ? C.R : cabin.R);
  var camWin = C && C.CAM_WIN ? C.CAM_WIN : CAM_WIN;
  cabin.group.position.set(0, -(C ? C.EYE : cabin.eye), rWall - camWin);
  cabin.group.quaternion.identity();
  cabin.group.scale.set(1, 1, 1);
  /* В полёте из салона видна ТОЛЬКО рама пульта.

     Гасим всё остальное железо салона по двум причинам, обе
     замерены. Первая: обшивка по краям кадра оказывается ближе к
     глазу, чем рама, и перекрывала её синими полосами вдоль левого и
     правого края. Вторая: окантовка проёма собрана из трёх десятков
     сегментов, и её кромка шла по дуге окна крупной пилой - её и
     видел заказчик, считая, что зубцы у рамы.

     Свет не трогаем: лампы салона освещают раму, а у неё свои
     поверх них. Прежнюю видимость запоминаем, чтобы вернуть при
     выходе из полёта. */
  if (!cabin.скрыто) {
    cabin.скрыто = [];
    var внутри = [];
    if (cabin.console3 && cabin.console3.group) {
      cabin.console3.group.traverse(function (o) { внутри.push(o); });
    }
    cabin.group.traverse(function (o) {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      if (внутри.indexOf(o) >= 0) return;
      if (o.visible) { cabin.скрыто.push(o); o.visible = false; }
    });
  }
  W3.cam.add(cabin.group);
  cabin.group.updateMatrixWorld(true);
}

function cabinDrop() {
  if (!cabin || !W3) return;
  /* Салон собирается заново на каждый заезд в финал: прокрутил вниз,
     прокрутил вверх, прокрутил вниз - и снова десяток холстов на
     текстуры, объёмные клавиши и физматериалы. Раньше узел просто
     отвязывался, а видеопамять за ним не возвращалась: второй и
     каждый следующий заезд стоил дороже предыдущего, до потери
     контекста. Отдаём всё дерево целиком. */
  убратьДерево(cabin.frame);
  убратьДерево(cabin.group);
  if (ui && ui.wrap) ui.wrap.classList.remove("rcf-native-cab");
  cabin = null;
}

/* Постановка кадра в салоне.

   Оборот ведёт прокрутка страницы: доля приходит из сцены сайта,
   которая знает, где какой раздел. Камера не летает по комнате -
   она стоит в середине и поворачивается, а к концу подступает к
   остеклению. Экраны при этом не двигаются вовсе: они часть стен,
   и «наверх ничто не уходит», как и требовалось. */
function stageCam(dt) {
  var C = cabin, T = g.THREE, w3 = W3;
  var I = g.RC_INTERIOR;
  var yawT = (I && I.yaw) ? I.yaw() : 0;
  var k = F.stageK || 0;
  /* Косинус перенормирован так, чтобы приходить ровно в единицу на
     0.96 доли с нулевой скоростью: прежняя жёсткая ступенька в конце
     давала видимый толчок кадра при переходе в игру */
  var kk = Math.min(1, k / 0.96);
  var ek = 0.5 - 0.5 * Math.cos(Math.PI * kk);

  /* Оборот сходится к нулю по мере подъезда: в конце камера
     смотрит строго в окно, иначе проём уедет вбок */
  /* ГЛАВНЫЙ источник дёрганого финала. Оборот в rc-interior сходится
     к ПОЛНОМУ кругу (TAU), а прежняя формула гасила yaw к нулю - на
     подъезде камера раскручивалась обратно на все триста шестьдесят
     градусов. Теперь довод идёт по короткой дуге к полному кругу:
     та же точка обзора, но без обратного вращения. */
  /* Финал и игра используют один и тот же пилотский ракурс. Старый
     круговой обход заставлял зрителя смотреть на пустые синие стены,
     а к старту внезапно подменял их настоящей приборной рамой. Теперь
     мы остаёмся лицом к остеклению с самого шага через люк; движение
     сохраняется как очень небольшой параллакс головы, а не как тур
     по декорации. Это тот же 3D-мир и та же камера, с которой через
     секунду начинается управление кораблём. */
  /* Полный оборот салона считает rc-interior: ноль на входе, семь
     остановок у экранов, ровно TAU на подъезде к пульту. Здесь
     стояло yaw = TAU всегда, то есть в слое полёта камера смотрела
     в окно с первого же кадра и оборота не показывала совсем -
     отсюда «внутри ракеты в салоне перед игрой 360 не работает».

     Берём настоящий угол, а к пульту дожимаем его к полному кругу:
     ek на подъезде равен единице, значит финальный кадр остаётся
     тем же самым и проём никуда не уезжает. */
  var survey = Math.sin(F.stageT / 4.4) * 0.014 * (1 - ek);
  var yaw = yawT + (Math.PI * 2 - yawT) * ek + survey;
  F.stageYaw = yaw;



  /* Дыхание: человек не штатив. На подъезде затухает - там кадр
     обязан встать намертво. */
  F.stageT = (F.stageT || 0) + dt;
  var calm = 1 - ek;
  var drift = Math.sin(F.stageT / 5.5) * 0.02 * calm;
  var bob = Math.sin(F.stageT / 3.2) * 0.012 * calm;

  /* Положение: от места у входа к рабочей точке пилота.

     Замер приёмки: пульт занимал 13,6% ширины кадра в салоне и
     43,8% в игре. Втрое - это уже не «та же панель под другим
     углом», это две разные вещи, и заказчик прочитал финал как
     подмену: сначала схематичный пультик из точек, потом внезапно
     настоящая консоль.

     Панель одна и была, вопрос был только в расстоянии. Начинаем
     подъезд не из середины помещения, а с половины пути: панель
     сразу читается той самой, а ход вперёд остаётся - он и должен
     ощущаться шагом к рабочему месту, а не перелётом через зал. */
  /* Камера стоит там, где стояла: заказчик держит кадр за космосом,
     панель живёт у нижнего края. Подъезд ведёт сценарий, а не мы. */
  /* ── Где стоит зритель во время оборота ───────────────────
     Доля кадра, которую занимает панель, равна отношению D к
     расстоянию до неё: из середины помещения это 0.86 / 3.05 = 28
     процентов. Владелец увидел ровно это и сказал: «слишком мелко,
     она не должна быть как картина на стене, она = стена».

     Двигаем не панель, а зрителя. Оборот делается не из геометрической
     середины, а с половины пути к креслу пилота: расстояние падает
     вдвое, и панель занимает уже половину кадра - это перёд корабля,
     а не картина на нём. Комната при этом остаётся целой: все семь
     экранов на своих местах и в кадре, до задней стены по-прежнему
     далеко. Замер: доля ширины кадра у панели 0.23 при нуле, 0.32
     при половине, 0.50 при 0.72. */
  /* ── Порядок сцены: центр, оборот, и только потом подъезд ──
     Здесь стояло START = 0.72: зритель стоял в трёх четвертях пути
     к креслу пилота ВСЁ время оборота и подъезжал остаток вместе с
     ним. Сделано это было в ответ на «панель мелкая, как картина на
     стене» - и панель действительно становилась крупнее, но ценой
     сценария. Заказчик описал, что должно быть, дословно: «должна
     остановиться в центре и провернуться на 360 и только потом
     приближаться к панели», и отдельно - «сейчас она в начале
     приближается к панели, а потом начинает крутиться, но не с
     центра салона».

     Доля подъезда уже считается отдельно от оборота: rc-interior
     держит её нулём до конца оборота и разгоняет от нуля до единицы
     между концом оборота и пультом. Берём её, а не общую долю
     сцены - тогда порядок получается сам собой, без ступеней и без
     подгонки чисел: пока идёт оборот, камера стоит в центре;
     оборот кончился - начался подъезд.

     Плата честная: во время оборота панель мельче, чем была. Это и
     есть вид из центра комнаты, а крупной она становится на
     подъезде, ради которого подъезд и существует. */
  var подъезд = (I && I.con) ? I.con() : ek;
  /* Ворота по фактическому обороту.

     Доля подъезда считается по прокрутке и честно равна нулю до
     конца оборота. Но сам оборот доворачивается с запаздыванием:
     угол сходится к расписанию плавно, а не мгновенно. Замер это и
     показал - подъезд стартовал на 5.10 радиана из 6.28, то есть
     последняя пятая часть круга проходила уже на ходу к пульту.
     Заказчик просил разделить: сначала оборот целиком, потом
     подъезд.

     Ворота открываются по НАСТОЯЩЕМУ углу, а не по прокрутке, и не
     ступенькой, а на последней десятой круга - иначе камера дёрнулась
     бы с места. Основную работу делает расписание в rc-interior: оно
     доводит угол до полного круга раньше рубежа, и к началу подъезда
     оборот закрыт по-настоящему. Ворота тут страховка на случай,
     если угол всё же отстал, а не главный механизм - потому и мягкие:
     жёсткие сжимали подъезд в последние проценты прокрутки, и кадр у
     пульта переставал совпадать с игровым.

     К пульту оба множителя равны единице, поэтому конечная точка не
     меняется ни на пиксель. */
  var ворота = Math.max(0, Math.min(1, (yawT / (Math.PI * 2) - 0.90) / 0.08));
  подъезд *= ворота;
  var eyeY = C.center.y + C.eye + bob;
  C.vTmp.set(C.center.x, eyeY, C.center.z);
  C.vTmp.lerp(C.p0, подъезд);

  /* Вход тоже движение, а не стоп-кадр.

     rc-interior честно считает шаг внутрь (st.enter, он же dollyT от
     1.70 к рабочей точке), но камера сцены его не читала: она жила
     одним ek, а ek равен нулю до самого начала оборота. Замер это и
     показал - от входа до первого градуса оборота проходит от 943
     точек прокрутки на лежачем до 2365 на широком, две с лишним
     высоты экрана, и всё это время камера стоит намертво. Два кадра,
     снятые в полутора экранах друг от друга, различались на пятнадцать
     точек сдвига одной карточки. Голограммы при этом наезжают на
     зрителя (за них отвечает то же число), а комната за ними стоит:
     параллакс разъезжается, и кадр читается нарисованным.

     Берём этот шаг и отводим камеру назад по оси «от пульта»: на
     входе человек стоит глубже в салоне и видит панель поодаль,
     дальше идёт к ней. Ровно то, что заказчик и описывал - «видно её
     вдалеке в салоне, заходим внутрь, приближаемся к панели». К
     началу подъезда отвод сходит на нет, финальный кадр не меняется
     ни на пиксель. */
  var eIn = (I && I.enter) ? I.enter() : 1;
  var отвод = (1 - eIn) * (1 - ek) * 0.8;
  if (отвод > 0.001) {
    if (!C.назад) C.назад = new T.Vector3();
    C.назад.set(C.center.x, eyeY, C.center.z).sub(C.p0);
    C.назад.y = 0;
    if (C.назад.lengthSq() > 1e-6) {
      C.назад.normalize();
      C.vTmp.addScaledVector(C.назад, отвод);
    }
  }
  w3.cam.position.copy(C.vTmp);

  /* Поворот: пока идёт оборот - свой азимут, к финалу сходимся к
     ориентации первого кадра полёта, вместе с её наклоном */
  var pit = (I && I.pitch) ? I.pitch() : 0;
  C.eTmp.set(pit * (1 - ek) * 0.18, C.yaw0 - yaw + drift, 0);
  C.qTmp.setFromEuler(C.eTmp);
  w3.cam.quaternion.copy(C.qTmp).slerp(C.q1, ek * ek);

  if (w3.cam.fov !== w3.fov0) { w3.cam.fov = w3.fov0; w3.cam.updateProjectionMatrix(); }

  /* Корпус кабины в проёме проявляется к концу подъезда: до этого
     мы видим сам проём и настоящую раму, а рисунок корпуса
     подхватывает кадр ровно там, где совпадает с плоской рамкой
     полёта. Опережать нельзя - иначе он повиснет в воздухе. */
  if (C.frame) C.frame.visible = false;
  /* Место панели считаем каждый кадр: она стоит в мире, а рисуется
     в DOM. Масштаб фиксируем единицей - размер целиком в матрице. */
  if (ui.wrap) ui.wrap.style.setProperty("--rcf-cabs", "1");
  /* Свет пульта разгорается вместе с подходом, а общий свет
     помещения к концу подъезда гаснет. Это не приём ради приёма:
     когда человек садится за панель, кадр обязан принадлежать
     остеклению и космосу за ним, а не подсвеченным стенам за
     спиной. Заодно уходит светлая полоска стены, которая иначе
     видна по краю корпуса. */
  /* ── Салон красит то, что за окном ────────────────────────
     Свет из остекления не выдуман: за ним Земля, и она отражает на
     стены голубое. Берём направление на планету и её расстояние -
     чем ближе, тем сильнее подсвет, и тем заметнее холодная нота на
     дальней половине помещения.

     Это ровно то, чего не хватало прежней рубке: там свет из окна
     был постоянным, и комната не реагировала на мир вокруг. */
  if (C.lamp && w3.earth) {
    var d = w3.cam.position.distanceTo(w3.earth.position);
    var near = Math.max(0, Math.min(1, 1 - (d - 60) / 420));
    C.lamp.intensity = (1.5 + near * 1.9) * (1 - Math.max(0, Math.min(1, (ek - 0.55) / 0.4)) * 0.55);
    /* Тон от планеты: у Земли он холодный синий, к её ночной
       стороне уходит в фиолет */
    C.lamp.color.setRGB(0.55 + near * 0.18, 0.72 + near * 0.16, 0.95);
  }
  if (C.refl) {
    /* Отражение ярче, когда за стеклом светло: на ночной стороне
       стекло почти чистое */
    var lit = w3.earth ? Math.max(0, Math.min(1, 1 - w3.cam.position.distanceTo(w3.earth.position) / 400)) : 0.4;
    C.refl.material.opacity = 0.08 + lit * 0.10;
    if (C.reflLip) C.reflLip.material.opacity = 0.16 + lit * 0.16;
  }

  /* Гул к пульту чуть плотнее: приборы просыпаются */
  if (g.RC_SOUND && g.RC_SOUND.flightLevel) {
    var lvl = 0.12 + ek * 0.1;
    if (Math.abs(lvl - (F.humLvl || 0)) > 0.02) {
      F.humLvl = lvl;
      try { g.RC_SOUND.flightLevel(lvl); } catch (e) {}
    }
  }

  /* Рама подъезжает вместе с камерой: далеко она меньше и глуше, у
     самого пульта - ровно 1:1, как в полёте. Совпадение в конце
     обязательно, на нём и держится бесшовность: кадр перед нажатием
     кнопки и первый кадр игры должны быть одним и тем же кадром. */


  var dim = Math.max(0, Math.min(1, (ek - 0.55) / 0.4));
  if (C.deskLight) C.deskLight.intensity = 0.9 + ek * 1.9;
  if (C.hemi) C.hemi.intensity = 1.45 * (1 - dim * 0.92);
  if (C.ceilL) C.ceilL.intensity = 1.35 * (1 - dim * 0.95);
  if (C.warmL) C.warmL.intensity = 1.7 * (1 - dim * 0.95);
  /* Диоды дышат */
  if (C.diodes && !ui.wrap.classList.contains("rcf-fast")) {
    for (var i = 0; i < C.diodes.length; i++) {
      var d = C.diodes[i];
      var b = 0.55 + 0.45 * Math.sin(F.stageT * 1.7 + d.userData.ph);
      d.material.transparent = true;
      d.material.opacity = b;
    }
  }
}

/* ── Кабина как финал сайта ──────────────────────────────────
   Раньше финал рисовала своя трёхмерная рубка: свой корпус, своё
   остекление, своя нарисованная планета. Получались два разных
   корабля подряд - один на сайте, другой в игре, и владелец увидел
   это сразу: «панель не та, которая в игре, я говорил - та панель
   (рамка), которая в игре, 1:1 она же в ракете, и фон тот же, космос
   с Землёй как в игре 1:1».

   Теперь финал и игра - буквально один слой. Тот же корпус кабины,
   тот же мир, та же Земля, та же камера. Разница ровно в двух вещах:
   в режиме сцены корабль стоит и приборов на стекле нет, а по нажатию
   старта они зажигаются и корабль трогается. Никакой склейки между
   сайтом и игрой не существует - её нечему разделять.

   Доля k ведёт подъезд: 0 - камера отведена назад (кадр «панель чуть
   дальше»), 1 - ровно ракурс старта полёта. */
/* ── Предсборка мира ─────────────────────────────────────────
   Владелец описал вход так: «зависание при входе, кадр не
   прогружается». Причина была на виду: buildWorld собирает всю
   сцену полёта - сорок пять тел, у каждого своя карта поверхности,
   печёная попиксельно, у Сатурна 2048 на 1024 - и делала это тем
   самым кадром, которым открывался люк. Створки и постройка мира
   попадали в один кадр, кадр вставал.

   Сборку двигаем вперёд, в проход к трапу. Человек в это время идёт
   к кораблю, кадр занят движением корпуса, лишняя работа в нём не
   видна. К моменту открытия люка мир уже стоит, и stage остаётся
   только поднять признак.

   Зовёт rc-interior с доли P_PREP. Если объёмный слой ещё не доехал,
   молча выходим: stage соберёт мир по-старому, как и раньше. */
function prebuild() {
  if (F.built || !g.THREE) return false;
  var тП = DBG ? performance.now() : 0;
  buildUI();
  var тUI = DBG ? performance.now() : 0;
  try { W3 = buildWorld(); } catch (e) {
    try { console.error("rc-flight: предсборка мира не удалась -", e); } catch (e2) {}
    return false;
  }
  F.built = true;
  netRestore();
  /* Корпус рубки собираем здесь же, заранее. Раньше он строился в
     первом кадре входа: замер приёмки на телефоне дал до 83 секунд
     на этот единственный кадр, и вход читался зависанием. Сцена
     ещё не рисуется, значит собрать его сейчас ничего не стоит. */
  var тМир = DBG ? performance.now() : 0;
  if (g.RC_CABIN) { try { cabinBuild(); } catch (e) {} }
  if (DBG) {
    var тК = performance.now();
    ЭТАПЫ.push(["+ разметка HUD", +(тUI - тП).toFixed(1)]);
    ЭТАПЫ.push(["+ мир целиком", +(тМир - тUI).toFixed(1)]);
    ЭТАПЫ.push(["+ корпус рубки", +(тК - тМир).toFixed(1)]);
  }
  return true;
}

function stage(k) {
  /* Отрицательная доля - команда убрать салон совсем. Ноль это не
     «выключено», а «вошли, но ещё не подступили к панели»: салон в
     этот момент как раз и нужен целиком. */
  if (k == null || k < 0) { stageOff(); return; }
  k = k > 1 ? 1 : k;
  if (F.open && !F.stage) return;            /* игра уже идёт - не мешаем */
  if (!g.THREE) {
    /* Объёмный слой ещё грузится: попробуем, когда доедет */
    if (!stage._wait) {
      stage._wait = 1;
      addEventListener("rc:3d", function once () {
        removeEventListener("rc:3d", once);
        stage._wait = 0;
        if (F.stageK > 0.002) stage(F.stageK);
      });
    }
    F.stageK = k;
    return;
  }
  /* ── Без корпуса кабины сцену не показываем ────────────────
     cabinBuild молча выходит, если модуль кабины ещё не доехал, а
     сцена включалась следом - и человек видел клавиши и космос БЕЗ
     рамы рубки. На быстром канале это доли секунды и незаметно, на
     мобильном интернете - минута такого кадра. Владелец прислал
     ровно его: «а куда снова панель управления пропала?»

     Ждём модуль и пробуем снова. Скролл при этом не блокируется:
     доля просто запоминается, как и с объёмным слоем выше. */
  if (!g.RC_CABIN) {
    F.stageK = k;
    if (!stage._ждуКабину) {
      stage._ждуКабину = setInterval(function () {
        if (!g.RC_CABIN) return;
        clearInterval(stage._ждуКабину);
        stage._ждуКабину = 0;
        if (F.stageK > 0.002 && !F.stage) stage(F.stageK);
      }, 220);
    }
    return;
  }
  buildUI();
  if (!F.built) {
    try { W3 = buildWorld(); } catch (e) {
      try { console.error("rc-flight: мир сцены не собрался -", e); } catch (e2) {}
      return;
    }
    F.built = true;
    netRestore();
  }
  var былоУПульта = (F.stageK || 0) > 0.80;
  var былоК = F.stageK || 0;
  F.stageK = k;
  /* Пересечение порога подъезда: пересчитываем плотность пикселей,
     чтобы к стыку с игрой она уже была игровой.

     И отдельно - сам ход подъезда. Дальние тела возвращаются теперь
     не одним порогом, а поодиночке по своим порогам (см. stageLite),
     и для этого пересчёт обязан случаться ПО ХОДУ, а не только на
     пересечении 0.80. Дёргаем его на каждой сотой доли подъезда:
     тел двадцать один, шагов сто, значит на каждое приходится свой
     кадр, и лишней работы почти нет. */
  if (F.stage && (былоУПульта !== (k > 0.80) ||
                  Math.floor(былоК * 200) !== Math.floor(k * 200))) stageLite(true);
  if (ui.wrap) ui.wrap.style.setProperty("--rcf-stage", k.toFixed(3));
  if (F.stage) return;

  F.stage = true;
  F.open = true;                              /* кадр рисуется тем же циклом */
  if (ui.wrap) ui.wrap.classList.remove("rcf-native-cab");
  /* Рама рубки нужна ЕЩЁ НА ПОДЪЕЗДЕ. Заказчик написал дословно:
     «панель не видно ещё до захода в корабль, она должна быть
     прибита к салону ещё до захода в ракету и видно вдалеке её же
     1:1». Раньше на весь финал рамы не было вовсе: человек летел к
     голограмме, висящей в пустоте, а по нажатию кнопки вокруг него
     внезапно возникала рубка. Это и была подмена, о которой он
     говорил. Картинка одна и та же, меняется только расстояние. */
  cabinBuild();
  /* Панель в салоне - та же картинка кабины и те же приборы, что в
     игре (DOM, полное разрешение экрана), но приколоченная к МИРУ:
     каждый кадр stagePanel() считает её место проекцией прямоугольника
     кадра игры из точки пилота. Стоит в своём углу, при обороте
     остаётся на месте, при подъезде приближается, а в конце подъезда
     ложится на кадр один в один - это и есть кадр игры.
     Трёхмерную раму пульта прячем, чтобы не двоила. */
  /* Плоской панели в салоне больше нет вовсе. Её роль взяла передняя
     секция рубки: та же стена, лицо которой - снимок, положенный
     проекцией из кресла пилота. Вклеивать нечего. */
  /* Трёхмерный пульт против плоской панели: с признаком rc3d=1 в
     салоне работает НАСТОЯЩАЯ геометрия, поднятая по карте глубины
     того же снимка, а плоская картинка не поднимается вовсе. */
  var трёхм = false;
  try { трёхм = /[?&]rc3d=1/.test(location.search); } catch (e3D) {}
  if (cabin && cabin.console3 && cabin.console3.group) {
    cabin.console3.group.visible = трёхм;
  }
  if (трёхм && bakeEl) bakeEl.style.display = "none";
  /* Гул корабля в салоне. Тише, чем в полёте: двигатель на холостом,
     работает вентиляция и приборы. Без него помещение читается
     картинкой - в кино корабль всегда слышно. */
  if (g.RC_SOUND) {
    try {
      if (g.RC_SOUND.flight) g.RC_SOUND.flight(true);
      if (g.RC_SOUND.flightLevel) g.RC_SOUND.flightLevel(0.13);
    } catch (e) {}
  }
  F.p = 0; F.v = 0; F.last = 0;
  F.away = false;
  F.look.x = F.look.y = F.look.tx = F.look.ty = 0;
  F.free = false;
  cabSrc();
  /* ── Разгрузка салона ────────────────────────────────────
     Из окна корабля виден только ближний космос: Земля, Луна и
     звёзды. Дальние галактики, туманности, пояс астероидов и
     планеты-гиганты в кадр не попадают, но честно рендерятся -
     и именно на них уходил кадр в финале сайта. Гасим их на время
     салона и возвращаем при старте полёта. */
  stageLite(true);
  ui.wrap.classList.add("on", "rcf-stage");
  /* Класс на корне гасит трёхмерную рубку сайта: два корабля в одном
     кадре - это и есть тот самый шов, ради которого всё затевалось */
  root.classList.add("rc-stage");
  size();
  if (!F.raf) F.raf = requestAnimationFrame(frame);
}

/* Тяжёлые дальние слои мира: в салоне они не видны из окна, а
   стоят дороже всего остального вместе взятого */
function stageLite(on) {
  if (!W3) return;
  /* Дальние тела возвращаются НЕ на стыке с игрой, а на подъезде.

     Их прятали на всё время сцены и включали разом в тот кадр, где
     начинается полёт: приёмка сняла два кадра подряд, и на первом
     справа пустой космос, а на втором там Сатурн, Юпитер, пояс
     астероидов и луны. Двадцать одно тело, появившееся в один кадр,
     читается подменой содержимого окна - ровно то слово, которое
     говорил владелец.

     Возвращаем их на четырёх пятых подъезда. Камера в этот момент уже
     почти встала и смотрит в проём, человек читает панель, а не
     считает звёзды. К стыку менять нечего: и тела на месте, и
     плотность пикселей уже игровая. */
  var к = F.stageK || 0;
  var уПульта = on && к > 0.80;
  var far = [W3.milky, W3.gal2, W3.gal3, W3.nebSprites, W3.galacticVolume,
             W3.belt1, W3.belt2, W3.rockField,
             W3.jupiter, W3.uranus, W3.neptune, W3.mercury, W3.venus,
             W3.hole, W3.comet, W3.saturn, W3.mars,
             /* Солнце дороже всех: его поверхность считает шейдер
                конвекции на каждый пиксель. Из окна салона звезда
                не видна - она за кормой. */
             W3.sun, W3.sunGlow, W3.corIn, W3.corOut];
  /* ── Почему тела возвращаются ПО ОЧЕРЕДИ ──────────────────
     Возврат стоял одним порогом на весь список: до 0.80 подъезда
     спрятано всё, после - видно всё. Замер прокруткой по восемьдесят
     точек поймал ровно это: за один шаг число видимых узлов сцены
     прыгало с одиннадцати на тридцать. Девятнадцать тел, появившихся
     в одном кадре, человек читает подменой содержимого окна - тем
     самым словом, которое говорил владелец, и порог 0.80 его не
     снимал, а только переносил.

     Теперь у каждого тела свой порог, разложенный по ходу подъезда
     от 0.04 до 0.78. Тела возвращаются поодиночке и пока камера ещё
     ЕДЕТ: движение прячет появление лучше любой прозрачности. К
     0.80, когда кадр встал и меняется плотность пикселей, список уже
     полон, и на самом стыке с игрой менять нечего.

     Порядок списка не случаен: сначала галактики и туманности - они
     размыты и появляются незаметнее всего, - потом пояса, потом
     планеты, и последним Солнце с короной. */
  var ОТ = 0.04, ДО = 0.78;
  for (var i = 0; i < far.length; i++) {
    var o = far[i];
    if (!o) continue;
    var порог = far.length > 1 ? ОТ + (ДО - ОТ) * (i / (far.length - 1)) : ОТ;
    var прятатьЭто = on && к <= порог;
    if (o.length) { for (var j = 0; j < o.length; j++) if (o[j]) o[j].visible = !прятатьЭто; }
    else o.visible = !прятатьЭто;
  }
  /* Домашние тела и галактики возвращает блок ниже. Он ставит на
     место сразу НЕСКОЛЬКО узлов, поэтому зовём его в самом начале
     возврата, а не в конце: на пороге 0.78 замер ловил его как
     скачок на четыре тела в один шаг - последний оставшийся после
     разводки списка. Теперь он отрабатывает на первом же пороге,
     когда камера только тронулась. */
  var прятать = on && к <= ОТ;
  /* Возвращая тела, спрашиваем, В КАКОМ МЫ РУКАВЕ.

     Здесь стояло безусловное включение всего списка. В чужой
     вселенной это означало вот что: после любого срабатывания
     адаптивного качества посреди PROXIMA снова зажигались Марс,
     Сатурн, Юпитер, Нептун, комета и земные узлы сети. Заказчик
     увидел ровно это и написал, что в других вселенных клик по
     планете открывает описание Земли: он и правда попадал по
     воскресшей Земле, стоявшей поверх чужой системы.

     Домашние тела возвращаем только дома. Галактики и туманности
     общие, они остаются. */
  if (!прятать) {
    showGalaxyField(uniIdx);
    if (uniIdx !== 0) showHome(false);
  }
  /* Плотность пикселей в салоне ниже: кадр статичный, камера едет
     по прокрутке, и разница на глаз не видна.

     Но ровно на стыке с игрой она видна очень хорошо: плотность
     прыгала с 1.15 на 1.8 в один кадр, и картинка разом
     переоценивалась по резкости - приёмка прочитала это как подмену
     содержимого окна. Поэтому у самого пульта, когда подъезд уже
     закончился и кадр всё равно стоит, переходим на игровую
     плотность заранее. К моменту старта менять нечего. */
  if (W3.r) {
    var dpr = g.devicePixelRatio || 1;
    var step = parseInt(root.getAttribute("data-degrade") || "0", 10) || 0;
    var hint = parseInt(root.getAttribute("data-quality-hint") || "0", 10) || 0;
    /* ── Почему у телефона было мыло ──────────────────────────
       Пульт больше не отдельный слой в разметке: и рама, и клавиши,
       и приборы рисуются внутри трёхмерного кадра. Значит их
       резкость - это резкость кадра, а не холста приборов.

       Замер на телефоне 412x915 с плотностью экрана 3: холст кадра
       выходил 296x658 при потолке 1.35 и просадке стража. То есть
       весь пульт растягивался на экране вчетверо. Заказчик написал
       коротко: «кнопки мутные». Текстуры тут ни при чём - они и
       так пекутся крупно; мылил потолок плотности.

       Поднимаем телефонный потолок до двойки. Дороже это ровно во
       столько, во сколько выросла площадь холста, и платят за это
       только те устройства, которые тянут: страж плавности ниже по
       файлу снимает по 0.16 за ступень, если кадр стабильно тяжёлый,
       и доводит до 0.72. Слабым телефонам, как и раньше, достанется
       низкая плотность - но уже по факту их скорости, а не заранее
       всем подряд. Потолок tiny не трогаем: там устройство слабое по
       определению, и ему честнее единица. */
    /* Потолок разный у салона и у игры, и разница не вкусовая.

       В САЛОНЕ пульт нарисован внутри трёхмерного кадра - это
       передняя секция обшивки со снимком в развёртке. Его резкость
       и есть резкость кадра, поэтому у пульта нужен потолок 2.0:
       замер на телефоне 412x915 при потолке 1.35 давал холст
       556x1235 на экран 824x1830, то есть полуторный растяг по
       клавишам и делениям ленты.

       В ИГРЕ пульт это слой разметки поверх холста: своя плотность,
       своя резкость, кадру он ничего не должен. Холст там рисует
       только космос - планеты, звёзды, шлейф, - а по нему полтора
       против двух на глаз не читается вовсе. Значит платить в игре
       за двойку не за что: это чистый расход заливки в сцене, про
       которую заказчик и писал «очень сильно лагает».

       Отсюда три ступени: оборот в салоне 1.15 (кадр стоит, камера
       едет по прокрутке), подъезд к пульту 2.0 (панель обязана быть
       резкой к моменту передачи), игра - прежние 1.35 на телефоне и
       1.8 на мониторе. */
    var cap = on
      ? (уПульта ? 2.0 : 1.15)
      : (tiny ? 1.0 : (innerWidth < 760 ? 1.35 : 1.8));
    cap -= Math.max(step, hint > 1 ? hint - 1 : 0) * 0.16;
    /* Потолок запоминаем: выше него регулятор плавности не поднимет
       ни при какой скорости - это граница, за которой резкость уже
       ничего не добавляет, а заливка растёт. */
    W3["потолокПл"] = Math.max(0.72, Math.min(dpr, cap));
    плотность(W3["потолокПл"]);
  }
}

/* Adaptive quality changes resolution and distant effects only. */
addEventListener("rc:degrade", function () {
  if (W3) stageLite(!!F.stage);
});

function stageOff() {
  stageLite(false);
  F.stageK = 0;
  /* The last scroll segment can already have promoted the parked
     stage into an active flight. Reverse scrolling is still an exit
     command: route it through the complete flight teardown instead
     of returning early and leaving the fixed canvas above the page. */
  if (!F.stage && F.open) { close(); return; }
  if (!F.stage) {
    if (ui.wrap) ui.wrap.classList.remove("on", "rcf-stage", "rcf-native-cab", "rcf-seam");
    root.classList.remove("rc-stage", "rc-flying");
    inertPage(false);
    return;
  }
  cabinDrop();
  /* Вышли из корабля назад по странице - гул смолкает */
  if (g.RC_SOUND && g.RC_SOUND.flight && !F.open) { try { g.RC_SOUND.flight(false); } catch (e) {} }
  F.stage = false;
  F.open = false;
  модальность(false);
  if (F.raf) { cancelAnimationFrame(F.raf); F.raf = null; }
  if (ui.wrap) ui.wrap.classList.remove("on", "rcf-stage");
  /* Reverse scrolling is an unconditional return to the website.
     Clear a stray flying flag and release inert content as a safety
     net even if another frame promoted the stage to flight while the
     exit gesture was already in progress. */
  root.classList.remove("rc-stage", "rc-flying");
  inertPage(false);
}

/* Ширина пульта на экране, в долях кадра. Считаем по габаритам
   пилотской стойки: восемь углов коробки проецируем в кадр и берём
   размах по горизонтали. */
/* Кассеты панели: сколько их, какая доля кадра у каждой и попала
   ли она в кадр вообще. */
function cabinCassettes() {
  if (!W3 || !cabin || !cabin.cassettes) return null;
  var T = g.THREE, out = [];
  if (!cabinCassettes.b) { cabinCassettes.b = new T.Box3(); cabinCassettes.v = new T.Vector3(); }
  for (var i = 0; i < cabin.cassettes.length; i++) {
    var m = cabin.cassettes[i];
    try {
      var box = cabinCassettes.b.setFromObject(m);
      var v = cabinCassettes.v, lo = 1e9, hi = -1e9, loY = 1e9, hiY = -1e9, front = 0;
      for (var k = 0; k < 8; k++) {
        v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z);
        v.project(W3.cam);
        if (v.z <= 1) front++;
        if (v.x < lo) lo = v.x; if (v.x > hi) hi = v.x;
        if (v.y < loY) loY = v.y; if (v.y > hiY) hiY = v.y;
      }
      var mm = m.material;
      out.push({ имя: m.userData.id, вкадре: front > 0,
                 картаЕсть: !!(mm && mm.map),
                 картаГотова: !!(mm && mm.map && mm.map.image && mm.map.image.width),
                 размерКарты: (mm && mm.map && mm.map.image && mm.map.image.width) ? (mm.map.image.width + 'x' + mm.map.image.height) : 'нет',
                 мирY: +m.getWorldPosition(new T.Vector3()).y.toFixed(2),
                 ширина: +(((hi - lo) / 2)).toFixed(3),
                 высота: +(((hiY - loY) / 2)).toFixed(3),
                 виден: m.visible });
    } catch (e) {}
  }
  return out;
}

/* Доли кадра, занятые рамой пульта, замеренные проекцией.
   Возвращает, сколько процентов кадра съедает каждая сторона:
   договорённость с заказчиком - не более десяти-пятнадцати. */
function frameMeasure() {
  if (!W3 || !cabin || !cabin.console3 || !cabin.console3.probe) return;
  /* Замер нужен приёмке, а не игре: его читает только служебная
     выкладка состояния. В обычной сборке он молчит, иначе каждый
     кадр уходили четыре проекции, шестнадцать углов клавиш и два
     новых объекта в мусор - ради чисел, которых никто не смотрит.
     В режиме приёмки считаем четыре раза в секунду: числам этого
     хватает, а кадр остаётся чистым. */
  if (!DBG) return;
  var сейчас = (g.performance && g.performance.now) ? g.performance.now() : +new Date();
  if (frameMeasure.когда && сейчас - frameMeasure.когда < 250) return;
  frameMeasure.когда = сейчас;
  var T = g.THREE;
  if (!frameMeasure.v) frameMeasure.v = new T.Vector3();
  var C3 = cabin.console3, pr = C3.probe, v = frameMeasure.v, out = [], i;
  /* Матрицы обновляем сами: замер идёт до отрисовки кадра, и в
     полёте, где салон подвешен к камере, они ещё не пересчитаны -
     тогда все четыре точки садились в середину кадра и замер
     показывал ровные пятьдесят процентов. */
  W3.cam.updateMatrixWorld();
  W3.cam.matrixWorldInverse.copy(W3.cam.matrixWorld).invert();
  C3.inner3.updateWorldMatrix(true, false);
  for (i = 0; i < pr.length; i++) {
    v.copy(pr[i]);
    C3.inner3.localToWorld(v);
    v.project(W3.cam);
    out.push({ x: v.x, y: v.y });
  }
  /* Клавиши меряем по краям ряда: подпись обязана лежать внутри
     кадра целиком, а не упираться в нижнюю кромку. */
  var lo = 1e9, hi = -1e9, capL = 1e9, capR = -1e9;
  for (i = 0; i < C3.caps.length && i < 7; i++) {
    var cap = C3.caps[i];
    var hw = cap.userData.halfW, hh = cap.userData.halfH;
    var corners = [[-hw, -hh], [hw, hh]];
    for (var k = 0; k < 2; k++) {
      /* Крышка смотрит в лицо пилоту: её плоскость это местные x и y,
         толщина по z. Прошлая рама лежала на полке, и здесь стояло
         (x, 0, -y) - для стоячей крышки это разворачивало углы в
         толщину, и замер клавиш отдавал числа на порядки мимо. */
      v.set(corners[k][0], corners[k][1], 0);
      cap.localToWorld(v);
      v.project(W3.cam);
      if (v.y < lo) lo = v.y;
      if (v.y > hi) hi = v.y;
      if (v.x < capL) capL = v.x;
      if (v.x > capR) capR = v.x;
    }
  }
  /* Порядок точек в probe: левая, правая, верхняя, нижняя.
     Раньше здесь читали из них не те оси - у левой точки вертикаль
     около нуля, и «низ» выходил ровно пятьдесят процентов при любой
     раме. Замер обязан падать в глаза, а не выглядеть правдоподобно,
     поэтому оси теперь по именам. */
  /* Клавиш в объёмной раме может не быть вовсе: сейчас работает
     плоская ветка пульта, и C3.caps там пустой. Тогда сторожевые
     значения оставались нетронутыми и уезжали в выдачу как числа
     («клавишиНиз: 50000000050», «клавишаPx: 205714285714»), а
     «срезано» считалось из них же и всегда выходило false. Любая
     проверка, построенная на этих полях, показывала зелёный свет,
     ничего не измерив. Пусто - так и говорим. */
  var естьКлавиши = lo < 1e8;
  cabin._share = {
    лево: +((1 + out[0].x) / 2 * 100).toFixed(1),
    право: +((1 - out[1].x) / 2 * 100).toFixed(1),
    верх: +((1 - out[2].y) / 2 * 100).toFixed(1),
    низ: +((1 + out[3].y) / 2 * 100).toFixed(1),
    клавишиНиз: естьКлавиши ? +((1 + lo) / 2 * 100).toFixed(1) : null,
    клавишиВерх: естьКлавиши ? +((1 - hi) / 2 * 100).toFixed(1) : null,
    клавишаPx: естьКлавиши ? +(Math.abs(capR - capL) / 7 * innerWidth / 2).toFixed(0) : null,
    клавишВРаме: C3.caps ? C3.caps.length : 0,
    срезано: естьКлавиши ? (lo < -1 || hi > 1 || capL < -1 || capR > 1) : null
  };
}

function frameShare() {
  return (cabin && cabin._share) || null;
}

function consoleShare() {
  if (!W3 || !cabin || !cabin.pilotRig) return null;
  var T = g.THREE;
  if (!consoleShare.box) {
    consoleShare.box = new T.Box3();
    consoleShare.v = new T.Vector3();
  }
  try {
    var box = consoleShare.box.setFromObject(cabin.pilotRig);
    if (!isFinite(box.min.x) || box.isEmpty()) return null;
    var v = consoleShare.v, lo = 1e9, hi = -1e9;
    for (var i = 0; i < 8; i++) {
      v.set(i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z);
      v.project(W3.cam);
      if (v.z > 1) continue;              /* за спиной камеры */
      if (v.x < lo) lo = v.x;
      if (v.x > hi) hi = v.x;
    }
    if (hi < lo) return 0;
    return +(((hi - lo) / 2)).toFixed(3);
  } catch (e) { return null; }
}

g.RC_FLIGHT = {
  open: open, close: close, stage: stage, prebuild: prebuild,
  "этапы": function () { return ЭТАПЫ.slice(); },

  /* ── Предсборка соседних рукавов ──────────────────────────
     Планеты чужих рукавов строились лениво, прямо в прыжке: человек
     нажимал пробой и ждал, пока посчитается целый рукав. Теперь их
     строит прогрев в свободных промежутках, пока человек читает
     страницу.

     За один вызов берём РОВНО ОДИН рукав и возвращаем, остались ли
     ещё. Не все разом: рукав считается сотнями миллисекунд, а
     свободный промежуток столько не длится, и жадный проход
     превратился бы ровно в тот рывок, от которого мы уходим.

     Тела кладутся в сцену скрытыми, как и при ленивой сборке, и на
     кадр не влияют: список тел для луча собирается по видимым. */
  "прогревМиров": function () {
    if (!W3) return false;
    var есть = false, i;
    for (i = 1; i < UNIVERSES.length; i++) {
      if (built[i]) continue;
      if (!есть) {
        try { buildUniverse(i); } catch (e) { return false; }
        есть = true;
        continue;
      }
      /* Нашли ещё несобранный после того, как один собрали: значит
         прогреву есть чем заняться в следующем промежутке. */
      return true;
    }
    return false;
  },

  /* ── Тёплый кадр ──────────────────────────────────────────
     Замер после предсборки мира дал остаток: мир и рубка уже стоят,
     кнопка отвечает мгновенно, а первый нарисованный кадр всё ещё
     стоит секунды. Считает его не наш поток. Это сборка программ
     видеокарты и заливка карт в видеопамять, и случается она ровно
     в первый вызов отрисовки. Значит первый вызов надо сделать
     заранее.

     Делаем два хода, они закрывают разное:
     · compile проходит по всей сцене, включая скрытые тела чужих
       рукавов, до которых отрисовка не дойдёт;
     · один настоящий кадр тем же путём, каким рисует игра, заводит
       буферы плёнки, которых compile не касается.

     Размер ставим тот же, что возьмёт настоящий кадр: иначе первый
     вход заново заведёт буферы под другое разрешение, и вся
     экономия пропадёт. */
  "прогревКадра": function () {
    if (!W3 || F.open || W3["_тёплый"]) return false;
    try {
      W3.r.setSize(innerWidth, innerHeight, false);
      if (W3.post) { try { W3.post.setSize(innerWidth, innerHeight); } catch (eР) {} }
      if (W3.r.compile) { try { W3.r.compile(W3.scene, W3.cam); } catch (eК) {} }
      if (W3.post) W3.post.render(W3.scene, W3.cam, 0);
      else W3.r.render(W3.scene, W3.cam);
      W3["_тёплый"] = true;
    } catch (e) { return false; }
    return true;
  },
  /* Раньше здесь стоял второй ключ state. В объекте побеждает
     последний, поэтому этот молчал, и приёмка читала не то, что
     думала. Сведено в один ниже. */
  /* Служебные ходы приёмки: поставить корабль в любую точку маршрута
     и вызвать финал, не проходя игру целиком. Стоят за признаком в
     адресе (?rcdbg=1) - в обычной сборке молчат. */
  _pilot: function () {
    if (!DBG) return;
    pilotShown = false;
    var t = NET_TOTAL; NET_TOTAL = function () { return netCount(); };
    pilotCard(); NET_TOTAL = t;
  },
  _set: function (v) {
    if (!DBG) return;
    F.p = Math.max(0, Math.min(1, v)); F.goal = null; F.orbit = null;
  },
  /* Камера сцены наружу: приёмка проецирует ею кромки рамы и
     проверяет, что рама вообще попала в кадр. Стоит за признаком в
     адресе, как и остальные служебные ходы. */
  _cam: function () { return DBG && W3 ? W3.cam : null; },
  /* Постобработка наружу для приёмки: свечение это несколько
     проходов размытия по всему кадру, и его цену надо знать
     числом, а не на глаз. */
  /* Шаг развёртки руками: ход регулятора ВВЕРХ иначе не проверить.
     Он поднимает плотность, когда кадры приходят ровно по развёртке,
     а в облаке программный растеризатор не доходит до неё никогда -
     ветка осталась бы непройденной. Подменяем оценку шага и смотрим,
     что регулятор поднимается и останавливается о потолок. */
  _шаг: function (мс) {
    if (!DBG) return null;
    if (мс) frame._шаг = мс / 1000;
    return { шаг: frame._шаг ? +(frame._шаг * 1000).toFixed(1) : null };
  },
  _пост: function (вкл) {
    if (!DBG || !W3) return null;
    if (вкл === false) { W3._постСпрятан = W3.post; W3.post = null; }
    else if (вкл === true && W3._постСпрятан) { W3.post = W3._постСпрятан; W3._постСпрятан = null; }
    return { есть: !!W3.post };
  },
  /* Что лежит в сцене верхним уровнем и сколько это стоит.
     Без имён и без поштучного гашения вопрос «что именно лагает»
     решается перебором правок вслепую: меняешь код, меряешь, и не
     знаешь, на ту ли подсистему смотрел. Здесь узел гасится на
     месте, кадр меряется до и после, и цена подсистемы становится
     числом. Стоит за признаком rcdbg, в обычной сборке молчит. */
  _узлы: function (индекс, видно, под) {
    if (!DBG || !W3 || !W3.scene) return null;
    var деть = W3.scene.children, из = [], i;
    if (индекс != null) {
      var о = деть[индекс];
      if (!о) return null;
      /* Второй уровень: у Земли три слоя в одном узле, и цена у них
         разная. Без поштучного гашения «сорок два процента кадра»
         остаётся числом без адреса. */
      if (под != null) {
        var сп = [];
        о.traverse(function (x) { if (x.isMesh || x.isPoints || x.isLine) сп.push(x); });
        if (!сп[под]) return null;
        сп[под].visible = !!видно;
        return { индекс: индекс, под: под, видно: сп[под].visible,
                 гео: сп[под].geometry ? сп[под].geometry.type : "?",
                 мат: сп[под].material ? сп[под].material.type : "?" };
      }
      о.visible = !!видно;
      return { индекс: индекс, видно: о.visible };
    }
    for (i = 0; i < деть.length; i++) {
      var о2 = деть[i], мешей = 0, треуг = 0;
      о2.traverse(function (x) {
        if (!x.isMesh && !x.isPoints && !x.isLine) return;
        mешСчёт();
        function mешСчёт() {
          мешей++;
          var g2 = x.geometry;
          if (!g2) return;
          if (g2.index) треуг += g2.index.count / 3;
          else if (g2.attributes && g2.attributes.position)
            треуг += g2.attributes.position.count / 3;
        }
      });
      var дети = [];
      о2.traverse(function (x) {
        if (!x.isMesh && !x.isPoints && !x.isLine) return;
        if (дети.length > 6) return;
        var м = x.material;
        дети.push((x.geometry ? x.geometry.type : "?") + "/" +
                  (м ? (м.type + (м.transparent ? "+прозр" : "") +
                        (м.map ? "+карта" : "")) : "?") +
                  "/" + Math.round(x.scale.x * 100) / 100);
      });
      из.push({ i: i, тип: о2.type, имя: о2.name || "",
                видно: о2.visible, мешей: мешей, треуг: Math.round(треуг),
                дети: дети });
    }
    return из;
  },
  /* Плотность кадра наружу. В облаке рисует программный растеризатор,
     он на порядок медленнее живой видеокарты, и страж плавности
     роняет плотность до пола за первые же секунды. Проверить на нём
     резкость пульта нельзя - меряешь не сборку, а контейнер. Через
     эту точку приёмка ставит плотность руками и снимает кадр таким,
     каким его увидит телефон. */
  _плотность: function (v) {
    if (!DBG || !W3 || !W3.r) return null;
    if (v) плотность(v);
    var о = frame._окно || [];
    var с = о.slice().sort(function (a, b) { return a - b; });
    return { холст: [ui.cv.width, ui.cv.height], экран: [innerWidth, innerHeight],
             плотность: W3.r.getPixelRatio(), экранная: g.devicePixelRatio || 1,
             потолок: W3["потолокПл"] || null,
             медиана: с.length ? +(с[с.length >> 1] * 1000).toFixed(1) : null,
             шагРазвёртки: frame._шаг ? +(frame._шаг * 1000).toFixed(1) : null,
             ступеней: frame._deg || 0 };
  },
  /* Состояние салона: где он, что в нём видно и в кадре ли рама.
     Жалоба «куда снова панель управления пропала» проверяется
     только числами - на глаз в тёмном кадре не отличить. */
  /* Экранные коробки мешей салона. Нужны, чтобы искать в кадре
     конкретную деталь - например пустые гнёзда пульта, - не гадая
     по мировым координатам. Обход от камеры не работает: камера
     обычно не в графе сцены, и traverse от неё находит ноль мешей
     (проверено). Идём от самого салона. Живёт под ?rcdbg=1. */
  _меши: function (снизу) {
    if (!DBG || !cabin || !cabin.group || !W3) return null;
    var T = g.THREE, из = [], край = (снизу == null ? 0 : снизу) * innerHeight;
    var б = new T.Box3(), в = new T.Vector3();
    /* Идём от КОРНЯ сцены, а не от салона: пульт строит не rc-cabin,
       и обход по cabin.group его не находит (проверено - там только
       стены и цилиндры комнаты). От камеры идти тоже нельзя, она
       обычно вне графа. Салон в графе есть всегда, от него и
       поднимаемся до самого верха. */
    var корень = cabin.group;
    while (корень.parent) корень = корень.parent;
    корень.traverse(function (o) {
      if (!o.isMesh || !видимоЛи(o)) return;
      б.setFromObject(o);
      if (!isFinite(б.min.x)) return;
      var л = 1e9, п = -1e9, вв = 1e9, н = -1e9, сзади = 0;
      for (var i = 0; i < 8; i++) {
        в.set(i & 1 ? б.max.x : б.min.x, i & 2 ? б.max.y : б.min.y, i & 4 ? б.max.z : б.min.z);
        в.project(W3.cam);
        if (в.z > 1) { сзади++; continue; }
        var x = (в.x * 0.5 + 0.5) * innerWidth, y = (-в.y * 0.5 + 0.5) * innerHeight;
        л = Math.min(л, x); п = Math.max(п, x); вв = Math.min(вв, y); н = Math.max(н, y);
      }
      if (сзади === 8 || н < край) return;
      из.push({ имя: o.name || "", гео: o.geometry ? o.geometry.type : "",
                л: Math.round(л), п: Math.round(п), в: Math.round(вв), н: Math.round(н),
                мир: [+б.min.y.toFixed(2), +б.max.y.toFixed(2), +б.min.z.toFixed(2), +б.max.z.toFixed(2)] });
    });
    из.sort(function (a, c) { return (c.п - c.л) * (c.н - c.в) - (a.п - a.л) * (a.н - a.в); });
    return { всего: из.length, детали: из.slice(0, 20) };
  },
  _cabin: function () {
    if (!DBG || !cabin || !W3) return null;
    var видимых = 0, всего = 0, части = [];
    cabin.group.traverse(function (o) {
      if (!o.isMesh && !o.isPoints && !o.isLine) return;
      всего++;
      if (видимоЛи(o)) видимых++;
      if (части.length < 14) части.push([o.name || o.type, видимоЛи(o)]);
    });
    var T = g.THREE, v = new T.Vector3();
    var рама = null;
    if (cabin.frame) {
      cabin.frame.updateWorldMatrix(true, false);
      v.setFromMatrixPosition(cabin.frame.matrixWorld);
      рама = { видно: видимоЛи(cabin.frame),
               прозрачность: +(cabin.frame.material.opacity || 0).toFixed(2),
               д: Math.round(W3.cam.position.distanceTo(v)) };
    }
    return {
      секция: cabin.секция || null,
      /* Куда камера кладёт верх и низ кадра, посчитанные по стене:
         если проекция верна, это ровно кромки экрана */
      кромки: (function () {
        var с = cabin.секция;
        if (!с) return null;
        var из = [], т = new T.Vector3(), зн = [1, -1], i;
        for (i = 0; i < 2; i++) {
          т.set(0, (g.RC_PANEL ? g.RC_PANEL.EYE : 1.62) + зн[i] * с.H / 2, -cabin.R);
          cabin.group.localToWorld(т);
          т.project(W3.cam);
          из.push(Math.round((-т.y * 0.5 + 0.5) * innerHeight));
        }
        return { верхЭкран: из[0], низЭкран: из[1], высотаКадра: innerHeight };
      })(),
      п0: cabin.p0 ? [+cabin.p0.x.toFixed(3), +cabin.p0.y.toFixed(3), +cabin.p0.z.toFixed(3)] : null,
      камера: [+W3.cam.position.x.toFixed(3), +W3.cam.position.y.toFixed(3), +W3.cam.position.z.toFixed(3)],
      глаз: cabin.eye, центрY: cabin.center ? +cabin.center.y.toFixed(3) : null,
      дистПан: +панельD(innerWidth, innerHeight, W3.fov0 || 72).toFixed(3),
      фов0: W3.fov0,
      вСцене: !!(cabin.group.parent),
      родитель: cabin.group.parent ? (cabin.group.parent === W3.cam ? "камера" : "сцена") : "нет",
      мешей: всего, видимых: видимых, скрыто: cabin.скрыто ? cabin.скрыто.length : 0,
      полётСкрыл: cabin["полётСкрыл"] ? cabin["полётСкрыл"].length : -1,
      летим: root.classList.contains("rc-flying"),
      центрД: Math.round(W3.cam.position.distanceTo(cabin.center || new T.Vector3())),
      R: cabin.R, рама: рама, части: части,
      былПультПриСборке: cabinBuild.былПульт, собранНа: cabinBuild.когда,
      /* Где на экране стоит игровая консоль: заказчик требует видеть
         её ЕЩЁ ДО входа в полёт, и на том же месте */
      пульт3: (function () {
        if (!cabin.console3 || !cabin.console3.group) return null;
        var б = new T.Box3().setFromObject(cabin.console3.group);
        if (!isFinite(б.min.x)) return null;
        var уг = [], v2 = new T.Vector3();
        for (var i = 0; i < 8; i++) {
          v2.set(i & 1 ? б.max.x : б.min.x, i & 2 ? б.max.y : б.min.y, i & 4 ? б.max.z : б.min.z);
          v2.project(W3.cam);
          уг.push([(v2.x * 0.5 + 0.5) * innerWidth, (-v2.y * 0.5 + 0.5) * innerHeight, v2.z]);
        }
        var л = 1e9, п = -1e9, в = 1e9, н = -1e9, сзади = 0;
        for (var j = 0; j < 8; j++) {
          if (уг[j][2] > 1) { сзади++; continue; }
          л = Math.min(л, уг[j][0]); п = Math.max(п, уг[j][0]);
          в = Math.min(в, уг[j][1]); н = Math.max(н, уг[j][1]);
        }
        if (сзади === 8) return { сзади: true };
        return { л: Math.round(л), п: Math.round(п), в: Math.round(в), н: Math.round(н),
                 доляШирины: +((п - л) / innerWidth).toFixed(3),
                 видимГруппа: видимоЛи(cabin.console3.group) };
      })()
    };
  },
  /* Что вернёт луч из данной точки экрана. Приёмке нужно отличать
     «луч не попал» от «попал, но досье не открылось». */
  _ray: function (px, py) {
    if (!DBG || !W3) return null;
    var T = g.THREE;
    var r = new T.Raycaster();
    r.setFromCamera({ x: (px / innerWidth) * 2 - 1, y: -(py / innerHeight) * 2 + 1 }, W3.cam);
    var h = r.intersectObjects(W3.pickables || [], false);
    var из = [];
    for (var i = 0; i < h.length && i < 6; i++) {
      из.push({ инфо: (h[i].object.userData && h[i].object.userData.info) || "",
                видно: видимоЛи(h[i].object), д: Math.round(h[i].distance) });
    }
    return { попаданий: h.length, первые: из };
  },
  /* Что вообще можно ткнуть в этом кадре: имя, экранные точки,
     видимость по всей ветке и масштаб. Без этих чисел жалобу «клики
     не работают на планетах» приходится проверять мышью вслепую. */
  _pick: function () {
    if (!DBG || !W3) return null;
    var T = g.THREE, v = new T.Vector3(), из = [];
    var сп = W3.pickables || [];
    for (var i = 0; i < сп.length; i++) {
      var o = сп[i];
      if (!o) continue;
      o.updateWorldMatrix(true, false);
      v.setFromMatrixPosition(o.matrixWorld);
      var d = W3.cam.position.distanceTo(v);
      v.project(W3.cam);
      var м = new T.Vector3();
      o.matrixWorld.decompose(new T.Vector3(), new T.Quaternion(), м);
      из.push({
        имя: (o.userData && o.userData.info ? String(o.userData.info).split(" · ")[0] : (o.name || "?")),
        видно: видимоЛи(o),
        масштаб: +м.x.toFixed(3),
        д: Math.round(d),
        сзади: v.z > 1,
        x: Math.round((v.x * 0.5 + 0.5) * innerWidth),
        y: Math.round((-v.y * 0.5 + 0.5) * innerHeight)
      });
    }
    return { всего: сп.length, вселенная: uniIdx, тела: из };
  },
  /* Прыжок в другой рукав по вызову: без него приёмка не могла снять
     переход покадрово - до кнопки прыжка надо пройти половину игры. */
  _jump: function (n) { if (DBG) jumpUniverse(n); },
  /* Открыть досье тела по имени: клик по самому телу в приёмке
     ненадёжен - на дистанции планета занимает несколько точек, и
     попасть по ней мышью из скрипта не выходит. */
  _dos: function (имя) {
    if (!DBG) return null;
    var ц = String(имя || "").toUpperCase();
    for (var id in holoIds) {
      if (!holoIds.hasOwnProperty(id)) continue;
      var r = holoIds[id];
      if (!r || !r.o) continue;
      if (String(r.title || "").toUpperCase().indexOf(ц) !== 0) continue;
      var об = r.o.userData && r.o.userData.info ? r.o : (r.o.children && r.o.children[0]) || r.o;
      dosOpen(об, (об.userData && об.userData.info) || r.title);
      return r.title;
    }
    return null;
  },
  _dbg: function () {
    if (!W3) return null;
    var d = new g.THREE.Vector3(); W3.cam.getWorldDirection(d);
    var e = new g.THREE.Vector3(0, 0, 0).sub(W3.cam.position).normalize();
    return { pos: W3.cam.position.toArray().map(Math.round),
             dir: d.toArray().map(function(v){return +v.toFixed(2)}),
             toEarth: e.toArray().map(function(v){return +v.toFixed(2)}),
             угол: +(Math.acos(Math.max(-1,Math.min(1,d.dot(e)))) * 57.3).toFixed(1) };
  },
  state: function () {
    return { открыт: F.open, собран: F.built, p: +F.p.toFixed(3), v: +F.v.toFixed(5),
             вселенная: uniIdx, цель: F.goalId || F.goalName || null,
             сцена: !!F.stage, подъезд: +(F.stageK || 0).toFixed(2), салон: !!cabin,
             /* Доля ширины кадра, которую занимает пульт. Заказчик
                потребовал одну и ту же панель на сайте и в игре,
                поэтому величина стала предметом приёмки: если в
                салоне она заметно меньше, чем в полёте, человек
                видит подмену, даже когда геометрия честно одна. */
             пультДоля: consoleShare(),
             /* Доли кадра, которые рама реально занимает на экране.
                Меряем проекцией живой камерой, а не расчётом при
                сборке: между ними стоят наклон взгляда, поле
                зрения и подъезд, и разошлись они уже дважды. */
             рама: frameShare(),
             /* Приёмка кассет: сколько собралось и видно ли их в
                кадре. Пульт заказчик забраковал дважды, поэтому
                величина измеряется, а не оценивается на глаз. */
             кассеты: cabinCassettes(),
             /* Геометрия кадра пульта: без этих чисел нельзя понять,
                почему панель видна ребром - камера ниже неё или
                наклон мал. */
             ракурс: (function () {
               if (!W3 || !cabin || !cabin.pilotRig) return null;
               var T2 = g.THREE, wp = new T2.Vector3();
               cabin.pilotRig.getWorldPosition(wp);
               var dy = W3.cam.position.y - wp.y;
               var dz = Math.abs(W3.cam.position.z - wp.z);
               return { камераY: +W3.cam.position.y.toFixed(2), пультY: +wp.y.toFixed(2),
                        превышение: +dy.toFixed(2), удаление: +dz.toFixed(2),
                        уголСверху: +(Math.atan2(dy, dz) * 57.3).toFixed(1),
                        наклонПульта: +(-cabin.pilotRig.rotation.x * 57.3).toFixed(1) };
             })(),
             отметки: W3 && W3.at ? W3.at : null };
  },
  /* Что осталось в памяти между заходами. Проверке нужно видеть это
     числами: раз за разом ломалось именно состояние, пережившее
     пересборку мира. */
  "кэши": function () {
    return {
      обзорЗалип: !!drag,
      свободныйОбзор: !!F.free,
      вселенныхВкэше: Object.keys(built).length,
      маяковСети: netNodes.length,
      телДляЛуча: W3 && W3.pickables ? W3.pickables.length : 0,
      меток: doc.querySelectorAll(".rch-tag").length,
      подписанНаМетки: !!holoSetup["подписан"],
      салон: !!cabin
    };
  },
  /* Отладочные рычаги для автопроверок: поставить корабль в нужную
     точку маршрута и прыгнуть в заданную вселенную. Через обычный
     интерфейс на это уходят десятки секунд полёта, а снимать кадры
     надо в конкретных местах. */
  seek: function (p) {
    if (!F.open) return null;
    F.goal = null; F.orbit = null; F.away = false; F.auto = false;
    F.p = Math.max(0, Math.min(1, p));
    F.v = 0;
    return F.p;
  },
  _go: function (id) {
    if (!DBG || !F.open) return null;
    goTo(id);
    return { id: F.goalId, p: F.goal, name: F.goalName };
  },
  /* Project the real WebGL keycaps into screen space and compare them
     with their accessible DOM hit targets. Debug builds use this to
     keep the physical console and touch geometry in one coordinate
     system on every viewport; the public URL exposes nothing. */
  _controls: function () {
    if (!DBG || !W3 || !cabin || !cabin.controlCaps) return null;
    W3.cam.updateMatrixWorld(true);
    var nodes = physicalControlsFrame.nodes || [], out = [];
    var p = new g.THREE.Vector3(), left = new g.THREE.Vector3(), right = new g.THREE.Vector3();
    for (var i = 0; i < cabin.controlCaps.length; i++) {
      var cap = cabin.controlCaps[i], el = nodes[i], rect = el ? el.getBoundingClientRect() : null;
      cap.updateWorldMatrix(true, false);
      cap.getWorldPosition(p); p.project(W3.cam);
      var halfW = cap.userData.halfW || 0.1625;
      left.set(-halfW, 0, 0); cap.localToWorld(left); left.project(W3.cam);
      right.set(halfW, 0, 0); cap.localToWorld(right); right.project(W3.cam);
      var x = (p.x * 0.5 + 0.5) * innerWidth;
      var y = (-p.y * 0.5 + 0.5) * innerHeight;
      var w = Math.abs(right.x - left.x) * innerWidth * 0.5;
      var hx = rect ? rect.left + rect.width * 0.5 : null;
      var hy = rect ? rect.top + rect.height * 0.5 : null;
      out.push({
        i: i, cap: [Math.round(x), Math.round(y), Math.round(w)],
        hit: rect ? [Math.round(hx), Math.round(hy), Math.round(rect.width), Math.round(rect.height)] : null,
        delta: rect ? [Math.round(hx - x), Math.round(hy - y)] : null
      });
    }
    return out;
  },
  _interaction: function () {
    if (!DBG) return null;
    return {
      scan: !!F.scan, auto: !!F.auto,
      zoom: +(F.zoom || 0).toFixed(3), thrust: +(F.thr || 0).toFixed(3),
      menu: !!(ui.menu && ui.menu.classList.contains("on")),
      map: !!(ui.netList && ui.netList.classList.contains("on")),
      help: !!(ui.help && ui.help.classList.contains("on")),
      caption: ui.cap ? ui.cap.textContent : ""
    };
  },
  jump: function (i) { jumpUniverse(i); return uniIdx; },
  /* Сколько всего рисуется: вершины, точки, вызовы отрисовки.
     Нужно, чтобы новые эффекты не пролезли мимо бюджета. */
  stats: function () {
    if (!W3) return null;
    var info = W3.r.info;
    var pts = 0, obj = 0;
    W3.scene.traverse(function (o) {
      obj++;
      if (o.isPoints && o.geometry && o.geometry.attributes.position) {
        pts += o.geometry.attributes.position.count;
      }
    });
    return { треугольники: info.render.triangles, вызовы: info.render.calls,
             точки: pts, объектов: obj, текстур: info.memory.textures,
             геометрий: info.memory.geometries };
  },
  /* Проверки столкновений: прогоняем весь маршрут и смотрим, не
     задевает ли он тела. Пригодилось при настройке манёвра обхода
     и остаётся как быстрый способ проверить правку дуги. */
  probe: function (steps) {
    if (!W3) return null;
    var n = steps || 400, out = [], bs = W3.bodies || [];
    var v = new g.THREE.Vector3();
    for (var i = 0; i <= n; i++) {
      W3.path.getPointAt(i / n, v);
      for (var j = 0; j < bs.length; j++) {
        var d = v.distanceTo(bs[j].o.position);
        var lim = bs[j].r * 1.5 + 26;
        if (d < lim) out.push({ тело: bs[j].name, p: +(i / n).toFixed(3),
                                дистанция: Math.round(d), предел: Math.round(lim) });
      }
    }
    return { заходов_в_зону: out.length, точки: out.slice(0, 12) };
  },
  cam: function () {
    if (!W3) return null;
    var bs = W3.bodies || [], near = [];
    for (var j = 0; j < bs.length; j++) {
      near.push({ тело: bs[j].name, d: Math.round(W3.cam.position.distanceTo(bs[j].o.position)),
                  корпус: bs[j].r });
    }
    return { позиция: W3.cam.position.toArray().map(Math.round), тела: near,
             увод: dodge ? +dodge.length().toFixed(1) : 0 };
  }
};

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", launchers);
else launchers();

})(window);
