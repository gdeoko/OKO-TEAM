/* ═══════════════════════════════════════════════════════════
   Rocket CDN · заставка загрузки: объёмная ракета

   Заставка обязана быть на экране в первые же сто пятьдесят
   миллисекунд, поэтому ждать three.js она не может: библиотека
   весит семьсот килобайт и приезжает позже. Значит объём считаем
   сами - здесь настоящая трёхмерная модель ракеты (корпус,
   носовой конус, три стабилизатора, сопло, кольца обшивки),
   перспективная проекция, сортировка граней по глубине и плоское
   затенение по нормали к источнику света.

   Это не картинка и не спрайт: ракета честно вращается в
   пространстве, её можно смотреть с любого угла, свет ложится по
   форме. Всё вместе - около шести килобайт кода и ни одного
   запроса к сети.

   Звук синтезируется на месте: гул набирает обороты вместе с
   прогрессом, на старте бьёт отрыв. Если человек не разрешал звук,
   заставка молчит - браузер всё равно не даст ей звучать до
   первого касания.
   ═══════════════════════════════════════════════════════════ */
(function (g, d) {
"use strict";

/* ── Модель ракеты ───────────────────────────────────────────
   Строим один раз при запуске: тело вращения из колец плюс
   стабилизаторы. Координаты в условных единицах, ось Y - вдоль
   корпуса. Профиль задаёт форму: пары «высота, радиус». */
var PROFILE = [
  [ 2.30, 0.00],   /* острие */
  [ 2.05, 0.14],
  [ 1.75, 0.26],
  [ 1.35, 0.36],
  [ 0.60, 0.40],   /* цилиндр корпуса */
  [-0.30, 0.40],
  [-0.95, 0.38],
  [-1.25, 0.30],   /* сужение к соплу */
  [-1.45, 0.26],
  [-1.62, 0.34],   /* раструб */
  [-1.72, 0.30]
];
var SEG = 18;      /* граней по окружности */

function buildRocket() {
  var verts = [], faces = [], i, j;

  /* Кольца профиля */
  for (i = 0; i < PROFILE.length; i++) {
    for (j = 0; j < SEG; j++) {
      var a = (j / SEG) * Math.PI * 2;
      verts.push([Math.cos(a) * PROFILE[i][1], PROFILE[i][0], Math.sin(a) * PROFILE[i][1]]);
    }
  }
  /* Боковые грани между соседними кольцами */
  for (i = 0; i < PROFILE.length - 1; i++) {
    for (j = 0; j < SEG; j++) {
      var j2 = (j + 1) % SEG;
      var a0 = i * SEG + j, b0 = i * SEG + j2;
      var a1 = (i + 1) * SEG + j, b1 = (i + 1) * SEG + j2;
      /* Тёмная обшивка, у сопла металл темнее и холоднее */
      var kind = i >= PROFILE.length - 3 ? "nozzle" : (i <= 2 ? "nose" : "hull");
      faces.push({ v: [a0, b0, b1, a1], kind: kind, ring: i });
    }
  }

  /* Три стабилизатора: плоские клинья у основания */
  for (i = 0; i < 3; i++) {
    var ang = (i / 3) * Math.PI * 2 + 0.4;
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var base = verts.length;
    /* Внутренняя кромка у корпуса, внешняя отведена наружу и вниз */
    verts.push([ca * 0.36, -0.35, sa * 0.36]);
    verts.push([ca * 0.36, -1.15, sa * 0.36]);
    verts.push([ca * 0.95, -1.42, sa * 0.95]);
    verts.push([ca * 0.60, -0.62, sa * 0.60]);
    faces.push({ v: [base, base + 1, base + 2, base + 3], kind: "fin", ring: 99 });
  }

  return { verts: verts, faces: faces };
}

var MODEL = buildRocket();

/* ── Математика ──────────────────────────────────────────── */
function rotate(p, ry, rx) {
  var cy = Math.cos(ry), sy = Math.sin(ry);
  var cx = Math.cos(rx), sx = Math.sin(rx);
  var x = p[0] * cy - p[2] * sy;
  var z = p[0] * sy + p[2] * cy;
  var y = p[1] * cx - z * sx;
  z = p[1] * sx + z * cx;
  return [x, y, z];
}

function normal(a, b, c) {
  var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  var l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  return [nx / l, ny / l, nz / l];
}

/* Свет по договору всего сайта: ключевой сверху-слева цианoвый,
   заполняющий снизу-справа фиолетовый, контровой холодный белый. */
var KEY = [-0.55, 0.72, 0.42];
var FILL = [0.6, -0.4, 0.35];

function shade(n, kind) {
  var kd = Math.max(0, n[0] * KEY[0] + n[1] * KEY[1] + n[2] * KEY[2]);
  var fd = Math.max(0, n[0] * FILL[0] + n[1] * FILL[1] + n[2] * FILL[2]);
  var rim = Math.pow(1 - Math.abs(n[2]), 3);

  var base = kind === "nozzle" ? [34, 44, 58]
           : kind === "fin" ? [22, 42, 64]
           : kind === "nose" ? [40, 74, 104]
           : [30, 56, 82];

  var r = base[0] + kd * 128 + fd * 62 + rim * 78;
  var gg = base[1] + kd * 186 + fd * 54 + rim * 132;
  var b = base[2] + kd * 210 + fd * 150 + rim * 168;
  return "rgb(" + Math.min(255, r | 0) + "," + Math.min(255, gg | 0) + "," + Math.min(255, b | 0) + ")";
}

/* ── Рисование кадра ─────────────────────────────────────── */
function drawRocket(x, W, H, S, spin, tilt, cxp, cyp, scale, glow) {
  var i, j;
  var cx = W * cxp, cy = H * cyp;
  var fov = S * scale;
  var dist = 7.4;

  var rot = [], vs = MODEL.verts;
  for (i = 0; i < vs.length; i++) rot.push(rotate(vs[i], spin, tilt));

  var list = [];
  for (i = 0; i < MODEL.faces.length; i++) {
    var f = MODEL.faces[i];
    var pts = [], zsum = 0;
    for (j = 0; j < f.v.length; j++) {
      var p = rot[f.v[j]];
      zsum += p[2];
      var k = fov / (dist + p[2]);
      pts.push([cx + p[0] * k, cy - p[1] * k]);
    }
    var n = normal(rot[f.v[0]], rot[f.v[1]], rot[f.v[2]]);
    /* Задние грани не рисуем: экономия и правильный силуэт */
    if (n[2] > 0.06 && f.kind !== "fin") continue;
    list.push({ pts: pts, z: zsum / f.v.length, col: shade(n, f.kind), kind: f.kind, ring: f.ring });
  }
  list.sort(function (a, b) { return b.z - a.z; });

  for (i = 0; i < list.length; i++) {
    var it = list[i];
    x.beginPath();
    x.moveTo(it.pts[0][0], it.pts[0][1]);
    for (j = 1; j < it.pts.length; j++) x.lineTo(it.pts[j][0], it.pts[j][1]);
    x.closePath();
    x.fillStyle = it.col;
    x.fill();
    /* Швы обшивки: тонкая цианoвая линия по кольцам */
    if (it.kind === "hull" && it.ring % 2 === 0) {
      x.strokeStyle = "rgba(66,178,220,.22)";
      x.lineWidth = Math.max(0.6, S * 0.0012);
      x.stroke();
    }
  }

  /* Факел: живёт под соплом, длина и яркость идут за прогрессом */
  if (glow > 0.01) {
    var nozzle = rotate([0, -1.78, 0], spin, tilt);
    var k2 = fov / (dist + nozzle[2]);
    var fx = cx + nozzle[0] * k2, fy = cy - nozzle[1] * k2;
    var len = S * (0.05 + glow * 0.14);
    var gr = x.createLinearGradient(fx, fy, fx, fy + len);
    gr.addColorStop(0, "rgba(226,240,255," + (0.85 * glow).toFixed(3) + ")");
    gr.addColorStop(0.22, "rgba(66,178,220," + (0.8 * glow).toFixed(3) + ")");
    gr.addColorStop(0.6, "rgba(138,89,246," + (0.42 * glow).toFixed(3) + ")");
    gr.addColorStop(1, "rgba(138,89,246,0)");
    x.beginPath();
    x.moveTo(fx - S * 0.016 * (0.6 + glow), fy);
    x.quadraticCurveTo(fx, fy + len * 1.15, fx + S * 0.016 * (0.6 + glow), fy);
    x.closePath();
    x.fillStyle = gr;
    x.fill();
    /* Ореол у среза сопла */
    var hg = x.createRadialGradient(fx, fy, 0, fx, fy, S * 0.05 * (0.5 + glow));
    hg.addColorStop(0, "rgba(207,233,245," + (0.5 * glow).toFixed(3) + ")");
    hg.addColorStop(1, "rgba(66,178,220,0)");
    x.fillStyle = hg;
    x.beginPath(); x.arc(fx, fy, S * 0.05 * (0.5 + glow), 0, 6.283); x.fill();
  }
}

g.RC_LOADER3D = { model: MODEL, draw: drawRocket, rotate: rotate };

})(window, document);
