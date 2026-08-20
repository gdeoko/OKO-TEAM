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

/* Публикация переменных оформления идёт через общий кэш: запись на
   корне документа помечает устаревшим стиль всего дерева, а мы
   зовём её из каждого кадра. Пишем только изменившееся. */
var V = (g.RC_VAR && g.RC_VAR.set) || function (el, n, v) {
  if (el && el.style) el.style.setProperty(n, v);
};

/* Мерки блоков берём из общего кэша: спросить браузер о месте блока
   после записи в стиль - значит заставить его досчитать вёрстку
   прямо посреди кадра. При прокрутке блоки стоят, двигается окно. */
var BOX = (g.RC_BOX && g.RC_BOX.box) || function (el) { return el.getBoundingClientRect(); };

/* ── Возможности устройства ──────────────────────────────── */
function caps() {
  var w = innerWidth, mob = w < 760;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mem = navigator.deviceMemory || 4;
  var cores = navigator.hardwareConcurrency || 4;
  /* Раньше «телефон» автоматически означал «слабое устройство»:
     корабль на мобиле собирался вдвое грубее, искр было втрое
     меньше, сглаживание выключалось. Владелец сравнил экраны и
     сказал прямо - на ПК красиво, а на телефоне нет, так быть не
     должно; отличаться могут только раскладка и размеры.

     Поэтому слабым теперь считается только действительно слабое
     железо, а телефонный бюджет добираем разрешением буфера. Это
     честный рычаг: он не убирает из кадра ни одной детали, ни
     одного блика, а на плотном экране разницу в чёткости глаз
     почти не видит - в отличие от гранёного силуэта и пропавших
     искр, которые видно сразу. */
  var tiny = mem <= 2 || cores <= 2;
  return {
    mobile: mob,
    reduce: reduce,
    weak: tiny,
    tiny: tiny,
    dpr: Math.min(g.devicePixelRatio || 1, tiny ? 1.1 : (mob ? 1.45 : 2)),
    aa: !tiny,
    sparks: tiny ? 150 : 420,
    smoke: tiny ? 70 : 170,
    radial: tiny ? 28 : 64,
    lathe: tiny ? 40 : 96,
    shadow: false
  };
}

/* ── Процедурная среда для отражений металла ─────────────── */
function envTexture(renderer) {
  var c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  var x = c.getContext("2d");

  var sky = x.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0.00, "#2B6494");
  sky.addColorStop(0.42, "#3D86BA");
  sky.addColorStop(0.52, "#17334F");
  sky.addColorStop(1.00, "#0A1927");
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

  /* Продольные штрихи шлифовки. Металл корпуса катаный, и блик по
     нему обязан вытягиваться вдоль корпуса, а не лежать круглым
     пятном - это и есть та самая анизотропия, из-за которой белый
     цилиндр перестаёт читаться пластиком. Настоящая анизотропия
     живёт только в MeshPhysicalMaterial свежих ревизий, а версия
     three здесь чужая и меняться не должна, поэтому вытягиваем
     блик текстурой: длинные полупрозрачные штрихи по y холста и
     есть направление шлифовки. */
  for (i = 0; i < 520; i++) {
    var sxp = Math.random() * W, syp = Math.random() * H;
    var sln = 40 + Math.random() * 260;
    x.globalAlpha = 0.020 + Math.random() * 0.040;
    x.fillStyle = Math.random() > 0.5 ? "#FFFFFF" : "#8FA3B8";
    x.fillRect(sxp, syp, 1 + Math.random(), sln);
  }
  x.globalAlpha = 1;

  /* Номера панелей и технические трафареты. Ракета крутится, поэтому
     буквы намеренно мелкие: крупная надпись смазалась бы в кашу, а
     мелкая читается ровно тем, чем является, - следом производства. */
  x.font = "600 15px ui-monospace, Menlo, monospace";
  x.textAlign = "center";
  var marks = ["RC-07", "A-12", "SEC 4", "LOX", "RC-19", "B-03", "N2", "SEC 9"];
  for (i = 0; i < 8; i++) {
    var mv = 0.24 + (i % 4) * 0.155;
    x.save();
    x.translate((i + 0.5) * (W / 8) + 26, (1 - mv) * H);
    /* Вдоль корпуса, то есть повёрнуто на холсте */
    x.rotate(-Math.PI / 2);
    x.fillStyle = "rgba(58,84,112,.42)";
    x.fillText(marks[i], 0, 0);
    x.restore();
  }

  /* Потёртости у кромок колец и подпалины у сопла: чистый корпус
     выглядит рендером, а не машиной, которая уже летала */
  for (i = 0; i < 90; i++) {
    var wv = Math.random() < 0.5 ? 0.19 + Math.random() * 0.03 : 0.79 + Math.random() * 0.03;
    x.globalAlpha = 0.05 + Math.random() * 0.10;
    x.fillStyle = "#6F8398";
    x.fillRect(Math.random() * W, (1 - wv) * H, 3 + Math.random() * 26, 1 + Math.random() * 2);
  }
  x.globalAlpha = 1;

  /* Нагар от факела: снизу вверх, языками. Он же прибивает белизну
     юбки, из-за которой низ корабля читался пустым пятном. */
  var soot = x.createLinearGradient(0, H, 0, (1 - 0.24) * H);
  soot.addColorStop(0.00, "rgba(14,20,28,.62)");
  soot.addColorStop(0.40, "rgba(24,34,46,.26)");
  soot.addColorStop(1.00, "rgba(30,42,56,0)");
  x.fillStyle = soot;
  x.fillRect(0, (1 - 0.24) * H, W, 0.24 * H);
  for (i = 0; i < 44; i++) {
    var tx = Math.random() * W, th = (0.05 + Math.random() * 0.16) * H;
    var tg = x.createLinearGradient(0, (1 - 0.10) * H, 0, (1 - 0.10) * H - th);
    tg.addColorStop(0, "rgba(12,18,26,.50)");
    tg.addColorStop(1, "rgba(12,18,26,0)");
    x.fillStyle = tg;
    x.fillRect(tx, (1 - 0.10) * H - th, 8 + Math.random() * 30, th);
  }

  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  tex.anisotropy = 8;
  /* Смотрим на корпус снаружи, поэтому текстуру зеркалим */
  tex.wrapS = T.RepeatWrapping;
  tex.repeat.x = -1;
  return tex;
}

/* ── Рельеф обшивки и карта шероховатости ─────────────────────
   Клиент сказал прямо: корпус читается пластиковой игрушкой. Так и
   есть - у него одна цветовая карта и одинаковая гладкость по всей
   поверхности. Настоящий металл выдают три вещи, и ни одна из них
   не про цвет: сломанный на швах блик, разная шероховатость (у
   сопла закопчено, на кольцах отполировано) и заклёпки, которые
   ловят свет по контуру панели.

   Всё считаем на холсте прямо здесь: своих файлов у сайта нет и не
   должно быть, любой лишний запрос дороже сотни миллисекунд на
   старте. Рисовать удобно ЯРКОСТЬЮ (шов темнее, заклёпка светлее),
   а нормаль получается из такой картинки одним проходом Собеля. */
function hullBump(S) {
  var c = document.createElement("canvas");
  c.width = c.height = S;
  var x = c.getContext("2d");
  x.fillStyle = "#808080";                 /* ноль высоты - ровная обшивка */
  x.fillRect(0, 0, S, S);

  var i, k;
  /* Панели чуть разной высоты: обшивка собрана из листов, и каждый
     лист лежит на своей заклёпке, а не на идеальной плоскости */
  var ROWS = 7, COLS = 8;
  for (i = 0; i < ROWS; i++) {
    for (k = 0; k < COLS; k++) {
      x.fillStyle = "rgba(255,255,255," + (0.02 + Math.random() * 0.05).toFixed(3) + ")";
      if (Math.random() < 0.5) x.fillStyle = "rgba(0,0,0," + (0.02 + Math.random() * 0.05).toFixed(3) + ")";
      x.fillRect(k * S / COLS, i * S / ROWS, S / COLS, S / ROWS);
    }
  }

  /* Швы: тёмная канавка со светлой фаской по краю. Одна тёмная
     линия дала бы царапину, а шов - это углубление с бортиками. */
  function seam(x0, y0, x1, y1) {
    x.strokeStyle = "rgba(255,255,255,.30)"; x.lineWidth = 3;
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    x.strokeStyle = "rgba(0,0,0,.55)"; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
  }
  for (i = 0; i < COLS; i++) seam(i * S / COLS, 0, i * S / COLS, S);
  for (i = 1; i < ROWS; i++) seam(0, i * S / ROWS, S, i * S / ROWS);

  /* Заклёпки вдоль швов. Именно они ловят ключевой свет точками и
     заставляют глаз поверить, что перед ним лист металла. */
  function rivet(px, py) {
    var gr = x.createRadialGradient(px, py, 0, px, py, 3.4);
    gr.addColorStop(0.00, "rgba(255,255,255,.85)");
    gr.addColorStop(0.55, "rgba(190,190,190,.35)");
    gr.addColorStop(1.00, "rgba(90,90,90,0)");
    x.fillStyle = gr;
    x.beginPath(); x.arc(px, py, 3.4, 0, Math.PI * 2); x.fill();
  }
  var step = S / 34;
  for (i = 0; i < COLS; i++) for (k = 0; k < 34; k++) rivet(i * S / COLS + 5, k * step + step / 2);
  for (i = 1; i < ROWS; i++) for (k = 0; k < 34; k++) rivet(k * step + step / 2, i * S / ROWS + 5);

  /* Вмятины и царапины: ровная сетка панелей сама по себе выдаёт
     процедурность, случайный дефект её ломает */
  for (i = 0; i < 26; i++) {
    var dx0 = Math.random() * S, dy0 = Math.random() * S, dr = 6 + Math.random() * 22;
    var dg = x.createRadialGradient(dx0, dy0, 0, dx0, dy0, dr);
    dg.addColorStop(0, "rgba(0,0,0,.30)");
    dg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = dg;
    x.beginPath(); x.arc(dx0, dy0, dr, 0, Math.PI * 2); x.fill();
  }
  return c;
}

/* Собель по карте высот. По окружности (x холста) текстура замкнута,
   поэтому там заворачиваем; вдоль корпуса зажимаем, иначе нос
   перетекает в сопло и на стыке появляется ложное ребро.

   Зеркаление карты (repeat.x = -1) отдельно учитывать не нужно:
   three строит касательный базис из производных самих UV, и вместе
   с ними разворачивается сам. */
function bumpToNormal(src, strength) {
  var W = src.width, H = src.height;
  var sd = src.getContext("2d").getImageData(0, 0, W, H).data;
  var out = document.createElement("canvas");
  out.width = W; out.height = H;
  var ox = out.getContext("2d");
  var img = ox.createImageData(W, H);
  var od = img.data;
  var x, y, i;
  for (y = 0; y < H; y++) {
    var yUp = y > 0 ? y - 1 : 0, yDn = y < H - 1 ? y + 1 : H - 1;
    for (x = 0; x < W; x++) {
      var xl = x > 0 ? x - 1 : W - 1, xr = x < W - 1 ? x + 1 : 0;
      var dx = (sd[(y * W + xr) * 4] - sd[(y * W + xl) * 4]) / 255 * strength;
      var dy = (sd[(yDn * W + x) * 4] - sd[(yUp * W + x) * 4]) / 255 * strength;
      var len = Math.sqrt(dx * dx + dy * dy + 1);
      i = (y * W + x) * 4;
      od[i]     = (-dx / len * 0.5 + 0.5) * 255;
      od[i + 1] = (-dy / len * 0.5 + 0.5) * 255;
      od[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      od[i + 3] = 255;
    }
  }
  ox.putImageData(img, 0, 0);
  var tex = new T.CanvasTexture(out);
  tex.wrapS = T.RepeatWrapping;
  tex.repeat.x = -1;
  return tex;
}

/* Шероховатость и металличность одной картинкой: three читает
   зелёный канал как roughness, синий как metalness, поэтому оба
   значения кладём в один холст и один буфер видеопамяти.

   Смысл карты: чистый металл гладкий и зеркальный, шов и потёртость
   матовые, нагар у сопла матовый и почти не металл (сажа - не
   металл вовсе). Без этого блик одинаков по всей поверхности, и
   любой корпус выглядит крашеным пластиком. */
function hullRough(S) {
  var c = document.createElement("canvas");
  c.width = c.height = S;
  var x = c.getContext("2d");
  /* База: G = 0.30 шероховатости, B = 0.60 металла */
  x.fillStyle = "rgb(0,77,153)";
  x.fillRect(0, 0, S, S);

  var i, k;
  /* Полированные фирменные кольца: там блик обязан быть зеркальным */
  function band(v, h, rough, metal) {
    x.fillStyle = "rgb(0," + Math.round(rough * 255) + "," + Math.round(metal * 255) + ")";
    x.fillRect(0, (1 - v - h) * S, S, h * S);
  }
  band(0.74, 0.06, 0.16, 0.80);
  band(0.13, 0.07, 0.16, 0.80);

  /* Швы матовее полотна: в канавке сидит грязь и герметик */
  x.lineWidth = 3;
  x.strokeStyle = "rgba(0,150,90,.75)";
  for (i = 0; i < 8; i++) {
    x.beginPath(); x.moveTo(i * S / 8, 0); x.lineTo(i * S / 8, S); x.stroke();
  }
  for (i = 1; i < 7; i++) {
    x.beginPath(); x.moveTo(0, i * S / 7); x.lineTo(S, i * S / 7); x.stroke();
  }

  /* Пятна разной выработки по полотну: одинаковая гладкость на всей
     обшивке - главный признак компьютерной картинки */
  for (i = 0; i < 120; i++) {
    var px = Math.random() * S, py = Math.random() * S, pr = 10 + Math.random() * 70;
    var gr = x.createRadialGradient(px, py, 0, px, py, pr);
    var rv = Math.random() < 0.5 ? "0,160,120" : "0,40,220";
    gr.addColorStop(0, "rgba(" + rv + ",.30)");
    gr.addColorStop(1, "rgba(" + rv + ",0)");
    x.fillStyle = gr;
    x.beginPath(); x.arc(px, py, pr, 0, Math.PI * 2); x.fill();
  }

  /* Нагар у сопла: матовый и неметаллический */
  var so = x.createLinearGradient(0, S, 0, (1 - 0.28) * S);
  so.addColorStop(0.00, "rgba(0,225,40,.92)");
  so.addColorStop(0.45, "rgba(0,190,90,.55)");
  so.addColorStop(1.00, "rgba(0,160,140,0)");
  x.fillStyle = so;
  x.fillRect(0, (1 - 0.28) * S, S, 0.28 * S);

  var tex = new T.CanvasTexture(c);
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

/* ── Посадочные опоры ─────────────────────────────────────────
   Почему они появились: аудит показал, что посадка не читается
   событием. Событие делают детали, которые меняются во времени -
   нога вышла, шток выехал, тарелка ударилась и просела. Стоящая
   ракета без опор выглядит вставленной в кадр.

   Механика честная, лендерская, и вся считается в плоскости одной
   ноги. Поэтому хватает одного угла на ногу и одного atan2 на
   подкос, без инверсной кинематики:
     - нога висит на шарнире у юбки и отходит вбок по углу th;
     - из неё телескопом выезжает шток - это и есть раскладывание;
     - подкос-гидроцилиндр соединяет неподвижную точку борта с
       серединой ноги, его длину и наклон пересчитываем каждый кадр;
     - тарелка обязана оставаться горизонтальной, поэтому её
       разворачиваем обратно на тот же угол th.

   Геометрию делаем один раз и делим на все три ноги: общие буферы
   стоят дешевле, чем лишние вызовы отрисовки, а материал берём в
   стиле корпуса - тот же металл и та же среда отражений. */
var GEAR_HIP_Y = -1.46;      /* шарнир на борту, по оси корабля */
var GEAR_HIP_Z = 0.575;      /* и его вынос от оси */
var GEAR_BR_Y  = -0.84;      /* верхняя точка подкоса */
var GEAR_BR_Z  = 0.605;
var GEAR_UP    = 0.62;       /* неподвижная часть ноги */
var GEAR_LO    = 0.76;       /* полный ход штока */
var GEAR_STOW  = 0.055;      /* сложена: прижата к юбке */
var GEAR_OPEN  = 0.63;       /* раскрыта: примерно тридцать шесть градусов */
var GEAR_MID   = 0.58;       /* куда упирается подкос, доля длины ноги */
/* Уровень площадки: низ тарелки при полностью раскрытой ноге.
   По нему ставим и грунт, и тень, и кольцо пыли - всё в одном
   месте, иначе ракета зависает над собственной тенью. */
var PAD_Y = -(GEAR_UP + GEAR_LO) * Math.cos(GEAR_OPEN) + GEAR_HIP_Y - 0.045;
/* Радиус, на котором стоят тарелки, и размер площадки. Метки на
   грунте считаются из них, а не подбираются на глаз. */
var PAD_FEET = GEAR_HIP_Z + (GEAR_UP + GEAR_LO) * Math.sin(GEAR_OPEN);
var PAD_SIZE = 6.4;                       /* сторона квадрата с разметкой */
/* Высота настила над окружающим грунтом. Ради неё вся площадка и
   переделана: пока у круга не было толщины, он читался наклейкой,
   а корабль - вырезанным и положенным сверху. */
var PAD_LIFT = 0.30;
var PAD_FOOT = PAD_FEET / (PAD_SIZE * 0.46);   /* доля радиуса разметки */

function buildGear(C, env) {
  var group = new T.Group();
  group.visible = false;

  var seg = C.weak ? 6 : 10;
  var strutGeo = new T.CylinderGeometry(0.098, 0.076, 1, seg);
  strutGeo.translate(0, -0.5, 0);          /* висит от начала координат вниз */
  var rodGeo = new T.CylinderGeometry(0.060, 0.054, 1, seg);
  rodGeo.translate(0, -0.5, 0);
  var braceGeo = new T.CylinderGeometry(0.048, 0.038, 1, seg);
  braceGeo.translate(0, 0.5, 0);           /* растёт от начала координат вверх */
  var footPts = [];
  footPts.push(new T.Vector2(0.001, 0.048));
  footPts.push(new T.Vector2(0.26, 0.042));    /* верхняя площадка тарелки */
  footPts.push(new T.Vector2(0.30, 0.010));    /* скос к ободу */
  footPts.push(new T.Vector2(0.33, -0.014));
  footPts.push(new T.Vector2(0.32, -0.048));   /* сам обод, которым стоит нога */
  footPts.push(new T.Vector2(0.24, -0.058));
  footPts.push(new T.Vector2(0.001, -0.058));
  var footGeo = new T.LatheGeometry(footPts, C.weak ? 8 : 14);
  var hipGeo = new T.BoxGeometry(0.26, 0.20, 0.17);
  /* Гильза гидроцилиндра: в неё уходит полированный шток подкоса.
     Без неё подкос читается палкой; с ней у него появляется ход. */
  var sleeveGeo = new T.CylinderGeometry(0.072, 0.066, 1, seg);
  sleeveGeo.translate(0, 0.5, 0);
  /* Шланг гидравлики - тонкий и матовый, идёт рядом с цилиндром */
  var hoseGeo = new T.CylinderGeometry(0.020, 0.020, 1, C.weak ? 4 : 6);
  hoseGeo.translate(0, 0.5, 0);
  /* Амортизатор в пятке: короткий толстый цилиндр над тарелкой */
  var dampGeo = new T.CylinderGeometry(0.115, 0.135, 0.17, C.weak ? 6 : 10);

  var strutMat = new T.MeshStandardMaterial({
    color: 0xC3D1DF, metalness: 0.86, roughness: 0.27, envMap: env, envMapIntensity: 1.5
  });
  /* Шток намеренно зеркальнее всего остального: полированный
     хромированный цилиндр - самая узнаваемая деталь любой опоры, и
     блик на нём с ходом ноги ползёт, то есть выдаёт движение */
  var rodMat = new T.MeshStandardMaterial({
    color: 0xB6C7D8, metalness: 1.0, roughness: 0.06, envMap: env, envMapIntensity: 2.6
  });
  var footMat = new T.MeshStandardMaterial({
    color: 0x24384E, metalness: 0.55, roughness: 0.58, envMap: env, envMapIntensity: 0.9
  });
  var hoseMat = new T.MeshStandardMaterial({
    color: 0x121C28, metalness: 0.12, roughness: 0.88, envMap: env, envMapIntensity: 0.4
  });

  var legs = [];
  for (var i = 0; i < 3; i++) {
    var piv = new T.Group();
    /* Ноги встают между стабилизаторами: те стоят на 0, 120 и 240 */
    piv.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 3;

    var hip = new T.Mesh(hipGeo, footMat);
    hip.position.set(0, GEAR_HIP_Y, GEAR_HIP_Z - 0.03);
    piv.add(hip);

    var swing = new T.Group();
    swing.position.set(0, GEAR_HIP_Y, GEAR_HIP_Z);
    piv.add(swing);

    var strut = new T.Mesh(strutGeo, strutMat);
    strut.scale.y = GEAR_UP;
    swing.add(strut);

    var rod = new T.Mesh(rodGeo, rodMat);
    rod.position.y = -GEAR_UP;
    swing.add(rod);

    var damp = new T.Mesh(dampGeo, rodMat);
    swing.add(damp);

    var foot = new T.Mesh(footGeo, footMat);
    swing.add(foot);

    var brace = new T.Mesh(braceGeo, rodMat);
    brace.position.set(0, GEAR_BR_Y, GEAR_BR_Z);
    piv.add(brace);

    /* Гильза и шланг живут отдельными объектами, а не детьми подкоса:
       у подкоса каждый кадр меняется масштаб по длине, и всё, что
       висит на нём, растянулось бы вместе с ним */
    var sleeve = new T.Mesh(sleeveGeo, strutMat);
    sleeve.position.set(0, GEAR_BR_Y, GEAR_BR_Z);
    piv.add(sleeve);

    var hose = null;
    if (!C.weak) {
      hose = new T.Mesh(hoseGeo, hoseMat);
      hose.position.set(0.085, GEAR_BR_Y + 0.04, GEAR_BR_Z - 0.03);
      piv.add(hose);
    }

    legs.push({
      swing: swing, rod: rod, foot: foot, brace: brace,
      sleeve: sleeve, hose: hose, damp: damp
    });
    group.add(piv);
  }
  return { group: group, legs: legs };
}

/* ── Грунт: разметка площадки ─────────────────────────────────
   Рисуем процедурно на холсте, как обшивку рядом: своя картинка
   весит ноль килобайт и подстраивается под фирменные цвета.
   Смотрим на площадку под очень острым углом (камера почти на
   уровне корабля), поэтому все линии нарочно толстые - тонкие на
   таком ракурсе схлопываются в ничто. */
function padTexture(weak) {
  var S = weak ? 512 : 1024;
  var c = document.createElement("canvas");
  c.width = c.height = S;
  var x = c.getContext("2d");
  var m = S / 2, R = S * 0.46;

  /* Сначала сама поверхность: без залитого пятна круг читается
     наклейкой поверх пустоты, а не площадкой на грунте */
  var soil = x.createRadialGradient(m, m, 0, m, m, R);
  soil.addColorStop(0.00, "rgba(58,84,112,.78)");
  soil.addColorStop(0.62, "rgba(46,68,94,.72)");
  soil.addColorStop(0.93, "rgba(34,52,74,.52)");
  soil.addColorStop(1.00, "rgba(28,44,64,0)");
  x.fillStyle = soil;
  x.fillRect(0, 0, S, S);

  /* Решётчатый настил. Плоский круг с разметкой читался наклейкой -
     под ракетой обязана быть КОНСТРУКЦИЯ. Рёбра идут в две стороны,
     на пересечениях сидят болты; между рёбрами - тёмные ячейки, и
     именно их чередование даёт настилу толщину даже на остром
     ракурсе, под которым мы на площадку и смотрим. */
  var di, dk;
  x.save();
  x.beginPath(); x.arc(m, m, R * 0.985, 0, Math.PI * 2); x.clip();
  var deck = x.createRadialGradient(m, m, R * 0.08, m, m, R);
  deck.addColorStop(0.00, "rgba(96,128,158,.80)");
  deck.addColorStop(0.62, "rgba(74,102,132,.82)");
  deck.addColorStop(1.00, "rgba(54,78,106,.86)");
  x.fillStyle = deck;
  x.fillRect(0, 0, S, S);
  /* Ячейки решётки: тёмные окна между рёбрами */
  var SEC = weak ? 20 : 32, BND = 5;
  for (di = 0; di < BND; di++) {
    var r0 = R * (0.20 + di * 0.158), r1 = R * (0.20 + (di + 1) * 0.158) - S * 0.006;
    for (dk = 0; dk < SEC; dk++) {
      var a0 = (dk / SEC) * Math.PI * 2 + 0.012, a1 = ((dk + 1) / SEC) * Math.PI * 2 - 0.012;
      x.beginPath();
      x.arc(m, m, r1, a0, a1);
      x.arc(m, m, r0, a1, a0, true);
      x.closePath();
      x.fillStyle = "rgba(14,26,40," + (0.34 + ((di + dk) % 2) * 0.22).toFixed(2) + ")";
      x.fill();
    }
  }
  /* Кольцевые и радиальные рёбра поверх ячеек */
  x.strokeStyle = "rgba(186,220,246,.34)";
  x.lineWidth = S * 0.006;
  for (di = 0; di <= BND; di++) {
    x.beginPath(); x.arc(m, m, R * (0.20 + di * 0.158), 0, Math.PI * 2); x.stroke();
  }
  for (dk = 0; dk < SEC; dk++) {
    var ra = (dk / SEC) * Math.PI * 2;
    x.beginPath();
    x.moveTo(m + Math.cos(ra) * R * 0.20, m + Math.sin(ra) * R * 0.20);
    x.lineTo(m + Math.cos(ra) * R * 0.99, m + Math.sin(ra) * R * 0.99);
    x.stroke();
  }
  /* Болты на пересечениях: мелкая деталь, которая ловит блик */
  if (!weak) {
    x.fillStyle = "rgba(214,236,252,.44)";
    for (di = 0; di <= BND; di++) {
      for (dk = 0; dk < SEC; dk += 2) {
        var ba = (dk / SEC) * Math.PI * 2, br = R * (0.20 + di * 0.158);
        x.beginPath();
        x.arc(m + Math.cos(ba) * br, m + Math.sin(ba) * br, S * 0.0042, 0, Math.PI * 2);
        x.fill();
      }
    }
  }
  x.restore();

  /* Следы прошлых посадок: смещённые от центра выцветшие подпалины и
     призраки старых меток под тарелки. Площадка, на которую садятся
     впервые, выглядит декорацией; рабочая - помнит все прежние
     касания, и именно эта память делает её местом, а не фигурой. */
  for (di = 0; di < 4; di++) {
    var oa = di * 1.7 + 0.6, orr = R * (0.10 + di * 0.09);
    var ox0 = m + Math.cos(oa) * orr, oy0 = m + Math.sin(oa) * orr;
    var old = x.createRadialGradient(ox0, oy0, 0, ox0, oy0, R * (0.30 + di * 0.06));
    old.addColorStop(0.00, "rgba(6,12,20,.26)");
    old.addColorStop(0.60, "rgba(8,16,26,.14)");
    old.addColorStop(1.00, "rgba(8,16,26,0)");
    x.fillStyle = old;
    x.fillRect(0, 0, S, S);
  }

  /* Прожжённое пятно под соплом: посадка оставляет след */
  var burn = x.createRadialGradient(m, m, 0, m, m, R * 0.62);
  burn.addColorStop(0.00, "rgba(4,9,15,.46)");
  burn.addColorStop(0.45, "rgba(8,18,28,.26)");
  burn.addColorStop(1.00, "rgba(8,18,28,0)");
  x.fillStyle = burn;
  x.fillRect(0, 0, S, S);

  function circle(r, w, col, dash) {
    x.save();
    x.strokeStyle = col;
    x.lineWidth = w;
    if (dash) x.setLineDash(dash);
    x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.stroke();
    x.restore();
  }
  /* Внешний обод и штриховая окружность внутри него */
  circle(R, S * 0.011, "rgba(126,200,238,.46)");
  circle(R * 0.965, S * 0.004, "rgba(200,236,255,.24)");
  circle(R * 0.78, S * 0.008, "rgba(126,200,238,.30)", [S * 0.03, S * 0.022]);
  circle(R * 0.23, S * 0.009, "rgba(160,222,252,.40)");

  /* Предупредительная разметка по ободу: те же цвета, что на люке */
  var i, a;
  for (i = 0; i < 24; i++) {
    a = (i / 24) * Math.PI * 2;
    x.save();
    x.translate(m, m); x.rotate(a);
    x.fillStyle = i % 2 ? "rgba(226,172,52,.26)" : "rgba(30,44,60,.30)";
    x.fillRect(R * 0.88, -R * 0.06, R * 0.10, R * 0.12);
    x.restore();
  }
  /* Радиальные засечки: по ним глаз читает, что круг лежит на земле */
  for (i = 0; i < 36; i++) {
    a = (i / 36) * Math.PI * 2;
    x.save();
    x.translate(m, m); x.rotate(a);
    x.fillStyle = i % 3 === 0 ? "rgba(180,228,255,.34)" : "rgba(120,180,214,.18)";
    x.fillRect(R * 1.005, -S * 0.004, R * (i % 3 === 0 ? 0.06 : 0.032), S * 0.008);
    x.restore();
  }
  /* Крест наведения от центра */
  for (i = 0; i < 4; i++) {
    x.save();
    x.translate(m, m); x.rotate(i * Math.PI / 2);
    var gr = x.createLinearGradient(R * 0.27, 0, R * 0.72, 0);
    gr.addColorStop(0, "rgba(150,214,246,.40)");
    gr.addColorStop(1, "rgba(150,214,246,0)");
    x.fillStyle = gr;
    x.fillRect(R * 0.27, -S * 0.006, R * 0.45, S * 0.012);
    x.restore();
  }
  /* Метки под тарелки опор: они стоят там, где нога и встанет.
     Радиус не назначаем на глаз, а берём из геометрии самой ноги -
     иначе стоит поправить угол раскрытия, и опоры промахиваются
     мимо собственных меток. */
  var fr = R * PAD_FOOT;
  for (i = 0; i < 3; i++) {
    /* Ноги смотрят вдоль локальной оси Z, повёрнутой на свой угол.
       На холсте это (sin, cos): холст лежит плашмя, его x совпадает
       с мировым x, а y - с мировым z. */
    a = (i / 3) * Math.PI * 2 + Math.PI / 3;
    var fx = m + Math.sin(a) * fr, fy = m + Math.cos(a) * fr;
    x.save();
    x.translate(fx, fy);
    x.strokeStyle = "rgba(232,176,48,.42)";
    x.lineWidth = S * 0.008;
    x.strokeRect(-R * 0.075, -R * 0.075, R * 0.15, R * 0.15);
    x.fillStyle = "rgba(232,176,48,.10)";
    x.fillRect(-R * 0.075, -R * 0.075, R * 0.15, R * 0.15);
    x.restore();
  }
  /* Пыль и мелкая крошка: ровный круг выглядит наклейкой */
  for (i = 0; i < (weak ? 260 : 900); i++) {
    var rr = Math.sqrt(Math.random()) * R;
    a = Math.random() * Math.PI * 2;
    x.globalAlpha = 0.03 + Math.random() * 0.07;
    x.fillStyle = Math.random() > 0.5 ? "#9FC4DC" : "#16283A";
    x.fillRect(m + Math.cos(a) * rr, m + Math.sin(a) * rr, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  x.globalAlpha = 1;

  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ── Грунт вокруг площадки ────────────────────────────────────
   Площадка, вырезанная в пустоте, висит в воздухе: ей не на чем
   стоять. Поэтому под неё кладём кусок местности - крупнее самой
   площадки и заметно темнее, с камнями, кратерами и радиальными
   следами прошлых выхлопов. Именно он даёт кадру пол: у площадки
   появляется окружение, а у корабля - место, куда он сел.

   Один холст, одна плоскость, один вызов отрисовки. Края уводим в
   прозрачность, иначе квадрат местности читается ковриком. */
function terrainTexture(weak) {
  var S = weak ? 256 : 512;
  var c = document.createElement("canvas");
  c.width = c.height = S;
  var x = c.getContext("2d");
  var m = S / 2;

  var base = x.createRadialGradient(m, m, 0, m, m, m);
  base.addColorStop(0.00, "rgba(56,76,100,.94)");
  base.addColorStop(0.66, "rgba(50,70,94,.94)");
  base.addColorStop(0.80, "rgba(56,78,104,.92)");
  base.addColorStop(0.92, "rgba(36,54,78,.58)");
  base.addColorStop(1.00, "rgba(26,40,58,0)");

  /* Тень примыкания: у самой кромки настила грунт темнее. Именно эта
     полоска и говорит глазу, что площадка ВОЗВЫШАЕТСЯ над землёй, а
     не нарисована на ней. Радиус совпадает с бортиком. */
  var hug = x.createRadialGradient(m, m, m * 0.62, m, m, m * 0.745);
  hug.addColorStop(0.00, "rgba(4,9,16,.62)");
  hug.addColorStop(0.40, "rgba(6,12,20,.22)");
  hug.addColorStop(1.00, "rgba(6,12,20,0)");
  x.fillStyle = hug;
  x.fillRect(0, 0, S, S);
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);

  var i, a, r, px, py, gr;
  /* Радиальные следы выхлопа: грунт сдут от центра полосами */
  for (i = 0; i < (weak ? 26 : 60); i++) {
    a = Math.random() * Math.PI * 2;
    var len = m * (0.16 + Math.random() * 0.36);
    x.save();
    x.translate(m, m); x.rotate(a);
    gr = x.createLinearGradient(m * 0.68, 0, m * 0.68 + len, 0);
    gr.addColorStop(0, "rgba(150,192,224,.20)");
    gr.addColorStop(1, "rgba(150,192,224,0)");
    x.fillStyle = gr;
    x.fillRect(m * 0.68, -S * 0.004, len, S * 0.008);
    x.restore();
  }

  /* Кратеры и камни: у каждого светлая маковка и тень с
     противоположной стороны - тем и читается рельеф на плоскости */
  for (i = 0; i < (weak ? 60 : 170); i++) {
    r = m * (0.66 + Math.random() * 0.32);
    a = Math.random() * Math.PI * 2;
    px = m + Math.cos(a) * r; py = m + Math.sin(a) * r;
    /* Мелкая россыпь, а не булыжник: крупные пятна на таком ракурсе
       читались не рельефом, а брусчаткой из мультфильма */
    var rr = S * (0.0035 + Math.random() * 0.0105);
    /* Свет в сцене идёт сверху и справа, значит тень камня - слева снизу */
    x.fillStyle = "rgba(6,12,20,.22)";
    x.beginPath(); x.ellipse(px - rr * 0.5, py + rr * 0.4, rr * 1.15, rr * 0.7, 0, 0, Math.PI * 2); x.fill();
    gr = x.createRadialGradient(px + rr * 0.3, py - rr * 0.3, 0, px, py, rr);
    gr.addColorStop(0.00, "rgba(158,188,214,.22)");
    gr.addColorStop(0.70, "rgba(70,96,124,.11)");
    gr.addColorStop(1.00, "rgba(40,60,84,0)");
    x.fillStyle = gr;
    x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.fill();
  }

  /* Отметины прежних посадок: три выцветших кольца по сторонам */
  for (i = 0; i < 3; i++) {
    a = 0.9 + i * 2.2;
    r = m * (0.74 + i * 0.06);
    px = m + Math.cos(a) * r; py = m + Math.sin(a) * r;
    x.strokeStyle = "rgba(8,16,26,.24)";
    x.lineWidth = S * 0.012;
    x.beginPath(); x.arc(px, py, m * (0.07 + i * 0.02), 0, Math.PI * 2); x.stroke();
    gr = x.createRadialGradient(px, py, 0, px, py, m * (0.09 + i * 0.02));
    gr.addColorStop(0, "rgba(6,12,20,.22)");
    gr.addColorStop(1, "rgba(6,12,20,0)");
    x.fillStyle = gr;
    x.beginPath(); x.arc(px, py, m * (0.09 + i * 0.02), 0, Math.PI * 2); x.fill();
  }

  /* Мелкая крошка поверх всего */
  for (i = 0; i < (weak ? 300 : 1100); i++) {
    r = m * (0.66 + Math.random() * 0.32);
    a = Math.random() * Math.PI * 2;
    x.globalAlpha = 0.04 + Math.random() * 0.10;
    x.fillStyle = Math.random() > 0.55 ? "#8FB4D0" : "#0E1B2A";
    x.fillRect(m + Math.cos(a) * r, m + Math.sin(a) * r, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  x.globalAlpha = 1;

  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* Бортик площадки: полоса предупредительной раскраски с тенью
   сверху. Её задача одна - показать ТОЛЩИНУ, поэтому наверху
   светлая кромка, внизу тень, а по полосе идёт косая разметка. */
function kerbTexture(weak) {
  var W = weak ? 256 : 512, H = 64;
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");
  var gr = x.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0.00, "#7B99B4");
  gr.addColorStop(0.18, "#48627C");
  gr.addColorStop(0.58, "#27394C");
  gr.addColorStop(1.00, "#111C27");
  x.fillStyle = gr;
  x.fillRect(0, 0, W, H);

  var i;
  /* Вертикальные рёбра жёсткости: по ним глаз и считывает, что это
     плита, а не полоска краски */
  for (i = 0; i < 26; i++) {
    var rx = (i + 0.5) * (W / 26);
    x.fillStyle = "rgba(150,186,216,.16)";
    x.fillRect(rx - 3, 0, 3, H);
    x.fillStyle = "rgba(6,12,20,.30)";
    x.fillRect(rx, 0, 3, H);
  }

  /* Косая разметка - узкой полосой посередине. Во всю высоту она
     превращала площадку в полосатый торт. */
  var y0 = H * 0.34, hh = H * 0.30;
  x.fillStyle = "rgba(10,18,28,.55)";
  x.fillRect(0, y0, W, hh);
  for (i = -8; i < 40; i++) {
    x.save();
    x.translate(i * (W / 32), 0);
    x.fillStyle = i % 2 ? "rgba(178,138,52,.42)" : "rgba(24,38,54,.52)";
    x.beginPath();
    x.moveTo(0, y0); x.lineTo(W / 32 * 0.6, y0);
    x.lineTo(W / 32 * 0.6 - hh * 0.7, y0 + hh); x.lineTo(-hh * 0.7, y0 + hh);
    x.closePath(); x.fill();
    x.restore();
  }

  /* Верхняя кромка: тонкая светлая линия - ребро панели */
  x.fillStyle = "rgba(214,238,255,.72)";
  x.fillRect(0, 0, W, 3);
  x.fillStyle = "rgba(0,0,0,.50)";
  x.fillRect(0, H - 6, W, 6);
  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  tex.wrapS = T.RepeatWrapping;
  tex.repeat.x = 3;
  return tex;
}

/* Ударная волна: светящееся кольцо, которое расходится от точки
   касания. Оно и делает касание событием - глаз ловит расширение
   быстрее, чем любую вспышку на месте. */
function ringTexture() {
  var S = 256;
  var c = document.createElement("canvas");
  c.width = c.height = S;
  var x = c.getContext("2d");
  var gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0.00, "rgba(255,255,255,0)");
  gr.addColorStop(0.62, "rgba(150,225,255,0)");
  gr.addColorStop(0.80, "rgba(210,245,255,.85)");
  gr.addColorStop(0.90, "rgba(120,205,245,.45)");
  gr.addColorStop(1.00, "rgba(90,180,230,0)");
  x.fillStyle = gr;
  x.fillRect(0, 0, S, S);
  return new T.CanvasTexture(c);
}

/* Мягкая тень: чёрное пятно с растушёвкой. Холст ракеты прозрачный
   и лежит поверх страницы, поэтому полупрозрачный чёрный честно
   притемняет то, что под ним, - отдельного слоя не нужно. */
function shadowTexture() {
  var S = 256;
  var c = document.createElement("canvas");
  c.width = c.height = S;
  var x = c.getContext("2d");
  var gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0.00, "rgba(0,0,0,.62)");
  gr.addColorStop(0.42, "rgba(0,0,0,.40)");
  gr.addColorStop(0.78, "rgba(0,0,0,.12)");
  gr.addColorStop(1.00, "rgba(0,0,0,0)");
  x.fillStyle = gr;
  x.fillRect(0, 0, S, S);
  return new T.CanvasTexture(c);
}

/* ── Пыль от посадки ──────────────────────────────────────────
   Раньше пыль жила в вёрстке: тридцать кружков DOM поверх холста.
   Дёшево, но неправдиво - плоские круги не знают ни глубины кадра,
   ни масштаба корабля, ни того, где именно у него опоры. При
   подходе ракета вырастала втрое, а пыль оставалась прежней.

   Теперь пыль - точки в самой сцене, в системе координат площадки.
   Она даром получает перспективу (кольцо раскрывается эллипсом,
   как и должно на грунте), масштабируется вместе с кораблём и
   правильно уходит за корпус. Это один вызов отрисовки, то есть
   дешевле, чем тридцать композиторских слоёв браузера.

   Материал свой, крошечный: PointsMaterial даёт один размер на всю
   систему, а клуб пыли обязан расти по мере расхождения. Размер и
   цвет держим в атрибутах - так каждая частица живёт своей жизнью,
   а подсветка снизу делается цветом, без единого лишнего источника
   света в сцене. */
var DUST_VERT = [
  "attribute float aSize;",
  "attribute vec3 aCol;",
  "uniform float uScale;",
  "uniform float uPx;",
  "varying vec3 vCol;",
  "void main(){",
  "  vCol = aCol;",
  "  vec4 mv = modelViewMatrix * vec4(position,1.0);",
  /* uPx переводит мировой размер в пиксели устройства на этой глубине.
     Считаем его снаружи из высоты холста и угла обзора: константа тут
     врала бы на каждом втором экране. */
  "  gl_PointSize = aSize * uScale * uPx / max(0.4, -mv.z);",
  "  gl_Position = projectionMatrix * mv;",
  "}"
].join("\n");

var DUST_FRAG = [
  "uniform sampler2D uMap;",
  "varying vec3 vCol;",
  "void main(){",
  "  float a = texture2D(uMap, gl_PointCoord).a;",
  "  if (a < 0.004) discard;",
  "  gl_FragColor = vec4(vCol, a);",
  "}"
].join("\n");

function buildDust(C) {
  var n = C.weak ? 64 : 230;
  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  var siz = new Float32Array(n);
  var geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  geo.setAttribute("aCol", new T.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new T.BufferAttribute(siz, 1));
  var uni = { uMap: { value: dotTexture(true) }, uScale: { value: 1 }, uPx: { value: 1000 } };
  var mat = new T.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: uni,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  });
  var pts = new T.Points(geo, mat);
  pts.frustumCulled = false;
  return {
    pts: pts, geo: geo, uni: uni, n: n,
    pos: pos, col: col, siz: siz,
    vel: new Float32Array(n * 3),
    life: new Float32Array(n),
    max: new Float32Array(n),
    live: 0
  };
}

/* ── Камешки и искры от удара ─────────────────────────────────
   Пыль расходится клубом и оседает, а грунт при этом ещё и
   ВЫБИВАЕТ: из-под тарелок летит мелкая крошка, ловит свет факела
   и скачет по площадке. Отдельная система нужна ровно потому, что
   физика у неё обратная пылевой - камень не вязнет в воздухе, он
   летит по баллистике и отскакивает.

   Шейдер тот же, что у пыли: атрибуты совпадают, а разница только в
   текстуре (здесь резкая точка вместо мягкой) и в шаге. Это один
   вызов отрисовки на всю россыпь. */
function buildDebris(C) {
  var n = C.weak ? 0 : 54;
  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  var siz = new Float32Array(n);
  var geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  geo.setAttribute("aCol", new T.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new T.BufferAttribute(siz, 1));
  var uni = { uMap: { value: dotTexture(false) }, uScale: { value: 1 }, uPx: { value: 1000 } };
  var mat = new T.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: uni,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  });
  var pts = new T.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  return {
    pts: pts, geo: geo, uni: uni, n: n,
    pos: pos, col: col, siz: siz,
    vel: new Float32Array(n * 3),
    life: new Float32Array(n),
    max: new Float32Array(n),
    live: 0
  };
}

/* ── Посадочные огни ──────────────────────────────────────────
   Огни по ободу площадки бегут по кругу - так их и ставят на
   настоящих площадках, чтобы издалека читалось направление. Для
   кадра это важнее, чем кажется: мигающая точка на ободе - это
   единственный элемент площадки, который ЖИВЁТ, пока корабль ещё
   заходит. Без неё площадка появляется мёртвой декорацией.

   Опять один вызов отрисовки: точки, тот же шейдер, что у пыли,
   яркость каждой лампы кладём в цвет. */
function buildLamps(C) {
  var n = C.weak ? 8 : 16;
  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  var siz = new Float32Array(n);
  var R = PAD_SIZE * 0.46 * 0.955;
  for (var i = 0; i < n; i++) {
    var a = (i / n) * Math.PI * 2;
    pos[i * 3]     = Math.cos(a) * R;
    pos[i * 3 + 1] = 0.05;
    pos[i * 3 + 2] = Math.sin(a) * R;
    siz[i] = 0.20;
  }
  var geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  geo.setAttribute("aCol", new T.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new T.BufferAttribute(siz, 1));
  var uni = { uMap: { value: dotTexture(false) }, uScale: { value: 1 }, uPx: { value: 1000 } };
  var mat = new T.ShaderMaterial({
    vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: uni,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  });
  var pts = new T.Points(geo, mat);
  pts.frustumCulled = false;
  return { pts: pts, geo: geo, uni: uni, n: n, col: col, siz: siz };
}

/* ── Пар из шлюза ─────────────────────────────────────────────
   Настоящий люк не открывается всухую: перед тем как створки
   тронутся, отсек стравливает давление, и из стыка бьёт белым.
   Без этого дверь читается панелью на шарнире, а не переходом
   между двумя средами - а весь смысл сцены именно в переходе.

   Система устроена как пыль посадки и по той же причине: точки
   живут в сцене, а не в вёрстке, поэтому даром получают
   перспективу, масштаб корабля и правильное перекрытие корпусом.
   Разница только в физике и в смешивании. Пыль складывается
   аддитивно - она светится от факела; пар аддитивно складывать
   нельзя: над белой обшивкой он выбелил бы кадр в молоко.
   Поэтому у пара обычное смешивание и своя прозрачность на
   частицу - густой клуб у самой щели и почти невидимая дымка
   через две секунды.

   Глубину не выключаем: пар обязан уходить ЗА корпус, когда
   струя обогнула борт. Это и есть просьба «объём падает от
   ракеты» - не нарисованный поверх дым, а газ в том же
   пространстве, что и корабль. */
function steamTexture() {
  /* Сто двадцать восемь, а не шестьдесят четыре: на подходе спрайт
     растягивается до полутора сотен пикселей, и мелкая текстура
     превращалась в расфокусированное пятно - клуб читался боке, а
     не паром. */
  var S = 128;
  var c = document.createElement("canvas");
  c.width = c.height = S;
  var x = c.getContext("2d");
  /* Клуб собран из смещённых пятен: ровный круг читается шариком, а
     пар обязан быть рваным по краю. Позиции фиксированные - текстура
     одна на все частицы, случайность дала бы разное качество от
     загрузки к загрузке при той же цене. */
  var b = [
    [0.47, 0.52, 0.30, 1.00], [0.33, 0.40, 0.25, 0.86],
    [0.63, 0.37, 0.23, 0.78], [0.40, 0.66, 0.26, 0.80],
    [0.66, 0.63, 0.21, 0.66], [0.52, 0.27, 0.16, 0.58],
    [0.25, 0.58, 0.15, 0.52], [0.74, 0.50, 0.14, 0.50],
    [0.58, 0.75, 0.12, 0.44], [0.30, 0.28, 0.12, 0.40]
  ];
  for (var i = 0; i < b.length; i++) {
    var cx = b[i][0] * S, cy = b[i][1] * S, r = b[i][2] * S, a = b[i][3];
    var gr = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    /* Ядро клуба почти непрозрачное и держится до двух третей радиуса.
       Полупрозрачный пар над белой обшивкой не читается вовсе - она
       сама белая; видно его становится только тогда, когда он
       перекрывает её рисунок: панельные швы, полосу, трафарет. */
    gr.addColorStop(0.00, "rgba(255,255,255," + (0.96 * a).toFixed(3) + ")");
    gr.addColorStop(0.38, "rgba(255,255,255," + (0.78 * a).toFixed(3) + ")");
    gr.addColorStop(0.72, "rgba(255,255,255," + (0.26 * a).toFixed(3) + ")");
    gr.addColorStop(1.00, "rgba(255,255,255,0)");
    x.fillStyle = gr;
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  }
  return new T.CanvasTexture(c);
}

var STEAM_VERT = [
  "attribute float aSize;",
  "attribute float aAlpha;",
  "attribute float aRot;",
  "attribute vec3 aCol;",
  "uniform float uScale;",
  "uniform float uPx;",
  "varying vec3 vCol;",
  "varying float vA;",
  "varying float vR;",
  "void main(){",
  "  vCol = aCol; vA = aAlpha; vR = aRot;",
  "  vec4 mv = modelViewMatrix * vec4(position,1.0);",
  /* Тот же перевод мирового размера в пиксели, что и у пыли. Потолок
     нужен на подходе: там корабль вырастает в двенадцать раз, и без
     ограничения одна частица закрыла бы пол-экрана - и по виду, и
     по цене заливки. */
  "  gl_PointSize = min(aSize * uScale * uPx / max(0.4, -mv.z), 260.0);",
  "  gl_Position = projectionMatrix * mv;",
  "}"
].join("\n");

var STEAM_FRAG = [
  "uniform sampler2D uMap;",
  "varying vec3 vCol;",
  "varying float vA;",
  "varying float vR;",
  "void main(){",
  /* Спрайт повёрнут на свой угол и медленно крутится. Без этого все
     двести клубов - одна и та же картинка в одной и той же
     ориентации, и выброс читается россыпью одинаковых шариков, а не
     паром. Стоит синус с косинусом на пиксель. */
  "  vec2 uv = gl_PointCoord - 0.5;",
  "  float sr = sin(vR), cr = cos(vR);",
  "  uv = vec2(uv.x * cr - uv.y * sr, uv.x * sr + uv.y * cr) + 0.5;",
  "  float a = texture2D(uMap, uv).a * vA;",
  "  if (a < 0.004) discard;",
  "  gl_FragColor = vec4(vCol, a);",
  "}"
].join("\n");

function buildSteam(C) {
  /* На слабом устройстве частиц вдвое меньше: заливка полупрозрачными
     спрайтами - самое дорогое, что есть в этой сцене */
  var n = C.weak ? 105 : 220;
  var pos = new Float32Array(n * 3);
  var col = new Float32Array(n * 3);
  var siz = new Float32Array(n);
  var alp = new Float32Array(n);
  var rot = new Float32Array(n);
  var geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  geo.setAttribute("aCol", new T.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new T.BufferAttribute(siz, 1));
  geo.setAttribute("aAlpha", new T.BufferAttribute(alp, 1));
  geo.setAttribute("aRot", new T.BufferAttribute(rot, 1));
  var uni = { uMap: { value: steamTexture() }, uScale: { value: 1 }, uPx: { value: 1000 } };
  var mat = new T.ShaderMaterial({
    vertexShader: STEAM_VERT, fragmentShader: STEAM_FRAG, uniforms: uni,
    transparent: true, depthWrite: false, depthTest: true, blending: T.NormalBlending
  });
  var pts = new T.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 4;
  pts.visible = false;
  return {
    pts: pts, geo: geo, uni: uni, n: n,
    pos: pos, col: col, siz: siz, alp: alp, rot: rot,
    spin: new Float32Array(n),
    vel: new Float32Array(n * 3),
    life: new Float32Array(n),
    max: new Float32Array(n),
    amp: new Float32Array(n),
    curl: new Float32Array(n),
    gnd: new Uint8Array(n),
    live: 0
  };
}

/* ── Сборка ракеты ───────────────────────────────────────── */
function buildRocket(C, env) {
  var root = new T.Group();

  /* Металл, а не крашеный пластик: и шероховатость, и металличность
     теперь приходят картой, поэтому у материала они равны единице -
     карта их и задаёт. Рельеф обшивки считаем в половинном
     разрешении цветовой карты: швы и заклёпки крупные, лишние
     пиксели тут не видны, а проход Собеля стоит времени на старте.
     Отсекаем по МОБИЛЬНОСТИ, а не по «слабости»: четырёхъядерный
     ноутбук считается слабым, но лишний буфер видеопамяти ему не
     страшен, а корпус без рельефа сразу превращается обратно в
     пластик. Раньше на телефоне рельефа не было вовсе - именно
     поэтому корабль там выглядел игрушечным. Теперь он есть везде,
     карта только меньше: её считают один раз при сборке, на кадр
     это не влияет совсем. */
  var bumpS = C.tiny ? 0 : (C.mobile ? 320 : 512);
  var hullMat = new T.MeshStandardMaterial({
    map: hullTexture(),
    roughnessMap: hullRough(C.weak ? 256 : 512),
    metalnessMap: null,
    metalness: 1.0,
    roughness: 1.0,
    envMap: env,
    envMapIntensity: 1.75
  });
  hullMat.metalnessMap = hullMat.roughnessMap;
  if (bumpS) {
    hullMat.normalMap = bumpToNormal(hullBump(bumpS), 2.6);
    hullMat.normalScale = new T.Vector2(0.85, 0.85);
  }

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

  /* ── Проём люка вырезан в самой обшивке ───────────────────
     Раньше корпус был сплошным телом вращения, а люк - накладкой
     поверх него: рама, створки и стена салона лежали НА обшивке.
     Пока створки закрыты, разницы не видно, но стоит им разъехаться,
     и под ними оказывается всё тот же сплошной борт. Владелец видел
     ровно это: «двери открываются, а салона не видно».

     Поэтому пояс корпуса на высоте люка строим с вырезом: обшивка
     идёт по кругу везде, кроме сектора проёма. В вырезе стоит рама,
     за ней - стена салона, и через открытые створки её действительно
     видно. Верх и низ корпуса остаются целыми телами вращения. */
  var DOOR_Y = 0.10, DOOR_H = 1.34, DOOR_HALF = 0.62;
  var beltA = DOOR_Y - DOOR_H / 2, beltB = DOOR_Y + DOOR_H / 2;

  /* Кусок профиля между двумя высотами, с точками ровно на границах:
     без них шов между поясом и соседями расходится на глаз */
  function slice(list, y0, y1) {
    var out = [], i, a, bp, t;
    function at(y) {
      for (var q = 1; q < list.length; q++) {
        var p0 = list[q - 1], p1 = list[q];
        if ((y >= p0.y && y <= p1.y) || (y <= p0.y && y >= p1.y)) {
          var dy = p1.y - p0.y;
          t = dy === 0 ? 0 : (y - p0.y) / dy;
          return new T.Vector2(p0.x + (p1.x - p0.x) * t, y);
        }
      }
      return null;
    }
    var s0 = at(y0), s1 = at(y1);
    if (s0) out.push(s0);
    for (i = 0; i < list.length; i++) {
      if (list[i].y > y0 && list[i].y < y1) out.push(list[i]);
    }
    if (s1) out.push(s1);
    return out;
  }

  var hullParts = [];
  var low = slice(pts, -2.30, beltA);
  var high = slice(pts, beltB, 2.72);
  /* Пояс: обшивка везде, кроме сектора проёма. Отсчёт угла у
     LatheGeometry и у цилиндров створок один и тот же (ноль на +Z),
     поэтому вырез и рама совпадают без подгонки. */
  var cut = DOOR_HALF * 1.07;
  var belt = slice(pts, beltA, beltB);
  hullParts.push(new T.Mesh(new T.LatheGeometry(low, C.radial), hullMat));
  hullParts.push(new T.Mesh(new T.LatheGeometry(high, C.radial), hullMat));
  hullParts.push(new T.Mesh(
    new T.LatheGeometry(belt, C.radial, cut, Math.PI * 2 - cut * 2),
    hullMat
  ));
  var body = hullParts[0];
  for (var hp = 0; hp < hullParts.length; hp++) {
    hullParts[hp].geometry.computeVertexNormals();
    root.add(hullParts[hp]);
  }

  /* Носовой конус потемнее, чтобы читался силуэт */
  var tipMat = new T.MeshStandardMaterial({
    color: 0x2C6190, metalness: 0.80, roughness: 0.19, envMap: env, envMapIntensity: 2.0
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
  /* Раструб закопчён: он матовее корпуса и заметно темнее. Светлое
     сопло выдавало игрушку сильнее всего остального. */
  var bellMat = new T.MeshStandardMaterial({
    color: 0x33404F, metalness: 0.92, roughness: 0.54,
    envMap: env, envMapIntensity: 0.9, side: T.DoubleSide
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
  /* Плоскость стабилизатора освещена почти одинаково по всей площади,
     поэтому объём ей может дать только отражение: чем оно сильнее, тем
     заметнее градиент от корня к кромке. Матовость поднимаем чуть выше
     зеркальной - лакированный металл, а не хром. */
  var finMat = new T.MeshStandardMaterial({
    color: 0x2A72AA, metalness: 0.84, roughness: 0.28, envMap: env, envMapIntensity: 2.0
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

  /* Опоры кладём внутрь корпуса: наклон, поворот и масштаб корабля
     они наследуют даром, а мы правим только углы */
  var gear = buildGear(C, env);
  root.add(gear.group);

  return { root: root, body: body, glass: glass, glowMat: glowMat, door: door, gear: gear };
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
  /* Что человек видит в открытом люке. Владелец сформулировал так:
     «двери открываются, и там уже салон видно». Значит в проёме
     должен читаться не тёмный прямоугольник, а комната: свет с
     потолка, приборы на дальней стене, решётчатый пол, глубина.

     Всё это рисуем в текстуре, а не геометрией, по одной причине:
     проём живёт полтора десятка кадров прокрутки, и держать ради
     него вторую сцену - значит отдать бюджет, на котором потом
     поднимется настоящая рубка. Текстура крупная (1024), потому что
     на подходе проём занимает почти весь экран и мелкая мылилась. */
  var W = 1024, H = 1024;
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");

  /* Глубина: потолок и пол темнее, полоса дальней стены светлее -
     именно этот перепад и читается как «там комната», а не панель */
  var bg = x.createLinearGradient(0, 0, 0, H);
  /* Тон тот же, что у настоящей рубки (rc-interior, COL.wall):
     человек входит в ту самую комнату, которую увидел в проёме, и
     разъехаться они по цвету не имеют права. */
  bg.addColorStop(0.00, "#0A1624");
  bg.addColorStop(0.16, "#14293E");
  bg.addColorStop(0.42, "#1C3E5C");
  bg.addColorStop(0.62, "#173247");
  bg.addColorStop(0.86, "#0D1B28");
  bg.addColorStop(1.00, "#070F18");
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);

  /* Боковые ниши: они сходятся к середине и дают перспективу.
     Без них стена плоская, сколько её ни свети. */
  function niche(cx, w, dark) {
    var g1 = x.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g1.addColorStop(0, dark ? "rgba(4,10,18,.85)" : "rgba(4,10,18,.55)");
    g1.addColorStop(0.5, "rgba(30,64,94,.30)");
    g1.addColorStop(1, dark ? "rgba(4,10,18,.85)" : "rgba(4,10,18,.55)");
    x.fillStyle = g1;
    x.fillRect(cx - w / 2, H * 0.14, w, H * 0.70);
  }
  niche(W * 0.10, W * 0.20, true);
  niche(W * 0.90, W * 0.20, true);
  niche(W * 0.30, W * 0.16, false);
  niche(W * 0.70, W * 0.16, false);

  /* Продольные рёбра обшивки */
  x.strokeStyle = "rgba(140,186,222,.20)";
  x.lineWidth = 3;
  for (var i = 1; i < 9; i++) {
    x.beginPath();
    x.moveTo((i / 9) * W, H * 0.14);
    x.lineTo((i / 9) * W, H * 0.84);
    x.stroke();
  }

  /* Пояс приборов на дальней стене: он и есть «салон», а не склад.
     Экраны разной яркости - ряд одинаковых читается орнаментом. */
  x.fillStyle = "rgba(20,52,80,.85)";
  x.fillRect(0, H * 0.20, W, H * 0.17);
  x.fillStyle = "rgba(66,178,220,.28)";
  x.fillRect(0, H * 0.20, W, 3);
  x.fillRect(0, H * 0.37 - 3, W, 3);
  for (i = 0; i < 14; i++) {
    var sx = W * (0.035 + i * 0.069);
    var lit = (i % 4 === 0) ? 0.92 : (i % 3 === 0 ? 0.62 : 0.34);
    x.fillStyle = "rgba(96,206,255," + lit + ")";
    x.fillRect(sx, H * 0.225, W * 0.055, H * 0.055);
    /* строки данных на экране */
    x.fillStyle = "rgba(10,26,42,.55)";
    for (var r = 0; r < 3; r++) {
      x.fillRect(sx + W * 0.007, H * (0.233 + r * 0.015), W * 0.034, H * 0.007);
    }
    x.fillStyle = "rgba(155,232,255,.55)";
    x.fillRect(sx, H * 0.290, W * 0.055, 2);
  }

  /* Кресла у дальней стены: два тёмных силуэта с подсветкой по
     спинке. Одна деталь, но именно она превращает отсек в салон. */
  function seat(cx) {
    x.fillStyle = "rgba(6,14,24,.92)";
    x.beginPath();
    x.moveTo(cx - W * 0.062, H * 0.84);
    x.lineTo(cx - W * 0.048, H * 0.58);
    x.lineTo(cx + W * 0.048, H * 0.58);
    x.lineTo(cx + W * 0.062, H * 0.84);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(66,178,220,.42)";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(cx - W * 0.046, H * 0.60);
    x.lineTo(cx + W * 0.046, H * 0.60);
    x.stroke();
  }
  seat(W * 0.34);
  seat(W * 0.66);

  /* Решётка пола с бликом от потолочной панели */
  x.strokeStyle = "rgba(150,190,225,.16)";
  x.lineWidth = 2;
  for (i = 0; i < 12; i++) {
    var yy = H * (0.82 + i * 0.014);
    x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke();
  }
  for (i = 0; i <= 10; i++) {
    var fx = W * (i / 10);
    x.beginPath();
    x.moveTo(W * 0.5 + (fx - W * 0.5) * 0.55, H * 0.82);
    x.lineTo(fx, H);
    x.stroke();
  }

  /* Тёплый свет потолочной панели - ради него проём и светится.
     Он же связывает кадр с лампой в проёме (rc-rocket, doorOpen).
     Держим его сдержанным: залитый светом потолок делал салон
     похожим на пустую белую комнату, а не на рубку корабля. */
  var lamp = x.createRadialGradient(W / 2, H * 0.10, 0, W / 2, H * 0.10, W * 0.62);
  lamp.addColorStop(0, "rgba(255,220,175,.34)");
  lamp.addColorStop(0.35, "rgba(120,170,210,.12)");
  lamp.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = lamp;
  x.fillRect(0, 0, W, H);

  /* Светящаяся полоса потолка: узкая, но она задаёт «верх» */
  var strip = x.createLinearGradient(0, H * 0.10, 0, H * 0.14);
  strip.addColorStop(0, "rgba(255,236,208,.58)");
  strip.addColorStop(1, "rgba(255,236,208,0)");
  x.fillStyle = strip;
  x.fillRect(W * 0.16, H * 0.10, W * 0.68, H * 0.04);

  /* Виньетки здесь нарочно нет. Она гасила края рисунка, а в проём
     человек смотрит именно на края: середина стены уходит за
     створки. С виньеткой салон читался тёмным пятном. */

  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  return tex;
}

/* Текстура створки: та же светлая обшивка, но со своей жизнью -
   поперечные рёбра жёсткости, фирменная полоса, трафарет и жёлтая
   предупредительная разметка по кромке. Атлас рассчитан на одну
   створку, поэтому рисунок не растягивается и дверь читается
   дверью с любого расстояния. */
/* Створка люка. Половинок две, и рисунок у них зеркальный: раньше
   обе брали одну текстуру, и в кадре стояли два одинаковых трафарета
   «R-01» рядом, а предупредительная лента шла по внешним краям
   вместо стыка. Дверь от этого читалась наклейкой на борту. Теперь
   левая и правая створки - это разные листы металла, как на
   настоящем корабле: маркировка у каждой своя, лента идёт по
   притвору, ручка-паз смотрит в сторону открывания. */
function doorTexture(right) {
  var W = 256, H = 512;
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");
  /* Зеркалим весь рисунок для правой створки одним преобразованием:
     так обе половинки гарантированно совпадают по стыку */
  if (right) { x.translate(W, 0); x.scale(-1, 1); }

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
  /* Маркировка. У каждой створки своя: на левой номер люка, на
     правой предписание шлюза. Два одинаковых трафарета в кадре
     сразу выдавали наклейку. */
  x.fillStyle = "rgba(20,52,86,.30)";
  x.font = "600 15px 'Golos Text', system-ui, sans-serif";
  if (right) {
    /* Текст на зеркальном холсте пришлось бы читать наоборот -
       возвращаем систему координат на время надписи */
    x.save();
    x.translate(W, 0); x.scale(-1, 1);
    x.fillText("AIRLOCK", 24, H * 0.30);
    x.font = "600 11px 'Golos Text', system-ui, sans-serif";
    x.fillStyle = "rgba(20,52,86,.24)";
    x.fillText("PRESS OK", 24, H * 0.34);
    x.restore();
  } else {
    x.fillText("R-01", 26, H * 0.30);
    x.font = "600 11px 'Golos Text', system-ui, sans-serif";
    x.fillStyle = "rgba(20,52,86,.24)";
    x.fillText("HATCH 1/2", 26, H * 0.34);
  }
  /* Ручка-паз: смотрит в сторону открывания, то есть к стыку */
  x.fillStyle = "rgba(40,60,84,.45)";
  x.fillRect(W * 0.40, H * 0.60, W * 0.42, 10);
  x.fillStyle = "rgba(255,255,255,.5)";
  x.fillRect(W * 0.40, H * 0.60 + 10, W * 0.42, 2);
  /* Петли на внешнем краю: три коротких утолщения. Именно они и
     объясняют глазу, что панель на шарнирах, а не приклеена. */
  for (i = 0; i < 3; i++) {
    var hy = H * (0.22 + i * 0.28);
    x.fillStyle = "rgba(88,110,136,.55)";
    x.fillRect(2, hy, 14, H * 0.06);
    x.fillStyle = "rgba(255,255,255,.42)";
    x.fillRect(2, hy, 14, 2);
  }

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
  /* Стена салона гнётся на сто тридцать пять градусов, а в кадр
     проёма попадает от силы сорок пять: при полном развороте
     текстуры человек видел бы её треть - кусок стены без единого
     прибора. Показываем в проёме середину рисунка целиком. */
  cabTex.repeat.x = 1;
  cabTex.offset.x = 0;
  var cabin = new T.Mesh(
    /* Стена салона шире самого проёма - иначе по его краям видно
       мимо неё, в пустое нутро корпуса, и салон читается узкой
       полоской посреди темноты. Радиус подобран так, чтобы дальняя
       стенка перекрывала проём с запасом на любой ракурс. */
    new T.CylinderGeometry(R * 0.86, R * 0.86, HH * 1.10, seg, 1, true, -HALF * 1.9, HALF * 3.8),
    /* Двусторонний нарочно. Односторонняя стенка рисуется только с
       изнанки, а в проём мы смотрим снаружи корабля - и видели
       сквозь неё космос вместо салона. */
    new T.MeshBasicMaterial({ map: cabTex, side: T.DoubleSide, toneMapped: false })
  );
  cabin.position.y = Y;
  cabin.renderOrder = 1;
  group.add(cabin);
  /* Пол тамбура: без него в проёме видна только стена, и глубины
     не читается. Тёмная решётка с бликом даёт понять, что там объём */
  var floor = new T.Mesh(
    new T.CircleGeometry(R * 0.86, seg),
    new T.MeshBasicMaterial({ color: 0x0A1726, toneMapped: false })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = Y - HH * 0.5;
  group.add(floor);

  /* Тёплая лампа в проёме: свет ложится на кромки створок */
  var lamp = new T.PointLight(0xFFD2A0, 0, 3.2, 2);
  lamp.position.set(0, Y + 0.3, R * 0.1);
  group.add(lamp);

  /* 2. Косяки проёма. Раньше здесь стоял цилиндрический сектор во
     всю ширину люка - и он же был главной ошибкой всей сцены: при
     двусторонней отрисовке ближняя к зрителю половина этого сектора
     рисовалась поверх всего и закрывала проём наглухо. Створки
     разъезжались, а за ними по-прежнему была ровная тёмная стенка -
     ровно то, на что владелец и жаловался.

     Настоящий люк обрамляют косяки: две вертикальные стойки по
     сторонам и два пояска сверху и снизу. Середина проёма остаётся
     открытой, и сквозь неё виден салон. */
  var frameMat = new T.MeshStandardMaterial({
    color: 0x6E829A, metalness: 0.92, roughness: 0.28, envMap: env, envMapIntensity: 1.6, side: T.DoubleSide
  });
  var jambW = 0.075;                    /* ширина стойки, радиан */
  function jamb(start) {
    var m = new T.Mesh(
      new T.CylinderGeometry(R * 0.995, R * 0.995, HH, Math.max(3, Math.round(seg * 0.14)), 1, true,
        start, jambW),
      frameMat
    );
    m.position.y = Y;
    return m;
  }
  group.add(jamb(-HALF * 1.07));
  group.add(jamb(HALF * 1.07 - jambW));
  /* Пояски: короткие по высоте сегменты во всю ширину проёма */
  function ledge(yy) {
    var m = new T.Mesh(
      new T.CylinderGeometry(R * 0.995, R * 0.995, HH * 0.045, seg, 1, true,
        -HALF * 1.07, HALF * 2.14),
      frameMat
    );
    m.position.y = yy;
    return m;
  }
  group.add(ledge(Y + HH * 0.5));
  group.add(ledge(Y - HH * 0.5));

  /* Уплотнитель по контуру: тонкая тёмная кромка между косяком и
     створкой. Без неё дверь сливается с бортом, с ней читается
     настоящий люк с притвором. Он тоже идёт только по краям. */
  var sealMat = new T.MeshStandardMaterial({
    color: 0x3A4E67, metalness: 0.7, roughness: 0.5, envMap: env, side: T.DoubleSide
  });
  function sealJamb(start) {
    var m = new T.Mesh(
      new T.CylinderGeometry(R * 0.999, R * 0.999, HH * 0.978, Math.max(3, Math.round(seg * 0.1)), 1, true,
        start, jambW * 0.42),
      sealMat
    );
    m.position.y = Y;
    return m;
  }
  group.add(sealJamb(-HALF * 1.014));
  group.add(sealJamb(HALF * 1.014 - jambW * 0.42));

  /* 3. Створки: тот же цилиндр, что и борт, потому и читаются
     обшивкой этого корабля, а не панелью поверх кадра. Материал
     свой: обшивочная текстура на узком сегменте растянулась бы
     всем атласом, и дверь выглядела бы окном с чужим рисунком. */
  /* Материала два - по листу на створку. Стоит их объединить, и
     рисунок повторится дважды: один и тот же трафарет рядом сам с
     собой это первое, что выдаёт наклейку вместо двери. */
  function doorMatFor(right) {
    return new T.MeshStandardMaterial({
      map: doorTexture(right), metalness: 0.62, roughness: 0.26,
      envMap: env, envMapIntensity: 1.45, side: T.DoubleSide
    });
  }
  var doorMatL = doorMatFor(false), doorMatR = doorMatFor(true);
  function leaf(sign) {
    var m = new T.Mesh(
      new T.CylinderGeometry(R * 1.004, R * 1.004, HH * 0.985, seg, 1, true,
        sign > 0 ? 0 : -HALF, HALF),
      sign > 0 ? doorMatR : doorMatL
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

  /* Радиус обшивки и высоту проёма отдаём наружу: пар из стыка обязан
     бить из настоящей щели этой двери, а не из чисел, переписанных
     руками во второе место файла */
  return {
    group: group, l: lTurn, r: rTurn, lamp: lamp, cabin: cabin,
    edgeMat: edgeMat, y: Y, half: HALF, rad: R, hh: HH
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

  return { group: grp, uniforms: uniforms, cone: cone, core: core, halo: halo };
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

  /* ── Световая постановка ────────────────────────────────────
     Раньше свет был почти лобовым: ключевой стоял у камеры, и
     цилиндр получал одинаковую яркость от края до края. Отсюда и
     «плоско» - объём цилиндру даёт не количество света, а то,
     насколько быстро он падает поперёк формы.

     Поэтому ключевой уводим вбок и вверх (свет скользит по борту и
     даёт градиент), рассеянный полусферный приглушаем (он и съедал
     весь объём), а силуэт держим двумя контровыми сзади. Контровой
     - единственный источник, который меняется по сцене: в космосе
     он холодный, на посадке его подменяет отсвет факела, и он
     становится тёплым. Ссылки храним: цвет и сила ведутся в кадре. */
  var hemi = new T.HemisphereLight(0xBFE2FF, 0x0A1826, 0.88);
  scene.add(hemi);
  this.hemi = hemi;

  var key = new T.DirectionalLight(0xF4FBFF, 3.2);
  key.position.set(6.5, 5.2, 3.0);
  scene.add(key);
  this.keyLight = key;

  /* Контровой по силуэту: стоит за кораблём и чуть сбоку, поэтому
     обводит кромку, а не освещает лицевую сторону */
  var rim = new T.DirectionalLight(0x8A59F6, 2.6);
  rim.position.set(-5.6, 0.8, -5.4);
  scene.add(rim);
  this.rimLight = rim;
  this._rimCold = new T.Color(0x8A59F6);
  this._rimWarm = new T.Color(0xFFB068);

  var fill = new T.DirectionalLight(0x62C6EA, 1.45);
  fill.position.set(-3.4, 3.0, 5.0);
  scene.add(fill);
  this.fillLight = fill;

  /* Отражённый от площадки: работает только на посадке, зато делает
     ровно то, чего просили, - снизу корабль перестаёт быть чёрным
     провалом, и опоры получают собственную светотень */
  var bounce = new T.DirectionalLight(0xFFC488, 0);
  bounce.position.set(0.6, -6, 2.6);
  scene.add(bounce);
  this.bounceLight = bounce;

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
  /* Посадка: доля раскрытия опор, тормозной импульс, просадка на
     касании и дрожь кадра. Всё хранится здесь, чтобы обратная
     прокрутка могла разом вернуть корабль в полётное состояние. */
  this.landK = 0;
  this.gearK = 0;
  this._burn = 0;
  this._shock = 0;
  this._shockT = 0;
  this._shake = 0;
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

/* Размеры холста: из памяти, а не у браузера */
Rocket.prototype.cw = function () { return this._cw || innerWidth; };
Rocket.prototype.ch = function () { return this._ch || innerHeight; };

Rocket.prototype.resize = function () {
  var w = innerWidth, h = innerHeight;
  /* Размеры холста запоминаем здесь. Раньше их спрашивали у браузера
     по десятку раз за кадр (clientWidth/clientHeight), и каждый такой
     вопрос после записи в стиль заставлял пересчитать вёрстку прямо
     внутри кадра. Холст растянут на всё окно и меняется только
     вместе с ним. */
  this._cw = w;
  this._ch = h;
  /* Разрешение буфера - единственное, чем телефон отличается от
     монитора: сама картинка и все её детали те же */
  this.r.setPixelRatio(Math.min(g.devicePixelRatio || 1,
    this.C.weak ? 1.1 : (this.C.mobile ? 1.45 : 2)));
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
  var w = this.cw();
  var h = this.ch();
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
  /* Долю посадки отдаём вёрстке. Владелец сказал прямо: когда
     корабль садится, под ним не должно быть ни текста, ни карточек,
     и снизу не должно просвечивать, что там ещё что-то есть -
     страница к этому моменту кончилась, корабль опускается на
     пустую площадку. По этой доле кадр и очищается. */
  var landR = (Math.round(this.landK * 50) / 50).toFixed(2);
  if (landR !== this._landPub) {
    this._landPub = landR;
    /* Долю очистки раздаём каждому разделу отдельно, а не одной
       записью на сцену. Одна запись выглядела экономнее, но сцена -
       это main, родитель всей страницы: переменная наследуемая, и
       каждый такой кадр помечал устаревшим стиль всего документа.
       На посадке это стоило тринадцати секунд пересчёта за проход.
       Разделов полтора десятка, значение у всех одно, и читает его
       сам раздел - наследовать нечего. */
    if (!this._clearEls) {
      var stage = document.querySelector("main.w3-stage");
      this._clearEls = stage ? [].slice.call(stage.children) : [];
      /* Правовая строка живёт в подвале, а уходить обязана вместе со
         всем остальным: иначе снизу просвечивает продолжение */
      var lg = document.querySelectorAll(".legal");
      for (var lj = 0; lj < lg.length; lj++) this._clearEls.push(lg[lj]);
    }
    var cl = Math.max(0, Math.min(1, this.landK * 1.35 - 0.10)).toFixed(2);
    if (cl !== this._clearVal) {
      this._clearVal = cl;
      for (var ci = 0; ci < this._clearEls.length; ci++) {
        V(this._clearEls[ci], "--rc-clear", cl);
      }
    }
  }
  /* Когда кадр очищен полностью, снимаем с него и нажатия: попасть
     пальцем в невидимую карточку человек не должен */
  var clear = this.landK > 0.82 ? "1" : "0";
  if (clear !== this._clearPub) {
    this._clearPub = clear;
    document.documentElement.setAttribute("data-clear", clear);
  }

  /* Всё, что появилось у посадки - опоры, импульс, просадка - ведём
     всегда, даже когда доля упала в ноль: иначе на обратной прокрутке
     ноги останутся раскрытыми у летящего корабля. */
  this.touchdown(dt);

  if (this.landK < 0.002) return 0;

  /* Площадка ровно по центру кадра: клиент просил посадку не сбоку,
     а в середине сцены - камера смотрит прямо на неё.

     Высоту считаем, а не назначаем. Раньше центр корпуса ставили на
     0.78 высоты кадра, и вся нижняя половина корабля - сопло, юбка,
     то самое место, куда он садится - уезжала за нижнюю кромку.
     Посадку было физически не видно, поэтому она и не читалась
     событием. Теперь отталкиваемся от пят: они обязаны встать на
     0.855 кадра, а центр корпуса выводим из текущего масштаба. Так
     точка касания попадает в кадр на любом экране. */
  var w = this.cw();
  var h = this.ch();
  var half = Math.tan((this.cam.fov * Math.PI / 180) / 2) * (this.cam.position.z + 0.2);
  var feet = Math.abs(PAD_Y) * (this._sNow || 1) / (2 * half);   /* доля кадра до пят */
  /* На телефоне площадку ставим чуть выше: там под ней сразу идут
     карточки следующего раздела, и разметка тонула бы в них */
  var aim = (this.C.mobile ? 0.82 : 0.855) - feet;
  if (aim < 0.30) aim = 0.30;
  this.toWorld(w * 0.5, h * aim, -0.2, this._padP || (this._padP = new T.Vector3()));

  /* Точку касания запоминаем ДО подъёма: это и есть уровень грунта,
     по нему стоит площадка. Иначе земля едет вниз вместе с
     садящимся кораблём, и снижения опять не видно - оно взаимно
     сокращается. */
  if (!this._padAt) this._padAt = new T.Vector3();
  this._padAt.copy(this._padP);

  /* Зависание над площадкой. Без него корабль подходил к точке
     касания по прямой из своей полётной позиции и последнюю треть
     посадки просто стоял: снижения не было видно вовсе. Теперь
     цель поднята над площадкой и опускается вместе с долей - глаз
     читает вертикальный спуск, а не подъезд сбоку. */
  var hov = 1 - this.landK;
  this._padP.y += hov * hov * Math.sqrt(hov) * 4.6 * (this._sNow || 1);
  pos.lerp(this._padP, this.landK);

  /* Нос разворачивается вверх: ракета встаёт на опоры. Выравнивание
     идёт с опережением - к тормозному импульсу корабль обязан уже
     стоять вертикально, иначе он тормозит боком, а это читается
     падением, а не посадкой. */
  tan.lerp(this._upVec || (this._upVec = new T.Vector3(0, 1, 0)),
    Math.min(1, this.landK * 1.4)).normalize();

  /* Тяга гаснет, но факел не исчезает совсем: сопло остывает */
  this.power = Math.max(0.14, this.power * (1 - this.landK * 0.82));
  return this.landK;
};

/* ── Тормозной импульс, касание и просадка ────────────────────
   Импульс намеренно считается ОТ ДОЛИ ПОСАДКИ, а не по таймеру от
   события. Причина простая: человек листает в обе стороны, и всё,
   что заведено таймером, на обратной прокрутке остаётся висеть или
   срабатывает второй раз. Функция от landK разворачивается назад
   сама собой - отлистал вверх, и вспышка честно гаснет.

   Просадка на касании - наоборот, чистое время: удар это событие, у
   него есть затухающие колебания, и растянуть их по скроллу нельзя,
   иначе амортизатор перестаёт быть амортизатором. Поэтому у неё
   свой счётчик, который сбрасывается вместе с флагом касания. */
Rocket.prototype.touchdown = function (dt) {
  dt = dt || 0.016;
  var lk = this.landK || 0;

  /* Опоры раскрываются на заходе, от 0.35 до 0.75 доли посадки:
     к касанию они обязаны стоять, а не доезжать */
  var gk = (lk - 0.35) / 0.40;
  gk = gk < 0 ? 0 : gk > 1 ? 1 : gk;
  this.gearK = gk * gk * (3 - 2 * gk);

  /* Импульс: горб вокруг 0.78 доли, то есть за миг до касания. Пик
     сдвинут туда, где корабль уже выровнялся: тормозить он обязан
     соплом в грунт, а не боком по касательной */
  var b = 1 - Math.abs(lk - 0.78) / 0.18;
  this._burn = b <= 0 ? 0 : b * b * (3 - 2 * b);

  /* Касание: удар, пыль из-под опор, дрожь кадра и тишина после */
  if (lk > 0.86 && !this._touched) {
    this._touched = 1;
    this._shockT = 0;
    this._shake = this.C.weak ? 0.55 : 1;
    this.dust();
    /* Крошку выбивает в тот же кадр, что и пыль: удар один */
    this.debrisEmit();
    /* Пар из-под опор в тот же миг, что и пыль. В акте посадки
       площадка и тень в кадре целиком, и клиент просил, чтобы объём
       падал именно от корабля: сухое касание читалось макетом. */
    this._padSteam = this.C.weak ? 0.5 : 1;
    this._padRest = 0;
    this.steamEmit(this.C.weak ? 54 : 130, 3);
    document.documentElement.classList.add("rc-landed-craft");
    if (g.RC_SOUND && g.RC_SOUND.boom) { try { g.RC_SOUND.boom(); } catch (e) {} }
    try { dispatchEvent(new CustomEvent("rc:touchdown")); } catch (e) {}
  }
  if (lk < 0.72 && this._touched) {
    /* Отлистали вверх - корабль снова в воздухе: снимаем всё, что
       принадлежит стоянке, и пыль тоже */
    this._touched = 0;
    this._shock = 0;
    this._shake = 0;
    this.dustClear();
    this.debrisClear();
    /* Посадочный выброс тоже принадлежит стоянке: взлетели обратно -
       газу из-под опор идти неоткуда */
    this._padSteam = 0;
    this._padRest = 0;
    document.documentElement.classList.remove("rc-landed-craft");
  }

  /* Затухающие колебания стойки: первый ход - сжатие, дальше два-три
     всё более мелких отскока. Так опора читается пружиной, а не
     подпоркой. */
  if (this._touched) {
    this._shockT += dt;
    var tt = this._shockT;
    var s = Math.exp(-tt * 5.0) * Math.cos(tt * 15.5);
    this._shock = s < -0.22 ? -0.22 : s;

    /* Газ выходит из-под опор ещё почти секунду после касания:
       одним хлопком клуб читается вспышкой, а не выбросом. Ставим
       частицы порциями по времени кадра, а не по ходу колеса -
       остановился на середине, выброс всё равно доиграет. */
    if (this._padSteam > 0 && tt < 0.95) {
      this._padRest = (this._padRest || 0) + dt * (this.C.weak ? 34 : 78) * this._padSteam;
      var pn = Math.floor(this._padRest);
      if (pn > 0) { this._padRest -= pn; this.steamEmit(pn, 3); }
    }
  }

  this.legs();
  return this.landK;
};

/* Поза опор на этот кадр. Считаем в плоскости одной ноги: угол
   выноса, длина выехавшего штока и один atan2 на подкос. Три ноги
   отличаются только поворотом своей группы, поэтому цикл короткий
   и одинаковый. */
Rocket.prototype.legs = function () {
  var G = this.rocket.gear;
  if (!G) return;
  var k = this.gearK || 0;
  G.group.visible = k > 0.004;
  if (!G.group.visible) return;

  var shock = this._shock || 0;
  /* Просадка не только укорачивает шток, но и слегка растопыривает
     ноги: так удар передаётся всей стойкой, а не одним цилиндром */
  var th = GEAR_STOW + (GEAR_OPEN - GEAR_STOW) * k + shock * 0.075;
  var lo = GEAR_LO * k * (1 - shock * 0.46);
  if (lo < 0.001) lo = 0.001;
  var full = GEAR_UP + lo;
  var ct = Math.cos(th), st = Math.sin(th);

  for (var i = 0; i < G.legs.length; i++) {
    var L = G.legs[i];
    L.swing.rotation.x = -th;              /* -th уводит ногу наружу, к +Z */
    L.rod.scale.y = lo;
    L.foot.position.y = -full;
    L.foot.rotation.x = th;                /* тарелка обязана лежать плашмя */
    /* Амортизатор сидит в пятке, чуть выше тарелки, и на просадке
       уходит в неё: удар гасит он, и это должно быть видно */
    L.damp.position.y = -full + 0.13 + shock * 0.05;

    /* Подкос: отрезок от неподвижной точки борта до середины ноги.
       Обе точки в одной плоскости, поэтому наклон - это atan2, а
       длина - обычная гипотенуза. */
    var dy = (GEAR_HIP_Y - full * GEAR_MID * ct) - GEAR_BR_Y;
    var dz = (GEAR_HIP_Z + full * GEAR_MID * st) - GEAR_BR_Z;
    var len = Math.sqrt(dy * dy + dz * dz);
    var ang = Math.atan2(dz, dy);
    L.brace.rotation.x = ang;
    L.brace.scale.y = len;
    /* Гильза короче штока и не тянется: шток в неё въезжает. Именно
       разница «неподвижная гильза - подвижный шток» и читается
       работающей гидравликой, а не нарисованной палкой. */
    L.sleeve.rotation.x = ang;
    L.sleeve.scale.y = len * 0.46;
    /* Шланг провисает: он длиннее прямой и потому чуть выгнут -
       наклоняем его сильнее подкоса и делаем длиннее на десятую */
    if (L.hose) {
      L.hose.rotation.x = ang + 0.14;
      L.hose.scale.y = len * 1.06;
    }
  }
};

/* ── Пыль из-под опор ─────────────────────────────────────────
   Выпускаем частицы кольцом от точки касания. Один и тот же
   излучатель работает дважды: слабой струйкой, пока сопло только
   раздувает грунт на подлёте, и разом на весь запас - в момент
   удара. Отдельного кода для этих двух случаев не нужно, разница
   только в числе частиц и в силе выброса. */
Rocket.prototype.dustEmit = function (count, force) {
  if (document.documentElement.classList.contains("rc-reduced")) return;
  var D = this.ground() && this._dust;
  if (!D) return;
  var made = 0;
  for (var i = 0; i < D.n && made < count; i++) {
    if (D.life[i] > 0) continue;               /* занятую частицу не трогаем */
    made++;
    var a = Math.random() * Math.PI * 2;
    /* Стартуем у самых тарелок, слегка вразнобой по радиусу */
    var r = PAD_FEET * (0.62 + Math.random() * 0.55);
    var sp = (1.3 + Math.random() * 2.9) * force;
    D.pos[i * 3]     = Math.cos(a) * r;
    D.pos[i * 3 + 1] = 0.04 + Math.random() * 0.14;
    D.pos[i * 3 + 2] = Math.sin(a) * r;
    D.vel[i * 3]     = Math.cos(a) * sp;
    D.vel[i * 3 + 1] = (0.35 + Math.random() * 1.5) * force;
    D.vel[i * 3 + 2] = Math.sin(a) * sp;
    D.siz[i] = 0.10 + Math.random() * 0.17;
    D.max[i] = 2.6 + Math.random() * 1.6;
    D.life[i] = D.max[i];
  }
  if (!made) return;
  D.live = 1;
  D.pts.visible = true;
  D.geo.attributes.aSize.needsUpdate = true;
};

/* Удар: разом весь запас частиц и на полной силе */
Rocket.prototype.dust = function () {
  this.dustEmit(this.C.weak ? 64 : 230, 1);
};

/* Обратная прокрутка: пыль обязана исчезнуть разом, а не дожить
   свои три секунды у корабля, который снова в воздухе */
Rocket.prototype.dustClear = function () {
  var D = this._dust;
  if (!D) return;
  D.live = 0;
  D.pts.visible = false;
  for (var i = 0; i < D.n; i++) D.life[i] = 0;
};

/* ── Площадка: грунт, разметка, тень и пыль ───────────────────
   Всё это одна группа, живущая прямо в сцене, а не внутри корабля.
   Причина: корабль всё время медленно крутится вокруг своей оси, и
   разметка грунта крутилась бы вместе с ним - земля поехала бы под
   ногами. Группа лишь повторяет положение и масштаб корабля, а
   поворот у неё свой, нулевой.

   Собираем по требованию, на первом же заходе на посадку: холсты
   разметки не нужны тем, кто до этого раздела не долистал. */
Rocket.prototype.ground = function () {
  if (this._padGrp) return this._padGrp;
  var C = this.C;
  var grp = new T.Group();
  grp.visible = false;

  /* Местность вокруг: она лежит НИЖЕ настила, поэтому у площадки
     появляется высота, а у корабля - пол под ногами. Плоскость
     крупная, но это всё те же четыре вершины и один вызов. */
  /* Грунт и бортик не режем даже на слабом устройстве: это две
     плоскости и один открытый цилиндр, то есть три вызова отрисовки
     на весь акт посадки. Без них площадка снова становится наклейкой,
     а ради этой толщины всё и делалось. Экономим на разрешении
     холстов и на числе сегментов, а не на самом объёме. */
  var soilMat = new T.MeshBasicMaterial({
    map: terrainTexture(C.weak), transparent: true, depthWrite: false,
    toneMapped: false, opacity: 0
  });
  var soil = new T.Mesh(new T.PlaneGeometry(PAD_SIZE * 1.42, PAD_SIZE * 1.42), soilMat);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = -PAD_LIFT;
  soil.renderOrder = 1;
  grp.add(soil);
  this._padSoil = soil;

  /* Бортик: цилиндр без крышек между уровнем грунта и настилом.
     Он и есть весь секрет объёма - у площадки становится видна
     ТОЛЩИНА, и она перестаёт быть наклейкой на пустоте. */
  var kMat = new T.MeshBasicMaterial({
    map: kerbTexture(C.weak), side: T.DoubleSide,
    transparent: true, depthWrite: false, toneMapped: false, opacity: 0
  });
  var kerb = new T.Mesh(
    new T.CylinderGeometry(PAD_SIZE * 0.462, PAD_SIZE * 0.478, PAD_LIFT, C.weak ? 20 : 40, 1, true),
    kMat
  );
  kerb.position.y = -PAD_LIFT / 2;
  kerb.renderOrder = 1;
  grp.add(kerb);
  this._padKerb = kerb;

  /* Разметка площадки лежит в самом низу стопки: тень падает на неё */
  var padMat = new T.MeshBasicMaterial({
    map: padTexture(C.weak), transparent: true, depthWrite: false,
    toneMapped: false, opacity: 0
  });
  var disc = new T.Mesh(new T.PlaneGeometry(PAD_SIZE, PAD_SIZE), padMat);
  disc.rotation.x = -Math.PI / 2;
  disc.renderOrder = 2;
  grp.add(disc);

  /* Тень корабля - одна плоскость, и она обязана быть везде: без неё
     корабль стоит НАД площадкой, а не на ней, и никакой объём этого
     уже не исправит. Роскошью остаются только тени под каждой
     опорой - вот их на слабом устройстве действительно нет. */
  var shMat = new T.MeshBasicMaterial({
    map: shadowTexture(), transparent: true, depthWrite: false,
    toneMapped: false, opacity: 0
  });
  var shadow = new T.Mesh(new T.PlaneGeometry(4.4, 4.4), shMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  shadow.renderOrder = 3;
  grp.add(shadow);

  if (!C.weak) {
    /* Своя тень у каждой опоры. Общее пятно под кораблём знает только
       про корпус, а стоит он на трёх точках - и пока под тарелками
       пусто, ноги висят над площадкой. Три экземпляра одной
       плоскости идут одним вызовом отрисовки. */
    if (T.InstancedMesh) {
      var fsMat = new T.MeshBasicMaterial({
        map: shadowTexture(), transparent: true, depthWrite: false,
        toneMapped: false, opacity: 0
      });
      var fs = new T.InstancedMesh(new T.PlaneGeometry(1, 1), fsMat, 3);
      fs.frustumCulled = false;
      fs.renderOrder = 3;
      grp.add(fs);
      this._footSh = fs;
      this._footM = new T.Matrix4();
      this._footQ = new T.Quaternion().setFromAxisAngle(new T.Vector3(1, 0, 0), -Math.PI / 2);
      this._footP = new T.Vector3();
      this._footS = new T.Vector3(1, 1, 1);
    }
  }

  /* Засвет под соплом: тот самый свет факела, который подсвечивает
     пыль снизу. Аддитивное пятно дешевле любого источника света и
     не трогает материалы всей сцены. */
  var blMat = new T.MeshBasicMaterial({
    map: dotTexture(false), color: 0x8FE0FF, transparent: true,
    depthWrite: false, blending: T.AdditiveBlending, opacity: 0
  });
  var blast = new T.Mesh(new T.PlaneGeometry(5.6, 5.6), blMat);
  blast.rotation.x = -Math.PI / 2;
  blast.position.y = 0.014;
  blast.renderOrder = 4;
  grp.add(blast);

  /* Ударная волна от касания */
  var rgMat = new T.MeshBasicMaterial({
    map: ringTexture(), transparent: true, depthWrite: false,
    blending: T.AdditiveBlending, opacity: 0
  });
  var ring = new T.Mesh(new T.PlaneGeometry(PAD_SIZE, PAD_SIZE), rgMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.renderOrder = 6;
  ring.visible = false;
  grp.add(ring);
  this._padRing = ring;

  var dust = buildDust(C);
  dust.pts.visible = false;
  dust.pts.renderOrder = 5;
  grp.add(dust.pts);
  this._dust = dust;

  /* Крошка от удара и бегущие огни обода */
  var deb = buildDebris(C);
  if (deb.n) { deb.pts.renderOrder = 6; grp.add(deb.pts); this._deb = deb; }
  var lamps = buildLamps(C);
  lamps.pts.renderOrder = 6;
  grp.add(lamps.pts);
  this._lamps = lamps;

  this.scene.add(grp);
  this._padGrp = grp;
  this._padDisc = disc;
  this._padShadow = shadow;
  this._padBlast = blast;
  return grp;
};

/* Кадр площадки: ставим её под корабль, ведём прозрачности и
   двигаем пыль. Вызывается после layout, когда положение и масштаб
   корабля на этот кадр уже посчитаны. */
Rocket.prototype.groundStep = function (dt) {
  var lk = this.landK || 0;
  var app = this.appK || 0;
  var dk = this.doorK || 0;

  if (lk < 0.02 && !this._padGrp) return;
  var grp = this.ground();

  /* Площадка появляется на заходе и уходит вместе с посадкой.
     На подходе к борту и на открытии люка она гаснет: мы уже
     смотрим в проём, грунт под ногами кадру только мешает. */
  var vis = (lk - 0.30) / 0.45;
  vis = vis < 0 ? 0 : vis > 1 ? 1 : vis;
  vis = vis * vis * (3 - 2 * vis);
  vis *= 1 - Math.min(1, app * 1.25);
  vis *= 1 - Math.min(1, dk * 1.6);

  grp.visible = vis > 0.004;
  if (!grp.visible) {
    if (this._dust && this._dust.live) this.dustClear();
    if (this._deb && this._deb.live) this.debrisClear();
    return;
  }

  var sc = this.pivot.scale.x || 1;
  var at = this._padAt;
  if (!at) { grp.visible = false; return; }
  /* По высоте площадка стоит там, где грунт, и никуда не движется -
     корабль снижается НА неё. По горизонтали она подтягивается под
     корабль тем же ходом посадки: так она гарантированно оказывается
     под опорами на любой вёрстке, а к касанию совпадает с точкой
     касания точь-в-точь. */
  var lx = lk * lk;
  grp.position.set(
    this.pivot.position.x + (at.x - this.pivot.position.x) * lx,
    at.y + PAD_Y * sc,
    this.pivot.position.z + (at.z - this.pivot.position.z) * lx
  );
  grp.scale.setScalar(sc);

  var burn = this._burn || 0;
  this._padDisc.material.opacity = vis * 0.92;
  /* Грунт вокруг уходит последним: без него площадка снова висит в
     пустоте, поэтому снимаем его только на самой глубокой ступени */
  if (this._padSoil) {
    this._padSoil.visible = degradeStep < 3;
    this._padSoil.material.opacity = vis * 0.85;
  }
  if (this._padKerb) this._padKerb.material.opacity = vis * 0.95;

  /* Просвет от опор до настила, в единицах корабля. По нему теперь
     живёт вся тень: не по доле посадки, а по РЕАЛЬНОЙ высоте.
     Разница видна сразу - на подлёте пятно широкое и еле заметное,
     у самого грунта оно сжимается и наливается чернотой. Так глаз и
     читает высоту: по тени, а не по положению корпуса в кадре. */
  var gapUp = (this.pivot.position.y - at.y) / sc;
  if (gapUp < 0) gapUp = 0;
  var high = gapUp / 4.6;                       /* 0 - на грунте, 1 - на зависании */
  if (high > 1) high = 1;

  if (this._padShadow) {
    /* Плотность и сборка тени идут от просвета: чем ближе, тем темнее
       и меньше. Пар, осевший на площадку, её разбавляет - сквозь
       белый слой тень читается слабее. Доля осевших частиц уже
       посчитана на шаге пара, здесь она стоит одного умножения. */
    var so = vis * (0.30 + (1 - high) * 0.72);
    var stg = this._steamGnd || 0;
    if (stg > 0) so *= 1 - Math.min(0.45, stg * 2.2);
    this._padShadow.material.opacity = so;
    /* Тень не лежит ровно под кораблём: ключевой свет стоит справа и
       сверху, значит пятно обязано уйти влево и к зрителю, да ещё и
       вытянуться вдоль луча. Симметричное пятно под осью читается
       прожогом от сопла, а не тенью, - именно поэтому его и не было
       видно. Смещение растёт с высотой: чем выше корабль, тем дальше
       уезжает его тень. */
    var sh = 1.02 + high * 1.20 + burn * 0.10;
    this._padShadow.scale.set(sh * 1.22, sh * 0.96, 1);
    this._padShadow.position.x = -(0.80 + high * 1.5);
    this._padShadow.position.z = 0.12 + high * 0.8;
  }

  /* Тени опор: каждая стоит ровно там, где тарелка, и сжимается
     вместе с приближением ноги к настилу */
  if (this._footSh && degradeStep < 2) {
    this._footSh.visible = true;
    var fk = this.gearK || 0;
    var fr = (GEAR_HIP_Z + (GEAR_UP + GEAR_LO * fk) * Math.sin(GEAR_STOW + (GEAR_OPEN - GEAR_STOW) * fk));
    var fsz = (0.62 + high * 0.85) * (0.35 + fk * 0.65);
    var frot = this.craft ? this.craft.rotation.y : 0;
    for (var fi = 0; fi < 3; fi++) {
      var fa = (fi / 3) * Math.PI * 2 + Math.PI / 3 + frot;
      /* Тот же снос по лучу, что и у общей тени: иначе три пятна
         сидят строго под тарелками и читаются нарисованными метками */
      this._footP.set(Math.sin(fa) * fr - 0.20 - high * 0.5, 0.004,
        Math.cos(fa) * fr + 0.14 + high * 0.3);
      this._footS.set(fsz, fsz, 1);
      this._footM.compose(this._footP, this._footQ, this._footS);
      this._footSh.setMatrixAt(fi, this._footM);
    }
    this._footSh.instanceMatrix.needsUpdate = true;
    this._footSh.material.opacity = vis * fk * (0.22 + (1 - high) * 0.55);
  } else if (this._footSh) this._footSh.visible = false;

  /* Огни обода бегут по кругу. Пока корабль заходит, бегут быстро -
     площадка «принимает»; после касания успокаиваются до ровного
     дежурного мигания. */
  if (this._lamps && degradeStep < 2) {
    this._lamps.pts.visible = true;
    var L = this._lamps;
    var lt = this.time * (this._touched ? 1.7 : 3.4);
    for (var li = 0; li < L.n; li++) {
      var ph = lt - li / L.n * 2.6;
      var pulse = Math.pow(Math.max(0, Math.sin(ph * 2.2)), 6);
      var lum = vis * (0.22 + pulse * 1.05) * (0.5 + lk * 0.5);
      L.col[li * 3]     = lum * 0.55;
      L.col[li * 3 + 1] = lum * 0.92;
      L.col[li * 3 + 2] = lum;
      L.siz[li] = 0.30 + pulse * 0.34;
    }
    L.uni.uScale.value = sc;
    L.uni.uPx.value = (this.ch()) * this.C.dpr /
      (2 * Math.tan((this.cam.fov * Math.PI / 180) / 2));
    L.geo.attributes.aCol.needsUpdate = true;
    L.geo.attributes.aSize.needsUpdate = true;
  } else if (this._lamps) this._lamps.pts.visible = false;
  /* Засвет: пик на тормозном импульсе, потом короткое послесвечение
     от остывающего сопла */
  var glow = burn * 0.85 + Math.max(0, this._shock || 0) * 0.35 + lk * 0.10;
  this._padBlast.material.opacity = Math.min(1, glow) * vis;
  var bs = 0.72 + burn * 0.62;
  this._padBlast.scale.set(bs, bs, 1);

  /* Ударная волна: живёт свои три четверти секунды после касания и
     гаснет. Ведём её тем же счётчиком, что и просадку стойки, -
     удар один, и всё, что от него, обязано идти одним движением. */
  var rt = this._touched ? this._shockT : 9;
  if (rt < 0.75) {
    var rk = rt / 0.75;
    this._padRing.visible = true;
    this._padRing.material.opacity = (1 - rk) * (1 - rk) * 0.95 * vis;
    var rs = 0.16 + rk * 0.90;
    this._padRing.scale.set(rs, rs, 1);
  } else if (this._padRing.visible) {
    this._padRing.visible = false;
  }

  /* Сопло раздувает грунт ещё до касания: пока идёт тормозной
     импульс, из-под ракеты тянет пылью. Так удар не возникает из
     ничего - площадка уже живёт к моменту, когда опоры её коснутся. */
  if (burn > 0.22 && lk < 0.88) {
    this._blowT = (this._blowT || 0) + dt;
    var step = this.C.weak ? 0.10 : 0.045;
    while (this._blowT > step) {
      this._blowT -= step;
      this.dustEmit(this.C.weak ? 1 : 2, 0.30 + burn * 0.45);
    }
  } else this._blowT = 0;

  this.dustStep(dt, sc, glow);
  this.debrisStep(dt, sc, glow);
};

/* ── Крошка от удара ──────────────────────────────────────────
   Камни выбивает из-под самих тарелок, а не из-под сопла: удар
   приходится туда. Летят по баллистике, один раз отскакивают и
   гаснут - вся жизнь укладывается в секунду, ровно в тот отрезок,
   когда глаз ещё ищет подтверждение, что корабль ударился о твердь. */
Rocket.prototype.debrisEmit = function () {
  if (document.documentElement.classList.contains("rc-reduced")) return;
  if (degradeStep >= 2) return;            /* кадры не тянут - крошки нет */
  var D = this._deb;
  if (!D || !D.n) return;
  var th = GEAR_OPEN, fr = GEAR_HIP_Z + (GEAR_UP + GEAR_LO) * Math.sin(th);
  for (var i = 0; i < D.n; i++) {
    /* Раскидываем поровну между тремя опорами, вокруг каждой - веер */
    var leg = i % 3;
    var base = (leg / 3) * Math.PI * 2 + Math.PI / 3;
    var a = base + (Math.random() - 0.5) * 1.5;
    var rr = fr * (0.80 + Math.random() * 0.40);
    var j = i * 3;
    D.pos[j]     = Math.sin(a) * rr;
    D.pos[j + 1] = 0.03;
    D.pos[j + 2] = Math.cos(a) * rr;
    /* Разлёт наружу от оси плюс заметная вертикальная составляющая */
    var out = Math.random() < 0.22 ? -0.5 : 1;    /* часть камешков летит внутрь */
    var sp = (1.6 + Math.random() * 3.4) * out;
    D.vel[j]     = Math.sin(a) * sp + (Math.random() - 0.5) * 0.8;
    D.vel[j + 1] = 1.6 + Math.random() * 3.6;
    D.vel[j + 2] = Math.cos(a) * sp + (Math.random() - 0.5) * 0.8;
    D.siz[i] = 0.035 + Math.random() * 0.055;
    D.max[i] = 0.55 + Math.random() * 0.75;
    D.life[i] = D.max[i];
  }
  D.live = 1;
  D.pts.visible = true;
  D.geo.attributes.aSize.needsUpdate = true;
};

Rocket.prototype.debrisClear = function () {
  var D = this._deb;
  if (!D) return;
  D.live = 0;
  D.pts.visible = false;
  for (var i = 0; i < D.n; i++) D.life[i] = 0;
};

Rocket.prototype.debrisStep = function (dt, scale, glow) {
  var D = this._deb;
  if (!D || !D.live) return;
  var alive = 0;
  for (var i = 0; i < D.n; i++) {
    if (D.life[i] <= 0) continue;
    alive++;
    D.life[i] -= dt;
    var j = i * 3;
    /* Камень воздухом почти не тормозится - только тяготением */
    D.vel[j + 1] -= dt * 9.2;
    D.pos[j] += D.vel[j] * dt;
    D.pos[j + 1] += D.vel[j + 1] * dt;
    D.pos[j + 2] += D.vel[j + 2] * dt;
    if (D.pos[j + 1] < 0.02) {
      /* Отскок с потерей: второй прыжок ниже, третий уже стелется */
      D.pos[j + 1] = 0.02;
      D.vel[j + 1] = -D.vel[j + 1] * 0.34;
      D.vel[j] *= 0.62;
      D.vel[j + 2] *= 0.62;
      if (D.vel[j + 1] < 0.25) D.vel[j + 1] = 0;
    }
    var a = D.life[i] / D.max[i];
    if (a < 0) a = 0;
    /* Искра горячая у грунта и быстро остывает в полёте */
    var lum = a * a * (0.55 + glow * 1.1);
    D.col[j]     = lum * 1.00;
    D.col[j + 1] = lum * (0.72 + a * 0.20);
    D.col[j + 2] = lum * (0.46 + a * 0.34);
  }
  if (!alive) { this.debrisClear(); return; }
  D.uni.uScale.value = scale;
  D.uni.uPx.value = (this.ch()) * this.C.dpr /
    (2 * Math.tan((this.cam.fov * Math.PI / 180) / 2));
  D.geo.attributes.position.needsUpdate = true;
  D.geo.attributes.aCol.needsUpdate = true;
};

/* Шаг пыли. Кольцо расходится, тормозится о воздух, оседает и
   гаснет. Подсветка снизу - не источник света, а цвет: чем ниже
   частица и чем ярче факел, тем она теплее и светлее. Так «пыль
   подсвечена факелом» стоит ноль дополнительных вычислений. */
Rocket.prototype.dustStep = function (dt, scale, glow) {
  var D = this._dust;
  if (!D || !D.live) return;
  var alive = 0;
  for (var i = 0; i < D.n; i++) {
    if (D.life[i] <= 0) continue;
    alive++;
    D.life[i] -= dt;
    var j = i * 3;
    /* Сопротивление воздуха: кольцо резко стартует и вязко замирает */
    var drag = Math.exp(-dt * 1.45);
    D.vel[j] *= drag;
    D.vel[j + 2] *= drag;
    D.vel[j + 1] = D.vel[j + 1] * drag - dt * 0.85;   /* и оседает */
    D.pos[j] += D.vel[j] * dt;
    D.pos[j + 1] += D.vel[j + 1] * dt;
    D.pos[j + 2] += D.vel[j + 2] * dt;
    /* Ниже грунта пыли нет: она стелется по площадке */
    if (D.pos[j + 1] < 0.02) { D.pos[j + 1] = 0.02; D.vel[j + 1] *= -0.18; }

    var a = D.life[i] / D.max[i];
    if (a < 0) a = 0;
    a = a * a * (0.55 + a * 0.45);
    /* Подсветка снизу: у грунта частица тёплая и яркая, выше -
       холодная и тусклая, как и должен светить факел */
    var low = Math.exp(-D.pos[j + 1] * 1.15);
    /* Яркость сбавлена вдвое против прежней: две сотни аддитивных
       спрайтов в одной точке выбеливали площадку в молоко, и вместо
       пыли получался пар. Цвет у грунта тёплый и землистый - её
       подсвечивает факел, а не лампа дневного света. */
    var lum = a * (0.10 + low * 0.30) * (0.7 + glow * 1.1);
    D.col[j]     = lum * (0.64 + low * 0.36);
    D.col[j + 1] = lum * (0.62 + low * 0.20);
    D.col[j + 2] = lum * (0.70 - low * 0.10);
    D.siz[i] += dt * 0.13;                  /* клуб расходится и растёт */
  }
  if (!alive) { this.dustClear(); return; }
  D.uni.uScale.value = scale;
  /* Мировой размер в пиксели устройства: высота холста, делённая на
     мировую высоту кадра на единичной глубине */
  D.uni.uPx.value = (this.ch()) * this.C.dpr /
    (2 * Math.tan((this.cam.fov * Math.PI / 180) / 2));
  D.geo.attributes.position.needsUpdate = true;
  D.geo.attributes.aCol.needsUpdate = true;
  D.geo.attributes.aSize.needsUpdate = true;
};

/* ── Пар разгерметизации ──────────────────────────────────────
   Систему собираем по требованию, как и площадку: до люка долистает
   не каждый, а холст текстуры и семь буферов на две сотни частиц
   зря занимать память незачем.

   Живёт пар внутри craft, а не в сцене: корпус на подходе едет к
   камере и вырастает в разы, и пар обязан ехать вместе с ним - он
   привязан к щели, а не к точке мира. Заодно даром достаётся
   поворот корабля люком к зрителю. */
Rocket.prototype.steam = function () {
  if (this._steam) return this._steam;
  var S = buildSteam(this.C);
  this.craft.add(S.pts);
  this._steam = S;
  return S;
};

/* Выпуск частиц. kind 0 - струя из стыка (бьёт вбок и вниз),
   kind 1 - дымка, которая тянется из открытого проёма, kind 2 -
   низкий слой, расстилающийся по площадке. */
Rocket.prototype.steamEmit = function (count, kind) {
  if (document.documentElement.classList.contains("rc-reduced")) return;
  var d = this.rocket.door;
  if (!d) return;
  var S = this.steam();
  var R = d.rad, HH = d.hh, Y = d.y;
  var gy = PAD_Y + 0.03;
  var made = 0;
  for (var i = 0; i < S.n && made < count; i++) {
    if (S.life[i] > 0) continue;             /* занятую частицу не трогаем */
    made++;
    var j = i * 3;
    if (kind === 3) {
      /* Посадочный выброс. Клиент описал этот кадр так: «тень и пар и
         объём - всё падает от ракеты». В акте посадки площадка с
         опорами и тенью как раз в кадре, поэтому здесь пар идёт не
         из люка, а из-под корабля: кольцо расходится от оси наружу
         во все стороны и стелется по грунту.

         Отличие от слоя у люка (kind 2) в двух вещах: сектор полный,
         а не со стороны двери, и стартовая скорость вдвое выше -
         газ выбивает из-под сопла, а не выдыхается из щели. */
      var pa = Math.random() * 6.283;
      var pr = 0.20 + Math.random() * 0.55;
      S.pos[j]     = Math.sin(pa) * pr;
      S.pos[j + 1] = gy + Math.random() * 0.05;
      S.pos[j + 2] = Math.cos(pa) * pr;
      /* Медленнее, чем казалось нужным: на первой сборке клубы
         разлетались за габарит площадки быстрее, чем глаз успевал их
         заметить, и касание снова читалось сухим. Газ должен ползти
         по настилу, а не выстреливать. */
      var ps = 0.85 + Math.random() * 1.05;
      S.vel[j]     = Math.sin(pa) * ps;
      S.vel[j + 1] = 0.05 + Math.random() * 0.12;   /* чуть вверх: клуб вспухает */
      S.vel[j + 2] = Math.cos(pa) * ps;
      S.siz[i]     = 0.19 + Math.random() * 0.26;
      /* Плотнее пыли: пыль землистая и притушена, чтобы не выбелить
         площадку, а пар обязан читаться белым клубом - иначе его в
         кадре попросту нет */
      S.amp[i]     = 0.42 + Math.random() * 0.3;
      S.max[i]     = 2.6 + Math.random() * 2.2;
      S.curl[i]    = (Math.random() - 0.5) * 0.3;
      S.life[i] = S.max[i];
      S.alp[i]  = 0;
      S.gnd[i]  = 1;
      S.rot[i]  = Math.random() * 6.283;
      S.spin[i] = (Math.random() - 0.5) * 0.6;
      continue;
    }
    if (kind === 2) {
      /* Слой у грунта. Струя из люка доходит до площадки за полторы
         секунды и к этому времени успевает выцвести, поэтому нижний
         слой рождается прямо на грунте - так же, как это делают в
         кино. Смотрится это тем самым «пар дошёл и расстелился», а
         стоит ноль лишних частиц в полёте. */
      var ga = (Math.random() - 0.5) * 2.4;   /* сектор со стороны люка */
      var gr = 0.30 + Math.random() * 0.95;
      S.pos[j]     = Math.sin(ga) * gr;
      S.pos[j + 1] = gy;
      S.pos[j + 2] = Math.cos(ga) * gr;
      var gs = 0.45 + Math.random() * 0.75;
      S.vel[j]     = Math.sin(ga) * gs;
      S.vel[j + 1] = 0;
      S.vel[j + 2] = Math.cos(ga) * gs;
      S.siz[i]     = 0.12 + Math.random() * 0.14;
      S.amp[i]     = 0.20 + Math.random() * 0.20;
      S.max[i]     = 3.0 + Math.random() * 2.0;
      S.curl[i]    = 0;
      S.life[i] = S.max[i];
      S.alp[i]  = 0;
      S.gnd[i]  = 1;
      S.rot[i]  = Math.random() * 6.283;
      S.spin[i] = (Math.random() - 0.5) * 0.5;
      continue;
    }
    if (kind) {
      /* Дымка: медленно вытекает из самого проёма и стелется вниз.
         Она держит переход, пока створки стоят открытыми, - без неё
         пар выглядит одним хлопком и сцена снова становится сухой. */
      S.pos[j]     = (Math.random() - 0.5) * R * 1.1;
      S.pos[j + 1] = Y + (Math.random() - 0.5) * HH * 0.8;
      S.pos[j + 2] = R * (0.55 + Math.random() * 0.55);
      S.vel[j]     = (Math.random() - 0.5) * 0.28;
      S.vel[j + 1] = -0.16 - Math.random() * 0.22;
      S.vel[j + 2] = 0.06 + Math.random() * 0.16;
      S.siz[i]     = 0.10 + Math.random() * 0.12;
      S.amp[i]     = 0.12 + Math.random() * 0.14;
      S.curl[i]    = 0;
      S.max[i]     = 2.4 + Math.random() * 1.6;
    } else {
      /* Струя. Стороны чередуем, иначе выброс сбивается в один бок.
         Бьёт по всей высоте стыка: пробовали два клапана, верхний и
         нижний, - на стенде выброс распался на два отдельных облака с
         пустотой между ними, и вместо занавеса из щели получились две
         кляксы. Уплотнитель травит по всей длине притвора, так это и
         выглядит. */
      var side = this._steamSide = -(this._steamSide || 1);
      S.pos[j]     = side * (0.012 + Math.random() * 0.05);
      S.pos[j + 1] = Y + (Math.random() - 0.5) * HH * 0.92;
      /* Ставим клуб СНАРУЖИ створок: изнутри его съел бы тест глубины */
      S.pos[j + 2] = R * (1.02 + Math.random() * 0.06);
      /* Скорости считаны под кадр, в котором это видно, а не на глаз.
         К открытию корабль вырос в шесть раз, и в кадр помещается
         полоса борта шириной около трёх его радиусов. Сопротивление
         гасит частицу на пути v/1.9, поэтому разброс 0.3-1.65 даёт
         клубы от самой щели до кромки борта и чуть дальше - там, где
         белый пар виден на тёмном небе. Одинаковая скорость собирала
         выброс в одно кольцо: оно уходило от корабля единым фронтом
         и оставляло стык голым (проверено стендом). */
      var sp = 0.30 + Math.random() * 1.35;
      S.vel[j]     = side * sp;
      S.vel[j + 1] = -(0.12 + Math.random() * 0.5);
      /* К зрителю выпускаем осторожно. Корабль в этот момент стоит в
         четырнадцати единицах от камеры, а масштаб его - шестикратный:
         полшага «на камеру» в его системе координат - это три единицы
         мира, и частица раздувается вдвое, разъезжаясь по всему кадру.
         Замерено дампом координат на стенде. */
      S.vel[j + 2] = 0.08 + Math.random() * 0.22;
      S.siz[i]     = 0.085 + Math.random() * 0.10;
      S.amp[i]     = 0.50 + Math.random() * 0.34;
      S.max[i]     = 1.3 + Math.random() * 0.8;
      /* Завихрение: струя не летит по прямой, её сворачивает в валик.
         Знак берём от стороны, поэтому оба клуба заворачиваются вверх
         и наружу, как настоящий вихрь у сопла. Стоит четыре умножения
         на частицу, а движение из «полетели точки» превращается в
         «пар клубится». */
      S.curl[i]    = side * (0.22 + Math.random() * 0.4);
    }
    S.life[i] = S.max[i];
    S.alp[i]  = 0;
    S.gnd[i]  = 0;
    S.rot[i]  = Math.random() * 6.283;
    S.spin[i] = (Math.random() - 0.5) * 1.3;
  }
  if (!made) return;
  S.live = 1;
  S.pts.visible = true;
};

/* Обратная прокрутка: пар обязан пропасть вместе с дверью, а не
   доживать свои две секунды у закрытого люка */
Rocket.prototype.steamClear = function () {
  var S = this._steam;
  if (!S) return;
  S.live = 0;
  S.pts.visible = false;
  for (var i = 0; i < S.n; i++) { S.life[i] = 0; S.alp[i] = 0; S.gnd[i] = 0; }
  this._steamAlive = 0;
  this._steamGnd = 0;
  /* Часы выброса переводим за все его окна, а не в ноль: чистка
     случается и на живой открытой двери, когда последняя частица
     дожила своё, - с нулём выброс пошёл бы по второму кругу */
  this._steamT = 99;
  this._gndRest = 0;
  this._steamRest = 0;
};

/* Шаг пара. Створки тронулись - и сброс давления пошёл СВОИМ временем,
   а не временем колеса. Это принципиально: разгерметизация - событие, а
   не анимация на прокрутке. Раньше выброс шёл долей открытия, и стоило
   остановить палец на середине окна, как струя замирала в воздухе.
   Теперь окно 0.05 только взводит выброс, дальше он отыгрывает сам;
   обратная прокрутка при этом честно уводит пар вместе с дверью, а
   закрытая дверь взводит его заново. */
Rocket.prototype.steamStep = function (dt) {
  var dk = this.doorK || 0;
  var S = this._steam;
  if (!S && dk < 0.05) return;                  /* дверь не трогалась - и системы нет */

  if (dk < 0.03) this._steamOn = 0;             /* закрылась - взводим заново */
  if (dk >= 0.05 && !this._steamOn) {
    this._steamOn = 1;
    this._steamT = 0;
    this._steamRest = 0;
    this._gndRest = 0;
    this.hiss();                                /* шипение в момент срыва */
  }
  if (this._steamOn) {
    var t0 = this._steamT || 0;
    this._steamT = t0 + dt;
    /* Струя бьёт две с половиной секунды: столько и длится настоящий
       сброс давления в притворе, дальше остаётся только дымка */
    var jet = 2.4;
    var j0 = t0 < jet ? t0 : jet, j1 = this._steamT < jet ? this._steamT : jet;
    if (j1 > j0) {
      /* Подача струи: резкий хлопок плюс ровный остаток. Отсек
         стравливает давление не мгновенно - сперва выбивает пробку,
         потом ещё пару секунд шипит на убывающем напоре, и клуб всё
         это время подпитывается от щели. Одним хлопком выброс
         отрывался от борта и улетал комом, оставляя стык голым -
         это первое, что видно на стенде.

         Считаем накопленным числом: N(t) = A(1-e^(-t/0.85)) + B*t,
         за кадр берём приращение. Такой счёт не зависит ни от частоты
         кадров, ни от скорости колеса - на просевшем кадре выйдет
         ровно столько же частиц, сколько на быстром. */
      var A = this.C.weak ? 40 : 85, B = this.C.weak ? 16 : 34;
      this._steamRest = (this._steamRest || 0) +
        A * (Math.exp(-j0 / 0.85) - Math.exp(-j1 / 0.85)) + B * (j1 - j0);
      var take = Math.floor(this._steamRest);
      if (take > 0) { this._steamRest -= take; this.steamEmit(take, 0); }
    }
    /* Слой у грунта выкладываем с задержкой: пар должен сперва дойти
       до площадки. Полсекунды - ровно столько летит струя от люка до
       опор, дальше он полторы секунды растекается. */
    if (this._steamT > 0.55 && t0 < 2.1) {
      var g0 = t0 < 0.55 ? 0.55 : t0, g1 = this._steamT < 2.1 ? this._steamT : 2.1;
      if (g1 > g0) {
        this._gndRest = (this._gndRest || 0) + (g1 - g0) / 1.55 * (this.C.weak ? 8 : 17);
        var gtake = Math.floor(this._gndRest);
        if (gtake > 0) { this._gndRest -= gtake; this.steamEmit(gtake, 2); }
      }
    }
    S = this._steam;
  }
  /* Дымка из проёма идёт, пока дверь открыта. На слабом устройстве её
     нет: там дорога каждая полупрозрачная точка. */
  if (!this.C.weak && dk > 0.12 && dk < 0.58 && S) {
    this._hazeT = (this._hazeT || 0) + dt;
    while (this._hazeT > 0.11) { this._hazeT -= 0.11; this.steamEmit(1, 1); }
  } else this._hazeT = 0;

  if (!S || !S.live) return;
  /* Чистка по закрытой двери справедлива только для пара из притвора.
     Посадочный выброс идёт из-под опор при наглухо закрытом люке, и
     это условие стирало его в тот же кадр, в котором он родился:
     клуб не успевал появиться ни разу. */
  if (dk < 0.02 && !this._padSteam) { this.steamClear(); return; }

  var d = this.rocket.door;
  /* Тёплый свет лампы проёма - единственное, что делает пар объёмным.
     Считаем его расстоянием до проёма: точки не принимают настоящих
     источников света, а лишний источник в сцене стоил бы кадра. */
  var lit = d ? Math.min(1, d.lamp.intensity / 2.6) : 0;
  var dy = d ? d.y : 0.10, dz = d ? d.rad : 0.65;
  /* Уровень грунта в системе корабля: там же, где стоят тарелки опор */
  var gy = PAD_Y + 0.03;
  /* Закрывающаяся дверь уводит пар за собой, а не гасит его рывком.
     Порог низкий: на открытии выброс обязан быть в полную силу с
     первого кадра, гаснуть он будет только на обратной прокрутке */
  /* Прозрачность ведёт дверь, но у посадочного выброса своей двери
     нет - он виден в полную силу, пока корабль стоит на площадке */
  var vis = Math.max(Math.min(1, dk * 14), this._padSteam ? 1 : 0);
  /* Пар отрабатывает своё в начале открытия и уходит до того, как
     кадр займёт проём. Владелец сказал прямо: «двери открываются, и
     там уже салон видно» - а видно его было плохо именно из-за
     клуба, висевшего перед самым люком. Сброс давления при этом
     остаётся: он и должен быть в первой половине хода створок. */
  if (!this._padSteam) {
    var clearK = (dk - 0.42) / 0.34;
    if (clearK > 0) vis *= 1 - (clearK > 1 ? 1 : clearK);
  }
  var alive = 0, onGnd = 0;

  for (var i = 0; i < S.n; i++) {
    if (S.life[i] <= 0) continue;
    S.life[i] -= dt;
    /* Дожившую частицу гасим явно: буфер прозрачностей общий, и
       брошенное в нём значение продолжало бы рисовать застывший клуб */
    if (S.life[i] <= 0) { S.life[i] = 0; S.alp[i] = 0; continue; }
    alive++;
    var j = i * 3;
    var lo = S.gnd[i];
    /* Струя вязнет в воздухе, слой у грунта - сильнее */
    var drag = Math.exp(-dt * (lo ? 2.6 : 1.9));
    S.vel[j] *= drag;
    S.vel[j + 2] *= drag;
    /* Пар из отсека холоднее воздуха и потому оседает, а не всплывает.
       Сопротивление по вертикали слабее, чем вбок: струя гасится о
       воздух, а падение оно только замедляет */
    S.vel[j + 1] = lo ? 0 : S.vel[j + 1] * Math.exp(-dt * 0.9) - dt * 0.7;
    /* Вихрь: поворачиваем вектор скорости в плоскости кадра. Пока
       струя быстрая, она заворачивается вверх и наружу; когда
       сопротивление её съело, поворачивать уже нечего, и клуб
       спокойно оседает. */
    if (S.curl[i]) {
      var cw = S.curl[i] * dt;
      var vx = S.vel[j], vy = S.vel[j + 1];
      S.vel[j] = vx - vy * cw;
      S.vel[j + 1] = vy + vx * cw;
    }
    S.pos[j] += S.vel[j] * dt;
    S.pos[j + 1] += S.vel[j + 1] * dt;
    S.pos[j + 2] += S.vel[j + 2] * dt;

    if (!lo && S.pos[j + 1] <= gy) {
      /* Дошёл до площадки. Пар не проваливается сквозь грунт и не
         отскакивает - он растекается по нему низким слоем. Это самая
         узнаваемая деталь настоящего пуска, ради неё всё и затевалось:
         упершись в землю, клуб разом раздаётся вширь и ползёт от
         корабля. */
      S.gnd[i] = 1; lo = 1;
      S.pos[j + 1] = gy;
      S.vel[j + 1] = 0;
      S.vel[j] *= 1.7;
      S.vel[j + 2] *= 1.7;
      S.siz[i] *= 1.5;
    }
    if (lo) { S.pos[j + 1] = gy; onGnd++; }

    /* Клуб медленно проворачивается: две сотни одинаковых спрайтов
       в одной ориентации выдают себя мгновенно */
    S.rot[i] += S.spin[i] * dt;
    /* Клуб всё время расходится; у грунта - вдвое быстрее, ему есть куда */
    S.siz[i] += dt * (lo ? 0.09 : 0.05);

    var a = S.life[i] / S.max[i];
    if (a < 0) a = 0;
    /* Появление за одну шестую секунды и мягкий уход: пар не возникает
       готовым клубом и не пропадает разом */
    var up = (S.max[i] - S.life[i]) * 6;
    if (up > 1) up = 1;
    S.alp[i] = S.amp[i] * up * a * (0.45 + a * 0.55) * vis;

    var wx = S.pos[j], wy = S.pos[j + 1] - dy, wz = S.pos[j + 2] - dz;
    var warm = lit * Math.exp(-(wx * wx + wy * wy + wz * wz) * 0.9);
    /* База - не белая, а серо-голубая. Белый пар на белой обшивке не
       виден вовсе: обшивка сама светлее его. Серо-голубой клуб на
       борту читается тенью и объёмом, а на тёмном небе за бортом всё
       равно остаётся ярко-белым - фон там втрое темнее. Тёплым его
       делает только лампа проёма, и только вблизи неё. Слой у грунта
       вдобавок лежит в тени корабля, поэтому ещё темнее. */
    var sh = lo ? 0.78 : 1;
    S.col[j]     = (0.70 + warm * 0.30) * sh;
    S.col[j + 1] = (0.76 + warm * 0.12) * sh;
    S.col[j + 2] = (0.88 - warm * 0.16) * sh;
  }

  if (!alive) { this.steamClear(); return; }
  this._steamAlive = alive;
  /* Доля осевшего пара: по ней на шаге площадки гаснет тень */
  this._steamGnd = onGnd / S.n;
  S.uni.uScale.value = this.pivot.scale.x || 1;
  S.uni.uPx.value = (this.ch()) * this.C.dpr /
    (2 * Math.tan((this.cam.fov * Math.PI / 180) / 2));
  S.geo.attributes.position.needsUpdate = true;
  S.geo.attributes.aCol.needsUpdate = true;
  S.geo.attributes.aSize.needsUpdate = true;
  S.geo.attributes.aAlpha.needsUpdate = true;
  S.geo.attributes.aRot.needsUpdate = true;
};

/* Шипение сброса давления. Отдельного звука на это в rc-sound нет, а
   править чужой файл нельзя, поэтому синтезируем на его же контексте
   и через его же master: кнопка звука и общая громкость сайта
   продолжают этим шипением управлять. Всё в try/catch - звук здесь
   украшение, и его отсутствие не имеет права ронять кадр. */
Rocket.prototype.hiss = function () {
  var S = g.RC_SOUND;
  if (!S) return;
  try {
    if (typeof S.hiss === "function") { S.hiss(); return; }
    if (!S.on || !S.ready || !S.ctx || !S.master) return;
    var ctx = S.ctx, t = ctx.currentTime;
    if (this._hissAt && t - this._hissAt < 1.5) return;   /* дребезг колеса */
    this._hissAt = t;
    var n = Math.floor(ctx.sampleRate * 1.1);
    var b = ctx.createBuffer(1, n, ctx.sampleRate), c = b.getChannelData(0);
    /* Резкий фронт и длинный хвост - так и звучит стравливание */
    for (var i = 0; i < n; i++) {
      var k = i / n;
      c[i] = (Math.random() * 2 - 1) * Math.min(1, k * 30) * Math.pow(1 - k, 1.7);
    }
    var src = ctx.createBufferSource(); src.buffer = b;
    var f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = 0.8;
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 1);
    var gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.11, t + 0.06);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    src.connect(f); f.connect(gn); gn.connect(S.master);
    src.start(t);
  } catch (e) {}
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
  } else if (sc && sc.act === "cabin" && this.appK > 0.12) {
    /* Салон: мы у борта, корпус держится во весь кадр, пока дверь
       открывается. Условие по appK отличает честный проход от
       прыжка по якорю сразу в салон.

       Держим единицу весь акт, а не первую его треть. Раньше на
       середине салона цель падала в ноль, и при обратной прокрутке
       подход прыгал с 0.01 до 0.97 за один шаг - ракета выскакивала
       из ниоткуда уже наклонённой. Теперь назад мы выходим тем же
       движением, каким входили. */
    goal = 1;
  }
  /* Сглаживание экспонентой: и рывок колеса, и смена акта дают
     плавный ход масштаба, без телепортов. Форма та же, что у витка:
     на просевших кадрах линейное сглаживание прыгает. */
  /* Скорость сглаживания адаптивная: чем сильнее доля отстала от
     цели (резкое колесо, пролистывание пальцем), тем быстрее догон.
     Иначе быстрый скролл проскакивал подход, и дверь не успевала
     показаться вовсе. */
  /* Ускоряем догон только вперёд. На отходе назад та же формула
     давала рывок: цель падала разом, и корабль отскакивал от борта
     за один кадр. Назад отходим ровно, тем же движением. */
  var gap = Math.abs(goal - this.appK);
  var rate = goal > this.appK ? (4.2 + gap * 16) : 3.4;
  var s = 1 - Math.exp(-(dt || 0.016) * rate);
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
      /* Створки ведёт сам подход, а не доля акта. Долю акта приёмка
         поймала на лжи: акт «проход к трапу» уступает кадр соседу
         около 0.70, поэтому дверь доходила максимум до 0.42 и порог
         входа (0.58) не брался никогда. Событие «мы в проёме» не
         летело, вспышка света не показывалась, и подмена корабля на
         рубку шла голой склейкой - шесть щелчков колеса кадр был
         попросту пуст.

         Подход же доходит до единицы честно: он и есть «мы дошли
         вплотную». Дверь начинает идти с трёх четвертей подхода. */
      /* Ход створок ведёт положение салона на странице, а не доля
         подхода. Подход последнюю четверть проходит за полтораста
         пикселей прокрутки, и весь эпизод входа - щель, две
         голограммы в ней, их чтение и растворение - укладывался в
         пару щелчков колеса: владелец видел не открытие двери, а
         мигание. Отрезок же до салона - это честный экран
         прокрутки, и на нём всё успевает произойти.

         Подход при этом остаётся условием: пока корабль не встал
         вплотную, створки не трогаются с места. */
      var relEl = this._relEl;
      if (!relEl || !relEl.isConnected) relEl = this._relEl = document.getElementById("reliability");
      var raw = 0;
      if (relEl) {
        var rTop = BOX(relEl).top;
        var h = this.ch();
        var s0 = h * 1.35, s1 = h * 0.30;
        raw = (s0 - rTop) / (s0 - s1);
      } else {
        raw = (this.appK - 0.72) / 0.26;
      }
      /* Затвор подходом: створки не смеют разъехаться, пока корабль
         ещё идёт к нам */
      raw = Math.min(raw, Math.max(0, (this.appK - 0.62) / 0.22));
      goal = raw < 0 ? 0 : raw > 1 ? 1 : raw;
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
    /* Створки уходят по борту вбок: поворот вокруг оси корабля.
       Знаки поворота были перепутаны, и створки разъезжались НАВСТРЕЧУ
       друг другу: левая уходила на место правой, они лежали на одном
       радиусе и мерцали z-конфликтом, а проём открывался не из
       середины, а с краёв. На стенде это видно сразу - при доле 0.45
       вместо чёрного проёма стоит полосатая каша из двух текстур.
       Теперь левая идёт влево, правая вправо, щель раскрывается от
       стыка - и паром из этой щели есть чему бить. */
    var open = this.doorK * d.half * 2.05;
    d.l.rotation.y = -open;
    d.r.rotation.y = open;
    /* Свет салона разгорается в щели раньше самих створок:
       сначала видно, что там свет, потом уже что там салон */
    var lit = Math.min(1, this.doorK * 2.4);
    d.lamp.intensity = lit * 2.6;
    d.edgeMat.opacity = 0.35 + (1 - this.doorK) * 0.55;
    /* Засвет от лампы в проёме идёт наружу и растёт вместе с
       дверью: к моменту передачи сцены рубке кадр уже залит тёплым
       светом, и подмену физически не видно. Переменную читает
       rc-world.css, слой лежит поверх страницы. */
    /* Засвета на входе больше нет. Владелец сказал прямо: «не должно
       быть какой-то вспышки, сделай бесшовно и кинематографично».
       Вспышка и была тем, что прикрывало подмену сцены, - и она же
       читалась как склейка: кадр вспыхивал, и «вдруг» оказывался
       салон. Теперь подмену прикрывают створки тамбура, которые
       расходятся, открывая уже нарисованный салон (rc-interior).
       Слой засвета оставлен погашенным: им пользуется только этот
       момент, а держать его на нуле дешевле, чем пересобирать. */
    var gEl = this._glowEl;
    if (!gEl || !gEl.isConnected) gEl = this._glowEl = document.querySelector(".rc-hatch-glow");
    if (gEl) V(gEl, "--hatch-glow", "0");
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
     предметом, к которому мы идём.

     То же и на посадке: садящийся корабль с опорами, пылью и
     площадкой - главное событие кадра, а сквозь него читались
     заголовки соседнего раздела. На первый план он выходит уже
     на снижении, а не только у самого борта. */
  var over = this.appK > 0.30 || (this.landK || 0) > 0.45;
  if (over !== this._over) {
    this._over = over;
    document.documentElement.classList.toggle("rc-approach", over);
  }
  /* Долю подхода отдаём в CSS: по ней содержимое раздела уходит из
     кадра корабля, и делает это ровно с той же скоростью, с какой
     корпус растёт. Округляем до сотой - чаще незачем, а лишние
     записи в стиль дороже самой анимации. */
  var appR = Math.round(this.appK * 100) / 100;
  if (appR !== this._appPub) {
    this._appPub = appR;
    /* Долю подхода читают правила ровно двух разделов - «Что входит»
       и «Сценарии». Раньше она писалась на корень документа, и
       браузер на каждое её изменение помечал устаревшим стиль всего
       дерева: замер на телефоне показал, что две трети времени кадра
       уходило именно на такие пересчёты. Пишем адресно. */
    if (!this._appEls) {
      this._appEls = [];
      var ids = ["included", "cases"], q;
      for (q = 0; q < ids.length; q++) {
        var el = document.getElementById(ids[q]);
        if (el) this._appEls.push(el);
      }
      /* Запасной путь: если разметка другая, ведём как раньше */
      if (!this._appEls.length) this._appEls.push(document.documentElement);
    }
    for (var w = 0; w < this._appEls.length; w++) {
      V(this._appEls[w], "--rc-app", String(appR));
    }
  }

/* Порог передачи сцены рубке. Сценарий входа задан владельцем и
     идёт по доле раскрытия люка: до 0.55 в щели проступают две
     голограммы из салона, до 0.85 они читаются, к единице тают
     вместе с наездом (rc-gate). Значит сцену меняем в самом конце,
     когда карточки уже растаяли, а проём накрыл кадр целиком: в
     этот момент и снаружи, и внутри кадр - тёмная труба люка, и
     подмена не видна ничем. Ни вспышки, ни вторых створок для этого
     не нужно. */
  var deep = this.doorK > 0.97 && this.appK > 0.86;
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
    var cW = this.cw();
    var cH = this.ch();
    /* Целимся не в центр корпуса, а в люк: он обязан встать ровно
       посреди кадра, потому что именно в него мы входим. Люк сидит
       выше середины корабля, поэтому корпус смещаем вниз на его
       высоту, пересчитанную в текущий масштаб сцены. */
    this.toWorld(cW * 0.5, cH * 0.5, -0.2, this._appP || (this._appP = new T.Vector3()));
    pos.lerp(this._appP, Math.min(1, app * 1.6));
    var dY = (this.rocket.door ? this.rocket.door.y : 0.1);
    pos.y -= app * dY * (this._sNow || 1);
  }

  /* Пролог фильма: корабль на стартовом столе. Раньше он стоял там,
     куда его выносила кривая маршрута, и на узком экране в кадр
     просто не попадал - фильм начинался без героя, приёмка это и
     поймала. Притягиваем его к точке первого кадра: на телефоне по
     центру чуть ниже середины, на широком экране справа от
     заголовка, чтобы текст остался слева. К концу акта хватка
     отпускает, и корабль уходит на свою траекторию. */
  var scAct = g.RC_SCENE;
  if (scAct && scAct.act === "pad" && app < 0.01 && (this.landK || 0) < 0.01) {
    /* Хватка держится почти весь акт и отпускает только на его
       исходе. Прежняя формула слабела линейно с самого начала, а на
       телефоне доля акта уже при нетронутой странице равна 0.58:
       герой оказывался притянут лишь на пятую часть пути и всё
       равно висел за краем кадра. */
    var padK = 1 - Math.max(0, Math.min(1, ((scAct.k || 0) - 0.72) / 0.28));
    if (padK > 0.01) {
      var pw = this.cw();
      var ph = this.ch();
      /* Место героя в первом кадре. На телефоне это низ экрана:
         выше идут заголовок, кнопки и список - корабль, поставленный
         посередине, просвечивал сквозь стеклянные кнопки и мешал их
         читать. На широком экране уводим правее центра глобуса,
         иначе корпус тонет в сетке шара и читается призраком. */
      /* Место героя в первом кадре. Единственная свободная зона на
         телефоне - правый верх, у логотипа и глобуса: ниже идут
         заголовок, кнопки, список и приборы, и корабль, поставленный
         там, просвечивал сквозь стекло карточек. На широком экране
         уводим правее центра шара, иначе корпус тонет в его сетке. */
      var pxA = this.C.mobile ? pw * 0.76 : pw * 0.84;
      var pyA = this.C.mobile ? ph * 0.23 : ph * 0.66;
      this.toWorld(pxA, pyA, -0.2, this._padP || (this._padP = new T.Vector3()));
      pos.lerp(this._padP, padK * 0.92);
      tan.lerp(this._upVec || (this._upVec = new T.Vector3(0, 1, 0)),
               Math.min(1, padK * 0.85)).normalize();
    }
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

  /* ── Коридор чтения ─────────────────────────────────────────
     Приёмка поймала главное: корабль шёл прямо по строкам. На
     телефоне он закрывал сразу четыре заголовка подряд, на мониторе
     проходил сквозь карточки продуктов и кольцо «99,9%».

     Разводим это двумя средствами сразу, одинаковыми на всех
     устройствах - меняется только запас по краям, потому что поля
     кадра у телефона и монитора разной ширины.

     Первое: если сбоку есть свободное поле, корабль мягко уходит в
     него. Второе: насколько он всё же остался над колонкой, ровно
     настолько кадр его и приглушает - долю публикуем в CSS.

     Не трогаем ни виток вокруг шара, ни посадку, ни подход к люку,
     ни пролог: там положение корабля - часть сцены, и любой сдвиг
     ломает то, к чему мы идём. */
  var lock = Math.max(this.orbK || 0, app, (this.landK || 0), dk || 0);
  if (lock < 0.2 && !(scAct && scAct.act === "pad")) {
    var vw = this.cw();
    /* Полуширина читаемой колонки в пикселях: та же, что у вёрстки */
    var colHalf = Math.min(vw * 0.5, 600) * 0.92;
    var edge = Math.max(0, vw * 0.5 - colHalf);   /* свободное поле */

    var pr = this._corrV || (this._corrV = new T.Vector3());
    pr.copy(pos).project(this.cam);
    var sx = (pr.x * 0.5 + 0.5) * vw;
    var off = sx - vw * 0.5;
    var over = 1 - Math.min(1, Math.abs(off) / Math.max(1, colHalf));

    if (pr.z < 1) {
      /* Сколько мира приходится на пиксель на глубине корабля */
      var dist = Math.abs(this.cam.position.z - pos.z) || 1;
      var worldW = 2 * Math.tan(this.cam.fov * Math.PI / 360) * dist * this.cam.aspect;
      var perPx = worldW / vw;

      /* Смещение храним отдельно и ведём к цели плавно: сама
         позиция каждый кадр берётся заново с кривой маршрута, и
         разовая поправка в неё не накапливается - корабль так и
         оставался посреди строк. */
      var side = off >= 0 ? 1 : -1;
      var wantPx = over > 0.001 ? side * (colHalf + edge * 0.5) - off : 0;
      var cur = this._corrX || 0;
      var to = wantPx * perPx * (1 - lock / 0.2);
      this._corrX = cur + (to - cur) * (dt ? Math.min(1, dt * 3.2) : 0.06);
      pos.x += this._corrX;

    }
  }
  if (lock >= 0.2) { this._corrX = (this._corrX || 0) * 0.86; }

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
    /* Люк обязан смотреть на камеру, а не «примерно вперёд».
       Раньше корпус доворачивался к ближайшему полному обороту
       вокруг своей оси - и это было неверно: ось корабля ставит
       кватернион по касательной маршрута, а вокруг неё азимут
       выходит любой. Из-за этого проём с салоном уезжал за корпус
       ровно тогда, когда мы к нему подходили, и человек упирался в
       гладкий борт.

       Считаем честно: берём камеру в системе корабля и разворачиваем
       корпус так, чтобы люк (он смотрит по локальной оси Z) встал
       к ней лицом. */
    var ry = this.craft.rotation.y;
    var tau = Math.PI * 2;
    var cl = this._camLoc || (this._camLoc = new T.Vector3());
    cl.copy(this.cam.position);
    this.pivot.updateMatrixWorld();
    this.pivot.worldToLocal(cl);
    var want = Math.atan2(cl.x, cl.z);
    /* Ближайший эквивалент по кругу: иначе корпус разворачивается
       через всю окружность на ровном месте */
    while (want - ry > Math.PI) want -= tau;
    while (ry - want > Math.PI) want += tau;
    this.craft.rotation.y = ry + (want - ry) * Math.min(1, (dt || 0.016) * (1.2 + app * 6));
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
  /* На посадке корабль слегка отъезжает, а не наезжает. Раньше он на
     ней подрастал, и вместе с опорами, тенью и площадкой попросту
     переставал помещаться в кадр: точку касания было не видно. Мера
     разная по устройствам - на телефоне корабль и так мелкий. */
  /* На телефоне корабль и так мелкий, там посадка наоборот
     подрастает: иначе разметку площадки на ней не разглядеть.

     К подходу поправка сходит на прежние 0.12 - дальше кадр ведёт
     не посадка, а сам проход к люку, и его выверенный масштаб
     трогать нельзя: от него зависит, закроет ли корпус кадр к
     моменту передачи сцены рубке. */
  var near = Math.min(1, app * 1.6);
  var lndS = 1 + (this.landK || 0) *
    ((this.C.mobile ? 0.12 : -0.20) * (1 - near) + 0.12 * near);
  /* Подход растит корпус сильнее прежнего: аудит показал, что при
     полном подходе корабль занимал всего треть ширины кадра и был
     виден целиком, от носа до стабилизаторов. Это читается «стоит
     вдалеке», а не «мы подошли вплотную». К единице подхода борт с
     люком обязан выходить за все четыре края. */
  /* ── Кадр фильма и кадр чтения ─────────────────────────────
     Приёмка прислала снимок телефона: корпус во весь экран, а
     поверх него четыре заголовка подряд. Дело не в прозрачности -
     корабль шириной в экран не может не мешать буквам.

     Поэтому у сцены два состояния. В кинематографических актах
     (старт, набор высоты, вход в атмосферу, посадка, подход к люку)
     корабль остаётся героем кадра и крупным - там текста почти нет.
     В актах, где человек читает, он отходит вглубь: остаётся тем же
     кораблём того же мира, просто дальше от нас.

     Разница по устройствам только в величине шага: на мониторе есть
     поля, куда его можно отвести, на телефоне их нет. */
  var CINE = {
    pad: 1, ignite: 1, climb: 1, clouds: 1, reentry: 1,
    landing: 1, walk: 1, egress: 1
  };
  var scS = g.RC_SCENE;
  var readAct = scS && !CINE[scS.act] ? 1 : 0;
  var readGoal = 1 - readAct * (this.C.mobile ? 0.46 : 0.16);
  /* Ведём плавно: резкий скачок масштаба на границе актов виден
     как рывок корпуса */
  this._readS = this._readS == null ? readGoal
              : this._readS + (readGoal - this._readS) * Math.min(1, (dt || 0.016) * 2.4);
  /* Подход к люку и посадка возвращают полный размер независимо от
     акта: там мы идём к самому кораблю */
  var full = Math.max(app, (this.landK || 0), dk || 0);
  var readS = this._readS + (1 - this._readS) * Math.min(1, full * 1.5);

  var sNow = s * (1 - k * 0.70) * lndS * (1 + app * 3.9) * (1 + dk * dk * 1.25) * readS;
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
    var w = this.cw();
    var h = this.ch();
    var cx = (v.x * 0.5 + 0.5) * w;
    var cy = (-v.y * 0.5 + 0.5) * h;
    /* Радиус проверки раньше был долей экрана - и это была ошибка:
       у корабля, занявшего экран целиком, центр далеко от собственных
       краёв, поэтому строки, лежащие прямо на корпусе, в проверку не
       попадали. Считаем честный экранный радиус самого корпуса. */
    if (this._hullR == null) {
      var box = new T.Box3().setFromObject(this.craft);
      var sph = box.getBoundingSphere(new T.Sphere());
      this._hullR = sph.radius || 1.4;
    }
    var rWorld = this._hullR * (this._sNow || 1);
    var edgeV = this._tmpD.copy(this.pivot.position);
    edgeV.y += rWorld;
    edgeV.project(this.cam);
    var rad = Math.abs((-edgeV.y * 0.5 + 0.5) * h - cy);
    /* Немного меньше габарита: у самой кромки корпус уже прозрачен
       от бликов, и слишком широкая мерка гасила бы корабль всегда */
    rad = Math.max(Math.min(w, h) * 0.12, rad * 0.82);

    /* Корабль занял кадр - вёрстка об этом знает. По этому признаку
       разделы, попавшие в такой кадр, кладут текст на бортовой
       планшет: сам корабль уменьшать нельзя, мы к нему идём. Мерка
       по фактическому размеру корпуса на экране, а не по акту -
       акты у телефона и монитора совпадают, а размеры нет. */
    var big = rad > Math.min(w, h) * 0.30;
    if (big !== this._hull) {
      this._hull = big;
      document.documentElement.classList.toggle("rc-hull", big);
    }
    var rr = rad * rad;
    var list = this.readables();
    var hit = false;
    for (var i = 0; i < list.length; i++) {
      var b = BOX(list[i]);
      if (b.width < 6 || b.bottom < -40 || b.top > h + 40) continue;
      var dx = Math.max(b.left - cx, 0, cx - b.left - b.width);
      var dy = Math.max(b.top - cy, 0, cy - b.bottom);
      if (dx * dx + dy * dy < rr) { hit = true; break; }
    }
    /* Уступает не корабль, а текст. Прежде корабль гас над словами
       до трети яркости и читался призраком за буквами - клиент это
       и назвал «сцена поверх контента». Теперь заголовки и абзацы
       сами отходят в сторону (см. хук flow в rc-hooks), поэтому
       кораблю достаточно едва заметно притухнуть, чтобы буквы на
       его фоне не спорили с обшивкой. */
    this._veilGoal = hit ? (this.C.mobile ? 0.58 : 0.80) : 1;
    /* На посадке и на подходе корабль не уступает никому: он и есть
       сцена, а не помеха тексту. Иначе ровно в тот момент, когда мы
       к нему идём, он растворяется под карточками. */
    /* В прологе корабль тоже не уступает: он герой первого кадра, а
       не помеха заголовку. Заголовок и без того стоит слева. */
    var scV = g.RC_SCENE;
    var padHold = (scV && scV.act === "pad") ? 0.85 : 0;
    var hold = Math.max(this.appK || 0, (this.landK || 0) * 0.9, padHold);
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
  /* Насколько корабль сейчас уступил тексту - по этой доле вёрстка
     подкладывает под буквы мягкую тень. Считает её тот, кто честно
     смотрит на пересечение со строками.

     Отдаём не число, а ступень. Правило тени висит на сотнях узлов, и
     покадровая запись переменной на корне заставляла браузер каждый
     кадр пересчитывать стиль всего дерева. Ступеней две, переход
     сглаживает сама вёрстка. */
  var vv = 1 - this._veil;
  var stepV = vv > 0.42 ? 2 : (vv > 0.14 ? 1 : 0);
  if (stepV !== this._veilStep) {
    this._veilStep = stepV;
    var cl = document.documentElement.classList;
    cl.toggle("rk-veil-1", stepV === 1);
    cl.toggle("rk-veil-2", stepV === 2);
  }
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

/* ── Ступень снижения качества ────────────────────────────────
   Страница сама объявляет, что кадры не тянут (rc-motion ставит
   data-degrade и шлёт событие). Всё, что добавлено ради красоты
   площадки, обязано на это откликаться: сначала гаснут крошка и
   бегущие огни, потом тени опор, потом грунт вокруг. Читаем
   событием, а не атрибутом каждый кадр: чтение из DOM в цикле
   отрисовки стоит дороже самого эффекта. */
var degradeStep = 0;
try {
  degradeStep = parseInt(document.documentElement.getAttribute("data-degrade"), 10) || 0;
} catch (e) {}
addEventListener("rc:degrade", function (e) {
  var st = e && e.detail && e.detail.step;
  if (st) degradeStep = st;
});

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
  /* Корпус проседает на стойках вместе с ними: удар обязан пройти
     через весь корабль, иначе амортизируют одни ноги, а ракета
     висит над ними неподвижным столбом */
  this.craft.position.y -= (this._shock || 0) * 0.34;

  /* Факел дышит и реагирует на скорость прокрутки. Тормозной импульс
     добавляется поверх тяги: сопло на миг вспыхивает ярче всего,
     что было в полёте, и тут же гаснет. */
  var burn = this._burn || 0;
  var pw = Math.min(1, this.power + burn * 0.9);
  var flick = 0.86 + Math.sin(t * 27) * 0.07 + Math.sin(t * 41) * 0.05;

  /* Севший корабль не может продолжать жечь грунт. Раньше факел и
     след жили своей жизнью, и выхлоп бил сквозь площадку - самая
     заметная неправда во всей посадке. Теперь длина факела идёт за
     просветом до земли: чем ближе опоры, тем короче струя, и к
     касанию от неё остаётся только остывающий раструб. Искры и
     дымный след выключаются совсем.

     Яркость при этом не падает - её ведёт тормозной импульс. Так
     торможение читается короткой мощной вспышкой у самого сопла, а
     не копьём, проходящим сквозь площадку. */
  var lk = this.landK || 0;
  var fk = (1 - lk) / 0.30;
  fk = fk < 0 ? 0 : fk > 1 ? 1 : fk;
  fk = fk * fk * (3 - 2 * fk);

  /* И вторая половина той же правды: струя не может быть длиннее,
     чем просвет до грунта. Меряем реальный просвет от оси корабля
     до площадки и подрезаем факел по нему - на подлёте он упирается
     в землю и расплющивается, а не протыкает её насквозь. Длина
     конуса 2.5, сопло на 2.28 выше пят, отсюда и запас. */
  var coneY = 0.10 + fk * 0.90;
  var clear = 99;
  if (this._padAt && lk > 0.02) {
    clear = (this.pivot.position.y - this._padAt.y) / (this.pivot.scale.x || 1);
    var lim = (clear + 0.30) / 2.5;
    if (lim < 0.07) lim = 0.07;
    if (lim < coneY) coneY = lim;
  }
  var cut = coneY / (0.10 + fk * 0.90 || 1);

  this.flame.uniforms.uTime.value = t;
  this.flame.uniforms.uPower.value = pw * flick;
  this.flame.cone.scale.set(0.55 + fk * 0.45, coneY, 0.55 + fk * 0.45);
  var cs = (0.9 + pw * 0.35 * flick + burn * 0.30) * (0.18 + fk * 0.82);
  this.flame.core.scale.set(cs, cs * cut, cs);
  var hs = (2.2 + pw * 1.9 * flick + burn * 1.5) * (0.42 + fk * 0.58);
  this.flame.halo.scale.set(hs, hs, 1);
  this.flame.halo.material.opacity = (0.55 + pw * 0.4) * (0.30 + fk * 0.70);
  this.engineLight.intensity = (2.2 + pw * 3.4 * flick + burn * 4.5) * (0.28 + fk * 0.72);

  /* Свет сцены ведём тут же, одним движением с факелом: пока
     корабль в пустоте, контровой холодный и фиолетовый, а на
     посадке его перекрывает отсвет от площадки - тот же огонь,
     который жжёт грунт, обязан обводить и силуэт. Заодно снизу
     включается отражённый: он и делает посадку объёмной. */
  var warmK = Math.min(1, lk * 1.15) * (0.55 + burn * 0.45);
  this.rimLight.color.copy(this._rimCold).lerp(this._rimWarm, warmK);
  this.rimLight.intensity = 2.6 + warmK * 1.5 + burn * 1.2;
  this.bounceLight.intensity = lk * (0.85 + burn * 1.4 + Math.max(0, this._shock || 0) * 0.8);
  /* На стоянке рассеянного добавляем: корабль стоит на освещённой
     площадке, а не висит в пустоте */
  this.hemi.intensity = 0.88 + lk * 0.26;

  /* Искры и дым летят вниз на несколько единиц - у самой земли им
     тоже некуда лететь, поэтому гасим их не только по доле посадки,
     но и по просвету */
  var tv = fk > 0.22 && clear > 1.7;
  if (tv !== this._trailOn) {
    this._trailOn = tv;
    this.trail.sparks.pts.visible = tv;
    this.trail.smoke.pts.visible = tv;
  }

  /* Иллюминатор и полосы пульсируют */
  this.rocket.glass.material.emissiveIntensity = 0.6 + Math.sin(t * 2.1) * 0.22;
  this.rocket.glowMat.opacity = 0.5 + Math.sin(t * 1.7) * 0.18;

  /* Невидимый след считать незачем: на стоянке это чистая трата кадра */
  if (tv) this.trail.step(dt, this.power);

  /* Плавное появление после загрузки */
  if (this.shown < 1) {
    this.shown = Math.min(1, this.shown + dt * 0.7);
    this.pivot.scale.multiplyScalar(0.4 + this.shown * 0.6);
  }
  /* Грунт считаем после layout: положение и масштаб корабля на этот
     кадр уже готовы, и площадка встаёт ровно под опоры */
  this.groundStep(dt);
  /* Пар шлюза считаем после площадки: ему нужен и готовый масштаб
     корабля на этот кадр, и уровень грунта, к которому он ляжет */
  this.steamStep(dt);
  this.quake(dt);
  this.veil(dt);

  this.publish();
  this.r.render(this.scene, this.cam);
};

/* ── Дрожь кадра при касании ──────────────────────────────────
   Трясём и сцену, и страницу. Камеру - потому что это честно и
   работает независимо от вёрстки: трёхмерный мир на самом деле
   вздрагивает. Плюс отдаём наружу три переменные на html, чтобы
   плоский интерфейс мог вздрогнуть тем же движением и в тот же
   миг - иначе 3D и вёрстка разъедутся.

   Толчок короткий: две высокие частоты, затухание за треть секунды.
   Долгая тряска читается поломкой, а не ударом. */
/* Слой удара: вспышка от факела и пыль у нижней кромки. Отдельный
   элемент нужен не для красоты - на нём живёт доля толчка, которую
   сцена переписывает каждый кадр. Держать её на корне документа
   значило пересчитывать стиль всей страницы в момент касания. */
var quakeEl = null;
function quakeFx() {
  if (quakeEl && quakeEl.isConnected) return quakeEl;
  quakeEl = document.querySelector(".rc-quake-fx");
  if (!quakeEl) {
    quakeEl = document.createElement("div");
    quakeEl.className = "rc-quake-fx";
    quakeEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(quakeEl);
  }
  return quakeEl;
}

Rocket.prototype.quake = function (dt) {
  var s = this._shake || 0;
  var root = document.documentElement;
  if (s > 0.002) {
    this._shake = s * Math.exp(-dt * 5.2);
    var t = this.time;
    var ox = (Math.sin(t * 63) * 0.65 + Math.sin(t * 29 + 1.1) * 0.35) * s;
    var oy = (Math.sin(t * 47 + 1.7) * 0.65 + Math.sin(t * 22 + 0.4) * 0.35) * s;
    this.cam.position.x = ox * 0.22;
    this.cam.position.y = oy * 0.17;
    /* Силу толчка читает только слой удара - вспышка и пыль у нижней
       кромки. Раньше её писали на корень документа, и каждый кадр
       тряски помечал устаревшим стиль всей страницы: две тысячи
       узлов ради двух градиентов. Пишем самому слою.

       Переменных было три: кроме силы ещё смещение по осям для
       класса rc-shakeable. Такого класса в разметке нет ни в одном
       файле - обе записи каждый кадр уходили в никуда. Убраны. */
    V(quakeFx(), "--rc-shake", s.toFixed(2));
    if (!this._quakeOn) { this._quakeOn = 1; root.classList.add("rc-quake"); }
    return;
  }
  if (!this._quakeOn) return;
  this._quakeOn = 0;
  this._shake = 0;
  this.cam.position.x = 0;
  this.cam.position.y = 0;
  V(quakeFx(), "--rc-shake", "0");
  root.classList.remove("rc-quake");
};

/* Тряска принадлежит одному моменту сценария - касанию грунта.
   На обратном ходу она залипала: класс держался от эпилога до самой
   посадки, и кадр мелко дрожал там, где корабль давно стоит. Смена
   акта снимает её принудительно, кроме собственно посадки. */
addEventListener("rc:act", function (e) {
  var a = e && e.detail && e.detail.act;
  if (a === "landing" || a === "walk") return;
  var root2 = document.documentElement;
  if (root2.classList.contains("rc-quake")) {
    root2.classList.remove("rc-quake");
    V(root2, "--rc-shake", "0");
    V(root2, "--rc-shake-x", "0px");
    V(root2, "--rc-shake-y", "0px");
  }
});

/* Экранное положение ракеты уходит в CSS-переменные. По ним чипы
   разлетаются от пролёта, счётчики стартуют, карточки подсвечиваются:
   трёхмерная сцена и плоский интерфейс живут в одном пространстве. */
Rocket.prototype.publish = function () {
  this._pubT = (this._pubT || 0) + 1;
  if (this._pubT % 2) return;
  var v = this._tmpC.copy(this.pivot.position).project(this.cam);
  var w = this.cw();
  var h = this.ch();
  var x = (v.x * 0.5 + 0.5) * w;
  var y = (-v.y * 0.5 + 0.5) * h;
  /* Близость корабля к зрителю. Раньше её брали из глубины в
     координатах отсечения ((z+1)/2), но эта величина нелинейна и у
     перспективной камеры почти всегда упирается в единицу: наружу
     уходили числа порядка 0.005, и свет корабля на странице был
     фактически выключен - приёмка поймала это замером.

     Берём честное расстояние в мире: вплотную это восемь единиц,
     дальше тридцати четырёх корабль уже точка. */
  var dist = this.cam.position.distanceTo(this.pivot.position);
  var near = 1 - Math.max(0, Math.min(1, (34 - dist) / 26));
  /* Пишем на сам слой свечения, а не на корень документа: эти три
     числа меняются каждый кадр, а читает их одна-единственная
     подложка. Запись на :root помечала устаревшим стиль всему
     дереву - на приёмке это была заметная доля пересчёта. */
  var shine = this._shineEl;
  if (!shine) {
    shine = this._shineEl = document.querySelector(".rc-shine") || document.documentElement;
  }
  V(shine, "--rocket-x", Math.round(x) + "px");
  V(shine, "--rocket-y", Math.round(y) + "px");
  V(shine, "--rocket-near", (1 - near).toFixed(2));
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
  /* Растворённый корабль не имеет права стоить целого кадра. Свою
     прозрачность сцена считает сама (veil * occl) и пишет в стиль
     холста, так что достаточно на неё посмотреть. Пока корабля в
     кадре нет, обновляем его раз в несколько кадров: этого хватает,
     чтобы он не залип в старой позе к моменту, когда снова
     понадобится, а телефон в это время занимается страницей.

     Это чистая экономия: ни одна деталь и ни один эффект от неё не
     пропадают, потому что пропускаются кадры, которых не видно. */
  var vis = parseFloat(this.canvas.style.opacity);
  if (!isNaN(vis) && vis < 0.02) {
    this._idleN = (this._idleN || 0) + 1;
    if (this._idleN % 6) return;
  } else {
    this._idleN = 0;
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

/* Где сейчас люк на экране. Нужна только для проверок: по этой точке
   видно, попадает ли проём в кадр на подходе - на глаз по скриншоту
   это не определить, а от неё зависит весь эпизод входа. */
Rocket.prototype.doorSpot = function () {
  var d = this.rocket && this.rocket.door;
  if (!d || !this.cam) return null;
  var v = this._tmpDS || (this._tmpDS = new T.Vector3());
  v.set(0, d.y || 0, 0);
  d.group.localToWorld(v);
  v.project(this.cam);
  /* Куда смотрит люк и не отвёрнут ли он от камеры */
  var n = this._tmpDN || (this._tmpDN = new T.Vector3());
  n.set(0, 0, 1);
  d.group.getWorldDirection ? d.group.getWorldDirection(n) : n.set(0, 0, 1);
  var wp = this._tmpDW || (this._tmpDW = new T.Vector3());
  wp.set(0, d.y || 0, 0);
  d.group.localToWorld(wp);
  var toCam = this._tmpDC || (this._tmpDC = new T.Vector3());
  toCam.copy(this.cam.position).sub(wp).normalize();
  return {
    x: +((v.x * 0.5 + 0.5) * this.cw()).toFixed(0),
    y: +((-v.y * 0.5 + 0.5) * this.ch()).toFixed(0),
    z: +v.z.toFixed(3),
    s: +(this._sNow || 1).toFixed(2),
    ry: +((this.craft ? this.craft.rotation.y : 0)).toFixed(2),
    лицом: +n.dot(toCam).toFixed(2),
    d: +this.cam.position.distanceTo(wp).toFixed(2)
  };
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
    /* Корабль - главный герой фильма, поэтому просит место как
       главная сцена: если все контексты разобраны украшениями,
       они уступят. Без корабля нет ни люка, ни входа внутрь. */
    if (g.RC_GL && !g.RC_GL.take(true)) return null;
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
