/* ═══════════════════════════════════════════════════════════
   Rocket CDN · rc-planets.js
   Библиотека процедурных небесных тел для космических сцен.

   Зачем отдельный файл: планеты нужны сразу в нескольких сценах
   (полёт, фон рубки, карта сети), а снимки с орбиты весят
   мегабайты и тянут загрузку. Здесь всё рисуется кодом на холсте
   при старте - трафик нулевой, а seed даёт повторяемый мир: один
   и тот же номер узла всегда даёт одну и ту же планету.

   Чем добиваемся «фото с орбиты», а не «крашеного шарика»:
   - шум берём трёхмерный, по направлению из центра сферы. Плоский
     шум по UV даёт шов на нулевом меридиане и растяжку у полюсов,
     трёхмерный не даёт ни того, ни другого;
   - высоту считаем один раз в массив, уровень моря выбираем по
     гистограмме под нужную долю суши. Иначе на одном seed выходит
     Пангея, на другом сплошной океан;
   - тот же массив высот идёт в bumpMap, поэтому рельеф читается на
     терминаторе: там свет скользящий и любая неровность видна;
   - климат раскладываем по широтам, а не пятнами. Пустыни Земли
     лежат кольцами на тридцатых широтах, потому что там опускается
     воздух пассатной ячейки, и глаз этот рисунок узнаёт;
   - океан помечен в specularMap: блик солнца ложится на воду и не
     ложится на сушу, это первое, что выдаёт подделку;
   - атмосфера - отдельная оболочка с френелем: на лимбе слой
     толстый и голубой, у терминатора красный (свет прошёл длинный
     путь и потерял синеву), в зените прозрачный;
   - ночные огни гасим по скалярному произведению нормали и
     направления на светило, иначе города горят и днём;
   - кольца отбрасывают тень на планету, а планета на кольца.

   Бюджет отрисовки: при detail:"low" сверх базовой сферы остаётся
   не больше двух мешей. Когда просят и кольца, и облака - облака
   впекаются прямо в текстуру поверхности, потому что на телефоне
   их самостоятельное вращение всё равно не разглядеть.

   Наружу: window.RC_PLANETS.make(kind, opts) / .kinds() / .star(opts)
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

if (!g.THREE) return;
var T = g.THREE;
var PI = Math.PI, TAU = PI * 2;

/* ── Мелкая арифметика ───────────────────────────────────── */
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth(e0, e1, x) {
  var d = e1 - e0;
  if (d === 0) d = 1e-6;
  var t = clamp((x - e0) / d, 0, 1);
  return t * t * (3 - 2 * t);
}
function wrapPi(a) {
  while (a > PI) a -= TAU;
  while (a < -PI) a += TAU;
  return a;
}

/* Зерно поверхности берём хэшем от координат, а не ещё одной
   октавой шума: октава стоит впятеро дороже. Хэш обязательно
   перемешивающий - наивное «x*a+y*b» даёт диагональную рябь,
   которая на текстуре читается как штриховка карандашом. */
function grainAt(x, y) {
  var h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
  h = h ^ (h >>> 16);
  return ((h >>> 0) & 255) * 0.00392156 - 0.5;
}
function hash01(i) {
  var h = Math.imul(i | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/* Поворот направления вокруг оси по формуле Родрига. Нужен там, где
   надо закрутить выборку шума в вихрь: спираль, полученная поворотом
   координат, ведёт себя как настоящее течение, а нарисованная
   завитушка всегда выглядит наклейкой. */
var ROT = [0, 0, 0];
function rotAxis(dx, dy, dz, ax, ay, az, th) {
  var c = Math.cos(th), s = Math.sin(th);
  var dot = dx * ax + dy * ay + dz * az;
  var crx = ay * dz - az * dy;
  var cry = az * dx - ax * dz;
  var crz = ax * dy - ay * dx;
  var k = dot * (1 - c);
  ROT[0] = dx * c + crx * s + ax * k;
  ROT[1] = dy * c + cry * s + ay * k;
  ROT[2] = dz * c + crz * s + az * k;
  return ROT;
}

/* ── ГПСЧ ─────────────────────────────────────────────────
   mulberry32: четыре целочисленные операции на число, период
   достаточный для наших нескольких тысяч выборок. Главное - он
   детерминирован, а Math.random берём только когда seed не задан,
   то есть когда повторяемость никому не нужна. */
function rngFrom(seed) {
  var a = (seed >>> 0) || 0x9E3779B9;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Шум Перлина в трёх измерениях ────────────────────────
   Градиентный, а не значенческий: значенческий дешевле, но даёт
   заметную квадратную сетку, а на планете это читается как
   клетчатая ткань. Таблицу перестановок мешаем нашим ГПСЧ,
   поэтому весь ландшафт зависит от seed. */
function makeNoise(rnd) {
  var perm = new Uint16Array(512);
  var base = new Uint8Array(256);
  var i, j, t;
  for (i = 0; i < 256; i++) base[i] = i;
  for (i = 255; i > 0; i--) {
    j = (rnd() * (i + 1)) | 0;
    t = base[i]; base[i] = base[j]; base[j] = t;
  }
  for (i = 0; i < 512; i++) perm[i] = base[i & 255];

  function grad(hash, x, y, z) {
    var h = hash & 15;
    var u = h < 8 ? x : y;
    var v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  function noise(x, y, z) {
    var fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    var X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    var u = x * x * x * (x * (x * 6 - 15) + 10);
    var v = y * y * y * (y * (y * 6 - 15) + 10);
    var w = z * z * z * (z * (z * 6 - 15) + 10);
    var A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    var B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    var x1 = lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u);
    var x2 = lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u);
    var y1 = lerp(x1, x2, v);
    x1 = lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u);
    x2 = lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u);
    return lerp(y1, lerp(x1, x2, v), w);
  }

  /* Классический фрактальный шум: сумма октав с удвоением частоты.
     Лакунарность 2.03, а не ровно 2 - иначе октавы попадают в фазу
     и по текстуре идут решётчатые повторы. */
  function fbm(x, y, z, oct) {
    var amp = 1, frq = 1, sum = 0, norm = 0;
    for (var k = 0; k < oct; k++) {
      sum += amp * noise(x * frq, y * frq, z * frq);
      norm += amp;
      amp *= 0.5; frq *= 2.03;
    }
    return sum / norm;
  }

  /* Хребтовый шум: излом по модулю даёт острые гребни, а квадрат
     делает их тоньше. Так получаются горные цепи, обычный fbm даёт
     только пологие холмы. */
  function ridged(x, y, z, oct) {
    var amp = 1, frq = 1, sum = 0, norm = 0, v;
    for (var k = 0; k < oct; k++) {
      v = 1 - Math.abs(noise(x * frq, y * frq, z * frq));
      v *= v;
      sum += amp * v;
      norm += amp;
      amp *= 0.52; frq *= 2.11;
    }
    return sum / norm;
  }

  return { n: noise, fbm: fbm, ridged: ridged };
}

/* ── Поле низкой частоты на четверти разрешения ───────────
   Первые октавы меняются медленно: считать их в каждом пикселе
   расточительно. Считаем на сетке вчетверо реже и разворачиваем
   билинейно - на глаз разницы нет, вызовов шума в шестнадцать раз
   меньше. Последний столбец повторяет первый, чтобы не появился
   шов на нулевом меридиане. */
function lowField(W, H, fn) {
  var w = (W >> 2) + 1, h = (H >> 2) + 1;
  var a = new Float32Array(w * h);
  var qy, qx, py, px, lat, cy, sy, lon;
  for (qy = 0; qy < h; qy++) {
    py = Math.min(qy << 2, H - 1);
    lat = (0.5 - (py + 0.5) / H) * PI;
    cy = Math.cos(lat); sy = Math.sin(lat);
    for (qx = 0; qx < w; qx++) {
      px = (qx << 2) % W;
      lon = ((px + 0.5) / W) * TAU;
      a[qy * w + qx] = fn(cy * Math.cos(lon), sy, cy * Math.sin(lon), lat);
    }
  }
  return { w: w, h: h, a: a };
}
function sampleLow(f, x, y) {
  var fx = x * 0.25, fy = y * 0.25;
  var ix = fx | 0, iy = fy | 0;
  var tx = fx - ix, ty = fy - iy;
  if (ix > f.w - 2) ix = f.w - 2;
  if (iy > f.h - 2) iy = f.h - 2;
  var i0 = iy * f.w + ix, i1 = i0 + f.w;
  var a = f.a;
  return lerp(lerp(a[i0], a[i0 + 1], tx), lerp(a[i1], a[i1 + 1], tx), ty);
}

/* ── Цвет ────────────────────────────────────────────────
   Палитра задана опорными точками, но в пиксельном цикле искать по
   ним дорого. Разворачиваем каждую палитру в таблицу на 256
   ступеней один раз: дальше это одно индексирование вместо поиска
   и трёх интерполяций. Ступени не видны, их прячет зерно. */
var OUT = [0, 0, 0];
function rampAt(pal, t) {
  t = clamp(t, 0, 1);
  var i = 0, last = pal.length - 1;
  while (i < last && t > pal[i + 1][0]) i++;
  var a = pal[i], b = pal[i < last ? i + 1 : last];
  var d = b[0] - a[0];
  var f = d > 0 ? (t - a[0]) / d : 0;
  OUT[0] = a[1] + (b[1] - a[1]) * f;
  OUT[1] = a[2] + (b[2] - a[2]) * f;
  OUT[2] = a[3] + (b[3] - a[3]) * f;
  return OUT;
}
function palLUT(pal) {
  var lut = new Float32Array(768);
  for (var i = 0; i < 256; i++) {
    var c = rampAt(pal, i / 255);
    lut[i * 3] = c[0]; lut[i * 3 + 1] = c[1]; lut[i * 3 + 2] = c[2];
  }
  return lut;
}

/* Оттенок клиента подмешиваем множителем с сохранением яркости:
   если просто смешать с цветом, планета выцветает в однотонное
   пятно и теряет весь рельеф. */
function tintFactors(hex) {
  var r = (hex >> 16) & 255, gg = (hex >> 8) & 255, b = hex & 255;
  var k = (r + gg + b) / 3;
  if (k < 1) k = 1;
  return [r / k, gg / k, b / k];
}

/* ── Холсты ─────────────────────────────────────────────── */
function canvas2d(w, h) {
  var c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
function texFrom(canvas, srgb) {
  var tx = new T.CanvasTexture(canvas);
  tx.wrapS = T.RepeatWrapping;          /* долгота замкнута */
  tx.wrapT = T.ClampToEdgeWrapping;     /* широта нет, иначе полюс подмешает экватор */
  tx.anisotropy = 8;                    /* three сам обрежет до предела железа */
  if (srgb) {
    if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
    else if (T.sRGBEncoding) tx.encoding = T.sRGBEncoding;
  }
  tx.needsUpdate = true;
  return tx;
}

/* ── Порог по гистограмме ────────────────────────────────
   Уровень моря нельзя задавать константой: у каждого seed свой
   размах высот, и на одном выходит сплошная суша, на другом
   сплошная вода. Берём такой порог, чтобы доля суши совпала с
   задуманной для типа планеты. */
function levelForFraction(arr, want) {
  var bins = new Uint32Array(512), i, n = arr.length;
  var mn = Infinity, mx = -Infinity, v;
  for (i = 0; i < n; i++) { v = arr[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
  var span = mx - mn; if (span < 1e-6) span = 1e-6;
  for (i = 0; i < n; i++) bins[((arr[i] - mn) / span * 511) | 0]++;
  var need = n * (1 - want), acc = 0;
  for (i = 0; i < 512; i++) {
    acc += bins[i];
    if (acc >= need) break;
  }
  return { level: mn + (i / 511) * span, min: mn, max: mx };
}

/* ── Кратеры ─────────────────────────────────────────────
   Рисуем не по всей карте, а по прямоугольнику вокруг каждого
   кратера: перебирать полмиллиона пикселей на каждый из пятисот
   кратеров нельзя. Ширину прямоугольника делим на косинус широты,
   иначе у полюсов кратер обрежется по бокам.

   Профиль настоящего ударного кратера: чаша ниже уровня,
   приподнятый вал по краю и выброс наружу. Свежие кратеры дают
   ещё и лучи - светлые полосы по азимуту, у Тихо они тянутся на
   пол-Луны и сразу выдают возраст поверхности. */
function stampCraters(h, alb, W, H, rnd, count, depthK) {
  var i, k;
  for (k = 0; k < count; k++) {
    /* Мелких кратеров на порядок больше крупных - степенное
       распределение, как в реальности */
    var u = rnd();
    var ar = 0.005 + 0.090 * u * u * u;             /* угловой радиус, радианы */
    var clat = Math.asin(rnd() * 2 - 1);
    var clon = rnd() * TAU;
    var fresh = rnd();
    /* Лучи бывают только у молодых крупных кратеров: у Луны их
       единицы на всю поверхность. Если раздать лучи всем подряд,
       поверхность превращается в ковёр из снежинок. */
    var rays = ar > 0.028 && fresh > 0.86;
    var raySeed = (rnd() * 100000) | 0;

    var cdx = Math.cos(clat) * Math.cos(clon), cdy = Math.sin(clat), cdz = Math.cos(clat) * Math.sin(clon);
    var outer = ar * (rays ? 4.2 : 1.75);
    var y0 = Math.max(0, Math.floor((0.5 - (clat + outer) / PI) * H));
    var y1 = Math.min(H - 1, Math.ceil((0.5 - (clat - outer) / PI) * H));
    var lonSpan = outer / Math.max(0.08, Math.cos(clat));
    if (lonSpan > PI) lonSpan = PI;
    var xc = (clon / TAU) * W;
    var xw = (lonSpan / TAU) * W;
    var x0 = Math.floor(xc - xw), x1 = Math.ceil(xc + xw);

    for (var y = y0; y <= y1; y++) {
      var lat = (0.5 - (y + 0.5) / H) * PI;
      var cy = Math.cos(lat), sy = Math.sin(lat);
      var row = y * W;
      for (var x = x0; x <= x1; x++) {
        var xi = x % W; if (xi < 0) xi += W;
        var lon = ((xi + 0.5) / W) * TAU;
        var ux = cy * Math.cos(lon), uy = sy, uz = cy * Math.sin(lon);
        var dot = ux * cdx + uy * cdy + uz * cdz;
        if (dot > 1) dot = 1; else if (dot < -1) dot = -1;
        var d = Math.acos(dot) / ar;                 /* 1.0 = кромка вала */
        var idx = row + xi;
        if (d < 1.0) {
          /* Чаша: параболическое дно, к валу поднимается */
          var floorD = -depthK * ar * (1 - d * d * 0.55) * 0.9;
          var rim = Math.exp(-Math.pow((d - 0.88) * 7.0, 2)) * depthK * ar * 0.95;
          h[idx] += floorD + rim;
          /* Альбедо трогаем слабо: форму кратера должен лепить свет
             по карте высот, а не нарисованное кольцо. Нарисованное
             кольцо светится и с теневой стороны и сразу выдаёт себя. */
          alb[idx] += (d > 0.80 ? 0.07 : -0.06) * (0.45 + fresh * 0.55);
        } else if (d < 1.75) {
          /* Выброс: тонкое одеяло вокруг, чуть светлее фона */
          var f = (1.75 - d) / 0.75;
          h[idx] += depthK * ar * 0.24 * f * f;
          alb[idx] += 0.07 * f * fresh;
        }
        if (rays && d >= 1.1 && d < 4.2) {
          /* Лучи. Косинус по азимуту дал бы ровную «снежинку», а у
             настоящих лучей длина и яркость разные: делим круг на
             сектора и каждому раздаём свою длину по хэшу. */
          var ex = ux - cdx * dot, ey = uy - cdy * dot, ez = uz - cdz * dot;
          var az = Math.atan2(ey, ex + ez * 0.5);
          var sk = (az + PI) / TAU * 42;
          var ki = Math.floor(sk), kfr = sk - ki;
          kfr = kfr * kfr * (3 - 2 * kfr);
          var s = lerp(hash01(ki + raySeed), hash01(ki + 1 + raySeed), kfr);
          var len = 1.1 + s * s * 3.1;
          if (d < len) {
            var fade = (len - d) / (len - 1.1);
            alb[idx] += Math.pow(s, 2.6) * fade * fade * 0.30;
          }
        }
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════════
   Палитры. Значения сняты с орбитальных снимков: земные океаны
   почти чёрные на глубине и бирюзовые на шельфе, растительность
   уходит не в изумруд, а в тёмно-оливковый, снег никогда не бывает
   чисто белым, лунный реголит - серый с бурым подтоном.
   ═══════════════════════════════════════════════════════════ */
var PAL = {
  sea: [
    [0.00, 5, 17, 48], [0.30, 9, 33, 78], [0.58, 15, 63, 116],
    [0.80, 31, 106, 150], [0.92, 64, 154, 178], [1.00, 110, 192, 202]
  ],
  landWet: [
    [0.00, 196, 180, 138], [0.03, 104, 130, 68], [0.12, 46, 92, 44],
    [0.32, 38, 78, 38], [0.50, 66, 88, 46], [0.70, 100, 98, 74],
    [0.86, 126, 122, 114], [1.00, 232, 238, 244]
  ],
  landDry: [
    [0.00, 210, 190, 146], [0.05, 194, 166, 112], [0.20, 168, 134, 88],
    [0.42, 144, 116, 78], [0.62, 128, 108, 84], [0.80, 124, 118, 108],
    [0.90, 148, 142, 134], [1.00, 232, 238, 244]
  ],
  desert: [
    [0.00, 150, 98, 58], [0.16, 188, 138, 80], [0.36, 218, 176, 114],
    [0.54, 232, 196, 138], [0.70, 196, 148, 92], [0.86, 152, 104, 62],
    [1.00, 214, 204, 190]
  ],
  rock: [
    [0.00, 32, 31, 31], [0.20, 58, 57, 56], [0.42, 88, 87, 85],
    [0.66, 120, 119, 116], [0.86, 156, 155, 151], [1.00, 200, 199, 194]
  ],
  ice: [
    [0.00, 96, 132, 168], [0.26, 150, 184, 212], [0.52, 196, 222, 240],
    [0.76, 226, 240, 250], [1.00, 246, 251, 255]
  ],
  crust: [
    [0.00, 10, 8, 9], [0.30, 26, 20, 20], [0.55, 44, 34, 31],
    [0.78, 66, 52, 45], [1.00, 96, 80, 70]
  ],
  hot: [
    [0.00, 40, 3, 0], [0.34, 120, 18, 2], [0.60, 206, 62, 5],
    [0.82, 246, 128, 22], [0.94, 255, 178, 62], [1.00, 255, 210, 118]
  ],
  gas: [
    [0.00, 88, 60, 44], [0.15, 142, 98, 62], [0.32, 192, 148, 96],
    [0.50, 226, 198, 154], [0.68, 246, 234, 210], [0.84, 210, 188, 152],
    [1.00, 150, 122, 90]
  ],
  toxic: [
    [0.00, 92, 92, 38], [0.18, 138, 134, 56], [0.40, 184, 176, 82],
    [0.60, 212, 204, 118], [0.80, 234, 226, 162], [1.00, 248, 242, 202]
  ]
};

/* Настройки рельефа по типам: доля суши, частоты, сколько октав.
   Октавы считаем скупо - каждая лишняя это ещё полмиллиона
   вызовов шума на карту. */
var TERRAIN = {
  terran: { land: 0.29, freq: 2.4, oct: 4, ridge: 0.60, rOct: 4, warp: 0.42, craters: 0, bump: 0.055 },
  ocean: { land: 0.14, freq: 2.2, oct: 4, ridge: 0.40, rOct: 3, warp: 0.40, craters: 0, bump: 0.040 },
  desert: { land: 0.97, freq: 2.7, oct: 4, ridge: 0.75, rOct: 4, warp: 0.55, craters: 110, bump: 0.085 },
  rocky: { land: 1.00, freq: 2.2, oct: 4, ridge: 0.45, rOct: 3, warp: 0.35, craters: 560, bump: 0.30 },
  ice: { land: 1.00, freq: 2.0, oct: 4, ridge: 0.38, rOct: 3, warp: 0.30, craters: 150, bump: 0.075 },
  lava: { land: 1.00, freq: 2.5, oct: 4, ridge: 0.55, rOct: 3, warp: 0.50, craters: 45, bump: 0.090 }
};

/* ═══════════════════════════════════════════════════════════
   Карты каменистых, ледяных и водных планет
   ═══════════════════════════════════════════════════════════ */
function terrainMaps(kind, W, H, rnd, N, tf, opts) {
  var cfg = TERRAIN[kind] || TERRAIN.rocky;
  var n = W * H;
  var h = new Float32Array(n);
  var alb = new Float32Array(n);
  var i, x, y;
  var lowd = opts.detail === "low";

  /* Смещение выборки: без него все планеты на разных seed всё равно
     тянутся из одной области шума и выходят похожими */
  var o1 = rnd() * 400 - 200, o2 = rnd() * 400 - 200, o3 = rnd() * 400 - 200;

  /* Поля низкой частоты. Искажение координат - главный приём против
     «шума из учебника»: оно гнёт линии берега, и континенты
     перестают быть симметричными кляксами. */
  var wpX = lowField(W, H, function (dx, dy, dz) { return N.fbm(dx * 1.5 + o1, dy * 1.5, dz * 1.5, 3); });
  var wpY = lowField(W, H, function (dx, dy, dz) { return N.fbm(dx * 1.5, dy * 1.5 + o2, dz * 1.5, 3); });
  var wpZ = lowField(W, H, function (dx, dy, dz) { return N.fbm(dx * 1.5, dy * 1.5, dz * 1.5 + o3, 3); });
  var cf = cfg.freq * 0.5;
  var cont = lowField(W, H, function (dx, dy, dz) {
    return N.fbm(dx * cf + o1, dy * cf, dz * cf + o2, 3);
  });
  /* Влажность: размах шума растягиваем в полный диапазон, иначе всё
     садится вокруг середины и планета выходит однотонной */
  var wet = lowField(W, H, function (dx, dy, dz) {
    return clamp(N.fbm(dx * 1.7 + o3, dy * 1.7 - o1, dz * 1.7, 3) * 1.9 + 0.5, 0, 1);
  });

  var cosLon = new Float32Array(W), sinLon = new Float32Array(W);
  for (x = 0; x < W; x++) {
    var lo = ((x + 0.5) / W) * TAU;
    cosLon[x] = Math.cos(lo); sinLon[x] = Math.sin(lo);
  }

  var wa = cfg.warp, fq = cfg.freq, hi = cfg.oct;

  for (y = 0; y < H; y++) {
    var lat = (0.5 - (y + 0.5) / H) * PI;
    var cy = Math.cos(lat), sy = Math.sin(lat);
    var row = y * W;
    for (x = 0; x < W; x++) {
      var dx = cy * cosLon[x], dy = sy, dz = cy * sinLon[x];
      var wx = dx + sampleLow(wpX, x, y) * wa;
      var wy = dy + sampleLow(wpY, x, y) * wa;
      var wz = dz + sampleLow(wpZ, x, y) * wa;
      /* Крупная часть уже посчитана на редкой сетке; её доля выше,
         иначе материки рассыпаются на архипелаг мелких клякс */
      h[row + x] = sampleLow(cont, x, y) * 0.74 +
        N.fbm(wx * fq * 2.4, wy * fq * 2.4, wz * fq * 2.4, hi) * 0.26;
    }
  }

  var lv = levelForFraction(h, cfg.land);
  var sea = lv.level, hmax = lv.max, hmin = lv.min;
  var upSpan = Math.max(1e-4, hmax - sea);
  var dnSpan = Math.max(1e-4, sea - hmin);

  /* Горные цепи поверх суши: хребтовый шум, но только там, где уже
     поднялось. Иначе хребты вырастают посреди океана. */
  var isDesert = kind === "desert";
  if (cfg.ridge > 0) {
    for (y = 0; y < H; y++) {
      var la2 = (0.5 - (y + 0.5) / H) * PI;
      var c2 = Math.cos(la2), s2 = Math.sin(la2);
      var r2 = y * W;
      for (x = 0; x < W; x++) {
        var e0 = (h[r2 + x] - sea) / upSpan;
        if (e0 <= 0.02) continue;
        var ax = c2 * cosLon[x], ay = s2, az = c2 * sinLon[x];
        var rg = N.ridged(ax * fq * 3.1 + o2, ay * fq * 3.1, az * fq * 3.1 - o3, cfg.rOct);
        /* Множитель на высоту: у берега гор нет, они растут вглубь материка */
        h[r2 + x] += (rg - 0.32) * cfg.ridge * upSpan * Math.min(1, e0 * 2.2);
        if (isDesert) {
          /* Дюны: шум сжат по долготе и растянут по широте, из-за
             чего гребни выстраиваются длинными параллельными
             грядами поперёк ветра */
          var dn = N.ridged(ax * 7.0 + o1, ay * 26.0, az * 7.0, 2);
          h[r2 + x] += (dn - 0.38) * 0.16 * upSpan;
        }
      }
    }
    lv = levelForFraction(h, cfg.land);
    sea = lv.level; hmax = lv.max; hmin = lv.min;
    upSpan = Math.max(1e-4, hmax - sea);
    dnSpan = Math.max(1e-4, sea - hmin);
  }

  var craters = cfg.craters;
  if (lowd) craters = (craters * 0.45) | 0;
  if (craters > 0) stampCraters(h, alb, W, H, rnd, craters, kind === "rocky" ? 1.9 : 1.1);

  /* ── Раскраска ──────────────────────────────────────── */
  var cCan = canvas2d(W, H), bCan = canvas2d(W, H);
  var cCtx = cCan.getContext("2d"), bCtx = bCan.getContext("2d");
  var cImg = cCtx.createImageData(W, H), bImg = bCtx.createImageData(W, H);
  var cD = cImg.data, bD = bImg.data;
  var wantSpec = (kind === "terran" || kind === "ocean" || kind === "ice");
  var sCan = null, sD = null, sImg = null, sCtx = null;
  if (wantSpec) {
    sCan = canvas2d(W, H); sCtx = sCan.getContext("2d");
    sImg = sCtx.createImageData(W, H); sD = sImg.data;
  }

  var isIce = kind === "ice", isLava = kind === "lava", isRock = kind === "rocky";
  var isWater = (kind === "terran" || kind === "ocean");

  var LSEA = palLUT(PAL.sea);
  var LWET = palLUT(PAL.landWet), LDRY = palLUT(PAL.landDry);
  var LDES = palLUT(PAL.desert), LROCK = palLUT(PAL.rock);
  var LICE = palLUT(PAL.ice), LCRUST = palLUT(PAL.crust), LHOT = palLUT(PAL.hot);

  var capLat = kind === "terran" ? 0.80 : (kind === "ocean" ? 0.85 : 0.87);
  var hasCap = isWater || isDesert;

  var eCan = null, eCtx = null, eImg = null, eD = null;
  if (isLava) {
    eCan = canvas2d(W, H); eCtx = eCan.getContext("2d");
    eImg = eCtx.createImageData(W, H); eD = eImg.data;
  }

  /* Частоты сети разломов. Трещины ищем как нулевую линию шума:
     ridged суммирует октавы и линия расплывается, а переход через
     ноль даёт настоящую тонкую борозду. Октав здесь мало нарочно:
     от высоких октав поле дрожит вокруг нуля и линия рассыпается
     в пунктир, а разлом обязан быть непрерывным. */
  var kf1 = fq * (isIce ? 3.0 : 1.5), kf2 = fq * (isIce ? 6.6 : 3.4);
  var kOct = lowd ? 2 : 3;
  var kw1 = isIce ? 14 : 19, kw2 = isIce ? 26 : 36;

  for (y = 0; y < H; y++) {
    var la = (0.5 - (y + 0.5) / H) * PI;
    var cyy = Math.cos(la), syy = Math.sin(la);
    var absLat = Math.abs(la) / (PI * 0.5);
    /* Климатические пояса: влажный экватор, сухие тридцатые широты,
       снова влажные умеренные, холодные приполярные. Пояс сухости
       узкий и неглубокий - если сделать его широким, вся планета
       уходит в песок и зелени не остаётся вовсе. */
    var dryBelt = Math.exp(-Math.pow((absLat - 0.32) * 5.4, 2)) * 0.52;
    var tropic = Math.exp(-Math.pow(absLat * 3.0, 2)) * 0.52;
    var cold = smooth(0.60, 0.95, absLat);
    var snowLine = 0.58 - absLat * 0.46;
    var r3 = y * W;
    for (x = 0; x < W; x++) {
      i = r3 + x;
      var p4 = i << 2;
      var hv = h[i];
      var r, gc, b, bump, spec = 0, lk;
      var ddx = cyy * cosLon[x], ddy = syy, ddz = cyy * sinLon[x];
      var m = sampleLow(wet, x, y);

      if (hv < sea && isWater) {
        /* Вода. Цвет по глубине, у берега светлый шельф - именно эта
           бирюзовая кайма читается глазом как «живая планета» */
        var dep = clamp((sea - hv) / dnSpan, 0, 1);
        lk = (clamp(1 - Math.pow(dep, 0.5), 0, 1) * 255 | 0) * 3;
        r = LSEA[lk]; gc = LSEA[lk + 1]; b = LSEA[lk + 2];
        /* Ледяная кромка у полюсов: вода замерзает раньше суши */
        var fz = smooth(capLat - 0.08, capLat + 0.10, absLat + (m - 0.5) * 0.07);
        if (fz > 0) {
          r = lerp(r, 214, fz); gc = lerp(gc, 230, fz); b = lerp(b, 240, fz);
        }
        bump = 0.5;                       /* вода плоская, рельеф ей вреден */
        spec = 255 * (1 - fz * 0.9);      /* блик солнца только по открытой воде */
      } else {
        var e = clamp((hv - sea) / upSpan, 0, 1);
        /* Ступень палитры искривляем: без этого почти вся суша
           попадает в первые проценты шкалы и планета выходит
           сплошь песочной, без равнин и лесов */
        var ec = Math.pow(e, 0.45);

        if (isLava) {
          lk = (clamp(ec * 0.85 + m * 0.15, 0, 1) * 255 | 0) * 3;
          r = LCRUST[lk]; gc = LCRUST[lk + 1]; b = LCRUST[lk + 2];
        } else if (isIce) {
          lk = (clamp(ec * 0.72 + 0.08 + m * 0.20, 0, 1) * 255 | 0) * 3;
          r = LICE[lk]; gc = LICE[lk + 1]; b = LICE[lk + 2];
        } else if (isRock) {
          /* Моря: тёмные базальтовые равнины в низинах, как на Луне */
          var mare = smooth(0.46, 0.16, ec) * smooth(0.34, 0.64, m);
          lk = (clamp(ec * 0.80 + 0.10, 0, 1) * 255 | 0) * 3;
          r = lerp(LROCK[lk], 48, mare * 0.85);
          gc = lerp(LROCK[lk + 1], 46, mare * 0.85);
          b = lerp(LROCK[lk + 2], 45, mare * 0.85);
        } else if (isDesert) {
          lk = (clamp(ec * 0.82 + m * 0.18, 0, 1) * 255 | 0) * 3;
          r = LDES[lk]; gc = LDES[lk + 1]; b = LDES[lk + 2];
          /* Солончаки. Раньше они брались узкой полосой высот и
             обводили возвышенности белым контуром, как горизонталь
             на карте. Соль садится в котловинах, поэтому берём
             площадь низин, а не изолинию. */
          var salt = smooth(0.34, 0.10, ec) * smooth(0.42, 0.74, m) * 0.85;
          r = lerp(r, 228, salt); gc = lerp(gc, 220, salt); b = lerp(b, 202, salt);
        } else {
          /* Земной тип. Влажность плюс климатические пояса решают,
             будет ли здесь лес или пустыня */
          var wetK = clamp(m * 1.15 + tropic - dryBelt, 0, 1) * (1 - cold * 0.55);
          lk = (clamp(ec, 0, 1) * 255 | 0) * 3;
          r = lerp(LDRY[lk], LWET[lk], wetK);
          gc = lerp(LDRY[lk + 1], LWET[lk + 1], wetK);
          b = lerp(LDRY[lk + 2], LWET[lk + 2], wetK);
          /* Тундра: у полюсов зелень уходит в бурый мох */
          if (cold > 0) {
            r = lerp(r, 128, cold * 0.32); gc = lerp(gc, 120, cold * 0.32); b = lerp(b, 102, cold * 0.32);
          }
          /* Пляж: тонкая песчаная кромка ровно на урезе воды */
          var beach = smooth(0.10, 0.0, ec);
          r = lerp(r, 200, beach * 0.75); gc = lerp(gc, 182, beach * 0.75); b = lerp(b, 140, beach * 0.75);
          /* Снеговая линия зависит от широты: в тропиках снег только
             на вершинах, у полюсов лежит почти везде */
          var snow = smooth(snowLine, snowLine + 0.12, e);
          r = lerp(r, 238, snow); gc = lerp(gc, 242, snow); b = lerp(b, 248, snow);
          spec = 12 + snow * 60;
        }

        /* Сеть разломов для льда и лавы. У разлома два масштаба:
           узкое раскалённое ядро и широкая тёплая зона вокруг него,
           где порода только начала плавиться. Одно ядро без зоны
           выглядит нарисованной проволокой. */
        var crack = 0, core = 0;
        if (isIce || isLava) {
          var a1 = Math.abs(N.fbm(ddx * kf1 + o1, ddy * kf1, ddz * kf1 + o2, kOct));
          var a2 = Math.abs(N.fbm(ddx * kf2 - o3, ddy * kf2, ddz * kf2, 2));
          core = clamp(1 - a1 * kw1, 0, 1);
          var wide = clamp(1 - a1 * kw1 * 0.26, 0, 1);
          var fine = clamp(1 - a2 * kw2, 0, 1);
          crack = clamp(core + wide * wide * 0.42 + fine * fine * 0.40, 0, 1);
        }
        if (isIce) {
          /* Поля хаоса: участки, где лёд когда-то подтаял и застыл
             мозаикой. На Европе они серо-голубые и занимают заметную
             часть диска, без них шар выглядит фарфоровым. */
          var chaos = smooth(0.40, 0.70, m) * smooth(0.56, 0.28, ec);
          if (chaos > 0) {
            r = lerp(r, 138, chaos * 0.62); gc = lerp(gc, 154, chaos * 0.62); b = lerp(b, 172, chaos * 0.62);
          }
          /* Толины: органика вдоль трещин красит их в рыжий, как на
             Европе. Красим по ядру, а не по всей зоне, иначе весь
             лёд уходит в бежевый и перестаёт быть льдом. */
          if (crack > 0) {
            var st2 = clamp(core * 0.90 + crack * 0.16, 0, 1);
            r = lerp(r, 146, st2 * 0.72);
            gc = lerp(gc, 106, st2 * 0.72);
            b = lerp(b, 94, st2 * 0.66);
          }
        }
        if (isLava) {
          /* Плиты: там, где кора устоялась, разломов почти нет.
             Без этого планета покрыта ровной сеткой и похожа на
             раскалённую рабицу. */
          var plate = clamp(N.fbm(ddx * 1.7 + o2, ddy * 1.7, ddz * 1.7 - o1, 3) * 1.7 + 0.50, 0, 1);
          var pool = smooth(0.36, 0.08, ec) * smooth(0.38, 0.72, m);
          /* Температура вдоль русла разная: где-то поток свежий и
             жёлтый, где-то уже подёрнулся коркой и тлеет красным.
             Ровно горячий разлом по всей длине выглядит неоновой
             трубкой, а не расплавом. */
          var heat = clamp(crack * (0.45 + plate * 0.85) * (0.55 + m * 0.80) + pool * 0.55, 0, 1);
          lk = (heat * 255 | 0) * 3;
          /* Кора вокруг разлома подсвечена снизу: даже остывший
             базальт рядом с руслом отдаёт красным */
          var bleed = Math.min(1, heat * 1.1);
          r = lerp(r, LHOT[lk] * 0.50, bleed);
          gc = lerp(gc, LHOT[lk + 1] * 0.50, bleed);
          b = lerp(b, LHOT[lk + 2] * 0.50, bleed);
          var eK = Math.pow(heat, 1.35);
          eD[p4] = LHOT[lk] * eK;
          eD[p4 + 1] = LHOT[lk + 1] * eK;
          eD[p4 + 2] = LHOT[lk + 2] * eK;
          eD[p4 + 3] = 255;
        }

        /* Кратерное альбедо поверх всего: валы светлее, дно темнее */
        var av = alb[i];
        if (av !== 0) {
          var kk = 1 + clamp(av, -0.40, 0.60);
          r *= kk; gc *= kk; b *= kk;
        }

        /* Полярная шапка. Граница рваная: ровный круг сразу выдаёт
           процедурную планету. */
        if (hasCap) {
          var edge = absLat + (m - 0.5) * 0.12 + e * 0.06;
          var cap = smooth(capLat - 0.06, capLat + 0.08, edge);
          if (cap > 0) {
            r = lerp(r, 240, cap); gc = lerp(gc, 245, cap); b = lerp(b, 252, cap);
            spec = Math.max(spec, 90 * cap);
          }
        }
        if (isIce) spec = 130 - core * 70;   /* борозда шершавая, лёд рядом с ней зеркальный */
        bump = 0.5 + clamp(e, 0, 1) * 0.5;
        if (isIce || isLava) bump = clamp(bump - core * 0.34 - crack * 0.10, 0, 1);
        if (isRock) {
          /* Реголит: мелкая рябь поверх крупного рельефа. Без неё
             между кратерами остаётся гладкий пластик, который на
             скользящем свете сразу выдаёт компьютер. */
          bump = clamp(bump + N.fbm(ddx * 26.0 + o3, ddy * 26.0, ddz * 26.0, 2) * 0.09, 0, 1);
        }
      }

      /* Зерно: реальная поверхность не бывает гладкой даже на
         пределе разрешения, а заодно оно прячет ступени палитры */
      var grain = grainAt(x, y) * 7;
      r += grain; gc += grain; b += grain;

      r *= tf[0]; gc *= tf[1]; b *= tf[2];

      cD[p4] = r; cD[p4 + 1] = gc; cD[p4 + 2] = b; cD[p4 + 3] = 255;
      var bv = bump * 255;
      bD[p4] = bv; bD[p4 + 1] = bv; bD[p4 + 2] = bv; bD[p4 + 3] = 255;
      if (sD) { sD[p4] = spec; sD[p4 + 1] = spec; sD[p4 + 2] = spec; sD[p4 + 3] = 255; }
    }
  }

  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  if (sD) sCtx.putImageData(sImg, 0, 0);
  if (eD) eCtx.putImageData(eImg, 0, 0);

  /* ── Ночные огни ────────────────────────────────────────
     Рисуем не пикселями, а размытыми пятнами через градиенты
     холста: город с орбиты - это ореол с ярким ядром, а не точка,
     и canvas отдаёт такое размытие бесплатно. */
  if (kind === "terran") {
    eCan = canvas2d(W, H);
    eCtx = eCan.getContext("2d");
    eCtx.fillStyle = "#000";
    eCtx.fillRect(0, 0, W, H);
    eCtx.globalCompositeOperation = "lighter";
    var sites = lowd ? 240 : 600, placed = 0, tries = 0;
    var popF = lowField(W, H, function (dx, dy, dz) {
      return clamp(N.fbm(dx * 3.0 - o2, dy * 3.0, dz * 3.0 + o1, 3) * 1.7 + 0.5, 0, 1);
    });
    while (placed < sites && tries < sites * 40) {
      tries++;
      var px = (rnd() * W) | 0, py = (rnd() * H) | 0;
      var hh = h[py * W + px];
      if (hh <= sea) continue;
      var ee = (hh - sea) / upSpan;
      if (ee > 0.55) continue;                       /* в горах городов нет */
      var laa = Math.abs((0.5 - (py + 0.5) / H) * PI) / (PI * 0.5);
      if (laa > 0.76) continue;                      /* и за полярным кругом тоже */
      var pop = sampleLow(popF, px, py);
      /* Побережье заселено плотнее - так выглядит любая ночная Земля */
      var coast = smooth(0.28, 0.02, ee);
      if (rnd() > pop * pop * (0.30 + coast * 1.0)) continue;
      placed++;
      var rad = (2 + rnd() * rnd() * 24) * (W / 1024);
      var bright = 0.18 + pop * 0.50 * rnd();
      var col1 = rnd() < 0.80 ? "rgba(255,210,142," : "rgba(184,220,255,";
      for (var rep = -1; rep <= 1; rep++) {
        var cx = px + rep * W;
        if (cx < -rad || cx > W + rad) continue;
        var grd = eCtx.createRadialGradient(cx, py, 0, cx, py, rad);
        grd.addColorStop(0, col1 + bright.toFixed(3) + ")");
        grd.addColorStop(0.35, col1 + (bright * 0.32).toFixed(3) + ")");
        grd.addColorStop(1, "rgba(0,0,0,0)");
        eCtx.fillStyle = grd;
        eCtx.fillRect(cx - rad, py - rad, rad * 2, rad * 2);
      }
      eCtx.fillStyle = col1 + Math.min(1, bright * 2.4).toFixed(3) + ")";
      eCtx.fillRect(px - 0.5, py - 0.5, 1.7, 1.7);
    }
    eCtx.globalCompositeOperation = "source-over";
  }

  return { color: cCan, bump: bCan, spec: sCan, emis: eCan, h: h, sea: sea };
}

/* ═══════════════════════════════════════════════════════════
   Карты газовых гигантов и планет с плотной атмосферой
   ═══════════════════════════════════════════════════════════ */
function gasMaps(kind, W, H, rnd, N, tf, opts) {
  var cCan = canvas2d(W, H), bCan = canvas2d(W, H);
  var cCtx = cCan.getContext("2d"), bCtx = bCan.getContext("2d");
  var cImg = cCtx.createImageData(W, H), bImg = bCtx.createImageData(W, H);
  var cD = cImg.data, bD = bImg.data;
  var LP = palLUT(kind === "toxic" ? PAL.toxic : PAL.gas);
  var lowd = opts.detail === "low";

  var isTox = kind === "toxic";

  /* Полосы - сумма гармоник по широте. Считаем один раз в таблицу:
     на пиксель приходится одна выборка вместо десятка синусов.
     У ядовитой атмосферы полос мало и они широкие: на Венере видна
     не полосатость Юпитера, а несколько огромных потоков. */
  var nb = isTox ? (3 + ((rnd() * 3) | 0)) : (7 + ((rnd() * 5) | 0));
  var bf = [], ba = [], bp = [], i, k;
  for (i = 0; i < nb; i++) {
    bf.push(2.2 + i * 2.4 + rnd() * 1.8);
    ba.push(1 / (1 + i * 0.5));
    bp.push(rnd() * TAU);
  }
  var LUTN = 2048;
  var lut = new Float32Array(LUTN), dlut = new Float32Array(LUTN);
  for (i = 0; i < LUTN; i++) {
    var t = (i / (LUTN - 1)) * 2 - 1;
    var s = 0, nn = 0;
    for (k = 0; k < nb; k++) { s += ba[k] * Math.sin(t * bf[k] * PI + bp[k]); nn += ba[k]; }
    lut[i] = 0.5 + 0.5 * (s / nn);
  }
  for (i = 1; i < LUTN - 1; i++) dlut[i] = Math.abs(lut[i + 1] - lut[i - 1]) * 60;
  dlut[0] = dlut[1]; dlut[LUTN - 1] = dlut[LUTN - 2];

  var o1 = rnd() * 300 - 150, o2 = rnd() * 300 - 150, o3 = rnd() * 300 - 150;

  /* Большое пятно: антициклон, живущий веками. Без него гигант
     выглядит как полосатый мяч из детской. */
  var spotLat = (0.16 + rnd() * 0.24) * (rnd() < 0.5 ? -1 : 1);
  var spotLon = rnd() * TAU;
  var spotW = 0.32 + rnd() * 0.16, spotH = 0.115 + rnd() * 0.05;
  var spotSpin = rnd() < 0.5 ? -1 : 1;
  var spotCol = isTox ? [204, 168, 76] : [178, 84, 52];

  /* Большие вихри для плотной атмосферы. Крутим ими саму выборку:
     из-за этого полосы изгибаются буквой Y, как на ультрафиолетовых
     снимках Венеры, вместо ровных горизонтальных лент. */
  var vort = [];
  if (isTox) {
    for (i = 0; i < 4; i++) {
      var vlat = Math.asin(rnd() * 1.6 - 0.8), vlon = rnd() * TAU;
      vort.push({
        ax: Math.cos(vlat) * Math.cos(vlon), ay: Math.sin(vlat), az: Math.cos(vlat) * Math.sin(vlon),
        r: 0.55 + rnd() * 0.65, s: (0.8 + rnd() * 1.1) * (vlat > 0 ? 1 : -1)
      });
    }
  }

  /* Мелкие белые овалы - спутники крупного вихря */
  var ovals = [], ovN = 3 + ((rnd() * 4) | 0);
  for (i = 0; i < ovN; i++) {
    ovals.push({
      lat: (rnd() * 2 - 1) * 0.58, lon: rnd() * TAU,
      w: 0.045 + rnd() * 0.07, h: 0.022 + rnd() * 0.028,
      bright: 0.4 + rnd() * 0.5
    });
  }

  var cosLon = new Float32Array(W), sinLon = new Float32Array(W);
  for (var xx = 0; xx < W; xx++) {
    var lo = ((xx + 0.5) / W) * TAU;
    cosLon[xx] = Math.cos(lo); sinLon[xx] = Math.sin(lo);
  }

  var octA = lowd ? 3 : 4, octB = lowd ? 2 : 3;
  var conK = isTox ? 0.85 : 1.0;   /* у ядовитой дымки контраст ниже */

  for (var y = 0; y < H; y++) {
    var lat = (0.5 - (y + 0.5) / H) * PI;
    var latN = lat / (PI * 0.5);
    var cy = Math.cos(lat), sy = Math.sin(lat);
    var row = y * W;
    var li = (clamp(latN, -1, 1) + 1) * 0.5 * (LUTN - 1);
    var lii = li | 0; if (lii > LUTN - 2) lii = LUTN - 2;
    var edgeBase = dlut[lii];
    for (var x = 0; x < W; x++) {
      var dx = cy * cosLon[x], dy = sy, dz = cy * sinLon[x];
      var bandLat = latN;

      /* Вихри плотной атмосферы: поворачиваем и точку выборки, и
         широту, по которой ищем полосу. Тогда поток изгибается
         целиком, а не покрывается наложенной рябью. */
      for (i = 0; i < vort.length; i++) {
        var vt = vort[i];
        var vdot = dx * vt.ax + dy * vt.ay + dz * vt.az;
        var vang = Math.acos(clamp(vdot, -1, 1));
        if (vang > vt.r) continue;
        var vf = 1 - vang / vt.r;
        var rr2 = rotAxis(dx, dy, dz, vt.ax, vt.ay, vt.az, vf * vf * vt.s);
        dx = rr2[0]; dy = rr2[1]; dz = rr2[2];
        bandLat = Math.asin(clamp(dy, -1, 1)) / (PI * 0.5);
        break;
      }

      /* Зональное растяжение: шум сжат по долготе и растянут по
         широте, поэтому завихрения размазываются вдоль полос -
         ровно как их размазывает суперротация атмосферы */
      var w1 = N.fbm(dx * 0.9 + o1, dy * 3.4, dz * 0.9 + o2, octA);
      var w2 = N.fbm(dx * 2.6 - o3, dy * 9.5, dz * 2.6, octB);
      /* На границах полос сдвиг сильнее: там и рождается турбулентность */
      var tt = bandLat + w1 * 0.090 * conK + w2 * 0.034 * conK * (0.4 + edgeBase);
      var f = (clamp(tt, -1, 1) + 1) * 0.5 * (LUTN - 1);
      var ii = f | 0, fr = f - ii;
      if (ii > LUTN - 2) ii = LUTN - 2;
      var v = lerp(lut[ii], lut[ii + 1], fr);
      var edge = dlut[ii];

      var turb = N.fbm(dx * 5.5 + o2, dy * 15.0, dz * 5.5 - o1, octB);
      v += turb * 0.11 * conK * (0.30 + edge * 1.7);
      /* Волокна: тонкие вытянутые нити вдоль струйных течений.
         Без них полосы выглядят как заливка градиентом. */
      var fil = N.ridged(dx * 9.5 + o1, dy * 34.0, dz * 9.5 - o2, 2);
      v += (fil - 0.40) * 0.085 * conK;
      v = clamp(v, 0, 1);

      var lon = ((x + 0.5) / W) * TAU;

      /* Большое пятно: внутри координаты закручиваем, поэтому полосы
         втягиваются в спираль вместо ровного эллипса */
      var dl = wrapPi(lon - spotLon);
      var ex = dl * cy / spotW, ey = (lat - spotLat) / spotH;
      var rr = Math.sqrt(ex * ex + ey * ey);
      var spotMix = 0;
      if (rr < 1.35 && !isTox) {
        var ang = Math.atan2(ey, ex) + (1.35 - rr) * 2.6 * spotSpin;
        var sx = Math.cos(ang) * rr, sy2 = Math.sin(ang) * rr;
        var sw = N.fbm(sx * 3.6 + 11.3, sy2 * 3.6 - 4.7, 2.9, 3);
        spotMix = smooth(1.18, 0.30, rr);
        v = clamp(v * (1 - spotMix * 0.55) + (0.60 + sw * 0.30) * spotMix * 0.55, 0, 1);
      }

      var lk = (v * 255 | 0) * 3;
      var r = LP[lk], gc = LP[lk + 1], b = LP[lk + 2];
      if (spotMix > 0) {
        var swf = spotMix * 0.82;
        r = lerp(r, spotCol[0], swf); gc = lerp(gc, spotCol[1], swf); b = lerp(b, spotCol[2], swf);
        var rim = Math.exp(-Math.pow((rr - 1.04) * 6.0, 2)) * 0.32;
        r *= (1 - rim); gc *= (1 - rim); b *= (1 - rim);
      }

      for (i = 0; i < ovals.length; i++) {
        var ov = ovals[i];
        var odl = wrapPi(lon - ov.lon);
        var oex = odl * cy / ov.w, oey = (lat - ov.lat) / ov.h;
        var orr = Math.sqrt(oex * oex + oey * oey);
        if (orr < 1.2) {
          var of2 = smooth(1.05, 0.2, orr) * ov.bright;
          r = lerp(r, 248, of2); gc = lerp(gc, 244, of2); b = lerp(b, 230, of2);
        }
      }

      /* Полярные капюшоны: у гигантов они темнее и холоднее по тону */
      var pol = smooth(0.60, 0.99, Math.abs(latN));
      if (kind === "toxic") {
        r = lerp(r, 148, pol * 0.42); gc = lerp(gc, 144, pol * 0.42); b = lerp(b, 88, pol * 0.42);
      } else {
        r = lerp(r, 96, pol * 0.52); gc = lerp(gc, 102, pol * 0.52); b = lerp(b, 118, pol * 0.52);
      }

      var grain = grainAt(x, y) * 5;
      r += grain; gc += grain; b += grain;
      r *= tf[0]; gc *= tf[1]; b *= tf[2];

      var p4 = (row + x) << 2;
      cD[p4] = r; cD[p4 + 1] = gc; cD[p4 + 2] = b; cD[p4 + 3] = 255;
      /* Рельефа у газа нет, но лёгкий bump заставляет полосы
         проступать на терминаторе и убирает ощущение наклейки */
      var bv = (v * 0.6 + turb * 0.2 + spotMix * 0.2) * 255;
      bD[p4] = bv; bD[p4 + 1] = bv; bD[p4 + 2] = bv; bD[p4 + 3] = 255;
    }
  }
  cCtx.putImageData(cImg, 0, 0);
  bCtx.putImageData(bImg, 0, 0);
  return { color: cCan, bump: bCan, spec: null, emis: null };
}

/* ═══════════════════════════════════════════════════════════
   Облака
   ═══════════════════════════════════════════════════════════ */
function cloudMap(kind, W, H, rnd, N, opts) {
  var can = canvas2d(W, H);
  var ctx = can.getContext("2d");
  var img = ctx.createImageData(W, H);
  var d = img.data;
  var lowd = opts.detail === "low";
  var oct = lowd ? 4 : 5;
  var o1 = rnd() * 200 - 100, o2 = rnd() * 200 - 100;

  /* Циклоны: вокруг каждого координату выборки поворачиваем на угол,
     спадающий к краю. Формула Родрига даёт настоящую спираль, а не
     нарисованную завитушку, и облачные поля втягиваются в вихрь
     сами. Именно эти спирали читаются глазом как «погода». */
  var vn = kind === "toxic" ? 4 : (kind === "ocean" ? 8 : 7);
  if (lowd) vn = Math.max(3, vn - 3);
  var vort = [];
  for (var i = 0; i < vn; i++) {
    var vlat = Math.asin(rnd() * 1.7 - 0.85);
    var vlon = rnd() * TAU;
    vort.push({
      ax: Math.cos(vlat) * Math.cos(vlon), ay: Math.sin(vlat), az: Math.cos(vlat) * Math.sin(vlon),
      r: 0.16 + rnd() * 0.30,
      /* Угол закрутки держим в пределах примерно радиана. Больше -
         и у центра вихря спираль наматывается быстрее, чем шаг
         текселя: вместо облачного рукава получается веер полос. */
      s: (rnd() * 0.7 + 0.55) * (vlat > 0 ? 1 : -1)
    });
  }

  var cosLon = new Float32Array(W), sinLon = new Float32Array(W);
  for (var x0 = 0; x0 < W; x0++) {
    var lo = ((x0 + 0.5) / W) * TAU;
    cosLon[x0] = Math.cos(lo); sinLon[x0] = Math.sin(lo);
  }

  var cover = kind === "toxic" ? 0.30 : (kind === "ocean" ? 0.40 : 0.36);
  cover = clamp(cover - (opts.cloudAmount || 0), 0.05, 0.90);
  var tR = kind === "toxic" ? 240 : 255, tG = kind === "toxic" ? 232 : 255, tB = kind === "toxic" ? 168 : 255;

  for (var y = 0; y < H; y++) {
    var lat = (0.5 - (y + 0.5) / H) * PI;
    var latN = lat / (PI * 0.5);
    var cy = Math.cos(lat), sy = Math.sin(lat);
    var row = y * W;
    /* Пояса циркуляции: экватор мокрый, тридцатые широты сухие,
       умеренные снова мокрые. Из-за них на снимках Земли поперёк
       планеты идут чередующиеся полосы, а не ровный ковёр. */
    var band = 0.58
      + 0.42 * Math.exp(-Math.pow(latN * 7.0, 2))
      - 0.40 * Math.exp(-Math.pow((Math.abs(latN) - 0.34) * 6.5, 2))
      + 0.32 * Math.exp(-Math.pow((Math.abs(latN) - 0.66) * 5.0, 2));
    for (var x = 0; x < W; x++) {
      var dx = cy * cosLon[x], dy = sy, dz = cy * sinLon[x];
      for (var v = 0; v < vort.length; v++) {
        var vt = vort[v];
        var dot = dx * vt.ax + dy * vt.ay + dz * vt.az;
        var ang = Math.acos(clamp(dot, -1, 1));
        if (ang > vt.r) continue;
        var f = 1 - ang / vt.r;
        var th = f * f * (3 - 2 * f) * vt.s;
        var cth = Math.cos(th), sth = Math.sin(th);
        var crx = vt.ay * dz - vt.az * dy;
        var cry = vt.az * dx - vt.ax * dz;
        var crz = vt.ax * dy - vt.ay * dx;
        var kdot = dot * (1 - cth);
        var nx = dx * cth + crx * sth + vt.ax * kdot;
        var ny = dy * cth + cry * sth + vt.ay * kdot;
        var nz = dz * cth + crz * sth + vt.az * kdot;
        /* Раньше здесь стоял break на первом подходящем вихре. Там,
           где два вихря перекрываются, соседние пиксели попадали в
           разные ветки, и по облакам шёл разрыв веером. Складываем
           все повороты подряд - шва не остаётся. */
        dx = nx; dy = ny; dz = nz;
      }
      var c1 = N.fbm(dx * 3.0 + o1, dy * 3.0, dz * 3.0 + o2, oct) * 0.5 + 0.5;
      var c2 = N.ridged(dx * 7.0 - o2, dy * 7.0, dz * 7.0 + o1, 3);
      var cv = (c1 * 0.76 + c2 * 0.24) * clamp(band, 0, 1.4);
      /* Порог с мягким краем: у настоящего облака край рыхлый */
      var a2 = Math.pow(smooth(cover, cover + 0.26, cv), 0.8);
      var p4 = (row + x) << 2;
      /* Плотное ядро чуть серее краёв - тень внутри самого облака */
      var shade = 1 - smooth(0.5, 1.0, a2) * 0.12;
      d[p4] = tR * shade; d[p4 + 1] = tG * shade; d[p4 + 2] = tB * shade;
      d[p4 + 3] = a2 * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return can;
}

/* ═══════════════════════════════════════════════════════════
   Кольца
   ═══════════════════════════════════════════════════════════ */
function ringMap(rnd, N, width) {
  /* Одномерный профиль: плотность колец зависит только от радиуса.
     Держим текстуру в четыре пикселя высотой - память копеечная,
     а деталей по радиусу столько же. */
  var W = width || 1024, H = 4;
  var can = canvas2d(W, H);
  var ctx = can.getContext("2d");
  var img = ctx.createImageData(W, H);
  var d = img.data;

  /* Щели: Кассини широкая, Энке узкая, плюс пара случайных */
  var gaps = [
    { at: 0.44, w: 0.038, deep: 0.95 },
    { at: 0.84, w: 0.008, deep: 0.88 },
    { at: 0.20 + rnd() * 0.08, w: 0.006 + rnd() * 0.006, deep: 0.65 },
    { at: 0.62 + rnd() * 0.10, w: 0.005 + rnd() * 0.008, deep: 0.55 }
  ];
  var seedOff = rnd() * 100;

  for (var x = 0; x < W; x++) {
    var t = x / (W - 1);
    /* Три зоны разной плотности, как C-B-A у Сатурна */
    var dens = 0.26 + 0.74 * smooth(0.00, 0.16, t);
    dens *= 1 - 0.28 * smooth(0.50, 0.62, t);
    dens *= 1 - 0.50 * smooth(0.93, 1.00, t);
    dens *= 1 - 0.45 * smooth(0.05, 0.00, t);
    /* Резонансные волны плотности: тонкая рябь по всему кольцу */
    var fine = N.fbm(t * 130 + seedOff, 0.5, 0.5, 4) * 0.5 + 0.5;
    var fine2 = N.fbm(t * 430 - seedOff, 1.5, 2.5, 3) * 0.5 + 0.5;
    dens *= 0.58 + fine * 0.52 + fine2 * 0.18;
    for (var gi = 0; gi < gaps.length; gi++) {
      var gp = gaps[gi];
      var dd = Math.abs(t - gp.at) / gp.w;
      if (dd < 1) dens *= 1 - gp.deep * (1 - dd * dd);
    }
    dens = clamp(dens, 0, 1);
    /* Лёд ближе к белому, каменистая пыль к охре */
    var icy = clamp(fine * 0.55 + t * 0.55, 0, 1);
    var r = lerp(214, 250, icy), gg = lerp(196, 242, icy), b = lerp(162, 224, icy);
    for (var y = 0; y < H; y++) {
      var p4 = (y * W + x) << 2;
      d[p4] = r; d[p4 + 1] = gg; d[p4 + 2] = b;
      d[p4 + 3] = clamp(dens * 268, 0, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return can;
}

/* ═══════════════════════════════════════════════════════════
   Шейдеры
   ═══════════════════════════════════════════════════════════ */

/* Мировая нормаль и мировая точка нужны почти всем нашим шейдерам:
   освещение планеты считаем от направления на светило в мире, а не
   в пространстве камеры, иначе кайма поедет при повороте камеры. */
var WORLD_VS = [
  "varying vec3 vWN;",
  "varying vec3 vWP;",
  "varying vec2 vUvR;",
  "void main(){",
  "  vUvR = uv;",
  "  vWN = normalize(mat3(modelMatrix) * normal);",
  "  vec4 wp = modelMatrix * vec4(position, 1.0);",
  "  vWP = wp.xyz;",
  "  gl_Position = projectionMatrix * viewMatrix * wp;",
  "}"
].join("\n");

/* Атмосфера. Френель по нормали к камере заменяет длину пути луча
   сквозь газ: в зените путь короткий и слой прозрачный, на лимбе
   длинный и яркий. У терминатора свет прошёл всю толщу по
   касательной, синева рассеялась - остаётся красное. Это и есть
   закат, увиденный с орбиты. */
var ATM_FS = [
  "uniform vec3 uSun; uniform vec3 uSky; uniform vec3 uSet;",
  "uniform float uPow; uniform float uStr; uniform float uFloor;",
  "varying vec3 vWN; varying vec3 vWP; varying vec2 vUvR;",
  "void main(){",
  "  vec3 N = normalize(vWN);",
  "  vec3 V = normalize(cameraPosition - vWP);",
  "  float rim = pow(1.0 - abs(dot(N, V)), uPow);",
  "  vec3 L = normalize(uSun);",
  "  float ndl = dot(N, L);",
  "  float day = smoothstep(-0.26, 0.30, ndl);",
  "  float term = exp(-ndl * ndl * 14.0);",
  "  vec3 col = mix(uSky, uSet, clamp(term * 0.92, 0.0, 1.0));",
  "  float a = rim * uStr * (uFloor + day * (1.0 - uFloor));",
  "  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));",
  "}"
].join("\n");

/* Кольца. Тень планеты берём честно: точка кольца в тени, если она
   за планетой вдоль луча света и её отступ от оси «планета-солнце»
   меньше радиуса планеты. Это цилиндр тени, три строчки, и
   выглядит правильно с любого угла.
   Яркость - от косинуса угла падения на плоскость колец: когда
   солнце уходит в плоскость, кольца гаснут, как у настоящего
   Сатурна в равноденствие. Со стороны, куда солнце не светит, они
   видны на просвет: тусклее и холоднее по тону. */
var RING_FS = [
  "uniform sampler2D uMap; uniform vec3 uSun; uniform vec3 uCenter;",
  "uniform float uR; uniform float uOpacity;",
  "varying vec3 vWN; varying vec3 vWP; varying vec2 vUvR;",
  "void main(){",
  "  vec4 t = texture2D(uMap, vec2(vUvR.x, 0.5));",
  "  if (t.a < 0.004) discard;",
  "  vec3 P = vWP - uCenter;",
  "  vec3 L = normalize(uSun);",
  "  float along = dot(P, L);",
  "  float d = length(P - along * L);",
  "  float sh = 1.0;",
  "  if (along < 0.0) sh = smoothstep(uR * 0.94, uR * 1.14, d);",
  "  sh = mix(0.12, 1.0, sh);",
  "  vec3 N = normalize(vWN);",
  "  vec3 V = normalize(cameraPosition - vWP);",
  "  float ndl = abs(dot(N, L));",
  "  float lit = 0.42 + 0.58 * pow(ndl, 0.35);",
  "  float thr = dot(N, L) * dot(N, V);",
  "  float back = smoothstep(0.04, -0.04, thr);",
  "  vec3 col = t.rgb * sh * lit;",
  "  col = mix(col, col * vec3(0.70, 0.76, 0.94) * 0.72, back);",
  "  float a = t.a * uOpacity * (0.42 + 0.58 * sh);",
  "  gl_FragColor = vec4(col, min(a, 0.90));",
  "}"
].join("\n");

/* Звезда: грануляция, пятна и потемнение к краю. Потемнение к краю -
   главный признак настоящего светила: у края диска мы смотрим сквозь
   более холодные верхние слои, и яркость падает примерно как корень
   из косинуса угла. Без него звезда выглядит наклейкой. */
var STAR_NOISE = [
  "float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453123); }",
  "float vn3(vec3 p){",
  "  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);",
  "  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),",
  "             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z);",
  "}",
  "float fb3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vn3(p); p *= 2.07; a *= 0.5; } return s; }"
].join("\n");

var STAR_FS = [
  "uniform float uT; uniform vec3 uHot; uniform vec3 uCool; uniform float uSpots;",
  "varying vec3 vWN; varying vec3 vWP; varying vec2 vUvR;",
  STAR_NOISE,
  "void main(){",
  "  vec3 N = normalize(vWN);",
  "  vec3 V = normalize(cameraPosition - vWP);",
  "  float mu = clamp(dot(N, V), 0.0, 1.0);",
  "  float gran = fb3(N * 26.0 + vec3(0.0, uT * 0.04, 0.0));",
  "  float cell = fb3(N * 78.0 - vec3(uT * 0.07, 0.0, uT * 0.03));",
  "  float sup = fb3(N * 7.0 + vec3(uT * 0.02));",
  "  float v = gran * 0.55 + cell * 0.25 + sup * 0.35;",
  "  float spot = smoothstep(0.62, 0.78, fb3(N * 3.1 + 21.0)) * uSpots;",
  "  vec3 col = mix(uCool, uHot, clamp(v * 1.25, 0.0, 1.0));",
  "  col = mix(col, col * vec3(0.30, 0.20, 0.16), spot);",
  "  col *= 0.34 + 0.66 * pow(mu, 0.55);",
  "  col += uHot * pow(1.0 - mu, 5.0) * 0.55;",
  "  gl_FragColor = vec4(col, 1.0);",
  "}"
].join("\n");

/* Корона. Френель здесь не годится: на оболочке он даёт яркость,
   растущую к её внешнему краю, и вокруг звезды повисает серый
   бублик. Считаем прицельное расстояние луча до центра светила -
   яркость падает от лимба наружу, как у настоящей короны. */
var CORONA_FS = [
  "uniform float uT; uniform vec3 uCol; uniform float uStr;",
  "uniform vec3 uCenter; uniform float uR;",
  "varying vec3 vWN; varying vec3 vWP; varying vec2 vUvR;",
  STAR_NOISE,
  "void main(){",
  "  vec3 V = normalize(vWP - cameraPosition);",
  "  vec3 CP = uCenter - cameraPosition;",
  "  float b = length(CP - dot(CP, V) * V);",
  "  float k = clamp(uR / max(b, 0.0001), 0.0, 1.0);",
  "  vec3 N = normalize(vWN);",
  "  float wisp = fb3(N * 8.0 + vec3(uT * 0.05, uT * 0.03, 0.0));",
  "  float a = pow(k, 4.0) * uStr * (0.62 + wisp * 0.62);",
  /* Гасим у внешнего края оболочки: иначе её геометрия проступает
     ободком, а вокруг звезды повисает серый туман */
  "  a *= smoothstep(0.42, 0.66, k);",
  "  gl_FragColor = vec4(uCol * (0.92 + wisp * 0.40), clamp(a, 0.0, 1.0));",
  "}"
].join("\n");

/* ── Правка стандартного материала ────────────────────────
   Три вещи, которых нет в готовом MeshPhongMaterial и ради которых
   не стоит писать своё освещение с нуля:
   1) ночные огни. emissiveMap в three светит всегда, и города
      горят поверх освещённой суши. Гасим эмиссию по скалярному
      произведению нормали и направления на светило.
   2) пульсация лавы. Разломы дышат во времени, ночью ярче.
   3) тень колец на планете. Из точки поверхности идём к солнцу,
      ищем пересечение с плоскостью колец и берём их плотность в
      этом радиусе. Именно эта полоса тени поперёк диска делает
      окольцованный гигант узнаваемым. */
function patchSurface(mat, kind, u) {
  var wantNight = !!u.night, wantRing = !!u.ringTex;
  mat.onBeforeCompile = function (shader) {
    shader.uniforms.uSunDir = u.sun;
    shader.uniforms.uTime = u.time;
    if (wantRing) {
      shader.uniforms.uRingTex = u.ringTex;
      shader.uniforms.uRingN = u.ringN;
      shader.uniforms.uCenter = u.center;
      shader.uniforms.uRingIn = u.ringIn;
      shader.uniforms.uRingOut = u.ringOut;
    }
    var vs = shader.vertexShader;
    if (vs.indexOf("#include <beginnormal_vertex>") < 0) return;
    vs = vs.replace("#include <beginnormal_vertex>",
      "#include <beginnormal_vertex>\n  vRcWN = normalize(mat3(modelMatrix) * objectNormal);");
    vs = vs.replace("#include <begin_vertex>",
      "#include <begin_vertex>\n  vRcWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.vertexShader = "varying vec3 vRcWN;\nvarying vec3 vRcWP;\n" + vs;

    var fs = shader.fragmentShader;
    var head = "varying vec3 vRcWN;\nvarying vec3 vRcWP;\nuniform vec3 uSunDir;\nuniform float uTime;\n";
    if (wantRing) {
      head += "uniform sampler2D uRingTex;\nuniform vec3 uRingN;\nuniform vec3 uCenter;\n" +
              "uniform float uRingIn;\nuniform float uRingOut;\n";
    }

    if (wantNight && fs.indexOf("#include <emissivemap_fragment>") >= 0) {
      var add;
      if (kind === "lava") {
        add = [
          "  float rcNdl = dot(normalize(vRcWN), normalize(uSunDir));",
          "  float rcPulse = 0.74 + 0.26 * sin(uTime * 1.4 + vRcWN.x * 7.0 + vRcWN.y * 5.0)",
          "                 * (0.55 + 0.45 * sin(uTime * 0.61 + vRcWN.z * 11.0));",
          "  totalEmissiveRadiance *= rcPulse * mix(0.60, 1.30, smoothstep(0.30, -0.30, rcNdl));"
        ].join("\n");
      } else {
        add = [
          "  float rcNdl = dot(normalize(vRcWN), normalize(uSunDir));",
          "  totalEmissiveRadiance *= smoothstep(0.10, -0.24, rcNdl);"
        ].join("\n");
      }
      fs = fs.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n" + add);
    }

    if (wantRing && fs.indexOf("#include <lights_fragment_end>") >= 0) {
      var sh = [
        "  float rcSh = 1.0;",
        "  {",
        "    vec3 rp = vRcWP - uCenter;",
        "    vec3 rl = normalize(uSunDir);",
        "    float dn = dot(rl, uRingN);",
        "    if (abs(dn) > 0.0015) {",
        "      float tt = -dot(rp, uRingN) / dn;",
        "      if (tt > 0.0) {",
        "        float rr = length(rp + rl * tt);",
        "        float uu = (rr - uRingIn) / max(0.001, uRingOut - uRingIn);",
        "        if (uu > 0.0 && uu < 1.0) rcSh = 1.0 - texture2D(uRingTex, vec2(uu, 0.5)).a * 0.88;",
        "      }",
        "    }",
        "  }",
        "  reflectedLight.directDiffuse *= rcSh;",
        "  reflectedLight.directSpecular *= rcSh;"
      ].join("\n");
      fs = fs.replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n" + sh);
    }
    shader.fragmentShader = head + fs;
  };
  /* Разные врезки не должны попасть в один кэш программы */
  mat.customProgramCacheKey = function () {
    return "rcp-" + kind + (wantNight ? "-n" : "") + (wantRing ? "-r" : "");
  };
}

/* ── Настройки атмосферы по типам ────────────────────────
   sky - цвет рассеяния на лимбе, set - цвет у терминатора,
   str - плотность, haze - внутренний слой дымки поверх диска,
   floor - сколько свечения остаётся на ночной стороне. */
var ATMO = {
  terran: { sky: [0.30, 0.56, 1.00], set: [1.00, 0.42, 0.16], str: 1.00, pow: 3.2, haze: 0.11, floor: 0.05 },
  ocean: { sky: [0.26, 0.60, 1.00], set: [1.00, 0.50, 0.24], str: 1.10, pow: 3.0, haze: 0.14, floor: 0.05 },
  ice: { sky: [0.58, 0.80, 1.00], set: [0.92, 0.74, 0.64], str: 0.40, pow: 3.8, haze: 0.05, floor: 0.05 },
  desert: { sky: [0.88, 0.66, 0.44], set: [1.00, 0.46, 0.24], str: 0.66, pow: 3.0, haze: 0.14, floor: 0.06 },
  rocky: { sky: [0.55, 0.56, 0.60], set: [0.80, 0.62, 0.50], str: 0.20, pow: 3.6, haze: 0.02, floor: 0.04 },
  lava: { sky: [0.92, 0.30, 0.10], set: [1.00, 0.58, 0.18], str: 0.50, pow: 3.2, haze: 0.10, floor: 0.16 },
  gas: { sky: [0.94, 0.76, 0.50], set: [1.00, 0.58, 0.28], str: 0.55, pow: 4.0, haze: 0.07, floor: 0.05 },
  toxic: { sky: [0.88, 0.86, 0.34], set: [1.00, 0.68, 0.22], str: 1.20, pow: 2.4, haze: 0.34, floor: 0.09 }
};

var KINDS = ["terran", "gas", "ice", "lava", "rocky", "desert", "toxic", "ocean"];

/* ── Сборка планеты ──────────────────────────────────────── */
function make(kind, opts) {
  opts = opts || {};
  if (KINDS.indexOf(kind) < 0) kind = "rocky";

  var radius = opts.radius > 0 ? opts.radius : 60;
  var seeded = typeof opts.seed === "number";
  var seed = seeded ? (opts.seed >>> 0) : ((Math.random() * 0xFFFFFFFF) >>> 0);
  var rnd = rngFrom(seed);
  var N = makeNoise(rngFrom(seed ^ 0x5BF03635));

  /* Автовыбор детализации: на телефоне мегапиксельная текстура
     строится секунду и съедает память, а разницы на маленьком
     экране всё равно не видно */
  var detail = opts.detail;
  if (detail !== "high" && detail !== "low") {
    var weak = false;
    try {
      weak = (g.innerWidth || 1024) < 760 ||
        (navigator.deviceMemory || 4) <= 2 ||
        (navigator.hardwareConcurrency || 4) <= 4;
    } catch (e) {}
    detail = weak ? "low" : "high";
  }
  var high = detail === "high";
  var W = high ? 1024 : 512, H = high ? 512 : 256;
  var conf = { detail: detail, cloudAmount: opts.cloudAmount || 0 };

  var isGas = (kind === "gas" || kind === "toxic");
  var tf = tintFactors(typeof opts.tint === "number" ? opts.tint : 0xffffff);

  var wantAtm = opts.atmosphere !== false && (kind !== "rocky" || opts.atmosphere === true);
  var wantClouds = opts.clouds !== false &&
    (kind === "terran" || kind === "ocean" || kind === "toxic" ||
     ((kind === "desert" || kind === "ice" || kind === "lava" || kind === "gas") && opts.clouds === true));
  var wantRings;
  if (typeof opts.rings === "boolean") wantRings = opts.rings;
  else wantRings = kind === "gas" ? rnd() < 0.6 : (kind === "ice" ? rnd() < 0.12 : false);

  /* Бюджет на слабом железе: сверх сферы не больше двух мешей.
     Кольца важнее облаков (их видно с любой дистанции), поэтому
     облака впекаем в саму текстуру - вращаться они перестанут, но
     на телефоне это всё равно не разглядеть. */
  var bakeClouds = false;
  if (!high) {
    var extra = (wantAtm ? 1 : 0) + (wantClouds ? 1 : 0) + (wantRings ? 1 : 0);
    if (extra > 2 && wantClouds) { bakeClouds = true; extra--; }
    if (extra > 2 && wantAtm) wantAtm = false;
  }

  var maps = isGas ? gasMaps(kind, W, H, rnd, N, tf, conf)
                   : terrainMaps(kind, W, H, rnd, N, tf, conf);

  var cloudCan = null;
  if (wantClouds) cloudCan = cloudMap(kind, W, H, rnd, N, conf);
  if (bakeClouds && cloudCan) {
    var cx2 = maps.color.getContext("2d");
    cx2.globalAlpha = 0.9;
    cx2.drawImage(cloudCan, 0, 0);
    cx2.globalAlpha = 1;
    cloudCan = null;
  }

  var trash = [];
  function keep(o) { trash.push(o); return o; }

  /* Общие униформы: направление на светило, время и параметры колец.
     Держим по одному объекту и раздаём ссылку - сменил направление,
     и сразу поехали кайма, тень на кольцах и ночная сторона. */
  var U = {
    sun: { value: opts.sun ? opts.sun.clone().normalize() : new T.Vector3(1, 0.28, 0.55).normalize() },
    time: { value: 0 },
    center: { value: new T.Vector3() },
    ringN: { value: new T.Vector3(0, 1, 0) },
    ringIn: { value: 1 }, ringOut: { value: 2 },
    ringTex: null, night: false
  };

  /* ── Иерархия ────────────────────────────────────────
     group -> tilt (наклон оси) -> spin (суточное вращение).
     Кольца висят в наклонённой системе, но не крутятся вместе с
     телом: их текстура радиальная, вращение было бы незаметно и
     стоило бы лишнего пересчёта матриц. */
  var group = new T.Group();
  var tilt = new T.Group();
  tilt.rotation.z = (typeof opts.tilt === "number") ? opts.tilt
    : (0.12 + rnd() * 0.42) * (rnd() < 0.5 ? 1 : -1);
  group.add(tilt);
  var spin = new T.Group();
  tilt.add(spin);

  var segW = high ? 64 : 32, segH = high ? 48 : 24;
  var geo = keep(new T.SphereGeometry(radius, segW, segH));
  var mapTex = keep(texFrom(maps.color, true));
  var bumpTex = keep(texFrom(maps.bump, false));

  var matOpt = {
    map: mapTex,
    bumpMap: bumpTex,
    bumpScale: (TERRAIN[kind] ? TERRAIN[kind].bump : 0.014) * (high ? 1 : 0.7),
    shininess: 6,
    specular: new T.Color(0x0c1014)
  };
  if (isGas) { matOpt.bumpScale = 0.012; matOpt.shininess = 2; }
  if (maps.spec) {
    matOpt.specularMap = keep(texFrom(maps.spec, false));
    /* Узкий и не слишком яркий блик: широкий превращает океан в
       белое пятно и убивает всю картинку */
    matOpt.specular = new T.Color(kind === "ice" ? 0x39434d : 0x2b3a48);
    matOpt.shininess = kind === "ice" ? 90 : 400;
  }
  var emisTex = null;
  if (maps.emis) {
    emisTex = keep(texFrom(maps.emis, true));
    matOpt.emissiveMap = emisTex;
    matOpt.emissive = new T.Color(kind === "lava" ? 0xffffff : 0xffe6c0);
    matOpt.emissiveIntensity = kind === "lava" ? 1.05 : 1.7;
    U.night = true;
  }
  var mat = keep(new T.MeshPhongMaterial(matOpt));
  if (U.night || wantRings) {
    if (wantRings) U.ringTex = { value: null };
    patchSurface(mat, kind, U);
  }
  var body = new T.Mesh(geo, mat);
  spin.add(body);

  /* Облака: отдельная сфера чуть большего радиуса. Слой ламбертов,
     то есть освещается сценой и честно гаснет на ночной стороне.
     depthWrite выключен, иначе полупрозрачные края режут атмосферу. */
  var clouds = null, cloudMat = null;
  if (cloudCan) {
    var cTex = keep(texFrom(cloudCan, true));
    cloudMat = keep(new T.MeshLambertMaterial({
      map: cTex, transparent: true, depthWrite: false,
      opacity: kind === "toxic" ? 0.97 : 0.94
    }));
    var cGeo = keep(new T.SphereGeometry(radius * 1.014, segW, segH));
    clouds = new T.Mesh(cGeo, cloudMat);
    clouds.renderOrder = 1;
    spin.add(clouds);
  }

  /* Атмосфера. Наружная оболочка рисуется изнутри (BackSide) и
     аддитивно: видно только кольцо за силуэтом планеты, где луч
     идёт сквозь газ по касательной. Внутренняя - обычная дымка
     поверх диска, без неё планета выглядит вырезанной ножницами.
     Порядок отрисовки задаём руками: у обеих оболочек один центр,
     и автоматическая сортировка прозрачных мешей их путает. */
  var atmOuter = null, atmInner = null;
  if (wantAtm) {
    var A = ATMO[kind] || ATMO.rocky;
    var strK = typeof opts.atmoStrength === "number" ? opts.atmoStrength : 1;
    var skyV = new T.Vector3(A.sky[0] * tf[0], A.sky[1] * tf[1], A.sky[2] * tf[2]);
    var setV = new T.Vector3(A.set[0], A.set[1], A.set[2]);

    if (high && A.haze > 0.02) {
      var hGeo = keep(new T.SphereGeometry(radius * 1.004, 48, 32));
      var hMat = keep(new T.ShaderMaterial({
        uniforms: {
          uSun: U.sun, uSky: { value: skyV.clone() }, uSet: { value: setV.clone() },
          uPow: { value: 1.4 }, uStr: { value: A.haze * strK }, uFloor: { value: 0.02 }
        },
        vertexShader: WORLD_VS, fragmentShader: ATM_FS,
        transparent: true, side: T.FrontSide, depthWrite: false
      }));
      atmInner = new T.Mesh(hGeo, hMat);
      atmInner.renderOrder = 2;
      group.add(atmInner);
    }

    var aGeo = keep(new T.SphereGeometry(radius * 1.055, high ? 48 : 24, high ? 32 : 18));
    var aMat = keep(new T.ShaderMaterial({
      uniforms: {
        uSun: U.sun, uSky: { value: skyV }, uSet: { value: setV },
        uPow: { value: A.pow }, uStr: { value: A.str * strK }, uFloor: { value: A.floor }
      },
      vertexShader: WORLD_VS, fragmentShader: ATM_FS,
      transparent: true, side: T.BackSide, depthWrite: false,
      blending: T.AdditiveBlending
    }));
    atmOuter = new T.Mesh(aGeo, aMat);
    atmOuter.renderOrder = 3;
    group.add(atmOuter);
  }

  /* Кольца */
  var rings = null, ringMat = null;
  if (wantRings) {
    var rIn = radius * (1.26 + rnd() * 0.12);
    var rOut = rIn * (1.62 + rnd() * 0.45);
    U.ringIn.value = rIn; U.ringOut.value = rOut;
    var rGeo = keep(new T.RingGeometry(rIn, rOut, high ? 180 : 80, 1));
    /* Развёртку кольца перекладываем на радиус: иначе полосатая
       текстура ляжет спицами, а не кругами */
    (function () {
      var pos = rGeo.attributes.position, uvA = rGeo.attributes.uv, v = new T.Vector3();
      var span = rOut - rIn;
      for (var q = 0; q < pos.count; q++) {
        v.fromBufferAttribute(pos, q);
        uvA.setXY(q, clamp((v.length() - rIn) / span, 0, 1), 0.5);
      }
      uvA.needsUpdate = true;
    })();
    var rTex = keep(texFrom(ringMap(rnd, N, high ? 1024 : 512), true));
    rTex.wrapS = T.ClampToEdgeWrapping;
    if (U.ringTex) U.ringTex.value = rTex;
    ringMat = keep(new T.ShaderMaterial({
      uniforms: {
        uMap: { value: rTex }, uSun: U.sun, uCenter: U.center,
        uR: { value: radius }, uOpacity: { value: 0.88 }
      },
      vertexShader: WORLD_VS, fragmentShader: RING_FS,
      transparent: true, side: T.DoubleSide, depthWrite: false
    }));
    rings = new T.Mesh(rGeo, ringMat);
    rings.rotation.x = -PI / 2;
    rings.renderOrder = 4;
    tilt.add(rings);
  }

  /* Скорости вращения: сутки за полторы-три минуты. Облака идут
     чуть быстрее тела - на снимках с орбиты именно так и есть,
     и этот сдвиг оживляет планету сильнее любой другой мелочи. */
  var spinSpeed = (opts.spin === 0 ? 0 : (TAU / (isGas ? 55 : 110)) * (opts.spin || 1));
  var cloudSpeed = spinSpeed * 1.35 + 0.0032;

  var tmpV = new T.Vector3();
  var visible = { clouds: true, atm: true };
  var st = { t: 0 };

  function setSun(x, y, z) {
    if (x && typeof x === "object") U.sun.value.set(x.x, x.y, x.z);
    else U.sun.value.set(x, y, z);
    U.sun.value.normalize();
  }
  function setSunPosition(p) {
    group.getWorldPosition(tmpV);
    U.sun.value.copy(p).sub(tmpV).normalize();
  }

  function update(dt, camPos) {
    if (!(dt > 0)) dt = 0;
    if (dt > 0.2) dt = 0.2;                /* после вкладки в фоне не проворачивать полвитка */
    st.t += dt;
    U.time.value = st.t;
    spin.rotation.y += spinSpeed * dt;
    if (clouds) clouds.rotation.y += (cloudSpeed - spinSpeed) * dt;

    if (rings) {
      group.getWorldPosition(U.center.value);
      rings.getWorldDirection(U.ringN.value);
    }

    /* Дальний LOD: с большого расстояния слой облаков и дымка
       занимают доли пикселя, но стоят полноценных проходов.
       Гасим их и возвращаем бюджет кадру. */
    if (camPos) {
      group.getWorldPosition(tmpV);
      var far = tmpV.distanceTo(camPos) > radius * 60;
      if (clouds && visible.clouds === far) { visible.clouds = !far; clouds.visible = !far; }
      if (atmInner && visible.atm === far) { visible.atm = !far; atmInner.visible = !far; }
    }
  }

  function dispose() {
    for (var i = 0; i < trash.length; i++) {
      var o = trash[i];
      if (o && o.dispose) { try { o.dispose(); } catch (e) {} }
    }
    trash.length = 0;
    maps.h = null;
  }

  return {
    group: group, update: update, radius: radius, dispose: dispose,
    kind: kind, seed: seed, detail: detail,
    body: body, clouds: clouds, atmosphere: atmOuter, haze: atmInner, rings: rings,
    tiltGroup: tilt, spinGroup: spin, material: mat, sun: U.sun,
    setSun: setSun, setSunPosition: setSunPosition
  };
}

/* ── Звезда системы ──────────────────────────────────────── */
function star(opts) {
  opts = opts || {};
  var radius = opts.radius > 0 ? opts.radius : 160;
  var seed = (typeof opts.seed === "number") ? (opts.seed >>> 0) : ((Math.random() * 0xFFFFFFFF) >>> 0);
  var rnd = rngFrom(seed);
  var high = opts.detail !== "low";

  /* Класс задаёт пару цветов: горячее ядро гранулы и холодная
     межгранульная дорожка. Разница между ними и есть «кипение». */
  var hot = new T.Color(typeof opts.tint === "number" ? opts.tint : 0xfff3d2);
  var cool = hot.clone().multiplyScalar(0.70).lerp(new T.Color(0xff9a38), 0.30);

  var trash = [];
  function keep(o) { trash.push(o); return o; }

  var group = new T.Group();
  var uT = { value: 0 };

  var coreGeo = keep(new T.SphereGeometry(radius, high ? 64 : 32, high ? 48 : 24));
  var coreMat = keep(new T.ShaderMaterial({
    uniforms: {
      uT: uT,
      uHot: { value: new T.Vector3(hot.r, hot.g, hot.b) },
      uCool: { value: new T.Vector3(cool.r, cool.g, cool.b) },
      uSpots: { value: typeof opts.spots === "number" ? opts.spots : 0.55 }
    },
    vertexShader: WORLD_VS, fragmentShader: STAR_FS
  }));
  var core = new T.Mesh(coreGeo, coreMat);
  group.add(core);

  var uCen = { value: new T.Vector3() };
  var corGeo = keep(new T.SphereGeometry(radius * 2.3, high ? 48 : 24, high ? 32 : 16));
  var corMat = keep(new T.ShaderMaterial({
    uniforms: {
      uT: uT, uCol: { value: new T.Vector3(hot.r, hot.g, hot.b) },
      uStr: { value: typeof opts.corona === "number" ? opts.corona : 1.30 },
      uCenter: uCen, uR: { value: radius }
    },
    vertexShader: WORLD_VS, fragmentShader: CORONA_FS,
    transparent: true, side: T.BackSide, depthWrite: false, blending: T.AdditiveBlending
  }));
  var corona = new T.Mesh(corGeo, corMat);
  corona.renderOrder = 2;
  group.add(corona);

  /* Дальнее гало спрайтом: настоящее свечение звёздной атмосферы
     тянется на несколько радиусов, оболочкой это не набрать - она
     получилась бы гигантской и всё бы перекрыла */
  var hc = canvas2d(256, 256);
  var hx = hc.getContext("2d");
  var grd = hx.createRadialGradient(128, 128, 0, 128, 128, 128);
  var hs = "rgba(" + ((hot.r * 255) | 0) + "," + ((hot.g * 255) | 0) + "," + ((hot.b * 255) | 0) + ",";
  grd.addColorStop(0.00, hs + "1.00)");
  grd.addColorStop(0.10, hs + "0.62)");
  grd.addColorStop(0.22, hs + "0.24)");
  grd.addColorStop(0.45, hs + "0.07)");
  grd.addColorStop(0.72, hs + "0.02)");
  grd.addColorStop(1.00, hs + "0)");
  hx.fillStyle = grd;
  hx.fillRect(0, 0, 256, 256);
  var haloMat = keep(new T.SpriteMaterial({
    map: keep(texFrom(hc, true)), transparent: true,
    depthWrite: false, blending: T.AdditiveBlending, opacity: 1
  }));
  var halo = new T.Sprite(haloMat);
  var haloK = radius * (opts.haloScale || 5.6);
  halo.scale.setScalar(haloK);
  halo.renderOrder = 3;
  group.add(halo);

  var light = null;
  if (opts.light !== false) {
    light = new T.PointLight(hot.getHex(), opts.intensity || 2.4, opts.distance || 0, 2);
    group.add(light);
  }

  var flick = rnd() * TAU;
  function update(dt) {
    if (!(dt > 0)) dt = 0;
    if (dt > 0.2) dt = 0.2;
    uT.value += dt;
    group.getWorldPosition(uCen.value);   /* корона считает расстояние от центра светила */
    /* Едва заметное дыхание гало: ровный спрайт выдаёт статику */
    var f = 1 + Math.sin(uT.value * 0.7 + flick) * 0.018 + Math.sin(uT.value * 1.9) * 0.008;
    halo.scale.setScalar(haloK * f);
    if (light) light.intensity = (opts.intensity || 2.4) * (1 + Math.sin(uT.value * 1.3 + flick) * 0.02);
  }

  function dispose() {
    for (var i = 0; i < trash.length; i++) {
      var o = trash[i];
      if (o && o.dispose) { try { o.dispose(); } catch (e) {} }
    }
    trash.length = 0;
  }

  return {
    group: group, update: update, radius: radius, dispose: dispose,
    core: core, corona: corona, halo: halo, light: light, seed: seed
  };
}

function kinds() { return KINDS.slice(); }

g.RC_PLANETS = { make: make, kinds: kinds, star: star, version: "1.1" };

})(window);
