/* ═══════════════════════════════════════════════════════════
   Rocket CDN · запасной сценарий

   Это не урезанная версия сайта, а вторая честная сборка. Фильм
   превращается в раскадровку: восемь запечённых кадров, снятых с
   тех же сцен, тот же свет, та же палитра. Прокрутка становится
   обычной прокруткой, все блоки идут сверху вниз.

   Включается по трём независимым причинам, любой достаточно:
   человек попросил меньше движения, устройство слабое, объёмный
   слой не поднялся вовсе.

   Что остаётся полностью: весь текст, форма заявки, обе темы,
   оба языка, поиск по городам, вопросы. Что выключается: полёт,
   вращение, наклон, частицы, параллакс.

   Файл подключается в шапке документа и работает до того, как
   поднимутся сцены: иначе они успеют занять контексты, которые
   на слабом устройстве и так на вес золота.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;

function on() {
  if (root.classList.contains("rc-reduced")) return;
  root.classList.add("rc-reduced");
  g.RC_REDUCED = true;
  try { dispatchEvent(new CustomEvent("rc:reduced")); } catch (e) {}
}

/* ── Причина первая: человек попросил меньше движения ─────── */
var wantsCalm = false;
try { wantsCalm = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

/* ── Причина вторая: устройство не потянет ────────────────── */
function webglAvailable() {
  try {
    var t = doc.createElement("canvas");
    return !!(t.getContext("webgl2") || t.getContext("webgl"));
  } catch (e) { return false; }
}

/* Слабое устройство больше не лишается фильма. Этот сигнал задаёт
   только стартовый LOD: renderer снижает pixel ratio, частицы и
   частоту дорогих симуляций, но ракета, кабина и полёт остаются. */
function qualityHint() {
  var cpu = navigator.hardwareConcurrency || 4;
  var mem = navigator.deviceMemory || 4;
  var c = navigator.connection;
  if (mem <= 1 || cpu <= 2) return 3;
  if (mem <= 2 || cpu <= 4 || (c && c.saveData)) return 2;
  if (mem <= 4 || cpu <= 6) return 1;
  return 0;
}

var qHint = qualityHint();
g.RC_QUALITY_HINT = qHint;
g.RC_CALM_MOTION = wantsCalm;
root.setAttribute("data-quality-hint", String(qHint));
root.classList.toggle("rc-adaptive-3d", qHint > 0);
root.classList.toggle("rc-calm-motion", wantsCalm);

/* Единственный жёсткий предел — браузер физически не умеет WebGL.
   В этом случае остаётся контентный fallback. Для всех WebGL-
   устройств объёмный фильм загружается независимо от CPU/RAM. */
if (!webglAvailable()) {
  root.classList.add("rc-no-webgl");
  on();
}

/* Заряда здесь больше нет, и это исправление ошибки, а не отказ от
   заботы о батарее. Правило «меньше двадцати процентов - показываем
   раскадровку» решало за человека: владелец открыл сайт на телефоне
   с девятнадцатью процентами и вместо фильма получил страницу с
   фотографиями. Ни он, ни любой другой посетитель об этом не просил
   и понять причину не мог - выглядело просто как сломанный сайт.

   Батарея сама по себе ничего не говорит о том, потянет ли
   устройство сцену: телефон на девятнадцати процентах рисует ровно
   так же, как на девяноста. А если он и правда не тянет, это
   увидит ступенчатая деградация (rc-motion) - она смотрит на
   настоящие кадры, а не на индикатор заряда, и снимает украшения
   по одному, не подменяя мир картинками.

   Явные просьбы человека остаются в силе: «меньше движения» в
   системе и режим экономии трафика ниже никуда не делись. */

/* ── Причина третья: объёмный слой не поднялся ────────────── */
addEventListener("rc:no3d", function () { on(); });

/* ═══ Раскадровка ═══════════════════════════════════════════
   Восемь кадров вместо восьми актов. Вставляем лениво, только в
   запасном режиме и только если файл реально есть: страница не
   имеет права поломаться из-за отсутствующей картинки. */
var FRAMES = [
  ["hero",        "01", "Ракета на стартовой площадке перед рассветом"],
  ["kpi",         "02", "Зажигание и первые секунды подъёма"],
  ["effect",      "03", "Ракета пробивает облачный слой"],
  ["products",    "05", "Строй орбитальных панелей вдоль трассы полёта"],
  ["infra",       "04", "Орбита над ночной стороной планеты"],
  ["route",       "06", "Вход в атмосферу"],
  ["included",    "07", "Посадка на площадку на рассвете"],
  ["reliability", "08", "Рубка корабля изнутри"]
];

function storyboard() {
  if (!root.classList.contains("rc-reduced")) return;
  var frameWatcher = null;
  if ("IntersectionObserver" in g) {
    frameWatcher = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        e.target.classList.toggle("rc-live", e.isIntersecting);
      });
    }, { rootMargin: "18% 0px", threshold: 0.04 });
  }
  FRAMES.forEach(function (f) {
    var sec = doc.getElementById(f[0]);
    if (!sec || sec._rcFrame) return;
    sec._rcFrame = 1;
    var box = doc.createElement("div");
    box.className = "rc-frame rc-frame-" + f[1];
    box.setAttribute("aria-hidden", "true");
    var img = doc.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 1600; img.height = 900;
    img.alt = "";
    img.src = "assets/storyboard/" + f[1] + ".webp";
    img.onerror = function () { box.style.display = "none"; };
    box.appendChild(img);
    sec.insertBefore(box, sec.firstChild);
    if (frameWatcher) frameWatcher.observe(box);
    else box.classList.add("rc-live");
  });
}

/* A browser with no WebGL cannot render the realtime cabin, but it
   can still keep the finale in motion. The plate is loaded only as
   the epilogue approaches the viewport and is paused when it leaves,
   so this path costs nothing during the main page journey. Weak
   devices that do have WebGL never enter this branch. */
var fallbackFlight = null;
function fallbackMotion() {
  if (fallbackFlight || !root.classList.contains("rc-no-webgl")) return;
  var epi = doc.getElementById("epilogue");
  if (!epi) return;

  var v = doc.createElement("video");
  v.className = "rc-fallback-flight";
  v.muted = true;
  v.loop = true;
  v.autoplay = true;
  v.playsInline = true;
  v.preload = "none";
  v.setAttribute("aria-hidden", "true");
  v.setAttribute("tabindex", "-1");
  epi.insertBefore(v, epi.firstChild);
  fallbackFlight = v;

  var started = false, portrait = null, resizeT = 0;
  function source() {
    var p = innerHeight > innerWidth;
    var webm = !!(v.canPlayType && v.canPlayType('video/webm; codecs="vp9"'));
    var stem = "assets/gen/cockpit-flight-" + (p ? "mobile" : "wide") + "-v2";
    return { p: p, src: stem + (webm ? ".webm" : ".mp4"), poster: stem + "-poster.webp" };
  }
  function pick() {
    var s = source();
    if (portrait === s.p && v.getAttribute("src")) return;
    portrait = s.p;
    v.poster = s.poster;
    v.src = s.src;
    if (started) {
      var play = v.play();
      if (play && play.catch) play.catch(function () {});
    }
  }
  function start() {
    started = true;
    pick();
    var play = v.play();
    if (play && play.catch) play.catch(function () {});
  }

  if ("IntersectionObserver" in g) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) start();
        else if (started) v.pause();
      });
    }, { rootMargin: "35% 0px", threshold: 0.01 });
    io.observe(epi);
  } else start();

  addEventListener("resize", function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (started) pick(); }, 180);
  }, { passive: true });
}

/* ═══ Хуки без ракеты ═══════════════════════════════════════
   В фильме счётчики, отсечки и галочки дёргает ракета. Здесь их
   дёргает появление в поле зрения. Ничего не имеет права
   остаться недорисованным. */
function seeing() {
  var groups = [
    [".kpi-n", "rc-lit"],
    [".step", "rc-tick"],
    [".inc-item", "rc-landed"]
  ];
  if (!("IntersectionObserver" in g)) {
    groups.forEach(function (grp) {
      [].forEach.call(doc.querySelectorAll(grp[0]), function (el) { el.classList.add(grp[1]); });
    });
    return;
  }
  groups.forEach(function (grp) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add(grp[1]);
        io.unobserve(e.target);
      });
    }, { threshold: 0.2 });
    [].forEach.call(doc.querySelectorAll(grp[0]), function (el) { io.observe(el); });
  });
}

/* ═══ Доступность поверх всего ═════════════════════════════ */
function access() {
  /* Декоративные холсты скринридеру не нужны: всё, что на них
     нарисовано, продублировано списками и карточками. */
  ["spaceBg", "rocketCanvas", "globeMap"].forEach(function (id) {
    var el = doc.getElementById(id);
    if (el) el.setAttribute("aria-hidden", "true");
  });
  [].forEach.call(doc.querySelectorAll("canvas:not([aria-hidden])"), function (c) {
    c.setAttribute("aria-hidden", "true");
  });
  /* Подписи переключателям, у которых на экране только значок */
  [].forEach.call(doc.querySelectorAll(".js-theme"), function (b) {
    if (!b.getAttribute("aria-label")) {
      b.setAttribute("aria-label", b.dataset.theme === "light" ? "Светлое оформление" : "Тёмное оформление");
    }
  });
  [].forEach.call(doc.querySelectorAll(".js-sound"), function (b) {
    if (!b.getAttribute("aria-label")) b.setAttribute("aria-label", "Звук страницы");
  });
}

function boot() {
  storyboard();
  fallbackMotion();
  seeing();
  access();
  if (root.classList.contains("rc-reduced") && g.RC_HOOKS && g.RC_HOOKS.settleAll) {
    g.RC_HOOKS.settleAll();
  }
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
else boot();
/* Блоки достраиваются при смене языка: раскадровку это не трогает,
   а вот галочки и отсечки надо переподписать. */
doc.addEventListener("rc:lang", function () { setTimeout(seeing, 80); });
addEventListener("rc:reduced", function () { setTimeout(boot, 30); });

})(window);
