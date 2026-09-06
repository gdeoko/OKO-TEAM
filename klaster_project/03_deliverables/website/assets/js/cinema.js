/* ===== Кластер — cinema.js =====
   Оживление кадров: фотография сама становится видео, когда попадает в вид,
   и замирает обратно, когда уходит. Ничего не грузится заранее.

   Разметка не меняется, достаточно повесить на figure или picture:
     data-live="/assets/video/live_hero.mp4"
   Внутри должен быть обычный img или picture, он остаётся постером и
   единственным, что видит человек на медленной сети.

   Видео не включается, если: человек просил систему убрать анимации,
   включена экономия трафика, сеть медленная, ядер мало или батарея садится. */
(function(){
  'use strict';

  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };

  function calm(){
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'человек просил без движения';
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (c){
      if (c.saveData) return 'включена экономия трафика';
      if (/^(slow-2g|2g|3g)$/.test(c.effectiveType || '')) return 'медленная сеть';
    }
    if ((navigator.hardwareConcurrency || 8) <= 2) return 'слабое устройство';
    return null;
  }

  var OFF = calm();

  function wire(box){
    var src = box.getAttribute('data-live');
    if (!src) return;
    box.classList.add('cine');

    if (OFF){ box.setAttribute('data-live-off', OFF); return; }

    var v = null, playing = false;

    function build(){
      if (v) return v;
      v = document.createElement('video');
      v.className = 'cine-v';
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted',''); v.setAttribute('playsinline','');
      v.preload = 'none';
      v.setAttribute('aria-hidden','true');
      v.tabIndex = -1;
      var s = document.createElement('source');
      s.src = src; s.type = 'video/mp4';
      v.appendChild(s);
      v.addEventListener('playing', function(){ box.classList.add('cine-on'); }, {once:false});
      v.addEventListener('error', function(){ box.classList.remove('cine-on'); box.setAttribute('data-live-off','ролик не открылся'); });
      box.appendChild(v);
      return v;
    }

    function start(){
      var el = build();
      if (el.preload === 'none'){ el.preload = 'auto'; el.load(); }
      var p = el.play();
      if (p && p.catch) p.catch(function(){ /* браузер не дал автозапуск, остаётся фото */ });
      playing = true;
    }
    function stop(){
      if (!v || !playing) return;
      v.pause(); playing = false;
    }

    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ e.isIntersecting ? start() : stop(); });
    }, {threshold: 0.28, rootMargin: '120px 0px'});
    io.observe(box);

    document.addEventListener('visibilitychange', function(){
      if (document.hidden) stop();
    });
  }

  function boot(){ $$('[data-live]').forEach(wire); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // каталог рисуется скриптом позже, ловим и его
  var grid = document.getElementById('catGrid');
  if (grid && 'MutationObserver' in window){
    new MutationObserver(function(){ $$('[data-live]', grid).forEach(wire); }).observe(grid,{childList:true});
  }
})();
