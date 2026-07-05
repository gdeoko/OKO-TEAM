/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · Скролл-анимации (GSAP + ScrollTrigger, CDN)

   Принцип: страница полностью читабельна и без JS. Все анимации
   задаются через gsap.from, поэтому при сбое CDN контент просто
   остаётся на месте. При prefers-reduced-motion модуль выходит
   сразу, не трогая DOM.
   ═══════════════════════════════════════════════════════════════ */

export async function initAnimations() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let gsap, ScrollTrigger;
  try {
    const g = await import('https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm');
    const st = await import('https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger/+esm');
    gsap = g.gsap || g.default;
    ScrollTrigger = st.ScrollTrigger || st.default;
    gsap.registerPlugin(ScrollTrigger);
  } catch (e) {
    return; /* нет сети до CDN: сайт работает без анимаций */
  }

  const EASE = 'power3.out';

  /* ── Прогресс скролла ── */
  const progress = document.getElementById('scrollProgress');
  if (progress) {
    gsap.to(progress, {
      scaleX: 1,
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
    });
  }

  /* ── Hero: заголовок посимвольно ── */
  const title = document.getElementById('heroTitle');
  if (title) {
    const chars = [];
    title.querySelectorAll('.line').forEach((line) => {
      const walk = (node) => {
        [...node.childNodes].forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            const frag = document.createDocumentFragment();
            for (const ch of child.textContent) {
              if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); continue; }
              const s = document.createElement('span');
              s.className = 'ch';
              s.textContent = ch;
              frag.appendChild(s);
              chars.push(s);
            }
            child.replaceWith(frag);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            walk(child);
          }
        });
      };
      walk(line);
    });
    gsap.from(chars, {
      yPercent: 108,
      duration: 0.8,
      ease: 'power4.out',
      stagger: 0.028,
      delay: 0.15,
    });
  }

  /* ── Ступенчатое появление hero-блоков ── */
  gsap.from('.hero [data-reveal]', {
    y: 26,
    autoAlpha: 0,
    duration: 0.8,
    ease: EASE,
    stagger: 0.12,
    delay: 0.5,
    clearProps: 'all',
  });

  /* ── Reveal всех остальных секций ── */
  document.querySelectorAll('section:not(.hero) [data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 34,
      autoAlpha: 0,
      duration: 0.9,
      ease: EASE,
      clearProps: 'all',
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
    });
  });

  /* ── Карточки ценности: въезд с лёгким наклоном ── */
  gsap.utils.toArray('.value-card').forEach((card, i) => {
    gsap.from(card, {
      y: 44,
      rotateX: -8,
      autoAlpha: 0,
      duration: 0.9,
      delay: i * 0.08,
      ease: EASE,
      clearProps: 'all',
      scrollTrigger: { trigger: card, start: 'top 88%', once: true },
    });
  });

  /* ── Счётчики hero-статистики ── */
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.6,
      ease: 'power2.out',
      delay: 0.7,
      scrollTrigger: { trigger: el, start: 'top 95%', once: true },
      onUpdate: () => {
        el.textContent = String(Math.round(obj.v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + suffix;
      },
    });
  });

  /* ── Таймлайн: горизонтальный скролл при вертикальной прокрутке ── */
  const track = document.getElementById('timelineTrack');
  if (track && window.innerWidth > 700) {
    const overflow = () => track.scrollWidth - track.parentElement.clientWidth;
    if (overflow() > 40) {
      /* пин активен: нативный скролл вьюпорта отключаем, ведёт GSAP */
      const vp = document.getElementById('timelineViewport');
      if (vp) vp.style.overflow = 'visible';
      gsap.to(track, {
        x: () => -overflow(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.timeline-sec',
          start: 'top 20%',
          end: () => '+=' + (overflow() + 300),
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
    }
  }

  /* ── Шаги таймлайна: появление по одному ── */
  gsap.utils.toArray('.tl-step').forEach((step, i) => {
    gsap.from(step, {
      y: 30,
      autoAlpha: 0,
      duration: 0.7,
      delay: (i % 5) * 0.07,
      ease: EASE,
      clearProps: 'all',
      scrollTrigger: { trigger: '.timeline-sec', start: 'top 70%', once: true },
    });
  });

  /* ── Сравнение: шторка раскрывается от центра при входе ── */
  const panda = document.getElementById('cmpPanda');
  const handle = document.getElementById('cmpHandle');
  if (panda && handle) {
    const pos = { p: 50 };
    gsap.fromTo(pos, { p: 96 }, {
      p: 50,
      duration: 1.4,
      ease: 'power3.inOut',
      scrollTrigger: { trigger: '#cmpFrame', start: 'top 75%', once: true },
      onUpdate: () => {
        if (document.getElementById('cmpFrame')?.dataset.dragged) return;
        panda.style.clipPath = `inset(0 0 0 ${pos.p}%)`;
        handle.style.left = pos.p + '%';
      },
    });
  }

  /* ── Маршрут: линия прорисовывается ── */
  const route = document.getElementById('routePath');
  if (route) {
    const len = route.getTotalLength();
    gsap.fromTo(route,
      { strokeDasharray: len, strokeDashoffset: len },
      {
        strokeDashoffset: 0,
        duration: 2.2,
        ease: 'power2.inOut',
        scrollTrigger: { trigger: '.route-map', start: 'top 78%', once: true },
        onComplete: () => { route.setAttribute('stroke-dasharray', '6 8'); },
      });
  }

  ScrollTrigger.refresh();
}
