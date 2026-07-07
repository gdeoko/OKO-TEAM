/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · Оркестратор фронтенда (ES-модуль)

   Собирает: калькулятор, чат-бот, форму заявки, отзывы, FAQ,
   трекинг событий и ленивую загрузку 3D-сцены с анимациями.

   Контракт API сохранён:
   POST api.php?action=newLead
     { name, phone, tg, email, service, msg, contact, website }
   Ответ { ok: true, id } ведёт на thanks.html.
   POST api.php?action=trackEvent  { type, data }
   ═══════════════════════════════════════════════════════════════ */

import { REVIEWS, FAQ_ITEMS } from './catalog-data.js';
import { Calc } from './calculator.js';
import { Chat } from './chatbot.js';
import { initFx } from './fx.js';

const $ = (sel) => document.querySelector(sel);

/* ── Трекинг событий: тихий, без реакции интерфейса ── */
function track(type, data = '') {
  try {
    fetch('api.php?action=trackEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}

/* ── Отправка заявки: единая точка для формы и чат-бота ── */
async function sendLead({ name, phone = '', tg = '', email = '', service = '', msg = '', contact = '' }) {
  const body = {
    name,
    phone,
    tg,
    email,
    service,
    msg,
    contact: contact || tg || email || phone,
    website: $('#fWebsite') ? $('#fWebsite').value : '',
  };
  const res = await fetch('api.php?action=newLead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.err || 'server_error');
  return json;
}

/* ── Тост ── */
let toastT;
function toast(text) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ── Шапка и мобильное меню ── */
function initHeader() {
  const header = $('#header');
  const onScroll = () => header && header.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const ham = $('#ham');
  const mobnav = $('#mobnav');
  const closeBtn = $('#mobnavClose');
  if (!ham || !mobnav) return;
  const close = () => {
    mobnav.classList.remove('open');
    document.body.style.overflow = '';
  };
  ham.addEventListener('click', () => {
    mobnav.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
  if (closeBtn) closeBtn.addEventListener('click', close);
  mobnav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
}

/* ── Резервный прогресс скролла без GSAP ── */
function initProgressFallback() {
  const bar = $('#scrollProgress');
  if (!bar) return;
  const upd = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  };
  window.addEventListener('scroll', upd, { passive: true });
  upd();
}

/* ── Бейдж курса: ping бэкенда ── */
async function initRate() {
  const badge = $('#rateBadge');
  if (!badge) return;
  try {
    const res = await fetch('api.php?action=ping');
    const json = await res.json();
    if (json.ok) badge.classList.add('live');
  } catch (e) { /* бэкенд недоступен: бейдж остаётся серым */ }
}

/* ── Отзывы: бесконечная лента ── */
function initReviews() {
  const track_ = $('#revTrack');
  if (!track_) return;
  const star = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const stars = star.repeat(5);
  const items = [...REVIEWS, ...REVIEWS];
  track_.innerHTML = items.map((r) => `
    <article class="rev-card">
      <div class="rev-stars" aria-label="Оценка 5 из 5">${stars}</div>
      <div class="rev-text">«${r.t}»</div>
      <div class="rev-author">
        <div class="rev-ava" aria-hidden="true">${r.ini}</div>
        <div>
          <div class="rev-name">${r.n}</div>
          <div class="rev-role">${r.r}</div>
        </div>
      </div>
    </article>`).join('');
}

/* ── FAQ ── */
function initFaq() {
  const list = $('#faqList');
  if (!list) return;
  const plus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  list.innerHTML = FAQ_ITEMS.map((it, i) => `
    <div class="faq-item">
      <button class="faq-q" type="button" aria-expanded="false" aria-controls="faqA${i}">
        ${it.q}<span class="faq-arr" aria-hidden="true">${plus}</span>
      </button>
      <div class="faq-a" id="faqA${i}"><div class="faq-a-i">${it.a}</div></div>
    </div>`).join('');
  list.querySelectorAll('.faq-q').forEach((q) => {
    q.addEventListener('click', () => {
      const item = q.parentElement;
      const isOpen = item.classList.contains('open');
      list.querySelectorAll('.faq-item.open').forEach((o) => {
        o.classList.remove('open');
        o.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
        o.querySelector('.faq-a').style.maxHeight = '0';
      });
      if (!isOpen) {
        item.classList.add('open');
        q.setAttribute('aria-expanded', 'true');
        const a = item.querySelector('.faq-a');
        a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });
}

/* ── Сравнение: чистая адаптивная таблица ── */
function initCompare() {
  const rows = [
    { name: 'Sur-Ron Ultra Bee',      panda: 417000,  dealer: 668000 },
    { name: 'LONCIN XWOLF 700L',      panda: 738000,  dealer: 1181000 },
    { name: 'CFmoto CFORCE 1000 MV',  panda: 1361000, dealer: 2178000 },
    { name: 'Sea-Doo GTI 170',        panda: 1835000, dealer: 2936000 },
    { name: 'Yamaha Grizzly 700',     panda: 1323000, dealer: 2117000 },
  ];
  const fmtN = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const box = $('#cmpRows');
  if (!box) return;
  box.innerHTML = rows.map((r) => `
    <div class="cmp-r">
      <div class="cmp-r-name">${r.name}</div>
      <div class="cmp-r-dealer">${fmtN(r.dealer)} ₽</div>
      <div class="cmp-r-panda">
        <b>${fmtN(r.panda)} ₽</b>
        <span class="cmp-r-save">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="12" height="12" aria-hidden="true"><polyline points="19 12 12 19 5 12"/><line x1="12" y1="5" x2="12" y2="19"/></svg>
          ${fmtN(r.dealer - r.panda)} ₽
        </span>
      </div>
    </div>`).join('');
}

/* ── Наклон карточек за курсором ── */
function initTilt() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    let raf = 0;
    card.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) translateY(-2px)`;
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      card.style.transform = '';
      card.style.transition = 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)';
      setTimeout(() => { card.style.transition = ''; }, 420);
    });
  });
}

/* ── Форма заявки ── */
function initForm() {
  const form = $('#leadForm');
  if (!form) return;
  const errBox = $('#formError');
  const submitBtn = $('#formSubmit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.remove('show');

    const name = $('#fName').value.trim();
    const phone = $('#fPhone').value.trim();
    const tg = $('#fTg').value.trim();
    const email = $('#fEmail').value.trim();
    const service = $('#fService').value.trim();
    const msg = $('#fMsg').value.trim();

    if (name.length < 2) {
      errBox.textContent = 'Укажите, пожалуйста, имя.';
      errBox.classList.add('show');
      $('#fName').focus();
      return;
    }
    if (!phone && !tg && !email) {
      errBox.textContent = 'Оставьте хотя бы один контакт: телефон, Telegram или email.';
      errBox.classList.add('show');
      $('#fPhone').focus();
      return;
    }

    submitBtn.disabled = true;
    const orig = submitBtn.innerHTML;
    submitBtn.textContent = 'Отправляем...';
    try {
      await sendLead({ name, phone, tg, email, service, msg });
      window.location.href = 'thanks.html';
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = orig;
      if (String(err.message) === 'rate_limit') {
        errBox.textContent = 'Слишком много попыток подряд. Подождите пару минут или напишите в Telegram @pandaGO_media.';
      } else {
        errBox.textContent = 'Отправка сейчас недоступна. Напишите нам в Telegram @pandaGO_media, ответим сразу.';
      }
      errBox.classList.add('show');
    }
  });
}

/* ── Кино-секции: скраб видео скроллом (без внешних библиотек) ── */
function initCinema() {
  initScrub('#cinema', '#cinemaVideo', '#cinemaBar');
  initScrub('#teardown', '#teardownVideo', '#teardownBar', '#teardownStill');
}

function initScrub(secSel, videoSel, barSel, stillSel) {
  const sec = $(secSel);
  let video = $(videoSel);
  const bar = $(barSel);
  if (!sec || !video) return;

  /* Портрет: вместо кропа альбомного видео используем резкий дизолв
     двух вертикальных кадров (нативная резкость на телефоне) */
  const still = stillSel ? $(stillSel) : null;
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  let stillTop = null;
  if (still && portrait) {
    video.remove();
    video = null;
    still.hidden = false;
    stillTop = still.querySelector('.top');
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  if (reduced || saveData) {
    if (video) video.removeAttribute('preload');
    if (stillTop) stillTop.style.opacity = '1';   /* показываем финал */
    return;
  }

  let duration = 0;
  let target = 0, current = 0, raf = 0;
  if (video) {
    video.addEventListener('loadedmetadata', () => { duration = video.duration || 0; });
    try { video.load(); } catch (e) {}
  }

  const tick = () => {
    raf = 0;
    if (video && !duration) { raf = requestAnimationFrame(tick); return; }
    current += (target - current) * 0.18;
    if (Math.abs(target - current) > 0.004) raf = requestAnimationFrame(tick);
    if (video) {
      try { video.currentTime = current * duration; } catch (e) {}
    } else if (stillTop) {
      stillTop.style.opacity = String(Math.min(1, current * 1.25));
      stillTop.style.transform = `scale(${1.05 - current * 0.05})`;
      stillTop.previousElementSibling.style.transform = `scale(${1 + current * 0.08})`;
    }
    if (bar) bar.style.transform = `scaleX(${current})`;
  };

  let lastScrollTs = 0;
  let autoPlaying = false;
  let inView = false;

  const onScroll = () => {
    const r = sec.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    if (span <= 0) return;
    target = Math.min(1, Math.max(0, -r.top / span));
    lastScrollTs = performance.now();
    if (autoPlaying && video) { video.pause(); autoPlaying = false; }
    if (!raf) raf = requestAnimationFrame(tick);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* кино живёт само: без скролла видео тихо играет в цикле, скролл
     перехватывает управление кадром */
  new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: 0.35 })
    .observe(sec);
  if (video) {
    video.loop = true;
    setInterval(() => {
      if (!inView) { if (autoPlaying) { video.pause(); autoPlaying = false; } return; }
      const idle = performance.now() - lastScrollTs > 1300;
      if (idle && !autoPlaying) {
        video.playbackRate = 0.6;
        video.play().then(() => { autoPlaying = true; }).catch(() => {});
      }
    }, 400);
  }
}

/* ── Живой фон формы: ночная Москва, грузится при приближении ── */
function initLeadVideo() {
  const video = $('#leadVideo');
  const sec = $('#lead');
  if (!video || !sec) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  if (reduced || saveData) return; /* остаётся градиент с постером */
  const io = new IntersectionObserver((es) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    video.src = 'assets/media/moscow-cold.mp4';
    video.play().then(() => video.classList.add('on')).catch(() => {});
  }, { rootMargin: '600px' });
  io.observe(sec);
}

/* ── Ленивый 3D-мир: после первой отрисовки, без reduced-motion ── */
function initWorld() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const holder = $('#worldCanvas');
  if (!holder) return;
  setTimeout(() => {
    import('./three-scene.js')
      .then((mod) => {
        mod.initScene(holder);
        holder.classList.add('on');
      })
      .catch(() => { /* нет WebGL или CDN: остаётся статичный градиент */ });
    import('./hud.js')
      .then((mod) => mod.initHud())
      .catch(() => {});
  }, 200);
}

/* ── Запуск ── */
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initProgressFallback();
  initRate();
  initReviews();
  initFaq();
  initCompare();
  initTilt();
  initForm();
  initCinema();
  initLeadVideo();

  Calc.init({
    onUse: () => track('calc_use'),
    onOrder: ({ service, msg }) => {
      const fService = $('#fService');
      const fMsg = $('#fMsg');
      if (fService) fService.value = service;
      if (fMsg && !fMsg.value) fMsg.value = msg;
      const lead = $('#lead');
      if (lead) lead.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Данные из калькулятора перенесены в заявку');
      setTimeout(() => {
        const n = $('#fName');
        if (n && window.innerWidth > 700) n.focus();
      }, 800);
    },
  });

  Chat.init({
    onOpen: () => track('chat_open'),
    submitLead: async (payload) => {
      try {
        await sendLead(payload);
        return true;
      } catch (e) {
        return false;
      }
    },
  });

  initWorld();
  initFx();
  import('./animations.js')
    .then((mod) => mod.initAnimations())
    .catch(() => {});

  track('page_view');
});
