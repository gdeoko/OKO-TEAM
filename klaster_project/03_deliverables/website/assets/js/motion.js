/* ===== Кластер — motion.js =====
   Моушен-слой поверх готовой вёрстки. Разметку в index.html не трогает:
   нужные классы и узлы расставляет сам. Всё выключается, если человек
   попросил систему убрать анимации (prefers-reduced-motion). */
(function(){
  'use strict';

  var CALM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf  = window.requestAnimationFrame || function(f){return setTimeout(f,16)};
  var $    = function(s,r){return (r||document).querySelector(s)};
  var $$   = function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};

  /* ---------- общий наблюдатель появления ---------- */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      e.target.classList.add('mo-on');
      if(e.target.hasAttribute('data-count')) count(e.target);
      io.unobserve(e.target);
    });
  },{threshold:.16, rootMargin:'0px 0px -8% 0px'}) : null;

  function watch(el){ if(io) io.observe(el); else el.classList.add('mo-on'); }

  /* ================= 1. полоса прокрутки ================= */
  function progress(){
    var bar = document.createElement('div');
    bar.className = 'mo-progress';
    document.body.appendChild(bar);
    var ticking = false;
    function upd(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      ticking = false;
    }
    window.addEventListener('scroll',function(){ if(!ticking){ ticking = true; raf(upd); } },{passive:true});
    upd();
  }

  /* ================= 2. шапка ================= */
  function header(){
    var hd = $('.hd'); if(!hd) return;
    var ticking = false;
    function upd(){ hd.classList.toggle('mo-stuck', window.scrollY > 40); ticking = false; }
    window.addEventListener('scroll',function(){ if(!ticking){ ticking = true; raf(upd); } },{passive:true});
    upd();
  }

  /* ================= 3. что появляется ================= */
  function reveals(){
    // крупные блоки внутри разделов
    var groups = [
      ['.hero-grid > div > *', ''],
      ['section .eyebrow, section > .wrap > h2, section > .wrap > .lead', ''],
      ['.why-card, .spec, .infra-card, .ind-card, .res-card, .faq-item, .lot, .tr-card, .card, .gal-i, .res, .route', ''],
      ['.hero-soc', '']
    ];
    groups.forEach(function(g){
      $$(g[0]).forEach(function(el){
        if(el.closest('.mo-ticker')) return;
        if(el.classList.contains('mo-r')) return;
        el.classList.add('mo-r');
        if(g[1]) el.classList.add(g[1]);
        watch(el);
      });
    });

    // ступенчатая задержка внутри каждой сетки
    $$('section').forEach(function(sec){
      var kids = $$('.mo-r', sec).filter(function(el){ return el.parentElement === sec || (el.parentElement && el.parentElement.parentElement === sec) || true; });
      var byParent = {};
      kids.forEach(function(el){
        var key = el.parentElement ? (el.parentElement.className || 'x') : 'x';
        byParent[key] = byParent[key] || [];
        byParent[key].push(el);
      });
      Object.keys(byParent).forEach(function(k){
        byParent[k].forEach(function(el,i){ el.style.setProperty('--i', Math.min(i,7)); });
      });
    });

    // заголовки: маска + золотая черта
    $$('section h2').forEach(function(h){
      if(h.querySelector('.mo-hi')) return;
      var inner = document.createElement('span');
      inner.className = 'mo-hi';
      while(h.firstChild) inner.appendChild(h.firstChild);
      h.appendChild(inner);
      h.classList.add('mo-h','mo-rule');
      watch(h);
    });

    // картинки: шторка и блик
    $$('.lot-img, .why-shot, .tr-shot, .infra-shots figure, .infra-card figure, .res-card figure, .ind-card figure, .why-card figure, .media, .pic').forEach(function(f){
      if(!f.querySelector('img')) return;
      f.classList.add('mo-img');
      watch(f);
    });
  }

  /* ================= 4. счётчики ================= */
  function markNumbers(){
    // ищем крупные числа в блоках статистики и вешаем data-count
    $$('.stat b, .stat strong, .stat-n, .num, .kpi b, .spec b').forEach(prep);
    // подстраховка: любые узлы, где текст это только число с пробелами и знаком
    $$('section .wrap b, section .wrap strong').forEach(function(el){
      if(el.children.length) return;
      if(/^[\d\s ]{2,}[+]?$/.test(el.textContent.trim())) prep(el);
    });
    function prep(el){
      if(el.hasAttribute('data-count')) return;
      var raw = el.textContent.trim();
      // диапазоны вида «6-12 м» не крутим, там нечего считать
      if(/\d\s*[-\u2013\u2014]\s*\d/.test(raw)) return;
      // первое число целиком, вместе с разрядными пробелами: «50 000», «1000», «6»
      var m = raw.match(/\d[\d\u00a0\u2009 ]*\d|\d/);
      if(!m) return;
      var token = m[0];
      var target = parseInt(token.replace(/[\s\u00a0\u2009]/g,''), 10);
      if(!isFinite(target) || target < 4) return;
      var pre  = raw.slice(0, m.index);
      var post = raw.slice(m.index + token.length);
      el.setAttribute('data-count', String(target));
      el.setAttribute('data-pre', pre);
      el.setAttribute('data-post', post);
      el.classList.add('mo-num');
      if(!CALM) el.textContent = pre + '0' + post;
      watch(el);
    }
  }

  function count(el){
    if(CALM) return;
    var target = parseInt(el.getAttribute('data-count'),10);
    var pre = el.getAttribute('data-pre') || '', post = el.getAttribute('data-post') || '';
    var dur = 1250, t0 = null;
    function fmt(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function step(ts){
      if(t0 === null) t0 = ts;
      var p = Math.min(1,(ts - t0)/dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = pre + fmt(Math.round(target * eased)) + post;
      if(p < 1) raf(step); else el.textContent = pre + fmt(target) + post;
    }
    raf(step);
  }

  /* ================= 5. герой: параллакс, свечение, подсказка ================= */
  function hero(){
    var h = $('.hero'); if(!h) return;

    var glow = document.createElement('div');
    glow.className = 'mo-glow';
    h.insertBefore(glow, h.firstChild);

    // подсказка «листайте» под кнопками
    var cta = $('.hero-cta', h);
    if(cta && !$('.mo-scroll', h)){
      var hint = document.createElement('div');
      hint.className = 'mo-scroll';
      hint.innerHTML = '<i></i><span>листайте</span>';
      cta.parentNode.insertBefore(hint, cta.nextSibling);
      window.addEventListener('scroll',function(){
        hint.classList.toggle('mo-hide', window.scrollY > 120);
      },{passive:true});
    }

    if(CALM) return;

    // мягкий параллакс изображения героя и текста
    var art = $('.hero-art, .hero-img, .hero-grid > :last-child', h);
    var txt = $('.hero-grid > :first-child', h);
    if(art === txt) art = null;           // в герое одна колонка, двигать нечего
    if(art) art.classList.add('mo-par');
    var ticking = false;
    function upd(){
      var y = window.scrollY;
      if(y < window.innerHeight * 1.2){
        if(art) art.style.transform = 'translate3d(0,' + (y * 0.11).toFixed(1) + 'px,0)';
        if(txt) txt.style.transform = 'translate3d(0,' + (y * 0.045).toFixed(1) + 'px,0)';
        glow.style.transform = 'translate3d(0,' + (y * 0.16).toFixed(1) + 'px,0)';
      }
      ticking = false;
    }
    window.addEventListener('scroll',function(){ if(!ticking){ ticking = true; raf(upd); } },{passive:true});
  }

  /* ================= 6. бегущая строка фактов ================= */
  function ticker(){
    var h = $('.hero'); if(!h || $('.mo-ticker')) return;
    var facts = [
      'производство внутри МКАД','вне зоны КРТ','статус технопарка в процессе',
      '50 000 м² комплекс','потолки до 12 м','5 МВт мощности','кран-балка и рампы',
      '100+ резидентов','6 отраслей','550 машиномест','метро Каспийская 2027','МЦД Котляково 2028',
      'охрана 24/7','отдельные входы и ворота'
    ];
    var row = facts.map(function(f){ return '<span>' + f + '</span>'; }).join('');
    var box = document.createElement('div');
    box.className = 'mo-ticker';
    box.setAttribute('aria-hidden','true');
    box.innerHTML = '<div class="mo-track">' + row + row + '</div>';
    h.parentNode.insertBefore(box, h.nextSibling);
  }

  /* ================= 7. карточки: блик за курсором ================= */
  function cards(){
    var sel = '.why-card, .infra-card, .ind-card, .res-card, .lot, .tr-card, .spec, .card';
    $$(sel).forEach(function(c){ c.classList.add('mo-card'); });
    if(CALM || !window.matchMedia('(hover:hover)').matches) return;
    document.addEventListener('pointermove', function(e){
      var c = e.target && e.target.closest && e.target.closest(sel);
      if(!c) return;
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top)  + 'px');
    }, {passive:true});
  }

  /* ================= 8. кнопки тянутся к курсору ================= */
  function magnets(){
    if(CALM || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    $$('.btn-lg, .btn-p').forEach(function(b){
      b.classList.add('mo-mag');
      b.addEventListener('pointermove', function(e){
        var r = b.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width/2)) / r.width;
        var dy = (e.clientY - (r.top + r.height/2)) / r.height;
        b.style.transform = 'translate3d(' + (dx*7).toFixed(1) + 'px,' + (dy*5).toFixed(1) + 'px,0)';
      });
      b.addEventListener('pointerleave', function(){ b.style.transform = ''; });
    });
  }

  /* ================= 9. номера разделов ================= */
  function stamps(){
    var order = ['about','gallery','transport','specs','infra','industries','residents','catalog','faq'];
    order.forEach(function(id,i){
      var s = document.getElementById(id);
      if(!s || $('.mo-stamp', s)) return;
      var n = document.createElement('div');
      n.className = 'mo-stamp';
      n.setAttribute('aria-hidden','true');
      n.textContent = (i+1 < 10 ? '0' : '') + (i+1);
      s.appendChild(n);
    });
  }

  /* ================= 10. каталог: доснять появление после отрисовки ================= */
  function catalogWatcher(){
    var grid = document.getElementById('catGrid'); if(!grid) return;
    var mo = new MutationObserver(function(){
      $$('.lot', grid).forEach(function(l,i){
        if(l.classList.contains('mo-r')) return;
        l.classList.add('mo-r','mo-card');
        l.style.setProperty('--i', Math.min(i,7));
        var f = $('.lot-img', l); if(f){ f.classList.add('mo-img'); watch(f); }
        watch(l);
      });
    });
    mo.observe(grid, {childList:true});
  }

  /* ================= запуск ================= */
  function boot(){
    document.documentElement.classList.add('js');
    try{ hero();      }catch(e){}
    try{ ticker();    }catch(e){}
    try{ stamps();    }catch(e){}
    try{ reveals();   }catch(e){}
    try{ markNumbers();}catch(e){}
    try{ cards();     }catch(e){}
    try{ magnets();   }catch(e){}
    try{ progress();  }catch(e){}
    try{ header();    }catch(e){}
    try{ catalogWatcher(); }catch(e){}

    // страховка: через 4 секунды ничего не остаётся спрятанным
    setTimeout(function(){
      $$('.mo-r:not(.mo-on), .mo-h:not(.mo-on), .mo-img:not(.mo-on)').forEach(function(el){ el.classList.add('mo-on'); });
      $$('[data-count]').forEach(function(el){
        if(el.textContent.indexOf('0') === 0 || /^\D*0\D*$/.test(el.textContent)) count(el);
      });
    }, 4000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
