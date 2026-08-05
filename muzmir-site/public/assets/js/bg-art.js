/**
 * Живой фон-оверлей Культурного центра «Музыкальный Мир».
 * ВАЖНО: canvas ПРОЗРАЧНЫЙ и лежит ПОВЕРХ реального фона:
 *   тёмная тема — видео настоящей Земли из космоса (.bg-earth),
 *   светлая тема — настоящие облака (.bg-sky/.bg-clouds).
 * Здесь рисуем только «магию» поверх: летящие ноты, мерцающие звёзды и кометы.
 * Один canvas, requestAnimationFrame, смена темы на лету (data-theme на <html>).
 */
(function () {
  'use strict';
  var cv = document.getElementById('mzBgArt');
  if (!cv) return;
  var ctx = cv.getContext('2d', { alpha: true });
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, lastSeedW = 0;
  var theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var notes = [], stars = [], comets = [], sparks = [];
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function resize() {
    // ВАЖНО: clientWidth/clientHeight — только для чтения; присваивание им в strict-mode
    // кидает TypeError и роняет весь скрипт (из-за этого фон-канвас не инициализировался).
    W = window.innerWidth;
    H = window.innerHeight;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!notes.length || Math.abs(W - lastSeedW) > 60) { lastSeedW = W; seed(); }
  }

  function seed() {
    var area = W * H;
    // Ноты — изящные, некрупные, полупрозрачные (эстетичный фон, не «баннер»).
    var noteN = Math.max(12, Math.min(26, Math.round(area / 52000)));
    notes = [];
    for (var i = 0; i < noteN; i++) {
      var big = Math.random() < 0.28;               // редкие покрупнее — для глубины
      notes.push({
        x: rnd(0, W), y: rnd(0, H),
        s: big ? rnd(15, 20) : rnd(8, 13),
        vy: rnd(7, 16) / 60,  // мягко падают сверху вниз
        vx: rnd(-4, 4) / 60,
        rot: rnd(-0.28, 0.28), vr: rnd(-0.22, 0.22) / 60,
        sway: rnd(0, Math.PI * 2), swaySp: rnd(0.3, 0.9),
        op: (big ? rnd(0.28, 0.5) : rnd(0.4, 0.66)),
        // Тип рисуется ВЕКТОРОМ (не Unicode-глифом — они не во всех шрифтах):
        // 0 восьмая, 1 пара с балкой, 2 четверть, 3 скрипичный ключ.
        kind: pick([0, 1, 0, 2, 3, 0, 3])
      });
    }
    // Звёзды — мерцают на ОБЕИХ темах (в тёмной ярче/крупнее, в светлой — деликатно).
    var starN = Math.max(46, Math.min(140, Math.round(area / 10000)));
    stars = [];
    for (var j = 0; j < starN; j++) {
      var rr = Math.random();
      stars.push({ x: rnd(0, W), y: rnd(0, H * 0.95), r: 0.4 + rr * rr * 1.7,
        ph: rnd(0, Math.PI * 2), tw: rnd(0.6, 1.8), gold: Math.random() < 0.3, vy: rnd(4, 12) / 60 });
    }
    // Золотые искры-пыльца (для светлой темы среди облаков).
    sparks = [];
    var sparkN = Math.max(18, Math.min(42, Math.round(area / 40000)));
    for (var k = 0; k < sparkN; k++) {
      sparks.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.6, 2.0),
        ph: rnd(0, Math.PI * 2), tw: rnd(0.5, 1.4), vy: rnd(4, 11) / 60, vx: rnd(-3, 3) / 60 });
    }
    comets = [];
  }

  function spawnComet() {
    var fromLeft = Math.random() < 0.5;
    comets.push({
      x: fromLeft ? -40 : W + 40, y: rnd(0, H * 0.5),
      vx: (fromLeft ? 1 : -1) * rnd(3.2, 6.0), vy: rnd(1.2, 2.6),
      len: rnd(90, 210), life: 0, max: rnd(120, 220), w: rnd(1.4, 2.6)
    });
  }

  function drawStar(s, t) {
    var dark = theme === 'dark';
    s.y += s.vy; if (s.y > H + 2) { s.y = -2; s.x = rnd(0, W); }
    var tw = 0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.ph);
    // На светлой теме звёзды тоже есть, но деликатнее (тёплое золото по небу).
    ctx.globalAlpha = tw * (dark ? 0.95 : 0.5);
    if (ctx.globalAlpha <= 0.02) return;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (dark ? 1 : 0.85), 0, Math.PI * 2);
    if (dark) {
      ctx.fillStyle = s.gold ? '#FFE9A8' : '#EAF2FF';
      ctx.shadowColor = s.gold ? 'rgba(255,213,120,0.9)' : 'rgba(200,224,255,0.8)';
      ctx.shadowBlur = 6 + s.r * 3;
    } else {
      ctx.fillStyle = s.gold ? '#E9C55E' : '#FFFFFF';
      ctx.shadowColor = s.gold ? 'rgba(212,154,61,0.7)' : 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 4 + s.r * 2;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawSpark(s, t) {
    if (theme === 'dark') return;
    s.x += s.vx; s.y += s.vy;
    if (s.y > H + 6) { s.y = -6; s.x = rnd(0, W); }
    var tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.001 * s.tw + s.ph));
    ctx.globalAlpha = tw * 0.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = '#E8B44C';
    ctx.shadowColor = 'rgba(212,154,61,0.7)'; ctx.shadowBlur = 5;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawComet(c) {
    c.life++; c.x += c.vx; c.y += c.vy;
    var fade = c.life < 20 ? c.life / 20 : (c.life > c.max - 30 ? Math.max(0, (c.max - c.life) / 30) : 1);
    var h = Math.hypot(c.vx, c.vy) || 1;
    var tx = c.x - c.vx / h * c.len, ty = c.y - c.vy / h * c.len;
    var g = ctx.createLinearGradient(c.x, c.y, tx, ty);
    g.addColorStop(0, 'rgba(255,240,200,' + (0.9 * fade) + ')');
    g.addColorStop(0.4, 'rgba(255,214,120,' + (0.5 * fade) + ')');
    g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.strokeStyle = g; ctx.lineWidth = c.w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.beginPath(); ctx.arc(c.x, c.y, c.w * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,245,220,' + fade + ')';
    ctx.shadowColor = 'rgba(255,220,140,0.9)'; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
  }

  // Векторная головка ноты (наклонный залитый эллипс).
  function noteHead(x, y, r) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.18, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Стилизованный скрипичный ключ (безье), рисуется на любом устройстве одинаково.
  function drawTreble(s) {
    var u = s * 0.5;
    ctx.lineWidth = Math.max(1.6, s * 0.17); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0.2 * u, 2.4 * u);
    ctx.bezierCurveTo(1.7 * u, 1.7 * u, 1.5 * u, -0.3 * u, 0.1 * u, -0.3 * u);
    ctx.bezierCurveTo(-1.4 * u, -0.3 * u, -1.3 * u, 1.7 * u, 0.35 * u, 1.85 * u);
    ctx.bezierCurveTo(2.0 * u, 2.0 * u, 1.8 * u, -1.5 * u, 0.2 * u, -2.6 * u);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(-0.05 * u, 2.9 * u, u * 0.3, 0, Math.PI * 2); ctx.fill();
  }

  // Рисует фигуру ноты (kind) с центром в (0,0), масштаб s. Заливка/обводка — уже заданы.
  function drawNoteShape(kind, s) {
    var r = s * 0.42;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 3) { drawTreble(s); return; }
    if (kind === 1) { // пара нот с балкой
      var dx = s * 0.95;
      noteHead(-dx * 0.5, r * 0.9, r); noteHead(dx * 0.5, r * 0.9, r);
      ctx.lineWidth = Math.max(1.5, s * 0.13);
      ctx.beginPath();
      ctx.moveTo(-dx * 0.5 + r * 1.05, r * 0.9); ctx.lineTo(-dx * 0.5 + r * 1.05, -s * 1.15);
      ctx.moveTo(dx * 0.5 + r * 1.05, r * 0.9); ctx.lineTo(dx * 0.5 + r * 1.05, -s * 1.15);
      ctx.stroke();
      ctx.lineWidth = s * 0.3;
      ctx.beginPath(); ctx.moveTo(-dx * 0.5 + r * 1.0, -s * 1.1); ctx.lineTo(dx * 0.5 + r * 1.1, -s * 1.1); ctx.stroke();
      return;
    }
    noteHead(0, r * 0.9, r);
    ctx.lineWidth = Math.max(1.5, s * 0.13);
    ctx.beginPath(); ctx.moveTo(r * 1.05, r * 0.9); ctx.lineTo(r * 1.05, -s * 1.2); ctx.stroke();
    if (kind === 0) { // флажок восьмой
      ctx.lineWidth = Math.max(1.6, s * 0.16);
      ctx.beginPath(); ctx.moveTo(r * 1.05, -s * 1.2);
      ctx.quadraticCurveTo(r * 1.05 + s * 0.95, -s * 0.85, r * 1.05 + s * 0.2, -s * 0.28);
      ctx.stroke();
    }
  }

  function drawNote(n, t) {
    ctx.save();
    var sway = Math.sin(t * 0.0006 * n.swaySp + n.sway) * 12;
    ctx.translate(n.x + sway, n.y);
    ctx.rotate(n.rot);
    ctx.globalAlpha = n.op;
    var grd = ctx.createLinearGradient(0, -n.s, 0, n.s);
    grd.addColorStop(0, theme === 'dark' ? '#FFE79A' : '#C79322');
    grd.addColorStop(1, theme === 'dark' ? '#E0A82E' : '#8A5E12');
    ctx.fillStyle = grd; ctx.strokeStyle = grd;
    ctx.shadowColor = theme === 'dark' ? 'rgba(255,214,110,0.55)' : 'rgba(120,80,10,0.35)';
    ctx.shadowBlur = theme === 'dark' ? 12 : 6;
    drawNoteShape(n.kind, n.s);
    ctx.restore();
    n.x += n.vx; n.y += n.vy; n.rot += n.vr;
    if (n.y > H + n.s * 3) { n.y = -n.s * 3; n.x = rnd(0, W); }
    if (n.x < -n.s * 3) n.x = W + n.s; if (n.x > W + n.s * 3) n.x = -n.s;
  }

  var cometTimer = 0;
  function frame(t) {
    if (!t) t = 0;
    ctx.clearRect(0, 0, W, H); // прозрачно — реальный фон (видео/облака) виден сквозь
    ctx.globalAlpha = 1;
    for (var i = 0; i < stars.length; i++) drawStar(stars[i], t);
    for (var k = 0; k < sparks.length; k++) drawSpark(sparks[k], t);
    if (!reduce) {
      cometTimer++;
      var every = theme === 'dark' ? 150 : 340;
      if (cometTimer > every && comets.length < 3) { cometTimer = 0; spawnComet(); }
      for (var c = comets.length - 1; c >= 0; c--) {
        drawComet(comets[c]);
        var cc = comets[c];
        if (cc.life > cc.max || cc.x < -80 || cc.x > W + 80 || cc.y > H + 80) comets.splice(c, 1);
      }
    }
    ctx.globalAlpha = 1;
    for (var j = 0; j < notes.length; j++) drawNote(notes[j], t);
    ctx.globalAlpha = 1;
    if (reduce) return; // статичный кадр
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize, { passive: true });
  new MutationObserver(function () {
    var nt = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    if (nt !== theme) theme = nt;
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  resize();
  requestAnimationFrame(frame);
})();
