/* ═══════════════════════════════════════════════════════════
   RocketCDN · глобус сети в настоящем 3D на WebGL.

   Тот же интерфейс, что у плоской версии (setTheme, filter,
   focusOn, start, stop), поэтому подменяется без правок в
   остальном коде. Суша и узлы - точки со своим шейдером,
   дуги трафика - линии с летящими пакетами, вокруг шара
   френелевское свечение атмосферы.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

if (!g.THREE) return;
var T = g.THREE;
var RAD = Math.PI / 180, TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function vec3(lat, lon, r) {
  var la = lat * RAD, lo = lon * RAD, cl = Math.cos(la) * (r || 1);
  return new T.Vector3(cl * Math.sin(lo), Math.sin(la) * (r || 1), cl * Math.cos(lo));
}

/* Мягкая круглая точка для свечения узлов */
function glowTexture() {
  var s = 96, c = document.createElement("canvas");
  c.width = c.height = s;
  var x = c.getContext("2d");
  var gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0.00, "rgba(255,255,255,1)");
  gr.addColorStop(0.22, "rgba(255,255,255,.85)");
  gr.addColorStop(0.50, "rgba(255,255,255,.28)");
  gr.addColorStop(1.00, "rgba(255,255,255,0)");
  x.fillStyle = gr;
  x.fillRect(0, 0, s, s);
  return new T.CanvasTexture(c);
}

/* ── Шейдеры ─────────────────────────────────────────────── */
var DOT_VS = [
  "attribute float aSize;",
  "attribute vec3 aColor;",
  "varying vec3 vColor;",
  "varying float vFace;",
  "uniform float uScale;",
  "uniform float uDist;",
  "void main(){",
  "  vColor = aColor;",
  "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
  /* Точка на обратной стороне шара: гасим по нормали в видовом пространстве */
  "  vec3 n = normalize(normalMatrix * normalize(position));",
  "  vFace = n.z;",
  "  gl_Position = projectionMatrix * mv;",
  "  gl_PointSize = aSize * uScale * (uDist / -mv.z);",
  "}"
].join("\n");

var DOT_FS = [
  "varying vec3 vColor;",
  "varying float vFace;",
  "uniform float uSoft;",
  "void main(){",
  "  if (vFace < 0.02) discard;",
  "  vec2 d = gl_PointCoord - vec2(0.5);",
  "  float r = length(d) * 2.0;",
  "  if (r > 1.0) discard;",
  "  float a = mix(1.0 - r, smoothstep(1.0, 0.0, r), uSoft);",
  "  a *= smoothstep(0.02, 0.45, vFace);",
  "  gl_FragColor = vec4(vColor, a);",
  "}"
].join("\n");

var ATM_VS = [
  "varying float vI;",
  "void main(){",
  "  vec3 n = normalize(normalMatrix * normal);",
  "  vec4 mv = modelViewMatrix * vec4(position, 1.0);",
  "  vec3 v = normalize(-mv.xyz);",
  "  vI = pow(1.0 - abs(dot(n, v)), 2.6);",
  "  gl_Position = projectionMatrix * mv;",
  "}"
].join("\n");

var ATM_FS = [
  "varying float vI;",
  "uniform vec3 uColor;",
  "uniform float uPower;",
  "void main(){",
  "  gl_FragColor = vec4(uColor, vI * uPower);",
  "}"
].join("\n");

/* ═══ Глобус ═════════════════════════════════════════════ */
function Globe3D(canvas, opts) {
  opts = opts || {};
  this.cv = canvas;
  this.opts = opts;
  this.nodes = opts.nodes || [];
  this.land = opts.land || [];
  this.dc = opts.dc || [];
  this.theme = opts.theme || "dark";
  this.speed = (opts.speed != null ? opts.speed : 3.2) * RAD;
  this.spin = 0;
  this.hover = -1;
  this.filter = null;
  this.focus = null;
  this.running = false;
  this.dragging = false;
  this._inView = false;
  this._t = 0;
  this._proj = [];

  var w = Math.max(1, canvas.clientWidth || 480);
  var mob = innerWidth < 760;
  this.mob = mob;

  var r = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: !mob, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(g.devicePixelRatio || 1, mob ? 1.5 : 2));
  if (T.SRGBColorSpace) r.outputColorSpace = T.SRGBColorSpace;
  this.r = r;

  this.scene = new T.Scene();
  this.cam = new T.PerspectiveCamera(34, 1, 0.1, 100);
  this.cam.position.set(0, 0, 4.4);

  /* Группа вращается, вся геометрия внутри неподвижна */
  this.world = new T.Group();
  this.world.rotation.x = 16 * RAD;
  this.scene.add(this.world);

  this.build();
  this.bind();
  this.resize();
}

Globe3D.prototype.palette = function () {
  return this.theme === "light"
    ? { land: [0.16, 0.26, 0.38], node: [0.04, 0.35, 0.59], acc: [0.54, 0.35, 0.96],
        soon: [0.45, 0.51, 0.58], dc: [0.05, 0.42, 0.72],
        atm: [0.26, 0.70, 0.86], atmP: 0.16,
        core: 0xE7EEF6, coreO: 0.55, arc: 0x1B7FB8, label: "#091320", labelBg: "rgba(255,255,255,.95)" }
    : { land: [0.55, 0.68, 0.82], node: [0.26, 0.70, 0.86], acc: [0.62, 0.44, 0.99],
        soon: [0.35, 0.42, 0.52], dc: [0.72, 0.93, 1.0],
        atm: [0.26, 0.70, 0.86], atmP: 0.28,
        core: 0x0A1A2A, coreO: 0.92, arc: 0x5BC4EA, label: "#E2E8F0", labelBg: "rgba(9,19,32,.95)" };
};

Globe3D.prototype.build = function () {
  var P = this.palette();
  var i;

  /* Тело шара */
  this.core = new T.Mesh(
    new T.SphereGeometry(0.995, this.mob ? 40 : 64, this.mob ? 28 : 44),
    new T.MeshBasicMaterial({ color: P.core, transparent: true, opacity: P.coreO })
  );
  this.world.add(this.core);

  /* Атмосфера: свечение по краю */
  this.atm = new T.Mesh(
    new T.SphereGeometry(1.16, 48, 32),
    new T.ShaderMaterial({
      vertexShader: ATM_VS, fragmentShader: ATM_FS,
      uniforms: { uColor: { value: new T.Color().fromArray(P.atm) }, uPower: { value: P.atmP } },
      transparent: true, blending: T.AdditiveBlending, side: T.BackSide, depthWrite: false
    })
  );
  this.scene.add(this.atm);

  /* Сетка меридианов и параллелей */
  var gridPts = [];
  for (i = 0; i < 360; i += 30) {
    for (var la = -80; la < 80; la += 4) {
      gridPts.push(vec3(la, i, 1.001), vec3(la + 4, i, 1.001));
    }
  }
  for (var lat = -60; lat <= 60; lat += 30) {
    for (var lo = 0; lo < 360; lo += 4) {
      gridPts.push(vec3(lat, lo, 1.001), vec3(lat, lo + 4, 1.001));
    }
  }
  var gg = new T.BufferGeometry().setFromPoints(gridPts);
  this.grid = new T.LineSegments(gg, new T.LineBasicMaterial({
    color: P.arc, transparent: true, opacity: this.theme === "light" ? 0.14 : 0.12, depthWrite: false
  }));
  this.world.add(this.grid);

  /* Суша точками */
  var step = this.mob ? 2 : 1;
  var lp = [], lc = [], ls = [];
  for (i = 0; i < this.land.length; i += step) {
    var v = vec3(this.land[i][0], this.land[i][1], 1.006);
    lp.push(v.x, v.y, v.z);
    lc.push(P.land[0], P.land[1], P.land[2]);
    ls.push(1.7);
  }
  this.landGeo = new T.BufferGeometry();
  this.landGeo.setAttribute("position", new T.Float32BufferAttribute(lp, 3));
  this.landGeo.setAttribute("aColor", new T.Float32BufferAttribute(lc, 3));
  this.landGeo.setAttribute("aSize", new T.Float32BufferAttribute(ls, 1));
  this.landMat = new T.ShaderMaterial({
    vertexShader: DOT_VS, fragmentShader: DOT_FS,
    uniforms: { uScale: { value: 1 }, uSoft: { value: 0.35 }, uDist: { value: 4.4 } },
    transparent: true, depthWrite: false
  });
  this.landPts = new T.Points(this.landGeo, this.landMat);
  this.world.add(this.landPts);

  /* Узлы сети */
  this.buildNodes();

  /* Дуги трафика */
  this.arcGroup = new T.Group();
  this.world.add(this.arcGroup);
  this.seedArcs();

  /* Метки собственных ЦОД */
  this.dcGroup = new T.Group();
  this.world.add(this.dcGroup);
  var glow = glowTexture();
  this.dcMarks = [];
  for (i = 0; i < this.dc.length; i++) {
    var d = this.dc[i];
    var pos = vec3(d.lat, d.lon, 1.02);
    var sp = new T.Sprite(new T.SpriteMaterial({
      map: glow, color: new T.Color().fromArray(P.dc), transparent: true,
      blending: T.AdditiveBlending, depthWrite: false, opacity: 0.95
    }));
    sp.position.copy(pos);
    sp.scale.setScalar(0.16);
    this.dcGroup.add(sp);

    var ring = new T.Mesh(
      new T.RingGeometry(0.03, 0.036, 32),
      new T.MeshBasicMaterial({ color: new T.Color().fromArray(P.dc), transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false })
    );
    ring.position.copy(pos);
    ring.lookAt(pos.clone().multiplyScalar(2));
    this.dcGroup.add(ring);
    this.dcMarks.push({ sprite: sp, ring: ring, phase: i * 0.33 });
  }
};

Globe3D.prototype.buildNodes = function () {
  var P = this.palette();
  if (this.nodePts) { this.world.remove(this.nodePts); this.nodeGeo.dispose(); }
  var np = [], nc = [], ns = [];
  this._nodeIndex = [];
  for (var i = 0; i < this.nodes.length; i++) {
    var n = this.nodes[i];
    if (this.filter != null && n[3] !== this.filter) continue;
    var v = vec3(n[1], n[2], 1.012);
    np.push(v.x, v.y, v.z);
    var col = (n[4] & 4) ? P.soon : (n[4] & 3) ? P.acc : P.node;
    nc.push(col[0], col[1], col[2]);
    ns.push((n[4] & 4) ? 2.6 : (n[4] & 3) ? 5.2 : 4.0);
    this._nodeIndex.push(i);
  }
  this.nodeGeo = new T.BufferGeometry();
  this.nodeGeo.setAttribute("position", new T.Float32BufferAttribute(np, 3));
  this.nodeGeo.setAttribute("aColor", new T.Float32BufferAttribute(nc, 3));
  this.nodeGeo.setAttribute("aSize", new T.Float32BufferAttribute(ns, 1));
  this.nodeMat = this.nodeMat || new T.ShaderMaterial({
    vertexShader: DOT_VS, fragmentShader: DOT_FS,
    uniforms: { uScale: { value: 1 }, uSoft: { value: 1.0 }, uDist: { value: 4.4 } },
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  });
  this.nodePts = new T.Points(this.nodeGeo, this.nodeMat);
  this.world.add(this.nodePts);
};

/* Дуга между двумя точками с подъёмом над поверхностью */
Globe3D.prototype.arcCurve = function (a, b) {
  var va = vec3(a[1], a[2], 1), vb = vec3(b[1], b[2], 1);
  var mid = va.clone().add(vb).multiplyScalar(0.5);
  var dist = va.distanceTo(vb);
  mid.normalize().multiplyScalar(1 + dist * 0.34);
  return new T.QuadraticBezierCurve3(va.clone().multiplyScalar(1.01), mid, vb.clone().multiplyScalar(1.01));
};

Globe3D.prototype.seedArcs = function () {
  var P = this.palette();
  while (this.arcGroup.children.length) {
    var c = this.arcGroup.children.pop();
    if (c.geometry) c.geometry.dispose();
  }
  var live = [];
  for (var i = 0; i < this.nodes.length; i++) if (!(this.nodes[i][4] & 4)) live.push(i);
  if (live.length < 2) return;

  var want = this.mob ? 8 : 16, seen = {}, guard = 0;
  this.arcs = [];
  var glow = this._glowTex || (this._glowTex = glowTexture());

  while (this.arcs.length < want && guard++ < want * 40) {
    var a = live[(Math.random() * live.length) | 0], b = live[(Math.random() * live.length) | 0];
    if (a === b) continue;
    var key = a < b ? a + "-" + b : b + "-" + a;
    if (seen[key]) continue;
    var na = this.nodes[a], nb = this.nodes[b];
    if (Math.abs(na[2] - nb[2]) < 28 && Math.abs(na[1] - nb[1]) < 18) continue;
    seen[key] = 1;

    var curve = this.arcCurve(na, nb);
    var pts = curve.getPoints(this.mob ? 28 : 48);
    var geo = new T.BufferGeometry().setFromPoints(pts);
    var line = new T.Line(geo, new T.LineBasicMaterial({
      color: P.arc, transparent: true, opacity: 0.42, depthWrite: false, blending: T.AdditiveBlending
    }));
    this.arcGroup.add(line);

    var packet = new T.Sprite(new T.SpriteMaterial({
      map: glow, color: 0xDFF6FF, transparent: true, blending: T.AdditiveBlending, depthWrite: false
    }));
    packet.scale.setScalar(0.075);
    this.arcGroup.add(packet);

    this.arcs.push({ curve: curve, line: line, packet: packet, t: Math.random(), sp: 0.16 + Math.random() * 0.26 });
  }
};

Globe3D.prototype.setTheme = function (v) {
  if (this.theme === v) return;
  this.theme = v;
  var P = this.palette();
  this.core.material.color.set(P.core);
  this.core.material.opacity = P.coreO;
  this.atm.material.uniforms.uColor.value.fromArray(P.atm);
  this.atm.material.uniforms.uPower.value = P.atmP;
  this.grid.material.color.set(P.arc);
  this.grid.material.opacity = this.theme === "light" ? 0.14 : 0.12;

  var lc = this.landGeo.getAttribute("aColor");
  for (var i = 0; i < lc.count; i++) lc.setXYZ(i, P.land[0], P.land[1], P.land[2]);
  lc.needsUpdate = true;

  this.buildNodes();
  this.seedArcs();
  for (i = 0; i < this.dcMarks.length; i++) {
    this.dcMarks[i].sprite.material.color.fromArray(P.dc);
    this.dcMarks[i].ring.material.color.fromArray(P.dc);
  }
  for (i = 0; this.pulses && i < this.pulses.length; i++) {
    this.pulses[i].ring.material.color.fromArray(P.dc);
    this.pulses[i].dot.material.color.fromArray(P.dc);
  }
  this.drawLabel();
};

Object.defineProperty(Globe3D.prototype, "filter", {
  get: function () { return this._filter === undefined ? null : this._filter; },
  set: function (v) {
    if (this._filter === v) return;
    this._filter = v;
    if (this.nodeGeo) this.buildNodes();
  }
});

/* Экранный круг планеты в координатах окна.
   Камера стоит неподвижно (fov 34, z 4.4), поэтому шар радиуса 1
   занимает постоянную долю высоты холста. По этому кругу ракета
   строит орбиту, не заглядывая внутрь чужой сцены. */
Globe3D.prototype.screenCircle = function () {
  var b = this.cv.getBoundingClientRect();
  if (!b.width || !b.height) return null;
  var half = Math.tan((34 * Math.PI / 180) / 2) * 4.4;   /* половина кадра в мире */
  return {
    cx: b.left + b.width / 2,
    cy: b.top + b.height / 2,
    r:  (1 / half) * (b.height / 2),
    rect: b
  };
};

Globe3D.prototype.resize = function () {
  var r = this.cv.getBoundingClientRect();
  var w = Math.max(1, r.width), h = Math.max(1, r.height);
  this.r.setSize(w, h, false);
  this.cam.aspect = w / h;
  this.cam.updateProjectionMatrix();
  /* Точка задаётся в пикселях экрана: масштаб считаем от размера
     холста и плотности пикселей, иначе на разных экранах разъезжается */
  var k = (this.r.getPixelRatio() || 1) * (Math.min(w, h) / 620);
  this.landMat.uniforms.uScale.value = k;
  this.nodeMat.uniforms.uScale.value = k;
  this.w = w; this.h = h;
};

/* Подпись города рисуем поверх, обычным слоем над холстом */
Globe3D.prototype.drawLabel = function () {
  var box = this._label;
  if (!box) {
    box = document.createElement("div");
    box.className = "g3-label";
    this.cv.parentNode.appendChild(box);
    this._label = box;
  }
  if (this.hover < 0 || this.hover >= this.nodes.length) { box.style.opacity = 0; return; }
  var n = this.nodes[this.hover];
  var v = vec3(n[1], n[2], 1.02).applyMatrix4(this.world.matrixWorld);
  var p = v.clone().project(this.cam);
  if (p.z > 1) { box.style.opacity = 0; return; }
  var facing = v.clone().normalize().dot(this.cam.position.clone().normalize());
  if (facing < 0.05) { box.style.opacity = 0; return; }
  var tag = (n[4] & 4) ? " · скоро" : (n[4] & 1) ? " · облако" : (n[4] & 2) ? " · защита" : "";
  box.textContent = n[0] + tag;
  box.style.left = ((p.x * 0.5 + 0.5) * this.w).toFixed(0) + "px";
  box.style.top = ((-p.y * 0.5 + 0.5) * this.h - 34).toFixed(0) + "px";
  box.style.opacity = 1;
};

Globe3D.prototype.frame = function (dt) {
  this._t += dt;

  if (!this.dragging) {
    if (this.focus) {
      var target = -this.focus.lon * RAD;
      var diff = ((target - this.spin + Math.PI * 3) % TAU) - Math.PI;
      this.spin += diff * Math.min(1, dt * 2.6);
      this.world.rotation.x += (clamp(this.focus.lat, -55, 55) * RAD * 0.85 - this.world.rotation.x) * Math.min(1, dt * 2.6);
      if (Math.abs(diff) < 0.006) this.focus = null;
    } else {
      this.spin += this.speed * dt;
    }
  }
  this.world.rotation.y = this.spin;

  /* Пакеты бегут по дугам */
  for (var i = 0; i < this.arcs.length; i++) {
    var A = this.arcs[i];
    A.t += dt * A.sp;
    if (A.t > 1) A.t -= 1;
    A.curve.getPoint(A.t, A.packet.position);
  }

  /* Кольца у собственных ЦОД пульсируют */
  for (i = 0; i < this.dcMarks.length; i++) {
    var M = this.dcMarks[i];
    var ph = (this._t * 0.5 + M.phase) % 1;
    M.ring.scale.setScalar(1 + ph * 4.5);
    M.ring.material.opacity = (1 - ph) * 0.75;
    M.sprite.scale.setScalar(0.14 + Math.sin(this._t * 2 + M.phase * 6) * 0.02);
  }

  /* Вспышки от прохода ракеты: кольцо расходится, огонёк гаснет */
  if (this.pulses) {
    for (i = 0; i < this.pulses.length; i++) {
      var Q = this.pulses[i];
      if (Q.life <= 0) continue;
      Q.life -= dt * 1.3;
      if (Q.life <= 0) {
        Q.life = 0;
        Q.ring.visible = false;
        Q.dot.visible = false;
        continue;
      }
      var e = 1 - Q.life;                       /* 0 - только зажгли, 1 - погасла */
      Q.ring.scale.setScalar(1 + e * 7);
      Q.ring.material.opacity = (1 - e) * 0.85;
      Q.dot.scale.setScalar(0.10 + (1 - e) * 0.20);
      Q.dot.material.opacity = (1 - e) * 0.9;
    }
  }

  this.world.updateMatrixWorld();
  this.r.render(this.scene, this.cam);
  this.drawLabel();
};

Globe3D.prototype.tick = function (ts) {
  if (!this.running) return;
  this._raf = requestAnimationFrame(this.tick.bind(this));
  var dt = this._last ? Math.min(0.05, (ts - this._last) / 1000) : 0.016;
  this._last = ts;
  this.frame(dt);
};
Globe3D.prototype.start = function () {
  if (this.running) return;
  this.running = true; this._last = 0;
  this._raf = requestAnimationFrame(this.tick.bind(this));
};
Globe3D.prototype.stop = function () {
  this.running = false;
  if (this._raf) cancelAnimationFrame(this._raf);
};
Globe3D.prototype.focusOn = function (lat, lon) { this.focus = { lat: lat, lon: lon }; };

/* ── Вспышка узла под ракетой ────────────────────────────────
   Ракета идёт по орбите поверх планеты, и когда она проходит над
   точкой сети, точка отзывается: расходится кольцо и вспыхивает
   огонёк. Кольца заведены пулом на всю жизнь сцены - создавать их
   на каждый проход дороже, чем держать четыре штуки наготове. */
Globe3D.prototype.buildPulses = function () {
  var P = this.palette();
  var n = this.mob ? 2 : 4;
  var geo = new T.RingGeometry(0.035, 0.052, this.mob ? 18 : 30);
  var glow = this._glowTex || (this._glowTex = glowTexture());
  this.pulses = [];
  this._pulseAt = 0;
  for (var i = 0; i < n; i++) {
    var ring = new T.Mesh(geo, new T.MeshBasicMaterial({
      color: new T.Color().fromArray(P.dc), transparent: true, opacity: 0,
      side: T.DoubleSide, depthWrite: false
    }));
    var dot = new T.Sprite(new T.SpriteMaterial({
      map: glow, color: new T.Color().fromArray(P.dc), transparent: true,
      blending: T.AdditiveBlending, depthWrite: false, opacity: 0
    }));
    ring.visible = false;
    dot.visible = false;
    this.world.add(ring);
    this.world.add(dot);
    this.pulses.push({ ring: ring, dot: dot, life: 0 });
  }
};

/* Зажечь узел по его номеру в общем списке точек */
Globe3D.prototype.pulse = function (i) {
  var n = this.nodes[i];
  if (!n) return;
  if (!this.pulses) this.buildPulses();
  var Q = this.pulses[this._pulseAt % this.pulses.length];
  this._pulseAt++;

  var v = vec3(n[1], n[2], 1.02);
  Q.ring.position.copy(v);
  /* Кольцо ложится на поверхность шара. Разворот считаем в своих
     координатах: мир вращается, и lookAt по мировой точке врал бы. */
  Q.ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), v.clone().normalize());
  Q.dot.position.copy(v);
  Q.ring.visible = true;
  Q.dot.visible = true;
  Q.life = 1;
  try {
    dispatchEvent(new CustomEvent("rc:node-flash", { detail: { i: i, name: n[0] } }));
  } catch (e) {}
};

/* Какой узел сейчас под этой точкой окна. Только ищет, ничего не жжёт:
   решение «зажигать или нет» принимает тот, кто спрашивает, - иначе
   один и тот же город вспыхивал бы каждый кадр, пока ракета над ним. */
Globe3D.prototype.nearNode = function (sx, sy, rad) {
  if (!this.nodeGeo) return -1;
  var b = this.cv.getBoundingClientRect();
  if (!b.width) return -1;
  return this._nearest(sx - b.left, sy - b.top, rad || 40);
};

/* Ближайший узел к точке экрана: считаем проекцией, это дешевле луча */
Globe3D.prototype._nearest = function (sx, sy, rad) {
  var lim = rad || 24;
  var best = -1, bd = lim * lim;
  var pos = this.nodeGeo.getAttribute("position");
  var v = new T.Vector3();
  for (var i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(this.world.matrixWorld);
    if (v.clone().normalize().dot(this.cam.position.clone().normalize()) < 0.08) continue;
    var p = v.project(this.cam);
    var x = (p.x * 0.5 + 0.5) * this.w, y = (-p.y * 0.5 + 0.5) * this.h;
    var dx = x - sx, dy = y - sy, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = this._nodeIndex[i]; }
  }
  return best;
};

Globe3D.prototype.bind = function () {
  var self = this, px = 0, py = 0, moved = 0;

  function local(e) {
    var r = self.cv.getBoundingClientRect();
    var t = e.touches && e.touches[0] ? e.touches[0] : e;
    return [t.clientX - r.left, t.clientY - r.top];
  }
  function down(e) { self.dragging = true; moved = 0; var l = local(e); px = l[0]; py = l[1]; self.focus = null; }
  function move(e) {
    var l = local(e);
    if (self.dragging) {
      var dx = l[0] - px, dy = l[1] - py;
      px = l[0]; py = l[1];
      moved += Math.abs(dx) + Math.abs(dy);
      self.spin += dx * 0.006;
      self.world.rotation.x = clamp(self.world.rotation.x + dy * 0.005, -1.1, 1.1);
      if (e.cancelable && Math.abs(dx) > 2) e.preventDefault();
    } else {
      var h = self._nearest(l[0], l[1]);
      if (h !== self.hover) {
        self.hover = h;
        self.cv.style.cursor = h >= 0 ? "pointer" : "grab";
        if (self.opts.onHover) self.opts.onHover(h);
      }
    }
  }
  function up(e) {
    if (self.dragging && moved < 8) {
      var l = local(e.changedTouches && e.changedTouches[0] ? e.changedTouches[0] : e);
      var h = self._nearest(l[0], l[1]);
      self.hover = h;
      if (h >= 0 && self.opts.onPick) self.opts.onPick(h);
    }
    self.dragging = false;
  }

  this.cv.addEventListener("mousedown", down);
  this.cv.addEventListener("mousemove", move);
  addEventListener("mouseup", up);
  this.cv.addEventListener("mouseleave", function () { self.dragging = false; self.hover = -1; self.drawLabel(); });
  this.cv.addEventListener("touchstart", down, { passive: true });
  this.cv.addEventListener("touchmove", move, { passive: false });
  this.cv.addEventListener("touchend", up);
  this.cv.style.cursor = "grab";

  if (g.IntersectionObserver) {
    new IntersectionObserver(function (ents) {
      self._inView = ents[0].isIntersecting;
      self._inView && !document.hidden ? self.start() : self.stop();
    }, { threshold: 0.02 }).observe(this.cv);
  } else { self._inView = true; self.start(); }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) self.stop();
    else if (self._inView) self.start();
  });

  var rt;
  addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { self.resize(); self.seedArcs(); }, 180);
  });
};

g.RCGlobe3D = Globe3D;
})(window);
