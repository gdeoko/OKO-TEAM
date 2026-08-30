/* ═══════════════════════════════════════════════════════════
   Rocket CDN · голографические метки над объектами полёта

   Клиент просил дословно: «текст = голограммы красивые реагирующие
   на клики касания наведение на полёте дальше красиво растворяются
   появляются». Значит над планетами, узлами сети и станциями висят
   подписи-голограммы: наведение или касание раскрывает карточку,
   клик фиксирует выбор, уход объекта из кадра растворяет метку.

   Разделение труда с игрой жёсткое: игра каждый кадр проецирует
   свои трёхмерные точки в экранные координаты и зовёт place().
   Этот модуль не знает ни про камеру, ни про сцену - он отвечает
   только за DOM, разведение меток и анимации.

   Почему всё устроено именно так:
   - place() вызывается шестьдесят раз в секунду на каждую метку,
     поэтому он умеет ровно одно: сравнить с прошлым значением и,
     если оно изменилось, записать CSS-переменную. Ни чтения
     геометрии, ни left/top/width - только --h-x, --h-y, --h-d.
   - События слушает один слой, а не двадцать четыре метки:
     делегирование дешевле и переживает любое пере-создание меток.
   - Разведение меток по вертикали считается не в кадре, а в
     отдельном rAF и только когда что-то реально сдвинулось.
   - Наведение существует только для мыши. На тач-экране первое
     касание раскрывает карточку, второе подтверждает выбор -
     иначе палец «выбирал» бы всё, к чему прикоснулся.

   Публичный контракт - window.RC_HOLO, см. хвост файла.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = g.document;

var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

/* Бюджет кадра. Больше двадцати четырёх меток одновременно на
   экране не держим: дальше растёт цена композитинга, а читать
   такую кашу всё равно невозможно. Лишние метки не удаляются,
   они просто не участвуют в разведении. */
var MAXN = 24;

/* Базовая высота выноски - та же, что initial-value у --h-lh в CSS */
var BASE_LH = 46;

/* Габариты карточки от точки объекта: 24px выноски плюс 214px
   самой карточки. Ими считается и перекрытие, и переброс метки
   на другую сторону у края кадра. Множитель масштаба тот же,
   что в CSS: scale(1 - --h-d * .38). */
/* Полная ширина метки вместе с выноской. Меняется вслед за проёмом
   окна: см. bounds. Двести тридцать восемь это настольный потолок. */
/* Потолок ширины подняли с 238. Двести тридцать восемь не хватало
   даже на мониторе: в проёме шириной 1086 карточка занимала 238, а
   «АСТЕРОИДНЫЙ ПОЯС» всё равно не влезал на тринадцать точек. Доля
   от проёма (0.74) осталась прежней, так что на телефоне ничего не
   изменилось - потолок там и не срабатывал. */
var CARD_W = 238;
var CARD_MAX = 330;
var SCALE_K = 0.38;

/* Метки считаются столкнувшимися, если их карточки перекрываются
   по горизонтали и стоят ближе сорока пикселей по вертикали. */
var NEAR_Y = 40;
/* Раскрытая карточка занимает по высоте втрое больше свёрнутой,
   поэтому соседи расходятся от неё дальше. */
var OPEN_Y = 122;
var LIFT_MAX = 170;

/* Сколько живёт растворение до полного снятия из потока. Держим
   в паре с длительностями в rc-holo.css. */
var OUT_MS = reduced ? 40 : 470;
var IN_MS = reduced ? 20 : 950;
var POP_MS = 700;

var LAYER = null;        /* слой .rc-holo внутри оверлея игры */
var TAGS = {};           /* id -> объект метки */
var ORDER = [];          /* те же метки списком: обход дешевле, чем по ключам */
var SUBS = [];           /* подписчики onPick */
var docBound = false;    /* слушатель «касание мимо меток» уже висит */
var winBound = false;    /* слушатель resize уже висит */

var hoverId = null;      /* метка под курсором */
var pickedId = null;     /* зафиксированная кликом метка */
var layerW = 0;          /* ширина слоя: читается на resize, не в кадре */
var layerH = 0;          /* высота слоя: по ней считаем, сколько меток влезет */
/* Полезные границы по горизонтали. Слой растянут на весь кадр, а
   режется он проёмом окна рубки, и это не одно и то же: на телефоне
   заказчика окно кончается на 354 пикселе при ширине экрана 412.
   Карточка, честно уместившаяся в слой, уходила под стойку рубки, и
   подписи обрывались - «АСТЕРОИ», «ЗВЁЗДНАЯ СИСТ», «Точка ретрансляц».
   Полёт сообщает сюда настоящие границы, а без них берётся слой. */
var огрЛ = 0, огрП = 0;
/* Верхняя и нижняя кромки проёма. Их не было вовсе, и это ровно тот
   дефект, о котором заказчик написал дважды: «в нижней части все
   подписи обрезаются, снизу треть кадра как будто невидимый слой,
   за которым всё перекрывается».

   Никакого невидимого слоя нет. Слой меток режется по контуру
   остекления (clip-path: var(--cab-clip) в rc-holo.css) - это
   правильно, иначе подписи светят ореолом на железо рубки. Но
   прижимались метки к этому контуру ТОЛЬКО по горизонтали: полёт
   отдавал сюда левую и правую кромки, а верхнюю и нижнюю не отдавал
   никогда, хотя знал все четыре. Метка у нижнего края окна честно
   вставала под кромку и честно обрезалась.

   Держим обе кромки и прижимаем по вертикали так же, как по
   горизонтали. */
var огрВ = 0, огрН = 0;
var deQueued = false;    /* разведение уже запрошено на ближайший кадр */
var deDirty = false;     /* с прошлого разведения что-то сдвинулось */

/* ── Иконки типов ────────────────────────────────────────────
   Только векторная графика: в интерфейсе полёта эмодзи выглядели
   бы инородно и по-разному на каждой системе. */
var KIND_ICO = {
  node:    '<path d="M8 1.5 14.3 5v6L8 14.5 1.7 11V5z"/><circle cx="8" cy="8" r="1.7"/>',
  planet:  '<circle cx="8" cy="8" r="3.9"/><ellipse cx="8" cy="8" rx="7.1" ry="2.5" transform="rotate(-20 8 8)"/>',
  station: '<rect x="4.6" y="5.6" width="6.8" height="6.8" rx="1.3"/><path d="M8 5.6V2.2M5.2 3.4 8 2.2l2.8 1.2M2.6 9h2M11.4 9h2"/>',
  relay:   '<path d="M8 14V7.4"/><circle cx="8" cy="5.4" r="1.6"/><path d="M4.6 8.9a5 5 0 0 1 0-7M11.4 1.9a5 5 0 0 1 0 7"/>',
  warn:    '<path d="M8 2.3 14.6 13.5H1.4z"/><path d="M8 6.3v3.3"/><circle cx="8" cy="11.6" r=".75" fill="currentColor" stroke="none"/>',
  gate:    '<path d="M5.2 2.5a7 7 0 0 0 0 11M10.8 2.5a7 7 0 0 1 0 11"/><path d="M8 4.6v6.8"/>'
};

/* ── Мелкие помощники ────────────────────────────────────────*/

/* Текст метки приходит от игры, а уезжает в innerHTML. Экранируем:
   в подписи легко может оказаться кавычка или угловая скобка. */
function esc(s) {
  return String(s === undefined || s === null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* Звук необязателен: модуль обязан работать и когда rc-sound.js
   не подключён, и когда браузер запретил аудио-контекст. */
function sound(name) {
  var s = g.RC_SOUND;
  if (!s) return;
  try { if (typeof s[name] === "function") s[name](); } catch (e) {}
}

/* closest() есть не у всех целей события: внутри метки лежит SVG,
   а у его узлов в старых движках метода нет. */
function upTag(node) {
  while (node && node !== LAYER) {
    if (node.classList && node.classList.contains("rch-tag")) return node;
    node = node.parentNode;
  }
  return null;
}

function tagOf(node) {
  var el = upTag(node);
  return el ? TAGS[el.getAttribute("data-id")] || null : null;
}

function now() {
  return (g.performance && g.performance.now) ? g.performance.now() : +new Date();
}

/* ── Слой ────────────────────────────────────────────────────*/

function init(host) {
  var parent = host || doc.body;
  if (LAYER && LAYER.parentNode === parent) return LAYER;
  if (LAYER && LAYER.parentNode) LAYER.parentNode.removeChild(LAYER);

  LAYER = doc.createElement("div");
  LAYER.className = "rc-holo";
  parent.appendChild(LAYER);

  /* Один комплект слушателей на слой: метки приходят и уходят,
     подписки остаются. passive - потому что мы ничего не отменяем
     и не хотим блокировать прокрутку полёта. */
  LAYER.addEventListener("pointerover", onOver, true);
  LAYER.addEventListener("pointerout", onOut, true);
  LAYER.addEventListener("pointerdown", onDown, { passive: true });
  LAYER.addEventListener("click", onClick);
  LAYER.addEventListener("focusin", onFocus);
  LAYER.addEventListener("focusout", onBlur);

  /* Касание мимо меток закрывает то, что раскрыто пальцем: иначе
     карточка висела бы до следующего попадания в метку. Вешаем
     один раз: init игра может позвать и на каждой новой сцене. */
  if (!docBound) {
    docBound = true;
    doc.addEventListener("pointerdown", onDocDown, true);
  }

  /* Ширина слоя нужна на каждом разведении, но читать её в кадре
     нельзя - это принудительный пересчёт вёрстки. Читаем на старте
     и на смене размера окна. */
  measure();
  if (!winBound) {
    winBound = true;
    g.addEventListener("resize", function () {
      measure();
      deDirty = true;
      queueDe();
    });
  }

  /* Метки, оставшиеся от прошлой сцены, переезжают в новый слой -
     игра может пересоздать оверлей, а список объектов не менять. */
  for (var i = 0; i < ORDER.length; i++) LAYER.appendChild(ORDER[i].el);
  return LAYER;
}

function measure() {
  layerW = LAYER ? (LAYER.clientWidth || g.innerWidth || 0) : 0;
  layerH = LAYER ? (LAYER.clientHeight || g.innerHeight || 0) : 0;
  сторожить();
}

function ensure() {
  if (!LAYER) init(doc.body);
  return LAYER;
}

/* ── Метка ───────────────────────────────────────────────────*/

function add(id, opts) {
  if (!id) return;
  ensure();
  opts = opts || {};

  var t = TAGS[id];
  if (t) { fill(t, opts); return; }

  t = {
    id: String(id),
    opts: opts,
    el: null,
    x: NaN, y: NaN, d: -1, z: -1, lift: 0,
    vis: false,   /* игра считает метку видимой */
    shown: false, /* метка есть в кадре (не свёрнута в display:none) */
    open: false,  /* карточка раскрыта (любой из четырёх причин) */
    mh: false,    /* курсор мыши */
    beam: false,  /* внешняя подсветка, например лучом сканера */
    tap: false,   /* раскрыта касанием */
    pick: false,  /* зафиксирована кликом */
    flip: false,  /* карточка переброшена влево у края кадра */
    outT: 0, inT: 0, popT: 0, downAt: 0,
    seed: Math.random()
  };

  var el = doc.createElement("div");
  el.className = "rch-tag off rch-k-" + kindOf(opts.kind);
  el.setAttribute("data-id", t.id);
  el.style.setProperty("--h-seed", t.seed.toFixed(3));
  el.style.setProperty("--h-lh", BASE_LH);
  el.innerHTML = markup(opts);
  t.el = el;

  TAGS[t.id] = t;
  ORDER.push(t);
  LAYER.appendChild(el);
}

function kindOf(k) {
  return (k && KIND_ICO[k]) ? k : "node";
}

/* Столбики телеметрии в правом углу заголовка. Рисунок берётся из
   самой подписи, а не из случайных чисел: у одного объекта он
   всегда одинаковый, и метки не выглядят близнецами. */
function meter(title) {
  var s = String(title || ""), h = 0, d = "", i;
  for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  for (i = 0; i < 7; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    var v = 2 + (h >> 8) % 6;
    d += "M" + (1 + i * 4.6).toFixed(1) + " 9V" + v + "";
  }
  return '<svg viewBox="0 0 30 10" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
}

function markup(o) {
  var kind = kindOf(o.kind);
  var title = esc(o.title || "");
  return '' +
    '<div class="rch-sc">' +
      '<button class="rch-mark" type="button" tabindex="0" aria-label="' + title + '">' +
        '<svg class="rch-glyph" viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
          '<circle class="rch-hair" cx="20" cy="20" r="14"/>' +
          '<circle class="rch-ring" cx="20" cy="20" r="8.5"/>' +
          '<path class="rch-tick" d="M20 3.6v5.4M20 31v5.4M3.6 20h5.4M31 20h5.4"/>' +
          '<circle class="rch-core" cx="20" cy="20" r="2.1"/>' +
        '</svg>' +
        '<i class="rch-halo"></i>' +
        '<i class="rch-ping"></i>' +
      '</button>' +
      '<i class="rch-riser"></i>' +
      '<div class="rch-lift">' +
        '<i class="rch-arm"></i>' +
        '<div class="rch-body">' +
          '<i class="rch-glass"></i>' +
          '<i class="rch-edge"></i>' +
          '<i class="rch-glow"></i>' +
          '<i class="rch-shred"></i>' +
          '<i class="rch-cor c1"></i><i class="rch-cor c2"></i>' +
          '<i class="rch-cor c3"></i><i class="rch-cor c4"></i>' +
          '<div class="rch-rows">' +
            '<div class="rch-title">' +
              '<svg class="rch-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' + KIND_ICO[kind] + '</svg>' +
              '<b class="rch-tname" data-t="' + title + '">' + title + '</b>' +
              '<i class="rch-meter">' + meter(o.title) + '</i>' +
            '</div>' +
            '<div class="rch-sub">' + esc(o.subtitle || "") + '</div>' +
            '<div class="rch-info">' + esc(o.info || "") + '</div>' +
          '</div>' +
          '<i class="rch-bar"></i>' +
        '</div>' +
      '</div>' +
    '</div>';
}

/* Повторный add с теми же id обновляет содержимое, а не пересобирает
   узел: пересборка убила бы текущую анимацию и состояние наведения. */
function fill(t, o) {
  var el = t.el, kind = kindOf(o.kind), old = kindOf(t.opts.kind);
  t.opts = o;
  if (kind !== old) {
    el.classList.remove("rch-k-" + old);
    el.classList.add("rch-k-" + kind);
    var ico = el.querySelector(".rch-ico");
    if (ico) ico.innerHTML = KIND_ICO[kind];
  }
  var name = el.querySelector(".rch-tname");
  if (name && name.getAttribute("data-t") !== (o.title || "")) {
    name.setAttribute("data-t", o.title || "");
    name.textContent = o.title || "";
    var mk = el.querySelector(".rch-mark");
    if (mk) mk.setAttribute("aria-label", o.title || "");
  }
  var sub = el.querySelector(".rch-sub");
  if (sub) sub.textContent = o.subtitle || "";
  var inf = el.querySelector(".rch-info");
  if (inf) inf.textContent = o.info || "";
}

function remove(id) {
  var t = TAGS[id];
  if (!t) return;
  if (t.outT) clearTimeout(t.outT);
  if (t.inT) clearTimeout(t.inT);
  if (t.popT) clearTimeout(t.popT);
  if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
  delete TAGS[id];
  for (var i = 0; i < ORDER.length; i++) {
    if (ORDER[i] === t) { ORDER.splice(i, 1); break; }
  }
  if (hoverId === id) hoverId = null;
  if (pickedId === id) pickedId = null;
  deDirty = true;
}

function clear() {
  for (var i = 0; i < ORDER.length; i++) {
    var t = ORDER[i];
    if (t.outT) clearTimeout(t.outT);
    if (t.inT) clearTimeout(t.inT);
    if (t.popT) clearTimeout(t.popT);
    if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
  }
  TAGS = {};
  ORDER = [];
  hoverId = null;
  pickedId = null;
  deDirty = false;
}

/* ── Кадр ────────────────────────────────────────────────────
   Самая горячая функция модуля. Всё внутри - сравнение с прошлым
   значением; запись в style идёт только на реальном изменении. */
function place(id, x, y, depth, visible) {
  var t = TAGS[id];
  if (!t) return;

  var vis = visible !== false;
  if (vis !== t.vis) {
    t.vis = vis;
    if (vis) show(t);
    else {
      /* Растворение длится своё время, и всё это время карточка
         стоит там, где стояла. Если она стоит ЗА проёмом - ждать
         нельзя: её обрежет кромкой на глазах, и штатная проверка
         меток ловит её именно гаснущей. Снаружи гасим мгновенно,
         внутри оставляем мягкое растворение: оно и есть красота. */
      var снаружи = false;
      if (огрП > огрЛ) снаружи = t.x < огрЛ || t.x > огрП;
      if (!снаружи && огрН > огрВ) снаружи = t.y < огрВ || t.y > огрН;
      if (снаружи) сразуСкрыть(t); else hide(t);
    }
    deDirty = true;
  }
  if (!vis) return;

  var st = t.el.style;

  /* Держим метку внутри полезных границ.

     Клип стоит именно здесь, а не у того, кто зовёт place: меток
     несколько видов и ставят их разные ветки полёта. Пока клип жил
     снаружи, часть подписей его обходила и упиралась в кромку
     остекления - заказчик видел «АСТЕРОИ» и «ЗВЁЗДНАЯ СИСТ».

     Считаем по фактической ширине карточки на этой глубине и с той
     стороны, на которую она перекинута. */
  if (огрП > огрЛ) {
    /* Сторону выноски и клип решаем ОДНИМ действием.

     Порознь они качались: клип прижимал метку, считая её
     перекинутой, раскладка следом перекид отменяла, и карточка
     снова вылезала за кромку остекления. Поэтому здесь сразу
     выбирается сторона, на которой карточка помещается, и клип
     считается уже по ней. Раскладка эту сторону больше не трогает. */
    var шк = CARD_W * (1 - (depth >= 0 ? Math.min(1, depth) : 0.5) * SCALE_K);
    var влезлаСправа = (x + шк) <= огрП;
    var влезлаСлева = (x - шк) >= огрЛ;
    var хочуВлево = !влезлаСправа && влезлаСлева;
    /* Не помещается ни там, ни там - идём в ту сторону, где просторнее. */
    if (!влезлаСправа && !влезлаСлева) хочуВлево = (x - огрЛ) > (огрП - x);
    if (хочуВлево !== t.flip) {
      t.flip = хочуВлево;
      t.el.classList.toggle("flip", хочуВлево);
    }
    /* Хвостик выноски торчит в противоположную от карточки сторону
       примерно на три десятка пикселей: это стойка с кружком и
       рычаг. Их и резала кромка остекления, когда запас был 12. */
    /* Не влезла ни одной стороной - не показываем.

       Выбор тут между двумя честностями. Прижать карточку к кромке
       значит оторвать перекрестье от тела: подпись останется, но
       будет показывать пальцем в пустоту. Спрятать значит потерять
       подпись, но не соврать. Заказчик про оторванную выноску
       написал отдельно и прямо, значит цена вранья выше.

       Порог с запасом на ореол: у карточки есть мягкое свечение за
       её геометрией, и штатная проверка меток ловит именно его. */
    /* Ореол у карточки два слоя: rch-glow (inset до -9) и rch-halo
       (inset -10 плюс размытие в пять точек). Считать запас в шесть
       точек было мало - штатная проверка ловила вылет ореола то на
       Юпитере, то на Сатурне. Восемнадцать покрывают оба слоя. */
    var ОРЕОЛ = 18;
    if (!влезлаСправа && !влезлаСлева) {
      t.vis = false; сразуСкрыть(t); deDirty = true;
      return;
    }
    if (хочуВлево ? (x - шк - ОРЕОЛ) < огрЛ : (x + шк + ОРЕОЛ) > огрП) {
      t.vis = false; сразуСкрыть(t); deDirty = true;
      return;
    }
    /* Двигать x здесь больше нельзя. Раньше карточку, не влезшую ни
       одной стороной, прижимали к кромке проёма - и вместе с ней
       уезжало перекрестье, то есть тот конец выноски, который стоит
       на теле. Заказчик написал про это прямо: «точка от планеты
       должна идти, а она идёт откуда-то снизу или справа».

       Сторону выбираем, прижим не делаем. Точку привязки полёт
       теперь и так держит внутри проёма (см. вОкне в rc-flight), а
       если карточка всё равно не помещается - её ужмёт своя же
       ширина и обрежет контур, что честнее оторванной подписи. */
  }
  /* ── Прижим по вертикали ─────────────────────────────────
     Метка занимает место НАД точкой: выноска высотой BASE_LH плюс
     подъём разведения, а над ними полка заголовка. Вниз она уходит
     только перекрестьем, а в раскрытом виде ещё и телом карточки.
     Считаем оба вылета в тех же мерах, которыми уже описано
     разведение, и держим их внутри проёма.

     Масштаб глубины учитываем: дальняя метка мельче, и прижимать её
     на полный рост значило бы отталкивать от кромки зря. */
  if (огрН > огрВ) {
    /* Полка стоит НАД точкой на высоте выноски. Если она выходит за
       верхнюю кромку проёма - укорачиваем выноску, а не двигаем
       точку: перекрестье обязано остаться на теле.

       Потолок укорочения - сама базовая длина: короче нуля выноски
       не бывает, и полка тогда просто садится на перекрестье. */
    var kв = 1 - (depth >= 0 ? Math.min(1, depth) : 0.5) * SCALE_K;
    var над = (BASE_LH + (t.lift || 0) + NEAR_Y) * kв;
    var неВлезло = 0;
    var верхПолки = y - над;
    if (верхПолки < огрВ) неВлезло = огрВ - верхПолки;
    var укор = Math.min(неВлезло / (kв || 1), BASE_LH + (t.lift || 0));
    укор = Math.round(укор);
    if (укор !== (t.укор || 0)) {
      t.укор = укор;
      t.el.style.setProperty("--h-lh", BASE_LH + (t.lift || 0) - укор);
    }
  }
  /* Субпиксель на голограмме не виден, а лишняя запись в style
     стоит пересчёта стилей - округляем. */
  var nx = x | 0, ny = y | 0;
  if (nx !== t.x) { t.x = nx; st.setProperty("--h-x", nx); deDirty = true; }
  if (ny !== t.y) { t.y = ny; st.setProperty("--h-y", ny); deDirty = true; }

  /* Отметка живости. По ней гасятся метки, которые перестали
     ставить вовсе: при прыжке в другой рукав список тел меняется, и
     метка прежнего мира остаётся показанной навсегда - её никто
     больше не двигает и никто не прячет. Она и висела за проёмом,
     обрезанная кромкой: штатная проверка ловила «ЛУНА РЕЗЕРВ» и
     «МАРС» на полторы-две сотни точек снаружи. */
  t.когда = now();

  var nd = depth;
  if (!(nd >= 0)) nd = 0; else if (nd > 1) nd = 1;
  nd = Math.round(nd * 50) / 50;          /* шаг 0.02: глазу хватает */
  if (nd !== t.d) {
    t.d = nd;
    st.setProperty("--h-d", nd);
    /* Ближние метки перекрывают дальние. Раскрытая карточка всегда
       наверху - её содержимое читают прямо сейчас. */
    var z = t.open ? 400 : (200 - Math.round(nd * 100));
    if (z !== t.z) { t.z = z; st.zIndex = z; }
  }

  queueDe();
}

/* Разведение считается не чаще раза в кадр и только если что-то
   реально сдвинулось: в спокойной сцене оно не стоит ничего. */
function queueDe() {
  if (!deDirty || deQueued) return;
  deQueued = true;
  g.requestAnimationFrame(declutter);
}

/* ── Сторож забытых меток ─────────────────────────────────────
   Разведение запускается только когда что-то СДВИНУЛОСЬ. Этого
   хватает, пока метки живут: они двигаются каждый кадр. Не хватает
   ровно в том случае, ради которого страховка и написана - когда
   метку перестают ставить вовсе. Тогда двигаться нечему, разведение
   не запускается, и забытая карточка висит за проёмом обрезанной
   сколько угодно долго. Штатная проверка ловила так «МАРС» на 199
   точек и «ЛУНА РЕЗЕРВ» на 166.

   Поэтому отдельный сторож, по времени, а не по движению. Четверть
   секунды - незаметно глазу и достаточно редко, чтобы ничего не
   стоить: показанных меток единицы, и почти всегда сторожу нечего
   делать. */
var сторож = 0;
function сторожить() {
  if (сторож) return;
  сторож = g.setInterval(function () {
    var живых = 0, i;
    for (i = 0; i < ORDER.length; i++) if (ORDER[i].shown) живых++;
    if (!живых) return;
    deDirty = true;
    declutter();
  }, 120);
}

/* ── Перезапуск анимации без пересчёта раскладки ──────────────
   Чтобы CSS-анимация проиграла заново, её надо снять и поставить, а
   между этим заставить браузер признать снятие. Обычный приём -
   прочитать размер узла (`void el.offsetWidth`), и это намеренный
   синхронный пересчёт раскладки.

   Здесь стояла оговорка «чтение допустимо, оно случается один раз на
   появление, а не в кадре». Замер полёта её ОПРОВЕРГ: на этой строке
   семь принудительных пересчётов из четырнадцати, потому что метки
   тел появляются и гаснут на каждом кадре, а `get offsetWidth` в
   профиле полёта стоил 3838 мс собственного времени.

   Тот же результат даёт сброс самой анимации через Web Animations:
   браузер начинает её заново, ничего не пересчитывая. Старым движкам
   оставляем прежний путь - там лучше лишний пересчёт, чем застывшая
   метка. */
function заново(эл, класс) {
  if (!эл) return;
  эл.classList.remove(класс);
  var сброшено = false;
  try {
    if (эл.getAnimations) {
      var а = эл.getAnimations();
      for (var i = 0; i < а.length; i++) а[i].cancel();
      сброшено = true;
    }
  } catch (eЗ) {}
  if (!сброшено) void эл.offsetWidth;
  эл.classList.add(класс);
}

function show(t) {
  var el = t.el;
  /* Метку могли вернуть в кадр прямо посреди растворения - тогда
     она не «доживает», а собирается заново от точки. */
  var dying = !!t.outT;
  if (dying) { clearTimeout(t.outT); t.outT = 0; }
  el.classList.remove("out");
  if (t.shown && !dying) return;
  t.shown = true;
  el.classList.remove("off");
  /* Перезапуск анимации входа - без чтения раскладки, см. заново(). */
  заново(el, "in");
  /* Класс входа снимается после сборки. Анимация с fill: both
     иначе навсегда удержала бы transform и opacity за собой -
     и подъём карточки под курсором просто не сработал бы. */
  if (t.inT) clearTimeout(t.inT);
  t.inT = setTimeout(function () {
    t.inT = 0;
    el.classList.remove("in");
  }, IN_MS);
}

function hide(t) {
  if (!t.shown || t.outT) return;
  var el = t.el;
  if (t.inT) { clearTimeout(t.inT); t.inT = 0; }
  el.classList.remove("in");
  el.classList.add("out");
  /* Пока метка растворяется, она больше не участвует в разговоре:
     ни наведения, ни фиксации. */
  t.mh = false; t.tap = false;
  if (t.pick) { t.pick = false; if (pickedId === t.id) pickedId = null; }
  if (hoverId === t.id) hoverId = null;
  sync(t);
  t.outT = setTimeout(function () {
    t.outT = 0;
    t.shown = false;
    el.classList.add("off");
    el.classList.remove("out");
  }, OUT_MS);
}

/* Мгновенное гашение: без растворения и без задержки.

   Обычное hide растворяет метку за OUT_MS, и всё это время карточка
   остаётся там, где стояла. Для метки, которая не помещается в
   проём, это ровно тот случай, когда ждать нельзя: она держится
   снаружи кромки и обрезается на глазах. Штатная проверка меток
   ловила именно её - подпись САТУРНа на 167 точек за проёмом, уже
   гаснущую, но ещё измеримую. */
function сразуСкрыть(t) {
  if (!t.shown) return;
  var el = t.el;
  if (t.inT) { clearTimeout(t.inT); t.inT = 0; }
  if (t.outT) { clearTimeout(t.outT); t.outT = 0; }
  t.mh = false; t.tap = false;
  if (t.pick) { t.pick = false; if (pickedId === t.id) pickedId = null; }
  if (hoverId === t.id) hoverId = null;
  el.classList.remove("in", "out");
  el.classList.add("off");
  t.shown = false;
  sync(t);
}

/* ── Разведение ──────────────────────────────────────────────
   Две метки рядом читаются как одна каша, поэтому нижняя по
   важности уезжает выше на длину своей выноски. Считаем не в
   кадре, а раз на кадр и только по факту сдвига: даже двадцать
   четыре метки здесь стоят меньше, чем один лишний layout.

   Приоритет у ближних: их позиция остаётся честной, отодвигаются
   дальние - глаз и так считает их фоном. */
function declutter() {
  deQueued = false;
  deDirty = false;

  var list = [], i, j, t;
  for (i = 0; i < ORDER.length; i++) {
    t = ORDER[i];
    if (t.vis && t.shown) list.push(t);
  }
  list.sort(byDepth);
  /* Сколько меток вообще показывать. Двадцать четыре это потолок для
     монитора; на телефоне столько подписей в проём не помещаются ни
     при каком разведении - подъём упирается в потолок LIFT_MAX, и
     дальние метки садятся друг на друга. Замер на ПК дал до
     одиннадцати пересечений разом, крупнейшее 89 на 10 точек.

     Считаем по месту: сколько строк карточек влезает в высоту слоя
     при нормальном зазоре, столько меток и ведём. Ближние остаются
     всегда - список уже отсортирован по глубине. */
  var влезет = MAXN;
  if (layerH > 0) влезет = Math.max(6, Math.floor(layerH / (NEAR_Y * 1.35)));
  if (влезет > MAXN) влезет = MAXN;
  if (list.length > влезет) list.length = влезет;

  for (i = 0; i < list.length; i++) {
    t = list[i];

    /* Карточка растёт вправо от объекта. У правого края кадра она
       уехала бы за границу слоя и обрезалась - там метка
       перекидывается на другую сторону выноски. */
    var wt = span(t);
    /* Сторону выноски выбирает place, когда полёт передал границы
       проёма: там же считается и клип, и решать это двумя местами
       нельзя - раскачивается. Границ нет - работаем по слою, как
       работали всегда. */
    if (!(огрП > огрЛ)) {
      var flip = layerW > CARD_W + 24 && (t.x + wt) > layerW - 6;
      if (flip && (t.x - wt) < 6) flip = false;
      if (flip !== t.flip) {
        t.flip = flip;
        t.el.classList.toggle("flip", flip);
      }
    }

    var lift = 0, guard = 0, again = true;
    /* Подняли метку - она могла заехать под следующую, поэтому
       проходов несколько. Guard страхует от качелей на плотной
       группе объектов. */
    while (again && guard++ < 8) {
      again = false;
      for (j = 0; j < i; j++) {
        var o = list[j];
        /* Честное пересечение отрезков по горизонтали: сравнивать
           одни только точки объектов мало - карточки длинные, и
           дальняя пара разъезжается совсем не там, где ближняя. */
        var lt = t.flip ? t.x - wt : t.x, rt = lt + wt;
        var wo = span(o);
        var lo = o.flip ? o.x - wo : o.x, ro = lo + wo;
        if (rt < lo || ro < lt) continue;
        var k = 1 - (t.d < o.d ? t.d : o.d) * SCALE_K;
        var gap = ((t.open || o.open) ? OPEN_Y : NEAR_Y) * k;
        var mine = t.y - lift, his = o.y - o.lift;
        var dy = mine - his;
        if (dy < 0) dy = -dy;
        if (dy < gap) { lift = t.y - his + gap; again = true; }
      }
    }
    if (lift < 0) lift = 0; else if (lift > LIFT_MAX) lift = LIFT_MAX;
    lift = Math.round(lift);
    if (lift !== t.lift) {
      t.lift = lift;
      t.el.style.setProperty("--h-lh", BASE_LH + lift);
    }
  }

  /* ── Последняя проверка: по настоящим границам ─────────────
     Выше место считалось по числам: ширина карточки, длина выноски,
     запас на ореол. Числа эти верны в среднем и неверны в частности -
     у метки-предупреждения ореол больше, у раскрытой карточки другая
     высота, у мелкой глубины другой масштаб. Штатная проверка ловила
     остаток то на Юпитере, то на Сатурне, то на чёрной дыре, от
     прогона к прогону по-разному.

     Здесь мы уже после раскладки, и можно спросить браузер, где
     метка стоит НА САМОМ ДЕЛЕ. Спрашиваем только у показанных, а их
     единицы, и только здесь - разведение и так считается не чаще
     раза в кадр. Что не помещается - гасим сразу.

     Это не замена расчёту выше: тот выбирает сторону и не даёт
     метке метаться. Это его страховка на случаи, которых он не
     знает. */
  /* Проход идёт ВСЕГДА, а не только когда полёт прислал границы.
     Здесь была ошибка: весь блок стоял под условием наличия границ,
     и на мониторе, где рубка плоская и границы не публикуются,
     страховка не работала совсем - проверка меток падала на ПК
     каждый прогон. Давность метки к границам отношения не имеет. */
  {
    var сдв = LAYER ? LAYER.getBoundingClientRect() : null;
    /* Идём по ВСЕМ показанным, а не по списку разведения. В списке
       только живые метки, а обрезается чаще всего гаснущая: она уже
       не участвует в раскладке, но ещё нарисована и всё это время
       стоит там, где её застало исчезновение. Штатная проверка
       ловила именно такую - «ЛУНА РЕЗЕРВ» на 166 точек за проёмом. */
    var сейчас = now();
    for (i = 0; i < ORDER.length; i++) {
      t = ORDER[i];
      if (!t.shown) continue;
      /* Метку не ставили почти полсекунды - её тела в кадре больше
         нет. Гасим, не разбираясь в границах: висеть ей всё равно
         не за что. */
      if (t.когда && сейчас - t.когда > 200) { t.vis = false; сразуСкрыть(t); continue; }
      var уз = t.el.querySelectorAll(".rch-body, .rch-halo, .rch-glow");
      var лн = 1e9, вн = 1e9, пн = -1e9, нн = -1e9, есть = false;
      for (j = 0; j < уз.length; j++) {
        var rr = уз[j].getBoundingClientRect();
        if (!(rr.width > 0.5)) continue;
        есть = true;
        if (rr.left < лн) лн = rr.left;
        if (rr.top < вн) вн = rr.top;
        if (rr.right > пн) пн = rr.right;
        if (rr.bottom > нн) нн = rr.bottom;
      }
      if (!есть || !сдв) continue;
      if (!(огрП > огрЛ) && !(огрН > огрВ)) continue;
      /* Границы хранятся в координатах слоя, рамки браузер отдаёт в
         координатах экрана - приводим к одному началу отсчёта. */
      var вылет = 0;
      if (огрП > огрЛ) {
        вылет = Math.max(вылет, (огрЛ + сдв.left) - лн, пн - (огрП + сдв.left));
      }
      if (огрН > огрВ) {
        вылет = Math.max(вылет, (огрВ + сдв.top) - вн, нн - (огрН + сдв.top));
      }
      if (вылет > 1) { t.vis = false; сразуСкрыть(t); }
      /* Порог в единицу, а не в ноль: рамка и метка считаются
         разными путями, и на дробном масштабе расходятся на доли
         точки. */
    }
  }
}

/* Ширина метки на экране с учётом глубины */
function span(t) {
  var d = t.d < 0 ? 0.5 : t.d;
  return CARD_W * (1 - d * SCALE_K);
}

function byDepth(a, b) { return a.d - b.d; }

/* ── Состояния ───────────────────────────────────────────────*/

/* Раскрытость метки складывается из четырёх независимых причин.
   Держим их отдельными флагами, чтобы уход мыши не гасил подсветку
   сканером, а сканер не снимал фиксацию кликом. */
function sync(t) {
  var open = t.mh || t.beam || t.tap || t.pick;
  if (open === t.open) {
    t.el.classList.toggle("pick", !!t.pick);
    return;
  }
  t.open = open;
  t.el.classList.toggle("on", open);
  t.el.classList.toggle("pick", !!t.pick);
  var z = open ? 400 : (200 - Math.round((t.d < 0 ? 0.5 : t.d) * 100));
  if (z !== t.z) { t.z = z; t.el.style.zIndex = z; }
  /* Раскрывшаяся карточка выросла втрое - соседям надо разойтись */
  deDirty = true;
  queueDe();
}

function hover(id, on) {
  var t = TAGS[id];
  if (!t) return;
  on = !!on;
  if (t.beam === on) return;
  t.beam = on;
  if (on) sound("uiHover");
  sync(t);
}

/* Раскрытые пальцем карточки закрываются все, кроме указанной:
   на тач-экране «увести палец» некуда. */
function closeTaps(keep) {
  for (var i = 0; i < ORDER.length; i++) {
    var t = ORDER[i];
    if (t !== keep && t.tap) { t.tap = false; sync(t); }
  }
}

function pick(t) {
  if (!t || !t.shown) return;

  /* Повторный клик по зафиксированной метке снимает фиксацию:
     иначе выбранную цель нечем было бы отпустить. */
  if (t.pick) {
    t.pick = false;
    if (pickedId === t.id) pickedId = null;
  } else {
    if (pickedId && TAGS[pickedId] && TAGS[pickedId] !== t) {
      var prev = TAGS[pickedId];
      prev.pick = false;
      sync(prev);
    }
    t.pick = true;
    pickedId = t.id;
  }
  sync(t);

  /* Вспышка и кольцо. Класс снимаем по таймеру - анимация должна
     иметь возможность запуститься заново на следующем клике. */
  if (t.popT) clearTimeout(t.popT);
  заново(t.el, "pop");
  t.popT = setTimeout(function () {
    t.popT = 0;
    t.el.classList.remove("pop");
  }, POP_MS);

  sound("uiClick");

  /* Действие метки - дело игры. Функцию зовём сами, всё остальное
     уходит подписчикам вместе с id. */
  var act = t.opts && t.opts.action;
  if (typeof act === "function") {
    try { act(t.id, t.opts); } catch (e) {}
  }
  for (var i = 0; i < SUBS.length; i++) {
    try { SUBS[i](t.id, t.opts); } catch (err) {}
  }
}

/* ── События ─────────────────────────────────────────────────*/

function onOver(e) {
  /* Наведение - только мышь. У пальца и пера pointerover приходит
     вместе с касанием, и карточка раскрывалась бы дважды. */
  if (e.pointerType && e.pointerType !== "mouse") return;
  var t = tagOf(e.target);
  if (!t || t.mh) return;
  t.mh = true;
  hoverId = t.id;
  sync(t);
  sound("uiHover");
}

function onOut(e) {
  if (e.pointerType && e.pointerType !== "mouse") return;
  var t = tagOf(e.target);
  if (!t || !t.mh) return;
  /* Переход между кнопкой и карточкой внутри одной метки уходом
     не считается. */
  if (e.relatedTarget && tagOf(e.relatedTarget) === t) return;
  t.mh = false;
  if (hoverId === t.id) hoverId = null;
  sync(t);
}

function onDown(e) {
  var t = tagOf(e.target);
  if (!t) return;
  t.downAt = now();

  if (e.pointerType && e.pointerType !== "mouse" && !t.tap) {
    /* Первое касание раскрывает: человек должен увидеть, что он
       выбирает, до того как это случится. */
    closeTaps(t);
    t.tap = true;
    sync(t);
    sound("uiHover");
    return;
  }
  pick(t);
}

function onClick(e) {
  var t = tagOf(e.target);
  if (!t) return;
  /* Клик после pointerdown уже отработан. Сюда доходит только
     клавиатура: Enter и пробел на кнопке метки. */
  if (t.downAt && now() - t.downAt < 700) return;
  pick(t);
}

function onFocus(e) {
  var t = tagOf(e.target);
  if (!t || t.mh) return;
  t.mh = true;
  hoverId = t.id;
  sync(t);
}

function onBlur(e) {
  var t = tagOf(e.target);
  if (!t) return;
  if (e.relatedTarget && tagOf(e.relatedTarget) === t) return;
  t.mh = false;
  if (hoverId === t.id) hoverId = null;
  sync(t);
}

function onDocDown(e) {
  if (tagOf(e.target)) return;
  closeTaps(null);
}

/* ── Контракт ────────────────────────────────────────────────
   RC_HOLO.init(host)                    - слой внутри оверлея игры
   RC_HOLO.add(id, {title, subtitle, info, kind, action})
                                         - kind: node|planet|station|relay|warn|gate
   RC_HOLO.remove(id)
   RC_HOLO.place(id, x, y, depth, visible)
                                         - x,y в пикселях слоя, depth 0..1 (0 - близко)
   RC_HOLO.hover(id, on)                 - подсветка извне (луч сканера)
   RC_HOLO.clear()
   RC_HOLO.onPick(fn)                    - fn(id, opts) на клике или тапе
   RC_HOLO.state()                       - снимок состояния для отладки
   ═══════════════════════════════════════════════════════════ */
g.RC_HOLO = {
  init: function (host) { return init(host); },
  add: function (id, opts) { add(id, opts); },
  remove: function (id) { remove(id); },
  place: function (id, x, y, depth, visible) { place(id, x, y, depth, visible); },
  /* Полезные границы по горизонтали в пикселях кадра. Полёт передаёт
     сюда проём окна рубки: именно им карточки и режутся. Ноль или
     перевёрнутая пара возвращают прежнее поведение по ширине слоя. */
  bounds: function (l, r, в, н) {
    /* Полёт присылает границы проёма в координатах ЭКРАНА, а метки
       ставит в координатах слоя. Слой лежит ровно по остеклению и
       его левый край сам сдвинут - на телефоне заказчика на 57
       точек. Без пересчёта прижим срабатывал на эти же 57 точек
       правее, и подписи всё равно упирались в стойку: «ЗЕМЛ» вместо
       «ЗЕМЛЯ», «АСТЕРОИ» вместо «АСТЕРОИДНЫЙ ПОЯС». Разница ровно в
       системе координат, а не в самих числах. */
    var сдвиг = 0;
    if (LAYER) { try { сдвиг = LAYER.getBoundingClientRect().left; } catch (eС) {} }
    огрЛ = (+l || 0) - сдвиг;
    огрП = (+r || 0) - сдвиг;
    if (огрП <= огрЛ) { огрЛ = 0; огрП = 0; }
    /* По вертикали пересчёт свой: слой сдвинут и по верху тоже.
       Считать его тем же числом нельзя - у остекления левый край и
       верхний край сдвинуты на разные величины. */
    var сдвигВ = 0;
    if (LAYER) { try { сдвигВ = LAYER.getBoundingClientRect().top; } catch (eВ) {} }
    огрВ = (+в || 0) - сдвигВ;
    огрН = (+н || 0) - сдвигВ;
    if (огрН <= огрВ) { огрВ = 0; огрН = 0; }
    /* Карточка занимает большую часть проёма, но не весь: за ней
       ещё выноска, а рядом обычно стоит вторая метка. Было 0.62, и
       на телефоне в карточку не влезало даже «PROXIMA b» - имя из
       девяти знаков обрывалось многоточием. */
    var w = огрП > огрЛ ? огрП - огрЛ : layerW;
    CARD_W = w > 0 ? Math.max(132, Math.min(CARD_MAX, Math.round(w * 0.74))) : CARD_MAX;
    if (LAYER) LAYER.style.setProperty("--rch-w", (CARD_W - 24) + "px");
  },
  hover: function (id, on) { hover(id, on); },
  clear: function () { clear(); },
  onPick: function (fn) { if (typeof fn === "function") SUBS.push(fn); },
  state: function () {
    var shown = 0;
    for (var i = 0; i < ORDER.length; i++) if (ORDER[i].shown) shown++;
    return {
      ready: !!LAYER,
      count: ORDER.length,
      shown: shown,
      max: MAXN,
      hover: hoverId,
      picked: pickedId,
      reduced: reduced,
      /* Границы проёма и ширина карточки: по ним видно, работает ли
         вообще прижим меток к остеклению */
      огрЛ: огрЛ, огрП: огрП, CARD_W: CARD_W, layerW: layerW
    };
  }
};

})(window);
