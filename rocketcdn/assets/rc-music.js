/* ═══════════════════════════════════════════════════════════
   Rocket CDN · музыкальная тема

   Заказчик выбрал тему сам и сказал главное о ней: она должна быть
   фоном, не действовать на нервы и не заставлять спешить. Поэтому
   здесь взят спокойный кусок с 3:48, из него собрана петля с
   перекрёстным затуханием - конец переходит в начало без шва, и
   человек не слышит, где трек пошёл по кругу.

   Как включается. ТОЛЬКО кнопкой звука в шапке, и никак иначе.

   Раньше здесь стояла хитрая схема: трек заводился беззвучно прямо
   на загрузке, а первое же событие из списка жестов - в том числе
   прокрутка и колесо мыши - снимало немоту. Замер на живой странице
   показал, чем это оборачивается: человек листает первый экран, у
   него сама собой начинает играть музыка на громкости 0.3, на
   документе появляется класс music-on, а тумблер звука в шапке при
   этом стоит в положении «выключено» (aria-pressed="false"). Плюс
   полмегабайта темы качалось у каждого, кто вообще не собирался
   ничего слушать.

   Прокрутка это не просьба включить звук. Поэтому:
     · по умолчанию тишина, ни одного байта темы не качается;
     · элемент audio создаётся в момент нажатия на кнопку, тогда же
       и начинается загрузка файла;
     · выключили - трек останавливается, состояние запоминается;
     · класс music-on и событие rc:music держат кнопку в шапке
       в том же положении, в каком находится сам звук.

   Мгновенного старта после нажатия теперь нет: первые доли секунды
   уходят на загрузку. Это честная цена за то, что страница молчит,
   пока её не попросили зазвучать, и не тратит трафик впустую.

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
var started = false, killed = false, duckUntil = 0, boosted = false;

/* Человек уже говорил «выключить» - помним это между визитами.
   Ключ общий со звуками ракеты: кнопка в шапке одна на весь звук. */
function muteChoice() {
  try { return localStorage.getItem(KEY) === "off"; } catch (e) { return false; }
}

function build() {
  if (el) return el;
  el = doc.createElement("audio");
  el.loop = true;
  /* Строим элемент только по нажатию, поэтому и качаем сразу всё:
     ждать больше нечего, человек уже попросил звук. Раньше здесь
     стояло "metadata" ради немого прогона на загрузке страницы -
     прогона больше нет. */
  el.preload = "auto";
  el.volume = 0;
  el.setAttribute("playsinline", "");
  el.setAttribute("aria-hidden", "true");

  var a = doc.createElement("source");
  a.src = SRC_WEBM; a.type = "audio/webm; codecs=opus";
  var b = doc.createElement("source");
  b.src = SRC_M4A; b.type = "audio/mp4; codecs=mp4a.40.2";
  el.appendChild(a); el.appendChild(b);

  /* Файла нет или формат не понят - молчим, кнопку возвращаем в
     положение «выключено», чтобы она не врала про играющий звук */
  el.addEventListener("error", function () {
    killed = true;
    want = 0; cur = 0; started = false;
    root.classList.remove("music-on");
    tell(false);
  }, true);

  el.style.cssText = "position:absolute;width:0;height:0;opacity:0;pointer-events:none";
  doc.body.appendChild(el);
  return el;
}

function tell(on) {
  try { dispatchEvent(new CustomEvent("rc:music", { detail: { on: !!on } })); } catch (e) {}
}

/* Кадровый цикл поднимаем только когда есть что вести: громкость
   едет, тема пригнулась под грохот или трек ещё не завёлся. */
function kick() {
  if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
}

/* Плавность ведём сами: у элемента нет своих переходов громкости,
   а резкое включение как раз и есть то, что бьёт по нервам. */
function frame(ts) {
  var moving = Math.abs(cur - want) > 0.002 || duckUntil > ts || (want > 0 && !started);
  raf = moving ? requestAnimationFrame(frame) : 0;
  if (!raf) last = 0;

  var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0.016;
  last = ts;
  if (!el) return;

  var goal = want;
  if (duckUntil > ts) goal *= 0.42;   /* грохот старта: тема отступает */

  if (Math.abs(cur - goal) < 0.002) { cur = goal; }
  else cur += (goal - cur) * Math.min(1, dt / (FADE / 6));

  var v = cur < 0 ? 0 : (cur > 1 ? 1 : cur);
  try { if (Math.abs(el.volume - v) > 0.003) el.volume = v; } catch (e) {}

  /* Дошли до нуля - останавливаем совсем. Держать трек на паузе
     без звука незачем: немого прогона в этой схеме нет. */
  if (v < 0.004 && !want && started) { try { el.pause(); } catch (e2) {} started = false; }
}

function play() {
  if (!el || killed) return null;
  var r = null;
  try { r = el.play(); } catch (e) { return null; }
  if (r && r.then) {
    r.then(function () { started = true; }).catch(function () {
      /* Браузер отказал даже после нажатия - значит звука нет, и
         кнопка обязана это показать, а не гореть «включено» */
      started = false;
      want = 0; cur = 0;
      root.classList.remove("music-on");
      tell(false);
    });
  } else started = true;
  return r;
}

/* ── Включение ───────────────────────────────────────────────
   Зовётся строго из обработчика нажатия на кнопку звука
   (rc-sound.js): это и есть жест человека, ради которого браузер
   вообще разрешает звук. Здесь же начинается загрузка файла. */
function on(level) {
  if (killed) return;
  /* Слово человека сильнее любого вызова: сказал «выключить» - тема не
     поднимается, кто бы её ни звал. Кнопка звука пишет «on» в этот же
     ключ ДО того, как позвать нас, поэтому собственное нажатие сюда
     не упирается. */
  if (muteChoice()) return;
  build();
  want = level === undefined ? VOL : level;
  if (!started || el.paused) play();
  root.classList.add("music-on");
  tell(true);
  kick();
}

function silence() {
  want = 0;
  root.classList.remove("music-on");
  tell(false);
  kick();
}

/* ── Наружу ──────────────────────────────────────────────────
   Тумблер звука в шапке дёргает и тему тоже: у человека одна
   кнопка на весь звук сайта, а не две. */
g.RC_MUSIC = {
  on: on,
  off: silence,
  quiet: function (yes) { if (want) { want = yes ? VOL_QUIET : VOL; kick(); } },
  /* Полёт: музыка встаёт в полный рост - клиент просил громче,
     когда летим. Выход из полёта возвращает фоновый уровень.
     Завести молчащую тему полёт не может: раньше boost(true) сам
     звал on(), и человек, не трогавший кнопку звука, получал
     музыку от одного нажатия «Начать полёт». */
  boost: function (yes) {
    if (!want) { boosted = false; return; }
    boosted = !!yes;
    want = yes ? 0.55 : VOL;
    kick();
  },
  duck: function (ms) { duckUntil = performance.now() + (ms || 2200); kick(); },
  /* Для кнопки в шапке: «включено» это намерение играть плюс живой
     трек. Ждать, пока шестисекундное проявление доедет до слышимой
     громкости, кнопка не должна - иначе первые секунды после
     нажатия она показывает «выключено» при играющей музыке. */
  playing: function () { return !!(el && want > 0 && !el.paused); },
  level: function () { return cur; },
  state: function () {
    return {
      файл: el ? (el.currentSrc || "").split("/").pop() : null,
      создан: !!el,
      идёт: !!(el && !el.paused),
      громкость: +cur.toFixed(3), цель: +want.toFixed(3),
      сломан: killed
    };
  }
};

/* ── Обстановка вокруг темы ──────────────────────────────────
   Всё это работает только когда музыка уже играет: пока want ноль,
   слушатели просто ничего не делают и ни байта не качают. */
function wire() {
  /* Тише там, где читают и пишут. Справочник и пульт - места, где
     человек думает над текстом, музыка там отходит на шаг назад и
     возвращается, когда сцена снова становится полётом. */
  addEventListener("rc:act", function (e) {
    var a = e && e.detail && e.detail.act;
    if (!want || boosted) return;
    want = (a === "console" || a === "manual") ? VOL_QUIET : VOL;
    kick();
  });
  doc.addEventListener("focusin", function (e) {
    if (!want || boosted) return;
    var n = e.target && e.target.tagName;
    if (n === "INPUT" || n === "TEXTAREA" || n === "SELECT") { want = VOL_QUIET; kick(); }
  });
  doc.addEventListener("focusout", function () {
    if (want) setTimeout(function () {
      if (!want || boosted) return;
      var a = doc.activeElement && doc.activeElement.tagName;
      if (a !== "INPUT" && a !== "TEXTAREA" && a !== "SELECT") {
        var act = g.RC_SCENE && g.RC_SCENE.act;
        want = (act === "console" || act === "manual") ? VOL_QUIET : VOL;
        /* Кадровый цикл засыпает, когда громкость доехала: без толчка
           новый уровень остался бы числом в переменной, а не звуком */
        kick();
      }
    }, 60);
  });

  /* Ушли со вкладки - тема замолкает и не играет в пустоту.
     Вернулись при включённом звуке - продолжаем с того же места. */
  doc.addEventListener("visibilitychange", function () {
    if (!el || !want) return;
    if (doc.hidden) { try { el.pause(); } catch (e) {} started = false; }
    else { play(); kick(); }
  });

  /* Человек сказал «выключить» в другой вкладке - гасим и здесь */
  addEventListener("storage", function (e) {
    if (e && e.key === KEY && e.newValue === "off" && want) silence();
  });
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire);
else wire();

})(window);
