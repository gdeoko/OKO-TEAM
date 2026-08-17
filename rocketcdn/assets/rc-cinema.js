/* ═══════════════════════════════════════════════════════════
   Rocket CDN · кинематограф: содержимое живёт внутри сцены

   Претензия владельца дословно: «текст контент идёт просто вниз,
   скучно, отдельно от фона и сценария с ракетой». Так и было:
   сцена летела сама по себе, а карточки просто проматывались.

   Здесь связка. Прокрутка перестаёт быть только вертикальной:
   у каждого акта своя камера.

   1. Барабан рубки. Мы внутри корабля, и блоки надёжности с
      вопросами стоят по кругу салона. Прокрутка поворачивает
      барабан: карточка выезжает из-за плеча, доворачивается к
      зрителю, читается и уходит за другое плечо. Ровно то, что
      в сценарии названо «оборот по рубке».

   2. Проезд вглубь. Продукты подходят из глубины на зрителя:
      дальние мелкие и притушены, ближние крупные и резкие.
      Прокрутка работает как движение камеры вперёд, а не как
      прокрутка списка.

   3. Полка с разворотом. Горизонтальные ленты перестают быть
      плоским рядом: карточки по краям отвёрнуты от зрителя, в
      центре развёрнуты к нему.

   Три правила, которые здесь не нарушаются:
   вертикальную прокрутку не перехватываем ни в одном режиме;
   текст, который человек читает, всегда стоит к нему лицом;
   при просьбе меньше движения и на быстрой прокрутке всё это
   выключается и остаётся обычная страница.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var phone = innerWidth < 760;
var acts = [];
var raf = null;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function ease(t) { return t * t * (3 - 2 * t); }

/* Доля прохода секции через кадр: 0 - только вошла снизу,
   1 - полностью ушла вверх. Считается от прямоугольника, поэтому
   работает при любой правке текста и на любом экране. */
function pass(rect) {
  var h = innerHeight;
  return clamp((h - rect.top) / (h + rect.height), 0, 1);
}

/* ── 1. Барабан рубки ────────────────────────────────────────
   Карточки надёжности встают по кругу, как панели в салоне.
   Активная развёрнута к зрителю и читается, соседние отвёрнуты
   и притушены. Прокрутка вращает барабан. */
function drum(act, p) {
  var items = act.items, n = items.length;
  if (!n) return;
  /* Оборот на все карточки плюс небольшой доворот в конце */
  var turn = p * n;
  for (var i = 0; i < n; i++) {
    var el = items[i];
    var d = i - turn + 0.5;                 /* расстояние до центра барабана */
    var ang = d * (phone ? 34 : 42);        /* градусов на карточку */
    var depth = -Math.abs(d) * (phone ? 90 : 150);
    var lift = d * (phone ? 26 : 40);
    var vis = clamp(1 - Math.abs(d) * 0.55, 0, 1);

    el.style.setProperty("--cin-rot", ang.toFixed(2) + "deg");
    el.style.setProperty("--cin-z", depth.toFixed(0) + "px");
    el.style.setProperty("--cin-y", lift.toFixed(0) + "px");
    el.style.setProperty("--cin-vis", (0.28 + vis * 0.72).toFixed(3));
    el.style.setProperty("--cin-blur", ((1 - vis) * (phone ? 1.2 : 2.4)).toFixed(2) + "px");
    /* Карточка в центре обязана быть плоской: текст читают */
    el.classList.toggle("cin-front", Math.abs(d) < 0.5);
  }
}

/* ── 2. Проезд вглубь ────────────────────────────────────────
   Сетка продуктов превращается в коридор: карточки приходят из
   глубины, проходят через кадр и уходят за спину. */
function tunnel(act, p) {
  var items = act.items, n = items.length;
  for (var i = 0; i < n; i++) {
    var el = items[i];
    /* Каждая карточка стартует со своей задержкой по проходу */
    var own = clamp(p * 1.35 - (i / n) * 0.35, 0, 1);
    var k = ease(own);
    var z = -520 + k * 620;                  /* издалека на зрителя */
    var rot = (1 - k) * (i % 2 ? 9 : -9);
    var vis = clamp(k * 2.6, 0, 1) * clamp((1.2 - k) * 4, 0, 1);
    el.style.setProperty("--cin-z", z.toFixed(0) + "px");
    el.style.setProperty("--cin-rot", rot.toFixed(2) + "deg");
    el.style.setProperty("--cin-vis", (0.3 + vis * 0.7).toFixed(3));
    /* Размытие только у дальнего края и слабое: карточку, до которой
       человек долистал, он должен читать, а не угадывать. */
    el.style.setProperty("--cin-blur", ((1 - clamp(k * 2.4, 0, 1)) * 1.4).toFixed(2) + "px");
  }
}

/* ── 3. Полка с разворотом ───────────────────────────────────
   Лента едет вбок от прокрутки (этим занимается rc-scroll), а
   здесь карточки разворачиваются: с краёв отвёрнуты, в центре
   лицом к зрителю. */
function shelf(act) {
  var items = act.items, mid = innerWidth / 2;
  for (var i = 0; i < items.length; i++) {
    var el = items[i];
    var r = act.rects[i];
    if (!r || r.width < 4) continue;
    var c = r.left + r.width / 2;
    var d = clamp((c - mid) / (innerWidth * 0.6), -1.4, 1.4);
    el.style.setProperty("--cin-rot", (-d * (phone ? 12 : 22)).toFixed(2) + "deg");
    el.style.setProperty("--cin-z", (-Math.abs(d) * (phone ? 60 : 140)).toFixed(0) + "px");
    el.style.setProperty("--cin-vis", (1 - Math.abs(d) * 0.4).toFixed(3));
  }
}

/* ── Сборка актов ────────────────────────────────────────────
   Роли раздаём по разметке, а не по номерам процентов: текст
   правят, блоки переставляют, а роль остаётся при своём блоке. */
function collect() {
  acts.length = 0;
  var add = function (sel, kind, itemSel) {
    var sec = doc.querySelector(sel);
    if (!sec) return;
    var items = [].slice.call(sec.querySelectorAll(itemSel));
    if (!items.length) return;
    sec.classList.add("cin-stage", "cin-" + kind);
    items.forEach(function (el) { el.classList.add("cin-item"); });
    acts.push({ sec: sec, kind: kind, items: items, rects: [], rect: null });
  };

  add("#reliability", "drum", ".card");
  add("#products", "tunnel", ".prod-card");
  add("#cases", "shelf", ".case");
  add("#how", "shelf", ".step");
}

/* ── Кадр: сперва читаем, потом пишем ───────────────────────── */
function frame() {
  raf = requestAnimationFrame(frame);
  if (doc.hidden || !acts.length) return;
  if (root.classList.contains("rc-reduced") || root.classList.contains("rc-fast")) return;

  var i, a;
  /* Чтение */
  for (i = 0; i < acts.length; i++) {
    a = acts[i];
    a.rect = a.sec.getBoundingClientRect();
    a.live = a.rect.bottom > -200 && a.rect.top < innerHeight + 200;
    if (a.live && a.kind === "shelf") {
      a.rects = a.items.map(function (el) { return el.getBoundingClientRect(); });
    }
  }
  /* Запись */
  for (i = 0; i < acts.length; i++) {
    a = acts[i];
    if (!a.live) continue;
    var p = pass(a.rect);
    if (a.kind === "drum") drum(a, p);
    else if (a.kind === "tunnel") tunnel(a, p);
    else shelf(a);
  }
}

/* ── Реакция на палец ────────────────────────────────────────
   На телефоне курсора нет, поэтому карточка отзывается на само
   касание: чуть проваливается под пальцем и возвращается. */
function touch() {
  doc.addEventListener("touchstart", function (e) {
    var el = e.target.closest && e.target.closest(".cin-item, .card, .viz-card, .dc");
    if (!el) return;
    el.classList.add("cin-press");
  }, { passive: true });

  var release = function (e) {
    var el = e.target.closest && e.target.closest(".cin-press");
    if (el) el.classList.remove("cin-press");
    [].forEach.call(doc.querySelectorAll(".cin-press"), function (x) { x.classList.remove("cin-press"); });
  };
  doc.addEventListener("touchend", release, { passive: true });
  doc.addEventListener("touchcancel", release, { passive: true });
}

/* ── Запуск ─────────────────────────────────────────────────── */
function boot() {
  if (reduced) return;
  collect();
  touch();
  if (!raf) raf = requestAnimationFrame(frame);
}

addEventListener("resize", function () {
  phone = innerWidth < 760;
  setTimeout(collect, 200);
}, { passive: true });

doc.addEventListener("rc:lang", function () { setTimeout(collect, 120); });
if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 150); });
else setTimeout(boot, 150);

g.RC_CINEMA = {
  refresh: collect,
  stats: function () {
    return acts.map(function (a) { return a.kind + ":" + a.items.length; }).join(" ");
  }
};

})(window);
