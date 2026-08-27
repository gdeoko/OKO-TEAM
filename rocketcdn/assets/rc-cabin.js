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
/* Половина проёма. Ровно один сектор из восьми и ни градусом
   больше: при 0.62 края соседних экранов заезжали на остекление -
   владелец увидел это первым пунктом, «экраны заходят поверх окон».
   Теперь между кромкой окна и краем экрана остаётся зазор. */
/* Размер проёма задаёт rc-console: рама пульта считается по долям
   кадра, и проём обязан быть шире её внешней кромки на всех
   устройствах, иначе из-под рамы покажется кромка обшивки. Числа
   там же и посчитаны - под телефон 390x932 и монитор 21:9. */
var CON = (typeof window !== "undefined" && window.RC_PANEL) || null;
var WIN_HALF = CON ? CON.WIN_HALF : 0.43;
var WIN_Y0 = CON ? CON.WIN_Y0 : 0.17;   /* низ проёма */
var WIN_Y1 = CON ? CON.WIN_Y1 : 3.06;   /* верх проёма */

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
  /* Метки и заголовки экранов раньше стояли русскими всегда, а строки
     под ними брались со страницы и переводились. На английской версии
     экран получался смешанным: «БОРТОВЫЕ ПОКАЗАТЕЛИ» над английскими
     подписями. Слова экранов теперь идут из одной таблицы и меняются
     вместе с языком страницы. */
  var ru = doc.documentElement.lang !== "en";
  var С = ru ? {
    над: "НАДЁЖНОСТЬ", пок: "БОРТОВЫЕ ПОКАЗАТЕЛИ", вход: "ЧТО ВХОДИТ",
    спр: "СПРАВОЧНИК", борт: "НА БОРТУ",
    сеть: "Сеть в цифрах", вкаждом: "В каждом подключении",
    коротко: "Коротко о главном", инфра: "Инфраструктура"
  } : {
    над: "RELIABILITY", пок: "NETWORK FIGURES", вход: "WHAT IS INCLUDED",
    спр: "HANDBOOK", борт: "ON BOARD",
    сеть: "Network in numbers", вкаждом: "In every connection",
    коротко: "The short answers", инфра: "Infrastructure"
  };

  /* Четыре карточки надёжности */
  var rel = doc.querySelectorAll("#reliability .card");
  for (i = 0; i < rel.length && out.length < 4; i++) {
    t = rel[i].querySelector("h3");
    p = rel[i].querySelector("p");
    if (!t) continue;
    out.push({ tag: С.над, h: t.textContent.trim(), lines: [p ? p.textContent.trim() : ""] });
  }

  /* Показатели сети: числа с их подписями */
  var kpi = doc.querySelectorAll("#kpi .kpi > *");
  var kl = [];
  for (i = 0; i < kpi.length && kl.length < 4; i++) {
    var kn = kpi[i].querySelector(".kpi-n");
    var kt = kpi[i].querySelector(".kpi-l");
    if (kn && kt) kl.push(kn.textContent.trim() + "  " + kt.textContent.trim());
  }
  if (kl.length) out.push({ tag: С.пок, h: С.сеть, lines: kl });

  /* Состав подключения */
  var inc = doc.querySelectorAll("#included .inc-item span");
  var il = [];
  for (i = 0; i < inc.length && il.length < 6; i++) il.push(inc[i].textContent.trim());
  if (il.length) out.push({ tag: С.вход, h: С.вкаждом, lines: il });

  /* Бортовой справочник: первые вопросы */
  var faq = doc.querySelectorAll("#faqList .faq-q span");
  var fl = [];
  for (i = 0; i < faq.length && fl.length < 5; i++) fl.push(faq[i].textContent.trim());
  if (fl.length) out.push({ tag: С.спр, h: С.коротко, lines: fl });

  /* Продукты: чем корабль загружен */
  var pr = doc.querySelectorAll("#products .prod-card h3");
  var pl = [];
  for (i = 0; i < pr.length && pl.length < 6; i++) pl.push(pr[i].textContent.trim());
  if (pl.length) out.push({ tag: С.борт, h: С.инфра, lines: pl });

  var FALL = ru ? [
    { tag: С.над, h: "SLA 99,9%", lines: ["Доступность закреплена договором."] },
    { tag: С.над, h: "Поддержка 24/7", lines: ["Дежурная смена инженеров круглосуточно."] },
    { tag: С.над, h: "Защита от атак", lines: ["Фильтрация на кромке сети."] },
    { tag: С.над, h: "Резерв", lines: ["Дублирование на каждом участке маршрута."] },
    { tag: С.пок, h: С.сеть, lines: ["218 узлов", "3 Тбит/с", "1,5 млн зрителей"] },
    { tag: С.вход, h: С.вкаждом, lines: ["Свой домен и сертификат", "Гибкие правила кэша", "Статистика в кабинете"] },
    { tag: С.спр, h: С.коротко, lines: ["Подключение за один день", "Оплата по факту трафика"] }
  ] : [
    { tag: С.над, h: "SLA 99.9%", lines: ["Availability is fixed by the contract."] },
    { tag: С.над, h: "Support 24/7", lines: ["Engineers on duty around the clock."] },
    { tag: С.над, h: "Attack shield", lines: ["Filtering at the network edge."] },
    { tag: С.над, h: "Redundancy", lines: ["Every leg of the route is duplicated."] },
    { tag: С.пок, h: С.сеть, lines: ["218 nodes", "3 Tbit/s", "1.5M viewers"] },
    { tag: С.вход, h: С.вкаждом, lines: ["Your own domain and certificate", "Flexible cache rules", "Statistics in the panel"] },
    { tag: С.спр, h: С.коротко, lines: ["Connection in a single day", "You pay for the traffic you use"] }
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
/* Фирменный шрифт сайта. Держим его одной строкой: канвас рисует
   текст мгновенно, и если шрифт ещё не подгружен, подставится
   системный - именно поэтому экраны выглядели «простыми». Ниже,
   после готовности шрифтов, текстуры перерисовываются. */
var FONT = "'Golos Text', 'Manrope', system-ui, -apple-system, sans-serif";

/* Текстуры экранов переживают пересборку салона.

   Салон собирается заново на каждый заезд в финал: прокрутил вниз,
   прокрутил вверх, прокрутил вниз. Семь экранов - это семь холстов
   768 на 576, три миллиона точек рисования на каждый заезд, и именно
   они дают ту самую задержку в начале сцены. Слова на них меняются
   только со сменой языка или продукта, поэтому держим готовые
   текстуры и отдаём их снова, пока слова те же.

   Ключ собирается из самих слов: изменилось хоть одно - набор
   рисуется заново, а прежний отдаётся карте. */
var кэшЭкранов = null, кэшКлюч = "";

function ключЭкранов(recs, tiny) {
  var ч = [tiny ? "т" : "ш"];
  for (var i = 0; i < recs.length; i++) {
    ч.push(recs[i].tag, recs[i].h, (recs[i].lines || []).join("|"));
  }
  return ч.join("\u0001");
}

function экраныПоКэшу(T, recs, tiny) {
  var к = ключЭкранов(recs, tiny);
  if (кэшЭкранов && кэшКлюч === к) return кэшЭкранов;
  if (кэшЭкранов) {
    for (var с = 0; с < кэшЭкранов.length; с++) {
      try { кэшЭкранов[с].dispose(); } catch (e) {}
    }
  }
  var набор = [];
  for (var i = 0; i < recs.length; i++) {
    var т = screenTex(T, recs[i], tiny);
    /* Общая текстура: снос салона её не трогает, иначе следующий
       заезд получит освобождённую карту и голую стену. */
    т.__общая = true;
    набор.push(т);
  }
  кэшЭкранов = набор;
  кэшКлюч = к;
  return набор;
}

function screenTex(T, rec, tiny) {
  var W = tiny ? 512 : 768, H = tiny ? 384 : 576;
  var c = cnv(W, H), x = c.getContext("2d"), i;

  /* Подложка полупрозрачная: голограмма светится, а не глушит
     стену за собой. Текст при этом читается - контраст держат
     кромка и общее затемнение. */
  var gr = x.createLinearGradient(0, 0, W * 0.4, H);
  gr.addColorStop(0, "rgba(13,33,53,.46)");
  gr.addColorStop(0.55, "rgba(8,25,42,.38)");
  gr.addColorStop(1, "rgba(5,15,28,.48)");
  x.fillStyle = gr; x.fillRect(0, 0, W, H);

  /* Пятно от лампы ниши сверху */
  var lg = x.createRadialGradient(W * 0.5, -H * 0.1, 10, W * 0.5, H * 0.42, W * 0.7);
  lg.addColorStop(0, "rgba(120,190,235,.22)");
  lg.addColorStop(1, "rgba(120,190,235,0)");
  x.fillStyle = lg; x.fillRect(0, 0, W, H);

  /* Поля внутри экрана широкие, и это не про красоту.

     Экран стоит на стене под углом к взгляду, и внешняя его кромка
     уходит за край кадра. Пока поле было в семь процентов, за кадром
     оставались СЛОВА: панель «Коротко о главном» читалась как «КО О
     ГЛАВНОМ» во всех кадрах акта без исключения. Отодвинуть точку
     обзора целиком нельзя без потери ощущения рубки, а вот увести
     текст внутрь панели можно: тогда за кадром остаётся рамка, а не
     буквы. Шестнадцать процентов покрывают срез с запасом. */
  var PAD = W * 0.16;

  /* Метка раздела */
  x.fillStyle = "#5fc8ef";
  x.font = "700 " + Math.round(W * 0.026) + "px " + FONT;
  x.textBaseline = "top";
  var tag = (rec.tag || "").toUpperCase();
  var sp = "";
  for (i = 0; i < tag.length; i++) sp += tag[i] + (i < tag.length - 1 ? " " : "");
  x.fillText(sp, PAD, PAD);
  x.fillRect(PAD, PAD + W * 0.05, W * 0.09, 2);

  /* Заголовок */
  x.fillStyle = "#eaf4ff";
  x.font = "800 " + Math.round(W * 0.082) + "px " + FONT;
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
  x.font = "500 " + Math.round(W * 0.040) + "px " + FONT;
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
    if (w2 && yy < H - PAD * 1.2) x.fillText(w2, PAD + W * 0.05, yy);
    ly = yy + W * 0.072;
    /* Не начинаем строку, которой не хватит места: обрезанный
       хвост текста на стене читается как брак */
    if (ly > H - PAD * 1.6) break;
  }

  /* Развёртка строк: дисплей, а не плакат */
  /* Развёртка заметнее: строчная сетка - главный признак того,
     что перед нами луч проектора, а не наклеенная панель */
  x.fillStyle = "rgba(5,14,26,.42)";
  for (i = 0; i < H; i += 4) x.fillRect(0, i, W, 1.6);
  /* Горизонтальная полоса подсветки, как у живого дисплея */
  var bandY = H * 0.34;
  var bg2 = x.createLinearGradient(0, bandY - H * 0.1, 0, bandY + H * 0.1);
  bg2.addColorStop(0, "rgba(95,200,239,0)");
  bg2.addColorStop(0.5, "rgba(95,200,239,.06)");
  bg2.addColorStop(1, "rgba(95,200,239,0)");
  x.fillStyle = bg2;
  x.fillRect(0, bandY - H * 0.1, W, H * 0.2);

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
  /* Экран смотрит на нас изнанкой цилиндра, а изнанка переворачивает
     развёртку по горизонтали - текст читался зеркально. Отражаем
     карту заранее, и на стене она встаёт как надо. */
  t.wrapS = T.RepeatWrapping;
  t.repeat.x = -1;
  t.offset.x = 1;
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
  gr.addColorStop(0, "#26323d");
  gr.addColorStop(0.30, "#1d2934");
  gr.addColorStop(0.70, "#121d27");
  gr.addColorStop(1, "#080e14");
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  /* Separate plates catch slightly different exposure. Keeping the
     variation under ten percent avoids the tiled blue-wall look while
     preserving one draw call for the entire cylindrical hull. */
  for (i = 0; i < 8; i++) {
    for (var pj = 0; pj < 4; pj++) {
      x.fillStyle = (i + pj) % 3 === 0 ? "rgba(155,176,193,.035)" : "rgba(0,4,8,.055)";
      x.fillRect(i * W / 8 + 3, pj * H / 4 + 3, W / 8 - 6, H / 4 - 6);
    }
  }
  /* Тёмный пояс у самого низа: тень от настила на стену */
  var sh = x.createLinearGradient(0, H * 0.78, 0, H);
  sh.addColorStop(0, "rgba(6,14,24,0)");
  sh.addColorStop(1, "rgba(6,14,24,.72)");
  x.fillStyle = sh; x.fillRect(0, H * 0.78, W, H * 0.22);
  /* Швы листов */
  x.strokeStyle = "rgba(1,5,9,.88)"; x.lineWidth = 3;
  for (i = 0; i <= 8; i++) {
    x.beginPath(); x.moveTo(i * W / 8, 0); x.lineTo(i * W / 8, H); x.stroke();
  }
  for (i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(0, i * H / 4); x.lineTo(W, i * H / 4); x.stroke();
  }
  /* Заклёпки по швам */
  x.fillStyle = "rgba(180,196,208,.19)";
  for (i = 0; i < 8; i++) {
    for (var j = 0; j < 12; j++) {
      x.beginPath(); x.arc(i * W / 8 + 5, j * H / 12 + 8, 1.45, 0, TAU); x.fill();
    }
  }
  /* Seeded hairline wear: the cabin remains identical between the
     exterior threshold and flight and never reshuffles on reload. */
  var seed = 7727;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  x.lineCap = "round";
  for (i = 0; i < 170; i++) {
    var sx = rnd() * W, sy = rnd() * H, sl = 3 + rnd() * 31;
    x.strokeStyle = "rgba(205,219,228," + (0.018 + rnd() * 0.05).toFixed(3) + ")";
    x.lineWidth = 0.4 + rnd() * 0.7;
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + sl, sy + (rnd() - 0.5) * 2.5); x.stroke();
  }
  var t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  return t;
}

/* Настил: решётка с проступью */
function deckTex(T) {
  var S = 256, c = cnv(S, S), x = c.getContext("2d"), i;
  var bg = x.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, "#18222b"); bg.addColorStop(0.55, "#0b1219"); bg.addColorStop(1, "#05090d");
  x.fillStyle = bg; x.fillRect(0, 0, S, S);
  /* Recessed service bays under the raised grid. */
  for (i = 0; i < 8; i++) {
    for (var j = 0; j < 8; j++) {
      x.fillStyle = (i + j) % 2 ? "rgba(0,3,6,.54)" : "rgba(35,47,58,.25)";
      x.fillRect(i * S / 8 + 4, j * S / 8 + 4, S / 8 - 8, S / 8 - 8);
    }
  }
  x.strokeStyle = "rgba(125,145,160,.26)"; x.lineWidth = 2;
  for (i = 0; i <= 8; i++) {
    x.beginPath(); x.moveTo(i * S / 8, 0); x.lineTo(i * S / 8, S); x.stroke();
    x.beginPath(); x.moveTo(0, i * S / 8); x.lineTo(S, i * S / 8); x.stroke();
  }
  x.fillStyle = "rgba(175,190,200,.18)";
  for (i = 0; i < 48; i++) x.fillRect((i * 47) % S, (i * 83) % S, 1.5, 1.5);
  /* Two restrained guidance strips replace the luminous blue carpet. */
  x.fillStyle = "rgba(95,200,239,.12)";
  x.fillRect(S * 0.12, 0, 2, S); x.fillRect(S * 0.88, 0, 2, S);
  var t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(4, 4);
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  return t;
}

/* Brushed flight-console alloy. This is a material map on the real
   beveled mesh, not a picture of a console: seams and wear therefore
   keep the correct parallax, lighting and silhouette while the camera
   moves. One small shared canvas is enough for colour and micro-bump. */
function consoleTex(T) {
  var W = 512, H = 160, c = cnv(W, H), x = c.getContext("2d"), i;
  var bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#26333d"); bg.addColorStop(0.46, "#111a22");
  bg.addColorStop(1, "#070c11");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  /* Machined longitudinal grain, intentionally sub-pixel and quiet. */
  for (i = 0; i < H; i += 2) {
    x.fillStyle = i % 6 ? "rgba(188,210,221,.018)" : "rgba(0,3,6,.12)";
    x.fillRect(0, i, W, 1);
  }
  /* Separate service cassettes rather than one featureless slab. */
  x.strokeStyle = "rgba(132,170,188,.20)"; x.lineWidth = 1;
  for (i = 1; i < 7; i++) {
    var sx = Math.round(i * W / 7) + 0.5;
    x.beginPath(); x.moveTo(sx, 18); x.lineTo(sx, H - 14); x.stroke();
  }
  x.strokeStyle = "rgba(0,0,0,.72)"; x.lineWidth = 3;
  x.strokeRect(5.5, 5.5, W - 11, H - 11);
  x.strokeStyle = "rgba(118,205,231,.16)"; x.lineWidth = 1;
  x.strokeRect(8.5, 8.5, W - 17, H - 17);
  var seed = 24991;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  for (i = 0; i < 120; i++) {
    var y = 12 + rnd() * (H - 24), xx = rnd() * W, len = 4 + rnd() * 38;
    x.strokeStyle = "rgba(214,227,234," + (0.018 + rnd() * .045).toFixed(3) + ")";
    x.lineWidth = .35 + rnd() * .55;
    x.beginPath(); x.moveTo(xx, y); x.lineTo(Math.min(W, xx + len), y + (rnd() - .5)); x.stroke();
  }
  var t = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  return t;
}

/* Back-lit engravings for the physical keycaps. These are textures on
   meshes which share every cabin transform and every key depression;
   unlike DOM icons they cannot drift away from the alloy beneath. */
function controlGlyphTex(T, idx) {
  var S = 256, c = cnv(S, S), x = c.getContext("2d");
  var warm = idx === 3;
  x.clearRect(0, 0, S, S);
  x.strokeStyle = warm ? "rgba(255,174,112,.98)" : "rgba(157,225,249,.96)";
  x.fillStyle = x.strokeStyle;
  x.lineWidth = 11;
  x.lineCap = "round";
  x.lineJoin = "round";
  x.shadowColor = warm ? "rgba(255,91,33,.90)" : "rgba(52,184,235,.88)";
  x.shadowBlur = 18;
  x.save();
  x.translate(S * 0.5, 102);
  if (idx === 0) {
    x.beginPath(); x.arc(0, 0, 48, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(18, -27); x.lineTo(3, 16); x.lineTo(-28, 31); x.lineTo(-12, -11); x.closePath(); x.stroke();
  } else if (idx === 1) {
    x.beginPath();
    x.moveTo(-48, -18); x.lineTo(-48, -43); x.lineTo(-23, -43);
    x.moveTo(23, -43); x.lineTo(48, -43); x.lineTo(48, -18);
    x.moveTo(48, 18); x.lineTo(48, 43); x.lineTo(23, 43);
    x.moveTo(-23, 43); x.lineTo(-48, 43); x.lineTo(-48, 18); x.stroke();
    x.beginPath(); x.moveTo(-30, 0); x.lineTo(30, 0); x.stroke();
  } else if (idx === 2) {
    x.beginPath(); x.arc(0, 0, 22, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(0, -52); x.lineTo(0, -25); x.moveTo(0, 25); x.lineTo(0, 52);
    x.moveTo(-52, 0); x.lineTo(-25, 0); x.moveTo(25, 0); x.lineTo(52, 0); x.stroke();
  } else if (idx === 3) {
    x.beginPath(); x.arc(0, 0, 42, 0, TAU); x.stroke();
    x.beginPath(); x.arc(0, 0, 9, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(0, -59); x.lineTo(0, -38); x.moveTo(0, 38); x.lineTo(0, 59);
    x.moveTo(-59, 0); x.lineTo(-38, 0); x.moveTo(38, 0); x.lineTo(59, 0); x.stroke();
  } else if (idx === 4) {
    x.beginPath(); x.arc(0, 0, 20, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(0, -53); x.lineTo(0, -24); x.moveTo(0, 24); x.lineTo(0, 53);
    x.moveTo(-53, 0); x.lineTo(-24, 0); x.moveTo(24, 0); x.lineTo(53, 0); x.stroke();
    x.font = "800 25px " + FONT; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("A", 0, 1);
  } else if (idx === 5) {
    x.strokeRect(-38, -38, 76, 76);
  } else if (idx === 6) {
    for (var bi = 0; bi < 4; bi++) {
      var bh = 30 + bi * 15, bx = -43 + bi * 29;
      x.fillRect(bx, 42 - bh, 13, bh);
    }
  } else if (idx === 7) {
    x.beginPath(); x.moveTo(-48, -28); x.lineTo(-10, -42); x.lineTo(28, -20);
    x.lineTo(45, 28); x.lineTo(7, 42); x.lineTo(-32, 20); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(-10, -42); x.lineTo(7, 42); x.moveTo(28, -20); x.lineTo(-32, 20); x.stroke();
  } else if (idx === 8 || idx === 9) {
    x.beginPath(); x.arc(-6, -5, 36, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(20, 22); x.lineTo(53, 54); x.stroke();
    x.beginPath(); x.moveTo(-27, -5); x.lineTo(15, -5);
    if (idx === 8) { x.moveTo(-6, -26); x.lineTo(-6, 16); }
    x.stroke();
  } else if (idx === 10) {
    x.beginPath(); x.moveTo(-48, -23); x.lineTo(-20, -23); x.lineTo(-10, -37);
    x.lineTo(29, -37); x.lineTo(40, -23); x.lineTo(48, -23); x.lineTo(48, 38);
    x.lineTo(-48, 38); x.closePath(); x.stroke();
    x.beginPath(); x.arc(0, 7, 20, 0, TAU); x.stroke();
  } else {
    x.font = "800 92px " + FONT; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("?", 0, 0);
  }
  x.restore();
  if (idx < 7) {
    var labels = ["NAV", "SCAN", "NODE", "FIRE", "AUTO", "STOP", "THR"];
    x.shadowBlur = 10;
    x.font = "800 27px " + FONT;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(labels[idx], S * 0.5, 207);
  }
  var t = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  return t;
}

function controlGlyphAtlas(T) {
  var cell = 256, cols = 4, rows = 3;
  var c = cnv(cell * cols, cell * rows), x = c.getContext("2d");
  for (var i = 0; i < 12; i++) {
    var one = controlGlyphTex(T, i);
    x.drawImage(one.image, (i % cols) * cell, Math.floor(i / cols) * cell);
    if (one.dispose) one.dispose();
  }
  var t = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  return t;
}

/* A machined slab for objects that must catch real cabin light. The
   canvas deck skin remains useful for lettering, but it cannot create
   silhouette, parallax or a contact shadow. These beveled meshes can. */
/* ── Гравированная легенда пульта ────────────────────────────
   Заказчик сформулировал претензию точно: «хуй поймёшь что за
   кнопки и зачем они». И был прав. Названия команд лежали
   гравировкой на самих клавишах, а клавиша занимает на экране
   пару десятков пикселей - подпись выходила ростом в шесть
   пикселей, то есть её не было.

   В настоящей кабине подписывают не клавишу, а панель под ней:
   табличка шире клавиши в разы, поэтому текст читается. Плюс
   команды разложены по зонам с заголовками, и рука знает, куда
   тянуться, не читая каждую надпись.

   Раскладка совпадает с геометрией один в один: семь основных
   клавиш стоят с шагом 0,43 от центра, вспомогательные - на
   плечах пульта. Совпадение обязано быть точным, иначе подпись
   уедет от своей клавиши и станет хуже, чем её отсутствие.

   Отдельная плита, а не рисунок на настиле: у выдавленной
   геометрии настила текстурные координаты идут в мировых
   единицах, и рисунок на ней повторяется три с половиной раза.
   У плоскости координаты честные, от нуля до единицы. */
var LEGEND = {
  ru: { keys: ["КУРС", "СКАН", "УЗЕЛ", "ЗАЛП", "АВТО", "СТОП", "ТЯГА"],
        zones: [["НАВИГАЦИЯ", 0.14], ["РАБОТА С СЕТЬЮ", 0.5], ["ХОД КОРАБЛЯ", 0.86]],
        aux: ["СЕТЬ", "БЛИЖЕ", "ДАЛЬШЕ", "КАДР", "СПРАВКА"],
        warn: "ОСТОРОЖНО" },
  en: { keys: ["COURSE", "SCAN", "NODE", "FIRE", "AUTO", "STOP", "THRUST"],
        zones: [["NAVIGATION", 0.14], ["NETWORK", 0.5], ["DRIVE", 0.86]],
        aux: ["NET", "ZOOM IN", "ZOOM OUT", "FRAME", "HELP"],
        warn: "CAUTION" }
};

function legendTex(T, ru) {
  var L = ru ? LEGEND.ru : LEGEND.en;
  var W = 2048, H = 124, c = cnv(W, H), x = c.getContext("2d");
  x.clearRect(0, 0, W, H);

  /* Бортик: тёмный анодированный алюминий с продольной шлифовкой */
  var bg = x.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "rgba(28,36,44,.96)");
  bg.addColorStop(0.5, "rgba(18,25,32,.96)");
  bg.addColorStop(1, "rgba(11,16,21,.96)");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  for (var i = 0; i < H; i += 3) {
    x.fillStyle = i % 9 ? "rgba(190,212,224,.020)" : "rgba(0,3,6,.10)";
    x.fillRect(0, i, W, 1);
  }

  /* Границы зон: тонкие фрезерованные канавки */
  x.strokeStyle = "rgba(0,0,0,.66)"; x.lineWidth = 3;
  [0.325, 0.695].forEach(function (u) {
    x.beginPath(); x.moveTo(u * W, 8); x.lineTo(u * W, H - 8); x.stroke();
  });
  x.strokeStyle = "rgba(120,190,220,.14)"; x.lineWidth = 1;
  [0.325, 0.695].forEach(function (u) {
    x.beginPath(); x.moveTo(u * W + 2, 8); x.lineTo(u * W + 2, H - 8); x.stroke();
  });

  /* Предупредительная косая штриховка под залпом: команда
     необратимая, и в кабине такие всегда выделены. */
  var wx0 = W * 0.478, wx1 = W * 0.560;
  x.save();
  x.beginPath(); x.rect(wx0, 6, wx1 - wx0, H - 12); x.clip();
  x.fillStyle = "rgba(66,29,11,.9)"; x.fillRect(wx0, 6, wx1 - wx0, H - 12);
  x.strokeStyle = "rgba(226,124,44,.55)"; x.lineWidth = 9;
  for (var s = -120; s < (wx1 - wx0) + 120; s += 26) {
    x.beginPath(); x.moveTo(wx0 + s, H - 6); x.lineTo(wx0 + s + 112, 6); x.stroke();
  }
  x.restore();

  /* Заголовки зон */
  x.textAlign = "center"; x.textBaseline = "middle";
  /* Заголовков зон на бортике нет. Видна ровно одна строка -
     нижнюю половину закрывают сами клавиши, - и эта строка должна
     называть команды, а не разделы. Группы всё равно читаются: по
     промежуткам между гнёздами и по красной зоне у залпа. */

  /* Подписи основных клавиш. Семь штук с шагом 0,43 при ширине
     плиты 3,65: доля центра = 0,5 + (i-3)*0,43/3,65. */
  x.font = "800 62px " + FONT;
  for (i = 0; i < 7; i++) {
    var u = 0.5 + (i - 3) * (0.43 / 3.65);
    var px = u * W;
    var fire = i === 3;
    /* Гравировка: тёмный оттиск плюс подсвеченный кант сверху */
    x.fillStyle = "rgba(0,0,0,.85)";
    x.fillText(L.keys[i], px, 66);
    x.fillStyle = fire ? "rgba(255,196,138,.98)" : "rgba(206,232,246,.94)";
    x.fillText(L.keys[i], px, 63);
    /* Разделитель между гнёздами команд */
    if (i < 6) {
      x.strokeStyle = "rgba(120,170,196,.14)"; x.lineWidth = 1;
      var du = 0.5 + (i - 2.5) * (0.43 / 3.65);
      x.beginPath(); x.moveTo(du * W, 10); x.lineTo(du * W, H - 10); x.stroke();
    }
  }

  /* Крепёж по углам: без него плита выглядит наклейкой */
  [[18, 18], [W - 18, 18], [18, H - 18], [W - 18, H - 18]].forEach(function (p) {
    var g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], 13);
    g.addColorStop(0, "rgba(180,199,214,.85)");
    g.addColorStop(0.62, "rgba(70,86,100,.9)");
    g.addColorStop(1, "rgba(0,0,0,.55)");
    x.fillStyle = g;
    x.beginPath(); x.arc(p[0], p[1], 8, 0, TAU); x.fill();
  });

  var t = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* Табличка вспомогательного переключателя: одна короткая подпись
   на своей маленькой плите. Их пять, и каждая стоит вплотную к
   своему тумблеру на плече пульта. */
function auxLabelTex(T, text) {
  var W = 512, H = 128, c = cnv(W, H), x = c.getContext("2d");
  x.clearRect(0, 0, W, H);
  x.fillStyle = "rgba(16,23,30,.92)";
  x.fillRect(0, 0, W, H);
  x.strokeStyle = "rgba(120,190,220,.18)"; x.lineWidth = 2;
  x.strokeRect(3, 3, W - 6, H - 6);
  x.textAlign = "center"; x.textBaseline = "middle";
  x.font = "800 58px " + FONT;
  x.fillStyle = "rgba(0,0,0,.85)";
  x.fillText(text, W / 2, H / 2 + 3);
  x.fillStyle = "rgba(206,232,246,.94)";
  x.fillText(text, W / 2, H / 2);
  var t = new T.CanvasTexture(c);
  if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundedDeckGeo(T, w, h, d, radius) {
  var s = new T.Shape(), x0 = -w * 0.5, y0 = -h * 0.5;
  var rr = Math.min(radius, w * 0.23, h * 0.23);
  s.moveTo(x0 + rr, y0);
  s.lineTo(x0 + w - rr, y0); s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + rr);
  s.lineTo(x0 + w, y0 + h - rr); s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - rr, y0 + h);
  s.lineTo(x0 + rr, y0 + h); s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - rr);
  s.lineTo(x0, y0 + rr); s.quadraticCurveTo(x0, y0, x0 + rr, y0);
  var bb = Math.min(0.025, w * 0.08, h * 0.12, d * 0.22);
  var g0 = new T.ExtrudeGeometry(s, {
    depth: d, steps: 1, curveSegments: 5,
    bevelEnabled: true, bevelSegments: 2, bevelSize: bb, bevelThickness: bb
  });
  g0.center();
  return g0;
}

/* ── Сборка ───────────────────────────────────────────────── */
/* Секундомер сборки салона. Владелец жалуется на зависание входа
   в ракету; замер prebuild показал, что дольше всего строится
   именно корпус рубки. Чтобы не чинить вслепую, разбиваем сборку
   по разделам. Живёт только под ?rcdbg=1. */
var СБ_DBG = false;
try { СБ_DBG = /[?&]rcdbg=1/.test(location.search); } catch (eД) {}
var СБ_Т = 0, СБ = [];
function сб(имя) {
  if (!СБ_DBG) return;
  var т = performance.now();
  if (СБ_Т) СБ.push([имя, +(т - СБ_Т).toFixed(1)]);
  СБ_Т = т;
}

function build(T, opts) {
  СБ = []; СБ_Т = СБ_DBG ? performance.now() : 0;
  opts = opts || {};
  var tiny = !!opts.tiny;
  var aspect = opts.aspect || (innerWidth / Math.max(1, innerHeight));
  var grp = new T.Group();
  var i, m, th;
  var style = g.RC_SHIP_STYLE || {
    panel: 0x101d2b, steel: 0x6e829a,
    cyan: 0x5fc8ef, cyanSoft: 0x9fe0f6, violet: 0xa974f5
  };

  var hull = hullTex(T);
  hull.repeat.set(6, 1);
  /* Салон освещается физически, но материал берём дешёвый.
     MeshPhongMaterial - полноценный PBR: он считает микрофасеты
     и окружение на каждый пиксель, и пять ламп салона умножали эту
     работу впятеро. На телефоне это и был главный тормоз финальной
     сцены. Phong с бликом даёт ту же картинку интерьера в разы
     дешевле: сталь читается сталью, обшивка обшивкой. */
  var wallMat = new T.MeshPhongMaterial({
    map: hull, side: T.BackSide,
    color: 0x93aac2
  });
  var steel = new T.MeshPhongMaterial({ color: style.steel, shininess: 46, specular: 0x6f8296 });
  var caseMat = new T.MeshPhongMaterial({ color: style.panel, shininess: 12, specular: 0x223447 });
  var litCyan = new T.MeshBasicMaterial({ color: style.cyan, transparent: true, opacity: 0.75, fog: false });
  var litSoft = new T.MeshBasicMaterial({ color: style.cyanSoft, transparent: true, opacity: 0.3,
    blending: T.AdditiveBlending, depthWrite: false, fog: false });

  сб("материалы");
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
  /* Три пояса обшивки держим списком.

     В полёте их надо гасить. Причина геометрическая: камера сидит в
     носу, в двух с лишним метрах от оси, и по краям кадра обшивка
     оказывается ближе к глазу, чем рама пульта. Она перекрывала раму
     двумя синеватыми полосами вдоль левого и правого края экрана -
     ровно там, где рама обязана доходить до кромки. Разглядывать
     обшивку в полёте всё равно некому: перед пилотом рама и космос. */
  var walls = [
    band(0, WIN_Y0, 0, TAU),
    band(WIN_Y1, H_ROOM, 0, TAU),
    band(WIN_Y0, WIN_Y1, gapA, TAU - gapLen)
  ];

  сб("обшивка");
  /* ── Настил и потолок ───────────────────────────────────── */
  var floor = new T.Mesh(
    new T.CircleGeometry(R_WALL, tiny ? 34 : 52),
    new T.MeshPhongMaterial({ map: deckTex(T), shininess: 14, specular: 0x2c3d4f, color: 0xa8bccf })
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
    new T.MeshPhongMaterial({ color: 0x0f1e2e, shininess: 6, side: T.BackSide })
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

  сб("настил");
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

  сб("стойки");
  /* ── Семь экранов на стенах ─────────────────────────────
     Пустой стены в обороте быть не должно нигде, кроме сектора
     остекления - это прямое требование владельца. Экран стоит по
     центру своего сектора, в неглубокой нише с козырьком и
     тёплой лампой под ним. */
  var recs = grab();
  var screens = [];
  /* Экран гнётся по обшивке, а не висит плоской доской. Причина не
     в красоте: плоская плита шириной почти в два метра углами
     выходит за цилиндр стены, и стена закрывает ей края - именно
     поэтому у каждого экрана срезалось начало строки. Гнутый лежит
     по стене целиком, до последнего пикселя.

     Дуга считается из ширины: сколько метров надо показать, столько
     градусов и берём на радиусе стены. */
  /* Один размер на все экраны. Прежняя растяжка на телефоне до 2.32
     давала дугу в целый сектор: экран налезал на швы и на окно -
     владелец видел «за рамки входят». Читаемость на телефоне даёт
     камера (подъезд ближе), а не растяжка стены. */
  /* Ширину ужали с 1.72: на 1.72 дуга экрана равна 34 градусам, и
     вместе с выносом сектора на 45 внешняя кромка уходила за край
     кадра. На 1.52 дуга 30 градусов, и панель входит целиком. */
  var SCR_W = 1.52, SCR_H = 1.34;
  var scrR = R_WALL - 0.14;
  var scrArc = SCR_W / scrR;
  var hoodArc = (SCR_W + 0.22) / (R_WALL - 0.14);
  var набор = экраныПоКэшу(T, recs, tiny);
  for (i = 1; i <= 7; i++) {
    th = azOf(i);
    var tex = набор[i - 1];
    /* Проекция, а не плита: экран оторван от стены на десяток
       сантиметров, полупрозрачен - за ним читается обшивка, - и
       подсвечен сзади мягким конусом. Это и отличает голограмму от
       «прибитой к салону карточки». */
    var face = new T.Mesh(
      new T.CylinderGeometry(scrR, scrR, SCR_H, tiny ? 8 : 14, 1, true,
        thetaOf(th) - scrArc / 2, scrArc),
      new T.MeshBasicMaterial({ map: tex, side: T.BackSide, fog: false,
        transparent: true, opacity: 0.86, depthWrite: false })
    );
    face.position.y = EYE + 0.06;
    face.renderOrder = 6;
    grp.add(face);
    /* Свечение за экраном: луч проектора, упавший на стену */
    var back = new T.Mesh(
      new T.CylinderGeometry(scrR + 0.07, scrR + 0.07, SCR_H + 0.22, tiny ? 8 : 12, 1, true,
        thetaOf(th) - scrArc * 0.58, scrArc * 1.16),
      new T.MeshBasicMaterial({ color: 0x2b8fc4, side: T.BackSide, fog: false,
        transparent: true, opacity: 0.16, blending: T.AdditiveBlending, depthWrite: false })
    );
    back.position.y = EYE + 0.06;
    grp.add(back);

    /* Козырёк и порожек - тоже дуги: прямые короба у краёв ниши
       отходили от стены и висели в воздухе */
    function arcBar(y, h, r, mat) {
      var b = new T.Mesh(
        new T.CylinderGeometry(r, r, h, tiny ? 8 : 14, 1, true,
          thetaOf(th) - hoodArc / 2, hoodArc),
        mat
      );
      b.position.y = y;
      grp.add(b);
      return b;
    }
    arcBar(EYE + 0.92, 0.12, R_WALL - 0.13, caseMat);
    arcBar(EYE - 0.80, 0.11, R_WALL - 0.11, caseMat);
    /* Тёплая лампа под козырьком: весь остальной свет холодный, и
       без этой ноты кадр синеет целиком */
    arcBar(EYE + 0.84, 0.028, R_WALL - 0.2, new T.MeshBasicMaterial({
      color: 0xffd8b4, transparent: true, opacity: 0.45, side: T.BackSide, fog: false
    }));

    screens.push({ obj: face, th: th, tex: tex, i: i });
  }

  сб("экраны");
  /* ── Рама остекления ──────────────────────────────────────
     Собственной рамы у проёма больше нет: её роль взяла на себя
     рама пульта (rc-console). Она идёт по кругу - балка сверху,
     стойки по бокам, приборная плита снизу, косынки в углах - и
     закрывает кромку обшивки со всех сторон. Двойная окантовка
     тут только спорила бы сама с собой и ловила z-конфликт. */
  сб("рама");
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
  var cableMat = new T.MeshPhongMaterial({ color: 0x0e1c2a, shininess: 4 });
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
  var ventMat = new T.MeshPhongMaterial({ color: 0x4d5f72, shininess: 10, specular: 0x2a3a4a });
  var ventGeo = new T.PlaneGeometry(0.86, 0.26);
  for (i = 0; i < (tiny ? 2 : 4); i++) {
    th = azOf(i * 2) + SECT / 2;
    var vt = new T.Mesh(ventGeo, ventMat);
    vt.position.copy(at(th, R_WALL - 0.02, 0.42, T));
    vt.rotation.y = -th;
    grp.add(vt);
  }

  сб("обстановка");
  /* ── Пульт: рама вокруг остекления ──────────────────────
     Пульт собирается отдельным модулем и по долям кадра, а не по
     метрам. Причина простая: раньше он был плитой под окном, и на
     телефоне она занимала весь низ кадра, а на мониторе почти
     пропадала. Теперь балка, стойки, плита и косынки встают в
     одинаковую долю на любом устройстве, а окно живёт внутри рамы.

     Заказчик сформулировал требование дословно: «она должна быть
     по кругу как рамка сверху справа снизу слева». Здесь оно и
     выполняется. */
  var con = new T.Group();
  var console3 = null;
  var controlCaps = [], controlSockets = [], controlGlyphs = [];
  var cassettes = [];
  var pilotRig = new T.Group();
  if (g.RC_PANEL) {
    console3 = g.RC_PANEL.build(T, {
      width: innerWidth, height: innerHeight, tiny: tiny,
      fov: opts.fov || 72, ru: doc.documentElement.lang !== "en"
    });
    con.add(console3.group);
    controlCaps = console3.caps;
    /* Приёмка меряет наклон и место пульта по этому узлу */
    pilotRig = console3.deck || console3.group;
  }
  function syncControlGlyphs() {}
  var diodes = [];
  grp.add(con);

  /* The cockpit shell is geometry above: wall bands, frame, window
     ribs and console. A camera-facing cockpit image used to sit here
     and was the last visible scene swap. Keep the public slot null so
     older flight code remains compatible without drawing a plane. */
  var frame = null;

  /* Отражение приборов в остеклении снято.

     Задумка была верной - стекло, в котором ничего не отражается,
     читается дырой в борту. Но исполнение было плоским: две
     светящиеся дуги поперёк проёма читались синими полосами по
     космосу, и это первое, что видно на любом снимке финальной
     сцены. Настоящее отражение приборной доски даёт сама рама
     (rc-console): у неё физический материал с отражением
     окружения, и стекло получает блик от неё честно. */
  var refl = null, reflLip = null;

  сб("пульт");
  /* ── Свет помещения ─────────────────────────────────────
     Ламп ровно четыре и больше не будет: каждая лишняя это лишний
     проход по всем материалам сцены в каждом кадре, а салон живёт
     в одном контексте со всем космосом.

     Ключевой холодный - из остекления. Заполняющий держит дальнюю
     половину, иначе за спиной выходит чёрная дыра вместо комнаты.
     Контровой тёплый обводит стойки по кромке. Свет пульта
     разгорается на подходе. */
  /* Точечный с ограниченным радиусом вместо направленного:
     направленный - бесконечный, он подкрашивал Землю и планеты
     всего мира, и владелец видел «нереалистичный космос». Этот
     гаснет в десяти метрах - ровно размер салона. */
  /* Свет в салоне. На референсах кадр тёмный, но приборы и стены
     у ламп читаются: свет собран в пятна, а не размазан. Общий
     рассеянный в сцене придавлен намеренно, поэтому вся яркость
     салона держится на этих источниках - их подняли, чтобы панель
     не тонула. */
  var lamp = new T.PointLight(0xcfe9f5, 3.4, 12, 1.4);
  lamp.position.set(0, 2.3, -(R_WALL - 0.7));
  grp.add(lamp);
  /* Заполняющий держит дальнюю половину помещения: без него за
     спиной выходит чёрная дыра вместо комнаты */
  var hemi = new T.HemisphereLight(0x3a5f80, 0x0c1826, 1.05);
  grp.add(hemi);
  /* Плафон под потолком - настоящий источник, а не только пятно:
     по нему на стенах читается спад яркости сверху вниз, и цилиндр
     перестаёт быть ровно закрашенной трубой */
  var ceilL = new T.PointLight(0xbfe6f7, 1.85, 10.5, 1.3);
  ceilL.position.set(0, H_ROOM - 0.5, 0);
  grp.add(ceilL);
  var warmL = new T.PointLight(0xffb066, 2.1, 9, 1.5);
  warmL.position.set(1.6, 2.6, 1.9);
  grp.add(warmL);
  /* Четыре источника вместо пяти: подсветка пульта повторяла
     потолочную, а каждый источник умножает стоимость шейдера
     всех материалов сцены разом */
  var deskLight = new T.PointLight(0x7fd6f5, 2.6, 7);
  deskLight.position.set(0, 1.42, -(R_WALL - 1.1));
  grp.add(deskLight);

  /* Свет пульта переехал в rc-console вместе с самим пультом: рама
     светит собой (световоды по кромке) и двумя короткими
     источниками за отбортовкой. Держать их здесь, привязанными к
     координатам снятой плиты, было нечем. */

  /* Шрифт мог не успеть загрузиться к моменту первой отрисовки:
     тогда текст лёг системной гарнитурой и экран выглядел чужим.
     Как только шрифты готовы, карты собираются заново. */
  if (doc.fonts && doc.fonts.ready && doc.fonts.ready.then) {
    doc.fonts.ready.then(function () {
      for (var si = 0; si < screens.length; si++) {
        var sc = screens[si];
        var nt = screenTex(T, recs[sc.i - 1], tiny);
        var old = sc.obj.material.map;
        sc.obj.material.map = nt;
        sc.obj.material.needsUpdate = true;
        sc.tex = nt;
        if (old && old.dispose) old.dispose();
      }
    });
  }

  сб("свет");
  /* ── Салон переходит на физические материалы ──────────────
     Здесь раньше стоял Phong. В комментарии выше он был назван
     полноценным PBR, и это была ошибка: Phong знает только цвет
     и блик, поэтому обшивка выглядела крашеным пластиком. Standard
     считает металличность, шероховатость и отражение окружения,
     а карты снимают равномерность: появляются шлифовка, царапины
     и осевшая пыль. Формы не трогаем, меняется только ответ
     поверхности на свет.

     Светящиеся элементы (Basic) остаются как есть: это лампы и
     голограммы, физика им не нужна, а свечение им даёт композер. */
  if (g.RC_REAL) {
    try {
      g.RC_REAL.upgradeTree(T, grp, function (mesh, mat) {
        var c = mat.color ? mat.color.getHex() : 0;
        /* Остекление: гладкое, почти зеркальное, слабый рельеф */
        if (mat.transparent && mat.opacity < 0.9) {
          return { kind: "glass", roughness: 0.08, metalness: 0.10, normalScale: 0.12, envMapIntensity: 1.5, repeat: 1 };
        }
        /* Пол и палуба: матовые, затёртые ногами */
        if (c === 0xa8bccf) {
          return { kind: "deck", roughness: 0.62, metalness: 0.42, normalScale: 0.75, envMapIntensity: 0.7, repeat: 5 };
        }
        /* Рама окна и несущий металл: полированный, ловит блики */
        if (c === style.steel || c === 0x4d5f72) {
          return { kind: "hull", roughness: 0.29, metalness: 0.92, normalScale: 0.5, envMapIntensity: 1.6, repeat: 3 };
        }
        /* Клавиши и корпуса приборов: полуматовый крашеный металл */
        if (c === style.panel || c === 0x0f1e2e || c === 0x0e1c2a) {
          return { kind: "panel", roughness: 0.55, metalness: 0.66, normalScale: 0.62, envMapIntensity: 0.9, repeat: 4 };
        }
        return { kind: "hull", roughness: 0.44, metalness: 0.78, normalScale: 0.55, envMapIntensity: 1.15, repeat: 3 };
      });
    } catch (eUp) {}
  }

  сб("физматериалы");
  if (СБ_DBG) { try { console.table(СБ); } catch (eТ2) {} }

  return {
    group: grp,
    "этапы": СБ.slice(),
    cassettes: cassettes,
    screens: screens,
    diodes: diodes,
    frame: frame,
    lamp: lamp,
    refl: refl,
    reflLip: reflLip,
    hemi: hemi,
    ceilL: ceilL,
    warmL: warmL,
    deskLight: deskLight,
    console3: console3,
    controlCaps: controlCaps,
    controlSockets: controlSockets,
    controlGlyphs: controlGlyphs,
    syncControlGlyphs: syncControlGlyphs,
    pilotRig: pilotRig,
    walls: walls,
    R: R_WALL, H: H_ROOM, eye: EYE,
    winY: (WIN_Y0 + WIN_Y1) / 2,
    winHalf: WIN_HALF
  };
}

g.RC_CABIN = {
  build: build,
  /* Содержимое экранов наружу: проверке нужно видеть, что слова
     меняются вместе с языком страницы */
  "экраны": grab,
  "этапы": function () { return СБ.slice(); },
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
