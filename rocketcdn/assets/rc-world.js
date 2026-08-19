/* ═══════════════════════════════════════════════════════════
   Rocket CDN · единый 3D-мир: одна камера на весь сайт

   Клиент уточнил задачу дважды, и вторая формулировка точнее
   первой: «камера по 3D-миру двигается вместе с контентом сайта -
   не только вниз, но и вправо, влево, вглубь, вдаль - но при этом
   кривым ничего не становится, всё ровное и премиальное».

   Первая версия вертела каждый раздел собственным поворотом, и
   сетки карточек расползались - раздел ехал по своей траектории,
   сосед по своей. Правильный ответ другой: камера ОДНА, и кадр
   она двигает ЦЕЛИКОМ. Весь поток страницы (main) получает один
   общий ход - панораму вбок, подъём, наезд вглубь - а раскадровка
   по актам решает, куда кадр плывёт на каждой сцене. Внутри кадра
   ничего не деформируется: карточки, сетки и наклоны от пролёта
   ракеты (rc-hooks, rc-depth) живут как жили.

   Глубину пространства дают три вещи, и ни одна не гнёт вёрстку:
   фон звёзд сносится против хода камеры (rc-space), ракета идёт
   с камерой (rc-rocket), а слои внутри разделов (.w3-lay) имеют
   свой коэффициент параллакса - заголовки против карточек.

   Отключается сам: просьба меньше движения, третья ступень
   деградации, активная форма и демо-полёт - камера замирает.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;

var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

/* ── Раскадровка камеры ──────────────────────────────────────
   Ключевые кадры по актам сценария. pan - панорама вбок (доля от
   максимума), tilt - подъём/спуск кадра, dive - наезд вглубь.
   Это режиссёрский раскадр: каждый акт узнаваем своим движением,
   а между актами кадр плывёт непрерывно. */
var SHOT = {
  pad:      { pan:  0.00, tilt:  0.55, dive: -0.5 },  /* стартовый стол: взгляд снизу */
  ignite:   { pan: -0.45, tilt: -0.60, dive:  0.6 },  /* тяга: кадр рвётся вверх и внутрь */
  climb:    { pan:  0.70, tilt: -0.35, dive:  0.3 },  /* разгон: уводит вправо */
  clouds:   { pan: -0.85, tilt:  0.25, dive: -0.4 },  /* сквозь облака, панорама влево */
  corridor: { pan:  0.10, tilt:  0.00, dive:  1.0 },  /* коридор продуктов: полный наезд */
  advance:  { pan:  0.90, tilt: -0.25, dive:  0.4 },  /* створ преимуществ: вправо */
  orbit:    { pan: -1.00, tilt:  0.55, dive: -0.7 },  /* облёт планеты: широкий отход */
  reentry:  { pan:  0.50, tilt: -0.70, dive:  0.8 },  /* вход в атмосферу: пикирование */
  route:    { pan: -0.35, tilt:  0.35, dive: -0.2 },  /* выравнивание над схемой */
  landing:  { pan:  0.00, tilt:  0.80, dive: -0.1 },  /* посадка: взгляд сверху на площадку */
  walk:     { pan:  0.00, tilt:  0.20, dive:  1.0 },  /* идём к кораблю: наезд */
  cabin:    { pan:  0.00, tilt:  0.00, dive:  0.0 },  /* внутри рулит камера рубки */
  manual:   { pan:  0.00, tilt:  0.00, dive:  0.0 },
  console:  { pan:  0.00, tilt:  0.00, dive:  0.3 },  /* подступ к пульту */
  egress:   { pan:  0.00, tilt: -0.30, dive: -1.0 }   /* отъезд: пульт отпускает, впереди космос */
};

var ORDER = ["pad", "ignite", "climb", "clouds", "corridor", "advance", "orbit",
             "reentry", "route", "landing", "walk", "cabin", "manual", "console", "egress"];

/* Пределы хода камеры в пикселях. Небольшие нарочно: панорама
   читается по параллаксу фона и ракеты, а сам кадр остаётся
   ровным и не оголяет края - запас закрывается лёгким наездом. */
var PAN_MAX = 26, TILT_MAX = 18, DIVE_MAX = 0.016;

/* ── Глубина слоёв внутри раздела ────────────────────────────
   Коэффициент параллакса: положительный - слой ближе к зрителю и
   идёт ЗА камерой, отрицательный - дальше и отстаёт. Сетки не
   трогаем: у соседних карточек один и тот же род - один и тот же
   ход, ряд остаётся рядом. */
var DEPTH = [
  [".sec-tag", 0.55], [".sec-h", 0.42], [".sec-p", 0.30], [".hs-h", 0.40],
  [".kpi-i", 0.18], [".chip", 0.24],
  [".card", -0.26], [".prod-card", -0.32], [".case", -0.28], [".step", -0.20], [".faq-i", -0.14],
  [".globe-wrap", -0.5], [".rack-wrap", -0.5], [".map-wrap", -0.42]
];

function depthOf(el) {
  for (var d = 0; d < DEPTH.length; d++) {
    if (el.matches && el.matches(DEPTH[d][0])) return DEPTH[d][1];
  }
  return 0;
}

var stage = null;                 /* main: кадр, который двигает камера */
var cam = { pan: 0, tilt: 0, dive: 0, yaw: 0, pitch: 0, roll: 0, z: 0 };
var goal = { pan: 0, tilt: 0, dive: 0 };
var raf = null, t0 = 0, idle = 0, lastY = -1;
var lastTf = "";

function seed() {
  stage = doc.querySelector("main");
  if (!stage) return;
  stage.classList.add("w3-stage");
  /* Слои: один проход, дальше слой читает свой коэффициент из
     переменной и сам едет за камерой через CSS */
  var kids = stage.querySelectorAll(DEPTH.map(function (d) { return d[0]; }).join(","));
  for (var j = 0; j < kids.length; j++) {
    var k = depthOf(kids[j]);
    if (!k) continue;
    kids[j].classList.add("w3-lay");
    kids[j].style.setProperty("--w3-k", k.toFixed(2));
  }
}

/* Кадр камеры для текущего акта: текущий ключ смешивается со
   следующим по доле акта, поэтому на стыке разделов камера уже
   плывёт в сторону новой сцены и границы не видно. */
function aim() {
  var sc = g.RC_SCENE;
  var a = sc && sc.act ? sc.act : "pad";
  var k = sc ? (sc.k || 0) : 0;
  var cur = SHOT[a] || SHOT.pad;
  var idx = ORDER.indexOf(a);
  var nxt = (idx > -1 && idx < ORDER.length - 1) ? (SHOT[ORDER[idx + 1]] || cur) : cur;

  var m = k < 0.5 ? 0 : (k - 0.5) / 0.5;
  m = m * m * (3 - 2 * m);

  goal.pan  = cur.pan  + (nxt.pan  - cur.pan)  * m;
  goal.tilt = cur.tilt + (nxt.tilt - cur.tilt) * m;
  goal.dive = cur.dive + (nxt.dive - cur.dive) * m;

  /* Живая рука оператора: медленное дыхание кадра, доли пикселя */
  var t = (performance.now ? performance.now() : Date.now()) / 1000;
  goal.pan  += Math.sin(t * 0.21) * 0.06;
  goal.tilt += Math.sin(t * 0.17 + 1.3) * 0.05;

  /* Скорость прокрутки подаёт кадр вглубь: рывок колеса читается
     ускорением полёта, а не дёрганьем вёрстки */
  var v = g.RC_MOTION && typeof g.RC_MOTION.v === "number" ? g.RC_MOTION.v : 0;
  var vv = Math.max(-1, Math.min(1, v / 30));
  goal.dive += Math.abs(vv) * 0.5;

  /* Взгляд за указателем: кадр плывёт туда, куда смотрит человек.
     Чуть-чуть - мир отзывается, но ничего не уезжает. */
  goal.pan  += mx * 0.32;
  goal.tilt += my * 0.22;
}

/* Положение указателя в долях от середины окна, -1..1 */
var mx = 0, my = 0, mGoalX = 0, mGoalY = 0;
addEventListener("pointermove", function (e) {
  if (e.pointerType === "touch") return;      /* палец ведёт скролл, а не камеру */
  mGoalX = (e.clientX / innerWidth - 0.5) * 2;
  mGoalY = (e.clientY / innerHeight - 0.5) * 2;
}, { passive: true });

/* Насколько мир вообще участвует: в салоне и на пульте своя
   камера, в демо-полёте и в форме - покой */
function power() {
  if (root.classList.contains("rc-flying")) return 0;
  if (root.classList.contains("rc-form-active")) return 0;
  /* Внутри корабля кадр ведёт rc-interior: там своя камера, свой
     оборот по салону и своё кольцо карточек на fixed. Мир молчит */
  if (root.classList.contains("rc-inside")) return 0;
  var deg = parseInt(root.getAttribute("data-degrade") || "0", 10) || 0;
  if (deg >= 3) return 0;
  if (deg >= 2) return 0.45;
  if (root.classList.contains("rc-fast")) return 0.6;
  return 1;
}

function frame() {
  raf = requestAnimationFrame(frame);
  if (doc.hidden || !stage) return;

  /* Стоим и указатель замер - считаем реже, мир только дышит */
  var y = g.pageYOffset || doc.documentElement.scrollTop || 0;
  var still = Math.abs(y - lastY) < 0.5 &&
              Math.abs(mGoalX - mx) < 0.02 && Math.abs(mGoalY - my) < 0.02;
  if (still) { if (++idle > 6 && (idle % 3)) return; } else idle = 0;
  lastY = y;

  var now = performance.now ? performance.now() : Date.now();
  var dt = t0 ? Math.min(0.05, (now - t0) / 1000) : 0.016;
  t0 = now;

  var ms = 1 - Math.exp(-dt * 6.5);
  mx += (mGoalX - mx) * ms;
  my += (mGoalY - my) * ms;

  aim();
  var p = power();
  var s = 1 - Math.exp(-dt * 2.4);
  cam.pan  += (goal.pan  * p - cam.pan)  * s;
  cam.tilt += (goal.tilt * p - cam.tilt) * s;
  cam.dive += (goal.dive * p - cam.dive) * s;

  /* Ход в пикселях. Предел хода считаем от размера окна: 26 пикселей
     панорамы на телефоне - это боковое поле раздела целиком, и край
     строки уезжал за обрез (обрезались заголовок сети, чипы, поиск).
     На большом экране упираемся в прежний потолок. Сотые доли
     округляем до четверти пикселя: форма и кнопки должны быть
     «стабильными» для браузера. */
  var panMax = Math.min(PAN_MAX, innerWidth * 0.016);
  var tiltMax = Math.min(TILT_MAX, innerHeight * 0.014);
  var dx = Math.round(cam.pan * panMax * 4) / 4;
  var dy = Math.round(cam.tilt * tiltMax * 4) / 4;

  /* Толчок от касания опор складываем с ходом камеры здесь: у кадра
     один transform, и второе правило на тот же элемент просто
     проиграло бы по специфичности. Значения публикует rc-rocket в
     момент посадки и сам же гасит их за треть секунды. Держим его
     отдельным слагаемым: толчок кадру разрешён сверх предела, а
     панораме - нет. */
  var sx = 0, sy = 0;
  if (root.classList.contains("rc-quake")) {
    var cs = root.style;
    sx = parseFloat(cs.getPropertyValue("--rc-shake-x")) || 0;
    sy = parseFloat(cs.getPropertyValue("--rc-shake-y")) || 0;
  }

  /* Наезд: базовый запас закрывает края при панораме (сдвинутый
     кадр не имеет права оголить фон), сверх него - глубина акта */
  var need = 1 + Math.max((Math.abs(dx) + Math.abs(sx)) * 2 / innerWidth,
                          (Math.abs(dy) + Math.abs(sy)) * 2 / innerHeight);
  var zoom = need + Math.max(0, cam.dive) * DIVE_MAX;
  /* Отъезд (dive < 0) не опускается ниже запаса краёв */
  if (cam.dive < 0) zoom = need + Math.max(cam.dive * DIVE_MAX * 0.5, (1 - need) * 0.9);
  /* Потолок наезда: масштаб съедает боковые поля, и на узком экране
     лишние проценты режут текст по краям. Там потолок заметно ниже. */
  var zMax = innerWidth < 760 ? 1.04 : 1.11;
  if (zoom > zMax) zoom = zMax;
  zoom = Math.round(zoom * 2000) / 2000;

  /* Кадр не выезжает дальше, чем его прикрывает наезд: за этой чертой
     у края окна показалась бы пустота, а строки ушли бы за обрез. */
  var room = (zoom - 1) * innerWidth / 2 - Math.abs(sx);
  var roomY = (zoom - 1) * innerHeight / 2 - Math.abs(sy);
  if (room < 0) room = 0;
  if (roomY < 0) roomY = 0;
  if (dx > room) dx = room; else if (dx < -room) dx = -room;
  if (dy > roomY) dy = roomY; else if (dy < -roomY) dy = -roomY;
  dx += sx;
  dy += sy;

  /* Совместимые значения для ракеты и фона: они читают yaw/pitch
     как раньше и получают тот же самый ход камеры */
  cam.yaw = cam.pan * 8;
  cam.pitch = cam.tilt * 6;
  cam.roll = 0;
  cam.z = cam.dive * 60;
  g.RC_WORLD = cam;

  var stl = root.style;
  stl.setProperty("--w3-shift", (dx * 0.55).toFixed(2) + "px");

  /* Один трансформ на весь кадр. Точка масштабирования - центр
     видимого окна, чтобы наезд шёл «в глубину кадра», а не от
     верха страницы. */
  var r = stage.getBoundingClientRect();
  var oy = Math.round((innerHeight / 2 - r.top) * 2) / 2;
  var tf = (zoom === 1 && !dx && !dy)
    ? ""
    : "translate3d(" + dx + "px," + dy + "px,0) scale(" + zoom + ")";
  if (tf !== lastTf) {
    lastTf = tf;
    stage.style.transformOrigin = "50% " + oy + "px";
    stage.style.transform = tf;
  }
}

/* ── Свет из проёма ──────────────────────────────────────────
   Момент, когда корабль отдаёт кадр рубке, прикрыт вспышкой света
   из люка: глаз читает её как шаг внутрь на свет, а не как смену
   сцены. Живёт полсекунды и убирает себя сама. */
var flash = null;
addEventListener("rc:hatch", function (e) {
  if (!e || !e.detail || !e.detail.deep) return;
  if (reduced || root.classList.contains("rc-reduced")) return;
  if (flash) return;
  flash = doc.createElement("div");
  flash.className = "w3-flash";
  flash.setAttribute("aria-hidden", "true");
  doc.body.appendChild(flash);
  setTimeout(function () {
    if (flash && flash.parentNode) flash.parentNode.removeChild(flash);
    flash = null;
  }, 620);
});

/* ── Якоря меню: кадр отпускает страницу на время перехода ────
   Наезд камеры двигает весь поток одним трансформом, и раздел, до
   которого ведёт ссылка, стоит на экране не там, где лежит по
   вёрстке: смещение равно доле наезда, помноженной на расстояние
   до середины кадра. Браузер считает цель прыжка один раз, по
   текущим координатам, поэтому промах доходил до трёхсот пикселей
   и «Вопросы» открывались серединой.

   Лечим честно: на время перехода кадр плавно встаёт на место,
   цель считаем уже по ровной странице, а камера подхватывает кадр
   на новом экране. */
var calmT = 0;
function calm(ms) {
  root.classList.add("rc-anchor");
  clearTimeout(calmT);
  calmT = setTimeout(function () { root.classList.remove("rc-anchor"); }, ms || 1000);
}

function anchorPad() {
  var v = 0;
  try { v = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0; } catch (e) {}
  return v || 88;
}

doc.addEventListener("click", function (e) {
  if (e.defaultPrevented || e.button) return;
  var a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
  if (!a || a.target === "_blank") return;
  var id = a.getAttribute("href");
  if (!id || id.length < 2) return;
  var el = null;
  try { el = doc.querySelector(id); } catch (err) { return; }
  if (!el) return;
  e.preventDefault();
  calm(1100);
  /* Сначала кадр становится ровно, и лишь на следующем кадре берём
     координаты цели - иначе снова считали бы по смещённым */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      var top = el.getBoundingClientRect().top + (g.pageYOffset || 0) - anchorPad();
      try { g.scrollTo({ top: Math.max(0, top), behavior: "smooth" }); }
      catch (err) { g.scrollTo(0, Math.max(0, top)); }
      if (history.replaceState) history.replaceState(null, "", id);
    });
  });
});

function boot() {
  if (reduced || root.classList.contains("rc-reduced")) return;
  if (root.getAttribute("data-degrade") === "3") return;
  seed();
  if (!stage) return;
  root.classList.add("w3-on");
  /* Слой засвета из люка ставим один раз: долю в него пишет корабль
     через переменную, поэтому сам слой ничего не считает */
  var glow = doc.createElement("div");
  glow.className = "rc-hatch-glow";
  glow.setAttribute("aria-hidden", "true");
  doc.body.appendChild(glow);
  if (!raf) raf = requestAnimationFrame(frame);
}

doc.addEventListener("rc:lang", function () { setTimeout(seed, 200); });

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
else boot();

g.RC_WORLD_API = {
  cam: function () { return cam; },
  state: function () {
    return {
      кадр: !!stage, сила: +power().toFixed(2),
      панорама: +cam.pan.toFixed(2), подъём: +cam.tilt.toFixed(2),
      глубина: +cam.dive.toFixed(2),
      указатель: [+mx.toFixed(2), +my.toFixed(2)]
    };
  }
};

})(window);
