/* ═══════════════════════════════════════════════════════════
   Rocket CDN · слой реализма для всего мира

   Заказчик показал девять референсов кабины и сказал одно:
   должно быть как в жизни, уровень Mass Effect. Разбор показал,
   что мешает ровно три вещи, и все три чинятся здесь, не трогая
   ни одной формы и ни одной точки сценария.

   1. Материал. Салон и полёт собраны на Phong. Phong не знает
      ни металличности, ни шероховатости, ни отражений: он умеет
      только «цвет плюс блик». Отсюда пластик. Переводим на
      Standard и даём каждому материалу карты, чтобы поверхность
      перестала быть равномерной.

   2. Свет. Отражать было нечего: сцене неоткуда взять окружение.
      Собираем панораму (солнце, Земля, полоса Млечного Пути),
      прогоняем через PMREM и кладём в scene.environment. После
      этого металл начинает ловить свет так, как ловит в кадре.

   3. Плёнка. Ни тональной кривой, ни свечения, ни виньетки, ни
      зерна. Кадр выглядел выводом отладчика. Свой композер даёт
      всё это одним проходом поверх сцены.

   Карты рисуем сами на canvas, а не тянем файлами: восемь мегабайт
   текстур на телефоне дороже, чем полсекунды рисования, и заодно
   у страницы по-прежнему нет ни одного внешнего запроса.

   Бюджет. На слабом устройстве свечение отключается, остаётся
   один дешёвый проход: кривая, виньетка, зерно. Мир при этом не
   исчезает - правило «3D нельзя выключать ради скорости» здесь
   соблюдено, падает только украшательство.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var R = {};
g.RC_REAL = R;

/* ── насколько слабое устройство ─────────────────────────── */
function tier() {
  var mem = navigator.deviceMemory || 4;
  var cpu = navigator.hardwareConcurrency || 4;
  var w = Math.min(innerWidth, innerHeight);
  if (mem <= 2 || cpu <= 2) return 0;          /* только кривая */
  if (w < 500 || mem <= 4) return 1;           /* кривая и слабое свечение */
  return 2;                                     /* всё */
}
R.tier = tier;

/* ═══════════════ карты поверхности ═══════════════════════ */

/* ── Анизотропия: одна на все карты этого модуля ──────────────
   Карты нормалей и шероховатости ложатся на стены рубки и на корпус
   корабля, а те почти всегда видны НАИСКОСЬ: цилиндрическая стена в
   обороте, скошенные панели пульта, борт корабля в пролёте. При
   анизотропии в единицу видеокарта берёт уровень мип-карты по самой
   сжатой оси, и рисунок вдоль другой оси размазывается в кашу
   задолго до того, как это оправдано расстоянием.

   Ровно эту причину нашли в rc-cabin: там экраны, обшивка и настил
   стояли с единицей при восьмёрке на остальном салоне, и именно она
   давала «стены мутные». Карты из этого модуля тогда остались
   непочиненными - чиним здесь.

   Восемь, а не шестнадцать: выше восьми разница на наших размерах
   текстур уже не читается, а выборок становится вдвое больше.
   Памяти анизотропия не стоит вовсе, только выборок при чтении. */
var АНИЗО = 8;


/* Шум-основа: складываем несколько частот, получаем ткань
   поверхности, а не равномерную заливку. */
function noiseField(w, h, oct, seed) {
  var out = new Float32Array(w * h), amp = 1, tot = 0, s = seed || 1;
  function rnd() { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }
  for (var o = 0; o < oct; o++) {
    var step = Math.pow(2, o + 1);
    var gw = Math.max(2, Math.ceil(w / (w / step))), gh = Math.max(2, Math.ceil(h / (h / step)));
    var grid = new Float32Array(gw * gh);
    for (var i = 0; i < grid.length; i++) grid[i] = rnd();
    for (var y = 0; y < h; y++) {
      var fy = y / h * (gh - 1), y0 = Math.floor(fy), ty = fy - y0, y1 = Math.min(gh - 1, y0 + 1);
      for (var x = 0; x < w; x++) {
        var fx = x / w * (gw - 1), x0 = Math.floor(fx), tx = fx - x0, x1 = Math.min(gw - 1, x0 + 1);
        var a = grid[y0 * gw + x0], b = grid[y0 * gw + x1], c = grid[y1 * gw + x0], d = grid[y1 * gw + x1];
        var sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        out[y * w + x] += (a + (b - a) * sx + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy) * amp;
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (var k = 0; k < out.length; k++) out[k] /= tot;
  return out;
}

/* Рельеф обшивки: шлифовка вдоль, случайные царапины,
   вмятинки у крепежа. Всё в высотах, нормаль считаем ниже. */
function heightMap(size, kind, seed) {
  var w = size, h = size, H = new Float32Array(w * h);
  var base = noiseField(w, h, 4, seed || 7);
  var s = seed || 7;
  function rnd() { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }

  for (var i = 0; i < H.length; i++) H[i] = base[i] * 0.22;

  /* Шлифовка: тонкие борозды в одном направлении. Именно она
     отличает обработанный металл от залитого цветом. */
  var dir = kind === "deck" ? 1 : 0;
  var lines = kind === "glass" ? 0 : Math.round(size * 1.6);
  for (var L = 0; L < lines; L++) {
    var p = Math.floor(rnd() * (dir ? h : w));
    var str = 0.02 + rnd() * 0.05;
    var len = Math.floor((0.3 + rnd() * 0.7) * (dir ? w : h));
    var off = Math.floor(rnd() * (dir ? w : h));
    for (var t = 0; t < len; t++) {
      var xx = dir ? (off + t) % w : p;
      var yy = dir ? p : (off + t) % h;
      H[yy * w + xx] += str * (rnd() > 0.5 ? 1 : -1);
    }
  }

  /* Царапины: короткие, под углом, с рваным краем. */
  var scr = kind === "glass" ? 3 : Math.round(size / 12);
  for (var c = 0; c < scr; c++) {
    var x = rnd() * w, y = rnd() * h;
    var ang = rnd() * Math.PI * 2, ln = (0.04 + rnd() * 0.22) * size, deep = 0.10 + rnd() * 0.22;
    for (var q = 0; q < ln; q++) {
      var px = Math.floor(x + Math.cos(ang) * q) % w, py = Math.floor(y + Math.sin(ang) * q) % h;
      if (px < 0) px += w; if (py < 0) py += h;
      H[py * w + px] -= deep * (1 - q / ln) * (0.7 + rnd() * 0.6);
    }
  }

  /* Крепёж: утопленные точки с валиком по краю. */
  if (kind !== "glass") {
    var bolts = Math.round(size / 26);
    for (var b = 0; b < bolts; b++) {
      var bx = Math.floor(rnd() * w), by = Math.floor(rnd() * h), rad = 2 + Math.floor(rnd() * 3);
      for (var dy = -rad - 1; dy <= rad + 1; dy++) {
        for (var dx = -rad - 1; dx <= rad + 1; dx++) {
          var d2 = Math.sqrt(dx * dx + dy * dy);
          var ix = (bx + dx + w) % w, iy = (by + dy + h) % h;
          if (d2 <= rad) H[iy * w + ix] -= 0.30 * (1 - d2 / rad);
          else if (d2 <= rad + 1) H[iy * w + ix] += 0.12;
        }
      }
    }
  }
  return H;
}

/* Высоты в карту нормалей. Оператор Собеля по кольцу, чтобы
   текстура сходилась на стыке и не давала шва. */
function normalTexture(T, size, kind, strength, seed) {
  var H = heightMap(size, kind, seed);
  var cv = document.createElement("canvas"); cv.width = cv.height = size;
  var ctx = cv.getContext("2d"), img = ctx.createImageData(size, size), d = img.data;
  var S = strength == null ? 2.4 : strength;
  function at(x, y) { return H[((y + size) % size) * size + ((x + size) % size)]; }
  for (var y = 0; y < size; y++) {
    for (var x = 0; x < size; x++) {
      var gx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      var gy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      var nx = -gx * S, ny = -gy * S, nz = 1;
      var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      var o = (y * size + x) * 4;
      d[o] = (nx / len * 0.5 + 0.5) * 255;
      d[o + 1] = (ny / len * 0.5 + 0.5) * 255;
      d[o + 2] = (nz / len * 0.5 + 0.5) * 255;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  var t = new T.CanvasTexture(cv);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = АНИЗО;
  return t;
}

/* Карта шероховатости: пятна затёртости, следы рук у ручек,
   осевшая пыль в углублениях. Ровный металл в жизни не бывает. */
function roughTexture(T, size, lo, hi, seed) {
  var a = noiseField(size, size, 5, (seed || 3) * 13);
  var b = noiseField(size, size, 2, (seed || 3) * 71);
  var cv = document.createElement("canvas"); cv.width = cv.height = size;
  var ctx = cv.getContext("2d"), img = ctx.createImageData(size, size), d = img.data;
  for (var i = 0; i < size * size; i++) {
    var v = a[i] * 0.65 + b[i] * 0.35;
    v = lo + (hi - lo) * v;
    var o = i * 4;
    d[o] = d[o + 1] = d[o + 2] = Math.max(0, Math.min(255, v * 255)) | 0;
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  var t = new T.CanvasTexture(cv);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = АНИЗО;
  return t;
}

/* Копия карты под нужную кратность повторения. Копии тоже
   кешируем: одна и та же пара «карта плюс кратность» встречается
   у десятков материалов, и плодить их незачем. */
var repCache = {};
function repeated(T, tex, rep) {
  if (!tex) return null;
  if (!tex.uuid) return tex;
  var key = tex.uuid + "@" + rep;
  if (repCache[key]) return repCache[key];
  var c = tex.clone();
  c.needsUpdate = true;
  c.wrapS = c.wrapT = T.RepeatWrapping;
  /* Клон анизотропию НЕ наследует автоматически в старых сборках, а
     копий здесь десятки - ставим явно, иначе половина стен снова
     осталась бы с единицей. */
  c.anisotropy = АНИЗО;
  c.repeat.set(rep, rep);
  repCache[key] = c;
  return c;
}

/* Карты живут в кэше: один набор на весь сайт, а не по набору
   на каждый материал. */
var cache = {};
R.maps = function (T, kind) {
  var k = kind || "hull";
  if (cache[k]) return cache[k];
  var size = tier() === 0 ? 128 : 256;
  var set;
  if (k === "deck") set = { normal: normalTexture(T, size, "deck", 2.1, 21), rough: roughTexture(T, size, 0.34, 0.78, 5) };
  else if (k === "glass") set = { normal: normalTexture(T, size, "glass", 0.5, 33), rough: roughTexture(T, size, 0.02, 0.14, 9) };
  else if (k === "panel") set = { normal: normalTexture(T, size, "hull", 1.7, 44), rough: roughTexture(T, size, 0.42, 0.86, 11) };
  else set = { normal: normalTexture(T, size, "hull", 2.6, 7), rough: roughTexture(T, size, 0.18, 0.62, 3) };
  cache[k] = set;
  return set;
};

/* ── Прогрев карт заранее ────────────────────────────────────
   Владелец пишет про вход в ракету одно и то же: «абсолютно всегда
   зависает». Замер показал, куда уходит время. Сборка салона на
   этой машине занимала 7,4 секунды, и 5,8 из них - вот эти четыре
   набора карт: рельеф и шероховатость для обшивки, настила, стекла
   и приборных корпусов. Считаются они попиксельно и все разом, тем
   самым кадром, которым открывается люк.

   Работа сама по себе нужная, ненужен момент. Человек читает
   страницу задолго до того, как дойдёт до корабля, и в это время
   процессор простаивает. Раскладываем наборы по свободным
   промежуткам: по одному на промежуток, чтобы ни один не съел
   кадр целиком. К моменту входа карты уже лежат в кэше, и сборка
   салона их просто берёт - замер после прогрева дал 2,1 секунды
   вместо 7,4.

   Если человек добрался до корабля раньше, чем прогрев доработал,
   ничего не ломается: R.maps соберёт недостающее на месте, как и
   раньше. Прогрев это ускорение, а не условие. */
function вСвободное(fn) {
  if (typeof requestIdleCallback === "function") requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 150);
}
R.прогрев = function (T) {
  if (!T || R.прогрев.начат) return;
  R.прогрев.начат = true;
  var очередь = ["hull", "deck", "glass", "panel"];
  var шаг = function () {
    var k = очередь.shift();
    if (!k) return;
    try { R.maps(T, k); } catch (e) {}
    if (очередь.length) вСвободное(шаг);
  };
  вСвободное(шаг);
};

/* ═══════════════ окружение для отражений ═════════════════ */

/* Панорама вокруг сцены: солнце сбоку, тёплое пятно Земли снизу,
   полоса Галактики, общий холод космоса. Металл отражает именно
   её, поэтому корпус перестаёт быть плоским. */

/* Доля ширины, на которой стоит солнце в базовой панораме. Через
   неё считается доворот: цифра живёт рядом с рисованием солнца,
   чтобы правка одного не разошлась с другим. */
var SUN_U = 0.74;

function envCanvas(warm) {
  var w = 512, h = 256;
  var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  var x = cv.getContext("2d");
  x.fillStyle = "#02040a"; x.fillRect(0, 0, w, h);

  var mw = x.createLinearGradient(0, h * 0.20, w, h * 0.62);
  mw.addColorStop(0, "rgba(20,26,40,0)");
  mw.addColorStop(0.35, "rgba(96,86,74,0.42)");
  mw.addColorStop(0.5, "rgba(150,134,112,0.55)");
  mw.addColorStop(0.66, "rgba(88,80,72,0.38)");
  mw.addColorStop(1, "rgba(16,22,34,0)");
  x.fillStyle = mw;
  x.save(); x.translate(0, h * 0.06); x.rotate(-0.10); x.fillRect(-w, h * 0.16, w * 3, h * 0.30); x.restore();

  var sun = x.createRadialGradient(w * 0.74, h * 0.30, 2, w * 0.74, h * 0.30, h * 0.52);
  sun.addColorStop(0, "rgba(255,248,232,1)");
  sun.addColorStop(0.12, "rgba(255,232,196,0.62)");
  sun.addColorStop(1, "rgba(255,214,160,0)");
  x.fillStyle = sun; x.fillRect(0, 0, w, h);

  var earth = x.createRadialGradient(w * 0.26, h * 0.80, 4, w * 0.26, h * 0.80, h * 0.66);
  earth.addColorStop(0, "rgba(150,206,246,0.92)");
  earth.addColorStop(0.30, "rgba(64,138,196,0.52)");
  earth.addColorStop(1, "rgba(12,38,70,0)");
  x.fillStyle = earth; x.fillRect(0, 0, w, h);

  if (warm) {
    var lamp = x.createRadialGradient(w * 0.06, h * 0.52, 2, w * 0.06, h * 0.52, h * 0.40);
    lamp.addColorStop(0, "rgba(255,186,102,0.70)");
    lamp.addColorStop(1, "rgba(255,150,60,0)");
    x.fillStyle = lamp; x.fillRect(0, 0, w, h);
  }

  var s = 12345;
  function rnd() { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }
  for (var i = 0; i < 900; i++) {
    var px = rnd() * w, py = rnd() * h, b = Math.pow(rnd(), 3.2);
    x.fillStyle = "rgba(255,255,255," + (0.12 + b * 0.86).toFixed(3) + ")";
    var r = b > 0.8 ? 1.5 : 0.8;
    x.fillRect(px, py, r, r);
  }
  return cv;
}

/* Та же панорама, довёрнутая по горизонтали. Развёртка замкнута по
   кругу, поэтому поворот это сдвиг с переносом: рисуем базовый холст
   дважды - на месте и на ширину левее.

   Только по горизонтали. Наклон светила над плоскостью сдвигом не
   передать: равнопромежуточная развёртка тянет полюса, и сдвиг по
   вертикали рвёт небо швом поперёк всего кадра. */
function envRotated(base, shift) {
  var d = ((shift % 1) + 1) % 1;
  if (d < 1e-3) return base;
  var cv = document.createElement("canvas");
  cv.width = base.width; cv.height = base.height;
  var x = cv.getContext("2d");
  var dx = Math.round(d * base.width);
  x.drawImage(base, dx, 0);
  x.drawImage(base, dx - base.width, 0);
  return cv;
}

var envCache = {};
/* sunDir - фактическое направление на светило в мире сцены.
   Панорама рисовалась с солнцем на постоянном месте и со сценой не
   поворачивалась: корабль разворачивался, свет на нём приходил с
   одной стороны, а блик в металле оставался с другой. Азимут
   укладывается в ширину развёртки ровно так, как её читает
   библиотека: u = atan2(z, x) / 2pi + 0.5.

   Направление необязательное: без него панорама остаётся ровно
   такой, какой была, поэтому старые вызовы ничего не замечают.
   Шаг доворота грубый, одна тридцать вторая круга: каждый новый
   угол это своя свёртка PMREM, а отражение окружения таких долей
   на глаз не различает. */
R.env = function (T, renderer, warm, sunDir) {
  var shift = 0;
  if (sunDir && (sunDir.x || sunDir.y || sunDir.z)) {
    var u = Math.atan2(sunDir.z, sunDir.x) / (Math.PI * 2) + 0.5;
    shift = Math.round((u - SUN_U) * 32) / 32;
  }
  var key = (warm ? "warm" : "cold") + "@" + shift;
  if (envCache[key]) return envCache[key];
  try {
    var tex = new T.CanvasTexture(envRotated(envCanvas(warm), shift));
    tex.mapping = T.EquirectangularReflectionMapping;
    if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    var pm = new T.PMREMGenerator(renderer);
    pm.compileEquirectangularShader();
    var out = pm.fromEquirectangular(tex).texture;
    pm.dispose(); tex.dispose();
    envCache[key] = out;
    return out;
  } catch (e) { return null; }
};

/* ═══════════════ перевод материалов на физику ════════════ */

/* Phong в Standard. Блеск Phong переводим в шероховатость по
   тому же закону, по которому он и задавался, поэтому картинка
   не «плывёт»: она становится честной. */
R.toStandard = function (T, mat, opt) {
  if (!mat || mat.isMeshStandardMaterial) return mat;
  var o = opt || {};
  var shin = mat.shininess == null ? 30 : mat.shininess;
  var rough = o.roughness != null ? o.roughness : Math.max(0.06, Math.min(0.98, 1 - Math.sqrt(shin / 220)));
  var metal = o.metalness != null ? o.metalness : (mat.specular ? 0.72 : 0.18);
  var kind = o.kind || "hull";
  var m = R.maps(T, kind);

  var s = new T.MeshStandardMaterial({
    color: mat.color ? mat.color.clone() : 0xffffff,
    map: mat.map || null,
    /* Рельеф из исходного материала переносим. Первая версия его
       теряла, и приборная панель, у которой вся фактура жила в
       bumpMap, выходила гладкой пластиной - ровно то, что заказчик
       назвал «плоское рисованное». */
    bumpMap: mat.bumpMap || null,
    bumpScale: mat.bumpScale || 0,
    alphaMap: mat.alphaMap || null,
    emissiveMap: mat.emissiveMap || null,
    roughness: rough,
    metalness: metal,
    transparent: mat.transparent,
    opacity: mat.opacity,
    side: mat.side,
    fog: mat.fog,
    depthWrite: mat.depthWrite,
    emissive: mat.emissive ? mat.emissive.clone() : 0x000000,
    emissiveIntensity: mat.emissiveIntensity || 1
  });
  /* Собственный рельеф материала важнее общего: если у поверхности
     уже есть своя карта, детализирующую не навязываем, иначе две
     фактуры дерутся и дают грязь.

     Кратность повторения ставим на КОПИИ карты, а не на общей.
     Карты лежат в кэше и раздаются всем материалам сразу; правка
     повторения на общем объекте переписывала бы масштаб фактуры
     всем, кто взял её раньше - побеждал бы последний вызвавший.
     Копия делит ту же картинку в памяти видеокарты, поэтому
     стоит она почти ничего. */
  var rep = o.repeat || 3;
  if (m && !s.bumpMap) {
    s.normalMap = repeated(T, m.normal, rep);
    s.normalScale = new T.Vector2(o.normalScale || 0.55, o.normalScale || 0.55);
  }
  if (m && !mat.roughnessMap) {
    s.roughnessMap = repeated(T, m.rough, rep);
  }
  s.envMapIntensity = o.envMapIntensity != null ? o.envMapIntensity : 1.0;
  return s;
};

/* Пройтись по готовому узлу и заменить всё разом. Вызывать
   после сборки геометрии: формы не меняются, меняется только
   то, как поверхность отвечает на свет. */
R.upgradeTree = function (T, root, rules) {
  if (!root) return 0;
  var n = 0;
  /* Один Phong обычно висит сразу на десятке мешей: салон собирается
     из общих материалов, а не из своего на каждую деталь. Раньше
     каждому мешу делался отдельный Standard, а исходный материал
     оставался жить со своей программой в памяти видеокарты - обход
     салона оставлял за собой сотни висячих материалов и столько же
     лишних Standard там, где хватило бы одного.

     Замену запоминаем по паре «исходный материал плюс его правило»:
     правило входит в ключ потому, что вызывающий смотрит и на меш
     тоже и вправе выдать одному материалу разные настройки.

     Освобождаем не на месте, а списком после обхода. На месте нельзя:
     до части мешей обход ещё не дошёл, и они держат тот же материал -
     освобождённый материал успел бы попасть в кадр. Текстуры при этом
     не страдают, dispose материала их не трогает, а карты мы перенесли
     в новый материал по ссылке. */
  var made = {}, spent = [];
  function hintKey(h) {
    if (!h) return "-";
    return [h.kind, h.roughness, h.metalness, h.normalScale, h.envMapIntensity, h.repeat].join(",");
  }
  root.traverse(function (o) {
    if (!o.isMesh || !o.material) return;
    var apply = function (mm) {
      if (!mm || mm.isMeshStandardMaterial) return mm;
      /* Basic оставляем: это светящиеся элементы, им физика не нужна */
      if (mm.isMeshBasicMaterial) return mm;
      var hint = rules && rules(o, mm);
      if (hint === false) return mm;
      var key = mm.uuid + "|" + hintKey(hint);
      if (made[key]) return made[key];
      n++;
      var s = R.toStandard(T, mm, hint || {});
      made[key] = s;
      if (spent.indexOf(mm) < 0) spent.push(mm);
      return s;
    };
    if (Array.isArray(o.material)) o.material = o.material.map(apply);
    else o.material = apply(o.material);
  });
  for (var i = 0; i < spent.length; i++) {
    try { spent[i].dispose(); } catch (e) {}
  }
  return n;
};

/* ═══════════════ плёнка ══════════════════════════════════ */

var VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

/* Яркие места отдельно: всё, что выше порога, уходит в размытие
   и возвращается ореолом. Так светятся лампы и голограммы. */
/* Потолок яркости у источника ореола и четыре отсчёта вместо одного.

   Потолок появился из-за белого квадрата: одна раскалённая точка -
   солнечный серп на кромке Земли - уносила буфер свечения далеко за
   единицу, и на кадре вместо ореола висел МЯГКИЙ БЕЛЫЙ КВАДРАТ в
   полсотни пикселей. Приёмка приняла его сперва за сломанный спрайт,
   потом за отражение окружения; на деле буфер свечения был вчетверо
   мельче кадра, и один его тексель, растянутый обратно, и есть тот
   квадрат.

   Потолок тогда поставили на 2.2, и это оказалась другая крайность:
   солнце в упор светило ровно так же, как лампа на пульте, и слепить
   перестало вовсе. Квадрат давало не само число, а единственный
   мелкий буфер. Теперь ореол собирается пирамидой и самый мелкий её
   уровень размывается многократно: одиночный выброс расходится, а не
   растягивается прямоугольником. Потолок поэтому поднят - яркому
   разрешено оставаться ярким.

   Четыре отсчёта по углам тексела это честное уменьшение вдвое.
   Одиночная выборка из полного кадра в мелкий буфер брала строку
   через строку, и звёзды в ореоле мигали при каждом движении камеры.
   Ограничение ставим на каждом отсчёте до усреднения: иначе один
   горячий тексель протаскивает свой перебор через среднее. */
var BRIGHT = [
  "uniform sampler2D tD; uniform float thr; uniform float soft;",
  "uniform float hicap; uniform vec2 px; varying vec2 vUv;",
  "vec3 grab(vec2 uv){",
  "  vec3 c = texture2D(tD, uv).rgb;",
  "  float l = dot(c, vec3(0.2126,0.7152,0.0722));",
  "  vec3 b = c * smoothstep(thr, thr + soft, l);",
  "  float m = max(max(b.r, b.g), b.b);",
  "  if (m > hicap) b *= hicap / m;",
  "  return b; }",
  "void main(){",
  "  vec3 s = grab(vUv + vec2(-0.5,-0.5) * px) + grab(vUv + vec2(0.5,-0.5) * px)",
  "         + grab(vUv + vec2(-0.5, 0.5) * px) + grab(vUv + vec2(0.5, 0.5) * px);",
  "  gl_FragColor = vec4(s * 0.25, 1.0); }"
].join("\n");

var BLUR = [
  "uniform sampler2D tD; uniform vec2 dir; varying vec2 vUv;",
  "void main(){ vec4 s = texture2D(tD, vUv) * 0.2270270270;",
  "  s += texture2D(tD, vUv + dir * 1.3846153846) * 0.3162162162;",
  "  s += texture2D(tD, vUv - dir * 1.3846153846) * 0.3162162162;",
  "  s += texture2D(tD, vUv + dir * 3.2307692308) * 0.0702702703;",
  "  s += texture2D(tD, vUv - dir * 3.2307692308) * 0.0702702703;",
  "  gl_FragColor = s; }"
].join("\n");

/* Сглаживание в самом композите. Нужно там, где multisample у цели
   рендера недоступен: на WebGL 1 его нет вовсе, а на самом слабом
   уровне мы отказываемся от него сами - полнокадровый multisample-
   буфер там дороже, чем девять выборок на пиксель.
   Классический FXAA: по яркостям на кресте находим направление края
   и усредняем поперёк него. */
var FXAA = [
  "float fxLum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }",
  "vec3 fxaa(sampler2D t, vec2 uv, vec2 px){",
  "  float nw = fxLum(texture2D(t, uv + vec2(-1.0,-1.0) * px).rgb);",
  "  float ne = fxLum(texture2D(t, uv + vec2( 1.0,-1.0) * px).rgb);",
  "  float sw = fxLum(texture2D(t, uv + vec2(-1.0, 1.0) * px).rgb);",
  "  float se = fxLum(texture2D(t, uv + vec2( 1.0, 1.0) * px).rgb);",
  "  vec3 cm = texture2D(t, uv).rgb; float lm = fxLum(cm);",
  "  float lo = min(lm, min(min(nw, ne), min(sw, se)));",
  "  float hi = max(lm, max(max(nw, ne), max(sw, se)));",
  "  vec2 dir = vec2(-((nw + ne) - (sw + se)), ((nw + sw) - (ne + se)));",
  "  float damp = max((nw + ne + sw + se) * 0.03125, 0.0078125);",
  "  float k = 1.0 / (min(abs(dir.x), abs(dir.y)) + damp);",
  "  dir = clamp(dir * k, vec2(-8.0), vec2(8.0)) * px;",
  "  vec3 a = 0.5 * (texture2D(t, uv + dir * -0.1666667).rgb",
  "                + texture2D(t, uv + dir *  0.1666667).rgb);",
  "  vec3 b = a * 0.5 + 0.25 * (texture2D(t, uv + dir * -0.5).rgb",
  "                           + texture2D(t, uv + dir *  0.5).rgb);",
  "  float lb = fxLum(b);",
  "  return (lb < lo || lb > hi) ? a : b; }"
].join("\n");

/* Сведение: кривая ACES, ореол, лёгкое расхождение цвета по краю,
   виньетка и зерно. Ровно то, чем кадр кино отличается от вывода
   отладчика. */
/* Сведение. Порядок важен и именно такой:
   расхождение каналов по краю, ореол, экспозиция, кривая, перевод
   в sRGB, виньетка, зерно.

   Про sRGB отдельно. Сцена уходит в буфер, а буфер линейный: при
   отрисовке в render target библиотека перевод не делает, она
   делает его только на холст и только своим материалам. Наш проход
   пишет напрямую, поэтому переводим сами. Без этой строки кадр
   выходит вдвое темнее нужного - что и случилось на первом прогоне.

   Расхождение каналов держим микроскопическим: это оптика, а не
   поломка сигнала. Смещение считаем в пикселях, а не в долях
   экрана, иначе на широком мониторе край расползается радугой. */
function compShader(fx) {
  return [
    "uniform sampler2D tD; uniform sampler2D tB; uniform sampler2D tB2;",
    "uniform sampler2D tB3; uniform sampler2D tB4; uniform vec4 halo;",
    "uniform float bloom;",
    "uniform float expo; uniform float vig; uniform float grain; uniform float time; uniform float ab;",
    "uniform vec2 px;",
    "varying vec2 vUv;",
    "vec3 aces(vec3 x){ float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }",
    "vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)), vec3(0.41666))-0.055, step(0.0031308, c)); }",
    /* Хэш без синуса. Классический fract(sin(dot(...))) держится на
       точности sin от больших аргументов, а её у видеокарт не хватает:
       вместо шума получается правильная РЕШЁТКА по всему кадру. На
       тёмном небе она видна отчётливо, и приёмка приняла её за
       наложение из вёрстки. Здесь три перемножения дробных частей -
       ни синуса, ни зависимости от точности. */
    "float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));",
    "  q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }",
    fx ? FXAA : "",
    "void main(){",
    "  vec2 d = vUv - 0.5; float r2 = dot(d,d);",
    "  vec2 off = normalize(d + 1e-6) * r2 * ab * px;",
    "  vec3 c;",
    /* Без multisample кадр сперва проходит FXAA, и расхождение каналов
       ложится на уже сглаженный кадр поправкой, а не тремя своими
       выборками: сдвиг тут доли пикселя, а девять выборок FXAA на
       каждый канал стоили бы втрое дороже всего прохода. */
    fx ? "  vec3 base = fxaa(tD, vUv, px); vec3 mid = texture2D(tD, vUv).rgb;" : "",
    fx ? "  c = base;" : "",
    fx ? "  c.r += texture2D(tD, vUv - off).r - mid.r;" : "  c.r = texture2D(tD, vUv - off).r;",
    fx ? "" : "  c.g = texture2D(tD, vUv).g;",
    fx ? "  c.b += texture2D(tD, vUv + off).b - mid.b;" : "  c.b = texture2D(tD, vUv + off).b;",
    "  vec3 h = texture2D(tB, vUv).rgb * halo.x + texture2D(tB2, vUv).rgb * halo.y",
    "         + texture2D(tB3, vUv).rgb * halo.z + texture2D(tB4, vUv).rgb * halo.w;",
    "  c += h * bloom;",
    "  c = aces(c * expo);",
    "  c = toSRGB(c);",
    "  float v = smoothstep(0.92, 0.10, r2 * vig);",
    "  c *= mix(1.0, v, 0.55);",
    /* Зерно. Раньше амплитуда была одна на весь кадр, и на чёрном
       космосе поверх половины площади лежала ровная статика - у
       матрицы её там не бывает: в чистом чёрном остаётся только шум
       считывания, сильнее всего зерно в средних тонах, а в светах его
       прячет сам сигнал. Ведём амплитуду по яркости уже переведённого
       кадра, потому что глазу зерно заметно именно в показанных
       тонах, а не в линейных.

       Внизу оставлен порог, а не ноль. С нулём чистый чёрный выходил
       математически стерильным: восьми разрядов на канал не хватает
       даже на один уровень такой амплитуды, и космос становился
       заливкой. У матрицы в темноте остаётся шум считывания, порог
       двадцать два сотых и есть он.

       Время берём завёрнутым. На сотнях секунд аргумент хэша
       перерастал точность float, соседние кадры давали один и тот же
       узор, и зерно ПОДМЕРЗАЛО - на длинном полёте оно превращалось
       в неподвижную грязь на стекле. Дробная часть возвращает
       аргумент в первую тысячу, где шаг между кадрами ещё есть. */
    "  float lum = dot(c, vec3(0.2126,0.7152,0.0722));",
    "  float amp = 0.22 + 0.78 * smoothstep(0.0, 0.32, lum) * (1.0 - 0.55 * smoothstep(0.55, 1.0, lum));",
    "  float gt = fract(time * 0.37) * 1000.0;",
    "  float n = hash(vUv * 512.0 + gt) - 0.5;",
    "  c += n * grain * amp;",
    "  gl_FragColor = vec4(c, 1.0); }"
  ].filter(function (l) { return l !== ""; }).join("\n");
}

function quad(T, mat) {
  var s = new T.Scene();
  s.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat));
  return s;
}

/* Композер. Держит цели рендера, знает свой уровень качества и
   умеет ужиматься: на слабом устройстве остаётся один проход. */
R.post = function (T, renderer, opt) {
  var o = opt || {};
  var lvl = o.tier != null ? o.tier : tier();
  var P = { tier: lvl, enabled: true };
  var half = T.HalfFloatType;
  var size = new T.Vector2();
  renderer.getSize(size);
  var pr = renderer.getPixelRatio();
  var W = Math.max(2, Math.round(size.x * pr)), H = Math.max(2, Math.round(size.y * pr));

  /* ms - сколько отсчётов на пиксель просить у самой цели.
     depth - нужен ли ей буфер глубины: буферам ореола он не нужен
     никогда, они плоские, а место в памяти видеокарты занимает. */
  function rt(w, h, ms, depth) {
    return new T.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
      type: half, minFilter: T.LinearFilter, magFilter: T.LinearFilter,
      depthBuffer: !!depth, stencilBuffer: false, samples: ms || 0
    });
  }

  /* Сглаживание. antialias, который просят у рендерера, относится к
     ХОЛСТУ, а кадр идёт в свою цель - холст композер только показывает
     готовым. Поэтому запрошенное сглаживание не делало ничего вообще:
     лесенка шла и по лимбам планет, и по кольцам, и по раме кабины,
     хотя в коде antialias честно стоял. Просить его надо у цели
     рендера, иначе просьба уходит в никуда.

     Буферам ореола отсчётов не даём: они мельче кадра в разы и следом
     размываются, сглаживать там нечего, а multisample стоит и памяти,
     и такта на разрешение буфера.

     Числа отсчётов режем по тому, что умеет железо: на WebGL 1
     multisample у цели нет вовсе, и maxSamples там ноль. Если отсчётов
     не досталось, сглаживаем в композите FXAA - девять выборок на
     пиксель дешевле полнокадрового multisample-буфера, а лесенку
     снимают обе дороги. */
  var maxMS = (renderer.capabilities && renderer.capabilities.maxSamples) || 0;
  /* ── Сглаживание среднего класса: FXAA вместо двух отсчётов ──
     Замер в игре на телефоне 412x915: кадр со сглаживанием буфера
     333 мс, без него 217 - треть кадра уходила на два отсчёта по
     цели половинной точности. Это самая дорогая единичная статья
     после самой постобработки, которая целиком стоит 53 процента.

     Отдавать её можно потому, что на телефоне эти отсчёты почти
     ничего не приносят: холст там рисуется с плотностью 1.35 при
     плотности экрана 3, то есть кадр всё равно растягивается в
     два с лишним раза, и субпиксельная точность, ради которой
     сглаживание и делается, теряется на растяге.

     Пустой отсчёт включает FXAA в сведении - ветка написана
     заранее (P.fxaa = msaa === 0) и работает по готовому кадру, а
     не по буферу: кромки текста и рамок она держит, а стоит одного
     прохода, который и так есть.

     Старший класс не трогаем: там кадр рисуется в родной плотности
     монитора, и разницу между отсчётами буфера и фильтром по кадру
     видно на звёздах. */
  var wantMS = o.samples != null ? o.samples : (lvl === 0 ? 0 : (lvl === 1 ? 0 : 4));
  /* На большом кадре четыре отсчёта режем до двух. Цель половинной
     точности с четырьмя отсчётами это восемь байт на пиксель на
     отсчёт: на кадре в четыре мегапикселя буфер вместе с глубиной
     переваливает за две сотни мегабайт, и встроенная видеокарта
     теряет контекст вместо того, чтобы рисовать. Два отсчёта снимают
     ту же лесенку почти так же, а памяти просят вдвое меньше. */
  if (wantMS > 2 && W * H > 4200000) wantMS = 2;
  var msaa = Math.max(0, Math.min(wantMS | 0, maxMS));
  P.samples = msaa;
  P.fxaa = msaa === 0;

  P.scene = rt(W, H, msaa, true);

  /* Ореол пирамидой.

     Было: один буфер вчетверо мельче кадра и два прохода по пять
     отсчётов. Радиус выходил около четырнадцати пикселей, и это всё,
     на что свечение было способно. Оптика так не светит: у настоящего
     ореола есть узкое ядро вплотную к источнику и широкий слабый нимб
     на пол-кадра. Один масштаб не даёт ни того, ни другого - солнце
     получалось тусклой ватой и не слепило.

     Стало: каждый следующий уровень вдвое мельче предыдущего и
     строится ИЗ УЖЕ РАЗМЫТОГО. Радиус на ступень удваивается почти
     даром - работа на всей пирамиде меньше, чем на одном полном
     кадре. Складываем уровни с убывающими весами: ядро несёт первый,
     нимб последний.

     Веса нормируем в сумму единицу, чтобы ручка bloom у вызывающего
     осталась той же величиной, что и была до пирамиды.

     Мельче уровня в шестнадцать раз не спускаемся: там уже мало
     текселей, и буфер начинает дышать при движении камеры. */
  var SHIFT = lvl === 0 ? [] : (lvl === 1 ? [2, 3, 4] : [1, 2, 3, 4]);
  var WEIGHT = lvl === 1 ? [1.0, 0.55, 0.34] : [1.0, 0.62, 0.42, 0.30];
  /* Ширина размытия на уровне, в текселях этого уровня. Первому
     уровню даём поменьше: он и есть ядро, ему положено быть тугим. */
  function ширина(i) { return i === 0 ? 0.9 : 1.4; }

  var уровни = [];
  for (var i = 0; i < SHIFT.length; i++) {
    var lw = Math.max(2, W >> SHIFT[i]), lh = Math.max(2, H >> SHIFT[i]);
    уровни.push({ sh: SHIFT[i], w: lw, h: lh, a: rt(lw, lh, 0, false), b: rt(lw, lh, 0, false) });
  }
  P.levels = уровни;
  /* Прежние имена буферов свечения: на них смотрят снаружи */
  P.b1 = уровни.length ? уровни[0].a : null;
  P.b2 = уровни.length ? уровни[0].b : null;

  var wsum = 0;
  for (i = 0; i < уровни.length; i++) wsum += WEIGHT[i];
  var haloW = new T.Vector4(0, 0, 0, 0);
  for (i = 0; i < уровни.length && i < 4; i++) haloW.setComponent(i, WEIGHT[i] / wsum);

  var cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var mBright = new T.ShaderMaterial({
    uniforms: {
      tD: { value: P.scene.texture },
      thr: { value: o.threshold != null ? o.threshold : 0.72 },
      soft: { value: 0.28 },
      /* Потолок высокий: пирамида размывает выброс, а не растягивает
         его прямоугольником, поэтому слепить солнцу теперь можно */
      hicap: { value: o.bloomTop != null ? o.bloomTop : 8.0 },
      px: { value: new T.Vector2(1 / W, 1 / H) }
    },
    vertexShader: VERT, fragmentShader: BRIGHT, depthTest: false, depthWrite: false
  });
  var mBlur = new T.ShaderMaterial({
    uniforms: { tD: { value: null }, dir: { value: new T.Vector2() } },
    vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false
  });
  var black = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  black.needsUpdate = true;
  function слой(i) { return уровни[i] ? уровни[i].a.texture : black; }
  var mComp = new T.ShaderMaterial({
    uniforms: {
      tD: { value: P.scene.texture },
      tB: { value: слой(0) },
      tB2: { value: слой(1) },
      tB3: { value: слой(2) },
      tB4: { value: слой(3) },
      halo: { value: haloW },
      bloom: { value: lvl === 0 ? 0 : (lvl === 1 ? o.bloomLow || 0.42 : o.bloom || 0.70) },
      expo: { value: o.exposure != null ? o.exposure : 1.06 },
      vig: { value: o.vignette != null ? o.vignette : 1.30 },
      grain: { value: o.grain != null ? o.grain : 0.030 },
      /* Единица - смещение в один пиксель на самом краю кадра */
      ab: { value: lvl === 0 ? 0 : (o.aberration != null ? o.aberration : 3.2) },
      px: { value: new T.Vector2(1 / W, 1 / H) },
      time: { value: 0 }
    },
    vertexShader: VERT, fragmentShader: compShader(P.fxaa), depthTest: false, depthWrite: false
  });

  var sBright = quad(T, mBright), sBlur = quad(T, mBlur), sComp = quad(T, mComp);

  P.setSize = function (w, h) {
    var p = renderer.getPixelRatio();
    W = Math.max(2, Math.round(w * p)); H = Math.max(2, Math.round(h * p));
    P.scene.setSize(W, H);
    mComp.uniforms.px.value.set(1 / W, 1 / H);
    mBright.uniforms.px.value.set(1 / W, 1 / H);
    for (var i = 0; i < уровни.length; i++) {
      var L = уровни[i];
      L.w = Math.max(2, W >> L.sh); L.h = Math.max(2, H >> L.sh);
      L.a.setSize(L.w, L.h); L.b.setSize(L.w, L.h);
    }
  };

  /* Одна отрисовка кадра: сцена в буфер, ореол, сведение на экран */
  P.render = function (scene, camera, t) {
    if (!P.enabled) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    var prevTone = renderer.toneMapping;
    renderer.toneMapping = T.NoToneMapping;   /* кривую накладываем сами */
    renderer.setRenderTarget(P.scene);
    renderer.clear();
    renderer.render(scene, camera);

    if (уровни.length) {
      /* Яркое снимаем сразу в первый уровень пирамиды, дальше каждый
         уровень строится из предыдущего: свой проход по горизонтали
         во вспомогательный буфер, свой по вертикали обратно. Уменьшение
         и размытие делает одна и та же пара проходов - отдельного
         прохода на уменьшение не нужно, выборка и так билинейная. */
      renderer.setRenderTarget(уровни[0].a);
      renderer.clear();
      renderer.render(sBright, cam);
      for (var i = 0; i < уровни.length; i++) {
        var L = уровни[i], src = i === 0 ? уровни[0].a : уровни[i - 1].a, k = ширина(i);
        mBlur.uniforms.tD.value = src.texture;
        mBlur.uniforms.dir.value.set(k / L.w, 0);
        renderer.setRenderTarget(L.b); renderer.clear(); renderer.render(sBlur, cam);
        mBlur.uniforms.tD.value = L.b.texture;
        mBlur.uniforms.dir.value.set(0, k / L.h);
        renderer.setRenderTarget(L.a); renderer.clear(); renderer.render(sBlur, cam);
      }
    }

    mComp.uniforms.time.value = (t || 0) * 0.001;
    renderer.setRenderTarget(null);
    renderer.render(sComp, cam);
    renderer.toneMapping = prevTone;
  };

  P.set = function (k, v) { if (mComp.uniforms[k]) mComp.uniforms[k].value = v; };

  P.dispose = function () {
    P.scene.dispose();
    for (var i = 0; i < уровни.length; i++) { уровни[i].a.dispose(); уровни[i].b.dispose(); }
    уровни.length = 0;
    P.b1 = P.b2 = null;
    mBright.dispose(); mBlur.dispose(); mComp.dispose(); black.dispose();
  };
  /* Последний собранный композер: по нему автопроверки видят, дали
     ли цели отсчёты на самом деле, или пришлось уходить в FXAA */
  R.lastPost = P;
  return P;
};

})(window);
