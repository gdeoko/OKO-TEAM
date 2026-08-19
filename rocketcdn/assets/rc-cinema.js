/* ═══════════════════════════════════════════════════════════
   Rocket CDN · кинематограф: содержимое живёт внутри сцены

   Претензия владельца дословно: «текст контент идёт просто вниз,
   скучно, отдельно от фона и сценария с ракетой». Так и было:
   сцена летела сама по себе, а карточки просто проматывались.

   Здесь связка. Прокрутка перестаёт быть только вертикальной:
   у каждого акта своя камера.

   1. Салон корабля. Мы внутри ракеты, и карточки надёжности
      стоят на стеновых панелях рубки. Поворот берётся не
      «похожий», а тот самый: RC_INTERIOR.yaw(). Экранное место
      карточки - проекция её панели, RC_INTERIOR.project(). Из-за
      этого стена и текст не могут разъехаться: у них одно
      движение на двоих. Панель, доехавшая до середины кадра,
      выпрямляется и читается; ушедшая за плечо притухает и
      уходит по глубине.

   2. Бортовой справочник. Вопросы и ответы - это экран на стене
      рубки. Он поворачивается вместе со стеной, но поворот
      ограничен: длинный текст читают, а не разглядывают под
      углом. Открытый вопрос выпрямляет справочник полностью.

   3. Проезд вглубь. Продукты подходят из глубины на зрителя:
      дальние мелкие и притушены, ближние крупные и резкие.
      Прокрутка работает как движение камеры вперёд, а не как
      прокрутка списка.

   4. Полка с разворотом. Горизонтальные ленты перестают быть
      плоским рядом: карточки по краям отвёрнуты от зрителя, в
      центре развёрнуты к нему.

   Три правила, которые здесь не нарушаются:
   вертикальную прокрутку не перехватываем ни в одном режиме;
   текст, который человек читает, всегда стоит к нему лицом и
   никогда не размыт;
   при просьбе меньше движения и на слабом устройстве всё это
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
var TAU = Math.PI * 2;
var DEG = 57.29578;

/* Сколько радиан вокруг центра кадра считаем «человек читает».
   Внутри этого угла карточка обязана стоять ровно, без размытия
   и без поворота. Снаружи начинается уход по глубине. */
var FRONT = 0.30;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function ease(t) { return t * t * (3 - 2 * t); }

/* Звук рубки. Он есть не всегда: человек мог его не включить, а на
   устройстве без Web Audio его нет вовсе. Поэтому обращение к нему
   всегда через try - молчание не должно ронять кадр. */
function snd(name) {
  try {
    var s = g.RC_SOUND;
    if (s && typeof s[name] === "function") s[name]();
  } catch (e) {}
}

/* Угол в диапазон от минус пи до пи: без этого карточка на
   трёхстах градусах считается дальней, хотя стоит рядом. */
function wrap(a) {
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

/* Доля прохода секции через кадр: 0 - только вошла снизу,
   1 - полностью ушла вверх. Считается от прямоугольника, поэтому
   работает при любой правке текста и на любом экране. */
function pass(rect) {
  var h = innerHeight;
  return clamp((h - rect.top) / (h + rect.height), 0, 1);
}

/* Рубка как источник расписания. Она отвечает на вопрос «на каком
   углу стоит панель» даже до того, как поднимется сама сцена. */
function iv() {
  var v = g.RC_INTERIOR;
  return (v && v.plan && v.yawAt) ? v : null;
}

/* Один поворот на всех. Пока рубка на экране, это её камера. Пока
   она ещё не поднялась - то же расписание, посчитанное вперёд:
   иначе в момент появления сцены содержимое дёрнулось бы с одного
   угла на другой. Совсем без рубки ведёт проход секции. */
function turnOf(V, act, n, step) {
  if (V) {
    if (V.live()) return V.yaw();
    if (g.RC_MOTION) return V.yawAt(g.RC_MOTION.p);
  }
  return pass(act.rect) * (n * step);
}

/* ── 1. Салон корабля ────────────────────────────────────────
   Карточки стоят на панелях рубки. Поворот приходит из сцены,
   место на экране - из проекции панели. Если объёмной рубки нет
   (нет WebGL, слабое устройство), поворот подменяется проходом
   секции через кадр: геометрия та же, ведущий другой. */
/* ── Голограммные экраны рубки ───────────────────────────────
   Владелец просил не карточки поверх фона, а экраны с
   голограммами в салоне. Форму и свет рисуют стили, отсюда идёт
   ровно то, что стили посчитать не могут: слои проекции, фаза
   мерцания у каждого экрана своя, яркость по расстоянию до линии
   чтения и распад развёртки на уходе.

   Слои вставляем разметкой, а не псевдоэлементами: у карточки они
   оба уже заняты (подсветка от курсора в rc.css и блик стекла в
   rc-interior.css), и отбирать их у соседних файлов - значит
   ломать вид карточки везде, где она стоит вне рубки. */
var HOLO = ["cin-scr", "cin-br", "cin-beam", "cin-sweep"];

function holoBuild(cards) {
  for (var i = 0; i < cards.length; i++) {
    var el = cards[i];
    el.classList.add("cin-holo");
    /* Фаза мерцания. Без неё четыре экрана мигают в такт, и вместо
       живой рубки получается один моргающий блок. Числа неровные
       нарочно: ровный шаг снова свёл бы их в общий ритм. */
    el.style.setProperty("--cin-ph", (i * 1.37 % 4.3).toFixed(2));
    if (el.getAttribute("data-holo") === "1") continue;
    for (var k = 0; k < HOLO.length; k++) {
      var lay = doc.createElement("i");
      lay.className = HOLO[k];
      lay.setAttribute("aria-hidden", "true");
      el.appendChild(lay);
    }
    el.setAttribute("data-holo", "1");
  }
}

function holoStrip(cards) {
  for (var i = 0; i < cards.length; i++) {
    var el = cards[i];
    el.classList.remove("cin-holo", "cin-decay", "cin-ignite", "cin-flash");
    if (el.getAttribute("data-holo") !== "1") continue;
    for (var k = 0; k < HOLO.length; k++) {
      var lay = el.querySelector("." + HOLO[k]);
      if (lay && lay.parentNode === el) el.removeChild(lay);
    }
    el.removeAttribute("data-holo");
    el.style.removeProperty("--cin-lit");
    el.style.removeProperty("--cin-dec");
    el.style.removeProperty("--cin-sy");
    el.style.removeProperty("--cin-ph");
  }
}

/* Розжиг: экран, доехавший до линии чтения, загорается разовой
   полосой развёртки. Класс снимаем сами - анимация на классе,
   который никто не убирает, второй раз уже не запустится. */
function holoIgnite(el) {
  if (el.__cinIg) clearTimeout(el.__cinIg);
  el.classList.remove("cin-ignite");
  /* Чтение размера перезапускает анимацию: без него браузер
     считает, что класс и не снимался, и полоса не побежит. */
  void el.offsetWidth;
  el.classList.add("cin-ignite");
  el.__cinIg = setTimeout(function () {
    el.classList.remove("cin-ignite");
    el.__cinIg = 0;
  }, 700);
}

/* Вспышка выбора: человек ткнул в экран, экран мигнул. */
function holoFlash(el) {
  if (el.__cinFl) clearTimeout(el.__cinFl);
  el.classList.remove("cin-flash");
  void el.offsetWidth;
  el.classList.add("cin-flash");
  el.__cinFl = setTimeout(function () {
    el.classList.remove("cin-flash");
    el.__cinFl = 0;
  }, 400);
}

/* Рука человека. Слушаем на документе: экраны пересобираются при
   смене языка, и переподписываться на каждый заново - лишний повод
   потерять обработчик. */
var holoBound = 0, holoHov = null;

function holoHand() {
  if (holoBound) return;
  holoBound = 1;

  var find = function (e) {
    var t = e.target;
    if (!t || !t.closest) return null;
    return t.closest(".cin-ring > .cin-item");
  };

  doc.addEventListener("pointerover", function (e) {
    var el = find(e);
    if (!el || el === holoHov) return;
    holoHov = el;
    snd("uiHover");
  }, { passive: true });

  doc.addEventListener("pointerout", function (e) {
    var el = find(e);
    if (!el || el !== holoHov) return;
    /* Переход между буквами внутри того же экрана - не уход */
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    holoHov = null;
  }, { passive: true });

  doc.addEventListener("click", function (e) {
    var el = find(e);
    if (!el || !el.classList.contains("cin-holo")) return;
    holoFlash(el);
    snd("uiClick");
  }, { passive: true });
}

/* Состояние кольца: до трека оно лежит в потоке, на треке держится
   в середине кадра, после - остаётся внизу трека. Считаем от
   обёртки блока: её высота задана в стилях и не зависит от того,
   что делает само кольцо, поэтому обратной связи здесь нет. */
function pin(act) {
  var ring = act.ring;
  var wrapR = act.wrap.getBoundingClientRect();
  var h = act.ringH || ring.getBoundingClientRect().height;
  var line = innerHeight * 0.5 - h / 2;
  var top0 = wrapR.top + act.ringOff;
  var tail = wrapR.bottom - h - 8;

  var state = 0;
  if (tail < line) state = 2;
  else if (top0 <= line) state = 1;

  if (state !== act.pinState) {
    act.pinState = state;
    ring.classList.toggle("cin-pin", state === 1);
    ring.classList.toggle("cin-pin-end", state === 2);
  }
}

function cabin(act) {
  var items = act.items, n = items.length;
  if (!n || !act.stage) return;

  var V = iv();
  var plan = V ? V.plan() : null;
  var step = plan ? plan.step : TAU / 8;
  var slotOf = function (i) {
    return (plan && plan.rel && plan.rel[i] !== undefined) ? plan.rel[i] : (i + 0.5) * step;
  };
  var turn = turnOf(V, act, n, step);
  var placed = !!(V && V.live());

  var cx = act.stage.left + act.stage.width / 2;
  var cy = act.stage.top + act.stage.height / 2;
  var R = phone ? 460 : 780;
  /* Разлёт по горизонтали. На телефоне карточка шириной почти во
     весь экран, и прежний предел уводил её край далеко за кадр:
     соседняя панель кольца наезжала на читаемую и обрезалась
     краем экрана. Теперь уходит ровно настолько, чтобы читалось
     кольцо, но текст не резался. */
  var maxX = innerWidth * (phone ? 0.44 : 0.78);
  var front = phone ? 0.34 : FRONT;
  var deg = root.getAttribute("data-degrade");
  var soft = !phone && !root.classList.contains("rc-fast") && deg !== "2" && deg !== "3";
  /* Экраны собраны разметкой один раз, при сборке акта. Если слоёв
     нет, писать переменные проектора некуда и незачем. */
  var holo = !!act.holo;
  /* Распад развёртки на уходе телефону по карману: это одна маска,
     а не фильтр. Поэтому у него отдельное разрешение, не общее с
     размытием. Перемотка и слабое устройство его всё же снимают. */
  var dcOK = !root.classList.contains("rc-fast") && deg !== "2" && deg !== "3";

  /* Ближайшая к центру карточка - та, которую сейчас читают.
     Она никогда не мутнеет, чем бы ни занималась остальная сцена. */
  var best = -1, bestA = 99;
  var i, rel, ax;
  for (i = 0; i < n; i++) {
    ax = Math.abs(wrap(slotOf(i) - turn));
    if (ax < bestA) { bestA = ax; best = i; }
  }

  for (i = 0; i < n; i++) {
    var el = items[i];
    var slot = slotOf(i);
    rel = wrap(slot - turn);
    ax = Math.abs(rel);

    /* Экранное место панели. У точки за спиной адреса нет, там
       берём геометрию кольца: карточку всё равно не видно. */
    var tx = R * Math.sin(rel), ty = 0;
    if (placed) {
      var pr = V.project(slot);
      if (pr.d > 0.3 && pr.v > 0 && ax < 1.3) {
        tx = pr.x * innerWidth - cx;
        /* По вертикали слушаемся стены только наполовину и в
           пределах полосы: строчку читают на своём месте, а не
           там, куда её увела перспектива. */
        ty = clamp((pr.y * innerHeight - cy) * 0.45, -innerHeight * 0.1, innerHeight * 0.1);
      }
    }
    tx = clamp(tx, -maxX, maxX);
    var tz = R * (Math.cos(rel) - 1);

    /* Ровно перед зрителем поворот сходит в ноль: читаемая
       карточка не имеет права быть отвёрнутой. */
    var rot = ax < front ? rel * (ax / front) : rel;

    var vis = ax <= front ? 1 : clamp(1 - (ax - front) / (phone ? 0.62 : 0.98), 0, 1);
    if (i === best) vis = Math.max(vis, 0.92);

    var s = el.style;
    s.setProperty("--cin-x", tx.toFixed(1) + "px");
    s.setProperty("--cin-y", ty.toFixed(1) + "px");
    s.setProperty("--cin-z", tz.toFixed(0) + "px");
    s.setProperty("--cin-rot", (rot * DEG).toFixed(2) + "deg");
    s.setProperty("--cin-vis", vis.toFixed(3));
    s.setProperty("--cin-blur", (soft && i !== best ? (1 - vis) * 2.6 : 0).toFixed(2) + "px");
    s.setProperty("--cin-zi", String(Math.round(600 - ax * 170)));

    /* ── Голограмма: яркость проектора и распад развёртки ─────
       Яркость считаем от угла, а не от прозрачности: экран
       разгорается, пока подъезжает к линии чтения, и делает это
       заметно раньше, чем перестаёт быть полупрозрачным. */
    if (holo) {
      var lit = clamp(1 - ax / (front * 1.7), 0, 1);
      s.setProperty("--cin-lit", lit.toFixed(3));

      /* Уход за плечо. Проектор не гаснет прозрачностью: у него
         рвётся развёртка, полосы утоньшаются, и в самом хвосте
         картинка схлопывается по вертикали. Схлоп начинаем только
         в конце, иначе текст плющило бы ещё на читаемом экране. */
      var dec = dcOK ? clamp(1 - vis / 0.72, 0, 1) : 0;
      /* Схлоп по вертикали идёт только в самом хвосте и только там,
         где эффекты не урезаны: плющить текст, который ещё читают,
         нельзя ни на каком устройстве. */
      var sy = soft ? 1 - clamp((dec - 0.58) / 0.42, 0, 1) * 0.68 : 1;
      s.setProperty("--cin-dec", dec.toFixed(3));
      s.setProperty("--cin-sy", sy.toFixed(3));
      el.classList.toggle("cin-decay", dec > 0.02);

      /* Розжиг ровно один раз на приезд: пока экран стоит перед
         человеком, полоса развёртки бежать не должна. */
      var isFront = i === best && ax < front;
      if (isFront && !el.__cinOn) holoIgnite(el);
      el.__cinOn = isFront ? 1 : 0;
    }

    el.classList.toggle("cin-front", i === best);
    /* Ушедшее за плечо не должно ловить курсор и палец */
    el.classList.toggle("cin-far", vis < 0.34);
  }
}

/* ── 2. Бортовой справочник ──────────────────────────────────
   Вопросы висят на стене рубки одним экраном. Он едет вместе со
   стеной, но угол ограничен: правило «текст стоит к человеку
   лицом» сильнее правила «всё честно по геометрии». */
function directory(act) {
  var V = iv();
  var host = act.host;
  var open = act.sec.querySelector(".faq-i.on");

  var rel = 0, dx = 0;
  if (V) {
    var plan = V.plan();
    rel = wrap(plan.faq - turnOf(V, act, 1, plan.step));
    if (V.live() && act.hostRect) {
      var pr = V.project(plan.faq);
      if (pr.d > 0.3 && pr.v > 0) {
        var hc = act.hostRect.left + act.hostRect.width / 2;
        dx = clamp(pr.x * innerWidth - hc, -innerWidth * 0.07, innerWidth * 0.07);
      }
    }
  } else {
    rel = (pass(act.rect) - 0.5) * (phone ? 0.5 : 0.9);
  }

  var maxR = phone ? 0.2 : 0.42;
  rel = clamp(rel, -maxR, maxR);
  /* Открытый вопрос читают целиком: экран встаёт фронтально */
  if (open) { rel = 0; dx = 0; }

  /* Догоняем цель за несколько кадров. Переход в стилях тут не
     годится: цель меняется каждый кадр, и браузер каждый раз
     начинал бы переход заново - получилась бы резина. */
  if (act.rotCur === undefined) { act.rotCur = rel; act.dxCur = dx; }
  act.rotCur += (rel - act.rotCur) * 0.14;
  act.dxCur += (dx - act.dxCur) * 0.14;
  /* Пока экран не доехал, кадр не имеет права уснуть: иначе
     справочник замрёт наполовину повёрнутым. */
  if (Math.abs(rel - act.rotCur) > 0.002 || Math.abs(dx - act.dxCur) > 0.4) busy = 1;

  host.style.setProperty("--cin-rot", (act.rotCur * DEG).toFixed(2) + "deg");
  host.style.setProperty("--cin-x", act.dxCur.toFixed(1) + "px");
  host.style.setProperty("--cin-z", (-(1 - Math.cos(act.rotCur)) * 340).toFixed(0) + "px");

  /* Строка, доехавшая до линии чтения, подсвечивается кромкой:
     видно, какой вопрос сейчас «под лучом» справочника. */
  var line = innerHeight * 0.44;
  for (var i = 0; i < act.items.length; i++) {
    var r = act.rects[i];
    if (!r) continue;
    var d = Math.abs(r.top + r.height / 2 - line);
    act.items[i].style.setProperty("--cin-lit",
      clamp(1 - d / (innerHeight * 0.3), 0, 1).toFixed(3));
  }
}

/* ── 3. Проезд вглубь ────────────────────────────────────────
   Сетка продуктов превращается в коридор: карточки приходят из
   глубины, проходят через кадр и уходят за спину. */
function tunnel(act, p) {
  var items = act.items, n = items.length;
  for (var i = 0; i < n; i++) {
    var el = items[i];
    /* Каждая карточка стартует со своей задержкой по проходу */
    var own = clamp(p * 1.35 - (i / n) * 0.35, 0, 1);
    var k = ease(own);
    /* Глубина подхода. Была вдвое больше, и пока карточки шли
       издалека, перспектива разводила ряд: соседи расходились к
       краям кадра, зазор вырастал впятеро, и сетка читалась
       рассыпавшейся, а не проездом камеры. Ближе - ровнее, а
       ощущение прихода из глубины остаётся. На телефоне режем
       сильнее: там угол обзора уже, и та же глубина уносит
       карточку почти за край экрана. */
    var far = phone ? -210 : -320;
    var z = far + k * (100 - far);           /* издалека на зрителя */
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

/* ── 4. Полка с разворотом ───────────────────────────────────
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

/* Салон разворачивать можно не всегда: при просьбе меньше движения
   и на устройстве, которое уже не тянет, страница обязана остаться
   обычной сеткой. Класс снимается вместе с раскладкой. */
function cabinAllowed() {
  return !reduced && !root.classList.contains("rc-reduced") &&
    root.getAttribute("data-degrade") !== "3";
}

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

  /* Салон: карточки надёжности на панелях рубки */
  var rel = doc.querySelector("#reliability");
  var ring = doc.getElementById("relGrid");
  if (rel && ring) {
    var cards = [].slice.call(ring.querySelectorAll(".card"));
    var on = cabinAllowed() && cards.length > 1;
    /* Класса cin-stage на секции тут нарочно нет: он даёт
       perspective, а любой perspective на предке отменяет
       position: fixed у потомка - кольцо перестало бы держаться в
       кадре. Точка схода живёт на самом кольце. */
    rel.classList.toggle("cin-cabin", on);
    ring.classList.toggle("cin-ring", on);
    /* Длина трека прокрутки считается из числа панелей, а правило
       живёт на обёртке блока - переменную ставим на секцию, иначе
       она до обёртки не дойдёт. */
    rel.style.setProperty("--cab-n", String(cards.length));
    cards.forEach(function (el) { el.classList.toggle("cin-item", on); });
    /* Экраны рубки: слои проекции живут разметкой. Вне салона их
       снимаем начисто - карточка обязана вернуться карточкой. */
    if (on) holoBuild(cards); else holoStrip(cards);
    /* Меряем кольцо только в потоке: у закреплённого offsetTop
       считается от окна и трек получился бы кривым. */
    ring.classList.remove("cin-pin", "cin-pin-end");
    if (on) {
      holoHand();
      acts.push({ sec: rel, kind: "cabin", items: cards, ring: ring,
        wrap: ring.parentNode,
        ringOff: ring.offsetTop,
        ringH: ring.getBoundingClientRect().height,
        holo: true,
        pinState: -1, rects: [], rect: null, stage: null });
    }
  }

  /* Справочник: вопросы одним экраном на стене */
  var faqSec = doc.querySelector("#faq");
  var faqHost = faqSec ? faqSec.querySelector(".faq") : null;
  if (faqSec && faqHost) {
    var qs = [].slice.call(faqHost.querySelectorAll(".faq-i"));
    var onF = cabinAllowed() && qs.length > 0;
    faqSec.classList.toggle("cin-stage", onF);
    faqSec.classList.toggle("cin-desk", onF);
    faqHost.classList.toggle("cin-board", onF);
    if (onF) {
      acts.push({ sec: faqSec, kind: "directory", items: qs, host: faqHost,
        rects: [], rect: null, hostRect: null });
    }
  }

  add("#products", "tunnel", ".prod-card");
  add("#cases", "shelf", ".case");
  add("#how", "shelf", ".step");

  /* Салон меняет высоту блока надёжности: сцена обязана пересчитать
     пороги, иначе люк закроется не там, где стоит содержимое. */
  if (g.RC_INTERIOR && g.RC_INTERIOR.remeasure) {
    setTimeout(function () { g.RC_INTERIOR.remeasure(); }, 60);
  }
}

/* ── Кадр: сперва читаем, потом пишем ───────────────────────── */
var lastY = -1, lastYaw = -99, idle = 0, wake = 0, busy = 0;

/* Раскрытие вопроса выпрямляет справочник, а страница при этом
   стоит. Будим кадр руками, иначе экран замрёт на полпути. */
doc.addEventListener("click", function (e) {
  if (e.target.closest && e.target.closest(".cin-board")) wake = 48;
}, { passive: true });

function frame() {
  raf = requestAnimationFrame(frame);
  if (doc.hidden || !acts.length) return;
  if (root.classList.contains("rc-reduced")) return;

  /* Перемотка гасит мелкую анимацию, но не раскладку салона:
     четыре карточки лежат друг на друге, и если перестать их
     разводить, они схлопнутся в кучу посреди прокрутки. */
  var fast = root.classList.contains("rc-fast");

  /* Страница стоит - пересчитывать нечего. Но у рубки свой демпфер:
     после остановки прокрутки камера ещё доезжает, и карточки
     обязаны доехать вместе с ней, иначе текст замрёт на полпути. */
  var y = g.pageYOffset || doc.documentElement.scrollTop || 0;
  var V = g.RC_INTERIOR;
  var yaw = (V && V.yaw) ? V.yaw() : 0;
  if (wake > 0) { wake--; idle = 0; }
  else if (!busy && Math.abs(y - lastY) < 0.5 && Math.abs(yaw - lastYaw) < 0.0004) {
    if (++idle > 2) return;
  } else { idle = 0; }
  lastY = y;
  lastYaw = yaw;
  busy = 0;

  var i, a;
  /* Чтение */
  for (i = 0; i < acts.length; i++) {
    a = acts[i];
    a.rect = a.sec.getBoundingClientRect();
    a.live = a.rect.bottom > -200 && a.rect.top < innerHeight + 200;
    /* Кольцо салона считаем всегда, даже когда блок далеко. Оно
       единственное здесь держится в кадре само по себе, и если
       перестать за ним следить на прыжке прокрутки - по якорю или
       клавишей «в конец» - оно так и останется висеть посреди
       чужого экрана. Одно измерение за кадр, это дёшево. */
    if (a.kind === "cabin") pin(a);
    if (!a.live) continue;
    if (a.kind === "shelf") {
      a.rects = a.items.map(function (el) { return el.getBoundingClientRect(); });
    } else if (a.kind === "cabin") {
      a.stage = a.ring.getBoundingClientRect();
    } else if (a.kind === "directory") {
      a.hostRect = a.host.getBoundingClientRect();
      a.rects = a.items.map(function (el) { return el.getBoundingClientRect(); });
    }
  }
  /* Запись */
  for (i = 0; i < acts.length; i++) {
    a = acts[i];
    if (!a.live) continue;
    if (a.kind === "cabin") { cabin(a); continue; }
    if (a.kind === "directory") { directory(a); continue; }
    if (fast) continue;
    var p = pass(a.rect);
    if (a.kind === "tunnel") tunnel(a, p);
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
/* Устройство перестало тянуть или человек попросил меньше движения:
   салон складывается обратно в обычную сетку. */
addEventListener("rc:degrade", function () { setTimeout(collect, 30); });
addEventListener("rc:reduced", function () { setTimeout(collect, 30); });
if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 150); });
else setTimeout(boot, 150);

g.RC_CINEMA = {
  refresh: collect,
  stats: function () {
    return acts.map(function (a) { return a.kind + ":" + a.items.length; }).join(" ");
  }
};

})(window);
