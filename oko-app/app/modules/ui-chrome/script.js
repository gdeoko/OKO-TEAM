/* ============================================================
   UI-CHROME · script.js — премиум-моушен хаба (перф-безопасно)
   1) Параллакс-слои хиро (глаз + текст) по указателю — только transform,
      rAF-троттлинг, отключён при prefers-reduced-motion и во время скролла.
   2) IntersectionObserver: хиро ушёл из вьюпорта → .uic-hero-off (CSS
      замораживает @keyframes хиро) — ноль работы вне экрана.
   Префикс uic*, self-init, всё в try/catch: одна ошибка не должна ронять ядро.
   ============================================================ */
(function uicHubMotion(){
  'use strict';
  try{
    var reduce = false;
    try{ reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches; }catch(e){}

    function uicInit(){
      var hero = document.getElementById('maHero');
      if(!hero) return;

      /* ---- IntersectionObserver: пауза анимаций хиро вне вьюпорта ---- */
      try{
        if('IntersectionObserver' in window){
          var io = new IntersectionObserver(function(entries){
            for(var i=0;i<entries.length;i++){
              var vis = entries[i].isIntersecting && entries[i].intersectionRatio > 0.02;
              hero.classList.toggle('uic-hero-off', !vis);
            }
          }, {threshold:[0,0.03]});
          io.observe(hero);
        }
      }catch(e){}

      /* ---- Параллакс по указателю (пропускаем при reduced-motion) ---- */
      if(reduce) return;

      var logo = hero.querySelector('.ma-hero-logo');
      var txt  = hero.querySelector('.ma-hero-txt');
      if(!logo && !txt) return;

      var tx = 0, ty = 0, raf = 0;
      function uicApply(){
        raf = 0;
        // не двигаем во время активного скролла (перф-слой wow-motion/tg-webapp)
        if(document.documentElement.classList.contains('oko-scrolling')) return;
        // глаз и текст смещаются в противоположные стороны — ощущение глубины
        hero.style.setProperty('--uic-lx', (tx * 9).toFixed(2) + 'px');
        hero.style.setProperty('--uic-ly', (ty * 7).toFixed(2) + 'px');
        hero.style.setProperty('--uic-tx', (tx * -4).toFixed(2) + 'px');
        hero.style.setProperty('--uic-ty', (ty * -3).toFixed(2) + 'px');
      }
      function uicMove(ev){
        try{
          var r = hero.getBoundingClientRect();
          if(!r.width || !r.height) return;
          var px = (ev.clientX - r.left) / r.width;   // 0..1
          var py = (ev.clientY - r.top) / r.height;   // 0..1
          tx = Math.max(-1, Math.min(1, (px - 0.5) * 2));
          ty = Math.max(-1, Math.min(1, (py - 0.5) * 2));
          if(!raf) raf = requestAnimationFrame(uicApply);
        }catch(e){}
      }
      function uicReset(){
        tx = 0; ty = 0;
        try{
          hero.style.setProperty('--uic-lx','0px'); hero.style.setProperty('--uic-ly','0px');
          hero.style.setProperty('--uic-tx','0px'); hero.style.setProperty('--uic-ty','0px');
        }catch(e){}
      }
      hero.addEventListener('pointermove', uicMove, {passive:true});
      hero.addEventListener('pointerleave', uicReset, {passive:true});
      hero.addEventListener('pointercancel', uicReset, {passive:true});
    }

    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', uicInit, {once:true});
    } else {
      uicInit();
    }
  }catch(e){ /* тихо: перф-моушен не критичен */ }
})();
