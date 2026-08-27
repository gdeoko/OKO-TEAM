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
var kPrev = 0, unlockT = 0;
/* Защёлка «мы у борта»: взводится, когда подход почти завершён, и
   держит дверь живой, пока секция в кадре. Без неё на телефоне
   (секции сжаты) створки успевали разъехаться раньше, чем подход
   доходил до корабля, и вход выпадал вовсе. */
var armed = false;

function build() {
  if (el) return;
  el = doc.createElement("div");
  el.className = "rc-airlock";
  el.setAttribute("aria-hidden", "true");
  /* Каждая створка несёт свою «жизнь»: слева иллюминатор и трафарет
     ROCKET, справа трафарет CDN-01. Над стыком - сегментное табло,
     два слоя которого (янтарный и циановый) перетекают по --al-k. */
  el.innerHTML =
    '<div class="al-glow"></div>' +
    '<div class="al-hull">' +
      '<div class="al-door al-l"><i></i>' +
        '<span class="al-port"></span>' +
        '<span class="al-stencil">ROCKET</span></div>' +
      '<div class="al-door al-r"><i></i>' +
        '<span class="al-stencil">CDN-01</span></div>' +
      '<div class="al-board"><span class="al-amber"></span><span class="al-cyan"></span></div>' +
    '</div>';
  doc.body.appendChild(el);
}

/* Доля открытия: дверь начинает открываться, когда салон в полутора
   экранах снизу, и распахнута полностью, когда его верх дошёл до
   трети экрана. Считаем от секции, а не от процентов страницы:
   правка текста выше по сайту дверь не собьёт. */
function measure() {
  var r = sec.getBoundingClientRect();
  var h = innerHeight;
  /* На телефоне секции сжаты втрое, и дверь, рассчитанная на
     десктопную длину прохода, стояла на экране через две секции
     контента. Окно двери должно быть коротким: появились - тут же
     поехали - ушли. */
  var start = Math.min(h * 1.15, h * 0.55 + 260), end = h * 0.42;
  var raw = (start - r.top) / (start - end);
  kGoal = raw < 0 ? 0 : (raw > 1 ? 1 : raw);
  live = r.top < start + h * 0.12 && r.top > -h * 0.5;
}

function frame() {
  raf = requestAnimationFrame(frame);
  if (doc.hidden || !el) return;
  if (root.classList.contains("rc-flying")) {
    if (el.classList.contains("on")) el.classList.remove("on");
    return;
  }
  measure();

  /* Дверь - у корпуса ракеты: пока мы не подошли к нему вплотную
     (RC_APPROACH из rc-rocket), створкам в кадре делать нечего.
     Если ракеты на странице нет, подход равен единице - дверь
     живёт по прежним правилам. */
  var app = (typeof g.RC_APPROACH === "number") ? g.RC_APPROACH : 1;
  if (app > 0.9) armed = true;
  if (!live) armed = false;
  var show = live && (armed || app > 0.55);
  if (show !== el.classList.contains("on")) {
    el.classList.toggle("on", show);
    /* Пока дверь борта в кадре, тамбур интерьера (rc-int-lock) молчит:
       его тёмные створки лежали поверх шлюза, и человек видел чёрный
       кадр вместо двери. Вход один - через борт. */
    root.classList.toggle("rc-albay", show);
  }
  /* Дверь проявляется по мере подхода, а не по таймеру: на 0.55
     подхода её ещё нет, к 0.88 борт встал плотно. Скролл назад так
     же честно растворяет её обратно в ракету */
  if (show) el.style.setProperty("--al-in", armed ? "1" : Math.max(0, Math.min(1, (app - 0.55) / 0.33)).toFixed(3));
  /* Затвор подходом: створки не смеют разъехаться, пока мы не дошли
     до борта. На телефоне окно двери и проход почти совпадают, и без
     затвора дверь уезжала раньше, чем появлялась. */
  var goal = kGoal * (armed ? 1 : Math.max(0, Math.min(1, (app - 0.5) / 0.4)));
  /* Канвас ракеты гаснет не при появлении двери, а когда она уже
     открывается: до этого борт и дверь стоят одним кораблём */
  var inside = show && k > 0.22;
  if (inside !== root.classList.contains("rc-doors")) root.classList.toggle("rc-doors", inside);
  if (!show) { k = goal; kPrev = k; hissed = goal >= 1; return; }

  k += (goal - k) * 0.16;
  if (Math.abs(k - goal) < 0.001) k = goal;
  el.style.setProperty("--al-k", k.toFixed(4));

  /* «Отдача» замков: в момент, когда дверь только тронулась (доля
     прошла порог вверх), створки коротко дёргаются внутрь и назад -
     как будто расцепились фиксаторы. Класс живёт 300 мс. */
  if (kPrev <= 0.04 && k > 0.04) {
    el.classList.add("al-unlock");
    clearTimeout(unlockT);
    unlockT = setTimeout(function () { if (el) el.classList.remove("al-unlock"); }, 300);
  }
  kPrev = k;

  /* Шипение пневматики один раз на открытие */
  if (k > 0.06 && !hissed) {
    hissed = true;
    var пневматика = false;
    if (g.RC_SOUND && g.RC_SOUND.dock) {
      try { пневматика = g.RC_SOUND.dock(); } catch (e) {}
    }
    /* Пока запись не доехала, шипение остаётся синтезом: тишины в
       момент открытия дверей быть не должно. */
    if (!пневматика && g.RC_SOUND && g.RC_SOUND.blip) {
      try { g.RC_SOUND.blip(180, 0.5, "sawtooth", 0.02); g.RC_SOUND.blip(2400, 0.35, "triangle", 0.008); } catch (e) {}
    }
  }
  if (k < 0.03) hissed = false;
}

function boot() {
  if (reduced || root.classList.contains("rc-reduced")) return;
  if (root.getAttribute("data-degrade") === "3") return;
  /* Если на странице живёт трёхмерный корабль, дверь рисует он сам:
     люк - часть его борта (rc-rocket, buildDoor). Оверлей остаётся
     только запасным входом для упрощённого режима и для устройств
     без WebGL, где ракеты нет вовсе. Проверяем с задержкой: сцена
     поднимается позже разметки. */
  if (g.RC_ROCKET || document.documentElement.classList.contains("has-rocket")) return;
  sec = doc.getElementById("reliability");
  if (!sec) return;
  build();
  if (!raf) raf = requestAnimationFrame(frame);
}

/* Ждём, пока сцена решит, поднялся ли корабль: rc-gl грузит цепочку
   скриптов асинхронно, и на момент DOMContentLoaded RC_ROCKET ещё нет.

   Таймер здесь был гонкой: на медленной машине корабль поднимался
   позже отведённых секунды с небольшим, и оверлей строился вдобавок
   к настоящему люку - в кадре оказывались две двери сразу. Поэтому
   ждём не время, а событие готовности объёмного слоя, и лишь если
   его нет вовсе, включаем запасной вход. */
function bootLater() {
  var tries = 0;
  function check() {
    if (g.RC_ROCKET || root.classList.contains("has-rocket")) return;  /* дверь рисует корабль */
    if (root.classList.contains("rc-no3d") || root.getAttribute("data-degrade") === "3") { boot(); return; }
    if (++tries > 40) { boot(); return; }        /* двадцать секунд - сцены не будет */
    setTimeout(check, 500);
  }
  addEventListener("rc:3d", function () { setTimeout(check, 600); });
  addEventListener("rc:no3d", function () { boot(); });
  setTimeout(check, 1200);
}
if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", bootLater);
else bootLater();

g.RC_AIRLOCK = { state: function () { return { доля: +k.toFixed(3), в_кадре: live }; } };

})(window);
