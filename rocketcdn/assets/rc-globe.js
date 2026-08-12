/* RocketCDN · интерактивный глобус сети.
   Canvas 2D, без внешних библиотек. Сам подстраивает нагрузку под устройство,
   засыпает вне экрана и уважает prefers-reduced-motion. */
(function (g) {
"use strict";

var TAU = Math.PI * 2, RAD = Math.PI / 180;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/* Единичный вектор из широты/долготы */
function vec(lat, lon) {
  var la = lat * RAD, lo = lon * RAD, cl = Math.cos(la);
  return [cl * Math.sin(lo), Math.sin(la), cl * Math.cos(lo)];
}

/* Сферическая интерполяция - по ней рисуются дуги трафика */
function slerp(a, b, t) {
  var d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1), o = Math.acos(d);
  if (o < 1e-6) return a.slice();
  var s = Math.sin(o), k1 = Math.sin((1 - t) * o) / s, k2 = Math.sin(t * o) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

function Globe(canvas, opts) {
  opts = opts || {};
  this.cv = canvas;
  this.ctx = canvas.getContext("2d", { alpha: true });
  this.opts = opts;
  this.spin = opts.spin != null ? opts.spin : 0;      /* текущий поворот, градусы */
  this.speed = opts.speed != null ? opts.speed : 3.2; /* градусов в секунду */
  this.tilt = (opts.tilt != null ? opts.tilt : 16) * RAD;
  this.nodes = opts.nodes || [];
  this.land = opts.land || [];
  this.arcs = [];
  this.hover = -1;
  this.filter = null;      /* индекс региона или null */
  this.focus = null;       /* {lat,lon} - плавный доворот к точке */
  this.running = false;
  this._inView = false;
  this.dragging = false;
  this.theme = opts.theme || "dark";
  this.quality = 1;
  this._t = 0;
  this._acc = 0;
  /* Саморегулировка: если устройство не успевает, снижаем детализацию */
  this._step = 0;          /* 0 - выбрать по ширине экрана */
  this._avg = 16;
  this._tune = 0;
  this._proj = [];
  /* Точки суши не меняются, поэтому раскладываем их один раз.
     В кадре остаётся поворот на четыре умножения вместо тригонометрии. */
  var L = this.land.length;
  this._lv = new Float32Array(L * 3);
  for (var li = 0; li < L; li++) {
    var la = this.land[li][0] * RAD, lo = this.land[li][1] * RAD, cl = Math.cos(la);
    this._lv[li * 3]     = cl * Math.sin(lo);   /* a */
    this._lv[li * 3 + 1] = Math.sin(la);        /* y */
    this._lv[li * 3 + 2] = cl * Math.cos(lo);   /* b */
  }
  this._bind();
  this.resize();
  this.seedArcs();
}

Globe.prototype.palette = function () {
  return this.theme === "light"
    ? { land: "rgba(9,19,32,.30)", grid: "rgba(9,19,32,.11)", halo: "rgba(66,178,220,.16)",
        node: "#0A5897", live: "#1B8CC4", soon: "rgba(9,19,32,.35)", arc: "rgba(66,178,220,.55)",
        acc: "#8A59F6", ring: "rgba(10,88,151,.30)", label: "#091320", labelBg: "rgba(255,255,255,.94)" }
    : { land: "rgba(226,232,240,.26)", grid: "rgba(66,178,220,.10)", halo: "rgba(66,178,220,.22)",
        node: "#42B2DC", live: "#7FD8FA", soon: "rgba(226,232,240,.34)", arc: "rgba(66,178,220,.62)",
        acc: "#8A59F6", ring: "rgba(66,178,220,.28)", label: "#E2E8F0", labelBg: "rgba(9,19,32,.94)" };
};

Globe.prototype.setTheme = function (t) { this.theme = t; this.draw(0); };

Globe.prototype.resize = function () {
  var r = this.cv.getBoundingClientRect(),
      w = Math.max(1, r.width), h = Math.max(1, r.height),
      dpr = clamp(window.devicePixelRatio || 1, 1, w < 760 ? 1.25 : 1.5);
  /* На узких экранах режем плотность точек - так глобус не лагает на телефоне */
  this.quality = w < 520 ? 0.45 : w < 900 ? 0.7 : 1;
  if (w * dpr > 1400) dpr = 1400 / w;
  this.dpr = dpr;
  this.cv.width = Math.round(w * dpr);
  this.cv.height = Math.round(h * dpr);
  this.w = w; this.h = h;
  this.cx = w / 2;
  this.cy = h * (this.opts.cyRatio || 0.5);
  this.R = Math.min(w, h) * (this.opts.radius || 0.42);
  this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  this.draw(0);
};

/* Дуги между узлами - «мосты» соединения. Строим по живым узлам, без «Скоро». */
/* Экранный круг глобуса в координатах окна: по нему ракета
   строит орбиту вокруг планеты. cx, cy и R уже в CSS-пикселях. */
Globe.prototype.screenCircle = function () {
  var b = this.cv.getBoundingClientRect();
  if (!b.width || !b.height) return null;
  return { cx: b.left + this.cx, cy: b.top + this.cy, r: this.R, rect: b };
};

Globe.prototype.seedArcs = function () {
  var live = [], i;
  for (i = 0; i < this.nodes.length; i++) if (!(this.nodes[i][4] & 4)) live.push(i);
  if (live.length < 2) { this.arcs = []; return; }
  var want = this.w < 520 ? 7 : this.w < 900 ? 11 : 16, seen = {};
  this.arcs = [];
  var guard = 0;
  while (this.arcs.length < want && guard++ < want * 40) {
    var a = live[(Math.random() * live.length) | 0], b = live[(Math.random() * live.length) | 0];
    if (a === b) continue;
    var key = a < b ? a + "-" + b : b + "-" + a;
    if (seen[key]) continue;
    var na = this.nodes[a], nb = this.nodes[b];
    /* Слишком короткие дуги визуально не читаются */
    if (Math.abs(na[2] - nb[2]) < 25 && Math.abs(na[1] - nb[1]) < 18) continue;
    seen[key] = 1;
    this.arcs.push({ a: a, b: b, t: Math.random(), sp: 0.16 + Math.random() * 0.26 });
  }
};

Globe.prototype._project = function (v) {
  var ct = Math.cos(this.tilt), st = Math.sin(this.tilt),
      y = v[1] * ct - v[2] * st, z = v[1] * st + v[2] * ct;
  return [this.cx + v[0] * this.R, this.cy - y * this.R, z];
};

Globe.prototype._pt = function (lat, lon) { return this._project(vec(lat, lon + this.spin)); };

Globe.prototype.draw = function (dt) {
  var c = this.ctx, P = this.palette(), i, p;
  c.clearRect(0, 0, this.w, this.h);

  var R = this.R, cx = this.cx, cy = this.cy;

  /* Ореол и тело сферы */
  var halo = c.createRadialGradient(cx, cy, R * 0.62, cx, cy, R * 1.42);
  halo.addColorStop(0, P.halo);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = halo;
  c.beginPath(); c.arc(cx, cy, R * 1.42, 0, TAU); c.fill();

  var body = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  if (this.theme === "light") {
    body.addColorStop(0, "rgba(255,255,255,.95)");
    body.addColorStop(0.7, "rgba(226,232,240,.75)");
    body.addColorStop(1, "rgba(200,213,228,.55)");
  } else {
    body.addColorStop(0, "rgba(19,42,66,.92)");
    body.addColorStop(0.72, "rgba(9,19,32,.92)");
    body.addColorStop(1, "rgba(4,10,18,.96)");
  }
  c.fillStyle = body;
  c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();

  /* Сетка меридианов и параллелей */
  c.strokeStyle = P.grid; c.lineWidth = 1;
  for (i = -60; i <= 60; i += 30) {
    var la = i * RAD, rr = Math.cos(la) * R, yy = Math.sin(la);
    var ct = Math.cos(this.tilt), st = Math.sin(this.tilt);
    c.beginPath();
    c.ellipse(cx, cy - yy * ct * R, rr, Math.max(1, rr * Math.abs(st)) , 0, 0, TAU);
    c.stroke();
  }
  /* Полный круг меридианов: половина сетки иначе пропадает
     на части оборота */
  for (i = 0; i < 360; i += 30) {
    c.beginPath();
    for (var s = -90; s <= 90; s += 6) {
      p = this._pt(s, i);
      if (p[2] < 0) { c.stroke(); c.beginPath(); continue; }
      c.lineTo(p[0], p[1]);
    }
    c.stroke();
  }

  /* Суша точками. Один путь на всю сушу и никакой тригонометрии
     внутри цикла: на телефоне это разница в разы. */
  var step = this._step || (this.quality >= 1 ? 2 : this.quality >= 0.7 ? 3 : 4),
      ds = Math.max(1, R * 0.0125);
  var sp = this.spin * RAD, CS = Math.cos(sp), SS = Math.sin(sp);
  var CT = Math.cos(this.tilt), ST = Math.sin(this.tilt);
  var lv = this._lv, ln = lv.length / 3;
  c.fillStyle = P.land;
  c.beginPath();
  for (i = 0; i < ln; i += step) {
    var a = lv[i * 3], yv = lv[i * 3 + 1], bb = lv[i * 3 + 2];
    var vx = a * CS + bb * SS;
    var vz = bb * CS - a * SS;
    var y2 = yv * CT - vz * ST;
    var z2 = yv * ST + vz * CT;
    if (z2 <= 0.02) continue;
    var sz = ds * (0.55 + z2 * 0.65);
    c.rect(cx + vx * R - sz / 2, cy - y2 * R - sz / 2, sz, sz);
  }
  c.fill();

  /* Дуги трафика */
  c.lineCap = "round";
  for (i = 0; i < this.arcs.length; i++) {
    var A = this.arcs[i], na = this.nodes[A.a], nb = this.nodes[A.b];
    var va = vec(na[1], na[2] + this.spin), vb = vec(nb[1], nb[2] + this.spin);
    var segs = this.quality >= 1 ? 26 : 16, pts = [], vis = 0;
    for (var k = 0; k <= segs; k++) {
      var t = k / segs, m = slerp(va, vb, t), lift = 1 + 0.19 * Math.sin(Math.PI * t);
      var pp = this._project([m[0] * lift, m[1] * lift, m[2] * lift]);
      pts.push(pp);
      if (pp[2] > 0) vis++;
    }
    if (!vis) continue;
    c.strokeStyle = P.arc;
    c.lineWidth = Math.max(1, R * 0.0045);
    c.globalAlpha = 0.55 * (vis / (segs + 1));
    c.beginPath();
    var pen = false;
    for (k = 0; k < pts.length; k++) {
      if (pts[k][2] <= 0) { pen = false; continue; }
      if (!pen) { c.moveTo(pts[k][0], pts[k][1]); pen = true; } else c.lineTo(pts[k][0], pts[k][1]);
    }
    c.stroke();

    /* Летящий пакет */
    A.t += dt * A.sp;
    if (A.t > 1) A.t -= 1;
    var idx = clamp(Math.round(A.t * segs), 0, segs), hp = pts[idx];
    if (hp[2] > 0) {
      c.globalAlpha = 1;
      var pr = Math.max(1.6, R * 0.011);
      var pg = c.createRadialGradient(hp[0], hp[1], 0, hp[0], hp[1], pr * 3.4);
      pg.addColorStop(0, this.theme === "light" ? "rgba(138,89,246,.95)" : "rgba(190,240,255,.95)");
      pg.addColorStop(1, "rgba(66,178,220,0)");
      c.fillStyle = pg;
      c.beginPath(); c.arc(hp[0], hp[1], pr * 3.4, 0, TAU); c.fill();
      c.fillStyle = this.theme === "light" ? "#8A59F6" : "#DFF6FF";
      c.beginPath(); c.arc(hp[0], hp[1], pr, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
  }

  /* Узлы */
  this._proj.length = 0;
  var nr = Math.max(1.5, R * 0.0105);
  for (i = 0; i < this.nodes.length; i++) {
    var n = this.nodes[i];
    if (this.filter != null && n[3] !== this.filter) continue;
    if (this.quality < 0.7 && (n[4] & 4)) continue;
    p = this._pt(n[1], n[2]);
    if (p[2] <= 0.02) continue;
    this._proj.push([p[0], p[1], i, p[2]]);
    var soon = n[4] & 4, cloud = n[4] & 1, shield = n[4] & 2;
    var a = 0.35 + p[2] * 0.65, r = nr * (0.7 + p[2] * 0.5);
    c.globalAlpha = a;
    if (cloud || shield) {
      c.fillStyle = P.acc;
      c.beginPath(); c.arc(p[0], p[1], r * 2.6, 0, TAU);
      c.globalAlpha = a * 0.16; c.fill(); c.globalAlpha = a;
    }
    c.fillStyle = soon ? P.soon : (cloud || shield ? P.acc : P.node);
    c.beginPath(); c.arc(p[0], p[1], r, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;

  /* Собственные ЦОД - крупнее, с пульсирующим кольцом */
  var dcs = this.opts.dc || [];
  for (i = 0; i < dcs.length; i++) {
    var d = dcs[i];
    p = this._pt(d.lat, d.lon);
    if (p[2] <= 0.02) continue;
    var ph = (this._t * 0.55 + i * 0.33) % 1, rr2 = nr * (2.2 + ph * 5.5);
    c.strokeStyle = P.ring;
    c.globalAlpha = (1 - ph) * 0.75 * (0.4 + p[2] * 0.6);
    c.lineWidth = Math.max(1, R * 0.004);
    c.beginPath(); c.arc(p[0], p[1], rr2, 0, TAU); c.stroke();
    c.globalAlpha = 1;
    var gr = c.createRadialGradient(p[0], p[1], 0, p[0], p[1], nr * 4);
    gr.addColorStop(0, "rgba(66,178,220,.75)");
    gr.addColorStop(1, "rgba(66,178,220,0)");
    c.fillStyle = gr;
    c.beginPath(); c.arc(p[0], p[1], nr * 4, 0, TAU); c.fill();
    c.fillStyle = this.theme === "light" ? "#0A5897" : "#B8ECFF";
    c.beginPath(); c.arc(p[0], p[1], nr * 1.7, 0, TAU); c.fill();
  }

  /* Подпись узла под курсором */
  if (this.hover >= 0 && this.hover < this.nodes.length) {
    var hn = this.nodes[this.hover], hpp = this._pt(hn[1], hn[2]);
    if (hpp[2] > 0) {
      var txt = hn[0], tag = (hn[4] & 4) ? " · скоро" : (hn[4] & 1) ? " · облако" : (hn[4] & 2) ? " · защита" : "";
      c.font = "600 12px Inter, system-ui, sans-serif";
      var tw = c.measureText(txt + tag).width + 18;
      var bx = clamp(hpp[0] - tw / 2, 4, this.w - tw - 4), by = hpp[1] - 32;
      c.fillStyle = P.labelBg;
      c.beginPath();
      if (c.roundRect) { c.roundRect(bx, by, tw, 24, 8); } else { c.rect(bx, by, tw, 24); }
      c.fill();
      c.strokeStyle = P.ring; c.lineWidth = 1; c.stroke();
      c.fillStyle = P.label;
      c.textBaseline = "middle";
      c.fillText(txt + tag, bx + 9, by + 12);
      c.beginPath();
      c.arc(hpp[0], hpp[1], Math.max(3, nr * 1.9), 0, TAU);
      c.strokeStyle = P.acc; c.lineWidth = 1.5; c.stroke();
    }
  }
};

Globe.prototype.tick = function (ts) {
  if (!this.running) return;
  var dt = this._last ? Math.min(0.05, (ts - this._last) / 1000) : 0.016;
  this._last = ts;
  this._t += dt;

  /* Скользящее среднее длительности кадра и мягкая подстройка качества */
  this._avg = this._avg * 0.9 + (dt * 1000) * 0.1;
  this._tune += dt;
  if (this._tune > 1.2) {
    this._tune = 0;
    var cur = this._step || (this.quality >= 1 ? 2 : this.quality >= 0.7 ? 3 : 4);
    if (this._avg > 26 && cur < 8) this._step = cur + 1;
    else if (this._avg < 14 && cur > 1) this._step = cur - 1;
  }

  if (!this.dragging) {
    if (this.focus) {
      /* Плавный доворот к выбранному городу */
      var target = -this.focus.lon, diff = ((target - this.spin + 540) % 360) - 180;
      this.spin += diff * Math.min(1, dt * 2.6);
      this.tilt = lerp(this.tilt, clamp(this.focus.lat, -55, 55) * RAD * 0.85, Math.min(1, dt * 2.6));
      if (Math.abs(diff) < 0.4) this.focus = null;
    } else {
      this.spin += this.speed * dt;
    }
  }
  if (this.spin > 360) this.spin -= 360;
  if (this.spin < 0) this.spin += 360;
  this.draw(dt);
  this._raf = requestAnimationFrame(this.tick.bind(this));
};

Globe.prototype.start = function () {
  if (this.running) return;
  this.running = true; this._last = 0;
  this._raf = requestAnimationFrame(this.tick.bind(this));
};
Globe.prototype.stop = function () {
  this.running = false;
  if (this._raf) cancelAnimationFrame(this._raf);
};

Globe.prototype.focusOn = function (lat, lon) { this.focus = { lat: lat, lon: lon }; };

Globe.prototype._nearest = function (x, y) {
  var best = -1, bd = 26 * 26;
  for (var i = 0; i < this._proj.length; i++) {
    var dx = this._proj[i][0] - x, dy = this._proj[i][1] - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = this._proj[i][2]; }
  }
  return best;
};

Globe.prototype._bind = function () {
  var self = this, cv = this.cv, px = 0, moved = 0;

  function local(e) {
    var r = cv.getBoundingClientRect(),
        t = e.touches && e.touches[0] ? e.touches[0] : e;
    return [t.clientX - r.left, t.clientY - r.top];
  }
  function down(e) {
    self.dragging = true; moved = 0;
    px = local(e)[0];
    self.focus = null;
  }
  function move(e) {
    var l = local(e);
    if (self.dragging) {
      var dx = l[0] - px;
      px = l[0];
      moved += Math.abs(dx);
      self.spin += dx * 0.32;
      if (e.cancelable && Math.abs(dx) > 2) e.preventDefault();
    } else {
      var h = self._nearest(l[0], l[1]);
      if (h !== self.hover) {
        self.hover = h;
        cv.style.cursor = h >= 0 ? "pointer" : "grab";
        if (self.opts.onHover) self.opts.onHover(h);
      }
    }
  }
  function up(e) {
    if (self.dragging && moved < 6) {
      var l = local(e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : e);
      var h = self._nearest(l[0], l[1]);
      self.hover = h;
      if (h >= 0 && self.opts.onPick) self.opts.onPick(h);
    }
    self.dragging = false;
  }

  cv.addEventListener("mousedown", down);
  cv.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  cv.addEventListener("mouseleave", function () { self.dragging = false; self.hover = -1; });
  cv.addEventListener("touchstart", down, { passive: true });
  cv.addEventListener("touchmove", move, { passive: false });
  cv.addEventListener("touchend", up);
  cv.style.cursor = "grab";

  /* Спим, когда глобус за пределами экрана или вкладка неактивна */
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (ents) {
      self._inView = ents[0].isIntersecting;
      self._inView && !document.hidden ? self.start() : self.stop();
    }, { threshold: 0.02 }).observe(cv);
  } else { self._inView = true; self.start(); }

  /* Возврат во вкладку не должен будить глобус, который за экраном:
     наблюдатель повторно не сработает, и он рисовал бы вхолостую. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) self.stop();
    else if (self._inView) self.start();
  });

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { self.resize(); self.seedArcs(); }, 180);
  });
};

g.RCGlobe = Globe;
})(window);
