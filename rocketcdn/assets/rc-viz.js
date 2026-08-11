/* ═══════════════════════════════════════════════════════════
   RocketCDN · инфографика.
   Всё рисуется на canvas и SVG, без внешних библиотек.
   Каждый виджет оживает, когда попадает в экран, и засыпает,
   когда уходит, чтобы не жечь батарею.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

function ease(t) { return 1 - Math.pow(1 - t, 3); }
function themeLight() { return document.documentElement.getAttribute("data-theme") === "light"; }

/* Запуск один раз при появлении в экране */
function onView(el, fn, once) {
  if (!("IntersectionObserver" in g)) { fn(true); return; }
  var io = new IntersectionObserver(function (ents) {
    ents.forEach(function (e) {
      if (e.isIntersecting) { fn(true); if (once !== false) io.unobserve(e.target); }
      else if (once === false) fn(false);
    });
  }, { threshold: 0.25 });
  io.observe(el);
}

/* Плавный тик от 0 до 1 */
function anim(dur, step, done) {
  if (REDUCE) { step(1); if (done) done(); return; }
  var t0 = performance.now();
  (function loop(now) {
    var k = Math.min(1, (now - t0) / dur);
    step(ease(k));
    if (k < 1) requestAnimationFrame(loop);
    else if (done) done();
  })(t0);
}

function fmt(n, dec) {
  return dec ? n.toFixed(dec).replace(".", ",") : Math.round(n).toLocaleString("ru-RU");
}

/* ── 1. Сравнение задержки ───────────────────────────────── */
function latency(box) {
  var rows = [
    { k: "direct", label: box.dataset.l1 || "Без сети доставки", ms: 340, cls: "bad" },
    { k: "cdn",    label: box.dataset.l2 || "Через Rocket CDN",  ms: 28,  cls: "good" }
  ];
  var max = 380;
  box.innerHTML = rows.map(function (r) {
    return '<div class="lat-row ' + r.cls + '">' +
      '<div class="lat-top"><span>' + r.label + '</span><b data-ms="' + r.ms + '">0 мс</b></div>' +
      '<div class="lat-track"><i style="width:0"></i></div></div>';
  }).join("");

  onView(box, function () {
    $$(".lat-row", box).forEach(function (row, i) {
      var b = $("b", row), bar = $(".lat-track i", row);
      var ms = +b.dataset.ms;
      setTimeout(function () {
        anim(1300, function (k) {
          b.textContent = fmt(ms * k) + " мс";
          bar.style.width = (ms / max * 100 * k).toFixed(2) + "%";
        });
      }, i * 260);
    });
  });
}

/* ── 2. Кольцо попаданий в кэш ───────────────────────────── */
function donut(box) {
  var val = +(box.dataset.value || 94);
  var R = 54, C2 = 2 * Math.PI * R;
  box.innerHTML =
    '<svg viewBox="0 0 140 140" class="donut">' +
      '<defs><linearGradient id="dgr' + box.id + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#5BC4EA"/><stop offset="1" stop-color="#8A59F6"/>' +
      '</linearGradient></defs>' +
      '<circle cx="70" cy="70" r="' + R + '" class="dn-bg"/>' +
      '<circle cx="70" cy="70" r="' + R + '" class="dn-val" stroke="url(#dgr' + box.id + ')" ' +
        'stroke-dasharray="' + C2 + '" stroke-dashoffset="' + C2 + '"/>' +
    '</svg>' +
    '<div class="dn-mid"><b>0%</b><span>' + (box.dataset.caption || "попаданий в кэш") + "</span></div>";

  var ring = $(".dn-val", box), num = $(".dn-mid b", box);
  onView(box, function () {
    anim(1600, function (k) {
      ring.style.strokeDashoffset = (C2 - C2 * (val / 100) * k).toFixed(2);
      num.textContent = fmt(val * k) + "%";
    });
  });
}

/* ── 3. Шкала доступности ────────────────────────────────── */
function gauge(box) {
  var val = parseFloat(box.dataset.value || "99.9");
  var lo = parseFloat(box.dataset.min || "99"), hi = 100;
  var A0 = Math.PI * 0.75, A1 = Math.PI * 2.25;   /* дуга снизу слева до снизу справа */
  var R = 58, cx = 75, cy = 75;

  function arc(a0, a1) {
    var x0 = cx + Math.cos(a0) * R, y0 = cy + Math.sin(a0) * R;
    var x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
    var big = (a1 - a0) > Math.PI ? 1 : 0;
    return "M" + x0.toFixed(2) + " " + y0.toFixed(2) + " A" + R + " " + R + " 0 " + big + " 1 " + x1.toFixed(2) + " " + y1.toFixed(2);
  }
  box.innerHTML =
    '<svg viewBox="0 0 150 132" class="gauge">' +
      '<defs><linearGradient id="ggr' + box.id + '" x1="0" y1="1" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#0A5897"/><stop offset="0.6" stop-color="#42B2DC"/><stop offset="1" stop-color="#8A59F6"/>' +
      '</linearGradient></defs>' +
      '<path d="' + arc(A0, A1) + '" class="ga-bg"/>' +
      '<path d="' + arc(A0, A1) + '" class="ga-val" stroke="url(#ggr' + box.id + ')"/>' +
      '<circle class="ga-dot" r="6" cx="' + (cx + Math.cos(A0) * R) + '" cy="' + (cy + Math.sin(A0) * R) + '"/>' +
    "</svg>" +
    '<div class="ga-mid"><b>0%</b><span>' + (box.dataset.caption || "доступность по SLA") + "</span></div>";

  var path = $(".ga-val", box), dot = $(".ga-dot", box), num = $(".ga-mid b", box);
  var len = path.getTotalLength();
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = len;

  onView(box, function () {
    var frac = (val - lo) / (hi - lo);
    anim(1700, function (k) {
      var f = frac * k;
      path.style.strokeDashoffset = (len - len * f).toFixed(2);
      var a = A0 + (A1 - A0) * f;
      dot.setAttribute("cx", (cx + Math.cos(a) * R).toFixed(2));
      dot.setAttribute("cy", (cy + Math.sin(a) * R).toFixed(2));
      num.textContent = fmt(lo + (val - lo) * k, 1) + "%";
    });
  });
}

/* ── 4. Живой график трафика ─────────────────────────────── */
function wave(box) {
  var cv = document.createElement("canvas");
  cv.className = "wave-cv";
  box.appendChild(cv);
  var readout = document.createElement("div");
  readout.className = "wave-read";
  readout.innerHTML = '<b>0</b><span>Гбит/с сейчас</span>';
  box.appendChild(readout);

  var x = cv.getContext("2d");
  var N = 120, data = new Array(N).fill(0.5), t = 0, running = false, raf = 0;
  var num = $("b", readout);

  function size() {
    var r = cv.getBoundingClientRect();
    var dpr = Math.min(2, g.devicePixelRatio || 1);
    cv.width = Math.max(1, r.width * dpr);
    cv.height = Math.max(1, r.height * dpr);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    cv._w = r.width; cv._h = r.height;
  }
  size();
  addEventListener("resize", function () { clearTimeout(box._rt); box._rt = setTimeout(size, 200); });

  function frame() {
    if (!running) return;
    t += 0.032;
    /* Складываем несколько синусов и лёгкий шум - выглядит как живой трафик */
    var v = 0.52
      + Math.sin(t * 0.9) * 0.16
      + Math.sin(t * 2.3 + 1.1) * 0.09
      + Math.sin(t * 5.1 + 0.4) * 0.05
      + (Math.random() - 0.5) * 0.05;
    v = Math.max(0.08, Math.min(0.96, v));
    data.push(v); data.shift();

    var W = cv._w, H = cv._h, light = themeLight();
    x.clearRect(0, 0, W, H);

    /* Сетка */
    x.strokeStyle = light ? "rgba(9,19,32,.07)" : "rgba(226,232,240,.07)";
    x.lineWidth = 1;
    for (var i = 1; i < 4; i++) {
      var y = H * i / 4;
      x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke();
    }

    function pt(i) { return [i / (N - 1) * W, H - data[i] * H * 0.86 - H * 0.07]; }

    /* Заливка */
    var gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "rgba(66,178,220,.34)");
    gr.addColorStop(1, "rgba(66,178,220,0)");
    x.beginPath();
    x.moveTo(0, H);
    for (i = 0; i < N; i++) { var p = pt(i); x.lineTo(p[0], p[1]); }
    x.lineTo(W, H);
    x.closePath();
    x.fillStyle = gr; x.fill();

    /* Линия */
    x.beginPath();
    for (i = 0; i < N; i++) { p = pt(i); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }
    x.strokeStyle = light ? "#0A5897" : "#5BC4EA";
    x.lineWidth = 2; x.lineJoin = "round";
    x.stroke();

    /* Головная точка */
    p = pt(N - 1);
    var glow = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], 14);
    glow.addColorStop(0, "rgba(138,89,246,.85)");
    glow.addColorStop(1, "rgba(138,89,246,0)");
    x.fillStyle = glow;
    x.beginPath(); x.arc(p[0], p[1], 14, 0, Math.PI * 2); x.fill();
    x.fillStyle = light ? "#8A59F6" : "#C9B4FF";
    x.beginPath(); x.arc(p[0], p[1], 3.2, 0, Math.PI * 2); x.fill();

    num.textContent = fmt(760 + v * 1900);
    raf = requestAnimationFrame(frame);
  }

  onView(box, function (vis) {
    running = vis && !REDUCE;
    if (running) frame();
    else { cancelAnimationFrame(raf); }
  }, false);

  if (REDUCE) { running = true; frame(); running = false; }
}

/* ── 5. Схема сети ───────────────────────────────────────── */
function topology(box) {
  var W = 640, H = 300;
  var origin = { x: 60, y: 150 };
  var dcs = [
    { x: 250, y: 62,  name: box.dataset.dc1 || "Москва" },
    { x: 250, y: 150, name: box.dataset.dc2 || "Алматы" },
    { x: 250, y: 238, name: box.dataset.dc3 || "Прага" }
  ];
  var edges = [];
  for (var i = 0; i < 9; i++) {
    edges.push({ x: 470 + (i % 3) * 62, y: 44 + Math.floor(i / 3) * 88 + (i % 3) * 14 });
  }

  function path(a, b) {
    var mx = (a.x + b.x) / 2;
    return "M" + a.x + " " + a.y + " C" + mx + " " + a.y + " " + mx + " " + b.y + " " + b.x + " " + b.y;
  }

  var links = "";
  dcs.forEach(function (d) { links += '<path class="tp-link" d="' + path(origin, d) + '"/>'; });
  edges.forEach(function (e, k) {
    var d = dcs[k % 3];
    links += '<path class="tp-link tp-thin" d="' + path(d, e) + '"/>';
  });

  var pulses = "";
  for (i = 0; i < 3; i++) {
    pulses += '<circle class="tp-pulse" r="3.6"><animateMotion dur="' + (2.2 + i * 0.35) + 's" repeatCount="indefinite" ' +
      'begin="' + (i * 0.5) + 's" path="' + path(origin, dcs[i]) + '"/></circle>';
  }
  edges.forEach(function (e, k) {
    var d = dcs[k % 3];
    pulses += '<circle class="tp-pulse tp-p2" r="2.6"><animateMotion dur="' + (1.6 + (k % 5) * 0.3) + 's" repeatCount="indefinite" ' +
      'begin="' + (0.2 * k) + 's" path="' + path(d, e) + '"/></circle>';
  });

  var nodes = '<g class="tp-origin"><rect x="' + (origin.x - 30) + '" y="' + (origin.y - 26) + '" width="60" height="52" rx="12"/>' +
    '<text x="' + origin.x + '" y="' + (origin.y + 46) + '">' + (box.dataset.origin || "Ваш origin") + "</text></g>";
  dcs.forEach(function (d) {
    nodes += '<g class="tp-dc"><circle cx="' + d.x + '" cy="' + d.y + '" r="17"/>' +
      '<circle class="tp-ring" cx="' + d.x + '" cy="' + d.y + '" r="17"/>' +
      '<text x="' + d.x + '" y="' + (d.y + 36) + '">' + d.name + "</text></g>";
  });
  edges.forEach(function (e) {
    nodes += '<circle class="tp-edge" cx="' + e.x + '" cy="' + e.y + '" r="6"/>';
  });

  box.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" class="topo">' + links + pulses + nodes + "</svg>";
}

/* ── 6. Бегущая строка городов ───────────────────────────── */
function marquee(box) {
  var G = g.RC_GEO;
  if (!G) return;
  var names = G.NODES.map(function (n) { return n[0]; });
  /* Перемешиваем, но детерминированно, чтобы порядок не прыгал при перерисовке */
  names = names.slice().sort(function (a, b) { return (a.length % 7) - (b.length % 7) || a.localeCompare(b); });
  var line = names.map(function (n) { return '<span>' + n + "</span>"; }).join('<i class="mq-dot"></i>');
  box.innerHTML = '<div class="mq-track"><div class="mq-set">' + line + '</div><div class="mq-set" aria-hidden="true">' + line + "</div></div>";
}

/* ── 7. Живые счётчики ───────────────────────────────────── */
function ticker(box) {
  var from = +(box.dataset.from || 0);
  var to   = +(box.dataset.to || 100);
  var dec  = +(box.dataset.dec || 0);
  var drift = +(box.dataset.drift || 0);
  var suffix = box.dataset.suffix || "";
  var out = document.createElement("b");
  out.textContent = fmt(from, dec) + suffix;
  box.insertBefore(out, box.firstChild);

  onView(box, function () {
    anim(1800, function (k) {
      out.textContent = fmt(from + (to - from) * k, dec) + suffix;
    }, function () {
      if (!drift || REDUCE) return;
      /* Лёгкое живое дрожание, чтобы цифра не выглядела мёртвой */
      setInterval(function () {
        var v = to + (Math.random() - 0.5) * drift;
        out.textContent = fmt(v, dec) + suffix;
      }, 2400);
    });
  });
}

/* ── 8. Столбики пропускной способности по регионам ──────── */
function bars(box) {
  var G = g.RC_GEO;
  if (!G) return;
  var counts = {};
  G.NODES.forEach(function (n) {
    var r = G.REGIONS[n[3]];
    var k = r[document.documentElement.lang === "en" ? "en" : "ru"] || r.ru;
    counts[k] = (counts[k] || 0) + 1;
  });
  var keys = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
  var max = counts[keys[0]] || 1;
  box.innerHTML = keys.map(function (k) {
    return '<div class="rb-row"><span class="rb-n">' + k + '</span>' +
      '<span class="rb-t"><i data-w="' + (counts[k] / max * 100).toFixed(1) + '"></i></span>' +
      '<b class="rb-v">' + counts[k] + "</b></div>";
  }).join("");
  onView(box, function () {
    $$(".rb-t i", box).forEach(function (bar, i) {
      setTimeout(function () { bar.style.width = bar.dataset.w + "%"; }, i * 110);
    });
  });
}

/* ── Инициализация ───────────────────────────────────────── */
var KIND = {
  latency: latency, donut: donut, gauge: gauge, wave: wave,
  topology: topology, marquee: marquee, ticker: ticker, bars: bars
};

function init(root) {
  $$("[data-viz]", root || document).forEach(function (el) {
    if (el._viz) return;
    el._viz = true;
    if (!el.id) el.id = "viz" + Math.random().toString(36).slice(2, 7);
    var fn = KIND[el.dataset.viz];
    if (fn) {
      try { fn(el); }
      catch (e) { if (g.RC_track) g.RC_track("jserr", "viz " + el.dataset.viz + ": " + (e.message || e), true); }
    }
  });
}

g.RC_VIZ = { init: init };
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
else init();
/* Пересобираем то, что зависит от языка */
document.addEventListener("rc:lang", function () {
  ["marquee", "bars"].forEach(function (kind) {
    $$('[data-viz="' + kind + '"]').forEach(function (el) { el._viz = false; el.innerHTML = ""; });
  });
  init();
});
})(window);
