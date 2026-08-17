/* ═══════════════════════════════════════════════════════════
   Rocket CDN · стойка дата-центра в объёме
   Собрана процедурно на three.js: корпус, восемь серверов,
   стеклянная дверь, диоды. Крутится мышкой и пальцем,
   при наведении сервер подсвечивается и подписывается.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";
var T = g.THREE;
if (!T) return;

var BLUE = 0x2FA9E0;
var CYAN = 0x6FD6FF;
var VIOL = 0x8A59F6;

function caps() {
  var m = matchMedia("(max-width: 780px)").matches;
  return {
    mobile: m,
    dpr: Math.min(g.devicePixelRatio || 1, m ? 1.6 : 2),
    aa: !m && (g.devicePixelRatio || 1) < 2
  };
}

/* Лицевая панель сервера рисуется на холсте: решётка, шильдик, полосы */
function faceTexture(i, total) {
  var W = 512, H = 78;
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");

  var grd = x.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "#2A3947");
  grd.addColorStop(0.5, "#1D2A37");
  grd.addColorStop(1, "#141E28");
  x.fillStyle = grd;
  x.fillRect(0, 0, W, H);

  /* Перфорация под забор воздуха */
  x.fillStyle = "rgba(0,0,0,.55)";
  for (var gy = 14; gy < H - 12; gy += 8) {
    for (var gx = 96; gx < W - 150; gx += 8) x.fillRect(gx, gy, 4, 4);
  }

  /* Ручки по краям */
  x.fillStyle = "#243444";
  x.fillRect(10, 18, 14, H - 36);
  x.fillRect(W - 24, 18, 14, H - 36);

  /* Шильдик */
  x.fillStyle = "#5FD0F5";
  x.font = "600 20px sans-serif";
  x.textBaseline = "middle";
  x.fillText("RCDN", 34, H / 2);
  x.fillStyle = "rgba(255,255,255,.34)";
  x.font = "500 15px sans-serif";
  x.fillText("NODE-" + String(total - i).padStart(2, "0"), W - 138, H / 2);

  var tex = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* Табличка над дверью */
function plateTexture() {
  var c = document.createElement("canvas");
  c.width = 460; c.height = 120;
  var x = c.getContext("2d");
  x.clearRect(0, 0, 460, 120);
  x.fillStyle = "#5FD0F5";
  x.font = "700 58px sans-serif";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.shadowColor = "rgba(95,208,245,.8)";
  x.shadowBlur = 22;
  x.fillText("ROCKET CDN", 230, 62);
  var tex = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/* Мягкое пятно света под стойкой */
function haloTexture() {
  var c = document.createElement("canvas");
  c.width = c.height = 256;
  var x = c.getContext("2d");
  var gr = x.createRadialGradient(128, 128, 4, 128, 128, 126);
  gr.addColorStop(0, "rgba(111,214,255,.95)");
  gr.addColorStop(0.35, "rgba(47,169,224,.42)");
  gr.addColorStop(1, "rgba(47,169,224,0)");
  x.fillStyle = gr;
  x.fillRect(0, 0, 256, 256);
  return new T.CanvasTexture(c);
}

function Rack(canvas, opts) {
  opts = opts || {};
  var C = caps();
  this.C = C;
  this.canvas = canvas;
  this.labels = opts.labels || [];
  this.time = 0;
  this.spin = 0;
  this.spinV = 0;
  this.aim = 0;
  this.hover = -1;
  this.running = false;
  this._in = true;

  var r = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: C.aa });
  r.setPixelRatio(C.dpr);
  if (T.SRGBColorSpace) r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.34;
  this.r = r;

  var scene = new T.Scene();
  this.scene = scene;

  var cam = new T.PerspectiveCamera(34, 1, 0.1, 60);
  cam.position.set(0.2, 0.7, 14);
  cam.lookAt(0, 0, 0);
  this.cam = cam;

  scene.add(new T.HemisphereLight(0xBFE2FF, 0x0A131C, 1.15));
  var key = new T.DirectionalLight(0xEAF7FF, 2.7);
  key.position.set(4, 7, 6);
  scene.add(key);
  var rim = new T.DirectionalLight(VIOL, 1.5);
  rim.position.set(-6, 1, -5);
  scene.add(rim);
  var fillFront = new T.DirectionalLight(0xCFE9FF, 1.25);
  fillFront.position.set(0.5, 1.5, 9);
  scene.add(fillFront);
  var under = new T.PointLight(CYAN, 2.4, 12, 2);
  under.position.set(0, -3.4, 2.2);
  scene.add(under);
  this.under = under;

  var root = new T.Group();
  scene.add(root);
  this.root = root;

  this.build(root);
  this.bind();
  this.resize();
}

Rack.prototype.build = function (root) {
  var C = this.C;
  var W = 3.0, H = 6.4, D = 2.2;
  var wall = 0.14;

  var metal = new T.MeshStandardMaterial({ color: 0x1A242F, metalness: 0.86, roughness: 0.36 });
  var inner = new T.MeshStandardMaterial({ color: 0x0B1119, metalness: 0.5, roughness: 0.9 });

  function box(w, h, d, mat, x, y, z) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  /* Корпус: две стенки, крышка, дно, задняя панель */
  root.add(box(wall, H, D, metal, -W / 2, 0, 0));
  root.add(box(wall, H, D, metal, W / 2, 0, 0));
  root.add(box(W + wall, wall, D, metal, 0, H / 2, 0));
  root.add(box(W + wall, wall, D, metal, 0, -H / 2, 0));
  root.add(box(W, H, 0.06, inner, 0, 0, -D / 2 + 0.05));

  /* Ножки */
  [-1, 1].forEach(function (s) {
    [-1, 1].forEach(function (t) {
      root.add(box(0.18, 0.3, 0.18, metal, s * (W / 2 - 0.22), -H / 2 - 0.15, t * (D / 2 - 0.3)));
    });
  });

  /* Серверы */
  var N = C.mobile ? 6 : 8;
  var gap = 0.1;
  var bh = (H - 1.0 - gap * (N - 1)) / N;
  var blades = [];
  this.leds = [];
  for (var i = 0; i < N; i++) {
    var grp = new T.Group();
    var y = H / 2 - 0.62 - bh / 2 - i * (bh + gap);
    grp.position.set(0, y, 0.16);

    /* Свечение идёт по той же текстуре: перфорация остаётся тёмной,
       и подсвеченный сервер выглядит железом, а не крашеной полосой */
    var ftex = faceTexture(i, N);
    var fm = new T.MeshStandardMaterial({
      map: ftex, metalness: 0.62, roughness: 0.48,
      emissive: new T.Color(0x8FD8FF), emissiveMap: ftex, emissiveIntensity: 0
    });
    var body = new T.Mesh(new T.BoxGeometry(W - 0.28, bh, D - 0.5), fm);
    grp.add(body);

    /* Диоды: три штуки у левого края лицевой панели */
    var lm = new T.MeshBasicMaterial({ color: CYAN });
    var row = [];
    for (var k = 0; k < 3; k++) {
      var led = new T.Mesh(new T.BoxGeometry(0.075, 0.075, 0.03), lm.clone());
      led.position.set(-W / 2 + 0.46 + k * 0.13, 0, (D - 0.5) / 2 + 0.02);
      grp.add(led);
      row.push(led);
    }
    this.leds.push(row);

    grp.userData = { i: i, y: y, base: fm };
    root.add(grp);
    blades.push(body);
    body.userData.grp = grp;
  }
  this.blades = blades;
  this.N = N;

  /* Стеклянная дверь: тонкая рама и почти прозрачное полотно.
     Настоящее преломление тут стоило бы лишнего прохода рендера
     и ничего не добавило бы на такой мелкой картинке. */
  var gz = D / 2 + 0.12;
  var glass = new T.Mesh(
    new T.PlaneGeometry(W - 0.24, H - 0.5),
    new T.MeshPhysicalMaterial({
      color: 0xAFDDF6, metalness: 0, roughness: 0.06,
      transparent: true, opacity: 0.07,
      clearcoat: 1, clearcoatRoughness: 0.05, side: T.DoubleSide,
      depthWrite: false
    })
  );
  glass.position.set(0, 0, gz);
  root.add(glass);
  this.glass = glass;

  var frameMat = new T.MeshStandardMaterial({ color: 0x22303E, metalness: 0.9, roughness: 0.3 });
  root.add(box(0.09, H - 0.4, 0.09, frameMat, -(W - 0.24) / 2, 0, gz));
  root.add(box(0.09, H - 0.4, 0.09, frameMat, (W - 0.24) / 2, 0, gz));
  root.add(box(W - 0.15, 0.09, 0.09, frameMat, 0, (H - 0.5) / 2, gz));
  root.add(box(W - 0.15, 0.09, 0.09, frameMat, 0, -(H - 0.5) / 2, gz));

  /* Шильдик на верхней перекладине */
  var plate = new T.Mesh(
    new T.PlaneGeometry(1.15, 0.3),
    new T.MeshBasicMaterial({ map: plateTexture(), transparent: true })
  );
  plate.position.set(0, H / 2 - 0.68, gz + 0.07);
  root.add(plate);

  /* Свечение под стойкой: мягкое пятно, а не плита */
  var halo = new T.Mesh(
    new T.PlaneGeometry(6.4, 4.2),
    new T.MeshBasicMaterial({
      map: haloTexture(), transparent: true, opacity: 0.55,
      blending: T.AdditiveBlending, depthWrite: false
    })
  );
  halo.position.set(0, -H / 2 - 0.26, 0.1);
  halo.rotation.x = -Math.PI / 2;
  root.add(halo);

  this.ray = new T.Raycaster();
  this.ptr = new T.Vector2(-9, -9);
};

Rack.prototype.bind = function () {
  var self = this, cv = this.canvas, drag = false, lastX = 0, moved = 0;

  cv.addEventListener("pointerdown", function (e) {
    drag = true; moved = 0; lastX = e.clientX;
    cv.setPointerCapture(e.pointerId);
    cv.style.cursor = "grabbing";
  });
  cv.addEventListener("pointermove", function (e) {
    var b = cv.getBoundingClientRect();
    self.ptr.x = ((e.clientX - b.left) / b.width) * 2 - 1;
    self.ptr.y = -((e.clientY - b.top) / b.height) * 2 + 1;
    if (!drag) return;
    var d = e.clientX - lastX;
    lastX = e.clientX;
    moved += Math.abs(d);
    self.spinV = d * 0.0045;
    self.spin += self.spinV;
  });
  function up(e) {
    if (!drag) return;
    drag = false;
    cv.style.cursor = "grab";
    try { cv.releasePointerCapture(e.pointerId); } catch (err) {}
  }
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
  cv.addEventListener("pointerleave", function () { self.ptr.set(-9, -9); });
  cv.style.cursor = "grab";
  cv.style.touchAction = "pan-y";

  var rt;
  addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { self.resize(); }, 160);
  });

  if (g.IntersectionObserver) {
    new IntersectionObserver(function (en) {
      self._in = en[0].isIntersecting;
      if (self._in) self.start(); else self.stop();
    }, { rootMargin: "120px" }).observe(cv);
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) self.stop();
    else if (self._in) self.start();
  });
};

Rack.prototype.resize = function () {
  var cv = this.canvas;
  var w = cv.clientWidth || 480, h = cv.clientHeight || 420;
  this.r.setSize(w, h, false);
  var cam = this.cam;
  cam.aspect = w / h;

  /* Отъезжаем ровно настолько, чтобы стойка целиком помещалась
     и в узкий портрет, и в широкую колонку */
  var half = Math.tan((cam.fov * Math.PI / 180) / 2);
  var byH = 3.62 / half;
  var byW = 2.35 / (half * cam.aspect);
  cam.position.z = Math.max(byH, byW);
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
};

Rack.prototype.setLabels = function (list) {
  this.labels = list || [];
  if (this.hover >= 0) this.showLabel(this.hover);
};

Rack.prototype.showLabel = function (i) {
  var el = this.tip;
  if (!el) {
    el = document.createElement("div");
    el.className = "rk-tip";
    this.canvas.parentElement.appendChild(el);
    this.tip = el;
  }
  if (i < 0 || !this.labels.length) { el.classList.remove("on"); return; }
  el.textContent = this.labels[i % this.labels.length];
  el.classList.add("on");
};

Rack.prototype.frame = function (dt) {
  this.time += dt;
  var t = this.time;

  /* Ход по инерции плюс тихий поворот сам по себе */
  this.spin += this.spinV;
  this.spinV *= 0.93;
  this.aim += dt * 0.12;
  var wobble = Math.sin(t * 0.5) * 0.16;
  this.root.rotation.y = -0.42 + this.spin + wobble + Math.sin(this.aim) * 0.05;
  this.root.rotation.x = Math.sin(t * 0.33) * 0.03;
  this.root.position.y = Math.sin(t * 0.7) * 0.07;

  /* Диоды мигают вразнобой */
  for (var i = 0; i < this.leds.length; i++) {
    var row = this.leds[i];
    for (var k = 0; k < row.length; k++) {
      var ph = Math.sin(t * (2.3 + i * 0.37 + k * 1.1) + i * 2.1 + k);
      var on = ph > (k === 2 ? 0.55 : -0.1);
      row[k].material.color.setHex(on ? (k === 2 ? VIOL : CYAN) : 0x14202B);
    }
  }

  /* Наведение на сервер */
  var hit = -1;
  if (this.ptr.x > -8) {
    this.ray.setFromCamera(this.ptr, this.cam);
    var is = this.ray.intersectObjects(this.blades, false);
    if (is.length) hit = is[0].object.userData.grp.userData.i;
  }
  if (hit !== this.hover) {
    this.hover = hit;
    this.showLabel(hit);
    this.canvas.style.cursor = hit >= 0 ? "pointer" : "grab";
  }
  for (var b = 0; b < this.blades.length; b++) {
    var m = this.blades[b].material;
    var want = b === this.hover ? 1.15 : 0;
    m.emissiveIntensity += (want - m.emissiveIntensity) * Math.min(1, dt * 8);
    var gp = this.blades[b].userData.grp;
    var pz = b === this.hover ? 0.34 : 0.16;
    gp.position.z += (pz - gp.position.z) * Math.min(1, dt * 8);
  }

  this.under.intensity = 2.1 + Math.sin(t * 1.6) * 0.5;
  this.r.render(this.scene, this.cam);
};

Rack.prototype.tick = function (ts) {
  if (document.documentElement.classList.contains("rc-flying")) { this._last = 0; return; }
  if (!this.running) return;
  this._raf = requestAnimationFrame(this.tick.bind(this));
  var dt = this._last ? Math.min(0.05, (ts - this._last) / 1000) : 0.016;
  this._last = ts;
  this.frame(dt);
};

Rack.prototype.start = function () {
  if (this.running) return;
  this.running = true;
  this._last = 0;
  this._raf = requestAnimationFrame(this.tick.bind(this));
};

Rack.prototype.stop = function () {
  this.running = false;
  if (this._raf) cancelAnimationFrame(this._raf);
};

g.RCRack = {
  create: function (canvas, opts) {
    if (!canvas) return null;
    try {
      var test = document.createElement("canvas");
      if (!(test.getContext("webgl2") || test.getContext("webgl"))) return null;
    } catch (e) { return null; }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    if ((navigator.deviceMemory || 4) <= 2) return null;
    if (g.RC_GL && !g.RC_GL.take()) return null;
    try {
      var made = new Rack(canvas, opts);
      if (g.RC_GL) g.RC_GL.guard(canvas, function () {
        made.stop();
        var box = canvas.parentElement;
        if (box) box.style.display = "none";
      }, function () {
        var box = canvas.parentElement;
        if (box) box.style.display = "";
        made.start();
      });
      return made;
    } catch (e) {
      if (g.RC_GL) g.RC_GL.give();
      if (g.RC_track) g.RC_track("jserr", "rack: " + (e.message || e), true);
      return null;
    }
  }
};
})(window);
