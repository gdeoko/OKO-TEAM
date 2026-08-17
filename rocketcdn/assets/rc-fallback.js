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
function weakDevice() {
  var cpu = navigator.hardwareConcurrency || 4;
  var mem = navigator.deviceMemory || 4;
  if (cpu <= 4 && mem <= 2) return true;
  if (mem <= 1) return true;
  var c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ""))) return true;
  /* Нет даже первой версии WebGL - объёма не будет по определению */
  try {
    var t = doc.createElement("canvas");
    if (!(t.getContext("webgl2") || t.getContext("webgl"))) return true;
  } catch (e) { return true; }
  return false;
}

if (wantsCalm || weakDevice()) on();

/* Заряд узнаём асинхронно: диалогов не показываем, просто если
   телефон почти сел, кино ему сейчас не нужно. */
try {
  if (navigator.getBattery) navigator.getBattery().then(function (b) {
    if (b && b.level <= 0.2 && !b.charging) on();
  })["catch"](function () {});
} catch (e) {}

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
  FRAMES.forEach(function (f) {
    var sec = doc.getElementById(f[0]);
    if (!sec || sec._rcFrame) return;
    sec._rcFrame = 1;
    var box = doc.createElement("div");
    box.className = "rc-frame";
    var img = doc.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 1600; img.height = 900;
    img.alt = f[2];
    img.src = "assets/storyboard/" + f[1] + ".webp";
    img.onerror = function () { box.style.display = "none"; };
    box.appendChild(img);
    sec.insertBefore(box, sec.firstChild);
  });
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
