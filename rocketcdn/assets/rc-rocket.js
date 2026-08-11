/* ═══════════════════════════════════════════════════════════
   RocketCDN · 3D-ракета, летящая через весь сайт по скроллу.

   Геометрия собирается кодом: корпус, сопло, стабилизаторы,
   иллюминатор, обшивка с логотипом. Металл отражает
   процедурную среду, поэтому выглядит как настоящий.
   Факел - свой шейдер с шумом, плюс искры и дымный след.

   Путь замкнут: прогресс 1 совпадает с прогрессом 0, поэтому
   бесконечная прокрутка не даёт рывка.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

if (!g.THREE) return;
var T = g.THREE;

/* ── Возможности устройства ──────────────────────────────── */
function caps() {
  var w = innerWidth, mob = w < 760;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mem = navigator.deviceMemory || 4;
  var weak = mob || mem <= 2 || (navigator.hardwareConcurrency || 4) <= 4;
  return {
    mobile: mob,
    reduce: reduce,
    weak: weak,
    dpr: Math.min(g.devicePixelRatio || 1, weak ? 1.35 : 2),
    aa: !weak,
    sparks: weak ? 140 : 420,
    smoke: weak ? 60 : 170,
    radial: weak ? 28 : 64,
    lathe: weak ? 40 : 96,
    shadow: false
  };
}

/* ── Процедурная среда для отражений металла ─────────────── */
function envTexture(renderer) {
  var c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  var x = c.getContext("2d");

  var sky = x.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0.00, "#1E4F78");
  sky.addColorStop(0.42, "#2A6E9E");
  sky.addColorStop(0.52, "#10243A");
  sky.addColorStop(1.00, "#060F1A");
  x.fillStyle = sky;
  x.fillRect(0, 0, 512, 256);

  /* Мягкие источники: холодный ключевой и фиолетовый контровой */
  function blob(cx, cy, r, col, a) {
    var gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, col);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    x.globalAlpha = a;
    x.fillStyle = gr;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    x.globalAlpha = 1;
  }
  blob(120, 60, 130, "#BFE9FF", 0.95);
  blob(390, 82, 110, "#8A59F6", 0.55);
  blob(256, 200, 150, "#42B2DC", 0.35);
  blob(470, 40, 70, "#FFFFFF", 0.7);

  var tex = new T.CanvasTexture(c);
  tex.mapping = T.EquirectangularReflectionMapping;
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;

  var pmrem = new T.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  var env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

/* ── Текстура обшивки: панели, кольца, надпись вдоль корпуса ─
   У LatheGeometry u идёт по окружности, v - вдоль профиля.
   Значит надпись, чтобы читаться вдоль корпуса, рисуется
   повёрнутой на девяносто градусов. */
function hullTexture() {
  var W = 1024, H = 1024;
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");

  /* Светлый металл с продольным градиентом */
  var base = x.createLinearGradient(0, 0, W, 0);
  base.addColorStop(0.00, "#C9D6E4");
  base.addColorStop(0.22, "#F4F8FC");
  base.addColorStop(0.50, "#DDE6F0");
  base.addColorStop(0.78, "#F7FAFD");
  base.addColorStop(1.00, "#C9D6E4");
  x.fillStyle = base;
  x.fillRect(0, 0, W, H);

  /* Мелкая фактура металла */
  for (var i = 0; i < 3400; i++) {
    x.globalAlpha = 0.025 + Math.random() * 0.045;
    x.fillStyle = Math.random() > 0.5 ? "#FFFFFF" : "#A9BACD";
    x.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 4, 1);
  }
  x.globalAlpha = 1;

  /* Продольные швы обшивки */
  x.strokeStyle = "rgba(120,142,168,.30)";
  x.lineWidth = 2;
  for (i = 0; i < 8; i++) {
    var px = (i / 8) * W;
    x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke();
  }

  /* v: 0 - сопло, 1 - нос. По холсту y = (1 - v) * H */
  function ring(v, h, fill) {
    x.fillStyle = fill;
    x.fillRect(0, (1 - v - h) * H, W, h * H);
  }

  /* Фирменные кольца */
  var gr = x.createLinearGradient(0, (1 - 0.80) * H, 0, (1 - 0.74) * H);
  gr.addColorStop(0, "#5BC4EA");
  gr.addColorStop(1, "#0A5897");
  x.fillStyle = gr;
  x.fillRect(0, (1 - 0.80) * H, W, 0.06 * H);

  gr = x.createLinearGradient(0, (1 - 0.20) * H, 0, (1 - 0.13) * H);
  gr.addColorStop(0, "#0A5897");
  gr.addColorStop(1, "#5BC4EA");
  x.fillStyle = gr;
  x.fillRect(0, (1 - 0.20) * H, W, 0.07 * H);

  /* Технический пояс у сопла */
  ring(0.05, 0.07, "#1B2E44");
  /* Тонкие кольца жёсткости */
  x.fillStyle = "rgba(96,118,146,.34)";
  [0.30, 0.34, 0.62, 0.66].forEach(function (v) { x.fillRect(0, (1 - v) * H, W, 3); });

  /* Надпись вдоль корпуса, четыре раза по окружности */
  var fam = '"Golos Text", "Arial Black", Arial, sans-serif';
  for (i = 0; i < 4; i++) {
    var cx = (i + 0.5) * (W / 4);
    x.save();
    x.translate(cx, (1 - 0.50) * H);
    x.rotate(Math.PI / 2);
    x.textAlign = "center";
    x.textBaseline = "middle";

    x.font = "800 96px " + fam;
    var wRocket = x.measureText("Rocket").width;
    var wCDN = x.measureText("CDN").width;
    var total = wRocket + wCDN;
    x.fillStyle = "#0B1726";
    x.fillText("Rocket", -total / 2 + wRocket / 2, -26);
    x.fillStyle = "#1B84BE";
    x.fillText("CDN", total / 2 - wCDN / 2, -26);

    x.font = "700 22px " + fam;
    try { x.letterSpacing = "9px"; } catch (e) {}
    x.fillStyle = "rgba(11,23,38,.45)";
    x.fillText("FAST. RELIABLE. GLOBAL.", 0, 42);
    try { x.letterSpacing = "0px"; } catch (e) {}
    x.restore();
  }

  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  tex.anisotropy = 8;
  /* Смотрим на корпус снаружи, поэтому текстуру зеркалим */
  tex.wrapS = T.RepeatWrapping;
  tex.repeat.x = -1;
  return tex;
}

/* Круглая мягкая точка для искр и дыма */
function dotTexture(soft) {
  var s = 64, c = document.createElement("canvas");
  c.width = c.height = s;
  var x = c.getContext("2d");
  var gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  if (soft) {
    gr.addColorStop(0, "rgba(255,255,255,.55)");
    gr.addColorStop(0.5, "rgba(255,255,255,.18)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.28, "rgba(190,240,255,.85)");
    gr.addColorStop(1, "rgba(66,178,220,0)");
  }
  x.fillStyle = gr;
  x.fillRect(0, 0, s, s);
  return new T.CanvasTexture(c);
}

/* ── Сборка ракеты ───────────────────────────────────────── */
function buildRocket(C, env) {
  var root = new T.Group();

  var hullMat = new T.MeshStandardMaterial({
    map: hullTexture(),
    metalness: 0.58,
    roughness: 0.30,
    envMap: env,
    envMapIntensity: 1.5
  });

  /* Профиль корпуса: от сопла (низ) к носу (верх) */
  var pts = [];
  function P(y, r) { pts.push(new T.Vector2(r, y)); }
  P(-2.30, 0.00);
  P(-2.28, 0.46);
  P(-2.10, 0.60);
  P(-1.86, 0.52);          /* юбка сопла */
  P(-1.60, 0.56);
  P(-1.10, 0.62);
  P(-0.20, 0.64);
  P( 0.90, 0.62);
  P( 1.45, 0.55);
  P( 1.95, 0.40);
  P( 2.35, 0.22);
  P( 2.62, 0.08);
  P( 2.72, 0.00);          /* остриё */

  var body = new T.Mesh(
    new T.LatheGeometry(pts, C.radial),
    hullMat
  );
  body.geometry.computeVertexNormals();
  root.add(body);

  /* Носовой конус потемнее, чтобы читался силуэт */
  var tipMat = new T.MeshStandardMaterial({
    color: 0x2C5F8C, metalness: 0.72, roughness: 0.22, envMap: env, envMapIntensity: 1.7
  });
  var tipPts = [];
  tipPts.push(new T.Vector2(0.001, 1.95));
  tipPts.push(new T.Vector2(0.40, 1.95));
  tipPts.push(new T.Vector2(0.24, 2.34));
  tipPts.push(new T.Vector2(0.09, 2.62));
  tipPts.push(new T.Vector2(0.001, 2.74));
  var tip = new T.Mesh(new T.LatheGeometry(tipPts, C.radial), tipMat);
  root.add(tip);

  /* Сопло: раструб с тёмным нутром */
  var bellMat = new T.MeshStandardMaterial({
    color: 0x51657C, metalness: 0.9, roughness: 0.32,
    envMap: env, envMapIntensity: 1.1, side: T.DoubleSide
  });
  var bell = new T.Mesh(
    new T.CylinderGeometry(0.62, 0.40, 0.62, C.radial, 1, true),
    bellMat
  );
  bell.position.y = -2.06;
  root.add(bell);

  var throat = new T.Mesh(
    new T.CircleGeometry(0.40, C.radial),
    new T.MeshBasicMaterial({ color: 0x8FE6FF })
  );
  throat.rotation.x = Math.PI / 2;
  throat.position.y = -1.78;
  root.add(throat);

  /* Стабилизаторы */
  var finShape = new T.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.05, 1.05);
  finShape.quadraticCurveTo(0.75, 0.62, 1.02, -0.42);
  finShape.quadraticCurveTo(0.62, -0.30, 0.10, -0.34);
  finShape.lineTo(0, 0);
  var finGeo = new T.ExtrudeGeometry(finShape, {
    depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2
  });
  finGeo.translate(0, 0, -0.035);
  var finMat = new T.MeshStandardMaterial({
    color: 0x2E7EB4, metalness: 0.75, roughness: 0.24, envMap: env, envMapIntensity: 1.6
  });
  for (var f = 0; f < 3; f++) {
    var finPivot = new T.Group();
    var fin = new T.Mesh(finGeo, finMat);
    fin.position.set(0.46, -1.62, 0);
    finPivot.add(fin);
    finPivot.rotation.y = (f / 3) * Math.PI * 2;
    root.add(finPivot);
  }

  /* Иллюминатор со светящимся ободом */
  var winGroup = new T.Group();
  var ring = new T.Mesh(
    new T.TorusGeometry(0.235, 0.055, 10, 28),
    new T.MeshStandardMaterial({ color: 0xE6EEF7, metalness: 1, roughness: 0.16, envMap: env })
  );
  var glass = new T.Mesh(
    new T.CircleGeometry(0.215, 28),
    new T.MeshStandardMaterial({
      color: 0x0A2740, metalness: 0.4, roughness: 0.06,
      emissive: 0x2E9BD6, emissiveIntensity: 0.75, envMap: env, envMapIntensity: 2
    })
  );
  glass.position.z = 0.02;
  winGroup.add(ring, glass);
  winGroup.position.set(0, 1.06, 0.60);
  root.add(winGroup);

  /* Тонкие светящиеся полосы по корпусу */
  var glowMat = new T.MeshBasicMaterial({ color: 0x5FD0F5, transparent: true, opacity: 0.62 });
  [[-1.28, 0.615], [0.30, 0.645]].forEach(function (r) {
    var strip = new T.Mesh(new T.TorusGeometry(r[1] + 0.004, 0.012, 6, C.radial), glowMat);
    strip.rotation.x = Math.PI / 2;
    strip.position.y = r[0];
    root.add(strip);
  });

  return { root: root, body: body, glass: glass, glowMat: glowMat };
}

/* ── Факел ───────────────────────────────────────────────── */
var FLAME_VERT = [
  "varying vec2 vUv;",
  "varying float vY;",
  "uniform float uTime;",
  "uniform float uPower;",
  "void main(){",
  "  vUv = uv;",
  "  vec3 p = position;",
  "  float t = uv.y;",                          /* 0 у сопла, 1 у хвоста */
  "  float wob = sin(uTime*13.0 + t*9.0)*0.035 + sin(uTime*21.0 + t*17.0)*0.022;",
  "  p.x += wob * t * 1.6;",
  "  p.z += cos(uTime*17.0 + t*11.0)*0.03 * t * 1.6;",
  "  p.y *= mix(0.75, 1.55, uPower);",
  "  vY = t;",
  "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);",
  "}"
].join("\n");

var FLAME_FRAG = [
  "varying vec2 vUv;",
  "varying float vY;",
  "uniform float uTime;",
  "uniform float uPower;",
  "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }",
  "float noise(vec2 p){",
  "  vec2 i = floor(p), f = fract(p);",
  "  f = f*f*(3.0-2.0*f);",
  "  float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));",
  "  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);",
  "}",
  "float fbm(vec2 p){",
  "  float v=0.0, a=0.5;",
  "  for(int i=0;i<4;i++){ v += a*noise(p); p*=2.03; a*=0.5; }",
  "  return v;",
  "}",
  "void main(){",
  "  float t = vY;",
  "  float n = fbm(vec2(vUv.x*7.0, t*5.0 - uTime*3.4));",
  "  float core = smoothstep(0.95, 0.05, t);",
  "  float edge = 1.0 - abs(vUv.x - 0.5)*2.0;",
  "  float body = core * smoothstep(0.0, 0.45, edge);",
  "  float a = body * (0.55 + n*0.75) * (0.45 + uPower*0.75);",
  "  a *= smoothstep(1.0, 0.72, t);",
  "  vec3 white = vec3(1.0, 0.99, 0.96);",
  "  vec3 cyan  = vec3(0.36, 0.78, 0.98);",
  "  vec3 blue  = vec3(0.05, 0.32, 0.62);",
  "  vec3 viol  = vec3(0.54, 0.35, 0.96);",
  "  vec3 col = mix(white, cyan, smoothstep(0.02, 0.30, t));",
  "  col = mix(col, blue, smoothstep(0.30, 0.68, t));",
  "  col = mix(col, viol, smoothstep(0.62, 1.0, t) * 0.7);",
  "  col += n * 0.18;",
  "  if (a < 0.004) discard;",
  "  gl_FragColor = vec4(col, a);",
  "}"
].join("\n");

function buildFlame(C) {
  var grp = new T.Group();

  var geo = new T.ConeGeometry(0.44, 2.5, C.weak ? 18 : 34, 14, true);
  geo.rotateX(Math.PI);           /* остриё вниз, широкая часть к соплу */
  geo.translate(0, -1.25, 0);
  var uniforms = { uTime: { value: 0 }, uPower: { value: 0.5 } };
  var mat = new T.ShaderMaterial({
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    uniforms: uniforms,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    side: T.DoubleSide
  });
  var cone = new T.Mesh(geo, mat);
  cone.position.y = -2.28;
  grp.add(cone);

  /* Внутреннее ядро - короткое и яркое */
  var core = new T.Mesh(
    geo.clone().scale(0.46, 0.42, 0.46),
    new T.MeshBasicMaterial({ color: 0xE8FBFF, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false })
  );
  core.position.y = -2.24;
  grp.add(core);

  /* Ореол вокруг сопла */
  var halo = new T.Sprite(new T.SpriteMaterial({
    map: dotTexture(false), color: 0x5FD0F5, transparent: true,
    blending: T.AdditiveBlending, depthWrite: false, opacity: 0.9
  }));
  halo.scale.set(2.6, 2.6, 1);
  halo.position.y = -2.3;
  grp.add(halo);

  return { group: grp, uniforms: uniforms, core: core, halo: halo };
}

/* ── Искры и дымный след ─────────────────────────────────── */
function buildTrail(C) {
  function make(n, size, tex, color, opacity) {
    var pos = new Float32Array(n * 3);
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var mat = new T.PointsMaterial({
      size: size, map: tex, transparent: true, depthWrite: false,
      blending: T.AdditiveBlending, color: color, opacity: opacity, sizeAttenuation: true
    });
    var pts = new T.Points(geo, mat);
    pts.frustumCulled = false;
    return { pts: pts, pos: pos, n: n, life: new Float32Array(n), vel: new Float32Array(n * 3) };
  }
  var sparkTex = dotTexture(false), smokeTex = dotTexture(true);
  var sparks = make(C.sparks, 0.13, sparkTex, 0x9BE8FF, 0.95);
  var smoke  = make(C.smoke, 0.62, smokeTex, 0x2E6E96, 0.30);
  smoke.pts.material.blending = T.NormalBlending;

  function reset(S, i, spread, speed) {
    S.pos[i * 3]     = (Math.random() - 0.5) * spread;
    S.pos[i * 3 + 1] = -2.3 - Math.random() * 0.3;
    S.pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
    S.vel[i * 3]     = (Math.random() - 0.5) * 0.5;
    S.vel[i * 3 + 1] = -(speed + Math.random() * speed);
    S.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    S.life[i] = 0.6 + Math.random() * 0.9;
  }
  for (var i = 0; i < sparks.n; i++) reset(sparks, i, 0.5, 4.5);
  for (i = 0; i < smoke.n; i++) reset(smoke, i, 0.7, 1.4);

  return {
    sparks: sparks, smoke: smoke, reset: reset,
    step: function (dt, power) {
      [[sparks, 0.5, 4.5], [smoke, 0.7, 1.4]].forEach(function (cfg) {
        var S = cfg[0];
        for (var i = 0; i < S.n; i++) {
          S.life[i] -= dt;
          if (S.life[i] <= 0) { reset(S, i, cfg[1], cfg[2] * (0.6 + power)); continue; }
          S.pos[i * 3]     += S.vel[i * 3] * dt;
          S.pos[i * 3 + 1] += S.vel[i * 3 + 1] * dt * (0.6 + power);
          S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
        }
        S.pts.geometry.attributes.position.needsUpdate = true;
      });
    }
  };
}

/* ── Путь: замкнутая кривая, чтобы цикл был бесшовным ────── */
function buildPath() {
  var v = function (x, y, z) { return new T.Vector3(x, y, z); };
  return new T.CatmullRomCurve3([
    v( 7.6,  3.4, -5.0),
    v( 3.2,  1.6, -1.2),
    v(-2.6,  2.6, -2.4),
    v(-6.8,  0.4, -4.2),
    v(-4.4, -2.6, -0.6),
    v( 0.4, -3.4, -3.4),
    v( 5.2, -1.8, -1.0),
    v( 8.4,  0.6, -4.6)
  ], true, "catmullrom", 0.5);
}

/* ═══ Основной класс ═════════════════════════════════════ */
function Rocket(canvas) {
  var C = caps();
  this.C = C;
  this.canvas = canvas;
  this.progress = 0;
  this.shown = 0;
  this.power = 0.45;
  this.time = 0;
  this.running = false;

  var r = new T.WebGLRenderer({
    canvas: canvas, alpha: true, antialias: C.aa, powerPreference: "high-performance"
  });
  r.setPixelRatio(C.dpr);
  r.setSize(innerWidth, innerHeight, false);
  if (T.SRGBColorSpace) r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.32;
  this.r = r;

  var scene = new T.Scene();
  this.scene = scene;

  var cam = new T.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 100);
  cam.position.set(0, 0, 13.5);
  this.cam = cam;

  var env = envTexture(r);
  this.env = env;

  scene.add(new T.HemisphereLight(0xCFEBFF, 0x0C1D2E, 1.15));
  var key = new T.DirectionalLight(0xF4FBFF, 3.0);
  key.position.set(4, 6, 7);
  scene.add(key);
  var rim = new T.DirectionalLight(0x8A59F6, 2.0);
  rim.position.set(-6, -2, -4);
  scene.add(rim);
  var fill = new T.DirectionalLight(0x62C6EA, 1.4);
  fill.position.set(-3, 4, 5);
  scene.add(fill);

  var built = buildRocket(C, env);
  this.rocket = built;

  var flame = buildFlame(C);
  this.flame = flame;

  var trail = buildTrail(C);
  this.trail = trail;

  /* Свет от факела - подсвечивает корпус снизу */
  var engineLight = new T.PointLight(0x6FD6FF, 3.2, 9, 2);
  engineLight.position.set(0, -2.6, 0);
  this.engineLight = engineLight;

  var craft = new T.Group();
  craft.add(built.root, flame.group, trail.sparks.pts, trail.smoke.pts, engineLight);
  this.craft = craft;

  /* Внешняя группа отвечает за положение и наклон по пути */
  var pivot = new T.Group();
  pivot.add(craft);
  scene.add(pivot);
  this.pivot = pivot;

  this.path = buildPath();
  this._tmpA = new T.Vector3();
  this._tmpB = new T.Vector3();
  this._q = new T.Quaternion();
  this._up = new T.Vector3(0, 1, 0);

  this.bind();
  this.resize();
  this.layout(0);
}

Rocket.prototype.bind = function () {
  var self = this, rt;
  addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { self.resize(); }, 160);
  });
  document.addEventListener("visibilitychange", function () {
    document.hidden ? self.stop() : self.start();
  });
};

Rocket.prototype.resize = function () {
  var w = innerWidth, h = innerHeight;
  this.r.setPixelRatio(Math.min(g.devicePixelRatio || 1, this.C.weak ? 1.35 : 2));
  this.r.setSize(w, h, false);
  this.cam.aspect = w / h;
  /* На узком экране отодвигаем камеру, чтобы ракета целиком влезала */
  this.cam.position.z = w < 760 ? 17.5 : 13.5;
  this.cam.updateProjectionMatrix();
};

/* Раскладка по прогрессу прокрутки: положение, поворот, масштаб */
Rocket.prototype.layout = function (p) {
  p = ((p % 1) + 1) % 1;
  var pos = this.path.getPointAt(p, this._tmpA);
  var tan = this.path.getTangentAt(p, this._tmpB).normalize();

  this.pivot.position.copy(pos);

  /* Нос смотрит вдоль движения */
  this._q.setFromUnitVectors(this._up, tan);
  this.pivot.quaternion.slerp(this._q, 0.22);

  /* Крен по горизонтальной составляющей */
  this.craft.rotation.z = -tan.x * 0.55;
  this.craft.rotation.y += 0.004;

  /* Дальние участки пути делаем мельче, ближние крупнее */
  var s = this.C.mobile ? 0.62 : 0.86;
  this.pivot.scale.setScalar(s);
};

Rocket.prototype.setProgress = function (p, velocity) {
  this.progress = p;
  this.power = Math.max(0.32, Math.min(1, 0.36 + Math.abs(velocity || 0) * 0.05));
};

Rocket.prototype.frame = function (dt) {
  this.time += dt;
  var t = this.time;

  this.layout(this.progress);

  /* Покачивание в состоянии покоя */
  this.craft.position.y = Math.sin(t * 1.35) * 0.16;
  this.craft.position.x = Math.cos(t * 0.9) * 0.09;

  /* Факел дышит и реагирует на скорость прокрутки */
  var flick = 0.86 + Math.sin(t * 27) * 0.07 + Math.sin(t * 41) * 0.05;
  this.flame.uniforms.uTime.value = t;
  this.flame.uniforms.uPower.value = this.power * flick;
  this.flame.core.scale.setScalar(0.9 + this.power * 0.35 * flick);
  var hs = 2.2 + this.power * 1.9 * flick;
  this.flame.halo.scale.set(hs, hs, 1);
  this.flame.halo.material.opacity = 0.55 + this.power * 0.4;
  this.engineLight.intensity = 2.2 + this.power * 3.4 * flick;

  /* Иллюминатор и полосы пульсируют */
  this.rocket.glass.material.emissiveIntensity = 0.6 + Math.sin(t * 2.1) * 0.22;
  this.rocket.glowMat.opacity = 0.5 + Math.sin(t * 1.7) * 0.18;

  this.trail.step(dt, this.power);

  /* Плавное появление после загрузки */
  if (this.shown < 1) {
    this.shown = Math.min(1, this.shown + dt * 0.7);
    this.pivot.scale.multiplyScalar(0.4 + this.shown * 0.6);
  }

  this.r.render(this.scene, this.cam);
};

Rocket.prototype.tick = function (ts) {
  if (!this.running) return;
  this._raf = requestAnimationFrame(this.tick.bind(this));

  /* На слабых устройствах держим тридцать кадров: глазу этого хватает,
     а батарее и плавности остального сайта заметно легче. */
  var min = this._minFrame;
  if (min) {
    if (this._acc2 && ts - this._acc2 < min) return;
    this._acc2 = ts;
  }
  var dt = this._last ? Math.min(0.05, (ts - this._last) / 1000) : 0.016;
  this._last = ts;
  this.frame(dt);

  /* Если кадры тяжёлые, сами переходим на тридцать в секунду */
  this._avg = (this._avg || 16) * 0.92 + (dt * 1000) * 0.08;
  if (!this._minFrame && this._avg > 26) this._minFrame = 1000 / 30;
};

Rocket.prototype.start = function () {
  if (this.running) return;
  this.running = true;
  this._last = 0;
  this._raf = requestAnimationFrame(this.tick.bind(this));
};

Rocket.prototype.stop = function () {
  this.running = false;
  if (this._raf) cancelAnimationFrame(this._raf);
};

Rocket.prototype.dispose = function () {
  this.stop();
  this.r.dispose();
};

/* ── Точка входа ─────────────────────────────────────────── */
g.RCRocket = {
  create: function (canvas) {
    if (!canvas) return null;
    /* Проверяем, что WebGL вообще есть */
    try {
      var test = document.createElement("canvas");
      var ctx = test.getContext("webgl2") || test.getContext("webgl");
      if (!ctx) return null;
    } catch (e) { return null; }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    try {
      return new Rocket(canvas);
    } catch (e) {
      if (g.RC_track) g.RC_track("jserr", "rocket: " + (e.message || e), true);
      return null;
    }
  }
};
})(window);
