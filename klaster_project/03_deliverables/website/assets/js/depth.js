/* ===== Кластер — depth.js =====
   Слой объёма: инерционная прокрутка, многослойный параллакс, наклон карточек
   к курсору, вытягивание заголовков по буквам, объёмная сцена в герое.
   Работает поверх motion.js, разметку не меняет.

   Зависимости (лежат рядом, самохостинг): gsap, ScrollTrigger, lenis.
   Если библиотека не подгрузилась, слой просто молчит и сайт живёт как был. */
(function(){
  'use strict';

  var CALM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TOUCH = window.matchMedia && window.matchMedia('(hover:none)').matches;
  var WEAK  = (navigator.hardwareConcurrency || 8) <= 4;
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var $  = function(s,r){ return (r||document).querySelector(s); };

  if (CALM) return;

  var gsap = window.gsap;
  var ST   = window.ScrollTrigger;
  if (gsap && ST) gsap.registerPlugin(ST);

  /* ---------- 1. инерционная прокрутка ---------- */
  function smoothScroll(){
    if (!window.Lenis || TOUCH || WEAK) return null;   // на телефоне родная прокрутка честнее
    var lenis = new window.Lenis({
      duration: 1.05,
      easing: function(t){ return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.6,
      autoRaf: false
    });
    if (gsap && ST){
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function(t){ lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    // якоря из меню продолжают работать
    document.addEventListener('click', function(e){
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -86, duration: 1.15 });
    });
    document.documentElement.classList.add('has-lenis');
    return lenis;
  }

  /* ---------- 2. многослойный параллакс ---------- */
  function layers(){
    if (!gsap || !ST) return;

    // крупные врезки: кадр едет медленнее блока, появляется глубина
    $$('.why-shot, .tr-shot, .gal-i.g-w2.g-h2, .infra-shots figure').forEach(function(box){
      var im = $('img', box); if (!im) return;
      gsap.set(im, { scale: 1.16, transformOrigin: '50% 50%' });
      gsap.to(im, {
        yPercent: -9, scale: 1.02, ease: 'none',
        scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      });
    });

    // номера разделов уплывают вбок, подчёркивая глубину сцены
    $$('.mo-stamp').forEach(function(n){
      gsap.to(n, {
        yPercent: 42, xPercent: 6, ease: 'none',
        scrollTrigger: { trigger: n.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    });

    // полоса цифр: каждая колонка входит со своей скоростью
    var stats = $$('.stats .stat');
    if (stats.length){
      gsap.from(stats, {
        yPercent: 38, opacity: 0, duration: .9, stagger: .06, ease: 'power3.out',
        scrollTrigger: { trigger: '.stats', start: 'top 88%' }
      });
    }

    // бегущая строка реагирует на направление прокрутки
    var track = $('.mo-track');
    if (track){
      var last = 0, skew = 0;
      ST.create({
        trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true,
        onUpdate: function(self){
          var v = self.getVelocity();
          skew = Math.max(-14, Math.min(14, v / 240));
          gsap.to(track, { skewX: skew, duration: .35, overwrite: true });
          gsap.to(track, { skewX: 0, duration: .8, delay: .25, overwrite: 'auto' });
          last = v;
        }
      });
    }
  }

  /* ---------- 3. карточки наклоняются к курсору ---------- */
  function tilt(){
    if (TOUCH || WEAK) return;
    var sel = '.why-card, .card, .spec, .res, .lot, .infra-shots figure';
    $$(sel).forEach(function(c){
      c.classList.add('d-tilt');
      var raf = null, rx = 0, ry = 0;
      function apply(){
        c.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        c.style.setProperty('--ry', ry.toFixed(2) + 'deg');
        raf = null;
      }
      c.addEventListener('pointermove', function(e){
        var r = c.getBoundingClientRect();
        ry =  ((e.clientX - (r.left + r.width/2))  / r.width)  * 7;
        rx = -((e.clientY - (r.top  + r.height/2)) / r.height) * 7;
        if (!raf) raf = requestAnimationFrame(apply);
      }, {passive:true});
      c.addEventListener('pointerleave', function(){
        rx = ry = 0;
        c.style.setProperty('--rx','0deg');
        c.style.setProperty('--ry','0deg');
      });
    });
  }

  /* ---------- 4. заголовки собираются по словам ---------- */
  function headings(){
    if (!gsap || !ST) return;
    $$('.hero h1').forEach(function(h){
      if (h.dataset.split) return;
      h.classList.remove('mo-r'); h.classList.add('mo-on'); h.style.removeProperty('--i');
      var words = (h.textContent || '').split(/(\s+)/);
      if (words.length < 2) return;
      h.dataset.split = '1';
      h.innerHTML = words.map(function(w){
        return /^\s+$/.test(w) ? w : '<span class="d-w"><span class="d-wi">' + w + '</span></span>';
      }).join('');
      var inner = $$('.d-wi', h);
      gsap.set(inner, { yPercent: 108, rotate: 2 });
      gsap.to(inner, {
        yPercent: 0, rotate: 0, duration: .95, ease: 'power4.out', stagger: .045,
        scrollTrigger: { trigger: h, start: 'top 90%' }
      });
    });
  }

  /* ---------- 5. объёмная сцена в герое ---------- */
  function heroDepth(){
    var hero = $('.hero'); if (!hero || !gsap) return;
    var media = $('.hero-media', hero);
    var badge = $('.hero-badge', hero);
    var text  = $('.hero-grid > :first-child', hero);
    if (!media) return;

    hero.classList.add('d-hero');

    // карточка кадра слегка поворачивается вслед за курсором
    if (!TOUCH && !WEAK){
      hero.addEventListener('pointermove', function(e){
        var r = hero.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width  - .5;
        var py = (e.clientY - r.top)  / r.height - .5;
        gsap.to(media, { rotateY: px * 7, rotateX: -py * 5, duration: .8, ease: 'power2.out', transformPerspective: 1100 });
        if (badge) gsap.to(badge, { x: px * 22, y: py * 12, duration: .9, ease: 'power2.out' });
        if (text)  gsap.to(text,  { x: px * -9, duration: 1.1, ease: 'power2.out' });
      }, {passive:true});
      hero.addEventListener('pointerleave', function(){
        gsap.to(media, { rotateY: 0, rotateX: 0, duration: 1 });
        if (badge) gsap.to(badge, { x: 0, y: 0, duration: 1 });
        if (text)  gsap.to(text,  { x: 0, duration: 1 });
      });
    }

    // вход страницы: кадр приезжает из глубины
    gsap.from(media, { scale: 1.08, opacity: 0, duration: 1.25, ease: 'power3.out' });
  }

  /* ---------- 6. плитки галереи выходят волной ---------- */
  function gallery(){
    if (!gsap || !ST) return;
    var tiles = $$('.gal-i');
    if (!tiles.length) return;
    tiles.forEach(function(el){ el.classList.remove('mo-r'); el.classList.add('mo-on'); el.style.removeProperty('--i'); });
    gsap.set(tiles, { opacity: 0, y: 44, scale: .965 });
    ST.batch(tiles, {
      start: 'top 92%',
      onEnter: function(batch){
        gsap.to(batch, { opacity: 1, y: 0, scale: 1, duration: .85, ease: 'power3.out', stagger: .07, overwrite: true });
      }
    });
  }

  function boot(){
    try{ smoothScroll(); }catch(e){}
    try{ heroDepth();    }catch(e){}
    try{ headings();     }catch(e){}
    try{ layers();       }catch(e){}
    try{ gallery();      }catch(e){}
    try{ tilt();         }catch(e){}
    if (ST) setTimeout(function(){ ST.refresh(); }, 800);
    // страховка: если что-то не доехало, через четыре секунды показываем как есть
    setTimeout(function(){
      $$('.gal-i, .d-wi, .stats .stat').forEach(function(el){
        var cs = getComputedStyle(el);
        if (parseFloat(cs.opacity) < 0.05){
          el.style.opacity = '1'; el.style.transform = 'none';
        }
      });
    }, 4200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
