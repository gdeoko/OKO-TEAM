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
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var RU = doc.documentElement.lang !== "en";

/* Язык игры раньше решался один раз, при загрузке файла: человек
   переключал сайт на английский, а кабина, названия целей и
   подсказки оставались русскими до перезагрузки. Теперь на смену
   языка мы пересобираем оверлей - при закрытой игре это незаметно,
   а в полёте ждём выхода, чтобы не рвать кадр. */
var langDirty = false;

function relang() {
  RU = doc.documentElement.lang !== "en";
  if (F.open) { langDirty = true; return; }
  langDirty = false;
  if (!ui.wrap) return;

  /* Мир нарисован в холст внутри оверлея: снося оверлей, обязаны
     забыть и мир, иначе следующий заход будет рисовать в холст,
     которого больше нет, - чёрный кадр без единой ошибки. */
  if (F.built) {
    F.built = false;
    if (W3 && W3.r) {
      try { W3.r.dispose(); } catch (e) {}
      try {
        var lose = W3.r.getContext().getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
      } catch (e2) {}
    }
    W3 = null;
    if (F.glSlot && g.RC_GL) { F.glSlot = false; g.RC_GL.give(); }
  }
  if (ui.wrap.parentNode) ui.wrap.parentNode.removeChild(ui.wrap);
  ui = {};
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
  { p: 0.00, t: RU ? "ЗЕМЛЯ · 218 точек присутствия Rocket CDN" : "EARTH · 218 Rocket CDN points of presence" },
  { p: 0.15, t: RU ? "ЛУНА · 384 000 км · пинг 2,6 с" : "MOON · 384,000 km · ping 2.6 s" },
  { p: 0.27, t: RU ? "РАЗГОН · контент идёт с ближайшего узла" : "ACCELERATION · content ships from the nearest node" },
  { p: 0.36, t: RU ? "МАРС · 225 млн км · без кеша сюда" : "MARS · 225M km · no cache out here" },
  { p: 0.50, t: RU ? "САТУРН · 1,4 млрд км от ваших пользователей" : "SATURN · 1.4B km from your users" },
  { p: 0.63, t: RU ? "ЧЁРНАЯ ДЫРА · так выглядит сайт без CDN" : "BLACK HOLE · a site with no CDN looks like this" },
  { p: 0.76, t: RU ? "ГИПЕРПРЫЖОК · Rocket доставляет быстрее" : "HYPERJUMP · Rocket delivers faster" },
  { p: 0.90, t: RU ? "ДОМА · заявка - и ваш контент на сверхскорости" : "HOME · one request away from lightspeed content" }
];

var F = {
  open: false, built: false,
  p: 0, v: 0, look: { x: 0, y: 0, tx: 0, ty: 0 },
  last: 0, raf: null, shake: 0,
  auto: true, goal: null,
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
var LOG_KEY = "rcdn.explored";
var explored = {};
try { explored = JSON.parse(localStorage.getItem(LOG_KEY) || "{}") || {}; } catch (e) { explored = {}; }
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
  var n = 11;                       /* тела и объекты родной системы */
  for (var u = 1; u < UNIVERSES.length; u++) {
    for (var s = 0; s < UNIVERSES[u].sys.length; s++) n += UNIVERSES[u].sys[s].planets.length;
  }
  return n;
}

/* Сколько всего мест, где можно развернуть узел. Считаем ровно те,
   на орбите которых включается кнопка: пять тел родного маршрута,
   звёздные системы чужих вселенных и их планеты. Раньше знаменатель
   у «Сети» брался от «Исследовано» - множества разные, и счётчик мог
   уйти за свой же предел, а «сеть развёрнута полностью» достигалась
   только через это переполнение. */
function NET_TOTAL() {
  var n = 5;                        /* Земля, Луна, Марс, Сатурн, дыра */
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
  ui.prog.textContent = (RU ? "Исследовано " : "Explored ") + Math.min(got, total) + "/" + total;
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
var UNIVERSES = [
  { name: RU ? "СОЛНЕЧНАЯ СИСТЕМА" : "SOLAR SYSTEM", tag: "SOL",
    sky: 0x9db4cc, amb: 0x3a4a68, neb: [0x42b2dc, 0x8a59f6], sun: 0xfff2dc,
    stars: [0xcfe9f5, 0x8fb7ff, 0xffe9c9],
    about: RU ? "родная система, весь маршрут" : "home system, the full route",
    sys: [] },

  { name: RU ? "ВСЕЛЕННАЯ RV-2" : "UNIVERSE RV-2", tag: "RV-2",
    sky: 0xa08cd8, amb: 0x4a3468, neb: [0x8a59f6, 0xd06bff], sun: 0xe8d4ff,
    stars: [0xe2d4ff, 0xb08cff, 0xffc9ec],
    about: RU ? "фиолетовый рукав, три обитаемые системы" : "violet arm, three systems",
    sys: [
      { id: "vega", name: RU ? "ВЕГА-RV" : "VEGA-RV", star: 0xd6c4ff, seed: 1741,
        at: [520, 120, -420],
        planets: [
          { kind: "terran", r: 54, dist: 210, tint: 0x7fb8e8, clouds: true,
            name: RU ? "АУРА" : "AURA", info: RU ? "океан и один материк, узел сети" : "ocean world, network node" },
          { kind: "gas", r: 86, dist: 420, rings: true, tint: 0xb79bff,
            name: RU ? "ЛИЛОВЫЙ ГИГАНТ" : "VIOLET GIANT", info: RU ? "кольца из льда, 62 спутника" : "ice rings, 62 moons" },
          { kind: "ice", r: 38, dist: 620, tint: 0xcfe4ff,
            name: RU ? "СТУЖА" : "FROST", info: RU ? "минус 214, подлёдный океан" : "-214C, subglacial ocean" }
        ] },
      { id: "orion", name: RU ? "ОРИОН-RV" : "ORION-RV", star: 0xffd9f2, seed: 9032,
        at: [-620, -80, -980],
        planets: [
          { kind: "toxic", r: 46, dist: 190, tint: 0xd8ff8f,
            name: RU ? "ЯД" : "TOXIN", info: RU ? "плотная атмосфера, кислотные дожди" : "dense acid atmosphere" },
          { kind: "rocky", r: 32, dist: 330, tint: 0x9c9186,
            name: RU ? "ОСКОЛОК" : "SHARD", info: RU ? "разбита древним ударом" : "shattered by an ancient impact" },
          { kind: "ocean", r: 58, dist: 520, tint: 0x4fa8d8,
            name: RU ? "ГЛУБИНА" : "DEEP", info: RU ? "сплошной океан, глубина 90 км" : "all ocean, 90 km deep" }
        ] },
      { id: "lyra", name: RU ? "ЛИРА-RV" : "LYRA-RV", star: 0xffe8c9, seed: 4488,
        at: [180, 260, -1520],
        planets: [
          { kind: "desert", r: 44, dist: 200, tint: 0xe0b978,
            name: RU ? "ПЕСКИ" : "SANDS", info: RU ? "бури на полгода" : "storms last half a year" },
          { kind: "terran", r: 50, dist: 380, tint: 0x8fd8a0, clouds: true,
            name: RU ? "ЗЕЛЁНАЯ" : "GREEN", info: RU ? "леса на весь материк" : "forest continent" }
        ] }
    ] },

  { name: RU ? "ВСЕЛЕННАЯ RC-3" : "UNIVERSE RC-3", tag: "RC-3",
    sky: 0xd8b48c, amb: 0x684a34, neb: [0xffb066, 0xff7a4d], sun: 0xffe0b0,
    stars: [0xffe9cf, 0xffc98f, 0xc9e2ff],
    about: RU ? "янтарный рукав, горячие миры" : "amber arm, hot worlds",
    sys: [
      { id: "forge", name: RU ? "ГОРН-RC" : "FORGE-RC", star: 0xffb066, seed: 7711,
        at: [480, -160, -520],
        planets: [
          { kind: "lava", r: 48, dist: 180, tint: 0xff6a2a,
            name: RU ? "КУЗНЯ" : "FORGE", info: RU ? "кора не остывает, разломы светятся" : "crust never cools" },
          { kind: "rocky", r: 36, dist: 320, tint: 0xb08060,
            name: RU ? "ШЛАК" : "SLAG", info: RU ? "выжжена звездой дотла" : "burnt bare by its star" },
          { kind: "gas", r: 92, dist: 560, tint: 0xffc98f, rings: true,
            name: RU ? "ЯНТАРЬ" : "AMBER", info: RU ? "шторм шириной в три Земли" : "storm three Earths wide" }
        ] },
      { id: "ember", name: RU ? "УГОЛЬ-RC" : "EMBER-RC", star: 0xff8f5a, seed: 2205,
        at: [-540, 140, -1120],
        planets: [
          { kind: "desert", r: 52, dist: 220, tint: 0xd98f5a,
            name: RU ? "ЖАРА" : "SCORCH", info: RU ? "день длиной в 40 суток" : "a 40-day long day" },
          { kind: "ice", r: 40, dist: 430, tint: 0xa8d8ff,
            name: RU ? "ТЕНЬ" : "SHADE", info: RU ? "вечная ночная сторона" : "the eternal night side" }
        ] },
      { id: "core", name: RU ? "ЯДРО-RC" : "CORE-RC", star: 0xfff0d0, seed: 6613,
        at: [260, -280, -1680],
        planets: [
          { kind: "terran", r: 56, dist: 240, tint: 0xd8a86a, clouds: true,
            name: RU ? "ОХРА" : "OCHRE", info: RU ? "красные степи, дата-центр на полюсе" : "red steppes, polar datacenter" },
          { kind: "gas", r: 78, dist: 460, tint: 0xff9a5a,
            name: RU ? "ПЛАМЯ" : "FLAME", info: RU ? "полосы кипят на глазах" : "bands boil visibly" },
          { kind: "lava", r: 42, dist: 640, tint: 0xff4a2a,
            name: RU ? "ГОРНИЛО" : "CRUCIBLE", info: RU ? "приливной разогрев от соседа" : "tidal heating from its neighbour" }
        ] }
    ] },

  /* Четвёртая вселенная закрыта, пока сеть не дотянется до шести
     миров. Это и есть цель игры: не «полетать», а довести сеть
     дальше, чем она доставала до вас. Награда честная - за ней
     новый рукав с мирами, которых больше нигде нет. */
  { name: RU ? "ВСЕЛЕННАЯ RX-4" : "UNIVERSE RX-4", tag: "RX-4",
    sky: 0x8cd8c0, amb: 0x2a5a4c, neb: [0x35e08f, 0x42b2dc], sun: 0xd8fff0,
    stars: [0xd6fff0, 0x8ff0c9, 0xc9e2ff],
    about: RU ? "изумрудный рукав, открыт за шесть узлов сети" : "emerald arm, unlocked by six nodes",
    need: 6,
    sys: [
      { id: "verd", name: RU ? "ВЕРДА-RX" : "VERDA-RX", star: 0x9ff0c9, seed: 3312,
        at: [420, 180, -560],
        planets: [
          { kind: "ocean", r: 62, dist: 230, tint: 0x35c8a0,
            name: RU ? "ИЗУМРУД" : "EMERALD", info: RU ? "цветущий океан, вода светится ночью" : "blooming ocean, glowing at night" },
          { kind: "terran", r: 52, dist: 400, tint: 0x7fd8a8, clouds: true,
            name: RU ? "ПОЛЯНА" : "GLADE", info: RU ? "материк-сад, узел стоит на орбите" : "garden continent, orbital node" },
          { kind: "ice", r: 44, dist: 610, tint: 0xbff0ff,
            name: RU ? "ЗЕРКАЛО" : "MIRROR", info: RU ? "ледяная кора отражает свою звезду" : "ice crust mirrors its star" }
        ] },
      { id: "helix", name: RU ? "СПИРАЛЬ-RX" : "HELIX-RX", star: 0xd8fff0, seed: 8844,
        at: [-480, -120, -1260],
        planets: [
          { kind: "gas", r: 96, dist: 300, tint: 0x6fe0c0, rings: true,
            name: RU ? "ВИХРЬ" : "VORTEX", info: RU ? "кольца из живого льда" : "rings of living ice" },
          { kind: "rocky", r: 34, dist: 520, tint: 0x8fa89c,
            name: RU ? "ЯКОРЬ" : "ANCHOR", info: RU ? "первый узел за пределами трёх рукавов" : "first node beyond three arms" }
        ] }
    ] }
];
var uniIdx = 0;

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
    if (on) { el.setAttribute("inert", ""); el.setAttribute("aria-hidden", "true"); }
    else { el.removeAttribute("inert"); el.removeAttribute("aria-hidden"); }
  }
}

function buildUI() {
  if (ui.wrap) return;
  var w = doc.createElement("div");
  w.className = "rc-flight";
  /* Полёт занимает весь экран, значит это диалог: без роли чтение с
     экрана считает его обычным куском страницы и продолжает водить
     фокус по разделам сайта под ним */
  w.setAttribute("role", "dialog");
  w.setAttribute("aria-modal", "true");
  w.setAttribute("aria-label", RU ? "Полёт по сети Rocket CDN" : "Rocket CDN network flight");
  /* Цели навигации: по ним корабль умеет долетать сам. Отметки p
     подставляются после сборки мира из честных позиций на дуге. */
  var NAV = [
    { id: "earth", t: RU ? "Земля" : "Earth" },
    { id: "moon", t: RU ? "Луна" : "Moon" },
    { id: "mars", t: RU ? "Марс" : "Mars" },
    { id: "saturn", t: RU ? "Сатурн" : "Saturn" },
    { id: "hole", t: RU ? "Дыра" : "Hole" },
    { id: "galaxy", t: RU ? "Галактика" : "Galaxy" },
    { id: "home", t: RU ? "Домой" : "Home" }
  ];
  var navHtml = "";
  for (var ni = 0; ni < NAV.length; ni++) {
    navHtml += '<button type="button" data-goal="' + NAV[ni].id + '">' + NAV[ni].t + "</button>";
  }
  navHtml += '<button type="button" class="rcf-scan-key" data-scan aria-pressed="false">' + (RU ? "Сканер" : "Scanner") + "</button>";
  navHtml += '<button type="button" class="rcf-auto-key" data-autokey aria-pressed="true">' + (RU ? "Авто" : "Auto") + "</button>";

  var uniHtml = "";
  for (var ui2 = 0; ui2 < UNIVERSES.length; ui2++) {
    /* Закрытые вселенные показываем сразу: цель должна быть видна,
       иначе её незачем достигать. Разница только в состоянии кнопки */
    var uu = UNIVERSES[ui2];
    var locked = uu.need && netCount() < uu.need;
    uniHtml += '<button type="button" data-uni="' + ui2 + '"' + (locked ? ' class="locked"' : '') + '><b>' +
      uu.name + '</b><span>' + (uu.about || "") + "</span></button>";
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
    '<img class="rcf-cab" alt="" aria-hidden="true" decoding="async">' +
    '<div class="rcf-hud">' +
      '<div class="rcf-cap" aria-live="polite"></div>' +
      '<div class="rcf-deck"><div class="rcf-nav" role="group" aria-label="' + (RU ? "Навигация" : "Navigation") + '">' + navHtml + '</div></div>' +
      '<div class="rcf-uni" role="menu"><i>' + (RU ? "КУДА ПРЫГАЕМ" : "JUMP TO") + '</i>' + uniHtml + '</div>' +
      '<div class="rcf-track"><i></i></div>' +
      '<div class="rcf-hint">' + (matchMedia("(pointer: coarse)").matches
        ? (RU ? "Ведите пальцем вверх - тяга, в сторону - взгляд" : "Swipe up to thrust, sideways to look")
        : (RU ? "Колесо или свайп - тяга. Мышь - взгляд." : "Scroll or swipe to thrust. Mouse to look.")) + '</div>' +
      '<div class="rcf-speed"><b>0</b><span>' + (RU ? "км/с" : "km/s") + '</span></div>' +
      '<div class="rcf-info" role="status"></div>' +
      '<div class="rcf-prog"></div>' +
      '<div class="rcf-net"></div>' +
      '<button type="button" class="rcf-deploy"></button>' +
      '<div class="rcf-lock" aria-hidden="true"><b></b><b></b><b></b><b></b><span></span></div>' +
    '</div>' +
    '<div class="rcf-holo" aria-hidden="true"><img src="assets/mark.webp" alt=""><i></i></div>' +
    '<button type="button" class="rcf-auto" aria-pressed="true">' +
      '<i></i><span>' + (RU ? "Автопилот" : "Autopilot") + '</span>' +
    '</button>' +
    '<div class="rcf-brief">' +
      '<div class="rcf-brief-card">' +
        '<b>' + (RU ? "ГОТОВ К СТАРТУ" : "READY FOR LAUNCH") + '</b>' +
        '<p>' + (RU ? "Маршрут: Земля - Луна - Марс - Сатурн - чёрная дыра - гиперпрыжок через Млечный Путь - домой. Панель внизу ведёт к любой цели, наведение рассказывает об объектах." : "Route: Earth - Moon - Mars - Saturn - black hole - hyperjump - home.") + '</p>' +
        '<div class="rcf-brief-btns">' +
          '<button type="button" data-mode="auto">' + (RU ? "Автополёт" : "Autopilot") + '<span>' + (RU ? "смотреть как кино" : "watch as a movie") + '</span></button>' +
          '<button type="button" data-mode="manual">' + (RU ? "Ручное управление" : "Manual") + '<span>' + (RU ? "колесо и свайп - тяга" : "scroll to thrust") + '</span></button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<button type="button" class="rcf-close" aria-label="' + (RU ? "Выйти из полёта" : "Exit flight") + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>' +
    '<button type="button" class="rcf-return">' + (RU ? "Вернуться на сайт" : "Back to the site") + '</button>' +
    '<div class="rcf-fade"></div>';
  doc.body.appendChild(w);
  ui.wrap = w;
  ui.cv = w.querySelector(".rcf-cv");
  ui.cab = w.querySelector(".rcf-cab");
  ui.cap = w.querySelector(".rcf-cap");
  ui.nav = w.querySelector(".rcf-nav");
  ui.bar = w.querySelector(".rcf-track i");
  ui.hint = w.querySelector(".rcf-hint");
  ui.speed = w.querySelector(".rcf-speed b");
  ui.auto = w.querySelector(".rcf-auto");
  ui.ret = w.querySelector(".rcf-return");
  ui.info = w.querySelector(".rcf-info");
  ui.brief = w.querySelector(".rcf-brief");
  ui.uni = w.querySelector(".rcf-uni");
  ui.autoKey = w.querySelector(".rcf-auto-key");
  ui.prog = w.querySelector(".rcf-prog");
  ui.net = w.querySelector(".rcf-net");
  ui.deploy = w.querySelector(".rcf-deploy");
  ui.deploy.addEventListener("click", function () { deployNode(); });
  ui.lock = w.querySelector(".rcf-lock");
  ui.lockCap = ui.lock.querySelector("span");
  ui.scanKey = w.querySelector(".rcf-scan-key");
  ui.fade = w.querySelector(".rcf-fade");
  ui.fx = w.querySelector(".rcf-fx");

  /* Рамка кабины: своя для альбома и своя для портрета */
  cabSrc();
  /* Картинка кабины та же, что на сайте, и к моменту старта она уже
     в кэше браузера: событие load по кэшированной картинке может и
     не прийти, а даже если придёт - позже первого кадра игры.
     Приёмка это и поймала: полторы десятых секунды кадр был без
     рамки, вместо неё пустой космос. Проверяем готовность сразу. */
  if (ui.cab.complete && ui.cab.naturalWidth) w.classList.add("has-cab");
  ui.cab.addEventListener("load", function () { w.classList.add("has-cab"); });
  ui.cab.addEventListener("error", function () { w.classList.remove("has-cab"); });

  ui.brief.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-mode]");
    if (!b) return;
    ui.brief.classList.add("off");
    setAuto(b.getAttribute("data-mode") === "auto");
    F.brief = false;
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (err) {} }
  });
  w.querySelector(".rcf-close").addEventListener("click", close);
  ui.ret.addEventListener("click", close);
  ui.auto.addEventListener("click", function () {
    setAuto(!F.auto);
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
  });
  ui.uni.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-uni]");
    if (!b) return;
    var want = parseInt(b.getAttribute("data-uni"), 10);
    var uw = UNIVERSES[want];
    if (uw && uw.need && netCount() < uw.need) {
      /* Ещё закрыто: говорим, сколько осталось, и не закрываем меню -
         человек должен видеть, куда он собирался */
      say((RU ? "ЗАКРЫТО · нужно узлов сети: " : "LOCKED · nodes needed: ") +
          uw.need + " (" + (RU ? "есть " : "have ") + netCount() + ")", 2800);
      if (g.RC_SOUND) { try { (g.RC_SOUND.uiClick || g.RC_SOUND.blip).call(g.RC_SOUND, 180); } catch (e3) {} }
      return;
    }
    ui.uni.classList.remove("on");
    if (want !== uniIdx) jumpUniverse(want);
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiClick || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (err) {} }
  });
  ui.nav.addEventListener("click", function (e) {
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiClick || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (err) {} }
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
      var all = ui.nav.querySelectorAll("button");
      for (var q = 0; q < all.length; q++) all[q].classList.remove("cur");
      sy.classList.add("cur");
      return;
    }
    var b = e.target.closest("button[data-goal]");
    if (!b) return;
    goTo(b.getAttribute("data-goal"));
  });
  bindControls();
}

/* Картинку кабины держим прогретой заранее: к финалу она уже
   показана на сайте, но если человек нажал «Полёт» из середины
   страницы, у игры она была бы холодной, и первый кадр вышел бы
   без рамки. */
var cabWarm = null;
function warmCab() {
  if (cabWarm) return;
  cabWarm = new Image();
  cabWarm.decoding = "async";
  cabWarm.src = innerHeight > innerWidth
    ? "assets/gen/cockpit-tall.webp"
    : "assets/gen/cockpit-wide.webp";
}
addEventListener("rc:act", function (e) {
  var a = e && e.detail && e.detail.act;
  if (a === "walk" || a === "cabin" || a === "console" || a === "egress") warmCab();
});

function cabSrc() {
  if (!ui.cab) return;
  var want = innerHeight > innerWidth ? "assets/gen/cockpit-tall.webp" : "assets/gen/cockpit-wide.webp";
  if (ui.cab.getAttribute("src") !== want) ui.cab.setAttribute("src", want);
}

/* ── Автопилот и навигация ───────────────────────────────────
   Автопилот держит крейсерскую тягу: корабль сам плывёт по всему
   маршруту, человек только смотрит по сторонам. Любое своё усилие
   на тяге отключает автопилот - управление отдано человеку.
   Кнопки навигации ведут к цели в обе стороны и сами тормозят
   у места назначения. */
function setAuto(on) {
  F.auto = !!on;
  if (on) { F.goal = null; if (F.orbit) { F.rejoin = 1; F.orbit = null; } }
  if (ui.auto) ui.auto.setAttribute("aria-pressed", F.auto ? "true" : "false");
  if (ui.autoKey) {
    ui.autoKey.setAttribute("aria-pressed", F.auto ? "true" : "false");
    ui.autoKey.classList.toggle("cur", F.auto);
  }
}

function manual() {
  if (F.auto) setAuto(false);
  F.goal = null;
  if (F.orbit) F.rejoin = 1;
  F.orbit = null;
  if (F.brief) { F.brief = false; if (ui.brief) ui.brief.classList.add("off"); }
  hideHint();
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

  for (var s = 0; s < (u.sys || []).length; s++) {
    var sys = u.sys[s];
    var sg = new T.Group();
    sg.position.set(sys.at[0], sys.at[1], sys.at[2]);

    /* Звезда системы: свет, диск и корона. Процедурную звезду даёт
       rc-planets (грануляция, пятна, потемнение к краю); если её
       нет, остаётся спрайт-гало, и система всё равно освещена. */
    var star = new T.PointLight(sys.star, 2.4, 2600, 1.6);
    sg.add(star);
    var madeStar = null;
    if (g.RC_PLANETS && g.RC_PLANETS.star) {
      try {
        madeStar = g.RC_PLANETS.star({ radius: 78, seed: sys.seed, tint: sys.star, light: false, corona: 1.25 });
        sg.add(madeStar.group);
        live.push(madeStar);
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
          /* Мир проявляется, а не возникает: короткий рост от нуля */
          made.group.scale.setScalar(0.01);
          made.group.userData.grow = 0;
          sg.add(made.group);
          live.push(made);

          /* Планеты чужих вселенных попадают и в сканер, и под
             наведение: иначе прибор в чужом рукаве слепнет */
          var solid = made.group.children[0];
          if (solid) {
            solid.userData.info = made.group.userData.info;
            if (W3.pickables) W3.pickables.push(solid);
            if (W3.scanTargets) W3.scanTargets.push({ o: made.group, name: pl.name, key: sys.id + "-" + pi, uni: i });
          }
        });
      })(pl, pi, px, py, pz, sg, sys);
    }
    sg.userData.sys = sys;
    root.add(sg);
  }

  W3.scene.add(root);
  built[i] = { root: root, live: live, uni: u };
  return built[i];
}

/* Тела родной вселенной: прячем их, пока мы в чужой, иначе Земля
   висит посреди фиолетового рукава */
function showHome(on) {
  if (!W3) return;
  var list = [W3.earth, W3.moon, W3.mars, W3.saturn, W3.hole, W3.comet, W3.sat, W3.belt1, W3.belt2];
  for (var i = 0; i < list.length; i++) if (list[i]) list[i].visible = on;
}

function applyUniverse(i) {
  if (!W3) return;
  var T = g.THREE, u = UNIVERSES[i % UNIVERSES.length];

  /* Показываем ту вселенную, в которую прыгнули, и прячем прочие */
  for (var b in built) if (built.hasOwnProperty(b)) built[b].root.visible = (+b === i);
  if (i > 0) buildUniverse(i).root.visible = true;
  showHome(i === 0);
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
    var NAV = [["earth", RU ? "Земля" : "Earth"], ["moon", RU ? "Луна" : "Moon"],
               ["mars", RU ? "Марс" : "Mars"], ["saturn", RU ? "Сатурн" : "Saturn"],
               ["hole", RU ? "Дыра" : "Hole"], ["galaxy", RU ? "Галактика" : "Galaxy"],
               ["home", RU ? "Домой" : "Home"]];
    for (var i = 0; i < NAV.length; i++) {
      html += '<button type="button" data-goal="' + NAV[i][0] + '">' + NAV[i][1] + "</button>";
    }
  } else {
    for (var s = 0; s < u.sys.length; s++) {
      html += '<button type="button" data-sys="' + s + '">' + u.sys[s].name + "</button>";
      /* Планеты системы идут следом отдельными кнопками: клиент
         просил «куча систем планет, по которым можно путешествовать» */
      for (var p = 0; p < u.sys[s].planets.length; p++) {
        html += '<button type="button" class="rcf-pl" data-sys="' + s + '" data-pl="' + p + '">' +
                u.sys[s].planets[p].name + "</button>";
      }
    }
    html += '<button type="button" data-goal="galaxy">' + (RU ? "Галактика" : "Galaxy") + "</button>";
  }
  html += '<button type="button" class="rcf-scan-key" data-scan aria-pressed="' +
          (F.scan ? "true" : "false") + '">' + (RU ? "Сканер" : "Scanner") + "</button>";
  html += '<button type="button" class="rcf-auto-key" data-autokey aria-pressed="' +
          (F.auto ? "true" : "false") + '">' + (RU ? "Авто" : "Auto") + "</button>";
  ui.nav.innerHTML = html;
  ui.scanKey = ui.wrap.querySelector(".rcf-scan-key");
  ui.autoKey = ui.wrap.querySelector(".rcf-auto-key");
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
    r = far * 1.25; y = far * 0.3;
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
    r = pl.r * 3.4; y = pl.r * 0.8;
  }
  F.away = true;
  F.auto = false;
  F.goal = null;
  F.orbit = { c: c, r: r, y: y, a: null, name: name };
  noteExplored(name);
  say((RU ? "КУРС · " : "COURSE · ") + name, 2200);
  if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
}

/* Прыжок между вселенными: белая вспышка, за ней мир уже другой */
var uniBusy = false;
function jumpUniverse(want) {
  if (uniBusy || !W3) return;
  uniBusy = true;
  uniIdx = (want === undefined) ? (uniIdx + 1) % UNIVERSES.length : want;
  if (ui.fade) { ui.fade.style.transition = "opacity .45s"; ui.fade.style.opacity = "1"; }
  if (g.RC_SOUND) { try { (g.RC_SOUND.hyper || g.RC_SOUND.chime).call(g.RC_SOUND); } catch (e) {} }
  F.shake = 1;
  setTimeout(function () {
    applyUniverse(uniIdx);
    if (ui.cap) {
      ui.cap._t = UNIVERSES[uniIdx].name;
      ui.cap._hold = performance.now() + 3200;
      ui.cap.classList.remove("in"); void ui.cap.offsetWidth;
      ui.cap.textContent = UNIVERSES[uniIdx].name;
      ui.cap.classList.add("in");
    }
    /* Панель навигации перестраивается под новую вселенную, и
       корабль сразу оказывается у первой её системы: прыжок должен
       заканчиваться видом на новый мир, а не на пустоту */
    systemNav();
    if (uniIdx > 0) {
      goSystem(0);
      F.away = true;
    } else {
      F.away = false;
      F.orbit = null;
      F.rejoin = 1;
    }
    if (ui.fade) ui.fade.style.opacity = "0";
    setTimeout(function () { uniBusy = false; }, 700);
  }, 480);
}

var GOAL_NAMES = {
  earth: RU ? "ЗЕМЛЯ" : "EARTH", moon: RU ? "ЛУНА" : "MOON",
  mars: RU ? "МАРС" : "MARS", saturn: RU ? "САТУРН" : "SATURN",
  hole: RU ? "ЧЁРНАЯ ДЫРА" : "BLACK HOLE",
  galaxy: RU ? "ГАЛАКТИКА" : "GALAXY", home: RU ? "ДОМОЙ" : "HOME"
};

/* Радиус орбиты и высота для каждого тела: подобраны по размеру */
/* Радиусы подобраны так, чтобы тело заполняло кадр, а не висело
   точкой вдали: клиент просил «подлетали к планетам, облетали их».
   Нижняя граница - зона обхода (1.8 радиуса плюс запас), иначе
   собственный манёвр уклонения начнёт отталкивать от цели. */
var ORBITS = {
  earth: { r: 128, y: 30 }, moon: { r: 42, y: 10 }, mars: { r: 68, y: 16 },
  saturn: { r: 168, y: 48 }, hole: { r: 200, y: 32 }
};

function goTo(id) {
  if (!W3 || !W3.at) return;
  F.goalId = id;
  if (id === "galaxy") {
    /* Список вселенных: человек выбирает, куда прыгать */
    if (ui.uni) ui.uni.classList.toggle("on");
    return;
  }
  var p = id === "earth" ? 0.02
        : id === "home" ? 0.985
        : id === "galaxy" ? (W3.at.jump0 + W3.at.jump1) / 2
        : W3.at[id];
  if (p === undefined) return;
  F.auto = false;
  if (ui.auto) ui.auto.setAttribute("aria-pressed", "false");
  F.goal = p;
  F.goalName = GOAL_NAMES[id] || null;
  hideHint();
}

/* ── Процедурные текстуры ────────────────────────────────────
   Марс, Сатурн и кольца рисуются на холсте: до них в кадре далеко,
   а лишние мегабайты и лишние запросы полёту ни к чему. */
function paintPlanet(w, h, base, bands, noise) {
  var c = doc.createElement("canvas");
  c.width = w; c.height = h;
  var x = c.getContext("2d");
  var grd = x.createLinearGradient(0, 0, 0, h);
  for (var i = 0; i < base.length; i++) grd.addColorStop(base[i][0], base[i][1]);
  x.fillStyle = grd; x.fillRect(0, 0, w, h);
  /* Полосы: полупрозрачные горизонтальные ленты разной толщины */
  for (i = 0; i < bands; i++) {
    var y = Math.random() * h, bh = 2 + Math.random() * (h * 0.06);
    x.fillStyle = "rgba(" + (Math.random() > 0.5 ? "255,255,255" : "0,0,0") + "," + (0.03 + Math.random() * 0.08).toFixed(3) + ")";
    x.fillRect(0, y, w, bh);
  }
  /* Шум: точки-кратеры и разводы */
  for (i = 0; i < noise; i++) {
    var nx = Math.random() * w, ny = Math.random() * h, r = 1 + Math.random() * 7;
    var gr2 = x.createRadialGradient(nx, ny, 0, nx, ny, r);
    gr2.addColorStop(0, "rgba(0,0,0," + (0.04 + Math.random() * 0.12).toFixed(3) + ")");
    gr2.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr2; x.beginPath(); x.arc(nx, ny, r, 0, 6.283); x.fill();
  }
  var t = new g.THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function paintRing() {
  var c = doc.createElement("canvas");
  c.width = 512; c.height = 32;
  var x = c.getContext("2d");
  for (var i = 0; i < 512; i++) {
    var d = i / 512;
    var a = 0.15 + 0.75 * Math.pow(Math.abs(Math.sin(d * 40) * Math.sin(d * 9)), 1.6);
    if (d < 0.06 || d > 0.97) a *= d < 0.06 ? d / 0.06 : (1 - d) / 0.03;
    var tone = 200 + Math.round(35 * Math.sin(d * 23));
    x.fillStyle = "rgba(" + tone + "," + (tone - 25) + "," + (tone - 55) + "," + a.toFixed(3) + ")";
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
var tiny = false;
try {
  tiny = (navigator.deviceMemory || 4) <= 2 ||
         (navigator.hardwareConcurrency || 4) <= 2;
} catch (eTiny) { tiny = false; }

function skyTexture(mob) {
  /* Размер скромный: текстура натянута на сферу радиусом 4200, и в
     кадр попадает малая её доля - каждый нарисованный пиксель на
     экране растягивается в несколько. Крупная сетка тут не нужна,
     нужна мягкость. */
  var W = tiny ? 1024 : 2048, H = W / 2;
  var c = doc.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");

  /* Своё зерно: небо обязано быть одинаковым от захода к заходу,
     иначе созвездия перемешиваются при каждом открытии игры */
  var seed = 20260819;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  x.fillStyle = "#02040a";
  x.fillRect(0, 0, W, H);

  /* Полоса Млечного Пути идёт наискось, как и в небе Земли.
     Рисуем только дымку диска и пыль: сами звёзды в игре живут
     точками (Points), у них честный параллакс, и дублировать их
     в текстуре значит получить мутные пятна на пол-экрана. */
  var midY = H * 0.52, tilt = H * 0.10;
  function bandY(u) { return midY + Math.sin(u * Math.PI * 2) * tilt; }

  var i, u, gr;
  for (i = 0; i < (tiny ? 900 : 1800); i++) {
    u = rnd();
    var px = u * W;
    var py = bandY(u) + (rnd() - 0.5) * H * (0.07 + rnd() * 0.10);
    var rr = 6 + rnd() * 26;
    gr = x.createRadialGradient(px, py, 0, px, py, rr);
    var warm = rnd();
    var col = warm > 0.7 ? "255,238,208" : warm > 0.35 ? "206,222,246" : "168,196,238";
    gr.addColorStop(0, "rgba(" + col + "," + (0.030 + rnd() * 0.045).toFixed(3) + ")");
    gr.addColorStop(1, "rgba(" + col + ",0)");
    x.fillStyle = gr;
    x.beginPath(); x.arc(px, py, rr, 0, 6.283); x.fill();
  }

  /* Ядро галактики: сгущение к центру полосы */
  var cx = W * 0.32, cy = bandY(0.32);
  var core = x.createRadialGradient(cx, cy, 0, cx, cy, W * 0.09);
  core.addColorStop(0, "rgba(255,236,200,.16)");
  core.addColorStop(0.45, "rgba(232,214,186,.07)");
  core.addColorStop(1, "rgba(200,190,180,0)");
  x.fillStyle = core;
  x.fillRect(0, 0, W, H);

  /* Пылевые прожилки: тёмные рваные полосы вдоль диска. Без них
     Млечный Путь выглядит светлой кляксой, а не галактикой */
  for (i = 0; i < (tiny ? 400 : 800); i++) {
    u = rnd();
    var dx = u * W;
    var dy = bandY(u) + (rnd() - 0.5) * H * 0.08;
    var dr = 5 + rnd() * 22;
    gr = x.createRadialGradient(dx, dy, 0, dx, dy, dr);
    gr.addColorStop(0, "rgba(2,4,10," + (0.10 + rnd() * 0.20).toFixed(3) + ")");
    gr.addColorStop(1, "rgba(2,4,10,0)");
    x.fillStyle = gr;
    x.beginPath(); x.arc(dx, dy, dr, 0, 6.283); x.fill();
  }

  /* Мелкая звёздная пыль: точки в один пиксель. Они не читаются
     отдельными звёздами, но дают диску зернистость, без которой он
     выглядит нарисованным градиентом. */
  var n = tiny ? 6000 : 14000;
  for (i = 0; i < n; i++) {
    u = rnd();
    var sx2 = u * W;
    var sy2 = rnd() < 0.6 ? bandY(u) + (rnd() - 0.5) * H * 0.20 : rnd() * H;
    var a = 0.10 + Math.pow(rnd(), 2.6) * 0.55;
    x.fillStyle = "rgba(226,236,255," + a.toFixed(3) + ")";
    x.fillRect(sx2, sy2, 1, 1);
  }

  /* Туманности в фирменных цветах: небо перекликается с сайтом */
  var NEB = [[0.13, 0.30, "66,178,220"], [0.62, 0.68, "138,89,246"],
             [0.82, 0.26, "66,178,220"], [0.44, 0.78, "196,120,255"]];
  for (i = 0; i < NEB.length; i++) {
    var nx = NEB[i][0] * W, ny = NEB[i][1] * H, nr = W * 0.05;
    for (var q = 0; q < 90; q++) {
      var ox = nx + (rnd() - 0.5) * nr * 2.0, oy = ny + (rnd() - 0.5) * nr * 1.4;
      var orr = nr * (0.10 + rnd() * 0.30);
      gr = x.createRadialGradient(ox, oy, 0, ox, oy, orr);
      gr.addColorStop(0, "rgba(" + NEB[i][2] + "," + (0.014 + rnd() * 0.020).toFixed(3) + ")");
      gr.addColorStop(1, "rgba(" + NEB[i][2] + ",0)");
      x.fillStyle = gr;
      x.beginPath(); x.arc(ox, oy, orr, 0, 6.283); x.fill();
    }
  }

  var tex = new g.THREE.CanvasTexture(c);
  tex.colorSpace = g.THREE.SRGBColorSpace || tex.colorSpace;
  tex.anisotropy = 4;
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
function buildWorld() {
  var T = g.THREE;
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
  r.setPixelRatio(Math.min(g.devicePixelRatio || 1, tiny ? 1.1 : (mob ? 1.45 : 2)));
  r.setClearColor(0x02050c, 1);

  /* Страховка на случай, если контекст всё же отберут: выходим из
     полёта на страницу и забываем собранный мир, чтобы следующий
     заход построил его заново, а не показывал чёрный кадр. */
  if (g.RC_GL && g.RC_GL.guard) {
    try {
      g.RC_GL.guard(ui.cv, function () {
        F.built = false;
        F.glSlot = false;
        if (F.open) close();
      }, function () {
        if (ui.cv) ui.cv.style.opacity = "";
      });
    } catch (e2) {}
  }
  F.glSlot = true;

  var scene = new T.Scene();
  var portrait = innerHeight > innerWidth;
  var FOV0 = portrait ? 84 : 72;
  var cam = new T.PerspectiveCamera(FOV0, 1, 0.1, 9000);

  var amb = new T.AmbientLight(0x3a4a68, 0.85);
  scene.add(amb);
  var sun = new T.DirectionalLight(0xfff2dc, 1.6);
  sun.position.set(2600, 1000, 1750);
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
      f.anisotropy = 4;
      t.image = f.image;
      t.needsUpdate = true;
    });
    t.anisotropy = 4;
    return t;
  }

  /* Небо: панорама Млечного Пути на дальней сфере + звёзды точками.
     Панорама даёт глубину и «дорогое» небо, точки - искры и
     параллакс, которого у панорамы нет. */
  var sky = new T.Mesh(
    new T.SphereGeometry(4200, 48, 28),
    new T.MeshBasicMaterial({ map: skyTexture(mob), side: T.BackSide, color: 0x9db4cc })
  );
  scene.add(sky);

  var starDot = glowSprite(64, "rgba(255,255,255,1)", "rgba(255,255,255,0)");
  function stars(n, size, spread, hue) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var v = new T.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      v.normalize().multiplyScalar(spread * (0.35 + Math.random() * 0.65));
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({
      color: hue, size: size, sizeAttenuation: true, map: starDot,
      transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, m);
    scene.add(pts);
    return pts;
  }
  var starMats = [
    stars(tiny ? 2400 : 5200, 2.4, 3000, 0xcfe9f5).material,
    stars(tiny ? 900 : 2200, 3.6, 2200, 0x8fb7ff).material,
    stars(tiny ? 400 : 900, 4.8, 1500, 0xffe9c9).material
  ];

  /* Солнце: далёкий слепящий блик, как на съёмке с орбиты */
  var sunGlow = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(256, "rgba(255,246,225,1)", "rgba(255,190,110,0)"),
    transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending
  }));
  sunGlow.position.set(2600, 1000, 1750);
  sunGlow.scale.setScalar(900);
  scene.add(sunGlow);

  /* Туманности: несколько мягких пятен в фирменных цветах */
  var nebT = glowSprite(256, "rgba(66,178,220,.32)", "rgba(66,178,220,0)");
  var nebV = glowSprite(256, "rgba(138,89,246,.28)", "rgba(138,89,246,0)");
  var nebs = [[-1400, 500, -2400, 2600, nebT], [1900, -300, -1500, 2100, nebV], [600, 800, 2200, 2400, nebT], [-2100, -600, 1400, 1900, nebV]];
  var nebSprites = [];
  for (var i = 0; i < nebs.length; i++) {
    var sp = new T.Sprite(new T.SpriteMaterial({ map: nebs[i][4], transparent: true, opacity: 0.5, depthWrite: false }));
    sp.position.set(nebs[i][0], nebs[i][1], nebs[i][2]);
    sp.scale.setScalar(nebs[i][3]);
    scene.add(sp);
    nebSprites.push(sp);
  }

  /* ── Земля ── */
  var earth = new T.Group();
  var eBody = new T.Mesh(
    new T.SphereGeometry(60, tiny ? 48 : 64, tiny ? 36 : 48),
    new T.MeshPhongMaterial({
      map: tex("assets/space/earth-day.jpg"),
      emissiveMap: tex("assets/space/earth-night.jpg"),
      emissive: new T.Color(0xffd9a0), emissiveIntensity: 1.05,
      specular: new T.Color(0x223344), shininess: 14
    })
  );
  earth.add(eBody);
  /* Атмосфера: подсвеченный ободок изнутри наружу */
  var atm = new T.Mesh(
    new T.SphereGeometry(61.9, 48, 36),
    new T.ShaderMaterial({
      transparent: true, side: T.BackSide, depthWrite: false,
      uniforms: {},
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying vec3 vN; void main(){ float f = pow(0.66 - dot(vN, vec3(0.0,0.0,-1.0)), 4.0); gl_FragColor = vec4(0.32,0.62,0.95, f * 0.62); }"
    })
  );
  earth.add(atm);
  var clouds = new T.Mesh(
    new T.SphereGeometry(61.2, tiny ? 48 : 64, tiny ? 36 : 48),
    new T.MeshLambertMaterial({
      map: tex("assets/space/clouds.png"),
      transparent: true, opacity: 0.55, depthWrite: false
    })
  );
  earth.add(clouds);
  scene.add(earth);

  /* ── Луна ── */
  var moon = new T.Mesh(
    new T.SphereGeometry(16, 40, 28),
    new T.MeshPhongMaterial({ map: tex("assets/space/moon.jpg"), shininess: 2 })
  );
  moon.position.set(300, 40, -190);
  scene.add(moon);
  /* Маршрут проходит с теневой стороны Луны - без своего света она
     встречала корабль чёрным диском */
  var moonLamp = new T.PointLight(0xcfd8e2, 1.1, 420);
  moonLamp.position.set(330, 60, -120);
  scene.add(moonLamp);

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
    scene.add(rs);
    relayPts.push(rp);
    relaySprites.push(rs);
  }
  /* Линия связи между узлами: тонкая, едва заметная */
  var relayGeo = new T.BufferGeometry().setFromPoints(relayPts);
  scene.add(new T.Line(relayGeo, new T.LineBasicMaterial({ color: 0x42b2dc, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false })));

  /* ── Марс ── */
  var mars = new T.Mesh(
    new T.SphereGeometry(30, 44, 30),
    new T.MeshPhongMaterial({
      map: paintPlanet(512, 256, [[0, "#9c4a2a"], [0.35, "#c96f3b"], [0.6, "#b35a30"], [1, "#7c3a20"]], 6, 520),
      shininess: 4
    })
  );
  mars.position.set(620, -170, -820);
  scene.add(mars);

  /* ── Сатурн ── */
  var saturn = new T.Group();
  saturn.add(new T.Mesh(
    new T.SphereGeometry(46, 48, 34),
    new T.MeshPhongMaterial({
      map: paintPlanet(512, 256, [[0, "#c3a06b"], [0.3, "#e0c188"], [0.55, "#cfa970"], [0.8, "#e8d09a"], [1, "#ad8a58"]], 40, 60),
      shininess: 6
    })
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
  var ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ map: paintRing(), side: T.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false }));
  ring.rotation.x = Math.PI / 2.25;
  saturn.add(ring);
  saturn.position.set(1560, 260, -1060);
  saturn.rotation.z = 0.12;
  scene.add(saturn);

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
  var halo = new T.Sprite(new T.SpriteMaterial({ map: glowSprite(256, "rgba(255,140,50,.32)", "rgba(255,80,20,0)"), transparent: true, opacity: 0.5, depthWrite: false }));
  halo.scale.setScalar(380);
  hole.add(halo);
  hole.position.set(2140, -160, -2380);
  scene.add(hole);

  /* ── Гиперпрыжок: пучок линий, вытянутых навстречу ── */
  var jump = (function () {
    var nLines = tiny ? 220 : 420;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(nLines * 6);
    for (var k = 0; k < nLines; k++) {
      var a = Math.random() * 6.283, rr = 14 + Math.random() * 240;
      var x0 = Math.cos(a) * rr, y0 = Math.sin(a) * rr, z0 = -Math.random() * 900;
      pos[k * 6] = x0; pos[k * 6 + 1] = y0; pos[k * 6 + 2] = z0;
      pos[k * 6 + 3] = x0; pos[k * 6 + 4] = y0; pos[k * 6 + 5] = z0 - (60 + Math.random() * 200);
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var lines = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0x9fd8ef, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    lines.frustumCulled = false;
    return lines;
  })();
  scene.add(jump);

  /* ── Галактики ──────────────────────────────────────────────
     Три спирали из частиц: Млечный Путь по курсу прыжка и две
     дальние вселенные по сторонам. Каждая - несколько тысяч точек
     по логарифмической спирали с гауссовым разбросом; ядро теплее,
     рукава в цвет вселенной. */
  function spiralGalaxy(px, py, pz, scale, colA, colB, tiltX, tiltZ) {
    var n = tiny ? 1600 : 3200;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(n * 3);
    var col = new Float32Array(n * 3);
    var cA = new T.Color(colA), cB = new T.Color(colB), cC = new T.Color(0xfff3dd);
    for (var k = 0; k < n; k++) {
      var tt = Math.pow(Math.random(), 0.65);            /* плотнее к ядру */
      var arm = (k % 3) * (6.28318 / 3);
      var ang = arm + tt * 4.6 + (Math.random() - 0.5) * 0.5;
      var rad = tt * scale;
      var spread = scale * 0.05 * (1 - tt * 0.6);
      pos[k * 3] = Math.cos(ang) * rad + (Math.random() - 0.5) * spread * 2;
      pos[k * 3 + 1] = (Math.random() - 0.5) * spread;
      pos[k * 3 + 2] = Math.sin(ang) * rad + (Math.random() - 0.5) * spread * 2;
      var c = tt < 0.18 ? cC : (Math.random() > 0.5 ? cA : cB);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    var pts = new T.Points(geo, new T.PointsMaterial({
      size: scale * 0.012, sizeAttenuation: true, map: starDot, vertexColors: true,
      transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending
    }));
    /* Ядро: тёплое свечение */
    var core = new T.Sprite(new T.SpriteMaterial({
      map: glowSprite(128, "rgba(255,240,214,.9)", "rgba(255,214,150,0)"),
      transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending
    }));
    core.scale.setScalar(scale * 0.5);
    var gr = new T.Group();
    gr.add(pts); gr.add(core);
    gr.position.set(px, py, pz);
    gr.rotation.x = tiltX; gr.rotation.z = tiltZ;
    scene.add(gr);
    return gr;
  }
  /* Что расскажет бортовой справочник при наведении на объект */
  eBody.userData.info = RU ? "ЗЕМЛЯ · диаметр 12 742 км · единственная планета с CDN" : "EARTH · 12,742 km wide · the only planet with a CDN";
  moon.userData.info = RU ? "ЛУНА · 384 400 км · первая цель космических миссий, 1959" : "MOON · 384,400 km · first space target, 1959";
  mars.userData.info = RU ? "МАРС · в телескоп впервые разглядел Галилей, 1610" : "MARS · first seen through a telescope by Galileo, 1610";
  saturn.userData.info = RU ? "САТУРН · кольца открыл Гюйгенс, 1655" : "SATURN · rings discovered by Huygens, 1655";
  hole.children[0].userData.info = RU ? "ЧЁРНАЯ ДЫРА · первый снимок - M87*, 2019" : "BLACK HOLE · first image - M87*, 2019";
  var pickables = [eBody, moon, mars, saturn.children[0], hole.children[0]];
  for (var rj = 0; rj < relaySprites.length; rj++) pickables.push(relaySprites[rj]);
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
  var cometTail = (function () {
    var n = 90, geo = new T.BufferGeometry(), posA = new Float32Array(n * 3);
    for (var k = 0; k < n; k++) {
      var d = k / n;
      posA[k * 3] = -d * 150 + (Math.random() - 0.5) * d * 26;
      posA[k * 3 + 1] = (Math.random() - 0.5) * d * 26;
      posA[k * 3 + 2] = (Math.random() - 0.5) * d * 26;
    }
    geo.setAttribute("position", new T.BufferAttribute(posA, 3));
    /* Размер частицы хвоста был подобран под вид издалека, и на
       близком пролёте каждая крупинка раздувалась в белый шар на
       полкадра - хвост читался цепочкой мыльных пузырей. Мельче и
       ярче: издали хвост тот же, вблизи это россыпь льда, как на
       снимках Чурюмова-Герасименко. */
    return new T.Points(geo, new T.PointsMaterial({
      color: 0xbfe4ff, size: 3.2, sizeAttenuation: true, map: starDot,
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
  satBody.userData.info = RU ? "СПУТНИК RC-SAT · ретранслятор Rocket CDN на низкой орбите" : "RC-SAT · Rocket CDN relay in low orbit";
  sat.add(satBody);
  var panelMat = new T.MeshPhongMaterial({ color: 0x1d4d8f, shininess: 90, side: T.DoubleSide, emissive: 0x0d2038 });
  var p1 = new T.Mesh(new T.PlaneGeometry(5.6, 1.8), panelMat); p1.position.x = 4; sat.add(p1);
  var p2 = new T.Mesh(new T.PlaneGeometry(5.6, 1.8), panelMat); p2.position.x = -4; sat.add(p2);
  scene.add(sat);
  pickables.push(satBody);

  var milky = spiralGalaxy(1150, 80, -2080, 950, 0x9fd8ef, 0x8fb7ff, 0.9, 0.3);
  var gal2 = spiralGalaxy(-2800, -500, -1600, 680, 0xb08cff, 0x8a59f6, 1.15, -0.4);
  var gal3 = spiralGalaxy(3400, 700, -400, 620, 0xffd9a6, 0xff9d6b, 0.75, 0.55);
  milky.children[1].userData.info = RU ? "МЛЕЧНЫЙ ПУТЬ · 200 млрд звёзд · виден с Земли 10 000 лет" : "MILKY WAY · 200B stars";
  gal2.children[1].userData.info = RU ? "ГАЛАКТИКА RV-2 · неизведанная вселенная" : "GALAXY RV-2 · uncharted universe";
  gal3.children[1].userData.info = RU ? "ГАЛАКТИКА RC-3 · открыта Rocket CDN" : "GALAXY RC-3 · discovered by Rocket CDN";
  pickables.push(milky.children[1], gal2.children[1], gal3.children[1]);

  /* ── Пыль у стекла ──
     Куб мелких частиц, вечно висящий вокруг камеры: кадр никогда
     не бывает мёртвым, а скорость читается кожей. Частицы
     заворачиваются по модулю куба относительно камеры - облако
     бесконечно, а точек всего три сотни. */
  var dust = (function () {
    var nD = tiny ? 160 : 320, SIDE = 140;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(nD * 3);
    for (var k = 0; k < nD * 3; k++) pos[k] = (Math.random() - 0.5) * SIDE;
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    /* Размер в пикселях, а не в мире. Пыль висит вокруг камеры, и
       частица, случайно оказавшаяся в паре единиц от стекла, при
       честном размере раздувалась в мутный шар на четверть кадра -
       в замерах такие пятна закрывали Сатурн целиком. Микрочастице
       объём не нужен: её работа - нестись мимо и давать скорость. */
    var pts = new T.Points(geo, new T.PointsMaterial({
      color: 0xaac6d8, size: 1.6, sizeAttenuation: false, map: starDot,
      transparent: true, opacity: 0.5, depthWrite: false
    }));
    pts.frustumCulled = false;
    pts.userData.side = SIDE;
    scene.add(pts);
    return pts;
  })();

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
  var washN = tiny ? 90 : 220;
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

  /* ── Астероидный пояс ──
     Камни рассыпаны трубой вокруг отрезка будущего маршрута между
     Марсом и Сатурном: корабль проходит сквозь пояс, камни висят
     вокруг и медленно дрейфуют. Два слоя точек - крупные ближе,
     мелкая пыль дальше. */
  function beltLayer(nPts, size, spread, color) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(nPts * 3);
    /* Отрезок пути: прямая от окрестности Марса к Сатурну */
    var A = new T.Vector3(760, -120, -900), B = new T.Vector3(1350, 210, -1000);
    for (var k = 0; k < nPts; k++) {
      var tt = Math.random();
      var cx = A.x + (B.x - A.x) * tt, cy = A.y + (B.y - A.y) * tt, cz = A.z + (B.z - A.z) * tt;
      var a = Math.random() * 6.283, rr = 40 + Math.pow(Math.random(), 0.5) * spread;
      pos[k * 3] = cx + Math.cos(a) * rr;
      pos[k * 3 + 1] = cy + (Math.random() - 0.5) * spread * 0.7;
      pos[k * 3 + 2] = cz + Math.sin(a) * rr;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var pts = new T.Points(geo, new T.PointsMaterial({
      color: color, size: size, sizeAttenuation: true, map: starDot,
      transparent: true, opacity: 0.8, depthWrite: false
    }));
    scene.add(pts);
    return pts;
  }
  var belt1 = beltLayer(tiny ? 500 : 1100, 3.4, 230, 0x9a8f80);
  var belt2 = beltLayer(tiny ? 260 : 600, 6.5, 160, 0xb8a890);

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
    new T.Vector3(312, 58, -110),        /* мимо Луны, с запасом над ней */
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
    hole: nearestP(hole.position)
  };
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
    { p: 0.94, at: new T.Vector3(0, 0, 0) }             /* снова Земля */
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
    { o: hole, name: RU ? "ЧЁРНАЯ ДЫРА" : "BLACK HOLE", key: "hole" },
    { o: comet, name: RU ? "КОМЕТА RC/2026" : "COMET RC/2026", key: "comet" },
    { o: sat, name: "RC-SAT", key: "sat" },
    { o: belt1, name: RU ? "АСТЕРОИДНЫЙ ПОЯС" : "ASTEROID BELT", key: "belt" },
    { o: milky, name: RU ? "МЛЕЧНЫЙ ПУТЬ" : "MILKY WAY", key: "milky" },
    { o: gal2, name: "RV-2", key: "gal2" },
    { o: gal3, name: "RC-3", key: "gal3" }
  ];

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
    { o: hole,   r: 30, hole: true, name: RU ? "ЧЁРНАЯ ДЫРА" : "BLACK HOLE" }
  ];

  /* Оптика и шлейф - украшение, а не механика. На просьбе меньше
     движения и на упрощённых режимах страницы их просто нет: игра
     обязана остаться играбельной, а не красивой любой ценой.
     Порог тот же, что у фонового космоса: со второй ступени
     упрощения страница уже призналась, что не тянет. */
  var wantFx = !reduced &&
    (parseInt(root.getAttribute("data-degrade") || "0", 10) || 0) < 2;

  return {
    fx: wantFx,
    r: r, scene: scene, cam: cam, path: path, looks: LOOKS, at: AT, fov0: FOV0, scanTargets: scanTargets,
    bodies: bodies,
    milky: milky, gal2: gal2, gal3: gal3,
    comet: comet, sat: sat, belt1: belt1, belt2: belt2, dust: dust, wash: wash, washN: washN,
    nebSprites: nebSprites, starMats: starMats, sunGlow: sunGlow, amb: amb, mob: mob,
    earth: earth, clouds: clouds, moon: moon, mars: mars, saturn: saturn, hole: hole,
    diskMat: diskMat, jump: jump, sky: sky, pickables: pickables,
    tmpA: new T.Vector3(), tmpB: new T.Vector3(), tmpQ: new T.Quaternion(), tmpM: new T.Matrix4()
  };
}

/* ── Управление ──────────────────────────────────────────────ы */
function bindControls() {
  var w = ui.wrap;

  w.addEventListener("wheel", function (e) {
    e.preventDefault();
    F.v += e.deltaY * 0.0001;
    manual();
  }, { passive: false });

  var tY = null, tX = null;
  w.addEventListener("touchstart", function (e) {
    if (e.touches.length) { tY = e.touches[0].clientY; tX = e.touches[0].clientX; }
  }, { passive: true });
  w.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (!e.touches.length) return;
    var y = e.touches[0].clientY, x = e.touches[0].clientX;
    if (tY !== null) {
      F.v += (tY - y) * 0.00016;
      manual();
      F.look.tx += (x - tX) * 0.004;
      F.look.tx = Math.max(-0.5, Math.min(0.5, F.look.tx));
    }
    tY = y; tX = x;
    hideHint();
  }, { passive: false });
  w.addEventListener("touchend", function () { tY = tX = null; F.look.tx *= 0.4; }, { passive: true });

  w.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    F.look.tx = (e.clientX / innerWidth - 0.5) * 0.66;
    F.look.ty = (e.clientY / innerHeight - 0.5) * 0.4;
    F.mx = (e.clientX / innerWidth) * 2 - 1;
    F.my = -(e.clientY / innerHeight) * 2 + 1;
  }, { passive: true });
  /* На тачскрине справочник вызывает касание */
  w.addEventListener("pointerdown", function (e) {
    F.mx = (e.clientX / innerWidth) * 2 - 1;
    F.my = -(e.clientY / innerHeight) * 2 + 1;
    F.pick = true;
  }, { passive: true });

  addEventListener("keydown", function (e) {
    if (!F.open) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { F.v += 0.14; e.preventDefault(); manual(); }
    if (e.key === "ArrowUp" || e.key === "PageUp") { F.v -= 0.14; e.preventDefault(); manual(); }
  });

  addEventListener("resize", function () { size(); cabSrc(); }, { passive: true });
}

var hintHidden = false, hintT = 0;
function hideHint() {
  if (hintT) { clearTimeout(hintT); hintT = 0; }
  if (hintHidden || !ui.hint) return;
  hintHidden = true;
  ui.hint.classList.add("off");
}

function size() {
  if (!W3 || !F.open) return;
  var w = innerWidth, h = innerHeight;
  W3.r.setSize(w, h, false);
  W3.cam.aspect = w / h;
  W3.cam.updateProjectionMatrix();
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
/* Короткое сообщение на табло поверх обычных титров. Держится
   заданное время, потом титры сцены возвращаются сами. */
function say(text, ms) {
  if (!ui.cap) return;
  ui.cap._t = text;
  ui.cap._hold = performance.now() + (ms || 1400);
  ui.cap.classList.remove("in"); void ui.cap.offsetWidth;
  ui.cap.textContent = text;
  ui.cap.classList.add("in");
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
  ui.net.textContent = (RU ? "Сеть " : "Network ") + Math.min(n, total) + "/" + total;
  ui.net.classList.toggle("full", n >= total);
}

/* Кнопка развёртывания живёт на пульте и включается только там, где
   есть что разворачивать: на орбите тела, которое ещё не в сети */
function netButton() {
  if (!ui.deploy) return;
  var here = F.orbit && F.orbit.name;
  var can = !!here && !net[here];
  ui.deploy.classList.toggle("on", can);
  if (can) ui.deploy.textContent = (RU ? "Развернуть узел · " : "Deploy node · ") + here;
}

function netMark(pos, name) {
  var T = g.THREE;
  if (!W3) return;
  var s = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(64, "rgba(159,224,246,1)", "rgba(66,178,220,0)"),
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  }));
  s.position.copy(pos);
  s.scale.setScalar(26);
  s.userData.info = (RU ? "УЗЕЛ СЕТИ · " : "NETWORK NODE · ") + name;
  W3.scene.add(s);
  netNodes.push({ s: s, p: pos.clone(), name: name });

  /* Линии связи между узлами: сеть должна выглядеть сетью */
  if (netNodes.length > 1) {
    if (netLine) W3.scene.remove(netLine);
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
  if (!W3 || !F.orbit || !F.orbit.name) return;
  var name = F.orbit.name;
  if (net[name]) return;
  net[name] = 1;
  try { localStorage.setItem(NET_KEY, JSON.stringify(net)); } catch (e) {}

  /* Луч развёртывания: от корабля к телу, живёт полсекунды */
  var T = g.THREE;
  if (netBeam) W3.scene.remove(netBeam);
  var geo = new T.BufferGeometry().setFromPoints([W3.cam.position.clone(), F.orbit.c.clone()]);
  netBeam = new T.Line(geo, new T.LineBasicMaterial({
    color: 0x9fe0f6, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending
  }));
  W3.scene.add(netBeam);
  netBeamT = 0.65;

  netMark(F.orbit.c, name);
  netPaint();
  netButton();

  /* Узел закрыл висящий запрос - это и есть победа в игре: трафик
     пришёл туда, где его ждали */
  var closed = req && req.name === name;
  if (closed) req = null;
  say((closed ? (RU ? "ЗАПРОС ЗАКРЫТ · " : "REQUEST SERVED · ")
              : (RU ? "УЗЕЛ РАЗВЁРНУТ · " : "NODE DEPLOYED · ")) + name + " · " +
      (RU ? "в сети " : "in network ") + netCount(), 2600);
  if (g.RC_SOUND) {
    try {
      (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND);
      setTimeout(function () { if (g.RC_SOUND.blip) g.RC_SOUND.blip(880); }, 180);
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
    var names = [GOAL_NAMES.earth, GOAL_NAMES.moon, GOAL_NAMES.mars, GOAL_NAMES.saturn];
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
  if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND, 660); } catch (e) {} }
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
    g.RC_HOLO.init(ui.wrap);
    g.RC_HOLO.onPick(function (id) {
      /* Клик по голограмме - это курс на объект. Ровно то, чего
         ждёшь от метки в кабине: ткнул и полетел. */
      var rec = holoIds[id];
      if (!rec) return;
      if (rec.sys !== undefined) goSystem(rec.sys, rec.pl);
      else if (rec.goal) goTo(rec.goal);
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
               sub: RU ? "ДОМ · 218 УЗЛОВ" : "HOME · 218 NODES", kind: "planet", goal: "earth",
               info: RU ? "Единственная планета с Rocket CDN. Отсюда расходится вся сеть." : "The only planet with Rocket CDN." });
    out.push({ id: "h-moon", o: w3.moon, title: RU ? "ЛУНА" : "MOON",
               sub: RU ? "РЕЗЕРВ · 384 400 КМ" : "BACKUP", kind: "station", goal: "moon",
               info: RU ? "Точка ретрансляции: сигнал доходит за 1,3 секунды." : "Relay point: 1.3 s of light travel." });
    out.push({ id: "h-mars", o: w3.mars, title: RU ? "МАРС" : "MARS",
               sub: RU ? "ХОЛОДНЫЙ КЭШ" : "COLD CACHE", kind: "planet", goal: "mars",
               info: RU ? "Дальний рубеж сети. Задержка до Земли - 3 до 22 минут." : "Far edge of the network." });
    out.push({ id: "h-saturn", o: w3.saturn, title: RU ? "САТУРН" : "SATURN",
               sub: RU ? "КОЛЬЦА · 282 000 КМ" : "RINGS", kind: "planet", goal: "saturn",
               info: RU ? "Кольца шириной в семь Земель, толщиной в десять метров." : "Rings seven Earths wide, ten metres thick." });
    out.push({ id: "h-hole", o: w3.hole, title: RU ? "ЧЁРНАЯ ДЫРА" : "BLACK HOLE",
               sub: RU ? "ГОРИЗОНТ СОБЫТИЙ" : "EVENT HORIZON", kind: "warn", goal: "hole",
               info: RU ? "Дальше не возвращаются даже пакеты. Держим дистанцию." : "Not even packets come back." });
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
    var padX = Math.max(56, innerWidth * (narrow ? 0.16 : 0.12));
    var padY = Math.max(90, innerHeight * (narrow ? 0.16 : 0.14));
    var padR = Math.min(innerWidth * 0.62, narrow ? 258 : 300);
    if (padR < padX + 40) padR = padX + 40;
    sx = Math.max(padX, Math.min(innerWidth - padR, sx));
    sy = Math.max(padY, Math.min(innerHeight - padY * 1.6, sy));
    /* Глубина метки: ноль вплотную, дальше метка мельчает. Потолок
       держим на 0.55 - при большей глубине rc-holo ужимает карточку
       больше чем на треть, и подпись перестаёт читаться. Пусть
       дальняя метка будет просто чуть меньше ближней. */
    var depth = Math.max(0, Math.min(0.55, (dist - 120) / 2600));
    var on = vis && !F.brief && shown < limit;
    if (on) {
      /* Ближние метки идут первыми (список отсортирован), поэтому
         прячется всегда дальняя из пары - так и правильно */
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

function frame(ts) {
  if (!F.open) return;
  F.raf = requestAnimationFrame(frame);
  var dt = F.last ? Math.min(0.05, (ts - F.last) / 1000) : 0.016;
  F.last = ts;
  var T = g.THREE, w3 = W3;

  /* Тяга и инерция. В гиперпрыжке корабль сам держит ход: прыжок
     не должен обрываться на полпути из-за уставшего пальца. */
  /* Зона гиперпрыжка живёт только на маршруте родной системы. В
     чужом рукаве маршрутной кривой нет, а F.p остаётся там, где его
     бросили: без этой проверки в чужой вселенной внезапно включался
     звёздный туннель и корабль сам набирал крейсерскую тягу. */
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
        F.orbit = { c: tgt.position, r: ob.r, y: ob.y, a: null,
                    name: GOAL_NAMES[F.goalId] || F.goalId };
        if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e2) {} }
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
    /* Ручной режим: тяга набирается щелчками и сама затухает */
    F.v *= Math.pow(0.14, dt);
  }
  F.v = Math.max(-0.2, Math.min(0.3, F.v));
  F.p += F.v * dt;
  if (F.p < 0) { F.p = 0; F.v = 0; }
  if (F.p > 1) { F.p = 1; F.v = 0; }

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
  w3.tmpA.copy(a.at).lerp(b.at, k);
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

  /* Взгляд человека поверх автопилота */
  F.look.x += (F.look.tx - F.look.x) * Math.min(1, dt * 5);
  F.look.y += (F.look.ty - F.look.y) * Math.min(1, dt * 5);
  w3.cam.rotateY(-F.look.x);
  w3.cam.rotateX(-F.look.y);
  /* Портрет: окно кокпита выше середины экрана, и цель, посаженная
     в геометрический центр, пряталась под нижнюю раму. Лёгкий
     наклон камеры вниз поднимает цель в стекло. */
  if (innerHeight > innerWidth) w3.cam.rotateX(-0.042);

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
  F.shake += ((jumpZone ? 1 : 0) * 0.8 + nearHole * 0.7 + thrust - F.shake) * Math.min(1, dt * 3);
  if (F.shake > 0.02) {
    w3.cam.rotateZ(Math.sin(ts * 0.021) * 0.004 * F.shake);
    w3.cam.position.x += Math.sin(ts * 0.037) * 0.5 * F.shake;
    w3.cam.position.y += Math.cos(ts * 0.029) * 0.5 * F.shake;
  }

  /* Поле зрения дышит от скорости */
  var fovGoal = (W3.fov0 || 72) + speed * 46 + (jumpZone ? 14 : 0);
  w3.cam.fov += (fovGoal - w3.cam.fov) * Math.min(1, dt * 4);
  w3.cam.updateProjectionMatrix();

  /* Живой мир */
  w3.earth.rotation.y += dt * 0.02;
  if (w3.clouds) w3.clouds.rotation.y += dt * 0.009;
  w3.moon.rotation.y += dt * 0.012;
  w3.mars.rotation.y += dt * 0.022;
  w3.saturn.rotation.y += dt * 0.03;
  w3.hole.rotation.y += dt * 0.14;
  w3.diskMat.uniforms.uT.value = ts * 0.001;
  w3.sky.rotation.y += dt * 0.0025;
  if (w3.milky) { w3.milky.rotation.y += dt * 0.01; w3.gal2.rotation.y -= dt * 0.008; w3.gal3.rotation.y += dt * 0.012; }
  if (w3.belt1) { w3.belt1.rotation.y += dt * 0.0012; w3.belt2.rotation.y -= dt * 0.0009; }

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

  /* Страж плавности: если кадры стабильно тяжёлые, снижаем
     разрешение рендера ступенями и в крайнем случае снимаем
     облака. Вверх не откатываемся - мигание качеством хуже. */
  frame._ema = (frame._ema || 0.016) * 0.95 + dt * 0.05;
  if (frame._ema > 0.055 && ts - (frame._degT || 0) > 4000) {
    frame._degT = ts;
    frame._deg = (frame._deg || 0) + 1;
    if (frame._deg === 1) w3.r.setPixelRatio(Math.max(1, (g.devicePixelRatio || 1) * 0.75));
    else if (frame._deg === 2) w3.r.setPixelRatio(1);
    /* Дальше снимаем украшения, а не механику: сначала шлейф и
       оптика остекления, и только потом облака Земли */
    else if (frame._deg === 3) {
      w3.fx = false;
      if (w3.wash) w3.wash.visible = false;
      if (ui.wrap) { ui.wrap.style.setProperty("--rcf-warp", "0"); ui.wrap.style.setProperty("--rcf-glow", "0"); }
    }
    else if (frame._deg === 4 && w3.clouds) w3.clouds.visible = false;
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
      if (netBeamT <= 0) { w3.scene.remove(netBeam); netBeam = null; }
    }
  }
  /* Узлы дышат: сеть живая, по ней идёт трафик */
  for (var nn = 0; nn < netNodes.length; nn++) {
    netNodes[nn].s.scale.setScalar(24 + Math.sin(ts * 0.003 + nn) * 5);
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
    var bestT = null, bestD = 0.55, sx = 0, sy = 0, bd = 0;
    for (var si = 0; si < (w3.scanTargets || []).length; si++) {
      var tg = w3.scanTargets[si];
      /* Цели чужих вселенных считаются только там, где они видны:
         иначе прибор ведёт объект из другого рукава сквозь всё небо */
      if (tg.uni !== undefined && tg.uni !== uniIdx) continue;
      if (tg.uni === undefined && uniIdx !== 0) continue;
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
      ui.lock.classList.add("on");
      ui.lock.style.left = sx + "px";
      ui.lock.style.top = sy + "px";
      /* Масштаб мира: радиус Земли 60 единиц = 6371 км, то есть
         единица - около ста километров. Дистанции получаются
         орбитальные, как и вся сцена. */
      var tkm = bd * 106 / 1000;
      ui.lockCap.textContent = bestT.name + " · " + (tkm >= 1000
        ? ((tkm / 1000).toFixed(1) + (RU ? " млн км" : "M km"))
        : (Math.round(tkm) + (RU ? " тыс. км" : "K km")));
      noteExplored(bestT.key);
    } else {
      ui.lock.classList.remove("on");
    }
  }

  /* Бортовой справочник: навёл на планету или галактику - корабль
     говорит, что это и когда открыто. Дорогую проверку пересечений
     гоняем восемь раз в секунду, не каждый кадр. */
  if (ui.info && (F.mx !== undefined) && ts - (frame._pickT || 0) > 120) {
    frame._pickT = ts;
    if (!frame._ray) frame._ray = new T.Raycaster();
    frame._ray.setFromCamera({ x: F.mx, y: F.my }, w3.cam);
    var hits = frame._ray.intersectObjects(w3.pickables || [], false);
    var info = null;
    for (var hi = 0; hi < hits.length; hi++) {
      if (hits[hi].object.userData && hits[hi].object.userData.info) { info = hits[hi].object.userData.info; break; }
    }
    if (info !== frame._info) {
      frame._info = info;
      if (info) {
        ui.info.textContent = info;
        ui.info.classList.add("on");
        if (ui.cap && ui.cap.parentNode) ui.cap.parentNode.classList.add("has-info");
        noteExplored(info.split(" ")[0]);
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
    }
    F.jz = ((F.jz || 0) + dt * (420 + jk * 900)) % 300;
    var stretch = 1 + Math.sin(jk * Math.PI) * 1.5;
    w3.jump.position.copy(w3.cam.position);
    w3.jump.quaternion.copy(w3.cam.quaternion);
    w3.jump.scale.set(1, 1, stretch);
    w3.jump.translateZ(F.jz);
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
    ui.cap.classList.remove("in");
    void ui.cap.offsetWidth;
    ui.cap.textContent = cap.t;
    ui.cap.classList.add("in");
  }
  ui.bar.style.width = (F.p * 100).toFixed(1) + "%";
  /* На перелёте между системами табло показывает настоящий ход:
     иначе при варпе счётчик стоял на месте, хотя мимо летит космос */
  ui.speed.textContent = String(Math.round(7.9 + speed * 6200 + (F.warpV || 0) * 0.9));
  ui.ret.classList.toggle("on", F.p > 0.965);

  /* Звук идёт за тягой */
  if (g.RC_SOUND && g.RC_SOUND.flightLevel) {
    try { g.RC_SOUND.flightLevel(Math.min(1, 0.25 + speed * 4 + (jumpZone ? 0.35 : 0))); } catch (e) {}
  }

  w3.r.render(w3.scene, w3.cam);
}

/* ── Вход и выход ────────────────────────────────────────────ы */
function open() {
  if (F.open) return;
  if (!g.THREE) {
    /* Объёмный слой ещё не доехал: дожидаемся и пробуем снова */
    var once = function () { removeEventListener("rc:3d", once); open(); };
    addEventListener("rc:3d", once);
    if (g.RC_GL && !g.RC_GL.want3d) return;   /* этому устройству не положено */
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
  }

  F.open = true;
  F.p = 0; F.v = 0; F.last = 0;

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
  var seamless = root.getAttribute("data-act") === "egress";
  /* Бесшовный старт из финала: сайтовая кабина стоит на своём
     масштабе, и игра обязана принять кадр в том же виде. Готовность
     рамки проверяем ещё раз - между сборкой интерфейса и открытием
     могла смениться ориентация, а с ней и картинка. */
  if (ui.cab && ui.cab.complete && ui.cab.naturalWidth) ui.wrap.classList.add("has-cab");
  ui.wrap.classList.toggle("rcf-seam", seamless);
  F.brief = !seamless;
  F.orbit = null;
  if (ui.brief) ui.brief.classList.toggle("off", seamless);
  F.scan = false;
  if (ui.scanKey) { ui.scanKey.classList.remove("cur"); ui.scanKey.setAttribute("aria-pressed", "false"); }
  if (ui.lock) ui.lock.classList.remove("on");
  paintProgress();
  netPaint();
  netButton();
  setAuto(true);
  F.look.x = F.look.y = F.look.tx = F.look.ty = 0;
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
  ui.wrap.classList.add("on");
  /* Страница под полётом перестаёт существовать для клавиатуры и
     чтения с экрана: иначе Tab уводит из кабины в список городов */
  inertPage(true);
  size();

  /* Сцены сайта спят, музыка встаёт в полный рост */
  try { dispatchEvent(new CustomEvent("rc:flight", { detail: { on: true } })); } catch (e) {}
  if (g.RC_MUSIC && g.RC_MUSIC.boost) { try { g.RC_MUSIC.boost(true); } catch (e) {} }
  if (g.RC_SOUND && g.RC_SOUND.flight) { try { g.RC_SOUND.flight(true); } catch (e) {} }
  if (g.RC_track) g.RC_track("flight", "open");

  F.raf = requestAnimationFrame(frame);
}

function close() {
  if (!F.open) return;
  F.open = false;
  if (F.raf) cancelAnimationFrame(F.raf);
  root.classList.remove("rc-flying");
  ui.wrap.classList.remove("on");
  inertPage(false);
  try { dispatchEvent(new CustomEvent("rc:flight", { detail: { on: false } })); } catch (e) {}
  if (g.RC_MUSIC && g.RC_MUSIC.boost) { try { g.RC_MUSIC.boost(false); } catch (e) {} }
  if (g.RC_SOUND && g.RC_SOUND.flight) { try { g.RC_SOUND.flight(false); } catch (e) {} }
  if (g.RC_track) g.RC_track("flight", "close p=" + F.p.toFixed(2));
  /* Язык переключили в полёте - пересобираем кабину теперь */
  if (langDirty) setTimeout(relang, 420);
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

g.RC_FLIGHT = {
  open: open, close: close,
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
             отметки: W3 && W3.at ? W3.at : null };
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
