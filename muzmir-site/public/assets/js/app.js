/* КЦ «Музыкальный Мир» — фронтенд. Vanilla JS, без библиотек. */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function isReduced() { return reduced.matches; }
  var hoverCapable = matchMedia('(hover: hover)');

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
      t.classList.add('toastOut');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
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

  /* ---------- Переключатель темы ---------- */
  var themeBtn = $('#themeToggle');
  function applyThemeIcon(theme) {
    var moon = '<svg id="themeIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    var sun = '<svg id="themeIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
    if (!themeBtn) return;
    // theme=light → показать «солнце»; theme=dark → «луну»
    themeBtn.innerHTML = theme === 'light' ? sun : moon;
  }
  if (themeBtn) {
    var startTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    applyThemeIcon(startTheme);
    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      var next = cur === 'light' ? 'dark' : 'light';
      function swap() {
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('muzmir-theme', next); } catch (e) {}
        var m = document.querySelector('meta[name="theme-color"]');
        if (m) m.setAttribute('content', next === 'light' ? '#FFFCF5' : '#0b0a0d');
        applyThemeIcon(next);
      }
      if (document.startViewTransition && !isReduced()) {
        document.startViewTransition(swap);
      } else {
        swap();
      }
    });
  }

  /* ---------- Появление секций при скролле + stagger ---------- */
  var STAGGER_SEL = '.stats > .stat, .grid > .card, .steps > .step, .partners > a';
  function staggerChildren(container) {
    if (isReduced()) return;
    // Прямые дети сеток внутри контейнера получают инкрементальную задержку.
    $$('.stats, .grid, .steps, .partners', container).forEach(function (gridEl) {
      var kids = Array.prototype.slice.call(gridEl.children);
      kids.forEach(function (kid, i) {
        kid.style.transitionDelay = (i * 70) + 'ms';
        kid.style.setProperty('--i', i);
      });
    });
    // Если сам контейнер является сеткой
    if (container.matches && container.matches('.stats, .grid, .steps, .partners')) {
      Array.prototype.slice.call(container.children).forEach(function (kid, i) {
        kid.style.transitionDelay = (i * 70) + 'ms';
        kid.style.setProperty('--i', i);
      });
    }
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          staggerChildren(e.target);
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    $$('.reveal').forEach(function (el) { io.observe(el); });

    // Счётчики
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countUp(e.target); cio.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    $$('[data-count]').forEach(function (el) { cio.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { staggerChildren(el); el.classList.add('in'); });
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    if (isReduced()) { el.textContent = target.toLocaleString('ru-RU') + suffix; return; }
    var dur = 1400, t0 = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      var val = Math.floor((1 - Math.pow(1 - p, 3)) * target);
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

  /* ---------- Parallax-tilt карточек ---------- */
  if (hoverCapable.matches && !isReduced()) {
    $$('.grid > .card, .steps > .step').forEach(function (card) {
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

  /* ---------- PWA ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/service-worker.js').catch(function () {}); });
  }
})();
