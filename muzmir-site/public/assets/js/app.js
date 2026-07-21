/* КЦ «Музыкальный Мир» — фронтенд. Vanilla JS, без библиотек. */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // Мобильное меню
  var burger = $('#burger'), nav = $('#nav');
  if (burger && nav) burger.addEventListener('click', function () { nav.classList.toggle('open'); });

  // Появление секций при скролле
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
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
    $$('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1400, t0 = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - t0) / dur);
      var val = Math.floor((1 - Math.pow(1 - p, 3)) * target);
      el.textContent = val.toLocaleString('ru-RU') + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Аккордеон
  $$('.acc-q').forEach(function (q) {
    q.addEventListener('click', function () { q.parentNode.classList.toggle('open'); });
  });

  // Плавающие ноты в hero
  var notesBox = $('.hero-notes');
  if (notesBox && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

  // Чат-виджет (агент поддержки)
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
      '<button class="btn btn--primary" style="padding:10px 16px">→</button></form>';
    document.body.appendChild(box);
    var log = $('#mc-log', box);
    addMsg('Здравствуйте! Чем можем помочь? Задайте вопрос о конкурсах, заявках или наградах.', 'bot');
    $('#mc-form', box).addEventListener('submit', function (ev) {
      ev.preventDefault();
      var inp = $('#mc-in', box), text = inp.value.trim();
      if (!text) return;
      addMsg(text, 'me'); inp.value = '';
      fetch(location.origin + '/api/v1/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      }).then(function (r) { return r.json(); })
        .then(function (d) { addMsg(d.reply || 'Спасибо! Мы ответим в ближайшее время.', 'bot'); })
        .catch(function () { addMsg('Спасибо! Мы свяжемся с Вами.', 'bot'); });
    });
    function addMsg(t, who) {
      var m = document.createElement('div');
      m.style.cssText = 'margin:8px 0;max-width:82%;padding:9px 13px;border-radius:12px;' +
        (who === 'me' ? 'margin-left:auto;background:#C9A84C;color:#fff' : 'background:#F9F2E4;color:#1B2340');
      m.textContent = t; log.appendChild(m); log.scrollTop = log.scrollHeight;
    }
    window.MuzmirChat = { toggle: function () { box.style.display = box.style.display === 'none' ? 'flex' : 'none'; } };
  }

  // PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/service-worker.js').catch(function () {}); });
  }
})();
