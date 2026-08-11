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
  var main = $("main");
  if (!hero || !main || $("#heroClone")) return;

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

  main.appendChild(clone);
}

/* ── Бесшовный цикл ──────────────────────────────────────── */
/* Высота страницы меняется, пока грузятся шрифты и дорисовывается
   инфографика. Замер точки склейки повторяем, иначе цикл сработает
   не там, где нужно. */
function measure() {
  var clone = $("#heroClone");
  var v = clone ? clone.offsetTop : 0;
  /* Страховка: точка склейки не может быть больше доступной прокрутки */
  var maxScroll = document.documentElement.scrollHeight - innerHeight;
  loopTop = (v > 0 && v <= maxScroll) ? v : 0;
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
  if (lock || loopTop < innerHeight * 2) return;
  var y = pos();
  if (y >= loopTop) jumpTo(y - loopTop);
}

function loopUp(delta) {
  if (lock || loopTop < innerHeight * 2) return;
  if (pos() <= 1 && delta < 0) jumpTo(loopTop - 2);
}

/* ── Прогресс для ракеты ─────────────────────────────────── */
function progress() {
  var y = pos();
  var span = loopTop || (document.documentElement.scrollHeight - innerHeight) || 1;
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
  });
}

/* ── Запуск ──────────────────────────────────────────────── */
function boot() {
  buildClone();

  /* Глобус для клона первого экрана, чтобы стык был незаметен */
  /* На телефоне второй глобус не рисуем: он виден доли секунды на стыке */
  var cloneCv = innerWidth > 760 ? $("#globeHeroClone") : null;
  if (cloneCv && g.RCGlobe && g.RC_GEO) {
    try {
      var gl = new g.RCGlobe(cloneCv, {
        nodes: g.RC_GEO.NODES, land: g.RC_GEO.landPoints(), dc: g.RC_GEO.DC,
        theme: document.documentElement.getAttribute("data-theme") || "dark",
        radius: 0.4, speed: 2.6
      });
      if (g.__globes) g.__globes.push(gl);
    } catch (e) {}
  }

  measure();
  watchLayout();
  collectParallax();

  var cv = $("#rocketCanvas");
  if (cv && g.RCRocket) {
    rocket = g.RCRocket.create(cv);
    if (rocket) { rocket.start(); document.documentElement.classList.add("has-rocket"); }
    else cv.style.display = "none";
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
    rt = setTimeout(function () { measure(); collectParallax(); onScroll(); }, 200);
  });

  /* Затухание скорости, чтобы факел плавно успокаивался */
  setInterval(function () { vel *= 0.82; }, 120);

  magnetics();
  cursor();
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
