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

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var TAU_NORM = 0.09;      /* постоянная сглаживания, секунды */
var TAU_HYPER = 0.03;
var DEAD = 0.0004;        /* мёртвая зона: ниже неё считаем, что стоим */
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
  return Math.max(1, (doc.documentElement.scrollHeight || doc.body.scrollHeight) - innerHeight);
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
var win = [], winSum = 0, winAt = 0;
var stepAt = 0;               /* когда в последний раз меняли ступень */
var goodSince = 0;            /* с какого времени кадры уверенно хорошие */

/* Сцена, которая только что построилась, честно съедает несколько
   кадров. Судить её за это нельзя: акт сменился - даём паузу. */
var calmUntil = 0;
addEventListener("rc:act", function () { calmUntil = ts0 + 1500; });
addEventListener("rc:3d", function () { calmUntil = ts0 + 2500; });

function watchFrame(dt) {
  if (noDeg) return;
  /* Первые секунды не судим: там грузятся шрифты, картинки и сцены,
     кадры честно тяжёлые, и это не повод снимать украшения. */
  if (!startedAt) startedAt = ts0;
  if (ts0 - startedAt < 5000) return;
  if (ts0 < calmUntil) return;

  var bad = dt > 0.05 ? 1 : 0;         /* ниже двадцати кадров в секунду */
  if (win.length < WIN) { win.push(bad); winSum += bad; }
  else {
    winSum += bad - win[winAt];
    win[winAt] = bad;
    winAt = (winAt + 1) % WIN;
  }
  if (win.length < WIN) return;        /* окно ещё не набралось */

  var share = winSum / WIN;
  if (!stepAt) stepAt = ts0;

  /* Вниз идём только на настоящей просадке: больше половины кадров
     тяжёлые, и это держится, а не мигнуло. */
  if (share > 0.5 && degrade < 3 && ts0 - stepAt > 3000) {
    degrade++;
    stepAt = ts0;
    goodSince = 0;
    winSum = 0; win.length = 0; winAt = 0;
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
  if (share < 0.12) {
    if (!goodSince) goodSince = ts0;
    if (degrade > 0 && ts0 - goodSince > 7000 && ts0 - stepAt > 7000) {
      degrade--;
      stepAt = ts0;
      goodSince = 0;
      winSum = 0; win.length = 0; winAt = 0;
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

addEventListener("visibilitychange", function () {
  if (doc.hidden) { last = 0; return; }
  readScroll();
  pSmooth = pTarget;
});

if (!reduced) raf = requestAnimationFrame(loop);
else { api.p = pTarget; root.classList.add("rc-still"); }

})(window);
