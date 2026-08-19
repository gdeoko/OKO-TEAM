/* RocketCDN · логика сайта.
   Темы, язык, рендер блоков, глобус, поиск по сети, формы, аналитика. */
(function () {
"use strict";

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var API = "api.php";
var LK  = "https://lk.rocketcdn.ru";

/* ═══ Иконки ═════════════════════════════════════════════ */
var ICO = {
  cdn:    '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v1A2.5 2.5 0 0 1 18.5 10h-13A2.5 2.5 0 0 1 3 7.5v-1ZM3 16.5A2.5 2.5 0 0 1 5.5 14h13a2.5 2.5 0 0 1 2.5 2.5v1a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-1Z"/><path d="M7 7h.01M7 17h.01"/>',
  stream: '<rect x="2" y="4" width="20" height="14" rx="2.5"/><path d="M8 21h8M12 18v3"/><path d="m10.5 8.8 4 2.2-4 2.2V8.8Z"/>',
  storage:'<path d="M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z"/><path d="m3 12 9 4.5L21 12M3 16.5 12 21l9-4.5"/>',
  player: '<circle cx="12" cy="12" r="9"/><path d="m10.2 8.6 5.3 3.4-5.3 3.4V8.6Z"/>',
  cloud:  '<path d="M17.5 19a4.5 4.5 0 0 0 .3-9 6.5 6.5 0 0 0-12.4 2A4 4 0 0 0 6 19h11.5Z"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6l-7-3Z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
  voice:  '<rect x="9" y="3" width="6" height="10" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  cpu:    '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3"/>',
  gpu:    '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M7 10.5h3.5M7 13.5h3.5"/><circle cx="16" cy="12" r="2.6"/>',
  support:'<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="13" width="4" height="6" rx="2"/><rect x="17.5" y="13" width="4" height="6" rx="2"/><path d="M20 19a3 3 0 0 1-3 3h-2"/>',
  load:   '<path d="M4 19h16"/><path d="M6.5 19V9.5M11 19V4.5M15.5 19v-7M20 19V7"/>',
  speed:  '<path d="M12 20a8 8 0 1 1 8-8"/><path d="m12 12 5-3.5"/><circle cx="12" cy="12" r="1.6"/>',
  bolt:   '<path d="M13 2 4.5 13.5H11L10.5 22 19.5 10H13l0-8Z"/>',
  globe:  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z"/>',
  dc:     '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  check:  '<path d="m4.5 12.5 5 5 10-11"/>',
  mail:   '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3 7 9 6 9-6"/>',
  tg:     '<path d="m21 4-3 16-6-4.5-3 3-.6-4.8L19 6.5 7.5 12.8 3 11.2 21 4Z"/>',
  clock:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
  phone:  '<path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z"/>',
  user:   '<circle cx="12" cy="8" r="4"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  up:     '<path d="M12 19V5M6 11l6-6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  sun:    '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
  moon:   '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
  burger: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close:  '<path d="M6 6l12 12M18 6 6 18"/>',
  arrow:  '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
function svg(name, cls) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round"' + (cls ? ' class="' + cls + '"' : '') + '>' +
    (ICO[name] || "") + "</svg>";
}
window.RC_ICO = svg;

/* ═══ Состояние ══════════════════════════════════════════ */
var state = {
  lang:  localStorage.getItem("rc_lang") || "ru",
  theme: localStorage.getItem("rc_theme") || "dark",
  region: null,
  query: "",
  content: null
};
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
var track = (function () {
  var sid = sessionStorage.getItem("rc_sid");
  if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("rc_sid", sid); }
  var queue = [], timer = null, sent = {};
  function flush() {
    if (!queue.length) return;
    var body = JSON.stringify({ sid: sid, ref: document.referrer, events: queue.splice(0, queue.length) });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(API + "?action=track", new Blob([body], { type: "application/json" }));
    } else {
      fetch(API + "?action=track", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
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
})();
window.RC_track = track;

/* Ловим ошибки фронта и складываем в тот же поток */
window.addEventListener("error", function (e) {
  track("jserr", ((e.message || "error") + " @ " + (e.filename || "").split("/").pop() + ":" + (e.lineno || 0)).slice(0, 180), true);
});

/* ═══ Тема и язык ════════════════════════════════════════ */
function applyTheme(v, silent) {
  state.theme = v;
  document.documentElement.setAttribute("data-theme", v);
  localStorage.setItem("rc_theme", v);
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
  /* Разметка тоже пишет число через атрибут, а не цифрами */
  $$("[data-nodes]").forEach(function (el) { el.textContent = nodesCount(); });
  localStorage.setItem("rc_lang", v);
  document.documentElement.lang = v;
  $$("[data-i18n]").forEach(function (el) {
    var k = el.getAttribute("data-i18n");
    var attr = el.getAttribute("data-i18n-attr");
    /* Запоминаем то, что написано в разметке: это наш запасной текст
       навсегда, даже если словарь придёт битым или устаревшим */
    if (el._i18nOrig == null) el._i18nOrig = attr ? (el.getAttribute(attr) || "") : el.textContent;
    var val = t(k, el._i18nOrig);
    if (val == null || val === "") return;
    if (attr) el.setAttribute(attr, val);
    else el.textContent = val;
  });
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
      return '<div class="faq-i"><button class="faq-q" aria-expanded="false" data-faq="' + i + '">' +
        "<span>" + esc(x.q) + "</span><i></i></button>" +
        '<div class="faq-a"><p>' + esc(x.a) + "</p></div></div>";
    }).join("");
    $$(".faq-q", f).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.parentNode, open = item.classList.contains("on");
        $$(".faq-i", f).forEach(function (it) {
          it.classList.remove("on");
          $(".faq-a", it).style.maxHeight = "";
          $(".faq-q", it).setAttribute("aria-expanded", "false");
        });
        if (!open) {
          item.classList.add("on");
          var a = $(".faq-a", item);
          a.style.maxHeight = a.scrollHeight + "px";
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

function renderNodes() {
  var list = $("#nodeList");
  if (!list) return;
  var rows = filteredNodes();
  var cnt = $("#nodeCount");
  if (cnt) cnt.textContent = rows.length;
  if (!rows.length) {
    list.innerHTML = '<div class="node-empty">' + esc(t("infra.none", "Ничего не найдено")) + "</div>";
    return;
  }
  list.innerHTML = rows.map(function (pair) {
    var n = pair[0], reg = GEO.REGIONS[n[3]];
    return '<div class="node-row" data-idx="' + pair[1] + '" role="button" tabindex="0">' +
      '<span class="nm">' + esc(GEO.name(n, state.lang)) + "</span>" + nodeTags(n) +
      '<span class="rg">' + esc(reg[state.lang] || reg.ru) + "</span></div>";
  }).join("");

  $$(".node-row", list).forEach(function (row) {
    function go() {
      var n = GEO.NODES[+row.dataset.idx];
      if (globe) { globe.focusOn(n[1], n[2]); globe.hover = +row.dataset.idx; }
      track("node", n[0]);
    }
    row.addEventListener("click", go);
    row.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });

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
    if (window.RCGlobe3D && window.THREE && !weak && room) {
      try { made = new window.RCGlobe3D(mapCv, opts); } catch (e) { made = null; }
      if (!made && window.RC_GL) window.RC_GL.give();
      else if (made && window.RC_GL) {
        /* Отобрали контекст - молча возвращаемся на плоский глобус */
        window.RC_GL.guard(mapCv, function () {
          try { made.stop(); } catch (e) {}
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
}

function countUp(el) {
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
function validate(form) {
  var ok = true;
  $$("[required]", form).forEach(function (f) {
    var wrap = f.closest(".field") || f.parentNode, val = (f.value || "").trim(), bad = false;
    if (f.type === "checkbox") bad = !f.checked;
    else if (!val) bad = true;
    else if (f.dataset.kind === "contact") bad = !(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(val) || (val.replace(/\D/g, "").length >= 10));
    else if (f.dataset.kind === "phone") bad = val.replace(/\D/g, "").length < 10;
    if (wrap.classList) wrap.classList.toggle("bad", bad);
    if (bad) ok = false;
  });
  return ok;
}

function wireForm(form, kind) {
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var msg = $(".form-msg", form), btn = $('button[type="submit"]', form);
    if (msg) msg.className = "form-msg";
    if (!validate(form)) return;

    var payload = { kind: kind, lang: state.lang, page: location.pathname + location.search };
    $$("input, textarea, select", form).forEach(function (f) {
      if (!f.name) return;
      payload[f.name] = f.type === "checkbox" ? (f.checked ? 1 : 0) : (f.value || "").trim();
    });
    payload.sid = sessionStorage.getItem("rc_sid") || "";

    var label = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.innerHTML = esc(t("ct.sending", "Отправляем")) + "..."; }

    fetch(API + "?action=lead", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (btn) { btn.disabled = false; btn.innerHTML = label; }
      if (r && r.ok) {
        if (msg) { msg.className = "form-msg ok"; msg.textContent = t(kind === "callback" ? "cb.ok" : "ct.ok", "Заявка принята, мы свяжемся с вами."); }
        form.reset();
        track("lead", kind);
        $$(".field", form).forEach(function (f) { f.classList.remove("bad"); });
      } else {
        if (msg) { msg.className = "form-msg bad"; msg.textContent = t("ct.err", "Не удалось отправить. Попробуйте ещё раз или напишите на info@rocketcdn.ru"); }
      }
    }).catch(function () {
      if (btn) { btn.disabled = false; btn.innerHTML = label; }
      if (msg) { msg.className = "form-msg bad"; msg.textContent = t("ct.err", "Не удалось отправить. Попробуйте ещё раз или напишите на info@rocketcdn.ru"); }
    });
  });

  $$("input, textarea", form).forEach(function (f) {
    f.addEventListener("input", function () {
      var w = f.closest(".field");
      if (w) w.classList.remove("bad");
    });
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
  function setDrawer(on) {
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
  }
  setDrawer(false);
  if (burger) burger.addEventListener("click", function () { setDrawer(!drawer.classList.contains("on")); });
  $$("#drawer a").forEach(function (a) { a.addEventListener("click", function () { setDrawer(false); }); });

  /* Шапка: тень, скрытие при скролле вниз, активный пункт */
  var hdr = $("#hdr"), prog = $("#prog"), toTop = $("#toTop"), lastY = 0, maxScroll = 0;
  /* Липкая панель с заявкой: приезжает, когда первый экран прочитан.
     Показывать её сразу нельзя - она перекрыла бы первый экран, ради
     которого человек и пришёл. Видима панель только на телефоне, это
     решает CSS; здесь мы лишь ставим класс. */
  var mcta = $("#mcta");
  var secs = $$("section[id]");
  function onScroll() {
    var y = window.scrollY || 0;
    var h = document.documentElement.scrollHeight - innerHeight;
    var ratio = h > 0 ? y / h : 0;
    if (prog) prog.style.width = (ratio * 100).toFixed(2) + "%";
    if (hdr) {
      hdr.classList.toggle("stuck", y > 8);
      hdr.classList.toggle("hide", y > 320 && y > lastY && !drawer.classList.contains("on"));
    }
    if (toTop) toTop.classList.toggle("on", y > 700);
    if (mcta) mcta.classList.toggle("on", y > innerHeight * 0.9);
    lastY = y;

    /* Глубина прочтения - в аналитику, по четвертям */
    var d = Math.round(ratio * 100);
    if (d > maxScroll) {
      maxScroll = d;
      [25, 50, 75, 95].forEach(function (m) { if (d >= m) track("scroll", String(m), true); });
    }

    var cur = "";
    secs.forEach(function (s) { if (s.getBoundingClientRect().top <= 120) cur = s.id; });
    $$(".nav a").forEach(function (a) {
      a.classList.toggle("act", a.getAttribute("href") === "#" + cur);
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
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

  /* Окно обратного звонка */
  var modal = $("#cbModal");
  function setModal(on) {
    if (!modal) return;
    modal.classList.toggle("on", on);
    document.body.style.overflow = on ? "hidden" : "";
    if (on) { track("open", "callback"); setTimeout(function () { var i = $("input", modal); if (i) i.focus(); }, 260); }
  }
  $$(".js-callback").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); setModal(true); }); });
  $$(".js-modal-close").forEach(function (b) { b.addEventListener("click", function () { setModal(false); }); });
  if (modal) modal.addEventListener("click", function (e) { if (e.target === modal) setModal(false); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    setModal(false);
    if (drawer && drawer.classList.contains("on")) setDrawer(false);
  });

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

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
})();
