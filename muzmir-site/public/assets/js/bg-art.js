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
    W = cv.clientWidth = window.innerWidth;
    H = cv.clientHeight = window.innerHeight;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!notes.length || Math.abs(W - lastSeedW) > 60) { lastSeedW = W; seed(); }
  }

  function seed() {
    var area = W * H;
    // Ноты — заметно больше, чем раньше.
    var noteN = Math.max(14, Math.min(32, Math.round(area / 44000)));
    notes = [];
    for (var i = 0; i < noteN; i++) {
      notes.push({
        x: rnd(0, W), y: rnd(0, H),
        s: rnd(12, 30),
        vy: rnd(-10, -26) / 60,
        vx: rnd(-6, 6) / 60,
        rot: rnd(-0.4, 0.4), vr: rnd(-0.3, 0.3) / 60,
        sway: rnd(0, Math.PI * 2), swaySp: rnd(0.4, 1.1),
        op: rnd(0.35, 0.85),
        gl: pick(['𝄞', '♫', '♪', '♬', '♩', '♫'])
      });
    }
    // Звёзды — украшают тёмное небо (мерцание), больше и ярче.
    var starN = Math.max(60, Math.min(160, Math.round(area / 8500)));
    stars = [];
    for (var j = 0; j < starN; j++) {
      var rr = Math.random();
      stars.push({ x: rnd(0, W), y: rnd(0, H * 0.92), r: 0.4 + rr * rr * 1.9,
        ph: rnd(0, Math.PI * 2), tw: rnd(0.6, 1.8), gold: Math.random() < 0.22 });
    }
    // Золотые искры-пыльца (для светлой темы среди облаков).
    sparks = [];
    var sparkN = Math.max(18, Math.min(42, Math.round(area / 40000)));
    for (var k = 0; k < sparkN; k++) {
      sparks.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.6, 2.0),
        ph: rnd(0, Math.PI * 2), tw: rnd(0.5, 1.4), vy: rnd(-4, -10) / 60, vx: rnd(-3, 3) / 60 });
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
    if (theme !== 'dark') return;
    var tw = 0.55 + 0.45 * Math.sin(t * 0.001 * s.tw + s.ph);
    ctx.globalAlpha = tw * 0.95;
    if (ctx.globalAlpha <= 0.02) return;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = s.gold ? '#FFE9A8' : '#EAF2FF';
    ctx.shadowColor = s.gold ? 'rgba(255,213,120,0.9)' : 'rgba(200,224,255,0.8)';
    ctx.shadowBlur = 6 + s.r * 3;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawSpark(s, t) {
    if (theme === 'dark') return;
    s.x += s.vx; s.y += s.vy;
    if (s.y < -6) { s.y = H + 6; s.x = rnd(0, W); }
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

  function drawNote(n, t) {
    ctx.save();
    var sway = Math.sin(t * 0.0006 * n.swaySp + n.sway) * 10;
    ctx.translate(n.x + sway, n.y);
    ctx.rotate(n.rot);
    ctx.globalAlpha = n.op;
    var grd = ctx.createLinearGradient(0, -n.s, 0, n.s);
    grd.addColorStop(0, theme === 'dark' ? '#FFE082' : '#D89A3D');
    grd.addColorStop(1, theme === 'dark' ? '#C79322' : '#A9741C');
    ctx.fillStyle = grd;
    ctx.shadowColor = theme === 'dark' ? 'rgba(255,214,110,0.6)' : 'rgba(199,147,34,0.45)';
    ctx.shadowBlur = 10;
    ctx.font = '700 ' + (n.s * 1.8) + "px 'Segoe UI Symbol','Noto Music','Noto Sans Symbols',serif";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(n.gl, 0, 0);
    ctx.restore();
    n.x += n.vx; n.y += n.vy; n.rot += n.vr;
    if (n.y < -n.s * 2) { n.y = H + n.s * 2; n.x = rnd(0, W); }
    if (n.x < -n.s * 2) n.x = W + n.s; if (n.x > W + n.s * 2) n.x = -n.s;
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
