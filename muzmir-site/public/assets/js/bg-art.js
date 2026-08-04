/* Рисованный анимационный фон «Музыкальный Мир».
 * Тёмная тема — космос: звёзды, Луна, Земля с атмосферой, золотые ноты с блеском.
 * Светлая тема — тёплое небо: солнце с живыми лучами, боке, золотые ноты с блеском.
 * Один canvas, requestAnimationFrame, смена темы на лету (data-theme на <html>).
 * prefers-reduced-motion — статичный кадр без анимации.
 */
(function () {
  'use strict';
  var canvas = document.getElementById('mzBgArt');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  var W = 0, H = 0, area = 1;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

  var NOTE_GLYPHS = ['♪', '♫', '♩', '♬', '𝄞'];
  var notes = [], sparks = [], stars = [], bokeh = [];
  var t = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    area = Math.max(0.45, Math.min(1.6, (W * H) / (1280 * 800)));
    seed();
  }

  function seed() {
    var nNotes = Math.round(14 * area);
    notes = [];
    for (var i = 0; i < nNotes; i++) {
      notes.push({
        x: rnd(0, W), y: rnd(0, H),
        vx: rnd(-0.14, 0.14), vy: rnd(-0.32, -0.1),
        size: rnd(16, 34), rot: rnd(-0.4, 0.4), vr: rnd(-0.004, 0.004),
        glyph: NOTE_GLYPHS[i % NOTE_GLYPHS.length],
        phase: rnd(0, Math.PI * 2), alpha: rnd(0.5, 0.95)
      });
    }
    stars = [];
    var nStars = Math.round(150 * area);
    for (i = 0; i < nStars; i++) {
      stars.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.4, 1.5), ph: rnd(0, Math.PI * 2), sp: rnd(0.4, 1.6) });
    }
    bokeh = [];
    for (i = 0; i < Math.round(9 * area); i++) {
      bokeh.push({ x: rnd(0, W), y: rnd(0, H), r: rnd(28, 90), vx: rnd(-0.05, 0.05), vy: rnd(-0.08, -0.02), a: rnd(0.03, 0.09) });
    }
    sparks = [];
  }

  /* ---------- Светлая тема: солнце ---------- */
  function drawLight() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#FDF7E6'); g.addColorStop(0.45, '#FAF1DC'); g.addColorStop(1, '#F4E6C6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    var sx = W * 0.85, sy = H * 0.12, sr = Math.min(W, H) * 0.11;
    // Дальнее тёплое сияние
    var halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 5.2);
    halo.addColorStop(0, 'rgba(255,214,110,0.5)');
    halo.addColorStop(0.35, 'rgba(255,205,92,0.18)');
    halo.addColorStop(1, 'rgba(255,205,92,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    // Живые лучи (медленно вращаются, дышат)
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(t * 0.0006);
    for (var i = 0; i < 12; i++) {
      var la = 0.10 + 0.05 * Math.sin(t * 0.004 + i * 1.7);
      ctx.rotate(Math.PI / 6);
      var lg = ctx.createLinearGradient(0, 0, sr * 4.4, 0);
      lg.addColorStop(0, 'rgba(255,204,88,' + la.toFixed(3) + ')');
      lg.addColorStop(1, 'rgba(255,204,88,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(sr * 0.8, 0);
      ctx.lineTo(sr * 4.4, -sr * 0.34);
      ctx.lineTo(sr * 4.4, sr * 0.34);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Диск солнца
    var sun = ctx.createRadialGradient(sx - sr * 0.25, sy - sr * 0.25, sr * 0.1, sx, sy, sr);
    sun.addColorStop(0, '#FFF6D8'); sun.addColorStop(0.55, '#FFDF8E'); sun.addColorStop(1, '#F2BE5A');
    ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fillStyle = sun;
    ctx.shadowColor = 'rgba(255,205,92,0.85)'; ctx.shadowBlur = 44;
    ctx.fill(); ctx.shadowBlur = 0;
    // Боке
    for (i = 0; i < bokeh.length; i++) {
      var b = bokeh[i];
      b.x += b.vx; b.y += b.vy;
      if (b.y < -b.r) { b.y = H + b.r; b.x = rnd(0, W); }
      var bg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      bg.addColorStop(0, 'rgba(226,180,84,' + b.a + ')');
      bg.addColorStop(1, 'rgba(226,180,84,0)');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  /* ---------- Тёмная тема: космос, Луна, Земля ---------- */
  function drawDark() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060B22'); g.addColorStop(0.5, '#0A1330'); g.addColorStop(1, '#0C1738');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Туманности
    var neb1 = ctx.createRadialGradient(W * 0.2, H * 0.3, 0, W * 0.2, H * 0.3, Math.max(W, H) * 0.5);
    neb1.addColorStop(0, 'rgba(43,74,150,0.16)'); neb1.addColorStop(1, 'rgba(43,74,150,0)');
    ctx.fillStyle = neb1; ctx.fillRect(0, 0, W, H);
    var neb2 = ctx.createRadialGradient(W * 0.85, H * 0.75, 0, W * 0.85, H * 0.75, Math.max(W, H) * 0.4);
    neb2.addColorStop(0, 'rgba(199,147,34,0.07)'); neb2.addColorStop(1, 'rgba(199,147,34,0)');
    ctx.fillStyle = neb2; ctx.fillRect(0, 0, W, H);
    // Звёзды мерцают
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var a = 0.35 + 0.55 * Math.abs(Math.sin(t * 0.002 * s.sp + s.ph));
      ctx.fillStyle = 'rgba(255,248,222,' + a.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    // Луна (верхний правый угол)
    var mx = W * 0.84, my = H * 0.14, mr = Math.min(W, H) * 0.085;
    var mh = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 3.4);
    mh.addColorStop(0, 'rgba(240,240,255,0.22)'); mh.addColorStop(1, 'rgba(240,240,255,0)');
    ctx.fillStyle = mh; ctx.fillRect(0, 0, W, H);
    var moon = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr);
    moon.addColorStop(0, '#F5F3EA'); moon.addColorStop(0.7, '#D9D6C8'); moon.addColorStop(1, '#B9B5A5');
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = moon;
    ctx.shadowColor = 'rgba(235,235,250,0.6)'; ctx.shadowBlur = 30;
    ctx.fill(); ctx.shadowBlur = 0;
    // Кратеры
    ctx.fillStyle = 'rgba(150,146,130,0.35)';
    var craters = [[-0.3, -0.15, 0.16], [0.25, 0.1, 0.11], [0.02, 0.38, 0.13], [-0.12, 0.12, 0.07], [0.38, -0.3, 0.08]];
    for (i = 0; i < craters.length; i++) {
      ctx.beginPath();
      ctx.arc(mx + craters[i][0] * mr, my + craters[i][1] * mr, craters[i][2] * mr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Земля (нижний левый угол, крупная дуга из-за края)
    var ex = W * 0.06, ey = H * 1.06, er = Math.min(W, H) * 0.34;
    var atm = ctx.createRadialGradient(ex, ey, er * 0.9, ex, ey, er * 1.25);
    atm.addColorStop(0, 'rgba(90,160,255,0.0)');
    atm.addColorStop(0.75, 'rgba(96,170,255,0.28)');
    atm.addColorStop(1, 'rgba(96,170,255,0)');
    ctx.fillStyle = atm;
    ctx.beginPath(); ctx.arc(ex, ey, er * 1.25, 0, Math.PI * 2); ctx.fill();
    var earth = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.5, er * 0.2, ex, ey, er);
    earth.addColorStop(0, '#3E7EDB'); earth.addColorStop(0.6, '#1E4E9E'); earth.addColorStop(1, '#0E2B63');
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = earth; ctx.fill();
    // Материки (мягкие пятна) + лёгкое вращение
    ctx.save();
    ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(96,186,120,0.55)';
    var drift = (t * 0.006) % (er * 2);
    var blobs = [[-0.5, -0.55, 0.34, 0.2], [0.1, -0.32, 0.42, 0.24], [-0.15, -0.75, 0.2, 0.12], [0.55, -0.6, 0.26, 0.16]];
    for (i = 0; i < blobs.length; i++) {
      var bx = ex + ((blobs[i][0] * er + drift + er * 3) % (er * 2)) - er;
      ctx.beginPath();
      ctx.ellipse(bx, ey + blobs[i][1] * er, blobs[i][2] * er, blobs[i][3] * er, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Облачность
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (i = 0; i < 3; i++) {
      var cx2 = ex + ((i * er * 0.8 - drift * 1.6 + er * 4) % (er * 2)) - er;
      ctx.beginPath();
      ctx.ellipse(cx2, ey - er * (0.35 + i * 0.14), er * 0.5, er * 0.1, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- Ноты с блеском (обе темы) ---------- */
  function drawNotes() {
    var goldTop = theme === 'dark' ? '#FFE082' : '#D89A3D';
    var goldBot = theme === 'dark' ? '#C79322' : '#A9741C';
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      n.x += n.vx + Math.sin(t * 0.002 + n.phase) * 0.12;
      n.y += n.vy;
      n.rot += n.vr;
      if (n.y < -50) { n.y = H + 40; n.x = rnd(0, W); }
      if (n.x < -50) n.x = W + 40;
      if (n.x > W + 50) n.x = -40;
      var tw = 0.75 + 0.25 * Math.sin(t * 0.005 + n.phase * 2);
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.rotate(Math.sin(t * 0.0015 + n.phase) * 0.22 + n.rot);
      var ng = ctx.createLinearGradient(0, -n.size / 2, 0, n.size / 2);
      ng.addColorStop(0, goldTop); ng.addColorStop(1, goldBot);
      ctx.font = '600 ' + n.size + 'px "Playfair Display", Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = n.alpha * tw;
      ctx.shadowColor = theme === 'dark' ? 'rgba(255,214,110,0.65)' : 'rgba(199,147,34,0.5)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = ng;
      ctx.fillText(n.glyph, 0, 0);
      ctx.restore();
      // Искры-блёстки рядом с нотой
      if (!reduce && Math.random() < 0.02) {
        sparks.push({ x: n.x + rnd(-14, 14), y: n.y + rnd(-14, 14), r: rnd(2, 5), life: 1, vr: rnd(0.02, 0.05) });
      }
    }
    // Спарклы: четырёхлучевые звёздочки, вспыхивают и тают
    for (i = sparks.length - 1; i >= 0; i--) {
      var sp = sparks[i];
      sp.life -= sp.vr;
      if (sp.life <= 0) { sparks.splice(i, 1); continue; }
      var sa = Math.sin(sp.life * Math.PI);
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.globalAlpha = sa;
      ctx.fillStyle = theme === 'dark' ? '#FFF3C4' : '#E8B44C';
      ctx.shadowColor = 'rgba(255,225,130,0.9)'; ctx.shadowBlur = 8;
      var r = sp.r * (0.6 + 0.6 * sa);
      ctx.beginPath();
      ctx.moveTo(0, -r * 2); ctx.quadraticCurveTo(r * 0.28, -r * 0.28, r * 2, 0);
      ctx.quadraticCurveTo(r * 0.28, r * 0.28, 0, r * 2);
      ctx.quadraticCurveTo(-r * 0.28, r * 0.28, -r * 2, 0);
      ctx.quadraticCurveTo(-r * 0.28, -r * 0.28, 0, -r * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function frame() {
    t += 16;
    if (theme === 'dark') drawDark(); else drawLight();
    drawNotes();
    if (!reduce) requestAnimationFrame(frame);
  }

  new MutationObserver(function () {
    var next = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    if (next !== theme) { theme = next; if (reduce) frame(); }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });

  resize();
  frame();
})();
