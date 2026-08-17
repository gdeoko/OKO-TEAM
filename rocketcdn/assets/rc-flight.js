/* ═══════════════════════════════════════════════════════════
   Rocket CDN · демо-полёт: космос от первого лица

   Заказчик попросил отдельный режим «полетать»: сесть в ракету,
   облететь Землю, пройти мимо Луны и Марса, над кольцами Сатурна,
   обогнуть чёрную дыру, прыгнуть через гиперпространство и
   вернуться домой. Не видео, а настоящий трёхмерный мир: им
   управляет сам человек.

   Правила мира:
   - Ведёт прокрутка. Колесо, палец, стрелки - это тяга корабля.
     Остановился - корабль плывёт по инерции и замирает. Никакого
     автопилота, кроме плавного доворота камеры к цели.
   - Мышь и палец по горизонтали - взгляд. Камера отклоняется на
     четверть оборота и мягко возвращается: смотреть по сторонам
     можно, потеряться нельзя.
   - Панель корабля чуть видна снизу кадра: присутствие в кабине
     есть, но девяносто процентов кадра - космос. Так просил
     клиент, слово в слово.
   - Земля и Луна - настоящие снимки NASA на сферах. Марс и Сатурн
     дальше и мельче, им хватает процедурной живописи: полосы и
     шум в нужной палитре, нарисованные на холсте при старте.
   - Чёрная дыра - шейдер: тонкий горячий диск, провал в центре.
   - Выход в любой момент: крестик, Esc, кнопка в конце маршрута.
     Страница под полётом стоит нетронутой и ждёт.

   Пока полёт открыт, остальные сцены сайта спят: событие rc:flight
   останавливает ракету, рубку и глобус, чтобы весь кадровый
   бюджет достался космосу. Закрыли - всё просыпается на месте.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var reduced = false;
try { reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

var RU = doc.documentElement.lang !== "en";

/* Подписи по маршруту: где мы и почему это про CDN */
var CAPTIONS = [
  { p: 0.00, t: RU ? "ЗЕМЛЯ · 218 точек присутствия Rocket CDN" : "EARTH · 218 Rocket CDN points of presence" },
  { p: 0.15, t: RU ? "ЛУНА · 384 000 км · пинг 2,6 с" : "MOON · 384,000 km · ping 2.6 s" },
  { p: 0.27, t: RU ? "РАЗГОН · контент идёт с ближайшего узла" : "ACCELERATION · content ships from the nearest node" },
  { p: 0.36, t: RU ? "МАРС · 225 млн км · без кеша сюда" : "MARS · 225M km · no cache out here" },
  { p: 0.50, t: RU ? "САТУРН · 1,4 млрд км от ваших пользователей" : "SATURN · 1.4B km from your users" },
  { p: 0.63, t: RU ? "ЧЁРНАЯ ДЫРА · так выглядит сайт без CDN" : "BLACK HOLE · a site with no CDN looks like this" },
  { p: 0.76, t: RU ? "ГИПЕРПРЫЖОК · Rocket доставляет быстрее" : "HYPERJUMP · Rocket delivers faster" },
  { p: 0.90, t: RU ? "ДОМА · заявка - и ваш контент на сверхскорости" : "HOME · one request away from lightspeed content" }
];

var F = {
  open: false, built: false,
  p: 0, v: 0, look: { x: 0, y: 0, tx: 0, ty: 0 },
  last: 0, raf: null, shake: 0,
  auto: true, goal: null
};

var ui = {};      /* DOM оверлея */
var W3 = null;    /* всё трёхмерное */

/* Журнал исследователя: что уже открыто наведением. Живёт в
   localStorage - вернувшись на сайт, человек продолжает свой
   список, а не начинает заново. */
var LOG_KEY = "rcdn.explored";
var explored = {};
try { explored = JSON.parse(localStorage.getItem(LOG_KEY) || "{}") || {}; } catch (e) { explored = {}; }
function noteExplored(name) {
  if (explored[name]) return;
  explored[name] = 1;
  try { localStorage.setItem(LOG_KEY, JSON.stringify(explored)); } catch (e) {}
  paintProgress();
  var total = 10, got = Object.keys(explored).length;
  if (got >= total && g.RC_SOUND && g.RC_SOUND.uiConfirm) { try { g.RC_SOUND.uiConfirm(); } catch (e) {} }
}
function paintProgress() {
  if (!ui.prog) return;
  var got = Object.keys(explored).length, total = 10;
  ui.prog.textContent = (RU ? "Исследовано " : "Explored ") + Math.min(got, total) + "/" + total;
  ui.prog.classList.toggle("full", got >= total);
}

/* Три вселенные: своя окраска неба, туманностей, звёзд и солнца.
   Мир один, но за гипер-вспышкой он оживает в другом свете - и его
   хочется исследовать заново. */
var UNIVERSES = [
  { name: RU ? "СОЛНЕЧНАЯ СИСТЕМА" : "SOLAR SYSTEM",
    sky: 0x9db4cc, amb: 0x3a4a68, neb: [0x42b2dc, 0x8a59f6], sun: 0xfff2dc,
    stars: [0xcfe9f5, 0x8fb7ff, 0xffe9c9] },
  { name: RU ? "ВСЕЛЕННАЯ RV-2" : "UNIVERSE RV-2",
    sky: 0xa08cd8, amb: 0x4a3468, neb: [0x8a59f6, 0xd06bff], sun: 0xe8d4ff,
    stars: [0xe2d4ff, 0xb08cff, 0xffc9ec] },
  { name: RU ? "ВСЕЛЕННАЯ RC-3" : "UNIVERSE RC-3",
    sky: 0xd8b48c, amb: 0x684a34, neb: [0xffb066, 0xff7a4d], sun: 0xffe0b0,
    stars: [0xffe9cf, 0xffc98f, 0xc9e2ff] }
];
var uniIdx = 0;

/* ── Оверлей ─────────────────────────────────────────────────
   DOM собирается один раз при первом открытии: кнопка полёта не
   должна ничего стоить тем, кто её не нажал. */
function buildUI() {
  if (ui.wrap) return;
  var w = doc.createElement("div");
  w.className = "rc-flight";
  /* Цели навигации: по ним корабль умеет долетать сам. Отметки p
     подставляются после сборки мира из честных позиций на дуге. */
  var NAV = [
    { id: "earth", t: RU ? "Земля" : "Earth" },
    { id: "moon", t: RU ? "Луна" : "Moon" },
    { id: "mars", t: RU ? "Марс" : "Mars" },
    { id: "saturn", t: RU ? "Сатурн" : "Saturn" },
    { id: "hole", t: RU ? "Дыра" : "Hole" },
    { id: "galaxy", t: RU ? "Галактика" : "Galaxy" },
    { id: "home", t: RU ? "Домой" : "Home" }
  ];
  var navHtml = "";
  for (var ni = 0; ni < NAV.length; ni++) {
    navHtml += '<button type="button" data-goal="' + NAV[ni].id + '">' + NAV[ni].t + "</button>";
  }
  navHtml += '<button type="button" class="rcf-scan-key" data-scan aria-pressed="false">' + (RU ? "Сканер" : "Scanner") + "</button>";

  w.innerHTML =
    '<canvas class="rcf-cv"></canvas>' +
    '<img class="rcf-cab" alt="" aria-hidden="true" decoding="async">' +
    '<div class="rcf-hud">' +
      '<div class="rcf-cap" aria-live="polite"></div>' +
      '<div class="rcf-deck"><div class="rcf-nav" role="group" aria-label="' + (RU ? "Навигация" : "Navigation") + '">' + navHtml + '</div></div>' +
      '<div class="rcf-track"><i></i></div>' +
      '<div class="rcf-hint">' + (matchMedia("(pointer: coarse)").matches
        ? (RU ? "Ведите пальцем вверх - тяга, в сторону - взгляд" : "Swipe up to thrust, sideways to look")
        : (RU ? "Колесо или свайп - тяга. Мышь - взгляд." : "Scroll or swipe to thrust. Mouse to look.")) + '</div>' +
      '<div class="rcf-speed"><b>0</b><span>' + (RU ? "км/с" : "km/s") + '</span></div>' +
      '<div class="rcf-info" role="status"></div>' +
      '<div class="rcf-prog"></div>' +
      '<div class="rcf-lock" aria-hidden="true"><b></b><b></b><b></b><b></b><span></span></div>' +
    '</div>' +
    '<div class="rcf-holo" aria-hidden="true"><img src="assets/mark.webp" alt=""><i></i></div>' +
    '<button type="button" class="rcf-auto" aria-pressed="true">' +
      '<i></i><span>' + (RU ? "Автопилот" : "Autopilot") + '</span>' +
    '</button>' +
    '<button type="button" class="rcf-close" aria-label="' + (RU ? "Выйти из полёта" : "Exit flight") + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>' +
    '<button type="button" class="rcf-return">' + (RU ? "Вернуться на сайт" : "Back to the site") + '</button>' +
    '<div class="rcf-fade"></div>';
  doc.body.appendChild(w);
  ui.wrap = w;
  ui.cv = w.querySelector(".rcf-cv");
  ui.cab = w.querySelector(".rcf-cab");
  ui.cap = w.querySelector(".rcf-cap");
  ui.nav = w.querySelector(".rcf-nav");
  ui.bar = w.querySelector(".rcf-track i");
  ui.hint = w.querySelector(".rcf-hint");
  ui.speed = w.querySelector(".rcf-speed b");
  ui.auto = w.querySelector(".rcf-auto");
  ui.ret = w.querySelector(".rcf-return");
  ui.info = w.querySelector(".rcf-info");
  ui.prog = w.querySelector(".rcf-prog");
  ui.lock = w.querySelector(".rcf-lock");
  ui.lockCap = ui.lock.querySelector("span");
  ui.scanKey = w.querySelector(".rcf-scan-key");
  ui.fade = w.querySelector(".rcf-fade");

  /* Рамка кабины: своя для альбома и своя для портрета */
  cabSrc();
  ui.cab.addEventListener("load", function () { w.classList.add("has-cab"); });
  ui.cab.addEventListener("error", function () { w.classList.remove("has-cab"); });

  w.querySelector(".rcf-close").addEventListener("click", close);
  ui.ret.addEventListener("click", close);
  ui.auto.addEventListener("click", function () {
    setAuto(!F.auto);
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
  });
  ui.nav.addEventListener("click", function (e) {
    if (g.RC_SOUND) { try { (g.RC_SOUND.uiClick || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (err) {} }
    var sc = e.target.closest("button[data-scan]");
    if (sc) {
      F.scan = !F.scan;
      sc.setAttribute("aria-pressed", F.scan ? "true" : "false");
      sc.classList.toggle("cur", F.scan);
      if (!F.scan && ui.lock) ui.lock.classList.remove("on");
      return;
    }
    var b = e.target.closest("button[data-goal]");
    if (!b) return;
    goTo(b.getAttribute("data-goal"));
  });
  bindControls();
}

function cabSrc() {
  if (!ui.cab) return;
  var want = innerHeight > innerWidth ? "assets/gen/cockpit-tall.webp" : "assets/gen/cockpit-wide.webp";
  if (ui.cab.getAttribute("src") !== want) ui.cab.setAttribute("src", want);
}

/* ── Автопилот и навигация ───────────────────────────────────
   Автопилот держит крейсерскую тягу: корабль сам плывёт по всему
   маршруту, человек только смотрит по сторонам. Любое своё усилие
   на тяге отключает автопилот - управление отдано человеку.
   Кнопки навигации ведут к цели в обе стороны и сами тормозят
   у места назначения. */
function setAuto(on) {
  F.auto = !!on;
  if (on) F.goal = null;
  if (ui.auto) ui.auto.setAttribute("aria-pressed", F.auto ? "true" : "false");
}

function manual() {
  if (F.auto) setAuto(false);
  F.goal = null;
  hideHint();
}

function applyUniverse(i) {
  if (!W3) return;
  var T = g.THREE, u = UNIVERSES[i % UNIVERSES.length];
  W3.sky.material.color.set(u.sky);
  W3.amb.color.set(u.amb);
  W3.sunGlow.material.color = new T.Color(u.sun);
  for (var k = 0; k < W3.nebSprites.length; k++) {
    W3.nebSprites[k].material.color = new T.Color(u.neb[k % 2]);
  }
  for (k = 0; k < W3.starMats.length; k++) {
    W3.starMats[k].color.set(u.stars[k]);
  }
}

/* Прыжок между вселенными: белая вспышка, за ней мир уже другой */
var uniBusy = false;
function jumpUniverse() {
  if (uniBusy || !W3) return;
  uniBusy = true;
  uniIdx = (uniIdx + 1) % UNIVERSES.length;
  if (ui.fade) { ui.fade.style.transition = "opacity .45s"; ui.fade.style.opacity = "1"; }
  if (g.RC_SOUND) { try { (g.RC_SOUND.hyper || g.RC_SOUND.chime).call(g.RC_SOUND); } catch (e) {} }
  F.shake = 1;
  setTimeout(function () {
    applyUniverse(uniIdx);
    if (ui.cap) {
      ui.cap._t = UNIVERSES[uniIdx].name;
      ui.cap._hold = performance.now() + 3200;
      ui.cap.classList.remove("in"); void ui.cap.offsetWidth;
      ui.cap.textContent = UNIVERSES[uniIdx].name;
      ui.cap.classList.add("in");
    }
    if (ui.fade) ui.fade.style.opacity = "0";
    setTimeout(function () { uniBusy = false; }, 700);
  }, 480);
}

var GOAL_NAMES = {
  earth: RU ? "ЗЕМЛЯ" : "EARTH", moon: RU ? "ЛУНА" : "MOON",
  mars: RU ? "МАРС" : "MARS", saturn: RU ? "САТУРН" : "SATURN",
  hole: RU ? "ЧЁРНАЯ ДЫРА" : "BLACK HOLE",
  galaxy: RU ? "ГАЛАКТИКА" : "GALAXY", home: RU ? "ДОМОЙ" : "HOME"
};

function goTo(id) {
  if (!W3 || !W3.at) return;
  if (id === "galaxy" && F.p > W3.at.jump0 && F.p < W3.at.jump1) {
    /* Уже в межгалактическом коридоре: прыгаем в другую вселенную */
    jumpUniverse();
    return;
  }
  var p = id === "earth" ? 0.02
        : id === "home" ? 0.985
        : id === "galaxy" ? (W3.at.jump0 + W3.at.jump1) / 2
        : W3.at[id];
  if (p === undefined) return;
  F.auto = false;
  if (ui.auto) ui.auto.setAttribute("aria-pressed", "false");
  F.goal = p;
  F.goalName = GOAL_NAMES[id] || null;
  hideHint();
}

/* ── Процедурные текстуры ────────────────────────────────────
   Марс, Сатурн и кольца рисуются на холсте: до них в кадре далеко,
   а лишние мегабайты и лишние запросы полёту ни к чему. */
function paintPlanet(w, h, base, bands, noise) {
  var c = doc.createElement("canvas");
  c.width = w; c.height = h;
  var x = c.getContext("2d");
  var grd = x.createLinearGradient(0, 0, 0, h);
  for (var i = 0; i < base.length; i++) grd.addColorStop(base[i][0], base[i][1]);
  x.fillStyle = grd; x.fillRect(0, 0, w, h);
  /* Полосы: полупрозрачные горизонтальные ленты разной толщины */
  for (i = 0; i < bands; i++) {
    var y = Math.random() * h, bh = 2 + Math.random() * (h * 0.06);
    x.fillStyle = "rgba(" + (Math.random() > 0.5 ? "255,255,255" : "0,0,0") + "," + (0.03 + Math.random() * 0.08).toFixed(3) + ")";
    x.fillRect(0, y, w, bh);
  }
  /* Шум: точки-кратеры и разводы */
  for (i = 0; i < noise; i++) {
    var nx = Math.random() * w, ny = Math.random() * h, r = 1 + Math.random() * 7;
    var gr2 = x.createRadialGradient(nx, ny, 0, nx, ny, r);
    gr2.addColorStop(0, "rgba(0,0,0," + (0.04 + Math.random() * 0.12).toFixed(3) + ")");
    gr2.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gr2; x.beginPath(); x.arc(nx, ny, r, 0, 6.283); x.fill();
  }
  var t = new g.THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function paintRing() {
  var c = doc.createElement("canvas");
  c.width = 512; c.height = 32;
  var x = c.getContext("2d");
  for (var i = 0; i < 512; i++) {
    var d = i / 512;
    var a = 0.15 + 0.75 * Math.pow(Math.abs(Math.sin(d * 40) * Math.sin(d * 9)), 1.6);
    if (d < 0.06 || d > 0.97) a *= d < 0.06 ? d / 0.06 : (1 - d) / 0.03;
    var tone = 200 + Math.round(35 * Math.sin(d * 23));
    x.fillStyle = "rgba(" + tone + "," + (tone - 25) + "," + (tone - 55) + "," + a.toFixed(3) + ")";
    x.fillRect(i, 0, 1, 32);
  }
  var t = new g.THREE.CanvasTexture(c);
  return t;
}

function glowSprite(size, inner, outer) {
  var c = doc.createElement("canvas");
  c.width = c.height = size;
  var x = c.getContext("2d");
  var gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  x.fillStyle = gr; x.fillRect(0, 0, size, size);
  return new g.THREE.CanvasTexture(c);
}

/* ── Мир ─────────────────────────────────────────────────────ы */
function buildWorld() {
  var T = g.THREE;
  var mob = innerWidth < 760;
  var r = new T.WebGLRenderer({ canvas: ui.cv, antialias: !mob, alpha: false, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(g.devicePixelRatio || 1, mob ? 1.6 : 2));
  r.setClearColor(0x02050c, 1);

  var scene = new T.Scene();
  var portrait = innerHeight > innerWidth;
  var FOV0 = portrait ? 84 : 72;
  var cam = new T.PerspectiveCamera(FOV0, 1, 0.1, 9000);

  var amb = new T.AmbientLight(0x3a4a68, 0.85);
  scene.add(amb);
  var sun = new T.DirectionalLight(0xfff2dc, 1.6);
  sun.position.set(2600, 1000, 1750);
  scene.add(sun);

  var L = new T.TextureLoader();
  function tex(p) { var t = L.load(p); t.anisotropy = 4; return t; }

  /* Небо: панорама Млечного Пути на дальней сфере + звёзды точками.
     Панорама даёт глубину и «дорогое» небо, точки - искры и
     параллакс, которого у панорамы нет. */
  var sky = new T.Mesh(
    new T.SphereGeometry(4200, 32, 20),
    new T.MeshBasicMaterial({ map: tex("assets/space/night-sky.png"), side: T.BackSide, color: 0x9db4cc })
  );
  scene.add(sky);

  var starDot = glowSprite(64, "rgba(255,255,255,1)", "rgba(255,255,255,0)");
  function stars(n, size, spread, hue) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var v = new T.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      v.normalize().multiplyScalar(spread * (0.35 + Math.random() * 0.65));
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var m = new T.PointsMaterial({
      color: hue, size: size, sizeAttenuation: true, map: starDot,
      transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending
    });
    var pts = new T.Points(geo, m);
    scene.add(pts);
    return pts;
  }
  var starMats = [
    stars(mob ? 2400 : 5200, 2.4, 3000, 0xcfe9f5).material,
    stars(mob ? 900 : 2200, 3.6, 2200, 0x8fb7ff).material,
    stars(mob ? 400 : 900, 4.8, 1500, 0xffe9c9).material
  ];

  /* Солнце: далёкий слепящий блик, как на съёмке с орбиты */
  var sunGlow = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(256, "rgba(255,246,225,1)", "rgba(255,190,110,0)"),
    transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending
  }));
  sunGlow.position.set(2600, 1000, 1750);
  sunGlow.scale.setScalar(900);
  scene.add(sunGlow);

  /* Туманности: несколько мягких пятен в фирменных цветах */
  var nebT = glowSprite(256, "rgba(66,178,220,.32)", "rgba(66,178,220,0)");
  var nebV = glowSprite(256, "rgba(138,89,246,.28)", "rgba(138,89,246,0)");
  var nebs = [[-1400, 500, -2400, 2600, nebT], [1900, -300, -1500, 2100, nebV], [600, 800, 2200, 2400, nebT], [-2100, -600, 1400, 1900, nebV]];
  var nebSprites = [];
  for (var i = 0; i < nebs.length; i++) {
    var sp = new T.Sprite(new T.SpriteMaterial({ map: nebs[i][4], transparent: true, opacity: 0.5, depthWrite: false }));
    sp.position.set(nebs[i][0], nebs[i][1], nebs[i][2]);
    sp.scale.setScalar(nebs[i][3]);
    scene.add(sp);
    nebSprites.push(sp);
  }

  /* ── Земля ── */
  var earth = new T.Group();
  var eBody = new T.Mesh(
    new T.SphereGeometry(60, mob ? 48 : 64, mob ? 36 : 48),
    new T.MeshPhongMaterial({
      map: tex("assets/space/earth-day.jpg"),
      emissiveMap: tex("assets/space/earth-night.jpg"),
      emissive: new T.Color(0xffd9a0), emissiveIntensity: 1.05,
      specular: new T.Color(0x223344), shininess: 14
    })
  );
  earth.add(eBody);
  /* Атмосфера: подсвеченный ободок изнутри наружу */
  var atm = new T.Mesh(
    new T.SphereGeometry(61.9, 48, 36),
    new T.ShaderMaterial({
      transparent: true, side: T.BackSide, depthWrite: false,
      uniforms: {},
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying vec3 vN; void main(){ float f = pow(0.66 - dot(vN, vec3(0.0,0.0,-1.0)), 4.0); gl_FragColor = vec4(0.32,0.62,0.95, f * 0.62); }"
    })
  );
  earth.add(atm);
  var clouds = new T.Mesh(
    new T.SphereGeometry(61.2, mob ? 48 : 64, mob ? 36 : 48),
    new T.MeshLambertMaterial({
      map: tex("assets/space/clouds.png"),
      transparent: true, opacity: 0.55, depthWrite: false
    })
  );
  earth.add(clouds);
  scene.add(earth);

  /* ── Луна ── */
  var moon = new T.Mesh(
    new T.SphereGeometry(16, 40, 28),
    new T.MeshPhongMaterial({ map: tex("assets/space/moon.jpg"), shininess: 2 })
  );
  moon.position.set(300, 40, -190);
  scene.add(moon);
  /* Маршрут проходит с теневой стороны Луны - без своего света она
     встречала корабль чёрным диском */
  var moonLamp = new T.PointLight(0xcfd8e2, 1.1, 420);
  moonLamp.position.set(330, 60, -120);
  scene.add(moonLamp);

  /* Узлы-реле CDN: цепочка светящихся маяков вдоль перегона
     Луна-Марс. Пустой кусок пути превращается в кадр про продукт:
     «контент идёт с ближайшего узла» - вот эти узлы. */
  var relayTex = glowSprite(64, "rgba(159,224,246,1)", "rgba(66,178,220,0)");
  var relayPts = [], relaySprites = [];
  for (var ri = 0; ri < 6; ri++) {
    var rt = ri / 5;
    var rp = new T.Vector3(350 + rt * 210, 20 - rt * 145, -250 - rt * 420);
    rp.x += (ri % 2 ? 34 : -30); rp.y += (ri % 3 - 1) * 26;
    var rs = new T.Sprite(new T.SpriteMaterial({ map: relayTex, transparent: true, opacity: 0.9, depthWrite: false, blending: T.AdditiveBlending }));
    rs.position.copy(rp);
    rs.scale.setScalar(9);
    rs.userData.info = RU ? "УЗЕЛ RC-" + (ri + 1) + "0 · ближайший к вам сервер сети" : "NODE RC-" + (ri + 1) + "0";
    scene.add(rs);
    relayPts.push(rp);
    relaySprites.push(rs);
  }
  /* Линия связи между узлами: тонкая, едва заметная */
  var relayGeo = new T.BufferGeometry().setFromPoints(relayPts);
  scene.add(new T.Line(relayGeo, new T.LineBasicMaterial({ color: 0x42b2dc, transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false })));

  /* ── Марс ── */
  var mars = new T.Mesh(
    new T.SphereGeometry(30, 44, 30),
    new T.MeshPhongMaterial({
      map: paintPlanet(512, 256, [[0, "#9c4a2a"], [0.35, "#c96f3b"], [0.6, "#b35a30"], [1, "#7c3a20"]], 6, 520),
      shininess: 4
    })
  );
  mars.position.set(620, -170, -820);
  scene.add(mars);

  /* ── Сатурн ── */
  var saturn = new T.Group();
  saturn.add(new T.Mesh(
    new T.SphereGeometry(46, 48, 34),
    new T.MeshPhongMaterial({
      map: paintPlanet(512, 256, [[0, "#c3a06b"], [0.3, "#e0c188"], [0.55, "#cfa970"], [0.8, "#e8d09a"], [1, "#ad8a58"]], 40, 60),
      shininess: 6
    })
  ));
  var ringGeo = new T.RingGeometry(60, 116, 96, 1);
  /* UV кольца по радиусу, чтобы полосатая текстура легла кругами */
  (function () {
    var pos = ringGeo.attributes.position, uv = ringGeo.attributes.uv, v = new T.Vector3();
    for (var k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      uv.setXY(k, (v.length() - 60) / 56, 0.5);
    }
  })();
  var ring = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ map: paintRing(), side: T.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false }));
  ring.rotation.x = Math.PI / 2.25;
  saturn.add(ring);
  saturn.position.set(1560, 260, -1060);
  saturn.rotation.z = 0.12;
  scene.add(saturn);

  /* ── Чёрная дыра ──
     Тонкий горячий диск, нарисованный шейдером: полосы, вращение,
     оранжевое пламя к центру и провал посередине. Плюс чёрное ядро
     и тёплое гало вокруг. */
  var hole = new T.Group();
  hole.add(new T.Mesh(new T.SphereGeometry(26, 40, 28), new T.MeshBasicMaterial({ color: 0x000000 })));
  var diskGeo = new T.RingGeometry(30, 105, mob ? 110 : 160, 1);
  (function () {
    var pos = diskGeo.attributes.position, uv = diskGeo.attributes.uv, v = new T.Vector3();
    for (var k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k);
      uv.setXY(k, (v.length() - 30) / 75, Math.atan2(v.y, v.x) / 6.28318 + 0.5);
    }
  })();
  var diskMat = new T.ShaderMaterial({
    transparent: true, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uT: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader:
      "varying vec2 vUv; uniform float uT;" +
      "float n(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }" +
      "void main(){" +
      "  float rad = vUv.x; float ang = vUv.y * 6.28318;" +
      "  float swirl = sin(ang * 3.0 + uT * 1.4 - rad * 14.0) * 0.5 + 0.5;" +
      "  float grain = n(vec2(floor(rad * 60.0), floor((ang + uT * 0.35) * 30.0)));" +
      "  float heat = (1.0 - rad);" +
      "  vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.85, 0.55), heat * heat);" +
      "  col = mix(col, vec3(0.55, 0.30, 0.95), rad * 0.35);" +
      "  float a = heat * (0.35 + swirl * 0.5 + grain * 0.25);" +
      "  a *= smoothstep(0.0, 0.12, rad) * smoothstep(1.0, 0.72, rad);" +
      "  gl_FragColor = vec4(col * (0.7 + heat), a);" +
      "}"
  });
  var disk = new T.Mesh(diskGeo, diskMat);
  disk.rotation.x = Math.PI / 2.5;
  hole.add(disk);
  /* Фотонная сфера: свет, обёрнутый вокруг горизонта. Тонкий
     ярко-белый обруч у самого ядра - как на снимке M87*. */
  var photon = new T.Mesh(
    new T.TorusGeometry(28.5, 0.7, 10, 90),
    new T.MeshBasicMaterial({ color: 0xffe8c9, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false })
  );
  photon.rotation.x = Math.PI / 2.5;
  hole.add(photon);
  var halo = new T.Sprite(new T.SpriteMaterial({ map: glowSprite(256, "rgba(255,140,50,.32)", "rgba(255,80,20,0)"), transparent: true, opacity: 0.5, depthWrite: false }));
  halo.scale.setScalar(380);
  hole.add(halo);
  hole.position.set(2140, -160, -2380);
  scene.add(hole);

  /* ── Гиперпрыжок: пучок линий, вытянутых навстречу ── */
  var jump = (function () {
    var nLines = mob ? 220 : 420;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(nLines * 6);
    for (var k = 0; k < nLines; k++) {
      var a = Math.random() * 6.283, rr = 14 + Math.random() * 240;
      var x0 = Math.cos(a) * rr, y0 = Math.sin(a) * rr, z0 = -Math.random() * 900;
      pos[k * 6] = x0; pos[k * 6 + 1] = y0; pos[k * 6 + 2] = z0;
      pos[k * 6 + 3] = x0; pos[k * 6 + 4] = y0; pos[k * 6 + 5] = z0 - (60 + Math.random() * 200);
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var lines = new T.LineSegments(geo, new T.LineBasicMaterial({ color: 0x9fd8ef, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    lines.frustumCulled = false;
    return lines;
  })();
  scene.add(jump);

  /* ── Галактики ──────────────────────────────────────────────
     Три спирали из частиц: Млечный Путь по курсу прыжка и две
     дальние вселенные по сторонам. Каждая - несколько тысяч точек
     по логарифмической спирали с гауссовым разбросом; ядро теплее,
     рукава в цвет вселенной. */
  function spiralGalaxy(px, py, pz, scale, colA, colB, tiltX, tiltZ) {
    var n = mob ? 1600 : 3200;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(n * 3);
    var col = new Float32Array(n * 3);
    var cA = new T.Color(colA), cB = new T.Color(colB), cC = new T.Color(0xfff3dd);
    for (var k = 0; k < n; k++) {
      var tt = Math.pow(Math.random(), 0.65);            /* плотнее к ядру */
      var arm = (k % 3) * (6.28318 / 3);
      var ang = arm + tt * 4.6 + (Math.random() - 0.5) * 0.5;
      var rad = tt * scale;
      var spread = scale * 0.05 * (1 - tt * 0.6);
      pos[k * 3] = Math.cos(ang) * rad + (Math.random() - 0.5) * spread * 2;
      pos[k * 3 + 1] = (Math.random() - 0.5) * spread;
      pos[k * 3 + 2] = Math.sin(ang) * rad + (Math.random() - 0.5) * spread * 2;
      var c = tt < 0.18 ? cC : (Math.random() > 0.5 ? cA : cB);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    geo.setAttribute("color", new T.BufferAttribute(col, 3));
    var pts = new T.Points(geo, new T.PointsMaterial({
      size: scale * 0.012, sizeAttenuation: true, map: starDot, vertexColors: true,
      transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending
    }));
    /* Ядро: тёплое свечение */
    var core = new T.Sprite(new T.SpriteMaterial({
      map: glowSprite(128, "rgba(255,240,214,.9)", "rgba(255,214,150,0)"),
      transparent: true, opacity: 0.85, depthWrite: false, blending: T.AdditiveBlending
    }));
    core.scale.setScalar(scale * 0.5);
    var gr = new T.Group();
    gr.add(pts); gr.add(core);
    gr.position.set(px, py, pz);
    gr.rotation.x = tiltX; gr.rotation.z = tiltZ;
    scene.add(gr);
    return gr;
  }
  /* Что расскажет бортовой справочник при наведении на объект */
  eBody.userData.info = RU ? "ЗЕМЛЯ · диаметр 12 742 км · единственная планета с CDN" : "EARTH · 12,742 km wide · the only planet with a CDN";
  moon.userData.info = RU ? "ЛУНА · 384 400 км · первая цель космических миссий, 1959" : "MOON · 384,400 km · first space target, 1959";
  mars.userData.info = RU ? "МАРС · в телескоп впервые разглядел Галилей, 1610" : "MARS · first seen through a telescope by Galileo, 1610";
  saturn.userData.info = RU ? "САТУРН · кольца открыл Гюйгенс, 1655" : "SATURN · rings discovered by Huygens, 1655";
  hole.children[0].userData.info = RU ? "ЧЁРНАЯ ДЫРА · первый снимок - M87*, 2019" : "BLACK HOLE · first image - M87*, 2019";
  var pickables = [eBody, moon, mars, saturn.children[0], hole.children[0]];
  for (var rj = 0; rj < relaySprites.length; rj++) pickables.push(relaySprites[rj]);
  saturn.children[0].userData.info = RU ? "САТУРН · кольца открыл Гюйгенс, 1655" : "SATURN · rings discovered by Huygens, 1655";

  /* Комета: ядро со свечением и хвост из частиц. Ходит по вытянутому
     эллипсу между Марсом и Сатурном, хвост всегда от солнца. */
  var comet = new T.Group();
  var cometCore = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(64, "rgba(220,244,255,1)", "rgba(160,220,255,0)"),
    transparent: true, depthWrite: false, blending: T.AdditiveBlending
  }));
  cometCore.scale.setScalar(26);
  cometCore.userData.info = RU ? "КОМЕТА RC/2026 · хвост всегда смотрит от солнца" : "COMET RC/2026 · the tail always points away from the sun";
  comet.add(cometCore);
  var cometTail = (function () {
    var n = 90, geo = new T.BufferGeometry(), posA = new Float32Array(n * 3);
    for (var k = 0; k < n; k++) {
      var d = k / n;
      posA[k * 3] = -d * 150 + (Math.random() - 0.5) * d * 26;
      posA[k * 3 + 1] = (Math.random() - 0.5) * d * 26;
      posA[k * 3 + 2] = (Math.random() - 0.5) * d * 26;
    }
    geo.setAttribute("position", new T.BufferAttribute(posA, 3));
    return new T.Points(geo, new T.PointsMaterial({
      color: 0xbfe4ff, size: 7, sizeAttenuation: true, map: starDot,
      transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending
    }));
  })();
  comet.add(cometTail);
  scene.add(comet);
  pickables.push(cometCore);

  /* Спутник на орбите Земли: корпус и две солнечные панели */
  var sat = new T.Group();
  var satBody = new T.Mesh(new T.BoxGeometry(1.4, 1.4, 2.8),
    new T.MeshPhongMaterial({ color: 0xd8e2ec, shininess: 60, emissive: 0x22303e }));
  satBody.userData.info = RU ? "СПУТНИК RC-SAT · ретранслятор Rocket CDN на низкой орбите" : "RC-SAT · Rocket CDN relay in low orbit";
  sat.add(satBody);
  var panelMat = new T.MeshPhongMaterial({ color: 0x1d4d8f, shininess: 90, side: T.DoubleSide, emissive: 0x0d2038 });
  var p1 = new T.Mesh(new T.PlaneGeometry(5.6, 1.8), panelMat); p1.position.x = 4; sat.add(p1);
  var p2 = new T.Mesh(new T.PlaneGeometry(5.6, 1.8), panelMat); p2.position.x = -4; sat.add(p2);
  scene.add(sat);
  pickables.push(satBody);

  var milky = spiralGalaxy(1150, 80, -2080, 950, 0x9fd8ef, 0x8fb7ff, 0.9, 0.3);
  var gal2 = spiralGalaxy(-2800, -500, -1600, 680, 0xb08cff, 0x8a59f6, 1.15, -0.4);
  var gal3 = spiralGalaxy(3400, 700, -400, 620, 0xffd9a6, 0xff9d6b, 0.75, 0.55);
  milky.children[1].userData.info = RU ? "МЛЕЧНЫЙ ПУТЬ · 200 млрд звёзд · виден с Земли 10 000 лет" : "MILKY WAY · 200B stars";
  gal2.children[1].userData.info = RU ? "ГАЛАКТИКА RV-2 · неизведанная вселенная" : "GALAXY RV-2 · uncharted universe";
  gal3.children[1].userData.info = RU ? "ГАЛАКТИКА RC-3 · открыта Rocket CDN" : "GALAXY RC-3 · discovered by Rocket CDN";
  pickables.push(milky.children[1], gal2.children[1], gal3.children[1]);

  /* ── Пыль у стекла ──
     Куб мелких частиц, вечно висящий вокруг камеры: кадр никогда
     не бывает мёртвым, а скорость читается кожей. Частицы
     заворачиваются по модулю куба относительно камеры - облако
     бесконечно, а точек всего три сотни. */
  var dust = (function () {
    var nD = mob ? 160 : 320, SIDE = 140;
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(nD * 3);
    for (var k = 0; k < nD * 3; k++) pos[k] = (Math.random() - 0.5) * SIDE;
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var pts = new T.Points(geo, new T.PointsMaterial({
      color: 0xaac6d8, size: 1.1, sizeAttenuation: true, map: starDot,
      transparent: true, opacity: 0.5, depthWrite: false
    }));
    pts.frustumCulled = false;
    pts.userData.side = SIDE;
    scene.add(pts);
    return pts;
  })();

  /* ── Астероидный пояс ──
     Камни рассыпаны трубой вокруг отрезка будущего маршрута между
     Марсом и Сатурном: корабль проходит сквозь пояс, камни висят
     вокруг и медленно дрейфуют. Два слоя точек - крупные ближе,
     мелкая пыль дальше. */
  function beltLayer(nPts, size, spread, color) {
    var geo = new T.BufferGeometry();
    var pos = new Float32Array(nPts * 3);
    /* Отрезок пути: прямая от окрестности Марса к Сатурну */
    var A = new T.Vector3(760, -120, -900), B = new T.Vector3(1350, 210, -1000);
    for (var k = 0; k < nPts; k++) {
      var tt = Math.random();
      var cx = A.x + (B.x - A.x) * tt, cy = A.y + (B.y - A.y) * tt, cz = A.z + (B.z - A.z) * tt;
      var a = Math.random() * 6.283, rr = 40 + Math.pow(Math.random(), 0.5) * spread;
      pos[k * 3] = cx + Math.cos(a) * rr;
      pos[k * 3 + 1] = cy + (Math.random() - 0.5) * spread * 0.7;
      pos[k * 3 + 2] = cz + Math.sin(a) * rr;
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    var pts = new T.Points(geo, new T.PointsMaterial({
      color: color, size: size, sizeAttenuation: true, map: starDot,
      transparent: true, opacity: 0.8, depthWrite: false
    }));
    scene.add(pts);
    return pts;
  }
  var belt1 = beltLayer(mob ? 500 : 1100, 3.4, 230, 0x9a8f80);
  var belt2 = beltLayer(mob ? 260 : 600, 6.5, 160, 0xb8a890);

  /* ── Маршрут ──
     Кривая проходит через все сцены и заворачивает домой. Взгляд
     ведут точки интереса: у каждого отрезка своя цель, между ними
     камера плавно переводит глаза. */
  var path = new T.CatmullRomCurve3([
    new T.Vector3(0, 8, 150),
    new T.Vector3(120, 26, 60),
    new T.Vector3(96, 18, -120),
    new T.Vector3(-60, 4, -150),
    new T.Vector3(-130, 22, 10),
    new T.Vector3(-40, 34, 170),
    new T.Vector3(180, 52, 60),          /* отход от Земли */
    new T.Vector3(300, 46, -120),        /* мимо Луны */
    new T.Vector3(420, -30, -400),
    new T.Vector3(520, -110, -640),      /* к Марсу */
    new T.Vector3(680, -190, -880),
    new T.Vector3(1000, 40, -960),
    new T.Vector3(1420, 300, -940),      /* над кольцами Сатурна */
    new T.Vector3(1700, 210, -1240),
    new T.Vector3(1900, -40, -1900),     /* подход к дыре */
    new T.Vector3(2260, -80, -2180),     /* дуга вокруг дыры */
    new T.Vector3(2300, -160, -2560),
    new T.Vector3(1860, -120, -2720),
    new T.Vector3(1000, 60, -1900),      /* гиперпрыжок домой */
    new T.Vector3(300, 90, -800),
    new T.Vector3(-60, 50, -290),
    new T.Vector3(-230, 30, -60),
    new T.Vector3(-170, 10, 170)         /* торможение: Земля по борту */
  ], false, "catmullrom", 0.12);

  /* Подписи и цели взгляда стояли на глазок и разъехались с фактом:
     кривая не тратит равные доли пути на равные куски пространства.
     Считаем честно: где дуга подходит к объекту ближе всего, там
     его сцена и есть. */
  function nearestP(target) {
    var best = 0, bd = 1e12;
    for (var k = 0; k <= 400; k++) {
      var pp = k / 400;
      var d = path.getPointAt(pp).distanceToSquared(target);
      if (d < bd) { bd = d; best = pp; }
    }
    return best;
  }
  var AT = {
    moon: nearestP(moon.position),
    mars: nearestP(mars.position),
    saturn: nearestP(saturn.position),
    hole: nearestP(hole.position)
  };
  AT.jump0 = Math.min(0.86, AT.hole + 0.05);
  AT.jump1 = Math.min(0.9, AT.jump0 + 0.27);

  var LOOKS = [
    { p: 0.00, at: new T.Vector3(0, 0, 0) },            /* Земля */
    { p: Math.max(0.08, AT.moon - 0.06), at: moon.position },
    { p: AT.moon + 0.03, at: moon.position },
    { p: AT.mars - 0.05, at: mars.position },
    { p: AT.mars + 0.03, at: mars.position },
    { p: AT.saturn - 0.05, at: saturn.position },
    { p: AT.saturn + 0.03, at: saturn.position },
    { p: AT.hole - 0.085, at: hole.position },
    { p: AT.hole + 0.03, at: hole.position },
    { p: AT.jump0 + 0.04, at: milky.position }, /* Млечный Путь - прыжок идёт сквозь его рукав */
    { p: AT.jump1, at: new T.Vector3(300, 90, -800) },  /* по ходу прыжка */
    { p: 0.94, at: new T.Vector3(0, 0, 0) }             /* снова Земля */
  ];

  /* Подписи встают на те же честные отметки. Сцены могут стоять
     тесно, поэтому после расстановки наводим монотонность: каждая
     следующая подпись не раньше предыдущей плюс шаг. */
  CAPTIONS[1].p = Math.max(0.06, AT.moon - 0.045);
  CAPTIONS[2].p = AT.moon + 0.04;
  CAPTIONS[3].p = AT.mars - 0.04;
  CAPTIONS[4].p = AT.saturn - 0.05;
  CAPTIONS[5].p = AT.hole - 0.05;
  CAPTIONS[6].p = AT.jump0;
  CAPTIONS.splice(7, 0, { p: AT.jump0 + 0.09,
    t: RU ? "МЛЕЧНЫЙ ПУТЬ · 200 млрд звёзд, ваши пользователи ближе" : "MILKY WAY · 200B stars, your users are closer" });
  CAPTIONS.splice(8, 0, { p: AT.jump0 + 0.19,
    t: RU ? "ДРУГОЙ РУКАВ ГАЛАКТИКИ · дом уже виден" : "ANOTHER GALACTIC ARM · home is in sight" });
  CAPTIONS[9].p = AT.jump1 + 0.02;
  for (var ci = 1; ci < CAPTIONS.length; ci++) {
    if (CAPTIONS[ci].p < CAPTIONS[ci - 1].p + 0.03) CAPTIONS[ci].p = CAPTIONS[ci - 1].p + 0.03;
  }

  /* Той же монотонности требует и график взгляда */
  for (var li = 1; li < LOOKS.length; li++) {
    if (LOOKS[li].p < LOOKS[li - 1].p + 0.015) LOOKS[li].p = LOOKS[li - 1].p + 0.015;
  }

  /* Цели сканера: что прибор умеет вести. Имя короткое - оно
     горит над рамкой захвата. */
  var scanTargets = [
    { o: earth, name: RU ? "ЗЕМЛЯ" : "EARTH", key: "earth" },
    { o: moon, name: RU ? "ЛУНА" : "MOON", key: "moon" },
    { o: mars, name: RU ? "МАРС" : "MARS", key: "mars" },
    { o: saturn, name: RU ? "САТУРН" : "SATURN", key: "saturn" },
    { o: hole, name: RU ? "ЧЁРНАЯ ДЫРА" : "BLACK HOLE", key: "hole" },
    { o: comet, name: RU ? "КОМЕТА RC/2026" : "COMET RC/2026", key: "comet" },
    { o: sat, name: "RC-SAT", key: "sat" },
    { o: belt1, name: RU ? "АСТЕРОИДНЫЙ ПОЯС" : "ASTEROID BELT", key: "belt" },
    { o: milky, name: RU ? "МЛЕЧНЫЙ ПУТЬ" : "MILKY WAY", key: "milky" },
    { o: gal2, name: "RV-2", key: "gal2" },
    { o: gal3, name: "RC-3", key: "gal3" }
  ];

  return {
    r: r, scene: scene, cam: cam, path: path, looks: LOOKS, at: AT, fov0: FOV0, scanTargets: scanTargets,
    milky: milky, gal2: gal2, gal3: gal3,
    comet: comet, sat: sat, belt1: belt1, belt2: belt2, dust: dust, nebSprites: nebSprites, starMats: starMats, sunGlow: sunGlow, amb: amb,
    earth: earth, clouds: clouds, moon: moon, mars: mars, saturn: saturn, hole: hole,
    diskMat: diskMat, jump: jump, sky: sky, pickables: pickables,
    tmpA: new T.Vector3(), tmpB: new T.Vector3(), tmpQ: new T.Quaternion(), tmpM: new T.Matrix4()
  };
}

/* ── Управление ──────────────────────────────────────────────ы */
function bindControls() {
  var w = ui.wrap;

  w.addEventListener("wheel", function (e) {
    e.preventDefault();
    F.v += e.deltaY * 0.0001;
    manual();
  }, { passive: false });

  var tY = null, tX = null;
  w.addEventListener("touchstart", function (e) {
    if (e.touches.length) { tY = e.touches[0].clientY; tX = e.touches[0].clientX; }
  }, { passive: true });
  w.addEventListener("touchmove", function (e) {
    e.preventDefault();
    if (!e.touches.length) return;
    var y = e.touches[0].clientY, x = e.touches[0].clientX;
    if (tY !== null) {
      F.v += (tY - y) * 0.00016;
      manual();
      F.look.tx += (x - tX) * 0.004;
      F.look.tx = Math.max(-0.5, Math.min(0.5, F.look.tx));
    }
    tY = y; tX = x;
    hideHint();
  }, { passive: false });
  w.addEventListener("touchend", function () { tY = tX = null; F.look.tx *= 0.4; }, { passive: true });

  w.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") return;
    F.look.tx = (e.clientX / innerWidth - 0.5) * 0.66;
    F.look.ty = (e.clientY / innerHeight - 0.5) * 0.4;
    F.mx = (e.clientX / innerWidth) * 2 - 1;
    F.my = -(e.clientY / innerHeight) * 2 + 1;
  }, { passive: true });
  /* На тачскрине справочник вызывает касание */
  w.addEventListener("pointerdown", function (e) {
    F.mx = (e.clientX / innerWidth) * 2 - 1;
    F.my = -(e.clientY / innerHeight) * 2 + 1;
    F.pick = true;
  }, { passive: true });

  addEventListener("keydown", function (e) {
    if (!F.open) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { F.v += 0.14; e.preventDefault(); manual(); }
    if (e.key === "ArrowUp" || e.key === "PageUp") { F.v -= 0.14; e.preventDefault(); manual(); }
  });

  addEventListener("resize", function () { size(); cabSrc(); }, { passive: true });
}

var hintHidden = false;
function hideHint() {
  if (hintHidden || !ui.hint) return;
  hintHidden = true;
  ui.hint.classList.add("off");
}

function size() {
  if (!W3 || !F.open) return;
  var w = innerWidth, h = innerHeight;
  W3.r.setSize(w, h, false);
  W3.cam.aspect = w / h;
  W3.cam.updateProjectionMatrix();
}

/* ── Кадр ────────────────────────────────────────────────────ы */
function frame(ts) {
  if (!F.open) return;
  F.raf = requestAnimationFrame(frame);
  var dt = F.last ? Math.min(0.05, (ts - F.last) / 1000) : 0.016;
  F.last = ts;
  var T = g.THREE, w3 = W3;

  /* Тяга и инерция. В гиперпрыжке корабль сам держит ход: прыжок
     не должен обрываться на полпути из-за уставшего пальца. */
  var jumpZone = W3.at ? (F.p > W3.at.jump0 && F.p < W3.at.jump1) : (F.p > 0.74 && F.p < 0.86);
  if (jumpZone && F.v < 0.11) F.v += (0.11 - F.v) * Math.min(1, dt * 2);

  if (F.goal !== null && F.goal !== undefined) {
    /* Навигация к цели: тяга по расстоянию, у места сама тормозит.
       Работает в обе стороны - к Марсу можно и вернуться. */
    var dp = F.goal - F.p;
    if (Math.abs(dp) < 0.006) { F.goal = null; F.v *= 0.3; }
    else {
      var wantV = Math.max(-0.14, Math.min(0.14, dp * 1.1 + (dp > 0 ? 0.02 : -0.02)));
      F.v += (wantV - F.v) * Math.min(1, dt * 3);
    }
  } else if (F.auto && F.p < 0.999) {
    /* Автопилот: спокойная крейсерская, чтобы просто смотреть кино */
    var cruise = jumpZone ? 0.11 : 0.03;
    F.v += (cruise - F.v) * Math.min(1, dt * 2.5);
  } else {
    /* Ручной режим: тяга набирается щелчками и сама затухает */
    F.v *= Math.pow(0.14, dt);
  }
  F.v = Math.max(-0.2, Math.min(0.3, F.v));
  F.p += F.v * dt;
  if (F.p < 0) { F.p = 0; F.v = 0; }
  if (F.p > 1) { F.p = 1; F.v = 0; }

  /* Подсветка текущей цели в навигации */
  if (ui.nav && w3.at && (frame._navT || 0) < ts - 300) {
    frame._navT = ts;
    var seg = "earth";
    if (F.p > 0.06 && F.p <= (w3.at.mars + w3.at.moon) / 2) seg = "moon";
    else if (F.p > (w3.at.mars + w3.at.moon) / 2 && F.p <= (w3.at.saturn + w3.at.mars) / 2) seg = "mars";
    else if (F.p > (w3.at.saturn + w3.at.mars) / 2 && F.p <= (w3.at.hole + w3.at.saturn) / 2) seg = "saturn";
    else if (F.p > (w3.at.hole + w3.at.saturn) / 2 && F.p <= w3.at.jump0) seg = "hole";
    else if (F.p > w3.at.jump0 && F.p <= w3.at.jump1) seg = "galaxy";
    else if (F.p > w3.at.jump1) seg = "home";
    if (frame._seg !== seg) {
      frame._seg = seg;
      var bs = ui.nav.querySelectorAll("button");
      for (var bi = 0; bi < bs.length; bi++) {
        bs[bi].classList.toggle("cur", bs[bi].getAttribute("data-goal") === seg);
      }
    }
  }

  /* Камера по кривой */
  var pos = w3.path.getPointAt(F.p);
  w3.cam.position.copy(pos);

  /* Цель взгляда: между точками интереса */
  var L = w3.looks, a = L[0], b = L[L.length - 1];
  for (var i = 0; i < L.length - 1; i++) {
    if (F.p >= L[i].p && F.p <= L[i + 1].p) { a = L[i]; b = L[i + 1]; break; }
  }
  var k = (F.p - a.p) / Math.max(0.0001, b.p - a.p);
  k = k * k * (3 - 2 * k);
  w3.tmpA.copy(a.at).lerp(b.at, k);
  w3.tmpM.lookAt(w3.cam.position, w3.tmpA, w3.cam.up);
  w3.tmpQ.setFromRotationMatrix(w3.tmpM);
  /* Ориентация автопилота живёт отдельно от взгляда человека.
     Раньше повороты мыши применялись к тому же кватерниону, что и
     сглаживание курса: на тяжёлых кадрах ручной наклон накапливался
     быстрее, чем курс успевал его возвращать, и камера утыкалась в
     пол. Теперь курс сходится сам по себе, а взгляд - только
     насадка на кадр. */
  if (!w3.baseQ) w3.baseQ = w3.cam.quaternion.clone();
  w3.baseQ.slerp(w3.tmpQ, Math.min(1, dt * 3.2));
  w3.cam.quaternion.copy(w3.baseQ);

  /* Взгляд человека поверх автопилота */
  F.look.x += (F.look.tx - F.look.x) * Math.min(1, dt * 5);
  F.look.y += (F.look.ty - F.look.y) * Math.min(1, dt * 5);
  w3.cam.rotateY(-F.look.x);
  w3.cam.rotateX(-F.look.y);
  /* Портрет: окно кокпита выше середины экрана, и цель, посаженная
     в геометрический центр, пряталась под нижнюю раму. Лёгкий
     наклон камеры вниз поднимает цель в стекло. */
  if (innerHeight > innerWidth) w3.cam.rotateX(-0.042);

  /* Тряска на прыжке и у дыры */
  var nearHole = Math.max(0, 1 - w3.cam.position.distanceTo(w3.hole.position) / 500);
  F.shake += ((jumpZone ? 1 : 0) * 0.8 + nearHole * 0.7 - F.shake) * Math.min(1, dt * 3);
  if (F.shake > 0.02) {
    w3.cam.rotateZ(Math.sin(ts * 0.021) * 0.004 * F.shake);
    w3.cam.position.x += Math.sin(ts * 0.037) * 0.5 * F.shake;
    w3.cam.position.y += Math.cos(ts * 0.029) * 0.5 * F.shake;
  }

  /* Поле зрения дышит от скорости */
  var speed = Math.abs(F.v);
  var fovGoal = (W3.fov0 || 72) + speed * 46 + (jumpZone ? 14 : 0);
  w3.cam.fov += (fovGoal - w3.cam.fov) * Math.min(1, dt * 4);
  w3.cam.updateProjectionMatrix();

  /* Живой мир */
  w3.earth.rotation.y += dt * 0.02;
  if (w3.clouds) w3.clouds.rotation.y += dt * 0.009;
  w3.moon.rotation.y += dt * 0.012;
  w3.mars.rotation.y += dt * 0.022;
  w3.saturn.rotation.y += dt * 0.03;
  w3.hole.rotation.y += dt * 0.14;
  w3.diskMat.uniforms.uT.value = ts * 0.001;
  w3.sky.rotation.y += dt * 0.0025;
  if (w3.milky) { w3.milky.rotation.y += dt * 0.01; w3.gal2.rotation.y -= dt * 0.008; w3.gal3.rotation.y += dt * 0.012; }
  if (w3.belt1) { w3.belt1.rotation.y += dt * 0.0012; w3.belt2.rotation.y -= dt * 0.0009; }

  /* Пыль заворачивается вокруг камеры: частица, отставшая больше
     чем на полкуба, перекладывается на другую сторону */
  if (w3.dust && ts - (frame._dustT || 0) > 120) {
    frame._dustT = ts;
    var dp = w3.dust.geometry.attributes.position, half = w3.dust.userData.side / 2;
    var cxp = w3.cam.position.x, cyp = w3.cam.position.y, czp = w3.cam.position.z;
    for (var di = 0; di < dp.count; di++) {
      var vx = dp.getX(di), vy = dp.getY(di), vz = dp.getZ(di);
      var moved = false;
      if (vx - cxp > half) { vx -= half * 2; moved = true; } else if (cxp - vx > half) { vx += half * 2; moved = true; }
      if (vy - cyp > half) { vy -= half * 2; moved = true; } else if (cyp - vy > half) { vy += half * 2; moved = true; }
      if (vz - czp > half) { vz -= half * 2; moved = true; } else if (czp - vz > half) { vz += half * 2; moved = true; }
      if (moved) dp.setXYZ(di, vx, vy, vz);
    }
    dp.needsUpdate = true;
  }

  /* Страж плавности: если кадры стабильно тяжёлые, снижаем
     разрешение рендера ступенями и в крайнем случае снимаем
     облака. Вверх не откатываемся - мигание качеством хуже. */
  frame._ema = (frame._ema || 0.016) * 0.95 + dt * 0.05;
  if (frame._ema > 0.055 && ts - (frame._degT || 0) > 4000) {
    frame._degT = ts;
    frame._deg = (frame._deg || 0) + 1;
    if (frame._deg === 1) w3.r.setPixelRatio(Math.max(1, (g.devicePixelRatio || 1) * 0.75));
    else if (frame._deg === 2) w3.r.setPixelRatio(1);
    else if (frame._deg === 3 && w3.clouds) w3.clouds.visible = false;
  }

  /* Комета: эллипс между Марсом и Сатурном, хвост от солнца */
  if (w3.comet) {
    var ca = ts * 0.000021;
    w3.comet.position.set(950 + Math.cos(ca) * 520, -40 + Math.sin(ca * 1.7) * 90, -860 + Math.sin(ca) * 300);
    w3.tmpB.copy(w3.comet.position).sub(w3.sunGlow.position).normalize();
    w3.comet.lookAt(w3.tmpA.copy(w3.comet.position).add(w3.tmpB));
    w3.comet.rotateY(Math.PI / 2);
  }
  /* Спутник: низкая орбита Земли с наклоном */
  if (w3.sat) {
    var sa = ts * 0.00011;
    w3.sat.position.set(Math.cos(sa) * 76, 18 + Math.sin(sa * 2) * 12, Math.sin(sa) * 76);
    w3.sat.rotation.y = sa + 1.2;
  }

  /* Сканер: находит цель ближе всех к центру кадра, ведёт её
     рамкой захвата и пишет дистанцию. Заодно пополняет журнал
     исследователя. Работает в своём темпе - двенадцать раз в
     секунду, дешевле рейкаста. */
  if (F.scan && ui.lock && ts - (frame._scanT || 0) > 84) {
    frame._scanT = ts;
    var bestT = null, bestD = 0.55, sx = 0, sy = 0, bd = 0;
    for (var si = 0; si < (w3.scanTargets || []).length; si++) {
      var tg = w3.scanTargets[si];
      w3.tmpA.setFromMatrixPosition(tg.o.matrixWorld).project(w3.cam);
      if (w3.tmpA.z > 1) continue;                  /* за спиной */
      var dxn = w3.tmpA.x, dyn = w3.tmpA.y;
      var dc = Math.sqrt(dxn * dxn + dyn * dyn);
      if (dc < bestD) {
        bestD = dc; bestT = tg;
        sx = (dxn * 0.5 + 0.5) * innerWidth;
        sy = (-dyn * 0.5 + 0.5) * innerHeight;
        bd = w3.cam.position.distanceTo(w3.tmpB.setFromMatrixPosition(tg.o.matrixWorld));
      }
    }
    if (bestT) {
      ui.lock.classList.add("on");
      ui.lock.style.left = sx + "px";
      ui.lock.style.top = sy + "px";
      /* Масштаб мира: радиус Земли 60 единиц = 6371 км, то есть
         единица - около ста километров. Дистанции получаются
         орбитальные, как и вся сцена. */
      var tkm = bd * 106 / 1000;
      ui.lockCap.textContent = bestT.name + " · " + (tkm >= 1000
        ? ((tkm / 1000).toFixed(1) + (RU ? " млн км" : "M km"))
        : (Math.round(tkm) + (RU ? " тыс. км" : "K km")));
      noteExplored(bestT.key);
    } else {
      ui.lock.classList.remove("on");
    }
  }

  /* Бортовой справочник: навёл на планету или галактику - корабль
     говорит, что это и когда открыто. Дорогую проверку пересечений
     гоняем восемь раз в секунду, не каждый кадр. */
  if (ui.info && (F.mx !== undefined) && ts - (frame._pickT || 0) > 120) {
    frame._pickT = ts;
    if (!frame._ray) frame._ray = new T.Raycaster();
    frame._ray.setFromCamera({ x: F.mx, y: F.my }, w3.cam);
    var hits = frame._ray.intersectObjects(w3.pickables || [], false);
    var info = null;
    for (var hi = 0; hi < hits.length; hi++) {
      if (hits[hi].object.userData && hits[hi].object.userData.info) { info = hits[hi].object.userData.info; break; }
    }
    if (info !== frame._info) {
      frame._info = info;
      if (info) {
        ui.info.textContent = info;
        ui.info.classList.add("on");
        noteExplored(info.split(" ")[0]);
        if (g.RC_SOUND) { try { (g.RC_SOUND.uiHover || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
      }
      else ui.info.classList.remove("on");
    }
    F.pick = false;
  }

  /* Стримы прыжка едут за камерой и светятся только в прыжке */
  var jm = w3.jump.material;
  jm.opacity += ((jumpZone ? 0.85 : 0) - jm.opacity) * Math.min(1, dt * 3);
  if (jm.opacity > 0.01) {
    w3.jump.position.copy(w3.cam.position);
    w3.jump.quaternion.copy(w3.cam.quaternion);
    /* Фаза туннеля: к концу прыжка полосы уходят из циана в
       фиолет - слышно, что летим уже по другому рукаву */
    if (w3.at) {
      var jk = (F.p - w3.at.jump0) / Math.max(0.001, w3.at.jump1 - w3.at.jump0);
      jk = jk < 0 ? 0 : jk > 1 ? 1 : jk;
      jm.color.setRGB(0.62 - jk * 0.2, 0.85 - jk * 0.35, 0.94);
    }
  }

  /* Панель кабины чуть оседает на разгоне: перегрузка */
  if (ui.wrap) ui.wrap.style.setProperty("--rcf-g", (speed * 5).toFixed(3));

  /* HUD */
  var cap = CAPTIONS[0];
  for (i = CAPTIONS.length - 1; i >= 0; i--) { if (F.p >= CAPTIONS[i].p) { cap = CAPTIONS[i]; break; } }
  /* Пока идёт перелёт к цели, титул честно говорит, куда летим */
  if (F.goal !== null && F.goal !== undefined && F.goalName) {
    cap = { t: (RU ? "КУРС → " : "COURSE → ") + F.goalName };
  }
  if (ui.cap._t !== cap.t && !(ui.cap._hold && ts < ui.cap._hold)) {
    ui.cap._t = cap.t;
    ui.cap.classList.remove("in");
    void ui.cap.offsetWidth;
    ui.cap.textContent = cap.t;
    ui.cap.classList.add("in");
  }
  ui.bar.style.width = (F.p * 100).toFixed(1) + "%";
  ui.speed.textContent = String(Math.round(7.9 + speed * 6200));
  ui.ret.classList.toggle("on", F.p > 0.965);

  /* Звук идёт за тягой */
  if (g.RC_SOUND && g.RC_SOUND.flightLevel) {
    try { g.RC_SOUND.flightLevel(Math.min(1, 0.25 + speed * 4 + (jumpZone ? 0.35 : 0))); } catch (e) {}
  }

  w3.r.render(w3.scene, w3.cam);
}

/* ── Вход и выход ────────────────────────────────────────────ы */
function open() {
  if (F.open) return;
  if (!g.THREE) {
    /* Объёмный слой ещё не доехал: дожидаемся и пробуем снова */
    var once = function () { removeEventListener("rc:3d", once); open(); };
    addEventListener("rc:3d", once);
    if (g.RC_GL && !g.RC_GL.want3d) return;   /* этому устройству не положено */
    return;
  }
  buildUI();
  if (!F.built) {
    try { W3 = buildWorld(); } catch (e) {
      if (g.RC_track) g.RC_track("jserr", "flight: " + (e.message || e), true);
      return;
    }
    F.built = true;
  }

  F.open = true;
  F.p = 0; F.v = 0; F.last = 0;
  F.scan = false;
  if (ui.scanKey) { ui.scanKey.classList.remove("cur"); ui.scanKey.setAttribute("aria-pressed", "false"); }
  if (ui.lock) ui.lock.classList.remove("on");
  paintProgress();
  setAuto(true);
  F.look.x = F.look.y = F.look.tx = F.look.ty = 0;
  hintHidden = false;
  if (ui.hint) ui.hint.classList.remove("off");

  root.classList.add("rc-flying");
  ui.wrap.classList.add("on");
  size();

  /* Сцены сайта спят, музыка встаёт в полный рост */
  try { dispatchEvent(new CustomEvent("rc:flight", { detail: { on: true } })); } catch (e) {}
  if (g.RC_MUSIC && g.RC_MUSIC.boost) { try { g.RC_MUSIC.boost(true); } catch (e) {} }
  if (g.RC_SOUND && g.RC_SOUND.flight) { try { g.RC_SOUND.flight(true); } catch (e) {} }
  if (g.RC_track) g.RC_track("flight", "open");

  F.raf = requestAnimationFrame(frame);
}

function close() {
  if (!F.open) return;
  F.open = false;
  if (F.raf) cancelAnimationFrame(F.raf);
  root.classList.remove("rc-flying");
  ui.wrap.classList.remove("on");
  try { dispatchEvent(new CustomEvent("rc:flight", { detail: { on: false } })); } catch (e) {}
  if (g.RC_MUSIC && g.RC_MUSIC.boost) { try { g.RC_MUSIC.boost(false); } catch (e) {} }
  if (g.RC_SOUND && g.RC_SOUND.flight) { try { g.RC_SOUND.flight(false); } catch (e) {} }
  if (g.RC_track) g.RC_track("flight", "close p=" + F.p.toFixed(2));
}

/* ── Кнопки запуска ──────────────────────────────────────────
   Плавающая кнопка появляется после первого экрана и живёт до
   конца страницы: клиент просил вход в полёт из любого места. */
function launchers() {
  var btns = [].slice.call(doc.querySelectorAll(".js-flight"));
  btns.forEach(function (b) { b.addEventListener("click", open); });

  var fab = doc.createElement("button");
  fab.type = "button";
  fab.className = "rcf-fab js-flight";
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>' +
    '<path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>' +
    '<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>' +
    '<span>' + (RU ? "Полёт" : "Flight") + '</span>';
  fab.addEventListener("click", open);
  doc.body.appendChild(fab);

  var seen = false;
  addEventListener("scroll", function () {
    var show = (g.scrollY || 0) > innerHeight * 0.6;
    if (show !== seen) { seen = show; fab.classList.toggle("on", show); }
  }, { passive: true });

  /* Сценарий клиента: заявка отправлена - экран пульта гаснет,
     и корабль отправляется в демо-облёт сам. */
  var form = doc.querySelector("#contact form");
  if (form) form.addEventListener("submit", function () {
    var msg = form.querySelector(".form-msg");
    var tries = 0;
    var wait = setInterval(function () {
      if (++tries > 40) { clearInterval(wait); return; }
      if (msg && msg.className.indexOf("ok") >= 0) {
        clearInterval(wait);
        setTimeout(open, 1600);
      }
    }, 250);
  });
}

g.RC_FLIGHT = {
  open: open, close: close,
  _dbg: function () {
    if (!W3) return null;
    var d = new g.THREE.Vector3(); W3.cam.getWorldDirection(d);
    var e = new g.THREE.Vector3(0, 0, 0).sub(W3.cam.position).normalize();
    return { pos: W3.cam.position.toArray().map(Math.round),
             dir: d.toArray().map(function(v){return +v.toFixed(2)}),
             toEarth: e.toArray().map(function(v){return +v.toFixed(2)}),
             угол: +(Math.acos(Math.max(-1,Math.min(1,d.dot(e)))) * 57.3).toFixed(1) };
  },
  state: function () {
    return { открыт: F.open, собран: F.built, p: +F.p.toFixed(3), v: +F.v.toFixed(5),
             отметки: W3 && W3.at ? W3.at : null };
  }
};

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", launchers);
else launchers();

})(window);
