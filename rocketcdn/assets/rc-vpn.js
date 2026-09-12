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
/* Ведём НЕ прямо на rocketvpn.top, а на свою же передачу /vpn.php.
   Причина в том, что сайт VPN закрыт и пускает только по подписанному
   ключу, а подписать ключ можно лишь секретом, которым он проверяется.
   Секрет нельзя отдавать в браузер: ключ, собранный на стороне
   человека, сможет собрать кто угодно, и закрытость станет
   декорацией. Поэтому ссылка ведёт на сервер, там ключ подписывается,
   и человек уходит уже с готовым.

   Здесь же лежит и признак перехода из космоса: сайт VPN по нему
   встречает человека сразу в акте выхода, а не отматывает его к
   первому экрану, который он уже прошёл на этой стороне. */
var ПЕРЕДАЧА_VPN = "/vpn.php";
/* Прямой адрес держим как запасной ход на случай, когда передача не
   отвечает: тогда человек хотя бы попадёт на сам сервис. */
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

/* Сколько длится сбой проектора. Полсекунды с небольшим: короче -
   и глаз не успевает прочитать помеху как помеху, длиннее - и смена
   марки превращается в ожидание. */
var ПОМЕХА_МС = 560;
/* Предзагруженные марки для холста. Холст рисует не тот <img>, что
   стоит в разметке, а свои картинки: в момент сбоя разметочная уже
   переключена на новую марку, а помехе нужны обе - старая до срыва и
   новая после. */
var логоImg = {};
/* Номер текущего прогона помехи. Второй щелчок посреди первого сбоя
   поднимает номер, и старый цикл кадров молча уходит. */
var фхНомер = 0;

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

/* ── Помеха на холсте ────────────────────────────────────────
   Заказчик просил, чтобы марка менялась «с эффектом глитча». Одной
   CSS-анимации на это не хватает: она умеет дёрнуть и перекосить
   картинку целиком, но не умеет ни развести цветовые каналы, ни
   порвать изображение по строкам - а именно эти две вещи глаз и
   читает как сбой сигнала.

   Поэтому кадры сбоя считает код и кладёт на холст поверх проекции:
   три прохода разными оттенками с разбегом по горизонтали дают
   разъезд каналов, случайные полосы - строчный разрыв, тёмная
   гребёнка - развёртку трубки. Ни одной картинки под это не нужно:
   рисуется всё из тех же двух марок, что уже лежат в проекте.

   На середине сбоя источник меняется со старой марки на новую -
   сигнал сорвало, и собрался он уже другим логотипом. Это и есть то
   самое «просто голограмма логотипа с эффектом глитча меняется на
   другой».

   Если холста в браузере нет, картинки ещё не догрузились или у
   коробки нулевой размер - помеха честно отказывается работать и
   возвращает false. Тогда остаётся прежний путь на одном CSS. */
function готовьЛого() {
  var ключи = ["cdn", "vpn"], i, им;
  for (i = 0; i < ключи.length; i++) {
    if (логоImg[ключи[i]]) continue;
    им = new Image();
    им.decoding = "async";
    им.src = МАРКИ[ключи[i]].лого;
    логоImg[ключи[i]] = им;
  }
}

function готова(им) { return !!(им && им.complete && им.naturalWidth); }

function спокойно() {
  try { return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  catch (e) { return false; }
}

/* Один кадр сбоя. сила от 0 до 1 - насколько сильно порван сигнал. */
function кадрПомехи(ctx, ш, в, им, сила) {
  ctx.clearRect(0, 0, ш, в);
  if (!готова(им)) return;
  /* Вписываем марку в коробку ровно так же, как это делает
     object-fit: contain у настоящей картинки. Иначе в момент подмены
     логотип прыгнет в размере, а этого заказчик как раз просил не
     делать - пропорции держим. */
  var k = Math.min(ш / им.naturalWidth, в / им.naturalHeight);
  var шм = им.naturalWidth * k, вм = им.naturalHeight * k;
  var x0 = (ш - шм) / 2, y0 = (в - вм) / 2;
  var разбег = сила * ш * 0.085;
  /* Тот же тон, каким rc-flight.css красит настоящую марку: холст
     обязан выглядеть той же проекцией, а не другой картинкой. */
  var ОСНОВА = "brightness(1.75) sepia(1) saturate(3.8) hue-rotate(162deg)";

  /* Каналы складываем по свету, а не поверх друг друга: так три
     прохода дают одну расслоившуюся проекцию, а не три картинки. */
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = ОСНОВА;
  ctx.drawImage(им, x0, y0, шм, вм);
  if (разбег > 0.4) {
    ctx.filter = "brightness(1.6) sepia(1) saturate(7) hue-rotate(-28deg)";
    ctx.drawImage(им, x0 - разбег, y0 + сила * 2, шм, вм);
    ctx.filter = "brightness(1.6) sepia(1) saturate(7) hue-rotate(224deg)";
    ctx.drawImage(им, x0 + разбег, y0 - сила * 2, шм, вм);
  }

  /* Строчный разрыв: несколько полос уезжают вбок. Полосу берём из
     источника по тому же преобразованию, что и всю марку, иначе она
     поедет ещё и по вертикали и разрыв станет кашей. */
  ctx.filter = ОСНОВА;
  var полос = Math.round(сила * 6), i, вп, уп, сдвиг, sy, sh;
  for (i = 0; i < полос; i++) {
    вп = 2 + Math.random() * в * 0.11;
    уп = y0 + Math.random() * Math.max(1, вм - вп);
    sy = (уп - y0) / k;
    sh = вп / k;
    if (sy < 0 || sh < 1 || sy + sh > им.naturalHeight) continue;
    сдвиг = (Math.random() - 0.5) * сила * ш * 0.45;
    ctx.drawImage(им, 0, sy, им.naturalWidth, sh, x0 + сдвиг, уп, шм, вп);
  }

  /* Развёртка и белый разрыв - это уже помеха самой трубки, а не
     свет проекции, поэтому кладём их обычным способом, поверх. */
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(0,0,0,.34)";
  var y;
  for (y = 0; y < в; y += 3) ctx.fillRect(0, y, ш, 1);
  if (сила > 0.5) {
    ctx.fillStyle = "rgba(207,233,245," + (0.3 * сила).toFixed(3) + ")";
    ctx.fillRect(0, Math.random() * в, ш, 1 + Math.random() * 2);
  }
}

function помеха(старая, новая) {
  var м = марка();
  if (!м || !g.requestAnimationFrame) return false;
  var к = м.querySelector(".rc-vpn-mark-fx");
  if (!к || !к.getContext) return false;
  var им1 = логоImg[старая], им2 = логоImg[новая];
  if (!готова(им1) || !готова(им2)) return false;
  var ш = к.clientWidth, в = к.clientHeight;
  if (!ш || !в) return false;
  var ctx = null;
  try { ctx = к.getContext("2d"); } catch (e) {}
  if (!ctx) return false;

  /* Плотность точек берём у экрана, но не выше двойной: на телефоне
     с тройной плотностью холст в сорок точек стал бы полем в сто
     двадцать, а сбой длится полсекунды - разницы не увидит никто. */
  var плотность = Math.min(2, g.devicePixelRatio || 1);
  к.width = Math.round(ш * плотность);
  к.height = Math.round(в * плотность);

  var тихо = спокойно();
  /* При просьбе убрать движение сбой не отменяем совсем: без него
     смена марки становится непонятной подменой картинки. Делаем его
     короче и слабее - то же решение, что уже принято в rc-vpn.css. */
  var длит = тихо ? 320 : ПОМЕХА_МС;
  var потолок = тихо ? 0.45 : 1;
  var мой = ++фхНомер;
  var старт = 0;
  м.classList.add("rc-vpn-fx");

  function шаг(t) {
    if (мой !== фхНомер) return;
    if (!старт) старт = t;
    var доля = (t - старт) / длит;
    if (доля >= 1) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, к.width, к.height);
      м.classList.remove("rc-vpn-fx");
      return;
    }
    /* Сила растёт до середины и падает к концу: сигнал сорвался,
       дошёл до полного развала и собрался обратно. */
    var сила = доля < 0.5 ? (0.3 + доля * 1.4) : Math.max(0, (1 - доля) * 2);
    ctx.setTransform(плотность, 0, 0, плотность, 0, 0);
    /* Источник меняется чуть раньше середины: к пику развала на
       холсте уже новая марка, и она из этого пика и выходит. */
    кадрПомехи(ctx, ш, в, доля < 0.46 ? им1 : им2, Math.min(потолок, сила));
    g.requestAnimationFrame(шаг);
  }
  g.requestAnimationFrame(шаг);
  return true;
}

/* ── Куда ведёт выход ────────────────────────────────────────
   При марке CDN мы уже на своём сайте, поэтому выходом считается
   закрытие космоса: уводить человека по внешнему адресу туда, где он
   и так стоит, значит терять его прокрутку и состояние страницы.
   При марке VPN выход это переход на другой сайт. */
function адресВыхода() { return mode === "vpn" ? ПЕРЕДАЧА_VPN : САЙТ_CDN; }

function уйтиНаСайт(source) {
  track((source || "exit") + "-" + mode);
  if (mode === "vpn") {
    /* Тот же прокол, что и на причале стыковочного узла. Уход на сайт
       VPN у нас один, откуда бы его ни позвали: с причала, с кнопки
       выхода или с крестика полёта. */
    var уехать = function () { try { g.location.href = ПЕРЕДАЧА_VPN; } catch (e) {} };
    var пошёл = false;
    try {
      if (g.RC_PROKOL && g.RC_PROKOL["открыть"]) пошёл = g.RC_PROKOL["открыть"](уехать);
    } catch (eП) {}
    if (!пошёл) уехать();
    return;
  }
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
  /* Холст сбоя стоит в разметке всегда, а не заводится на щелчок:
     завести его в момент нажатия значит потерять первый кадр помехи
     на раскладку и подъём контекста. В покое он пуст и прозрачен. */
  var холст = doc.createElement("canvas");
  холст.className = "rc-vpn-mark-fx";
  холст.setAttribute("aria-hidden", "true");
  м.appendChild(холст);
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
    /* Выход больше не решает за человека. Раньше куда он уйдёт,
       определяла голограмма в кабине, и человек узнавал об этом уже на
       той стороне. Теперь щелчок открывает стыковочный узел с двумя
       причалами, и выбирает он сам. Голограмма при этом остаётся: она
       говорит, какой причал загорится первым.

       Если узел почему-то не собрался (файл не доехал, разметки нет),
       работает прежний путь: уходим по марке. Выход это последний
       орган управления, отказать он не имеет права. */
    e.preventDefault();
    var открылся = false;
    try {
      if (g.RC_DOCK && g.RC_DOCK.открыть) открылся = g.RC_DOCK.открыть();
    } catch (eУ) { открылся = false; }
    if (!открылся) уйтиНаСайт("exit");
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
  var прежний = mode;
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

  /* Помеху поднимаем ПОСЛЕ перерисовки: к этому кадру в разметке уже
     стоит новая марка, и если холст не поднимется, человек увидит её,
     а не застывшую старую. Отказ холста - не беда: подпись, шум и
     марка в меню продолжают дёргаться на прежних правилах CSS. */
  if (!помеха(прежний, next) && м) {
    /* Прогон мог остаться незакрытым, если холст отказал на середине
       предыдущего. Номер поднимаем, чтобы старый цикл кадров ушёл,
       и снимаем класс - иначе картинка останется погашенной. */
    фхНомер++;
    м.classList.remove("rc-vpn-fx");
  }
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
  /* Обе марки просим у сети сразу: холст помехи умеет рисовать только
     уже разобранную картинку, а первый щелчок по голограмме может
     случиться в ту же секунду, что и вход в космос. */
  готовьЛого();
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
