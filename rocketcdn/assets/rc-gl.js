/* ═══════════════════════════════════════════════════════════
   Rocket CDN · страховка для сцен на WebGL

   Браузер вправе отобрать контекст: на айфоне это случается при
   нехватке памяти или когда контекстов на странице слишком много.
   Без обработчика холст просто чернеет и остаётся таким навсегда.

   Здесь одно правило на все сцены: контекст потеряли - сцену
   останавливаем и убираем с глаз, страница продолжает работать.
   Вернули - поднимаем обратно, если сцена умеет подниматься.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var scenes = [];

/* Сколько контекстов позволяем себе на этом устройстве.
   Сафари на телефоне держит мало и лишние гасит молча. */
function budget() {
  var w = innerWidth;
  var mem = navigator.deviceMemory || 4;
  var cpu = navigator.hardwareConcurrency || 4;
  if (mem <= 2 || cpu <= 2) return 1;
  /* Телефону раньше давали два контекста, и этого не хватало: глобус
     со стойкой разбирали оба, а кораблю - главному герою фильма -
     места не оставалось. Он не строился вовсе, а без него нет ни
     люка, ни входа в рубку: владелец видел вместо кино страницу.
     Современный Android держит три контекста спокойно, а порядок
     важности ниже страхует нас от любого их числа. */
  if (w < 760) return (mem >= 4 && cpu >= 4) ? 3 : 2;
  if (w < 1100) return 3;
  return 4;
}

var used = 0;

/* ── Порядок важности ────────────────────────────────────────
   Сцены сайта не равны между собой. Корабль и рубка - это сам
   сценарий: без них фильма нет. Глобус и стойка - украшения
   раздела, их отсутствие человек даже не заметит, потому что у
   обоих есть плоская версия.

   Поэтому вспомогательные сцены умеют уступать место: они
   подписываются на «rc:gl-free», а тот, кому места не хватило,
   просит освободить его и пробует ещё раз. Раньше побеждал просто
   тот, кто успел первым, и это был не главный герой. */
function freeAux() {
  try { dispatchEvent(new CustomEvent("rc:gl-free")); } catch (e) {}
}

g.RC_GL = {
  /* Можно ли завести ещё одну сцену */
  afford: function () { return used < budget(); },

  /* Взять место под сцену. Возвращает false, если места нет.
     Признак main говорит, что просит главная сцена сценария: тогда
     при нехватке мы сначала просим вспомогательные освободиться. */
  take: function (main) {
    if (used < budget()) { used++; return true; }
    if (!main) return false;
    freeAux();
    if (used < budget()) { used++; return true; }
    return false;
  },

  /* Уступить место главному: зовут вспомогательные сцены сами */
  freeAux: freeAux,

  give: function () { if (used > 0) used--; },

  /* Повесить страховку на холст.
     onLost вызывается при потере, onBack - при возврате. */
  guard: function (canvas, onLost, onBack) {
    if (!canvas || canvas._glGuard) return;
    canvas._glGuard = 1;
    var rec = { cv: canvas, lost: false };
    scenes.push(rec);

    canvas.addEventListener("webglcontextlost", function (e) {
      /* Без preventDefault браузер не даст вернуть контекст */
      e.preventDefault();
      rec.lost = true;
      g.RC_GL.give();
      try { if (onLost) onLost(); } catch (err) {}
      canvas.style.opacity = "0";
      if (g.RC_track) g.RC_track("glloss", canvas.id || "canvas", true);
    }, false);

    canvas.addEventListener("webglcontextrestored", function () {
      rec.lost = false;
      try { if (onBack) onBack(); } catch (err) {}
      canvas.style.opacity = "";
    }, false);
  },

  /* Потолок по устройству: нужен и загрузчику ниже */
  budget: budget,

  /* Сколько сцен сейчас живо: пригодилось в проверках */
  stats: function () { return { used: used, budget: budget(), scenes: scenes.length }; }
};

/* ── Подгрузка трёхмерного слоя по необходимости ─────────────
   three.js весит семьсот килобайт. Первому экрану он не нужен:
   там плоский глобус на обычном холсте. Поэтому библиотеку и три
   сцены тянем после загрузки страницы и только там, где они
   вообще будут показаны. Кому 3D не положено - не платит за него
   ни байтом. */
(function () {
  /* Путь и метка версии берём из собственного тега: bump.php ставит
     её всем ссылкам, и объёмный слой обязан подчиняться тому же
     правилу, иначе браузер отдаст из кеша старую ракету к новой
     странице. */
  var ver = "";
  var base = (function () {
    var me = document.currentScript;
    if (me && me.src) {
      var q = me.src.indexOf("?");
      if (q >= 0) { ver = me.src.slice(q); }
      return me.src.replace(/[?#].*$/, "").replace(/[^/]+$/, "");
    }
    return "assets/";
  })();

  function ok3d() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (g.RC_GL.budget() < 2) return false;
    try {
      var c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch (e) { return false; }
  }

  var want = ok3d();
  g.RC_GL.want3d = want;
  g.RC_GL.ready3d = false;

  function fire(name) {
    try { dispatchEvent(new CustomEvent(name)); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent(name)); } catch (e) {}
  }

  if (!want) {
    /* Ждём, пока подпишутся, и сообщаем: объёмного слоя не будет.
       Класс на документе прячет всё, что без объёма не работает:
       кнопки полёта не должны обещать то, чего не случится. */
    document.documentElement.classList.add("rc-no3d");
    setTimeout(function () { fire("rc:no3d"); }, 0);
    return;
  }

  /* rc-planets стоит перед игрой: она строит по нему миры чужих
     вселенных. Библиотека процедурная, картинок не тянет. */
  var FILES = ["vendor/three.min.js", "rc-globe3d.js", "rc-rack.js", "rc-rocket.js",
               "rc-interior.js", "rc-planets.js", "rc-flight.js"];
  var started = false;

  function load(i) {
    if (i >= FILES.length) {
      g.RC_GL.ready3d = true;
      fire("rc:3d");
      return;
    }
    var sc = document.createElement("script");
    sc.src = base + FILES[i] + ver;
    sc.async = false;
    sc.onload = function () { load(i + 1); };
    sc.onerror = function () {
      /* Не дотянулись - живём без объёма, страница целая. Класс тот
         же, что и при осознанном отказе: без него кнопка «Полёт в
         открытый космос» остаётся на экране живой на вид и мёртвой
         на деле - нажатие не делает ничего. */
      g.RC_GL.want3d = false;
      document.documentElement.classList.add("rc-no3d");
      fire("rc:no3d");
    };
    document.head.appendChild(sc);
  }

  function go() {
    if (started) return;
    started = true;
    load(0);
  }

  /* На быстром канале тянем сразу: ракета нужна с первых секунд, а
     если ждать события load, человек успевает решить, что её нет.
     На медленной мобильной связи всё наоборот - семьсот килобайт
     библиотеки отбирают канал у шрифта, стилей и первого экрана,
     поэтому там объёмный слой ждёт своей очереди. */
  var slow = false;
  try {
    var c = navigator.connection;
    if (c && (c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || ""))) slow = true;
  } catch (e) {}

  if (!slow) go();
  else if (document.readyState === "complete") setTimeout(go, 400);
  else addEventListener("load", function () { setTimeout(go, 400); }, { once: true });
})();
})(window);
