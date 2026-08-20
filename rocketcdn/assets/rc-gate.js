/* ═══════════════════════════════════════════════════════════
   Rocket CDN · карточки в проёме люка

   Клиент описал этот кадр так: «двери открываются с паром, как у
   настоящей ракеты, и там появляется на мобиле две карточки внутри
   открытых дверей, как в салоне (на ПК по бокам ракеты); дальше мы
   приближаемся и заходим внутрь, и в этот момент эти карточки, как
   голограмма, исчезают в воздухе, растворяются одновременно с
   приближением».

   То есть в проёме мы должны увидеть кусочек того, что ждёт внутри:
   пару голографических экранов из салона. Они не украшение - это
   первые два тезиса раздела надёжности, которые дальше встретят нас
   на стене рубки. Поэтому текст берём из самой страницы, а не
   выдумываем: карточки в проёме и экраны в салоне обязаны говорить
   одно и то же.

   Как это живёт по скроллу:
     RC_DOOR  0.15 -> 0.55  экраны проступают в открывающейся щели
     RC_DOOR  0.55 -> 0.85  держатся, читаются
     RC_DOOR  0.85 -> 1     растворяются вместе с наездом камеры
   Обратная прокрутка проигрывает то же самое назад.

   На ПК места по бокам корпуса больше, чем в самом проёме, поэтому
   там экраны стоят по сторонам ракеты; на телефоне корпус занимает
   почти весь кадр - экраны встают в проём, друг под другом.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

/* Дозор вместо кадра: пока делать нечего, цикл спит и просыпается
   четыре раза в секунду или сразу от прокрутки. На телефоне таких
   спящих циклов набирался десяток, и каждый стоил браузеру входа
   в JS на каждом кадре. */
function idler(step, awake) {
  var raf = 0, timer = 0, empty = 0, live = true;
  function frame(ts) {
    raf = 0;
    var busy = step(ts) !== false;
    empty = busy ? 0 : empty + 1;
    if (empty > 8) { live = false; nap(); return; }
    raf = requestAnimationFrame(frame);
  }
  function nap() {
    if (timer) return;
    timer = setInterval(function () {
      if (doc.hidden) return;
      if (!awake || awake()) { clearInterval(timer); timer = 0; empty = 0; live = true; start(); }
    }, 250);
  }
  function start() { if (!raf && live) raf = requestAnimationFrame(frame); }
  /* Будить цикл на каждое движение колеса нельзя: именно во время
     прокрутки эти модули чаще всего и не нужны, а просыпались они
     ровно тогда. Пробуждение решает только собственная проверка -
     она идёт четыре раза в секунду и опоздать не может: и шлюз, и
     пульт въезжают в кадр постепенно. */
  start();
}

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var wrap = null, cards = [], shown = false, lastK = -1;

/* Берём первые карточки раздела надёжности: в проёме показываем
   ровно то, что человек прочитает внутри, только раньше и мельче */
function texts() {
  var out = [];
  var list = doc.querySelectorAll("#reliability .card");
  for (var i = 0; i < list.length && out.length < 2; i++) {
    var t = list[i].querySelector("h3, .card-h, b, strong");
    var p = list[i].querySelector("p");
    out.push({
      t: t ? t.textContent.trim() : "",
      p: p ? p.textContent.trim() : ""
    });
  }
  if (!out.length) {
    out = [{ t: "SLA 99,9%", p: "Доступность закреплена договором." },
           { t: "Поддержка 24/7", p: "Дежурная смена инженеров круглосуточно." }];
  }
  return out;
}

function build() {
  if (wrap) return;
  wrap = doc.createElement("div");
  wrap.className = "rc-gate";
  wrap.setAttribute("aria-hidden", "true");     /* тот же текст есть в разделе ниже */
  var data = texts(), html = "";
  for (var i = 0; i < data.length; i++) {
    html += '<div class="rc-gate-card" data-i="' + i + '">' +
              '<i class="rc-gate-beam"></i>' +
              '<b>' + data[i].t + "</b>" +
              "<span>" + data[i].p + "</span>" +
            "</div>";
  }
  wrap.innerHTML = html;
  doc.body.appendChild(wrap);
  cards = wrap.querySelectorAll(".rc-gate-card");
}

/* Доля проявления: 0 - экранов нет, 1 - читаются целиком.
   На самом входе (дверь почти распахнута) уводим в ноль - именно
   там они растворяются вместе с наездом. */
/* Отрезки подобраны так, чтобы к моменту, когда сцену принимает
   рубка (доля люка около 0.97), голограмм в проёме уже не было:
   владелец описал этот порядок дословно - «там уже салон видно и
   карточки две, которые исчезнут, а потом экраны появляются, когда
   уже зашли». Растворение должно закончиться ДО входа, иначе те же
   две карточки встречают человека второй раз, уже на стене. */
function fade(d) {
  if (d < 0.14) return 0;
  if (d < 0.50) return (d - 0.14) / 0.36;
  if (d < 0.78) return 1;
  return Math.max(0, 1 - (d - 0.78) / 0.15);
}

function frame() {
  if (doc.hidden) return false;

  var d = (typeof g.RC_DOOR === "number") ? g.RC_DOOR : 0;
  var app = (typeof g.RC_APPROACH === "number") ? g.RC_APPROACH : 0;
  /* Внутри корабля проём уже за спиной: там свои экраны на стене */
  var inside = root.classList.contains("rc-inside");
  var want = !inside && app > 0.5 && d > 0.1;

  if (want !== shown) {
    shown = want;
    if (want) build();
    if (wrap) wrap.classList.toggle("on", want);
  }
  if (!wrap || !want) return false;

  var k = fade(d);
  /* Проём накрыл кадр (rc-in-hatch ставит корабль) - значит мы уже
     переступаем порог, и экраны обязаны растаять именно здесь, а не
     висеть до самого салона. Иначе они дублируют те же карточки,
     которые через миг встретят нас на стене рубки. */
  if (root.classList.contains("rc-in-hatch")) k = 0;
  if (Math.abs(k - lastK) < 0.01) return false;
  lastK = k;
  wrap.style.setProperty("--gate-k", k.toFixed(3));
  /* Наезд: при растворении экраны уходят на зрителя вместе с
     камерой, а не просто гаснут - тогда это читается «прошли
     сквозь них», а не «выключили» */
  wrap.style.setProperty("--gate-z", (Math.max(0, d - 0.74) * 5).toFixed(3));
}

function boot() {
  if (reduced || root.classList.contains("rc-reduced")) return;
  if (root.getAttribute("data-degrade") === "3") return;
  /* Шлюз нужен только у самого люка: в остальное время цикл спит */
  idler(frame, function () {
    var d = (typeof g.RC_DOOR === "number") ? g.RC_DOOR : 0;
    var app = (typeof g.RC_APPROACH === "number") ? g.RC_APPROACH : 0;
    return app > 0.4 && d > 0.05;
  });
}

doc.addEventListener("rc:lang", function () {
  /* Язык переключили - тексты в карточках другие, пересобираем */
  if (wrap && wrap.parentNode) { wrap.parentNode.removeChild(wrap); wrap = null; shown = false; lastK = -1; }
});

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
else boot();

g.RC_GATE = {
  state: function () {
    return { есть: !!wrap, видно: shown, доля: +lastK.toFixed(2) };
  }
};

})(window);
