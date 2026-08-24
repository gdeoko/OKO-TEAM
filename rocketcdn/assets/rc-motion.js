/* ═══════════════════════════════════════════════════════════
   Rocket CDN · режимы движения: быстрая прокрутка, простой,
   ступенчатая деградация

   Фильм по прокрутке живёт ровно до тех пор, пока прокрутка
   ведёт себя как протяжка плёнки. Как только человек хватает
   ползунок и швыряет страницу из конца в начало, честная
   анимация превращается в кашу: счётчики не досчитываются,
   карточки застревают на полпути, кадры не успевают.

   Поэтому здесь три вещи:
   1. Один сглаженный прогресс на весь сайт, чтобы модули не
      считали его каждый по-своему.
   2. Режимы. Быстро - гасим мелочь и мгновенно доводим всё до
      конечного состояния. Стоим - роняем частоту кадров, чтобы
      не жечь батарею. Прыжок - короткий режим перемотки.
   3. Ступенчатая деградация. Если устройство не тянет, мы не
      показываем чёрный экран, а последовательно снимаем
      украшения: сначала частицы, потом свечения, потом объём.
      Фильм продолжается, качество падает.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

/* Высоту документа берём из общего кэша: прямой вопрос заставляет
   браузер досчитать вёрстку, а спрашиваем мы её в каждом кадре. */
var DOCH = (window.RC_BOX && window.RC_BOX.docH) || function () {
  return document.documentElement.scrollHeight || 1;
};

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var TAU_NORM = 0.09;      /* постоянная сглаживания, секунды */
var TAU_HYPER = 0.03;
/* Мёртвая зона на порядок меньше прежней: на отрезке подъезда к
   пульту прежние четыре десятитысячных доли страницы схлопывали
   хвост сглаживания скачком - финал вздрагивал в конце каждого
   жеста колеса. Экспонента сама доводит остаток за пару кадров. */
var DEAD = 0.00008;
var FAST_V = 0.55;        /* доля страницы в секунду, выше которой это уже перемотка */
var JUMP = 0.06;          /* прыжок за кадр, после которого включаем гипер */

var pTarget = 0, pSmooth = 0, vel = 0, last = 0;
var mode = "idle";        /* idle | scroll | fast | hyper */
var hyperUntil = 0;
var stillSince = 0;
var fps = 60, wantFps = 60;
var listeners = [];
var degrade = 0, heavy = 0, startedAt = 0, ts0 = 0;
var hintShown = 0, hintEl = null;

function maxScroll() {
  return Math.max(1, DOCH() - innerHeight);
}

function readScroll() {
  pTarget = Math.max(0, Math.min(1, (g.pageYOffset || doc.documentElement.scrollTop || 0) / maxScroll()));
}

addEventListener("scroll", readScroll, { passive: true });
addEventListener("resize", readScroll, { passive: true });
readScroll();
pSmooth = pTarget;

/* ── Подсказка «листайте дальше» ─────────────────────────────
   Показываем не чаще двух раз за визит и только если человек
   действительно завис в начале страницы, а не дочитал до конца. */
function hint() {
  /* На первом экране уже стоит своя подсказка прокрутки, и две
     сразу читались как ошибка вёрстки: одна плашка поверх карточек,
     вторая у края. Пока видна статичная - свою не показываем. */
  try {
    var own = doc.querySelector(".scroll-hint");
    if (own && getComputedStyle(own).display !== "none") {
      var r = own.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) return;
    }
  } catch (eH) {}
  if (reduced || hintShown >= 2 || pSmooth > 0.9) return;
  try {
    var seen = parseInt(sessionStorage.getItem("rc_hint") || "0", 10);
    if (seen >= 2) { hintShown = 2; return; }
    sessionStorage.setItem("rc_hint", String(seen + 1));
  } catch (e) {}
  hintShown++;
  if (!hintEl) {
    hintEl = doc.createElement("div");
    hintEl.className = "rc-hint";
    hintEl.setAttribute("role", "status");
    hintEl.textContent = doc.documentElement.lang === "en" ? "Keep scrolling" : "Листайте дальше";
    doc.body.appendChild(hintEl);
  }
  hintEl.classList.add("on");
  setTimeout(function () { if (hintEl) hintEl.classList.remove("on"); }, 3200);
}

/* ── Ступенчатая деградация ──────────────────────────────────
   Считаем подряд идущие тяжёлые кадры. Десять пар подряд - и мы
   снимаем очередной слой украшений. Обратно не откатываемся:
   мигание качеством раздражает сильнее, чем стабильно простая
   картинка. */
/* Отладочный ключ ?nodeg=1: снимает автоснижение качества. Нужен на
   проверках в софтверном браузере, где кадры тяжелы не из-за сайта, а
   из-за отсутствия видеокарты, и сцена сама себя выключает. */
var noDeg = false;
try { noDeg = location.search.indexOf("nodeg") > -1; } catch (e) {}

/* Окно наблюдения: доля тяжёлых кадров за последние сто. Счётчик
   «шестнадцать тяжёлых подряд» оказался слишком нервным: на телефоне
   такую серию даёт один быстрый свайп или первая сборка новой сцены,
   и качество падало навсегда - владелец видел вместо фильма голую
   страницу. Доля за окно переживает короткий всплеск и реагирует
   только на настоящую, длительную просадку. */
var WIN = 100;
/* Второе окно, под рваную картинку: считает пропущенные кадры
   монитора там, где первое считает только настоящие зависания. */
var рвWin = [], рвSum = 0;
/* Шаг самого экрана. Считать рывком всё, что дольше двадцати восьми
   миллисекунд, нельзя: бывают мониторы на тридцать герц и ноутбуки,
   которым система сама держит тридцать кадров на батарее. Там ровная
   картинка идёт шагом в тридцать три миллисекунды, и по жёсткому
   числу сайт упрощался бы ни за что. Поэтому шаг экрана мы наблюдаем:
   держим самый короткий из недавних и медленно его отпускаем. Рывок -
   это заметно дольше собственного шага, а не дольше числа. */
var шагЭкрана = 0.0167;
var win = [], winSum = 0, winAt = 0;
var stepAt = 0;               /* когда в последний раз меняли ступень */
var goodSince = 0;            /* с какого времени кадры уверенно хорошие */

/* Сцена, которая только что построилась, честно съедает несколько
   кадров. Судить её за это нельзя: акт сменился - даём паузу.

   Пауза короткая и, главное, она пропускает ЗАМЕР, а не отключает
   сторожа целиком. Прежде здесь стояло полторы секунды и выход из
   watchFrame по первой же строке. При прокрутке акты сменяются чаще,
   чем раз в полторы секунды, то есть сторож молчал ровно тогда, когда
   он и нужен - пока человек катит страницу и видит рывки. Замер
   живьём: восемьдесят восемь процентов кадров рваные, а ступень
   качества так и осталась нулевой за двадцать секунд. */
var calmUntil = 0;
addEventListener("rc:act", function () { calmUntil = ts0 + 500; });
addEventListener("rc:3d", function () { calmUntil = ts0 + 1200; });

function watchFrame(dt) {
  if (noDeg) return;
  /* Первые секунды не судим: там грузятся шрифты, картинки и сцены,
     кадры честно тяжёлые, и это не повод снимать украшения. */
  if (!startedAt) startedAt = ts0;
  if (ts0 - startedAt < 5000) return;

  /* Мерок две, и это важно.

     Была одна: кадр тяжелее пятидесяти миллисекунд, то есть ниже
     двадцати кадров в секунду. Такую просадку человек называет уже не
     рывками, а зависанием. Заказчик же написал «сайт лагает при
     прокрутке», а лагает он на тридцати-сорока кадрах: картинка идёт,
     но дёргается. Под старую мерку это не попадало никогда, и сторож
     молчал ровно там, где должен был работать.

     Теперь тяжёлый кадр (ниже двадцати) снимает украшения быстро, как
     и раньше, а рваный (пропущен хотя бы один кадр монитора, то есть
     ниже примерно тридцати шести) - медленно и только если рвётся
     больше двух третей времени подряд. Медленно потому, что редкий
     пропуск бывает у всех и качество не должно из-за него мигать.

     Вкладку без фокуса не судим вовсе: браузер там сам режет кадры,
     и по возвращении сайт встречал бы человека упрощённым ни за что. */
  if (doc.hidden) return;

  /* Кадры сразу после сборки сцены в окно не кладём, но решение по
     уже накопленному окну принимаем: иначе прокрутка сквозь акты
     обнуляет сторожа навсегда. */
  var судить = ts0 >= calmUntil;

  if (судить && dt > 0.004) {
    шагЭкрана = Math.min(шагЭкрана * 1.01, dt);
    if (шагЭкрана < 0.006) шагЭкрана = 0.006;
    if (шагЭкрана > 0.036) шагЭкрана = 0.036;
  }
  var bad = dt > 0.05 ? 1 : 0;         /* ниже двадцати кадров в секунду */
  var порогРывка = шагЭкрана * 1.7 + 0.004;
  var рвано = dt > порогРывка ? 1 : 0; /* заметно дольше своего шага */
  if (!судить) { /* этот кадр не наш */ }
  else if (win.length < WIN) { win.push(bad); winSum += bad; рвWin.push(рвано); рвSum += рвано; }
  else {
    winSum += bad - win[winAt];
    win[winAt] = bad;
    рвSum += рвано - рвWin[winAt];
    рвWin[winAt] = рвано;
    winAt = (winAt + 1) % WIN;
  }
  if (win.length < WIN) return;        /* окно ещё не набралось */

  var share = winSum / WIN;
  var рвДоля = рвSum / WIN;
  if (!stepAt) stepAt = ts0;

  /* Рваная картинка: шаг вниз с выдержкой в пять секунд. */
  if (рвДоля > 0.66 && share <= 0.5 && degrade < 3 && ts0 - stepAt > 2500) {
    degrade++;
    stepAt = ts0;
    goodSince = 0;
    winSum = 0; win.length = 0; winAt = 0; рвSum = 0; рвWin.length = 0;
    root.setAttribute("data-degrade", String(degrade));
    try {
      dispatchEvent(new CustomEvent("rc:degrade", { detail: { step: degrade, рвано: true } }));
    } catch (eР) {}
    return;
  }

  /* Вниз идём только на настоящей просадке: больше половины кадров
     тяжёлые, и это держится, а не мигнуло. */
  if (share > 0.5 && degrade < 3 && ts0 - stepAt > 3000) {
    degrade++;
    stepAt = ts0;
    goodSince = 0;
    winSum = 0; win.length = 0; winAt = 0; рвSum = 0; рвWin.length = 0;
    root.setAttribute("data-degrade", String(degrade));
    try {
      dispatchEvent(new CustomEvent("rc:degrade", { detail: { step: degrade } }));
    } catch (e) {}
    return;
  }

  /* И обязательно возвращаемся вверх. Раньше деградация была
     односторонней: одна тяжёлая секунда где-нибудь в середине - и до
     конца визита человек смотрел упрощённый сайт, даже когда телефон
     давно справлялся. Держим запас по времени, чтобы качество не
     мигало туда-сюда. */
  if (share < 0.12 && рвДоля < 0.20) {
    if (!goodSince) goodSince = ts0;
    if (degrade > 0 && ts0 - goodSince > 7000 && ts0 - stepAt > 7000) {
      degrade--;
      stepAt = ts0;
      goodSince = 0;
      winSum = 0; win.length = 0; winAt = 0; рвSum = 0; рвWin.length = 0;
      if (degrade > 0) root.setAttribute("data-degrade", String(degrade));
      else root.removeAttribute("data-degrade");
      try {
        dispatchEvent(new CustomEvent("rc:degrade", { detail: { step: degrade, up: true } }));
      } catch (e2) {}
    }
  } else {
    goodSince = 0;
  }
}

/* ── Главный цикл ────────────────────────────────────────── */
var raf = null;

function loop(ts) {
  raf = requestAnimationFrame(loop);
  if (doc.hidden) { last = 0; return; }

  var dt = last ? Math.min(0.08, (ts - last) / 1000) : 0.016;
  last = ts;
  ts0 = ts;
  watchFrame(dt);

  var before = pSmooth;
  var d = pTarget - pSmooth;

  /* Прыжок ползунком: короткая перемотка вместо честного проезда */
  if (Math.abs(d) > JUMP && ts > hyperUntil) {
    hyperUntil = ts + 500;
    setMode("hyper");
    if (g.RC_HOOKS && g.RC_HOOKS.settleAll) g.RC_HOOKS.settleAll();
  }

  var tau = ts < hyperUntil ? TAU_HYPER : TAU_NORM;
  if (Math.abs(d) < DEAD) pSmooth = pTarget;
  else pSmooth += d * (1 - Math.exp(-dt / tau));

  /* Скорость сглаживаем: иначе один рывок колеса выглядит как перемотка */
  var raw = (pSmooth - before) / Math.max(0.001, dt);
  vel = vel * 0.82 + raw * 0.18;

  var a = Math.abs(vel);
  if (ts < hyperUntil) setMode("hyper");
  else if (a > FAST_V) setMode("fast");
  else if (a > 0.008) setMode("scroll");
  else setMode("idle");

  /* Простой: роняем кадры и через восемь секунд подсказываем */
  if (mode === "idle") {
    if (!stillSince) stillSince = ts;
    var still = (ts - stillSince) / 1000;
    wantFps = still > 15 ? 20 : (still > 3 ? 30 : 60);
    if (still > 8 && !hintEl) hint();
  } else {
    stillSince = 0;
    wantFps = 60;
  }
  if (wantFps !== fps) {
    fps = wantFps;
    api.fps = fps;
    try { dispatchEvent(new CustomEvent("rc:fps", { detail: { fps: fps } })); } catch (e) {}
  }

  for (var i = 0; i < listeners.length; i++) {
    try { listeners[i](pSmooth, vel, mode); } catch (e) {}
  }
  api.p = pSmooth;
  api.v = vel;
}

function setMode(m) {
  if (m === mode) return;
  mode = m;
  api.mode = m;
  root.classList.toggle("rc-fast", m === "fast" || m === "hyper");
  root.classList.toggle("rc-hyper", m === "hyper");
  /* Выходя из быстрой прокрутки, доводим всё до конца: ни один
     счётчик не имеет права остаться на середине. */
  if (m !== "fast" && m !== "hyper" && g.RC_HOOKS && g.RC_HOOKS.settleAll) {
    g.RC_HOOKS.settleAll();
  }
  try { dispatchEvent(new CustomEvent("rc:mode", { detail: { mode: m } })); } catch (e) {}
}

var api = {
  p: 0, v: 0, mode: "idle", fps: 60, degrade: 0,
  on: function (fn) { if (typeof fn === "function") listeners.push(fn); },
  off: function (fn) {
    var i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  },
  /* Сколько кадров в секунду сейчас разумно рисовать сценам */
  minFrame: function () { return 1000 / fps; }
};
g.RC_MOTION = api;

/* ── Анимации за кромкой окна ────────────────────────────────
   На странице больше тридцати бесконечных анимаций: свечения кнопок,
   бегущая строка, дыхание голограмм, пульс колец. Пока раздел за
   кромкой окна, показать они ничего не могут, но браузер честно
   считает их каждый кадр - трассировка на телефоне насчитала по
   двести таких пересчётов стиля за один проход прокрутки.

   Ставим их на паузу, когда раздел ушёл из кадра, и снимаем с паузы
   заранее, за пол-экрана до возвращения. Анимации бесконечные и
   продолжаются с того же места, поэтому на глаз ничего не меняется:
   человек видит ровно ту же картинку, только кадры дешевле. */
(function () {
  if (!g.IntersectionObserver) return;
  var seen = null;
  function watch() {
    var list = doc.querySelectorAll("main > section, main > div, .epi, footer, header");
    if (!list.length) return;
    if (!seen) {
      seen = new IntersectionObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
          recs[i].target.classList.toggle("rc-off", !recs[i].isIntersecting);
        }
      }, { rootMargin: "50% 0px 50% 0px" });
    }
    for (var i = 0; i < list.length; i++) {
      if (list[i].__rcOff) continue;
      list[i].__rcOff = 1;
      seen.observe(list[i]);
    }
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", watch);
  else watch();
  addEventListener("rc:content", watch);
  doc.addEventListener("rc:lang", function () { setTimeout(watch, 150); });
})();

addEventListener("visibilitychange", function () {
  if (doc.hidden) { last = 0; return; }
  readScroll();
  pSmooth = pTarget;
});

if (!reduced) raf = requestAnimationFrame(loop);
else { api.p = pTarget; root.classList.add("rc-still"); }

})(window);
