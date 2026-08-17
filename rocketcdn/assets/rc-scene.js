/* ═══════════════════════════════════════════════════════════
   Rocket CDN · единая сцена: один акт на всю страницу

   Владелец сказал главное: «чтобы фон и текст и карточки и 3D
   сцена и сценарий были единым целым». До сих пор каждый модуль
   решал сам, что сейчас происходит: фон смотрел на прокрутку,
   ракета на свой сплайн, рубка на свои пороги, карточки вообще ни
   на что. Отсюда и обрывы - в одном месте страницы шёл разгон, а
   фон уже жил орбитой.

   Здесь один диспетчер. Он смотрит, какая секция сейчас держит
   кадр, называет это актом и объявляет его всем сразу: ставит на
   документ data-act, публикует RC_SCENE.act и рассылает событие
   rc:act. Дальше фон, ракета, карточки и звук читают одно и то же
   число - и не могут разойтись, потому что источник один.

   Акты названы по сценарию, а не по процентам: проценты живут до
   первой правки текста, а блок «инфраструктура» остаётся собой
   при любой длине страницы.

   Переход между актами не мгновенный: у каждого есть доля -
   насколько мы в нём. По ней модули плавно смешивают состояния,
   поэтому границы актов на экране не видно.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;

/* Порядок актов - это и есть фильм. Каждому назначена секция
   разметки и роль, понятная остальным модулям. */
var ACTS = [
  { id: "pad",     sel: "#hero",        role: "площадка" },
  { id: "ignite",  sel: "#kpi",         role: "зажигание" },
  { id: "climb",   sel: "#effect",      role: "разгон" },
  { id: "clouds",  sel: "#what",        role: "облака" },
  { id: "corridor",sel: "#products",    role: "коридор продуктов" },
  { id: "advance", sel: "#adv",         role: "створ преимуществ" },
  { id: "orbit",   sel: "#infra",       role: "орбита" },
  { id: "reentry", sel: "#how",         role: "вход в атмосферу" },
  { id: "route",   sel: "#route",       role: "схема маршрута" },
  { id: "landing", sel: "#included",    role: "посадка" },
  { id: "walk",    sel: "#cases",       role: "проход к трапу" },
  { id: "cabin",   sel: "#reliability", role: "салон" },
  { id: "manual",  sel: "#faq",         role: "бортовой справочник" },
  { id: "console", sel: "#contact",     role: "пульт" }
];

var live = [];
var cur = null, curK = 0, raf = null, lastY = -1, idle = 0;

function collect() {
  live.length = 0;
  for (var i = 0; i < ACTS.length; i++) {
    var el = doc.querySelector(ACTS[i].sel);
    if (!el) continue;
    live.push({ id: ACTS[i].id, role: ACTS[i].role, el: el, i: live.length });
  }
}

/* Кадр держит та секция, чья середина ближе к середине экрана.
   Заодно считаем долю: 0 - только вошла, 1 - вот-вот уступит. */
function pick() {
  var mid = innerHeight / 2, best = null, bestD = 1e9, bestK = 0;
  for (var i = 0; i < live.length; i++) {
    var r = live[i].el.getBoundingClientRect();
    if (r.bottom < -80 || r.top > innerHeight + 80) continue;
    var c = r.top + r.height / 2;
    var d = Math.abs(c - mid);
    if (d < bestD) {
      bestD = d;
      best = live[i];
      var raw = (innerHeight - r.top) / (innerHeight + r.height);
      bestK = raw < 0 ? 0 : (raw > 1 ? 1 : raw);
    }
  }
  return best ? { act: best, k: bestK } : null;
}

function frame() {
  raf = requestAnimationFrame(frame);
  if (doc.hidden || !live.length) return;

  /* Страница стоит - акт не меняется, кадр стоит ноль */
  var y = g.pageYOffset || doc.documentElement.scrollTop || 0;
  if (Math.abs(y - lastY) < 0.5) {
    if (++idle > 3) return;
  } else idle = 0;
  lastY = y;

  var got = pick();
  if (!got) return;
  curK = got.k;
  api.k = curK;

  if (!cur || cur.id !== got.act.id) {
    var prev = cur;
    cur = got.act;
    api.act = cur.id;
    api.role = cur.role;
    api.index = cur.i;
    api.total = live.length;
    root.setAttribute("data-act", cur.id);
    try {
      dispatchEvent(new CustomEvent("rc:act", {
        detail: { act: cur.id, role: cur.role, from: prev ? prev.id : null, index: cur.i, total: live.length }
      }));
    } catch (e) {}
  }
  /* Долю акта отдаём переменной: по ней CSS смешивает состояния */
  root.style.setProperty("--act-k", curK.toFixed(3));
}

var api = {
  act: null, role: null, k: 0, index: 0, total: 0,
  acts: function () { return live.map(function (a) { return a.id; }); },
  refresh: collect
};
g.RC_SCENE = api;

function boot() {
  collect();
  if (!raf) raf = requestAnimationFrame(frame);
}

doc.addEventListener("rc:lang", function () { setTimeout(collect, 120); });
addEventListener("resize", function () { setTimeout(collect, 200); }, { passive: true });
if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
else boot();

})(window);
