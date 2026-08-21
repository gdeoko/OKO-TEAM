/* ═══════════════════════════════════════════════════════════
   Rocket CDN · салон корабля внутри мира игры

   Владелец сформулировал требование одной фразой, и она отменяет
   всю прежнюю конструкцию финала: «когда мы входим в ракету, мы
   как бы на сайте, но уже стоит та самая панель и 3D мир игры...
   это единый 3D мир».

   Раньше было две сцены. Сайт заканчивался нарисованной рубкой со
   своим окном и своей планетой, а игра открывала свой мир со своей
   кабиной. Между ними неизбежно происходила подмена: нарисованное
   менялось на настоящее. Убрать этот шов правкой нельзя - его
   порождает само наличие двух миров.

   Поэтому салон переехал СЮДА, внутрь мира игры. Стены, экраны,
   пульт и остекление стоят вокруг точки, с которой начинается
   полёт, в той же сцене, что Земля и звёзды. Камера одна на весь
   эпизод: вошли, обошли салон взглядом, подступили к панели,
   тронулись. Ни одной подмены не остаётся, потому что менять
   нечего.

   Что здесь есть:
     - обшивка с вырезом под остекление (семь секторов из восьми);
     - семь настенных экранов с настоящим содержимым сайта,
       нарисованным в текстуру: пустой стены в обороте быть не
       должно нигде;
     - приборная ниша под окном и корпус кабины в проёме - тот же
       рисунок, что рамка в полёте, только натянутый на геометрию,
       чтобы в конце подъезда он совпал с ней пиксель в пиксель.

   Масштаб. Мир игры считает в единицах, где Земля - шестьдесят.
   Салон живёт в своём поясе размеров (радиус около трёх), и это
   не противоречие: он стоит вплотную к камере, а планета в
   полутора сотнях единиц. Оба попадают в один буфер глубины без
   потери точности.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document;
var TAU = Math.PI * 2;

/* ── Геометрия салона ─────────────────────────────────────
   Восемь секторов по сорок пять градусов. Нулевой занят
   остеклением - он смотрит туда же, куда камера в первом кадре
   полёта. Остальные семь несут экраны, и это ровно столько,
   сколько на сайте набирается разделов для чтения изнутри. */
var R_WALL = 3.05;               /* радиус обшивки */
var H_ROOM = 4.2;                /* высота помещения */
var EYE = 1.62;                  /* высота глаз над настилом */
var SECT = TAU / 8;              /* сектор */
var WIN_HALF = 0.62;             /* половина проёма остекления */
var WIN_Y0 = 1.02;               /* низ проёма */
var WIN_Y1 = 2.86;               /* верх проёма */

/* Азимут sector i лежит на i * 45 градусов. Ноль - окно. */
function azOf(i) { return i * SECT; }

/* Точка на азимуте: наша запись совпадает с той, что принята в
   рубке и в кино, поэтому числа переносятся между модулями без
   пересчёта. */
function at(th, r, y, T) { return new T.Vector3(r * Math.sin(th), y, -r * Math.cos(th)); }

/* Угол цилиндра three.js из нашего азимута. Один минус разницы,
   но без него вырез оказывается в противоположном углу. */
function thetaOf(th) { return Math.PI - th; }

/* ── Содержимое экранов ───────────────────────────────────
   Берём из самой страницы, а не выдумываем: экран на стене и
   раздел сайта обязаны говорить одно и то же. Если разметки нет
   (упрощённый режим, чужая страница), остаются запасные тексты -
   пустого экрана в салоне быть не должно. */
function grab() {
  var out = [];
  var i, n, t, p;

  /* Четыре карточки надёжности */
  var rel = doc.querySelectorAll("#reliability .card");
  for (i = 0; i < rel.length && out.length < 4; i++) {
    t = rel[i].querySelector("h3");
    p = rel[i].querySelector("p");
    if (!t) continue;
    out.push({ tag: "НАДЁЖНОСТЬ", h: t.textContent.trim(), lines: [p ? p.textContent.trim() : ""] });
  }

  /* Показатели сети: числа с их подписями */
  var kpi = doc.querySelectorAll("#kpi .kpi > *");
  var kl = [];
  for (i = 0; i < kpi.length && kl.length < 4; i++) {
    var kn = kpi[i].querySelector(".kpi-n");
    var kt = kpi[i].querySelector(".kpi-l");
    if (kn && kt) kl.push(kn.textContent.trim() + "  " + kt.textContent.trim());
  }
  if (kl.length) out.push({ tag: "БОРТОВЫЕ ПОКАЗАТЕЛИ", h: "Сеть в цифрах", lines: kl });

  /* Состав подключения */
  var inc = doc.querySelectorAll("#included .inc-item span");
  var il = [];
  for (i = 0; i < inc.length && il.length < 6; i++) il.push(inc[i].textContent.trim());
  if (il.length) out.push({ tag: "ЧТО ВХОДИТ", h: "В каждом подключении", lines: il });

  /* Бортовой справочник: первые вопросы */
  var faq = doc.querySelectorAll("#faqList .faq-q span");
  var fl = [];
  for (i = 0; i < faq.length && fl.length < 5; i++) fl.push(faq[i].textContent.trim());
  if (fl.length) out.push({ tag: "СПРАВОЧНИК", h: "Коротко о главном", lines: fl });

  /* Продукты: чем корабль загружен */
  var pr = doc.querySelectorAll("#products .prod-card h3");
  var pl = [];
  for (i = 0; i < pr.length && pl.length < 6; i++) pl.push(pr[i].textContent.trim());
  if (pl.length) out.push({ tag: "НА БОРТУ", h: "Инфраструктура", lines: pl });

  var FALL = [
    { tag: "НАДЁЖНОСТЬ", h: "SLA 99,9%", lines: ["Доступность закреплена договором."] },
    { tag: "НАДЁЖНОСТЬ", h: "Поддержка 24/7", lines: ["Дежурная смена инженеров круглосуточно."] },
    { tag: "НАДЁЖНОСТЬ", h: "Защита от атак", lines: ["Фильтрация на кромке сети."] },
    { tag: "НАДЁЖНОСТЬ", h: "Резерв", lines: ["Дублирование на каждом участке маршрута."] },
    { tag: "БОРТОВЫЕ ПОКАЗАТЕЛИ", h: "Сеть в цифрах", lines: ["218 узлов", "3 Тбит/с", "1,5 млн зрителей"] },
    { tag: "ЧТО ВХОДИТ", h: "В каждом подключении", lines: ["Свой домен и сертификат", "Гибкие правила кэша", "Статистика в кабинете"] },
    { tag: "СПРАВОЧНИК", h: "Коротко о главном", lines: ["Подключение за один день", "Оплата по факту трафика"] }
  ];
  for (n = 0; out.length < 7; n++) out.push(FALL[n % FALL.length]);
  return out.slice(0, 7);
}

/* ── Текстуры ─────────────────────────────────────────────── */
function cnv(w, h) {
  var c = doc.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

/* Экран стены. Рисуем не карточку сайта, а бортовой дисплей:
   тёмное стекло, светящаяся кромка, метка раздела, заголовок и
   строки. Развёртка и уголки делают его прибором, а не картинкой. */
function screenTex(T, rec, tiny) {
  var W = tiny ? 512 : 768, H = tiny ? 384 : 576;
  var c = cnv(W, H), x = c.getContext("2d"), i;

  var gr = x.createLinearGradient(0, 0, W * 0.4, H);
  gr.addColorStop(0, "#0d2135");
  gr.addColorStop(0.55, "#08192a");
  gr.addColorStop(1, "#050f1c");
  x.fillStyle = gr; x.fillRect(0, 0, W, H);

  /* Пятно от лампы ниши сверху */
  var lg = x.createRadialGradient(W * 0.5, -H * 0.1, 10, W * 0.5, H * 0.42, W * 0.7);
  lg.addColorStop(0, "rgba(120,190,235,.22)");
  lg.addColorStop(1, "rgba(120,190,235,0)");
  x.fillStyle = lg; x.fillRect(0, 0, W, H);

  var PAD = W * 0.075;

  /* Метка раздела */
  x.fillStyle = "#5fc8ef";
  x.font = "600 " + Math.round(W * 0.028) + "px 'Golos Text', system-ui, sans-serif";
  x.textBaseline = "top";
  var tag = (rec.tag || "").toUpperCase();
  var sp = "";
  for (i = 0; i < tag.length; i++) sp += tag[i] + (i < tag.length - 1 ? " " : "");
  x.fillText(sp, PAD, PAD);
  x.fillRect(PAD, PAD + W * 0.05, W * 0.09, 2);

  /* Заголовок */
  x.fillStyle = "#eaf4ff";
  x.font = "700 " + Math.round(W * 0.068) + "px 'Golos Text', system-ui, sans-serif";
  var hy = PAD + W * 0.085;
  var words = String(rec.h || "").split(" "), line = "", maxW = W - PAD * 2;
  for (i = 0; i < words.length; i++) {
    var probe = line ? line + " " + words[i] : words[i];
    if (x.measureText(probe).width > maxW && line) {
      x.fillText(line, PAD, hy);
      hy += W * 0.082;
      line = words[i];
    } else line = probe;
  }
  if (line) { x.fillText(line, PAD, hy); hy += W * 0.082; }

  /* Отбивка */
  x.fillStyle = "rgba(95,200,239,.32)";
  x.fillRect(PAD, hy + W * 0.012, W - PAD * 2, 1);

  /* Строки: каждая с точкой-маркером */
  x.font = "500 " + Math.round(W * 0.042) + "px 'Golos Text', system-ui, sans-serif";
  var ly = hy + W * 0.055;
  var lines = rec.lines || [];
  for (i = 0; i < lines.length && ly < H - PAD; i++) {
    var s = String(lines[i]);
    if (!s) continue;
    x.fillStyle = "#5fc8ef";
    x.beginPath(); x.arc(PAD + 4, ly + W * 0.022, 3.2, 0, TAU); x.fill();
    x.fillStyle = "rgba(226,238,252,.9)";
    /* Длинную строку режем по ширине, а не выпускаем за край */
    var w2 = "", parts = s.split(" "), yy = ly;
    for (var k = 0; k < parts.length; k++) {
      var pr = w2 ? w2 + " " + parts[k] : parts[k];
      if (x.measureText(pr).width > maxW - W * 0.05 && w2) {
        x.fillText(w2, PAD + W * 0.05, yy);
        yy += W * 0.052;
        w2 = parts[k];
      } else w2 = pr;
    }
    if (w2) x.fillText(w2, PAD + W * 0.05, yy);
    ly = yy + W * 0.072;
  }

  /* Развёртка строк: дисплей, а не плакат */
  x.fillStyle = "rgba(5,14,26,.30)";
  for (i = 0; i < H; i += 4) x.fillRect(0, i, W, 1.4);

  /* Кромка и уголки */
  x.strokeStyle = "rgba(95,200,239,.55)"; x.lineWidth = 3;
  x.strokeRect(1.5, 1.5, W - 3, H - 3);
  x.strokeStyle = "rgba(150,225,255,.95)"; x.lineWidth = 4;
  var cc = W * 0.06;
  var corn = [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]];
  for (i = 0; i < 4; i++) {
    var q = corn[i];
    x.beginPath();
    x.moveTo(q[0] + q[2] * cc, q[1] + q[3] * 2);
    x.lineTo(q[0] + q[2] * 2, q[1] + q[3] * 2);
    x.lineTo(q[0] + q[2] * 2, q[1] + q[3] * cc);
    x.stroke();
  }

  var t = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  return t;
}

/* Обшивка: крашеный металл поясами. Три пояса вместо ровной
   плитки - иначе цилиндр читается трубой в обоях, без верха и
   низа. */
function hullTex(T) {
  var W = 512, H = 512;
  var c = cnv(W, H), x = c.getContext("2d"), i;
  var gr = x.createLinearGradient(0, 0, 0, H);
  /* Три пояса: светлее у потолка, рабочий в середине, тёмный
     плинтус. Ровная заливка читалась бы трубой в обоях - у стены
     обязаны быть верх и низ, иначе цилиндр не собирается в комнату. */
  gr.addColorStop(0, "#24405b");
  gr.addColorStop(0.30, "#2a4864");
  gr.addColorStop(0.70, "#1e3a52");
  gr.addColorStop(1, "#13253a");
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  /* Тёмный пояс у самого низа: тень от настила на стену */
  var sh = x.createLinearGradient(0, H * 0.78, 0, H);
  sh.addColorStop(0, "rgba(6,14,24,0)");
  sh.addColorStop(1, "rgba(6,14,24,.72)");
  x.fillStyle = sh; x.fillRect(0, H * 0.78, W, H * 0.22);
  /* Швы листов */
  x.strokeStyle = "rgba(6,14,24,.75)"; x.lineWidth = 2;
  for (i = 0; i <= 8; i++) {
    x.beginPath(); x.moveTo(i * W / 8, 0); x.lineTo(i * W / 8, H); x.stroke();
  }
  for (i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(0, i * H / 4); x.lineTo(W, i * H / 4); x.stroke();
  }
  /* Заклёпки по швам */
  x.fillStyle = "rgba(180,205,230,.22)";
  for (i = 0; i < 8; i++) {
    for (var j = 0; j < 12; j++) {
      x.beginPath(); x.arc(i * W / 8 + 4, j * H / 12 + 8, 1.6, 0, TAU); x.fill();
    }
  }
  var t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  return t;
}

/* Настил: решётка с проступью */
function deckTex(T) {
  var S = 256, c = cnv(S, S), x = c.getContext("2d"), i;
  x.fillStyle = "#16283a"; x.fillRect(0, 0, S, S);
  x.strokeStyle = "rgba(140,175,205,.20)"; x.lineWidth = 2;
  for (i = 0; i <= 8; i++) {
    x.beginPath(); x.moveTo(i * S / 8, 0); x.lineTo(i * S / 8, S); x.stroke();
    x.beginPath(); x.moveTo(0, i * S / 8); x.lineTo(S, i * S / 8); x.stroke();
  }
  x.fillStyle = "rgba(95,200,239,.10)";
  for (i = 0; i < 40; i++) x.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  var t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(6, 6);
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  return t;
}

/* ── Сборка ───────────────────────────────────────────────── */
function build(T, opts) {
  opts = opts || {};
  var tiny = !!opts.tiny;
  var grp = new T.Group();
  var i, m, th;

  var hull = hullTex(T);
  hull.repeat.set(6, 1);
  var wallMat = new T.MeshStandardMaterial({
    map: hull, side: T.BackSide, roughness: 0.66, metalness: 0.28,
    color: 0x93aac2
  });
  var steel = new T.MeshStandardMaterial({ color: 0x3d4c5d, roughness: 0.42, metalness: 0.86 });
  var caseMat = new T.MeshStandardMaterial({ color: 0x1b2c3f, roughness: 0.8, metalness: 0.16 });
  var litCyan = new T.MeshBasicMaterial({ color: 0x5fc8ef, transparent: true, opacity: 0.75, fog: false });
  var litSoft = new T.MeshBasicMaterial({ color: 0x9fe0f6, transparent: true, opacity: 0.3,
    blending: T.AdditiveBlending, depthWrite: false, fog: false });

  /* ── Обшивка тремя поясами ──────────────────────────────
     Средний пояс обрывается у проёма: в носу настоящая дыра в
     борту, и сквозь неё виден тот же космос, что в полёте. */
  var seg = tiny ? 32 : 52;
  var gapA = thetaOf(-WIN_HALF);
  var gapLen = WIN_HALF * 2;
  function band(y0, y1, thetaStart, thetaLength) {
    var sg = Math.max(5, Math.round(seg * (thetaLength / TAU)));
    var mesh = new T.Mesh(
      new T.CylinderGeometry(R_WALL, R_WALL, y1 - y0, sg, 1, true, thetaStart, thetaLength),
      wallMat
    );
    mesh.position.y = (y0 + y1) / 2;
    grp.add(mesh);
    return mesh;
  }
  band(0, WIN_Y0, 0, TAU);
  band(WIN_Y1, H_ROOM, 0, TAU);
  band(WIN_Y0, WIN_Y1, gapA, TAU - gapLen);

  /* ── Настил и потолок ───────────────────────────────────── */
  var floor = new T.Mesh(
    new T.CircleGeometry(R_WALL, tiny ? 34 : 52),
    new T.MeshStandardMaterial({ map: deckTex(T), roughness: 0.82, metalness: 0.28, color: 0xa8bccf })
  );
  floor.rotation.x = -Math.PI / 2;
  grp.add(floor);

  /* Световая полоса по периметру пола: главная линия помещения */
  m = new T.Mesh(new T.RingGeometry(R_WALL * 0.93, R_WALL * 0.985, tiny ? 34 : 52), litCyan);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  grp.add(m);
  m = new T.Mesh(new T.RingGeometry(R_WALL * 0.6, R_WALL * 0.97, tiny ? 26 : 40), litSoft);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.025;
  grp.add(m);

  var ceil = new T.Mesh(
    new T.CircleGeometry(R_WALL, tiny ? 30 : 46),
    new T.MeshStandardMaterial({ color: 0x0f1e2e, roughness: 0.92, metalness: 0.2, side: T.BackSide })
  );
  ceil.rotation.x = -Math.PI / 2;
  ceil.position.y = H_ROOM;
  grp.add(ceil);

  /* Балки потолка сходятся к середине: по ним читается круглая
     комната, а не изогнутая картинка */
  var beams = tiny ? 8 : 12;
  var beamGeo = new T.BoxGeometry(0.14, 0.16, R_WALL * 0.9);
  for (i = 0; i < beams; i++) {
    m = new T.Mesh(beamGeo, steel);
    m.position.set(0, H_ROOM - 0.12, 0);
    m.rotation.y = i / beams * TAU;
    m.translateZ(-R_WALL * 0.52);
    grp.add(m);
  }
  /* Плафон: видно, откуда идёт верхний свет */
  m = new T.Mesh(new T.CircleGeometry(0.95, 24), new T.MeshBasicMaterial({
    color: 0xbfe6f7, transparent: true, opacity: 0.62, fog: false
  }));
  m.rotation.x = Math.PI / 2;
  m.position.y = H_ROOM - 0.03;
  grp.add(m);

  /* ── Стойки на швах секторов ────────────────────────────── */
  var strutGeo = new T.BoxGeometry(0.15, H_ROOM - 0.2, 0.26);
  var stripGeo = new T.PlaneGeometry(0.035, H_ROOM - 0.9);
  for (i = 0; i < 8; i++) {
    th = azOf(i) + SECT / 2;                 /* шов между секторами */
    var col = new T.Group();
    m = new T.Mesh(strutGeo, steel);
    m.position.set(0, 0, -(R_WALL - 0.11));
    col.add(m);
    var nl = new T.Mesh(stripGeo, litCyan);
    nl.position.set(0, 0, -(R_WALL - 0.24));
    col.add(nl);
    col.rotation.y = -th;
    col.position.y = H_ROOM / 2 - 0.05;
    grp.add(col);
  }

  /* ── Семь экранов на стенах ─────────────────────────────
     Пустой стены в обороте быть не должно нигде, кроме сектора
     остекления - это прямое требование владельца. Экран стоит по
     центру своего сектора, в неглубокой нише с козырьком и
     тёплой лампой под ним. */
  var recs = grab();
  var screens = [];
  var faceGeo = new T.PlaneGeometry(1.86, 1.4);
  var hoodGeo = new T.BoxGeometry(1.98, 0.1, 0.3);
  var lampGeo = new T.PlaneGeometry(1.64, 0.03);
  for (i = 1; i <= 7; i++) {
    th = azOf(i);
    var pan = new T.Group();
    var tex = screenTex(T, recs[i - 1], tiny);
    var face = new T.Mesh(faceGeo, new T.MeshBasicMaterial({ map: tex, fog: false }));
    face.position.set(0, 0, -(R_WALL - 0.03));
    pan.add(face);
    /* Козырёк и порожек: у плиты появляются верх и низ, и она
       перестаёт быть наклейкой на стене */
    m = new T.Mesh(hoodGeo, caseMat);
    m.position.set(0, 0.79, -(R_WALL - 0.17));
    pan.add(m);
    m = new T.Mesh(hoodGeo, caseMat);
    m.position.set(0, -0.79, -(R_WALL - 0.15));
    pan.add(m);
    /* Тёплая лампа под козырьком: весь остальной свет холодный, и
       без этой ноты кадр синеет целиком */
    m = new T.Mesh(lampGeo, new T.MeshBasicMaterial({
      color: 0xffd8b4, transparent: true, opacity: 0.4, fog: false
    }));
    m.position.set(0, 0.72, -(R_WALL - 0.13));
    pan.add(m);

    pan.rotation.y = -th;
    pan.position.y = EYE + 0.06;
    grp.add(pan);
    screens.push({ obj: face, th: th, tex: tex, i: i });
  }

  /* ── Рама остекления ────────────────────────────────────── */
  var frameMat = new T.MeshStandardMaterial({
    color: 0x27394b, roughness: 0.36, metalness: 0.82, side: T.DoubleSide
  });
  function arc(y, h, mat) {
    var s = new T.Mesh(
      new T.CylinderGeometry(R_WALL - 0.03, R_WALL - 0.03, h, tiny ? 10 : 16, 1, true,
        gapA - gapLen, gapLen),
      mat || frameMat
    );
    s.position.y = y;
    grp.add(s);
    return s;
  }
  arc(WIN_Y0 - 0.06, 0.13);
  arc(WIN_Y1 + 0.06, 0.13);
  arc(WIN_Y0 + 0.015, 0.02, new T.MeshBasicMaterial({ color: 0x5fc8ef, transparent: true, opacity: 0.6, side: T.BackSide, fog: false }));
  arc(WIN_Y1 - 0.015, 0.02, new T.MeshBasicMaterial({ color: 0x5fc8ef, transparent: true, opacity: 0.6, side: T.BackSide, fog: false }));

  /* Косяки по краям проёма */
  var jambGeo = new T.BoxGeometry(0.16, WIN_Y1 - WIN_Y0 + 0.24, 0.24);
  for (i = 0; i < 2; i++) {
    var jm = new T.Mesh(jambGeo, frameMat);
    var jth = i ? WIN_HALF : -WIN_HALF;
    jm.position.copy(at(jth, R_WALL - 0.08, (WIN_Y0 + WIN_Y1) / 2, T));
    jm.rotation.y = -jth;
    grp.add(jm);
  }

  /* ── Обстановка помещения ───────────────────────────────
     Поручень, кабельные трассы и вентиляция стоят не ради красоты.
     Ближняя дуга поручня проходит перед объективом и едет заметно
     быстрее дальней стены - этот параллакс глаз читает как «я
     нахожусь внутри», и никакая текстура его не заменит. */
  if (!tiny) {
    var rail = new T.Mesh(new T.TorusGeometry(R_WALL - 0.14, 0.04, 5, 44), steel);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 1.06;
    grp.add(rail);
    /* Кронштейны поручня: он к чему-то крепится */
    for (i = 0; i < 8; i++) {
      th = azOf(i) + SECT / 2;
      m = new T.Mesh(new T.BoxGeometry(0.05, 0.05, 0.2), steel);
      m.position.copy(at(th, R_WALL - 0.06, 1.06, T));
      m.rotation.y = -th;
      grp.add(m);
    }
  }

  /* Кабельные трассы поясом под потолком и спуски на стойки:
     вертикаль связывает потолок со стеной, и верх кадра перестаёт
     висеть отдельно */
  var cableMat = new T.MeshStandardMaterial({ color: 0x0e1c2a, roughness: 0.95, metalness: 0.1 });
  for (i = 0; i < (tiny ? 1 : 2); i++) {
    m = new T.Mesh(new T.TorusGeometry(R_WALL - 0.1, 0.055 + i * 0.018, 5, tiny ? 26 : 38), cableMat);
    m.rotation.x = Math.PI / 2;
    m.position.y = H_ROOM - 0.42 - i * 0.12;
    grp.add(m);
  }
  if (!tiny) {
    for (i = 0; i < 4; i++) {
      th = azOf(i * 2) + SECT / 2;
      m = new T.Mesh(new T.BoxGeometry(0.07, 0.9, 0.07), cableMat);
      m.position.copy(at(th, R_WALL - 0.13, H_ROOM - 0.95, T));
      m.rotation.y = -th;
      grp.add(m);
    }
  }

  /* Вентиляционные решётки в плинтусе: мелочь, но именно такие
     мелочи в нижнем поясе объясняют, что помещение рабочее */
  var ventMat = new T.MeshStandardMaterial({ color: 0x4d5f72, roughness: 0.9, metalness: 0.25 });
  var ventGeo = new T.PlaneGeometry(0.86, 0.26);
  for (i = 0; i < (tiny ? 2 : 4); i++) {
    th = azOf(i * 2) + SECT / 2;
    var vt = new T.Mesh(ventGeo, ventMat);
    vt.position.copy(at(th, R_WALL - 0.02, 0.42, T));
    vt.rotation.y = -th;
    grp.add(vt);
  }

  /* ── Приборная ниша под окном ───────────────────────────
     Пульт неглубокий и прижат к носу: всё, что торчит вбок,
     попадает в кадр ещё в салоне и режет обзор поперёк. */
  var con = new T.Group();
  var desk = new T.Mesh(new T.BoxGeometry(3.1, 0.14, 0.86), new T.MeshStandardMaterial({
    color: 0x16283a, roughness: 0.3, metalness: 0.66
  }));
  desk.position.set(0, WIN_Y0 - 0.16, -(R_WALL - 0.62));
  desk.rotation.x = -0.2;
  con.add(desk);
  var riser = new T.Mesh(new T.BoxGeometry(3.4, WIN_Y0 - 0.24, 0.5), caseMat);
  riser.position.set(0, (WIN_Y0 - 0.24) / 2, -(R_WALL - 0.42));
  con.add(riser);
  /* Световая полоса по переднему ребру: тот же нижний свет, что
     подсвечивает голограмму панели */
  var lip = new T.Mesh(new T.BoxGeometry(3.06, 0.022, 0.026), litCyan);
  lip.position.set(0, WIN_Y0 - 0.09, -(R_WALL - 1.02));
  con.add(lip);
  /* Диоды приборов: дышат от общего таймера */
  var diodes = [];
  var dGeo = new T.SphereGeometry(0.028, 6, 5);
  for (i = 0; i < (tiny ? 12 : 22); i++) {
    var warm = i % 4 === 0;
    var d = new T.Mesh(dGeo, new T.MeshBasicMaterial({ color: warm ? 0xa974f5 : 0x5fc8ef, fog: false }));
    d.position.set(-1.32 + (i % 11) * 0.265, WIN_Y0 - 0.1 + (i > 10 ? 0.07 : 0), -(R_WALL - 0.74) + (i > 10 ? 0.2 : 0));
    d.userData.ph = i * 0.7;
    con.add(d);
    diodes.push(d);
  }
  grp.add(con);

  /* ── Корпус кабины в проёме ─────────────────────────────
     Та же картинка, что рамка в полёте, натянутая на плоскость в
     проёме. Смысл в стыке: когда подъезд заканчивается, эта
     плоскость проецируется ровно в тот же прямоугольник, что и
     плоская рамка игры, и подмена одного другим не видна ничем.
     Ставится снаружи, сразу за проёмом, чтобы её края уходили за
     косяки, а не висели в воздухе. */
  var frame = null;
  if (opts.cabSrc) {
    var ldr = new T.TextureLoader();
    var ct = ldr.load(opts.cabSrc);
    if (T.SRGBColorSpace) ct.colorSpace = T.SRGBColorSpace;
    var fw = opts.cabW || 7.6, fh = opts.cabH || 4.34;
    frame = new T.Mesh(new T.PlaneGeometry(fw, fh), new T.MeshBasicMaterial({
      map: ct, transparent: true, depthWrite: false, fog: false, opacity: 0
    }));
    /* Ставим по глазам, а не по середине проёма: корпус обязан
       закрыть кадр ровно так же, как плоская рамка полёта, а она
       центрирована по кадру. Глубину задаёт сцена - от неё же взят
       размер плоскости. */
    var fz = (R_WALL - (opts.camWin || 1.42)) + (opts.cabZ || 1.05);
    frame.position.set(0, EYE, -fz);
    grp.add(frame);
  }

  /* ── Свет помещения ─────────────────────────────────────
     Ламп ровно четыре и больше не будет: каждая лишняя это лишний
     проход по всем материалам сцены в каждом кадре, а салон живёт
     в одном контексте со всем космосом.

     Ключевой холодный - из остекления. Заполняющий держит дальнюю
     половину, иначе за спиной выходит чёрная дыра вместо комнаты.
     Контровой тёплый обводит стойки по кромке. Свет пульта
     разгорается на подходе. */
  var lamp = new T.DirectionalLight(0xcfe9f5, 2.6);
  lamp.position.set(0, 2.4, -7);
  lamp.target.position.set(0, 1.2, 0);
  grp.add(lamp);
  grp.add(lamp.target);
  /* Заполняющий держит дальнюю половину помещения: без него за
     спиной выходит чёрная дыра вместо комнаты */
  grp.add(new T.HemisphereLight(0x3a5f80, 0x0c1826, 1.45));
  /* Плафон под потолком - настоящий источник, а не только пятно:
     по нему на стенах читается спад яркости сверху вниз, и цилиндр
     перестаёт быть ровно закрашенной трубой */
  var ceilL = new T.PointLight(0xbfe6f7, 1.35, 9.5, 1.4);
  ceilL.position.set(0, H_ROOM - 0.5, 0);
  grp.add(ceilL);
  var warmL = new T.PointLight(0xa974f5, 1.7, 9, 1.6);
  warmL.position.set(1.6, 2.6, 1.9);
  grp.add(warmL);
  var deskLight = new T.PointLight(0x5fc8ef, 1.1, 7);
  deskLight.position.set(0, WIN_Y0 + 0.4, -(R_WALL - 1.1));
  grp.add(deskLight);

  return {
    group: grp,
    screens: screens,
    diodes: diodes,
    frame: frame,
    lamp: lamp,
    deskLight: deskLight,
    R: R_WALL, H: H_ROOM, eye: EYE,
    winY: (WIN_Y0 + WIN_Y1) / 2,
    winHalf: WIN_HALF
  };
}

g.RC_CABIN = {
  build: build,
  R: R_WALL,
  eye: EYE,
  sect: SECT,
  winHalf: WIN_HALF,
  /* Азимуты семи экранов - по ним сцена расставляет остановки
     оборота, чтобы камера замирала ровно напротив каждого */
  stops: function () {
    var out = [];
    for (var i = 1; i <= 7; i++) out.push(azOf(i));
    return out;
  }
};

})(window);
