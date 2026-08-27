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
  /* Лупы сняты горизонтальными, 960 на 540. На телефоне их пришлось
     бы растягивать по высоте втрое - именно это владелец и назвал
     «мутняком»: вместо космоса получалось мыло поверх чёткого
     рисованного неба. На узком экране фон остаётся рисованным, он
     резкий в любом разрешении. */
  if (innerWidth < 901) return false;
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

  /* Появление - только когда видео реально готово играть.
     Раньше класс вешался по пересечению, и на медленной сети
     фон «мигал» чёрным кадром. Теперь ждём canplay; если данные
     уже на месте (кэш) - включаем сразу. */
  function reveal() { v.classList.add("on"); }
  if (v.readyState >= 3) reveal();
  else v.addEventListener("canplay", reveal, { once: true });

  /* Маскировка стыка лупа: за четверть секунды до конца плавно
     пригашаем видео до ~60% его рабочей непрозрачности, а после
     перемотки к началу так же плавно возвращаем. Только события,
     без таймеров. Базовую opacity держит класс .on, поэтому
     инлайн после отката снимаем начисто (style.opacity = ''),
     чтобы кен-бёрнс и темы дальше жили по CSS. */
  var dimmed = false;
  function dimOff() {
    if (!dimmed) return;
    dimmed = false;
    v.style.opacity = "";
  }
  v.addEventListener("timeupdate", function () {
    var d = v.duration;
    if (!d || !isFinite(d)) return;
    if (!dimmed && v.currentTime > d - 0.25) {
      dimmed = true;
      var cur = parseFloat(getComputedStyle(v).opacity);
      if (!isFinite(cur)) cur = 1;
      v.style.transition = "opacity .22s linear";
      v.style.opacity = String(cur * 0.6);
    } else if (dimmed && v.currentTime < d - 0.5) {
      /* Луп перескочил к началу (в части браузеров seeked при
         loop не приходит) - возвращаем яркость. */
      dimOff();
    }
  });
  v.addEventListener("seeked", function () {
    if (v.currentTime < 1) dimOff();
  });
  /* Когда откат непрозрачности доигрался - убираем инлайновый
     transition, чтобы 2-секундная плавность класса .on вернулась. */
  v.addEventListener("transitionend", function (e) {
    if (e.propertyName === "opacity" && !dimmed) v.style.transition = "";
  });

  function inView() {
    var r = sec.getBoundingClientRect();
    return r.bottom > 0 && r.top < (innerHeight || root.clientHeight);
  }
  function tryPlay() {
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  /* Заводим только в кадре. Порог маленький: видео фоновое,
     пусть уже идёт, когда человек доехал до содержимого. */
  var io = new IntersectionObserver(function (es) {
    for (var i = 0; i < es.length; i++) {
      if (es[i].isIntersecting && !root.classList.contains("rc-flying")) {
        tryPlay();
      } else {
        try { v.pause(); } catch (e) {}
      }
    }
  }, { rootMargin: "160px 0px" });
  io.observe(sec);

  /* Вкладка ушла в фон - видео молчит; вернулась - продолжаем,
     но только если секция действительно на экране. */
  doc.addEventListener("visibilitychange", function () {
    if (doc.hidden) { try { v.pause(); } catch (e) {} }
    else if (inView() && !root.classList.contains("rc-flying")) tryPlay();
  });

  /* В полёте фоны страницы молчат, а после возврата оживают.
     Раньше слушали только вход, и человек, вернувшийся из полёта,
     получал вместо живого фона застывший кадр до конца сессии. */
  addEventListener("rc:flight", function (e) {
    var on = !!(e.detail && e.detail.on);
    if (on) { try { v.pause(); } catch (err) {} return; }
    if (doc.hidden || !inView()) return;
    if (root.classList.contains("rc-flying")) return;
    tryPlay();
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
