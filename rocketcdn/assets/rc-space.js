/* ═══════════════════════════════════════════════════════════
   Rocket CDN · живой космос на фоне всей страницы

   Один холст под всем содержимым: звёздное поле в три слоя с
   параллаксом от прокрутки, редкие пролетающие пакеты данных и
   мягкая туманность в фирменных цветах. Рисуется обычным
   двумерным контекстом: контексты WebGL дороги и все четыре
   заняты сценами, а фон должен работать даже на слабом телефоне.

   Фон меняется по ходу страницы: у земли теплее и плотнее,
   в космосе холоднее и разреженнее.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Каким должен быть космос в каждом акте фильма:
   [теплота, приглушение, скорость пакетов].
   Теплота - зарево двигателя и атмосферы; приглушение - мы внутри
   корабля и смотрим сквозь стекло; скорость - как быстро идёт мимо
   поток данных. Ключи те же, что у диспетчера сцены. */
var ACT = {
  pad:      [0.60, 0.12, 0.55],
  ignite:   [0.95, 0.00, 1.55],
  climb:    [0.65, 0.00, 1.90],
  clouds:   [0.38, 0.05, 1.60],
  corridor: [0.12, 0.28, 1.20],
  advance:  [0.10, 0.18, 1.10],
  orbit:    [0.00, 0.00, 0.80],
  reentry:  [1.00, 0.05, 2.10],
  route:    [0.10, 0.22, 0.90],
  landing:  [0.72, 0.10, 0.70],
  walk:     [0.30, 0.46, 0.50],
  cabin:    [0.12, 0.60, 0.35],
  manual:   [0.10, 0.62, 0.30],
  console:  [0.16, 0.50, 0.45],
  _:        [0.20, 0.10, 1.00]
};

function Space(canvas) {
  this.cv = canvas;
  this.x = canvas.getContext("2d", { alpha: true });
  this.t = 0;
  this.p = 0;          /* положение на странице, 0..1 */
  this.pShown = 0;
  /* Состояние акта: цель приходит событием, показанное догоняет её
     плавно - иначе на границе секций фон дёргался бы ступенькой */
  this.warm = 0.2; this.warmT = 0.2;
  this.dim = 0.1;  this.dimT = 0.1;
  this.rush = 1;   this.rushT = 1;
  this.running = false;
  this.theme = document.documentElement.getAttribute("data-theme") || "dark";
  this.build();
  this.bind();
  this.resize();
}

Space.prototype.build = function () {
  var w = innerWidth, h = innerHeight;
  var mob = w < 760;
  /* Плотность держим в разумных пределах: фон не должен есть кадры */
  var n = mob ? 120 : 260;
  this.stars = [];
  for (var i = 0; i < n; i++) {
    var layer = i % 3;                      /* 0 дальний, 2 ближний */
    this.stars.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + layer * 0.42 + Math.random() * 0.5,
      l: layer,
      tw: Math.random() * 6.28,             /* фаза мерцания */
      sp: 0.3 + Math.random() * 0.8
    });
  }
  /* Пакеты данных: короткие росчерки, летят поперёк */
  this.pk = [];
  var pn = mob ? 5 : 11;
  for (i = 0; i < pn; i++) this.pk.push(this.seedPacket(true));
};

Space.prototype.seedPacket = function (anywhere) {
  return {
    x: anywhere ? Math.random() : -0.05,
    y: Math.random(),
    v: 0.05 + Math.random() * 0.12,
    len: 0.04 + Math.random() * 0.10,
    a: 0.25 + Math.random() * 0.5,
    hue: Math.random() > 0.72 ? "v" : "c"
  };
};

Space.prototype.bind = function () {
  var self = this, rt;
  addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { self.build(); self.resize(); }, 200);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) self.stop(); else self.start();
  });
  addEventListener("scroll", function () {
    var max = document.documentElement.scrollHeight - innerHeight;
    self.p = max > 0 ? Math.min(1, Math.max(0, (g.scrollY || 0) / max)) : 0;
  }, { passive: true });

  /* Фон слушает тот же акт, что и всё остальное. До этого он жил
     одной прокруткой и легко расходился со сценой: на странице шёл
     вход в атмосферу, а космос за окном оставался ледяным. Теперь
     источник один - диспетчер сцены. */
  addEventListener("rc:act", function (e) {
    var a = e && e.detail && e.detail.act;
    var s = ACT[a] || ACT._;
    self.warmT = s[0]; self.dimT = s[1]; self.rushT = s[2];
  });
};

Space.prototype.setTheme = function (v) { this.theme = v; };

Space.prototype.resize = function () {
  var w = innerWidth, h = innerHeight;
  var dpr = Math.min(g.devicePixelRatio || 1, w < 760 ? 1.5 : 2);
  this.cv.width = Math.round(w * dpr);
  this.cv.height = Math.round(h * dpr);
  this.cv.style.width = w + "px";
  this.cv.style.height = h + "px";
  this.x.setTransform(dpr, 0, 0, dpr, 0, 0);
  this.w = w; this.h = h;
};

Space.prototype.frame = function (dt) {
  var x = this.x, w = this.w, h = this.h;
  this.t += dt;
  /* Положение по странице догоняем плавно, чтобы фон не дёргался */
  this.pShown += (this.p - this.pShown) * Math.min(1, dt * 3);
  var p = this.pShown;
  var light = this.theme === "light";

  /* Догоняем состояние акта. Медленнее, чем положение на странице:
     смена времени суток в кадре должна быть незаметной. */
  var k = Math.min(1, dt * 1.1);
  this.warm += (this.warmT - this.warm) * k;
  this.dim  += (this.dimT  - this.dim)  * k;
  this.rush += (this.rushT - this.rush) * k;
  var warm = this.warm, dim = 1 - this.dim * 0.62, rush = this.rush;

  x.clearRect(0, 0, w, h);

  /* Туманность: два мягких пятна, расходятся к середине пути */
  var g1 = x.createRadialGradient(w * (0.18 + p * 0.2), h * (0.18 + p * 0.1), 0,
                                  w * (0.18 + p * 0.2), h * (0.18 + p * 0.1), Math.max(w, h) * 0.62);
  var a1 = (light ? 0.10 : 0.20) * dim;
  g1.addColorStop(0, "rgba(66,178,220," + (a1 * (1 - p * 0.35)).toFixed(3) + ")");
  g1.addColorStop(1, "rgba(66,178,220,0)");
  x.fillStyle = g1;
  x.fillRect(0, 0, w, h);

  var g2 = x.createRadialGradient(w * (0.88 - p * 0.25), h * (0.72 - p * 0.3), 0,
                                  w * (0.88 - p * 0.25), h * (0.72 - p * 0.3), Math.max(w, h) * 0.55);
  var a2 = (light ? 0.07 : 0.16) * dim;
  g2.addColorStop(0, "rgba(138,89,246," + (a2 * (0.5 + p * 0.5)).toFixed(3) + ")");
  g2.addColorStop(1, "rgba(138,89,246,0)");
  x.fillStyle = g2;
  x.fillRect(0, 0, w, h);

  /* Зарево акта: на старте и на входе в атмосферу снизу поднимается
     тёплый свет, в космосе его нет вовсе. Пятно одно и очень мягкое -
     это отсвет на всём кадре, а не источник в кадре. */
  if (warm > 0.02) {
    var gw = x.createRadialGradient(w * 0.5, h * 1.02, 0, w * 0.5, h * 1.02, Math.max(w, h) * 0.85);
    gw.addColorStop(0, "rgba(255,150,60," + (warm * (light ? 0.10 : 0.17) * dim).toFixed(3) + ")");
    gw.addColorStop(0.45, "rgba(255,110,40," + (warm * 0.05 * dim).toFixed(3) + ")");
    gw.addColorStop(1, "rgba(255,90,30,0)");
    x.fillStyle = gw;
    x.fillRect(0, 0, w, h);
  }

  /* Звёзды. Ближние слои сдвигаются сильнее: это и есть параллакс */
  var base = light ? "9,19,32" : "226,232,240";
  for (var i = 0; i < this.stars.length; i++) {
    var s = this.stars[i];
    var shift = (s.l + 1) * 0.16;
    var sy = (s.y - p * shift) % 1;
    if (sy < 0) sy += 1;
    var tw = 0.55 + 0.45 * Math.sin(this.t * s.sp + s.tw);
    var al = (light ? 0.22 : 0.55) * tw * (0.4 + s.l * 0.3) * dim;
    x.beginPath();
    x.arc(s.x * w, sy * h, s.r, 0, 6.283);
    x.fillStyle = "rgba(" + base + "," + al.toFixed(3) + ")";
    x.fill();
  }

  /* Пакеты данных */
  for (i = 0; i < this.pk.length; i++) {
    var q = this.pk[i];
    q.x += q.v * dt * rush;
    if (q.x > 1.1) this.pk[i] = q = this.seedPacket(false);
    var x1 = q.x * w, y1 = q.y * h;
    var x2 = (q.x - q.len) * w, y2 = y1 + q.len * h * 0.16;
    var col = q.hue === "v" ? "138,89,246" : "66,178,220";
    var lg = x.createLinearGradient(x2, y2, x1, y1);
    lg.addColorStop(0, "rgba(" + col + ",0)");
    lg.addColorStop(1, "rgba(" + col + "," + (q.a * (light ? 0.5 : 1) * dim).toFixed(2) + ")");
    x.strokeStyle = lg;
    x.lineWidth = 1.4;
    x.beginPath();
    x.moveTo(x2, y2);
    x.lineTo(x1, y1);
    x.stroke();
  }
};

Space.prototype.tick = function (ts) {
  if (!this.running) return;
  this._raf = requestAnimationFrame(this.tick.bind(this));
  var dt = this._last ? Math.min(0.05, (ts - this._last) / 1000) : 0.016;
  this._last = ts;
  /* Тридцать кадров хватает: это фон, а не главный герой */
  this._acc = (this._acc || 0) + dt;
  if (this._acc < 1 / 32) return;
  this.frame(this._acc);
  this._acc = 0;
};

Space.prototype.start = function () {
  if (this.running || REDUCE) return;
  this.running = true;
  this._last = 0;
  this._raf = requestAnimationFrame(this.tick.bind(this));
};

Space.prototype.stop = function () {
  this.running = false;
  if (this._raf) cancelAnimationFrame(this._raf);
};

g.RCSpace = {
  create: function (canvas) {
    if (!canvas) return null;
    try {
      var s = new Space(canvas);
      if (REDUCE) { s.frame(0.016); return s; }   /* один статичный кадр */
      s.start();
      g.RC_SPACE = s;
      return s;
    } catch (e) { return null; }
  }
};
})(window);
