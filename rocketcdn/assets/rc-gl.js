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
  if (w < 760) return 2;
  if (w < 1100) return 3;
  return 4;
}

var used = 0;

g.RC_GL = {
  /* Можно ли завести ещё одну сцену */
  afford: function () { return used < budget(); },

  /* Взять место под сцену. Возвращает false, если места нет. */
  take: function () {
    if (used >= budget()) return false;
    used++;
    return true;
  },

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
  var base = (function () {
    var me = document.currentScript;
    if (me && me.src) return me.src.replace(/[^/]+$/, "");
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
    /* Ждём, пока подпишутся, и сообщаем: объёмного слоя не будет */
    setTimeout(function () { fire("rc:no3d"); }, 0);
    return;
  }

  var FILES = ["vendor/three.min.js", "rc-globe3d.js", "rc-rack.js", "rc-rocket.js"];
  var started = false;

  function load(i) {
    if (i >= FILES.length) {
      g.RC_GL.ready3d = true;
      fire("rc:3d");
      return;
    }
    var sc = document.createElement("script");
    sc.src = base + FILES[i];
    sc.async = false;
    sc.onload = function () { load(i + 1); };
    sc.onerror = function () {
      /* Не дотянулись - живём без объёма, страница целая */
      g.RC_GL.want3d = false;
      fire("rc:no3d");
    };
    document.head.appendChild(sc);
  }

  function go() {
    if (started) return;
    started = true;
    load(0);
  }

  /* Тянем сразу: ракета нужна с первых секунд, а на мобильной связи
     семьсот килобайт после события load приезжают слишком поздно и
     человек успевает решить, что ракеты нет вовсе. Экономия остаётся
     там, где она честная: кому объём не положен, тот не качает ничего. */
  go();
})();
})(window);
