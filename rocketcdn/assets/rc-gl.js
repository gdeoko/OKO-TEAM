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

  /* Сколько сцен сейчас живо: пригодилось в проверках */
  stats: function () { return { used: used, budget: budget(), scenes: scenes.length }; }
};
})(window);
