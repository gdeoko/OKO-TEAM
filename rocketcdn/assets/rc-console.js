/* ═══════════════════════════════════════════════════════════
   Rocket CDN · пульт: последняя сцена фильма

   Сценарий заканчивается тем, что человек, осмотрев рубку,
   подходит к панели управления и оставляет заявку. До сих пор
   этот момент был обычной формой на фоне: обрыв, который владелец
   и назвал «резким переходом».

   Здесь пульт становится сценой. Снимок панели сделан в фирменной
   палитре и лежит фоном за формой, а поверх него живёт тонкий слой
   рисования: индикаторы дышат, по кромке идёт блик, у края бежит
   строка телеметрии. Никакого видеофайла - кадры считаются на
   месте, поэтому вес сцены равен весу одной картинки.

   Подход к пульту привязан к прокрутке: пока человек листает от
   рубки к форме, камера едет вперёд, панель растёт и выходит из
   расфокуса. Останавливаемся ровно тогда, когда форма готова к
   заполнению - дальше сцена замирает и не мешает вводу.

   Правила те же, что во всём фильме: прокрутку не перехватываем,
   при просьбе меньше движения показываем статичный кадр, на
   слабом устройстве не поднимаемся вовсе, а форма работает
   всегда и при любом раскладе.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var sec = null, layer = null, img = null, cv = null, x = null;
var raf = null, t = 0, last = 0, ready = false, shown = false;
var p = 0, pShow = 0;

/* Индикаторы панели: доли от размера картинки. Координаты сняты с
   самого снимка, поэтому огоньки садятся ровно на кнопки. */
var LAMPS = [
  [0.34, 0.63], [0.36, 0.63], [0.38, 0.63], [0.40, 0.63],
  [0.34, 0.67], [0.36, 0.67], [0.38, 0.67], [0.40, 0.67],
  [0.63, 0.63], [0.65, 0.63], [0.67, 0.63],
  [0.84, 0.68], [0.86, 0.68], [0.88, 0.68],
  [0.11, 0.70], [0.13, 0.70], [0.15, 0.70],
  [0.33, 0.40], [0.36, 0.40], [0.39, 0.40],
  [0.60, 0.40], [0.62, 0.40]
];

function build() {
  if (layer || !sec) return;
  layer = doc.createElement("div");
  layer.className = "rc-console";
  layer.setAttribute("aria-hidden", "true");

  img = doc.createElement("img");
  img.src = "assets/gen/console.webp";
  img.alt = "";
  img.decoding = "async";
  img.loading = "lazy";
  img.width = 1344; img.height = 768;

  cv = doc.createElement("canvas");
  cv.className = "rc-console-live";

  layer.appendChild(img);
  layer.appendChild(cv);
  sec.insertBefore(layer, sec.firstChild);
  /* Ролик подхода тянем не сразу: полмегабайта видео не должны
     ехать раньше первого экрана. Наблюдатель заводит его за
     полтора-два экрана до пульта - к подходу кадры уже готовы. */
  if ("IntersectionObserver" in g) {
    var vio = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) {
        if (es[i].isIntersecting) { vidBuild(); vio.disconnect(); break; }
      }
    }, { rootMargin: "1800px 0px" });
    vio.observe(sec);
  } else {
    vidBuild();
  }

  img.onload = function () {
    ready = true;
    layer.classList.add("on");
    size();
  };
  img.onerror = function () {
    /* Снимка нет - если есть ролик, сцена живёт им; нет и ролика -
       убираем слой целиком, форма от этого не страдает */
    if (vid && vidOk) return;
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    layer = null;
  };
  x = cv.getContext("2d");
}

/* ── Подход к пульту: кадры видео идут за прокруткой ──────────
   Снимок панели оживлён в видео: камера подъезжает к пульту, а в
   иллюминаторе выходит планета. Ролик не проигрывается сам по
   себе - его ведёт прокрутка, кадр в кадр. Человек листает вниз,
   и это буквально его собственный шаг к панели: остановился -
   встало и изображение.

   Ролик закодирован так, что каждый кадр ключевой: перемотка в
   любую точку мгновенная, без подгрузки соседних кадров. Иначе
   скольжение по времени превращается в рывки.

   Перематываем не чаще двенадцати раз в секунду и только когда
   цель ушла дальше кадра - иначе декодер захлёбывается на запросах
   и как раз получаются те подтормаживания, на которые жаловались.
   На узком экране берём вдвое меньший файл. */
var vid = null, vidOk = false, vidAt = 0, vidWant = 0, seekAt = 0, seeking = false;

function vidBuild() {
  if (vid || !layer) return;
  /* Слабое устройство или просьба меньше движения - остаёмся на
     статичном снимке, он и так хорош */
  if (reduced || root.getAttribute("data-degrade") === "3") return;

  var small = innerWidth < 900 || (g.devicePixelRatio || 1) < 1.2;
  vid = doc.createElement("video");
  /* H.264 понимают все браузеры, где этот сайт вообще открывают, и
     он вдвое легче. Запасной webm нужен ровно для сборок Chromium
     без проприетарных кодеков - в них mp4 просто не проигрывается,
     а сцена обрываться не должна. */
  var mp4 = "";
  try { mp4 = vid.canPlayType('video/mp4; codecs="avc1.4d401f"'); } catch (e) {}
  vid.className = "rc-console-vid";
  vid.muted = true;
  vid.defaultMuted = true;
  vid.playsInline = true;
  vid.setAttribute("playsinline", "");
  vid.setAttribute("muted", "");
  vid.setAttribute("aria-hidden", "true");
  vid.preload = "auto";
  vid.disablePictureInPicture = true;
  vid.controls = false;
  vid.src = mp4 ? (small ? "assets/gen/console-640.mp4" : "assets/gen/console-960.mp4")
                : "assets/gen/console-640.webm";

  vid.addEventListener("loadedmetadata", function () {
    vidOk = vid.duration > 0.5;
    if (vidOk) {
      layer.classList.add("has-vid");
      /* Сцена больше не ждёт снимок: кадр даёт ролик. Снимок грузится
         лениво и на быстрой прокрутке легко опаздывает - привязывать
         к нему показ всей панели значит иногда не показать её вовсе. */
      ready = true;
      layer.classList.add("on");
      size();
    }
    /* Первый кадр надо вытащить принудительно: без этого на части
       браузеров видео остаётся пустым до первого проигрывания. */
    try { vid.currentTime = 0.01; } catch (e) {}
  });
  vid.addEventListener("seeked", function () { seeking = false; });
  vid.addEventListener("error", function () {
    vidOk = false;
    if (vid && vid.parentNode) vid.parentNode.removeChild(vid);
    vid = null;
    if (layer) layer.classList.remove("has-vid");
  });

  layer.insertBefore(vid, cv);
}

/* Ведём кадр за прокруткой: доля подхода p - это и есть время
   ролика. Держим небольшое отставание, чтобы движение выглядело
   как ход камеры, а не как рывок мыши. */
function vidSeek(ts) {
  if (!vid || !vidOk) return;
  var dur = vid.duration || 6;
  vidWant = Math.max(0, Math.min(0.985, p)) * dur;
  vidAt += (vidWant - vidAt) * 0.18;
  if (seeking || ts - seekAt < 82) return;
  if (Math.abs(vid.currentTime - vidAt) < dur / 90) return;
  seekAt = ts;
  seeking = true;
  try { vid.currentTime = vidAt; } catch (e) { seeking = false; }
}

function size() {
  if (!cv || !layer) return;
  var r = layer.getBoundingClientRect();
  var k = Math.min(2, g.devicePixelRatio || 1);
  var w = Math.round((r.width || innerWidth) * k);
  var h = Math.round((r.height || innerHeight * 0.6) * k);
  if (w < 8 || h < 8) return;
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
}

/* ── Живой слой ──────────────────────────────────────────────
   Индикаторы дышат от общего таймера с фазовым сдвигом, по
   верхней кромке панели идёт блик, у правого края бежит тонкая
   строка телеметрии. Всё в фирменных цветах и очень тихо: пульт
   не должен спорить с формой, стоящей поверх него. */
function frame(dt) {
  if (!x || !cv || !ready) return;
  size();
  var W = cv.width, H = cv.height;
  if (W < 8 || H < 8) return;
  x.clearRect(0, 0, W, H);

  var i, l, ph, b;

  /* Под видео своих огней рисовать нельзя: камера едет, а точки
     сняты с неподвижного кадра и поехали бы мимо кнопок. Там
     панель светится сама, а от нас нужен только отклик на
     человека - тёплое пятно под рукой и вспышка при отправке. */
  if (vid && vidOk) {
    if (hoverX >= 0) {
      var hx = hoverX * W, hy = hoverY * H, hr = Math.max(60, W * 0.12);
      var hg = x.createRadialGradient(hx, hy, 0, hx, hy, hr);
      hg.addColorStop(0, "rgba(66,178,220,.16)");
      hg.addColorStop(0.55, "rgba(138,89,246,.07)");
      hg.addColorStop(1, "rgba(66,178,220,0)");
      x.fillStyle = hg;
      x.beginPath(); x.arc(hx, hy, hr, 0, 6.283); x.fill();
    }
    if (flash > 0.01) {
      x.fillStyle = "rgba(207,233,245," + (flash * 0.20).toFixed(3) + ")";
      x.fillRect(0, 0, W, H);
      flash *= 0.9;
    }
    x.fillStyle = "rgba(66,178,220,.42)";
    for (i = 0; i < 12; i++) {
      var vy = H * (0.30 + i * 0.028);
      var vl = W * (0.010 + 0.016 * Math.abs(Math.sin(t * 0.8 + i * 1.7)));
      x.fillRect(W * 0.965 - vl, vy, vl, Math.max(1, H * 0.003));
    }
    return;
  }

  /* Индикаторы */
  for (i = 0; i < LAMPS.length; i++) {
    l = LAMPS[i];
    ph = i * 0.9;
    b = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(t * 1.4 + ph)), 2);
    /* Ближе к курсору - ярче: панель чувствует руку */
    if (hoverX >= 0) {
      var hd = Math.sqrt((l[0] - hoverX) * (l[0] - hoverX) + (l[1] - hoverY) * (l[1] - hoverY));
      if (hd < 0.22) b = Math.min(1.35, b + (0.22 - hd) * 3.4);
    }
    if (flash > 0.01) b = Math.min(1.6, b + flash * 1.2);
    var lx = l[0] * W, ly = l[1] * H;
    var rad = Math.max(2, W * 0.0042) * (0.7 + b * 0.6);
    var gr = x.createRadialGradient(lx, ly, 0, lx, ly, rad * 3.2);
    var col = i % 5 === 0 ? "138,89,246" : "66,178,220";
    gr.addColorStop(0, "rgba(" + col + "," + (0.75 * b).toFixed(3) + ")");
    gr.addColorStop(1, "rgba(" + col + ",0)");
    x.fillStyle = gr;
    x.beginPath(); x.arc(lx, ly, rad * 3.2, 0, 6.283); x.fill();
  }

  if (flash > 0.001) flash *= 0.93;

  /* Блик по кромке панели: медленно уезжает слева направо */
  var bx = ((t * 0.11) % 1.4 - 0.2) * W;
  var bg = x.createLinearGradient(bx - W * 0.18, 0, bx + W * 0.18, 0);
  bg.addColorStop(0, "rgba(207,233,245,0)");
  bg.addColorStop(0.5, "rgba(207,233,245,.16)");
  bg.addColorStop(1, "rgba(207,233,245,0)");
  x.fillStyle = bg;
  x.fillRect(0, H * 0.33, W, H * 0.035);

  /* Строка телеметрии у правого края: короткие штрихи разной длины */
  x.fillStyle = "rgba(66,178,220,.5)";
  for (i = 0; i < 14; i++) {
    var ty = H * (0.42 + i * 0.021);
    var len = W * (0.012 + 0.02 * Math.abs(Math.sin(t * 0.9 + i * 1.7)));
    x.fillRect(W * 0.955 - len, ty, len, Math.max(1, H * 0.0035));
  }
}

/* ── Подход к пульту ─────────────────────────────────────────
   Пока блок контактов идёт через кадр, камера едет вперёд: панель
   растёт, выходит из расфокуса и слегка опускается, будто человек
   подошёл и сел. У самой формы движение останавливается. */
function place() {
  if (!layer || !sec) return;
  var r = sec.getBoundingClientRect();
  var h = innerHeight;
  var raw = (h - r.top) / (h + Math.min(r.height, h * 1.4));
  p = raw < 0 ? 0 : (raw > 1 ? 1 : raw);
  /* Мягкое приближение: 0 - панель далеко и мягкая, 1 - вплотную */
  var k = p < 0.72 ? p / 0.72 : 1;
  k = k * k * (3 - 2 * k);
  pShow += (k - pShow) * 0.12;

  layer.style.setProperty("--con-scale", (1.02 + pShow * 0.16).toFixed(4));
  layer.style.setProperty("--con-y", ((0.5 - pShow) * -34).toFixed(1) + "px");
  layer.style.setProperty("--con-blur", ((1 - pShow) * 5).toFixed(2) + "px");
  layer.style.setProperty("--con-vis", (0.25 + pShow * 0.75).toFixed(3));

  root.classList.toggle("rc-console-near", pShow > 0.55);

  var live = r.bottom > -200 && r.top < h + 200;
  if (live !== shown) {
    shown = live;
    layer.classList.toggle("live", live);
  }
}

function loop(ts) {
  raf = requestAnimationFrame(loop);
  if (doc.hidden) { last = 0; return; }
  var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
  last = ts;

  place();
  if (!shown) return;
  vidSeek(ts);
  /* На стоящей странице хватает пятнадцати кадров: пульт только
     дышит, гнать шестьдесят ради этого незачем. */
  t += dt;
  if (root.classList.contains("rc-fast")) return;
  if (ts - (loop._at || 0) < 62) return;
  loop._at = ts;
  frame(dt);
}

/* ── Живая панель ────────────────────────────────────────────
   Пульт отзывается на человека: под курсором ближайшие индикаторы
   разгораются, при отправке заявки по панели проходит вспышка.
   Это дешёвые вещи, но именно они превращают картинку в прибор. */
var hoverX = -1, hoverY = -1, flash = 0;

function watch() {
  if (!sec) return;
  sec.addEventListener("pointermove", function (e) {
    if (!layer) return;
    var r = layer.getBoundingClientRect();
    hoverX = (e.clientX - r.left) / Math.max(1, r.width);
    hoverY = (e.clientY - r.top) / Math.max(1, r.height);
  }, { passive: true });
  sec.addEventListener("pointerleave", function () { hoverX = hoverY = -1; }, { passive: true });

  /* Отправка заявки: панель отвечает вспышкой и щелчком */
  var form = sec.querySelector("form");
  if (form) form.addEventListener("submit", function () {
    flash = 1;
    if (g.RC_SOUND && g.RC_SOUND.blip) { try { g.RC_SOUND.blip(520); } catch (e) {} }
  });

  /* Пока человек в поле, экран считается включённым: рамка ярче */
  doc.addEventListener("focusin", function (e) {
    if (sec.contains(e.target)) root.classList.add("rc-console-near");
  }, true);
}

function boot() {
  if (reduced || root.classList.contains("rc-reduced")) return;
  if (root.getAttribute("data-degrade") === "3") return;
  sec = doc.getElementById("contact");
  if (!sec) return;
  build();
  watch();
  if (!raf) raf = requestAnimationFrame(loop);
}

addEventListener("resize", function () { setTimeout(size, 200); }, { passive: true });
addEventListener("rc:degrade", function (e) {
  var step = (e && e.detail && e.detail.step) || 0;
  if (step >= 3 && layer) { layer.classList.remove("on"); }
});

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 300); });
else setTimeout(boot, 300);

g.RC_CONSOLE = {
  state: function () {
    return {
      собрана: !!layer, готова: ready, видна: shown, подход: pShow.toFixed(2),
      ролик: !!vid, кадры: vidOk, время: vid ? +vid.currentTime.toFixed(2) : null,
      цель: +vidAt.toFixed(2), перемотка: seeking, доля: +p.toFixed(2)
    };
  }
};

})(window);
