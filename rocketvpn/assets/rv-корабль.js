/* Rocket VPN. Корабль финала: тот же, что на соседнем сайте.

   ЗАЧЕМ. Владелец прислал восемь снимков финала Rocket CDN и написал:
   «вот как на сайте rocketcdn.ru 1:1 должен быть финал (кроме
   разворота на 360)». На снимках по порядку: ракета на посадочной
   площадке в звёздах, подход, люк, салон за люком с карточками
   текста, рубка с окном и Землёй за ним, и последний кадр - панель с
   вопросами и кнопками внутри окна.

   ОТКУДА ЭТОТ ФАЙЛ. Это библиотека геометрии из rc-rocket.js
   соседнего сайта, взятая КАК ЕСТЬ: обшивка с заклёпками и швами,
   иллюминатор, стабилизаторы, опоры с тарелками, люк с двумя
   створками, салон за люком, разметка площадки, бортик, грунт и
   дымка. Ни одно число тут не наше и правиться тут не должно: меняется
   что-то в корабле - правится у соседей, потом переносится сюда.

   ЧЕГО ЗДЕСЬ НЕТ. Их полёта. У соседей корабль летит через весь сайт
   по своему пути, со своим холстом и своим отрисовщиком; у нас он
   стоит на дне шахты в общем мире, и ведёт его наш акт финала. Поэтому
   перенесена ровно первая половина файла - постройка тел и текстур, - а
   маршрут, факел, орбита и хвост остались там.

   ЧТО ОТДАЁТ НАРУЖУ:
     RV_КОРАБЛЬ.собрать(мир, родитель) -> Group | null
     RV_КОРАБЛЬ.кадр(доля, dt, часы)   доля 0 люк закрыт, 1 настежь
     RV_КОРАБЛЬ.мерки()                радиус, высота, низ проёма
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

if (!g.THREE) return;
var T = g.THREE;

/* One ship, one material language. Both the exterior airlock and
   the flight cabin read this palette, so the threshold cannot turn
   from a white rocket into an unrelated blue room. Geometry may use
   a cheaper shader on mobile, but albedo/emission stay identical. */
var SHIP = g.RV_СТИЛЬ_КОРАБЛЯ = g.RV_СТИЛЬ_КОРАБЛЯ || {
  deep: 0x02060a,
  hull: 0x101923,
  wall: 0x182633,
  panel: 0x060d14,
  steel: 0x566675,
  cyan: 0x5fc8ef,
  cyanSoft: 0x9fe0f6,
  violet: 0xa974f5,
  warm: 0xffa85c
};

/* Публикация переменных оформления идёт через общий кэш: запись на
   корне документа помечает устаревшим стиль всего дерева, а мы
   зовём её из каждого кадра. Пишем только изменившееся. */
var V = (g.RV_VAR && g.RV_VAR.set) || function (el, n, v) {
  if (el && el.style) el.style.setProperty(n, v);
};

/* Мерки блоков берём из общего кэша: спросить браузер о месте блока
   после записи в стиль - значит заставить его досчитать вёрстку
   прямо посреди кадра. При прокрутке блоки стоят, двигается окно. */
var BOX = (g.RV_BOX && g.RV_BOX.box) || function (el) { return el.getBoundingClientRect(); };

/* ── Возможности устройства ──────────────────────────────── */
/* ── Полотно страницы не имеет права укорачиваться под пальцем ──
   Замер входа в корабль: высота документа падала с 14294 до 12447
   точек. Разделы за спиной сжимались (у них по прокрутке едет
   max-width, а с ней перетекает текст), браузер подтягивал
   прокрутку назад на полторы тысячи точек - и доля подъезда к
   пульту отскакивала с половины на ноль. Ровно это владелец назвал
   «шев переход» и «скачок» на финальной сцене.

   Лечится не поимённой правкой каждого раздела, а полом высоты:
   с началом подхода полотно фиксируем на достигнутой высоте. Расти
   ему можно, укорачиваться - нет. Отпускаем, когда отошли, и при
   смене размера окна: там пересчёт честен. */
function закрепитьВысоту(вкл) {
  var m = document.querySelector("main.w3-stage") || document.querySelector("main");
  if (!m) return;
  if (!вкл) {
    m.style.minHeight = "";
    закрепитьВысоту._h = 0;
    return;
  }
  var h = m.offsetHeight;
  if (h > (закрепитьВысоту._h || 0)) {
    закрепитьВысоту._h = h;
    m.style.minHeight = h + "px";
  }
}
addEventListener("resize", function () {
  if (закрепитьВысоту._w === innerWidth) return;
  закрепитьВысоту._w = innerWidth;
  /* Поворот телефона меняет всю раскладку, и старый пол высоты после
     него врёт: держит страницу длиннее, чем она есть, и внизу
     появляется пустота. Снимаем, а если подход ещё идёт - ставим
     заново, уже по новой раскладке. Четверть секунды на то, чтобы
     разделы успели перетечь. */
  var подход = document.documentElement.classList.contains("rc-approach");
  закрепитьВысоту(false);
  if (подход) setTimeout(function () { закрепитьВысоту(true); }, 260);
}, { passive: true });

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

  /* Обшивка: обработанный гунметал, а не белая эмаль.

     Так было не всегда. Раньше здесь лежал почти белый градиент, и
     ракета читалась игрушкой из магазина: белый глянец плюс синяя
     полоса. Разбор по референсам заказчика показал причину. Для
     металла цвет в текстуре - это не «какой он на вид», а сколько
     света он отражает; у стали это средне-тёмный серо-синий.
     Поставь туда белый - и получишь зеркало, залитое белилами,
     сколько ни правь шероховатость. Тон опустили до стали, а всё
     остальное (блики, объём, отражения) теперь делает свет.

     Фирменные кольца и знаки не трогаем: они и должны быть яркими
     пятнами на тёмном корпусе, как на брендбуке. */
  var base = x.createLinearGradient(0, 0, W, 0);
  base.addColorStop(0.00, "#3A3F46");
  base.addColorStop(0.22, "#5C636C");
  base.addColorStop(0.50, "#464C54");
  base.addColorStop(0.78, "#626972");
  base.addColorStop(1.00, "#3A3F46");
  x.fillStyle = base;
  x.fillRect(0, 0, W, H);

  /* Шлифовка: борозды вдоль корпуса. Именно она отличает
     обработанный металл от заливки одним тоном. */
  for (var i = 0; i < 3400; i++) {
    x.globalAlpha = 0.030 + Math.random() * 0.055;
    x.fillStyle = Math.random() > 0.5 ? "#7C8B9C" : "#1A222C";
    x.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 4, 1);
  }
  /* Следы работы: потёртости у стыков и осевшая копоть снизу */
  for (i = 0; i < 130; i++) {
    x.globalAlpha = 0.05 + Math.random() * 0.10;
    x.fillStyle = Math.random() > 0.45 ? "#0E141C" : "#8A99AB";
    var wx = Math.random() * W, wy = Math.random() * H;
    var ww = 6 + Math.random() * 48, wh = 2 + Math.random() * 10;
    x.fillRect(wx, wy, ww, wh);
  }
  x.globalAlpha = 1;

  /* Продольные швы обшивки */
  x.strokeStyle = "rgba(12,18,28,.55)";
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
    color: 0x9AA4AF, metalness: 0.84, roughness: 0.33, envMap: env, envMapIntensity: 1.2
  });
  /* Шток намеренно зеркальнее всего остального: полированный
     хромированный цилиндр - самая узнаваемая деталь любой опоры, и
     блик на нём с ходом ноги ползёт, то есть выдаёт движение */
  var rodMat = new T.MeshStandardMaterial({
    color: 0xAEB6BE, metalness: 1.0, roughness: 0.10, envMap: env, envMapIntensity: 1.9
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
/* Дымка над равниной: у земли плотная, кверху сходит на нет. Ею и
   склеивается стык «планета - космос», которого иначе не спрятать:
   плоскость земли всегда кончается прямой линией. */
function hazeTexture() {
  var W = 8, H = 128;
  var c = document.createElement("canvas");
  c.width = W; c.height = H;
  var x = c.getContext("2d");
  var g1 = x.createLinearGradient(0, H, 0, 0);
  g1.addColorStop(0.00, "rgba(46,66,92,.92)");
  g1.addColorStop(0.10, "rgba(40,58,82,.78)");
  g1.addColorStop(0.26, "rgba(32,48,70,.46)");
  g1.addColorStop(0.48, "rgba(24,37,56,.20)");
  g1.addColorStop(0.72, "rgba(18,28,44,.06)");
  g1.addColorStop(1.00, "rgba(14,22,36,0)");
  x.fillStyle = g1;
  x.fillRect(0, 0, W, H);
  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  return tex;
}

/* Равнина до горизонта. Рисуем не «землю с деталями», а именно
   даль: у площадки грунт ещё читается, к краю он тонет в холодной
   дымке и без шва переходит в космос. Резкая кромка сразу выдавала
   бы, что планета кончается в десяти метрах от опор. */
function plainTexture(weak) {
  var S = weak ? 256 : 512;
  var c = document.createElement("canvas");
  c.width = c.height = S;
  var x = c.getContext("2d");
  var m = S / 2;

  var g1 = x.createRadialGradient(m, m, m * 0.05, m, m, m);
  /* Плотность держим почти до самого края: камера стоит низко, и
     равнина в кадре сжата перспективой в узкую полосу у горизонта.
     Если гасить её с середины, от земли не остаётся ничего и
     площадка снова висит в звёздах. */
  g1.addColorStop(0.00, "rgba(42,60,82,.96)");
  g1.addColorStop(0.45, "rgba(34,50,70,.94)");
  g1.addColorStop(0.74, "rgba(26,40,58,.86)");
  g1.addColorStop(0.90, "rgba(18,29,44,.52)");
  g1.addColorStop(1.00, "rgba(12,20,32,0)");
  x.fillStyle = g1;
  x.fillRect(0, 0, S, S);

  /* Неровности: пятна светлее и темнее, крупные и мягкие - вблизи их
     не разглядывают, а издали именно они не дают равнине читаться
     залитым цветом */
  var i, a, r, px, py, sp;
  for (i = 0; i < (weak ? 22 : 54); i++) {
    a = Math.random() * Math.PI * 2;
    r = m * (0.14 + Math.random() * 0.82);
    px = m + Math.cos(a) * r;
    py = m + Math.sin(a) * r;
    var rad = S * (0.03 + Math.random() * 0.09);
    var lit = Math.random() < 0.45;
    sp = x.createRadialGradient(px, py, 0, px, py, rad);
    sp.addColorStop(0, lit ? "rgba(96,126,160,.16)" : "rgba(8,14,24,.22)");
    sp.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = sp;
    x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill();
  }

  var tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace || tex.colorSpace;
  return tex;
}

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
  /* Физика обшивки. Здесь стояла металличность в единицу, и это
     сбивало весь корпус.

     У чистого металла собственного цвета нет: то, что мы называем
     его цветом, целиком приходит из отражения. Значит корпус
     показывал не сталь, а окружение - отсюда ровный синий налив по
     всей длине, сколько ни правь текстуру. Плюс карта металличности
     была назначена картой шероховатости: затёртые места становились
     самыми металлическими, то есть ровно наоборот.

     Обшивка корабля - крашеный металл, а не зеркало. Металличность
     опускаем до трети: тогда работает и собственный тон покрытия,
     и отражение, а шероховатость решает, где поверхность блестит,
     а где съедена работой. */
  var hullMat = new T.MeshStandardMaterial({
    map: hullTexture(),
    roughnessMap: hullRough(C.weak ? 256 : 512),
    metalness: 0.38,
    roughness: 1.0,
    envMap: env,
    envMapIntensity: 1.05
  });
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
    /* Стабилизаторы: тот же гунметал, что корпус. Ярко-синий с
       зеркальной шероховатостью 0.19 читался пластиковым крылом от
       игрушечной ракеты - на телефоне это было заметнее всего. */
    color: 0x3E4650, metalness: 0.55, roughness: 0.46, envMap: env, envMapIntensity: 1.1
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
    color: 0x44505C, metalness: 0.60, roughness: 0.44, envMap: env, envMapIntensity: 1.15
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
    /* Обтекатель носа: сталь, а не белое зеркало. Металличность в
       единицу означает, что собственного тона у детали нет и она
       показывает только отражение - на светлом фоне это выглядело
       белым пластиком. */
    new T.MeshStandardMaterial({ color: 0x8A939E, metalness: 0.78, roughness: 0.30, envMap: env })
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

  /* Тонкие светящиеся полосы по корпусу. Верхняя пересекает пояс
     люка, поэтому у неё свой материал: при открытии она гаснет и не
     продолжает бортовую графику прямо сквозь пустой проём. */
  var glowMat = new T.MeshBasicMaterial({ color: 0x5FD0F5, transparent: true, opacity: 0.62 });
  var hatchBandMat = new T.MeshBasicMaterial({ color: 0x5FD0F5, transparent: true, opacity: 0.62 });
  var stripLow = new T.Mesh(new T.TorusGeometry(0.619, 0.012, 6, C.radial), glowMat);
  stripLow.rotation.x = Math.PI / 2; stripLow.position.y = -1.28; root.add(stripLow);
  var stripHatch = new T.Mesh(new T.TorusGeometry(0.649, 0.012, 6, C.radial), hatchBandMat);
  stripHatch.rotation.x = Math.PI / 2; stripHatch.position.y = 0.30; root.add(stripHatch);

  var door = buildDoor(C, env, hullMat);
  root.add(door.group);

  /* Опоры кладём внутрь корпуса: наклон, поворот и масштаб корабля
     они наследуют даром, а мы правим только углы */
  var gear = buildGear(C, env);
  root.add(gear.group);

  return { root: root, body: body, glass: glass, glowMat: glowMat,
    hatchBandMat: hatchBandMat, door: door, gear: gear };
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

  /* Створка шлюза - тот же металл, что корпус: одна конструкция
     не может быть из двух разных материалов. Тон держим на полтона
     светлее обшивки, чтобы проём читался как проём. */
  var base = x.createLinearGradient(0, 0, W, 0);
  base.addColorStop(0.00, "#323E4D");
  base.addColorStop(0.30, "#546375");
  base.addColorStop(0.62, "#3E4B5B");
  base.addColorStop(1.00, "#2A3542");
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

/* Material maps are allowed to describe a surface; they never replace
   the scene. These three deterministic canvases provide albedo,
   roughness and shallow normal relief for the same real meshes below.
   Panel seams, fasteners and abrasion therefore stay locked to the
   airlock while the camera crosses it instead of sliding like a photo. */
function airlockMetalMaps() {
  var S = 512, al = document.createElement("canvas");
  var ro = document.createElement("canvas"), bu = document.createElement("canvas");
  al.width = al.height = ro.width = ro.height = bu.width = bu.height = S;
  var a = al.getContext("2d"), r = ro.getContext("2d"), b = bu.getContext("2d");
  var seed = 1949;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  var base = a.createLinearGradient(0, 0, 0, S);
  base.addColorStop(0, "#667482");
  base.addColorStop(0.42, "#34414e");
  base.addColorStop(0.78, "#202a34");
  base.addColorStop(1, "#111820");
  a.fillStyle = base; a.fillRect(0, 0, S, S);
  r.fillStyle = "#c4c4c4"; r.fillRect(0, 0, S, S);
  b.fillStyle = "#808080"; b.fillRect(0, 0, S, S);

  /* Large manufactured plates. The double seam has a bright worn
     lip and a dark recess, which survives at a distance as real depth. */
  var i, x, y;
  for (i = 1; i < 8; i++) {
    x = i * S / 8;
    a.fillStyle = "rgba(3,8,13,.72)"; a.fillRect(x - 2, 0, 3, S);
    a.fillStyle = "rgba(205,224,238,.12)"; a.fillRect(x + 1, 0, 1, S);
    r.fillStyle = "#929292"; r.fillRect(x - 2, 0, 4, S);
    b.fillStyle = "#626262"; b.fillRect(x - 2, 0, 3, S);
    b.fillStyle = "#929292"; b.fillRect(x + 1, 0, 1, S);
  }
  for (i = 1; i < 5; i++) {
    y = i * S / 5;
    a.fillStyle = "rgba(3,8,13,.62)"; a.fillRect(0, y - 2, S, 3);
    a.fillStyle = "rgba(210,228,240,.09)"; a.fillRect(0, y + 1, S, 1);
    r.fillStyle = "#969696"; r.fillRect(0, y - 2, S, 4);
    b.fillStyle = "#606060"; b.fillRect(0, y - 2, S, 3);
    b.fillStyle = "#929292"; b.fillRect(0, y + 1, S, 1);
  }

  /* Fasteners are part of the relief map, not luminous decoration. */
  for (i = 0; i < 64; i++) {
    x = (i % 8) * S / 8 + 7;
    y = Math.floor(i / 8) * S / 8 + 7;
    a.fillStyle = "rgba(214,224,232,.24)";
    a.beginPath(); a.arc(x, y, 3.1, 0, Math.PI * 2); a.fill();
    a.fillStyle = "rgba(5,9,13,.75)";
    a.beginPath(); a.arc(x - 0.8, y + 0.8, 1.5, 0, Math.PI * 2); a.fill();
    b.fillStyle = "#b8b8b8"; b.beginPath(); b.arc(x, y, 3, 0, Math.PI * 2); b.fill();
    r.fillStyle = "#787878"; r.beginPath(); r.arc(x, y, 3, 0, Math.PI * 2); r.fill();
  }

  /* Directional abrasion and fingerprints around the working height.
     All marks are seeded, so a reload cannot reshuffle the ship. */
  a.lineCap = r.lineCap = b.lineCap = "round";
  for (i = 0; i < 190; i++) {
    x = rnd() * S; y = rnd() * S;
    var len = 5 + rnd() * 42, alpha = 0.025 + rnd() * 0.07;
    a.strokeStyle = "rgba(224,235,242," + alpha.toFixed(3) + ")";
    a.lineWidth = 0.45 + rnd() * 0.9;
    a.beginPath(); a.moveTo(x, y); a.lineTo(x + len, y + (rnd() - 0.5) * 3); a.stroke();
    r.strokeStyle = "rgba(95,95,95,.22)"; r.lineWidth = 1;
    r.beginPath(); r.moveTo(x, y); r.lineTo(x + len, y); r.stroke();
    b.strokeStyle = rnd() > 0.5 ? "#868686" : "#787878"; b.lineWidth = 0.7;
    b.beginPath(); b.moveTo(x, y); b.lineTo(x + len, y); b.stroke();
  }
  var grime = a.createLinearGradient(0, S * 0.55, 0, S);
  grime.addColorStop(0, "rgba(2,5,8,0)");
  grime.addColorStop(1, "rgba(2,5,8,.48)");
  a.fillStyle = grime; a.fillRect(0, S * 0.55, S, S * 0.45);

  function tex(c, srgb) {
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb && T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  return { map: tex(al, true), rough: tex(ro, false), bump: tex(bu, false) };
}

/* Real geometry behind the exterior hatch. The previous version put
   a painted blue room on a curved canvas and then replaced it with
   the flight cabin. This compact pressure tunnel is made from the
   same metal, panel and emission palette as RV_САЛОН. It lives in
   the rocket scene, inherits the rocket transform and remains
   volumetric from the first visible crack to the camera crossing. */
function buildAirlockInterior(env, R, HH, Y, seg) {
  var group = new T.Group();
  var q = Math.max(5, Math.round(seg * 0.55));
  function roundedSlab(w, h, d, radius, bevel) {
    var s = new T.Shape(), x0 = -w * 0.5, y0 = -h * 0.5;
    var rr = Math.min(radius, w * 0.24, h * 0.24);
    s.moveTo(x0 + rr, y0);
    s.lineTo(x0 + w - rr, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + rr);
    s.lineTo(x0 + w, y0 + h - rr); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - rr, y0 + h);
    s.lineTo(x0 + rr, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - rr);
    s.lineTo(x0, y0 + rr); s.quadraticCurveTo(x0, y0, x0 + rr, y0);
    var bb = Math.min(bevel, w * 0.12, h * 0.20, d * 0.22);
    var geo = new T.ExtrudeGeometry(s, {
      depth: d, steps: 1, curveSegments: q,
      bevelEnabled: true, bevelSegments: 1, bevelSize: bb, bevelThickness: bb
    });
    geo.center();
    return geo;
  }
  var maps = airlockMetalMaps();
  var shellMat = new T.MeshStandardMaterial({
    color: 0x9aa6af, map: maps.map, roughnessMap: maps.rough,
    bumpMap: maps.bump, bumpScale: 0.012,
    metalness: 0.82, roughness: 0.58,
    envMap: env, envMapIntensity: 0.92
  });
  var darkMat = new T.MeshStandardMaterial({
    color: 0x26313a, map: maps.map, roughnessMap: maps.rough,
    bumpMap: maps.bump, bumpScale: 0.009,
    metalness: 0.68, roughness: 0.72,
    envMap: env, envMapIntensity: 0.68
  });
  var steelMat = new T.MeshStandardMaterial({
    color: SHIP.steel, metalness: 0.9, roughness: 0.24,
    envMap: env, envMapIntensity: 1.12
  });
  var gasketMat = new T.MeshStandardMaterial({
    color: 0x020508, metalness: 0.08, roughness: 0.93,
    envMap: env, envMapIntensity: 0.22
  });
  var glassMat = new T.MeshStandardMaterial({
    color: 0x02070b, metalness: 0.18, roughness: 0.12,
    envMap: env, envMapIntensity: 1.35,
    emissive: 0x03131d, emissiveIntensity: 0.48
  });
  var grateMat = new T.MeshStandardMaterial({
    color: 0x18222b, metalness: 0.86, roughness: 0.48,
    envMap: env, envMapIntensity: 0.72
  });
  var cyanSoft = new T.MeshBasicMaterial({
    color: SHIP.cyanSoft, transparent: true, opacity: 0.34,
    blending: T.AdditiveBlending, depthWrite: false, toneMapped: false
  });

  /* Rear pressure bulkhead: a real surface with depth and bevel-like
     reinforcement, not a texture pretending to be a room. */
  var bulk = new T.Mesh(new T.BoxGeometry(R * 1.52, HH * 0.92, 0.085), shellMat);
  bulk.position.set(0, Y, -R * 0.58);
  group.add(bulk);
  var bulkInset = new T.Mesh(roundedSlab(R * 1.31, HH * 0.72, 0.052, R * 0.055, 0.009), darkMat);
  bulkInset.position.set(0, Y, -R * 0.526);
  group.add(bulkInset);
  /* The shadow gap around the inset is a rubber pressure seal. It
     gives the rear wall three readable depth planes without a bevel
     shader or an extra full-screen texture. */
  var insetTop = new T.Mesh(new T.BoxGeometry(R * 1.38, 0.028, 0.032), gasketMat);
  insetTop.position.set(0, Y + HH * 0.385, -R * 0.496);
  group.add(insetTop);
  var insetBottom = insetTop.clone(); insetBottom.position.y = Y - HH * 0.385; group.add(insetBottom);
  for (var side = -1; side <= 1; side += 2) {
    var insetSide = new T.Mesh(new T.BoxGeometry(0.028, HH * 0.79, 0.032), gasketMat);
    insetSide.position.set(side * R * 0.69, Y, -R * 0.496);
    group.add(insetSide);
  }

  /* Floor and ceiling continue through the hatch. Longitudinal rails
     provide parallax during the first-person camera move. */
  var floor = new T.Mesh(new T.BoxGeometry(R * 1.55, 0.055, R * 1.36), gasketMat);
  floor.position.set(0, Y - HH * 0.49, 0.02);
  group.add(floor);
  var ceil = new T.Mesh(new T.BoxGeometry(R * 1.55, 0.07, R * 1.36), darkMat);
  ceil.position.y = Y + HH * 0.49;
  group.add(ceil);

  /* Actual raised grating. Two instanced sets cost two draw calls but
     create moving occlusion and specular parallax under the camera. */
  var longBars = new T.InstancedMesh(new T.BoxGeometry(0.025, 0.018, R * 1.28), grateMat, 7);
  var matrix = new T.Matrix4();
  for (var gi = 0; gi < 7; gi++) {
    matrix.makeTranslation((gi - 3) * R * 0.19, Y - HH * 0.455, 0.02);
    longBars.setMatrixAt(gi, matrix);
  }
  longBars.instanceMatrix.needsUpdate = true; group.add(longBars);
  var crossBars = new T.InstancedMesh(new T.BoxGeometry(R * 1.43, 0.016, 0.022), grateMat, 7);
  for (gi = 0; gi < 7; gi++) {
    matrix.makeTranslation(0, Y - HH * 0.452, R * (0.55 - gi * 0.18));
    crossBars.setMatrixAt(gi, matrix);
  }
  crossBars.instanceMatrix.needsUpdate = true; group.add(crossBars);

  /* Side liners close the tunnel physically. Their leading edges sit
     behind the exterior jamb, so the exterior silhouette never grows. */
  for (side = -1; side <= 1; side += 2) {
    var liner = new T.Mesh(new T.BoxGeometry(0.06, HH * 0.88, R * 1.28), darkMat);
    liner.position.set(side * R * 0.735, Y, 0.015);
    group.add(liner);
    var rail = new T.Mesh(new T.BoxGeometry(0.045, 0.035, R * 1.30), steelMat);
    rail.position.set(side * R * 0.58, Y - HH * 0.455, 0.02);
    group.add(rail);
  }

  /* Three structural hoops define actual depth. Their dimensions are
     deliberately shared with the hatch opening, so no edge can float
     outside the ship silhouette on narrow mobile crops. */
  var hoopTopGeo = roundedSlab(R * 1.50, 0.055, 0.055, 0.014, 0.007);
  var hoopPostGeo = roundedSlab(0.055, HH * 0.91, 0.055, 0.014, 0.007);
  var gusGeo = roundedSlab(R * 0.25, 0.038, 0.045, 0.009, 0.005);
  for (var zi = 0; zi < 4; zi++) {
    var z = R * (0.36 - zi * 0.28);
    var top = new T.Mesh(hoopTopGeo, steelMat);
    top.position.set(0, Y + HH * 0.455, z);
    group.add(top);
    var bottom = top.clone();
    bottom.position.y = Y - HH * 0.455;
    group.add(bottom);
    for (side = -1; side <= 1; side += 2) {
      var post = new T.Mesh(hoopPostGeo, steelMat);
      post.position.set(side * R * 0.72, Y, z);
      group.add(post);
    }
    /* Short diagonal gussets make each hoop structural rather than a
       rectangular neon outline. */
    if (zi < 3) {
      for (side = -1; side <= 1; side += 2) {
        var gus = new T.Mesh(gusGeo, steelMat);
        gus.position.set(side * R * 0.61, Y + HH * 0.375, z - 0.002);
        gus.rotation.z = side * 0.72;
        group.add(gus);
      }
    }
  }

  /* ── Панель в проёме одна, и она из игры ────────────────────
     Здесь стояла собственная приборка тамбура: металлический короб,
     безель, стеклянный экран, три полоски телеметрии и пять круглых
     клавиш. Она была «визуальным зерном», которое потом подхватывает
     настоящая рубка. На деле выходило три разные панели подряд - в
     проёме люка своя, в салоне своя, и только в игре настоящая.
     Заказчик написал про это прямо: «по факту реальная панель
     управления с реальными размерами появляется только в игре, а я
     что просил?»

     Просил он одну. Ту, что в игре, видимую с той минуты, как
     разошлись створки: стоит в глубине, прибитая на своём месте, и
     растёт по мере подхода. Поэтому в глубину тамбура встаёт снимок
     рубки - ТОТ ЖЕ ФАЙЛ, которым рубка живёт в игре. У него
     прозрачное окно, значит это рама, а не наклейка, и файл общий с
     игрой, значит второй загрузки нет.

     Своя приборка остаётся запасным путём: паспорта кабины нет -
     строим как раньше. Пустого проёма не будет ни при каком
     раскладе. */
  /* Паспорт кабины спрашиваем, но НЕ надеемся на него.

     Первый заход полагался только на `RV_КАБ_ПЛОСКАЯ`, и это оказалось
     гонкой: корабль собирается раньше, чем догружается паспорт, и на
     части заходов снимка не было - тамбур честно строил запасную
     приборку. Выходило ровно то, на что жаловался заказчик: на одном
     экране рубка, на другом пять круглых клавиш. На мониторе мне
     просто везло, на телефоне не повезло ни разу, и «проверено» с
     первого захода было удачей, а не проверкой.

     Поэтому рядом лежит вшитый список тех же трёх снимков. Он не
     красив, зато не зависит ни от порядка файлов, ни от скорости
     сети. Паспорт главнее: появился - берём из него, и смена снимков
     остаётся правкой в одном месте. */
  var ЗАПАСНЫЕ_СНИМКИ = {
    "широкая": { "файл": "assets/gen/каб/cockpit-wide-hd.webp", w: 2688, h: 1536 },
    "средняя": { "файл": "assets/gen/каб/cockpit-mid-hd.webp",  w: 2048, h: 1536 },
    "высокая": { "файл": "assets/gen/каб/cockpit-tall-hd.webp", w: 1536, h: 2499 }
  };
  var снимок = null;
  try {
    var видК = (innerHeight > innerWidth) ? "высокая" : "широкая";
    var М = g.RV_КАБ_ПЛОСКАЯ;
    if (М) снимок = М[видК] || М["широкая"] || null;
    if (!снимок || !снимок["файл"] || !снимок.w || !снимок.h) {
      снимок = ЗАПАСНЫЕ_СНИМКИ[видК] || ЗАПАСНЫЕ_СНИМКИ["широкая"];
    }
  } catch (eСн) {
    снимок = ЗАПАСНЫЕ_СНИМКИ["широкая"];
  }

  var indicators = [];
  var teleMat = new T.MeshStandardMaterial({
    color: 0x071019, emissive: SHIP.cyan, emissiveIntensity: 1.2,
    metalness: 0.05, roughness: 0.36, toneMapped: false
  });
  indicators.push(teleMat);

  if (снимок) {
    /* ── Рубка вдали должна быть ТОЙ ЖЕ рубкой ────────────────────
       Здесь снимок вешался как есть, сырым файлом. А в салоне тот же
       снимок получает три вещи, которых у сырого нет:

         · цветокоррекцию. Снимок снят почти обесцвеченным (среднее по
           широкому кадру 7,12,13 - серый с еле заметной бирюзой),
           синим его делает фильтр в стилях полёта;
         · деку - клавиши и приборы. В самом снимке их нет вовсе,
           ниши пустые;
         · космос за стеклом. Окно на снимке прозрачное, и за ним в
           салоне видно звёзды, а в тамбуре была чернота.

       Отсюда и жалоба заказчика: «до входа в ракету я вижу эту панель
       управления, она качественная, но без космоса, без окна, и по
       визуалу по-другому выглядит». Он описал ровно эти три отличия.

       Печём здесь то же самое, что печёт салон: сначала космос, потом
       снимок под тем же фильтром, потом дека. Разрешение берём вдвое
       меньше салонного - рубка вдали занимает четверть кадра и стоит
       в кадре секунды, платить за неё полным разрешением незачем. */
    var холТ = document.createElement("canvas");
    var кТ = Math.min(1400, снимок.w), вТ = Math.round(кТ * снимок.h / снимок.w);
    холТ.width = кТ; холТ.height = вТ;
    var хкТ = холТ.getContext("2d");
    /* Космос за стеклом. Не звёздное поле целиком - несколько десятков
       точек и мягкий градиент: сквозь окно рубки, стоящей в глубине
       тамбура, больше и не разглядеть. */
    var грТ = хкТ.createLinearGradient(0, 0, 0, вТ);
    грТ.addColorStop(0, "#05080f");
    грТ.addColorStop(0.55, "#081426");
    грТ.addColorStop(1, "#04070d");
    хкТ.fillStyle = грТ;
    хкТ.fillRect(0, 0, кТ, вТ);
    var сид = 20250829;
    function случТ() { сид = (сид * 1664525 + 1013904223) % 4294967296; return сид / 4294967296; }
    for (var зв = 0; зв < 90; зв++) {
      var зx = случТ() * кТ, зy = случТ() * вТ * 0.72;
      var зр = 0.6 + случТ() * 1.5, зя = 0.25 + случТ() * 0.6;
      хкТ.fillStyle = "rgba(214,232,255," + зя.toFixed(2) + ")";
      хкТ.beginPath();
      хкТ.arc(зx, зy, зр, 0, Math.PI * 2);
      хкТ.fill();
    }
    var текРубки = new T.CanvasTexture(холТ);
    if (T.SRGBColorSpace) текРубки.colorSpace = T.SRGBColorSpace;
    текРубки.anisotropy = 8;
    /* Из какого снимка испечён холст. Раньше это читалось само - в
       проёме висел файл, и его имя было прямо в текстуре. Теперь
       текстура своя, и след надо оставить явно: по нему штатная
       проверка «панель в проёме одна и та же» и сверяет, что тамбур
       показывает ТУ ЖЕ рубку, что и игра. Без следа она видит холст
       без имени и справедливо ругается. */
    текРубки.userData = текРубки.userData || {};
    текРубки.userData["снимок"] = снимок["файл"];
    try { холТ.setAttribute("data-снимок", снимок["файл"]); } catch (eМ) {}
    (function () {
      var им = new Image();
      им.decoding = "async";
      им.onload = function () {
        try {
          /* Тот же фильтр, что у слоя рубки в полёте. Числа
             переписаны оттуда один в один: разойдутся - тамбур снова
             станет другого цвета, чем салон. */
          хкТ.filter = (снимок.h > снимок.w)
            ? "brightness(1.2) contrast(1.14) saturate(3.2) hue-rotate(10deg)"
            : "brightness(.86) contrast(1.1) saturate(2.1) hue-rotate(5deg)";
        } catch (eФТ) {}
        хкТ.drawImage(им, 0, 0, кТ, вТ);
        try { хкТ.filter = "none"; } catch (eФ2) {}
        /* Дека поверх: те же клавиши и приборы, что и в салоне. Без
           неё ниши остаются пустыми, и рубка читается макетом. */
        try {
          var видД = (g.RV_НАСТИЛ && g.RV_НАСТИЛ["какой"]) ? g.RV_НАСТИЛ["какой"](снимок.w, снимок.h) : null;
          var планД = (видД && g.RV_КАБ_НАСТИЛ) ? (g.RV_КАБ_НАСТИЛ[видД] || g.RV_КАБ_НАСТИЛ["широкая"]) : null;
          if (планД && g.RV_НАСТИЛ && g.RV_НАСТИЛ["создать"]) {
            var д = g.RV_НАСТИЛ["создать"]();
            д["вид"](снимок, планД, document.documentElement.lang !== "en");
            д["размер"](кТ, вТ, 1);
            д["кадр"](0.016);
            if (д["тело"]) хкТ.drawImage(д["тело"], 0, 0, кТ, вТ);
            хкТ.globalCompositeOperation = "screen";
            хкТ.drawImage(д.canvas, 0, 0, кТ, вТ);
            хкТ.globalCompositeOperation = "source-over";
          }
        } catch (eД) {}
        текРубки.needsUpdate = true;
      };
      им.src = снимок["файл"];
    })();
    /* Ширину берём по проёму, высоту по пропорции снимка: сплющенную
       рубку заказчик поймает первым же взглядом. */
    var шР = R * 1.30;
    var вР = шР * (снимок.h / снимок.w);
    var макВ = HH * 0.88;
    if (вР > макВ) { вР = макВ; шР = вР * (снимок.w / снимок.h); }
    var рубкаВдали = new T.Mesh(
      new T.PlaneGeometry(шР, вР),
      new T.MeshBasicMaterial({
        map: текРубки, transparent: true, opacity: 0.96,
        depthWrite: false, toneMapped: false
      })
    );
    /* У самой дальней переборки и чуть ниже уровня глаз - там же, где
       рубка окажется, когда мы к ней подойдём. */
    рубкаВдали.position.set(0, Y - HH * 0.03, -R * 0.455);
    рубкаВдали.renderOrder = 3;
    group.add(рубкаВдали);
  } else {
  var consoleBox = new T.Mesh(roundedSlab(R * 1.12, HH * 0.31, 0.12, R * 0.055, 0.014), shellMat);
  consoleBox.position.set(0, Y - HH * 0.055, -R * 0.47);
  group.add(consoleBox);
  var screenBezel = new T.Mesh(roundedSlab(R * 0.86, HH * 0.115, 0.035, R * 0.026, 0.006), gasketMat);
  screenBezel.position.set(0, Y + HH * 0.005, -R * 0.395);
  group.add(screenBezel);
  var screen = new T.Mesh(new T.PlaneGeometry(R * 0.76, HH * 0.079), glassMat);
  screen.position.set(0, Y + HH * 0.005, -R * 0.360);
  group.add(screen);
  for (var ti = 0; ti < 3; ti++) {
    var tele = new T.Mesh(new T.BoxGeometry(R * (0.58 - ti * 0.10), 0.008, 0.006), teleMat);
    tele.position.set(-R * 0.07, Y + HH * (0.030 - ti * 0.024), -R * 0.342);
    group.add(tele);
  }
  }
  var keyCapMat = new T.MeshStandardMaterial({
    color: 0x46545f, metalness: 0.78, roughness: 0.24,
    envMap: env, envMapIntensity: 1.1
  });
  var keyLampMat = new T.MeshStandardMaterial({
    color: 0x071017, emissive: SHIP.cyanSoft, emissiveIntensity: 0.72,
    metalness: 0.18, roughness: 0.34, toneMapped: false
  });
  var keyActiveMat = new T.MeshStandardMaterial({
    color: 0x180b05, emissive: 0xff783a, emissiveIntensity: 0.96,
    metalness: 0.20, roughness: 0.34, toneMapped: false
  });
  /* Пять круглых клавиш - часть запасной приборки: их строим только
     тогда, когда снимка рубки нет и в проёме нечего показать. */
  if (!снимок) {
    var socketGeo = new T.CylinderGeometry(R * 0.067, R * 0.067, 0.028, 14);
    var capGeo = new T.CylinderGeometry(R * 0.044, R * 0.048, 0.021, 16);
    var ringGeo = new T.TorusGeometry(R * 0.052, R * 0.0065, 5, 18);
    for (var bi = 0; bi < 5; bi++) {
      var socket = new T.Mesh(socketGeo, steelMat);
      socket.position.set((bi - 2) * R * 0.17, Y - HH * 0.126, -R * 0.390);
      socket.rotation.x = Math.PI * 0.5;
      group.add(socket);
      var key = new T.Mesh(capGeo, keyCapMat);
      key.position.set(socket.position.x, socket.position.y, -R * 0.361);
      key.rotation.x = Math.PI * 0.5;
      group.add(key);
      var ring = new T.Mesh(ringGeo, bi === 3 ? keyActiveMat : keyLampMat);
      ring.position.set(socket.position.x, socket.position.y, -R * 0.342);
      group.add(ring);
    }
    var domeGeo = new T.SphereGeometry(R * 0.027, 10, 6);
    var domes = new T.InstancedMesh(domeGeo, keyCapMat, 5);
    var domeQ = new T.Quaternion(), domeS = new T.Vector3(1, 1, 0.42), domeP = new T.Vector3();
    for (bi = 0; bi < 5; bi++) {
      domeP.set((bi - 2) * R * 0.17, Y - HH * 0.126, -R * 0.322);
      matrix.compose(domeP, domeQ, domeS); domes.setMatrixAt(bi, matrix);
    }
    domes.instanceMatrix.needsUpdate = true; group.add(domes);
  }
  /* Материалы ламп кладём в список ВСЕГДА, даже когда сама приборка
     не построена: кадр читает список по номеру (indicators[1] и [2]),
     и укоротить его значит уронить сборку корабля целиком. */
  indicators.push(keyLampMat, keyActiveMat);

  /* Eight cold fastener heads pin the console to the bulkhead. They
     share one geometry/material and therefore remain one draw call. */
  var boltGeo = new T.CylinderGeometry(0.012, 0.012, 0.009, 8);
  var bolts = new T.InstancedMesh(boltGeo, steelMat, 8);
  var boltQ = new T.Quaternion().setFromEuler(new T.Euler(Math.PI * 0.5, 0, 0));
  var boltS = new T.Vector3(1, 1, 1), boltP = new T.Vector3();
  for (var bo = 0; bo < 8; bo++) {
    var bx = bo % 2 ? R * 0.51 : -R * 0.51;
    var by = Y + (Math.floor(bo / 2) - 1.5) * HH * 0.085;
    boltP.set(bx, by, -R * 0.370);
    matrix.compose(boltP, boltQ, boltS); bolts.setMatrixAt(bo, matrix);
  }
  bolts.instanceMatrix.needsUpdate = true; group.add(bolts);

  /* Light comes from physical strips mounted in the ceiling and
     console. One short-range lamp lights the door edge without
     leaking onto the whole exterior model. */
  for (var li = -1; li <= 1; li += 2) {
    var strip = new T.Mesh(new T.BoxGeometry(R * 0.34, 0.018, 0.028), cyanSoft);
    strip.position.set(li * R * 0.39, Y + HH * 0.452, -R * 0.12);
    group.add(strip);
    var warmMat = new T.MeshBasicMaterial({
      color: SHIP.warm, transparent: true, opacity: 0.46,
      toneMapped: false, blending: T.AdditiveBlending, depthWrite: false
    });
    var practical = new T.Mesh(new T.BoxGeometry(0.022, HH * 0.18, 0.025), warmMat);
    practical.position.set(li * R * 0.69, Y - HH * 0.30, -R * 0.14);
    group.add(practical);
  }
  var lamp = new T.PointLight(SHIP.warm, 0, 3.2, 2);
  lamp.position.set(0, Y + HH * 0.22, R * 0.02);
  group.add(lamp);
  var cabinLight = new T.PointLight(SHIP.cyanSoft, 0.78, 2.2, 1.7);
  cabinLight.position.set(0, Y + HH * 0.14, -R * 0.20);
  group.add(cabinLight);

  /* consoleBox есть только у запасной приборки: со снимком рубки короб
     не строится вовсе. Наружу отдаём то, что есть - читателей у этого
     поля сейчас нет, но пусть значение будет честным. */
  return { group: group, lamp: lamp, bulkhead: bulk,
           console: (typeof consoleBox !== "undefined" ? consoleBox : null),
           indicators: indicators };
}

function buildDoor(C, env, hullMat) {
  var group = new T.Group();

  /* Геометрия проёма: середина борта, чуть выше фирменного кольца */
  var R = 0.648;               /* радиус обшивки в этом месте */
  var HH = 1.34;               /* высота люка */
  var Y = 0.10;                /* центр люка по оси корабля */
  var HALF = 0.62;             /* половина угла проёма, радиан */
  var seg = Math.max(10, Math.round(C.radial / 4));

  /* 1. The visible room behind the hatch is now real geometry in
     this rocket scene. There is no canvas room and therefore no
     possible image swap at the threshold. */
  var airlock = buildAirlockInterior(env, R, HH, Y, seg);
  group.add(airlock.group);
  var cabin = airlock.group;
  var lamp = airlock.lamp;

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
    edgeMat: edgeMat, indicators: airlock.indicators,
    y: Y, half: HALF, rad: R, hh: HH
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


/* ═══════════════════════════════════════════════════════════
   ЗДЕСЬ КОНЧАЕТСЯ ПЕРЕНОС И НАЧИНАЕТСЯ НАША ЧАСТЬ

   Всё выше взято у соседнего сайта как есть. Ниже - разводка под наш
   мир: у них корабль летит по своему пути на своём холсте, у нас он
   стоит на дне шахты в общей сцене, и ведёт его акт финала.
   ═══════════════════════════════════════════════════════════ */

var М = {};
var собрано = false;
var W = null;
var доляЛюка = 0;

/* Мерки корабля из его же чисел. Акту нужно знать, куда ставить глаз
   и на какой высоте стоит проём: подбирать это на глаз значит
   разойтись с моделью на первой же её правке. */
var ЛЮК_Y = 0.10;            /* середина проёма по оси корабля */
var ЛЮК_ВЫС = 1.34;          /* высота проёма */
var БОРТ_R = 0.65;           /* радиус обшивки на поясе люка */

/* Поза шасси. Перенесена из rc-rocket (поза шасси) без единой правки
   кроме одной: просадки от удара у нас нет, корабль уже стоит. */
function поставитьНоги(k) {
  var G = М.ракета && М.ракета.gear;
  if (!G || !G.legs) return;
  G.group.visible = k > 0.004;
  if (!G.group.visible) return;
  var th = GEAR_STOW + (GEAR_OPEN - GEAR_STOW) * k;
  var lo = GEAR_LO * k;
  if (lo < 0.001) lo = 0.001;
  var full = GEAR_UP + lo;
  var ct = Math.cos(th), st = Math.sin(th);
  for (var i = 0; i < G.legs.length; i++) {
    var L = G.legs[i];
    L.swing.rotation.x = -th;              /* -th уводит ногу наружу, к +Z */
    L.rod.scale.y = lo;
    L.foot.position.y = -full;
    L.foot.rotation.x = th;                /* тарелка обязана лежать плашмя */
    L.damp.position.y = -full + 0.13;
    /* Подкос: отрезок от неподвижной точки борта до середины ноги.
       Обе точки в одной плоскости, поэтому наклон это atan2, а длина
       обычная гипотенуза. */
    var dy = (GEAR_HIP_Y - full * GEAR_MID * ct) - GEAR_BR_Y;
    var dz = (GEAR_HIP_Z + full * GEAR_MID * st) - GEAR_BR_Z;
    var len = Math.sqrt(dy * dy + dz * dz);
    var ang = Math.atan2(dz, dy);
    L.brace.rotation.x = ang;
    L.brace.scale.y = len;
    /* Гильза короче штока и не тянется: шток в неё въезжает. Разница
       «неподвижная гильза - подвижный шток» и читается работающей
       гидравликой, а не нарисованной палкой. */
    L.sleeve.rotation.x = ang;
    L.sleeve.scale.y = len * 0.46;
    if (L.hose) {
      L.hose.rotation.x = ang + 0.14;
      L.hose.scale.y = len * 1.06;
    }
  }
}

function собрать(мир, родитель) {
  if (собрано) return М.корень;
  W = мир || W;
  if (!W || !W.T || !родитель) return null;
  /* Библиотека выше писалась под глобальный THREE. У нас он тот же
     объект, просто мир держит на него ссылку; сверяем, чтобы не
     собрать корабль чужим модулем. */
  if (T !== W.T) T = W.T;

  var C = caps();
  var env = null;
  try {
    var r = W.r || (g.RV_REAL && g.RV_REAL["renderer"]);
    if (r) env = envTexture(r);
  } catch (eС) {}

  М.корень = new T.Group();
  М.корень.name = "корабль CDN";

  /* ── ПЛОЩАДКА ─────────────────────────────────────────────
     На снимке владельца ракета стоит НА КРУГЛОЙ ПЛОЩАДКЕ с разметкой,
     бортиком в жёлто-чёрную полосу и огнями по ободу. Без неё корабль
     висит в пустоте: у соседей это первое, что было замечено на
     приёмке, и у нас будет так же.

     Порядок стопки снизу вверх: грунт, разметка, тень, бортик, огни.
     Он не украшение - тень обязана лечь НА разметку, а не под неё. */
  var площадка = new T.Group();
  площадка.name = "площадка";
  площадка.position.y = PAD_Y;
  М.корень.add(площадка);

  /* ── ГРУНТА ВОКРУГ ПЛОЩАДКИ У НАС НЕТ ─────────────────────────
     У соседей корабль стоит на открытой равнине, и вокруг площадки
     лежит плоскость грунта в шесть её сторон: по ней глаз считывает,
     что площадка возвышается. Я перенёс её вместе со всем остальным, и
     замер (tools/кадр-финала.mjs) показал, чем это кончилось:

       доля  глаз                 экран корабля л,в,п,н     за спиной
       0.05  23.8, 22.2, -17.7    -23.16, 1.25, 3.25, 8.02      2

     Коробка предмета вылезла на двадцать три экрана вширь, два её угла
     оказались ЗА КАМЕРОЙ, и в кадре стоял ровный светло-серый лист.
     Считаем: сторона плоскости 6.4 * 6 = 38.4 местных единицы, а узел
     ужат под наш мир множителем 5.31 * 0.377 = 2.0 - то есть в мире это
     семьдесят семь единиц поперёк при корабле в десять ростом. Камера
     на подходе стоит в двадцати восьми, внутри этого листа.

     Пола нашему кораблю хватает своего: он стоит на дне шахты, и пол
     там уже есть (rv-комната.js). Площадка с бортиком остаётся - она
     размером с корабль и говорит, что он ПРИЗЕМЛИЛСЯ. */

  /* Разметка круга. */
  var диск = new T.Mesh(
    new T.PlaneGeometry(PAD_SIZE, PAD_SIZE),
    new T.MeshBasicMaterial({ map: padTexture(C.weak), transparent: true,
                              depthWrite: false, toneMapped: false, opacity: 0.95 })
  );
  диск.rotation.x = -Math.PI / 2;
  диск.renderOrder = 2;
  площадка.add(диск);
  М.диск = диск;

  /* Тень корабля. Одна плоскость, и она обязана быть всегда: без неё
     корабль стоит НАД площадкой, и никакой объём этого не исправит. */
  var тень = new T.Mesh(
    new T.PlaneGeometry(4.4, 4.4),
    new T.MeshBasicMaterial({ map: shadowTexture(), transparent: true,
                              depthWrite: false, toneMapped: false, opacity: 0.55 })
  );
  тень.rotation.x = -Math.PI / 2;
  тень.position.y = 0.006;
  тень.renderOrder = 3;
  площадка.add(тень);

  /* Бортик: полоса предупредительной раскраски по кромке круга. Ради
     него площадка и получила толщину. */
  var бортик = new T.Mesh(
    new T.CylinderGeometry(PAD_SIZE * 0.462, PAD_SIZE * 0.478, PAD_LIFT,
                           C.weak ? 20 : 40, 1, true),
    new T.MeshBasicMaterial({ map: kerbTexture(C.weak), transparent: true,
                              side: T.DoubleSide, toneMapped: false, opacity: 0.95 })
  );
  бортик.position.y = -PAD_LIFT / 2;
  бортик.renderOrder = 1;
  площадка.add(бортик);

  /* Огни по ободу. */
  М.огни = buildLamps(C);
  if (М.огни && М.огни.pts) {
    М.огни.pts.position.y = 0.02;
    площадка.add(М.огни.pts);
  }

  /* ── КОРАБЛЬ ──────────────────────────────────────────────*/
  М.ракета = buildRocket(C, env);
  М.корень.add(М.ракета.root);

  /* Опоры раскрыты: корабль сел, а не летит. Постановка ног взята у
     соседей (rc-rocket, поза шасси) буква в букву, только доля здесь
     всегда единица - у нас корабль не садится на глазах, он стоит. */
  поставитьНоги(1);

  родитель.add(М.корень);
  собрано = true;
  return М.корень;
}

/* Ход люка. Доля ноль - створки в притворе, единица - настежь.
   Числа взяты у соседей (rc-rocket, ход двери) буква в букву: отжим
   притвора в первые четырнадцать сотых хода, разъезд на 2.05 половины
   угла проёма, свет салона впереди створок. */
function кадр(доля, dt, часы) {
  if (!собрано) return;
  var к = доля == null ? 0 : (доля < 0 ? 0 : (доля > 1 ? 1 : доля));
  доляЛюка = к;
  var д = М.ракета && М.ракета.door;
  if (!д) return;

  var распах = к * д.half * 2.05;
  /* Расцепление замков: створки сперва отходят наружу по радиусу и
     только потом уезжают по обшивке. Без этого дверь читается
     картинкой, которая просто разъехалась. */
  var отжим = 1 + Math.min(1, к / 0.14) * 0.022;
  д.l.scale.set(отжим, 1, отжим);
  д.r.scale.set(отжим, 1, отжим);
  д.l.rotation.y = -распах;
  д.r.rotation.y = распах;

  /* Свет салона разгорается в щели РАНЬШЕ самих створок: сначала
     видно, что там свет, потом уже что там салон. */
  var горит = Math.min(1, к * 2.4);
  if (д.lamp) д.lamp.intensity = горит * 2.6;
  if (д.edgeMat) д.edgeMat.opacity = 0.35 + (1 - к) * 0.55;
  if (М.ракета.hatchBandMat) {
    var пояс = Math.max(0, Math.min(1, (к - 0.04) / 0.22));
    пояс = пояс * пояс * (3 - 2 * пояс);
    М.ракета.hatchBandMat.opacity = 0.62 * (1 - пояс);
  }

  /* Огни по ободу бегут по кругу - так их и ставят на настоящих
     площадках, чтобы издалека читалось направление. */
  if (М.огни && М.огни.uni && М.огни.col) {
    var ч = часы || 0;
    for (var i = 0; i < М.огни.n; i++) {
      var ф = Math.sin(ч * 1.6 - i * 0.5) * 0.5 + 0.5;
      var я = 0.25 + ф * 0.75;
      М.огни.col[i * 3] = 0.37 * я;
      М.огни.col[i * 3 + 1] = 0.78 * я;
      М.огни.col[i * 3 + 2] = 0.96 * я;
    }
    М.огни.geo.attributes.aCol.needsUpdate = true;
  }
}

g["RV_КОРАБЛЬ"] = {
  "собрать": собрать,
  "кадр": кадр,
  "узел": function () { return собрано ? М.корень : null; },
  /* Мерки для акта: где стоит проём и какого он размера. Отдаём
     числами модели, а не своими - подбирать их значит разойтись с
     кораблём на первой его правке. */
  "мерки": function () {
    return {
      "борт": БОРТ_R,
      "люкY": ЛЮК_Y,
      "люкВысота": ЛЮК_ВЫС,
      "площадкаY": PAD_Y,
      "площадкаR": PAD_SIZE * 0.46
    };
  },
  "замер": function () {
    if (!собрано) return { "собрано": false };
    var б = new T.Box3().setFromObject(М.ракета.root);
    return {
      "собрано": true,
      "люк": +доляЛюка.toFixed(3),
      "низ": +б.min.y.toFixed(2),
      "верх": +б.max.y.toFixed(2),
      "ширина": +(б.max.x - б.min.x).toFixed(2)
    };
  }
};

})(window);
