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

    // Смена таба: даём экрану активироваться, помечаем новое и раскрываем видимое.
    function wmOnTabSwitch(){
      setTimeout(function(){
        var active = document.querySelector('main .screen.active') ||
                     document.querySelector('.screen.active');
        wmScan(active || document);
        wmRevealVisible(active || document);
      }, 60);
    }

    function wmInit(){
      wmScan(document);
      // Раскрыть то, что видно на старте (активный экран).
      wmRevealVisible(document);

      // Реакция на нижнюю навигацию (переключение табов).
      var tabs = document.getElementById('tabs');
      if(tabs) tabs.addEventListener('click', wmOnTabSwitch, true);

      // Тайлы мини-аппов / любые переходы, меняющие active-экран.
      document.addEventListener('click', function(ev){
        var t = ev.target;
        if(t && t.closest && (t.closest('.svc') || t.closest('[data-tab]') || t.closest('nav#tabs'))){
          wmOnTabSwitch();
        }
      }, true);

      // Глобальный MutationObserver УБРАН — он вызывал лаги на каждом ре-рендере.
      // Reveal переинициализируется при смене таба (wmOnTabSwitch) — этого достаточно,
      // и контент теперь всегда видим (opacity:1), так что «прятать» нечего.

      // Подстраховка: после полной загрузки ещё раз раскрыть видимое.
      window.addEventListener('load', function(){ wmScan(document); wmRevealVisible(document); }, { once:true });

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
