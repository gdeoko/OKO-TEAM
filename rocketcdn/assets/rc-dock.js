/* ═══════════════════════════════════════════════════════════
   Rocket · стыковочный узел: выход из космоса с выбором причала

   Космос один, а марок в нём две, и у каждой свой сайт. До сих пор
   выход был односторонним: куда уйдёт человек, решала голограмма в
   кабине, а сам он об этом узнавал уже на той стороне. Владелец
   попросил ровно обратное - чтобы на выходе человек ВЫБИРАЛ, куда
   вернуться.

   Три решения, на которых стоит этот файл.

   1. ВЫХОД ЭТО ЧАСТЬ КИНО, А НЕ ОКНО БРАУЗЕРА. Никакого «вы уверены,
      что хотите выйти» с двумя кнопками. Перед кораблём разворачивается
      короткий коридор с двумя причалами: бирюзовый ведёт на сайт
      Rocket CDN, индиговый открывает прокол на сайт Rocket VPN. Человек
      подходит к причалу, корабль швартуется, и только потом меняется
      адрес.

   2. У ЧЕЛОВЕКА ВСЕГДА ЕСТЬ КОРОТКИЙ ХОД. Escape и системная кнопка
      «назад» закрывают узел и оставляют человека в космосе, а не
      уводят его на случайный сайт. Красиво не значит без выхода.

   3. УЗЕЛ НЕ ЗНАЕТ, КУДА ВЕДУТ ПРИЧАЛЫ. Он спрашивает это у RC_VPN,
      который и владеет марками и адресами. Иначе адрес сайта VPN
      оказался бы записан в двух местах и разошёлся бы при первой же
      правке.

   Доступность: узел это диалог с ловушкой фокуса, причалы это кнопки
   не мельче 44 точек, стрелки ходят между ними, Enter выбирает, Escape
   закрывает. При включённом «уменьшить движение» узел появляется без
   анимации.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document;
var узел = null;          /* корневой узел разметки */
var былФокус = null;      /* куда вернуть фокус при закрытии */
var швартуется = false;

function ru() {
  return (doc.documentElement.getAttribute("lang") || "ru") !== "en";
}

function полёт() { return doc.querySelector(".rc-flight"); }

function тише() {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches ||
           doc.documentElement.classList.contains("rc-reduced");
  } catch (e) { return false; }
}

var ПРИЧАЛЫ = [
  {
    марка: "cdn",
    лого: "assets/mark.webp",
    имя: "Rocket CDN",
    строка: { ru: "вернуться на сайт сети", en: "back to the network site" },
    цвет: "бирюза"
  },
  {
    марка: "vpn",
    /* Марка без надписи. У Rocket CDN марка это голая литера с
       ракетой, а у VPN в файле лежит полный замок с надписью
       RocketVPN и слоганом. Рядом на двух причалах это читалось
       разнобоем: слева знак, справа вывеска, и размеры разные.
       Владелец увидел это первым же взглядом. Здесь берём марку,
       вырезанную из того же файла: обе стоят в одинаковом квадрате и
       читаются парой. Название и так подписано ниже словами. */
    лого: "assets/rocketvpn-mark.webp",
    имя: "RocketVPN",
    строка: { ru: "уйти проколом на сайт VPN", en: "punch through to the VPN site" },
    цвет: "индиго"
  }
];

/* Куда ведёт причал. Спрашиваем у владельца марок: адрес сайта VPN
   подписывается на сервере, и знать его здесь незачем. */
function уйти(марка) {
  try {
    if (g.RC_VPN && g.RC_VPN.set) g.RC_VPN.set(марка);
  } catch (e) {}
  if (марка === "vpn") {
    var адрес = "/vpn.php";
    try {
      if (g.RC_VPN && g.RC_VPN.exit) адрес = g.RC_VPN.exit() || адрес;
    } catch (e2) {}
    var уехать = function () { try { g.location.href = адрес; } catch (e3) {} };
    /* Причал VPN это не ссылка, а ПРОКОЛ. На той стороне человека
       встречает акт «Выход», где сеть уже открыта, и попасть туда
       мгновенной сменой адреса значит отдать ему конец сюжета без
       перехода. Прокол уводит сам, когда доиграет; не собрался -
       уходим сразу, переход важнее кадра. */
    var пошёл = false;
    try {
      if (g.RC_PROKOL && g.RC_PROKOL["открыть"]) пошёл = g.RC_PROKOL["открыть"](уехать);
    } catch (e5) {}
    if (!пошёл) уехать();
    return;
  }
  /* Причал CDN: сайт уже под нами, космос просто закрывается там же,
     где человек его открыл. Перезагрузка страницы стоила бы ему места
     в прокрутке и всей собранной сцены. */
  закрыть(true);
  try {
    if (g.RC_FLIGHT && g.RC_FLIGHT.close) g.RC_FLIGHT.close();
  } catch (e4) {}
}

/* Швартовка: причал разгорается, свет заливает кадр, и только после
   этого меняется адрес. Без этой паузы переход читается обрывом. */
function швартовка(кнопка, марка) {
  if (швартуется) return;
  швартуется = true;
  if (узел) узел.setAttribute("data-швартовка", марка);
  кнопка.classList.add("рчл-идёт");
  var пауза = тише() ? 0 : 760;
  setTimeout(function () { уйти(марка); швартуется = false; }, пауза);
}

function собрать() {
  var f = полёт();
  if (!f || узел) return узел;

  узел = doc.createElement("div");
  узел.className = "rcf-dock";
  узел.setAttribute("role", "dialog");
  узел.setAttribute("aria-modal", "true");
  узел.setAttribute("aria-label", ru() ? "Стыковочный узел" : "Docking node");

  var шапка = doc.createElement("p");
  шапка.className = "rcf-dock-line";
  шапка.textContent = ru() ? "Куда швартуемся" : "Where do we moor";
  узел.appendChild(шапка);

  var ряд = doc.createElement("div");
  ряд.className = "rcf-dock-row";

  ПРИЧАЛЫ.forEach(function (п) {
    var b = doc.createElement("button");
    b.type = "button";
    b.className = "rcf-berth рчл-" + п.цвет;
    b.setAttribute("data-марка", п.марка);
    b.innerHTML =
      '<span class="rcf-berth-glow" aria-hidden="true"></span>' +
      '<img class="rcf-berth-mark" src="' + п.лого + '" alt="" aria-hidden="true" ' +
      'width="256" height="256" decoding="async">' +
      '<b>' + п.имя + '</b>' +
      '<i>' + (ru() ? п.строка.ru : п.строка.en) + '</i>';
    b.addEventListener("click", function () { швартовка(b, п.марка); });
    ряд.appendChild(b);
  });
  узел.appendChild(ряд);

  var назад = doc.createElement("button");
  назад.type = "button";
  назад.className = "rcf-dock-back";
  назад.textContent = ru() ? "Остаться в космосе" : "Stay in space";
  назад.addEventListener("click", function () { закрыть(); });
  узел.appendChild(назад);

  узел.addEventListener("keydown", поКлавише);
  f.appendChild(узел);
  return узел;
}

/* Клавиатура. Стрелки ходят между причалами, Escape закрывает, Tab
   заперт внутри узла: это диалог, и уходить из него табом за спину
   человеку незачем. */
function поКлавише(e) {
  var кнопки = узел ? [].slice.call(узел.querySelectorAll("button")) : [];
  if (!кнопки.length) return;
  var i = кнопки.indexOf(doc.activeElement);
  if (e.key === "Escape") {
    /* Останавливаем всплытие: выше по дереву Escape закрывает весь
       космос, а из узла он должен возвращать в космос, а не из него. */
    e.preventDefault();
    e.stopPropagation();
    закрыть();
    return;
  }
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    кнопки[(i + 1 + кнопки.length) % кнопки.length].focus();
    return;
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    кнопки[(i - 1 + кнопки.length) % кнопки.length].focus();
    return;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    var шаг = e.shiftKey ? -1 : 1;
    кнопки[(i + шаг + кнопки.length) % кнопки.length].focus();
  }
}

function открыть() {
  var у = собрать();
  if (!у) return false;
  былФокус = doc.activeElement;
  у.classList.add("рчл-видно");
  var f = полёт();
  if (f) f.classList.add("rcf-docking");
  var первый = у.querySelector("button");
  if (первый) setTimeout(function () { try { первый.focus(); } catch (e) {} }, тише() ? 0 : 120);
  return true;
}

function закрыть(тихо) {
  if (!узел) return;
  узел.classList.remove("рчл-видно");
  узел.removeAttribute("data-швартовка");
  var идущие = узел.querySelectorAll(".рчл-идёт");
  for (var i = 0; i < идущие.length; i++) идущие[i].classList.remove("рчл-идёт");
  var f = полёт();
  if (f) f.classList.remove("rcf-docking");
  if (!тихо && былФокус && былФокус.focus) { try { былФокус.focus(); } catch (e) {} }
  былФокус = null;
}

function открыт() { return !!(узел && узел.classList.contains("рчл-видно")); }

g.RC_DOCK = {
  открыть: открыть,
  закрыть: закрыть,
  открыт: открыт
};

})(window);
