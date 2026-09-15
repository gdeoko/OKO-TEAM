/* ═══════════════════════════════════════════════════════════
   Rocket CDN · точки касания ракеты и содержимого

   Ракета живёт в трёхмерной сцене, содержимое - обычная вёрстка.
   Чтобы они читались как одно пространство, ракета должна физически
   задевать интерфейс: сдувать чипы на отрыве, будить счётчики,
   бросать пакеты в виджеты, качать карточки струёй, ронять галочки
   на пункты при посадке.

   Правила, из-за которых модуль написан именно так:
   1. Ракета публикует своё экранное положение в RC_ROCKET_POS
      (пиксели вьюпорта). Больше сцена о вёрстке ничего не знает,
      а вёрстка ничего не знает про three.js.
   2. Раз в кадр сначала читаем прямоугольники пачкой, потом пачкой
      пишем стили. Смешивать нельзя: получится forced reflow.
   3. Считаем только то, что реально видно: за видимостью следит
      IntersectionObserver, вне экрана целей нет вообще.
   4. Каждый хук обязан уметь мгновенно встать в конечное состояние.
      Человек может прыгнуть скроллом в любое место, и после прыжка
      ничего не должно остаться недорисованным.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

/* Высоту документа берём из общего кэша: прямой вопрос заставляет
   браузер досчитать вёрстку, а спрашиваем мы её в каждом кадре. */
var DOCH = (window.RC_BOX && window.RC_BOX.docH) || function () {
  return document.documentElement.scrollHeight || 1;
};

/* Переменные оформления пишем через общий кэш: даже на локальном
   элементе запись помечает устаревшим его поддерево, а зовём мы её
   из каждого кадра по всем карточкам. Пишем только изменившееся. */
var V = (g.RC_VAR && g.RC_VAR.set) || function (el, n, v) {
  if (el && el.style) el.style.setProperty(n, v);
};

/* Мерки карточек - из общего кэша. Мы читаем их по всему видимому
   списку в каждом кадре, а сами карточки в этот же кадр двигаем: без
   кэша каждый такой вопрос заставляет браузер пересчитать вёрстку.
   Заодно мерка становится честнее - это место карточки на странице,
   а не то, куда её только что отвёл сам эффект. */
var BOX = (g.RC_BOX && g.RC_BOX.box) || function (el) { return el.getBoundingClientRect(); };

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var $$ = function (s, r) {
  return Array.prototype.slice.call((r || doc).querySelectorAll(s));
};

/* ── Реестр целей ────────────────────────────────────────────
   Каждая запись: селектор, радиус влияния в пикселях и две
   функции. hit вызывается, пока ракета рядом, settle доводит
   элемент до конечного состояния мгновенно. */
var HOOKS = [];
var ITEMS = [];          /* живые цели: {el, hook, seen, vis, r} */
var visible = [];        /* только видимые, по ним и работаем */

function reg(h) { HOOKS.push(h); }

/* Мягкая единица влияния: 1 в центре, 0 на границе радиуса */
function power(dx, dy, r) {
  var d = Math.sqrt(dx * dx + dy * dy);
  if (d >= r) return 0;
  var k = 1 - d / r;
  return k * k * (3 - 2 * k);          /* сглаженная ступенька */
}

/* ── 1. Чипы первого экрана сдувает тягой ─────────────────── */
reg({
  key: "chip",
  sel: ".hero-chips .chip",
  radius: 340,
  hit: function (el, p, dx, dy) {
    /* Отлетают от ракеты, а не в случайную сторону */
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var push = p * 20;
    el.style.transform = "translate3d(" + (-dx / d * push) + "px," + (-dy / d * push * 0.6) + "px,0) rotate(" + (-dx / d * p * 5.5) + "deg)";
    el.style.borderColor = "rgba(66,178,220," + (0.16 + p * 0.5).toFixed(3) + ")";
  },
  rest: function (el) {
    el.style.transform = "";
    el.style.borderColor = "";
  },
  settle: function (el) { el.style.transform = ""; el.style.borderColor = ""; }
});

/* ── 2. Полоса показателей просыпается от пролёта ──────────── */
reg({
  key: "kpi",
  sel: ".kpi-n",
  radius: 300,
  once: true,
  hit: function (el, p) {
    if (p < 0.25 || el._lit) return;
    el._lit = 1;
    /* По одному, а не всей полосой разом: ракета идёт слева направо */
    var all = $$(".kpi-n"), i = all.indexOf(el);
    setTimeout(function () { el.classList.add("rc-lit"); }, Math.max(0, i) * 90);
  },
  settle: function (el) { el._lit = 1; el.classList.add("rc-lit"); }
});

/* ── 3. Три пакета данных летят в виджеты ─────────────────── */
var pktLayer = null;
function packet(fromX, fromY, toX, toY, delay) {
  if (reduced) return;
  if (!pktLayer) {
    pktLayer = doc.createElement("div");
    pktLayer.className = "rc-pkt-layer";
    pktLayer.setAttribute("aria-hidden", "true");
    doc.body.appendChild(pktLayer);
  }
  var i = doc.createElement("i");
  i.className = "rc-pkt";
  i.style.transform = "translate3d(" + fromX + "px," + fromY + "px,0)";
  pktLayer.appendChild(i);
  setTimeout(function () {
    i.style.transform = "translate3d(" + toX + "px," + toY + "px,0)";
    i.style.opacity = "0";
  }, 20 + (delay || 0));
  setTimeout(function () { if (i.parentNode) i.parentNode.removeChild(i); }, 900 + (delay || 0));
}

reg({
  key: "viz",
  sel: ".viz-card",
  radius: 420,
  once: true,
  hit: function (el, p, dx, dy, r, pos) {
    if (p < 0.3 || el._pkt) return;
    el._pkt = 1;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (var k = 0; k < 3; k++) packet(pos.x, pos.y, cx, cy, k * 130);
    setTimeout(function () { el.classList.add("rc-pulse"); }, 620);
    setTimeout(function () { el.classList.remove("rc-pulse"); }, 1500);
  },
  settle: function (el) { el._pkt = 1; }
});

/* ── 3а. Текст расступается перед кораблём ────────────────────
   Раньше корабль сам прятался от слов: подлетая к тексту, он гас
   почти вдвое и читался призраком за буквами. Клиент сказал прямо:
   контент - часть сцены, а не слой поверх неё. Значит уступать
   должен не корабль, а вёрстка: заголовок и абзац, к которым он
   подошёл, отходят в сторону на несколько пикселей и слегка
   отпускают контраст. Корабль остаётся виден целиком, текст
   остаётся читаемым, и оба живут в одном кадре.

   Сдвиг маленький нарочно: это дыхание кадра, а не разъезжающаяся
   вёрстка. На узком экране он ещё вдвое меньше - там двигаться
   некуда, и любое смещение читается поломкой. */
reg({
  key: "flow",
  sel: ".sec-h, .sec-p, .hs-h, .sec-tag",
  radius: 300,
  hit: function (el, p, dx, dy) {
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var room = innerWidth < 760 ? 5 : 11;
    var push = p * room;
    /* Пишем переменные, а не transform: те же заголовки участвуют в
       параллаксе слоёв единого мира (rc-world), и инлайновый
       transform стёр бы их глубину. Мир складывает оба сдвига сам. */
    V(el, "--rc-fx", Math.round(-dx / d * push) + "px");
    V(el, "--rc-fy", Math.round(-dy / d * push * 0.45) + "px");
    el.style.opacity = (1 - p * 0.18).toFixed(3);
  },
  rest: function (el) {
    V(el, "--rc-fx", "0px");
    V(el, "--rc-fy", "0px");
    el.style.opacity = "";
  },
  settle: function (el) { this.rest(el); }
});

/* ── 4. Карточки дата-центров качает струёй ───────────────── */
reg({
  key: "dc",
  sel: ".dc",
  radius: 380,
  hit: function (el, p, dx, dy) {
    var side = dx > 0 ? 1 : -1;
    V(el, "--jet", p.toFixed(2));
    V(el, "--jet-rot", (side * p * 1.8).toFixed(1) + "deg");
  },
  rest: function (el) {
    V(el, "--jet", "0");
    V(el, "--jet-rot", "0deg");
  },
  settle: function (el) { this.rest(el); }
});

/* ── 5. Продукты-спутники кренятся от прохода ─────────────── */
reg({
  key: "prod",
  sel: ".prod-card",
  radius: 300,
  hit: function (el, p, dx, dy) {
    V(el, "--tilt", (-(dx > 0 ? 1 : -1) * p * 3.6).toFixed(1) + "deg");
    V(el, "--lift", (p * 4).toFixed(1) + "px");
  },
  rest: function (el) {
    V(el, "--tilt", "0deg");
    V(el, "--lift", "0px");
  },
  settle: function (el) { this.rest(el); }
});

/* ── 6. Заголовок подсвечивается снизу, когда ракета тормозит ─ */
reg({
  key: "head",
  sel: ".sec-h",
  radius: 330,
  hit: function (el, p) { V(el, "--under", p.toFixed(2)); },
  rest: function (el) { V(el, "--under", "0"); },
  settle: function (el) { V(el, "--under", "0"); }
});

/* ── 7. Шаги маршрута щёлкают отсечками при проходе ───────── */
reg({
  key: "step",
  sel: ".step",
  radius: 280,
  once: true,
  hit: function (el, p) {
    if (p < 0.3 || el._tick) return;
    el._tick = 1;
    el.classList.add("rc-tick");
    /* Частый щелчок под пальцем - через tick: у него своя защёлка
       от треска на быстрой прокрутке */
    if (g.RC_SOUND && g.RC_SOUND.tick) { try { g.RC_SOUND.tick(); } catch (e) {} }
  },
  settle: function (el) { el._tick = 1; el.classList.add("rc-tick"); }
});

/* ── 8. Сценарии применения подтягиваются за ракетой ──────── */
reg({
  key: "case",
  sel: ".case:not(.step)",
  radius: 260,
  hit: function (el, p, dx) {
    V(el, "--drag", Math.round((dx > 0 ? -1 : 1) * p * 5) + "px");
  },
  rest: function (el) { V(el, "--drag", "0px"); },
  settle: function (el) { V(el, "--drag", "0px"); }
});

/* ── 9. Девять пунктов: галочки по световым дорожкам ──────────
   Это единственный хук, который идёт не от близости, а от
   момента посадки: по сценарию пункты приезжают по дорожкам от
   точки касания. Поэтому он живёт на прогрессе, а не на пролёте. */
var incDone = false;
function landing(p) {
  if (incDone || p < 0.6) return;
  var items = $$(".inc-item");
  if (!items.length) return;
  incDone = true;
  items.forEach(function (el, i) {
    setTimeout(function () { el.classList.add("rc-landed"); }, reduced ? 0 : i * 70);
  });
}
function landingSettle() {
  incDone = true;
  $$(".inc-item").forEach(function (el) { el.classList.add("rc-landed"); });
}

/* ── Сборка целей ────────────────────────────────────────── */
var io = null;
function collect() {
  ITEMS.length = 0;
  visible.length = 0;
  if (io) io.disconnect();
  if ("IntersectionObserver" in g) {
    io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        var it = e.target._rcHook;
        if (!it) return;
        it.vis = e.isIntersecting;
      });
      visible = ITEMS.filter(function (i) { return i.vis; });
    }, { rootMargin: "20% 0px 20% 0px" });
  }
  HOOKS.forEach(function (h) {
    $$(h.sel).forEach(function (el) {
      var it = { el: el, h: h, vis: !io, r: null };
      el._rcHook = it;
      if (!el.hasAttribute("data-rocket-hook")) el.setAttribute("data-rocket-hook", h.key);
      ITEMS.push(it);
      if (io) io.observe(el);
    });
  });
  if (!io) visible = ITEMS.slice();
}

/* ── Кадр: сначала все чтения, потом все записи ───────────── */
var raf = null, lastPos = null, idle = 0, lastAt = 0;

function frame(ts) {
  raf = requestAnimationFrame(frame);
  if (doc.hidden) return;

  /* Тридцати раз в секунду хватает: касание ракеты - это мягкое
     покачивание, а не игра. Лишние кадры уходили на чтение
     прямоугольников и подтормаживали прокрутку. */
  var now = ts || (g.performance && performance.now()) || Date.now();
  if (lastAt && now - lastAt < 33) return;
  lastAt = now;

  var pos = g.RC_ROCKET_POS;
  if (!pos || root.classList.contains("rc-reduced")) return;

  /* Быстрая прокрутка: не тратим кадр на мелочь, всё уже досведено */
  if (root.classList.contains("rc-fast")) return;

  /* Дешёвая отсечка: ракета не двигалась - и работы нет */
  if (lastPos && Math.abs(lastPos.x - pos.x) < 0.7 && Math.abs(lastPos.y - pos.y) < 0.7) {
    if (++idle > 4) return;
  } else idle = 0;
  lastPos = { x: pos.x, y: pos.y };

  var n = visible.length, i, it;
  if (!n) return;

  /* Чтение */
  for (i = 0; i < n; i++) {
    it = visible[i];
    it.r = BOX(it.el);
  }

  /* Запись */
  for (i = 0; i < n; i++) {
    it = visible[i];
    var r = it.r;
    if (!r || (!r.width && !r.height)) continue;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = pos.x - cx, dy = pos.y - cy;
    /* Радиус растёт вместе с размером цели: широкая карточка ловит раньше */
    var rad = it.h.radius + Math.min(260, r.width * 0.35);
    var p = power(dx, dy, rad);
    if (p > 0.02) {
      try { it.h.hit(it.el, p, dx, dy, r, pos); } catch (e) {}
      it.active = 1;
      if (!it.el._fired) {
        it.el._fired = 1;
        fire(it.el, p, it.h.key);
      }
    } else if (it.active) {
      it.active = 0;
      it.el._fired = 0;
      if (it.h.rest) { try { it.h.rest(it.el); } catch (e) {} }
    }
  }
}

/* Событие наружу: по нему могут работать звук и посторонние модули */
function fire(el, p, from) {
  try {
    doc.dispatchEvent(new CustomEvent("rocket:hit", {
      detail: { power: p, from: from, el: el }
    }));
  } catch (e) {}
}

/* ── Публичный интерфейс ─────────────────────────────────── */
g.RC_HOOKS = {
  register: reg,
  fire: fire,
  /* Мгновенно довести всё до конечного состояния: нужно при быстрой
     прокрутке и в запасном сценарии, чтобы ничего не осталось
     недорисованным. */
  settleAll: function () {
    ITEMS.forEach(function (it) {
      try { it.h.settle(it.el); } catch (e) {}
    });
    landingSettle();
  },
  refresh: collect,
  stats: function () { return { всего: ITEMS.length, видно: visible.length }; }
};

/* ── Запуск ──────────────────────────────────────────────────
   Цели собираем после того, как язык применён и карточки
   отрисованы: половина блоков строится скриптом. */
function start() {
  collect();
  if (reduced) { g.RC_HOOKS.settleAll(); return; }
  if (!raf) raf = requestAnimationFrame(frame);
}

doc.addEventListener("rc:lang", function () { setTimeout(collect, 60); });
if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { setTimeout(start, 120); });
else setTimeout(start, 120);

/* Посадка идёт от прогресса страницы, а не от близости ракеты */
addEventListener("scroll", function () {
  var max = DOCH() - innerHeight;
  landing(max > 0 ? (g.pageYOffset || doc.documentElement.scrollTop) / max : 0);
}, { passive: true });

addEventListener("resize", function () { setTimeout(collect, 200); }, { passive: true });

/* ── Форма важнее кино ───────────────────────────────────────
   Как только человек встал в поле, сцена вокруг замирает, а все
   украшения над формой снимаются. Причина не только в красоте:
   трансформы и фильтры на предках ломают позиционирование при
   подъёме экранной клавиатуры, а тут у нас живые заявки. */
doc.addEventListener("focusin", function (e) {
  if (!e.target.closest || !e.target.closest("form")) return;
  root.classList.add("rc-form-active");
}, true);

doc.addEventListener("focusout", function (e) {
  if (!e.target.closest || !e.target.closest("form")) return;
  setTimeout(function () {
    var a = doc.activeElement;
    if (!a || !a.closest || !a.closest("form")) root.classList.remove("rc-form-active");
  }, 60);
}, true);

})(window);
