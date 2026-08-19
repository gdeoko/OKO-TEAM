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

  /* Названия на корпусе нет: ракета всё время крутится, и на вращении
     любая надпись смазывается в кашу. Вместо букв - опознавательный знак:
     четыре фирменных шеврона по окружности. */
  for (i = 0; i < 4; i++) {
    var cx = (i + 0.5) * (W / 4);
    x.save();
    x.translate(cx, (1 - 0.50) * H);

    var sh = x.createLinearGradient(0, -80, 0, 80);
    sh.addColorStop(0, "#5BC4EA");
    sh.addColorStop(1, "#0A5897");
    x.fillStyle = sh;
    /* Шеврон остриём к носу, то есть вверх по холсту */
    [0, 74].forEach(function (off) {
      x.beginPath();
      x.moveTo(0, -62 + off);
      x.lineTo(56, 6 + off);
      x.lineTo(36, 6 + off);
      x.lineTo(0, -30 + off);
      x.lineTo(-36, 6 + off);
      x.lineTo(-56, 6 + off);
      x.closePath();
      x.fill();
    });
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

  var door = buildDoor(C, env, hullMat);
  root.add(door.group);

  return { root: root, body: body, glass: glass, glowMat: glowMat, door: door };
}

/* ── Люк в борту ─────────────────────────────────────────────
   Клиент повторил дважды: дверь должна быть у ТОЙ ракеты, что села
   перед нами, а не полноэкранными воротами поверх кадра. Значит
   люк - часть корпуса, здесь, в трёхмерной сцене: проём в обшивке,
   за ним настоящий салон со светом, поверх две изогнутые створки,
   вырезанные из того же цилиндра, что и борт.

   Створки не двигают геометрию: они поворачиваются вокруг оси
   корабля и уезжают по обшивке вбок - так ходят люки на цилиндре.
   Перспектива, масштаб и наклон достаются даром, потому что всё
   это живёт внутри ракеты и подчиняется ей. */
function cabinTexture() {
  var W = 512, H = 512;
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");

  /* Глубина салона: дальняя стена светлее пола и потолка */
  var bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0.00, "#050C15");
  bg.addColorStop(0.30, "#0C1F33");
  bg.addColorStop(0.58, "#14314C");
  bg.addColorStop(1.00, "#040A12");
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);

  /* Продольные панели дальней стены */
  x.strokeStyle = "rgba(126,166,200,.16)";
  x.lineWidth = 2;
  for (var i = 1; i < 7; i++) {
    x.beginPath(); x.moveTo((i / 7) * W, H * 0.16); x.lineTo((i / 7) * W, H * 0.86); x.stroke();
  }
  /* Пояс приборов: ряд ламп и экранов в глубине */
  x.fillStyle = "rgba(66,178,220,.20)";
  x.fillRect(0, H * 0.44, W, H * 0.10);
  for (i = 0; i < 9; i++) {
    x.fillStyle = i % 3 === 0 ? "rgba(155,232,255,.85)" : "rgba(66,178,220,.55)";
    x.fillRect(W * (0.08 + i * 0.10), H * 0.465, W * 0.045, H * 0.028);
  }
  /* Тёплый свет потолочной панели, ради которого проём и светится */
  var lamp = x.createRadialGradient(W / 2, H * 0.20, 0, W / 2, H * 0.20, W * 0.6);
  lamp.addColorStop(0, "rgba(255,214,160,.42)");
  lamp.addColorStop(0.45, "rgba(120,170,210,.14)");
  lamp.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = lamp;
  x.fillRect(0, 0, W, H);
  /* Решётка пола */
  x.strokeStyle = "rgba(150,190,225,.13)";
  x.lineWidth = 1;
  for (i = 0; i < 10; i++) {
    var yy = H * (0.86 + i * 0.016);
    x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke();
  }

  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  return tex;
}

/* Текстура створки: та же светлая обшивка, но со своей жизнью -
   поперечные рёбра жёсткости, фирменная полоса, трафарет и жёлтая
   предупредительная разметка по кромке. Атлас рассчитан на одну
   створку, поэтому рисунок не растягивается и дверь читается
   дверью с любого расстояния. */
function doorTexture() {
  var W = 256, H = 512;
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");

  var base = x.createLinearGradient(0, 0, W, 0);
  base.addColorStop(0.00, "#AFC0D2");
  base.addColorStop(0.30, "#EDF3F9");
  base.addColorStop(0.62, "#D7E1EC");
  base.addColorStop(1.00, "#9FB2C6");
  x.fillStyle = base;
  x.fillRect(0, 0, W, H);

  /* Рёбра жёсткости поперёк створки */
  for (var i = 1; i < 8; i++) {
    var y = (i / 8) * H;
    x.fillStyle = "rgba(110,134,160,.28)";
    x.fillRect(0, y, W, 3);
    x.fillStyle = "rgba(255,255,255,.55)";
    x.fillRect(0, y + 3, W, 1);
  }
  /* Фирменная полоса поперёк корпуса продолжается на двери */
  var st = x.createLinearGradient(0, H * 0.44, 0, H * 0.54);
  st.addColorStop(0, "#5BC4EA");
  st.addColorStop(1, "#0A5897");
  x.fillStyle = st;
  x.fillRect(0, H * 0.44, W, H * 0.10);

  /* Предупредительная разметка по кромке стыка (правый край UV) */
  for (i = 0; i < 26; i++) {
    x.fillStyle = i % 2 ? "rgba(232,176,48,.55)" : "rgba(38,48,62,.55)";
    x.save();
    x.translate(W - 16, (i / 26) * H);
    x.fillRect(0, 0, 16, H / 26 + 1);
    x.restore();
  }
  /* Трафарет и ручка-паз */
  x.fillStyle = "rgba(20,52,86,.30)";
  x.font = "600 15px 'Golos Text', system-ui, sans-serif";
  x.fillText("R-01", 26, H * 0.30);
  x.fillStyle = "rgba(40,60,84,.45)";
  x.fillRect(W * 0.18, H * 0.60, W * 0.40, 10);
  x.fillStyle = "rgba(255,255,255,.5)";
  x.fillRect(W * 0.18, H * 0.60 + 10, W * 0.40, 2);

  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildDoor(C, env, hullMat) {
  var group = new T.Group();

  /* Геометрия проёма: середина борта, чуть выше фирменного кольца */
  var R = 0.648;               /* радиус обшивки в этом месте */
  var HH = 1.34;               /* высота люка */
  var Y = 0.10;                /* центр люка по оси корабля */
  var HALF = 0.62;             /* половина угла проёма, радиан */
  var seg = Math.max(10, Math.round(C.radial / 4));

  /* 1. Салон за проёмом: изогнутая стена внутри корпуса. Она видна
     ещё до открытия сквозь щель, и это ровно то, что просили -
     «салон внутри ракеты сразу издалека виден такой, какой будет,
     когда мы зайдём». */
  var cabTex = cabinTexture();
  cabTex.wrapS = T.RepeatWrapping;
  cabTex.repeat.x = 1.6;                 /* панели не растягиваются по дуге */
  var cabin = new T.Mesh(
    new T.CylinderGeometry(R * 0.46, R * 0.46, HH * 1.06, seg, 1, true, -HALF * 1.9, HALF * 3.8),
    new T.MeshBasicMaterial({ map: cabTex, side: T.BackSide, toneMapped: false })
  );
  cabin.position.y = Y;
  cabin.renderOrder = 1;
  group.add(cabin);
  /* Пол тамбура: без него в проёме видна только стена, и глубины
     не читается. Тёмная решётка с бликом даёт понять, что там объём */
  var floor = new T.Mesh(
    new T.CircleGeometry(R * 0.46, seg),
    new T.MeshBasicMaterial({ color: 0x0A1726, toneMapped: false })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = Y - HH * 0.5;
  group.add(floor);

  /* Тёплая лампа в проёме: свет ложится на кромки створок */
  var lamp = new T.PointLight(0xFFD2A0, 0, 3.2, 2);
  lamp.position.set(0, Y + 0.3, R * 0.1);
  group.add(lamp);

  /* 2. Рама проёма: тёмная обвязка, по которой ходят створки */
  var frameMat = new T.MeshStandardMaterial({
    color: 0x6E829A, metalness: 0.92, roughness: 0.28, envMap: env, envMapIntensity: 1.6, side: T.DoubleSide
  });
  var frame = new T.Mesh(
    new T.CylinderGeometry(R * 0.995, R * 0.995, HH, seg, 1, true, -HALF * 1.07, HALF * 2.14),
    frameMat
  );
  frame.position.y = Y;
  group.add(frame);
  /* Уплотнитель по контуру проёма: тонкая тёмная кромка между рамой
     и створками. Без неё дверь сливается с бортом, с ней - читается
     как настоящий люк с притвором. */
  var sealMat = new T.MeshStandardMaterial({
    color: 0x1B2B3E, metalness: 0.7, roughness: 0.5, envMap: env, side: T.DoubleSide
  });
  var seal = new T.Mesh(
    new T.CylinderGeometry(R * 0.999, R * 0.999, HH * 0.995, seg, 1, true, -HALF * 1.03, HALF * 2.06),
    sealMat
  );
  seal.position.y = Y;
  group.add(seal);

  /* 3. Створки: тот же цилиндр, что и борт, потому и читаются
     обшивкой этого корабля, а не панелью поверх кадра. Материал
     свой: обшивочная текстура на узком сегменте растянулась бы
     всем атласом, и дверь выглядела бы окном с чужим рисунком. */
  var doorMat = new T.MeshStandardMaterial({
    map: doorTexture(), metalness: 0.62, roughness: 0.26,
    envMap: env, envMapIntensity: 1.45, side: T.DoubleSide
  });
  function leaf(sign) {
    var m = new T.Mesh(
      new T.CylinderGeometry(R * 1.004, R * 1.004, HH * 0.985, seg, 1, true,
        sign > 0 ? 0 : -HALF, HALF),
      doorMat
    );
    m.position.y = Y;
    return m;
  }
  var lTurn = new T.Group(), rTurn = new T.Group();
  lTurn.add(leaf(-1)); rTurn.add(leaf(1));
  group.add(lTurn, rTurn);

  /* Светящаяся кромка по стыку: сигнальная лента шлюза */
  var edgeMat = new T.MeshBasicMaterial({ color: 0x9FE0F6, transparent: true, opacity: 0.9, toneMapped: false });
  function edge(sign) {
    var m = new T.Mesh(new T.BoxGeometry(0.012, HH * 0.94, 0.02), edgeMat);
    m.position.set(sign * 0.012, Y, R * 1.012);
    return m;
  }
  var lEdge = edge(-1), rEdge = edge(1);
  lTurn.add(lEdge); rTurn.add(rEdge);

  return {
    group: group, l: lTurn, r: rTurn, lamp: lamp, cabin: cabin,
    edgeMat: edgeMat, y: Y, half: HALF
  };
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

/* ── След на витке ───────────────────────────────────────────
   Пока ракета идёт вокруг планеты, за ней остаётся дуга. Линия
   толщиной в пиксель на таком расстоянии не читается, а трубка
   стоит лишней геометрии, поэтому след - лента из треугольников,
   развёрнутая плашмя к камере. Хвост сужается и уходит в чёрный:
   при аддитивном смешении чёрный не даёт ничего, то есть тает.
   Буферы выделяются один раз, каждый кадр в них только пишем. */
function buildOrbTrail(C) {
  var N = C.weak ? 20 : 36;                       /* отрезков в ленте */
  var pos = new Float32Array((N + 1) * 2 * 3);
  var col = new Float32Array((N + 1) * 2 * 3);
  var idx = [];
  for (var i = 0; i < N; i++) {
    var a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  var geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  geo.setAttribute("color", new T.BufferAttribute(col, 3));
  geo.setIndex(idx);
  var mesh = new T.Mesh(geo, new T.MeshBasicMaterial({
    vertexColors: true, transparent: true,
    blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide
  }));
  mesh.frustumCulled = false;                     /* лента живёт вне пивота */
  mesh.visible = false;
  return { mesh: mesh, geo: geo, pos: pos, col: col, n: N };
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
  this._tmpC = new T.Vector3();
  this._q = new T.Quaternion();
  this._up = new T.Vector3(0, 1, 0);

  /* Уступает дорогу тексту: корпус белый, буквы белые, поверх читать нельзя */
  this._veil = 1;
  this._veilGoal = 1;
  this._veilT = 0;

  /* Орбита вокруг планеты */
  this.orbK = 0;      /* 0 - летим по маршруту, 1 - полностью на витке */
  this.orbA = 0;      /* угол на витке */
  this._orbV = 0;     /* разгон от прокрутки, 0..1 */
  this._orbW = null;  /* текущая угловая скорость витка */
  this._orbHas = 0;   /* хоть раз посчитали точку витка */
  this._fit = null;   /* сглаженный габарит витка */
  this._orbShift = null;
  this._lastNode = -1;
  this.occl = 1;      /* 1 - видна, ниже - уходит за шар */
  /* Подход к севшей ракете в акте walk: 0 - стоим у площадки,
     1 - упёрлись в корпус. Доля публикуется в RC_APPROACH, по ней
     шлюз решает, когда показывать створки. */
  this.appK = 0;
  this._orbP = new T.Vector3();
  this._orbT = new T.Vector3();
  this._tmpD = new T.Vector3();
  /* Точка витка: экранные координаты, глубина и та же точка в мире.
     Держим два готовых слепка и переписываем их, чтобы на каждый кадр
     не рождать по сотне объектов. */
  this._oA = { sx: 0, sy: 0, z: 0, v: new T.Vector3() };
  this._oB = { sx: 0, sy: 0, z: 0, v: new T.Vector3() };
  this._oT = new T.Vector3();
  this._oS = new T.Vector3();

  var otrail = buildOrbTrail(C);
  this.otrail = otrail;
  scene.add(otrail.mesh);

  canvas.classList.add("rk-soft");

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
/* ── Орбита вокруг планеты ────────────────────────────────
   Долистали до раздела с глобусом - ракета сходит с общей траектории
   и наматывает витки вокруг шара, сама по себе, пока человек читает.
   Тронулись дальше - плавно возвращается на траекторию из той точки,
   где была, без телепортов.

   Планета живёт в чужом холсте, поэтому орбита строится не по её сцене,
   а по экранному кругу: у обоих глобусов есть метод screenCircle. Круг
   переводится в мир камеры ракеты через размер кадра на нужной глубине. */

/* Раньше плоскость витка стояла почти ребром к зрителю, и весь облёт
   сводился к прямой черте, проходящей сбоку от шара. Теперь плоскость
   наклонена: по горизонтали ракета уходит за края планеты, по вертикали
   поднимается над ней. На экране путь читается эллипсом - видно, что
   это виток, а не пролёт мимо.

   Центр витка вынесен к зрителю (ORB_LIFT): благодаря этому ракета
   почти всё время идёт поверх планеты, а за шар ныряет коротко, у
   нижней кромки - ровно настолько, чтобы читалось «зашла за планету». */
var ORB_TILT = 0.58;                                  /* подъём витка по экрану */
var ORB_COS  = Math.sqrt(1 - ORB_TILT * ORB_TILT);    /* и его уход в глубину */
var ORB_R    = 1.36;                                  /* радиус витка в радиусах планеты */
var ORB_LIFT = 0.30;                                  /* смещение центра витка к камере */
var ORB_BASE = 0.62;                                  /* сам по себе: радиан в секунду */
var ORB_TAIL = 1.15;                                  /* длина следа, радиан */
var ORB_HEAD = 0.09;                                  /* след начинается за соплом */
var ORB_TAU  = Math.PI * 2;
var ORB_TOP  = 0.11;                                  /* поле над витком, доля кадра */

Rocket.prototype.globeCircle = function () {
  var list = g.__globes || [];
  for (var i = 0; i < list.length; i++) {
    var gl = list[i];
    if (!gl || typeof gl.screenCircle !== "function") continue;
    if (gl.cv && gl.cv.id !== "globeMap") continue;
    var c = gl.screenCircle();
    /* Запоминаем сам глобус: по нему потом зажигаем узлы под ракетой */
    if (c && c.r > 24) { this._globe = gl; return c; }
  }
  return null;
};

/* Насколько точка витка закрыта планетой: 0 - видна, 1 - за шаром.
   Условия два сразу: точка ушла глубже плоскости центра планеты и её
   снос от центра на экране меньше радиуса диска. Оба края мягкие,
   чтобы ракета не мигала на входе в тень. */
function hidden(o, c, planeZ, dz) {
  var d = (planeZ - o.z) / (dz * 0.22);
  if (d <= 0) return 0;
  if (d > 1) d = 1;
  var dx = (o.sx - c.cx) / c.r, dy = (o.sy - c.cy) / c.r;
  var ins = (1.02 - Math.sqrt(dx * dx + dy * dy)) / 0.20;
  if (ins <= 0) return 0;
  if (ins > 1) ins = 1;
  return d * ins;
}

/* Экранная точка в мир камеры ракеты на заданной глубине */
Rocket.prototype.toWorld = function (sx, sy, z, out) {
  var w = this.canvas.clientWidth || innerWidth;
  var h = this.canvas.clientHeight || innerHeight;
  var dist = this.cam.position.z - z;
  var halfH = Math.tan((this.cam.fov * Math.PI / 180) / 2) * dist;
  var halfW = halfH * (w / h);
  out.set(((sx / w) * 2 - 1) * halfW, (-(sy / h) * 2 + 1) * halfH, z);
  return { halfH: halfH, h: h };
};

/* Насколько мы «в разделе планеты»: 0 - мимо, 1 - шар целиком в кадре.

   Раньше мерили расстояние от центра шара до центра экрана - и в живой
   вёрстке этот замер не набирал единицы никогда: глобус стоит в левой
   колонке широкого раздела и до середины экрана не доходит. Ракета
   зависала между маршрутом и витком, то есть шла сбоку от планеты.
   Теперь считаем честнее: какая доля шара попала в кадр. */
function capture(c) {
  if (!c) return 0;
  var H = innerHeight;
  var vis = (Math.min(c.cy + c.r, H) - Math.max(c.cy - c.r, 0)) / (2 * c.r);
  var v = (vis - 0.42) / 0.34;
  return v < 0 ? 0 : v > 1 ? 1 : v * v * (3 - 2 * v);
}

/* Точка витка по углу. Эллипс строим прямо в экранных координатах
   вокруг круга планеты и только потом переводим в мир на своей глубине:
   так путь на экране всегда тот, который задумали, а перспектива не
   растягивает верх витка за кромку кадра.
   Ноль - левый край шара, дальше ракета идёт вверх и на зрителя,
   поверх планеты, к правому краю, и ныряет за шар снизу. */
Rocket.prototype.orbAt = function (a, cx, cy, Rs, z0, dz, out) {
  var ca = Math.cos(a), sa = Math.sin(a);
  out.sx = cx - Rs * ca;
  out.sy = cy - Rs * ORB_TILT * sa;
  out.z  = z0 + dz * sa;
  this.toWorld(out.sx, out.sy, out.z, out.v);
  return out;
};

/* Габарит витка. Раздел высокий, и планета часто стоит у самой верхней
   кромки: места на полный виток над ней нет. Тогда сначала опускаем
   виток (смещение до четверти радиуса глаз читает как наклон орбиты),
   а потом поджимаем его к планете. Ракета, срезанная кромкой экрана,
   выглядит поломкой; низкая орбита - нет.
   Сверху оставляем поле под саму ракету, а не под её центр. */
Rocket.prototype.orbFit = function (c, dt) {
  var up = c.r * ORB_R * ORB_TILT;
  var room = c.cy - innerHeight * ORB_TOP;
  var shift = 0;
  if (room < up) {
    shift = Math.min(c.r * 0.22, up - room);
    room += shift;
  }
  var k = up > 1 && room > 0 ? room / up : 1;
  k = k > 1 ? 1 : k < 0.72 ? 0.72 : k;

  /* Габарит и снос ведём плавно: пока человек листает, планета едет по
     кадру, и честный пересчёт на каждый кадр читался бы как дрожание
     орбиты вокруг шара. */
  var s = 1 - Math.exp(-(dt || 0.016) * 3);
  this._fit = this._fit == null ? k : this._fit + (k - this._fit) * s;
  this._orbShift = this._orbShift == null ? shift : this._orbShift + (shift - this._orbShift) * s;
  return this._fit;
};

/* Украшения витка: след и вспышки узлов. На быстрой прокрутке и на
   упрощённом режиме их нет - там дороже ровные кадры. */
Rocket.prototype.orbFX = function () {
  var root = document.documentElement;
  if (root.classList.contains("rc-fast")) return false;
  if (root.classList.contains("rc-reduced")) return false;
  return (parseInt(root.getAttribute("data-degrade") || "0", 10) || 0) < 3;
};

/* Планета лежит в общем потоке страницы, а поток по вёрстке идёт поверх
   холста ракеты: у каждой обёртки раздела свой слой. Из-за этого облёт
   «поверх планеты» и не читался - ракета честно шла по витку, но тонула
   под шаром. Пока раздел сети в кадре, поднимаем холст над содержимым, а
   на выходе возвращаем как было: в остальных сценах ракета обязана
   лететь ЗА текстом, а не по нему. */
Rocket.prototype.orbLayer = function (on) {
  on = !!on;
  if (on === this._orbTop) return;
  this._orbTop = on;
  this.canvas.style.zIndex = on ? "3" : "";
  document.documentElement.classList.toggle("rc-orbiting", on);
};

Rocket.prototype.orbit = function (dt) {
  var c = this.globeCircle();
  var want = capture(c);
  /* Захват мягкий: рывков на границе быть не должно. Сглаживание через
     экспоненту, а не через dt*k: на просевших кадрах линейная форма
     перепрыгивает половину пути за раз, и выход на виток дёргается. */
  this.orbK += (want - this.orbK) * (1 - Math.exp(-dt * 1.8));
  /* Слой переключаем на подходе, пока ракета ещё далеко от шара:
     сделай это на середине витка - и она вспыхнет посреди планеты. */
  this.orbLayer(want > 0.02 || this.orbK > 0.02);

  if (this.orbK < 0.002 && want < 0.002) {
    this.orbK = 0;
    this.occl = 1;
    this._lastNode = -1;
    if (this.otrail) this.otrail.mesh.visible = false;
    return null;
  }
  /* Планета пропала из разметки посреди схода с витка: последняя
     посчитанная точка остаётся якорем, и возврат на маршрут идёт
     плавно, а не прыжком из ниоткуда. */
  if (!c) {
    if (this.otrail) this.otrail.mesh.visible = false;
    return this._orbHas ? { stale: 1 } : null;
  }

  /* Виток идёт своим ходом, прокрутка его подгоняет. Берём модуль
     скорости: разгон всегда вперёд, поэтому смена направления
     прокрутки виток не разворачивает и не дёргает. */
  var boost = (this._orbV || 0) * Math.exp(-dt * 1.5);
  this._orbV = boost < 0.002 ? 0 : boost;
  var wantW = ORB_BASE * (1 + this._orbV * 2.6);
  var w = this._orbW == null ? ORB_BASE : this._orbW;
  this._orbW = w + (wantW - w) * (1 - Math.exp(-dt * 3.2));
  this.orbA += this._orbW * dt;
  if (this.orbA > ORB_TAU) this.orbA -= ORB_TAU;

  var planeZ = -1.6;                      /* планета «стоит» чуть в глубине */
  var m = this.toWorld(c.cx, c.cy, planeZ, this._tmpD);
  var Rw = (c.r / (m.h / 2)) * m.halfH;   /* радиус планеты в мире ракеты */
  var fit = this.orbFit(c, dt);
  var Rs = c.r * ORB_R * fit;             /* большая полуось витка, пиксели */
  var dz = Rw * ORB_R * fit * ORB_COS;    /* размах витка по глубине */
  var z0 = planeZ + Rw * ORB_LIFT;
  var cy = c.cy + this._orbShift;

  var A = this.orbAt(this.orbA, c.cx, cy, Rs, z0, dz, this._oA);
  var B = this.orbAt(this.orbA + 0.05, c.cx, cy, Rs, z0, dz, this._oB);
  this._orbP.copy(A.v);
  this._orbT.copy(B.v).sub(A.v).normalize();
  this._orbHas = 1;

  /* Ушла за шар - гаснет, как и положено: планета непрозрачная */
  this.occl = 1 - hidden(A, c, planeZ, dz) * 0.92 * this.orbK;

  var fx = this.orbFX();
  if (this.otrail) {
    this.otrail.mesh.visible = fx && this.orbK > 0.06;
    if (this.otrail.mesh.visible) this.tail(c, cy, Rs, z0, dz, planeZ, Rw);
  }
  if (fx) this.nodeFlash(dt, c);

  return { Rs: Rs, Rw: Rw };
};

/* Лента следа: идём назад по витку от текущего угла и на каждом шаге
   ставим пару точек поперёк движения. Поперечину берём как векторное
   произведение хода и направления на камеру - тогда лента всегда
   повёрнута к зрителю плашмя и не схлопывается в нитку. */
Rocket.prototype.tail = function (c, cy, Rs, z0, dz, planeZ, Rw) {
  var TR = this.otrail, N = TR.n, PS = TR.pos, CL = TR.col;
  var camz = this.cam.position.z;
  var t = this._oT, s = this._oS;
  var wid = Rw * 0.045;                   /* ширина ленты у сопла, в мире */

  for (var i = 0; i <= N; i++) {
    var u = i / N;                        /* 0 - у сопла, 1 - конец хвоста */
    var a = this.orbA - ORB_HEAD - ORB_TAIL * u;
    var A = this.orbAt(a, c.cx, cy, Rs, z0, dz, this._oA);
    var B = this.orbAt(a + 0.05, c.cx, cy, Rs, z0, dz, this._oB);
    var p = A.v;
    t.copy(B.v).sub(p).normalize();
    s.set(-p.x, -p.y, camz - p.z).normalize().cross(t);
    var len = s.length();
    if (len < 1e-4) s.set(0, 1, 0); else s.multiplyScalar(1 / len);

    var half = wid * (1 - u);
    var al = (1 - u) * (1 - u) * this.orbK * 0.60;
    al *= 1 - hidden(A, c, planeZ, dz) * 0.85;

    var j = i * 6;
    PS[j]     = p.x + s.x * half; PS[j + 1] = p.y + s.y * half; PS[j + 2] = p.z + s.z * half;
    PS[j + 3] = p.x - s.x * half; PS[j + 4] = p.y - s.y * half; PS[j + 5] = p.z - s.z * half;
    /* Красного почти нет: при аддитивном смешении иначе выходит не
       фирменный циан, а белёсый мазок поверх планеты */
    var cr = 0.18 * al, cg = 0.68 * al, cb = 1.00 * al;
    CL[j] = cr; CL[j + 1] = cg; CL[j + 2] = cb;
    CL[j + 3] = cr; CL[j + 4] = cg; CL[j + 5] = cb;
  }
  TR.geo.attributes.position.needsUpdate = true;
  TR.geo.attributes.color.needsUpdate = true;
};

/* Проход над узлом сети. Точная привязка к координатам тут не нужна:
   важно, чтобы вспышка совпала с проходом, поэтому берём ближайший к
   ракете узел на диске планеты и зажигаем его. Каждый узел за один
   проход загорается один раз. */
Rocket.prototype.nodeFlash = function (dt, c) {
  this._flashT = (this._flashT || 0) + dt;
  if (this._flashT < (this.C.mobile ? 0.62 : 0.38)) return;
  if (this.orbK < 0.5 || this.occl < 0.6) return;

  var gl = this._globe;
  if (!gl || typeof gl.nearNode !== "function") return;
  var pos = g.RC_ROCKET_POS;
  if (!pos || !isFinite(pos.x)) return;

  /* Светим только когда ракета идёт поверх диска планеты */
  var dx = pos.x - c.cx, dy = pos.y - c.cy;
  if (dx * dx + dy * dy > c.r * c.r) return;

  var i = gl.nearNode(pos.x, pos.y, c.r * 0.34);
  if (i < 0 || i === this._lastNode) return;
  this._lastNode = i;
  this._flashT = 0;
  gl.pulse(i);
};

/* ── Посадка ─────────────────────────────────────────────────
   Перед тем как мы войдём внутрь корабля, он должен приземлиться:
   иначе человек заходит в люк ракеты, которая по-прежнему летит.
   Порог посадки сообщает сцена интерьера (она знает, где начинается
   тамбур). Если её нет, посадки просто не происходит и ракета летит
   до конца страницы, как летела раньше. */
Rocket.prototype.landing = function (p, dt, pos, tan) {
  /* Посадку ведёт акт сцены, а не доля всей страницы. Раньше порог
     брался из прогресса и совпадал с моментом, когда интерьер
     забирал сцену себе: корабль касался площадки и тут же гас -
     клиент это и увидел как «села где-то сбоку и исчезла».
     Теперь она садится в своём акте, до прохода, и стоит. */
  var sc = g.RC_SCENE, k = 0, known = false;
  if (sc && sc.act) {
    known = true;
    if (sc.act === "landing") {
      /* За первую половину акта опоры уже на площадке */
      var raw = (sc.k - 0.04) / 0.46;
      k = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    } else if (sc.act === "walk" || sc.act === "cabin" || sc.act === "manual" || sc.act === "console") {
      k = 1;                      /* стоит: дальше проход и вход */
    } else {
      k = 0;                      /* до посадки корабль в полёте */
    }
  }
  if (!known) {
    var at = g.RC_LAND_AT || 0;
    if (!at) { this.landK = 0; return 0; }
    var from = Math.max(0, at - 0.07);
    k = (p - from) / Math.max(0.001, at - from);
    k = k < 0 ? 0 : k > 1 ? 1 : k;
  }
  k = k * k * (3 - 2 * k);
  /* Демпфер: рывок скроллом не должен ронять ракету камнем */
  /* Первый кадр: поля ещё нет, и без явного нуля сложение даёт NaN,
     который дальше расходится по всей сцене */
  var prev = this.landK || 0;
  /* Скорость догона растёт с отставанием: при резком скролле ракета
     обязана успеть сесть до прохода, иначе подход и дверь срываются */
  this.landK = prev + (k - prev) * Math.min(1, (dt || 0.016) * (3.2 + Math.abs(k - prev) * 14));
  if (this.landK < 0.002) return 0;

  /* Площадка ровно по центру кадра: клиент просил посадку не сбоку,
     а в середине сцены - камера смотрит прямо на неё. По вертикали
     ставим опоры на нижнюю четверть, чтобы корпус целиком был в
     кадре и на телефоне, и на широком экране. */
  var w = this.canvas.clientWidth || innerWidth;
  var h = this.canvas.clientHeight || innerHeight;
  this.toWorld(w * 0.5, h * 0.78, -0.2, this._padP || (this._padP = new T.Vector3()));
  pos.lerp(this._padP, this.landK);

  /* Нос разворачивается вверх: ракета встаёт на опоры */
  tan.lerp(this._upVec || (this._upVec = new T.Vector3(0, 1, 0)), this.landK).normalize();

  /* Тяга гаснет, но факел не исчезает совсем: сопло остывает */
  this.power = Math.max(0.14, this.power * (1 - this.landK * 0.82));

  /* Касание: один удар, пыль из-под опор и тишина после него */
  if (this.landK > 0.86 && !this._touched) {
    this._touched = 1;
    this.dust();
    document.documentElement.classList.add("rc-landed-craft");
    if (g.RC_SOUND && g.RC_SOUND.boom) { try { g.RC_SOUND.boom(); } catch (e) {} }
    try { dispatchEvent(new CustomEvent("rc:touchdown")); } catch (e) {}
  }
  if (this.landK < 0.4 && this._touched) {
    this._touched = 0;
    document.documentElement.classList.remove("rc-landed-craft");
  }
  return this.landK;
};

/* Пыль из-под опор. Живёт в обычной вёрстке, а не в сцене: тридцать
   лёгких кружков поверх холста дешевле любой системы частиц и на
   телефоне не стоит ничего. */
Rocket.prototype.dust = function () {
  if (document.documentElement.classList.contains("rc-reduced")) return;
  var pos = g.RC_ROCKET_POS;
  if (!pos || !isFinite(pos.x)) return;
  var layer = document.createElement("div");
  layer.className = "rc-dust";
  layer.setAttribute("aria-hidden", "true");
  layer.style.left = pos.x + "px";
  layer.style.top = pos.y + "px";
  var n = this.C.mobile ? 14 : 28;
  for (var i = 0; i < n; i++) {
    var d = document.createElement("i");
    var a = (Math.random() - 0.5) * Math.PI;      /* в стороны, а не вверх */
    var dist = 60 + Math.random() * 190;
    d.style.setProperty("--dx", (Math.cos(a) * dist).toFixed(0) + "px");
    d.style.setProperty("--dy", (Math.abs(Math.sin(a)) * dist * 0.32).toFixed(0) + "px");
    d.style.setProperty("--ds", (0.5 + Math.random() * 1.5).toFixed(2));
    d.style.animationDelay = (Math.random() * 0.18).toFixed(2) + "s";
    layer.appendChild(d);
  }
  document.body.appendChild(layer);
  setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 2200);
};

/* ── Подход к ракете ──────────────────────────────────────────
   Клиент требует бесшовности входа: «ракета села → мы ИДЁМ к ней →
   у неё открывается дверь → заходим». Раньше между посадкой и
   дверью шлюза был разрыв: ракета стояла вдалеке по центру кадра,
   а створки возникали из ниоткуда во весь экран.

   Теперь акт walk («проход к трапу», секция #cases) - это и есть
   сам проход: пока человек листает его, ракета растёт навстречу и
   к концу акта корпус занимает почти всю высоту кадра. Дальше по
   сценарию у этого корпуса открывается дверь (rc-airlock), и вход
   читается одним непрерывным движением.

   Долю подхода диктует доля акта из RC_SCENE.k, то есть сам скролл:
   обратная прокрутка так же честно отводит назад к площадке.
   Подход включается только после состоявшейся посадки (landK>0.9) -
   к летящей ракете идти пешком не к чему; вне акта walk цель
   становится нулём и доля плавно стекает, не трогая ни полёт, ни
   орбиту, ни саму посадку. */
Rocket.prototype.approach = function (dt) {
  var goal = 0;
  var sc = g.RC_SCENE;
  if (sc && sc.act === "walk" && (this.landK || 0) > 0.45) {
    /* Идём к кораблю: доля акта walk и есть длина прохода. Сцена
       отдаёт кадр салону раньше единицы, поэтому вплотную мы
       оказываемся уже к ~0.65 доли. */
    var raw = (sc.k - 0.08) / 0.57;
    goal = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    goal = goal * goal * (3 - 2 * goal);
  } else if (sc && sc.act === "cabin" && sc.k < 0.35 && this.appK > 0.12) {
    /* Начало салона: мы уже у борта, корпус держится во весь кадр,
       пока дверь открывается. Условие по appK отличает честный
       проход от прыжка по якорю сразу в салон. */
    goal = 1;
  }
  /* Сглаживание экспонентой: и рывок колеса, и смена акта дают
     плавный ход масштаба, без телепортов. Форма та же, что у витка:
     на просевших кадрах линейное сглаживание прыгает. */
  /* Скорость сглаживания адаптивная: чем сильнее доля отстала от
     цели (резкое колесо, пролистывание пальцем), тем быстрее догон.
     Иначе быстрый скролл проскакивал подход, и дверь не успевала
     показаться вовсе. */
  var s = 1 - Math.exp(-(dt || 0.016) * (4.2 + Math.abs(goal - this.appK) * 16));
  this.appK += (goal - this.appK) * s;
  if (this.appK < 0.001) this.appK = 0;
  g.RC_APPROACH = this.appK;
  return this.appK;
};

/* ── Люк: открытие ───────────────────────────────────────────
   Доля открытия живёт здесь же, у корабля, а не в отдельном
   оверлее: дверь - его часть. Ведёт её тот же скролл, что и
   подход. Створки успевают тронуться, только когда мы уже
   вплотную: раньше открывать нечего, мы ещё идём. */
Rocket.prototype.doorOpen = function (dt) {
  var sc = g.RC_SCENE;
  var goal = 0;
  if (this.appK > 0.45 && sc) {
    if (sc.act === "walk") {
      /* Створки идут почти весь проход, а не последнюю четверть:
         вход должен быть движением, а не сменой кадра. Раньше дверь
         трогалась в самом конце акта, и на один шаг колеса
         приходился весь переход - зритель видел склейку. */
      var raw = (sc.k - 0.42) / 0.5;
      goal = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      goal *= 0.82;
    } else if (sc.act === "cabin") {
      goal = 1;
    }
  }
  /* Рубки на этом устройстве не будет - вести в проём некуда:
     дверь остаётся закрытой, проход просто переходит к разделу */
  if (g.RC_NO_CABIN) goal = 0;
  var prev = this.doorK || 0;
  var s = 1 - Math.exp(-(dt || 0.016) * (3.4 + Math.abs(goal - prev) * 14));
  this.doorK = prev + (goal - prev) * s;
  if (this.doorK < 0.001) this.doorK = 0;
  g.RC_DOOR = this.doorK;

  var d = this.rocket.door;
  if (d) {
    /* Створки уходят по борту вбок: поворот вокруг оси корабля */
    var open = this.doorK * d.half * 2.05;
    d.l.rotation.y = open;
    d.r.rotation.y = -open;
    /* Свет салона разгорается в щели раньше самих створок:
       сначала видно, что там свет, потом уже что там салон */
    var lit = Math.min(1, this.doorK * 2.4);
    d.lamp.intensity = lit * 2.6;
    d.edgeMat.opacity = 0.35 + (1 - this.doorK) * 0.55;
    /* Засвет от лампы в проёме идёт наружу и растёт вместе с
       дверью: к моменту передачи сцены рубке кадр уже залит тёплым
       светом, и подмену физически не видно. Переменную читает
       rc-world.css, слой лежит поверх страницы. */
    document.documentElement.style.setProperty("--hatch-glow",
      (Math.max(0, this.doorK - 0.30) / 0.7 * this.appK).toFixed(3));
  }
  /* Проход открыт и кадр закрыт корпусом - можно отдавать сцену
     интерьеру. Флаг читает rc-interior: подмена случается под
     закрытым кадром, поэтому её не видно. */
  /* Порог передачи сцены рубке. Был 0.88, и на телефоне он не
     достигался никогда: как только рубка показывалась, корабль
     останавливался и доля двери замирала на 0.63. Из-за этого не
     летело событие rc:hatch, а вместе с ним не показывалась вспышка
     света, которая и прикрывает стык. Теперь порог берём тот, что
     реально достижим на всех экранах. */
  /* Подойдя к борту, корабль обязан ЗАКРЫВАТЬ собой страницу.
     Пока холст лежал под содержимым, заголовки и карточки
     просвечивали сквозь корпус, и он читался обоями, а не
     предметом, к которому мы идём. */
  var over = this.appK > 0.30;
  if (over !== this._over) {
    this._over = over;
    document.documentElement.classList.toggle("rc-approach", over);
  }

  var deep = this.doorK > 0.58 && this.appK > 0.8;
  if (deep !== this._deep) {
    this._deep = deep;
    document.documentElement.classList.toggle("rc-in-hatch", deep);
    try { dispatchEvent(new CustomEvent("rc:hatch", { detail: { deep: deep } })); } catch (e) {}
  }
  return this.doorK;
};

Rocket.prototype.layout = function (p, dt) {
  p = ((p % 1) + 1) % 1;
  var pos = this.path.getPointAt(p, this._tmpA);
  var tan = this.path.getTangentAt(p, this._tmpB).normalize();

  var orb = this.orbit(dt || 0.016);
  var k = this.orbK;
  if (orb && k > 0.001) {
    pos.lerp(this._orbP, k);
    tan.lerp(this._orbT, k).normalize();
  }

  /* Посадка перекрывает и полёт, и орбиту: это финал наружного акта */
  var land = this.landing(p, dt, pos, tan);
  if (land > 0.01) k = k * (1 - land);

  /* Подход: после посадки акт walk ведёт нас к самому кораблю.
     Клиент прислал скрин: ракета росла ещё в полётном наклоне.
     Подход сам дожимает корабль в вертикаль и в центр кадра -
     к двери он стоит как на стартовом столе. */
  var app = this.approach(dt);
  var dk = this.doorOpen(dt);
  if (app > 0.001) {
    tan.lerp(this._upVec || (this._upVec = new T.Vector3(0, 1, 0)), Math.min(1, app * 2.2)).normalize();
    var cW = this.canvas.clientWidth || innerWidth;
    var cH = this.canvas.clientHeight || innerHeight;
    /* Целимся не в центр корпуса, а в люк: он обязан встать ровно
       посреди кадра, потому что именно в него мы входим. Люк сидит
       выше середины корабля, поэтому корпус смещаем вниз на его
       высоту, пересчитанную в текущий масштаб сцены. */
    this.toWorld(cW * 0.5, cH * 0.5, -0.2, this._appP || (this._appP = new T.Vector3()));
    pos.lerp(this._appP, Math.min(1, app * 1.6));
    var dY = (this.rocket.door ? this.rocket.door.y : 0.1);
    pos.y -= app * dY * (this._sNow || 1);
  }

  /* Общая камера сайта (rc-world) сносит и корабль: когда кадр
     поворачивается, ракета уезжает вместе с разделами, а не висит
     сама по себе поверх них. Гасим снос на витке, на посадке и на
     подходе - там положение корабля привязано к точке экрана, и
     любой лишний сдвиг ломает и виток, и вход в люк. */
  var W3 = g.RC_WORLD;
  if (W3) {
    var free = 1 - Math.max(this.orbK || 0, Math.max(app, (this.landK || 0) * 0.9));
    if (free > 0.01) {
      pos.x += W3.yaw * 0.040 * free;
      pos.y += -W3.pitch * 0.032 * free;
      /* Наезд камеры на корабль не переносим: при подходе к пульту
         и в коридоре продуктов он выносил корпус в середину кадра
         поверх формы заявки и карточек. Ракета следует за поворотом
         кадра, но своей глубиной распоряжается сама. */
    }
  }

  this.pivot.position.copy(pos);

  /* Нос смотрит вдоль движения. На орбите доворачиваем резче,
     иначе на быстром витке ракета летит боком. */
  this._q.setFromUnitVectors(this._up, tan);
  /* На подходе доворот почти мгновенный: корпус, к двери которого
     мы идём, обязан стоять вертикально даже при резком скролле */
  this.pivot.quaternion.slerp(this._q, Math.min(1, 0.22 + k * 0.4 + app * 0.65));

  /* Крен по горизонтальной составляющей; у борта корабль ровный */
  this.craft.rotation.z = -tan.x * 0.55 * (1 - (this.appK || 0));
  /* Ракета всё время медленно вращается, но к двери она обязана
     повернуться люком: доворачиваем к ближайшему полному обороту,
     иначе проём уедет за корпус ровно тогда, когда мы к нему
     подошли. Вне подхода вращение продолжается как жило. */
  if (app > 0.02) {
    var ry = this.craft.rotation.y;
    var tau = Math.PI * 2;
    var near = Math.round(ry / tau) * tau;             /* ближний «люк на нас» */
    this.craft.rotation.y = ry + (near - ry) * Math.min(1, (dt || 0.016) * (1.2 + app * 6));
  } else {
    this.craft.rotation.y += 0.004;
  }

  /* Дальние участки пути делаем мельче, ближние крупнее.
     Вокруг планеты ракета идёт мельче: она «далеко», и только в таком
     масштабе виток читается витком, а не пролётом корабля через кадр. */
  var s = this.C.mobile ? 0.66 : 1.12;
  /* Подход растит корпус: к единице подхода борт с люком занимает
     кадр, а открытая дверь наезжает проёмом на зрителя - это и есть
     вход внутрь, без склейки и без вторых ворот поверх сцены. */
  /* Рост на открытии двери держим в узде: дальше определённого
     масштаба камера проваливается внутрь обшивки и кадр становится
     пустым. Последний шаг входа делает не масштаб, а сам проём -
     его стена видна изнутри и закрывает кадр. */
  var sNow = s * (1 - k * 0.70) * (1 + (this.landK || 0) * 0.12) * (1 + app * 2.6) * (1 + dk * dk * 1.25);
  this._sNow = sNow;
  this.pivot.scale.setScalar(sNow);
};

/* Крупный читаемый текст: только он лежит на прозрачном фоне,
   у карточек своя подложка и ракета за ней и так не видна */
var READ_SEL = ".hero h1,.hero-sub,.sec-h,.sec-p,.sec-tag,.kpi-n,.kpi-l,.hs-h,.legal,.card,.prod-card,.case,.step,.faq-i,.chip";

Rocket.prototype.readables = function () {
  if (!this._reads || this._readsAt !== document.body.childElementCount) {
    this._reads = [].slice.call(document.querySelectorAll(READ_SEL));
    this._readsAt = document.body.childElementCount;
  }
  return this._reads;
};

/* Раз в сто миллисекунд смотрим, не наехала ли ракета на слова */
Rocket.prototype.veil = function (dt) {
  this._veilT += dt;
  if (this._veilT >= 0.1) {
    this._veilT = 0;
    var v = this._tmpC.copy(this.pivot.position).project(this.cam);
    var w = this.canvas.clientWidth || innerWidth;
    var h = this.canvas.clientHeight || innerHeight;
    var cx = (v.x * 0.5 + 0.5) * w;
    var cy = (-v.y * 0.5 + 0.5) * h;
    var rad = Math.min(w, h) * (this.C.mobile ? 0.20 : 0.17);
    var rr = rad * rad;
    var list = this.readables();
    var hit = false;
    for (var i = 0; i < list.length; i++) {
      var b = list[i].getBoundingClientRect();
      if (b.width < 6 || b.bottom < -40 || b.top > h + 40) continue;
      var dx = Math.max(b.left - cx, 0, cx - b.right);
      var dy = Math.max(b.top - cy, 0, cy - b.bottom);
      if (dx * dx + dy * dy < rr) { hit = true; break; }
    }
    /* Раньше ракета пряталась от текста до 0,17 и её было не видно.
       Теперь она остаётся на виду: над словами лишь слегка притухает,
       а читаемость держит стеклянная подложка под текстовым блоком. */
    /* На телефоне колонка одна и текста в кадре втрое больше, поэтому
       над словами ракета уступает заметно сильнее, чем на мониторе. */
    this._veilGoal = hit ? (this.C.mobile ? 0.34 : 0.62) : 1;
    /* На посадке и на подходе корабль не уступает никому: он и есть
       сцена, а не помеха тексту. Иначе ровно в тот момент, когда мы
       к нему идём, он растворяется под карточками. */
    var hold = Math.max(this.appK || 0, (this.landK || 0) * 0.9);
    if (hold > 0.08) this._veilGoal = Math.max(this._veilGoal, Math.min(1, hold * 1.6));
  }
  var light = document.documentElement.getAttribute("data-theme") === "light";
  var d = this._veilGoal - this._veil;
  var moved = Math.abs(d) > 0.004;
  if (moved) this._veil += d * Math.min(1, dt * 4.5);
  var occMoved = Math.abs(this.occl - (this._wasOcc == null ? 1 : this._wasOcc)) > 0.004;
  this._wasOcc = this.occl;
  if (!moved && !occMoved && light === this._wasLight) return;
  this._wasLight = light;
  this.canvas.style.opacity = (this._veil * this.occl * (light ? 0.92 : 1)).toFixed(3);
};

/* Тяга по актам. Двигатель не может гудеть одинаково на старте и в
   тот момент, когда человек уже сидит в рубке и читает справочник:
   там ракета вообще не в кадре. Числа согласованы со звуком - там
   тот же словарь, и картинка со звуком не расходятся. */
var THRUST = {
  pad: 0.45, ignite: 1.00, climb: 0.94, clouds: 0.82, corridor: 0.55,
  advance: 0.60, orbit: 0.62, reentry: 0.90, route: 0.48, landing: 0.66,
  walk: 0.38, cabin: 0.34, manual: 0.32, console: 0.34, egress: 0.72
};
var actThrust = 0.6;
addEventListener("rc:act", function (e) {
  var a = e && e.detail && e.detail.act;
  if (a && THRUST[a] != null) actThrust = THRUST[a];
});

Rocket.prototype.setProgress = function (p, velocity) {
  this.progress = p;
  var a = Math.abs(velocity || 0);
  /* Скорость прокрутки добавляет к тяге акта, но не заменяет её */
  this.power = Math.max(0.28, Math.min(1, actThrust * 0.72 + 0.18 + a * 0.04));
  /* Листаешь - виток вокруг планеты ускоряется. Знак скорости не берём:
     разгон всегда по ходу витка, разворотов на орбите не бывает. */
  var boost = Math.min(1, a / 16);
  if (boost > (this._orbV || 0)) this._orbV = boost;
};

Rocket.prototype.frame = function (dt) {
  this.time += dt;
  var t = this.time;

  this.layout(this.progress, dt);

  /* Покачивание в состоянии покоя */
  var calmK = 1 - (this.landK || 0) * 0.92;      /* на опорах ракета стоит */
  this.craft.position.y = Math.sin(t * 1.35) * 0.16 * calmK;
  this.craft.position.x = Math.cos(t * 0.9) * 0.09 * calmK;

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
  this.veil(dt);

  this.publish();
  this.r.render(this.scene, this.cam);
};

/* Экранное положение ракеты уходит в CSS-переменные. По ним чипы
   разлетаются от пролёта, счётчики стартуют, карточки подсвечиваются:
   трёхмерная сцена и плоский интерфейс живут в одном пространстве. */
Rocket.prototype.publish = function () {
  this._pubT = (this._pubT || 0) + 1;
  if (this._pubT % 2) return;
  var v = this._tmpC.copy(this.pivot.position).project(this.cam);
  var w = this.canvas.clientWidth || innerWidth;
  var h = this.canvas.clientHeight || innerHeight;
  var x = (v.x * 0.5 + 0.5) * w;
  var y = (-v.y * 0.5 + 0.5) * h;
  /* near: 1 когда ракета близко к камере, 0 когда далеко */
  var near = Math.max(0, Math.min(1, (v.z + 1) * 0.5));
  var st = document.documentElement.style;
  st.setProperty("--rocket-x", Math.round(x) + "px");
  st.setProperty("--rocket-y", Math.round(y) + "px");
  st.setProperty("--rocket-near", (1 - near).toFixed(3));
  g.RC_ROCKET_POS = { x: x, y: y, near: 1 - near, orb: this.orbK };
};

Rocket.prototype.tick = function (ts) {
  if (document.documentElement.classList.contains("rc-flying")) { this._last = 0; return; }
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
    if (g.RC_GL && !g.RC_GL.take()) return null;
    try {
      var made = new Rocket(canvas);
      g.RC_ROCKET = made;
      if (g.RC_GL) g.RC_GL.guard(canvas, function () {
        made.stop();
        document.documentElement.classList.remove("has-rocket");
      }, function () {
        document.documentElement.classList.add("has-rocket");
        made.start();
      });
      return made;
    } catch (e) {
      if (g.RC_GL) g.RC_GL.give();
      if (g.RC_track) g.RC_track("jserr", "rocket: " + (e.message || e), true);
      return null;
    }
  }
};
})(window);
