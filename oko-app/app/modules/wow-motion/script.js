/* ==========================================================================
   wow-motion — ненавязчивый моушен-движок OKO.
   - reveal-анимации при появлении (IntersectionObserver), СТРОГО один раз;
   - мягкий stagger внутри контейнеров;
   - реагирует на смену табов и динамический ре-рендер (MutationObserver);
   - уважает prefers-reduced-motion;
   - НЕ переопределяет функции ядра, работает только классами + IO.
   Всё завёрнуто в IIFE, префикс wm*, с null-проверками и try/catch.
   ========================================================================== */
(function(){
  'use strict';
  try{
    var root = document.documentElement;
    if(!root) return;

    // reduced-motion → не включаем моушен-слой вовсе (CSS reveal гейтится wm-on).
    var mqReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if(mqReduce && mqReduce.matches) return;

    root.classList.add('wm-on');

    // Контентные поверхности, которые красиво «всплывают». Sheet-item намеренно
    // НЕ включён (bottom-sheet и так анимируется — исключаем риск застрять в opacity:0).
    var SEL = '.card,.stat,.plan,.svc,.chat-item,.prow,.post,.reel-card';

    var supportsIO = ('IntersectionObserver' in window);
    var io = null;
    if(supportsIO){
      io = new IntersectionObserver(function(entries){
        for(var i=0;i<entries.length;i++){
          var en = entries[i];
          if(en.isIntersecting){
            en.target.classList.add('wm-in');
            io.unobserve(en.target);
          }
        }
      }, { root:null, rootMargin:'0px 0px -6% 0px', threshold:0.08 });
    }

    // Пометить элемент для reveal (idempotent) + вычислить stagger-задержку.
    function wmTag(el){
      if(!el || el.__wm) return;
      el.__wm = 1;
      // Индекс среди уже помеченных прямых соседей → мягкий каскад (макс 6).
      var idx = 0, p = el.parentElement;
      if(p){
        try { idx = p.querySelectorAll(':scope > .wm-r').length; } catch(e){ idx = 0; }
      }
      if(idx > 6) idx = 6;
      el.style.setProperty('--wm-d', (idx * 45) + 'ms');
      el.classList.add('wm-r');
      if(io) io.observe(el);
      else el.classList.add('wm-in'); // деградация: просто показать
    }

    function wmScan(ctx){
      var nodes;
      try { nodes = (ctx || document).querySelectorAll(SEL); }
      catch(e){ return; }
      for(var i=0;i<nodes.length;i++) wmTag(nodes[i]);
    }

    // Ручной проход: показать уже-видимые (нужно, когда экран стал active —
    // IO иногда не триггерит на display:none→block без скролла).
    function wmRevealVisible(scope){
      var vh = window.innerHeight || 800;
      var nodes;
      try { nodes = (scope || document).querySelectorAll('.wm-r:not(.wm-in)'); }
      catch(e){ return; }
      for(var i=0;i<nodes.length;i++){
        var el = nodes[i];
        var r = el.getBoundingClientRect();
        if(r.bottom > 0 && r.top < vh * 0.96 && (r.width > 0 || r.height > 0)){
          el.classList.add('wm-in');
          if(io) io.unobserve(el);
        }
      }
    }

    // Дебаунс для реакции на мутации DOM (ре-рендеры ленты/чатов и т.п.).
    var scanTimer = 0;
    function wmScanSoon(){
      if(scanTimer) return;
      scanTimer = setTimeout(function(){
        scanTimer = 0;
        wmScan(document);
      }, 140);
    }

    // ========================================================================
    // COUNT-UP — крупные числовые статы «набегают» с 0 при первом появлении.
    // Строго один раз на элемент (IO + unobserve). rAF, ≤700 мс, easeOut.
    // БЕЗОПАСНО: в конце всегда возвращаем ТОЧНЫЙ исходный innerHTML — если
    // анимацию прервали или узел удалили, число НИКОГДА не останется частичным.
    // Живые/приложением-управляемые значения (id, data-*count, «0») пропускаем.
    // ========================================================================
    // Разбор форматированного числа: префикс(₽/$/+) + ядро(с пробелами/точкой) + суффикс(к/%/₽).
    function wmNumParse(raw){
      try{
        var s = ('' + raw).replace(/ /g, ' ').trim();
        if(!s) return null;
        var m = s.match(/^([^\d]*?)([+\-]?\d[\d .,]*\d|[+\-]?\d)(.*)$/);
        if(!m) return null;
        var prefix = m[1], core = m[2], suffix = m[3];
        if(/\d/.test(suffix)) return null;          // в суффиксе не должно быть цифр
        var sign = 1, c = core;
        if(c.charAt(0) === '+'){ c = c.slice(1); }
        else if(c.charAt(0) === '-'){ sign = -1; c = c.slice(1); }
        var dec = 0, decSep = '.';
        var dm = c.match(/([.,])(\d{1,2})$/);       // хвост вида .2 / ,5 = дробная часть
        if(dm){ decSep = dm[1]; dec = dm[2].length; }
        var digits = c.replace(/[ .,]/g, '');
        if(!/^\d+$/.test(digits)) return null;
        var intD = dec ? digits.slice(0, digits.length - dec) : digits;
        var decD = dec ? digits.slice(digits.length - dec) : '';
        var value = parseFloat((intD || '0') + (dec ? ('.' + decD) : '')) * sign;
        if(!isFinite(value)) return null;
        var thou = /\d \d/.test(core) ? ' ' : '';    // пробел-разделитель тысяч?
        return { prefix:prefix, suffix:suffix, value:value, dec:dec, decSep:decSep, thou:thou };
      }catch(e){ return null; }
    }
    // Собрать промежуточное значение обратно в тот же формат.
    function wmNumFmt(v, info){
      var neg = v < 0; v = Math.abs(v);
      var s = info.dec > 0 ? v.toFixed(info.dec) : String(Math.round(v));
      var p = s.split('.');
      var ip = p[0];
      if(info.thou) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, info.thou);
      var body = ip + (p[1] !== undefined ? info.decSep + p[1] : '');
      return info.prefix + (neg ? '-' : '') + body + info.suffix;
    }
    // Запустить счётчик для конкретного элемента (уже отфильтрован как числовой).
    function wmNumRun(el){
      try{
        if(!el || !el.isConnected) return;
        var info = wmNumParse(el.textContent);
        if(!info || !isFinite(info.value) || info.value === 0) return;
        var orig = el.innerHTML;                    // точный исходник для доводки
        var target = info.value;
        var dur = Math.min(700, 340 + String(Math.round(Math.abs(target))).length * 60);
        var t0 = 0;
        function settle(){
          try{
            if(!el.isConnected) return;
            // Не затираем, если содержимое сменил кто-то другой (ре-рендер/тикер).
            if(el.textContent === el.__wmLast) el.innerHTML = orig;
          }catch(e){}
        }
        function step(ts){
          try{
            if(!el.isConnected) return;             // узел удалён — тихо выходим
            if(!t0) t0 = ts;
            var pr = (ts - t0) / dur; if(pr > 1) pr = 1;
            var e = 1 - Math.pow(1 - pr, 3);        // easeOutCubic
            var txt = wmNumFmt(target * e, info);
            el.textContent = txt; el.__wmLast = txt;
            if(pr < 1) requestAnimationFrame(step);
            else settle();
          }catch(err){ settle(); }
        }
        requestAnimationFrame(step);
      }catch(e){}
    }

    // Селекторы «явно числовых» героев-статов (иконочные/live отсекаются гардом ниже).
    var SELNUM = '.pay-sum,.stat .v,.pstat .v,.ch-stat .v,.pw-live-cell .v,.adm-kpi b,.gm-prz-stat b';
    var ioNum = null;
    if(supportsIO){
      ioNum = new IntersectionObserver(function(entries){
        for(var i=0;i<entries.length;i++){
          var en = entries[i];
          if(en.isIntersecting){ ioNum.unobserve(en.target); wmNumRun(en.target); }
        }
      }, { root:null, rootMargin:'0px 0px -8% 0px', threshold:0.5 });
    }
    // Гард: только листовой текст, без id и без «счётных» data-* (их анимирует ядро).
    function wmNumEligible(el){
      try{
        if(!el || el.__wmn) return false;
        if(el.childElementCount !== 0) return false;   // есть вложенные теги — не трогаем
        if(el.id) return false;                        // id → живое значение приложения
        var a = el.attributes;
        for(var i=0;i<a.length;i++){
          var n = a[i].name;
          if(n === 'data-to' || n === 'data-sk' || n === 'data-mpcount' ||
             n === 'data-fn' || n === 'data-count' || n === 'data-anim') return false;
        }
        return !!wmNumParse(el.textContent);
      }catch(e){ return false; }
    }
    function wmNumTag(el){
      if(!wmNumEligible(el)) return;
      el.__wmn = 1;
      if(ioNum) ioNum.observe(el);                     // без IO — просто не анимируем (безопасно)
    }
    function wmNumScan(ctx){
      var nodes;
      try { nodes = (ctx || document).querySelectorAll(SELNUM); }
      catch(e){ return; }
      for(var i=0;i<nodes.length;i++) wmNumTag(nodes[i]);
    }
    // Троттлинг: одно сканирование document на «пачку» кликов (~180 мс), чтобы
    // поймать попапы/шиты/паволлы. Уже помеченное отсекается мгновенно (__wmn).
    var numScanTimer = 0;
    function wmNumScanSoon(){
      if(numScanTimer) return;
      numScanTimer = setTimeout(function(){ numScanTimer = 0; wmNumScan(document); }, 180);
    }

    // Смена таба: даём экрану активироваться, помечаем новое и раскрываем видимое.
    function wmOnTabSwitch(){
      setTimeout(function(){
        var active = document.querySelector('main .screen.active') ||
                     document.querySelector('.screen.active');
        wmScan(active || document);
        wmRevealVisible(active || document);
        wmNumScan(active || document);      // count-up на новых числах экрана
      }, 60);
    }

    function wmInit(){
      wmScan(document);
      // Раскрыть то, что видно на старте (активный экран).
      wmRevealVisible(document);
      wmNumScan(document);                  // count-up на числах стартового экрана

      // Реакция на нижнюю навигацию (переключение табов).
      var tabs = document.getElementById('tabs');
      if(tabs) tabs.addEventListener('click', wmOnTabSwitch, true);

      // Тайлы мини-аппов / любые переходы, меняющие active-экран.
      document.addEventListener('click', function(ev){
        var t = ev.target;
        if(t && t.closest && (t.closest('.svc') || t.closest('[data-tab]') || t.closest('nav#tabs'))){
          wmOnTabSwitch();
        }
        // Любой клик мог открыть попап/шит/паволл с новыми числами — дадим им
        // отрисоваться и один раз пометим (событийно + троттлинг, НЕ polling/MO).
        wmNumScanSoon();
      }, true);

      // Глобальный MutationObserver УБРАН — он вызывал лаги на каждом ре-рендере.
      // Reveal переинициализируется при смене таба (wmOnTabSwitch) — этого достаточно,
      // и контент теперь всегда видим (opacity:1), так что «прятать» нечего.

      // Подстраховка: после полной загрузки ещё раз раскрыть видимое.
      window.addEventListener('load', function(){ wmScan(document); wmRevealVisible(document); wmNumScan(document); }, { once:true });

      // ---- PERF-слой: пауза декоративных @keyframes во время скролла и в фоне ----
      // (главная борьба с «лагает при скролле» — освобождаем компоновщик).
      var scrollOff = 0;
      function onScroll(){
        if(!root.classList.contains('oko-scrolling')) root.classList.add('oko-scrolling');
        if(scrollOff) clearTimeout(scrollOff);
        scrollOff = setTimeout(function(){ scrollOff = 0; root.classList.remove('oko-scrolling'); }, 160);
      }
      // capture:true ловит скролл ЛЮБОГО внутреннего контейнера (main, .screen, списки).
      window.addEventListener('scroll', onScroll, { capture:true, passive:true });
      document.addEventListener('touchmove', onScroll, { capture:true, passive:true });

      document.addEventListener('visibilitychange', function(){
        if(document.hidden) root.classList.add('oko-hidden');
        else root.classList.remove('oko-hidden');
      });
    }

    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', wmInit, { once:true });
    } else {
      wmInit();
    }

  }catch(err){
    // Любой сбой моушен-слоя не должен ломать приложение и не должен прятать контент.
    try { document.documentElement.classList.remove('wm-on'); } catch(e){}
  }
})();

/* ==========================================================================
   wow-motion, слой 2: RIPPLE + SCROLL-SHADOW.
   Отдельная IIFE со своей защитой (reduced-motion гасит только визуал через CSS,
   а JS всё равно не мешает работать интерфейсу). Ничего в ядре не переопределяем,
   только слушаем события и добавляем классы/дочерние спаны.
   ========================================================================== */
(function(){
  'use strict';
  try{
    var doc = document;
    if(!doc || !doc.documentElement) return;

    var mqReduce2 = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduced = !!(mqReduce2 && mqReduce2.matches);

    // ----------------------------------------------------------------------
    // RIPPLE, лаймовая волна из точки клика на кнопках/чипах/тайлах/табах/строках.
    // При reduced-motion не добавляем спан вовсе (экономим DOM).
    // ----------------------------------------------------------------------
    var RIP_SEL = '.btn, .chip, .svc-ic, .sheet-item, .prow, nav#tabs>button, nav#tabs button';
    function wmMakeRipple(ev){
      try{
        if(reduced) return;
        var t = ev.target;
        if(!t || !t.closest) return;
        var host = t.closest(RIP_SEL);
        if(!host) return;
        // не плодим одновременных волн
        if(host.__wmRipTs && (Date.now() - host.__wmRipTs) < 80) return;
        host.__wmRipTs = Date.now();

        var rect = host.getBoundingClientRect();
        var px = (typeof ev.clientX === 'number') ? ev.clientX
              : (ev.touches && ev.touches[0] ? ev.touches[0].clientX : rect.left + rect.width/2);
        var py = (typeof ev.clientY === 'number') ? ev.clientY
              : (ev.touches && ev.touches[0] ? ev.touches[0].clientY : rect.top + rect.height/2);
        var x = px - rect.left;
        var y = py - rect.top;
        // масштаб волны подгоняем под самый дальний угол
        var maxDim = Math.max(rect.width, rect.height);
        var scale = Math.max(18, Math.min(42, Math.ceil(maxDim / 8)));

        var r = doc.createElement('span');
        r.className = 'wm-ripple';
        r.style.left = x + 'px';
        r.style.top  = y + 'px';
        r.style.setProperty('--wm-rip-max', scale);
        // не ломаем клики по внутренним элементам
        host.appendChild(r);
        setTimeout(function(){
          try{ if(r && r.parentNode) r.parentNode.removeChild(r); }catch(e){}
        }, 640);
      }catch(e){}
    }
    // pointerdown ловит и мышь и тач, ДО клика (волна успевает стартовать)
    doc.addEventListener('pointerdown', wmMakeRipple, { capture:true, passive:true });

    // ----------------------------------------------------------------------
    // SCROLL-SHADOW, тень под шапкой когда контент под ней прокручивается.
    // Основной скроллер приложения, <main>. Плюс sticky-поиск .st2-search
    // внутри своих скроллеров получает такую же подсветку.
    // ----------------------------------------------------------------------
    function wmApplyMainShadow(){
      try{
        var m = doc.querySelector('main');
        if(!m) return;
        if(m.scrollTop > 6) m.classList.add('wm-scrolled');
        else m.classList.remove('wm-scrolled');
      }catch(e){}
    }
    function wmApplyStickyShadow(scope){
      try{
        var stickies = (scope || doc).querySelectorAll('.st2-search');
        for(var i=0;i<stickies.length;i++){
          var s = stickies[i];
          // sticky сидит внутри своего скроллера, находим ближайший scroller
          var p = s.parentElement, hit = null;
          while(p){
            var ov = getComputedStyle(p).overflowY;
            if(ov === 'auto' || ov === 'scroll'){ hit = p; break; }
            p = p.parentElement;
          }
          if(!hit) continue;
          if(hit.scrollTop > 6) s.classList.add('wm-scrolled');
          else s.classList.remove('wm-scrolled');
        }
      }catch(e){}
    }
    function wmOnAnyScroll(ev){
      // main-скролл ставим по любому событию скролла (capture ловит и внутренние)
      wmApplyMainShadow();
      var tgt = ev && ev.target;
      if(tgt && tgt.querySelectorAll) wmApplyStickyShadow(tgt);
      else wmApplyStickyShadow(doc);
    }
    // capture:true ловит скролл main и любых внутренних контейнеров
    window.addEventListener('scroll', wmOnAnyScroll, { capture:true, passive:true });

    // Первичный прогон + после смены таба (нужен для нового активного экрана)
    function wmShadowInit(){
      wmApplyMainShadow();
      wmApplyStickyShadow(doc);
    }
    if(doc.readyState === 'loading'){
      doc.addEventListener('DOMContentLoaded', wmShadowInit, { once:true });
    } else {
      wmShadowInit();
    }
    // Клик по табам может сбросить скролл нового экрана, обновим индикатор
    var tabsEl = doc.getElementById('tabs');
    if(tabsEl){
      tabsEl.addEventListener('click', function(){
        setTimeout(wmShadowInit, 80);
      }, true);
    }

  }catch(err){ /* тихо, не ломаем приложение */ }
})();

/* ==========================================================================
   wow-motion, слой 3 — кинематографические микро-анимации уровня Apple/Instagram.
   • Splash-shot (SVG-глаз + halo) при первой загрузке приложения
   • Tab-switch — направленный slide-in нового экрана + слайд-fade клона старого
   • Long-press ripple — большая лаймовая волна на удержании .btn
   • okoWow.showCheck(text) — оверлей с рисующейся галочкой + backdrop-blur
   • okoWow.shake(el) — тряска ошибки
   • okoWow.confetti(x,y) — 40 лаймовых квадратов с физикой падения
   • Skeleton .wow-skel — CSS-класс (в style.css)
   • Number count-up на .wow-count[data-to]
   • Page-parallax на .wow-parallax
   • Haptic-hint scale(.97→1) на .btn/.svc/.chip
   Публичный API: window.okoWow.{showCheck,shake,confetti,ripple,init,pop}.
   ========================================================================== */
(function(){
  'use strict';
  try{
    if(typeof document==='undefined'||typeof window==='undefined') return;
    var doc=document, root=doc.documentElement, win=window;
    if(!root) return;

    var mqR = win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)');
    var REDUCED = !!(mqR && mqR.matches);

    var LIME = '#9AFF00';

    // Уже собранный API — не даём случайно перетереть.
    var api = win.okoWow = win.okoWow || {};

    // ------------------------------------------------------------------
    // 1) SPLASH-SHOT
    // ------------------------------------------------------------------
    function buildSplash(){
      if(REDUCED) return null;
      if(doc.getElementById('wm-splash')) return doc.getElementById('wm-splash');
      var el = doc.createElement('div');
      el.id = 'wm-splash';
      el.setAttribute('aria-hidden','true');
      el.innerHTML =
        '<div id="wm-splash-halo"></div>'+
        '<svg id="wm-splash-eye" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">'+
          '<defs>'+
            '<clipPath id="wm-eye-clip"><ellipse cx="100" cy="50" rx="90" ry="45"/></clipPath>'+
          '</defs>'+
          '<g clip-path="url(#wm-eye-clip)">'+
            '<circle class="wm-splash-iris" cx="100" cy="50" r="26" fill="'+LIME+'"/>'+
            '<circle cx="100" cy="50" r="10" fill="#0d0d0d"/>'+
            '<circle cx="108" cy="42" r="4" fill="#fff" opacity="0.85"/>'+
          '</g>'+
          '<ellipse cx="100" cy="50" rx="90" ry="45" fill="none" stroke="'+LIME+'" stroke-width="3"/>'+
          '<rect class="wm-splash-lid wm-splash-lid-top" x="-10" y="-2" width="220" height="52" fill="#000"/>'+
          '<rect class="wm-splash-lid wm-splash-lid-bot" x="-10" y="50" width="220" height="52" fill="#000"/>'+
        '</svg>'+
        '<div class="wm-splash-word">OKO</div>';
      (doc.body || doc.documentElement).appendChild(el);
      return el;
    }
    function dismissSplash(){
      var el = doc.getElementById('wm-splash');
      if(!el) return;
      el.classList.add('wm-gone');
      setTimeout(function(){
        try{ if(el.parentNode) el.parentNode.removeChild(el); }catch(e){}
      }, 520);
    }
    // Собираем и снимаем сплэш через oko:app-ready
    function initSplash(){
      if(REDUCED) return;
      // Вставить как можно раньше — до paint основного контента
      if(doc.body) buildSplash();
      else doc.addEventListener('DOMContentLoaded', buildSplash, { once:true });

      var dismissed = false;
      function once(){ if(dismissed) return; dismissed = true; dismissSplash(); }
      win.addEventListener('oko:app-ready', once, { once:true });

      // Автоматический emit через 400 мс после DOMContentLoaded
      function armAutoReady(){
        setTimeout(function(){
          try{ win.dispatchEvent(new Event('oko:app-ready')); }
          catch(e){
            // Старые движки без Event()
            var evt = doc.createEvent('Event'); evt.initEvent('oko:app-ready', false, false);
            win.dispatchEvent(evt);
          }
        }, 400);
      }
      if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', armAutoReady, { once:true });
      else armAutoReady();

      // Аварийный сброс, чтобы никогда не залипнуть больше 2.5с
      setTimeout(once, 2500);
    }

    // ------------------------------------------------------------------
    // 2) TAB-SWITCH — направленный slide-in + клон-оверлей уходящего экрана.
    // ------------------------------------------------------------------
    var _lastTabIdx = -1;
    var _pendingDir = 'right';   // куда двигать входящий экран
    var _tabsOrder = [];

    function refreshTabsOrder(){
      var tabs = doc.querySelectorAll('nav#tabs>button');
      _tabsOrder = [];
      for(var i=0;i<tabs.length;i++){
        var b = tabs[i];
        var t = b.getAttribute('data-tab') || b.getAttribute('data-screen') || b.id || ('t'+i);
        _tabsOrder.push({ el:b, key:t });
      }
    }
    function idxOfTab(btn){
      for(var i=0;i<_tabsOrder.length;i++) if(_tabsOrder[i].el === btn) return i;
      return -1;
    }
    function snapshotActiveScreen(){
      if(REDUCED) return;
      var main = doc.querySelector('main');
      if(!main) return;
      var active = main.querySelector('.screen.active');
      if(!active) return;
      // Пропускаем гигантские экраны — cloneNode будет дорогим
      var count = active.querySelectorAll('*').length;
      if(count > 350) return;

      var mr = main.getBoundingClientRect();
      var overlay = doc.createElement('div');
      overlay.className = 'wm-tab-overlay';
      overlay.style.left   = mr.left + 'px';
      overlay.style.top    = mr.top  + 'px';
      overlay.style.width  = mr.width + 'px';
      overlay.style.height = mr.height + 'px';

      var clone;
      try{ clone = active.cloneNode(true); }catch(e){ return; }
      // Не хотим двойных обработчиков/id-конфликтов
      try{
        var ids = clone.querySelectorAll('[id]');
        for(var i=0;i<ids.length;i++) ids[i].removeAttribute('id');
        if(clone.id) clone.removeAttribute('id');
      }catch(e){}
      clone.classList.remove('active','wm-tab-in-right','wm-tab-in-left');
      clone.style.display = 'block';
      // Компенсация скролла main — чтобы клон встал ровно там же
      clone.style.transform = 'translate3d(0,'+(-main.scrollTop)+'px,0)';
      overlay.appendChild(clone);
      doc.body.appendChild(overlay);

      var dx = (_pendingDir === 'right') ? -8 : 8;
      try{
        overlay.animate([
          { opacity:1, transform:'translate3d(0,0,0)' },
          { opacity:0, transform:'translate3d('+dx+'%,0,0)' }
        ], { duration:150, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards' });
      }catch(e){
        overlay.style.transition = 'opacity .15s ease, transform .15s ease';
        overlay.style.opacity = '0';
        overlay.style.transform = 'translate3d('+dx+'%,0,0)';
      }
      setTimeout(function(){
        try{ if(overlay.parentNode) overlay.parentNode.removeChild(overlay); }catch(e){}
      }, 200);
    }

    function initTabSwitch(){
      refreshTabsOrder();
      var tabs = doc.getElementById('tabs');

      // Перехватываем клик по табу capture:true — до того как ядро сменит .active.
      // На основе индекса определяем direction для входящего экрана.
      if(tabs){
        tabs.addEventListener('pointerdown', function(ev){
          try{
            var t = ev.target && ev.target.closest && ev.target.closest('button');
            if(!t) return;
            if(!_tabsOrder.length) refreshTabsOrder();
            var newIdx = idxOfTab(t);
            if(newIdx < 0) return;
            if(_lastTabIdx < 0){
              // первый переход — узнаём текущий активный
              var active = tabs.querySelector('button.active');
              _lastTabIdx = idxOfTab(active);
            }
            _pendingDir = (newIdx >= _lastTabIdx) ? 'right' : 'left';
            snapshotActiveScreen();
          }catch(e){}
        }, true);

        tabs.addEventListener('click', function(ev){
          try{
            var t = ev.target && ev.target.closest && ev.target.closest('button');
            if(!t) return;
            var idx = idxOfTab(t);
            if(idx >= 0) _lastTabIdx = idx;
          }catch(e){}
        }, true);
      }

      // MutationObserver на main для отслеживания смены .screen.active — маркируем
      // новый активный экран правильным классом slide-in.
      var main = doc.querySelector('main');
      if(!main || REDUCED) return;
      var mo = new MutationObserver(function(muts){
        for(var i=0;i<muts.length;i++){
          var m = muts[i];
          if(m.type !== 'attributes' || m.attributeName !== 'class') continue;
          var el = m.target;
          if(!el || !el.classList || !el.classList.contains('screen')) continue;
          if(!el.classList.contains('active')) continue;
          // Не дублировать пока анимация идёт
          if(el.classList.contains('wm-tab-in-right') || el.classList.contains('wm-tab-in-left')) continue;
          var cls = (_pendingDir === 'right') ? 'wm-tab-in-right' : 'wm-tab-in-left';
          el.classList.add(cls);
          (function(node, klass){
            var clear = function(){
              try{ node.classList.remove(klass); }catch(e){}
              try{ node.removeEventListener('animationend', clear); }catch(e){}
            };
            node.addEventListener('animationend', clear);
            setTimeout(clear, 380);
          })(el, cls);
        }
      });
      try{
        mo.observe(main, { subtree:true, attributes:true, attributeFilter:['class'] });
      }catch(e){}
    }

    // ------------------------------------------------------------------
    // 3) LONG-PRESS RIPPLE — большая волна при удержании .btn
    // ------------------------------------------------------------------
    var LP_SEL = '.btn';
    var LP_HOLD_MS = 320;

    function initLongPress(){
      if(REDUCED) return;
      var lpTimer = 0, lpHost = null, lpX = 0, lpY = 0;
      function cancel(){
        if(lpTimer){ clearTimeout(lpTimer); lpTimer = 0; }
        lpHost = null;
      }
      doc.addEventListener('pointerdown', function(ev){
        try{
          var t = ev.target;
          if(!t || !t.closest) return;
          var host = t.closest(LP_SEL);
          if(!host) return;
          lpHost = host;
          var rect = host.getBoundingClientRect();
          var px = (typeof ev.clientX === 'number') ? ev.clientX : rect.left + rect.width/2;
          var py = (typeof ev.clientY === 'number') ? ev.clientY : rect.top + rect.height/2;
          lpX = px - rect.left;
          lpY = py - rect.top;
          if(lpTimer) clearTimeout(lpTimer);
          lpTimer = setTimeout(function(){
            try{
              if(!lpHost || !lpHost.isConnected) return;
              var r = doc.createElement('span');
              r.className = 'wm-lpress';
              r.style.left = lpX + 'px';
              r.style.top  = lpY + 'px';
              lpHost.appendChild(r);
              setTimeout(function(){ try{ if(r.parentNode) r.parentNode.removeChild(r); }catch(e){} }, 780);
            }catch(e){}
            lpTimer = 0;
          }, LP_HOLD_MS);
        }catch(e){}
      }, { capture:true, passive:true });
      doc.addEventListener('pointerup',     cancel, { capture:true, passive:true });
      doc.addEventListener('pointercancel', cancel, { capture:true, passive:true });
      doc.addEventListener('pointerleave',  cancel, { capture:true, passive:true });
      // Скролл убивает намерение удержания
      win.addEventListener('scroll', cancel, { capture:true, passive:true });
    }

    // ------------------------------------------------------------------
    // 4) okoWow.showCheck(text)
    // ------------------------------------------------------------------
    api.showCheck = function(text){
      try{
        // Убрать предыдущий, если ещё жив
        var prev = doc.getElementById('wm-check');
        if(prev && prev.parentNode) prev.parentNode.removeChild(prev);

        var el = doc.createElement('div');
        el.id = 'wm-check';
        el.setAttribute('role','status');
        el.setAttribute('aria-live','polite');
        var label = (typeof text === 'string' && text) ? text : 'Готово';
        el.innerHTML =
          '<div class="wm-check-box">'+
            '<svg class="wm-check-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'+
              '<circle class="wm-check-circle" cx="50" cy="50" r="40"/>'+
              '<path class="wm-check-tick" d="M28 52 L44 68 L74 36"/>'+
            '</svg>'+
            '<div class="wm-check-text"></div>'+
          '</div>';
        var textNode = el.querySelector('.wm-check-text');
        if(textNode) textNode.textContent = label;
        doc.body.appendChild(el);
        // force reflow → плавный fade-in
        void el.offsetWidth;
        el.classList.add('wm-show');

        setTimeout(function(){
          try{ el.classList.remove('wm-show'); }catch(e){}
          setTimeout(function(){ try{ if(el.parentNode) el.parentNode.removeChild(el); }catch(e){} }, 240);
        }, 1200);
        return el;
      }catch(e){ return null; }
    };

    // ------------------------------------------------------------------
    // 5) okoWow.shake(el) — тряска ошибки
    // ------------------------------------------------------------------
    api.shake = function(el){
      try{
        if(!el || !el.classList) return;
        el.classList.remove('wm-shake');
        // reflow чтобы анимация перезапустилась при повторном вызове
        void el.offsetWidth;
        el.classList.add('wm-shake');
        var clear = function(){
          try{ el.classList.remove('wm-shake'); }catch(e){}
          try{ el.removeEventListener('animationend', clear); }catch(e){}
        };
        el.addEventListener('animationend', clear);
        setTimeout(clear, 320);
      }catch(e){}
    };

    // ------------------------------------------------------------------
    // 6) okoWow.confetti(x, y) — 40 лаймовых квадратов из точки клика
    // ------------------------------------------------------------------
    var _confCanvas = null, _confCtx = null, _confParts = [], _confRAF = 0;

    function ensureConfCanvas(){
      if(_confCanvas && _confCanvas.isConnected) return _confCanvas;
      _confCanvas = doc.createElement('canvas');
      _confCanvas.id = 'wm-confetti-canvas';
      doc.body.appendChild(_confCanvas);
      resizeConfCanvas();
      _confCtx = _confCanvas.getContext('2d');
      return _confCanvas;
    }
    function resizeConfCanvas(){
      if(!_confCanvas) return;
      var dpr = Math.min(win.devicePixelRatio || 1, 2);
      var w = win.innerWidth, h = win.innerHeight;
      _confCanvas.width  = Math.round(w * dpr);
      _confCanvas.height = Math.round(h * dpr);
      _confCanvas.style.width  = w + 'px';
      _confCanvas.style.height = h + 'px';
      if(_confCtx) _confCtx.setTransform(dpr,0,0,dpr,0,0);
    }
    win.addEventListener('resize', resizeConfCanvas, { passive:true });

    function confStep(){
      if(!_confCtx || !_confCanvas){ _confRAF = 0; return; }
      _confCtx.clearRect(0, 0, _confCanvas.width, _confCanvas.height);
      var alive = 0;
      var dt = 1;  // условная единица; физика упрощённая
      for(var i=0;i<_confParts.length;i++){
        var p = _confParts[i];
        if(p.life <= 0) continue;
        alive++;
        p.vy += 0.45 * dt;     // гравитация
        p.vx *= 0.995;         // сопротивление
        p.x  += p.vx;
        p.y  += p.vy;
        p.rot += p.vrot;
        p.life -= dt;
        var a = Math.max(0, Math.min(1, p.life / p.lifeMax));
        _confCtx.save();
        _confCtx.translate(p.x, p.y);
        _confCtx.rotate(p.rot);
        _confCtx.globalAlpha = a;
        _confCtx.fillStyle = p.color;
        _confCtx.fillRect(-p.size/2, -p.size/2, p.size, p.size * (0.35 + 0.65 * Math.abs(Math.sin(p.rot))));
        _confCtx.restore();
      }
      if(alive > 0){
        _confRAF = requestAnimationFrame(confStep);
      }else{
        _confRAF = 0;
        try{
          if(_confCanvas && _confCanvas.parentNode) _confCanvas.parentNode.removeChild(_confCanvas);
        }catch(e){}
        _confCanvas = null; _confCtx = null; _confParts = [];
      }
    }

    api.confetti = function(x, y, opts){
      try{
        if(REDUCED) return;
        opts = opts || {};
        var count = opts.count || 40;
        var cx = (typeof x === 'number') ? x : win.innerWidth / 2;
        var cy = (typeof y === 'number') ? y : win.innerHeight / 2;
        ensureConfCanvas();
        // Палитра — лайм с лёгкими вариациями (яркий/тёмный/белый акцент)
        var palette = [LIME, '#B8FF3D', '#7ACC00', '#DFFF9A', '#FFFFFF'];
        for(var i=0;i<count;i++){
          var ang = -Math.PI/2 + (Math.random() - 0.5) * Math.PI * 1.2; // веерный выхлоп вверх
          var speed = 6 + Math.random() * 10;
          _confParts.push({
            x: cx, y: cy,
            vx: Math.cos(ang) * speed + (Math.random()-0.5) * 2,
            vy: Math.sin(ang) * speed,
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 0.4,
            size: 6 + Math.random() * 6,
            color: palette[(Math.random() * palette.length) | 0],
            life: 72 + Math.random() * 30,       // ~1.2s @ 60fps
            lifeMax: 100
          });
        }
        if(!_confRAF) _confRAF = requestAnimationFrame(confStep);
      }catch(e){}
    };

    // ------------------------------------------------------------------
    // 7) okoWow.ripple(x, y, el) — программный ripple (короткая волна)
    // ------------------------------------------------------------------
    api.ripple = function(x, y, host){
      try{
        if(REDUCED) return;
        if(!host) return;
        var rect = host.getBoundingClientRect();
        var lx = (typeof x === 'number' ? x : rect.left + rect.width/2) - rect.left;
        var ly = (typeof y === 'number' ? y : rect.top  + rect.height/2) - rect.top;
        // Гарантируем контекст стакинга/оверфлоу как у других ripple-хостов
        var cs = getComputedStyle(host);
        if(cs.position === 'static') host.style.position = 'relative';
        if(cs.overflow === 'visible') host.style.overflow = 'hidden';
        var r = doc.createElement('span');
        r.className = 'wm-ripple';
        r.style.left = lx + 'px';
        r.style.top  = ly + 'px';
        host.appendChild(r);
        setTimeout(function(){ try{ if(r.parentNode) r.parentNode.removeChild(r); }catch(e){} }, 640);
      }catch(e){}
    };

    // ------------------------------------------------------------------
    // 8) NUMBER COUNT-UP — .wow-count[data-to="1234"]
    // ------------------------------------------------------------------
    var _wcIO = null;
    function fmtNum(n, dec, thousand){
      var neg = n < 0; n = Math.abs(n);
      var s = (dec > 0) ? n.toFixed(dec) : String(Math.round(n));
      var parts = s.split('.');
      var ip = parts[0];
      if(thousand) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, thousand);
      return (neg ? '-' : '') + ip + (parts[1] !== undefined ? '.' + parts[1] : '');
    }
    function runCount(el){
      try{
        if(!el || !el.isConnected || el.__wcDone) return;
        el.__wcDone = 1;
        var raw = el.getAttribute('data-to');
        if(raw == null) return;
        var target = parseFloat(String(raw).replace(/[ ,]/g,''));
        if(!isFinite(target)) return;
        var dec = 0;
        var m = String(raw).match(/[.,](\d+)$/);
        if(m) dec = m[1].length;
        var thou = el.getAttribute('data-thousand');
        if(thou == null) thou = (/\d,\d/.test(raw)) ? ',' : (/\d \d/.test(raw)) ? ' ' : '';
        var prefix = el.getAttribute('data-prefix') || '';
        var suffix = el.getAttribute('data-suffix') || '';
        var dur = parseInt(el.getAttribute('data-dur'), 10) || 1500;
        var t0 = 0;
        function step(ts){
          try{
            if(!el.isConnected) return;
            if(!t0) t0 = ts;
            var pr = (ts - t0) / dur; if(pr > 1) pr = 1;
            var e = 1 - Math.pow(1 - pr, 3);  // easeOutCubic
            el.textContent = prefix + fmtNum(target * e, dec, thou) + suffix;
            if(pr < 1) requestAnimationFrame(step);
            else el.textContent = prefix + fmtNum(target, dec, thou) + suffix;
          }catch(e){}
        }
        requestAnimationFrame(step);
      }catch(e){}
    }
    function scanWowCount(scope){
      try{
        if(!('IntersectionObserver' in win)) return;
        if(!_wcIO){
          _wcIO = new IntersectionObserver(function(entries){
            for(var i=0;i<entries.length;i++){
              var en = entries[i];
              if(en.isIntersecting){ _wcIO.unobserve(en.target); runCount(en.target); }
            }
          }, { root:null, rootMargin:'0px 0px -8% 0px', threshold:0.3 });
        }
        var nodes = (scope || doc).querySelectorAll('.wow-count[data-to]');
        for(var i=0;i<nodes.length;i++){
          var el = nodes[i];
          if(el.__wcTagged) continue;
          el.__wcTagged = 1;
          // Начальное «0» — чтобы не мелькать финальным значением
          try{
            var prefix = el.getAttribute('data-prefix') || '';
            var suffix = el.getAttribute('data-suffix') || '';
            var dec = 0;
            var raw = el.getAttribute('data-to') || '';
            var mm = String(raw).match(/[.,](\d+)$/);
            if(mm) dec = mm[1].length;
            if(!el.textContent || el.textContent.trim() === '' || el.textContent.trim() === '0'){
              el.textContent = prefix + (dec ? (0).toFixed(dec) : '0') + suffix;
            }
          }catch(e){}
          _wcIO.observe(el);
        }
      }catch(e){}
    }

    // ------------------------------------------------------------------
    // 9) PAGE PARALLAX — .wow-parallax на main.scroll
    // ------------------------------------------------------------------
    function initParallax(){
      if(REDUCED) return;
      var main = doc.querySelector('main');
      if(!main) return;
      var els = [];
      function rescan(){
        try{ els = Array.prototype.slice.call(doc.querySelectorAll('.wow-parallax')); }catch(e){ els = []; }
      }
      rescan();
      var rafPending = false, lastTop = 0;
      function onScroll(){
        if(rafPending) return;
        rafPending = true;
        requestAnimationFrame(function(){
          rafPending = false;
          var top = main.scrollTop;
          if(top === lastTop) return;
          lastTop = top;
          for(var i=0;i<els.length;i++){
            var el = els[i];
            if(!el.isConnected) continue;
            var speed = parseFloat(el.getAttribute('data-speed'));
            if(!isFinite(speed)) speed = 0.35;
            // Отрицательный знак — фон уезжает медленнее, эффект глубины
            var y = -(top * speed);
            el.style.setProperty('--wm-par-y', y.toFixed(2) + 'px');
          }
        });
      }
      main.addEventListener('scroll', onScroll, { passive:true });
      // Смена таба — пересканировать
      var tabs = doc.getElementById('tabs');
      if(tabs) tabs.addEventListener('click', function(){ setTimeout(rescan, 120); }, true);
    }

    // ------------------------------------------------------------------
    // 10) HAPTIC-HINT — короткий scale(.97→1) на .btn/.svc/.chip
    // ------------------------------------------------------------------
    var HP_SEL = '.btn, .svc, .chip';
    function initHaptic(){
      if(REDUCED) return;
      api.pop = function(el){
        try{
          if(!el || !el.classList) return;
          el.classList.remove('wm-pop');
          void el.offsetWidth;
          el.classList.add('wm-pop');
          var clear = function(){
            try{ el.classList.remove('wm-pop'); }catch(e){}
            try{ el.removeEventListener('animationend', clear); }catch(e){}
          };
          el.addEventListener('animationend', clear);
          setTimeout(clear, 140);
        }catch(e){}
      };
      doc.addEventListener('pointerdown', function(ev){
        try{
          var t = ev.target;
          if(!t || !t.closest) return;
          var host = t.closest(HP_SEL);
          if(!host) return;
          api.pop(host);
        }catch(e){}
      }, { capture:true, passive:true });
    }

    // ------------------------------------------------------------------
    // INIT — идемпотентный, вызывается один раз
    // ------------------------------------------------------------------
    var _inited = false;
    api.init = function(){
      if(_inited) return;
      _inited = true;
      initSplash();
      var ready = function(){
        try{ initTabSwitch(); }catch(e){}
        try{ initLongPress(); }catch(e){}
        try{ initParallax(); }catch(e){}
        try{ initHaptic(); }catch(e){}
        try{ scanWowCount(doc); }catch(e){}
      };
      if(doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', ready, { once:true });
      else ready();

      // Пере-сканирование чисел при смене таба (появляются новые .wow-count)
      var tabs = doc.getElementById('tabs');
      if(tabs) tabs.addEventListener('click', function(){ setTimeout(function(){ scanWowCount(doc); }, 120); }, true);

      // Публичный хук для повторного скана — если приложение динамически подгрузило блоки
      api.rescan = function(){ try{ scanWowCount(doc); }catch(e){} };
    };

    // Автостарт
    api.init();

  }catch(err){ /* тихо, ничего не ломаем */ }
})();
