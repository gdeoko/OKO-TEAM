/* ═══════════════════════════════════════════════════════════
   Rocket CDN · рама рубки

   Что здесь происходит и почему именно так.

   Три предыдущие рамы были нарисованы кодом: профили, фаски, болты,
   процедурный металл. Все три заказчик отверг одними словами - «не
   реалистично и некрасиво». И он прав: рубка, набранная из кубиков и
   градиентов, не бывает похожа на снятую камерой. Разница не в числе
   деталей, а в том, что настоящая поверхность несёт микрорельеф,
   затёртости, пыль по углам и свет, который считался целиком, а не по
   одному источнику на деталь.

   Поэтому лицо рамы теперь не рисуется, а снимается: кадр фотореальной
   рубки, сгенерированный по подробному описанию, с чистой чёрной дырой
   на месте окна. Инструменты в tools/ разбирают этот кадр на цвет,
   свечение, шероховатость, карту нормалей и карту глубины.

   Кадр берёт tools/cabflux.py через бесплатный ZeroGPU: кабинет ChatGPT,
   которым снимали прошлый заход, в тот же день закрылся - Cloudflare
   отбил адрес сервера, а через заграничные выходы страница открывается,
   но ответ модели не доходит. Разбор в INTEGRATIONS.md.

   Плоской картинкой это не остаётся. Карта глубины поднимает вершины
   сетки к пилоту, и рама получает настоящую геометрию: пульт выступает,
   ниши проваливаются, кромка окна режет свет. Свет мира за окном идёт
   по ней честно - планета проходит мимо, и блик едет по металлу.
   Клавиши стоят отдельными объёмными телами поверх своих же снимков и
   уходят вниз при нажатии. Это и есть единый объёмный мир: рама живёт
   в той же сцене, что и космос, а не висит наклейкой поверх него.

   Ключевое свойство, на котором всё держится: Proj.at ставит точку так,
   что она попадает в заданное место кадра НА ЛЮБОЙ глубине. Значит
   поднятие вершин меняет только настоящее положение в пространстве -
   нормали, тени, блики, параллакс при тряске, - и никогда не сдвигает
   рисунок по экрану. Доли кадра, отданные раме, остаются те же на любом
   устройстве, что и было обещано заказчику.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

/* ── Точка проектирования ─────────────────────────────────
   Глаз пилота, высота над настилом, расстояние до остекления.
   Числа общие с rc-cabin и rc-flight: все трое строят от них. */
var EYE = 1.62;
var R_WALL = 3.05;
var CAM_WIN = 0.86;

/* Проём в обшивке. Шире рамы с запасом: край обшивки обязан
   оставаться за железом на любом устройстве. */
var WIN_Y0 = 0.17;
var WIN_Y1 = 3.06;
var WIN_HALF = 0.43;

/* Куда обязана лечь кромка окна, в долях половины кадра.
   Договорённость с заказчиком - раме не больше десяти-пятнадцати
   процентов с каждой стороны. На мониторе: по бокам 12%, сверху 11%,
   снизу 15% (низ несёт приборную полку, поэтому он шире).

   У телефона своя раскладка. Экран 9:19.5 вдвое уже монитора, и
   двенадцать процентов с каждой стороны там съедают вчетверо больше
   полезной ширины, чем на мониторе. Поэтому стойки ужимаем до восьми
   процентов, а полку отдаём вниз - руке она всё равно нужна внизу, и
   пальцу нужен размер. Итог: бока 8%, верх 10%, низ 24%.

   Числа выбраны так, чтобы окно по пропорциям совпало с окном на
   снимке: чем ближе они, тем меньше растяжения (см. MAX_SKEW). */
var F_SIDE = 0.760;
var F_TOP = 0.780;
var F_BOTTOM = 0.700;
var F_SIDE_P = 0.840;
var F_TOP_P = 0.800;
var F_BOTTOM_P = 0.520;

/* Разброс глубины оболочки по оси взгляда, метры от глаза.
   Дальняя точка - задняя стенка ниши, ближняя - кромка пульта под
   руками. Полметра хода хватает, чтобы силуэт читался, и мало
   настолько, что рама не лезет в кадр при тряске. */
var D_BACK = 1.18;
var D_FRONT = 0.64;

/* Предел растяжения снимка: во сколько раз масштаб по горизонтали
   вправе разойтись с масштабом по вертикали. Восемнадцать процентов
   на металле не читаются, тридцать уже видно по болтам. */
var MAX_SKEW = 1.18;

/* Насколько сильно светится сам снимок.

   Свет кабины на кадре уже запечён, и материал отдаёт его через
   свечение - иначе рама уходит в чёрный силуэт. Но полная сила тоже
   неверна: свечение не знает ни теней, ни бликов, и рама становится
   молочной, теряя контраст, который на снимке есть. Половина с
   небольшим держит и то и другое: рисунок читается, тени остаются. */
var EMIS_BASE = 0.55;

var TEX = "assets/gen/cab/";

/* ══════════════════════════════════════════════════════════
   Проекция
   ══════════════════════════════════════════════════════════ */
function Proj(fovDeg, aspect) {
  this.tv = Math.tan(fovDeg * Math.PI / 360);
  this.th = this.tv * aspect;
  this.cz = -(R_WALL - CAM_WIN);
  this.aspect = aspect;
}
/* Точка, которая попадёт в (sx, sy) кадра на удалении d по оси взгляда */
Proj.prototype.at = function (T, sx, sy, d) {
  return new T.Vector3(sx * this.th * d, EYE + sy * this.tv * d, this.cz - d);
};
Proj.prototype.set = function (v, sx, sy, d) {
  v.set(sx * this.th * d, EYE + sy * this.tv * d, this.cz - d);
  return v;
};

/* ══════════════════════════════════════════════════════════
   Укладка снимка в кадр

   Снимок один, а экранов бесконечно много: от телефона 9:20 до монитора
   21:9. Кладём кадр так, чтобы кромка окна легла ровно на обещанные
   доли кадра, а не так, чтобы снимок покрыл экран целиком.

   Разница принципиальная. Покрытие держит пропорции снимка, но тогда
   на телефоне у широкого кадра срезает стойки, а на широком мониторе у
   вертикального срезает козырёк и полку - и договорённость о десяти
   пятнадцати процентах перестаёт выполняться там, где её обещали. Здесь
   наоборот: доли кадра выполняются везде, а платой идёт растяжение
   снимка. Растяжение зажато MAX_SKEW: дальше него круглый болт заметно
   становится овалом, и мы предпочитаем чуть более широкую раму.

   За краем снимка сетка продолжается до края экрана с прижатой
   развёрткой. Крайние пиксели кадра для этого затемнены до ровного
   чёрного в tools/cabgen.py - тогда растяжка кромки не видна.
   ══════════════════════════════════════════════════════════ */
function Fit(meta, W, H, tgt) {
  var box = meta["коробка"];
  this.W = W; this.H = H;
  this.tgt = tgt;
  this.cu = (box.l + box.r) / 2;
  this.cv = (box.t + box.b) / 2;
  var wu = box.r - box.l, hv = box.b - box.t;
  var gx = wu > 1e-4 ? (2 * tgt.side) / wu : 2;
  var gy = hv > 1e-4 ? (tgt.top + tgt.bottom) / hv : 1.5;
  /* Сколько пикселей экрана приходится на пиксель снимка по каждой
     оси. Если эти два числа разошлись, снимок растянут, и на металле
     это видно: круглый болт становится овалом. */
  var kx = gx * (W / 2) / meta.w;
  var ky = gy * (H / 2) / meta.h;
  var r = kx / ky, s;
  if (r > MAX_SKEW) { s = Math.sqrt(r / MAX_SKEW); gx /= s; gy *= s; }
  else if (r < 1 / MAX_SKEW) { s = Math.sqrt(1 / (r * MAX_SKEW)); gx *= s; gy /= s; }
  this.gx = gx;
  this.gy = gy;
  this.ty = (tgt.top - tgt.bottom) / 2;
  this.skew = r;
}
Fit.prototype.sx = function (u) { return (u - this.cu) * this.gx; };
Fit.prototype.sy = function (v) { return this.ty - (v - this.cv) * this.gy; };
Fit.prototype.u = function (sx) { return sx / this.gx + this.cu; };
Fit.prototype.v = function (sy) { return (this.ty - sy) / this.gy + this.cv; };

/* ══════════════════════════════════════════════════════════
   Карта глубины

   Приходит решёткой байтов в паспорте: единица - ближе всего к
   пилоту. Читаем билинейно, за краем берём кромку - там всё равно
   тёмный металл рамы, и он тянется до края экрана.
   ══════════════════════════════════════════════════════════ */
function Depth(d) {
  this.w = d.w; this.h = d.h;
  var bin = atob(d.d), n = bin.length, i;
  var a = new Uint8Array(n);
  for (i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
  this.a = a;
}
Depth.prototype.at = function (u, v) {
  var w = this.w, h = this.h, a = this.a;
  var x = (u < 0 ? 0 : u > 1 ? 1 : u) * (w - 1);
  var y = (v < 0 ? 0 : v > 1 ? 1 : v) * (h - 1);
  var x0 = x | 0, y0 = y | 0;
  var x1 = x0 + 1 < w ? x0 + 1 : x0;
  var y1 = y0 + 1 < h ? y0 + 1 : y0;
  var fx = x - x0, fy = y - y0;
  var p00 = a[y0 * w + x0], p10 = a[y0 * w + x1];
  var p01 = a[y1 * w + x0], p11 = a[y1 * w + x1];
  var top = p00 + (p10 - p00) * fx;
  var bot = p01 + (p11 - p01) * fx;
  return (top + (bot - top) * fy) / 255;
};

/* ══════════════════════════════════════════════════════════
   Многоугольник окна
   ══════════════════════════════════════════════════════════ */
function inPoly(poly, x, y) {
  var n = poly.length, hit = false, i, j;
  for (i = 0, j = n - 1; i < n; j = i++) {
    var xi = poly[i][0], yi = poly[i][1];
    var xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) &&
        x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/* Самый большой вписанный прямоугольник со сторонами по осям.

   Габарит проёма тут не годится: проём скруглён, и всплывающее окно
   по габариту заезжало бы на срезанные углы рамы. Перебираем пары
   горизонталей: для полосы между ними левая граница это самый правый
   левый край, правая - самый левый правый. */
function inscribed(poly) {
  var ys = [], i, k, e, p;
  for (i = 0; i < poly.length; i++) ys.push(poly[i][1]);
  ys.sort(function (a, b) { return a - b; });
  var best = null, bestA = -1;
  for (i = 0; i < ys.length; i++) {
    for (k = i + 1; k < ys.length; k++) {
      var b = ys[i], t = ys[k];
      if (t - b < 1e-3) continue;
      var l = -1e9, r = 1e9;
      for (e = 0, p = poly.length - 1; e < poly.length; p = e++) {
        var x1 = poly[p][0], y1 = poly[p][1];
        var x2 = poly[e][0], y2 = poly[e][1];
        if (Math.max(y1, y2) < b - 1e-9) continue;
        if (Math.min(y1, y2) > t + 1e-9) continue;
        var cy0 = Math.max(b, Math.min(y1, y2));
        var cy1 = Math.min(t, Math.max(y1, y2));
        var xa, xb;
        if (Math.abs(y2 - y1) < 1e-9) { xa = x1; xb = x2; }
        else {
          xa = x1 + (x2 - x1) * (cy0 - y1) / (y2 - y1);
          xb = x1 + (x2 - x1) * (cy1 - y1) / (y2 - y1);
        }
        var xmin = Math.min(xa, xb), xmax = Math.max(xa, xb);
        var mid = (x1 + x2) / 2;
        if (mid < 0) { if (xmax > l) l = xmax; }
        else { if (xmin < r) r = xmin; }
      }
      if (r - l < 1e-3) continue;
      var area = (r - l) * (t - b);
      if (area > bestA) { bestA = area; best = { l: l, r: r, b: b, t: t }; }
    }
  }
  return best || { l: -F_SIDE * 0.9, r: F_SIDE * 0.9, b: -F_BOTTOM * 0.9, t: F_TOP * 0.9 };
}

/* ══════════════════════════════════════════════════════════
   Клавиши
   ══════════════════════════════════════════════════════════ */
var CMD_RU = ["КУРС", "СКАН", "УЗЕЛ", "ЗАЛП", "АВТО", "СТОП", "ТЯГА"];
var CMD_EN = ["COURSE", "SCAN", "NODE", "FIRE", "AUTO", "STOP", "THRUST"];
var AUX_RU = ["СЕТЬ", "БЛИЖЕ", "ДАЛЬШЕ", "КАДР", "СПРАВКА"];
var AUX_EN = ["MAP", "ZOOM IN", "ZOOM OUT", "FRAME", "HELP"];

/* Раскладка атласа лиц: четыре столбца, четыре ряда, последний ряд
   ровный тёмный металл под бока крышек. */
var ATLAS_COLS = 4;
var ATLAS_ROWS = 4;

/* Ряд клавиш на приборной полке.

   Клавиши нарочно НЕ берутся со снимка. Пробовала: поиск подсвеченных
   пятен находит не клавиши, а экраны радара, и двенадцать команд
   садились кто куда, разного размера. На снимке пульт свой, у него
   своя раскладка, и подгонять её под наши двенадцать команд нечестно.

   Поэтому ряд свой, ровный, поверх полки: двенадцать одинаковых
   крышек с шагом, каждая со своим лицом из атласа. Атлас тоже снят, а
   не нарисован (tools/cabkeys.py), поэтому фактура у крышек ровно та
   же, что у рамы, и чужеродным ряд не выглядит.

   На телефоне ряд идёт в две строки по шесть: в одну строку крышка
   выходит в два с половиной сантиметра экрана - меньше подушечки
   пальца, и попасть в неё нельзя. */
function layout(inner, tgt, portrait) {
  var rows = portrait ? 2 : 1;
  var perRow = 12 / rows;
  /* Полоса под окном целиком */
  var bandTop = inner.b;
  var bandH = bandTop + 1;
  /* Ряд ставим в нижние две трети полосы: верхняя треть это кромка
     окна и её фаска, туда садиться нельзя. */
  var top = bandTop - bandH * 0.22;
  var bot = bandTop - bandH * 0.88;
  var rowH = (top - bot) / rows;
  var half = Math.min(inner.r, tgt.side) * 0.94;
  var stepX = (half * 2) / perRow;
  /* Крышка квадратная в пикселях экрана, поэтому по вертикали её
     доля кадра иная, чем по горизонтали. Здесь работаем в долях
     кадра, а квадрат доводится в мире по настоящему размеру. */
  var out = [];
  for (var r = 0; r < rows; r++) {
    for (var i = 0; i < perRow; i++) {
      out.push({
        sx: -half + stepX * (i + 0.5),
        sy: top - rowH * (r + 0.5),
        wx: stepX * 0.82,
        wy: rowH * 0.80
      });
    }
  }
  return out;
}

/* Коробка со скруглёнными углами, лицом к пилоту */
function capGeo(T, hw, hh, th, r) {
  r = Math.max(0.0005, Math.min(r, Math.min(hw, hh) * 0.45));
  var sh = new T.Shape();
  sh.moveTo(-hw + r, -hh);
  sh.lineTo(hw - r, -hh);
  sh.quadraticCurveTo(hw, -hh, hw, -hh + r);
  sh.lineTo(hw, hh - r);
  sh.quadraticCurveTo(hw, hh, hw - r, hh);
  sh.lineTo(-hw + r, hh);
  sh.quadraticCurveTo(-hw, hh, -hw, hh - r);
  sh.lineTo(-hw, -hh + r);
  sh.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  var geo = new T.ExtrudeGeometry(sh, {
    depth: th, bevelEnabled: true,
    bevelThickness: th * 0.14, bevelSize: th * 0.14,
    bevelSegments: 2, curveSegments: 5
  });
  geo.translate(0, 0, -th * 0.5);
  geo.computeBoundingBox();
  return geo;
}

/* Развёртка крышки по атласу: лицо на свою клетку, бока и низ на
   ровный тёмный ряд. Кусок лица на рёбра брать нельзя - рисунок
   поехал бы по фаске. */
function capUv(geo, cell) {
  var pos = geo.attributes.position;
  var uv = geo.attributes.uv;
  var bb = geo.boundingBox;
  var xw = (bb.max.x - bb.min.x) || 1;
  var yw = (bb.max.y - bb.min.y) || 1;
  var zmax = bb.max.z;
  var col = cell % ATLAS_COLS, row = (cell / ATLAS_COLS) | 0;
  var u0 = col / ATLAS_COLS, v0 = row / ATLAS_ROWS;
  var du = 1 / ATLAS_COLS, dv = 1 / ATLAS_ROWS;
  /* Поле по краю клетки: соседние клетки не должны просачиваться
     билинейной выборкой на фаску. */
  var pad = 0.04;
  var darkU = 0.5, darkV = 1 - (ATLAS_ROWS - 0.5) / ATLAS_ROWS;
  for (var i = 0; i < pos.count; i++) {
    if (pos.getZ(i) > zmax - 1e-5) {
      var fx = (pos.getX(i) - bb.min.x) / xw;
      var fy = (pos.getY(i) - bb.min.y) / yw;
      uv.setXY(i,
        u0 + du * (pad + fx * (1 - pad * 2)),
        1 - (v0 + dv * (pad + (1 - fy) * (1 - pad * 2))));
    } else {
      uv.setXY(i, darkU, darkV);
    }
  }
  uv.needsUpdate = true;
}

function keycaps(T, api, proj, fit, dep, inner, tgt, parent, ru, tiny, aniso) {
  var loader = new T.TextureLoader();
  var atlas = loader.load(TEX + "keys-atlas.webp");
  atlas.wrapS = atlas.wrapT = T.ClampToEdgeWrapping;
  atlas.anisotropy = aniso;
  if (T.SRGBColorSpace) atlas.colorSpace = T.SRGBColorSpace;
  api.atlas = atlas;

  var list = layout(inner, tgt, api.portrait);
  var caps = [];
  var main = ru ? CMD_RU : CMD_EN;
  var aux = ru ? AUX_RU : AUX_EN;
  for (var i = 0; i < list.length; i++) {
    var q = list[i];
    var d01 = dep.at(fit.u(q.sx), fit.v(q.sy));
    var dist = D_BACK - d01 * (D_BACK - D_FRONT);
    var hw = q.wx / 2 * proj.th * dist;
    var hh = q.wy / 2 * proj.tv * dist;
    if (!(hw > 1e-5) || !(hh > 1e-5)) continue;
    /* Крышка квадратная: берём меньшую сторону, чтобы ряд не
       превращался в ленту растянутых прямоугольников. */
    var side = Math.min(hw, hh);
    hw = hh = side;
    var th = side * 0.62;
    var geo = capGeo(T, hw, hh, th, side * 0.24);
    capUv(geo, i);
    /* Своя копия материала на каждую клавишу: rc-flight тянет
       свечение нажатой отдельно от остальных, а на общем материале
       вспыхивал бы весь пульт разом. Карты у копий те же самые,
       памяти это не стоит. */
    var cm = new T.MeshStandardMaterial({
      map: atlas,
      emissiveMap: atlas,
      emissive: new T.Color(0xffffff),
      emissiveIntensity: EMIS_BASE * 0.7,
      metalness: 0.30,
      roughness: 0.62
    });
    var m = new T.Mesh(geo, cm);
    proj.set(m.position, q.sx, q.sy, dist - th * 0.5);
    m.frustumCulled = false;
    m.renderOrder = 7;
    m.userData.halfW = hw;
    m.userData.halfH = hh;
    m.userData["имя"] = i < 7 ? main[i] : (aux[i - 7] || "");
    m.userData.z0 = m.position.z;
    m.userData["ход"] = th * 0.55;
    m.userData["нажата"] = 0;
    /* Числа для свечения нажатой: их читает rc-flight */
    m.userData.baseEmissive = EMIS_BASE * 0.7;
    m.userData.ph = i * 0.7;
    m.userData.homeY = m.position.y;
    parent.add(m);
    caps.push(m);
  }
  api.addUpdate(function (t, dt) {
    for (var k = 0; k < caps.length; k++) {
      var c = caps[k];
      var goal = c.userData.z0 - (c.userData["нажата"] ? c.userData["ход"] : 0);
      c.position.z += (goal - c.position.z) * Math.min(1, dt * 18);
    }
  });
  return caps;
}

/* ══════════════════════════════════════════════════════════
   Сборка
   ══════════════════════════════════════════════════════════ */
var RC = { last: null };

function build(T, o) {
  o = o || {};
  var W = o.width || innerWidth || 1280;
  var H = o.height || innerHeight || 720;
  var tiny = !!o.tiny;
  var ru = o.ru !== false;
  var portrait = H > W;
  var proj = new Proj(o.fov || 72, W / H);

  var api = {};
  var upd = [];
  api.addUpdate = function (fn) { upd.push(fn); };
  api.update = function (ts, dt, tele) {
    var t = (ts || 0) / 1000;
    for (var q = 0; q < upd.length; q++) upd[q](t, dt || 0.016, tele || {});
  };

  var grp = new T.Group();
  /* Наклон рамы под взгляд камеры. В финале камера смотрит с
     наклоном, а рама строится горизонтально: без поворота вокруг
     глаза она уезжала вверх или вниз на треть кадра. */
  var pivot = new T.Group();
  pivot.position.set(0, EYE, 0);
  var inner3 = new T.Group();
  inner3.position.set(0, -EYE, 0);
  pivot.add(inner3);
  grp.add(pivot);
  api.group = grp;
  api.inner3 = inner3;
  api.pivot = pivot;
  api.proj = proj;
  api.setPitch = function (p) { pivot.rotation.x = p || 0; };
  api.ru = ru;
  api.tiny = tiny;
  api.W = W; api.H = H;
  api.portrait = portrait;

  var M = g.RC_CAB_META;
  var meta = M ? (portrait ? M["высокая"] : M["широкая"]) : null;
  if (!meta) return fallback(T, api, inner3, proj, portrait);

  var tgt = portrait
    ? { side: F_SIDE_P, top: F_TOP_P, bottom: F_BOTTOM_P }
    : { side: F_SIDE, top: F_TOP, bottom: F_BOTTOM };
  var fit = new Fit(meta, W, H, tgt);
  var dep = new Depth(meta["глубина"]);
  api.fit = fit;
  api.meta = meta;
  api.depth = dep;

  var poly = [], i;
  for (i = 0; i < meta["контур"].length; i++) {
    var c = meta["контур"][i];
    poly.push([fit.sx(c[0]), fit.sy(c[1])]);
  }
  api.poly = poly;

  var inner = {
    l: fit.sx(meta["коробка"].l), r: fit.sx(meta["коробка"].r),
    t: fit.sy(meta["коробка"].t), b: fit.sy(meta["коробка"].b)
  };
  api.inner = inner;

  /* ── Фактуры ────────────────────────────────────────────
     Четыре карты с одного кадра. Цвет несёт запечённый свет
     кабины, свечение держит лампы и экраны, шероховатость решает,
     где блику быть, нормали дают микрорельеф. */
  var name = meta["имя"];
  var loader = new T.TextureLoader();
  var aniso = 8;
  try {
    var rr = g.RC_REAL && g.RC_REAL.renderer;
    if (rr && rr.capabilities) aniso = Math.min(8, rr.capabilities.getMaxAnisotropy() || 8);
  } catch (eA) {}
  function tex(suffix, srgb) {
    var t = loader.load(TEX + name + suffix);
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    t.anisotropy = aniso;
    if (srgb && T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  var mapAlbedo = tex("-albedo.webp", true);
  var mapEmis = tex("-emis.webp", true);
  var mapRough = tex("-rough.webp", false);
  var mapNormal = tex("-normal.webp", false);
  api.maps = { albedo: mapAlbedo, emis: mapEmis, rough: mapRough, normal: mapNormal };

  var mat = new T.MeshStandardMaterial({
    map: mapAlbedo,
    normalMap: mapNormal,
    roughnessMap: mapRough,
    emissiveMap: mapEmis,
    emissive: new T.Color(0xffffff),
    emissiveIntensity: EMIS_BASE,
    /* Металличность держим средней. Чистый металл без окружения
       уходит в чёрное - на этом уже обожглись, рама пропадала в
       тень целиком. Свет с кадра уже запечён, материалу остаётся
       добавить отклик сцены. */
    metalness: 0.38,
    roughness: 1.0,
    alphaTest: 0.5,
    side: T.FrontSide
  });
  mat.normalScale = new T.Vector2(1.2, 1.2);
  try {
    if (g.RC_REAL && g.RC_REAL.env) { mat.envMap = g.RC_REAL.env; mat.envMapIntensity = 0.55; }
  } catch (eE) {}
  api.mat = mat;

  /* ── Оболочка ───────────────────────────────────────────
     Сетка на весь кадр с запасом за край. Ячейки, целиком
     попавшие в окно, не выпускаем вовсе; краевые оставляем и
     режем прозрачностью снимка - так кромка окна идёт ровно по
     контуру, а не по клеткам сетки. */
  var NX = tiny ? 132 : 236;
  var NY = tiny ? 132 : 236;
  /* Насколько сетка выходит за край кадра.
     Было 1.07, и на широком мониторе по бокам оставались синеватые
     полосы: снимок туда не достаёт, а за ним видно обшивку рубки.
     Двадцать процентов запаса закрывают её при любой пропорции, а
     стоят десяток лишних треугольников с чёрной кромкой. */
  var S = 1.20;
  var pos = [], uvs = [], idx = [];
  var flag = new Uint8Array((NX + 1) * (NY + 1));
  var v3 = new T.Vector3();
  var ii, jj;
  for (jj = 0; jj <= NY; jj++) {
    var sy = -S + 2 * S * jj / NY;
    for (ii = 0; ii <= NX; ii++) {
      var sx = -S + 2 * S * ii / NX;
      var u = fit.u(sx), v = fit.v(sy);
      var dist = D_BACK - dep.at(u, v) * (D_BACK - D_FRONT);
      proj.set(v3, sx, sy, dist);
      pos.push(v3.x, v3.y, v3.z);
      var cu = u < 0 ? 0 : u > 1 ? 1 : u;
      var cv = v < 0 ? 0 : v > 1 ? 1 : v;
      uvs.push(cu, 1 - cv);
      flag[jj * (NX + 1) + ii] = inPoly(poly, sx, sy) ? 1 : 0;
    }
  }
  for (jj = 0; jj < NY; jj++) {
    for (ii = 0; ii < NX; ii++) {
      var a0 = jj * (NX + 1) + ii;
      var b0 = a0 + 1;
      var c0 = a0 + (NX + 1);
      var d0 = c0 + 1;
      if (flag[a0] && flag[b0] && flag[c0] && flag[d0]) continue;
      /* Обход против часовой стрелки со стороны пилота.
         При обратном порядке лицевая сторона смотрит от него, и
         оболочка отбраковывается целиком: в кадре остаются одни
         клавиши, висящие в пустоте. Один раз уже случилось. */
      idx.push(a0, b0, c0, b0, d0, c0);
    }
  }
  var geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  var shell = new T.Mesh(geo, mat);
  shell.renderOrder = 6;
  shell.frustumCulled = false;
  inner3.add(shell);
  api.shell = shell;
  api.tris = idx.length / 3;

  /* ── Настил под пилотом ─────────────────────────────────
     Точка привязки для других модулей: к ней вешается камера в
     полёте. Геометрии нет, только положение. */
  var deck = new T.Group();
  deck.position.set(0, 0, proj.cz - D_FRONT * 0.9);
  inner3.add(deck);
  api.deck = deck;

  api.caps = keycaps(T, api, proj, fit, dep, inner, tgt, inner3, ru, tiny, aniso);

  /* ── Собственный свет кабины ────────────────────────────
     Три мягкие лампы: тёплая снизу от пульта, холодная сверху
     из-под козырька и лайм от приборов. Они не рисуют картинку
     заново, а дают объёму отклик, которого у плоского снимка не
     бывает: при тряске блик едет по металлу. */
  var warm = new T.PointLight(0xffb47a, tiny ? 0.26 : 0.38, 3.2, 2);
  warm.position.set(0, EYE - 0.62, proj.cz - D_FRONT - 0.05);
  inner3.add(warm);
  var cool = new T.PointLight(0xbfe6ff, tiny ? 0.16 : 0.26, 3.0, 2);
  cool.position.set(0, EYE + 0.58, proj.cz - D_FRONT - 0.05);
  inner3.add(cool);
  var lime = new T.PointLight(0x9aff00, tiny ? 0.12 : 0.20, 2.2, 2);
  lime.position.set(0, EYE - 0.46, proj.cz - D_FRONT + 0.04);
  inner3.add(lime);
  api.lights = [warm, cool, lime];

  /* Дыхание приборов: свечение чуть гуляет, как у живой подсветки,
     и подрастает вместе со скоростью. */
  api.addUpdate(function (t, dt, tele) {
    var sp = Math.max(0, Math.min(1, tele.speed || 0));
    var puls = 0.94 + 0.05 * Math.sin(t * 1.7) + 0.03 * Math.sin(t * 4.3);
    mat.emissiveIntensity = EMIS_BASE * puls * (1 + sp * 0.22);
    lime.intensity = (tiny ? 0.12 : 0.20) * (0.85 + sp * 0.6) * puls;
  });

  /* ── Замеры и границы ───────────────────────────────────
     Четыре точки на кромках окна: по ним rc-flight меряет живой
     камерой, сколько кадра съедает рама. */
  var dWin = D_BACK - dep.at(fit.u(0), fit.v(inner.b)) * (D_BACK - D_FRONT);
  api.probe = [
    proj.at(T, inner.l, 0, dWin),
    proj.at(T, inner.r, 0, dWin),
    proj.at(T, 0, inner.t, dWin),
    proj.at(T, 0, inner.b, dWin)
  ];

  var raw = inscribed(poly);
  var pad = 0.012;
  var safe = { l: raw.l + pad, r: raw.r - pad, b: raw.b + pad, t: raw.t - pad };
  api.safe = safe;

  api.clipPath = function (ins) {
    var p = ins || 0, out = [], q;
    for (q = 0; q < poly.length; q++) {
      var x = (1 + poly[q][0] * (1 - p)) / 2 * 100;
      var y = (1 - poly[q][1] * (1 - p)) / 2 * 100;
      out.push(x.toFixed(2) + "% " + y.toFixed(2) + "%");
    }
    return "polygon(" + out.join(",") + ")";
  };
  api.windowRect = function () {
    return { x: (safe.l + 1) / 2, y: (1 - safe.t) / 2,
             w: (safe.r - safe.l) / 2, h: (safe.t - safe.b) / 2 };
  };
  api.frameShare = function () {
    return {
      слева: (1 + inner.l) / 2,
      справа: (1 - inner.r) / 2,
      сверху: (1 - inner.t) / 2,
      снизу: (1 + inner.b) / 2
    };
  };

  RC.last = { inner: inner, safe: safe, clip: api.clipPath(), poly: poly };
  /* Собранная рама целиком - для приёмки. Числа из неё меряет
     tools/audit_cab.mjs: сколько клавиш, сколько треугольников,
     насколько растянут снимок. На глаз это не оценивается. */
  g.RC_PANEL_LAST_API = api;
  return api;
}

/* ══════════════════════════════════════════════════════════
   Запасной каркас: паспорт кабины не пришёл
   ══════════════════════════════════════════════════════════ */
function fallback(T, api, inner3, proj, portrait) {
  var s0 = portrait ? F_SIDE_P : F_SIDE;
  var t0 = portrait ? F_TOP_P : F_TOP;
  var b0 = portrait ? F_BOTTOM_P : F_BOTTOM;
  var inner = { l: -s0, r: s0, t: t0, b: -b0 };
  var poly = [[s0, -b0], [s0, t0], [-s0, t0], [-s0, -b0]];
  api.inner = inner;
  api.poly = poly;
  api.caps = [];
  api.deck = new T.Group();
  inner3.add(api.deck);
  api.probe = [
    proj.at(T, inner.l, 0, CAM_WIN),
    proj.at(T, inner.r, 0, CAM_WIN),
    proj.at(T, 0, inner.t, CAM_WIN),
    proj.at(T, 0, inner.b, CAM_WIN)
  ];
  var pad = 0.012;
  var safe = { l: inner.l + pad, r: inner.r - pad, b: inner.b + pad, t: inner.t - pad };
  api.safe = safe;
  api.clipPath = function () { return "none"; };
  api.windowRect = function () {
    return { x: (safe.l + 1) / 2, y: (1 - safe.t) / 2,
             w: (safe.r - safe.l) / 2, h: (safe.t - safe.b) / 2 };
  };
  api.frameShare = function () {
    return { слева: (1 + inner.l) / 2, справа: (1 - inner.r) / 2,
             сверху: (1 - inner.t) / 2, снизу: (1 + inner.b) / 2 };
  };
  RC.last = { inner: inner, safe: safe, clip: "none", poly: poly };
  return api;
}

g.RC_PANEL = {
  build: build,
  CAM_WIN: CAM_WIN,
  EYE: EYE,
  R_WALL: R_WALL,
  WIN_HALF: WIN_HALF,
  WIN_Y0: WIN_Y0,
  WIN_Y1: WIN_Y1,
  F_SIDE: F_SIDE,
  F_TOP: F_TOP,
  F_BOTTOM: F_BOTTOM,
  get last() { return RC.last; }
};
})(window);
