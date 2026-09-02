/* RocketCDN · логика сайта.
   Темы, язык, рендер блоков, глобус, поиск по сети, формы, аналитика. */
(function () {
"use strict";

/* Высоту документа берём из общего кэша: прямой вопрос заставляет
   браузер досчитать вёрстку, а спрашиваем мы её в каждом кадре. */
var DOCH = (window.RC_BOX && window.RC_BOX.docH) || function () {
  return document.documentElement.scrollHeight || 1;
};

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var API = "api.php";
var LK  = "https://lk.rocketcdn.ru";

/* Мерки блоков - через общий кэш. Прямой вопрос браузеру о месте
   блока заставляет его досчитать вёрстку немедленно, а спрашиваем мы
   по списку секций в каждом кадре прокрутки. */
var BOX = (window.RC_BOX && window.RC_BOX.box) || function (el) { return el.getBoundingClientRect(); };

/* ═══ Иконки ═════════════════════════════════════════════
   Сам набор лежит в assets/rc-ico.js: его же читает админка,
   чтобы владелец выбирал иконку карточки из настоящих, а не
   вписывал имя вслепую. Набор не доехал - рисуем пустой контур,
   карточка остаётся на месте. */
var ICO = window.RC_ICONS || {};
function svg(name, cls) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round"' + (cls ? ' class="' + cls + '"' : '') + '>' +
    (ICO[name] || "") + "</svg>";
}
window.RC_ICO = svg;

/* ═══ Состояние ══════════════════════════════════════════ */
/* Хранилище отбирают: приватный режим, жёсткая блокировка cookie,
   webview без storage, переполненная квота. Без обёртки первая же
   брошенная ошибка роняет весь модуль - а он строит контент всех
   разделов, поэтому страница остаётся пустой. Помним выбор в
   памяти вкладки, если диск недоступен. */
var MEM = {};
function lsGet(k) {
  try { var v = localStorage.getItem(k); return v == null ? MEM[k] : v; }
  catch (e) { return MEM[k]; }
}
function lsSet(k, v) {
  MEM[k] = v;
  try { localStorage.setItem(k, v); } catch (e) {}
}

var state = {
  lang:  lsGet("rc_lang") || "ru",
  theme: lsGet("rc_theme") || "dark",
  region: null,
  query: "",
  content: null
};
/* Ключ в адресе сильнее запомненного выбора: по нему поисковик и
   любой, кто прислал ссылку, попадают сразу на нужный язык. На него
   же ссылаются hreflang-альтернативы в шапке документа. */
try {
  var qLang = (location.search.match(/[?&]lang=(ru|en)\b/i) || [])[1];
  if (qLang) state.lang = qLang.toLowerCase();
} catch (e) {}
if (state.lang !== "en") state.lang = "ru";

/* Перевод по ключу. Служебный ключ на экран не выходит никогда.
   Порядок поиска: правка из админки, словарь текущего языка,
   русский словарь, запасной текст из разметки. Не нашлось ничего -
   пустая строка.

   Раньше на последней ступени возвращался сам ключ, и при потерянном
   по дороге словаре человек видел в шапке «ui.sound» вместо слова
   «Звук». Потом ключ заменили на null - стало не лучше: null уходил
   в setAttribute и оседал в aria-label строкой «null». */
/* Число точек присутствия живёт в одном месте - реестре сети. В
   текстах оно пишется как {nodes} и подставляется здесь, иначе после
   каждого нового узла пришлось бы править девять файлов. */
function nodesCount() {
  return (window.RC_GEO && window.RC_GEO.COUNT) || 218;
}
function subst(v) {
  return typeof v === "string" && v.indexOf("{nodes}") >= 0
    ? v.split("{nodes}").join(nodesCount())
    : v;
}

function t(k, fallback) {
  var all = window.RC_I18N || {};
  var d = all[state.lang] || {};
  if (state.content && state.content.i18n && state.content.i18n[state.lang] && state.content.i18n[state.lang][k]) {
    return subst(state.content.i18n[state.lang][k]);
  }
  if (d[k] != null) return subst(d[k]);
  if (all.ru && all.ru[k] != null) return subst(all.ru[k]);
  return fallback != null ? subst(fallback) : "";
}

/* Наборы карточек. Раньше здесь падало с ошибкой, если словарь не
   доехал: к window.RC_BLOCKS обращались напрямую. Падение рвало
   applyLang посередине, и вместе со словарём с экрана пропадали
   продукты, преимущества, сценарии, вопросы и список узлов. */
function blocks() {
  if (state.content && state.content.blocks && state.content.blocks[state.lang]) return state.content.blocks[state.lang];
  var B = window.RC_BLOCKS;
  if (!B) return null;
  return B[state.lang] || B.ru || null;
}

/* ═══ Аналитика ══════════════════════════════════════════ */
/* ── Сайт и игра считаются ОТДЕЛЬНО ────────────────────────
   Панель теперь общая на два сайта и игру между ними, и смешивать их
   в один счёт нельзя. Сайт это чтение страницы: разделы, формы,
   источники. Игра это полёт: тела, клавиши, прыжки, выход через
   стыковочный узел. Один и тот же человек за одно посещение бывает и
   там, и там, а вопросы к этим числам разные: у сайта спрашивают
   конверсию, у игры удержание.

   Хранилище одно, разрез по сайту едет в адресе запроса. Отправщик
   тоже один, только собирается дважды - иначе очередь и метка сессии
   были бы общими, и события игры уезжали бы в счёт сайта. */
function сборщик(сайт) {
  /* Тот же случай, что и с localStorage: недоступное хранилище
     не должно уносить с собой аналитику и весь модуль следом */
  /* Метка сессии ОБЩАЯ у сайта и игры: это один человек за один
     заход, и считать его дважды значит вдвое завысить уникальных. */
  var sid = "";
  try { sid = sessionStorage.getItem("rc_sid") || ""; } catch (e) {}
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { sessionStorage.setItem("rc_sid", sid); } catch (e2) {}
  }
  var адрес = API + "?action=track" + (сайт ? "&site=" + сайт : "");
  var queue = [], timer = null, sent = {};
  function flush() {
    if (!queue.length) return;
    var body = JSON.stringify({ sid: sid, ref: document.referrer, events: queue.splice(0, queue.length) });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(адрес, new Blob([body], { type: "application/json" }));
    } else {
      fetch(адрес, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
    }
  }
  function push(type, label, once) {
    if (once) { if (sent[type + label]) return; sent[type + label] = 1; }
    queue.push({ t: type, l: label || "", ts: Date.now() });
    clearTimeout(timer); timer = setTimeout(flush, 900);
  }
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); });
  return push;
}
var track = сборщик("");
window.RC_track = track;
/* Счётчик игры. Тот же ход, своя очередь, свой разрез в хранилище. */
window.RC_track_игра = сборщик("game");

/* Ловим ошибки фронта и складываем в тот же поток */
window.addEventListener("error", function (e) {
  track("jserr", ((e.message || "error") + " @ " + (e.filename || "").split("/").pop() + ":" + (e.lineno || 0)).slice(0, 180), true);
});

/* ═══ Тема и язык ════════════════════════════════════════ */
function applyTheme(v, silent) {
  state.theme = v;
  document.documentElement.setAttribute("data-theme", v);
  lsSet("rc_theme", v);
  var m = $('meta[name="theme-color"]');
  if (m) m.setAttribute("content", v === "light" ? "#F3F7FB" : "#050C15");
  /* Фирменная пилюля: кругляш едет к выбранной половине */
  $$(".pill.theme").forEach(function (p) {
    p.classList.toggle("at-2", v === "dark");
  });
  $$(".js-theme").forEach(function (b) {
    var on = b.dataset.theme === v;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  if (window.__globes) window.__globes.forEach(function (g) { g.setTheme(v); });
  if (window.__space) window.__space.setTheme(v);
  if (!silent) track("theme", v);
}

function applyLang(v, silent) {
  state.lang = v;
  /* Разметка тоже пишет число через атрибут, а не цифрами.

     Счётчик KPI прокручивается и пишет число прямо в свой узел,
     сметая вложенную метку. Поэтому обновляем и сам счётчик: без
     этого после первой прокрутки метки оставалось на одну меньше, и
     блок навсегда застывал на числе из разметки. */
  $$("[data-nodes]").forEach(function (el) { el.textContent = nodesCount(); });
  $$("[data-count]").forEach(function (el) {
    if (el._счётчикУзлов) el.textContent = nodesCount().toLocaleString(v === "en" ? "en-US" : "ru-RU");
  });
  lsSet("rc_lang", v);
  document.documentElement.lang = v;
  $$("[data-i18n]").forEach(function (el) {
    var k = el.getAttribute("data-i18n");
    /* Атрибутов может быть несколько через запятую. Раньше правился
       ровно один, и подпись для чтения с экрана оставалась русской
       поверх переведённой подсказки в поле: aria-label перебивает
       placeholder при вычислении имени, и английский посетитель
       слышал «Поиск города». Так же не переводились подсказки на
       кнопках оформления. */
    var attr = el.getAttribute("data-i18n-attr");
    var список = attr ? attr.split(",") : null;
    /* Запоминаем то, что написано в разметке: это наш запасной текст
       навсегда, даже если словарь придёт битым или устаревшим */
    if (el._i18nOrig == null) el._i18nOrig = список ? (el.getAttribute(список[0].trim()) || "") : el.textContent;
    var val = t(k, el._i18nOrig);
    if (val == null || val === "") return;
    if (список) {
      for (var аи = 0; аи < список.length; аи++) {
        var имяА = список[аи].trim();
        if (имяА) el.setAttribute(имяА, val);
      }
    } else el.textContent = val;
  });
  /* Заголовок вкладки, описание и canonical. Их не менял никто:
     английская страница висела с русским заголовком, а canonical с
     ключом языка указывал на русский адрес и тем самым отменял
     английскую версию для поисковика - она склеивалась с русской и
     выпадала из выдачи. */
  try {
    var загл = t("meta.title", "");
    if (загл) document.title = загл;
    var опис = t("meta.desc", "");
    var мОпис = document.querySelector('meta[name="description"]');
    if (опис && мОпис) мОпис.setAttribute("content", опис);
    var ог = document.querySelector('meta[property="og:title"]');
    if (загл && ог) ог.setAttribute("content", загл);
    var огО = document.querySelector('meta[property="og:description"]');
    if (опис && огО) огО.setAttribute("content", опис);
    var канон = document.querySelector('link[rel="canonical"]');
    if (канон) канон.setAttribute("href", v === "en" ? "https://rocketcdn.ru/?lang=en" : "https://rocketcdn.ru/");
    var огЛок = document.querySelector('meta[property="og:locale"]');
    if (огЛок) огЛок.setAttribute("content", v === "en" ? "en_US" : "ru_RU");
    var огАльт = document.querySelector('meta[property="og:locale:alternate"]');
    if (огАльт) огАльт.setAttribute("content", v === "en" ? "ru_RU" : "en_US");
    var огУрл = document.querySelector('meta[property="og:url"]');
    if (огУрл) огУрл.setAttribute("content", v === "en" ? "https://rocketcdn.ru/?lang=en" : "https://rocketcdn.ru/");
  } catch (eМета) {}
  $$(".lang button").forEach(function (b) {
    var on = b.dataset.lang === v;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
  $$(".pill.lang").forEach(function (p) { p.classList.toggle("at-2", v === "en"); });
  /* Перерисовываем блоки только тогда, когда есть чем. Нет словаря -
     на экране остаётся то, что написано в разметке, и мы ждём
     словарь, а не выкладываем ряд пустых карточек. */
  if (blocks()) {
    try { renderBlocks(); } catch (e) {}
    try { renderNodes(); } catch (e) {}
  }
  /* Событие уходит в любом случае: на него подписаны счётчики,
     виджеты, стойка и лента - они от словаря не зависят */
  document.dispatchEvent(new CustomEvent("rc:lang", { detail: { lang: v, t: t, blocks: blocks } }));
  if (!silent) track("lang", v);
}

/* Словарь мог опоздать: во встроенном браузере Телеграма файлы
   приезжают не в том порядке, в каком стоят в разметке, и rc-i18n.js
   иногда встаёт после rc-app.js. Как только он доедет - раскладываем
   язык заново, уже со словарём. */
document.addEventListener("rc:i18n", function () { applyLang(state.lang, true); });

/* ═══ Рендер повторяющихся блоков ════════════════════════ */
function renderBlocks() {
  var B = blocks();

  var p = $("#gridProducts");
  if (p) p.innerHTML = B.products.map(function (x, i) {
    return '<article class="card prod-card rv rv-d' + (i % 6 + 1) + '">' +
      '<div class="card-ico">' + svg(x.icon) + "</div>" +
      "<h3>" + esc(x.h) + "</h3><p>" + esc(x.p) + "</p>" +
      "<ul>" + (x.li || []).map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul>" +
      "</article>";
  }).join("");

  /* Список направлений в форме заявки собираем из того же массива
     продуктов, что и карточки.

     В разметке у него стояли ключи перевода prod.1h ... prod.7h,
     которых в словаре нет ни в русском, ни в английском: по-русски
     текст оставался из разметки и всё выглядело нормально, а
     по-английски список оставался русским. Замер поймал у
     англоязычного посетителя «Безопасность» и «Виртуальный диктор» в
     выпадающем списке.

     Наполняем из одного источника - тогда список не сможет разойтись
     с карточками ни по языку, ни по составу. Выбранное значение
     держим по НОМЕРУ, а не по тексту: при смене языка текст меняется,
     а выбор человека обязан остаться. */
  var т = $("#lfTopic");
  if (т && B.products && B.products.length) {
    var былНомер = т.selectedIndex > 0 ? т.selectedIndex : 0;
    т.innerHTML = B.products.map(function (x) {
      return "<option>" + esc(x.h) + "</option>";
    }).join("");
    т.selectedIndex = Math.min(былНомер, т.options.length - 1);
  }

  var a = $("#gridAdv");
  if (a) a.innerHTML = B.advantages.map(function (x, i) {
    return '<article class="card rv rv-d' + (i % 6 + 1) + '">' +
      '<div class="card-ico">' + svg(x.icon) + "</div>" +
      "<h3>" + esc(x.h) + "</h3><p>" + esc(x.p) + "</p></article>";
  }).join("");

  var c = $("#gridCases");
  if (c) c.innerHTML = B.cases.map(function (x, i) {
    return '<article class="card case rv rv-d' + (i % 6 + 1) + '">' +
      '<span class="num">' + (i + 1) + "</span>" +
      "<h3>" + esc(x.h) + "</h3><p>" + esc(x.p) + "</p></article>";
  }).join("");

  var f = $("#faqList");
  if (f) {
    f.innerHTML = B.faq.map(function (x, i) {
      /* Свёрнутый ответ прячется высотой, но для чтения с экрана
         остаётся на месте: связываем кнопку с ответом и убираем
         скрытый текст из дерева доступности через inert. */
      return '<div class="faq-i"><button class="faq-q" aria-expanded="false" ' +
        'aria-controls="faqA' + i + '" id="faqQ' + i + '" data-faq="' + i + '">' +
        "<span>" + esc(x.q) + "</span><i></i></button>" +
        '<div class="faq-a" id="faqA' + i + '" role="region" aria-labelledby="faqQ' + i +
        '" inert><p>' + esc(x.a) + "</p></div></div>";
    }).join("");
    $$(".faq-q", f).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.parentNode, open = item.classList.contains("on");
        $$(".faq-i", f).forEach(function (it) {
          it.classList.remove("on");
          var box = $(".faq-a", it);
          box.style.maxHeight = "";
          box.setAttribute("inert", "");
          $(".faq-q", it).setAttribute("aria-expanded", "false");
        });
        if (!open) {
          item.classList.add("on");
          var a = $(".faq-a", item);
          a.style.maxHeight = a.scrollHeight + "px";
          a.removeAttribute("inert");
          btn.setAttribute("aria-expanded", "true");
          track("faq", B.faq[btn.dataset.faq].q.slice(0, 60));
        }
      });
    });
  }
  observeReveal();
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

/* ═══ Сеть присутствия ═══════════════════════════════════ */
var GEO = window.RC_GEO, globe = null;

/* Метки узла берём из реестра: подписи на обоих языках лежат в RC_GEO.FLAGS,
   здесь остаётся только обернуть их в разметку. */
function nodeTags(n) {
  return GEO.tags(n).map(function (f) {
    return '<span class="tag tag-' + f.key + '">' + esc(f[state.lang] || f.ru) + "</span>";
  }).join("");
}

/* Поиск отдаём реестру: он один знает и русское, и английское название узла,
   иначе на английском запрос «Prague» не находил бы Прагу. */
function filteredNodes() {
  return GEO.NODES.map(function (n, i) { return [n, i]; }).filter(function (pair) {
    var n = pair[0];
    if (state.region != null && n[3] !== state.region) return false;
    return GEO.match(n, state.query);
  });
}

/* Сколько строк реестра показываем сразу. Больше не нужно: список
   перестал быть окном с внутренней прокруткой (см. ниже), а листать
   двести восемнадцать строк подряд человеку незачем - для поиска
   есть поиск. */
var NODES_HEAD = 8;
var nodesAll = false;

function renderNodes() {
  var list = $("#nodeList");
  if (!list) return;
  var rows = filteredNodes();
  var cnt = $("#nodeCount");
  if (cnt) cnt.textContent = rows.length;
  /* Реестр больше не крадёт прокрутку страницы. Раньше он был окном
     с собственной полосой прокрутки на треть экрана, и колесо (а на
     телефоне - палец) над этой зоной листало города вместо сайта:
     человек застревал посреди фильма и не понимал, почему страница
     не едет. Теперь список показывает первые строки целиком, а
     остальные разворачиваются по кнопке. */
  var full = nodesAll || !!state.query || state.region != null;
  var shown = full ? rows : rows.slice(0, NODES_HEAD);
  var hidden = rows.length - shown.length;
  if (!rows.length) {
    list.innerHTML = '<div class="node-empty">' + esc(t("infra.none", "Ничего не найдено")) + "</div>";
    return;
  }
  list.innerHTML = shown.map(function (pair) {
    var n = pair[0], reg = GEO.REGIONS[n[3]];
    /* Табом в список входим один раз: двести восемнадцать строк
       подряд - непроходимая стена, до заявки и подвала клавиатурой
       было не добраться. Внутри списка ходим стрелками. */
    return '<div class="node-row" data-idx="' + pair[1] + '" role="button" tabindex="' +
      (pair === shown[0] ? "0" : "-1") + '">' +
      '<span class="nm">' + esc(GEO.name(n, state.lang)) + "</span>" + nodeTags(n) +
      '<span class="rg">' + esc(reg[state.lang] || reg.ru) + "</span></div>";
  }).join("") +
  (hidden > 0
    ? '<button type="button" class="node-more">' +
      esc(t("infra.more", "Показать все")) + " " + rows.length + "</button>"
    : "");

  var more = list.querySelector(".node-more");
  if (more) {
    more.addEventListener("click", function () {
      nodesAll = true;
      renderNodes();
      track("nodes", "expand");
    });
  }

  $$(".node-row", list).forEach(function (row) {
    function go() {
      var n = GEO.NODES[+row.dataset.idx];
      if (globe) { globe.focusOn(n[1], n[2]); globe.hover = +row.dataset.idx; }
      track("node", n[0]);
    }
    row.addEventListener("click", go);
    row.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); return; }

      /* Стрелки водят по списку, Home и End - к краям. Место входа
         переезжает вместе с фокусом, поэтому вернувшись табом,
         человек попадает туда, где остановился. */
      var step = 0;
      if (e.key === "ArrowDown") step = 1;
      else if (e.key === "ArrowUp") step = -1;
      else if (e.key !== "Home" && e.key !== "End") return;

      var all = $$(".node-row", list);
      var at = all.indexOf(row);
      var to = e.key === "Home" ? 0
             : e.key === "End" ? all.length - 1
             : at + step;
      if (to < 0 || to >= all.length) return;
      e.preventDefault();
      all.forEach(function (x) { x.tabIndex = -1; });
      all[to].tabIndex = 0;
      all[to].focus();
    });

    /* Список узлов - это бортовой реестр, а не таблица на фоне:
       строка под курсором обязана зажигать свою точку на шаре.
       Так текст и объёмная сцена перестают быть двумя разными
       вещами - наводишь строку, отвечает мир. Глобус не крутим:
       поворот по наведению сбивал бы чтение списка, разворот
       остаётся за кликом. */
    function lite(on) {
      if (!globe) return;
      globe.hover = on ? +row.dataset.idx : -1;
      if (globe.drawLabel) { try { globe.drawLabel(); } catch (e) {} }
    }
    row.addEventListener("mouseenter", function () { lite(true); });
    row.addEventListener("mouseleave", function () { lite(false); });
    row.addEventListener("focus", function () { lite(true); });
    row.addEventListener("blur", function () { lite(false); });
  });
}

/* Космос на фоне: заводим рано, он лёгкий и задаёт настроение */
function initSpace() {
  var cv = document.getElementById("spaceBg");
  if (!cv || !window.RCSpace) return;
  var s = window.RCSpace.create(cv);
  if (!s) { cv.style.display = "none"; return; }
  requestAnimationFrame(function () { cv.classList.add("on"); });
  window.__space = s;
}

function initGlobes() {
  if (!window.RCGlobe || !GEO) return;
  var land = GEO.landPoints();
  /* Список общий с rc-scroll: создаёт тот, кто пришёл первым */
  window.__globes = window.__globes || [];

  var heroCv = $("#globeHero");
  if (heroCv) {
    var gh = new RCGlobe(heroCv, { nodes: GEO.NODES, land: land, dc: GEO.DC, theme: state.theme, radius: 0.4, speed: 2.6 });
    window.__globes.push(gh);
  }
  var mapCv = $("#globeMap");
  /* Глобус в разделе сети ждёт объёмный слой: он далеко внизу, время есть.
     Не дождались за шесть секунд - показываем плоский, лишь бы не пусто. */
  if (mapCv && window.RC_GL && window.RC_GL.want3d && !window.RCGlobe3D) {
    var made2 = false;
    var build = function () {
      if (made2) return;
      made2 = true;
      buildMapGlobe(mapCv);
    };
    addEventListener("rc:3d", build);
    addEventListener("rc:no3d", build);
    setTimeout(build, 6000);
    return;
  }
  if (mapCv) buildMapGlobe(mapCv);
}

function buildMapGlobe(mapCv) {
  var land = GEO.landPoints();
  {
    /* Главный глобус - настоящий 3D, если браузер тянет WebGL.
       Плоская версия остаётся запасным вариантом. */
    var opts = {
      nodes: GEO.NODES, land: land, dc: GEO.DC, theme: state.theme, radius: 0.44, speed: 3.4,
      onPick: function (i) { if (i >= 0) track("node", GEO.NODES[i][0]); }
    };
    var made = null;
    /* На совсем слабых устройствах два контекста WebGL сразу (ракета и
       глобус) не тянутся, поэтому там остаётся плоская версия. */
    var weak = (navigator.deviceMemory || 4) <= 2 || (navigator.hardwareConcurrency || 4) <= 2;
    var room = !window.RC_GL || window.RC_GL.take();
    /* Объёмный глобус - украшение раздела, а не сценарий. Если
       кораблю или рубке не хватило контекста, отдаём свой и молча
       возвращаемся к плоской карте: её человек и не отличит, а
       фильм без корабля разваливается. */
    addEventListener("rc:gl-free", function () {
      if (!made || !window.RC_GL) return;
      try { made.stop(); } catch (e) {}
      /* Холст меняем на новый, а не переиспользуем. Once a canvas
         has handed out a WebGL context, двумерный на нём получить
         уже нельзя: getContext вернёт null, и плоский глобус падал
         на первом же обращении к рисовалке. Поэтому кладём на место
         старого холста его свежую копию. */
      var fresh = document.createElement("canvas");
      fresh.id = mapCv.id;
      fresh.className = mapCv.className;
      fresh.setAttribute("aria-hidden", mapCv.getAttribute("aria-hidden") || "true");
      if (mapCv.parentNode) mapCv.parentNode.replaceChild(fresh, mapCv);
      mapCv = fresh;
      var back = null;
      try { back = new RCGlobe(mapCv, opts); } catch (e2) { back = null; }
      var i = window.__globes.indexOf(made);
      if (back) {
        if (i >= 0) window.__globes[i] = back;
        globe = back;
        back.start();
      } else if (i >= 0) {
        window.__globes.splice(i, 1);
      }
      made = null;
      window.RC_GL.give();
    });
    if (window.RCGlobe3D && window.THREE && !weak && room) {
      try { made = new window.RCGlobe3D(mapCv, opts); } catch (e) { made = null; }
      if (!made && window.RC_GL) window.RC_GL.give();
      else if (made && window.RC_GL) {
        /* Отобрали контекст - молча возвращаемся на плоский глобус */
        window.RC_GL.guard(mapCv, function () {
          try { made.stop(); } catch (e) {}
          /* Тот же случай, что и при добровольной уступке слота:
             старый холст двумерный контекст уже не отдаст */
          var swap = document.createElement("canvas");
          swap.id = mapCv.id;
          swap.className = mapCv.className;
          if (mapCv.parentNode) mapCv.parentNode.replaceChild(swap, mapCv);
          mapCv = swap;
          var back = new RCGlobe(mapCv, opts);
          var i = window.__globes.indexOf(made);
          if (i >= 0) window.__globes[i] = back;
          globe = back;
          back.start();
          mapCv.style.opacity = "";
        });
      }
    } else if (room && window.RC_GL) { window.RC_GL.give(); }
    globe = made || new RCGlobe(mapCv, opts);
    window.__globes.push(globe);
  }
  initRack();
}

/* ═══ Стойка дата-центра в объёме ════════════════════════ */
var rack = null;
function rackLabels() {
  var out = [];
  for (var i = 1; i <= 8; i++) out.push(t("what.r" + i, "Узел " + i));
  return out;
}
function initRack() {
  var cv = $("#rackCv");
  if (!cv || rack) return;
  /* Ракета уже держит один контекст WebGL, третий берём только там,
     где машина это тянет */
  var weak = (navigator.deviceMemory || 4) <= 2 || (navigator.hardwareConcurrency || 4) <= 2;
  if (!window.RCRack || !window.THREE || weak) {
    var box = cv.parentElement;
    if (box) box.remove();
    return;
  }
  rack = window.RCRack.create(cv, { labels: rackLabels() });
  if (!rack) { if (cv.parentElement) cv.parentElement.remove(); return; }
  rack.start();
  window.__rack = rack;
  /* Слушаем на document: событие rc:lang рассылается именно там и не всплывает
     до window, поэтому подписка на window молча не срабатывала. */
  document.addEventListener("rc:lang", function () { rack.setLabels(rackLabels()); });
}

/* ═══ Появление блоков и счётчики ════════════════════════ */
var io = null;
function observeReveal() {
  if (!("IntersectionObserver" in window)) { $$(".rv").forEach(function (e) { e.classList.add("on"); }); return; }
  if (!io) {
    io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); }
      });
      /* Запас по краям и низкий порог: разделы теперь живут в общей
         3D-сцене (rc-world) и приходят в кадр под наклоном, слегка
         из глубины. С прежним порогом в 12% блок успевал доехать до
         середины экрана невидимым, а на широком мониторе оставался
         пустым вовсе. */
    }, { threshold: 0.04, rootMargin: "14% 0px 6% 0px" });
  }
  $$(".rv:not(.on)").forEach(function (e) { io.observe(e); });
  guardReveal();
}

/* Сторож появления. Наблюдатель за видимостью на занятом устройстве
   голодает: приёмка ловила разделы, которые оставались прозрачными
   и через двенадцать секунд после того, как встали в кадр. Пустой
   раздел вместо текста - худший исход, поэтому раз в семьсот
   миллисекунд проверяем сами и показываем то, что уже видно.
   Сторож замолкает, как только показывать больше нечего. */
var revealT = 0;
function guardReveal() {
  if (revealT) return;
  revealT = setInterval(function () {
    var rest = $$(".rv:not(.on)");
    if (!rest.length) { clearInterval(revealT); revealT = 0; return; }
    if (document.hidden) return;
    var h = innerHeight;
    rest.forEach(function (e) {
      var b = BOX(e);
      if (b.bottom > -40 && b.top < h + 40 && b.width > 0) {
        e.classList.add("on");
        if (io) io.unobserve(e);
      }
    });
  }, 700);
}

function countUp(el) {
  /* Счётчик узлов держит число в реестре, а не в разметке. В
     data-count стояло 218 цифрами, и после добавления города в панели
     чип героя показывал новое число, а блок «Узлов CDN по всему миру»
     - старое, навсегда, до правки разметки руками. Реестр - один
     источник, разметка только запасной вариант. */
  if (el._счётчикУзлов || (el.querySelector && el.querySelector("[data-nodes]"))) {
    el._счётчикУзлов = true;
    el.dataset.count = String(nodesCount());
  }
  var raw = el.dataset.count, target = parseFloat(raw);
  if (isNaN(target)) return;
  var dur = 1400, t0 = performance.now(), dec = (raw.split(".")[1] || "").length;
  function step(now) {
    var k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    var v = target * e;
    el.textContent = (dec ? v.toFixed(dec) : Math.round(v).toLocaleString(state.lang === "en" ? "en-US" : "ru-RU")) + (el.dataset.suffix || "");
    if (k < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ═══ Формы ══════════════════════════════════════════════ */
/* Подпись ошибки связываем с полем: без aria-describedby чтение с
   экрана видит красную рамку, но не знает, что именно не так, а
   без aria-invalid не понимает даже, что поле забраковано. */
var errSeq = 0;
function bindErr(field, wrap, bad) {
  var msg = wrap && wrap.querySelector ? wrap.querySelector(".err") : null;
  if (bad) {
    field.setAttribute("aria-invalid", "true");
    if (msg) {
      if (!msg.id) msg.id = "rcerr" + (++errSeq);
      field.setAttribute("aria-describedby", msg.id);
    }
  } else {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  }
}

function validate(form) {
  var ok = true, first = null;
  $$("[required]", form).forEach(function (f) {
    var wrap = f.closest(".field") || f.closest(".consent") || f.parentNode, val = (f.value || "").trim(), bad = false;
    if (f.type === "checkbox") bad = !f.checked;
    else if (!val) bad = true;
    else if (f.dataset.kind === "contact") bad = !(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(val) || (val.replace(/\D/g, "").length >= 10));
    else if (f.dataset.kind === "phone") bad = val.replace(/\D/g, "").length < 10;
    if (wrap.classList) wrap.classList.toggle("bad", bad);
    bindErr(f, wrap, bad);
    if (bad) { ok = false; if (!first) first = f; }
  });
  /* Курсор сам встаёт в первое незаполненное поле: на телефоне
     ошибка может оказаться выше кадра, и человек видит только то,
     что кнопка «не работает» */
  if (first && first.focus) { try { first.focus(); } catch (e) {} }
  return ok;
}

function wireForm(form, kind) {
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $(".form-msg", form), btn = $('button[type="submit"]', form);
    if (msg) msg.className = "form-msg";
    if (!validate(form)) {
      /* Молчаливый отказ - худшее, что тут может быть: человек жмёт
         кнопку, ничего не происходит, и он уходит. Говорим прямо. */
      if (msg) {
        msg.className = "form-msg bad";
        msg.textContent = t("ct.check", "Проверьте отмеченные поля.");
      }
      return;
    }

    var payload = { kind: kind, lang: state.lang, page: location.pathname + location.search };
    $$("input, textarea, select", form).forEach(function (f) {
      if (!f.name) return;
      payload[f.name] = f.type === "checkbox" ? (f.checked ? 1 : 0) : (f.value || "").trim();
    });
    /* Обращение к хранилищу обязано быть в защите. Там, где cookie и
       хранилище закрыты (браузер с полным запретом, приватные
       вебвью, встраивание в рамку), сам доступ бросает исключение -
       и обработчик отправки рвался прямо здесь, до кнопки и до
       запроса. Для человека кнопка «Отправить заявку» просто не
       работала и ничего не объясняла. */
    try { payload.sid = sessionStorage.getItem("rc_sid") || ""; }
    catch (eХр) { payload.sid = ""; }

    var label = btn ? btn.innerHTML : "";
    /* Отправка идёт: кнопка занята, в ней крутится точка. Без
       зримого признака человек жмёт повторно, и заявка уходит
       дважды - на приёмке это отдельная жалоба. */
    if (btn) {
      btn.disabled = true;
      btn.classList.add("is-sending");
      btn.innerHTML = '<i class="btn-spin" aria-hidden="true"></i>' +
        esc(t("ct.sending", "Отправляем"));
    }

    fetch(API + "?action=lead", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (btn) { btn.disabled = false; btn.classList.remove("is-sending"); btn.innerHTML = label; }
      if (r && r.ok) {
        if (msg) { msg.className = "form-msg ok"; msg.textContent = t(kind === "callback" ? "cb.ok" : "ct.ok", "Заявка принята, мы свяжемся с вами."); }
        form.reset();
        try { if (navigator.vibrate) navigator.vibrate([14, 60, 14]); } catch (e3) {}
        track("lead", kind);
        $$(".field", form).forEach(function (f) { f.classList.remove("bad"); });
      } else {
        if (msg) { msg.className = "form-msg bad"; msg.textContent = t("ct.err", "Не удалось отправить. Попробуйте ещё раз или напишите на info@rocketcdn.ru"); }
      }
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.classList.remove("is-sending"); btn.innerHTML = label; }
      if (msg) { msg.className = "form-msg bad"; msg.textContent = t("ct.err", "Не удалось отправить. Попробуйте ещё раз или напишите на info@rocketcdn.ru"); }
    });
  });

  /* Метку ошибки снимаем ровно с той обёртки, на которую её и
     повесила проверка. Раньше здесь искали только .field, а у флажка
     согласия обёртка другая (.consent): человек ставил галочку, поля
     белели, а рамка вокруг согласия и подпись под ним оставались
     красными. Событие у флажка тоже своё - change, а не input. */
  $$("input, textarea, select", form).forEach(function (f) {
    var снять = function () {
      var w = f.closest(".field") || f.closest(".consent") || f.parentNode;
      if (w && w.classList) w.classList.remove("bad");
      bindErr(f, w, false);
    };
    f.addEventListener("input", снять);
    if (f.type === "checkbox" || f.type === "radio" || f.tagName === "SELECT") {
      f.addEventListener("change", снять);
    }
  });
}

/* ═══ Контент из админки ═════════════════════════════════ */
function applyContent() {
  return fetch(API + "?action=content", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (r) {
      if (r && r.ok && r.content) { state.content = r.content; applyLang(state.lang, true); }
    })
    .catch(function () {});
}

/* ═══ Запуск ═════════════════════════════════════════════ */
function boot() {
  initSpace();
  applyTheme(state.theme, true);
  applyLang(state.lang, true);
  initGlobes();
  observeReveal();

  /* Заставкой заведует RocketLoader из шапки документа: он считает
     честный прогресс и сам уходит. Отсюда только страхуем случай,
     когда приложение поднялось, а какая-то веха не пришла. */
  if (window.RocketLoader) setTimeout(function () { window.RocketLoader.hide(); }, 1200);

  /* Переключатели */
  $$(".js-theme").forEach(function (b) {
    b.addEventListener("click", function () { applyTheme(b.dataset.theme || (state.theme === "light" ? "dark" : "light")); });
  });
  $$(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.dataset.lang); });
  });
  /* Клавиатура: стрелками ходим по половинам пилюли */
  $$(".pill").forEach(function (p) {
    p.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      var bs = [].slice.call(p.querySelectorAll("button"));
      var i = bs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      var n = bs[e.key === "ArrowLeft" ? Math.max(0, i - 1) : Math.min(bs.length - 1, i + 1)];
      n.focus(); n.click();
    });
  });

  /* Мобильное меню */
  var drawer = $("#drawer"), burger = $("#burger");
  var шторкаНазад = null;
  function setDrawer(on, кто) {
    if (!drawer) return;
    drawer.classList.toggle("on", on);
    /* Закрытое меню не должно ловить фокус и читаться скринридером */
    if ("inert" in HTMLElement.prototype) drawer.inert = !on;
    drawer.setAttribute("aria-hidden", on ? "false" : "true");
    document.body.style.overflow = on ? "hidden" : "";
    if (burger) {
      burger.innerHTML = svg(on ? "close" : "burger");
      burger.setAttribute("aria-label", t(on ? "menu.close" : "menu.open", on ? "Закрыть меню" : "Открыть меню"));
      burger.setAttribute("aria-expanded", on ? "true" : "false");
    }

    /* Шторка это непрозрачная заслонка во весь экран, значит страница
       под ней перестаёт существовать так же, как под окном заявки.
       Раньше этого не было: человек с клавиатуры проходил меню до
       конца и следующим нажатием уходил ЗА заслонку, вслепую, а
       Escape оставлял фокус на кнопке, лежащей на пять тысяч точек
       ниже окна. Делаем ровно то же, что и окно: глушим страницу,
       ставим фокус внутрь, на закрытии возвращаем на бургер. */
    if (on) {
      var актив = document.activeElement;
      шторкаНазад = (актив && актив !== document.body && актив !== document.documentElement)
        ? актив : (кто || burger || null);
    }
    $$("body > *").forEach(function (el) {
      if (el === drawer || el.tagName === "SCRIPT") return;
      if (on) {
        if (!el.hasAttribute("inert")) { el.setAttribute("inert", ""); el.setAttribute("data-rc-dinert", ""); }
        if (!el.hasAttribute("aria-hidden")) { el.setAttribute("aria-hidden", "true"); el.setAttribute("data-rc-dah", ""); }
      } else {
        if (el.hasAttribute("data-rc-dinert")) { el.removeAttribute("inert"); el.removeAttribute("data-rc-dinert"); }
        if (el.hasAttribute("data-rc-dah")) { el.removeAttribute("aria-hidden"); el.removeAttribute("data-rc-dah"); }
      }
    });
    if (on) {
      /* Фокус ставим не сразу: у шторки анимируется сама видимость, и
         в тот же тик, когда навешен класс, она ещё hidden - focus()
         на невидимом узле молча ничего не делает. Целимся, пока не
         попадём, как это сделано у окна заявки и у полёта. */
      var попыток = 0;
      (function целиться() {
        if (!drawer.classList.contains("on")) return;
        var видно = getComputedStyle(drawer).visibility !== "hidden";
        var первая = видно ? drawer.querySelector("a[href], button") : null;
        if (первая) {
          try { первая.focus({ preventScroll: true }); } catch (eФ) {}
          if (document.activeElement === первая) return;
        }
        if (++попыток < 90) requestAnimationFrame(целиться);
      })();
    } else if (шторкаНазад && шторкаНазад.focus) {
      var куда = шторкаНазад;
      шторкаНазад = null;
      try { куда.focus({ preventScroll: true }); } catch (eФ2) {}
      if (document.activeElement !== куда) requestAnimationFrame(function () {
        try { куда.focus({ preventScroll: true }); } catch (eФ3) {}
      });
    }
  }
  setDrawer(false);
  if (burger) burger.addEventListener("click", function () { setDrawer(!drawer.classList.contains("on"), burger); });
  $$("#drawer a").forEach(function (a) { a.addEventListener("click", function () { setDrawer(false); }); });
  $$(".js-drawer-close").forEach(function (b) { b.addEventListener("click", function () { setDrawer(false); }); });

  /* Шапка: тень, скрытие при скролле вниз, активный пункт */
  var hdr = $("#hdr"), prog = $("#prog"), toTop = $("#toTop"), lastY = 0, maxScroll = 0;
  /* Липкая панель с заявкой: приезжает, когда первый экран прочитан.
     Показывать её сразу нельзя - она перекрыла бы первый экран, ради
     которого человек и пришёл. Видима панель только на телефоне, это
     решает CSS; здесь мы лишь ставим класс. */
  var mcta = $("#mcta");
  var secs = $$("section[id]");
  /* Ссылки меню и высоту документа кэшируем: раньше обработчик на
     каждое событие прокрутки писал стиль, потом читал scrollHeight и
     границы шестнадцати секций, потом снова искал ссылки в DOM.
     Такое чередование записи и чтения заставляет браузер пересчитать
     вёрстку по два десятка раз за событие - на приёмке это отдельной
     строкой вышло в подтормаживание прокрутки.

     Теперь всё чтение живёт в одном кадре, высота документа
     обновляется по изменению размеров, а не покадрово. */
  var navLinks = $$(".nav a");
  /* Переход по якорю: пока он идёт, шапка стоит на месте, а когда
     прокрутка успокоилась - досылаем к цели и обновляем подсветку.

     Оба хвоста нужны из-за того, что страница меняет высоту прямо
     во время перехода: липкие ленты пересчитывают свои сцены,
     блоки выезжают. Без удержания шапка пряталась (прыжок для неё
     - обычная прокрутка вниз, а на телефоне это уносит и бургер,
     единственный вход в меню). Без досылки раздел «Вопросы»
     промахивался на полсотни пикселей и терял свой заголовок. */
  var holdHdr = 0, aimId = "", aimTimer = 0, aimY = -1, aimStill = 0;

  function keepHeader() {
    holdHdr = performance.now() + 600;
    if (hdr) hdr.classList.remove("hide");
  }

  function chase() {
    var y = Math.round(scrollY);
    /* Ждём, пока прокрутка остановится: вмешиваться в идущую
       плавную прокрутку нельзя - две сразу гасят друг друга */
    if (y !== aimY) { aimY = y; aimStill = 0; keepHeader(); return; }
    if (++aimStill < 2) { keepHeader(); return; }

    clearInterval(aimTimer);
    aimTimer = 0;
    var box = aimId && document.getElementById(aimId);
    if (box) {
      var top = box.getBoundingClientRect().top;
      var pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 88;
      if (Math.abs(top - pad) > 14) {
        try { window.scrollTo({ top: scrollY + top - pad, behavior: "smooth" }); }
        catch (e) { window.scrollTo(0, scrollY + top - pad); }
      }
    }
    /* Прыжок закончился: для шапки это не «человек листает вниз»,
       поэтому точку отсчёта переносим сюда. Иначе первый же
       пересчёт после перехода прятал шапку. */
    lastY = Math.round(scrollY);
    read();
    setTimeout(function () { lastY = Math.round(scrollY); read(); }, 500);
  }

  function goAnchor(id) {
    aimId = id || "";
    aimY = -1;
    aimStill = 0;
    keepHeader();
    if (aimTimer) clearInterval(aimTimer);
    aimTimer = setInterval(chase, 140);
    /* Страховка: сколько бы ни длилась прокрутка, через шесть
       секунд наблюдение прекращается */
    setTimeout(function () {
      if (aimTimer) { clearInterval(aimTimer); aimTimer = 0; read(); }
    }, 6000);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || a.getAttribute("href").length < 2) return;
    goAnchor(a.getAttribute("href").slice(1));
  }, true);
  addEventListener("hashchange", function () {
    goAnchor((location.hash || "").slice(1));
  });
  var docH = 0, curSec = "", schedH = 0;
  function measure() {
    docH = DOCH() - innerHeight;
  }
  measure();
  addEventListener("resize", measure, { passive: true });
  if (window.ResizeObserver) {
    try {
      new ResizeObserver(function () {
        /* Высота меняется пачками (карточки, ленты, шрифты):
           пересчитываем один раз в конце кадра */
        if (schedH) return;
        schedH = requestAnimationFrame(function () { schedH = 0; measure(); });
      }).observe(document.body);
    } catch (e) {}
  }

  var pend = 0;
  function onScroll() {
    if (pend) return;
    pend = requestAnimationFrame(read);
  }
  function read() {
    pend = 0;
    var y = window.scrollY || 0;
    var ratio = docH > 0 ? y / docH : 0;

    /* Сначала читаем всё, что нужно прочитать */
    var cur = "";
    for (var i = 0; i < secs.length; i++) {
      if (BOX(secs[i]).top <= 120) cur = secs[i].id;
    }

    /* И только потом пишем */
    if (prog) prog.style.width = (ratio * 100).toFixed(2) + "%";
    if (hdr) {
      hdr.classList.toggle("stuck", y > 8);
      /* Прыжок по якорю - формально «прокрутка вниз», и шапка от него
         пряталась. На телефоне это отрезало навигацию совсем: бургер
         уезжал за кромку, а другого входа в меню нет. Пока идёт
         переход по ссылке меню, шапку держим. */
      var jump = performance.now() < holdHdr;
      hdr.classList.toggle("hide", !jump && y > 320 && y > lastY && !drawer.classList.contains("on"));
    }
    if (toTop) toTop.classList.toggle("on", y > 700);
    if (mcta) mcta.classList.toggle("on", y > innerHeight * 0.9);
    lastY = y;

    if (cur !== curSec) {
      curSec = cur;
      for (var k = 0; k < navLinks.length; k++) {
        navLinks[k].classList.toggle("act", navLinks[k].getAttribute("href") === "#" + cur);
      }
    }

    /* Глубина прочтения - в аналитику, по четвертям */
    var d = Math.round(ratio * 100);
    if (d > maxScroll) {
      maxScroll = d;
      [25, 50, 75, 95].forEach(function (m) { if (d >= m) track("scroll", String(m), true); });
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  read();
  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* Счётчики */
  if ("IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (e) {
      e.forEach(function (x) { if (x.isIntersecting) { countUp(x.target); cio.unobserve(x.target); } });
    }, { threshold: 0.5 });
    $$("[data-count]").forEach(function (el) { cio.observe(el); });
  } else $$("[data-count]").forEach(countUp);

  /* Подсветка карточек под курсором */
  document.addEventListener("mousemove", function (e) {
    var c = e.target.closest && e.target.closest(".card");
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty("--mx", (e.clientX - r.left) + "px");
    c.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });

  /* Регионы и поиск */
  var tabs = $("#regTabs");
  if (tabs) {
    /* Пересобираем вкладки отдельной функцией: при смене языка подписи регионов
       должны переехать вместе с остальной страницей, а выбранная вкладка -
       остаться выбранной. Обработчик висит на контейнере, поэтому перерисовка
       кнопок его не рвёт. */
    function paintTabs() {
      var cur = state.region;
      tabs.innerHTML = '<button data-r="all">' + esc(t("infra.all", "Все регионы")) + "</button>" +
        GEO.REGIONS.map(function (r, i) {
          return '<button data-r="' + i + '">' + esc(r[state.lang] || r.ru) + "</button>";
        }).join("");
      $$("button", tabs).forEach(function (b) {
        var mine = b.dataset.r === "all" ? cur == null : +b.dataset.r === cur;
        b.classList.toggle("on", mine);
      });
    }
    paintTabs();
    document.addEventListener("rc:lang", paintTabs);
    tabs.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      $$("button", tabs).forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      state.region = b.dataset.r === "all" ? null : +b.dataset.r;
      if (globe) globe.filter = state.region;
      renderNodes();
      track("region", b.textContent);
    });
  }
  var si = $("#nodeSearch");
  if (si) {
    var st;
    si.addEventListener("input", function () {
      state.query = si.value;
      clearTimeout(st);
      st = setTimeout(function () {
        renderNodes();
        if (si.value.length > 2) track("search", si.value.slice(0, 40));
      }, 160);
    });
  }
  renderNodes();

  /* Формы */
  wireForm($("#leadForm"), "lead");
  wireForm($("#cbForm"), "callback");

  /* Окно обратного звонка.

     Клавиатурой оно раньше не работало: фокус оставался на странице
     под затемнением и гулял по ней сквозь окно. Здесь три вещи -
     фокус уходит на первое видимое поле (первым в разметке стоит
     ловушка для ботов с tabindex="-1", её брать нельзя), обход по
     Tab заперт внутри окна, а страница под ним помечена inert. */
  var modal = $("#cbModal");
  var modalBack = null;   /* куда вернуть фокус после закрытия */

  function focusables(box) {
    return $$('a[href], button:not([disabled]), input:not([disabled]), ' +
      'select:not([disabled]), textarea:not([disabled]), [tabindex]', box)
      .filter(function (el) {
        return el.tabIndex >= 0 && el.offsetWidth > 0 && el.offsetHeight > 0;
      });
  }

  function setModal(on, кто) {
    if (!modal) return;
    modal.classList.toggle("on", on);
    document.body.style.overflow = on ? "hidden" : "";

    /* Куда вернуть фокус, запоминаем ДО того, как страница под окном
       станет недоступной. Проставленный на предке inert сбрасывает
       фокус на body, и снятый после него activeElement всегда был
       телом документа: человек, который ходит клавиатурой, после
       закрытия окна оказывался в начале страницы и шёл табом через
       всю шапку обратно. */
    if (on) {
      /* Куда вернуть фокус. Обычно это тот элемент, что был в фокусе,
         но нажатие мышью фокус на кнопку ставят не все браузеры (в
         Safari и Firefox кнопка после клика остаётся неактивной), и
         тогда здесь оказывается тело документа - возвращать фокус
         становится некуда. Поэтому запоминаем и того, кто открыл. */
      var актив = document.activeElement;
      modalBack = (актив && актив !== document.body && актив !== document.documentElement)
        ? актив : (кто || null);
    }

    /* Страница под окном перестаёт существовать для клавиатуры и
       для чтения с экрана - так же, как это сделано у шторки меню */
    $$("body > *").forEach(function (el) {
      if (el === modal || el.tagName === "SCRIPT") return;
      if (on) {
        /* Помечаем только то, что закрыли мы. Слои-канвасы и закрытая
           шторка несут inert и aria-hidden прямо в разметке, и слепое
           снятие на закрытии окна возвращало их в поле зрения чтения
           с экрана - «фоновое небо» становилось содержимым. */
        if (!el.hasAttribute("inert")) { el.setAttribute("inert", ""); el.setAttribute("data-rc-inert", ""); }
        if (!el.hasAttribute("aria-hidden")) { el.setAttribute("aria-hidden", "true"); el.setAttribute("data-rc-ah", ""); }
      } else {
        if (el.hasAttribute("data-rc-inert")) { el.removeAttribute("inert"); el.removeAttribute("data-rc-inert"); }
        if (el.hasAttribute("data-rc-ah")) { el.removeAttribute("aria-hidden"); el.removeAttribute("data-rc-ah"); }
      }
    });

    if (on) {
      track("open", "callback");
      /* Фокус ставим не по таймеру, а когда окно действительно
         проявилось: пока идёт переход, оно ещё visibility:hidden, и
         focus() молча ничего не делает. На занятой странице кадры
         редкие, поэтому фиксированная задержка не спасала - раньше
         фокус так и оставался снаружи. */
      var tries = 0;
      (function aim() {
        if (!modal.classList.contains("on")) return;
        var vis = getComputedStyle(modal).visibility !== "hidden";
        var f = vis ? focusables(modal) : [];
        if (f.length) {
          /* Целимся в первое поле ввода, а не в крестик: человек
             открыл окно, чтобы оставить номер, - курсор должен уже
             стоять там, где он будет писать */
          var field = null;
          for (var k = 0; k < f.length; k++) {
            var tag = f[k].tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") { field = f[k]; break; }
          }
          (field || f[0]).focus();
          return;
        }
        if (++tries < 120) requestAnimationFrame(aim);
      })();
    } else if (modalBack && modalBack.focus) {
      var куда = modalBack;
      var вернуть = function () {
        try { куда.focus(); } catch (e) {}
        /* Кнопка могла быть ещё глухой: страницу глушат и окно, и
           сцена полёта, и снимают они это в разном порядке. Второй
           заход следующим кадром попадает уже наверняка. */
        if (document.activeElement !== куда) requestAnimationFrame(function () {
          try { куда.focus(); } catch (e2) {}
        });
      };
      вернуть();
      /* Под окном может стоять сцена полёта: она глушит страницу
         целиком, и вернуть фокус на кнопку под ней нельзя. Тогда
         отдаём его самой сцене, а не оставляем в начале документа. */
      if (document.activeElement === document.body) {
        var сцена = document.querySelector(".rc-flight.on");
        if (сцена && сцена.focus) { try { сцена.focus(); } catch (e2) {} }
      }
      modalBack = null;
    }
  }

  /* Замок обхода: с последнего элемента Tab возвращает на первый */
  if (modal) {
    modal.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = focusables(modal);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  $$(".js-callback").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); setModal(true, b); }); });
  $$(".js-modal-close").forEach(function (b) { b.addEventListener("click", function () { setModal(false); }); });
  if (modal) modal.addEventListener("click", function (e) { if (e.target === modal) setModal(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    /* Escape, закрывший окно, дальше не идёт. Иначе он доходил до
       сцены полёта и закрывал заодно её: сцена в этот момент снимала
       глушение со страницы, и фокус, который окно только что вернуло
       на кнопку, оставался в никуда. Одно нажатие - одно действие. */
    var былоОкно = !!(modal && modal.classList.contains("on"));
    setModal(false);
    if (drawer && drawer.classList.contains("on")) { setDrawer(false); былоОкно = true; }
    if (былоОкно) { e.stopPropagation(); }
  }, true);

  /* Почту и телеграм чаще переписывают, чем нажимают: на настольной
     машине mailto открывает не тот почтовик, а на телефоне человек
     хочет отправить адрес коллеге. Даём кнопку «скопировать» рядом
     со строкой - сама ссылка при этом работает как работала. */
  (function copyContacts() {
    var list = $(".contact-list");
    if (!list || !navigator.clipboard) return;

    var toast = null, toastT = 0;
    function say(text) {
      if (!toast) {
        toast = document.createElement("div");
        toast.className = "rc-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        document.body.appendChild(toast);
      }
      toast.textContent = text;
      toast.classList.add("on");
      clearTimeout(toastT);
      toastT = setTimeout(function () { toast.classList.remove("on"); }, 2200);
    }

    $$('a[href^="mailto:"], a[href*="t.me/"]', list).forEach(function (a) {
      var val = a.getAttribute("href").indexOf("mailto:") === 0
        ? a.getAttribute("href").slice(7)
        : (a.textContent || "").trim();
      var b = document.createElement("button");
      b.type = "button";
      b.className = "copy-btn";
      b.setAttribute("aria-label", t("ct.copy", "Скопировать") + ": " + val);
      /* Знак рисуем фоном через маску, а не вложенным svg: строка
         контакта сама подставляет свою иконку первым ребёнком и
         ориентируется на разметку внутри */
      b.setAttribute("data-copy", "");
      b.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(val).then(function () {
          say(t("ct.copied", "Скопировано") + ": " + val);
          b.classList.add("done");
          setTimeout(function () { b.classList.remove("done"); }, 1400);
          /* Короткий толчок там, где он есть: палец должен
             почувствовать, что нажатие сработало */
          try { if (navigator.vibrate) navigator.vibrate(10); } catch (e2) {}
          track("copy", val);
        }).catch(function () {
          say(t("ct.copyerr", "Не удалось скопировать"));
        });
      });
      a.appendChild(b);
    });
  })();

  /* Клики по регистрации и внешним ссылкам */
  $$('a[href*="lk.rocketcdn"], .js-reg').forEach(function (a) {
    a.addEventListener("click", function () { track("register", a.dataset.place || "link"); });
  });
  $$(".js-connect").forEach(function (a) {
    a.addEventListener("click", function () { track("connect", a.dataset.place || "cta"); });
  });

  track("view", location.pathname);
  applyContent();
}

/* Ждём именно DOMContentLoaded, а не «страница уже разобрана».
   Скрипты идут с defer, и на момент их выполнения readyState уже
   «interactive» - при прежней проверке boot начинал работу сразу,
   рассылал rc:lang, и модули, стоящие ниже по списку (rc-fill,
   rc-viz), не успевали подписаться. Разделы «как работает»,
   «надёжность» и «что входит» оставались пустыми. */
if (document.readyState === "complete") boot();
else document.addEventListener("DOMContentLoaded", boot);

/* ── Поворот телефона держит ДОЛЮ прочитанного ───────────────
   Страница это фильм на прокрутке, и его высота в двух положениях
   разная: 13226 точек в портрете против 11232 в альбоме. Браузер при
   повороте сохраняет число точек, а не долю, поэтому доля скачет, и
   человек оказывается в другом акте.

   Замер на живой странице: с середины (доля 0,615, акт «Сценарии»)
   три поворота подряд дали сдвиги +1704, +2025 и +1345 точек и
   положили человека ровно на дно, в финал. Читал про сценарии,
   повернул телефон дважды - смотришь титры.

   Держим долю: где человек читал, там и останется. */
(function поворот() {
  var доля = 0, тик = 0, возвращаем = 0;
  var шир = innerWidth, выс = innerHeight;
  function запомнить() {
    var макс = document.documentElement.scrollHeight - innerHeight;
    доля = макс > 0 ? scrollY / макс : 0;
  }
  addEventListener("scroll", function () {
    /* Пока идёт возврат после поворота, долю не переписываем: высота
       документа в эти доли секунды ещё считается, и запись с неё
       увела бы человека туда же, откуда мы его возвращаем. */
    if (возвращаем || тик) return;
    тик = requestAnimationFrame(function () { тик = 0; запомнить(); });
  }, { passive: true });
  запомнить();
  addEventListener("resize", function () {
    /* Смена высоты сама по себе поворотом не считается: на телефоне
       она меняется каждый раз, когда прячется адресная строка. Ждём
       именно смены стороны. */
    var былоШире = шир > выс;
    шир = innerWidth; выс = innerHeight;
    if (былоШире === (шир > выс)) return;
    var д = доля;
    возвращаем++;
    var вернуть = function (последний) {
      var макс = document.documentElement.scrollHeight - innerHeight;
      if (макс > 0) { try { window.scrollTo(0, Math.round(макс * д)); } catch (e) {} }
      доля = д;
      if (последний) возвращаем = Math.max(0, возвращаем - 1);
    };
    /* Раскладка после поворота досчитывается не сразу: возвращаемся
       несколько раз, пока высота документа не устоится. */
    setTimeout(вернуть, 60);
    setTimeout(вернуть, 320);
    setTimeout(вернуть, 720);
    setTimeout(function () { вернуть(true); }, 1400);
  }, { passive: true });
})();
})();
