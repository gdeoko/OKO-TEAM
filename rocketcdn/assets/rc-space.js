/* ═══════════════════════════════════════════════════════════
   Rocket CDN · живой космос на фоне всей страницы

   Один холст под всем содержимым. Рисуется обычным двумерным
   контекстом: контексты WebGL дороги и все четыре заняты сценами,
   а фон должен работать даже на слабом телефоне.

   Что здесь есть и почему именно так:
   - звёзды разной величины и температуры. Настоящее ночное небо не
     белое: голубые гиганты, белые, жёлтые как Солнце, оранжевые и
     красные карлики. Один общий цвет сразу читается как «точки на
     чёрном», а не как небо;
   - мерцание честное: это атмосферная сцинтилляция, у неё нет
     одного периода. Складываем две несоизмеримые частоты, и мелкие
     звёзды дрожат заметно сильнее крупных - именно так и в жизни,
     потому что маленький диск целиком попадает в одну ячейку
     турбулентности;
   - у самых ярких - тонкий крест дифракции. Его даёт не небо, а
     оптика, но глаз без него не читает звезду как «яркую»;
   - туманности, пылевые полосы Млечного Пути и звёздная пыль
     запечены в отдельный слой один раз. Полторы сотни мягких пятен
     в каждом кадре стоили бы дороже всего остального вместе, а так
     это одна отрисовка картинки. Слой печём в половинном
     разрешении: пятна мягкие, разницы не видно, а пикселей вчетверо
     меньше;
   - редкие метеоры со следом: кадр перестаёт быть статичной
     заставкой, но не отвлекает - один болид раз в десяток секунд;
   - параллакс в три слоя. Слои разъезжаются и от прокрутки, и от
     поворота общей камеры сайта (RC_WORLD.pan/tilt), поэтому фон
     живёт в том же пространстве, что и разделы с ракетой.

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

/* Спектральные классы. Доли взяты по смыслу, а не по каталогу: в
   каталоге девять из десяти звёзд - тусклые красные карлики, но
   глазом видны как раз горячие. Небо должно выглядеть так, как его
   видит человек, а не так, как его считает статистика.
   [r, g, b, доля, во сколько раз крупнее базового радиуса] */
var SPECTRA = [
  [170, 196, 255, 0.07, 1.30],   /* O-B: голубые гиганты, редки и крупны */
  [222, 234, 255, 0.19, 1.10],   /* A: белые */
  [255, 246, 222, 0.28, 1.00],   /* F-G: солнечные */
  [255, 214, 162, 0.26, 0.92],   /* K: оранжевые */
  [255, 176, 140, 0.20, 0.84]    /* M: красные карлики */
];

function pickSpectrum(u) {
  var acc = 0;
  for (var i = 0; i < SPECTRA.length; i++) {
    acc += SPECTRA[i][3];
    if (u <= acc) return SPECTRA[i];
  }
  return SPECTRA[2];
}

/* Детерминированный генератор: небо обязано быть одинаковым от
   захода к заходу, иначе созвездия перемешиваются на каждом
   изменении размера окна. */
function rngFrom(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  this.resize();
  this.build();
  this.bind();
}

/* Насколько скупо рисуем. Слабый телефон и принудительное упрощение
   страницы снимают всё, что стоит дороже базового звёздного поля. */
Space.prototype.budget = function () {
  var w = innerWidth;
  var deg = parseInt(document.documentElement.getAttribute("data-degrade") || "0", 10) || 0;
  var weak = false;
  try {
    /* Четырёхъядерный телефон - это не слабое устройство, а обычное.
       С прежним порогом фон на нём терял и метеоры, и кресты
       дифракции, и половину звёзд: небо на телефоне выглядело
       беднее, чем на мониторе, чего владелец и не принял. */
    weak = (navigator.deviceMemory || 4) <= 2 || (navigator.hardwareConcurrency || 4) <= 2;
  } catch (e) {}
  var mob = w < 760;
  return {
    mob: mob,
    /* deg>=2 - страница уже призналась, что не тянет: фон обязан
       отойти в сторону первым, он тут не главный герой */
    lean: deg >= 2 || weak,
    deep: deg < 2 && !REDUCE,           /* печь ли слой туманностей */
    meteors: deg < 2 && !REDUCE && !weak,
    /* Кресты дифракции у ярких звёзд рисуем и на телефоне: это
       рисунок в запечённом слое, на кадр он не влияет вовсе */
    spikes: !weak && deg < 1
  };
};

Space.prototype.build = function () {
  var B = this.budget();
  this.B = B;
  var rnd = rngFrom(20260819);
  /* Плотность держим в разумных пределах: фон не должен есть кадры */
  var n = B.lean ? 90 : 320;
  this.stars = [];
  for (var i = 0; i < n; i++) {
    var layer = i % 3;                      /* 0 дальний, 2 ближний */
    var sp = pickSpectrum(rnd());
    /* Размер по степенному закону: ярких звёзд единицы, мелких
       россыпь. Линейное распределение даёт «манную крупу». */
    var mag = Math.pow(rnd(), 2.2);
    var r = (0.35 + layer * 0.30 + mag * 1.5) * sp[4];
    this.stars.push({
      x: rnd(), y: rnd(), r: r, l: layer,
      c: sp[0] + "," + sp[1] + "," + sp[2],
      /* Мерцание: две несоизмеримые частоты. Мелкая звезда дрожит
         сильнее - её диск целиком укладывается в одну ячейку
         турбулентности, у крупной дрожание усредняется. */
      f1: 0.6 + rnd() * 1.5, p1: rnd() * 6.28,
      f2: 1.7 + rnd() * 3.4, p2: rnd() * 6.28,
      amp: Math.min(0.46, 0.16 + 0.30 / (0.5 + r)),
      base: 0.42 + mag * 0.58,
      spike: r > 1.55
    });
  }
  /* Пакеты данных: короткие росчерки, летят поперёк */
  this.pk = [];
  var pn = B.lean ? 3 : 11;
  for (i = 0; i < pn; i++) this.pk.push(this.seedPacket(true));

  /* Метеоры: один живой болид за раз, следующий через паузу */
  this.met = null;
  this.metAt = 3 + rnd() * 6;

  this.bakeDeep();
};

/* ── Дальний слой: туманности, Млечный Путь, звёздная пыль ──
   Печём один раз в половинном разрешении и потом только
   переставляем. Пятен здесь под две сотни; рисовать их в каждом
   кадре нельзя, а без них небо - точки на пустоте. */
Space.prototype.bakeDeep = function () {
  this.deep = null;
  if (!this.B.deep) return;
  var w = this.w, h = this.h;
  if (!(w > 0 && h > 0)) return;

  /* Запас по краям: слой ездит от параллакса, и без поля по краю
     показалась бы его граница */
  var PAD = 0.10;
  var cw = Math.max(64, Math.round(w * (1 + PAD * 2) * 0.5));
  var ch = Math.max(64, Math.round(h * (1 + PAD * 2) * 0.5));
  var c = document.createElement("canvas");
  c.width = cw; c.height = ch;
  var x = c.getContext("2d");
  var rnd = rngFrom(0x5BF03635);
  var light = this.theme === "light";
  var i, gr;

  /* Полоса Млечного Пути идёт наискось через кадр, как и в небе
     Земли. Задаём её линией и вокруг неё сеем всё остальное. */
  var ang = -0.42, ca = Math.cos(ang), sa = Math.sin(ang);
  var mx = cw * 0.46, my = ch * 0.55;
  function band(u, spread) {
    /* u вдоль полосы (-1..1), spread поперёк */
    var lx = (u * cw * 0.95), ly = spread * ch * 0.30;
    return [mx + lx * ca - ly * sa, my + lx * sa + ly * ca];
  }

  x.globalCompositeOperation = "lighter";

  /* Дымка диска: широкие мягкие пятна вдоль полосы. Цвет к центру
     галактики теплее - там старые звёзды балджа. */
  var nHaze = this.B.lean ? 90 : 170;
  for (i = 0; i < nHaze; i++) {
    var u = rnd() * 2 - 1;
    var sp = (rnd() - 0.5) * (0.7 + rnd() * 1.5);
    var pt = band(u, sp);
    var rr = (0.05 + rnd() * 0.13) * cw;
    var warm = 1 - Math.abs(u + 0.25);
    var col = warm > 0.55 ? "255,232,196" : (rnd() > 0.45 ? "206,222,246" : "162,192,240");
    var a = (0.020 + rnd() * 0.030) * (light ? 0.35 : 1) * (0.4 + warm * 0.9);
    gr = x.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], rr);
    gr.addColorStop(0, "rgba(" + col + "," + a.toFixed(4) + ")");
    gr.addColorStop(1, "rgba(" + col + ",0)");
    x.fillStyle = gr;
    x.fillRect(pt[0] - rr, pt[1] - rr, rr * 2, rr * 2);
  }

  /* Ядро галактики: сгущение на полосе */
  var kp = band(-0.25, 0);
  gr = x.createRadialGradient(kp[0], kp[1], 0, kp[0], kp[1], cw * 0.26);
  gr.addColorStop(0, "rgba(255,236,200," + (light ? 0.05 : 0.11) + ")");
  gr.addColorStop(0.4, "rgba(232,214,186," + (light ? 0.02 : 0.05) + ")");
  gr.addColorStop(1, "rgba(200,190,180,0)");
  x.fillStyle = gr;
  x.fillRect(0, 0, cw, ch);

  /* Звёздная пыль: точки в один пиксель. Отдельными звёздами они не
     читаются, но дают диску зернистость, без которой он выглядит
     нарисованным градиентом. */
  var nDust = this.B.lean ? 900 : 2600;
  for (i = 0; i < nDust; i++) {
    var du = rnd() * 2 - 1;
    var inBand = rnd() < 0.62;
    var dp = inBand ? band(du, (rnd() - 0.5) * 1.5) : [rnd() * cw, rnd() * ch];
    var dsp = pickSpectrum(rnd());
    var da = (0.06 + Math.pow(rnd(), 2.4) * 0.40) * (light ? 0.25 : 1);
    x.fillStyle = "rgba(" + dsp[0] + "," + dsp[1] + "," + dsp[2] + "," + da.toFixed(3) + ")";
    x.fillRect(dp[0] | 0, dp[1] | 0, 1, 1);
  }

  /* Туманности в фирменных цветах: небо перекликается с сайтом.
     Каждая - облако из десятков пятен разного размера, поэтому у
     неё есть объём, а не ровная клякса. */
  var NEB = [[0.16, 0.24, "66,178,220", 0.9], [0.78, 0.66, "138,89,246", 1.0],
             [0.52, 0.14, "138,89,246", 0.6], [0.30, 0.82, "66,178,220", 0.7]];
  for (i = 0; i < NEB.length; i++) {
    var nx = NEB[i][0] * cw, ny = NEB[i][1] * ch, nr = cw * 0.16 * NEB[i][3];
    var blobs = this.B.lean ? 26 : 46;
    for (var q = 0; q < blobs; q++) {
      var ox = nx + (rnd() - 0.5) * nr * 2.2, oy = ny + (rnd() - 0.5) * nr * 1.6;
      var orr = nr * (0.16 + rnd() * 0.55);
      var oa = (0.014 + rnd() * 0.026) * (light ? 0.3 : 1);
      gr = x.createRadialGradient(ox, oy, 0, ox, oy, orr);
      gr.addColorStop(0, "rgba(" + NEB[i][2] + "," + oa.toFixed(4) + ")");
      gr.addColorStop(0.55, "rgba(" + NEB[i][2] + "," + (oa * 0.35).toFixed(4) + ")");
      gr.addColorStop(1, "rgba(" + NEB[i][2] + ",0)");
      x.fillStyle = gr;
      x.fillRect(ox - orr, oy - orr, orr * 2, orr * 2);
    }
  }

  /* Пылевые полосы: тёмные рваные прожилки вдоль диска. Именно они
     делают Млечный Путь узнаваемым - без них это светлая клякса.
     Рисуем вычитанием, поэтому режим смены на обычный. */
  x.globalCompositeOperation = "destination-out";
  var nDark = this.B.lean ? 120 : 260;
  for (i = 0; i < nDark; i++) {
    var lu = rnd() * 2 - 1;
    var lp = band(lu, (rnd() - 0.5) * 0.85);
    var lr = (0.02 + rnd() * 0.075) * cw;
    gr = x.createRadialGradient(lp[0], lp[1], 0, lp[0], lp[1], lr);
    gr.addColorStop(0, "rgba(0,0,0," + (0.22 + rnd() * 0.42).toFixed(3) + ")");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr;
    x.fillRect(lp[0] - lr, lp[1] - lr, lr * 2, lr * 2);
  }
  x.globalCompositeOperation = "source-over";

  this.deep = c;
  this.deepPad = PAD;
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

/* Метеор: входит с края под пологим углом, живёт секунду с
   небольшим. След тянется назад по курсу и гаснет к хвосту. */
Space.prototype.seedMeteor = function () {
  var fromTop = Math.random() < 0.7;
  var a = (fromTop ? 0.25 : -0.15) + Math.random() * 0.5;   /* угол вниз-вправо */
  var dir = Math.random() < 0.5 ? 1 : -1;
  return {
    x: dir > 0 ? -0.05 : 1.05,
    y: fromTop ? Math.random() * 0.45 : 0.4 + Math.random() * 0.4,
    vx: dir * (0.42 + Math.random() * 0.55),
    vy: a * 0.55,
    len: 0.09 + Math.random() * 0.16,
    life: 0,
    max: 1.1 + Math.random() * 0.9,
    /* Цвет по составу: железо горит белым, натрий жёлто-оранжевым */
    c: Math.random() < 0.62 ? "214,236,255" : "255,214,158"
  };
};

Space.prototype.bind = function () {
  var self = this, rt;
  addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { self.resize(); self.build(); }, 200);
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

Space.prototype.setTheme = function (v) {
  if (this.theme === v) return;
  this.theme = v;
  /* Слой туманностей печётся с учётом темы: на светлом фоне те же
     плотности превращают верх страницы в грязное пятно */
  this.bakeDeep();
};

Space.prototype.resize = function () {
  var w = innerWidth, h = innerHeight;
  /* Размер кадра изменился - выпеченную дымку надо сложить заново */
  this.haze = null;
  var dpr = Math.min(g.devicePixelRatio || 1, w < 760 ? 1.5 : 2);
  this.cv.width = Math.round(w * dpr);
  this.cv.height = Math.round(h * dpr);
  this.cv.style.width = w + "px";
  this.cv.style.height = h + "px";
  this.x.setTransform(dpr, 0, 0, dpr, 0, 0);
  this.w = w; this.h = h;
};


/* Выпечка ближней дымки. Слой вдвое меньше кадра: пятна мягкие, и
   разницы на глаз нет, а пикселей вчетверо меньше. */
Space.prototype.bakeHaze = function (p, warm, dim, light) {
  var w = this.w, h = this.h;
  var cw = Math.max(2, Math.round(w / 2)), ch = Math.max(2, Math.round(h / 2));
  if (!this.haze) { this.haze = document.createElement("canvas"); }
  if (this.haze.width !== cw || this.haze.height !== ch) {
    this.haze.width = cw; this.haze.height = ch;
  }
  var c = this.haze.getContext("2d");
  c.clearRect(0, 0, cw, ch);
  var mx = Math.max(cw, ch);

  var g1 = c.createRadialGradient(cw * (0.18 + p * 0.2), ch * (0.18 + p * 0.1), 0,
                                  cw * (0.18 + p * 0.2), ch * (0.18 + p * 0.1), mx * 0.62);
  var a1 = (light ? 0.08 : 0.15) * dim;
  g1.addColorStop(0, "rgba(66,178,220," + (a1 * (1 - p * 0.35)).toFixed(3) + ")");
  g1.addColorStop(1, "rgba(66,178,220,0)");
  c.fillStyle = g1;
  c.fillRect(0, 0, cw, ch);

  var g2 = c.createRadialGradient(cw * (0.88 - p * 0.25), ch * (0.72 - p * 0.3), 0,
                                  cw * (0.88 - p * 0.25), ch * (0.72 - p * 0.3), mx * 0.55);
  var a2 = (light ? 0.055 : 0.12) * dim;
  g2.addColorStop(0, "rgba(138,89,246," + (a2 * (0.5 + p * 0.5)).toFixed(3) + ")");
  g2.addColorStop(1, "rgba(138,89,246,0)");
  c.fillStyle = g2;
  c.fillRect(0, 0, cw, ch);

  /* Зарево акта: на старте и на входе в атмосферу снизу поднимается
     тёплый свет, в космосе его нет вовсе. */
  if (warm > 0.02) {
    var gw = c.createRadialGradient(cw * 0.5, ch * 1.02, 0, cw * 0.5, ch * 1.02, mx * 0.85);
    gw.addColorStop(0, "rgba(255,150,60," + (warm * (light ? 0.10 : 0.17) * dim).toFixed(3) + ")");
    gw.addColorStop(0.45, "rgba(255,110,40," + (warm * 0.05 * dim).toFixed(3) + ")");
    gw.addColorStop(1, "rgba(255,90,30,0)");
    c.fillStyle = gw;
    c.fillRect(0, 0, cw, ch);
  }

  this.hazeP = p; this.hazeW = warm; this.hazeD = dim; this.hazeLight = light;
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

  /* Поворот общей камеры сайта. Слои разъезжаются по нему с разной
     силой - это и есть параллакс: ближние звёзды сносит заметно,
     дальняя дымка почти стоит. */
  var W3 = g.RC_WORLD;
  var panx = W3 ? (W3.pan || 0) : 0;
  var pany = W3 ? (W3.tilt || 0) : 0;

  /* Дальний слой: туманности и Млечный Путь. Едет медленнее всего -
     он самый далёкий. */
  if (this.deep) {
    var pad = this.deepPad;
    var ox = -w * pad + (panx * 0.020 - p * 0.035) * w;
    var oy = -h * pad + (pany * 0.016 - p * 0.10) * h;
    /* Держим слой в пределах запаса, иначе покажется его край */
    var lim = w * pad, limY = h * pad;
    if (ox > 0) ox = 0; else if (ox < -lim * 2) ox = -lim * 2;
    if (oy > 0) oy = 0; else if (oy < -limY * 2) oy = -limY * 2;
    x.globalAlpha = dim * (light ? 0.55 : 1);
    x.drawImage(this.deep, ox, oy, w * (1 + pad * 2), h * (1 + pad * 2));
    x.globalAlpha = 1;
  }

  /* Ближняя дымка, зарево акта и их движение по странице.

     Раньше всё это рисовалось прямо в кадр: три полноэкранные
     заливки градиентом плюс создание самих градиентов - и так
     шестьдесят раз в секунду. На телефоне это была едва ли не самая
     дорогая строка всего фона.

     Вид остался ровно тот же, изменился способ: дымка живёт в своём
     слое половинного разрешения и перерисовывается только когда
     действительно поменялась - при заметном сдвиге по странице, при
     смене зарева или темы. Мягкому пятну половинного разрешения и
     редких обновлений хватает с запасом: у него нет ни одной резкой
     границы, на которой это было бы заметно. */
  var need = !this.haze ||
             Math.abs(p - this.hazeP) > 0.008 ||
             Math.abs(warm - this.hazeW) > 0.02 ||
             Math.abs(dim - this.hazeD) > 0.02 ||
             this.hazeLight !== light;
  if (need) this.bakeHaze(p, warm, dim, light);
  if (this.haze) x.drawImage(this.haze, 0, 0, w, h);

  /* ── Звёзды ──
     Ближние слои сдвигаются сильнее: это и есть параллакс. */
  var spikes = this.B.spikes;
  for (var i = 0; i < this.stars.length; i++) {
    var s = this.stars[i];
    var shift = (s.l + 1) * 0.16;
    var lay = (s.l + 1) * 0.6;                 /* ближний слой сносит сильнее */
    var sy = (s.y - p * shift - pany * 0.024 * lay) % 1;
    if (sy < 0) sy += 1;
    var sx = (s.x - panx * 0.034 * lay) % 1;
    if (sx < 0) sx += 1;
    /* Сцинтилляция: произведение двух несоизмеримых волн. Одна
       синусоида даёт ровное «дыхание», две - неровное живое дрожание */
    var tw = 1 + s.amp * (Math.sin(this.t * s.f1 + s.p1) * 0.62 +
                          Math.sin(this.t * s.f2 + s.p2) * 0.38);
    var al = s.base * tw * (0.35 + s.l * 0.28) * dim * (light ? 0.42 : 1);
    if (al <= 0.01) continue;
    if (al > 1) al = 1;
    var px = sx * w, py = sy * h;
    var rr2 = s.r * tw;
    x.fillStyle = light
      ? "rgba(12,22,38," + (al * 0.9).toFixed(3) + ")"
      : "rgba(" + s.c + "," + al.toFixed(3) + ")";
    if (rr2 < 0.9) {
      /* Мелкие рисуем прямоугольником: дуга на субпиксельном радиусе
         стоит втрое дороже и выглядит так же */
      x.fillRect(px, py, 1, 1);
    } else {
      x.beginPath();
      x.arc(px, py, rr2, 0, 6.283);
      x.fill();
      /* Ореол вокруг ярких: у настоящей яркой звезды свет
         рассеивается в оптике и в глазу, чистая точка выглядит
         дешёвой засветкой пикселя */
      if (rr2 > 1.4 && !light) {
        var hg = x.createRadialGradient(px, py, 0, px, py, rr2 * 3.4);
        hg.addColorStop(0, "rgba(" + s.c + "," + (al * 0.34).toFixed(3) + ")");
        hg.addColorStop(1, "rgba(" + s.c + ",0)");
        x.fillStyle = hg;
        x.fillRect(px - rr2 * 3.4, py - rr2 * 3.4, rr2 * 6.8, rr2 * 6.8);
      }
    }
    /* Крест дифракции у самых ярких */
    if (spikes && s.spike && !light) {
      var sl = rr2 * 5.5;
      x.strokeStyle = "rgba(" + s.c + "," + (al * 0.22).toFixed(3) + ")";
      x.lineWidth = 0.7;
      x.beginPath();
      x.moveTo(px - sl, py); x.lineTo(px + sl, py);
      x.moveTo(px, py - sl); x.lineTo(px, py + sl);
      x.stroke();
    }
  }

  /* ── Метеор ── */
  if (this.B.meteors) {
    if (this.met) {
      var m = this.met;
      m.life += dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.life > m.max || m.x < -0.2 || m.x > 1.2 || m.y > 1.2) {
        this.met = null;
        this.metAt = this.t + 6 + Math.random() * 12;
      } else {
        /* Яркость всплывает и гаснет: болид вспыхивает при входе и
           сгорает, ровная линия читается царапиной на экране */
        var lf = m.life / m.max;
        var fl = Math.sin(lf * Math.PI);
        fl = fl * fl * (light ? 0.45 : 1) * dim;
        var hx = m.x * w, hy = m.y * h;
        var tx = (m.x - m.vx * m.len / 0.5) * w, ty2 = (m.y - m.vy * m.len / 0.5) * h;
        var lg2 = x.createLinearGradient(tx, ty2, hx, hy);
        lg2.addColorStop(0, "rgba(" + m.c + ",0)");
        lg2.addColorStop(0.72, "rgba(" + m.c + "," + (fl * 0.32).toFixed(3) + ")");
        lg2.addColorStop(1, "rgba(" + m.c + "," + (fl * 0.85).toFixed(3) + ")");
        x.strokeStyle = lg2;
        x.lineWidth = 1.6;
        x.lineCap = "round";
        x.beginPath();
        x.moveTo(tx, ty2); x.lineTo(hx, hy);
        x.stroke();
        x.lineCap = "butt";
        /* Голова ярче следа: там идёт само горение */
        var hg2 = x.createRadialGradient(hx, hy, 0, hx, hy, 7);
        hg2.addColorStop(0, "rgba(255,255,255," + (fl * 0.75).toFixed(3) + ")");
        hg2.addColorStop(0.35, "rgba(" + m.c + "," + (fl * 0.35).toFixed(3) + ")");
        hg2.addColorStop(1, "rgba(" + m.c + ",0)");
        x.fillStyle = hg2;
        x.fillRect(hx - 7, hy - 7, 14, 14);
      }
    } else if (this.t > this.metAt) {
      this.met = this.seedMeteor();
    }
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
  if (document.documentElement.classList.contains("rc-flying")) { this._last = 0; return; }
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
