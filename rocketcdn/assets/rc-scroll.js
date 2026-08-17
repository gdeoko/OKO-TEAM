/* ═══════════════════════════════════════════════════════════
   RocketCDN · прокрутка и кинематика.

   Плавный скролл, бесшовное зацикливание страницы, привязка
   полёта ракеты к прогрессу, параллакс, магнитные кнопки и
   курсор на больших экранах.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
var TOUCH  = matchMedia("(hover: none)").matches || "ontouchstart" in g;
var FINE   = matchMedia("(hover: hover) and (pointer: fine)").matches;

var rocket = null, loopTop = 0, lock = false, lastY = 0, vel = 0;

/* ── Клон первого экрана в конце страницы ────────────────── */
function buildClone() {
  var hero = $("#hero");
  if (!hero || $("#heroClone")) return;

  var clone = hero.cloneNode(true);
  clone.id = "heroClone";
  clone.setAttribute("aria-hidden", "true");
  clone.classList.add("is-clone");

  /* Дубли идентификаторов недопустимы */
  $$("[id]", clone).forEach(function (el) {
    if (el.tagName === "CANVAS") el.id = "globeHeroClone";
    else el.removeAttribute("id");
  });
  /* Клон не должен попадать в навигацию и фокус */
  $$("a, button, input", clone).forEach(function (el) { el.setAttribute("tabindex", "-1"); });
  if ("inert" in HTMLElement.prototype) clone.inert = true;

  /* Клон ставим ПОСЛЕ подвала, а не внутрь main: точка склейки
     считается по нему, и всё, что ниже, становится недостижимым. */
  document.body.appendChild(clone);
}

/* ── Бесшовный цикл ──────────────────────────────────────── */
/* Высота страницы меняется, пока грузятся шрифты и дорисовывается
   инфографика. Замер точки склейки повторяем, иначе цикл сработает
   не там, где нужно. */
function measure() {
  var clone = $("#heroClone");
  var v = clone ? Math.round(clone.getBoundingClientRect().top + (g.scrollY || g.pageYOffset || 0)) : 0;
  /* Страховка: точка склейки не может быть больше доступной прокрутки */
  var maxScroll = document.documentElement.scrollHeight - innerHeight;
  loopTop = (LOOP && v > 0 && v <= maxScroll) ? v : 0;
}

function watchLayout() {
  var t;
  function re() { clearTimeout(t); t = setTimeout(measure, 120); }
  addEventListener("load", re);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(re).catch(function () {});
  if (g.ResizeObserver) {
    var ro = new ResizeObserver(re);
    var main = $("main");
    if (main) ro.observe(main);
  }
  /* Первые секунды страница ещё дособирается */
  [400, 1200, 2500, 5000].forEach(function (ms) { setTimeout(measure, ms); });
}

function jumpTo(y) {
  lock = true;
  if (g.RC_SCROLL) {
    g.RC_SCROLL.jumps++;
    if (g.RC_SCROLL.log.length > 40) g.RC_SCROLL.log.length = 0;
    g.RC_SCROLL.log.push({ from: Math.round(g.scrollY), to: Math.round(y), top: loopTop });
  }
  /* Мгновенный переход, иначе плавная прокрутка покажет перемотку */
  var prev = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = "auto";
  g.scrollTo(0, y);
  document.documentElement.style.scrollBehavior = prev;
  lastY = y;
  setTimeout(function () { lock = false; }, 90);
}

function pos() { return g.scrollY || g.pageYOffset || 0; }

function loopCheck() {
  if (!LOOP) return;
  if (lock || loopTop < innerHeight * 2) return;
  var y = pos();
  if (y >= loopTop) jumpTo(y - loopTop);
}

function loopUp(delta) {
  if (!LOOP) return;
  if (lock || loopTop < innerHeight * 2) return;
  if (pos() <= 1 && delta < 0) jumpTo(loopTop - 2);
}

/* ── Прогресс для ракеты ─────────────────────────────────── */
function progress() {
  var y = pos();
  var span = (LOOP && loopTop) || (document.documentElement.scrollHeight - innerHeight) || 1;
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
function applyParallax() {
  if (REDUCE) return;
  var vh = innerHeight;
  for (var i = 0; i < parItems.length; i++) {
    var it = parItems[i];
    var r = it.el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) continue;
    var mid = r.top + r.height / 2 - vh / 2;
    it.el.style.transform = "translate3d(0," + (-mid * it.k).toFixed(2) + "px,0)";
  }
}

/* ── Магнитные кнопки ────────────────────────────────────── */
function magnetics() {
  if (!FINE || REDUCE) return;
  $$(".btn-p, .btn-g, .icon-btn").forEach(function (b) {
    b.addEventListener("mousemove", function (e) {
      var r = b.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      b.style.transform = "translate(" + (dx * 7).toFixed(1) + "px," + (dy * 6).toFixed(1) + "px)";
    });
    b.addEventListener("mouseleave", function () { b.style.transform = ""; });
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
  addEventListener("mousemove", function (e) {
    if (!document.documentElement.classList.contains("cursor-live")) {
      document.documentElement.classList.add("cursor-live");
    }
    mx = e.clientX; my = e.clientY;
    dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
    var t = e.target;
    var hot = t.closest && t.closest("a, button, .card, .node-row, .faq-q, input, textarea, select");
    ring.classList.toggle("on", !!hot);
  }, { passive: true });

  (function loop() {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
    requestAnimationFrame(loop);
  })();

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
function applyHS() {
  if (innerWidth <= 900) return;
  for (var i = 0; i < hsList.length; i++) {
    var h = hsList[i];
    if (!h.span) continue;
    var r = h.sec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    var total = h.sec.offsetHeight - innerHeight;
    var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    h.track.style.transform = "translate3d(" + (-p * h.span).toFixed(1) + "px,0,0)";
    if (h.bar) h.bar.style.setProperty("--p", (8 + p * 92).toFixed(1) + "%");
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

function apply3D() {
  if (REDUCE) return;
  var vh = innerHeight, half = vh / 2;
  for (var i = 0; i < d3list.length; i++) {
    var el = d3list[i];
    if (el._hov) continue;
    var r = el.getBoundingClientRect();
    var p = ((r.top + r.height / 2) - half) / vh;
    if (p < -0.9) p = -0.9; else if (p > 0.9) p = 0.9;
    el.style.transform = "perspective(1100px) rotateX(" + (-p * 4.6).toFixed(2) + "deg)";
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
    loopCheck();
    pushProgress();
    applyParallax();
    applyHS();
    apply3D();
    updateRing(progress());
  });
}

/* ── Запуск ──────────────────────────────────────────────── */
/* Клон строим, когда первый экран уже наполнен переводом и иконками,
   иначе в копию попадают пустые блоки. */
/* Клиент попросил убрать зацикленность: страница кончается внизу,
   дальше работает кнопка «наверх». Клон первого экрана и телепорт
   на стыке больше не нужны, но код оставлен - вдруг вернут. */
var LOOP = false;

function setupClone() {
  if (!LOOP) { measure(); watchLayout(); return; }
  if ($("#heroClone")) return;
  buildClone();

  /* Глобус для клона, чтобы стык был незаметен.
     На телефоне второй глобус не рисуем: он виден доли секунды. */
  var cloneCv = innerWidth > 760 ? $("#globeHeroClone") : null;
  if (cloneCv && g.RCGlobe && g.RC_GEO) {
    try {
      var gl = new g.RCGlobe(cloneCv, {
        nodes: g.RC_GEO.NODES, land: g.RC_GEO.landPoints(), dc: g.RC_GEO.DC,
        theme: document.documentElement.getAttribute("data-theme") || "dark",
        radius: 0.4, speed: 2.6
      });
      /* Список общий: его создаёт тот, кто пришёл первым */
      (g.__globes = g.__globes || []).push(gl);
    } catch (e) {}
  }
  measure();
  splitWords();
}

function boot() {
  measure();
  watchLayout();
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
    onScroll();
  }, { passive: true });

  addEventListener("wheel", function (e) { loopUp(e.deltaY); }, { passive: true });

  var ty = 0;
  addEventListener("touchstart", function (e) { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", function (e) {
    var dy = ty - e.touches[0].clientY;
    if (dy < -6) loopUp(-1);
  }, { passive: true });

  var rt;
  addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { sizeHS(); measure(); collectParallax(); onScroll(); }, 200);
  });

  /* Затухание скорости, чтобы факел плавно успокаивался */
  setInterval(function () { vel *= 0.82; }, 120);

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

  /* Клон снимаем с уже наполненного первого экрана */
  document.addEventListener("rc:lang", function () {
    setTimeout(function () { splitWords(); collectHS(); setupClone(); measure(); }, 60);
  });
  addEventListener("load", function () {
    setTimeout(function () { splitWords(); collectHS(); setupClone(); measure(); }, 100);
  });
  setTimeout(setupClone, 1200);
  onScroll();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

g.RC_SCROLL = {
  /* Доступ к движку прокрутки нужен для отладки и внешних переходов */
  get loopTop() { return loopTop; },
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
