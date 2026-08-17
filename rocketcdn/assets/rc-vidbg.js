/* ═══════════════════════════════════════════════════════════
   Rocket CDN · живые видеофоны

   Клиент попросил, чтобы в фоне ничего не стояло. Два коротких
   космических лупа сняты нейрорендером под палитру бренда: Земля
   с рассветом для орбитальной части и туманность с галактикой для
   створа преимуществ. Файлы лёгкие, без звука, крутятся по кругу.

   Дисциплина такая же, как у всего сайта:
   - видео заводится только когда секция реально в кадре, и
     останавливается, как только ушла: батарея дороже красоты;
   - на слабом устройстве, в экономном режиме и при просьбе меньше
     движения видео не создаётся вовсе - фон остаётся рисованным;
   - формат берём тот, который браузер умеет: webm или mp4.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

/* Какой секции какой луп. Ключ - id секции. */
var MAP = {
  infra: "space-earth",
  adv: "space-nebula"
};

function ok() {
  if (reduced || root.classList.contains("rc-reduced")) return false;
  if (root.getAttribute("data-degrade") === "3") return false;
  var mem = navigator.deviceMemory || 4;
  if (mem <= 2) return false;
  /* Экономия трафика: уважим просьбу системы */
  try { if (navigator.connection && navigator.connection.saveData) return false; } catch (e) {}
  return true;
}

function build(sec, name) {
  var v = doc.createElement("video");
  v.className = "rc-vidbg";
  v.muted = true; v.defaultMuted = true;
  v.loop = true;
  v.playsInline = true;
  v.setAttribute("playsinline", "");
  v.setAttribute("muted", "");
  v.setAttribute("aria-hidden", "true");
  v.preload = "metadata";
  v.disablePictureInPicture = true;

  var can = "";
  try { can = v.canPlayType('video/webm; codecs="vp9"'); } catch (e) {}
  v.src = "assets/gen/" + name + (can ? ".webm" : ".mp4");

  v.addEventListener("error", function () {
    if (v.parentNode) v.parentNode.removeChild(v);
  });

  sec.classList.add("has-vidbg");
  sec.insertBefore(v, sec.firstChild);

  /* Заводим только в кадре. Порог маленький: видео фоновое,
     пусть уже идёт, когда человек доехал до содержимого. */
  var io = new IntersectionObserver(function (es) {
    for (var i = 0; i < es.length; i++) {
      if (es[i].isIntersecting && !root.classList.contains("rc-flying")) {
        var r = v.play();
        if (r && r.catch) r.catch(function () {});
        v.classList.add("on");
      } else {
        try { v.pause(); } catch (e) {}
      }
    }
  }, { rootMargin: "160px 0px" });
  io.observe(sec);

  /* В полёте фоны страницы молчат */
  addEventListener("rc:flight", function (e) {
    if (e.detail && e.detail.on) { try { v.pause(); } catch (err) {} }
  });
}

function boot() {
  if (!ok()) return;
  for (var id in MAP) {
    var sec = doc.getElementById(id);
    if (sec && !sec.querySelector(".rc-vidbg")) build(sec, MAP[id]);
  }
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
else boot();

})(window);
