/* ═══════════════════════════════════════════════════════════
   Rocket CDN · шлюз: настоящий вход в ракету

   Клиент описал вход дословно: «мы идём к ракете, открывается
   дверь, мы заходим». До сих пор между проходом к трапу (#cases)
   и салоном (#reliability) был обычный стык секций - обрыв.

   Здесь дверь. Пока человек долистывает проход, поверх кадра
   стоят две корпусные створки со светящейся щелью. Скролл ведёт
   их в стороны: щель ширится, из неё бьёт тёплый свет салона, и
   на полном раскрытии створки уходят за края кадра - мы внутри.
   Прокрутка назад закрывает дверь так же честно.

   Прокрутку никто не перехватывает: доля открытия считается из
   положения секции салона, само движение сглаживается в rAF.
   Слабое устройство, просьба меньше движения и демо-полёт дверь
   не видят вовсе.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var el = null, sec = null, raf = null;
var k = 0, kGoal = 0, live = false, hissed = false;

function build() {
  if (el) return;
  el = doc.createElement("div");
  el.className = "rc-airlock";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    '<div class="al-glow"></div>' +
    '<div class="al-door al-l"><i></i></div>' +
    '<div class="al-door al-r"><i></i></div>';
  doc.body.appendChild(el);
}

/* Доля открытия: дверь начинает открываться, когда салон в полутора
   экранах снизу, и распахнута полностью, когда его верх дошёл до
   трети экрана. Считаем от секции, а не от процентов страницы:
   правка текста выше по сайту дверь не собьёт. */
function measure() {
  var r = sec.getBoundingClientRect();
  var h = innerHeight;
  var start = h * 1.15, end = h * 0.42;
  var raw = (start - r.top) / (start - end);
  kGoal = raw < 0 ? 0 : (raw > 1 ? 1 : raw);
  live = r.top < h * 1.6 && r.top > -h * 0.5;
}

function frame() {
  raf = requestAnimationFrame(frame);
  if (doc.hidden || !el) return;
  if (root.classList.contains("rc-flying")) {
    if (el.classList.contains("on")) el.classList.remove("on");
    return;
  }
  measure();

  if (live !== el.classList.contains("on")) el.classList.toggle("on", live);
  if (!live) { k = kGoal; hissed = kGoal >= 1; return; }

  k += (kGoal - k) * 0.16;
  if (Math.abs(k - kGoal) < 0.001) k = kGoal;
  el.style.setProperty("--al-k", k.toFixed(4));

  /* Шипение пневматики один раз на открытие */
  if (k > 0.06 && !hissed) {
    hissed = true;
    if (g.RC_SOUND && g.RC_SOUND.blip) {
      try { g.RC_SOUND.blip(180, 0.5, "sawtooth", 0.02); g.RC_SOUND.blip(2400, 0.35, "triangle", 0.008); } catch (e) {}
    }
  }
  if (k < 0.03) hissed = false;
}

function boot() {
  if (reduced || root.classList.contains("rc-reduced")) return;
  if (root.getAttribute("data-degrade") === "3") return;
  sec = doc.getElementById("reliability");
  if (!sec) return;
  build();
  if (!raf) raf = requestAnimationFrame(frame);
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
else boot();

g.RC_AIRLOCK = { state: function () { return { доля: +k.toFixed(3), в_кадре: live }; } };

})(window);
