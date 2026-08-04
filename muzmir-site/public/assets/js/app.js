/* КЦ «Музыкальный Мир» — фронтенд. Vanilla JS, без библиотек. */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function isReduced() { return reduced.matches; }
  var hoverCapable = matchMedia('(hover: hover)');
  // Включает JS-моушен (.reveal стартует скрытым только при наличии .js — иначе контент виден всегда).
  document.documentElement.classList.add('js');

  /* ---------- Тост-уведомления ---------- */
  // window.toast(msg, type) — type: 'success' | 'error' | '' . Автоскрытие ~3.5с.
  window.toast = function (msg, type) {
    if (!msg) return;
    var host = $('#toastHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toastHost';
      host.className = 'toast-host';
      host.setAttribute('aria-live', 'polite');
      host.setAttribute('aria-atomic', 'true');
      document.body.appendChild(host);
    }
    var t = document.createElement('div');
    t.className = 'toast' + (type === 'success' ? ' toast--success' : type === 'error' ? ' toast--error' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    host.appendChild(t);
    var life = isReduced() ? 3500 : 3500;
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      t.classList.add('is-hiding');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }
    setTimeout(close, life);
    t.addEventListener('click', close);
    return t;
  };

  /* ---------- Мобильное меню + a11y ---------- */
  var burger = $('#burger'), nav = $('#nav');
  if (burger && nav) {
    if (!nav.id) nav.id = 'nav';
    burger.setAttribute('aria-controls', nav.id);
    burger.setAttribute('aria-expanded', 'false');
    function setMenu(open) {
      nav.classList.toggle('open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    burger.addEventListener('click', function (e) {
      e.stopPropagation();
      setMenu(!nav.classList.contains('open'));
    });
    // Закрытие по Esc
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.keyCode === 27) && nav.classList.contains('open')) {
        setMenu(false);
        burger.focus();
      }
    });
    // Закрытие по клику вне меню
    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(e.target) || burger.contains(e.target)) return;
      setMenu(false);
    });
  }

  /* ---------- Нормализация темы (ДЕФОЛТ 'light') ---------- */
  // Инлайн-скрипт в layout ставит 'dark' при пустом localStorage; приводим к ТЗ: пусто → light.
  function currentTheme() {
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('muzmir-theme', theme); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', theme === 'light' ? '#FAF4E6' : '#0A1330');
  }
  (function initThemeDefault() {
    var saved = null;
    try { saved = localStorage.getItem('muzmir-theme'); } catch (e) {}
    if (saved !== 'light' && saved !== 'dark') {
      // Явного выбора не было — по ТЗ дефолт светлый.
      setTheme('light');
    } else if (document.documentElement.dataset.theme !== saved) {
      setTheme(saved);
    }
  })();

  /* ---------- Переключатель темы: ЕДИНСТВЕННЫЙ обработчик живёт в layout.php. ----------
     Здесь его НЕ дублировать: второй listener на той же кнопке давал двойное
     переключение (dark→сразу обратно light), из-за чего «тумблер не работал». */

  /* ---------- Появление секций при скролле + stagger ---------- */
  var GRID_SEL = '.stats, .grid, .grid-2, .grid-3, .grid-4, .steps, .partners, .timeline, .kpis';
  function markStagger(gridEl) {
    Array.prototype.slice.call(gridEl.children).forEach(function (kid, i) {
      kid.style.transitionDelay = (i * 70) + 'ms';
      kid.style.setProperty('--i', i);
    });
  }
  function staggerChildren(container) {
    if (isReduced()) return;
    // Прямые дети сеток внутри контейнера получают инкрементальную задержку (каскад --i * 70ms).
    $$(GRID_SEL, container).forEach(markStagger);
    // Если сам контейнер является сеткой
    if (container.matches && container.matches(GRID_SEL)) markStagger(container);
  }

  function revealEl(el) {
    if (!el || el.classList.contains('in')) return;
    try { staggerChildren(el); } catch (err) {}   // никогда не блокируем показ
    el.classList.add('in');
  }
  if ('IntersectionObserver' in window) {
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { revealEl(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.94) { revealEl(el); }   // выше/на сгибе — сразу, без ожидания
      else io.observe(el);
    });
    // Гарантия: ничто не остаётся скрытым дольше 3с (защита от сбоя observer/скрытых вкладок)
    setTimeout(function () { $$('.reveal').forEach(function (el) { if (!el.classList.contains('in')) revealEl(el); }); }, 3000);

    // Счётчики — на сгибе/выше сгиба запускаем сразу (без «0»-мигания и без ожидания observer)
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        try { countUp(e.target); } catch (err) {} e.target.dataset.counted = '1'; cio.unobserve(e.target);
      });
    }, { threshold: 0.35 });
    $$('[data-count]').forEach(function (el) {
      if (el.dataset.counted) return;
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.94 && r.bottom > 0) { try { countUp(el); } catch (err) {} el.dataset.counted = '1'; }
      else cio.observe(el);
    });

    // Инфографика: SVG-кольца (.stat-ring/.donut, dasharray) и .bar (scaleX) — так же сразу для above-the-fold
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        try { animateProgress(e.target); } catch (err) {} e.target.dataset.progressed = '1'; pio.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    $$('.stat-ring, .donut, .bar').forEach(function (el) {
      if (el.dataset.progressed) return;
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.94 && r.bottom > 0) { try { animateProgress(el); } catch (err) {} el.dataset.progressed = '1'; }
      else pio.observe(el);
    });

    // Гарантия: числа и графики никогда не застревают на 0 (failsafe через 3с)
    setTimeout(function () {
      $$('[data-count]').forEach(function (el) { if (!el.dataset.counted) { try { countUp(el); } catch (err) {} el.dataset.counted = '1'; cio.unobserve(el); } });
      $$('.stat-ring, .donut, .bar').forEach(function (el) { if (!el.dataset.progressed) { try { animateProgress(el); } catch (err) {} el.dataset.progressed = '1'; pio.unobserve(el); } });
    }, 3200);
  } else {
    $$('.reveal').forEach(function (el) { revealEl(el); });
    $$('.stat-ring, .donut, .bar').forEach(function (el) { animateProgress(el); });
  }

  /* ---------- Анимация прогресса: SVG-кольца/пончики (dasharray) и полосы (scaleX) ---------- */
  function readPct(el) {
    var v = parseFloat(
      el.getAttribute('data-value') || el.getAttribute('data-percent') ||
      el.getAttribute('data-count') || '0'
    );
    if (isNaN(v)) v = 0;
    return Math.max(0, Math.min(100, v));
  }
  function animateProgress(el) {
    var pct = readPct(el);
    if (el.classList.contains('bar')) {
      // Полоса: заполняемый элемент .bar-fill / [data-fill] / первый ребёнок.
      var fill = el.querySelector('.bar-fill, [data-fill]') || el.firstElementChild;
      if (!fill) return;
      fill.style.transformOrigin = 'left center';
      if (isReduced()) { fill.style.transform = 'scaleX(' + (pct / 100) + ')'; return; }
      fill.style.transform = 'scaleX(0)';
      // reflow → плавный переход (transition задаёт CSS)
      void fill.offsetWidth;
      requestAnimationFrame(function () {
        fill.style.transform = 'scaleX(' + (pct / 100) + ')';
      });
      return;
    }
    // Кольцо/пончик: анимируем stroke-dashoffset прогрессной дуги.
    var arc = el.querySelector('.ring-fill, [data-ring], .donut-fill') ||
      (function () { var cs = el.querySelectorAll('circle, path'); return cs.length ? cs[cs.length - 1] : null; })();
    if (!arc || typeof arc.getTotalLength !== 'function') return;
    var len;
    try { len = arc.getTotalLength(); } catch (e2) { return; }
    if (!len || !isFinite(len)) return;
    arc.style.strokeDasharray = len + ' ' + len;
    var target = len * (1 - pct / 100);
    if (isReduced()) { arc.style.strokeDashoffset = target; return; }
    arc.style.strokeDashoffset = len;
    var dur = 1300, t0 = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      arc.style.strokeDashoffset = (len - (len - target) * eased);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    if (isReduced()) { el.textContent = target.toLocaleString('ru-RU') + suffix; return; }
    var dur = 1400, t0 = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      var val = p >= 1 ? target : Math.floor((1 - Math.pow(1 - p, 3)) * target); // финал точно = target (без off-by-one)
      el.textContent = val.toLocaleString('ru-RU') + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- Sticky-хедер + reading-progress ---------- */
  var header = $('.header') || $('header');
  var readBar = null;
  (function initReadProgress() {
    readBar = document.createElement('div');
    readBar.className = 'read-progress';
    readBar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(readBar);
  })();
  var scrollTicking = false;
  function onScrollFrame() {
    scrollTicking = false;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (header) header.classList.toggle('scrolled', y > 20);
    if (readBar) {
      var doc = document.documentElement;
      var max = (doc.scrollHeight - doc.clientHeight) || 1;
      var frac = Math.min(1, Math.max(0, y / max));
      readBar.style.transform = 'scaleX(' + frac + ')';
    }
  }
  function requestScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(onScrollFrame);
  }
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll, { passive: true });
  onScrollFrame();

  /* ---------- Активный индикатор нижнего appnav ---------- */
  var appnav = $('.appnav') || $('#appnav');
  var appInd = null;
  function positionAppInd() {
    if (!appnav) return;
    var active = $('.active', appnav) || $('[aria-current="page"]', appnav);
    if (!active) { if (appInd) appInd.style.opacity = '0'; return; }
    if (!appInd) {
      appInd = document.createElement('span');
      appInd.className = 'appnav-ind';
      appInd.setAttribute('aria-hidden', 'true');
      appnav.appendChild(appInd);
    }
    appInd.style.opacity = '1';
    appInd.style.width = active.offsetWidth + 'px';
    appInd.style.transform = 'translateX(' + active.offsetLeft + 'px)';
    // Лёгкий bounce иконки активной вкладки
    if (!isReduced()) {
      var icon = active.querySelector('svg, img, .icon') || active;
      icon.classList.remove('appnav-bounce');
      // reflow для перезапуска анимации
      void icon.offsetWidth;
      icon.classList.add('appnav-bounce');
    }
  }
  if (appnav) {
    positionAppInd();
    window.addEventListener('resize', function () { requestAnimationFrame(positionAppInd); }, { passive: true });
    window.addEventListener('load', positionAppInd);
  }

  /* ---------- Аккордеон (совместим с <div> и <button> .acc-q) ---------- */
  $$('.acc-q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.parentNode;
      var open = item.classList.toggle('open');
      if (q.hasAttribute('aria-expanded')) q.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ---------- Parallax-tilt карточек (только hover:hover, не reduced) ---------- */
  if (hoverCapable.matches && !isReduced()) {
    $$('.card--3d, .grid > .card, .steps > .step').forEach(function (card) {
      card.addEventListener('pointerenter', function () { card.style.willChange = 'transform'; });
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        var ry = px * 8; // ±4°
        var rx = -py * 8;
        card.style.transform = 'perspective(700px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
        card.style.willChange = 'auto';
      });
    });
  }

  /* ---------- Magnetic-CTA (лёгкое притяжение к курсору) ---------- */
  // Только hover:hover и не reduced. Кнопка мягко тянется к курсору, на уход — пружинит назад.
  if (hoverCapable.matches && !isReduced()) {
    $$('.btn--magnetic, [data-magnetic], .hero-cta .btn--primary').forEach(function (btn) {
      var STRENGTH = 0.3, MAX = 10, raf = 0;
      function onMove(e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var r = btn.getBoundingClientRect();
          var x = (e.clientX - r.left - r.width / 2) * STRENGTH;
          var y = (e.clientY - r.top - r.height / 2) * STRENGTH;
          x = Math.max(-MAX, Math.min(MAX, x));
          y = Math.max(-MAX, Math.min(MAX, y));
          btn.classList.remove('magnetic-return');
          btn.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        });
      }
      btn.addEventListener('pointermove', onMove);
      btn.addEventListener('pointerleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        btn.classList.add('magnetic-return');
        btn.style.transform = '';
      });
    });
  }

  /* ---------- Плавающие ноты в hero ---------- */
  var notesBox = $('.hero-notes');
  if (notesBox && !isReduced()) {
    var glyphs = ['♪', '♫', '♩', '𝄞'];
    for (var i = 0; i < 14; i++) {
      var n = document.createElement('span');
      n.textContent = glyphs[i % glyphs.length];
      n.style.cssText = 'position:absolute;color:rgba(201,168,76,.4);font-size:' +
        (18 + Math.random() * 26) + 'px;left:' + (Math.random() * 100) + '%;bottom:-40px;' +
        'animation:floatNote ' + (7 + Math.random() * 8) + 's linear ' + (Math.random() * 8) + 's infinite;';
      notesBox.appendChild(n);
    }
  }

  /* ---------- Чат-виджет (агент поддержки) ---------- */
  var fab = $('#chatFab');
  if (fab) fab.addEventListener('click', function () {
    if (window.MuzmirChat) return window.MuzmirChat.toggle();
    openChat();
  });
  /* FAB не перекрывает контент: прячем при скролле вниз, при фокусе на поле, и когда открыт чат */
  if (fab) {
    var lastY = window.pageYOffset || 0, fabTick = false, chatOpen = false;
    function fabHide(v) { if (!chatOpen) fab.classList.toggle('is-hidden', v); }
    window.addEventListener('scroll', function () {
      if (fabTick) return; fabTick = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset || 0;
        if (y > lastY + 6 && y > 160) fabHide(true);        // скролл вниз — прячем
        else if (y < lastY - 6) fabHide(false);             // скролл вверх — показываем
        lastY = y; fabTick = false;
      });
    }, { passive: true });
    document.addEventListener('focusin', function (e) {
      var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) fabHide(true);
    });
    document.addEventListener('focusout', function () { setTimeout(function () { fabHide(false); }, 120); });
    document.addEventListener('muzmir-chat-open', function () { chatOpen = true; fab.classList.remove('is-hidden'); });
    document.addEventListener('muzmir-chat-close', function () { chatOpen = false; });
  }
  function openChat() {
    var box = document.createElement('div');
    box.id = 'muzmir-chat';
    box.style.cssText = 'position:fixed;right:22px;bottom:92px;width:min(360px,92vw);height:460px;' +
      'background:#fff;border:1px solid rgba(139,111,31,.18);border-radius:16px;z-index:61;' +
      'box-shadow:0 20px 60px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden;font-family:inherit';
    box.innerHTML =
      '<div style="background:#1B2340;color:#fff;padding:14px 16px;font-weight:700">Поддержка «Музыкальный Мир»</div>' +
      '<div id="mc-log" style="flex:1;overflow:auto;padding:14px;font-size:.92rem;color:#2A2E3F"></div>' +
      '<form id="mc-form" style="display:flex;gap:8px;padding:10px;border-top:1px solid #eee">' +
      '<input id="mc-in" placeholder="Ваш вопрос" style="flex:1;padding:10px;border:1px solid #ddd;border-radius:10px">' +
      '<button class="btn btn--primary" type="submit" style="padding:10px 16px">→</button></form>';
    document.body.appendChild(box);
    // Анимация появления
    requestAnimationFrame(function () { box.classList.add('open'); });
    var log = $('#mc-log', box);
    var sendBtn = $('#mc-form button', box);
    addMsg('Здравствуйте! Чем можем помочь? Задайте вопрос о конкурсах, заявках или наградах.', 'bot');
    $('#mc-form', box).addEventListener('submit', function (ev) {
      ev.preventDefault();
      var inp = $('#mc-in', box), text = inp.value.trim();
      if (!text) return;
      addMsg(text, 'me'); inp.value = '';
      var typing = showTyping();
      sendBtn.classList.add('is-loading');
      sendBtn.disabled = true;
      function done() {
        removeTyping(typing);
        sendBtn.classList.remove('is-loading');
        sendBtn.disabled = false;
      }
      fetch(location.origin + '/api/v1/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      }).then(function (r) { return r.json(); })
        .then(function (d) { done(); addMsg(d.reply || 'Спасибо! Мы ответим в ближайшее время.', 'bot'); })
        .catch(function () { done(); addMsg('Спасибо! Мы свяжемся с Вами.', 'bot'); });
    });
    function showTyping() {
      var m = document.createElement('div');
      m.style.cssText = 'margin:8px 0;max-width:82%;padding:9px 13px;border-radius:12px;background:#F9F2E4;color:#1B2340';
      m.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
      log.appendChild(m); log.scrollTop = log.scrollHeight;
      return m;
    }
    function removeTyping(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
    function addMsg(t, who) {
      var m = document.createElement('div');
      m.style.cssText = 'margin:8px 0;max-width:82%;padding:9px 13px;border-radius:12px;' +
        (who === 'me' ? 'margin-left:auto;background:#C9A84C;color:#fff' : 'background:#F9F2E4;color:#1B2340');
      m.textContent = t; log.appendChild(m); log.scrollTop = log.scrollHeight;
    }
    window.MuzmirChat = { toggle: function () {
      var vis = box.style.display === 'none';
      box.style.display = vis ? 'flex' : 'none';
      if (vis) requestAnimationFrame(function () { box.classList.add('open'); });
      else box.classList.remove('open');
    } };
  }

  /* ---------- Skeleton-хелперы ---------- */
  // window.skeleton.on(el) / .off(el) — переключение состояния загрузки (класс .skeleton задаёт CSS).
  window.skeleton = {
    on: function (el) {
      if (typeof el === 'string') el = $(el);
      if (el) { el.classList.add('skeleton'); el.setAttribute('aria-busy', 'true'); }
      return el;
    },
    off: function (el) {
      if (typeof el === 'string') el = $(el);
      if (el) { el.classList.remove('skeleton'); el.removeAttribute('aria-busy'); }
      return el;
    }
  };

  /* ---------- Анимированный фон .bg-fx (Canvas 2D) ---------- */
  // Слои: плавающие золотые ноты/звёзды, glow-orbs с параллаксом (скролл+мышь), тонкая нотная сетка.
  // OFF при prefers-reduced-motion и на маломощных устройствах (hardwareConcurrency<=4 / экономный режим).
  (function initBgFx() {
    var lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4);
    if (isReduced() || lowPower) return;

    var host = $('.bg-fx');
    if (!host) {
      // Контейнер обычно добавляет layout; создаём defensively, если его нет.
      host = document.createElement('div');
      host.className = 'bg-fx';
      host.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(host, document.body.firstChild);
    }
    var canvas = document.createElement('canvas');
    canvas.className = 'bg-fx-canvas';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    var W = 0, H = 0;
    var theme = currentTheme();
    var palette;
    function setPalette() {
      // Тёплое золото; в светлой теме мягче/прозрачнее, в тёмной ярче.
      palette = theme === 'light'
        ? { note: 'rgba(201,168,76,', orb: 'rgba(230,199,102,', grid: 'rgba(139,111,31,', noteA: 0.28, orbA: 0.10, gridA: 0.05 }
        : { note: 'rgba(232,194,90,', orb: 'rgba(232,194,90,', grid: 'rgba(232,194,90,', noteA: 0.34, orbA: 0.13, gridA: 0.06 };
    }
    setPalette();

    var notes = [], orbs = [];
    var GLYPHS = ['♪', '♫', '✦', '✧', '♩']; // ♪ ♫ ✦ ✧ ♩
    function build() {
      var area = W * H;
      var nCount = Math.max(10, Math.min(34, Math.round(area / 42000)));
      notes = [];
      for (var i = 0; i < nCount; i++) {
        notes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: 12 + Math.random() * 20,
          vy: -(4 + Math.random() * 10) / 100,      // медленный дрейф вверх
          vx: (Math.random() - 0.5) * 0.05,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.004,
          a: 0.35 + Math.random() * 0.5,
          g: GLYPHS[(Math.random() * GLYPHS.length) | 0]
        });
      }
      orbs = [];
      var oCount = 3 + (area > 900000 ? 2 : 0);
      for (var j = 0; j < oCount; j++) {
        orbs.push({
          bx: Math.random(), by: Math.random(),           // базовая позиция (доля)
          r: (Math.min(W, H) * (0.18 + Math.random() * 0.22)),
          depth: 0.15 + Math.random() * 0.5,              // сила параллакса
          drift: Math.random() * Math.PI * 2
        });
      }
    }

    function resize() {
      W = host.clientWidth || window.innerWidth;
      H = host.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    }

    // Параллакс-вводы
    var scrollY = window.pageYOffset || 0;
    var mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5;
    window.addEventListener('scroll', function () {
      scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    }, { passive: true });
    if (hoverCapable.matches) {
      window.addEventListener('pointermove', function (e) {
        tmx = e.clientX / (window.innerWidth || 1);
        tmy = e.clientY / (window.innerHeight || 1);
      }, { passive: true });
    }

    function drawGrid() {
      // Тонкая нотная сетка (5-линейные станы) с вертикальной маской.
      ctx.save();
      ctx.strokeStyle = palette.grid + palette.gridA + ')';
      ctx.lineWidth = 1;
      var gap = 9, staff = gap * 4, block = 150, y = 40;
      while (y < H + block) {
        var fade = 0.5 + 0.5 * Math.sin((y / H) * Math.PI); // затухание к краям
        ctx.globalAlpha = fade;
        for (var k = 0; k < 5; k++) {
          var ly = y + k * gap;
          ctx.beginPath();
          ctx.moveTo(0, ly);
          ctx.lineTo(W, ly);
          ctx.stroke();
        }
        y += staff + block;
      }
      ctx.restore();
    }

    function drawOrbs() {
      var px = (mx - 0.5), py = (my - 0.5);
      for (var i = 0; i < orbs.length; i++) {
        var o = orbs[i];
        o.drift += 0.0015;
        var ox = o.bx * W + Math.cos(o.drift) * 40 + px * 120 * o.depth;
        var oy = o.by * H + Math.sin(o.drift) * 40 + py * 120 * o.depth - scrollY * 0.06 * o.depth;
        var grd = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r);
        grd.addColorStop(0, palette.orb + palette.orbA + ')');
        grd.addColorStop(1, palette.orb + '0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(ox, oy, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawNotes() {
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        n.y += n.vy; n.x += n.vx; n.rot += n.vr;
        if (n.y < -30) { n.y = H + 30; n.x = Math.random() * W; }
        if (n.x < -30) n.x = W + 30; else if (n.x > W + 30) n.x = -30;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(n.rot);
        ctx.globalAlpha = n.a * palette.noteA * 3;
        ctx.fillStyle = palette.note + '1)';
        ctx.font = n.size + 'px "Cormorant Garamond", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.g, 0, 0);
        ctx.restore();
      }
    }

    var running = true, rafId = 0;
    function frame() {
      if (!running) return;
      // Плавное сглаживание мыши
      mx += (tmx - mx) * 0.05;
      my += (tmy - my) * 0.05;
      ctx.clearRect(0, 0, W, H);
      drawGrid();
      drawOrbs();
      drawNotes();
      rafId = requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; rafId = requestAnimationFrame(frame); } }
    function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); }

    // Пауза при скрытой вкладке — экономия батареи/CPU.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else start();
    });
    // Реакция на смену темы
    window.addEventListener('muzmir:theme', function (e) {
      theme = (e && e.detail) || currentTheme(); setPalette();
    });
    // Отключение, если пользователь включил reduced-motion на лету
    if (reduced.addEventListener) {
      reduced.addEventListener('change', function () { if (isReduced()) { stop(); host.style.display = 'none'; } });
    }

    var rzT;
    window.addEventListener('resize', function () {
      clearTimeout(rzT); rzT = setTimeout(resize, 200);
    }, { passive: true });

    resize();
    rafId = requestAnimationFrame(frame);
  })();

  /* ---------- Модалка авторизации (.auth-modal) ---------- */
  (function initAuth() {
    var origin = location.origin;
    // Гость определяется по отсутствию ссылки на /cabinet в шапке (её показывают залогиненным).
    var loggedIn = !!document.querySelector('.nav-actions a[href$="/cabinet"], .nav-actions a[href*="/cabinet"]');
    var LOGO = '/assets/img/logo_muzmir_256.png';
    var modal = null, lastFocus = null;

    var VK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M13.2 17.4c-5.5 0-8.9-3.8-9-10.1h2.8c.1 4.6 2.2 6.6 3.8 7V7.3h2.6v4c1.6-.2 3.3-2 3.9-4h2.6c-.5 2.5-2.2 4.3-3.4 5 1.2.6 3.2 2.2 3.9 5.1h-2.9c-.6-1.9-2.1-3.4-4.1-3.6v3.6h-.2z"/></svg>';
    var MAX_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12 3.2c-5.4 0-9.8 3.5-9.8 7.9 0 2.5 1.4 4.7 3.6 6.1-.2 1-.7 2.3-1.6 3.4-.3.4 0 .9.5.8 1.9-.4 3.5-1.1 4.7-1.8 .8.2 1.7.3 2.6.3 5.4 0 9.8-3.5 9.8-7.9S17.4 3.2 12 3.2z"/></svg>';
    var MAIL_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
    var PHONE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';

    function api(path, body) {
      return fetch(origin + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          return { ok: r.ok, status: r.status, data: d };
        });
      });
    }
    function afterSuccess(d) {
      var to = (d && d.redirect) || '/cabinet';
      window.toast('Вход выполнен.', 'success');
      setTimeout(function () { window.location.href = to; }, 500);
    }
    function fail(res, fallback) {
      var msg = (res && res.data && (res.data.error || res.data.message)) || fallback || 'Не удалось выполнить вход. Попробуйте позже.';
      window.toast(msg, 'error');
    }

    function close() {
      if (!modal) return;
      modal.classList.remove('open');
      var m = modal;
      setTimeout(function () { if (m.parentNode) m.parentNode.removeChild(m); }, 260);
      modal = null;
      try { localStorage.setItem('muzmir-auth-seen', '1'); } catch (e) {}
      document.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape' || e.keyCode === 27) { close(); return; }
      // Ловушка фокуса: Tab не выходит за пределы модалки (a11y).
      if ((e.key === 'Tab' || e.keyCode === 9) && modal) {
        var f = Array.prototype.filter.call(
          modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'),
          function (el) { return !el.disabled && el.offsetParent !== null; }
        );
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    function open() {
      if (modal) return;
      lastFocus = document.activeElement;
      modal = document.createElement('div');
      modal.className = 'auth-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', 'Вход и регистрация');
      modal.innerHTML =
        '<div class="auth-overlay" data-close></div>' +
        '<div class="auth-card" role="document">' +
          '<button class="auth-close" type="button" aria-label="Закрыть" data-close>' +
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
          '<div class="auth-head">' +
            '<img class="auth-logo" src="' + LOGO + '" alt="КЦ «Музыкальный Мир»" width="56" height="56">' +
            '<h3 class="auth-title">Вход в личный кабинет</h3>' +
            '<p class="auth-sub">Быстрый вход в один клик или по почте / телефону.</p>' +
          '</div>' +
          '<div class="auth-social">' +
            '<button class="auth-btn auth-btn--vk" type="button">' + VK_SVG + '<span>Войти через ВКонтакте</span></button>' +
            '<button class="auth-btn auth-btn--max" type="button">' + MAX_SVG + '<span>Войти через MAX</span></button>' +
          '</div>' +
          '<div class="auth-or"><span>или</span></div>' +
          '<div class="auth-alt">' +
            '<button class="auth-btn auth-btn--email" type="button">' + MAIL_SVG + '<span>Почта</span></button>' +
            '<button class="auth-btn auth-btn--phone" type="button">' + PHONE_SVG + '<span>Телефон</span></button>' +
          '</div>' +
          '<div class="auth-forms" hidden></div>' +
          '<p class="auth-legal">Продолжая, Вы соглашаетесь с <a href="/agreement">условиями</a> и <a href="/privacy">политикой конфиденциальности</a>.</p>' +
        '</div>';
      document.body.appendChild(modal);
      requestAnimationFrame(function () {
        modal.classList.add('open');
        var f = modal.querySelector('.auth-btn, .auth-close');
        if (f && f.focus) { try { f.focus(); } catch (e) {} }
      });
      document.addEventListener('keydown', onKey);

      $$('[data-close]', modal).forEach(function (el) {
        el.addEventListener('click', close);
      });

      // ВК / MAX — редирект на OAuth-эндпоинты (graceful: бэкенд сам вернёт flash при не-настроенности).
      $('.auth-btn--vk', modal).addEventListener('click', function () {
        window.location.href = origin + '/api/v1/oauth_vk';
      });
      $('.auth-btn--max', modal).addEventListener('click', function () {
        window.location.href = origin + '/api/v1/oauth_max';
      });

      var forms = $('.auth-forms', modal);
      $('.auth-btn--email', modal).addEventListener('click', function () { showEmail(forms); });
      $('.auth-btn--phone', modal).addEventListener('click', function () { showPhone(forms); });

      // Фокус на первую соц-кнопку
      var first = $('.auth-btn--vk', modal);
      if (first) first.focus();
    }

    function showEmail(forms) {
      forms.hidden = false;
      forms.innerHTML =
        '<form class="auth-form" novalidate>' +
          '<label class="field"><span>Электронная почта</span>' +
            '<input type="email" name="email" autocomplete="email" required placeholder="you@mail.ru"></label>' +
          '<label class="field"><span>Пароль</span>' +
            '<input type="password" name="password" autocomplete="current-password" placeholder="Ваш пароль"></label>' +
          '<button class="btn btn--primary btn--block" type="submit">Войти</button>' +
          '<button class="auth-link" type="button" data-otp>Войти по коду из письма</button>' +
        '</form>';
      var f = $('.auth-form', forms);
      var otpMode = false;
      $('[data-otp]', f).addEventListener('click', function () {
        otpMode = true;
        var email = f.email.value.trim();
        if (!email) { window.toast('Введите почту для отправки кода.', 'error'); return; }
        var b = this; b.disabled = true; b.textContent = 'Отправляем код…';
        api('/api/v1/auth_email', { action: 'request', email: email }).then(function (res) {
          b.disabled = false; b.textContent = 'Отправить код повторно';
          if (res.ok && res.data && res.data.ok !== false) {
            f.password.parentNode.querySelector('span').textContent = 'Код из письма';
            f.password.type = 'text'; f.password.name = 'otp'; f.password.value = '';
            f.password.setAttribute('inputmode', 'numeric'); f.password.placeholder = '6-значный код';
            window.toast('Код отправлен на почту.', 'success');
          } else { fail(res, 'Не удалось отправить код.'); }
        }).catch(function () { b.disabled = false; b.textContent = 'Войти по коду из письма'; window.toast('Сеть недоступна. Попробуйте позже.', 'error'); });
      });
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var email = f.email.value.trim();
        if (!email) { window.toast('Укажите почту.', 'error'); return; }
        var body = otpMode
          ? { action: 'verify', email: email, otp: (f.otp ? f.otp.value.trim() : '') }
          : { action: 'login', email: email, password: f.password.value };
        submitAuth(f, '/api/v1/auth_email', body);
      });
      var em = $('input[name="email"]', f); if (em) em.focus();
    }

    function showPhone(forms) {
      forms.hidden = false;
      forms.innerHTML =
        '<form class="auth-form" novalidate>' +
          '<label class="field"><span>Номер телефона</span>' +
            '<input type="tel" name="phone" autocomplete="tel" inputmode="tel" required placeholder="+7 900 000-00-00"></label>' +
          '<div class="auth-otp-row" hidden>' +
            '<label class="field"><span>Код из СМS</span>' +
              '<input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" placeholder="Код из SMS"></label>' +
          '</div>' +
          '<button class="btn btn--primary btn--block" type="submit" data-phase="request">Получить код</button>' +
        '</form>';
      var f = $('.auth-form', forms);
      var otpRow = $('.auth-otp-row', f);
      var btn = $('button[type="submit"]', f);
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var phone = f.phone.value.trim();
        if (!phone) { window.toast('Введите номер телефона.', 'error'); return; }
        var phase = btn.getAttribute('data-phase');
        if (phase === 'request') {
          btn.classList.add('is-loading'); btn.disabled = true;
          api('/api/v1/auth_phone', { action: 'request', phone: phone }).then(function (res) {
            btn.classList.remove('is-loading'); btn.disabled = false;
            if (res.ok && res.data && res.data.ok !== false) {
              otpRow.hidden = false;
              btn.setAttribute('data-phase', 'verify');
              btn.textContent = 'Подтвердить';
              var c = $('input[name="code"]', f); if (c) c.focus();
              window.toast('Код отправлен по SMS.', 'success');
            } else { fail(res, 'Не удалось отправить код.'); }
          }).catch(function () { btn.classList.remove('is-loading'); btn.disabled = false; window.toast('Сеть недоступна. Попробуйте позже.', 'error'); });
        } else {
          submitAuth(f, '/api/v1/auth_phone', { action: 'verify', phone: phone, code: f.code.value.trim() }, btn);
        }
      });
      var ph = $('input[name="phone"]', f); if (ph) ph.focus();
    }

    function submitAuth(form, path, body, btn) {
      btn = btn || $('button[type="submit"]', form);
      if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }
      api(path, body).then(function (res) {
        if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
        if (res.ok && res.data && (res.data.ok === true || res.data.success)) {
          afterSuccess(res.data);
        } else if (res.status === 501 || (res.data && res.data.not_configured)) {
          window.toast('Способ входа пока не настроен. Воспользуйтесь ВКонтакте.', '');
        } else {
          fail(res);
        }
      }).catch(function () {
        if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
        window.toast('Сеть недоступна. Попробуйте позже.', 'error');
      });
    }

    // ВСПЛЫВАЮЩАЯ МОДАЛКА ВХОДА ОТКЛЮЧЕНА ПОЛНОСТЬЮ (по требованию).
    // Все ссылки «Войти» ведут на отдельную страницу /login — никаких перехватов
    // кликов и никакого авто-открытия попапа. open()/close() оставлены неиспользуемыми.
    void open; void close;
  })();

  /* ---------- PWA ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/service-worker.js').catch(function () {}); });
  }
})();

/* ---------- Аналитика сайта (site_events, api/v1/track) ---------- */
/* pageview при загрузке и SPA-навигации; клики по .btn и ссылкам —
   делегирование + троттлинг, отправка через sendBeacon (без ПД). */
(function () {
  'use strict';
  var API = '/api/v1/track';
  var lastClick = 0;

  function send(type, path, meta) {
    try {
      var payload = JSON.stringify({
        type: type,
        path: path || (location.pathname + location.search),
        meta: meta || {}
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API, new Blob([payload], { type: 'application/json' }));
      } else {
        var x = new XMLHttpRequest();
        x.open('POST', API, true);
        x.setRequestHeader('Content-Type', 'application/json');
        x.send(payload);
      }
    } catch (e) { /* тихо */ }
  }

  /* pageview при первичной загрузке */
  send('pageview');

  /* pageview при SPA-навигации (spa.js шлёт mz-spa-navigate; mz:navigated — совместимость) */
  document.addEventListener('mz-spa-navigate', function (e) {
    var u = e && e.detail && e.detail.url;
    try { u = u ? new URL(u, location.href) : null; } catch (err) { u = null; }
    send('pageview', u ? (u.pathname + u.search) : (location.pathname + location.search));
  });
  document.addEventListener('mz:navigated', function () { send('pageview'); });
  window.addEventListener('mz:navigated', function () { send('pageview'); });

  /* Клики по кнопкам и ссылкам: делегирование + троттлинг 400мс */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var el = t && t.closest ? t.closest('.btn, a[href]') : null;
    if (!el) return;
    var now = Date.now();
    if (now - lastClick < 400) return;
    lastClick = now;
    var label = (el.getAttribute('data-track') || el.getAttribute('aria-label') || el.textContent || '')
      .replace(/\s+/g, ' ').trim().slice(0, 80);
    var href = el.getAttribute('href') || '';
    if (/^(mailto|tel|javascript):/i.test(href)) href = href.split(':')[0] + ':';
    send('click', location.pathname, {
      t: label,
      href: href.slice(0, 140),
      btn: el.classList && el.classList.contains('btn') ? 1 : 0
    });
  }, true);
})();
