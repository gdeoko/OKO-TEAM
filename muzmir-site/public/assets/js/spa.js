/**
 * SPA-роутер muzmir. Перехватывает переходы между разделами:
 * fetch(href) → парсим HTML → заменяем ТОЛЬКО <main>, header/appnav/фон/музыка остаются.
 * Результат: сайт работает как приложение — переходы без reload, фон/музыка непрерывны, меню всегда на месте.
 */
(function () {
  if (window.MzSpa) return;
  var main = null, activeReq = null;

  function ensureMain() { main = main || document.querySelector('main'); return main; }

  function isInternal(href) {
    if (!href) return false;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;
    try {
      var u = new URL(href, location.href);
      if (u.origin !== location.origin) return false;
      // Не перехватываем: /admin, /api, файлы (.pdf, .png, .jpg, .zip, .css, .js), /logout
      if (/^\/(admin|api)\b/.test(u.pathname)) return false;
      if (/\.(pdf|png|jpg|jpeg|webp|svg|gif|zip|css|js|xml|ico|webmanifest)($|\?)/i.test(u.pathname)) return false;
      if (u.pathname === '/logout') return false;
      return true;
    } catch (_) { return false; }
  }

  function highlightAppnav() {
    var nav = document.querySelector('.appnav'); if (!nav) return;
    var here = location.pathname;
    nav.querySelectorAll('a').forEach(function (a) {
      var p = new URL(a.href, location.href).pathname;
      a.classList.toggle('active', p === here);
    });
  }

  function progressStart() {
    var b = document.getElementById('mz-spa-bar');
    if (!b) {
      b = document.createElement('div'); b.id = 'mz-spa-bar';
      b.style.cssText = 'position:fixed;top:0;left:0;height:2px;width:0;background:linear-gradient(90deg,#c9a84c,#e6c766);z-index:9999;transition:width .3s ease,opacity .3s;box-shadow:0 0 8px rgba(232,194,90,.6);pointer-events:none';
      document.body.appendChild(b);
    }
    b.style.opacity = '1'; b.style.width = '15%';
    setTimeout(function () { b.style.width = '55%'; }, 60);
  }
  function progressDone() {
    var b = document.getElementById('mz-spa-bar'); if (!b) return;
    b.style.width = '100%';
    setTimeout(function () { b.style.opacity = '0'; b.style.width = '0'; }, 260);
  }

  async function navigate(url, push) {
    if (!ensureMain()) return false;
    if (activeReq) activeReq.aborted = true;
    var req = { aborted: false }; activeReq = req;
    progressStart();
    try {
      var res = await fetch(url, { credentials: 'same-origin', headers: { 'X-Spa': '1' } });
      if (req.aborted) return true;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var html = await res.text();
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var newMain = doc.querySelector('main');
      if (!newMain) { window.location.href = url; return true; }
      // мягкая смена: fade out → replace → fade in
      main.style.transition = 'opacity .18s ease';
      main.style.opacity = '.15';
      setTimeout(function () {
        main.replaceWith(newMain);
        main = newMain;
        main.style.opacity = '0';
        main.style.transition = 'opacity .28s ease';
        // Обновляем title
        var t = doc.querySelector('title'); if (t) document.title = t.textContent;
        // Обновляем <head> meta-описание (лёгкий SEO-фикс)
        var md = doc.querySelector('meta[name="description"]');
        var cur = document.querySelector('meta[name="description"]');
        if (md && cur) cur.setAttribute('content', md.getAttribute('content') || '');
        // Прогоняем скрипты внутри main (inline и src) — без этого JS-фичи страниц не оживут
        Array.from(main.querySelectorAll('script')).forEach(function (s) {
          var n = document.createElement('script');
          for (var i = 0; i < s.attributes.length; i++) n.setAttribute(s.attributes[i].name, s.attributes[i].value);
          if (s.textContent) n.textContent = s.textContent;
          s.parentNode.replaceChild(n, s);
        });
        // Инициализируем reveal-анимацию для нового контента
        newMain.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
        // Плавный fade in
        requestAnimationFrame(function () { main.style.opacity = '1'; });
        window.scrollTo({ top: 0, behavior: 'auto' });
        highlightAppnav();
        // Обновляем закреплённый Telegram BackButton
        try {
          var tg = window.Telegram && window.Telegram.WebApp;
          if (tg && tg.BackButton) { location.pathname === '/' ? tg.BackButton.hide() : tg.BackButton.show(); }
        } catch (_) {}
        progressDone();
        // Событие для сторонних скриптов (аналитика/микроанимации)
        document.dispatchEvent(new CustomEvent('mz-spa-navigate', { detail: { url: url } }));
      }, 190);
      if (push) history.pushState({ mz: 1 }, '', url);
      return true;
    } catch (e) {
      progressDone();
      window.location.href = url;
      return true;
    }
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    if (a.target && a.target !== '' && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    if (a.hasAttribute('data-no-spa')) return;
    var href = a.getAttribute('href');
    if (!isInternal(href)) return;
    e.preventDefault();
    navigate(new URL(href, location.href).pathname + new URL(href, location.href).search, true);
  }, false);

  window.addEventListener('popstate', function () {
    navigate(location.pathname + location.search, false);
  });

  // Первичная подсветка активного пункта меню
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', highlightAppnav);
  else highlightAppnav();

  window.MzSpa = { navigate: function (u) { return navigate(u, true); } };
})();
