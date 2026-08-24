/* ═══════════════════════════════════════════════════════════
   Rocket CDN · приборы пульта

   Здесь решается то, на что заказчик показывал пальцем несколько раз
   подряд: «кнопки кривые, выглядят как вклейка хуйни в реализм».

   Он был прав, и причина не в аккуратности. Сгенерированная клавиша -
   это снимок предмета, снятого своим светом: у него свои блики, своя
   тень, свой ракурс. Положи такой предмет на панель, снятую другим
   светом, и глаз мгновенно видит две картинки вместо одной. Ровняй
   сколько угодно - останется наклейка.

   Поэтому здесь не кладут предметов. Здесь рисуют СВЕТ. Плита из
   кабинета приходит с пустыми нишами - чистый металл, ничего в них
   нет. Слой светится поверх металла в границах ниши: подсветка
   клавиши, свечение экрана, блик по фаске. Свет складывается с
   поверхностью (режим screen), а не заслоняет её: сквозь него видно
   и зерно металла, и его собственную тень. Так работает настоящая
   подсветка, и так же ставят интерфейсы в кино.

   Из этого следует всё остальное:

   · Ниши - четырёхугольники, а не прямоугольники. Пульт стоит под
     углом, ниши на кадре сходятся. Свет ложится по той же сходимости,
     иначе получается ровно та наклейка, которую заказчик отверг.
   · Рисуем полосами: четырёхугольник режется на два десятка полосок,
     каждая кладётся своим преобразованием. Двух треугольников мало -
     по диагонали виден излом.
   · Холст живёт в точках устройства, не в CSS-точках: на телефоне с
     тройной плотностью иначе получится мыло.
   · Имя класса своё, rcf-instr. Первым было rcf-deck - и оно уже
     занято панелью управления разметки. Холст молча нахватал чужих
     правил: фон, перспективу, свой слой, и приборы пропали с экрана
     при живом и правильном рисунке. Проверка это и показала: дамп
     холста был верен, а на экране пусто.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document;
var ЦИАН = "#42B2DC";
var СВЕТЛО = "#7BD1EC";
var БЛЕДНО = "#CFE9F5";

/* Полос на нишу. Двадцать четыре хватает: излом становится меньше
   точки экрана даже на большой ниши широкого кадра. */
var ПОЛОС = 16;

/* ── Раскладка кадра ─────────────────────────────────────────
   Плита лежит картинкой с object-fit: cover. Чтобы ниша попала
   ровно туда, где она на снимке, повторяем ту же арифметику:
   масштаб по большей нужде, остаток уходит за края поровну. */
function покрытие(meta, W, H) {
  var k = Math.max(W / meta.w, H / meta.h);
  return { k: k, dw: meta.w * k, dh: meta.h * k,
           ox: (W - meta.w * k) / 2, oy: (H - meta.h * k) / 2 };
}

function точка(п, u, v) {
  return { x: п.ox + u * п.dw, y: п.oy + v * п.dh };
}

function угол(п, q) {
  var out = [];
  for (var i = 0; i < 4; i++) out.push(точка(п, q[i][0], q[i][1]));
  return out;
}

/* ── Наложение картинки на четырёхугольник ───────────────────
   Полоса за полосой. У полосы верх и низ считаются по долям вдоль
   боковых рёбер, дальше это почти параллелограмм, и он кладётся
   одним преобразованием без искажения. */
function влить(c, src, q, sw, sh) {
  var A = q[0], B = q[1], C = q[2], D = q[3];
  for (var i = 0; i < ПОЛОС; i++) {
    var t0 = i / ПОЛОС, t1 = (i + 1) / ПОЛОС;
    var l0x = A.x + (D.x - A.x) * t0, l0y = A.y + (D.y - A.y) * t0;
    var r0x = B.x + (C.x - B.x) * t0, r0y = B.y + (C.y - B.y) * t0;
    var l1x = A.x + (D.x - A.x) * t1, l1y = A.y + (D.y - A.y) * t1;
    var sy = t0 * sh, sd = (t1 - t0) * sh;
    /* Полосы стыкуются встык, без нахлёста. Нахлёст казался лекарством
       от шва, а давал вторую беду: на стыке краска ложилась дважды и по
       экранам шли светлые ленты. Шов лечится не нахлёстом, а тем, что
       холст складывает свет: два полупрозрачных края на общей границе
       дают ровно единицу. Режим сложения ставится один раз на весь
       заход, снаружи. */
    c.save();
    c.setTransform((r0x - l0x) / sw, (r0y - l0y) / sw,
                   (l1x - l0x) / sd, (l1y - l0y) / sd, l0x, l0y);
    c.drawImage(src, 0, sy, sw, sd, 0, 0, sw, sd);
    c.restore();
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
}

/* Точка внутри четырёхугольника: по знаку векторного произведения
   на всех четырёх рёбрах. Нужна для попадания пальцем по клавише. */
function внутри(q, x, y) {
  var знак = 0;
  for (var i = 0; i < 4; i++) {
    var a = q[i], b = q[(i + 1) % 4];
    var v = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (v === 0) continue;
    var s = v > 0 ? 1 : -1;
    if (!знак) знак = s;
    else if (знак !== s) return false;
  }
  return true;
}

/* Поджимает четырёхугольник к его середине.

   Нужно затем, что ниша на плите имеет фаску, и свет, положенный
   впритык к её габариту, ложится на эту фаску и читается вылезшим за
   край. Заказчик увидел это сразу: «немного криво выходит за рамки».
   Поджатие на несколько сотых оставляет между светом и кромкой поле,
   и клавиша сидит в нише, а не наезжает на неё. */
function ужать(q, d) {
  var cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
  var cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  var out = [];
  for (var i = 0; i < 4; i++) {
    out.push([cx + (q[i][0] - cx) * (1 - d), cy + (q[i][1] - cy) * (1 - d)]);
  }
  return out;
}

/* Делит полосу на равные места под клавиши, сохраняя сходимость. */
function места(q, n, зазор) {
  var out = [];
  for (var i = 0; i < n; i++) {
    var a = i / n, b = (i + 1) / n;
    out.push([
      [q[0][0] + (q[1][0] - q[0][0]) * a, q[0][1] + (q[1][1] - q[0][1]) * a],
      [q[0][0] + (q[1][0] - q[0][0]) * b, q[0][1] + (q[1][1] - q[0][1]) * b],
      [q[3][0] + (q[2][0] - q[3][0]) * b, q[3][1] + (q[2][1] - q[3][1]) * b],
      [q[3][0] + (q[2][0] - q[3][0]) * a, q[3][1] + (q[2][1] - q[3][1]) * a]
    ]);
    out[i] = ужать(out[i], зазор == null ? 0.14 : зазор);
  }
  return out;
}

/* ══════════════════════════════════════════════════════════
   Что рисуем внутри ниш

   Всё чёрное здесь значит «света нет»: холст ниши кладётся поверх
   металла в режиме screen, и чёрное просто оставляет металл как он
   есть. Поэтому фона не рисуем вовсе - только линии и свечение.
   ══════════════════════════════════════════════════════════ */

function стекло(c, w, h, сила) {
  /* Прибор это не рисунок на металле, а подсвеченное стекло. Ровный
     тихий подсвет по всей нише даёт разницу между «нарисовали линии
     поверх» и «под панелью что-то горит». */
  var gr = c.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5,
                                  Math.max(w, h) * 0.72);
  gr.addColorStop(0, "rgba(40,120,155," + (0.34 * сила).toFixed(3) + ")");
  gr.addColorStop(1, "rgba(18,60,84,0)");
  c.fillStyle = gr;
  c.fillRect(0, 0, w, h);
}

function рамка(c, w, h, r, сила) {
  /* Тонкая световая нить по краю ниши: так выглядит утопленная в
     панель подсветка. Она же собирает форму, если содержимое тихое. */
  c.strokeStyle = "rgba(66,178,220," + сила + ")";
  c.lineWidth = Math.max(1, h * 0.012);
  c.beginPath();
  var x = c.lineWidth, y = c.lineWidth, ww = w - x * 2, hh = h - y * 2;
  c.moveTo(x + r, y);
  c.arcTo(x + ww, y, x + ww, y + hh, r);
  c.arcTo(x + ww, y + hh, x, y + hh, r);
  c.arcTo(x, y + hh, x, y, r);
  c.arcTo(x, y, x + ww, y, r);
  c.closePath();
  c.stroke();
}

var ПРИБОР = {
  /* Навигатор: широкая ниша просит горизонтального прибора. Круглый
     радар в полосе четыре к одному тонет в пустом стекле, поэтому
     здесь лента курса, линия горизонта и две шкалы по краям - ровно
     то, что занимает ширину делом. */
  навигатор: function (c, w, h, s) {
    стекло(c, w, h, 1);
    рамка(c, w, h, h * 0.12, 0.34);
    var л = w * 0.13, п = w * 0.87, cy = h * 0.56;

    /* Лента курса: деления бегут, крупное под носом корабля. */
    var к = (s.курс || 0);
    var шаг = w * 0.075;
    c.save();
    c.beginPath(); c.rect(л, h * 0.10, п - л, h * 0.20); c.clip();
    for (var i = -6; i <= 6; i++) {
      var v = Math.round(к / 10) * 10 + i * 10;
      var x = w * 0.5 + (v - к) / 10 * шаг;
      var б = (v % 30 === 0);
      c.strokeStyle = "rgba(66,178,220," + (б ? 0.85 : 0.42) + ")";
      c.lineWidth = Math.max(1, h * 0.016);
      c.beginPath();
      c.moveTo(x, h * 0.13); c.lineTo(x, h * (б ? 0.26 : 0.21));
      c.stroke();
    }
    c.restore();
    c.strokeStyle = "rgba(207,233,245,0.9)";
    c.lineWidth = Math.max(1, h * 0.02);
    c.beginPath();
    c.moveTo(w * 0.5, h * 0.06); c.lineTo(w * 0.5 - h * 0.05, h * 0.005 + h * 0.10);
    c.lineTo(w * 0.5 + h * 0.05, h * 0.105); c.closePath();
    c.stroke();

    /* Горизонт с лесенкой тангажа, наклонённый по крену. */
    c.save();
    c.beginPath(); c.rect(w * 0.26, h * 0.32, w * 0.48, h * 0.50); c.clip();
    c.translate(w * 0.5, cy);
    c.rotate(s.крен || 0);
    var сдв = (s.тангаж || 0) * h * 0.9;
    c.strokeStyle = "rgba(66,178,220,0.75)";
    c.lineWidth = Math.max(1, h * 0.020);
    c.beginPath(); c.moveTo(-w * 0.24, сдв); c.lineTo(w * 0.24, сдв); c.stroke();
    c.lineWidth = Math.max(1, h * 0.014);
    c.strokeStyle = "rgba(66,178,220,0.42)";
    for (var j = -2; j <= 2; j++) {
      if (!j) continue;
      var y = сдв + j * h * 0.18;
      var д = w * 0.10 - Math.abs(j) * w * 0.022;
      c.beginPath(); c.moveTo(-д, y); c.lineTo(д, y); c.stroke();
    }
    c.restore();

    /* Нос корабля поверх горизонта: неподвижная метка. */
    c.strokeStyle = "rgba(207,233,245,0.95)";
    c.lineWidth = Math.max(1, h * 0.024);
    c.beginPath();
    c.moveTo(w * 0.5 - w * 0.055, cy); c.lineTo(w * 0.5 - w * 0.018, cy);
    c.moveTo(w * 0.5 + w * 0.018, cy); c.lineTo(w * 0.5 + w * 0.055, cy);
    c.stroke();

    /* Две шкалы по краям: скорость слева, высота справа. */
    полоска(c, л, h * 0.34, w * 0.048, h * 0.40, s.скорость, "СКОР");
    полоска(c, п - w * 0.048, h * 0.34, w * 0.048, h * 0.40, s.высота, "ВЫС");
  },

  /* Радар: круговая развёртка с метками. Читается мгновенно и на
     телефоне, потому что форма круглая, а не мелкий текст. */
  радар: function (c, w, h, s) {
    стекло(c, w, h, 1);
    var cx = w * 0.5, cy = h * 0.47, R = Math.min(w * 0.30, h * 0.42);
    рамка(c, w, h, h * 0.10, 0.30);

    c.strokeStyle = "rgba(66,178,220,0.42)";
    c.lineWidth = Math.max(1, R * 0.018);
    for (var i = 1; i <= 3; i++) {
      c.beginPath(); c.arc(cx, cy, R * i / 3, 0, 6.2832); c.stroke();
    }
    c.beginPath();
    c.moveTo(cx - R, cy); c.lineTo(cx + R, cy);
    c.moveTo(cx, cy - R); c.lineTo(cx, cy + R);
    c.stroke();

    /* Луч развёртки: клин с затуханием назад по ходу. */
    var a = s.фаза * 6.2832;
    var gr = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, "rgba(123,209,236,0.42)");
    gr.addColorStop(1, "rgba(66,178,220,0)");
    c.save();
    c.translate(cx, cy); c.rotate(a);
    c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, -0.55, 0); c.closePath();
    c.fillStyle = gr; c.fill();
    c.restore();

    c.strokeStyle = "rgba(207,233,245,0.85)";
    c.lineWidth = Math.max(1, R * 0.02);
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    c.stroke();

    /* Отметки: то, что рядом с кораблём. Пока целей нет - тихо. */
    var м = s.метки || [];
    for (var j = 0; j < м.length; j++) {
      var p = м[j];
      var d = ((a - p.a) % 6.2832 + 6.2832) % 6.2832;
      var ярко = Math.max(0.12, 1 - d / 2.2);
      c.fillStyle = "rgba(207,233,245," + ярко.toFixed(3) + ")";
      c.beginPath();
      c.arc(cx + Math.cos(p.a) * R * p.r, cy + Math.sin(p.a) * R * p.r,
            R * 0.035, 0, 6.2832);
      c.fill();
    }
    подпись(c, w, h, "ОБЗОР", s);
  },

  /* Курс: лесенка тангажа и лента курса. Показывает, куда смотрит
     нос корабля, без единой цифры мельче читаемой. */
  курс: function (c, w, h, s) {
    стекло(c, w, h, 0.85);
    рамка(c, w, h, h * 0.14, 0.26);
    var cx = w * 0.5, cy = h * 0.50, R = h * 0.40;
    c.save();
    c.beginPath(); c.rect(w * 0.08, h * 0.18, w * 0.84, h * 0.62); c.clip();
    c.translate(cx, cy);
    c.rotate(s.крен || 0);
    var шаг = R * 0.55, сдв = (s.тангаж || 0) * R * 2;
    c.strokeStyle = "rgba(66,178,220,0.70)";
    c.lineWidth = Math.max(1, h * 0.024);
    for (var i = -3; i <= 3; i++) {
      var y = i * шаг + сдв;
      var д = i === 0 ? w * 0.30 : w * 0.14 - Math.abs(i) * w * 0.014;
      c.globalAlpha = i === 0 ? 1 : 0.55;
      c.beginPath(); c.moveTo(-д, y); c.lineTo(д, y); c.stroke();
    }
    c.globalAlpha = 1;
    c.restore();

    /* Нос корабля: неподвижная метка поверх лесенки. */
    c.strokeStyle = "rgba(207,233,245,0.92)";
    c.lineWidth = Math.max(1, h * 0.022);
    c.beginPath();
    c.moveTo(cx - w * 0.10, cy); c.lineTo(cx - w * 0.03, cy);
    c.moveTo(cx + w * 0.03, cy); c.lineTo(cx + w * 0.10, cy);
    c.moveTo(cx, cy - h * 0.05); c.lineTo(cx, cy + h * 0.05);
    c.stroke();
    подпись(c, w, h, "КУРС", s);
  },

  /* Тяга: три полосы состояния. Полоса честнее цифры: заполнение
     видно боковым зрением, читать не нужно. */
  тяга: function (c, w, h, s) {
    стекло(c, w, h, 0.85);
    рамка(c, w, h, h * 0.14, 0.26);
    var ряд = [["ТЯГА", s.тяга], ["ЩИТ", s.щит], ["КОРПУС", s.корпус]];
    var x0 = w * 0.10, x1 = w * 0.90, hh = h * 0.10;
    for (var i = 0; i < 3; i++) {
      var y = h * (0.30 + i * 0.235);
      var v = Math.max(0, Math.min(1, ряд[i][1] == null ? 0.6 : ряд[i][1]));
      c.strokeStyle = "rgba(66,178,220,0.34)";
      c.lineWidth = Math.max(1, h * 0.010);
      c.strokeRect(x0, y, x1 - x0, hh);
      var gr = c.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, "rgba(66,178,220,0.55)");
      gr.addColorStop(1, "rgba(123,209,236,0.95)");
      c.fillStyle = gr;
      c.fillRect(x0 + hh * 0.16, y + hh * 0.2, (x1 - x0 - hh * 0.32) * v, hh * 0.6);
      var р = Math.max(6, h * 0.085);
      c.font = "700 " + р + "px Montserrat, system-ui, sans-serif";
      c.fillStyle = "rgba(66,178,220,0.62)";
      c.textAlign = "left";
      c.textBaseline = "bottom";
      c.fillText(ряд[i][0], x0, y - h * 0.012);
    }
  }
};

/* Вертикальная шкала у края навигатора. */
function полоска(c, x, y, w, h, v, t) {
  v = Math.max(0, Math.min(1, v == null ? 0.5 : v));
  c.strokeStyle = "rgba(66,178,220,0.34)";
  c.lineWidth = Math.max(1, w * 0.10);
  c.strokeRect(x, y, w, h);
  var gr = c.createLinearGradient(0, y + h, 0, y);
  gr.addColorStop(0, "rgba(66,178,220,0.55)");
  gr.addColorStop(1, "rgba(123,209,236,0.95)");
  c.fillStyle = gr;
  c.fillRect(x + w * 0.2, y + h * (1 - v) + w * 0.2, w * 0.6, h * v - w * 0.4);
  var р = Math.max(7, w * 0.62);
  c.font = "700 " + р + "px Montserrat, system-ui, sans-serif";
  c.fillStyle = "rgba(66,178,220,0.62)";
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  c.fillText(t, x + w / 2, y + h + р * 1.05);
}

/* Подпись прибора: мелко, у нижнего края, чтобы не спорить с
   содержимым. Шрифт берём тот же, что на сайте. */
function подпись(c, w, h, t, s) {
  if (!s.подписи) return;
  /* Заголовок ставим внутрь, к левому верхнему углу. Снизу по центру
     он ложился ровно на кромку ниши и обрезался - та самая обрезанная
     подпись, за которую пульт уже ругали. */
  var р = Math.max(7, h * 0.11);
  c.font = "700 " + р + "px Montserrat, system-ui, sans-serif";
  c.fillStyle = "rgba(66,178,220,0.62)";
  c.textAlign = "left";
  c.textBaseline = "top";
  c.fillText(t, w * 0.075, h * 0.085);
}

/* ── Клавиша ─────────────────────────────────────────────────
   Не предмет, а подсвеченное место: контур ниши, значок и подпись.
   Нажатие не двигает клавишу, а поднимает свет - так ведёт себя
   настоящая ёмкостная панель, и никакого сдвига картинки не нужно. */
function клавиша(c, w, h, k, сила, ru) {
  var r = Math.min(w, h) * 0.16;
  c.strokeStyle = "rgba(66,178,220," + (0.22 + сила * 0.62).toFixed(3) + ")";
  c.lineWidth = Math.max(1, Math.min(w, h) * 0.045);
  c.beginPath();
  var x = c.lineWidth, y = c.lineWidth, ww = w - x * 2, hh = h - y * 2;
  c.moveTo(x + r, y);
  c.arcTo(x + ww, y, x + ww, y + hh, r);
  c.arcTo(x + ww, y + hh, x, y + hh, r);
  c.arcTo(x, y + hh, x, y, r);
  c.arcTo(x, y, x + ww, y, r);
  c.closePath();
  c.stroke();

  if (сила > 0.01) {
    /* Нажатую клавишу заливаем светом: он растекается от центра,
       как подсветка под стеклом, а не красит плоско. */
    var gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.62);
    gr.addColorStop(0, "rgba(123,209,236," + (0.30 * сила).toFixed(3) + ")");
    gr.addColorStop(1, "rgba(66,178,220,0)");
    c.fillStyle = gr;
    c.fill();
  }

  /* Значок: путь из rc-keys, чтобы клавиша в рубке и в списке
     команд были одним и тем же рисунком. */
  var сз = Math.min(w, h) * 0.42;
  var K = g.RC_KEYS;
  if (K && K.icon) {
    c.save();
    c.translate((w - сз) / 2, h * 0.42 - сз * 0.58);
    c.strokeStyle = "rgba(207,233,245," + (0.60 + сила * 0.40).toFixed(3) + ")";
    c.fillStyle = c.strokeStyle;
    c.lineWidth = сз * 0.09;
    c.lineCap = "round";
    c.lineJoin = "round";
    K.icon(k["рисунок"], c, сз);
    c.restore();
  }

  var имя = ru ? k["имя"] : k.en;
  var р = Math.max(6, h * 0.145);
  c.font = "700 " + р + "px Montserrat, system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  /* Подпись ужимаем под место: длинное слово иначе вылезет за нишу,
     а это ровно та «обрезанная кнопка», на которую жаловались. */
  var шир = c.measureText(имя).width, макс = w * 0.80;
  if (шир > макс) {
    р = р * макс / шир;
    c.font = "700 " + р + "px Montserrat, system-ui, sans-serif";
  }
  c.fillStyle = "rgba(66,178,220," + (0.55 + сила * 0.45).toFixed(3) + ")";
  c.fillText(имя, w / 2, h * 0.88);
}

/* ══════════════════════════════════════════════════════════
   Слой
   ══════════════════════════════════════════════════════════ */
function создать(wrap) {
  var cv = doc.createElement("canvas");
  cv.className = "rcf-instr";
  cv.setAttribute("aria-hidden", "true");
  var c = cv.getContext("2d");

  /* Черновики: содержимое ниши рисуется в свой холст, а потом
     вливается в четырёхугольник. Так содержимое считает в удобных
     прямых координатах и не знает про сходимость пульта. */
  var буф = doc.createElement("canvas");
  var бк = буф.getContext("2d");
  /* Второй черновик под сияние. Размывать приходится ровно один раз
     на нишу: если размывать при вливании, фильтр ложится на каждую из
     двух десятков полос, и на слабой машине кадр падает в пол. Сайт и
     так упрекали за тормоза, повторять эту ошибку нельзя. */
  var ор = doc.createElement("canvas");
  var орк = ор.getContext("2d");

  var сост = { фаза: 0, тяга: 0.62, щит: 0.86, корпус: 1, тангаж: 0, крен: 0,
               метки: [], подписи: true };
  var сила = [];           /* свет каждой клавиши, 0..1 */
  var зоны = [];           /* четырёхугольники клавиш на экране */
  var W = 0, H = 0, DPR = 1, meta = null, разметка = null, ru = true;

  function размер(w, h, dpr) {
    W = w; H = h; DPR = dpr;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
  }

  function буфер(w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (буф.width !== w || буф.height !== h) { буф.width = w; буф.height = h; }
    else бк.clearRect(0, 0, w, h);
    return { w: w, h: h };
  }

  /* Подмешивает к содержимому ниши его же размытую копию: у света под
     стеклом всегда есть ореол, без него линии выглядят наклейкой. */
  function сияние(w, h, r) {
    if (r < 0.6) return;
    if (ор.width !== w || ор.height !== h) { ор.width = w; ор.height = h; }
    else орк.clearRect(0, 0, w, h);
    орк.save();
    орк.filter = "blur(" + r.toFixed(1) + "px)";
    орк.drawImage(буф, 0, 0);
    орк.restore();
    бк.save();
    бк.globalCompositeOperation = "lighter";
    бк.globalAlpha = 0.6;
    бк.drawImage(ор, 0, 0);
    бк.restore();
  }

  function кадр(dt) {
    if (!meta || !разметка || !cv.width) return;
    сост.фаза = (сост.фаза + dt * 0.22) % 1;
    var п = покрытие(meta, cv.width, cv.height);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = "lighter";

    var э = разметка["экраны"] || [];
    for (var i = 0; i < э.length; i++) {
      var q = угол(п, ужать(э[i]["угол"], 0.05));
      var ш = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
      var в = Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y);
      /* Черновик берём вдвое крупнее места на экране: после вливания
         полосами остаётся запас на сглаживание, и линии не рвутся. */
      var б = буфер(ш * 1.6, в * 1.6);
      var f = ПРИБОР[э[i]["ид"]];
      if (f) { бк.save(); f(бк, б.w, б.h, сост); бк.restore(); }
      сияние(б.w, б.h, б.h * 0.05);
      влить(c, буф, q, б.w, б.h);
    }

    зоны.length = 0;
    var K = g.RC_KEYS ? g.RC_KEYS.KEYS : [];
    var п_ = разметка["полосы"] || [];
    var n = 0;
    for (var s = 0; s < п_.length; s++) {
      var кв = места(ужать(п_[s]["угол"], 0.10), п_[s]["мест"], п_[s]["зазор"]);
      var спис = п_[s]["ключи"];
      for (var j = 0; j < кв.length; j++, n++) {
        /* Какая команда где: полоса вправе назвать свои клавиши. На
           телефоне мест мало, и там нужны не первые попавшиеся, а те
           четыре, без которых в полёте не обойтись. */
        var k = K[спис ? спис[j] : (n % Math.max(1, K.length))];
        if (!k) continue;
        var qq = угол(п, кв[j]);
        зоны.push(qq);
        if (сила[n] == null) сила[n] = 0;
        сила[n] *= Math.max(0, 1 - dt * 3.4);
        var шш = Math.hypot(qq[1].x - qq[0].x, qq[1].y - qq[0].y);
        var вв = Math.hypot(qq[3].x - qq[0].x, qq[3].y - qq[0].y);
        var б2 = буфер(шш * 1.6, вв * 1.6);
        бк.save(); клавиша(бк, б2.w, б2.h, k, сила[n], ru); бк.restore();
        сияние(б2.w, б2.h, б2.h * 0.06);
        влить(c, буф, qq, б2.w, б2.h);
      }
    }
    c.globalCompositeOperation = "source-over";
  }

  return {
    canvas: cv,
    вид: function (m, d, язык) { meta = m; разметка = d; ru = язык !== false; },
    размер: размер,
    кадр: кадр,
    данные: function (o) { for (var k in o) if (o.hasOwnProperty(k)) сост[k] = o[k]; },
    нажать: function (i) { сила[i] = 1; },
    место: function (i) { return зоны[i] || null; },
    попал: function (x, y) {
      for (var i = 0; i < зоны.length; i++) if (внутри(зоны[i], x, y)) return i;
      return -1;
    },
    мест: function () { return зоны.length; }
  };
}

g.RC_DECK = { создать: создать, покрытие: покрытие };
})(window);
