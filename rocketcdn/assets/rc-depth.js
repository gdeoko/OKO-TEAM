/* ═══════════════════════════════════════════════════════════
   Rocket CDN · движок объёма

   Претензия была одна: «всё плоское». Наклон под курсором её не
   снимает - крутится плоская картинка. Объём даёт не поворот, а
   внутренняя толщина предмета и общая точка схода на всю сетку.
   Разметку под это готовит rc-depth.css, а здесь живёт то, что
   нельзя выразить стилями: кто именно сейчас в кадре, кто ближе
   к центру экрана, куда смотрит курсор и как карточка
   возвращается в покой.

   Три правила, из которых вырос весь файл.

   1. Ни одного нового контекста WebGL. Бюджет занят ракетой,
      глобусом, стойкой и рубкой; здесь работает только
      композитор браузера, и стоит это ноль.

   2. Не больше четырёх наклоняющихся карточек в кадре. Это не
      экономия, это режиссура: пять парящих предметов на экране
      читаются как ярмарка. Видимых считаем через
      IntersectionObserver, из них берём четыре ближайшие к
      центру кадра, остальные стоят ровно.

   3. Читаем и пишем раздельно. Сначала пачкой снимаем все
      прямоугольники, потом пачкой пишем стили. Иначе каждый
      второй вызов getBoundingClientRect заставляет браузер
      пересчитывать раскладку, и кадр рушится на ровном месте.

   Вертикальную прокрутку не трогаем ни одним обработчиком.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

/* Место карточки в кадре берём из общего кэша: чтение геометрии
   после записи стиля заставляет браузер пересчитать вёрстку прямо
   в нашем колбэке, и на телефоне это оказалось самой дорогой
   строкой всего кадра. */
var BOX = (g.RC_BOX && g.RC_BOX.box) || function (el) { return el.getBoundingClientRect(); };

/* Переменные оформления пишем через общий кэш: даже на локальном
   элементе запись помечает устаревшим его поддерево, а зовём мы её
   из каждого кадра по всем карточкам. Пишем только изменившееся. */
var V = (g.RC_VAR && g.RC_VAR.set) || function (el, n, v) {
  if (el && el.style) el.style.setProperty(n, v);
};
var D = (g.RC_VAR && g.RC_VAR.del) || function (el, n) {
  if (el && el.style) el.style.removeProperty(n);
};

var doc = document, root = doc.documentElement;

/* ── Кого поднимаем в объём ─────────────────────────────────
   Всё, у чего есть корпус, значок и текст. Ленты, списки и форму
   не трогаем: форма - рабочий инструмент, она стоит твёрдо. */
var SEL = ".card, .viz-card, .dc, .flow-node";
/* Заголовки берут только параллакс глубины: титр и подзаголовок
   едут с разной скоростью, между ними появляется воздух. */
var SEL_HEAD = ".sec-h, .sec-p";
/* Горизонтальная лента уже едет вбок от прокрутки. Наклон поверх
   этого читается как болтанка колеса, а не как объём, поэтому её
   карточкам оставляем только разлёт слоёв - он статический и
   второго движения не добавляет. */
var SEL_STILL = ".hs-track";

var MAX_TILT = 4;      /* потолок одновременно наклонённых карточек */
var RX = 6;            /* потолок наклона по X от курсора, градусы */
var RY = 8;            /* потолок наклона по Y от курсора, градусы */
var RX_FRAME = 4;      /* разворот от положения в кадре, градусы */
var TZ_UP = 40;        /* уход вглубь выше центра экрана, пиксели */
var TZ_DOWN = 30;      /* и ниже центра */
var PAR = 14;          /* размах параллакса глубины, пиксели */
var LIFT = 9;          /* подъём карточки под курсором */
var FLOAT = 5;         /* размах собственного парения, пиксели */

/* Пружина критического демпфирования: ни колебаний, ни ватного
   возврата. У такой пружины остаток хода равен (1+wt)·e^(-wt);
   заказан покой за 420 мс, значит на этой отметке должно остаться
   процентов пять - отсюда w = 11.5 рад/с, жёсткость w²,
   сопротивление 2w. */
var SPR_K = 132, SPR_C = 23;
/* Шаг интегрирования. Считать пружину одним шагом на кадр нельзя:
   на слабой машине кадр растягивается до сотни миллисекунд, шаг
   приходится обрезать ради устойчивости, и пружина начинает
   отставать от настоящего времени в разы. Дробим длинный кадр на
   короткие шаги - и устойчиво, и по часам честно. */
var SUB = 0.02;
/* Слежение за курсором отдельно и без пружины: за пальцем нельзя
   опаздывать, иначе карточка кажется приклеенной к чужому месту. */
var TRACK = 0.14;

var reduce = false, fine = false;
try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
try { fine = matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (e) {}

var cards = [];        /* всё заявленное */
var visible = [];      /* сейчас в кадре, по данным IntersectionObserver */
var heads = [];        /* заголовки на параллаксе */
var headsVis = [];
var io = null, ioHead = null;
var hoverEl = null, mx = 0, my = 0;
var lastFrame = 0, tSec = 0;
var seq = 0;
var off = false;       /* полный стоп: покой, слабое устройство, третья ступень */

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

/* ── Кто сейчас главный по transform ─────────────────────────
   Карточкам пишет transform ещё и rc-scroll.js. Помечаем свои,
   чтобы он их даже не собирал: лишняя работа в его цикле нам ни
   к чему, а спор за свойство разводит приоритет в rc-depth.css. */
function claim(el) {
  el._d3 = 1;
  el.classList.remove("d3");
}

/* ── Перелив по стеклу ───────────────────────────────────────
   Отдельный слой, потому что псевдоэлементы у этих карточек уже
   разобраны: подсветка курсора, размытое пятно, струя ракеты.
   Ставим последним ребёнком - он вне потока и раскладку не
   трогает. */
function sheen(el) {
  if (el.querySelector(":scope > .rcd-sheen")) return;
  var i = doc.createElement("i");
  i.className = "rcd-sheen";
  i.setAttribute("aria-hidden", "true");
  el.appendChild(i);
}

/* ── Сцена: перспектива живёт на контейнере ──────────────────
   Одна точка схода на всю сетку. Если раздать перспективу
   карточкам поштучно, у каждой будет свой зритель и ряд
   развалится на несвязанные плитки. */
function stage(el) {
  var p = el.parentElement;
  if (p && !p.classList.contains("rcd-stage")) p.classList.add("rcd-stage");
}

/* ── Сбор ────────────────────────────────────────────────────
   Блоки достраиваются при смене языка, поэтому проходов будет
   много. Уже взятое пропускаем по метке. */
function collect() {
  if (off) return;
  var list = doc.querySelectorAll(SEL), i, el, rec;

  for (i = 0; i < list.length; i++) {
    el = list[i];
    if (el._rcd) continue;
    /* Пока блок не появился, transform у него занят выездом .rv.
       Перехватим сейчас - выезд не состоится. Дождёмся. */
    if (el.classList.contains("rv") && !el.classList.contains("on")) continue;
    el._rcd = 1;
    claim(el);
    stage(el);
    sheen(el);
    el.classList.add("rcd");
    rec = {
      el: el, live: false, hov: false,
      still: !!(el.closest && el.closest(SEL_STILL)),
      rx: 0, ry: 0, tz: 0, lift: 0,       /* текущее состояние */
      vrx: 0, vry: 0, vtz: 0, vlift: 0,   /* скорости пружины */
      k: 0, kw: -1, y: 0, yw: 999,
      ph: (seq++ % 7) * 0.9               /* фаза парения: соседи не в такт */
    };
    el._rcdRec = rec;
    cards.push(rec);
    if (io) io.observe(el); else visible.push(rec);
  }

  var hl = doc.querySelectorAll(SEL_HEAD);
  for (i = 0; i < hl.length; i++) {
    el = hl[i];
    if (el._rcdH) continue;
    el._rcdH = 1;
    el.classList.add("rcd-head");
    rec = { el: el, k: el.classList.contains("sec-p") ? 1.7 : 1, y: 0, yw: 999 };
    el._rcdHRec = rec;
    heads.push(rec);
    if (ioHead) ioHead.observe(el); else headsVis.push(rec);
  }
}

/* ── Появление секции строками ───────────────────────────────
   Шаг 60 мс по месту элемента в своей строке. Жёстко прошитые
   rv-d1..rv-d6 снимаем: они дают чужой ритм и ломают лесенку в
   тех сетках, где карточек больше шести. Трогаем только то, что
   ещё не выехало, - иначе выезд дёрнется на середине. */
function rows() {
  var list = doc.querySelectorAll(".rv:not(.on)"), i, el, p, idx;
  for (i = 0; i < list.length; i++) {
    el = list[i];
    if (el._rcdRow) continue;
    el._rcdRow = 1;
    p = el.parentElement;
    if (!p) continue;
    idx = 0;
    for (var j = 0; j < p.children.length; j++) {
      if (p.children[j] === el) break;
      if (p.children[j].classList && p.children[j].classList.contains("rv")) idx++;
    }
    for (var d = 1; d <= 6; d++) el.classList.remove("rv-d" + d);
    el.classList.add("rcd-row");
    /* Восемь ступеней - потолок: полсекунды ожидания это уже не
       премиальность, а тормоза. */
    V(el, "--rcd-i", String(idx > 8 ? 8 : idx));
  }
}

/* ── Курсор ──────────────────────────────────────────────────
   Один слушатель на документ вместо сотни на карточки. Пассивный,
   прокрутку не перехватывает. */
function watchPointer() {
  if (!fine) return;
  doc.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    mx = e.clientX; my = e.clientY;
    var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
    if (el && !el._rcdRec) el = null;
    if (el === hoverEl) return;
    if (hoverEl && hoverEl._rcdRec) hoverEl._rcdRec.hov = false;
    hoverEl = el;
    if (el) el._rcdRec.hov = true;
  }, { passive: true });

  /* Курсор ушёл за окно - отпускаем карточку, иначе она застынет
     наклонённой до следующего движения мыши. */
  doc.addEventListener("pointerleave", function () {
    if (hoverEl && hoverEl._rcdRec) hoverEl._rcdRec.hov = false;
    hoverEl = null;
  }, { passive: true });
}

/* ── Кадр ────────────────────────────────────────────────────
   Сначала все чтения, потом все записи. */
var readBuf = [];

function frame(dt) {
  var vh = innerHeight, half = vh / 2, i, rec, r;
  var fast = root.classList.contains("rc-fast");

  /* ── чтение ── */
  readBuf.length = 0;
  for (i = 0; i < visible.length; i++) {
    rec = visible[i];
    r = BOX(rec.el);
    if (!r.height) continue;
    /* Положение центра карточки относительно центра экрана,
       в долях высоты окна: -0.5 наверху, 0 в центре, +0.5 внизу. */
    rec.p = clamp(((r.top + r.height / 2) - half) / vh, -0.5, 0.5);
    /* Насколько карточка вошла в кадр: полный разлёт слоёв
       набирается за 40% высоты экрана, как заказано сценарием. */
    var deep = Math.min((vh - r.top) / (vh * 0.4), r.bottom / (vh * 0.4));
    rec.kT = clamp(deep, 0, 1);
    /* Центр и полуразмеры кладём тут же: они понадобятся на записи
       для наклона под курсором, а лезть за прямоугольником после
       первой же записи стилей - значит заставить браузер заново
       считать раскладку посреди кадра. */
    rec.cx = r.left + r.width / 2;
    rec.cy = r.top + r.height / 2;
    rec.hw = r.width / 2 || 1;
    rec.hh = r.height / 2 || 1;
    /* Карточки ленты уводим в конец очереди: слоями они живут,
       а место в четвёрке наклоняющихся занимать не имеют права. */
    rec.d = rec.still ? 1e6 : Math.abs(rec.p);
    readBuf.push(rec);
  }

  var headRead = [];
  for (i = 0; i < headsVis.length; i++) {
    r = BOX(headsVis[i].el);
    headsVis[i].p = clamp(((r.top + r.height / 2) - half) / vh, -0.7, 0.7);
    headRead.push(headsVis[i]);
  }

  /* ── выбор четвёрки ──
     Ближайшие к центру кадра. Сортируем короткий список видимых,
     это дешевле, чем держать его отсортированным всегда. */
  readBuf.sort(function (a, b) { return a.d - b.d; });
  var limit = fast ? 0 : MAX_TILT;
  var deg = parseInt(root.getAttribute("data-degrade") || "0", 10);
  if (deg >= 3) limit = 0;
  else if (deg === 2) limit = Math.min(limit, 2);

  /* ── запись ── */
  for (i = 0; i < readBuf.length; i++) {
    rec = readBuf[i];
    var wantLive = i < limit && !rec.still;

    /* Цель по наклону. Разворот от положения в кадре есть всегда,
       он и есть объём на телефоне: выше центра карточка отклонена
       назад, в центре ровная, ниже - подана вперёд. */
    var rxT = 0, ryT = 0, tzT = 0, liftT = 0;
    if (wantLive) {
      rxT = -rec.p * 2 * RX_FRAME;
      tzT = -Math.abs(rec.p) * 2 * (rec.p < 0 ? TZ_UP : TZ_DOWN);
      if (rec.hov && fine) {
        var dx = clamp((mx - rec.cx) / rec.hw, -1, 1);
        var dy = clamp((my - rec.cy) / rec.hh, -1, 1);
        rxT = clamp(rxT - dy * RX, -(RX + RX_FRAME), RX + RX_FRAME);
        ryT = dx * RY;
        tzT += 26;
        liftT = -LIFT;
        V(rec.el, "--rcd-gl", (118 + dx * 55).toFixed(0) + "deg");
      }
      /* Собственное парение: медленный синус, у соседей своя фаза.
         Раньше это делали keyframes, но их нельзя остановить на
         перемотке и в режимах деградации. */
      if (rec.el.classList.contains("float-3d")) {
        liftT += Math.sin(tSec * 0.85 + rec.ph) * FLOAT;
      }
    }

    /* Пружина или слежение. Под курсором идём почти без задержки,
       отпустили - возвращаемся пружиной за 420 мс. */
    if (rec.hov && fine && wantLive) {
      var f = 1 - Math.pow(1 - TRACK, dt * 60);
      rec.rx += (rxT - rec.rx) * f; rec.vrx = 0;
      rec.ry += (ryT - rec.ry) * f; rec.vry = 0;
      rec.tz += (tzT - rec.tz) * f; rec.vtz = 0;
      rec.lift += (liftT - rec.lift) * f; rec.vlift = 0;
    } else {
      var steps = Math.ceil(dt / SUB), sdt = dt / steps, n;
      for (n = 0; n < steps; n++) {
        rec.vrx += ((rxT - rec.rx) * SPR_K - rec.vrx * SPR_C) * sdt; rec.rx += rec.vrx * sdt;
        rec.vry += ((ryT - rec.ry) * SPR_K - rec.vry * SPR_C) * sdt; rec.ry += rec.vry * sdt;
        rec.vtz += ((tzT - rec.tz) * SPR_K - rec.vtz * SPR_C) * sdt; rec.tz += rec.vtz * sdt;
        rec.vlift += ((liftT - rec.lift) * SPR_K - rec.vlift * SPR_C) * sdt; rec.lift += rec.vlift * sdt;
      }
    }

    /* Пришли в покой - перестаём писать и снимаем слой
       композитора. Без этого страница держит десятки слоёв
       впустую и на телефоне это видно по памяти. */
    var rest = Math.abs(rec.rx) < 0.02 && Math.abs(rec.ry) < 0.02 &&
               Math.abs(rec.tz) < 0.2 && Math.abs(rec.lift) < 0.2 &&
               Math.abs(rec.vrx) < 0.05 && Math.abs(rec.vlift) < 0.5;

    if (wantLive !== rec.live) {
      rec.live = wantLive;
      rec.el.classList.toggle("rcd-live", wantLive);
    }
    if (!wantLive && rest) {
      if (rec.wrote) {
        rec.wrote = 0;
        D(rec.el, "--rcd-rx");
        D(rec.el, "--rcd-ry");
        D(rec.el, "--rcd-tz");
        D(rec.el, "--rcd-lift");
      }
    } else {
      rec.wrote = 1;
      V(rec.el, "--rcd-rx", rec.rx.toFixed(1) + "deg");
      V(rec.el, "--rcd-ry", rec.ry.toFixed(1) + "deg");
      V(rec.el, "--rcd-tz", Math.round(rec.tz) + "px");
      V(rec.el, "--rcd-lift", Math.round(rec.lift) + "px");
    }

    /* Разлёт слоёв и параллакс. Пишем через порог, а не каждый
       кадр: без этого карточка дрожит на третьем знаке. */
    var kT = rec.kT;
    if (Math.abs(kT - rec.kw) > 0.01) {
      rec.kw = kT;
      V(rec.el, "--rcd-k", kT.toFixed(1));
    }
    var yT = fast ? 0 : -rec.p * PAR;
    if (Math.abs(yT - rec.yw) > 0.25) {
      rec.yw = yT;
      V(rec.el, "--rcd-y", Math.round(yT) + "px");
    }
  }

  /* Заголовки: только параллакс глубины, ничего больше */
  for (i = 0; i < headRead.length; i++) {
    rec = headRead[i];
    var hy = fast ? 0 : -rec.p * PAR * 0.55 * rec.k;
    if (Math.abs(hy - rec.yw) > 0.25) {
      rec.yw = hy;
      V(rec.el, "--rcd-y", Math.round(hy) + "px");
    }
  }
}

/* ── Цикл ────────────────────────────────────────────────────
   Живёт на общем такте из rc-motion.js, если он поднялся: один
   requestAnimationFrame на весь сайт - его же правило. Своим
   кадром пользуемся только как запасным. */
function tick(ts) {
  if (off) return;
  if (doc.hidden) { lastFrame = 0; return; }
  var dt = lastFrame ? (ts - lastFrame) / 1000 : 0.016;
  lastFrame = ts;
  /* Частоту держим ту, что назначил rc-motion.js: на простое он
     роняет её до 20 кадров, и объёму спорить не о чем. */
  var minF = (g.RC_MOTION && g.RC_MOTION.minFrame) ? g.RC_MOTION.minFrame() / 1000 : 0;
  if (dt < minF * 0.9) { lastFrame = ts - dt * 1000; return; }
  /* Потолок в 120 мс - страховка от возврата из фоновой вкладки:
     догонять полсекунды одним кадром незачем, всё равно никто не
     видел. */
  dt = clamp(dt, 0.004, 0.12);
  tSec += dt;
  frame(dt);
}

function ownLoop(ts) {
  requestAnimationFrame(ownLoop);
  tick(ts);
}

/* ── Стоп ────────────────────────────────────────────────────
   Снимаем всё, что успели навесить, и уходим. Возврата нет:
   мигание качеством раздражает сильнее плоской картинки. */
function stop() {
  if (off) return;
  off = true;
  for (var i = 0; i < cards.length; i++) {
    var ce = cards[i].el;
    D(ce, "--rcd-rx"); D(ce, "--rcd-ry");
    D(ce, "--rcd-tz"); D(ce, "--rcd-lift");
    D(ce, "--rcd-y");  D(ce, "--rcd-k");
    cards[i].el.classList.remove("rcd-live");
  }
  for (i = 0; i < heads.length; i++) D(heads[i].el, "--rcd-y");
  if (io) io.disconnect();
  if (ioHead) ioHead.disconnect();
}

/* ── Запуск ─────────────────────────────────────────────────
   На покое и в запасном сценарии не заводимся вовсе: там страница
   честно плоская, и это её вторая рабочая сборка, а не поломка. */
function boot() {
  if (reduce || g.RC_REDUCED || root.classList.contains("rc-reduced")) { off = true; return; }

  if (g.IntersectionObserver) {
    io = new IntersectionObserver(function (ents) {
      for (var i = 0; i < ents.length; i++) {
        var rec = ents[i].target._rcdRec;
        if (!rec) continue;
        var at = visible.indexOf(rec);
        if (ents[i].isIntersecting) { if (at < 0) visible.push(rec); }
        else if (at >= 0) {
          visible.splice(at, 1);
          /* За кадром состояние обнуляем разом: возвращаться
             пружиной там, где никто не смотрит, незачем. */
          rec.rx = rec.ry = rec.tz = rec.lift = 0;
          rec.vrx = rec.vry = rec.vtz = rec.vlift = 0;
          rec.kw = rec.yw = 999;
          rec.live = false; rec.wrote = 0;
          rec.el.classList.remove("rcd-live");
          D(rec.el, "--rcd-rx"); D(rec.el, "--rcd-ry");
          D(rec.el, "--rcd-tz"); D(rec.el, "--rcd-lift");
          V(rec.el, "--rcd-k", "0");
          V(rec.el, "--rcd-y", "0px");
        }
      }
    }, { rootMargin: "14% 0px" });

    ioHead = new IntersectionObserver(function (ents) {
      for (var i = 0; i < ents.length; i++) {
        var rec = ents[i].target._rcdHRec;
        if (!rec) continue;
        var at = headsVis.indexOf(rec);
        if (ents[i].isIntersecting) { if (at < 0) headsVis.push(rec); }
        else if (at >= 0) {
          headsVis.splice(at, 1);
          rec.yw = 999;
          V(rec.el, "--rcd-y", "0px");
        }
      }
    }, { rootMargin: "10% 0px" });
  }

  rows();
  collect();
  watchPointer();

  if (g.RC_MOTION && g.RC_MOTION.on) {
    /* rc-motion.js уже держит единственный кадр на весь сайт и
       сам молчит при document.hidden - подписываемся к нему. */
    g.RC_MOTION.on(function () { tick(performance.now()); });
  } else {
    requestAnimationFrame(ownLoop);
  }

  /* Блоки перерисовываются при смене языка, новые карточки должны
     получить объём. И первые секунды страница ещё дособирается. */
  doc.addEventListener("rc:lang", function () {
    setTimeout(function () { rows(); collect(); }, 80);
  });
  addEventListener("rc:reduced", stop);
  addEventListener("rc:degrade", function (e) {
    if (e && e.detail && e.detail.step >= 3) stop();
  });
  addEventListener("load", function () { setTimeout(function () { rows(); collect(); }, 120); });
  [600, 1500, 3000, 6000].forEach(function (ms) {
    setTimeout(function () { rows(); collect(); }, ms);
  });
  /* Карточки берём в объём по мере появления: пока блок выезжает,
     transform занят выездом, и перехватывать его нельзя. */
  /* Сторож карточек: на скрытой вкладке искать нечего, а обход всего
     документа каждые девять десятых секунды - работа впустую */
  setInterval(function () { if (!off && !doc.hidden) collect(); }, 900);
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
else boot();

/* Наружу отдаём только то, что нужно для проверок и отладки */
g.RC_DEPTH = {
  stop: stop,
  rescan: function () { rows(); collect(); },
  stats: function () {
    var live = 0;
    for (var i = 0; i < cards.length; i++) if (cards[i].live) live++;
    return { cards: cards.length, visible: visible.length, live: live, max: MAX_TILT, off: off };
  }
};
})(window);
