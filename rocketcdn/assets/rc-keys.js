/* ═══════════════════════════════════════════════════════════
   Rocket CDN · лица клавиш пульта

   Почему они рисуются, а не снимаются, хотя рама - наоборот.

   Раму снимаем камерой: там сложная поверхность, которую подделать
   кодом нельзя - зерно металла, затёртости, свет, считанный целиком.
   С клавишей всё наоборот. Это стеклянная плитка с иконкой: подделывать
   нечего, зато нужна безупречная геометрия. Генератор её и завалил -
   заказчик написал коротко: «кнопки кривые обрезанные». Иконки выходили
   разного размера, сетка неровная, нарезка шла по замеренным на глаз
   местам, и половина лиц обрезалась по краю.

   Здесь этого не может случиться. Каждая иконка это путь по формулам,
   плитка ровно квадратная, поле одинаковое, подпись по центру. Холст
   берётся под плотность экрана, поэтому на телефоне с тройной
   плотностью иконка остаётся острой.

   Цвет - циан #42B2DC. Лайм был ошибкой: это цвет OKO, а не Rocket CDN.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document;

/* Бренд Rocket CDN, взято из style.css */
var CYAN = "#42B2DC";
var CYAN_HI = "#7BD1EC";
var PALE = "#CFE9F5";

/* Двенадцать команд: имя, подпись под иконкой, рисунок иконки.
   Порядок совпадает с rc-flight, менять нельзя. */
var KEYS = [
  { имя: "КУРС", en: "COURSE", рисунок: "курс" },
  { имя: "СКАН", en: "SCAN", рисунок: "скан" },
  { имя: "УЗЕЛ", en: "NODE", рисунок: "узел" },
  { имя: "ЗАЛП", en: "FIRE", рисунок: "залп" },
  { имя: "АВТО", en: "AUTO", рисунок: "авто" },
  { имя: "СТОП", en: "STOP", рисунок: "стоп" },
  { имя: "ТЯГА", en: "THRUST", рисунок: "тяга" },
  { имя: "СЕТЬ", en: "MAP", рисунок: "сеть" },
  { имя: "БЛИЖЕ", en: "ZOOM IN", рисунок: "ближе" },
  { имя: "ДАЛЬШЕ", en: "ZOOM OUT", рисунок: "дальше" },
  { имя: "КАДР", en: "FRAME", рисунок: "кадр" },
  { имя: "СПРАВКА", en: "HELP", рисунок: "справка" }
];

/* ══════════════════════════════════════════════════════════
   Иконки

   Каждая рисуется в квадрате со стороной 1 от точки (0,0). Толщина
   линии задаётся снаружи, чтобы на всех размерах она была одинаковой
   долей плитки. Ничего кроме путей: заливок и градиентов внутри
   иконки нет, иначе на маленьком размере она превращается в кляксу.
   ══════════════════════════════════════════════════════════ */
var ICON = {
  /* Курс: стрелка вперёд по дуге орбиты */
  курс: function (c, s) {
    c.beginPath();
    c.arc(0.5 * s, 0.86 * s, 0.44 * s, Math.PI * 1.18, Math.PI * 1.82);
    c.stroke();
    c.beginPath();
    c.moveTo(0.5 * s, 0.14 * s);
    c.lineTo(0.5 * s, 0.62 * s);
    c.stroke();
    c.beginPath();
    c.moveTo(0.34 * s, 0.30 * s);
    c.lineTo(0.5 * s, 0.14 * s);
    c.lineTo(0.66 * s, 0.30 * s);
    c.stroke();
  },
  /* Скан: три дуги радара из угла */
  скан: function (c, s) {
    var i;
    for (i = 1; i <= 3; i++) {
      c.beginPath();
      c.arc(0.5 * s, 0.5 * s, 0.13 * s * i, -Math.PI * 0.78, -Math.PI * 0.22);
      c.stroke();
    }
    c.beginPath();
    c.arc(0.5 * s, 0.5 * s, 0.05 * s, 0, Math.PI * 2);
    c.stroke();
  },
  /* Узел сети: точка с тремя отводами */
  узел: function (c, s) {
    var pts = [[0.5, 0.14], [0.16, 0.74], [0.84, 0.74]];
    var i;
    for (i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(0.5 * s, 0.5 * s);
      c.lineTo(pts[i][0] * s, pts[i][1] * s);
      c.stroke();
      c.beginPath();
      c.arc(pts[i][0] * s, pts[i][1] * s, 0.09 * s, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.arc(0.5 * s, 0.5 * s, 0.11 * s, 0, Math.PI * 2);
    c.stroke();
  },
  /* Залп: прицел с перекрестием */
  залп: function (c, s) {
    c.beginPath();
    c.arc(0.5 * s, 0.5 * s, 0.30 * s, 0, Math.PI * 2);
    c.stroke();
    var d = [[0.5, 0.06, 0.5, 0.26], [0.5, 0.74, 0.5, 0.94],
             [0.06, 0.5, 0.26, 0.5], [0.74, 0.5, 0.94, 0.5]];
    for (var i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(d[i][0] * s, d[i][1] * s);
      c.lineTo(d[i][2] * s, d[i][3] * s);
      c.stroke();
    }
    c.beginPath();
    c.arc(0.5 * s, 0.5 * s, 0.06 * s, 0, Math.PI * 2);
    c.fill();
  },
  /* Автопилот: руль с точкой посередине */
  авто: function (c, s) {
    c.beginPath();
    c.arc(0.5 * s, 0.5 * s, 0.34 * s, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(0.5 * s, 0.5 * s, 0.10 * s, 0, Math.PI * 2);
    c.stroke();
    var a;
    for (a = 0; a < 3; a++) {
      var t = -Math.PI / 2 + a * Math.PI * 2 / 3;
      c.beginPath();
      c.moveTo((0.5 + Math.cos(t) * 0.10) * s, (0.5 + Math.sin(t) * 0.10) * s);
      c.lineTo((0.5 + Math.cos(t) * 0.34) * s, (0.5 + Math.sin(t) * 0.34) * s);
      c.stroke();
    }
  },
  /* Стоп: квадрат */
  стоп: function (c, s) {
    var r = 0.05 * s, x = 0.24 * s, w = 0.52 * s;
    c.beginPath();
    c.moveTo(x + r, x);
    c.lineTo(x + w - r, x);
    c.quadraticCurveTo(x + w, x, x + w, x + r);
    c.lineTo(x + w, x + w - r);
    c.quadraticCurveTo(x + w, x + w, x + w - r, x + w);
    c.lineTo(x + r, x + w);
    c.quadraticCurveTo(x, x + w, x, x + w - r);
    c.lineTo(x, x + r);
    c.quadraticCurveTo(x, x, x + r, x);
    c.closePath();
    c.stroke();
  },
  /* Тяга: сопло с факелом */
  тяга: function (c, s) {
    c.beginPath();
    c.moveTo(0.34 * s, 0.12 * s);
    c.lineTo(0.66 * s, 0.12 * s);
    c.lineTo(0.76 * s, 0.52 * s);
    c.lineTo(0.24 * s, 0.52 * s);
    c.closePath();
    c.stroke();
    var i;
    for (i = 0; i < 3; i++) {
      var x = (0.36 + i * 0.14) * s;
      c.beginPath();
      c.moveTo(x, 0.60 * s);
      c.lineTo(x, (0.78 + (i === 1 ? 0.12 : 0)) * s);
      c.stroke();
    }
  },
  /* Сеть: точки на сетке */
  сеть: function (c, s) {
    var i, j;
    for (i = 0; i < 3; i++) {
      for (j = 0; j < 3; j++) {
        c.beginPath();
        c.arc((0.24 + i * 0.26) * s, (0.24 + j * 0.26) * s, 0.055 * s, 0, Math.PI * 2);
        if (i === 1 && j === 1) c.fill(); else c.stroke();
      }
    }
  },
  /* Ближе: лупа с плюсом */
  ближе: function (c, s) { lupa(c, s, 1); },
  /* Дальше: лупа с минусом */
  дальше: function (c, s) { lupa(c, s, -1); },
  /* Кадр: уголки рамки */
  кадр: function (c, s) {
    var d = 0.16, e = 0.34;
    var corners = [[d, e, d, d, e, d], [1 - d, e, 1 - d, d, 1 - e, d],
                   [d, 1 - e, d, 1 - d, e, 1 - d], [1 - d, 1 - e, 1 - d, 1 - d, 1 - e, 1 - d]];
    for (var i = 0; i < 4; i++) {
      var k = corners[i];
      c.beginPath();
      c.moveTo(k[0] * s, k[1] * s);
      c.lineTo(k[2] * s, k[3] * s);
      c.lineTo(k[4] * s, k[5] * s);
      c.stroke();
    }
  },
  /* Справка: вопрос */
  справка: function (c, s) {
    c.beginPath();
    c.arc(0.5 * s, 0.36 * s, 0.17 * s, Math.PI * 0.92, Math.PI * 0.30);
    c.stroke();
    c.beginPath();
    c.moveTo(0.5 * s, 0.53 * s);
    c.lineTo(0.5 * s, 0.66 * s);
    c.stroke();
    c.beginPath();
    c.arc(0.5 * s, 0.82 * s, 0.055 * s, 0, Math.PI * 2);
    c.fill();
  }
};

function lupa(c, s, znak) {
  c.beginPath();
  c.arc(0.44 * s, 0.44 * s, 0.26 * s, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.moveTo(0.63 * s, 0.63 * s);
  c.lineTo(0.86 * s, 0.86 * s);
  c.stroke();
  c.beginPath();
  c.moveTo(0.30 * s, 0.44 * s);
  c.lineTo(0.58 * s, 0.44 * s);
  c.stroke();
  if (znak > 0) {
    c.beginPath();
    c.moveTo(0.44 * s, 0.30 * s);
    c.lineTo(0.44 * s, 0.58 * s);
    c.stroke();
  }
}

/* ══════════════════════════════════════════════════════════
   Атлас лиц

   Двенадцать клеток четыре на три плюс тринадцатая клетка ровного
   тёмного стекла - она уходит на бока и низ объёмной крышки.

   Размер клетки считаем от того, сколько места клавиша займёт на
   экране, и умножаем на плотность. Иначе на телефоне с тройной
   плотностью атлас в 256 точек растягивается втрое, и подпись
   расползается - ровно то мыло, за которое влетело.
   ══════════════════════════════════════════════════════════ */
var COLS = 4;
var ROWS = 4;

function tile(c, s, item, ru) {
  /* Стекло: плитка темнее к низу, по краю тонкая светлая кромка */
  var gr = c.createLinearGradient(0, 0, 0, s);
  gr.addColorStop(0, "#1b2530");
  gr.addColorStop(0.55, "#131a23");
  gr.addColorStop(1, "#0c1119");
  c.fillStyle = gr;
  var m = s * 0.045, r = s * 0.14, w = s - m * 2;
  round(c, m, m, w, w, r);
  c.fill();

  /* Отсвет по верхней кромке: стекло, а не матовый пластик */
  var sh = c.createLinearGradient(0, m, 0, m + w * 0.42);
  sh.addColorStop(0, "rgba(207,233,245,0.16)");
  sh.addColorStop(1, "rgba(207,233,245,0)");
  c.fillStyle = sh;
  round(c, m, m, w, w * 0.42, r);
  c.fill();

  /* Кромка */
  c.strokeStyle = "rgba(123,209,236,0.30)";
  c.lineWidth = Math.max(1, s * 0.012);
  round(c, m, m, w, w, r);
  c.stroke();

  /* Иконка и подпись стоят В РЯД, а не одна под другой.

     Пульт наклонён от камеры, и по вертикали лицо клавиши сжимается
     перспективой почти вдвое. Подпись лежала внизу плитки и от неё
     на экране оставалась пара пикселей: заказчик видел одни значки и
     написал прямо - «для чего какая кнопка вообще не понятно», а
     иконки без слова назвал неподходящими. Наклон идёт вокруг
     горизонтальной оси, значит ширина не страдает: кладём значок
     слева, слово справа, и слово читается при любом наклоне. */
  var icon = ICON[item["рисунок"]];
  c.save();
  var pad = s * 0.335;
  var side = s - pad * 2;
  c.translate(s * 0.055, (s - side) / 2);
  c.lineWidth = Math.max(1.4, side * 0.075);
  c.lineCap = "round";
  c.lineJoin = "round";
  c.strokeStyle = CYAN_HI;
  c.fillStyle = CYAN_HI;
  c.shadowColor = CYAN;
  c.shadowBlur = side * 0.22;
  if (icon) icon(c, side * 0.86);
  c.restore();

  /* Подпись: заказчик просил понимать, что будет при нажатии.
     Под текстом тёмная плашка: без неё подпись тонула в светлой
     полосе пульта, когда плитка стоит над бликом. */
  var label = ru ? item["имя"] : item.en;
  c.save();
  c.shadowColor = "rgba(8,11,16,0.9)";
  c.shadowBlur = s * 0.05;
  c.fillStyle = PALE;
  c.textAlign = "left";
  c.textBaseline = "middle";
  /* Кегль подгоняем под ширину плитки, а не берём по числу букв.

     По числу букв не работает: «ДАЛЬШЕ» и «СПРАВКА» разной ширины
     при одинаковой длине, а на телефоне плитка вдвое уже, чем на
     мониторе. Меряем и ужимаем, пока не влезет в четыре пятых
     стороны - тогда подпись читается на любом устройстве и никогда
     не выходит за плитку. */
  /* Слово занимает правые две трети плитки и берёт всю высоту, какую
     может: чем крупнее буква, тем меньше от неё отнимает наклон. */
  var текстX = s * 0.44;
  var size = s * 0.185;
  var limit = s - текстX - s * 0.07;
  var font = function (px) {
    return "600 " + px.toFixed(1) + "px 'Golos Text', 'Manrope', system-ui, sans-serif";
  };
  c.font = font(size);
  for (var guard = 0; guard < 12 && c.measureText(label).width > limit; guard++) {
    size *= 0.92;
    c.font = font(size);
  }
  c.fillText(label, текстX, s * 0.52);
  c.restore();
}

function round(c, x, y, w, h, r) {
  r = Math.min(r, Math.min(w, h) / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

/* cell - сколько точек экрана займёт одна клавиша по стороне.
   Отсюда считается размер клетки атласа. */
function atlas(cell, ru) {
  var dpr = Math.min(3, g.devicePixelRatio || 1);
  var s = Math.max(128, Math.min(512, Math.round(cell * dpr * 1.15)));
  var cv = doc.createElement("canvas");
  cv.width = s * COLS;
  cv.height = s * ROWS;
  var c = cv.getContext("2d");
  c.fillStyle = "#080b10";
  c.fillRect(0, 0, cv.width, cv.height);
  for (var i = 0; i < KEYS.length; i++) {
    c.save();
    c.translate((i % COLS) * s, ((i / COLS) | 0) * s);
    tile(c, s, KEYS[i], ru);
    c.restore();
  }
  /* Тринадцатая клетка: ровное тёмное стекло на бока крышки */
  var gr = c.createLinearGradient(0, (ROWS - 1) * s, 0, ROWS * s);
  gr.addColorStop(0, "#141a22");
  gr.addColorStop(1, "#0a0e14");
  c.fillStyle = gr;
  c.fillRect(0, (ROWS - 1) * s, cv.width, s);
  return { canvas: cv, cols: COLS, rows: ROWS, cell: s };
}

g.RC_KEYS = {
  atlas: atlas,
  KEYS: KEYS,
  /* Рисунок иконки отдельно от атласа: пульт рисует их прямо в
     нишах плиты, без промежуточной текстуры. Путь один и тот же,
     значит клавиша в рубке и клавиша в списке команд не разъедутся. */
  icon: function (name, c, s) {
    var f = ICON[name];
    if (f) f(c, s);
    return !!f;
  },
  COLS: COLS,
  ROWS: ROWS,
  CYAN: CYAN,
  name: function (i, ru) {
    var k = KEYS[i];
    return k ? (ru ? k["имя"] : k.en) : "";
  }
};
})(window);
