/* ═══════════════════════════════════════════════════════════
   Rocket CDN · музыкальная тема

   Заказчик выбрал тему сам и сказал главное о ней: она должна быть
   фоном, не действовать на нервы и не заставлять спешить. Поэтому
   здесь взят спокойный кусок с 3:48, из него собрана петля с
   перекрёстным затуханием - конец переходит в начало без шва, и
   человек не слышит, где трек пошёл по кругу.

   Как включается. Браузеры не дают сайту зазвучать без участия
   человека, и никакой трюк этого не отменяет. Зато можно сделать
   так, чтобы задержки не было ни на слух, ни на глаз: трек
   стартует беззвучно сразу при загрузке, крутится и ждёт. Первое
   же касание - клик, палец, клавиша, колесо - снимает немоту, и
   музыка появляется уже идущей, а не начинает грузиться. Там, где
   браузер разрешает звук сразу (человек уже бывал на сайте),
   ничего ждать не надо: включаемся на загрузке.

   Громкость. Ниже, чем кажется правильным на первый взгляд: тема
   должна читаться как воздух комнаты, а не как саундтрек поверх
   текста. Вход - шесть секунд, чтобы музыка не «включилась», а
   проявилась. При грохоте старта и посадки тема отступает на пару
   секунд и возвращается.

   Выключение. Тот же тумблер, что и у звуков ракеты, и решение
   человека запоминается: сказал «выключить» - больше не включаем
   ни сейчас, ни в следующий раз.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var KEY = "rcdn.sound";               /* один ключ на весь звук сайта */
var SRC_WEBM = "assets/audio/theme.webm";
var SRC_M4A  = "assets/audio/theme.m4a";

/* Уровень темы. Сознательно тихо: под ней должен читаться текст. */
var VOL = 0.30;
var VOL_QUIET = 0.16;                 /* когда человек в форме или в справочнике */
var FADE = 6.0;                       /* секунд на проявление */

var el = null, want = 0, cur = 0, raf = null, last = 0;
var armed = false, started = false, killed = false, duckUntil = 0, heard = false, boosted = false;

function off() {
  try { return localStorage.getItem(KEY) === "off"; } catch (e) { return false; }
}

function build() {
  if (el) return el;
  el = doc.createElement("audio");
  el.loop = true;
  /* Метаданные хватает, чтобы трек был готов начаться: сами данные
     браузер дотянет по ходу немого прогона */
  el.preload = "metadata";
  el.volume = 0;
  el.muted = true;                    /* немой старт разрешён везде */
  el.setAttribute("playsinline", "");
  el.setAttribute("aria-hidden", "true");

  var a = doc.createElement("source");
  a.src = SRC_WEBM; a.type = "audio/webm; codecs=opus";
  var b = doc.createElement("source");
  b.src = SRC_M4A; b.type = "audio/mp4; codecs=mp4a.40.2";
  el.appendChild(a); el.appendChild(b);

  /* Файла нет или формат не понят - молчим и не мешаем странице */
  el.addEventListener("error", function () { killed = true; }, true);

  el.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
  doc.body.appendChild(el);
  return el;
}

/* Плавность ведём сами: у элемента нет своих переходов громкости,
   а резкое включение как раз и есть то, что бьёт по нервам. */
function frame(ts) {
  /* Кадровый цикл нужен только пока громкость едет. Когда она
     доехала до своего значения, а трек уже играет или уже молчит,
     смотреть каждый кадр не на что: дальше за темой следит редкий
     сторож немого прогона на таймере. */
  var moving = Math.abs(cur - want) > 0.002 || duckUntil > ts || (want > 0 && !started);
  raf = moving ? requestAnimationFrame(frame) : 0;
  if (!raf) {
    if (!frame._nap) {
      frame._nap = setInterval(function () {
        if (doc.hidden) return;
        if (Math.abs(cur - want) > 0.002 || duckUntil > performance.now() ||
            (!want && !killed && el && el.muted && el.paused)) {
          clearInterval(frame._nap); frame._nap = 0;
          if (!raf) raf = requestAnimationFrame(frame);
        }
      }, 400);
    }
  } else if (frame._nap) { clearInterval(frame._nap); frame._nap = 0; }

  var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016;
  last = ts;
  if (!el) return;

  var goal = want;
  if (duckUntil > ts) goal *= 0.42;   /* грохот старта: тема отступает */

  if (Math.abs(cur - goal) < 0.002) { cur = goal; }
  else cur += (goal - cur) * Math.min(1, dt / (FADE / 6));

  var v = cur < 0 ? 0 : (cur > 1 ? 1 : cur);
  try { if (Math.abs(el.volume - v) > 0.003) el.volume = v; } catch (e) {}

  /* Дошли до нуля - останавливаем, чтобы не жечь батарею впустую.
     Немой прогон не трогаем: он и заведён ради того, чтобы к
     первому касанию трек уже шёл, а не начинал грузиться. */
  if (v < 0.004 && started && !want && !el.muted) { try { el.pause(); } catch (e) {} started = false; }

  /* Сторож немого прогона. Проба голоса и запрет браузера ходят
     наперегонки, и трек легко остаётся на паузе: сняли немоту -
     браузер остановил, вернули немоту - момент упущен. Поэтому раз
     в полторы секунды просто проверяем факт: молчим, стоим, не
     выключены - значит снова заводим беззвучно. */
  if (!want && !killed && !doc.hidden && el.muted && el.paused && ts - (frame._at || 0) > 800) {
    frame._at = ts;
    play();
  }
}

function play() {
  if (!el || killed) return null;
  var r = null;
  try { r = el.play(); } catch (e) { return null; }
  if (r && r.then) r.then(function () { started = true; }).catch(function () {});
  else started = true;
  return r;
}

/* ── Включение ───────────────────────────────────────────────
   Снимаем немоту и выводим громкость. Если браузер к этому
   моменту так и не дал играть - пробуем ещё раз: жест человека
   уже случился, теперь разрешение есть. */
function on(level) {
  if (killed || off()) return;
  build();
  /* Первое включение начинаем с начала выбранного куска: пока трек
     шёл беззвучно, он успел уехать на несколько секунд, а заказчик
     выбирал именно это вступление. Слышно этого никто не может -
     до сих пор была тишина. */
  if (!heard) {
    heard = true;
    try { if (el.currentTime > 0.2) el.currentTime = 0; } catch (e) {}
  }
  el.muted = false;
  want = level === undefined ? VOL : level;
  if (!started || el.paused) play();
  root.classList.add("music-on");
  try { dispatchEvent(new CustomEvent("rc:music", { detail: { on: true } })); } catch (e) {}
}

function silence() {
  want = 0;
  root.classList.remove("music-on");
  try { dispatchEvent(new CustomEvent("rc:music", { detail: { on: false } })); } catch (e) {}
}

/* ── Первый контакт ──────────────────────────────────────────
   Ловим всё, что браузер согласен считать участием человека.
   Один раз: дальше слушатели снимаются. */
var GESTURES = ["pointerdown", "pointerup", "touchstart", "touchend",
                "mousedown", "click", "keydown", "wheel", "scroll"];

function first() {
  if (!armed) return;
  armed = false;
  GESTURES.forEach(function (n) {
    removeEventListener(n, first, true);
    doc.removeEventListener(n, first, true);
  });
  on();
}

function arm() {
  if (armed) return;
  armed = true;
  GESTURES.forEach(function (n) {
    addEventListener(n, first, { capture: true, passive: true });
    doc.addEventListener(n, first, { capture: true, passive: true });
  });
}

/* Проба голоса: снимаем немоту и смотрим, не осадил ли нас
   браузер. Осадил - молча возвращаемся к беззвучному прогону и
   ждём касания; разрешил - выводим громкость. Проверяем не по
   обещанию, а по факту через треть секунды: браузер имеет право
   ответить «да» и тут же поставить на паузу. */
function tryAloud() {
  if (!el || killed) return;
  var at = el.currentTime;
  try { el.muted = false; } catch (e) { return; }
  var r = null;
  try { r = el.play(); } catch (e2) {}
  if (r && r.catch) r.catch(function () {});
  setTimeout(function () {
    if (!el) return;
    if (!el.paused && !el.muted && el.currentTime >= at) {
      started = true;
      armed = false;
      on();
    } else {
      try { el.muted = true; } catch (e3) {}
      play();
      arm();
    }
  }, 340);
}

function boot() {
  if (off()) return;
  build();
  if (!raf) raf = requestAnimationFrame(frame);

  /* Немой прогон: к первому касанию трек уже идёт и звук появится
     мгновенно, без паузы на загрузку. Только когда он точно пошёл,
     пробуем зазвучать в голос - иначе браузер отклонит обе попытки
     разом и мы останемся молча. */
  var r = play();
  if (r && r.then) r.then(tryAloud).catch(arm);
  else setTimeout(tryAloud, 200);

  /* Человек уже что-то делал на странице до загрузки скрипта -
     значит разрешение есть, ждать нечего. */
  try {
    if (navigator.userActivation && navigator.userActivation.hasBeenActive) setTimeout(tryAloud, 60);
  } catch (e) {}
  arm();

  /* Второй сторож, уже на таймере. Кадровый цикл на загруженной
     странице может надолго уступить место отрисовке, и тогда немой
     прогон поднимется не сразу; таймер от этого не зависит. */
  setInterval(function () {
    if (killed || off() || want || doc.hidden) return;
    if (el && el.muted && el.paused) play();
  }, 1500);

  /* Тише там, где читают и пишут. Справочник и пульт - места, где
     человек думает над текстом, музыка там отходит на шаг назад и
     возвращается, когда сцена снова становится полётом. */
  addEventListener("rc:act", function (e) {
    var a = e && e.detail && e.detail.act;
    if (!want || boosted) return;
    want = (a === "console" || a === "manual") ? VOL_QUIET : VOL;
  });
  doc.addEventListener("focusin", function (e) {
    if (!want || boosted) return;
    var n = e.target && e.target.tagName;
    if (n === "INPUT" || n === "TEXTAREA" || n === "SELECT") want = VOL_QUIET;
  });
  doc.addEventListener("focusout", function () {
    if (want) setTimeout(function () {
      if (!want || boosted) return;
      var a = doc.activeElement && doc.activeElement.tagName;
      if (a !== "INPUT" && a !== "TEXTAREA" && a !== "SELECT") {
        var act = g.RC_SCENE && g.RC_SCENE.act;
        want = (act === "console" || act === "manual") ? VOL_QUIET : VOL;
      }
    }, 60);
  });

  /* Подстраховка: вкладка могла открыться в фоне, и тогда браузер
     не даёт играть даже беззвучно. Как только вкладку показали -
     пробуем снова. */
  doc.addEventListener("visibilitychange", function () {
    if (doc.hidden) { if (el && want) { try { el.pause(); } catch (e) {} started = false; } }
    else if (want) { play(); }
    else if (!off() && el && el.paused) { play(); }
  });
}

/* ── Наружу ──────────────────────────────────────────────────
   Тумблер звука в шапке дёргает и тему тоже: у человека одна
   кнопка на весь звук сайта, а не две. */
g.RC_MUSIC = {
  on: on,
  off: silence,
  quiet: function (yes) { if (want) want = yes ? VOL_QUIET : VOL; },
  /* Полёт: музыка встаёт в полный рост - клиент просил громче,
     когда летим. Выход из полёта возвращает фоновый уровень. */
  boost: function (yes) {
    boosted = !!yes;
    if (yes) { if (!want) on(); want = 0.55; }
    else if (want) want = VOL;
  },
  duck: function (ms) { duckUntil = performance.now() + (ms || 2200); },
  playing: function () { return !!(el && !el.paused && !el.muted && cur > 0.01); },
  level: function () { return cur; },
  state: function () {
    return {
      файл: el ? (el.currentSrc || "").split("/").pop() : null,
      идёт: !!(el && !el.paused), немой: !!(el && el.muted),
      громкость: +cur.toFixed(3), цель: +want.toFixed(3),
      ждёт_касания: armed, сломан: killed
    };
  }
};

/* Полкилобайта на человека, который звук так и не включит - дорого:
   тема весит 513 КБ и качалась у всех подряд ещё до первого касания
   экрана. Немой прогон остаётся (он и даёт мгновенный звук после
   жеста), но заводим его не раньше, чем видно вовлечение: касание,
   клавиша или уход с первого экрана. На экономии трафика и режиме
   «сберечь данные» тема не поднимается вообще.

   Страховка на десять секунд нужна тому, кто просто читает первый
   экран и потом сразу жмёт звук - он не должен ждать загрузки. */
function armBoot() {
  if (off()) return;
  try {
    var c = navigator.connection;
    if (c && (c.saveData || /(^|-)(2g)$/.test(c.effectiveType || ""))) return;
  } catch (e) {}

  var done = false;
  function go() {
    if (done) return;
    done = true;
    removeEventListener("pointerdown", go);
    removeEventListener("keydown", go);
    removeEventListener("scroll", onScr);
    boot();
  }
  function onScr() { if ((scrollY || 0) > innerHeight * 0.5) go(); }

  addEventListener("pointerdown", go, { passive: true, once: true });
  addEventListener("keydown", go, { once: true });
  addEventListener("scroll", onScr, { passive: true });
  setTimeout(go, 10000);
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", armBoot);
else armBoot();

})(window);
