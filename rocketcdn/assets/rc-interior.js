/* ═══════════════════════════════════════════════════════════
   Rocket CDN · сцена D: тамбур и рубка корабля

   Вторая половина фильма происходит внутри ракеты. Камера входит
   в люк: створки тамбура перекрывают кадр, и ровно под ними
   наружная сцена гасится, а внутренняя поднимается. Это
   единственное место на сайте, где мы имеем право чуть
   притормозить человека.

   Дальше прокрутка раскладывается в полный оборот по рубке, а на
   выходе камера возвращается к пульту, за которым лежит анкета.

   Главное, ради чего файл переписан: раньше рубка вращалась сама
   по себе, а карточки содержимого жили отдельной жизнью, и было
   видно, что текст просто едет вниз поверх картинки. Теперь
   поворот камеры - единственный источник правды. Он объявлен
   наружу (yaw), расписан по остановкам (plan) и умеет считать
   экранную точку любой панели (project). Кинематограф из
   rc-cinema.js берёт эти же числа и ставит карточки ровно на те
   панели, мимо которых едет камера. Стены и содержимое двигаются
   одним движением, потому что движение одно.

   Оборот разложен по остановкам, между остановками - синусная
   кривая. У неё нулевая производная на концах, поэтому камера
   сама замирает напротив каждой панели: это и есть полка чтения
   из сценария, только без ручных полок в коде.

   Модели у нас нет и не будет: всё построено процедурно прямо
   здесь. Причина простая - готовый glb с текстурами это триста-
   пятьсот килобайт в критическом пути ради двадцати секунд экрана,
   а процедурная рубка весит ноль байт и грузится мгновенно.

   Бюджет контекстов соблюдаем строго: если свободного слота нет,
   в тамбуре мы забираем слот у наружной сцены - она в этот момент
   всё равно больше не нужна, мы внутри ракеты.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var T = null;                    /* three.js, появляется вместе с объёмным слоем */
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var TAU = Math.PI * 2;

/* Геометрия рубки. Восемь стеновых панелей по кругу: на первых
   четырёх стоят карточки надёжности, на пятой - бортовой
   справочник с вопросами, остальные держат стену, чтобы при
   обороте в кадре не было глухого места. */
var PANELS = 8;
var STEP = TAU / PANELS;         /* сорок пять градусов на остановку */
var R_WALL = 2.52;               /* радиус, на котором висят панели */
var H_WALL = 1.75;               /* высота их центра над полом */
var EYE = 1.6;                   /* глаза человека, он же центр круга */

/* Пороги сцены. В сценарии они записаны процентами прокрутки, но
   проценты живут ровно до первой правки текста: добавили абзац -
   и рубка начинается посреди сценариев применения. Поэтому проценты
   мы считаем из настоящих позиций блоков, которые переехали внутрь
   корабля: надёжность, вопросы, форма. Числа из сценария остаются
   запасным вариантом на случай, если блоков вдруг нет. */
var P_PREP = 0.58;               /* с этого места начинаем строить */
var P_LOCK = 0.72;               /* тамбур */
var P_IN   = 0.76;               /* мы внутри */
var P_TURN = 0.88;               /* оборот закончен, дальше пульт */
var P_OUT  = 0.965;              /* уходим наружу */

/* Расписание оборота: узлы вида [доля прокрутки, поворот в радианах].
   Между узлами идёт синусная кривая, в самих узлах камера стоит.
   Узел - это панель, напротив которой человек читает. */
var KNOT = [];
var PLAN = { step: STEP, rel: [], faq: STEP * 4.5, con: TAU, n: 4 };

function relCards() {
  var n = doc.querySelectorAll("#reliability .card").length;
  return n > 0 ? n : 4;
}

function measure() {
  var maxS = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
  var rel = doc.getElementById("reliability");
  var con = doc.getElementById("contact");
  if (!rel || !con) return;
  var faq = doc.getElementById("faq");
  var y = g.pageYOffset || doc.documentElement.scrollTop || 0;
  var relBox = rel.getBoundingClientRect();
  var conBox = con.getBoundingClientRect();
  var relTop = relBox.top + y, relBot = relBox.bottom + y;
  var conTop = conBox.top + y, conBot = conBox.bottom + y;

  /* Люк начинает закрываться за половину экрана до блока надёжности */
  P_IN   = Math.max(0.05, Math.min(0.95, (relTop - innerHeight * 0.45) / maxS));
  P_LOCK = Math.max(0.03, P_IN - (innerHeight * 0.4) / maxS);
  P_TURN = Math.max(P_IN + 0.02, Math.min(0.985, (conTop - innerHeight * 0.4) / maxS));
  P_OUT  = Math.max(P_TURN + 0.01, Math.min(0.999, (conBot - innerHeight * 0.2) / maxS));
  P_PREP = Math.max(0.2, P_LOCK - 0.12);
  /* Ракета обязана приземлиться до того, как мы войдём в люк:
     заходить внутрь корабля, который ещё летит, странно. */
  g.RC_LAND_AT = P_LOCK;

  /* ── Узлы оборота ──────────────────────────────────────────
     Карточки надёжности разложены по своему блоку, справочник
     вопросов - по своему, остаток оборота уходит на подход к
     пульту. Считаем от настоящих прямоугольников: правка текста
     сдвигает узлы вместе с содержимым, а не ломает раскладку. */
  var n = relCards();
  PLAN.n = n;
  PLAN.rel = [];
  /* Отступы сверху и снизу не декоративные. Кольцо карточек
     держится в середине кадра не весь блок, а пока обёртка идёт
     мимо: до и после этого оно едет вместе со страницей. Узлы
     обязаны уложиться внутрь этого отрезка, иначе последняя
     панель встаёт напротив человека уже после того, как кольцо
     отпустили, и текст читается на отъезжающей стене. */
  var relA = (relTop + innerHeight * 0.22) / maxS;
  var relB = (relBot - innerHeight * 0.85) / maxS;
  if (relB - relA < 0.004) relB = relA + 0.004;

  KNOT = [[P_IN, 0]];
  for (var i = 0; i < n; i++) {
    var a = (i + 0.5) * STEP;
    PLAN.rel.push(a);
    KNOT.push([relA + ((i + 0.5) / n) * (relB - relA), a]);
  }

  PLAN.faq = (n + 0.5) * STEP;
  if (faq) {
    var fb = faq.getBoundingClientRect();
    var fMid = ((fb.top + y) + (fb.bottom + y)) / 2 - innerHeight * 0.15;
    KNOT.push([fMid / maxS, PLAN.faq]);
  }

  PLAN.con = TAU;
  KNOT.push([P_TURN, TAU]);
  KNOT.push([P_OUT, TAU + 0.14]);

  /* Узлы обязаны идти строго по возрастанию: иначе на коротком
     блоке камера дёрнется назад посреди сектора. */
  for (i = 1; i < KNOT.length; i++) {
    if (KNOT[i][0] <= KNOT[i - 1][0]) KNOT[i][0] = KNOT[i - 1][0] + 0.0008;
  }
}

/* Поворот камеры для любой точки страницы. Одна функция на весь
   сайт: и сцена, и карточки спрашивают именно её. */
function yawAt(p) {
  if (!KNOT.length) return 0;
  if (p <= KNOT[0][0]) return KNOT[0][1];
  var last = KNOT.length - 1;
  if (p >= KNOT[last][0]) return KNOT[last][1];
  for (var i = 1; i <= last; i++) {
    if (p > KNOT[i][0]) continue;
    var p0 = KNOT[i - 1][0], p1 = KNOT[i][0];
    var t = (p - p0) / Math.max(1e-6, p1 - p0);
    /* Синус: на концах отрезка скорость ноль, значит камера сама
       останавливается напротив панели и текст успевают прочитать */
    var e = 0.5 - 0.5 * Math.cos(Math.PI * t);
    return KNOT[i - 1][1] + e * (KNOT[i][1] - KNOT[i - 1][1]);
  }
  return KNOT[last][1];
}

var st = {
  built: false, shown: false, slot: false, dead: false,
  p: 0, yaw: 0, yawT: 0, yawOff: 0, pitch: 0, pitchT: 0, drift: 0,
  dolly: 1.7, dollyT: 1.7, fov: 58, fovT: 58, stop: -1,
  sLock: false, sIn: false
};

var cv = null, rend = null, scene = null, cam = null, grp = null;
var lamp = null, planet = null, halo = null, diodes = [], anchors = [], lock = null;
var raf = null, lastTs = 0;

var phone = innerWidth < 760;

function snd() {
  var s = g.RC_SOUND;
  return (s && s.on) ? s : null;
}

/* ── Процедурные текстуры ────────────────────────────────────
   Рисуем обычным двумерным холстом. Панели с фасками, кабельные
   жгуты, перфорация пола: всё это дешевле нарисовать, чем
   привезти картинкой. */
function panelTex(w, h, dark) {
  var c = doc.createElement("canvas");
  c.width = w; c.height = h;
  var x = c.getContext("2d");
  x.fillStyle = dark ? "#0A1524" : "#0E1D2E";
  x.fillRect(0, 0, w, h);

  /* Крупные панели с фаской: свет входит сверху, значит верхняя
     кромка светлее, нижняя темнее. Один и тот же договор о свете,
     что и на плоских карточках сайта. */
  var step = 128;
  for (var y = 0; y < h; y += step) {
    for (var i = 0; i < w; i += step) {
      var pad = 6;
      x.fillStyle = "rgba(226,232,240,.045)";
      x.fillRect(i + pad, y + pad, step - pad * 2, 1);
      x.fillStyle = "rgba(4,12,22,.55)";
      x.fillRect(i + pad, y + step - pad - 1, step - pad * 2, 1);
      x.fillStyle = "rgba(226,232,240,.02)";
      x.fillRect(i + pad, y + pad, 1, step - pad * 2);
    }
  }
  /* Хайрлайн-швы, подсвеченные цианом: фирменная деталь корпуса */
  x.strokeStyle = "rgba(66,178,220,.5)";
  x.lineWidth = 2;
  for (y = step; y < h; y += step * 2) {
    x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke();
  }
  /* Мелкий крепёж */
  x.fillStyle = "rgba(226,232,240,.10)";
  for (var k = 0; k < 160; k++) {
    var px = Math.random() * w, py = Math.random() * h;
    x.beginPath(); x.arc(px, py, 1.6, 0, 6.283); x.fill();
  }
  var tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}

function floorTex() {
  var c = doc.createElement("canvas");
  c.width = c.height = 256;
  var x = c.getContext("2d");
  x.fillStyle = "#070F1A"; x.fillRect(0, 0, 256, 256);
  /* Перфорация технического настила */
  x.fillStyle = "rgba(226,232,240,.06)";
  for (var i = 8; i < 256; i += 16) {
    for (var j = 8; j < 256; j += 16) {
      x.beginPath(); x.arc(i, j, 3, 0, 6.283); x.fill();
    }
  }
  var tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

/* Планета за остеклением: тот же вид, что и в наружной сцене */
function planetTex() {
  var c = doc.createElement("canvas");
  c.width = 512; c.height = 512;
  var x = c.getContext("2d");
  var gr = x.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, "#0A5897");
  gr.addColorStop(0.55, "#0B2B4A");
  gr.addColorStop(1, "#050C15");
  x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
  /* Материки точками, как на глобусе сайта */
  x.fillStyle = "rgba(66,178,220,.55)";
  for (var i = 0; i < 2600; i++) {
    var px = Math.random() * 512, py = Math.random() * 512;
    var n = Math.sin(px * 0.04) * Math.cos(py * 0.03) + Math.sin(py * 0.017);
    if (n < 0.35) continue;
    x.fillRect(px, py, 2, 2);
  }
  /* Огни ночных городов */
  x.fillStyle = "rgba(207,233,245,.85)";
  for (i = 0; i < 90; i++) x.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
  return new T.CanvasTexture(c);
}

/* ── Сборка рубки ────────────────────────────────────────── */
function build() {
  if (st.built || !T) return;

  cv = doc.createElement("canvas");
  cv.id = "intCanvas";
  cv.className = "rc-int-canvas";
  cv.setAttribute("aria-hidden", "true");
  doc.body.appendChild(cv);

  rend = new T.WebGLRenderer({ canvas: cv, antialias: !phone, alpha: true, powerPreference: "high-performance" });
    /* Рубка - самая дорогая сцена на странице: цилиндр, панели,
     иллюминаторы и планета за окном. Считать её в два пикселя на
     точку незачем, разницы на глаз нет, а кадры она забирает
     целиком. Полтора пикселя на мониторе, один с четвертью на
     телефоне. */
  rend.setPixelRatio(Math.min(phone ? 1.25 : 1.5, g.devicePixelRatio || 1));
  rend.setSize(innerWidth, innerHeight, false);
  if (rend.outputColorSpace !== undefined) rend.outputColorSpace = T.SRGBColorSpace;
  rend.toneMapping = T.ACESFilmicToneMapping;
  rend.toneMappingExposure = 1.02;

  scene = new T.Scene();
  scene.fog = new T.FogExp2(0x050c15, 0.055);
  /* Входим с узким углом: в тамбуре тесно. Внутри угол раскрывается
     до семидесяти двух, и человек физически чувствует, что вышел
     из щели в помещение. */
  cam = new T.PerspectiveCamera(st.fov, innerWidth / innerHeight, 0.1, 60);
  cam.position.set(0, EYE, st.dolly);

  grp = new T.Group();
  scene.add(grp);

  var wall = panelTex(512, 512, false);
  wall.repeat.set(6, 2);

  /* Цилиндр рубки: диаметр 5,2 метра, смотрим изнутри */
  var shell = new T.Mesh(
    new T.CylinderGeometry(2.6, 2.6, 3.4, phone ? 24 : 40, 1, true),
    new T.MeshStandardMaterial({ map: wall, side: T.BackSide, roughness: 0.78, metalness: 0.4, color: 0xa9bdd2 })
  );
  shell.position.y = 1.7;
  grp.add(shell);

  /* Пол и потолок */
  var floor = new T.Mesh(
    new T.CircleGeometry(2.6, phone ? 32 : 48),
    new T.MeshStandardMaterial({ map: floorTex(), roughness: 0.92, metalness: 0.2, color: 0x8496a9 })
  );
  floor.rotation.x = -Math.PI / 2;
  grp.add(floor);

  var ceil = new T.Mesh(
    new T.CircleGeometry(2.6, phone ? 24 : 40),
    new T.MeshStandardMaterial({ color: 0x0a1626, roughness: 0.9, metalness: 0.3, side: T.BackSide })
  );
  ceil.rotation.x = -Math.PI / 2;
  ceil.position.y = 3.4;
  grp.add(ceil);

  /* Восемь панелей по кругу. Угол панели совпадает с поворотом
     камеры, при котором человек стоит к ней лицом: панель номер i
     живёт на (i + 0.5) * 45 градусов. Из-за этого карточке
     достаточно знать свой номер, чтобы встать на своё место.

     Три знака минус в rotation.y - не опечатка: камера смотрит
     вдоль минус Z и вращается на минус yaw, поэтому стена, чтобы
     оказаться напротив, обязана повернуться в другую сторону. */
  var panelMat = new T.MeshStandardMaterial({
    color: 0x14283d, roughness: 0.3, metalness: 0.7,
    emissive: 0x123c5c, emissiveIntensity: 0.9
  });
  var edgeMat = new T.MeshBasicMaterial({ color: 0x42b2dc, transparent: true, opacity: 0.55 });
  var faceGeo = new T.PlaneGeometry(1.9, 1.42);
  var edgeGeo = new T.PlaneGeometry(1.9, 0.02);

  for (var i = 0; i < PANELS; i++) {
    var th = (i + 0.5) * STEP;
    var pan = new T.Group();
    var face = new T.Mesh(faceGeo, panelMat);
    face.position.set(0, 0, -R_WALL);
    pan.add(face);
    /* Светящаяся кромка сверху, где свет входит */
    var edge = new T.Mesh(edgeGeo, edgeMat);
    edge.position.set(0, 0.72, -R_WALL + 0.02);
    pan.add(edge);
    pan.rotation.y = -th;
    pan.position.y = H_WALL;
    grp.add(pan);
    anchors.push({ obj: face, th: th });
  }

  /* Иллюминаторы на швах между панелями. Нужны не для красоты: при
     полном обороте в кадре не должно быть глухой стены, иначе
     четверть пути человек смотрит в пустоту. За каждым - планета.
     Шов на нуле занят пультом, поэтому окна начинаются с сорока
     пяти градусов. */
  var portTex = planetTex();
  for (i = 0; i < 4; i++) {
    var pa = STEP + i * (STEP * 2);
    var port = new T.Group();
    var glass = new T.Mesh(
      new T.CircleGeometry(0.52, 28),
      new T.MeshBasicMaterial({ map: portTex, color: 0x9fd8f0 })
    );
    glass.position.set(0, 0, -2.53);
    port.add(glass);
    /* Обрамление: толстое кольцо с цианoвой подсветкой изнутри */
    var ring2 = new T.Mesh(
      new T.TorusGeometry(0.54, 0.07, 8, 28),
      new T.MeshStandardMaterial({ color: 0x16283c, roughness: 0.35, metalness: 0.85,
        emissive: 0x0d3350, emissiveIntensity: 0.6 })
    );
    ring2.position.set(0, 0, -2.5);
    port.add(ring2);
    port.rotation.y = -pa;
    port.position.y = 1.95;
    grp.add(port);
  }

  /* Кабельные трассы под потолком: жгуты идут вдоль стены */
  var cableMat = new T.MeshStandardMaterial({ color: 0x0b1420, roughness: 0.95, metalness: 0.1 });
  for (i = 0; i < (phone ? 2 : 4); i++) {
    var ring = new T.Mesh(new T.TorusGeometry(2.45, 0.045 + i * 0.012, 6, phone ? 24 : 40), cableMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 3.05 - i * 0.09;
    grp.add(ring);
  }

  /* Остекление рубки: единственный настоящий источник света */
  var win = new T.Mesh(
    new T.PlaneGeometry(2.9, 1.35, 1, 1),
    new T.MeshBasicMaterial({ color: 0x0b1a2c, transparent: true, opacity: 0.25 })
  );
  win.position.set(0, 1.85, -2.45);
  grp.add(win);

  planet = new T.Mesh(
    new T.SphereGeometry(7.5, phone ? 18 : 28, phone ? 14 : 20),
    new T.MeshBasicMaterial({ map: planetTex() })
  );
  planet.position.set(0.6, -3.6, -13);
  grp.add(planet);

  /* Атмосферный ободок планеты */
  halo = new T.Mesh(
    new T.SphereGeometry(7.85, 20, 14),
    new T.MeshBasicMaterial({ color: 0x42b2dc, transparent: true, opacity: 0.16, side: T.BackSide, blending: T.AdditiveBlending })
  );
  halo.position.copy(planet.position);
  grp.add(halo);

  /* Пульт под остеклением */
  var deskMat = new T.MeshStandardMaterial({ color: 0x0a1421, roughness: 0.4, metalness: 0.8 });
  var desk = new T.Mesh(new T.BoxGeometry(2.6, 0.12, 0.75), deskMat);
  desk.position.set(0, 1.02, -2.05);
  desk.rotation.x = -0.22;
  grp.add(desk);

  /* Диоды на пульте: дышат от общего таймера с фазовым сдвигом */
  var dGeo = new T.SphereGeometry(0.022, 6, 6);
  for (i = 0; i < (phone ? 10 : 18); i++) {
    var warm = i % 3 === 0;
    var d = new T.Mesh(dGeo, new T.MeshBasicMaterial({ color: warm ? 0x8a59f6 : 0x42b2dc }));
    d.position.set(-1.1 + (i % 9) * 0.26, 1.09 + (i > 8 ? 0.06 : 0), -2.16 + (i > 8 ? 0.16 : 0));
    d.userData.ph = i * 0.7;
    grp.add(d);
    diodes.push(d);
  }

  /* Свет: один настоящий направленный из окна, остальное запечено
     в цвет материалов и в мягкий ambient. Тени не считаем: под
     всем, что должно их отбрасывать, нарисована фактура. */
  lamp = new T.DirectionalLight(0xcfe9f5, 3.4);
  lamp.position.set(-0.8, 2.6, -4);
  scene.add(lamp);
  /* Отражённый свет от планеты: он и держит дальнюю половину рубки,
     иначе за спиной получается чёрная дыра вместо помещения */
  scene.add(new T.HemisphereLight(0x2f4f6d, 0x0a1420, 1.35));
  scene.add(new T.AmbientLight(0x33465e, 1.15));
  var fill = new T.PointLight(0x8a59f6, 1.1, 9);
  fill.position.set(1.4, 1.4, 1.6);
  scene.add(fill);
  var glow = new T.PointLight(0x42b2dc, 0.9, 7);
  glow.position.set(0, 1.4, -1.9);
  scene.add(glow);

  st.built = true;
  try { dispatchEvent(new CustomEvent("rc:interior-ready")); } catch (e) {}
}

/* ── Тамбур ──────────────────────────────────────────────────
   Плоский слой поверх кадра. Он перекрывает переход, и именно под
   ним меняются сцены. Если интерьер почему-то не готов, тамбур
   держится дольше, живя собственной анимацией уплотнителей:
   чёрного кадра не будет.

   Створки - половина ощущения. Вторая половина в том, что камера
   в это время реально едет вперёд (см. st.dolly) и угол объектива
   раскрывается. Створки говорят «закрылось», движение говорит
   «ты прошёл», и вместе они читаются как вход, а не как склейка. */
function lockShow() {
  if (lock) return;
  lock = doc.createElement("div");
  lock.className = "rc-int-lock";
  lock.setAttribute("aria-hidden", "true");
  lock.innerHTML =
    '<i class="rc-lock-l"></i><i class="rc-lock-r"></i>' +
    '<span class="rc-lock-tx">FAST. RELIABLE. GLOBAL.</span>';
  doc.body.appendChild(lock);
  requestAnimationFrame(function () { if (lock) lock.classList.add("on"); });
}

function lockHide() {
  if (!lock) return;
  var el = lock;
  lock = null;
  el.classList.remove("on");
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 460);
}

/* ── Показать и спрятать ─────────────────────────────────── */
function takeSlot() {
  if (st.slot) return true;
  if (g.RC_GL && g.RC_GL.take) {
    if (g.RC_GL.take()) { st.slot = true; return true; }
    /* Свободного слота нет. Наружная сцена нам его отдаст: по
       сценарию в этот момент мы уже внутри ракеты и снаружи
       смотреть не на что. */
    if (g.RC_ROCKET) {
      try {
        g.RC_ROCKET.stop();
        root.classList.add("rc-rocket-parked");
        g.RC_GL.give();
      } catch (e) {}
      if (g.RC_GL.take()) { st.slot = true; return true; }
    }
    return false;
  }
  st.slot = true;
  return true;
}

function show() {
  if (st.shown || st.dead) return;
  if (!takeSlot()) return;
  build();
  if (!st.built) return;
  st.shown = true;
  root.classList.add("rc-inside");
  if (cv) cv.classList.add("on");
  if (g.RC_ROCKET && !root.classList.contains("rc-rocket-parked")) {
    try { g.RC_ROCKET.stop(); root.classList.add("rc-rocket-parked"); } catch (e) {}
  }
  lastTs = 0;
  if (!raf) raf = requestAnimationFrame(tick);
}

function hide() {
  if (!st.shown) return;
  st.shown = false;
  root.classList.remove("rc-inside");
  if (cv) cv.classList.remove("on");
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  /* Возвращаем наружную сцену: человек листает назад, и ракета
     обязана снова оказаться на месте. */
  if (g.RC_ROCKET && root.classList.contains("rc-rocket-parked")) {
    try { g.RC_ROCKET.start(); root.classList.remove("rc-rocket-parked"); } catch (e) {}
  }
}

/* ── Прогресс ─────────────────────────────────────────────── */
function setProgress(p) {
  st.p = p;

  if (p >= P_PREP && !st.built && T) build();

  /* Тамбур и подмена сцен.

     Подмену наружной сцены на рубку теперь назначает сам корабль:
     пока его люк не открыт и проём не накрыл кадр, снаружи есть что
     показывать - ракета, к которой мы идём. Раньше порог считался
     от процентов страницы и срабатывал раньше входа: ракета гасла
     на полпути, а поверх кадра появлялись створки «ниоткуда».
     Флаг rc-in-hatch ставит rc-rocket, когда мы уже в проёме. */
  var hatch = root.classList.contains("rc-in-hatch");
  var hasRocket = typeof g.RC_DOOR === "number";
  /* Обратный ход: пока мы внутри, корабль остановлен и долю двери
     сам не пересчитает. Поэтому наружные акты снимают флаг сами -
     иначе из салона нельзя было бы выйти скроллом назад. */
  var sc = g.RC_SCENE;
  if (hatch && sc && (sc.act === "walk" || sc.act === "landing" || sc.act === "route")) {
    root.classList.remove("rc-in-hatch");
    hatch = false;
  }
  /* Внутренние акты сцены: салон, справочник, пульт. Пока мы в них,
     рубка держится, даже если доля люка уже стекла - корабль в этот
     момент остановлен и ничего не считает. Вход же честный: либо мы
     прошли сквозь открытый люк (hatch), либо попали в салон прыжком
     по якорю, и тогда запасной порог по прогрессу. */
  var innerAct = sc && (sc.act === "cabin" || sc.act === "manual" || sc.act === "console");
  var ready = hasRocket
    ? (hatch || (st.shown && innerAct) || (innerAct && p >= P_IN))
    : (p >= P_LOCK);

  if (ready && p < P_IN) {
    /* Полноэкранных створок больше нет: дверь у нас настоящая, в
       борту. Тамбур остаётся только как затемнение стыка, если
       корабля на странице нет (упрощённый режим, нет WebGL). */
    if (!hasRocket) lockShow();
    show();
    /* Тяжёлый лязг замка: створки сомкнулись за спиной */
    if (!st.sLock) {
      st.sLock = true;
      var s1 = snd();
      if (s1 && s1.boom) { try { s1.boom(); } catch (e) {} }
    }
  /* Запасной порог по прогрессу оставлен только для страниц без
     корабля. С кораблём вход честный - через его люк: на телефоне
     разделы сжаты, порог достигался ещё в проходе, и рубка
     включалась до того, как дверь вообще тронулась. */
  } else if ((ready || (!hasRocket && p >= P_IN)) && p < P_OUT) {
    show();
    lockHide();
    /* Давление выровнялось, внутренний люк расходится: две ноты
       вверх. Ровно один раз за вход, обратный ход их сбрасывает. */
    if (!st.sIn) {
      st.sIn = true;
      var s2 = snd();
      if (s2 && s2.blip) {
        try {
          s2.blip(392);
          setTimeout(function () { var s3 = snd(); if (s3 && s3.blip) s3.blip(587); }, 190);
        } catch (e) {}
      }
    }
  } else {
    lockHide();
    if (st.shown) hide();
    if (p < P_LOCK) { st.sLock = false; st.sIn = false; st.stop = -1; }
  }

  /* Вход: створки перекрывают кадр, а камера в это время едет
     вперёд из тамбура в центр рубки и раскрывает объектив. */
  /* Ход камеры вперёд синхронен с открытием люка: когда дверь
     корабля разошлась наполовину, мы уже наполовину в тамбуре */
  var enter = hasRocket
    ? Math.max(0, Math.min(1, ((g.RC_DOOR || 0) - 0.45) / 0.5))
    : Math.max(0, Math.min(1, (p - P_LOCK) / Math.max(1e-4, (P_IN - P_LOCK) * 1.75)));
  var eIn = 0.5 - 0.5 * Math.cos(Math.PI * enter);
  st.dollyT = 1.7 * (1 - eIn);
  st.fovT = 58 + eIn * 14;
  root.style.setProperty("--int-enter", eIn.toFixed(3));

  if (!st.shown) return;

  st.yawT = yawAt(p);

  /* После оборота камера подступает к пульту и замирает */
  if (p > P_TURN) {
    var kk = Math.min(1, (p - P_TURN) / Math.max(1e-4, P_OUT - P_TURN));
    st.dollyT = -0.42 * kk;
    st.pitchT = -kk * 0.12;
  }

  /* Щелчок фиксации: камера встала напротив очередной панели */
  var stop = Math.floor(st.yawT / STEP);
  if (stop !== st.stop) {
    if (st.stop >= 0 && !root.classList.contains("rc-fast")) {
      var s4 = snd();
      if (s4 && s4.blip) { try { s4.blip(560 + (stop % 4) * 55); } catch (e) {} }
    }
    st.stop = stop;
  }
}

/* ── Наклон от мыши: без гироскопа и без разрешений ───────── */
if (!phone) {
  addEventListener("mousemove", function (e) {
    if (!st.shown) return;
    var nx = (e.clientX / innerWidth - 0.5) * 2;
    var ny = (e.clientY / innerHeight - 0.5) * 2;
    st.pitchT = -ny * 0.21 + (st.p > P_TURN ? -0.1 : 0);      /* около 12 градусов */
    st.yawOff = nx * 0.1;
  }, { passive: true });
}

/* ── Проекция: где панель оказалась на экране ────────────────
   Считаем вручную, а не через project(): у точки за спиной знак
   однородной координаты меняется, и штатная проекция возвращает
   зеркальный экранный адрес. Раньше на этом ловились якоря -
   панель позади камеры отдавала координату панели впереди, и
   карточка уезжала не туда.

   Возвращаем доли экрана (0..1), расстояние в метрах, масштаб
   относительно опорного и запас читаемости v: единица - панель в
   середине кадра, ноль - ушла за край или за спину. */
var vTmp = null;
function project(th, h) {
  var out = { x: 0.5, y: 0.5, d: 99, s: 0.5, v: 0 };
  if (!st.built || !cam) return out;
  if (!vTmp) vTmp = new T.Vector3();
  cam.updateMatrixWorld();
  vTmp.set(R_WALL * Math.sin(th), h === undefined ? H_WALL : h, -R_WALL * Math.cos(th));
  vTmp.applyMatrix4(cam.matrixWorldInverse);
  var d = -vTmp.z;
  out.d = d;
  if (d < 0.15) return out;                      /* за спиной: адреса нет */
  var f = 1 / Math.tan(cam.fov * Math.PI / 360);
  var ndcX = (vTmp.x / d) * f / cam.aspect;
  var ndcY = (vTmp.y / d) * f;
  out.x = ndcX * 0.5 + 0.5;
  out.y = -ndcY * 0.5 + 0.5;
  out.s = (R_WALL + EYE * 0.25) / d;
  var edge = Math.abs(ndcX);
  out.v = edge > 1.6 ? 0 : (edge < 0.55 ? 1 : (1.6 - edge) / 1.05);
  return out;
}

/* ── Якоря: экранные точки панелей уходят в CSS ────────────
   Переменные --int-anchor-N-x / -y / -v объявлены для всех
   восьми панелей. Первые четыре - те, на которых стоят карточки
   надёжности, ими же пользуется rc-interior.css. */
function publish() {
  if (!T || !st.built) return;
  var s = root.style;
  for (var i = 0; i < anchors.length; i++) {
    var pr = project(anchors[i].th, H_WALL);
    s.setProperty("--int-anchor-" + i + "-x", (pr.x * 100).toFixed(2) + "%");
    s.setProperty("--int-anchor-" + i + "-y", (pr.y * 100).toFixed(2) + "%");
    s.setProperty("--int-anchor-" + i + "-v", pr.v.toFixed(3));
  }
  s.setProperty("--int-yaw", (st.yaw * 57.2958).toFixed(1) + "deg");
}

/* ── Кадр ────────────────────────────────────────────────── */
function tick(ts) {
  raf = requestAnimationFrame(tick);
  if (!st.shown || doc.hidden) return;
  /* В демо-полёте рубка спит: весь кадровый бюджет у космоса */
  if (root.classList.contains("rc-flying")) { lastTs = 0; return; }

  /* Держим ту же частоту, что и весь сайт: в простое двадцать */
  var min = g.RC_MOTION ? g.RC_MOTION.minFrame() : 16;
  if (lastTs && ts - lastTs < min - 1) return;
  var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;

  var fast = root.classList.contains("rc-fast");

  /* Демпфер: резкая прокрутка не должна вертеть рубку рывками.
     Коэффициент считаем от времени кадра, а не от кадра как
     такового: в простое сайт роняет частоту до двадцати, и на
     постоянном коэффициенте камера доезжала бы втрое дольше -
     человек уже читает, а стена ещё едет. На перемотке постоянную
     укорачиваем, иначе камера отстаёт от содержимого и карточки
     повисают на пустой стене. */
  var kY = 1 - Math.exp(-dt / (fast ? 0.06 : 0.17));
  st.yaw += (st.yawT + (fast ? 0 : st.yawOff) - st.yaw) * kY;
  st.pitch += ((fast ? 0 : st.pitchT) - st.pitch) * kY;
  st.dolly += (st.dollyT - st.dolly) * kY;
  st.drift += dt;

  var drift = fast ? 0 : Math.sin(st.drift / 6) * 0.026;   /* дрейф 3 градуса, период 6 секунд */
  cam.rotation.order = "YXZ";
  cam.rotation.y = -st.yaw + drift;
  cam.rotation.x = st.pitch;
  /* Камера едет по своей оси взгляда: в тамбуре она позади центра,
     внутри встаёт ровно в центр круга, у пульта подступает ближе. */
  cam.position.set(-Math.sin(st.yaw) * st.dolly, EYE, Math.cos(st.yaw) * st.dolly);

  if (Math.abs(st.fov - st.fovT) > 0.05) {
    st.fov += (st.fovT - st.fov) * 0.1;
    cam.fov = st.fov;
    cam.updateProjectionMatrix();
  }

  /* Диоды дышат от одного таймера с фазовым сдвигом */
  if (!fast) {
    for (var i = 0; i < diodes.length; i++) {
      var d = diodes[i];
      var b = 0.55 + 0.45 * Math.sin(st.drift * 1.6 + d.userData.ph);
      d.material.opacity = b;
      d.material.transparent = true;
      d.scale.setScalar(0.85 + b * 0.35);
    }
    /* Планета медленно едет за окном */
    if (planet) planet.rotation.y += dt * 0.02;
  }

  publish();
  rend.render(scene, cam);
}

/* ── Размер и потеря контекста ───────────────────────────── */
addEventListener("resize", function () {
  phone = innerWidth < 760;
  if (!rend) return;
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  rend.setSize(innerWidth, innerHeight, false);
}, { passive: true });

function dispose() {
  st.dead = true;
  hide();
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  if (rend) { try { rend.dispose(); } catch (e) {} }
  if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
  if (st.slot && g.RC_GL) { g.RC_GL.give(); st.slot = false; }
  st.built = false;
}

/* ── Точка входа ─────────────────────────────────────────── */
function boot() {
  if (reduced || root.classList.contains("rc-reduced")) return;
  T = g.THREE;
  if (!T) return;
  if (g.RC_GL) {
    g.RC_GL.guard(cv, function () {
      st.shown = false;
      root.classList.remove("rc-inside");
    }, function () {
      if (st.p >= P_IN && st.p < P_OUT) show();
    });
  }
  measure();
  doc.addEventListener("rc:lang", function () { setTimeout(measure, 200); });
  addEventListener("resize", function () { setTimeout(measure, 250); }, { passive: true });
  addEventListener("load", function () { setTimeout(measure, 400); });

  /* Люк корабля открылся - подхватываем сцену тем же кадром, не
     дожидаясь следующего тика прокрутки: окно перехода короткое, и
     опоздание на кадр читается провалом в пустоту. */
  addEventListener("rc:hatch", function (e) {
    if (e && e.detail && e.detail.deep) setProgress(st.p);
  });

  /* Слушаем общий прогресс страницы */
  if (g.RC_MOTION) g.RC_MOTION.on(function (p) { setProgress(p); });
  else addEventListener("scroll", function () {
    var max = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
    setProgress((g.pageYOffset || 0) / max);
  }, { passive: true });
}

/* Ступени качества. Общий сторож кадров в rc-motion.js считает
   тяжёлые кадры и сообщает ступень: на первой мы считаем меньше
   пикселей, на второй гасим планету за окном и её ободок, на
   третьей рубка не поднимается вовсе - вместо кино человек
   получает обычную страницу, но без рывков. */
addEventListener("rc:degrade", function (e) {
  var step = (e && e.detail && e.detail.step) || 0;
  try {
    if (step >= 1 && rend) rend.setPixelRatio(1);
    if (step >= 2) {
      if (planet) planet.visible = false;
      if (halo) halo.visible = false;
      if (scene && scene.fog) scene.fog.density = 0.02;
    }
    /* Третья ступень: рубки нет. Сообщаем об этом кораблю - он не
       поведёт нас в проём, из которого нечему открыться, и вход
       останется обычным переходом к разделу. */
    if (step >= 3) { hide(); st.dead = true; g.RC_NO_CABIN = true; }
  } catch (err) {}
});

addEventListener("rc:3d", boot);
if (g.THREE) boot();

g.RC_INTERIOR = {
  prepare: build,
  show: show,
  hide: hide,
  setProgress: setProgress,
  dispose: dispose,
  ready: function () { return st.built; },

  /* Единственный источник правды о повороте. Кинематограф берёт
     его же, поэтому стены и карточки не могут разъехаться. */
  yaw: function () { return st.yaw; },
  yawAt: yawAt,

  /* Расписание панелей: на каком угле стоит какая карточка */
  plan: function () { return PLAN; },

  /* Экранная точка панели: доли ширины и высоты кадра */
  project: project,

  /* Можно ли сейчас вешать содержимое на стены */
  live: function () {
    return !!(st.built && st.shown && !root.classList.contains("rc-reduced") &&
      root.getAttribute("data-degrade") !== "3");
  },

  /* Пересчитать пороги: кинематограф меняет высоту блока
     надёжности и обязан сказать об этом сцене */
  remeasure: measure,

  state: function () {
    return {
      построена: st.built, видна: st.shown, слот: st.slot,
      оборот: (st.yaw * 57.3).toFixed(0),
      проход: st.dolly.toFixed(2),
      узлов: KNOT.length,
      /* Пороги входа: по ним видно, почему салон показался или нет */
      доля: +st.p.toFixed(3), порог_вход: +P_IN.toFixed(3),
      порог_выход: +P_OUT.toFixed(3), мёртв: st.dead
    };
  }
};

})(window);
