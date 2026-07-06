/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · Микро-магия интерфейса

   Всё опционально и деградирует безопасно: при reduced-motion или на
   тач-устройствах тяжёлые эффекты не включаются, контент не страдает.
     - плавный инерционный скролл (Lenis, CDN, с фолбэком на нативный)
     - декодинг-скрэмблинг заголовка hero
     - кастомный курсор (только десктоп, pointer: fine)
     - магнитные кнопки
     - параллакс hero при движении указателя
   ═══════════════════════════════════════════════════════════════ */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(pointer: fine)').matches;

/* ── Плавный скролл ── */
export async function initSmoothScroll() {
  if (reduced || window.innerWidth < 768) return null;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/lenis@1.1.14/+esm');
    const Lenis = mod.default || mod.Lenis;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true, lerp: 0.11 });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    /* якорные ссылки прокручиваем через Lenis */
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href');
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -70 });
      });
    });
    window.__lenis = lenis;
    return lenis;
  } catch (e) {
    return null;
  }
}

/* ── Декодинг заголовка ── */
export function initScramble() {
  if (reduced) return;
  const els = document.querySelectorAll('[data-scramble]');
  const glyphs = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШ01#%><*/';
  els.forEach((el, idx) => {
    const finalText = el.textContent;
    const chars = [...finalText];
    let frame = 0;
    const settle = chars.map((c, i) => (c === ' ' ? 0 : 6 + i * 1.4 + idx * 6));
    const run = () => {
      let out = '';
      let done = true;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i] === ' ') { out += ' '; continue; }
        if (frame >= settle[i]) {
          out += chars[i];
        } else {
          done = false;
          out += glyphs[Math.floor((frame * 7 + i * 13) % glyphs.length)];
        }
      }
      el.textContent = out;
      frame++;
      if (!done) requestAnimationFrame(run);
      else el.textContent = finalText;
    };
    /* стартуем чуть позже, после появления */
    setTimeout(run, 260 + idx * 90);
  });
}

/* ── Кастомный курсор + магнитные кнопки ── */
export function initCursor() {
  if (reduced || !fine) return;

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  document.body.appendChild(ring);
  document.body.appendChild(dot);
  document.documentElement.classList.add('has-cursor');

  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px)`;
  }, { passive: true });

  const loop = () => {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  const hoverSel = 'a, button, .value-card, .chip, .model-item, .faq-q, input, textarea, [data-magnetic]';
  document.querySelectorAll(hoverSel).forEach((el) => {
    el.addEventListener('pointerenter', () => document.documentElement.classList.add('cursor-hover'));
    el.addEventListener('pointerleave', () => document.documentElement.classList.remove('cursor-hover'));
  });

  /* магнитное притяжение кнопок */
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic) || 0.35;
    let raf = 0;
    el.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      el.style.transform = '';
    });
  });
}

/* ── Параллакс hero-слоёв при движении указателя ── */
export function initHeroParallax() {
  if (reduced || !fine) return;
  const layers = document.querySelectorAll('[data-parallax]');
  if (!layers.length) return;
  let raf = 0;
  window.addEventListener('pointermove', (e) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const px = (e.clientX / window.innerWidth - 0.5) * 2;
      const py = (e.clientY / window.innerHeight - 0.5) * 2;
      layers.forEach((l) => {
        const depth = parseFloat(l.dataset.parallax) || 10;
        l.style.transform = `translate(${px * depth}px, ${py * depth}px)`;
      });
    });
  }, { passive: true });
}

export function initFx() {
  initSmoothScroll();
  initScramble();
  initCursor();
  initHeroParallax();
}
