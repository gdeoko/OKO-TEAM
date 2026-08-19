/* ═══════════════════════════════════════════════════════════
   Rocket CDN · сцена D: тамбур и рубка корабля

   Вторая половина фильма происходит внутри ракеты. Камера входит
   в люк: створки тамбура перекрывают кадр, и ровно под ними
   наружная сцена гасится, а внутренняя поднимается. Это
   единственное место на сайте, где мы имеем право чуть
   притормозить человека.

   Дальше прокрутка раскладывается в полный оборот по рубке, а на
   выходе камера возвращается к пульту, за которым лежит анкета.

   Главное, ради чего файл переписан: раньше рубка вращалась сама
   по себе, а карточки содержимого жили отдельной жизнью, и было
   видно, что текст просто едет вниз поверх картинки. Теперь
   поворот камеры - единственный источник правды. Он объявлен
   наружу (yaw), расписан по остановкам (plan) и умеет считать
   экранную точку любой панели (project). Кинематограф из
   rc-cinema.js берёт эти же числа и ставит карточки ровно на те
   панели, мимо которых едет камера. Стены и содержимое двигаются
   одним движением, потому что движение одно.

   Оборот разложен по остановкам, между остановками - синусная
   кривая. У неё нулевая производная на концах, поэтому камера
   сама замирает напротив каждой панели: это и есть полка чтения
   из сценария, только без ручных полок в коде.

   Модели у нас нет и не будет: всё построено процедурно прямо
   здесь. Причина простая - готовый glb с текстурами это триста-
   пятьсот килобайт в критическом пути ради двадцати секунд экрана,
   а процедурная рубка весит ноль байт и грузится мгновенно.

   Бюджет контекстов соблюдаем строго: если свободного слота нет,
   в тамбуре мы забираем слот у наружной сцены - она в этот момент
   всё равно больше не нужна, мы внутри ракеты.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var T = null;                    /* three.js, появляется вместе с объёмным слоем */
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var TAU = Math.PI * 2;
/* Угол, на котором в рубке стоит приборная панель. Он же публикуется
   для слоя кабины (rc-cockpit), чтобы картинка пульта и поворот
   камеры считались от одного числа и не могли разъехаться. */
var TH_CON = -0.62;

/* ── Палитра рубки: единственный источник цвета ───────────────
   Раньше объёмная рубка, снимок пульта и стили формы красились
   каждый своим набором чисел. Из-за этого три соседних кадра -
   салон, пульт, кабина игры - читались как три разных сайта: у них
   не совпадали ни цвет стен, ни цветовая температура света.

   Теперь цвет объявлен ровно один раз здесь и тем же составом
   уходит в CSS (--int-*), поэтому оформление пульта физически не
   может разойтись с рубкой по тону: они берут одни и те же числа.
   Для полупрозрачных заливок рядом публикуется тройка каналов
   (--int-*-rgb), её удобно подставлять внутрь rgba(). */
var COL = {
  deep:  0x050C15,   /* дальний воздух и туман, самый тёмный тон */
  hull:  0x0A1524,   /* обшивка, корпуса приборов */
  wall:  0x0E1D2E,   /* стеновая панель рубки */
  panel: 0x14283D,   /* лицевая плита прибора, фон экранов */
  emis:  0x123C5C,   /* внутреннее свечение плиты */
  cyan:  0x42B2DC,   /* фирменный циан: швы, кромки, диоды */
  vio:   0x8A59F6,   /* фирменный фиолет: тёплая подсветка */
  lit:   0xCFE9F5    /* свет из остекления, холодный */
};

function hex6(n) {
  var s = n.toString(16);
  while (s.length < 6) s = "0" + s;
  return "#" + s;
}

/* Отдаём палитру в CSS сразу при загрузке файла, не дожидаясь
   сборки сцены: оформление секции контактов обязано быть в тон даже
   если объёмный слой ещё не поднялся или не поднимется вовсе. */
function paintCSS() {
  var s = root.style, k, v;
  for (k in COL) {
    if (!COL.hasOwnProperty(k)) continue;
    v = COL[k];
    s.setProperty("--int-" + k, hex6(v));
    s.setProperty("--int-" + k + "-rgb",
      ((v >> 16) & 255) + "," + ((v >> 8) & 255) + "," + (v & 255));
  }
}
paintCSS();

/* Геометрия рубки. Восемь стеновых панелей по кругу: на первых
   четырёх стоят карточки надёжности, на пятой - бортовой
   справочник с вопросами, остальные держат стену, чтобы при
   обороте в кадре не было глухого места. */
var PANELS = 8;
var STEP = TAU / PANELS;         /* сорок пять градусов на остановку */
var R_WALL = 2.52;               /* радиус, на котором висят панели */
var H_WALL = 1.75;               /* высота их центра над полом */
var EYE = 1.6;                   /* глаза человека, он же центр круга */

/* Пороги сцены. В сценарии они записаны процентами прокрутки, но
   проценты живут ровно до первой правки текста: добавили абзац -
   и рубка начинается посреди сценариев применения. Поэтому проценты
   мы считаем из настоящих позиций блоков, которые переехали внутрь
   корабля: надёжность, вопросы, форма. Числа из сценария остаются
   запасным вариантом на случай, если блоков вдруг нет. */
var P_PREP = 0.58;               /* с этого места начинаем строить */
var P_LOCK = 0.72;               /* тамбур */
var P_IN   = 0.76;               /* мы внутри */
var P_TURN = 0.88;               /* оборот закончен, дальше пульт */
var P_CON  = 0.965;              /* камера доехала до пульта, анкета в кадре */
var P_OUT  = 0.999;              /* конец сцены: дальше игра */

/* Расписание оборота: узлы вида [доля прокрутки, поворот в радианах].
   Между узлами идёт синусная кривая, в самих узлах камера стоит.
   Узел - это панель, напротив которой человек читает. */
var KNOT = [];
var PLAN = { step: STEP, rel: [], faq: STEP * 4.5, con: TAU, n: 4 };

function relCards() {
  var n = doc.querySelectorAll("#reliability .card").length;
  return n > 0 ? n : 4;
}

function measure() {
  var maxS = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
  var rel = doc.getElementById("reliability");
  var con = doc.getElementById("contact");
  if (!rel || !con) return;
  var faq = doc.getElementById("faq");
  var y = g.pageYOffset || doc.documentElement.scrollTop || 0;
  var relBox = rel.getBoundingClientRect();
  var conBox = con.getBoundingClientRect();
  var relTop = relBox.top + y, relBot = relBox.bottom + y;
  var conTop = conBox.top + y, conBot = conBox.bottom + y;

  /* Люк начинает закрываться за половину экрана до блока надёжности */
  P_IN   = Math.max(0.05, Math.min(0.95, (relTop - innerHeight * 0.45) / maxS));
  P_LOCK = Math.max(0.03, P_IN - (innerHeight * 0.4) / maxS);
  P_TURN = Math.max(P_IN + 0.02, Math.min(0.985, (conTop - innerHeight * 0.4) / maxS));
  /* Подход к пульту заканчивается вместе с формой: дальше по
     сценарию камера не едет вперёд, а отступает. */
  P_CON  = Math.max(P_TURN + 0.01, Math.min(0.994, (conBot - innerHeight * 0.2) / maxS));
  /* А наружу мы не выходим вовсе. Раньше сцена заканчивалась на
     форме, и эпилог играл уже на улице: в кадре снова летела
     ракета, а кнопка старта висела на фоне сайта. Клиент назвал
     это нелогичным, и он прав - мы сидим внутри этой ракеты.
     Поэтому рубка держится до конца эпилога, а сам эпилог мы
     смотрим сквозь остекление кабины. */
  var epi = doc.getElementById("epilogue");
  var outBase = conBot;
  if (epi) {
    var eBox = epi.getBoundingClientRect();
    outBase = eBox.bottom + y;
  }
  /* Эпилог - последняя секция страницы, и низа у сцены попросту нет:
     докрутив до самого дна, человек всё ещё сидит в кресле корабля.
     Раньше порог стоял чуть выше конца документа, и на последних
     пикселях прокрутки рубка выключалась - в кадре снова появлялась
     ракета, из которой мы по сценарию не выходили. Поэтому с
     эпилогом выход вниз закрыт совсем: наружу можно только назад,
     обратной прокруткой через люк. */
  P_OUT = epi
    ? 1.0001
    : Math.max(P_CON + 0.004, Math.min(0.9995, (outBase - innerHeight * 0.1) / maxS));
  P_PREP = Math.max(0.2, P_LOCK - 0.12);
  /* Ракета обязана приземлиться до того, как мы войдём в люк:
     заходить внутрь корабля, который ещё летит, странно. */
  g.RC_LAND_AT = P_LOCK;

  /* ── Узлы оборота ──────────────────────────────────────────
     Карточки надёжности разложены по своему блоку, справочник
     вопросов - по своему, остаток оборота уходит на подход к
     пульту. Считаем от настоящих прямоугольников: правка текста
     сдвигает узлы вместе с содержимым, а не ломает раскладку. */
  var n = relCards();
  PLAN.n = n;
  PLAN.rel = [];
  /* Отступы сверху и снизу не декоративные. Кольцо карточек
     держится в середине кадра не весь блок, а пока обёртка идёт
     мимо: до и после этого оно едет вместе со страницей. Узлы
     обязаны уложиться внутрь этого отрезка, иначе последняя
     панель встаёт напротив человека уже после того, как кольцо
     отпустили, и текст читается на отъезжающей стене. */
  var relA = (relTop + innerHeight * 0.22) / maxS;
  var relB = (relBot - innerHeight * 0.85) / maxS;
  if (relB - relA < 0.004) relB = relA + 0.004;

  KNOT = [[P_IN, 0]];
  for (var i = 0; i < n; i++) {
    var a = (i + 0.5) * STEP;
    PLAN.rel.push(a);
    KNOT.push([relA + ((i + 0.5) / n) * (relB - relA), a]);
  }

  PLAN.faq = (n + 0.5) * STEP;
  if (faq) {
    var fb = faq.getBoundingClientRect();
    var fTop = fb.top + y, fBot = fb.bottom + y;
    KNOT.push([(fTop + (fBot - fTop) * 0.35 - innerHeight * 0.15) / maxS, PLAN.faq]);
    /* Круг обязан замкнуться ДО подхода к пульту: раньше последняя
       четверть оборота доигрывалась уже в акте пульта, и два
       движения накладывались друг на друга - зритель не получал ни
       законченного оборота, ни спокойного подхода к панели. */
    KNOT.push([(fBot - innerHeight * 0.55) / maxS, TAU]);
  }

  PLAN.con = TAU;
  /* В акте пульта камера уже никуда не поворачивается: она только
     подступает к панели (этим занимается dolly ниже) */
  /* Круг замыкается не на направлении входа, а на пульте: он стоит
     в своём углу рубки (TH_CON), и человек, обойдя салон взглядом,
     доворачивается именно к нему. Раньше оборот заканчивался ровно
     там же, откуда начался, и панель оказывалась перед глазами уже
     на входе - клиент справедливо сказал, что так не бывает: пульт
     это предмет обстановки, а не интерфейс поверх кадра. */
  KNOT.push([P_TURN, TAU + TH_CON]);
  KNOT.push([P_CON, TAU + TH_CON + 0.05]);

  /* Узлы обязаны идти строго по возрастанию: иначе на коротком
     блоке камера дёрнется назад посреди сектора. */
  for (i = 1; i < KNOT.length; i++) {
    if (KNOT[i][0] <= KNOT[i - 1][0]) KNOT[i][0] = KNOT[i - 1][0] + 0.0008;
  }
}

/* Поворот камеры для любой точки страницы. Одна функция на весь
   сайт: и сцена, и карточки спрашивают именно её. */
function yawAt(p) {
  if (!KNOT.length) return 0;
  if (p <= KNOT[0][0]) return KNOT[0][1];
  var last = KNOT.length - 1;
  if (p >= KNOT[last][0]) return KNOT[last][1];
  for (var i = 1; i <= last; i++) {
    if (p > KNOT[i][0]) continue;
    var p0 = KNOT[i - 1][0], p1 = KNOT[i][0];
    var t = (p - p0) / Math.max(1e-6, p1 - p0);
    /* Синус: на концах отрезка скорость ноль, значит камера сама
       останавливается напротив панели и текст успевают прочитать */
    var e = 0.5 - 0.5 * Math.cos(Math.PI * t);
    return KNOT[i - 1][1] + e * (KNOT[i][1] - KNOT[i - 1][1]);
  }
  return KNOT[last][1];
}

var st = {
  built: false, shown: false, slot: false, dead: false,
  p: 0, yaw: 0, yawT: 0, yawOff: 0, pitch: 0, pitchT: 0, drift: 0,
  dolly: 1.7, dollyT: 1.7, fov: 58, fovT: 58, stop: -1, con: 0, conL: 0,
  back: 0,                       /* доля отъезда от пульта в финале */
  roll: 0, yawPrev: 0,           /* крен камеры на повороте */
  sLock: false, sIn: false
};

var cv = null, rend = null, scene = null, cam = null, grp = null;
var lamp = null, planet = null, halo = null, diodes = [], anchors = [], lock = null;
var deskLight = null, winMesh = null, air = null;
/* Мелочь, которую снимают на слабых машинах: балки, поручень,
   световые пятна. Собираем в один список, чтобы гасить одним махом. */
var fine = [];
var raf = null, lastTs = 0;

var phone = innerWidth < 760;
/* Узкий экран и слабое железо - разные вещи, а раньше в этом файле
   они были одним и тем же: по флагу phone рубка собиралась грубее -
   меньше сегментов у стен и иллюминаторов, шесть потолочных балок
   вместо десяти, один жгут вместо двух. Владелец сравнил телефон с
   монитором и сказал, что так быть не должно: отличаться могут
   только раскладка и размеры под экран.

   Поэтому детализацию режем только на действительно слабом железе,
   а телефонный бюджет добираем разрешением буфера. Вершины дёшевы,
   в отличие от пикселей: гранёная стена видна сразу, а чуть меньшая
   чёткость на плотном экране - почти нет. */
var tiny = (navigator.deviceMemory || 4) <= 2 ||
           (navigator.hardwareConcurrency || 4) <= 2;

/* ── Постановка камеры под устройство ────────────────────────
   На телефоне кадр вертикальный, а угол объектива у перспективной
   камеры задан по вертикали: при том же числе по горизонтали видно
   вдвое меньше, и стеновая панель шириной 1,9 метра просто не
   влезает в кадр - экран «наезжает» на человека. Лечим двумя
   числами сразу: раскрываем объектив и отодвигаем камеру от стены,
   то есть ставим человека не в самый центр круга, а чуть позади.

   Отход от центра нужен и на мониторе, но по другой причине: пока
   камера стоит ровно в оси вращения, поворот не даёт параллакса -
   ближние стойки и дальняя стена едут с одной скоростью, и рубка
   читается нарисованной панорамой, а не помещением. */
function restDolly() { return phone ? 0.86 : 0.34; }
function fovIn()     { return phone ? 84 : 72; }
function fovTamb()   { return phone ? 66 : 58; }

function snd() {
  var s = g.RC_SOUND;
  return (s && s.on) ? s : null;
}

/* ── Процедурные текстуры ────────────────────────────────────
   Рисуем обычным двумерным холстом. Обшивка с поясами, решётчатый
   настил, приборные стойки, вентиляция: всё это дешевле нарисовать,
   чем привезти картинкой, и весит ноль байт в критическом пути.

   Общее правило всех текстур здесь: свет в рубке идёт сверху, из
   потолочной ниши. Значит верхние грани светлые, нижние тёмные, а
   яркость падает к полу. Пока этот договор соблюдается на каждой
   поверхности, глаз собирает из плоских картинок объём. */
var texCache = {};

function cnv(w, h) {
  var c = doc.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/* Обшивка рубки. Раньше это была ровная плитка с болтами, из-за
   чего цилиндр читался трубой, обклеенной обоями: не было ни низа,
   ни верха. Теперь у стены три пояса - тёмный плинтус, рабочий пояс
   ниш и светлый карниз под потолком, - и сквозной вертикальный
   градиент. Он и даёт стене верх и низ. */
function hullTex() {
  var W = 512, H = 512;
  var c = cnv(W, H), x = c.getContext("2d");

  var gr = x.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0.00, "#14283d");   /* карниз: сюда бьёт потолочный свет */
  gr.addColorStop(0.16, "#0d1e30");
  gr.addColorStop(0.52, "#081524");
  gr.addColorStop(0.86, "#050d18");
  gr.addColorStop(1.00, "#03080f");   /* плинтус у самого настила */
  x.fillStyle = gr; x.fillRect(0, 0, W, H);

  /* Вертикальные ребра жёсткости. Идут через всю высоту и держат
     форму цилиндра: без них стена гнётся на глаз как бумага. */
  var rib = 64, i, y;
  for (i = 0; i < W; i += rib) {
    x.fillStyle = "rgba(150,186,214,.055)";
    x.fillRect(i, 0, 3, H);
    x.fillStyle = "rgba(3,8,15,.55)";
    x.fillRect(i + 3, 0, 4, H);
  }

  /* Горизонтальные пояса: карниз, рабочий пояс, плинтус. Каждый
     отбит светлой верхней кромкой и тенью снизу - это и есть фаска. */
  var belts = [[0, 74], [96, 300], [330, 452], [452, H]];
  for (i = 0; i < belts.length; i++) {
    y = belts[i][0];
    x.fillStyle = "rgba(150,186,214,.10)";
    x.fillRect(0, y, W, 2);
    x.fillStyle = "rgba(2,6,12,.7)";
    x.fillRect(0, belts[i][1] - 3, W, 3);
  }

  /* Технические надписи и трафареты. Мелкие, почти нечитаемые: они
     работают масштабом, а не смыслом - по ним видно размер стены. */
  x.fillStyle = "rgba(150,186,214,.16)";
  for (i = 0; i < 26; i++) {
    var tx = 18 + (i % 7) * 72, ty = 120 + Math.floor(i / 7) * 68;
    x.fillRect(tx, ty, 4 + (i % 5) * 3, 3);
    x.fillRect(tx, ty + 6, 12 + (i % 3) * 8, 2);
  }

  /* Крепёж по поясам, а не вразнобой: болты стоят рядами */
  x.fillStyle = "rgba(190,214,232,.13)";
  for (i = 20; i < W; i += 64) {
    var rows = [40, 322, 470];
    for (y = 0; y < rows.length; y++) {
      x.beginPath(); x.arc(i, rows[y], 2.2, 0, 6.283); x.fill();
    }
  }

  /* Фирменный шов: одна циановая нитка по низу карниза. Одна, а не
     через каждый ряд - иначе стена становится полосатой тряпкой. */
  x.fillStyle = "rgba(66,178,220,.42)";
  x.fillRect(0, 88, W, 2);

  var tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

/* Решётчатый настил. Смысл решётки не в узоре: сквозь неё видно
   тёмный провал подпола, и пол перестаёт быть заливкой - у него
   появляется толщина. */
function deckTex() {
  var S = 256;
  var c = cnv(S, S), x = c.getContext("2d");
  x.fillStyle = "#03070d"; x.fillRect(0, 0, S, S);

  var cell = 32, i;
  for (i = 0; i < S; i += cell) {
    /* Пруток: тёмное тело и светлая верхняя грань */
    x.fillStyle = "#152431"; x.fillRect(i, 0, 9, S);
    x.fillStyle = "#152431"; x.fillRect(0, i, S, 7);
    x.fillStyle = "rgba(186,212,232,.20)"; x.fillRect(i, 0, 2.5, S);
    x.fillStyle = "rgba(186,212,232,.14)"; x.fillRect(0, i, S, 2);
    x.fillStyle = "rgba(0,0,0,.6)"; x.fillRect(i + 7, 0, 2, S);
  }
  /* Противоскользящая насечка по пруткам */
  x.fillStyle = "rgba(0,0,0,.35)";
  for (i = 0; i < S; i += 6) x.fillRect(0, i, S, 1);

  var tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/* Лицевая плита приборной стойки. Ею закрываем те панели круга, на
   которых не висит содержимое: при полном обороте в кадре не должно
   быть глухой стены, а вешать туда ещё карточек некуда. */
function rackTex() {
  var W = 256, H = 192;
  var c = cnv(W, H), x = c.getContext("2d");
  var gr = x.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#132639"); gr.addColorStop(1, "#070f1a");
  x.fillStyle = gr; x.fillRect(0, 0, W, H);

  var i, j;
  /* Ряды приборных модулей с фаской */
  for (j = 0; j < 4; j++) {
    for (i = 0; i < 3; i++) {
      var px = 12 + i * 80, py = 14 + j * 44;
      x.fillStyle = "rgba(8,18,30,.9)"; x.fillRect(px, py, 68, 32);
      x.fillStyle = "rgba(150,186,214,.14)"; x.fillRect(px, py, 68, 1);
      x.fillStyle = "rgba(0,0,0,.7)"; x.fillRect(px, py + 31, 68, 1);
      /* Экранчик и шкала: холодный свет приборов */
      x.fillStyle = "rgba(66,178,220,.30)"; x.fillRect(px + 6, py + 7, 30, 18);
      x.fillStyle = "rgba(66,178,220,.55)";
      for (var k = 0; k < 5; k++) x.fillRect(px + 44, py + 8 + k * 4, 4 + (k % 3) * 6, 2);
    }
  }
  /* Пара тёплых диодов на стойку: холодный кадр обязан иметь
     хотя бы одну тёплую точку, иначе он читается мёртвым */
  x.fillStyle = "rgba(138,89,246,.75)";
  x.fillRect(20, 176, 5, 5); x.fillRect(96, 176, 5, 5);

  var tex = new T.CanvasTexture(c);
  return tex;
}

function screenTex() {
  if (texCache.screen) return texCache.screen;
  var W = 256, H = 192;
  var c = cnv(W, H), x = c.getContext("2d");
  var gr = x.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, "#0e2237"); gr.addColorStop(0.55, "#0a1a2b"); gr.addColorStop(1, "#061220");
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  var i;
  /* Развёртка: тонкие строки, как у выключенного монитора */
  x.fillStyle = "rgba(120,170,205,.05)";
  for (i = 0; i < H; i += 4) x.fillRect(0, i, W, 1);
  /* Сетка координат: по ней видно размер плиты */
  x.strokeStyle = "rgba(66,178,220,.09)"; x.lineWidth = 1;
  for (i = 32; i < W; i += 32) { x.beginPath(); x.moveTo(i, 8); x.lineTo(i, H - 8); x.stroke(); }
  for (i = 32; i < H; i += 32) { x.beginPath(); x.moveTo(8, i); x.lineTo(W - 8, i); x.stroke(); }
  /* Рамка прибора с фаской */
  x.strokeStyle = "rgba(66,178,220,.3)"; x.lineWidth = 3;
  x.strokeRect(5, 5, W - 10, H - 10);
  x.fillStyle = "rgba(150,186,214,.14)"; x.fillRect(5, 5, W - 10, 2);
  /* Уголки крепления */
  x.fillStyle = "rgba(66,178,220,.42)";
  var cs = [[10, 10], [W - 26, 10], [10, H - 18], [W - 26, H - 18]];
  for (i = 0; i < 4; i++) { x.fillRect(cs[i][0], cs[i][1], 16, 3); }
  texCache.screen = new T.CanvasTexture(c);
  return texCache.screen;
}

/* Вентиляционная решётка: горизонтальные жалюзи с тенью в глубине */
function ventTex() {
  var W = 128, H = 64;
  var c = cnv(W, H), x = c.getContext("2d");
  x.fillStyle = "#050b13"; x.fillRect(0, 0, W, H);
  for (var y = 3; y < H - 3; y += 7) {
    x.fillStyle = "rgba(140,176,204,.22)"; x.fillRect(4, y, W - 8, 2);
    x.fillStyle = "rgba(0,0,0,.85)"; x.fillRect(4, y + 2, W - 8, 4);
  }
  x.strokeStyle = "rgba(140,176,204,.3)"; x.lineWidth = 2;
  x.strokeRect(2, 2, W - 4, H - 4);
  return new T.CanvasTexture(c);
}

/* Пятно света. Один и тот же мягкий градиент работает и лужей от
   светильника на стене, и разливом от напольной полосы. Настоящих
   ламп в рубке пять штук и больше ставить нельзя - каждая лишняя
   стоит целого прохода по всем материалам. Пятна же не стоят
   ничего: это прозрачный прямоугольник в режиме сложения. */
function poolTex() {
  if (texCache.pool) return texCache.pool;
  var S = 128;
  var c = cnv(S, S), x = c.getContext("2d");
  var rg = x.createRadialGradient(S / 2, S * 0.26, 2, S / 2, S * 0.26, S * 0.48);
  rg.addColorStop(0, "rgba(255,255,255,.95)");
  rg.addColorStop(0.30, "rgba(255,255,255,.42)");
  rg.addColorStop(0.72, "rgba(255,255,255,.09)");
  rg.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = rg; x.fillRect(0, 0, S, S);
  texCache.pool = new T.CanvasTexture(c);
  return texCache.pool;
}

/* Рама иллюминатора: кольцо с болтами по кругу. Рисуем в альфу,
   поэтому одна текстура годится и на раму, и на её подсветку. */
function bezelTex() {
  var S = 256;
  var c = cnv(S, S), x = c.getContext("2d");
  var gr = x.createLinearGradient(0, 0, 0, S);
  gr.addColorStop(0, "#2a4257"); gr.addColorStop(0.5, "#132638"); gr.addColorStop(1, "#080f1a");
  x.fillStyle = gr; x.fillRect(0, 0, S, S);
  /* Болты по окружности рамы */
  x.fillStyle = "rgba(200,222,238,.35)";
  for (var i = 0; i < 16; i++) {
    var a = i / 16 * 6.283;
    x.beginPath();
    x.arc(S / 2 + Math.cos(a) * S * 0.40, S / 2 + Math.sin(a) * S * 0.40, 4.5, 0, 6.283);
    x.fill();
  }
  x.fillStyle = "rgba(6,12,20,.8)";
  for (i = 0; i < 16; i++) {
    var b = i / 16 * 6.283;
    x.beginPath();
    x.arc(S / 2 + Math.cos(b) * S * 0.40, S / 2 + Math.sin(b) * S * 0.40 + 2, 3, 0, 6.283);
    x.fill();
  }
  return new T.CanvasTexture(c);
}

function portTex() {
  if (texCache.port) return texCache.port;
  var S = 256;
  var c = cnv(S, S), x = c.getContext("2d");
  x.fillStyle = "#03060d"; x.fillRect(0, 0, S, S);
  var i;
  /* Звёзды за бортом */
  x.fillStyle = "rgba(207,233,245,.9)";
  for (i = 0; i < 120; i++) x.fillRect(Math.random() * S, Math.random() * S, 1.4, 1.4);
  /* Лимб планеты снизу: светлый край и тень к горизонту */
  var gr = x.createRadialGradient(S * 0.5, S * 1.02, S * 0.24, S * 0.5, S * 1.02, S * 0.78);
  gr.addColorStop(0, "#2fa7e8");
  gr.addColorStop(0.55, "#0d5c96");
  gr.addColorStop(0.86, "#0a2b48");
  gr.addColorStop(1, "rgba(6,18,32,0)");
  x.fillStyle = gr;
  x.beginPath(); x.arc(S * 0.5, S * 1.02, S * 0.78, 0, 6.283); x.fill();
  /* Атмосферный ободок: узкая яркая полоса по краю планеты */
  x.strokeStyle = "rgba(180,228,255,.55)"; x.lineWidth = 3;
  x.beginPath(); x.arc(S * 0.5, S * 1.02, S * 0.77, 0, 6.283); x.stroke();
  /* Огни городов на ночной стороне */
  x.fillStyle = "rgba(255,214,160,.6)";
  for (i = 0; i < 40; i++) {
    var a = 3.34 + Math.random() * 2.6, r = S * (0.5 + Math.random() * 0.26);
    x.fillRect(S * 0.5 + Math.cos(a) * r, S * 1.02 + Math.sin(a) * r, 1.6, 1.6);
  }
  texCache.port = new T.CanvasTexture(c);
  return texCache.port;
}

/* Окружение для отражений. Металл без карты окружения выходит
   чёрным: отражать ему нечего. Поэтому рисуем крошечную панораму
   самой рубки - тёмный низ, светлый потолок, яркое пятно
   остекления, - и металл получает настоящий продольный блик,
   который едет по стойкам при повороте камеры. */
function envTex() {
  var c = cnv(128, 64), x = c.getContext("2d");
  var gr = x.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, "#16283a"); gr.addColorStop(0.45, "#08131f"); gr.addColorStop(1, "#02060b");
  x.fillStyle = gr; x.fillRect(0, 0, 128, 64);
  var rg = x.createRadialGradient(96, 26, 1, 96, 26, 30);
  rg.addColorStop(0, "rgba(207,233,245,.95)");
  rg.addColorStop(1, "rgba(207,233,245,0)");
  x.fillStyle = rg; x.fillRect(56, 0, 72, 64);
  x.fillStyle = "rgba(66,178,220,.35)"; x.fillRect(0, 8, 128, 3);
  x.fillStyle = "rgba(138,89,246,.22)"; x.fillRect(0, 40, 128, 2);
  var t = new T.CanvasTexture(c);
  t.mapping = T.EquirectangularReflectionMapping;
  return t;
}

/* Планета за остеклением: тот же вид, что и в наружной сцене */
function planetTex() {
  var c = doc.createElement("canvas");
  c.width = 512; c.height = 512;
  var x = c.getContext("2d");
  var gr = x.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#0A5897");
  gr.addColorStop(0.55, "#0B2B4A");
  gr.addColorStop(1, hex6(COL.deep));
  x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
  /* Материки точками, как на глобусе сайта */
  x.fillStyle = "rgba(66,178,220,.55)";
  for (var i = 0; i < 2600; i++) {
    var px = Math.random() * 512, py = Math.random() * 512;
    var n = Math.sin(px * 0.04) * Math.cos(py * 0.03) + Math.sin(py * 0.017);
    if (n < 0.35) continue;
    x.fillRect(px, py, 2, 2);
  }
  /* Огни ночных городов */
  x.fillStyle = "rgba(207,233,245,.85)";
  for (i = 0; i < 90; i++) x.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
  return new T.CanvasTexture(c);
}

/* ── Сборка рубки ──────────────────────────────────────────
   Порядок сборки повторяет порядок постройки настоящего отсека:
   сначала оболочка и настил, потом силовой набор (стойки, балки),
   потом обстановка (ниши, иллюминаторы, трассы, поручень) и только
   в конце свет. Так проще держать договор о свете: каждый предмет
   ставится уже понимая, откуда на него падает.

   Вершинный бюджет считаем строго. Дорогие тела (торы иллюминаторов
   и жгутов) заменены на кольца и трубки с малым числом сегментов,
   поэтому набор деталей вырос, а вершин стало не больше: место
   освободили, а не добавили. */
function build() {
  if (st.built || !T) return;

  var i, j, m, th;

  cv = doc.createElement("canvas");
  cv.id = "intCanvas";
  cv.className = "rc-int-canvas";
  cv.setAttribute("aria-hidden", "true");
  doc.body.appendChild(cv);

  /* Воздух рубки: плоский слой поверх холста. Он делает то, чего
     трёхмерная сцена дёшево не умеет - виньетку по углам кадра и
     тёплый подмес в нижней трети, там где работает свет пульта.
     Полноценно это считается только постобработкой, а она стоит
     второго прохода по всем пикселям; здесь тот же результат берёт
     один композитный слой браузера. */
  air = doc.createElement("i");
  air.className = "rc-int-air";
  air.setAttribute("aria-hidden", "true");
  doc.body.appendChild(air);

  rend = new T.WebGLRenderer({ canvas: cv, antialias: !phone, alpha: true, powerPreference: "high-performance" });
    /* Рубка - самая дорогая сцена на странице: цилиндр, панели,
     иллюминаторы и планета за окном. Считать её в два пикселя на
     точку незачем, разницы на глаз нет, а кадры она забирает
     целиком. Полтора пикселя на мониторе, один с четвертью на
     телефоне. */
  rend.setPixelRatio(Math.min(tiny ? 1.0 : (phone ? 1.45 : 1.6), g.devicePixelRatio || 1));
  rend.setSize(innerWidth, innerHeight, false);
  if (rend.outputColorSpace !== undefined) rend.outputColorSpace = T.SRGBColorSpace;
  rend.toneMapping = T.ACESFilmicToneMapping;
  rend.toneMappingExposure = 0.94;

  scene = new T.Scene();
  /* Туман плотнее прежнего в два с половиной раза. Раньше он стоял
     на 0.055 и на трёх метрах давал три процента - то есть не делал
     ничего, и дальняя стена была ровно такой же яркой, как ближняя.
     Именно поэтому рубка читалась плоской картинкой: у неё не было
     воздушной перспективы. Теперь на дальней стене четверть тумана,
     на ближней десятая часть, и глубина появляется сама. */
  scene.fog = new T.FogExp2(COL.deep, phone ? 0.115 : 0.135);

  /* Входим с узким углом: в тамбуре тесно. Внутри угол раскрывается
     (на телефоне сильнее, см. fovIn), и человек физически чувствует,
     что вышел из щели в помещение. */
  st.fov = st.fovT = fovTamb();
  cam = new T.PerspectiveCamera(st.fov, innerWidth / innerHeight, 0.1, 60);
  cam.position.set(0, EYE, st.dolly);

  grp = new T.Group();
  scene.add(grp);

  /* Карта окружения для металла. Если её собрать не удалось (старый
     драйвер, отказ PMREM), металл гасим до полуматового: чёрных
     зеркал в кадре быть не должно. */
  var hasEnv = false;
  try {
    var pm = new T.PMREMGenerator(rend);
    var et = envTex();
    scene.environment = pm.fromEquirectangular(et).texture;
    pm.dispose(); et.dispose();
    hasEnv = true;
  } catch (e) {}
  var METAL = hasEnv ? 0.9 : 0.42;
  var ENVI = 0.5;

  /* ── Общие материалы ──────────────────────────────────────
     Материалов ровно столько, сколько в рубке настоящих веществ:
     крашеный металл обшивки, полированный металл набора, матовый
     пластик приборов, стекло, резина уплотнителей и чистый свет.
     Каждый переиспользуется всеми деталями своего вещества - лишний
     материал это лишняя компиляция шейдера на слабом телефоне. */
  var hull = hullTex();
  hull.repeat.set(7, 1);
  var shellMat = new T.MeshStandardMaterial({
    map: hull, side: T.BackSide, roughness: 0.8, metalness: 0.3,
    color: 0x8296ab, envMapIntensity: ENVI * 0.6
  });
  /* Полированный набор: стойки, балки, рамы. Ему и достаётся блик */
  var steelMat = new T.MeshStandardMaterial({
    color: 0x3c4956, roughness: 0.45, metalness: METAL, envMapIntensity: ENVI * 0.85
  });
  /* Матовый корпусный пластик: козырьки ниш, короба */
  var caseMat = new T.MeshStandardMaterial({
    color: COL.wall, roughness: 0.82, metalness: 0.12,
    emissive: COL.emis, emissiveIntensity: 0.1, envMapIntensity: ENVI * 0.4
  });
  /* Резина уплотнителей: она не блестит вовсе, и именно поэтому
     рядом с ней металл читается металлом */
  var rubberMat = new T.MeshStandardMaterial({
    color: 0x0a1119, roughness: 1, metalness: 0
  });
  /* Чистый свет: лампы, кромки, полосы. Один материал на цвет */
  var litCyan = new T.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.62, fog: false });
  var litWarm = new T.MeshBasicMaterial({ color: 0xffd9b8, transparent: true, opacity: 0.26, fog: false });
  var litEdge = new T.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.24, fog: false });
  /* Пятна света: сложение, без записи в буфер глубины, иначе они
     срежут всё, что окажется за ними */
  var pool = poolTex();
  var poolWarm = new T.MeshBasicMaterial({
    map: pool, color: 0xffb07a, transparent: true, opacity: 0.44,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  });
  var poolCool = new T.MeshBasicMaterial({
    map: pool, color: COL.lit, transparent: true, opacity: 0.32,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  });

  /* ── Оболочка ─────────────────────────────────────────── */
  var shell = new T.Mesh(
    new T.CylinderGeometry(2.6, 2.6, 3.4, tiny ? 28 : 44, 1, true),
    shellMat
  );
  shell.position.y = 1.7;
  grp.add(shell);

  /* ── Настил ───────────────────────────────────────────────
     Решётка, а под ней провал: пол получает толщину. Металличность
     держим низкой - мокрого блеска на техническом настиле не бывает,
     а вот сухой рассеянный отклик есть. */
  var floor = new T.Mesh(
    new T.CircleGeometry(2.6, tiny ? 36 : 52),
    new T.MeshStandardMaterial({
      map: deckTex(), roughness: 0.88, metalness: 0.34,
      color: 0x6d7f93, envMapIntensity: ENVI * 0.5
    })
  );
  floor.rotation.x = -Math.PI / 2;
  grp.add(floor);

  /* Технический люк в середине настила: у пола появляется центр, и
     круг перестаёт быть бесконечным полем решётки */
  var hatch = new T.Mesh(new T.CircleGeometry(0.66, 22), steelMat);
  hatch.rotation.x = -Math.PI / 2;
  hatch.position.y = 0.014;
  grp.add(hatch);
  m = new T.Mesh(new T.RingGeometry(0.66, 0.71, 22), litCyan);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.016;
  grp.add(m);

  /* Световая полоса по периметру пола. Главная линия всей рубки:
     она обводит помещение по низу и тем самым объявляет его форму.
     Без неё пол и стена сходились в чёрный шов, и круг не читался. */
  var rim = new T.Mesh(new T.RingGeometry(2.42, 2.52, tiny ? 36 : 52), new T.MeshBasicMaterial({
    color: 0x9fd4ea, transparent: true, opacity: 0.42, fog: false
  }));
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.02;
  grp.add(rim);

  /* Разлив от полосы на настил: свет обязан куда-то ложиться */
  var spill = new T.Mesh(new T.RingGeometry(1.85, 2.5, tiny ? 28 : 40), new T.MeshBasicMaterial({
    color: COL.cyan, transparent: true, opacity: 0.17,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  }));
  spill.rotation.x = -Math.PI / 2;
  spill.position.y = 0.024;
  grp.add(spill);
  fine.push(spill);

  /* ── Потолок с рёбрами ────────────────────────────────────
     Ребристый потолок нужен не ради ребёр. Он даёт кадру верхнюю
     границу: балки сходятся к середине и работают линиями схода,
     по которым глаз мгновенно понимает, что стоит в круглой
     комнате, а не смотрит на изогнутую картинку. */
  var ceil = new T.Mesh(
    new T.CircleGeometry(2.6, tiny ? 28 : 44),
    new T.MeshStandardMaterial({
      color: 0x16273a, roughness: 0.9, metalness: 0.22, side: T.BackSide,
      envMapIntensity: ENVI * 0.3
    })
  );
  ceil.rotation.x = -Math.PI / 2;
  ceil.position.y = 3.4;
  grp.add(ceil);

  var beams = tiny ? 6 : 10;
  var beamGeo = new T.BoxGeometry(0.13, 0.17, 2.34);
  for (i = 0; i < beams; i++) {
    m = new T.Mesh(beamGeo, steelMat);
    m.position.set(0, 3.22, 0);
    m.rotation.y = i / beams * TAU;
    m.translateZ(-1.24);
    grp.add(m);
    fine.push(m);
  }

  /* Обод под потолком: балки обязаны на что-то опираться */
  m = new T.Mesh(new T.TorusGeometry(2.46, 0.055, 4, tiny ? 26 : 36), steelMat);
  m.rotation.x = Math.PI / 2;
  m.position.y = 3.14;
  grp.add(m);

  /* Потолочный плафон: единственный источник верхнего света в кадре.
     Сам он не светит (настоящих ламп у нас пять), но глаз обязан
     видеть, откуда идёт верхний свет, иначе градиент на стенах
     выглядит покраской, а не освещением. */
  m = new T.Mesh(new T.CircleGeometry(0.82, 20), new T.MeshBasicMaterial({
    color: COL.lit, transparent: true, opacity: 0.62, fog: false
  }));
  m.rotation.x = Math.PI / 2;
  m.position.y = 3.36;
  grp.add(m);

  m = new T.Mesh(new T.CircleGeometry(2.3, tiny ? 20 : 30), new T.MeshBasicMaterial({
    map: poolTex(), color: 0x86b6d4, transparent: true, opacity: 0.3,
    blending: T.AdditiveBlending, depthWrite: false, fog: false
  }));
  m.rotation.x = Math.PI / 2;
  m.position.y = 3.33;
  grp.add(m);
  fine.push(m);

  /* ── Силовые стойки между панелями ────────────────────────
     Стоят на швах круга и выступают внутрь. Это самая полезная
     деталь всей рубки: при повороте они проходят у самого объектива
     и едут заметно быстрее дальней стены. Такой параллакс глаз
     читает как «я нахожусь внутри», и никакая текстура его не
     заменит. */
  var strutGeo = new T.BoxGeometry(0.125, 2.36, 0.22);
  var strutLit = new T.PlaneGeometry(0.03, 1.9);
  for (i = 0; i < PANELS; i++) {
    th = i * STEP;
    var col = new T.Group();
    m = new T.Mesh(strutGeo, steelMat);
    m.position.set(0, 0, -2.48);
    col.add(m);
    /* Световая нитка по внутреннему ребру стойки */
    var nl = new T.Mesh(strutLit, litEdge);
    nl.position.set(0, 0, -2.365);
    col.add(nl);
    col.rotation.y = -th;
    col.position.y = 1.72;
    grp.add(col);
  }

  /* ── Ниши со стеновыми панелями ───────────────────────────
     Панель теперь не приклеена к стене, а утоплена в нишу: над ней
     козырёк, под козырьком тёплая лампа, от лампы на плите пятно
     света. Три предмета вместо одного, и панель получает глубину -
     раньше это был просто светлый прямоугольник на светлой стене.

     Угол панели совпадает с поворотом камеры, при котором человек
     стоит к ней лицом: панель номер i живёт на (i + 0.5) * 45
     градусов. Из-за этого карточке достаточно знать свой номер,
     чтобы встать на своё место.

     Три знака минус в rotation.y - не опечатка: камера смотрит
     вдоль минус Z и вращается на минус yaw, поэтому стена, чтобы
     оказаться напротив, обязана повернуться в другую сторону. */
  var panelMat = new T.MeshStandardMaterial({
    map: screenTex(), color: 0xdfe9f2, roughness: 0.5, metalness: 0.32,
    emissive: COL.emis, emissiveIntensity: 0.5, envMapIntensity: ENVI * 0.5
  });
  /* Свободные панели круга закрыты приборными стойками: глухой
     стены при обороте быть не должно, а вешать туда нечего */
  var rackMat = new T.MeshStandardMaterial({
    map: rackTex(), roughness: 0.66, metalness: 0.3,
    emissive: 0x0d2a40, emissiveIntensity: 0.8, envMapIntensity: ENVI * 0.5
  });
  var faceGeo = new T.PlaneGeometry(1.9, 1.42);
  var lampGeo = new T.PlaneGeometry(1.62, 0.028);
  var hoodGeo = new T.BoxGeometry(2.0, 0.1, 0.24);
  var poolGeo = new T.PlaneGeometry(1.94, 1.5);

  for (i = 0; i < PANELS; i++) {
    th = (i + 0.5) * STEP;
    var pan = new T.Group();
    /* Плита утоплена глубже стены: у ниши появляется дно */
    var face = new T.Mesh(faceGeo, i < 5 ? panelMat : rackMat);
    face.position.set(0, 0, -R_WALL);
    pan.add(face);

    /* Козырёк ниши. Он выступает в помещение на 12 сантиметров и
       прячет лампу: источник виден только по своему свету, как в
       настоящем интерьере. */
    var hood = new T.Mesh(hoodGeo, caseMat);
    hood.position.set(0, 0.79, -R_WALL + 0.16);
    pan.add(hood);

    /* Порожек снизу. Пара «козырёк плюс порожек» и делает нишу
       нишей: у плиты появляются верх и низ, и она перестаёт быть
       наклейкой на стене. */
    var sill = new T.Mesh(hoodGeo, caseMat);
    sill.position.set(0, -0.79, -R_WALL + 0.13);
    pan.add(sill);

    /* Тёплая лампа под козырьком. Тёплая нарочно: весь остальной
       свет в рубке холодный, и без этой ноты кадр синеет целиком */
    var lampStrip = new T.Mesh(lampGeo, litWarm);
    lampStrip.position.set(0, 0.71, -R_WALL + 0.1);
    pan.add(lampStrip);

    /* Пятно от лампы на плите: свет обязан лечь на поверхность */
    var pl = new T.Mesh(poolGeo, i < 5 ? poolWarm : poolCool);
    pl.position.set(0, 0.06, -R_WALL + 0.012);
    pan.add(pl);
    fine.push(pl);

    pan.rotation.y = -th;
    pan.position.y = H_WALL;
    grp.add(pan);
    anchors.push({ obj: face, th: th });
  }

  /* ── Иллюминаторы ─────────────────────────────────────────
     Раньше это была плоская картинка планеты и кольцо поверх неё:
     дырка в стене, а не окно. Теперь у окна есть настоящая толщина -
     труба в борту, стекло в её глубине, рама с болтами снаружи и
     резиновый уплотнитель по стыку. Толщина и решает: по ней глаз
     понимает, что стена не бумажная.

     Стоят на швах, где нет ни панели, ни пульта. */
  var glassMat = new T.MeshBasicMaterial({ map: portTex(), color: 0xc6d8e4, fog: false });
  var bezelMat = new T.MeshStandardMaterial({
    map: bezelTex(), roughness: 0.3, metalness: METAL * 0.85,
    envMapIntensity: ENVI * 1.1
  });
  var tubeGeo = new T.CylinderGeometry(0.43, 0.43, 0.22, tiny ? 16 : 22, 1, true);
  var portA = [STEP * 2, STEP * 4, STEP * 6];
  for (i = 0; i < portA.length; i++) {
    var port = new T.Group();
    /* Труба проёма: смотрим в неё изнутри, значит нужна изнанка */
    var tube = new T.Mesh(tubeGeo, new T.MeshStandardMaterial({
      color: 0x46586b, roughness: 0.45, metalness: METAL * 0.7,
      side: T.DoubleSide, envMapIntensity: ENVI * 0.9
    }));
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, 0, -2.44);
    port.add(tube);

    /* Стекло сидит в глубине обечайки, а не заподлицо с её краем */
    var glass = new T.Mesh(new T.CircleGeometry(0.43, tiny ? 16 : 22), glassMat);
    glass.position.set(0, 0, -2.555);
    port.add(glass);

    /* Рама с болтами по внутреннему краю обечайки */
    var bez = new T.Mesh(new T.RingGeometry(0.43, 0.59, tiny ? 18 : 24), bezelMat);
    bez.position.set(0, 0, -2.32);
    port.add(bez);

    /* Уплотнитель по стыку рамы с обечайкой */
    var seal = new T.Mesh(new T.TorusGeometry(0.44, 0.032, 4, tiny ? 14 : 18), rubberMat);
    seal.position.set(0, 0, -2.33);
    port.add(seal);

    /* Подсветка проёма изнутри: холодная кромка вокруг стекла */
    var glow = new T.Mesh(new T.RingGeometry(0.38, 0.43, tiny ? 16 : 22), litEdge);
    glow.position.set(0, 0, -2.54);
    port.add(glow);

    port.rotation.y = -portA[i];
    port.position.y = 2.02;
    grp.add(port);
  }

  /* ── Кабельные трассы ─────────────────────────────────────
     Жгуты идут поясом под потолком и спускаются на стойки. Спуски
     важнее самих жгутов: вертикаль связывает потолок со стеной, и
     верх кадра перестаёт висеть отдельно. */
  var cableMat = new T.MeshStandardMaterial({
    color: 0x101c2a, roughness: 0.95, metalness: 0.1, envMapIntensity: ENVI * 0.3
  });
  for (i = 0; i < (tiny ? 1 : 2); i++) {
    m = new T.Mesh(new T.TorusGeometry(2.44, 0.055 + i * 0.016, 4, tiny ? 24 : 34), cableMat);
    m.rotation.x = Math.PI / 2;
    m.position.y = 3.0 - i * 0.11;
    grp.add(m);
  }
  if (!phone) {
    var dropGeo = new T.BoxGeometry(0.07, 0.86, 0.07);
    for (i = 0; i < 4; i++) {
      var drop = new T.Group();
      m = new T.Mesh(dropGeo, cableMat);
      m.position.set(0.14, 0, -2.5);
      drop.add(m);
      drop.rotation.y = -(i * STEP * 2);
      drop.position.y = 2.52;
      grp.add(drop);
      fine.push(drop);
    }
  }

  /* ── Поручень ─────────────────────────────────────────────
     Идёт кольцом на высоте руки, в полуметре ниже панелей. Он тоже
     работает на параллакс: ближняя его дуга проходит перед камерой
     и режет кадр по низу, а дальняя видна далеко за спиной. */
  if (!phone) {
    var rail = new T.Mesh(new T.TorusGeometry(2.4, 0.035, 4, 42), steelMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 1.02;
    grp.add(rail);
    fine.push(rail);
  }

  /* ── Вентиляция ───────────────────────────────────────────
     Решётки стоят в плинтусе, между стойками. Мелочь, но именно
     такие мелочи в нижнем поясе объясняют, что комната рабочая. */
  var ventMat = new T.MeshStandardMaterial({
    map: ventTex(), roughness: 0.9, metalness: 0.25, color: 0x5c6d7e,
    envMapIntensity: ENVI * 0.3
  });
  var ventGeo = new T.PlaneGeometry(0.8, 0.24);
  for (i = 0; i < (tiny ? 2 : 4); i++) {
    var vt = new T.Group();
    m = new T.Mesh(ventGeo, ventMat);
    m.position.set(0, 0, -2.57);
    vt.add(m);
    vt.rotation.y = -((i + 0.5) * STEP * 2);
    vt.position.y = 0.44;
    grp.add(vt);
  }

  /* ── Угол пульта ──────────────────────────────────────────
     Вся обстановка поста управления живёт в одной группе, повёрнутой
     на TH_CON. Раньше стойка, столешница и остекление стояли на
     нуле, а слой кабины (rc-cockpit) считал своё место от TH_CON:
     пульт в объёме и пульт на картинке стояли в разных углах одной
     комнаты, и на подъезде камера смотрела мимо мебели. Теперь угол
     объявлен один раз и им пользуются оба слоя. */
  var con = new T.Group();
  con.rotation.y = -TH_CON;
  grp.add(con);

  /* Остекление рубки: главный источник холодного света в кадре.
     Стекло светится на просвет, тем же тоном, что и направленный
     свет из окна. Тёмной плитой оно быть не имеет права - именно
     из-за неё нос корабля превращался в чёрный прямоугольник. */
  var win = new T.Mesh(
    new T.PlaneGeometry(2.9, 1.35, 1, 1),
    new T.MeshBasicMaterial({ color: COL.lit, transparent: true, opacity: 0.1,
      blending: T.AdditiveBlending, depthWrite: false, fog: false })
  );
  win.position.set(0, 1.85, -2.45);
  con.add(win);
  winMesh = win;

  /* Фаска остекления: тонкая циановая рамка по контуру. Тот же
     приём, что у экрана анкеты в секции контактов - когда камера
     доезжает до носа, рамка окна и рамка экрана стоят рядом и
     читаются одним прибором, а не двумя разными картинками. */
  var fasciaMat = new T.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.42, fog: false });
  var fh = new T.PlaneGeometry(3.02, 0.014);
  var fv = new T.PlaneGeometry(0.014, 1.44);
  var fPos = [[0, 2.53, fh], [0, 1.17, fh], [-1.51, 1.85, fv], [1.51, 1.85, fv]];
  for (i = 0; i < fPos.length; i++) {
    var fm = new T.Mesh(fPos[i][2], fasciaMat);
    fm.position.set(fPos[i][0], fPos[i][1], -2.43);
    con.add(fm);
  }

  /* Планета за остеклением. Туман рубки на неё не действует: это
     воздух помещения, а планета снаружи. Раньше туман её съедал, и
     за окном оставалось мутное пятно. */
  planet = new T.Mesh(
    new T.SphereGeometry(7.5, tiny ? 18 : 28, tiny ? 14 : 20),
    new T.MeshBasicMaterial({ map: planetTex(), fog: false })
  );
  planet.position.set(0.6, -3.6, -13);
  con.add(planet);

  /* Атмосферный ободок планеты */
  halo = new T.Mesh(
    new T.SphereGeometry(7.85, 20, 14),
    new T.MeshBasicMaterial({ color: 0x42b2dc, transparent: true, opacity: 0.16,
      side: T.BackSide, blending: T.AdditiveBlending, fog: false })
  );
  halo.position.copy(planet.position);
  con.add(halo);

  /* Пульт под остеклением */
  /* Столешница остаётся тёмной, но с собственным слабым свечением и
     заметным глянцем: свет из окна обязан скользить по ней длинным
     бликом, это и делает её столешницей, а не крашеной доской. */
  var deskMat = new T.MeshStandardMaterial({
    color: COL.hull, roughness: 0.32, metalness: 0.62,
    emissive: COL.emis, emissiveIntensity: 0.14, envMapIntensity: ENVI * 1.1
  });
  var desk = new T.Mesh(new T.BoxGeometry(2.6, 0.12, 0.75), deskMat);
  desk.position.set(0, 1.02, -2.05);
  desk.rotation.x = -0.22;
  con.add(desk);

  /* ── Приборная стойка ──────────────────────────────────────
     Нужна ради стыка салона с секцией контактов. Раньше в акте
     пульта низ кадра занимал голый пол, и анкета висела над
     пустотой: кадр не был похож на пульт, и раздел читался
     отдельной картинкой.

     Стойка нарочно неглубокая и прижата к носу. Первая попытка
     была вдвое крупнее, с боковыми тумбами, и всё сломала: из
     центра рубки эти тумбы вставали чёрными глыбами поперёк
     салона. Правило простое - мебель обязана работать только в
     последней четверти оборота и не лезть в кадр, когда камера
     стоит у карточек надёжности. */
  var riser = new T.Mesh(new T.BoxGeometry(3.05, 0.84, 0.46), caseMat);
  riser.position.set(0, 0.44, -2.26);
  con.add(riser);

  /* Боковых тумб и крыльев здесь нарочно нет. Их пробовали дважды:
     всё, что торчит вбок от пульта, попадает в кадр ещё в салоне,
     ловит направленный свет из окна плашмя и превращается в светлые
     клинья поперёк карточек надёжности. Борта кадра держат стены и
     стойки рубки, им мебель для этого не нужна. */

  /* Световая полоса по переднему ребру пульта. Это и есть тот
     нижний свет, который в секции контактов подсвечивает экран
     анкеты снизу: источник один, поэтому подсветка формы читается
     как свет от панели, а не как декоративное свечение карточки.
     Полоса одна: вторая, по низу стойки, давала в салоне две
     параллельные линии и читалась дорожной разметкой, а не пультом. */
  var lip = new T.Mesh(new T.BoxGeometry(2.62, 0.018, 0.022), litCyan);
  lip.position.set(0, 1.05, -1.66);
  con.add(lip);

  /* Диоды на пульте: дышат от общего таймера с фазовым сдвигом */
  var dGeo = new T.SphereGeometry(0.022, 6, 4);
  for (i = 0; i < (tiny ? 10 : 18); i++) {
    var warm = i % 3 === 0;
    var d = new T.Mesh(dGeo, new T.MeshBasicMaterial({ color: warm ? COL.vio : COL.cyan, fog: false }));
    d.position.set(-1.1 + (i % 9) * 0.26, 1.09 + (i > 8 ? 0.06 : 0), -2.16 + (i > 8 ? 0.16 : 0));
    d.userData.ph = i * 0.7;
    con.add(d);
    diodes.push(d);
  }

  /* ── Свет ─────────────────────────────────────────────────
     Ламп ровно пять и больше не будет: каждая лишняя это лишний
     проход по всем материалам сцены на каждом кадре, а рубка живёт
     в одном контексте на слабом телефоне. Поэтому постановочный
     свет собран не из ламп, а из ролей.

     Ключевой - холодный из остекления. Заполняющий - отражённый от
     планеты, он держит дальнюю половину рубки, иначе за спиной
     выходит чёрная дыра вместо помещения. Контровой тёплый стоит за
     спиной и обводит стойки по кромке: без него полированный набор
     сливается со стеной. Свет пульта разгорается на подходе (см.
     tick). А лужи от ламп в нишах и полоса по полу - не лампы, а
     нарисованные пятна: света они не считают, но глаз видит именно
     их и достраивает освещение сам. */
  lamp = new T.DirectionalLight(COL.lit, 2.5);
  lamp.position.set(-0.8, 2.6, -4);
  con.add(lamp);
  con.add(lamp.target);
  lamp.target.position.set(0, 1.2, 0);

  var LB = tiny ? 1.2 : 1;
  scene.add(new T.HemisphereLight(0x27435c, 0x060d16, 0.82 * LB));
  scene.add(new T.AmbientLight(0x223247, 0.56 * LB));

  /* Контровой тёплый: стоит высоко за спиной входа и обводит
     кромки. Он же единственная тёплая лампа в холодной комнате. */
  var warmL = new T.PointLight(COL.vio, 1.7, 8.5, 1.6);
  warmL.position.set(1.5, 2.5, 1.7);
  scene.add(warmL);

  /* Свет пульта. Стоит низко, у самой стойки: это он ложится на
     приборы снизу и тем же цветом подсвечивает экран анкеты.
     Держим лампу на отлёте от столешницы: вплотную она выжигала
     переднее ребро пульта в белый клин, и в салоне этот клин
     перечёркивал кольцо карточек. */
  deskLight = new T.PointLight(COL.cyan, 0.85, 6.5);
  deskLight.position.set(0, 1.42, -1.95);
  con.add(deskLight);

  st.built = true;
  try { dispatchEvent(new CustomEvent("rc:interior-ready")); } catch (e) {}
}

/* ── Тамбур ──────────────────────────────────────────────────
   Плоский слой поверх кадра. Он перекрывает переход, и именно под
   ним меняются сцены. Если интерьер почему-то не готов, тамбур
   держится дольше, живя собственной анимацией уплотнителей:
   чёрного кадра не будет.

   Створки - половина ощущения. Вторая половина в том, что камера
   в это время реально едет вперёд (см. st.dolly) и угол объектива
   раскрывается. Створки говорят «закрылось», движение говорит
   «ты прошёл», и вместе они читаются как вход, а не как склейка. */
function lockShow() {
  if (lock) return;
  lock = doc.createElement("div");
  lock.className = "rc-int-lock";
  lock.setAttribute("aria-hidden", "true");
  lock.innerHTML =
    '<i class="rc-lock-l"></i><i class="rc-lock-r"></i>' +
    '<span class="rc-lock-tx">FAST. RELIABLE. GLOBAL.</span>';
  doc.body.appendChild(lock);
  requestAnimationFrame(function () { if (lock) lock.classList.add("on"); });
}

function lockHide() {
  if (!lock) return;
  var el = lock;
  lock = null;
  el.classList.remove("on");
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 460);
}

/* ── Показать и спрятать ─────────────────────────────────── */
function takeSlot() {
  if (st.slot) return true;
  if (g.RC_GL && g.RC_GL.take) {
    if (g.RC_GL.take(true)) { st.slot = true; return true; }
    /* Свободного слота нет. Наружная сцена нам его отдаст: по
       сценарию в этот момент мы уже внутри ракеты и снаружи
       смотреть не на что. */
    if (g.RC_ROCKET) {
      try {
        g.RC_ROCKET.stop();
        root.classList.add("rc-rocket-parked");
        g.RC_GL.give();
      } catch (e) {}
      if (g.RC_GL.take(true)) { st.slot = true; return true; }
    }
    return false;
  }
  st.slot = true;
  return true;
}

function show() {
  if (st.shown || st.dead) return;
  if (!takeSlot()) return;
  build();
  if (!st.built) return;
  st.shown = true;
  root.classList.add("rc-inside");
  if (cv) cv.classList.add("on");
  if (air) air.classList.add("on");
  if (g.RC_ROCKET && !root.classList.contains("rc-rocket-parked")) {
    try { g.RC_ROCKET.stop(); root.classList.add("rc-rocket-parked"); } catch (e) {}
  }
  lastTs = 0;
  if (!raf) raf = requestAnimationFrame(tick);
}

function hide() {
  if (!st.shown) return;
  st.shown = false;
  root.classList.remove("rc-inside");
  if (cv) cv.classList.remove("on");
  if (air) air.classList.remove("on");
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  /* Возвращаем наружную сцену: человек листает назад, и ракета
     обязана снова оказаться на месте. */
  if (g.RC_ROCKET && root.classList.contains("rc-rocket-parked")) {
    try { g.RC_ROCKET.start(); root.classList.remove("rc-rocket-parked"); } catch (e) {}
  }
}

/* ── Прогресс ─────────────────────────────────────────────── */
function setProgress(p) {
  st.p = p;

  if (p >= P_PREP && !st.built && T) build();

  /* Тамбур и подмена сцен.

     Подмену наружной сцены на рубку теперь назначает сам корабль:
     пока его люк не открыт и проём не накрыл кадр, снаружи есть что
     показывать - ракета, к которой мы идём. Раньше порог считался
     от процентов страницы и срабатывал раньше входа: ракета гасла
     на полпути, а поверх кадра появлялись створки «ниоткуда».
     Флаг rc-in-hatch ставит rc-rocket, когда мы уже в проёме. */
  var hatch = root.classList.contains("rc-in-hatch");
  var hasRocket = typeof g.RC_DOOR === "number";
  /* Обратный ход: пока мы внутри, корабль остановлен и долю двери
     сам не пересчитает. Поэтому наружные акты снимают флаг сами -
     иначе из салона нельзя было бы выйти скроллом назад. */
  var sc = g.RC_SCENE;
  if (hatch && sc && (sc.act === "walk" || sc.act === "landing" || sc.act === "route")) {
    root.classList.remove("rc-in-hatch");
    hatch = false;
  }
  /* Внутренние акты сцены: салон, справочник, пульт. Пока мы в них,
     рубка держится, даже если доля люка уже стекла - корабль в этот
     момент остановлен и ничего не считает. Вход же честный: либо мы
     прошли сквозь открытый люк (hatch), либо попали в салон прыжком
     по якорю, и тогда запасной порог по прогрессу. */
  /* Эпилог тоже внутренний акт: финал мы смотрим из кабины, а не с
     улицы. Без него прыжок по якорю в конец страницы выбрасывал
     наружу, и в кадре снова появлялась ракета, из которой мы по
     сценарию ещё не выходили. */
  var innerAct = sc && (sc.act === "cabin" || sc.act === "manual" ||
                        sc.act === "console" || sc.act === "egress");
  var ready = hasRocket
    ? (hatch || (st.shown && innerAct) || (innerAct && p >= P_IN))
    : (p >= P_LOCK);

  if (ready && p < P_IN) {
    /* Полноэкранных створок больше нет: дверь у нас настоящая, в
       борту. Тамбур остаётся только как затемнение стыка, если
       корабля на странице нет (упрощённый режим, нет WebGL). */
    if (!hasRocket) lockShow();
    show();
    /* Тяжёлый лязг замка: створки сомкнулись за спиной */
    if (!st.sLock) {
      st.sLock = true;
      var s1 = snd();
      if (s1 && s1.boom) { try { s1.boom(); } catch (e) {} }
    }
  /* Запасной порог по прогрессу оставлен только для страниц без
     корабля. С кораблём вход честный - через его люк: на телефоне
     разделы сжаты, порог достигался ещё в проходе, и рубка
     включалась до того, как дверь вообще тронулась. */
  } else if ((ready || (!hasRocket && p >= P_IN)) && p < P_OUT) {
    show();
    lockHide();
    /* Давление выровнялось, внутренний люк расходится: две ноты
       вверх. Ровно один раз за вход, обратный ход их сбрасывает. */
    if (!st.sIn) {
      st.sIn = true;
      var s2 = snd();
      if (s2 && s2.blip) {
        try {
          s2.blip(392);
          setTimeout(function () { var s3 = snd(); if (s3 && s3.blip) s3.blip(587); }, 190);
        } catch (e) {}
      }
    }
  } else {
    lockHide();
    if (st.shown) hide();
    if (p < P_LOCK) { st.sLock = false; st.sIn = false; st.stop = -1; }
  }

  /* Вход: створки перекрывают кадр, а камера в это время едет
     вперёд из тамбура в центр рубки и раскрывает объектив. */
  /* Ход камеры вперёд синхронен с открытием люка: когда дверь
     корабля разошлась наполовину, мы уже наполовину в тамбуре */
  var enter = hasRocket
    ? Math.max(0, Math.min(1, ((g.RC_DOOR || 0) - 0.45) / 0.5))
    : Math.max(0, Math.min(1, (p - P_LOCK) / Math.max(1e-4, (P_IN - P_LOCK) * 1.75)));
  var eIn = 0.5 - 0.5 * Math.cos(Math.PI * enter);
  /* Раньше камера доезжала ровно в центр круга (dolly ноль). В такой
     точке поворот перестаёт быть проездом: ось вращения проходит
     через объектив, ближнее и дальнее едут с одной скоростью, и
     рубка читается панорамной картинкой. Теперь человек встаёт
     чуть позади центра (restDolly) - и оборот сразу становится
     проездом, а на телефоне ещё и отодвигает стену на читаемое
     расстояние. */
  var dRest = restDolly();
  st.dollyT = dRest + (1.7 - dRest) * (1 - eIn);
  st.fovT = fovTamb() + eIn * (fovIn() - fovTamb());
  root.style.setProperty("--int-enter", eIn.toFixed(3));

  /* Доля подхода к пульту: ноль - камера ещё стоит в центре рубки,
     единица - доехала вплотную к приборной панели. Этим же числом
     живёт оформление секции контактов (--int-con в rc-console.css),
     поэтому экран анкеты разгорается ровно вместе с подъездом
     камеры: одно движение, а не два независимых. */
  var con = p > P_TURN ? Math.min(1, (p - P_TURN) / Math.max(1e-4, P_CON - P_TURN)) : 0;
  st.con = con;
  root.style.setProperty("--int-con", con.toFixed(3));

  /* Отъезд от пульта. По сценарию клиента после анкеты камера идёт
     назад, анкета растворяется голограммой, и в кадре остаётся
     остекление кабины и космос за ним - тот самый ракурс, с
     которого начинается игра. Долю публикуем: по ней гаснет анкета
     и разгорается надпись старта. */
  var back = p > P_CON ? Math.min(1, (p - P_CON) / Math.max(1e-4, P_OUT - P_CON)) : 0;
  st.back = back;
  root.style.setProperty("--int-out", back.toFixed(3));

  if (!st.shown) return;

  st.yawT = yawAt(p);

  /* После оборота камера подступает к пульту и замирает.

     Едем заметно ближе, чем раньше (было 0.42 метра): секция
     контактов обязана читаться продолжением той же рубки, а для
     этого приборная стойка должна занять низ кадра. Дальше метра с
     небольшим не идём - за этой отметкой камера утыкается в стойку.

     Угол объектива при этом чуть раскрываем, а не сужаем: сузить
     значило бы выкинуть стены из кадра, и пульт снова превратился
     бы в отдельную картинку вместо угла комнаты. */
  if (con > 0) {
    var ec = 0.5 - 0.5 * Math.cos(Math.PI * con);
    /* Конечная точка та же, что и была (-1.02): подъезд к пульту
       вымерен по кадру секции контактов, его не трогаем. Меняется
       только начало пути - камера стартует не из центра, а из
       позиции покоя. */
    st.dollyT = dRest + (-1.02 - dRest) * ec;
    st.pitchT = -0.17 * ec;
    st.fovT = fovIn() + ec * 6;
  }

  /* Отъезд: камера уходит от пульта назад и поднимает взгляд к
     остеклению. Кадр при этом не пустеет - стены рубки в эту
     минуту гаснут (rc-cockpit.css), и вперёд выходит космос за
     стеклом вместе с рамкой кабины. */
  if (back > 0) {
    var eb = 0.5 - 0.5 * Math.cos(Math.PI * back);
    st.dollyT = -1.02 + eb * 3.1;
    st.pitchT = -0.17 * (1 - eb);
    st.fovT = (fovIn() + 6) - eb * 14;
  }

  /* Щелчок фиксации: камера встала напротив очередной панели */
  var stop = Math.floor(st.yawT / STEP);
  if (stop !== st.stop) {
    if (st.stop >= 0 && !root.classList.contains("rc-fast")) {
      var s4 = snd();
      if (s4 && s4.blip) { try { s4.blip(560 + (stop % 4) * 55); } catch (e) {} }
    }
    st.stop = stop;
  }
}

/* ── Наклон от мыши: без гироскопа и без разрешений ───────── */
if (!phone) {
  addEventListener("mousemove", function (e) {
    if (!st.shown) return;
    var nx = (e.clientX / innerWidth - 0.5) * 2;
    var ny = (e.clientY / innerHeight - 0.5) * 2;
    st.pitchT = -ny * 0.21 + (st.p > P_TURN ? -0.1 : 0);      /* около 12 градусов */
    st.yawOff = nx * 0.1;
  }, { passive: true });
}

/* ── Проекция: где панель оказалась на экране ────────────────
   Считаем вручную, а не через project(): у точки за спиной знак
   однородной координаты меняется, и штатная проекция возвращает
   зеркальный экранный адрес. Раньше на этом ловились якоря -
   панель позади камеры отдавала координату панели впереди, и
   карточка уезжала не туда.

   Возвращаем доли экрана (0..1), расстояние в метрах, масштаб
   относительно опорного и запас читаемости v: единица - панель в
   середине кадра, ноль - ушла за край или за спину. */
var vTmp = null;
function project(th, h) {
  var out = { x: 0.5, y: 0.5, d: 99, s: 0.5, v: 0 };
  if (!st.built || !cam) return out;
  if (!vTmp) vTmp = new T.Vector3();
  cam.updateMatrixWorld();
  vTmp.set(R_WALL * Math.sin(th), h === undefined ? H_WALL : h, -R_WALL * Math.cos(th));
  vTmp.applyMatrix4(cam.matrixWorldInverse);
  var d = -vTmp.z;
  out.d = d;
  if (d < 0.15) return out;                      /* за спиной: адреса нет */
  var f = 1 / Math.tan(cam.fov * Math.PI / 360);
  var ndcX = (vTmp.x / d) * f / cam.aspect;
  var ndcY = (vTmp.y / d) * f;
  out.x = ndcX * 0.5 + 0.5;
  out.y = -ndcY * 0.5 + 0.5;
  out.s = (R_WALL + EYE * 0.25) / d;
  var edge = Math.abs(ndcX);
  out.v = edge > 1.6 ? 0 : (edge < 0.55 ? 1 : (1.6 - edge) / 1.05);
  return out;
}

/* ── Якоря: экранные точки панелей уходят в CSS ────────────
   Переменные --int-anchor-N-x / -y / -v объявлены для всех
   восьми панелей. Первые четыре - те, на которых стоят карточки
   надёжности, ими же пользуется rc-interior.css. */
function publish() {
  if (!T || !st.built) return;
  var s = root.style;
  for (var i = 0; i < anchors.length; i++) {
    var pr = project(anchors[i].th, H_WALL);
    s.setProperty("--int-anchor-" + i + "-x", (pr.x * 100).toFixed(2) + "%");
    s.setProperty("--int-anchor-" + i + "-y", (pr.y * 100).toFixed(2) + "%");
    s.setProperty("--int-anchor-" + i + "-v", pr.v.toFixed(3));
  }
  s.setProperty("--int-yaw", (st.yaw * 57.2958).toFixed(1) + "deg");
}

/* ── Кадр ────────────────────────────────────────────────── */
function tick(ts) {
  raf = requestAnimationFrame(tick);
  if (!st.shown || doc.hidden) return;
  /* В демо-полёте рубка спит: весь кадровый бюджет у космоса */
  if (root.classList.contains("rc-flying")) { lastTs = 0; return; }

  /* Держим ту же частоту, что и весь сайт: в простое двадцать */
  var min = g.RC_MOTION ? g.RC_MOTION.minFrame() : 16;
  if (lastTs && ts - lastTs < min - 1) return;
  var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;

  var fast = root.classList.contains("rc-fast");
  /* Пока человек печатает, рубка стоит. Гасить её нельзя: экран
     анкеты - часть этой же комнаты, и если комната выцветет, форма
     снова станет карточкой поверх чужого фона. Поэтому не гасим, а
     останавливаем: дрейф и дыхание диодов замирают, кадр держится. */
  var typing = root.classList.contains("rc-form-active");

  /* Демпфер: резкая прокрутка не должна вертеть рубку рывками.
     Коэффициент считаем от времени кадра, а не от кадра как
     такового: в простое сайт роняет частоту до двадцати, и на
     постоянном коэффициенте камера доезжала бы втрое дольше -
     человек уже читает, а стена ещё едет. На перемотке постоянную
     укорачиваем, иначе камера отстаёт от содержимого и карточки
     повисают на пустой стене. */
  var kY = 1 - Math.exp(-dt / (fast ? 0.06 : 0.17));
  st.yaw += (st.yawT + (fast ? 0 : st.yawOff) - st.yaw) * kY;
  st.pitch += ((fast ? 0 : st.pitchT) - st.pitch) * kY;
  st.dolly += (st.dollyT - st.dolly) * kY;
  if (!typing) st.drift += dt;

  /* ── Дыхание камеры ────────────────────────────────────────
     Человек не штатив: он дышит, переминается и заваливает голову
     в сторону поворота. Три эти мелочи и отличают проезд в кино от
     разворота модели в просмотрщике.

     Периоды нарочно разные и несоизмеримые (6, 4.3 и 3.1 секунды):
     совпадай они, движение сложилось бы в заметную качку. Амплитуды
     мелкие: дыхание должно чувствоваться, а не читаться.

     На перемотке и пока человек печатает всё это выключено - там
     любое лишнее движение мешает. */
  var calm = fast || typing;
  var drift = calm ? 0 : Math.sin(st.drift / 6) * 0.026;   /* дрейф 3 градуса, период 6 секунд */
  var sway  = calm ? 0 : Math.sin(st.drift / 4.3) * 0.035; /* шаг вбок: 3.5 см */
  var bob   = calm ? 0 : Math.sin(st.drift / 3.1) * 0.016; /* вдох-выдох по высоте */

  /* Крен на повороте. Считаем от настоящей угловой скорости камеры,
     а не от прокрутки: камера отстаёт от прокрутки на демпфере, и
     крен, снятый с прокрутки, приходил бы раньше самого поворота. */
  var vYaw = dt > 0 ? (st.yaw - st.yawPrev) / dt : 0;
  st.yawPrev = st.yaw;
  var rollT = calm ? 0 : Math.max(-0.03, Math.min(0.03, vYaw * 0.045));
  st.roll += (rollT - st.roll) * (1 - Math.exp(-dt / 0.28));

  cam.rotation.order = "YXZ";
  cam.rotation.y = -st.yaw + drift;
  cam.rotation.x = st.pitch;
  cam.rotation.z = st.roll;

  /* Камера едет по своей оси взгляда: в тамбуре она далеко позади
     центра, внутри отходит на шаг от оси (см. restDolly - именно
     этот шаг и даёт параллакс), у пульта подступает вплотную.
     Боковое дыхание кладём поперёк взгляда, иначе оно просто
     добавлялось бы к проезду и не читалось. */
  var sx = -Math.sin(st.yaw), sz = Math.cos(st.yaw);
  cam.position.set(sx * st.dolly + sz * sway, EYE + bob, sz * st.dolly - sx * sway);

  /* Свет пульта разгорается вместе с подходом камеры. Тем же числом
     (--int-con) разгорается экран анкеты в CSS: свет в кадре и свет
     под формой - это буквально один источник, поэтому секция
     контактов не выпадает из рубки ни по яркости, ни по тону. */
  if (Math.abs(st.conL - st.con) > 0.002) {
    st.conL += (st.con - st.conL) * kY;
    if (deskLight) deskLight.intensity = 0.85 + st.conL * 1.7;
    if (winMesh) winMesh.material.opacity = 0.1 + st.conL * 0.1;
  }

  if (Math.abs(st.fov - st.fovT) > 0.05) {
    st.fov += (st.fovT - st.fov) * 0.1;
    cam.fov = st.fov;
    cam.updateProjectionMatrix();
  }

  /* Диоды дышат от одного таймера с фазовым сдвигом */
  if (!fast && !typing) {
    for (var i = 0; i < diodes.length; i++) {
      var d = diodes[i];
      var b = 0.55 + 0.45 * Math.sin(st.drift * 1.6 + d.userData.ph);
      d.material.opacity = b;
      d.material.transparent = true;
      d.scale.setScalar(0.85 + b * 0.35);
    }
    /* Планета медленно едет за окном */
    if (planet) planet.rotation.y += dt * 0.02;
  }

  publish();
  rend.render(scene, cam);
}

/* ── Размер и потеря контекста ───────────────────────────── */
addEventListener("resize", function () {
  var was = phone;
  phone = innerWidth < 760;
  if (!rend) return;
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  rend.setSize(innerWidth, innerHeight, false);
  /* Поворот телефона меняет не только пропорции кадра, но и всю
     постановку: угол объектива и расстояние до стены у вертикального
     и горизонтального кадра разные. Пересчитываем цели той же
     функцией, что и прокрутка, чтобы не заводить второй источник. */
  if (was !== phone) {
    if (scene && scene.fog) scene.fog.density = tiny ? 0.1 : 0.135;
    setProgress(st.p);
  }
}, { passive: true });

function dispose() {
  st.dead = true;
  hide();
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  if (rend) { try { rend.dispose(); } catch (e) {} }
  if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
  if (air && air.parentNode) air.parentNode.removeChild(air);
  if (st.slot && g.RC_GL) { g.RC_GL.give(); st.slot = false; }
  st.built = false;
}

/* ── Точка входа ─────────────────────────────────────────── */
function boot() {
  if (reduced || root.classList.contains("rc-reduced")) return;
  T = g.THREE;
  if (!T) return;
  if (g.RC_GL) {
    g.RC_GL.guard(cv, function () {
      st.shown = false;
      root.classList.remove("rc-inside");
    }, function () {
      if (st.p >= P_IN && st.p < P_OUT) show();
    });
  }
  measure();
  doc.addEventListener("rc:lang", function () { setTimeout(measure, 200); });
  addEventListener("resize", function () { setTimeout(measure, 250); }, { passive: true });
  addEventListener("load", function () { setTimeout(measure, 400); });

  /* Люк корабля открылся - подхватываем сцену тем же кадром, не
     дожидаясь следующего тика прокрутки: окно перехода короткое, и
     опоздание на кадр читается провалом в пустоту. */
  addEventListener("rc:hatch", function (e) {
    if (e && e.detail && e.detail.deep) setProgress(st.p);
  });

  /* Слушаем общий прогресс страницы */
  if (g.RC_MOTION) g.RC_MOTION.on(function (p) { setProgress(p); });
  else addEventListener("scroll", function () {
    var max = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
    setProgress((g.pageYOffset || 0) / max);
  }, { passive: true });
}

/* Ступени качества. Общий сторож кадров в rc-motion.js считает
   тяжёлые кадры и сообщает ступень: на первой мы считаем меньше
   пикселей, на второй гасим планету за окном и её ободок, на
   третьей рубка не поднимается вовсе - вместо кино человек
   получает обычную страницу, но без рывков. */
addEventListener("rc:degrade", function (e) {
  var step = (e && e.detail && e.detail.step) || 0;
  try {
    /* Ступень теперь ходит в обе стороны, поэтому обработчик не
       «снимает лишнее», а описывает состояние целиком: всё, что было
       выключено на низком качестве, обязано вернуться, когда телефон
       справился. Иначе один тяжёлый отрезок навсегда оставлял бы
       комнату без планеты за окном. */
    var full = step < 2;
    for (var j = 0; j < fine.length; j++) fine[j].visible = full;
    if (planet) planet.visible = step < 3;
    if (halo) halo.visible = step < 3;
    if (air) air.classList.toggle("flat", step >= 3);
    if (scene && scene.fog) scene.fog.density = step >= 2 ? 0.09 : (phone ? 0.115 : 0.135);
    if (rend && step === 0) {
      rend.setPixelRatio(Math.min(tiny ? 1.0 : (phone ? 1.45 : 1.6), g.devicePixelRatio || 1));
    }
    /* Первая ступень трогает только число пикселей. Это честный
       рычаг: он не убирает из кадра ни одной детали, ни одного
       блика - картинка та же, просто считается в меньшем разрешении,
       чего на плотном экране телефона глаз почти не различает. */
    if (step >= 1 && rend) rend.setPixelRatio(1);
    /* Вторая ступень снимает мелочь, которую в движении не видно:
       спуски жгутов, отдельные световые пятна. Силовой набор, ниши,
       иллюминаторы и планета за окном остаются - это и есть комната,
       ради которой всё делалось. */
    if (step >= 2) {
      for (var i = 0; i < fine.length; i++) fine[i].visible = false;
      if (scene && scene.fog) scene.fog.density = 0.09;
    }
    /* Третья ступень раньше означала «рубки нет»: кино просто
       выключалось, и владелец на своём телефоне видел вместо фильма
       обычную страницу с кораблём поверх текста. Так нельзя. Сцена
       остаётся всегда - на последней ступени она лишь считается в
       половинном разрешении и без дальней планеты. Сценарий важнее
       любых украшений: вход в корабль, оборот и пульт обязаны
       доиграться на любом устройстве. */
    if (step >= 3) {
      if (rend) rend.setPixelRatio(Math.min(1, (g.devicePixelRatio || 1) * 0.75));
      if (planet) planet.visible = false;
      if (halo) halo.visible = false;
      if (air) air.classList.add("flat");
    }
  } catch (err) {}
});

addEventListener("rc:3d", boot);
if (g.THREE) boot();

g.RC_INTERIOR = {
  prepare: build,
  show: show,
  hide: hide,
  setProgress: setProgress,
  dispose: dispose,
  ready: function () { return st.built; },

  /* Единственный источник правды о повороте. Кинематограф берёт
     его же, поэтому стены и карточки не могут разъехаться. */
  yaw: function () { return st.yaw; },

  /* Угол, на котором стоит приборная панель: по нему слой кабины
     считает своё место в кадре */
  thCon: function () { return TH_CON; },
  yawAt: yawAt,

  /* Расписание панелей: на каком угле стоит какая карточка */
  plan: function () { return PLAN; },

  /* Экранная точка панели: доли ширины и высоты кадра */
  project: project,

  /* Можно ли сейчас вешать содержимое на стены */
  live: function () {
    return !!(st.built && st.shown && !root.classList.contains("rc-reduced") &&
      root.getAttribute("data-degrade") !== "3");
  },

  /* Пересчитать пороги: кинематограф меняет высоту блока
     надёжности и обязан сказать об этом сцене */
  remeasure: measure,

  state: function () {
    return {
      построена: st.built, видна: st.shown, слот: st.slot,
      оборот: (st.yaw * 57.3).toFixed(0),
      проход: st.dolly.toFixed(2),
      /* Доля подхода к пульту: тем же числом живёт оформление
         секции контактов, по нему видно, разошлись они или нет */
      пульт: +st.con.toFixed(3),
      узлов: KNOT.length,
      /* Цена кадра: по этим двум числам видно, не разъелась ли рубка
         сверх бюджета. Считает сам рендерер, гадать не нужно. */
      треугольников: rend ? rend.info.render.triangles : 0,
      вызовов: rend ? rend.info.render.calls : 0,
      /* Пороги входа: по ним видно, почему салон показался или нет */
      доля: +st.p.toFixed(3), порог_вход: +P_IN.toFixed(3),
      порог_выход: +P_OUT.toFixed(3), мёртв: st.dead
    };
  }
};

})(window);
