/* rc-console.js - рама пульта вокруг остекления.

   Зачем отдельный файл. Раньше пульт был плитой под окном: полоса
   железа внизу кадра и семь одинаковых квадратов на ней. Заказчик
   прочитал это одним словом - «не похоже на панель», и был прав.
   В кабине корабля пульт идёт по кругу: балка сверху, стойки по
   бокам, приборная плита снизу, косынки в углах. Окно живёт внутри
   этой рамы, а не над полоской.

   Главная идея модуля. Рама строится не в метрах, а в долях кадра.
   Для каждой точки периметра мы знаем, куда она обязана попасть на
   экране, и уже оттуда считаем мировые координаты. Поэтому на любом
   устройстве рама занимает одинаковую долю: около одиннадцати
   процентов снизу и около шести сверху и по бокам, остальное отдано
   космосу. Ни на телефоне, ни на широком мониторе она не уползает
   и не режется.

   Откуда фактура. Снимки сгенерированы фотореалистично (ChatGPT,
   промпты в rocketcdn/prompts/frame-*.txt и keys-row.txt, по три
   варианта на узел). Целиком снимок на полосу натянуть нельзя: у
   полосы пропорция пятнадцать к одному, у снимка полтора к одному,
   и всё содержимое сплющивается. Поэтому режем узкие ленты, близкие
   по пропорции к тому, что реально видно, и кладём их с честной
   кратностью. Крупные узлы - клавиши, экраны, решётки - стоят
   отдельной геометрией и ловят настоящий свет. */
(function (g) {
"use strict";

var doc = document;
var TAU = Math.PI * 2;

/* ── Точка проектирования ─────────────────────────────────
   Всё считается от глаза пилота в конце подъезда: он смотрит
   строго по минус Z, глаза на 1.62, до остекления 0.86. Это
   расстояние выбрано не на глаз: при прежних 1.42 на телефоне с
   вертикальным полем зрения в сто градусов нижний край проёма
   уходил ниже настила, то есть окно физически не могло закрыть
   кадр. С 0.86 проём закрывает кадр на любом устройстве. */
var EYE = 1.62;
var R_WALL = 3.05;
var CAM_WIN = 0.86;

/* Проём в обшивке. Считан под самый широкий случай (телефон 390x932
   и монитор 21:9) с запасом: край проёма обязан лежать за рамой,
   иначе из-под неё покажется кромка обшивки. */
var WIN_Y0 = 0.17;
var WIN_Y1 = 3.06;
var WIN_HALF = 0.43;

/* Доли кадра, которые занимает рама. Договорённость с заказчиком:
   «не более 10-15% по краям, 90% обзор космоса». Низ шире - он
   несёт клавиши; верх и бока узкие. */
/* Габарит проёма берётся из самого контура (см. SHAPE): считать
   его дважды - в промпте и в коде - значит гарантированно
   разойтись. Эти три числа остаются справочными для разметки
   сайта и пересчитываются при сборке. */
var F_BOTTOM = 0.660;
var F_TOP = 0.900;
var F_SIDE = 0.780;

/* Глубины колец от глаза, метры. */
var D_LIP = 0.500;      /* кромка отбортовки - ближе всего к пилоту */
var D_FACE = 0.545;     /* лицевая плита */
var D_OUT = 0.700;      /* внешняя кромка плиты, уже за кадром */

var TEX = "assets/gen/panel/";

/* ── Проекция ──────────────────────────────────────────── */
function Proj(fovDeg, aspect) {
  this.tv = Math.tan(fovDeg * Math.PI / 360);
  this.th = this.tv * aspect;
  this.cz = -(R_WALL - CAM_WIN);
}
/* Точка, которая попадёт в (sx, sy) кадра на удалении d по оси взгляда */
Proj.prototype.at = function (T, sx, sy, d) {
  return new T.Vector3(sx * this.th * d, EYE + sy * this.tv * d, this.cz - d);
};
/* Та же точка, но доведённая до обшивки */
Proj.prototype.wall = function (T, sx, sy) {
  var dx = sx * this.th;
  var a = 1 + dx * dx, b = -2 * this.cz, c = this.cz * this.cz - R_WALL * R_WALL;
  var disc = b * b - 4 * a * c;
  var t = (-b + Math.sqrt(disc > 0 ? disc : 0)) / (2 * a);
  return this.at(T, sx, sy, t);
};

/* ── Контур фонаря ─────────────────────────────────────────
   Контур снят с самого снимка рубки, а не придуман кодом. Скрипт
   tools/shape.py находит на снимке чёрный проём, обводит его и
   кладёт сюда список вершин в долях снимка (ноль слева и сверху).
   Пока снимок не снят, работает восьмиугольник по тем же долям,
   что заказаны в промпте: одиннадцать процентов по бокам, пять
   сверху, семнадцать снизу, углы срезаны под сорок пять.

   Смысл ровно один: геометрия обязана совпасть с рисунком до
   пикселя. Тогда снимок ложится на железо один в один, и не
   бывает ни щели между рамой и проёмом, ни куска рубки, залезшего
   на космос. */
var SHAPE = {
  wide: [
    [0.8738,0.4994], [0.8744,0.6003], [0.8394,0.6845], [0.8031,0.7561],
    [0.7550,0.7995], [0.6913,0.7995], [0.6469,0.7995], [0.6125,0.7995],
    [0.5850,0.7995], [0.5606,0.7995], [0.5394,0.7995], [0.5194,0.7995],
    [0.5000,0.7995], [0.4806,0.7995], [0.4606,0.7995], [0.4394,0.7995],
    [0.4150,0.7995], [0.3875,0.7995], [0.3531,0.7995], [0.3088,0.7995],
    [0.2450,0.7995], [0.1963,0.7561], [0.1606,0.6845], [0.1256,0.6003],
    [0.1256,0.4994], [0.1256,0.3985], [0.1275,0.2950], [0.1669,0.2171],
    [0.2019,0.1481], [0.2537,0.1137], [0.3113,0.1137], [0.3550,0.1137],
    [0.3906,0.1137], [0.4219,0.1137], [0.4494,0.1137], [0.4750,0.1137],
    [0.5000,0.1124], [0.5250,0.1137], [0.5506,0.1137], [0.5781,0.1137],
    [0.6088,0.1137], [0.6450,0.1137], [0.6887,0.1137], [0.7462,0.1137],
    [0.7975,0.1481], [0.8331,0.2171], [0.8725,0.2950], [0.8738,0.3985]
  ],
  tall: [
    [0.8638,0.4997], [0.8638,0.5196], [0.8650,0.5406], [0.8650,0.5631],
    [0.8650,0.5877], [0.8662,0.6176], [0.8675,0.6537], [0.8413,0.6862],
    [0.7913,0.7114], [0.7362,0.7391], [0.6750,0.7727], [0.5925,0.7936],
    [0.5000,0.7941], [0.4075,0.7936], [0.3250,0.7727], [0.2637,0.7391],
    [0.2087,0.7114], [0.1588,0.6857], [0.1325,0.6537], [0.1350,0.6171],
    [0.1350,0.5877], [0.1350,0.5631], [0.1363,0.5406], [0.1363,0.5196],
    [0.1363,0.4997], [0.1363,0.4798], [0.1363,0.4589], [0.1363,0.4364],
    [0.1363,0.4117], [0.1363,0.3829], [0.1363,0.3473], [0.1350,0.3002],
    [0.1338,0.2342], [0.1688,0.1645], [0.2587,0.1226], [0.3738,0.1001],
    [0.5000,0.1011], [0.6250,0.1006], [0.7388,0.1268], [0.8313,0.1645],
    [0.8675,0.2326], [0.8650,0.3002], [0.8650,0.3468], [0.8650,0.3824],
    [0.8650,0.4112], [0.8638,0.4364], [0.8638,0.4589], [0.8638,0.4798]
  ]
};

/* Доли снимка в доли кадра. Снимок снят кадром целиком, поэтому
   перевод прямой: ноль-один в минус-один-один, ось Y вверх.
   Порядок обхода разворачиваем: в координатах картинки ось Y
   смотрит вниз, и после переворота обход из против часовой
   становится по часовой, а вся сборка лент рассчитана на первый. */
function shapeNdc(pts) {
  var out = [];
  for (var i = pts.length - 1; i >= 0; i--) {
    out.push({ x: pts[i][0] * 2 - 1, y: 1 - pts[i][1] * 2, side: "f" });
  }
  return out;
}

/* Скруглённый многоугольник: по прямой участку - равномерные
   отсчёты, в вершине - дуга. Радиус в долях кадра приводим к
   пикселям по каждой оси отдельно, иначе на широком мониторе
   круглая фаска становится овальной. */
function roundPoly(pts, W, H, nEdge, nArc) {
  var out = [], n = pts.length, i, k;
  var A = W / H;
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function norm(v) {
    /* длину меряем в пикселях, чтобы фаска была одинаковой на глаз */
    var L = Math.hypot(v.x * A, v.y);
    return { x: v.x / (L || 1), y: v.y / (L || 1), L: L };
  }
  for (i = 0; i < n; i++) {
    var p = pts[i], pPrev = pts[(i - 1 + n) % n], pNext = pts[(i + 1) % n];
    var dIn = norm(sub(p, pPrev)), dOut = norm(sub(pNext, p));
    var r = Math.min(p.r, dIn.L * 0.45, dOut.L * 0.45);
    var a = { x: p.x - dIn.x * r, y: p.y - dIn.y * r };
    var b = { x: p.x + dOut.x * r, y: p.y + dOut.y * r };
    /* прямая от конца прошлой дуги до начала этой */
    var prev = pts[(i - 1 + n) % n];
    var dPrev = norm(sub(p, prev));
    var rPrev = Math.min(prev.r, dPrev.L * 0.45);
    var startX = prev.x + dPrev.x * rPrev, startY = prev.y + dPrev.y * rPrev;
    for (k = 0; k < nEdge; k++) {
      var t = k / nEdge;
      out.push({ x: startX + (a.x - startX) * t, y: startY + (a.y - startY) * t, side: p.side });
    }
    /* дуга квадратичной кривой через вершину: дешевле дуги и
       визуально не отличается на такой фаске */
    for (k = 0; k <= nArc; k++) {
      var u = k / nArc, iu = 1 - u;
      out.push({
        x: iu * iu * a.x + 2 * iu * u * p.x + u * u * b.x,
        y: iu * iu * a.y + 2 * iu * u * p.y + u * u * b.y,
        side: p.side
      });
    }
  }
  return out;
}

/* Внешнее кольцо. За кромкой кадра форма никого не волнует, важно
   одно: каждая точка обязана выйти за край, иначе между рамой и
   обшивкой покажется щель. Разводим по лучу от середины. */
function outerRing(inner, push) {
  var out = [];
  for (var i = 0; i < inner.length; i++) {
    var p = inner[i];
    var m = Math.max(Math.abs(p.x), Math.abs(p.y)) || 1;
    var k = Math.max(1 + push, (1 + push) / m);
    out.push({ x: p.x * k, y: p.y * k, side: p.side });
  }
  return out;
}

/* Где отрезок от внутренней точки к внешней пересекает край кадра.
   Нужно, чтобы лицевая плита ровно заканчивалась на кромке экрана:
   всё, что дальше, зритель не видит, и текстуру туда тянуть нельзя. */
function edgeLambda(px, py, qx, qy) {
  var best = 1, lam;
  if (qx !== px) {
    lam = ((qx > px ? 1 : -1) - px) / (qx - px);
    if (lam > 0 && lam < best && Math.abs(py + (qy - py) * lam) <= 1.0002) best = lam;
  }
  if (qy !== py) {
    lam = ((qy > py ? 1 : -1) - py) / (qy - py);
    if (lam > 0 && lam < best && Math.abs(px + (qx - px) * lam) <= 1.0002) best = lam;
  }
  return best;
}

/* ── Полосы между двумя кольцами ───────────────────────────
   Кольца идут точка в точку, поэтому лента собирается тривиально.
   Группы (низ, бока, верх, углы) режем по метке стороны: у каждой
   своя фактура и своя кратность. */
function strip(T, A, B, uvA, uvB, groups) {
  /* groups: [{sides:[...], mat, repeat}] */
  var n = A.length;
  var out = [];
  for (var gi = 0; gi < groups.length; gi++) {
    var G = groups[gi];
    var idx = [];
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      if (G.sides.indexOf(A[i].side) >= 0 || G.sides.indexOf(A[j].side) >= 0) idx.push(i);
    }
    if (!idx.length) continue;
    /* разбиваем на непрерывные куски (левая сторона может обернуться) */
    var runs = [], cur = [idx[0]];
    for (i = 1; i < idx.length; i++) {
      if (idx[i] === idx[i - 1] + 1) cur.push(idx[i]);
      else { runs.push(cur); cur = [idx[i]]; }
    }
    runs.push(cur);
    for (var ri = 0; ri < runs.length; ri++) {
      var run = runs[ri];
      var pos = [], uv = [], ind = [];
      /* длина по дуге для честной кратности рисунка */
      var len = [0], total = 0;
      for (i = 0; i < run.length; i++) {
        var k = run[i], k1 = (k + 1) % n;
        if (i > 0) {
          var p0 = A[run[i - 1]], p1 = A[k];
          total += Math.hypot(p1.x - p0.x, p1.y - p0.y);
          len.push(total);
        }
        void k1;
      }
      var last = run[run.length - 1], lastNext = (last + 1) % n;
      var pe = A[last], pn = A[lastNext];
      total += Math.hypot(pn.x - pe.x, pn.y - pe.y);
      len.push(total);
      var rep = G.repeat || 1;
      /* Развёртка ленты.

         Вдоль ленты идёт длина по дуге, поперёк - ширина полосы.
         Но снимок бывает и вертикальным: стойка снята портретом,
         и если положить её как есть, рисунок ложится набок и
         размазывается в полосы. Поэтому у группы есть swap - он
         меняет оси местами, - и flip, который переворачивает
         поперечную ось: у верхней балки световод обязан оказаться
         со стороны окна, а не у кромки кадра. */
      var vA = G.flip ? uvB : uvA, vB = G.flip ? uvA : uvB;
      for (i = 0; i <= run.length; i++) {
        var ii = i < run.length ? run[i] : lastNext;
        var a = A[ii], b = B[ii];
        pos.push(a.w.x, a.w.y, a.w.z);
        pos.push(b.w.x, b.w.y, b.w.z);
        if (G.ndcUv) {
          /* Развёртка по долям кадра.

             Это и есть «один в один». Снимок рубки снят с той же
             точки, с которой смотрит пилот, поэтому каждая точка
             геометрии обязана взять из него ровно тот пиксель, в
             который она попадает на экране. Никакой кратности,
             никакого разворота осей, ничего не растягивается: где
             на снимке болт, там болт и на железе. */
          uv.push((a.n.x + 1) / 2, (a.n.y + 1) / 2);
          uv.push((b.n.x + 1) / 2, (b.n.y + 1) / 2);
        } else {
          var u = (total > 0 ? len[i] / total : 0) * rep;
          if (G.swap) uv.push(vA, u, vB, u);
          else uv.push(u, vA, u, vB);
        }
      }
      /* Обход строго один на всю раму. Периметр идёт против часовой
         стрелки в долях кадра, внутреннее кольцо всегда A, внешнее
         всегда B - при таком порядке нормаль смотрит на пилота.
         Обратный порядок отбраковывался как задняя грань, и вся
         рама пропадала из кадра при живой геометрии. */
      for (i = 0; i < run.length; i++) {
        var v0 = i * 2, v1 = v0 + 1, v2 = v0 + 2, v3 = v0 + 3;
        ind.push(v0, v1, v2, v1, v3, v2);
      }
      var geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(ind);
      geo.computeVertexNormals();
      out.push(new T.Mesh(geo, G.mat));
    }
  }
  return out;
}

/* ── Полотно ──────────────────────────────────────────────── */
function cnv(w, h) {
  var c = doc.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

var FONT = "'Golos Text', 'Manrope', system-ui, -apple-system, sans-serif";

/* Команды пульта. Порядок менять нельзя: rc-flight сопоставляет
   клавиши с кнопками разметки строго по индексу. */
var CMD = {
  ru: ["КУРС", "СКАН", "УЗЕЛ", "ЗАЛП", "АВТО", "СТОП", "ТЯГА"],
  en: ["COURSE", "SCAN", "NODE", "FIRE", "AUTO", "STOP", "THRUST"],
  auxRu: ["СЕТЬ", "БЛИЖЕ", "ДАЛЬШЕ", "КАДР", "СПРАВКА"],
  auxEn: ["MAP", "ZOOM IN", "ZOOM OUT", "FRAME", "HELP"]
};
/* Что человек получит, нажав. Это и есть ответ на «хуй поймёшь,
   что за кнопки»: подсказка всплывает голограммой на стекле. */
var HINT = {
  ru: [
    "выбрать цель и проложить маршрут",
    "просветить сектор, показать узлы сети",
    "развернуть узел в этой точке",
    "залп по помехе перед кораблём",
    "автопилот ведёт корабль сам",
    "сброс тяги, полная остановка",
    "прибавить ход"
  ],
  en: [
    "pick a target and plot the route",
    "sweep the sector, reveal network nodes",
    "deploy a node at this point",
    "fire at the obstruction ahead",
    "autopilot flies the ship",
    "cut thrust, full stop",
    "add speed"
  ],
  auxRu: ["карта сети", "приблизить", "отдалить", "снимок кадра", "как играть"],
  auxEn: ["network map", "zoom in", "zoom out", "capture frame", "how to play"]
};

/* Лица вспомогательных клавиш рисуем сами: на снимке их нет, а
   стиль обязан совпасть - тёмное стекло, тонкая рамка, холодная
   гравировка. */
function auxFace(x, S, idx) {
  x.save();
  x.translate(S * 0.5, S * 0.5);
  var grd = x.createLinearGradient(0, -S * 0.5, 0, S * 0.5);
  grd.addColorStop(0, "#1b2530");
  grd.addColorStop(0.5, "#101820");
  grd.addColorStop(1, "#0a1016");
  x.fillStyle = grd;
  x.beginPath();
  var rr = S * 0.13, hs = S * 0.40;
  x.moveTo(-hs + rr, -hs);
  x.arcTo(hs, -hs, hs, hs, rr);
  x.arcTo(hs, hs, -hs, hs, rr);
  x.arcTo(-hs, hs, -hs, -hs, rr);
  x.arcTo(-hs, -hs, hs, -hs, rr);
  x.closePath();
  x.fill();
  x.strokeStyle = "rgba(120,150,170,.55)";
  x.lineWidth = S * 0.014;
  x.stroke();
  x.strokeStyle = "rgba(150,225,255,.95)";
  x.fillStyle = x.strokeStyle;
  x.shadowColor = "rgba(60,190,240,.9)";
  x.shadowBlur = S * 0.06;
  x.lineWidth = S * 0.032;
  x.lineCap = "round";
  x.lineJoin = "round";
  var u = S * 0.19;
  x.beginPath();
  if (idx === 0) {                       /* карта сети */
    x.moveTo(-u, -u * 0.7); x.lineTo(0, -u * 0.2); x.lineTo(u, -u * 0.9);
    x.lineTo(u, u * 0.7); x.lineTo(0, u); x.lineTo(-u, u * 0.5); x.closePath();
    x.moveTo(0, -u * 0.2); x.lineTo(0, u);
    x.stroke();
  } else if (idx === 1 || idx === 2) {   /* приблизить, отдалить */
    x.arc(-u * 0.15, -u * 0.15, u * 0.72, 0, TAU); x.stroke();
    x.beginPath();
    x.moveTo(u * 0.38, u * 0.38); x.lineTo(u * 1.0, u * 1.0); x.stroke();
    x.beginPath();
    x.moveTo(-u * 0.62, -u * 0.15); x.lineTo(u * 0.32, -u * 0.15);
    if (idx === 1) { x.moveTo(-u * 0.15, -u * 0.62); x.lineTo(-u * 0.15, u * 0.32); }
    x.stroke();
  } else if (idx === 3) {                /* снимок кадра */
    x.moveTo(-u, -u * 0.45); x.lineTo(-u * 0.45, -u * 0.45); x.lineTo(-u * 0.24, -u * 0.78);
    x.lineTo(u * 0.44, -u * 0.78); x.lineTo(u * 0.62, -u * 0.45); x.lineTo(u, -u * 0.45);
    x.lineTo(u, u * 0.8); x.lineTo(-u, u * 0.8); x.closePath(); x.stroke();
    x.beginPath(); x.arc(0, u * 0.14, u * 0.4, 0, TAU); x.stroke();
  } else {                               /* как играть */
    x.font = "800 " + Math.round(S * 0.34) + "px " + FONT;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("?", 0, S * 0.02);
  }
  x.restore();
}

/* Атлас лиц клавиш.

   Подпись живёт на самом лице, а не на отдельной табличке под ним.
   Табличку пробовали: при доле кадра в одиннадцать процентов она
   выходит ростом в двадцать пикселей, слово в неё влезает, но
   читается хуже, чем то же слово под иконкой на самой клавише.
   Плюс отдельная плита это ещё один проход отрисовки и ещё один
   шанс на z-конфликт.

   Ячейка не квадратная: сверху квадратное лицо со снимка, снизу
   полоса с гравировкой. Пропорция ячейки и пропорция клавиши
   совпадают один в один, иначе иконка сплющится. */
var CELL_W = 256, CELL_H = 332, CELL_COLS = 4, CELL_ROWS = 4;
var CAP_RATIO = CELL_H / CELL_W;

function faceAtlas(T, img, ru) {
  var c = cnv(CELL_W * CELL_COLS, CELL_H * CELL_ROWS), x = c.getContext("2d");
  x.fillStyle = "#0a0d11";
  x.fillRect(0, 0, c.width, c.height);
  var names = (ru ? CMD.ru : CMD.en).concat(ru ? CMD.auxRu : CMD.auxEn);
  var i, cx, cy;
  for (i = 0; i < 12; i++) {
    cx = (i % CELL_COLS) * CELL_W;
    cy = Math.floor(i / CELL_COLS) * CELL_H;
    x.save();
    x.translate(cx, cy);
    if (i < 7 && img) {
      var cw = img.width / 7;
      x.drawImage(img, i * cw, 0, cw, img.height, 0, 0, CELL_W, CELL_W);
    } else if (i >= 7) {
      auxFace(x, CELL_W, i - 7);
    } else {
      x.fillStyle = "#101820";
      x.fillRect(0, 0, CELL_W, CELL_W);
    }
    /* Полоса подписи: тёмный анодированный металл, слово выбито
       штампом - тёмный оттиск и светлая фаска на пиксель выше. */
    var bh = CELL_H - CELL_W;
    var gb = x.createLinearGradient(0, CELL_W, 0, CELL_H);
    gb.addColorStop(0, "#1c242c");
    gb.addColorStop(0.42, "#131a21");
    gb.addColorStop(1, "#0b1015");
    x.fillStyle = gb;
    x.fillRect(0, CELL_W, CELL_W, bh);
    x.fillStyle = "rgba(150,180,200,.22)";
    x.fillRect(0, CELL_W, CELL_W, 2);
    var txt = names[i] || "";
    /* Кегль подбираем замером, а не формулой от числа букв: у
       «СПРАВКА» и «ДАЛЬШЕ» надпись вылезала за клавишу и обрезалась
       кромкой кадра. Уменьшаем, пока строка не встанет в ширину. */
    var size = 54;
    x.textAlign = "center";
    x.textBaseline = "middle";
    var lim = CELL_W * 0.88;
    do {
      x.font = "800 " + size + "px " + FONT;
      if (x.measureText(txt).width <= lim) break;
      size -= 2;
    } while (size > 18);
    var by = CELL_W + bh * 0.54;
    x.fillStyle = "rgba(3,6,9,.92)";
    x.fillText(txt, CELL_W / 2, by + 2);
    x.fillStyle = i === 3 ? "rgba(255,198,142,.95)" : "rgba(202,228,244,.94)";
    x.fillText(txt, CELL_W / 2, by);
    x.restore();
  }
  /* ячейка 12: боковины и донце клавиши */
  cx = (12 % CELL_COLS) * CELL_W;
  cy = Math.floor(12 / CELL_COLS) * CELL_H;
  var gg = x.createLinearGradient(cx, cy, cx, cy + CELL_H);
  gg.addColorStop(0, "#39424c");
  gg.addColorStop(0.45, "#1d242c");
  gg.addColorStop(1, "#10161c");
  x.fillStyle = gg;
  x.fillRect(cx, cy, CELL_W, CELL_H);
  var t = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* Скруглённая коробка: лицо смотрит в плюс Y, толщина по Y.
   Развёртку правим руками - у выдавленной геометрии координаты
   идут в метрах, и рисунок на ней повторяется. */
function capGeo(T, w, h, d, r) {
  var s = new T.Shape();
  var hw = w / 2 - r, hh = h / 2 - r;
  s.moveTo(-hw - r, -hh);
  s.lineTo(-hw - r, hh);
  s.quadraticCurveTo(-hw - r, hh + r, -hw, hh + r);
  s.lineTo(hw, hh + r);
  s.quadraticCurveTo(hw + r, hh + r, hw + r, hh);
  s.lineTo(hw + r, -hh);
  s.quadraticCurveTo(hw + r, -hh - r, hw, -hh - r);
  s.lineTo(-hw, -hh - r);
  s.quadraticCurveTo(-hw - r, -hh - r, -hw - r, -hh);
  var geo = new T.ExtrudeGeometry(s, {
    depth: d, bevelEnabled: true, bevelSegments: 2, steps: 1,
    bevelSize: Math.min(0.012, r * 0.4), bevelThickness: Math.min(0.010, d * 0.35),
    curveSegments: 4
  });
  geo.translate(0, 0, -d / 2);
  geo.rotateX(-Math.PI / 2);          /* лицо смотрит вверх по Y */
  return geo;
}

/* Развёртка клавиши: лицо в свою ячейку атласа, всё остальное - в
   тёмную. Так одна клавиша это один материал и один вызов отрисовки. */
function capUv(T, geo, cell) {
  geo.computeBoundingBox();
  var pos = geo.attributes.position, uv = geo.attributes.uv;
  var box = geo.boundingBox;
  var minX = box.min.x, maxX = box.max.x, minZ = box.min.z, maxZ = box.max.z;
  var top = box.max.y - 1e-4;
  var cw = 1 / CELL_COLS, ch = 1 / CELL_ROWS;
  var fx = (cell % CELL_COLS) * cw, fy = 1 - (Math.floor(cell / CELL_COLS) + 1) * ch;
  var dx = (12 % CELL_COLS) * cw, dy = 1 - (Math.floor(12 / CELL_COLS) + 1) * ch;
  for (var i = 0; i < pos.count; i++) {
    var px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    if (py >= top) {
      var u = (px - minX) / (maxX - minX);
      var v = 1 - (pz - minZ) / (maxZ - minZ);
      uv.setXY(i, fx + u * cw, fy + v * ch);
    } else {
      uv.setXY(i, dx + cw * 0.5, dy + ch * 0.5);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/* ── Сборка ──────────────────────────────────────────────── */
var RC = { last: null };

function portraitOf(W, H) { return H > W; }

function build(T, o) {
  o = o || {};
  var W = o.width || (g.innerWidth || 1280);
  var H = o.height || (g.innerHeight || 720);
  var tiny = !!o.tiny;
  var proj = new Proj(o.fov || 72, W / Math.max(1, H));
  var ru = o.ru !== false;

  /* Рама висит на оси взгляда, а не на полу помещения.

     Точка сборки одна - глаз пилота. Но камера в конце подъезда
     смотрит не строго по горизонту: она нацелена туда же, куда
     смотрит первый кадр полёта, а маршрут в этой точке идёт с
     небольшим подъёмом. Помещение при этом стоит ровно, и без
     поправки рама уезжала вверх: верхняя балка почти покидала
     кадр, нижняя подтягивалась. Поэтому рама сидит на шарнире в
     точке глаза и поворачивается вместе с взглядом, а комната
     остаётся на своих ногах. */
  var pivot = new T.Group();
  pivot.position.set(0, EYE, -(R_WALL - CAM_WIN));
  var grp = new T.Group();
  grp.position.set(0, -EYE, R_WALL - CAM_WIN);
  pivot.add(grp);
  var api = {
    group: pivot, inner3: grp, proj: proj,
    caps: [], legends: null, lights: [], anim: [],
    /* Наклон взгляда приходит из полёта: только он знает, куда
       нацелен первый кадр. */
    setPitch: function (rad) { pivot.rotation.x = rad || 0; }
  };

  /* Внутренний контур - то, что человек считает окном */
  var sh = portraitOf(W, H) ? SHAPE.tall : SHAPE.wide;
  var inner = { l: 1, r: -1, b: 1, t: -1 };
  for (var si = 0; si < sh.length; si++) {
    var nx = sh[si][0] * 2 - 1, ny = 1 - sh[si][1] * 2;
    if (nx < inner.l) inner.l = nx;
    if (nx > inner.r) inner.r = nx;
    if (ny < inner.b) inner.b = ny;
    if (ny > inner.t) inner.t = ny;
  }
  /* Внешний уводим за кадр: между кромкой экрана и обшивкой рама
     не обязана быть красивой, её никто не видит */
  var outer = { l: -1.26, r: 1.26, b: -1.30, t: 1.28 };
  api.inner = inner;

  /* Радиус угла. Было 0.115 от меньшей стороны - рама читалась
     рамкой телевизора, а не кабиной: угол съедал треть боковой
     стойки. На референсах угол острый, со сварной косынкой. */
  var nEdge = tiny ? 4 : 7, nArc = tiny ? 3 : 4;
  var portrait = H > W;
  /* Контур снят с самого снимка, скруглять его нечем и незачем:
     фаски углов там уже нарисованы. */
  var Rin = shapeNdc(portrait ? SHAPE.tall : SHAPE.wide);
  void nEdge; void nArc;
  api.portrait = portrait;
  /* Ширина отбортовки со световодом. Была 0.020 доли кадра - на
     мониторе это тридцать пикселей светящейся трубы по всему
     периметру, и она забивала фактуру рамы целиком. Настоящий
     световод в кабине это тонкая линия. */
  var expand = 0.009;
  /* Лицевая плита начинается сразу за кромкой: каждую точку
     контура отодвигаем наружу по лучу ровно на ширину отбортовки.
     Через outerRing это делать нельзя - он ещё и выталкивает всё
     за край кадра, и отбортовка разрасталась во всю раму. */
  var Rface = Rin.map(function (p) {
    var m = Math.hypot(p.x, p.y) || 1;
    var k = 1 + expand / m;
    return { x: p.x * k, y: p.y * k, side: p.side };
  });
  var Rout = outerRing(Rin, 0.34);

  var i, n = Rin.length;
  var Alip = [], Aface = [], Aedge = [], Aout = [], Awall = [], Aback = [];
  for (i = 0; i < n; i++) {
    var a = Rin[i], f = Rface[i], q = Rout[i];
    Alip.push({ side: a.side, n: { x: a.x, y: a.y }, w: proj.at(T, a.x, a.y, D_LIP) });
    Aback.push({ side: a.side, n: { x: a.x, y: a.y }, w: proj.at(T, a.x, a.y, D_LIP + 0.075) });
    Aface.push({ side: f.side, n: { x: f.x, y: f.y }, w: proj.at(T, f.x, f.y, D_FACE) });
    var lam = edgeLambda(f.x, f.y, q.x, q.y);
    var ex = f.x + (q.x - f.x) * lam, ey = f.y + (q.y - f.y) * lam;
    Aedge.push({ side: f.side, n: { x: ex, y: ey },
                 w: proj.at(T, ex, ey, D_FACE + (D_OUT - D_FACE) * lam), lam: lam });
    Aout.push({ side: q.side, n: { x: q.x, y: q.y }, w: proj.at(T, q.x, q.y, D_OUT) });
    Awall.push({ side: q.side, n: { x: q.x, y: q.y }, w: proj.wall(T, q.x, q.y) });
  }

  /* ── Материалы ──────────────────────────────────────────── */
  var loader = new T.TextureLoader();
  function tex(name, repX, repY) {
    var t = loader.load(TEX + name);
    if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
    /* Повтор по обеим осям. Была зажата вторая: у боковой стойки
       после разворота развёртки повторяться обязана именно она, и
       всё, что за единицей, превращалось в растянутый последний
       ряд пикселей - ту самую полосу-мазок. */
    t.wrapS = T.RepeatWrapping;
    t.wrapT = T.RepeatWrapping;
    t.anisotropy = tiny ? 4 : 8;
    t.repeat.set(repX || 1, repY || 1);
    return t;
  }
  /* Одна фактура на всю раму - снимок рубки целиком.

     Пять отдельных лент с кусками снимков были ошибкой: у каждой
     своя кратность, свой разворот, свои швы, и вместе они читались
     набором наклеек. Заказчик сказал это прямо: «есть разница
     между тем что ты делаешь, и как в реальности выглядит». Есть.
     Поэтому теперь рубка снимается одним кадром с точки пилота, а
     геометрия берёт из неё пиксели по своим же долям кадра. Швов
     не бывает по построению. */
  var ckName = portrait ? "cockpit-tall.webp" : "cockpit-wide.webp";
  var ckTex = tex(ckName, 1, 1);
  ckTex.wrapS = ckTex.wrapT = T.ClampToEdgeWrapping;
  var matFrame = new T.MeshStandardMaterial({
    map: ckTex, roughness: 0.56, metalness: 0.52,
    /* Отражение окружения придавлено: панорама салона яркая, и на
       единице она заливала рубку ровным голубым, съедая её
       собственный контраст. Раме нужен блик, а не заливка. */
    envMapIntensity: 0.32, side: T.DoubleSide,
    /* Свет на снимке уже стоит - лампы, световоды, блики. Салон
       тёмный, поэтому большую часть яркости рама берёт из своего
       же снимка, а лампы салона добавляют объём и живой отклик на
       поворот головы. */
    emissiveMap: ckTex, emissive: new T.Color(0xffffff), emissiveIntensity: 0.78
  });
  api.frameMat = matFrame;

  var matEdge = new T.MeshStandardMaterial({
    color: 0x11161c, roughness: 0.52, metalness: 0.86, envMapIntensity: 1.0,
    side: T.DoubleSide
  });

  /* Кратность рисунка: считаем из настоящего размера полосы на
     экране, иначе лента растянется и снимок превратится в кашу. */
  var bandBottomPx = (1 + inner.b) * H / 2;
  var bandTopPx = (1 - inner.t) * H / 2;
  var bandSidePx = (1 + inner.l) * W / 2;

  /* ── Лицевая плита ──────────────────────────────────────── */
  /* Стойка и скос идут одной фактурой: на референсах это одна
     деталь, которая от пояса уходит внутрь к балке. Отдельная
     угловая косынка на длинном скосе растягивалась в мазок. */
  var faces = strip(T, Aface, Aedge, 1, 0, [
    { sides: ["f"], mat: matFrame, ndcUv: true }
  ]);
  for (i = 0; i < faces.length; i++) grp.add(faces[i]);

  /* Плечо и юбка: за кадром, но обязаны быть - без них рама висит
     плоской наклейкой, а на подъезде видно, что она без толщины. */
  var ALL = ["f"];
  var shoulder = strip(T, Aedge, Aout, 0, 1, [{ sides: ALL, mat: matEdge, repeat: 1 }]);
  for (i = 0; i < shoulder.length; i++) grp.add(shoulder[i]);
  var skirt = strip(T, Aout, Awall, 0, 1, [{ sides: ALL, mat: matEdge, repeat: 1 }]);
  for (i = 0; i < skirt.length; i++) grp.add(skirt[i]);

  /* ── Отбортовка со световодом ───────────────────────────
     Кромка рамы у настоящей кабины светится: сверху тёплый,
     по бокам холодный. Это единственная линия, которая держит
     силуэт рамы на фоне космоса. */
  /* Световод по всей кромке холодный. Тёплую ноту оставляем
     только вдоль верхней балки узкой полосой: на референсах
     заказчика кабина цианово-синяя, тёплый янтарь спорил с
     космосом и тянул кадр в коричневое. */
  /* Отбортовка кромки. Светящейся трубы больше нет: на снимке
     рубки световоды уже стоят там, где им положено, и вторая
     подсветка поверх спорила бы с ней. Здесь остаётся узкая фаска
     тёмного металла - она держит силуэт проёма и ловит блик от
     ламп салона. */
  var lip = strip(T, Alip, Aface, 0.5, 0.5, [{ sides: ["f"], mat: matEdge }]);

  /* Возврат кромки к стеклу: без него рама с косого ракурса
     показывает открытый торец */
  var ret = strip(T, Aback, Alip, 0, 1, [{ sides: ALL, mat: matEdge, repeat: 1 }]);
  for (i = 0; i < ret.length; i++) grp.add(ret[i]);

  /* ── Органы управления ──────────────────────────────────
     Ставим их не «примерно снизу», а ровно туда, где на снимке
     рубки для них есть место: семь команд в центральный блок
     приборной доски, пять служебных на стойки. Координаты заданы
     в долях снимка, поэтому железо и рисунок совпадают на любом
     экране без подгонки.

     Клавиша повёрнута к пилоту и стоит в гнезде. Нажатие уводит её
     вглубь, свечение поднимается - это тот самый отклик, без
     которого панель читается картинкой. */
  var keyRig = new T.Group();
  keyRig.rotation.x = Math.PI / 2;      /* локальный +Y смотрит на пилота */
  grp.add(keyRig);
  api.keyRig = keyRig;

  var atlasTex = faceAtlas(T, null, ru);
  api.atlasTex = atlasTex;
  var im = new Image();
  im.onload = function () {
    var fresh = faceAtlas(T, im, ru);
    atlasTex.image = fresh.image;
    atlasTex.needsUpdate = true;
  };
  im.src = TEX + "fr-keys.webp";

  function ndcOfPx(px, axis) { return px / (axis === "x" ? W / 2 : H / 2); }
  /* Доля снимка в долю кадра */
  function fx(u) { return u * 2 - 1; }
  function fy(v) { return 1 - v * 2; }

  /* Глубина точки рамы по её доле кадра.

     Лицевая плита идёт от контура проёма наружу, поэтому глубина
     точки зависит от того, насколько далеко она ушла от контура по
     своему лучу. Радиус контура в нужную сторону берём пересечением
     луча с многоугольником - контур снят со снимка и правильным
     кругом не описывается. */
  function innerRadius(dx, dy) {
    var best = 0;
    for (var k = 0; k < Rin.length; k++) {
      var a = Rin[k], b = Rin[(k + 1) % Rin.length];
      var ex = b.x - a.x, ey = b.y - a.y;
      var den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      var tt = (a.x * ey - a.y * ex) / den;
      if (tt <= 0) continue;
      var px2 = dx * tt, py2 = dy * tt;
      var sAlong = Math.abs(ex) > Math.abs(ey) ? (px2 - a.x) / ex : (py2 - a.y) / ey;
      if (sAlong < -0.001 || sAlong > 1.001) continue;
      if (tt > best) best = tt;
    }
    return best || 1;
  }
  function depthAt(sx, sy) {
    var m = Math.hypot(sx, sy);
    if (m < 1e-6) return D_FACE;
    var ux = sx / m, uy = sy / m;
    var rIn = innerRadius(ux, uy);
    /* Внешнее кольцо выталкивается не по радиусу, а до квадрата
       кадра - иначе по диагонали остаётся щель. Считать его как
       rIn * 1.34 было ошибкой: по вертикали радиус выходил вдвое
       меньше настоящего, глубина уезжала на десяток сантиметров, и
       клавиши проваливались за лицевую плиту. */
    var mMax = Math.max(Math.abs(ux), Math.abs(uy)) * rIn;
    var rOut = rIn * Math.max(1.34, 1.34 / (mMax || 1));
    var lam = (m - rIn) / Math.max(1e-6, rOut - rIn);
    return D_FACE + (D_OUT - D_FACE) * Math.max(0, Math.min(1, lam));
  }

  var capThick = 0.014;
  var caps = api.caps;

  function addKey(cell, sx, sy, wPx, hPx, hint) {
    var d = depthAt(sx, sy);
    var hw = ndcOfPx(wPx / 2, "x") * proj.th * d;
    var hh = ndcOfPx(hPx / 2, "y") * proj.tv * d;
    var geo = capUv(T, capGeo(T, hw * 2, hh * 2, capThick, Math.min(hw, hh) * 0.20), cell);
    var mat = new T.MeshStandardMaterial({
      map: atlasTex, emissiveMap: atlasTex,
      emissive: new T.Color(0xffffff), emissiveIntensity: 0.055,
      roughness: 0.46, metalness: 0.58, envMapIntensity: 0.7
    });
    var mesh = new T.Mesh(geo, mat);
    var w = proj.at(T, sx, sy, d);
    mesh.position.set(w.x, w.z + 0.010, -w.y);
    mesh.userData.homeY = mesh.position.y;
    mesh.userData.halfW = hw;
    mesh.userData.halfH = hh;
    mesh.userData.hit = Math.max(40, Math.max(wPx, hPx) * 1.05);
    mesh.userData.ph = caps.length * 0.64;
    mesh.userData.hint = hint;
    mesh.userData.baseEmissive = 0.055;
    keyRig.add(mesh);
    caps.push(mesh);
    return mesh;
  }

  var socketGeo = null, socketMat = new T.MeshStandardMaterial({
    color: 0x090d11, roughness: 0.46, metalness: 0.9, envMapIntensity: 0.7
  });
  function addSocket(sx, sy, wPx, hPx) {
    var d = depthAt(sx, sy);
    var hw = ndcOfPx(wPx * 0.60, "x") * proj.th * d;
    var hh = ndcOfPx(hPx * 0.60, "y") * proj.tv * d;
    if (!socketGeo) socketGeo = capGeo(T, 2, 2, 0.5, 0.22);
    var m = new T.Mesh(socketGeo, socketMat);
    var w = proj.at(T, sx, sy, d);
    m.position.set(w.x, w.z + 0.004, -w.y);
    m.scale.set(hw, 0.020, hh);
    keyRig.add(m);
    return m;
  }

  /* Раскладка в долях снимка. Замерена по самому снимку: центр
     приборной доски свободен под блок команд, стойки несут
     служебные тумблеры. */
  var L = portrait ? {
    row: 0.876, x0: 0.215, x1: 0.785, capH: 0.048,
    aux: [[0.066, 0.330], [0.066, 0.415], [0.934, 0.300], [0.934, 0.385], [0.934, 0.470]],
    auxH: 0.030
  } : {
    row: 0.888, x0: 0.348, x1: 0.652, capH: 0.088,
    aux: [[0.068, 0.400], [0.068, 0.510], [0.932, 0.365], [0.932, 0.475], [0.932, 0.585]],
    auxH: 0.054
  };
  var capH = L.capH * H;
  var keyPx = capH / CAP_RATIO;
  var pitchNdc = (L.x1 - L.x0) / 6;
  var hints = ru ? HINT.ru : HINT.en;
  for (i = 0; i < 7; i++) {
    var kx = fx(L.x0 + pitchNdc * i), ky = fy(L.row);
    addSocket(kx, ky, keyPx * 1.10, capH * 1.06);
    addKey(i, kx, ky, keyPx, capH, hints[i]);
  }
  api.keyPx = keyPx;
  api.capH = capH;

  var auxH = L.auxH * H, auxW = auxH / CAP_RATIO;
  var auxHints = ru ? HINT.auxRu : HINT.auxEn;
  /* Порядок служебных обязан совпасть с разметкой: карта, ближе,
     дальше, кадр, справка. */
  for (i = 0; i < 5; i++) {
    var ax = fx(L.aux[i][0]), ay = fy(L.aux[i][1]);
    addSocket(ax, ay, auxW * 1.12, auxH * 1.08);
    addKey(7 + i, ax, ay, auxW, auxH, auxHints[i]);
  }
  api.auxW = auxW;

  /* ── Приборные модули ───────────────────────────────────
     Раньше на этом месте была голая полоса металла, и заказчик
     сравнил её со старой рубкой не в нашу пользу. На его
     референсах приборка плотная: круглый радар слева, экраны
     телеметрии, рычаг тяги и крупная скорость справа. Всё это
     живое - радар метёт сектор, числа меняются, рычаг ходит со
     скоростью корабля.

     Модуль это плоскость на лицевой плите, повёрнутая к пилоту,
     с полотном вместо картинки. Полотно перерисовываем редко
     (радар двенадцать раз в секунду, телеметрия четыре), иначе
     каждый кадр уходил бы в заливку. */
  var mods = [];
  function addModule(sx, sy, wPx, hPx, draw, fps) {
    var d = depthAt(sx, sy);
    var hw = ndcOfPx(wPx / 2, "x") * proj.th * d;
    var hh = ndcOfPx(hPx / 2, "y") * proj.tv * d;
    var cw = Math.max(64, Math.min(512, Math.round(wPx * 2)));
    var chh = Math.max(48, Math.min(512, Math.round(hPx * 2)));
    var c = cnv(cw, chh);
    var t = new T.CanvasTexture(c);
    if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = tiny ? 2 : 4;
    var geo = new T.PlaneGeometry(hw * 2, hh * 2);
    geo.rotateX(-Math.PI / 2);
    var mat = new T.MeshStandardMaterial({
      map: t, emissiveMap: t, emissive: new T.Color(0xffffff), emissiveIntensity: 0.62,
      roughness: 0.30, metalness: 0.1, envMapIntensity: 0.5, fog: false
    });
    var m = new T.Mesh(geo, mat);
    var w = proj.at(T, sx, sy, d);
    /* Экран выносим вперёд на два сантиметра. Четыре миллиметра
       не хватало: лицевая плита в этой точке считается по линейной
       доле, а лежит по прямой в пространстве, и расхождение в пару
       миллиметров прятало модуль внутрь плиты. */
    m.position.set(w.x, w.z + 0.020, -w.y);
    m.renderOrder = 4;
    keyRig.add(m);
    /* рамка гнезда вокруг экрана: без неё модуль читается наклейкой */
    var ring2 = new T.Mesh(capGeo(T, hw * 2.14, hh * 2.20, 0.016, Math.min(hw, hh) * 0.16), socketMat);
    ring2.position.set(w.x, w.z + 0.006, -w.y);
    keyRig.add(ring2);
    mods.push({ mesh: m, ctx: c.getContext("2d"), tex: t, w: cw, h: chh,
                draw: draw, every: 1000 / (fps || 6), last: -1e9 });
    return m;
  }

  var CY = "#7fe3ff", CY2 = "rgba(127,227,255,.35)", INK = "#050b12";

  function drawRadar(x, W2, H2, t, tele) {
    x.fillStyle = INK; x.fillRect(0, 0, W2, H2);
    var cx = W2 / 2, cy = H2 / 2, R = Math.min(cx, cy) * 0.92;
    x.strokeStyle = CY2; x.lineWidth = Math.max(1, R * 0.02);
    for (var k = 1; k <= 3; k++) {
      x.beginPath(); x.arc(cx, cy, R * k / 3, 0, TAU); x.stroke();
    }
    x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy);
    x.moveTo(cx, cy - R); x.lineTo(cx, cy + R); x.stroke();
    var a = (t * 1.15) % TAU;
    var gr = x.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, "rgba(127,227,255,.45)");
    gr.addColorStop(1, "rgba(127,227,255,0)");
    x.beginPath(); x.moveTo(cx, cy);
    x.arc(cx, cy, R, a - 0.5, a); x.closePath();
    x.fillStyle = gr; x.fill();
    x.strokeStyle = CY; x.lineWidth = Math.max(1, R * 0.035);
    x.beginPath(); x.moveTo(cx, cy);
    x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.stroke();
    /* отметки целей: не случайные - те же тела, что в маршруте */
    var marks = (tele && tele.marks) || [0.42, 0.68, 0.24];
    for (k = 0; k < marks.length; k++) {
      var ma = a - 0.9 - k * 1.9, mr = R * (0.3 + marks[k] * 0.6);
      var fade = 0.35 + 0.65 * Math.max(0, 1 - ((a - ma + TAU) % TAU) / 2.2);
      x.fillStyle = "rgba(154,255,120," + fade.toFixed(2) + ")";
      x.beginPath();
      x.arc(cx + Math.cos(ma) * mr, cy + Math.sin(ma) * mr, Math.max(1.5, R * 0.05), 0, TAU);
      x.fill();
    }
    x.strokeStyle = "rgba(140,180,205,.5)"; x.lineWidth = Math.max(1, R * 0.05);
    x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.stroke();
  }

  function drawTele(x, W2, H2, t, tele) {
    x.fillStyle = INK; x.fillRect(0, 0, W2, H2);
    x.strokeStyle = "rgba(127,227,255,.16)"; x.lineWidth = 1;
    var step = H2 / 6, k;
    for (k = 1; k < 6; k++) { x.beginPath(); x.moveTo(0, k * step); x.lineTo(W2, k * step); x.stroke(); }
    for (k = 1; k < 10; k++) { x.beginPath(); x.moveTo(k * W2 / 10, 0); x.lineTo(k * W2 / 10, H2); x.stroke(); }
    /* график: не шум, а тот же ход корабля */
    var v = (tele && tele.speed) || 0;
    x.strokeStyle = CY; x.lineWidth = Math.max(1.5, H2 * 0.03);
    x.beginPath();
    for (k = 0; k <= 40; k++) {
      var u = k / 40;
      var yy = H2 * (0.72 - 0.42 * v * (0.55 + 0.45 * Math.sin(u * 7 + t * 1.6)));
      if (k === 0) x.moveTo(0, yy); else x.lineTo(u * W2, yy);
    }
    x.stroke();
    x.fillStyle = "rgba(190,232,250,.92)";
    x.font = "700 " + Math.round(H2 * 0.17) + "px " + FONT;
    x.textBaseline = "top";
    x.fillText("ПОТОК", W2 * 0.04, H2 * 0.05);
    x.textAlign = "right";
    x.fillText(Math.round(120 + v * 880) + " ГБ/С", W2 * 0.96, H2 * 0.05);
    x.textAlign = "left";
  }

  function drawSpeed(x, W2, H2, t, tele) {
    x.fillStyle = INK; x.fillRect(0, 0, W2, H2);
    var v = (tele && tele.speed) || 0;
    x.fillStyle = "rgba(127,227,255,.10)";
    x.fillRect(0, H2 * (1 - v), W2, H2 * v);
    x.fillStyle = "#cfefff";
    x.font = "800 " + Math.round(H2 * 0.52) + "px " + FONT;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText((v * 12).toFixed(1), W2 / 2, H2 * 0.40);
    x.fillStyle = "rgba(160,200,225,.85)";
    x.font = "700 " + Math.round(H2 * 0.20) + "px " + FONT;
    x.fillText("КМ/С", W2 / 2, H2 * 0.80);
    void t;
  }

  /* Куда садятся живые приборы. Замерено по самому снимку: на
     приборной доске уже есть врезанные экраны, и наши показания
     обязаны лечь ровно в них, а не рядом. Радар слева, поток по
     обе стороны от блока команд, скорость справа. */
  var MOD = portrait ? {
    radar: [0.150, 0.945, 0.130, 0.030],
    telL:  [0.330, 0.945, 0.150, 0.028],
    telR:  [0.670, 0.945, 0.150, 0.028],
    speed: [0.855, 0.945, 0.150, 0.030]
  } : {
    radar: [0.160, 0.900, 0.078, 0.070],
    telL:  [0.258, 0.900, 0.062, 0.062],
    telR:  [0.762, 0.900, 0.062, 0.062],
    speed: [0.858, 0.900, 0.082, 0.062]
  };
  function mod(spec, draw, fps) {
    addModule(fx(spec[0]), fy(spec[1]), spec[2] * W, spec[3] * H, draw, fps);
  }
  mod(MOD.radar, drawRadar, 12);
  mod(MOD.telL, drawTele, 4);
  mod(MOD.telR, drawTele, 4);
  mod(MOD.speed, drawSpeed, 6);
  api.mods = mods;

  /* ── Голограмма марки над проектором ────────────────────
     На приборной доске стоят два проекционных гнезда с хромовым
     ободом, и оба светят вверх пустым конусом. Заказчик заметил
     это сразу: «справа нету голограммного логотипа». Ставим марку
     корабля в правый конус - она собрана лучом, поэтому висит
     строчной развёрткой, чуть дрожит и медленно дышит. */
  var holo = null;
  (function () {
    var HL = portrait ? [0.800, 0.690, 0.165] : [0.842, 0.688, 0.090];
    var hx = fx(HL[0]), hy = fy(HL[1]);
    var d = depthAt(hx, hy);
    var wPx = HL[2] * W, hPx = wPx * (320 / 343);
    var hw = ndcOfPx(wPx / 2, "x") * proj.th * d;
    var hh = ndcOfPx(hPx / 2, "y") * proj.tv * d;
    var cw = 256, chh = Math.round(256 * 320 / 343);
    var c = cnv(cw, chh), cx2 = c.getContext("2d");
    var tex2 = new T.CanvasTexture(c);
    if (T.SRGBColorSpace) tex2.colorSpace = T.SRGBColorSpace;
    var geo = new T.PlaneGeometry(hw * 2, hh * 2);
    geo.rotateX(-Math.PI / 2);
    var mat = new T.MeshBasicMaterial({
      map: tex2, transparent: true, opacity: 0.0,
      blending: T.AdditiveBlending, depthWrite: false, fog: false
    });
    holo = new T.Mesh(geo, mat);
    var w2 = proj.at(T, hx, hy, d);
    holo.position.set(w2.x, w2.z + 0.030, -w2.y);
    holo.renderOrder = 8;
    keyRig.add(holo);

    var mark = new Image();
    mark.onload = function () { holo.userData.img = mark; };
    mark.src = "assets/mark.webp";

    holo.userData.draw = function (t) {
      var x2 = cx2;
      x2.clearRect(0, 0, cw, chh);
      var img2 = holo.userData.img;
      if (!img2) return;
      /* Марку берём по альфе и перекрашиваем в холодный: голограмма
         не бывает цветной печатью, она светится одним лучом. */
      x2.save();
      x2.globalCompositeOperation = "source-over";
      x2.drawImage(img2, 0, 0, cw, chh);
      x2.globalCompositeOperation = "source-in";
      var gr = x2.createLinearGradient(0, 0, 0, chh);
      gr.addColorStop(0, "rgba(150,236,255,.95)");
      gr.addColorStop(0.55, "rgba(90,205,245,.80)");
      gr.addColorStop(1, "rgba(60,170,225,.62)");
      x2.fillStyle = gr;
      x2.fillRect(0, 0, cw, chh);
      /* Строчная развёртка и бегущий срез: изображение собрано
         лучом, а не напечатано */
      x2.globalCompositeOperation = "destination-out";
      for (var yy = (t * 26) % 4; yy < chh; yy += 4) x2.fillRect(0, yy, cw, 1.2);
      var cut = ((t * 0.42) % 1.6) * chh - chh * 0.3;
      x2.fillRect(0, cut, cw, chh * 0.035);
      x2.restore();
      tex2.needsUpdate = true;
    };
  })();
  api.holo = holo;

  /* ── Свет рамы ──────────────────────────────────────────
     Два коротких источника за отбортовкой. Дальность жёстко
     ограничена: пульт обязан светиться сам, но подкрашивать Землю
     за окном он не имеет права. */
  var lightIn = proj.at(T, 0, inner.b - 0.02, D_LIP - 0.10);
  var lampBottom = new T.PointLight(0x9fd8f2, tiny ? 3.2 : 4.4, 3.2, 1.5);
  lampBottom.position.copy(lightIn);
  grp.add(lampBottom);
  var lightTop = proj.at(T, 0, inner.t + 0.02, D_LIP - 0.10);
  var lampTop = new T.PointLight(0xcfe4f5, tiny ? 2.6 : 3.6, 3.2, 1.5);
  lampTop.position.copy(lightTop);
  grp.add(lampTop);
  api.lights = [lampBottom, lampTop];

  /* Диодные лестницы по стойкам сняты: на снимке рубки световоды
     и индикаторы уже стоят там, где им положено, и вторая гирлянда
     поверх спорила с ними. Ход корабля показывает крупная скорость
     на приборной доске, а не самодельные полоски по краям. */
  var live = [];
  api.live = live;

  /* ── Приёмка ───────────────────────────────────────────
     Доли кадра отдаём наружу: без них любой разговор о размере
     панели превращается в спор на глазок. */
  /* Четыре точки на середине кромок проёма. Полёт проецирует их
     живой камерой и получает настоящие доли кадра - не расчётные,
     а те, что зритель видит. Без такого замера разговор о размере
     панели каждый раз скатывается на глазок. */
  api.probe = [
    proj.at(T, 0, inner.b, D_LIP),
    proj.at(T, 0, inner.t, D_LIP),
    proj.at(T, inner.l, 0, D_LIP),
    proj.at(T, inner.r, 0, D_LIP)
  ];
  api.frameShare = function () {
    return {
      низ: +((1 + inner.b) / 2 * 100).toFixed(1),
      верх: +((1 - inner.t) / 2 * 100).toFixed(1),
      бок: +((1 + inner.l) / 2 * 100).toFixed(1),
      клавишаPx: +keyPx.toFixed(0),
      служебнаяPx: +auxPx.toFixed(0)
    };
  };
  /* Прямоугольник, целиком лежащий внутри проёма.

     Проём восьмиугольный, поэтому габаритная рамка задевает
     срезанные углы: всплывающее окно, положенное по габариту,
     заезжало бы на раму - ровно то, что заказчик запретил
     («окно = экран с голограммами», рама неприкосновенна).
     Ищем вписанный прямоугольник сжатием к середине проёма, пока
     все четыре его угла не окажутся внутри контура. */
  function inPoly(px, py) {
    var c = false;
    for (var k = 0, j = Rin.length - 1; k < Rin.length; j = k++) {
      var a = Rin[k], b = Rin[j];
      if (((a.y > py) !== (b.y > py)) &&
          (px < (b.x - a.x) * (py - a.y) / (b.y - a.y) + a.x)) c = !c;
    }
    return c;
  }
  var midX = (inner.l + inner.r) / 2, midY = (inner.b + inner.t) / 2;
  var safe = { l: inner.l, r: inner.r, b: inner.b, t: inner.t };
  for (var kk = 0; kk < 24; kk++) {
    if (inPoly(safe.l, safe.b) && inPoly(safe.r, safe.b) &&
        inPoly(safe.l, safe.t) && inPoly(safe.r, safe.t)) break;
    safe.l = midX + (safe.l - midX) * 0.965;
    safe.r = midX + (safe.r - midX) * 0.965;
    safe.b = midY + (safe.b - midY) * 0.965;
    safe.t = midY + (safe.t - midY) * 0.965;
  }
  api.safe = safe;
  RC.last = { inner: inner, safe: safe, clip: null };

  /* Контур проёма в долях кадра, готовой строкой для clip-path.

     Прямоугольник тут не годится: проём восьмиугольный, и по
     габариту голограмма всё равно ложится на срезанные углы рамы.
     Отдаём сам контур, слегка поджатый внутрь, - тогда ни одна
     метка, ни одна надпись физически не может выйти на железо. */
  api.clipPath = function (inset) {
    var k = 1 - (inset === undefined ? 0.012 : inset);
    var cxm = (inner.l + inner.r) / 2, cym = (inner.b + inner.t) / 2;
    var parts = [];
    for (var ci = 0; ci < Rin.length; ci++) {
      var px2 = cxm + (Rin[ci].x - cxm) * k;
      var py2 = cym + (Rin[ci].y - cym) * k;
      parts.push(((px2 + 1) / 2 * 100).toFixed(2) + "% " +
                 ((1 - py2) / 2 * 100).toFixed(2) + "%");
    }
    return "polygon(" + parts.join(",") + ")";
  };

  RC.last.clip = api.clipPath();

  api.windowRect = function () {
    return { x: (safe.l + 1) / 2, y: (1 - safe.t) / 2,
             w: (safe.r - safe.l) / 2, h: (safe.t - safe.b) / 2 };
  };
  api.deckRect = function () {
    return { x: 0, y: (1 - inner.b) / 2, w: 1, h: (1 + inner.b) / 2 };
  };

  /* ── Кадр ──────────────────────────────────────────────── */
  var tPrev = 0;
  api.update = function (ts, dt, tele) {
    void dt;
    var t = ts * 0.001;
    tPrev = t;
    /* световод дышит еле заметно: ровное свечение читается пластиком */
    /* Рама дышит собственным свечением: ровная яркость снимка
       читается наклейкой, лёгкое колебание - работающим железом. */
    matFrame.emissiveIntensity = 0.78 + Math.sin(t * 0.6) * 0.035;
    var speed = tele && typeof tele.speed === "number" ? tele.speed : 0;
    if (holo && holo.userData.draw) {
      holo.userData.draw(t);
      /* Дрожь и дыхание: ровно горящая голограмма читается
         наклейкой, а не лучом */
      holo.material.opacity = 0.80 + Math.sin(t * 1.7) * 0.08 +
        (Math.sin(t * 21.3) > 0.94 ? -0.22 : 0);
      holo.position.z = holo.userData.z0 !== undefined
        ? holo.userData.z0 + Math.sin(t * 0.9) * 0.004
        : (holo.userData.z0 = holo.position.z, holo.position.z);
    }
    for (var mi = 0; mi < mods.length; mi++) {
      var M = mods[mi];
      if (ts - M.last < M.every) continue;
      M.last = ts;
      M.draw(M.ctx, M.w, M.h, t, tele);
      M.tex.needsUpdate = true;
    }
    for (var k = 0; k < live.length; k++) {
      var L = live[k];
      if (!L.mesh.instanceColor) continue;
      var c = api._c || (api._c = new T.Color());
      for (var j = 0; j < L.n; j++) {
        var on;
        if (L.kind === "thrust") {
          on = (j / L.n) < speed ? 1 : 0.06;
          if (Math.abs(j / L.n - speed) < 1 / L.n) on = 0.55 + 0.45 * Math.sin(t * 9);
          c.setRGB(0.32 * on, 0.80 * on, 1.0 * on);
        } else {
          var ph = j * 1.7;
          on = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin(t * (1.1 + j * 0.17) + ph));
          c.setRGB(0.55 * on, 1.0 * on, 0.58 * on);
        }
        L.mesh.setColorAt(j, c);
      }
      L.mesh.instanceColor.needsUpdate = true;
    }
  };
  void tPrev;

  return api;
}

RC.build = build;
g.RC_CONSOLE = RC;
Object.assign(RC, {
  EYE: EYE, R: R_WALL, CAM_WIN: CAM_WIN,
  WIN_Y0: WIN_Y0, WIN_Y1: WIN_Y1, WIN_HALF: WIN_HALF,
  F_BOTTOM: F_BOTTOM, F_TOP: F_TOP, F_SIDE: F_SIDE
});

})(window);
