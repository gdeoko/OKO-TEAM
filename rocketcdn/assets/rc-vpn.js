/* ═══════════════════════════════════════════════════════════
   Rocket CDN / RocketVPN · одна голограмма на два сайта

   Космос у двух продуктов общий. Заказчик описал его так: сайт
   Rocket CDN стоит на своём домене, вход в космос один, но сам космос
   обслуживает оба сайта, и через него можно уйти на сайт VPN.

   Отсюда три правила, которые и держит этот файл.

   1. Марка в кабине ОДНА. Раньше рядом с голограммой Rocket CDN висел
      второй логотип RocketVPN (кнопка .rc-vpn-projector). Заказчик
      написал прямо: «где-то в воздухе летают ещё логотип рокет VPN,
      зачем он там нужен непонятно». Второй логотип убран, а его работу
      взяла на себя та самая голограмма марки, что уже стоит в кабине.

   2. Клик по голограмме НИКУДА НЕ УВОДИТ. Он только меняет марку:
      Rocket CDN превращается в RocketVPN и обратно, под короткой
      электронной помехой. Дословно: «просто голограмма логотипа с
      эффектом глитча меняется на другой».

   3. Выход на сайт - отдельная кнопка, и она идёт туда, чью марку
      сейчас показывает голограмма. «И тут уже зависит от логотипа, на
      какой сайт мы вернёмся». Крестик выхода из полёта подчиняется
      тому же правилу: при марке VPN он уводит на сайт VPN, а не просто
      закрывает космос.

   Речь мира (названия узлов, титры, досье) переключается не здесь: её
   берёт rc-flight.js через RC_VPN.mode(). Этот файл только владеет
   маркой и решает, куда ведёт выход.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;

/* ─────────────────────────────────────────────────────────────
   АДРЕС САЙТА ROCKETVPN · ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ У ЗАКАЗЧИКА

   Настоящего домена VPN в проекте нет ни в одном файле: канонический
   адрес этого сайта - https://rocketcdn.ru/, а про VPN во всём коде
   встретился ровно один адрес, вот этот, и стоял он в прежней версии
   этого же файла. Выдумывать второй нельзя, поэтому оставлен
   найденный. Когда заказчик назовёт настоящий домен, правится ОДНА
   строка ниже и больше ничего.
   ───────────────────────────────────────────────────────────── */
var САЙТ_VPN = "https://rocketvpn.top/";

/* Адрес своего сайта нужен только как запасной ход: обычно выход при
   марке CDN просто закрывает космос, потому что мы уже на этом сайте.
   Ссылка живёт в разметке, чтобы кнопка оставалась ссылкой и её можно
   было открыть в новой вкладке средним щелчком. */
var САЙТ_CDN = "./";

/* Марки берём настоящими файлами проекта. Никаких перерисовок в SVG:
   mark.webp это фирменная марка Rocket CDN, которую полёт уже ставит
   в голограмму, rocketvpn-logo.webp - настоящий логотип RocketVPN.
   Пропорции держит сам полёт: у голограммы object-fit: contain. */
var МАРКИ = {
  cdn: { лого: "assets/mark.webp", имя: "Rocket CDN" },
  vpn: { лого: "assets/rocketvpn-logo.webp", имя: "RocketVPN" }
};

var MODE_KEY = "rcdn.product";
var AB_KEY = "rcdn.ab.vpn";
var mode = "cdn", variant = "a", glitchT = 0;

try {
  mode = localStorage.getItem(MODE_KEY) === "vpn" ? "vpn" : "cdn";
  variant = localStorage.getItem(AB_KEY) || "";
  if (variant !== "a" && variant !== "b") {
    variant = Math.random() < 0.5 ? "a" : "b";
    localStorage.setItem(AB_KEY, variant);
  }
} catch (e) { mode = "cdn"; variant = "a"; }

function ru() { return doc.documentElement.lang !== "en"; }

function sound(kind) {
  var s = g.RC_SOUND;
  if (!s) return;
  try {
    if (kind === "jump" && s.hyper) s.hyper();
    else if (s.uiConfirm) s.uiConfirm();
    else if (s.blip) s.blip(760, 0.12, "sine", 0.035);
  } catch (e) {}
}

function track(label) {
  if (!g.RC_track) return;
  try { g.RC_track("product", "vpn-" + variant + ":" + label); } catch (e) {}
}

function flight() { return doc.querySelector(".rc-flight"); }
function марка() { return doc.querySelector(".rcf-holo"); }

/* ── Куда ведёт выход ────────────────────────────────────────
   При марке CDN мы уже на своём сайте, поэтому выходом считается
   закрытие космоса: уводить человека по внешнему адресу туда, где он
   и так стоит, значит терять его прокрутку и состояние страницы.
   При марке VPN выход это переход на другой сайт. */
function адресВыхода() { return mode === "vpn" ? САЙТ_VPN : САЙТ_CDN; }

function уйтиНаСайт(source) {
  track((source || "exit") + "-" + mode);
  if (mode === "vpn") { try { g.location.href = САЙТ_VPN; } catch (e) {} return; }
  if (g.RC_FLIGHT && g.RC_FLIGHT.close) { try { g.RC_FLIGHT.close(); return; } catch (e2) {} }
  try { g.location.href = САЙТ_CDN; } catch (e3) {}
}

/* ── Разметка ────────────────────────────────────────────────
   Голограмму рисует rc-flight.js, а не мы: там она стоит вместе с
   лучом проектора и развёрткой строк. Нам достаточно объявить её
   органом управления и добавить внутрь два своих слоя - помеху и
   подпись марки. Функция идемпотентна: полёт пересобирается при смене
   языка, и признак на узле не даёт навесить обработчики дважды. */
function ensureMark() {
  var м = марка();
  if (!м || м._rcvpn) return false;
  м._rcvpn = true;
  м.classList.add("rc-vpn-mark");
  /* Голограмма была чистым украшением: aria-hidden и без фокуса.
     Раз по ней теперь щёлкают, она обязана быть органом и для
     клавиатуры, и для чтения с экрана. */
  м.removeAttribute("aria-hidden");
  м.setAttribute("role", "button");
  м.setAttribute("tabindex", "0");
  var шум = doc.createElement("span");
  шум.className = "rc-vpn-mark-noise";
  шум.setAttribute("aria-hidden", "true");
  м.appendChild(шум);
  var подпись = doc.createElement("b");
  подпись.className = "rc-vpn-mark-cap";
  подпись.setAttribute("data-vpn-name", "");
  м.appendChild(подпись);

  м.addEventListener("click", function (e) {
    e.preventDefault();
    toggle("hologram");
  });
  /* Клавиатура: у роли button пробел и ввод обязаны работать так же,
     как щелчок. Пробел гасим, иначе страница под космосом прокрутится. */
  м.addEventListener("keydown", function (e) {
    var k = e.key;
    if (k !== "Enter" && k !== " " && k !== "Spacebar") return;
    e.preventDefault();
    toggle("hologram-key");
  });
  return true;
}

function ensureExit() {
  var f = flight();
  if (!f || f.querySelector(".rc-vpn-exit")) return false;
  var a = doc.createElement("a");
  a.className = "rc-vpn-exit";
  a.setAttribute("rel", "noopener");
  a.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14 4h4.5v16H14"/><path d="M10.5 8.2L14.6 12l-4.1 3.8"/><path d="M14.2 12H4.5"/></svg>' +
    '<span><i>' + (ru() ? "ВЫХОД ИЗ КОСМОСА" : "LEAVE SPACE") + '</i>' +
    '<b data-vpn-site></b></span>';
  a.addEventListener("click", function (e) {
    /* При марке CDN уходить некуда: закрываем космос и остаёмся на
       своей странице там же, где человек её оставил. */
    if (mode === "vpn") { track("exit-vpn"); return; }
    e.preventDefault();
    уйтиНаСайт("exit");
  });
  f.appendChild(a);
  return true;
}

function ensureDrawer() {
  var d = doc.getElementById("drawer");
  if (!d || d.querySelector(".rc-vpn-entry")) return;
  var b = doc.createElement("button");
  b.type = "button";
  b.className = "rc-vpn-entry js-vpn-mode";
  b.innerHTML =
    '<span class="rc-vpn-entry-mark"><img src="' + МАРКИ.vpn.лого + '" alt="" aria-hidden="true" width="48" height="48" loading="lazy" decoding="async"></span>' +
    '<span><b>RocketVPN</b><i data-vpn-label></i></span>' +
    '<em aria-hidden="true"></em>';
  var tools = d.querySelector(".drawer-tools");
  d.insertBefore(b, tools || null);
}

/* ── Показать текущую марку ──────────────────────────────────
   Одна функция на всё состояние: и голограмма, и подпись, и адрес
   выхода, и крестик читают одно и то же поле mode. Пока состояние
   раскладывалось по трём местам, оно расходилось. */
function paint() {
  var м = МАРКИ[mode] || МАРКИ.cdn;
  var другая = МАРКИ[mode === "vpn" ? "cdn" : "vpn"];
  root.setAttribute("data-product", mode);
  root.setAttribute("data-vpn-ab", variant);

  var buttons = doc.querySelectorAll(".rc-vpn-entry");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].setAttribute("aria-pressed", mode === "vpn" ? "true" : "false");
    buttons[i].classList.toggle("on", mode === "vpn");
    var tx = buttons[i].querySelector("[data-vpn-label]");
    if (tx) {
      tx.textContent = mode === "vpn"
        ? (ru() ? "Марка в космосе: RocketVPN" : "Space mark: RocketVPN")
        : (variant === "a"
          ? (ru() ? "Сменить марку космоса на RocketVPN" : "Switch the space mark to RocketVPN")
          : (ru() ? "Защищённый контур VPN в том же космосе" : "Secure VPN circuit in the same space"));
    }
  }

  var узел = марка();
  if (узел) {
    var img = узел.querySelector("img");
    /* Подменяем адрес только когда он реально другой: без проверки
       браузер перезапрашивал картинку на каждой перерисовке и марка
       моргала пустотой посреди помехи. */
    if (img && img.getAttribute("src") !== м.лого) img.setAttribute("src", м.лого);
    /* Имя органа даёт aria-label на самой голограмме, поэтому картинка
       остаётся немой: иначе скринридер прочитает марку дважды. */
    if (img) img.setAttribute("alt", "");
    var cap = узел.querySelector("[data-vpn-name]");
    if (cap) cap.textContent = м.имя.toUpperCase();
    узел.setAttribute("aria-label", ru()
      ? "Марка " + м.имя + ". Нажмите, чтобы сменить на " + другая.имя
      : "Mark " + м.имя + ". Press to switch to " + другая.имя);
    узел.setAttribute("title", ru()
      ? "Сменить марку на " + другая.имя
      : "Switch the mark to " + другая.имя);
    узел.setAttribute("aria-pressed", mode === "vpn" ? "true" : "false");
  }

  var вых = doc.querySelector(".rc-vpn-exit");
  if (вых) {
    вых.setAttribute("href", адресВыхода());
    var имяСайта = вых.querySelector("[data-vpn-site]");
    if (имяСайта) имяСайта.textContent = (ru() ? "на сайт " + м.имя : "to " + м.имя).toUpperCase();
    вых.setAttribute("aria-label", ru()
      ? "Выйти из космоса на сайт " + м.имя
      : "Leave space for the " + м.имя + " site");
    вых.setAttribute("title", вых.getAttribute("aria-label"));
  }

  /* Крестик полёта принадлежит rc-flight.js, но правило выхода одно на
     всех: человек должен видеть, куда его выведет закрытие космоса,
     ДО того как нажмёт. Меняем только подпись, разметку не трогаем. */
  var кр = doc.querySelector(".rc-flight .rcf-close");
  if (кр) {
    var сл = ru()
      ? (mode === "vpn" ? "Выйти из космоса на сайт RocketVPN" : "Выйти из полёта")
      : (mode === "vpn" ? "Leave space for the RocketVPN site" : "Exit flight");
    кр.setAttribute("aria-label", сл);
    кр.setAttribute("title", сл);
  }

  var status = doc.querySelectorAll("[data-vpn-status]");
  for (i = 0; i < status.length; i++) {
    status[i].textContent = mode === "vpn"
      ? (ru() ? "КОНТУР VPN ВЫБРАН" : "VPN CIRCUIT SELECTED")
      : (ru() ? "КОНТУР CDN АКТИВЕН" : "CDN CIRCUIT ACTIVE");
  }
}

/* ── Смена марки ─────────────────────────────────────────────
   Помеха и подмена идут в одном кадре: класс помехи ставится первым,
   картинка меняется сразу за ним, поэтому новый логотип появляется уже
   внутри дребезга, а не после него. Так это и читается - сигнал
   проектора сорвало, и он собрался другой маркой. */
function setMode(next, source) {
  next = next === "vpn" ? "vpn" : "cdn";
  var м = марка();
  if (glitchT) clearTimeout(glitchT);
  root.classList.remove("rc-product-glitch");
  if (м) м.classList.remove("rc-vpn-flick");
  /* Принудительный пересчёт: без него повторный клик по той же марке
     не перезапускал анимацию, класс снимался и ставился в одном кадре. */
  void root.offsetWidth;
  root.classList.add("rc-product-glitch");
  if (м) м.classList.add("rc-vpn-flick");
  glitchT = setTimeout(function () {
    root.classList.remove("rc-product-glitch");
    var м2 = марка();
    if (м2) м2.classList.remove("rc-vpn-flick");
  }, 680);

  mode = next;
  try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
  paint();
  sound(mode === "vpn" ? "jump" : "confirm");
  track((source || "switch") + "-" + mode);
  try {
    dispatchEvent(new CustomEvent("rc:product", {
      detail: { product: mode, source: source || "switch", variant: variant }
    }));
  } catch (e2) {}
}

function toggle(source) {
  setMode(mode === "vpn" ? "cdn" : "vpn", source);
}

function bind() {
  ensureDrawer();
  ensureMark();
  ensureExit();
  paint();

  doc.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".js-vpn-mode") : null;
    if (!b) return;
    e.preventDefault();
    toggle("drawer");
  });

  /* Крестик выхода из полёта при марке VPN уводит на сайт VPN.

     Заказчик описал космос как общий для двух сайтов: «если мы выходим
     из космоса обратно, то попадаем на сайт VPN». Разметка и обработчик
     крестика живут в rc-flight.js, поэтому перехватываем на погружении:
     на этой фазе документ получает событие раньше самой кнопки, и её
     собственный обработчик до работы не доходит. При марке CDN не
     вмешиваемся вовсе - крестик закрывает космос, как и закрывал. */
  doc.addEventListener("click", function (e) {
    if (mode !== "vpn") return;
    var кр = e.target.closest ? e.target.closest(".rc-flight .rcf-close") : null;
    if (!кр) return;
    e.preventDefault();
    e.stopPropagation();
    уйтиНаСайт("close");
  }, true);

  /* Полёт строится лениво и пересобирается при смене языка, поэтому
     наблюдатель остаётся активным: потерянные после пересборки марка и
     кнопка выхода собираются заново сами.

     Внутри полёта разметка правится по несколько раз за кадр - там
     живут табло, скорость и подсказки. Значит, в обработчике не должно
     быть ничего дорогого: обе сборки выходят по одному querySelector,
     когда всё на месте, а перерисовка состояния зовётся ТОЛЬКО если
     что-то действительно собрали заново. Иначе paint переписывал бы
     подпись марки шестьдесят раз в секунду, а каждая такая запись -
     это новая правка разметки, то есть вызов наблюдателя по кругу. */
  if (g.MutationObserver) {
    var mo = new MutationObserver(function () {
      var собрали = ensureMark();
      if (ensureExit()) собрали = true;
      if (собрали) paint();
    });
    mo.observe(doc.body, { childList: true, subtree: true });
  }

  doc.addEventListener("rc:lang", function () {
    /* Сам полёт при смене языка пересобирается, новый экземпляр придёт
       с чистой голограммой. Меню обновляем сразу, остальное подхватит
       наблюдатель. */
    var old = doc.querySelector(".rc-vpn-entry");
    if (old) old.parentNode.removeChild(old);
    ensureDrawer();
    ensureMark();
    ensureExit();
    paint();
  });
}

g.RC_VPN = {
  mode: function () { return mode; },
  set: function (v) { setMode(v, "api"); },
  /* Отдельной панели RocketVPN в кабине больше нет: заказчик просил,
     чтобы клик по марке ничего не открывал. Ходы остаются, потому что
     rc-flight.js зовёт RC_VPN.close() при разборе панелей и на Escape,
     и падать там не должно. */
  open: function () {},
  close: function () {},
  /* Куда сейчас ведёт выход. Наружу отдаём для приёмки: проверка
     доказывает, что адрес меняется вместе с маркой. */
  exit: адресВыхода,
  variant: function () { return variant; }
};

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", bind);
else bind();

})(window);
