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
