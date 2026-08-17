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
  last: 0, raf: null, shake: 0
};

var ui = {};      /* DOM оверлея */
var W3 = null;    /* всё трёхмерное */

/* ── Оверлей ─────────────────────────────────────────────────
   DOM собирается один раз при первом открытии: кнопка полёта не
   должна ничего стоить тем, кто её не нажал. */
function buildUI() {
  if (ui.wrap) return;
  var w = doc.createElement("div");
  w.className = "rc-flight";
  w.innerHTML =
    '<canvas class="rcf-cv"></canvas>' +
    '<div class="rcf-cockpit" aria-hidden="true"></div>' +
    '<div class="rcf-hud">' +
      '<div class="rcf-cap" aria-live="polite"></div>' +
      '<div class="rcf-track"><i></i></div>' +
      '<div class="rcf-hint">' + (matchMedia("(pointer: coarse)").matches
        ? (RU ? "Ведите пальцем вверх - тяга, в сторону - взгляд" : "Swipe up to thrust, sideways to look")
        : (RU ? "Колесо или свайп - тяга. Мышь - взгляд." : "Scroll or swipe to thrust. Mouse to look.")) + '</div>' +
      '<div class="rcf-speed"><b>0</b><span>' + (RU ? "км/с" : "km/s") + '</span></div>' +
    '</div>' +
    '<button type="button" class="rcf-close" aria-label="' + (RU ? "Выйти из полёта" : "Exit flight") + '">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
    '</button>' +
    '<button type="button" class="rcf-return">' + (RU ? "Вернуться на сайт" : "Back to the site") + '</button>' +
    '<div class="rcf-fade"></div>';
  doc.body.appendChild(w);
  ui.wrap = w;
  ui.cv = w.querySelector(".rcf-cv");
  ui.cap = w.querySelector(".rcf-cap");
  ui.bar = w.querySelector(".rcf-track i");
  ui.hint = w.querySelector(".rcf-hint");
  ui.speed = w.querySelector(".rcf-speed b");
  ui.ret = w.querySelector(".rcf-return");
  ui.fade = w.querySelector(".rcf-fade");

  w.querySelector(".rcf-close").addEventListener("click", close);
  ui.ret.addEventListener("click", close);
  bindControls();
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
  r.setPixelRatio(Math.min(g.devicePixelRatio || 1, mob ? 1.35 : 1.65));
  r.setClearColor(0x02050c, 1);

  var scene = new T.Scene();
  var portrait = innerHeight > innerWidth;
  var FOV0 = portrait ? 84 : 72;
  var cam = new T.PerspectiveCamera(FOV0, 1, 0.1, 9000);

  scene.add(new T.AmbientLight(0x3a4a68, 0.85));
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
  stars(mob ? 2400 : 5200, 2.4, 3000, 0xcfe9f5);
  stars(mob ? 900 : 2200, 3.6, 2200, 0x8fb7ff);
  stars(mob ? 400 : 900, 4.8, 1500, 0xffe9c9);

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
  for (var i = 0; i < nebs.length; i++) {
    var sp = new T.Sprite(new T.SpriteMaterial({ map: nebs[i][4], transparent: true, opacity: 0.5, depthWrite: false }));
    sp.position.set(nebs[i][0], nebs[i][1], nebs[i][2]);
    sp.scale.setScalar(nebs[i][3]);
    scene.add(sp);
  }

  /* ── Земля ── */
  var earth = new T.Group();
  var eBody = new T.Mesh(
    new T.SphereGeometry(60, mob ? 48 : 64, mob ? 36 : 48),
    new T.MeshPhongMaterial({
      map: tex("assets/space/earth-day.jpg"),
      emissiveMap: tex("assets/space/earth-night.jpg"),
      emissive: new T.Color(0xffd9a0), emissiveIntensity: 0.75,
      specular: new T.Color(0x223344), shininess: 14
    })
  );
  earth.add(eBody);
  /* Атмосфера: подсвеченный ободок изнутри наружу */
  var atm = new T.Mesh(
    new T.SphereGeometry(62.6, 48, 36),
    new T.ShaderMaterial({
      transparent: true, side: T.BackSide, depthWrite: false,
      uniforms: {},
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying vec3 vN; void main(){ float f = pow(0.72 - dot(vN, vec3(0.0,0.0,-1.0)), 3.2); gl_FragColor = vec4(0.30,0.62,0.95, f * 0.9); }"
    })
  );
  earth.add(atm);
  scene.add(earth);

  /* ── Луна ── */
  var moon = new T.Mesh(
    new T.SphereGeometry(16, 40, 28),
    new T.MeshPhongMaterial({ map: tex("assets/space/moon.jpg"), shininess: 2 })
  );
  moon.position.set(300, 40, -190);
  scene.add(moon);

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
  var diskGeo = new T.RingGeometry(30, 105, 110, 1);
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
  var halo = new T.Sprite(new T.SpriteMaterial({ map: glowSprite(256, "rgba(255,140,50,.4)", "rgba(255,80,20,0)"), transparent: true, opacity: 0.55, depthWrite: false }));
  halo.scale.setScalar(240);
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
    new T.Vector3(0, 40, -260),
    new T.Vector3(-40, 14, 190)          /* торможение у Земли */
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
    { p: AT.hole - 0.04, at: hole.position },
    { p: AT.hole + 0.03, at: hole.position },
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
  CAPTIONS[7].p = AT.jump1 + 0.02;
  for (var ci = 1; ci < CAPTIONS.length; ci++) {
    if (CAPTIONS[ci].p < CAPTIONS[ci - 1].p + 0.03) CAPTIONS[ci].p = CAPTIONS[ci - 1].p + 0.03;
  }

  /* Той же монотонности требует и график взгляда */
  for (var li = 1; li < LOOKS.length; li++) {
    if (LOOKS[li].p < LOOKS[li - 1].p + 0.015) LOOKS[li].p = LOOKS[li - 1].p + 0.015;
  }

  return {
    r: r, scene: scene, cam: cam, path: path, looks: LOOKS, at: AT, fov0: FOV0,
    earth: earth, moon: moon, mars: mars, saturn: saturn, hole: hole,
    diskMat: diskMat, jump: jump, sky: sky,
    tmpA: new T.Vector3(), tmpB: new T.Vector3(), tmpQ: new T.Quaternion(), tmpM: new T.Matrix4()
  };
}

/* ── Управление ──────────────────────────────────────────────ы */
function bindControls() {
  var w = ui.wrap;

  w.addEventListener("wheel", function (e) {
    e.preventDefault();
    F.v += e.deltaY * 0.0001;
    hideHint();
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
  }, { passive: true });

  addEventListener("keydown", function (e) {
    if (!F.open) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { F.v += 0.14; e.preventDefault(); hideHint(); }
    if (e.key === "ArrowUp" || e.key === "PageUp") { F.v -= 0.14; e.preventDefault(); hideHint(); }
  });

  addEventListener("resize", size, { passive: true });
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
  F.v *= Math.pow(0.14, dt);
  F.v = Math.max(-0.2, Math.min(0.3, F.v));
  F.p += F.v * dt;
  if (F.p < 0) { F.p = 0; F.v = 0; }
  if (F.p > 1) { F.p = 1; F.v = 0; }

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
  w3.cam.quaternion.slerp(w3.tmpQ, Math.min(1, dt * 3.2));

  /* Взгляд человека поверх автопилота */
  F.look.x += (F.look.tx - F.look.x) * Math.min(1, dt * 5);
  F.look.y += (F.look.ty - F.look.y) * Math.min(1, dt * 5);
  w3.cam.rotateY(-F.look.x);
  w3.cam.rotateX(-F.look.y);

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
  w3.moon.rotation.y += dt * 0.012;
  w3.mars.rotation.y += dt * 0.022;
  w3.saturn.rotation.y += dt * 0.03;
  w3.hole.rotation.y += dt * 0.14;
  w3.diskMat.uniforms.uT.value = ts * 0.001;
  w3.sky.rotation.y += dt * 0.0025;

  /* Стримы прыжка едут за камерой и светятся только в прыжке */
  var jm = w3.jump.material;
  jm.opacity += ((jumpZone ? 0.85 : 0) - jm.opacity) * Math.min(1, dt * 3);
  if (jm.opacity > 0.01) {
    w3.jump.position.copy(w3.cam.position);
    w3.jump.quaternion.copy(w3.cam.quaternion);
  }

  /* Панель кабины чуть оседает на разгоне: перегрузка */
  if (ui.wrap) ui.wrap.style.setProperty("--rcf-g", (speed * 5).toFixed(3));

  /* HUD */
  var cap = CAPTIONS[0];
  for (i = CAPTIONS.length - 1; i >= 0; i--) { if (F.p >= CAPTIONS[i].p) { cap = CAPTIONS[i]; break; } }
  if (ui.cap._t !== cap.t) {
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
  state: function () {
    return { открыт: F.open, собран: F.built, p: +F.p.toFixed(3), v: +F.v.toFixed(5),
             отметки: W3 && W3.at ? W3.at : null };
  }
};

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", launchers);
else launchers();

})(window);
