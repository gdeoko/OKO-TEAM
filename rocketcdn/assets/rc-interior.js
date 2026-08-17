/* ═══════════════════════════════════════════════════════════
   Rocket CDN · сцена D: тамбур и рубка корабля

   Вторая половина фильма происходит внутри ракеты. На 72 процентах
   прокрутки камера входит в люк: четыреста миллисекунд кадр
   перекрыт геометрией тамбура, и ровно в этот момент наружная
   сцена гасится, а внутренняя поднимается. Это единственное место
   на сайте, где мы имеем право чуть притормозить человека.

   С 76 до 88 процентов прокрутка раскладывается в полный оборот по
   рубке: четыре панели по девяносто градусов, на каждой свой блок
   содержимого. С 88 до 96 - пульт с анкетой. Дальше камера уходит
   через остекление наружу, и начинается подвал.

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

function measure() {
  var maxS = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
  var rel = doc.getElementById("reliability");
  var con = doc.getElementById("contact");
  if (!rel || !con) return;
  var y = g.pageYOffset || doc.documentElement.scrollTop || 0;
  var relTop = rel.getBoundingClientRect().top + y;
  var conTop = con.getBoundingClientRect().top + y;
  var conBot = con.getBoundingClientRect().bottom + y;

  /* Люк начинает закрываться за половину экрана до блока надёжности */
  P_IN   = Math.max(0.05, Math.min(0.95, (relTop - innerHeight * 0.45) / maxS));
  P_LOCK = Math.max(0.03, P_IN - (innerHeight * 0.4) / maxS);
  P_TURN = Math.max(P_IN + 0.02, Math.min(0.985, (conTop - innerHeight * 0.4) / maxS));
  P_OUT  = Math.max(P_TURN + 0.01, Math.min(0.999, (conBot - innerHeight * 0.2) / maxS));
  P_PREP = Math.max(0.2, P_LOCK - 0.12);
}

var st = {
  built: false, shown: false, slot: false, dead: false,
  p: 0, yaw: 0, yawT: 0, pitch: 0, pitchT: 0, drift: 0
};

var cv = null, rend = null, scene = null, cam = null, grp = null;
var lamp = null, planet = null, diodes = [], anchors = [], lock = null;
var raf = null, lastTs = 0;

var phone = innerWidth < 760;

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
  rend.setPixelRatio(Math.min(phone ? 1.5 : 2, g.devicePixelRatio || 1));
  rend.setSize(innerWidth, innerHeight, false);
  if (rend.outputColorSpace !== undefined) rend.outputColorSpace = T.SRGBColorSpace;
  rend.toneMapping = T.ACESFilmicToneMapping;
  rend.toneMappingExposure = 1.02;

  scene = new T.Scene();
  scene.fog = new T.FogExp2(0x050c15, 0.055);
  cam = new T.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 60);
  cam.position.set(0, 1.6, 0);

  grp = new T.Group();
  scene.add(grp);

  var wall = panelTex(512, 512, false);
  wall.repeat.set(6, 2);

  /* Цилиндр рубки: диаметр 5,2 метра, смотрим изнутри */
  var shell = new T.Mesh(
    new T.CylinderGeometry(2.6, 2.6, 3.4, phone ? 32 : 56, 1, true),
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

  /* Четыре панели по девяносто градусов: на каждой держится свой
     блок содержимого. Их экранные точки уходят в CSS-переменные. */
  var panelMat = new T.MeshStandardMaterial({
    color: 0x14283d, roughness: 0.3, metalness: 0.7,
    emissive: 0x123c5c, emissiveIntensity: 0.9
  });
  var edgeMat = new T.MeshBasicMaterial({ color: 0x42b2dc, transparent: true, opacity: 0.55 });

  for (var i = 0; i < 4; i++) {
    var a = (i / 4) * Math.PI * 2;
    var pan = new T.Group();
    var face = new T.Mesh(new T.PlaneGeometry(2.2, 1.3), panelMat);
    face.position.set(0, 0, -2.52);
    pan.add(face);
    /* Светящаяся кромка сверху, где свет входит */
    var edge = new T.Mesh(new T.PlaneGeometry(2.2, 0.02), edgeMat);
    edge.position.set(0, 0.66, -2.5);
    pan.add(edge);
    pan.rotation.y = a;
    pan.position.y = 1.75;
    grp.add(pan);
    anchors.push({ obj: face, world: new T.Vector3() });
  }

  /* Иллюминаторы между панелями. Нужны не для красоты: при полном
     обороте в кадре не должно быть глухой стены, иначе четверть
     пути человек смотрит в пустоту. За каждым - планета и звёзды. */
  var portTex = planetTex();
  for (i = 0; i < 4; i++) {
    var pa = (i / 4) * Math.PI * 2 + Math.PI / 4;
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
    port.rotation.y = pa;
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
    new T.SphereGeometry(7.5, phone ? 24 : 40, phone ? 18 : 28),
    new T.MeshBasicMaterial({ map: planetTex() })
  );
  planet.position.set(0.6, -3.6, -13);
  grp.add(planet);

  /* Атмосферный ободок планеты */
  var halo = new T.Mesh(
    new T.SphereGeometry(7.85, 28, 20),
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
   Плоский слой поверх кадра. Он перекрывает переход ровно на
   четыреста миллисекунд, и именно под ним меняются сцены. Если
   интерьер почему-то не готов, тамбур держится дольше, живя
   собственной анимацией уплотнителей: чёрного кадра не будет. */
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
  if (!raf) raf = requestAnimationFrame(tick);
}

function hide() {
  if (!st.shown) return;
  st.shown = false;
  root.classList.remove("rc-inside");
  if (cv) cv.classList.remove("on");
  /* Возвращаем наружную сцену: человек листает назад, и ракета
     обязана снова оказаться на месте. */
  if (g.RC_ROCKET && root.classList.contains("rc-rocket-parked")) {
    try { g.RC_ROCKET.start(); root.classList.remove("rc-rocket-parked"); } catch (e) {}
  }
}

/* ── Прогресс ───────────────────────────────────────────────
   Внутри сектора вращение неравномерное: сначала доворот, потом
   полка чтения с еле заметным дрейфом, потом разгон к следующей
   панели. Так текст успевают прочитать, а движение не выглядит
   механическим. */
function sectorEase(k) {
  if (k < 0.3) return (k / 0.3) * 0.39;                       /* доворот 70 градусов из 180 */
  if (k < 0.7) return 0.39 + ((k - 0.3) / 0.4) * 0.045;       /* полка чтения */
  return 0.435 + ((k - 0.7) / 0.3) * 0.565;                   /* разгон */
}

function setProgress(p) {
  st.p = p;

  if (p >= P_PREP && !st.built && T) build();

  /* Тамбур и подмена сцен */
  if (p >= P_LOCK && p < P_IN) {
    lockShow();
    show();
  } else if (p >= P_IN && p < P_OUT) {
    show();
    lockHide();
  } else {
    lockHide();
    if (st.shown) hide();
  }

  if (!st.shown) return;

  /* Оборот: 76-88 процентов раскладываются в полные 360 градусов */
  var k = Math.max(0, Math.min(1, (p - P_IN) / (P_TURN - P_IN)));
  var sector = k * 4;                       /* четыре панели */
  var whole = Math.floor(sector);
  var frac = sector - whole;
  st.yawT = (whole + sectorEase(frac)) * (Math.PI / 2);

  /* После оборота камера доворачивается к пульту и замирает */
  if (p > P_TURN) {
    var kk = Math.min(1, (p - P_TURN) / (P_OUT - P_TURN));
    st.yawT = Math.PI * 2 + kk * 0.12;
    /* Уходим наружу: чуть поднимаем взгляд к остеклению */
    st.pitchT = -kk * 0.12;
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

/* ── Якоря: экранные точки панелей уходят в CSS ──────────── */
var tmp = null;
function publish() {
  if (!T) return;
  if (!tmp) tmp = new T.Vector3();
  var s = root.style;
  for (var i = 0; i < anchors.length; i++) {
    anchors[i].obj.getWorldPosition(tmp);
    tmp.project(cam);
    s.setProperty("--int-anchor-" + i + "-x", ((tmp.x * 0.5 + 0.5) * 100).toFixed(2) + "%");
    s.setProperty("--int-anchor-" + i + "-y", ((-tmp.y * 0.5 + 0.5) * 100).toFixed(2) + "%");
    s.setProperty("--int-anchor-" + i + "-v", (tmp.z < 1 ? 1 : 0));
  }
}

/* ── Кадр ────────────────────────────────────────────────── */
function tick(ts) {
  raf = requestAnimationFrame(tick);
  if (!st.shown || doc.hidden) return;

  /* Держим ту же частоту, что и весь сайт: в простое двадцать */
  var min = g.RC_MOTION ? g.RC_MOTION.minFrame() : 16;
  if (lastTs && ts - lastTs < min - 1) return;
  var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
  lastTs = ts;

  /* Демпфер: резкая прокрутка не должна вертеть рубку рывками */
  st.yaw += (st.yawT + (st.yawOff || 0) - st.yaw) * 0.08;
  st.pitch += (st.pitchT - st.pitch) * 0.09;
  st.drift += dt;

  cam.rotation.order = "YXZ";
  cam.rotation.y = -st.yaw + Math.sin(st.drift / 6) * 0.026;   /* дрейф 3 градуса, период 6 секунд */
  cam.rotation.x = st.pitch;

  /* Диоды дышат от одного таймера с фазовым сдвигом */
  for (var i = 0; i < diodes.length; i++) {
    var d = diodes[i];
    var b = 0.55 + 0.45 * Math.sin(st.drift * 1.6 + d.userData.ph);
    d.material.opacity = b;
    d.material.transparent = true;
    d.scale.setScalar(0.85 + b * 0.35);
  }
  /* Планета медленно едет за окном */
  if (planet) planet.rotation.y += dt * 0.02;

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

  /* Слушаем общий прогресс страницы */
  if (g.RC_MOTION) g.RC_MOTION.on(function (p) { setProgress(p); });
  else addEventListener("scroll", function () {
    var max = Math.max(1, doc.documentElement.scrollHeight - innerHeight);
    setProgress((g.pageYOffset || 0) / max);
  }, { passive: true });
}

addEventListener("rc:3d", boot);
if (g.THREE) boot();

g.RC_INTERIOR = {
  prepare: build,
  show: show,
  hide: hide,
  setProgress: setProgress,
  dispose: dispose,
  ready: function () { return st.built; },
  state: function () { return { построена: st.built, видна: st.shown, слот: st.slot, оборот: (st.yaw * 57.3).toFixed(0) }; }
};

})(window);
