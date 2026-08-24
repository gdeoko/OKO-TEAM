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
   процентов. Итог: бока 8%, верх 10%, низ 15%.

   Низ был 24 процента: полка несла два ряда клавиш, и им нужен был
   размер под палец. Заказчик потребовал не больше пятнадцати нигде,
   поэтому ряд теперь один, а клавиши стали шире и ниже - палец в них
   попадает не хуже, а четверть экрана вернулась космосу.

   Числа выбраны так, чтобы окно по пропорциям совпало с окном на
   снимке: чем ближе они, тем меньше растяжения (см. MAX_SKEW). */
var F_SIDE = 0.780;
var F_TOP = 0.800;
var F_BOTTOM = 0.720;
var F_SIDE_P = 0.840;
var F_TOP_P = 0.800;
var F_BOTTOM_P = 0.700;

/* Разброс глубины оболочки по оси взгляда, метры от глаза.
   Дальняя точка - задняя стенка ниши, ближняя - кромка пульта под
   руками.

   Было полметра, и рама выходила раздутой: заказчик попросил тоньше,
   «не сильно объёмную». Двадцать сантиметров хватает, чтобы силуэт
   читался и блик ехал по кромке, но рама остаётся плоской панелью
   современного корабля, а не толстым бортом старого. */
var D_BACK = 1.02;
var D_FRONT = 0.80;

/* Предел растяжения снимка: во сколько раз масштаб по горизонтали
   вправе разойтись с масштабом по вертикали.

   Треть - это много, на металле такое растяжение уже видно. Но выбор
   тут между растянутым кадром и нарушенной договорённостью: на
   мониторе 21:9 при меньшем пределе рама раздувалась до шестнадцати
   процентов по бокам вместо обещанных пятнадцати. Договорённость
   важнее. На обычных пропорциях предел всё равно не срабатывает. */
var MAX_SKEW = 1.32;

/* Насколько сильно светится сам снимок.

   Свет кабины на кадре уже запечён, и материал отдаёт его через
   свечение - иначе рама уходит в чёрный силуэт. Но полная сила тоже
   неверна: свечение не знает ни теней, ни бликов, и рама становится
   молочной, теряя контраст, который на снимке есть. Меньше половины
   держит и то и другое: рисунок читается, тени остаются, и рама не
   выглядит освещённой днём комнатой на фоне чёрного космоса. */
var EMIS_BASE = 0.46;

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

/* Где луч из точки внутрь-наружу пересекает контур.

   Нужно, чтобы посадить вершины краевых ячеек ровно на кромку окна.
   Без этого край шёл ступенями с шагом сетки: ячейка либо целиком
   есть, либо целиком нет, и прозрачность снимка тут не помогает -
   резать нечего, крайние ячейки просто не выпускаются. */
function rayHit(poly, cx, cy, dx, dy) {
  var n = poly.length, best = -1, i, j;
  for (i = 0, j = n - 1; i < n; j = i++) {
    var x1 = poly[j][0], y1 = poly[j][1];
    var x2 = poly[i][0], y2 = poly[i][1];
    var ex = x2 - x1, ey = y2 - y1;
    var den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    var t = ((x1 - cx) * ey - (y1 - cy) * ex) / den;
    var u = ((x1 - cx) * dy - (y1 - cy) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1 && (best < 0 || t < best)) best = t;
  }
  return best;
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
  /* На мониторе двенадцать клавиш идут одним рядом, на телефоне
     двумя по шесть.

     Одним рядом на телефоне пробовала: триста девяносто точек на
     двенадцать клавиш это тридцать две точки на клавишу, подпись
     под иконкой перестаёт читаться совсем. Двумя рядами клавиша
     выходит вдвое шире, а полоса под пульт остаётся та же
     пятнадцатипроцентная - в неё два ряда помещаются, если не
     оставлять пустых полей. */
  var rows = portrait ? 2 : 1;
  var perRow = 12 / rows;
  /* Полоса под окном целиком */
  var bandTop = inner.b;
  var bandH = bandTop + 1;
  /* Ряд ставим в нижние две трети полосы: верхняя треть это кромка
     окна и её фаска, туда садиться нельзя. */
  /* На ПК ряд сидит в нижней половине полки: в верхней стоят
     запечённые экраны пульта, и ряд поверх них выглядел кашей. */
  var top = bandTop - bandH * (rows > 1 ? 0.04 : 0.30);
  var bot = bandTop - bandH * (rows > 1 ? 0.92 : 0.88);
  var rowH = (top - bot) / rows;
  var half = Math.min(inner.r, tgt.side) * (rows > 1 ? 0.99 : 0.94);
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
        wx: stepX * (rows > 1 ? 0.93 : 0.86),
        wy: rowH * (rows > 1 ? 0.84 : 0.74)
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
  var list = layout(inner, tgt, api.portrait);

  /* Лица клавиш рисует rc-keys прямо под размер, который клавиша
     займёт на этом экране, и под плотность этого экрана.

     Снятый атлас отсюда убран. Генератор рисует стеклянную плитку
     хуже, чем формула: иконки выходили разного размера, сетка
     неровная, нарезка шла по замеренным на глаз местам, и половина
     лиц обрезалась. Заказчик написал «кнопки кривые обрезанные», и
     это было ровно про это. Здесь обрезаться нечему. */
  var cellPx = 96;
  if (list.length) {
    var q0 = list[0];
    cellPx = Math.max(48, Math.round(Math.min(q0.wx * api.W / 2, q0.wy * api.H / 2)));
  }
  var drawn = g.RC_KEYS ? g.RC_KEYS.atlas(cellPx, ru) : null;
  if (!drawn) return [];
  var atlas = new T.CanvasTexture(drawn.canvas);
  atlas.wrapS = atlas.wrapT = T.ClampToEdgeWrapping;
  atlas.anisotropy = aniso;
  atlas.minFilter = T.LinearMipmapLinearFilter;
  atlas.generateMipmaps = true;
  if (T.SRGBColorSpace) atlas.colorSpace = T.SRGBColorSpace;
  api.atlas = atlas;
  api.atlasCell = drawn.cell;
  var caps = [];
  for (var i = 0; i < list.length; i++) {
    var q = list[i];
    var d01 = dep.at(fit.u(q.sx), fit.v(q.sy));
    var dist = D_BACK - d01 * (D_BACK - D_FRONT);
    var hw = q.wx / 2 * proj.th * dist;
    var hh = q.wy / 2 * proj.tv * dist;
    if (!(hw > 1e-5) || !(hh > 1e-5)) continue;
    /* Крышка не квадрат, а вписанный прямоугольник со своими
       пропорциями клетки, но не уже трёх четвертей высоты: на
       телефоне двенадцать квадратов в ряд превратились бы в
       полоску по три миллиметра. */
    hw = Math.min(hw, hh * 1.45);
    hh = Math.min(hh, hw * 1.35);
    var side = Math.min(hw, hh);
    var th = side * 0.30;
    var geo = capGeo(T, hw, hh, th, side * 0.24);
    capUv(geo, i);
    /* Своя копия материала на каждую клавишу: rc-flight тянет
       свечение нажатой отдельно от остальных, а на общем материале
       вспыхивал бы весь пульт разом. Карты у копий те же самые,
       памяти это не стоит. */
    /* Стеклянная плитка: почти не металл, гладкая, светится сама.
       Свечение держим высоким - лицо уже нарисовано со своим светом,
       и гасить его сценой значит потерять иконку в темноте.
       Крышка низкая (треть стороны): она сидит в лотке пульта,
       который генерится нарочно пустым, и выглядит его частью,
       а не наклейкой поверх. */
    var cm = new T.MeshStandardMaterial({
      map: atlas,
      emissiveMap: atlas,
      emissive: new T.Color(0xffffff),
      emissiveIntensity: 0.82,
      metalness: 0.10,
      roughness: 0.34
    });
    var m = new T.Mesh(geo, cm);
    proj.set(m.position, q.sx, q.sy, dist - th * 0.5);
    m.frustumCulled = false;
    m.renderOrder = 7;
    m.userData.halfW = hw;
    m.userData.halfH = hh;
    m.userData["имя"] = g.RC_KEYS.name(i, ru);
    m.userData.z0 = m.position.z;
    m.userData["ход"] = th * 0.55;
    m.userData["нажата"] = 0;
    /* Числа для свечения нажатой: их читает rc-flight */
    m.userData.baseEmissive = 0.82;
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

/* ══════════════════════════════════════════════════════════
   Плоская рама

   Рама рубки снова плоская: тем же кадром, что стоял 17-19 августа.

   Почему отказались от объёмной сетки, хотя её и просили сделать
   «единым 3D миром». Причина не идейная, а измеримая. Сетка
   пересэмплирует снимок дважды - при выборке по развёртке и при
   мипмаппинге, - и на экране он мылится; край окна режется по
   клеткам сетки и идёт зубцами; материал накладывает свой свет
   поверх запечённого и даёт пересветы. Всё это заказчик и назвал
   «качество говно, форма уродская». Плоский слой браузер
   масштабирует один раз своим фильтром: кадр остаётся резким,
   кромка ровной, пересветов нет вовсе.

   Физически рама и не должна быть объёмной: она приклеена к глазу
   пилота и никогда не движется относительно него. Объём нужен миру
   за окном, и он там есть.

   Сам кадр показывает rc-cockpit слоем разметки. Здесь остаётся
   геометрия: где на экране окно, какой у него контур, куда можно
   класть всплывающие окна. Её спрашивают rc-desk, rc-flight и
   отсечение голограмм, поэтому источник обязан быть один.
   ══════════════════════════════════════════════════════════ */
function flatBuild(T, o, api, inner3, portrait, W, H, proj) {
  var M = g.RC_CAB_FLAT;
  var meta = M ? (portrait ? M["высокая"] : M["широкая"]) : null;
  if (!meta) return null;

  /* Раскладку кадра считает слой приборов и он же ставит её картинке.
     Считать её здесь второй раз нельзя: на широком мониторе кадр
     привязан к низу, чтобы пульт не ушёл за кромку, и вторая копия
     арифметики молча разошлась бы с первой - окно у геометрии одно, на
     экране другое. Запасные числа нужны на случай, если слой не
     поднялся: без него лучше центр, чем ничего. */
  var п = (g.RC_DECK && g.RC_DECK["покрытие"])
    ? g.RC_DECK["покрытие"](meta, W, H) : null;
  var c = п ? п.k : Math.max(W / meta.w, H / meta.h);
  var dw = п ? п.dw : meta.w * c, dh = п ? п.dh : meta.h * c;
  var ox = п ? п.ox : (W - dw) / 2, oy = п ? п.oy : (H - dh) / 2;
  function sx(u) { return (ox + u * dw) / W * 2 - 1; }
  function sy(v) { return 1 - (oy + v * dh) / H * 2; }

  var poly = [], i;
  for (i = 0; i < meta["контур"].length; i++) {
    var q = meta["контур"][i];
    poly.push([sx(q[0]), sy(q[1])]);
  }
  var box = meta["коробка"];
  var inner = { l: sx(box.l), r: sx(box.r), t: sy(box.t), b: sy(box.b) };

  api.meta = meta;
  api.poly = poly;
  api.inner = inner;
  api.flat = true;
  api.caps = [];
  api.shell = null;
  api.tris = 0;
  api.fit = { skew: 1 };

  var deck = new T.Group();
  deck.position.set(0, 0, proj.cz - CAM_WIN * 0.9);
  inner3.add(deck);
  api.deck = deck;

  api.probe = [
    proj.at(T, inner.l, 0, CAM_WIN),
    proj.at(T, inner.r, 0, CAM_WIN),
    proj.at(T, 0, inner.t, CAM_WIN),
    proj.at(T, 0, inner.b, CAM_WIN)
  ];

  var raw = inscribed(poly);
  var pad = 0.012;
  var safe = { l: raw.l + pad, r: raw.r - pad, b: raw.b + pad, t: raw.t - pad };
  api.safe = safe;

  api.clipPath = function (ins) {
    var p = ins || 0, out = [], k;
    for (k = 0; k < poly.length; k++) {
      var x = (1 + poly[k][0] * (1 - p)) / 2 * 100;
      var y = (1 - poly[k][1] * (1 - p)) / 2 * 100;
      out.push(x.toFixed(2) + "% " + y.toFixed(2) + "%");
    }
    return "polygon(" + out.join(",") + ")";
  };
  api.windowRect = function () {
    return { x: (safe.l + 1) / 2, y: (1 - safe.t) / 2,
             w: (safe.r - safe.l) / 2, h: (safe.t - safe.b) / 2 };
  };
  api.frameShare = function () {
    return { слева: (1 + inner.l) / 2, справа: (1 - inner.r) / 2,
             сверху: (1 - inner.t) / 2, снизу: (1 + inner.b) / 2 };
  };
  RC.last = { inner: inner, safe: safe, clip: api.clipPath(), poly: poly, плоская: true };
  g.RC_PANEL_LAST_API = api;
  return api;
}

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

  /* Плоская рама - основной путь. Объёмная сетка ниже осталась
     запасной: если паспорта плоской рамы нет, сцена соберёт старую. */
  var flat = flatBuild(T, o, api, inner3, portrait, W, H, proj);
  if (flat) return flat;

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
    /* Кромку окна режем прозрачностью, но НЕ порогом.

       Порог (alphaTest) сравнивает альфу с половиной и отбрасывает
       пиксель целиком. На скруглении окна это давало видимую
       лесенку: заказчик её и увидел. Обычная прозрачность режет
       плавно, край выходит ровным, а глубина всё равно пишется -
       значит космос за окном не просвечивает сквозь раму. */
    transparent: true,
    alphaTest: 0.02,
    depthWrite: true,
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
  var v3 = new T.Vector3();
  var ii, jj;
  for (jj = 0; jj <= NY; jj++) {
    var sy0 = -S + 2 * S * jj / NY;
    for (ii = 0; ii <= NX; ii++) {
      var sx = -S + 2 * S * ii / NX;
      var sy = sy0;
      var u = fit.u(sx), v = fit.v(sy);
      var dist = D_BACK - dep.at(u, v) * (D_BACK - D_FRONT);
      proj.set(v3, sx, sy, dist);
      pos.push(v3.x, v3.y, v3.z);
      var cu = u < 0 ? 0 : u > 1 ? 1 : u;
      var cv = v < 0 ? 0 : v > 1 ? 1 : v;
      uvs.push(cu, 1 - cv);
    }
  }
  for (jj = 0; jj < NY; jj++) {
    for (ii = 0; ii < NX; ii++) {
      var a0 = jj * (NX + 1) + ii;
      var b0 = a0 + 1;
      var c0 = a0 + (NX + 1);
      var d0 = c0 + 1;
      /* Ячейки внутри окна НЕ выбрасываем.

         Пробовала двумя способами - выбрасывать по контуру и сажать
         вершины краевых ячеек на кромку. Оба дают видимый зубчатый
         край: в первом случае лесенкой с шагом сетки, во втором
         пилой между внешними вершинами и контурными. Заказчик увидел
         именно это.

         Правильно так: сетка идёт сплошной, а окно вырезает
         прозрачность снимка - она в текстуре плавная, переход шесть
         пикселей, и край получается ровным на любом увеличении.
         Плата - примерно четверть лишних треугольников, полностью
         прозрачных: их фрагменты отбрасываются порогом до записи
         глубины, поэтому космос за окном виден как надо. */
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

  /* ── Живые приборы ──────────────────────────────────────
     Радар, карта узлов и телеметрия ложатся ровно в рамки экранов,
     найденных на снимке (tools/cabgen.py). Запечённая картинка
     остаётся подложкой, живой холст чуть впереди - прибор начинает
     работать: развёртка идёт, узлы дышат, кривая ползёт. Заказчик
     просил «радары навигаторы», и это они. */
  instruments(T, api, proj, fit, dep, meta, inner3, tiny, aniso);

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
  /* Была лампа лаймом 0x9aff00 - цвет OKO, не Rocket CDN. Она и
     красила ближние клавиши в зелень, которую увидел заказчик. */
  var lime = new T.PointLight(0x42b2dc, tiny ? 0.12 : 0.20, 2.2, 2);
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
   Живые приборы пульта
   ══════════════════════════════════════════════════════════ */
var CYAN_CSS = "rgba(66,178,220,";
var PALE_CSS = "rgba(207,233,245,";

function drawRadar(c, w, h, t) {
  c.clearRect(0, 0, w, h);
  var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44;
  c.strokeStyle = CYAN_CSS + "0.5)";
  c.lineWidth = Math.max(1, R * 0.02);
  for (var i = 1; i <= 3; i++) {
    c.beginPath();
    c.arc(cx, cy, R * i / 3, 0, Math.PI * 2);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(cx - R, cy); c.lineTo(cx + R, cy);
  c.moveTo(cx, cy - R); c.lineTo(cx, cy + R);
  c.stroke();
  /* Развёртка с затухающим следом */
  var a = t * 1.4;
  var grd = c.createConicGradient ? null : null;
  for (var k = 0; k < 20; k++) {
    var aa = a - k * 0.045;
    c.strokeStyle = CYAN_CSS + (0.55 * (1 - k / 20)).toFixed(3) + ")";
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R);
    c.stroke();
  }
  /* Отметки целей: стоят на месте, вспыхивают под лучом */
  var marks = [[0.55, 0.7], [2.3, 0.4], [4.1, 0.85], [5.3, 0.55]];
  for (var m = 0; m < marks.length; m++) {
    var ma = marks[m][0], mr = marks[m][1] * R;
    var d = (a - ma) % (Math.PI * 2);
    if (d < 0) d += Math.PI * 2;
    var glow = Math.max(0, 1 - d * 0.8);
    c.fillStyle = PALE_CSS + (0.25 + glow * 0.75).toFixed(3) + ")";
    c.beginPath();
    c.arc(cx + Math.cos(ma) * mr, cy + Math.sin(ma) * mr,
          Math.max(1.5, R * 0.045), 0, Math.PI * 2);
    c.fill();
  }
}

function drawNav(c, w, h, t) {
  c.clearRect(0, 0, w, h);
  /* Карта узлов сети: точки соединены дугами, дышат по очереди */
  var pts = [[0.15, 0.62], [0.32, 0.3], [0.5, 0.55], [0.68, 0.28], [0.86, 0.6], [0.5, 0.82]];
  c.strokeStyle = CYAN_CSS + "0.4)";
  c.lineWidth = Math.max(1, h * 0.015);
  var links = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [0, 5], [4, 5]];
  for (var l = 0; l < links.length; l++) {
    var A = pts[links[l][0]], B = pts[links[l][1]];
    c.beginPath();
    c.moveTo(A[0] * w, A[1] * h);
    c.quadraticCurveTo((A[0] + B[0]) / 2 * w, (A[1] + B[1]) / 2 * h - h * 0.08,
                       B[0] * w, B[1] * h);
    c.stroke();
  }
  for (var i = 0; i < pts.length; i++) {
    var puls = 0.5 + 0.5 * Math.sin(t * 1.8 + i * 1.1);
    c.fillStyle = PALE_CSS + (0.35 + puls * 0.6).toFixed(3) + ")";
    c.beginPath();
    c.arc(pts[i][0] * w, pts[i][1] * h, Math.max(1.5, h * 0.045 * (0.7 + puls * 0.5)), 0, Math.PI * 2);
    c.fill();
  }
  /* Бегущая искра по случайному ребру: пакет пошёл */
  var li = ((t * 0.7) | 0) % links.length;
  var f = (t * 0.7) % 1;
  var A2 = pts[links[li][0]], B2 = pts[links[li][1]];
  c.fillStyle = PALE_CSS + "0.95)";
  c.beginPath();
  c.arc((A2[0] + (B2[0] - A2[0]) * f) * w,
        (A2[1] + (B2[1] - A2[1]) * f) * h - Math.sin(f * Math.PI) * h * 0.08,
        Math.max(1.5, h * 0.03), 0, Math.PI * 2);
  c.fill();
}

function drawTele(c, w, h, t, speed) {
  c.clearRect(0, 0, w, h);
  /* Сетка */
  c.strokeStyle = CYAN_CSS + "0.22)";
  c.lineWidth = 1;
  for (var gx = 1; gx < 6; gx++) {
    c.beginPath(); c.moveTo(w * gx / 6, 0); c.lineTo(w * gx / 6, h); c.stroke();
  }
  for (var gy = 1; gy < 4; gy++) {
    c.beginPath(); c.moveTo(0, h * gy / 4); c.lineTo(w, h * gy / 4); c.stroke();
  }
  /* Кривая тяги: ползёт влево, отвечает скорости */
  c.strokeStyle = CYAN_CSS + "0.9)";
  c.lineWidth = Math.max(1, h * 0.03);
  c.beginPath();
  for (var x = 0; x <= w; x += 3) {
    var ph = (x / w) * 5 + t * 1.6;
    var y = h * (0.62 - speed * 0.22
      - Math.sin(ph) * 0.10 - Math.sin(ph * 2.7) * 0.05);
    if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
}

function instruments(T, api, proj, fit, dep, meta, parent, tiny, aniso) {
  var list = (meta["экраны"] || []).slice(0);
  /* Снимок без различимых экранов - ставим два расчётных: по левой
     и правой трети полосы между низом окна и рядом клавиш. Пульт
     без приборов заказчик не принимает, и правильно. */
  if (list.length < 2) {
    var box = meta["коробка"];
    var band = 1 - box.b;
    var sw = (box.r - box.l) * 0.20;
    var sh = band * 0.34;
    var sy0 = box.b + band * 0.05;
    list = [
      { x: box.l + (box.r - box.l) * 0.10, y: sy0, w: sw, h: sh },
      { x: box.r - (box.r - box.l) * 0.10 - sw, y: sy0, w: sw, h: sh }
    ].concat(list);
  }
  var kinds = ["radar", "nav", "tele"];
  var made = [];
  for (var i = 0; i < list.length && i < 3; i++) {
    var r = list[i];
    var cu = r.x + r.w / 2, cv = r.y + r.h / 2;
    var sx = fit.sx(cu), sy = fit.sy(cv);
    var dist = D_BACK - dep.at(cu, cv) * (D_BACK - D_FRONT);
    var hw = (fit.sx(r.x + r.w) - fit.sx(r.x)) / 2 * proj.th * dist;
    var hh = (fit.sy(r.y) - fit.sy(r.y + r.h)) / 2 * proj.tv * dist;
    if (!(hw > 1e-5) || !(hh > 1e-5)) continue;
    var pxw = Math.max(96, Math.min(384, Math.round(r.w * api.W * 1.4)));
    var pxh = Math.max(64, Math.min(256, Math.round(pxw * hh / hw)));
    var cnv = document.createElement("canvas");
    cnv.width = pxw; cnv.height = pxh;
    var ctx2 = cnv.getContext("2d");
    var tex2 = new T.CanvasTexture(cnv);
    tex2.anisotropy = aniso;
    if (T.SRGBColorSpace) tex2.colorSpace = T.SRGBColorSpace;
    var mat2 = new T.MeshBasicMaterial({
      map: tex2, transparent: true, opacity: 0.92,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    });
    var mesh = new T.Mesh(new T.PlaneGeometry(hw * 2 * 0.94, hh * 2 * 0.88), mat2);
    proj.set(mesh.position, sx, sy, dist - 0.008);
    mesh.renderOrder = 8;
    mesh.frustumCulled = false;
    parent.add(mesh);
    made.push({ ctx: ctx2, tex: tex2, w: pxw, h: pxh, kind: kinds[i % 3] });
  }
  if (!made.length) return;
  api.screens = made;
  var last = 0;
  api.addUpdate(function (t, dt, tele) {
    /* Десять кадров в секунду прибору достаточно, глазу видна
       развёртка, а телефону не жжёт батарею. */
    if (t - last < 0.1) return;
    last = t;
    var sp = Math.max(0, Math.min(1, tele.speed || 0));
    for (var q = 0; q < made.length; q++) {
      var m = made[q];
      if (m.kind === "radar") drawRadar(m.ctx, m.w, m.h, t);
      else if (m.kind === "nav") drawNav(m.ctx, m.w, m.h, t);
      else drawTele(m.ctx, m.w, m.h, t, sp);
      m.tex.needsUpdate = true;
    }
  });
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
