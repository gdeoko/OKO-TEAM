/* ══════════════════════════════════════════════════════════════
   МЕТАНОЙЯ · magic.js · тёплая магия интерфейса
   Метафора бренда — «маяк в тумане»: мягкий золотой свет.
   Всё на чистом canvas, без библиотек. Уважает prefers-reduced-motion.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const BRAND = ['#D4A574', '#C97064', '#FAF8F5', '#E6C79A', '#7AAED4'];

/* ───────── АМБИЕНТНЫЕ ЗОЛОТЫЕ ИСКРЫ (сплэш, «свет маяка») ───────── */

function ambientMotes(canvas, count = 26) {
  if (REDUCE_MOTION) return () => {};
  const ctx = canvas.getContext('2d');
  let W, H, raf;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  const resize = () => {
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const motes = Array.from({ length: count }, (_, i) => ({
    x: (i * 137.5) % W,
    y: (i * 89.3) % H,
    r: 0.8 + (i % 5) * 0.7,
    vy: -0.15 - (i % 4) * 0.08,
    vx: Math.sin(i) * 0.12,
    a: 0.15 + (i % 6) * 0.08,
    tw: 0.6 + (i % 5) * 0.4,       // частота мерцания
    ph: i,                          // фаза
  }));

  let t = 0;
  const tick = () => {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    for (const m of motes) {
      m.y += m.vy; m.x += m.vx;
      if (m.y < -6) { m.y = H + 6; m.x = (m.x + 53) % W; }
      const glow = m.a * (0.55 + 0.45 * Math.sin(t * m.tw + m.ph));
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 4);
      g.addColorStop(0, `rgba(212,165,116,${glow})`);
      g.addColorStop(1, 'rgba(212,165,116,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
  window.addEventListener('resize', resize);
  return () => cancelAnimationFrame(raf);
}

/* ───────── ПРАЗДНИК: ЗОЛОТОЙ САЛЮТ + ПЕРЬЯ ГОЛУБЯ ───────── */

let fxCanvas = null, fxCtx = null;

function ensureFxCanvas() {
  if (fxCanvas) return;
  fxCanvas = document.createElement('canvas');
  fxCanvas.className = 'fx-canvas';
  document.body.appendChild(fxCanvas);
  fxCtx = fxCanvas.getContext('2d');
}

function celebrate(originX, originY) {
  if (REDUCE_MOTION) return;
  ensureFxCanvas();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  fxCanvas.width = W * dpr; fxCanvas.height = H * dpr;
  fxCanvas.style.width = W + 'px'; fxCanvas.style.height = H + 'px';
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fxCanvas.classList.add('fx-canvas--on');

  const ox = originX ?? W / 2;
  const oy = originY ?? H * 0.42;
  const parts = [];
  const N = 90;
  for (let i = 0; i < N; i++) {
    const ang = (Math.PI * 2 * i) / N + Math.sin(i) * 0.3;
    const speed = 3 + (i % 7) * 1.4;
    parts.push({
      x: ox, y: oy,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 2,
      g: 0.12 + (i % 3) * 0.03,
      size: 3 + (i % 4) * 2,
      color: BRAND[i % BRAND.length],
      rot: i, vr: (i % 2 ? 1 : -1) * 0.2,
      life: 1,
      shape: i % 5 === 0 ? 'feather' : 'dot',
    });
  }

  let frame = 0;
  const run = () => {
    frame++;
    fxCtx.clearRect(0, 0, W, H);
    let alive = false;
    for (const p of parts) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
      p.life -= 0.011;
      if (p.life <= 0) continue;
      alive = true;
      fxCtx.save();
      fxCtx.globalAlpha = Math.max(0, p.life);
      fxCtx.translate(p.x, p.y);
      fxCtx.rotate(p.rot);
      fxCtx.fillStyle = p.color;
      if (p.shape === 'feather') {
        fxCtx.beginPath();
        fxCtx.ellipse(0, 0, p.size * 0.6, p.size * 1.6, 0, 0, Math.PI * 2);
        fxCtx.fill();
      } else {
        fxCtx.beginPath();
        fxCtx.arc(0, 0, p.size, 0, Math.PI * 2);
        fxCtx.fill();
      }
      fxCtx.restore();
    }
    if (alive && frame < 220) requestAnimationFrame(run);
    else { fxCtx.clearRect(0, 0, W, H); fxCanvas.classList.remove('fx-canvas--on'); }
  };
  run();
}

/* ───────── МОДАЛКА НАГРАДЫ ───────── */

function rewardModal({ icon = 'trophy', title, subtitle, xp, voice }) {
  const wrap = document.createElement('div');
  wrap.className = 'reward';
  wrap.innerHTML = `
    <div class="reward__box">
      <div class="reward__halo"></div>
      <div class="reward__badge">${typeof ICON === 'function' ? ICON(icon, 46) : ''}</div>
      <div class="reward__title">${title}</div>
      ${subtitle ? `<div class="reward__sub">${subtitle}</div>` : ''}
      ${xp ? `<div class="reward__xp">+${xp} очков</div>` : ''}
      ${voice ? `<button class="reward__voice" aria-label="Послушать голосом Екатерины">${typeof ICON === 'function' ? ICON('play', 15) : '▶'} Голос Екатерины</button>` : ''}
      <button class="btn btn--primary reward__ok">Отлично!</button>
    </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('reward--on'));
  const r = wrap.querySelector('.reward__badge').getBoundingClientRect();
  setTimeout(() => celebrate(r.left + r.width / 2, r.top + r.height / 2), 220);
  let audio = null;
  if (voice) {
    audio = new Audio(voice);
    audio.play().catch(() => {}); // автозвук может быть заблокирован — тогда по кнопке
    wrap.querySelector('.reward__voice').addEventListener('click', (e) => { e.stopPropagation(); try { audio.currentTime = 0; audio.play(); } catch (x) {} });
  }
  const close = () => { if (audio) audio.pause(); wrap.classList.remove('reward--on'); setTimeout(() => wrap.remove(), 300); };
  wrap.querySelector('.reward__ok').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
}

window.MAGIC = { ambientMotes, celebrate, rewardModal };
