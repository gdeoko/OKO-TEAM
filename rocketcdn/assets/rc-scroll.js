/* ═══════════════════════════════════════════════════════════
   RocketCDN · прокрутка и кинематика.

   Плавный скролл, бесшовное зацикливание страницы, привязка
   полёта ракеты к прогрессу, параллакс, магнитные кнопки и
   курсор на больших экранах.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

/* Высоту документа берём из общего кэша: прямой вопрос заставляет
   браузер досчитать вёрстку, а спрашиваем мы её в каждом кадре. */
var DOCH = (window.RC_BOX && window.RC_BOX.docH) || function () {
  return document.documentElement.scrollHeight || 1;
};

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
var TOUCH  = matchMedia("(hover: none)").matches || "ontouchstart" in g;
var FINE   = matchMedia("(hover: hover) and (pointer: fine)").matches;

var rocket = null, lastY = 0, vel = 0;

/* ── Бесшовный цикл страницы: снят ───────────────────────────
   Клиент попросил убрать зацикленность: страница кончается внизу,
   дальше работает кнопка «наверх». Флаг LOOP стоял в false, но весь
   аппарат цикла оставался на месте и продолжал стоить кадров:
   слушатели wheel и touchmove звали пустую функцию на каждое
   событие колеса и каждый палец, а замер точки склейки читал
   scrollHeight по загрузке, по шрифтам, по наблюдателю за размерами
   и ещё четырьмя таймерами - и каждое такое чтение заставляет браузер
   досчитать вёрстку. Всё это ради переменной, которая по построению
   всегда ноль.

   Снято целиком: клон первого экрана, замер склейки, наблюдение за
   раскладкой ради него, телепорт и обе проверки цикла. Кнопка
   «наверх» и прогресс к циклу отношения не имеют и остались. */

function pos() { return g.scrollY || g.pageYOffset || 0; }

/* ── Прогресс для ракеты ─────────────────────────────────── */
function progress() {
  var y = pos();
  var span = (DOCH() - innerHeight) || 1;
  return (y / span) % 1;
}

function pushProgress() {
  if (!rocket) return;
  rocket.setProgress(progress(), vel);
}

/* ── Параллакс ───────────────────────────────────────────── */
var parItems = [];
function collectParallax() {
  parItems = $$("[data-par]").map(function (el) {
    return { el: el, k: parseFloat(el.dataset.par) || 0.12 };
  });
}
/* Параллакс разведён на чтение и запись. Причина не в красоте: пока
   чтение места и запись трансформа шли вперемешку, каждый следующий
   вопрос о месте заставлял браузер пересчитать стиль посреди кадра.
   Сначала спрашиваем обо всём, потом двигаем всё. */
var parRead = [];
function readParallax() {
  parRead.length = 0;
  if (REDUCE) return;
  var vh = innerHeight;
  for (var i = 0; i < parItems.length; i++) {
    var it = parItems[i];
    var r = it.el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) continue;
    it._mid = r.top + r.height / 2 - vh / 2;
    parRead.push(it);
  }
}
function writeParallax() {
  for (var i = 0; i < parRead.length; i++) {
    var it = parRead[i];
    it.el.style.transform = "translate3d(0," + (-it._mid * it.k).toFixed(2) + "px,0)";
  }
}

/* ── Магнитные кнопки ──────────────────────────────────────
   Мышь над кнопкой шлёт до сотни событий в секунду, и на каждом
   здесь спрашивали место кнопки, а следующей же строкой писали ей
   трансформ. Вопрос после записи стиля - это принудительный пересчёт
   вёрстки, то есть сотня пересчётов в секунду просто за то, что
   указатель лежит на кнопке. Слушатель вдобавок не был помечен
   пассивным, и браузер на всякий случай ждал, не отменят ли прокрутку.

   Кнопка под указателем не двигается и не меняет размер: место
   достаточно узнать один раз, на входе указателя, и держать до
   выхода. Прокрутка и изменение окна мерку сбрасывают. Сам сдвиг
   пишем в кадре, а не прямо в событии: между двумя кадрами браузер
   всё равно покажет только последнее значение. */
var magBoxes = [];
function dropMagBoxes() {
  for (var i = 0; i < magBoxes.length; i++) magBoxes[i]();
}
function magnetics() {
  if (!FINE || REDUCE) return;
  $$(".btn-p, .btn-g, .icon-btn").forEach(function (b) {
    var box = null, want = "", queued = false;

    function put() {
      queued = false;
      if (b._magTf === want) return;
      b._magTf = want;
      b.style.transform = want;
    }
    b.addEventListener("mouseenter", function () { box = null; }, { passive: true });
    b.addEventListener("mousemove", function (e) {
      if (!box) {
        var r = b.getBoundingClientRect();
        if (!r.width || !r.height) return;
        box = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
      }
      var dx = (e.clientX - box.cx) / box.w;
      var dy = (e.clientY - box.cy) / box.h;
      want = "translate(" + (dx * 7).toFixed(1) + "px," + (dy * 6).toFixed(1) + "px)";
      if (!queued) { queued = true; requestAnimationFrame(put); }
    }, { passive: true });
    b.addEventListener("mouseleave", function () {
      box = null;
      want = "";
      if (!queued) { queued = true; requestAnimationFrame(put); }
    }, { passive: true });

    /* Страница поехала или окно сменило размер - кнопка под
       указателем теперь в другом месте, мерку выбрасываем */
    magBoxes.push(function () { box = null; });
  });
}

/* ── Курсор ──────────────────────────────────────────────── */
function cursor() {
  if (!FINE || REDUCE) return;
  var dot = document.createElement("div");
  var ring = document.createElement("div");
  dot.className = "cur-dot";
  ring.className = "cur-ring";
  document.body.appendChild(dot);
  document.body.appendChild(ring);

  var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
  var craf = 0;

  /* Кольцо догоняет указатель по экспоненте, то есть догоняет его
     за несколько кадров и дальше стоит вместе с ним. Цикл же крутился
     вечно: на неподвижной мыши он каждый кадр считал те же числа и
     писал в стиль ту же строку, и так все шестьдесят раз в секунду
     весь визит, включая свёрнутую вкладку.

     Теперь цикл живёт ровно столько, сколько идёт догон. Сошлись
     координаты - цикл снимается сам, движение мыши заводит его
     заново. Уход со вкладки тоже останавливает: в фоне кольца никто
     не видит, а по возвращении оно встаёт на место мгновенно. */
  function ride() {
    craf = 0;
    if (document.hidden) return;
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    /* Полпикселя - предел того, что вообще может показать экран */
    var done = Math.abs(mx - rx) < 0.5 && Math.abs(my - ry) < 0.5;
    if (done) { rx = mx; ry = my; }
    ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
    if (!done) craf = requestAnimationFrame(ride);
  }
  function chase() {
    if (!craf && !document.hidden) craf = requestAnimationFrame(ride);
  }

  addEventListener("mousemove", function (e) {
    if (!document.documentElement.classList.contains("cursor-live")) {
      document.documentElement.classList.add("cursor-live");
    }
    mx = e.clientX; my = e.clientY;
    dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
    var t = e.target;
    var hot = t.closest && t.closest("a, button, .card, .node-row, .faq-q, input, textarea, select");
    ring.classList.toggle("on", !!hot);
    chase();
  }, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (craf) { cancelAnimationFrame(craf); craf = 0; }
      return;
    }
    /* Вернулись во вкладку: догонять нечего, ставим кольцо сразу */
    rx = mx; ry = my;
    ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
  });

  ride();
  document.documentElement.classList.add("has-cursor");
}

/* ── Плавная прокрутка ───────────────────────────────────────
   Пробовали внешний движок сглаживания: он перехватывает позицию и
   на стыке бесконечного цикла страница дёргается назад. Нативная
   прокрутка ведёт себя предсказуемо, а плавность даёт
   scroll-behavior и сами анимации. */



/* ── Горизонтальная лента: вертикальный скролл двигает вбок ─ */
var hsList = [];
function collectHS() {
  hsList = $$(".hs").map(function (sec) {
    return { sec: sec, track: $(".hs-track", sec), bar: $(".hs-bar i", sec) };
  }).filter(function (h) { return h.track; });
  sizeHS();
}
function sizeHS() {
  if (innerWidth <= 900) {
    hsList.forEach(function (h) { h.sec.style.height = ""; h.track.style.transform = ""; });
    return;
  }
  hsList.forEach(function (h) {
    var over = Math.max(0, h.track.scrollWidth - innerWidth);
    h.span = over;
    /* Высота секции задаёт, сколько прокрутки уходит на проезд ленты.
       Коэффициент меньше единицы: лента едет вбок быстрее, чем палец
       вниз, и раздел не растягивает страницу. */
    h.sec.style.height = Math.round(innerHeight * 0.72 + over * 0.42) + "px";
  });
}
var hsRead = [];
function readHS() {
  hsRead.length = 0;
  if (innerWidth <= 900) return;
  for (var i = 0; i < hsList.length; i++) {
    var h = hsList[i];
    if (!h.span) continue;
    var r = h.sec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    var total = h.sec.offsetHeight - innerHeight;
    h._p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    hsRead.push(h);
  }
}
function writeHS() {
  for (var i = 0; i < hsRead.length; i++) {
    var h = hsRead[i];
    h.track.style.transform = "translate3d(" + (-h._p * h.span).toFixed(1) + "px,0,0)";
    if (h.bar) h.bar.style.setProperty("--p", (8 + h._p * 92).toFixed(1) + "%");
  }
}

/* ── Заголовки вскрываются по словам ─────────────────────── */
function escHtml(t) {
  return String(t).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function splitWords() {
  if (REDUCE) return;
  $$(".sec-h[data-i18n], .hero h1 [data-i18n], #heroClone h1 span").forEach(function (el) {
    var text = (el.textContent || "").trim();
    /* Перевод перезаписывает textContent и стирает разбивку, поэтому
       смотрим не только на текст, но и на то, жива ли она сейчас */
    if (!text) return;
    if (el._split === text && el.querySelector(".w")) return;
    el._split = text;
    el.innerHTML = text.split(/\s+/).map(function (w, i) {
      return '<span class="w" style="--i:' + i + '"><i>' + escHtml(w) + "</i></span>";
    }).join(" ");
  });
  /* Первый экран запускаем сразу после раскладки */
  $$(".hero h1").forEach(function (h) {
    if (h.classList.contains("words-in")) return;
    void h.offsetWidth;
    requestAnimationFrame(function () { h.classList.add("words-in"); });
  });
}

/* ── Объём карточек ──────────────────────────────────────────
   Под курсором карточка поворачивается, а её внутренние слои
   расходятся по глубине. Без мыши, на телефоне, тот же объём
   даёт прокрутка: карточка доворачивается по своему положению
   на экране, поэтому лента живёт и под пальцем. */
var SEL3D = ".card, .dc";
var d3list = [], d3io = null;

function collect3D() {
  if (REDUCE) return;
  if (!d3io && g.IntersectionObserver) {
    d3io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        var i = d3list.indexOf(e.target);
        if (e.isIntersecting) { if (i < 0) d3list.push(e.target); }
        else if (i >= 0) { d3list.splice(i, 1); e.target.style.transform = ""; }
      });
    }, { rootMargin: "12% 0px" });
  }
  $$(SEL3D).forEach(function (el) {
    if (el._d3) return;
    el._d3 = 1;
    el.classList.add("d3");
    if (d3io) d3io.observe(el); else d3list.push(el);
  });
}

var d3read = [];
function read3D() {
  d3read.length = 0;
  if (REDUCE) return;
  var vh = innerHeight, half = vh / 2;
  for (var i = 0; i < d3list.length; i++) {
    var el = d3list[i];
    if (el._hov) continue;
    var r = el.getBoundingClientRect();
    var p = ((r.top + r.height / 2) - half) / vh;
    if (p < -0.9) p = -0.9; else if (p > 0.9) p = 0.9;
    el._p3 = p;
    d3read.push(el);
  }
}
function write3D() {
  for (var i = 0; i < d3read.length; i++) {
    var el = d3read[i];
    el.style.transform = "perspective(1100px) rotateX(" + (-el._p3 * 4.6).toFixed(2) + "deg)";
  }
}

function tilt() {
  if (REDUCE) return;
  collect3D();
  if (!FINE) return;
  document.addEventListener("mousemove", function (e) {
    var c = e.target.closest && e.target.closest(SEL3D + ", .viz-card");
    if (!c) return;
    var r = c.getBoundingClientRect();
    var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    c._hov = 1;
    c.classList.add("tilt");
    c.style.setProperty("--gl", (120 + dx * 60).toFixed(0) + "deg");
    c.style.transform = "perspective(1100px) rotateX(" + (-dy * 7).toFixed(2) + "deg) rotateY(" +
      (dx * 8).toFixed(2) + "deg) translateY(-5px) scale(1.012)";
  }, { passive: true });
  document.addEventListener("mouseout", function (e) {
    var c = e.target.closest && e.target.closest(SEL3D + ", .viz-card");
    if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return;
    c._hov = 0;
    c.classList.remove("tilt");
    c.style.transform = "";
  }, { passive: true });
}

/* ── Кольцо прогресса вокруг кнопки «наверх» ─────────────── */
var ringEl = null, ringLen = 0;
function buildRing() {
  var btn = $("#toTop");
  if (!btn || $("svg.ring", btn)) return;
  var R = 24, C2 = 2 * Math.PI * R;
  btn.insertAdjacentHTML("afterbegin",
    '<svg class="ring" viewBox="0 0 54 54" aria-hidden="true">' +
      '<circle class="bg" cx="27" cy="27" r="' + R + '"/>' +
      '<circle class="fg" cx="27" cy="27" r="' + R + '" stroke-dasharray="' + C2 + '" stroke-dashoffset="' + C2 + '"/>' +
    "</svg>");
  ringEl = $("svg.ring .fg", btn);
  ringLen = C2;
}
function updateRing(p) {
  if (!ringEl) return;
  ringEl.style.strokeDashoffset = (ringLen - ringLen * Math.min(1, Math.max(0, p))).toFixed(2);
}

/* ── Общий обработчик прокрутки ──────────────────────────── */
var ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(function () {
    ticking = false;
    /* Сначала весь кадр читается, потом весь кадр пишется */
    readParallax();
    readHS();
    read3D();
    pushProgress();
    writeParallax();
    writeHS();
    write3D();
    updateRing(progress());
  });
}

/* ── Запуск ──────────────────────────────────────────────── */

function boot() {
  collectParallax();
  collectHS();

  /* Ракету заводим, когда объёмный слой доехал: библиотека тянется
     после загрузки страницы, чтобы первый экран не платил за неё */
  var cv = $("#rocketCanvas");
  function makeRocket() {
    if (!cv || rocket || !g.RCRocket) return;
    rocket = g.RCRocket.create(cv);
    if (rocket) { rocket.start(); document.documentElement.classList.add("has-rocket"); }
    else cv.style.display = "none";
  }
  function noRocket() { if (cv && !rocket) cv.style.display = "none"; }
  if (g.RCRocket) makeRocket();
  else {
    addEventListener("rc:3d", makeRocket);
    addEventListener("rc:no3d", noRocket);
    if (g.RC_GL && !g.RC_GL.want3d) noRocket();
  }

  addEventListener("scroll", function () {
    var y = g.scrollY || 0;
    vel = (y - lastY) * 0.35;
    lastY = y;
    dropMagBoxes();
    fadeOn();
    onScroll();
  }, { passive: true });

  /* Слушателей wheel и touchmove здесь больше нет: они звали loopUp,
     которая при снятом цикле страницы выходила первой же строкой.
     Каждый щелчок колеса и каждый палец будили обработчик ради
     ничего, а на телефоне touchmove идёт сплошным потоком. */

  var rt;
  addEventListener("resize", function () {
    clearTimeout(rt);
    dropMagBoxes();
    rt = setTimeout(function () { sizeHS(); collectParallax(); onScroll(); }, 200);
  });

  /* Затухание скорости, чтобы факел плавно успокаивался.
     Раньше это был вечный setInterval: он тикал каждые сто двадцать
     миллисекунд весь визит, в том числе на неподвижной странице и в
     свёрнутой вкладке, где ни факела, ни зрителя нет. Теперь
     затухание живёт ровно от последнего движения до нуля и снимает
     себя само; движение заводит его заново. */
  var velT = 0;
  function fade() {
    if (document.hidden) { velStop(); return; }
    vel *= 0.82;
    /* Ниже сотой доли пикселя за кадр факел уже не отличить от покоя */
    if (Math.abs(vel) < 0.01) velStop();
  }
  function velStop() { vel = 0; if (velT) { clearInterval(velT); velT = 0; } }
  function fadeOn() { if (!velT && !document.hidden) velT = setInterval(fade, 120); }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) velStop();
  });

  magnetics();
  cursor();
  tilt();
  /* Блоки перерисовываются при смене языка, новые карточки тоже
     должны получить объём */
  addEventListener("rc:lang", function () { setTimeout(collect3D, 60); });
  document.addEventListener("rc:lang", function () { setTimeout(collect3D, 60); });
  setTimeout(collect3D, 1200);
  setTimeout(collect3D, 3000);
  buildRing();
  splitWords();

  /* Перевод и загрузка меняют разметку первого экрана: разбивку слов
     и список выездов надо собрать заново */
  document.addEventListener("rc:lang", function () {
    setTimeout(function () { splitWords(); collectHS(); }, 60);
  });
  addEventListener("load", function () {
    setTimeout(function () { splitWords(); collectHS(); }, 100);
  });
  onScroll();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

g.RC_SCROLL = {
  /* Доступ к движку прокрутки нужен для отладки и внешних переходов.
     loopTop и jumps оставлены нулями: цикл страницы снят, но внешние
     проверки и отладочные панели про эти поля ещё знают. */
  get loopTop() { return 0; },
  progress: progress,
  jumps: 0,
  log: [],
  toTop: function () { g.scrollTo({ top: 0, behavior: "smooth" }); },
  to: function (sel) {
    var el = $(sel);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }
};
})(window);
