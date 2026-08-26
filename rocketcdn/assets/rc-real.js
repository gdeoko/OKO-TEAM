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

/* ═══════════════ окружение для отражений ═════════════════ */

/* Панорама вокруг сцены: солнце сбоку, тёплое пятно Земли снизу,
   полоса Галактики, общий холод космоса. Металл отражает именно
   её, поэтому корпус перестаёт быть плоским. */
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

var envCache = {};
R.env = function (T, renderer, warm) {
  var key = warm ? "warm" : "cold";
  if (envCache[key]) return envCache[key];
  try {
    var tex = new T.CanvasTexture(envCanvas(warm));
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
  root.traverse(function (o) {
    if (!o.isMesh || !o.material) return;
    var apply = function (mm) {
      if (!mm || mm.isMeshStandardMaterial) return mm;
      /* Basic оставляем: это светящиеся элементы, им физика не нужна */
      if (mm.isMeshBasicMaterial) return mm;
      var hint = rules && rules(o, mm);
      if (hint === false) return mm;
      n++;
      return R.toStandard(T, mm, hint || {});
    };
    if (Array.isArray(o.material)) o.material = o.material.map(apply);
    else o.material = apply(o.material);
  });
  return n;
};

/* ═══════════════ плёнка ══════════════════════════════════ */

var VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

/* Яркие места отдельно: всё, что выше порога, уходит в размытие
   и возвращается ореолом. Так светятся лампы и голограммы. */
/* Потолок яркости у источника ореола. Без него одна раскалённая
   точка - солнечный серп на кромке Земли - уносила буфер свечения
   далеко за единицу, и на кадре вместо ореола висел МЯГКИЙ БЕЛЫЙ
   КВАДРАТ размером в полсотни пикселей. Приёмка приняла его сперва
   за сломанный спрайт, потом за отражение окружения; на деле буфер
   свечения вчетверо мельче кадра, и один его тексель, растянутый
   обратно, и есть тот квадрат. Ограничение сверху оставляет ореол
   ореолом: яркое остаётся ярким, но перестаёт заливать соседей. */
var BRIGHT = [
  "uniform sampler2D tD; uniform float thr; uniform float soft; varying vec2 vUv;",
  "void main(){ vec4 c = texture2D(tD, vUv);",
  "  float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));",
  "  float k = smoothstep(thr, thr + soft, l);",
  "  vec3 b = c.rgb * k;",
  "  float m = max(max(b.r, b.g), b.b);",
  "  if (m > 2.2) b *= 2.2 / m;",
  "  gl_FragColor = vec4(b, 1.0); }"
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
var COMP = [
  "uniform sampler2D tD; uniform sampler2D tB; uniform float bloom;",
  "uniform float expo; uniform float vig; uniform float grain; uniform float time; uniform float ab;",
  "uniform vec2 px;",
  "varying vec2 vUv;",
  "vec3 aces(vec3 x){ float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }",
  "vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)), vec3(0.41666))-0.055, step(0.0031308, c)); }",
  "float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }",
  "void main(){",
  "  vec2 d = vUv - 0.5; float r2 = dot(d,d);",
  "  vec2 off = normalize(d + 1e-6) * r2 * ab * px;",
  "  vec3 c;",
  "  c.r = texture2D(tD, vUv - off).r;",
  "  c.g = texture2D(tD, vUv).g;",
  "  c.b = texture2D(tD, vUv + off).b;",
  "  c += texture2D(tB, vUv).rgb * bloom;",
  "  c = aces(c * expo);",
  "  c = toSRGB(c);",
  "  float v = smoothstep(0.92, 0.10, r2 * vig);",
  "  c *= mix(1.0, v, 0.55);",
  "  float n = hash(vUv * 512.0 + time) - 0.5;",
  "  c += n * grain;",
  "  gl_FragColor = vec4(c, 1.0); }"
].join("\n");

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

  function rt(w, h) {
    return new T.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), {
      type: half, minFilter: T.LinearFilter, magFilter: T.LinearFilter,
      depthBuffer: true, stencilBuffer: false
    });
  }

  P.scene = rt(W, H);
  var bw = Math.max(2, W >> 2), bh = Math.max(2, H >> 2);
  P.b1 = lvl > 0 ? rt(bw, bh) : null;
  P.b2 = lvl > 0 ? rt(bw, bh) : null;

  var cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  var mBright = new T.ShaderMaterial({
    uniforms: { tD: { value: P.scene.texture }, thr: { value: o.threshold != null ? o.threshold : 0.72 }, soft: { value: 0.28 } },
    vertexShader: VERT, fragmentShader: BRIGHT, depthTest: false, depthWrite: false
  });
  var mBlur = new T.ShaderMaterial({
    uniforms: { tD: { value: null }, dir: { value: new T.Vector2() } },
    vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false
  });
  var black = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  black.needsUpdate = true;
  var mComp = new T.ShaderMaterial({
    uniforms: {
      tD: { value: P.scene.texture },
      tB: { value: lvl > 0 ? P.b1.texture : black },
      bloom: { value: lvl === 0 ? 0 : (lvl === 1 ? o.bloomLow || 0.42 : o.bloom || 0.70) },
      expo: { value: o.exposure != null ? o.exposure : 1.06 },
      vig: { value: o.vignette != null ? o.vignette : 1.30 },
      grain: { value: o.grain != null ? o.grain : 0.030 },
      /* Единица - смещение в один пиксель на самом краю кадра */
      ab: { value: lvl === 0 ? 0 : (o.aberration != null ? o.aberration : 3.2) },
      px: { value: new T.Vector2(1 / W, 1 / H) },
      time: { value: 0 }
    },
    vertexShader: VERT, fragmentShader: COMP, depthTest: false, depthWrite: false
  });

  var sBright = quad(T, mBright), sBlur = quad(T, mBlur), sComp = quad(T, mComp);

  P.setSize = function (w, h) {
    var p = renderer.getPixelRatio();
    W = Math.max(2, Math.round(w * p)); H = Math.max(2, Math.round(h * p));
    P.scene.setSize(W, H);
    mComp.uniforms.px.value.set(1 / W, 1 / H);
    if (P.b1) { bw = Math.max(2, W >> 2); bh = Math.max(2, H >> 2); P.b1.setSize(bw, bh); P.b2.setSize(bw, bh); }
  };

  /* Одна отрисовка кадра: сцена в буфер, ореол, сведение на экран */
  P.render = function (scene, camera, t) {
    if (!P.enabled) { renderer.setRenderTarget(null); renderer.render(scene, camera); return; }
    var prevTone = renderer.toneMapping;
    renderer.toneMapping = T.NoToneMapping;   /* кривую накладываем сами */
    renderer.setRenderTarget(P.scene);
    renderer.clear();
    renderer.render(scene, camera);

    if (P.b1) {
      renderer.setRenderTarget(P.b1);
      renderer.clear();
      renderer.render(sBright, cam);
      /* Два прохода размытия вместо одного. Пять отсчётов на проход
         дают не круглый ореол, а боксовое плато с прямыми краями -
         в мелком буфере оно и читается квадратом. Второй проход
         вдвое уже первого, и плато становится круглым пятном.
         Проходы идут по буферу вчетверо мельче кадра, стоят они
         почти ничего. */
      var ход = [[1.1, 0.5], [0.5, 0.28]];
      for (var пр = 0; пр < ход.length; пр++) {
        mBlur.uniforms.tD.value = P.b1.texture;
        mBlur.uniforms.dir.value.set(ход[пр][0] / bw, 0);
        renderer.setRenderTarget(P.b2); renderer.clear(); renderer.render(sBlur, cam);
        mBlur.uniforms.tD.value = P.b2.texture;
        mBlur.uniforms.dir.value.set(0, ход[пр][0] / bh);
        renderer.setRenderTarget(P.b1); renderer.clear(); renderer.render(sBlur, cam);
      }
    }

    mComp.uniforms.time.value = (t || 0) * 0.001;
    renderer.setRenderTarget(null);
    renderer.render(sComp, cam);
    renderer.toneMapping = prevTone;
  };

  P.set = function (k, v) { if (mComp.uniforms[k]) mComp.uniforms[k].value = v; };

  P.dispose = function () {
    P.scene.dispose(); if (P.b1) P.b1.dispose(); if (P.b2) P.b2.dispose();
    mBright.dispose(); mBlur.dispose(); mComp.dispose(); black.dispose();
  };
  return P;
};

})(window);
