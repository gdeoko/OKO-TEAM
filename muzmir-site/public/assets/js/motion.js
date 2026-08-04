/**
 * Универсальные микроанимации + онбординг.
 * — Reveal-on-scroll: IntersectionObserver добавляет .in на .reveal и *-card при появлении
 * — Cascade: у соседних карточек в контейнере добавляется delay через --i
 * — Onboarding: показывает 3 экрана при первом входе (localStorage=mz-onb-done)
 */
(function(){
  if (window.MzMotion) return; window.MzMotion = true;

  /* ---------- Reveal on scroll ---------- */
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  function bindReveal(root){
    if (reduced) return;
    var els = (root||document).querySelectorAll('.reveal:not(.in), .card:not(.in), .comp-card:not(.in), .menu-tile:not(.in), .cab-card:not(.in), .ach-tile:not(.in), .cab-kpi:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(function(e){e.classList.add('in');}); return; }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, {rootMargin:'0px 0px -8% 0px', threshold:.06});
    // Каскадный сдвиг по индексу в контейнере
    var byParent = new Map();
    els.forEach(function(e){
      var p = e.parentElement;
      if (!byParent.has(p)) byParent.set(p, 0);
      var i = byParent.get(p); byParent.set(p, i+1);
      if (!e.style.getPropertyValue('--i')) e.style.setProperty('--i', i);
      io.observe(e);
    });
  }
  bindReveal(document);
  document.addEventListener('mz-spa-navigate', function(){ bindReveal(document); });
  new MutationObserver(function(muts){
    muts.forEach(function(m){ m.addedNodes && m.addedNodes.forEach(function(n){ if (n.nodeType===1) bindReveal(n); }); });
  }).observe(document.body, {childList:true, subtree:true});

  /* ---------- Share: Web Share API + fallback popup с VK/TG/WhatsApp/Copy ---------- */
  function shareFallback(title, url){
    // Показать всплывашку с вариантами
    if (document.getElementById('mzSharePop')) return;
    var enc = encodeURIComponent;
    var txt = enc(title || document.title);
    var link = enc(url);
    var host = document.createElement('div');
    host.id = 'mzSharePop'; host.className = 'mz-fun on';
    host.innerHTML =
      '<div class="mz-fun-card" style="max-width:340px">' +
        '<button type="button" class="mz-fun-x" data-close aria-label="Закрыть">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<div class="mz-fun-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></div>' +
        '<h3>Поделиться</h3>' +
        '<p>' + (title||'') + '</p>' +
        '<div class="share-panel" style="margin-top:6px">' +
          '<a class="share-btn share-btn--vk" target="_blank" rel="noopener" href="https://vk.com/share.php?url=' + link + '&title=' + txt + '">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 17.4c-5.5 0-8.9-3.8-9-10.1h2.8c.1 4.6 2.2 6.6 3.8 7V7.3h2.6v4c1.6-.2 3.3-2 3.9-4h2.6c-.5 2.5-2.2 4.3-3.4 5 1.2.6 3.2 2.2 3.9 5.1h-2.9c-.6-1.9-2.1-3.4-4.1-3.6v3.6h-.2z"/></svg>ВКонтакте</a>' +
          '<a class="share-btn share-btn--wa" target="_blank" rel="noopener" href="https://wa.me/?text=' + txt + '%20' + link + '">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 3.5C18 1.5 15.2.4 12.3.4 6.8.4 2.3 4.9 2.3 10.4c0 1.8.5 3.5 1.3 5L2.2 20l4.9-1.3c1.4.8 3 1.2 4.7 1.2h.4c5.5 0 10-4.5 10-10 0-2.7-1-5.2-2.9-7.1zm-7.7 15.4c-1.4 0-2.9-.4-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3c-.8-1.2-1.2-2.7-1.2-4.1 0-4.4 3.6-8 8-8 2.2 0 4.2.9 5.7 2.4s2.3 3.5 2.3 5.7c0 4.3-3.6 7.7-8 7.7z"/></svg>WhatsApp</a>' +
          '<button type="button" class="share-btn share-btn--copy" data-copy>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>Копировать</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(host);
    host.addEventListener('click', function(e){
      if (e.target.closest('[data-close]') || e.target === host) { host.remove(); return; }
      if (e.target.closest('[data-copy]')) {
        navigator.clipboard && navigator.clipboard.writeText(url).then(function(){
          e.target.closest('[data-copy]').textContent = 'Скопировано';
        });
      }
    });
  }
  function shareTrigger(btn){
    var title = btn.getAttribute('data-share-title') || document.title;
    var url = btn.getAttribute('data-share-url') || location.href;
    // Абсолютный URL
    try { url = new URL(url, location.origin).href; } catch(e){}
    if (navigator.share) {
      navigator.share({title: title, url: url}).catch(function(){ shareFallback(title, url); });
    } else {
      shareFallback(title, url);
    }
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-share]');
    if (b) { e.preventDefault(); shareTrigger(b); }
  });

  /* ---------- Countdown: живой обратный отсчёт до атрибута data-deadline ---------- */
  function bindCountdown(root){
    (root||document).querySelectorAll('[data-deadline]:not([data-cd-bound])').forEach(function(el){
      el.setAttribute('data-cd-bound','1');
      var target = new Date(el.getAttribute('data-deadline'));
      if (isNaN(target.getTime())) return;
      // Рендерим структуру раз
      el.innerHTML =
        '<span class="mz-cd-unit"><b class="d">0</b><small>дн</small></span>' +
        '<span class="mz-cd-sep">:</span>' +
        '<span class="mz-cd-unit"><b class="h">00</b><small>ч</small></span>' +
        '<span class="mz-cd-sep">:</span>' +
        '<span class="mz-cd-unit"><b class="m">00</b><small>мин</small></span>' +
        '<span class="mz-cd-sep">:</span>' +
        '<span class="mz-cd-unit"><b class="s">00</b><small>сек</small></span>';
      function pad(n){ return n<10 ? '0'+n : ''+n; }
      function tick(){
        var d = Math.max(0, (target - new Date()) / 1000);
        var days = Math.floor(d/86400);
        var hours = Math.floor((d%86400)/3600);
        var mins = Math.floor((d%3600)/60);
        var secs = Math.floor(d%60);
        el.querySelector('.d').textContent = days;
        el.querySelector('.h').textContent = pad(hours);
        el.querySelector('.m').textContent = pad(mins);
        el.querySelector('.s').textContent = pad(secs);
        el.classList.toggle('is-hot', days <= 3);
        if (d <= 0) el.classList.add('is-done');
      }
      tick();
      var iv = setInterval(tick, 1000);
      // Останавливаем при переходе (SPA)
      document.addEventListener('mz-spa-navigate', function once(){ clearInterval(iv); document.removeEventListener('mz-spa-navigate', once); });
    });
  }
  bindCountdown(document);
  document.addEventListener('mz-spa-navigate', function(){ bindCountdown(document); });

  /* ---------- Count-up: КПИ-цифры «догоняют» значение при появлении ---------- */
  (function(){
    if (reduced || !('IntersectionObserver' in window)) return;
    var SEL = '.stat b, .stats-chip b, .cab-kpi b, .kpi b, .club-stats b, .calx-kpi b, .cab-level-num';
    function animate(el){
      var orig = el.textContent;
      var m = /^([^\d]*)([\d][\d\s  ]*)(.*)$/.exec(orig.trim());
      if (!m) return;
      var val = parseInt(m[2].replace(/[\s  ]/g, ''), 10);
      if (!isFinite(val) || val <= 1 || val > 9999999) return;
      var grouped = /[\s  ]/.test(m[2].trim());
      var pre = m[1], suf = m[3], t0 = null, dur = Math.min(1400, 700 + val % 500);
      el.classList.add('mz-counting');
      function fmt(v){ return grouped ? v.toLocaleString('ru-RU') : String(v); }
      function frame(ts){
        if (t0 === null) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3); /* easeOutCubic */
        el.textContent = pre + fmt(Math.round(val * e)) + suf;
        if (p < 1) requestAnimationFrame(frame);
        else { el.textContent = orig; el.classList.remove('mz-counting'); }
      }
      requestAnimationFrame(frame);
    }
    function bindCount(root){
      var els = (root||document).querySelectorAll(SEL);
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(en){
          if (en.isIntersecting){ io.unobserve(en.target); animate(en.target); }
        });
      }, {threshold:.35});
      els.forEach(function(el){
        if (el.dataset.cntBound || el.closest('.mz-countdown') || el.closest('[data-deadline]')) return;
        el.dataset.cntBound = '1';
        io.observe(el);
      });
    }
    bindCount(document);
    document.addEventListener('mz-spa-navigate', function(){ bindCount(document); });
  })();

  /* ---------- Image skeleton: маркируем img[data-loaded] когда картинка готова ---------- */
  function markLoaded(img){
    if (img.complete && img.naturalWidth > 0) img.setAttribute('data-loaded','1');
    else img.addEventListener('load', function(){ img.setAttribute('data-loaded','1'); }, {once:true});
  }
  function bindImgs(root){
    (root||document).querySelectorAll('img[loading="lazy"]:not([data-loaded])').forEach(markLoaded);
  }
  bindImgs(document);
  document.addEventListener('mz-spa-navigate', function(){ bindImgs(document); });
  new MutationObserver(function(muts){
    muts.forEach(function(m){ m.addedNodes && m.addedNodes.forEach(function(n){ if (n.nodeType===1) bindImgs(n); }); });
  }).observe(document.body, {childList:true, subtree:true});

  /* ---------- PWA install prompt (Chrome/Edge/Samsung) ---------- */
  (function(){
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function(e){
      e.preventDefault(); deferred = e;
      // Не показываем на служебных страницах и в TG (там свой install)
      if (document.documentElement.classList.contains('in-tg')) return;
      if (/^\/(admin|api|login|register|apply|cabinet)/.test(location.pathname)) return;
      // Раз в неделю максимум
      try {
        var last = parseInt(localStorage.getItem('mz-pwa-shown')||'0', 10);
        if (Date.now() - last < 7*86400*1000) return;
      } catch(e){}
      setTimeout(function(){
        if (!deferred) return;
        var bar = document.createElement('div'); bar.className = 'mz-pwa-bar';
        bar.innerHTML =
          '<div class="mz-pwa-inner">' +
            '<div class="mz-pwa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg></div>' +
            '<div class="mz-pwa-body"><b>Установить приложение</b><span>Быстрый доступ с главного экрана</span></div>' +
            '<button type="button" class="btn btn--primary btn--sm" data-pwa-yes>Установить</button>' +
            '<button type="button" class="mz-pwa-x" data-pwa-no aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
          '</div>';
        document.body.appendChild(bar);
        requestAnimationFrame(function(){ bar.classList.add('on'); });
        bar.querySelector('[data-pwa-yes]').addEventListener('click', function(){
          deferred.prompt();
          deferred.userChoice.then(function(){ deferred = null; bar.remove(); });
          try{ localStorage.setItem('mz-pwa-shown', String(Date.now())); }catch(e){}
        });
        bar.querySelector('[data-pwa-no]').addEventListener('click', function(){
          bar.classList.remove('on'); setTimeout(function(){bar.remove();}, 260);
          try{ localStorage.setItem('mz-pwa-shown', String(Date.now())); }catch(e){}
        });
      }, 8000);
    });
  })();

  /* ---------- Онбординг: 3 экрана при первом визите ---------- */
  var LS = 'mz-onb-done';
  var done = false; try { done = localStorage.getItem(LS) === '1'; } catch(e){}
  if (done) return;
  // Не показываем на служебных страницах / если гость на /apply, /admin, /api, /login, /register — там свои UI
  if (/^\/(apply|admin|api|login|register|cabinet|verify|reset|logout|verify-email|forgot|__)/.test(location.pathname)) return;

  var SLIDES = [
    {
      ic:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      title:'Добро пожаловать в КЦ «Музыкальный Мир»',
      text:'Международные и Всероссийские онлайн-конкурсы культуры и искусства. Роскомнадзор № 094084, при информационной поддержке Министерств.'
    },
    {
      ic:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="2.4"/>',
      title:'4 действующих конкурса',
      text:'Мировые Таланты, В зените славы, Искусство во благо, Величие России. Один клик — выбрали, отметили несколько, оплатили одним чеком.'
    },
    {
      ic:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
      title:'Дипломы, награды, кабинет',
      text:'Электронные дипломы на почту через 5 рабочих дней. Оригиналы, кубки, статуэтки — через «Заказ наград». Статистика и достижения — в профиле.'
    }
  ];
  var idx = 0;
  var wrap = document.createElement('div');
  wrap.id = 'mzOnb'; wrap.className = 'mz-onb';
  wrap.innerHTML =
    '<div class="mz-onb-card">' +
      '<button type="button" class="mz-onb-skip" aria-label="Пропустить">Пропустить</button>' +
      '<div class="mz-onb-slide">' +
        '<div class="mz-onb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></svg></div>' +
        '<h3></h3>' +
        '<p></p>' +
      '</div>' +
      '<div class="mz-onb-dots"></div>' +
      '<div class="mz-onb-nav">' +
        '<button type="button" class="btn btn--ghost" data-onb-prev>Назад</button>' +
        '<button type="button" class="btn btn--primary" data-onb-next>Далее</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  var dots = wrap.querySelector('.mz-onb-dots');
  SLIDES.forEach(function(_, i){
    var d = document.createElement('span'); d.className = 'mz-onb-dot'; if (i===0) d.classList.add('on');
    dots.appendChild(d);
  });
  function render(){
    var s = SLIDES[idx];
    wrap.querySelector('svg').innerHTML = s.ic;
    wrap.querySelector('h3').textContent = s.title;
    wrap.querySelector('p').textContent = s.text;
    dots.querySelectorAll('.mz-onb-dot').forEach(function(d, i){ d.classList.toggle('on', i===idx); });
    wrap.querySelector('[data-onb-prev]').style.visibility = idx===0 ? 'hidden' : '';
    wrap.querySelector('[data-onb-next]').textContent = idx===SLIDES.length-1 ? 'Начать' : 'Далее';
    wrap.querySelector('.mz-onb-slide').classList.remove('anim-in'); void wrap.offsetWidth;
    wrap.querySelector('.mz-onb-slide').classList.add('anim-in');
  }
  function finish(){
    try { localStorage.setItem(LS, '1'); } catch(e){}
    wrap.classList.remove('on');
    setTimeout(function(){ wrap.remove(); }, 320);
  }
  wrap.querySelector('.mz-onb-skip').addEventListener('click', finish);
  wrap.querySelector('[data-onb-prev]').addEventListener('click', function(){ if (idx>0){ idx--; render(); }});
  wrap.querySelector('[data-onb-next]').addEventListener('click', function(){
    if (idx < SLIDES.length-1) { idx++; render(); } else { finish(); }
  });
  render();
  requestAnimationFrame(function(){ wrap.classList.add('on'); });
})();
