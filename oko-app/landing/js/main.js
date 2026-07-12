/* ОКО landing — smooth scroll, reveals, autoplay video */
(function(){
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const isTouch = matchMedia('(hover:none)').matches || 'ontouchstart' in window;

  // loader
  const load=document.getElementById('load');
  const hide=()=>load&&load.classList.add('gone');
  window.addEventListener('load',()=>setTimeout(hide,500));
  setTimeout(hide,2600);

  if(window.gsap&&window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);

    // Lenis smooth scroll on desktop only (native scroll on touch feels better)
    if(!reduce && !isTouch && window.Lenis){
      const lenis=new Lenis({lerp:0.09,wheelMultiplier:1,smoothWheel:true});
      lenis.on('scroll',ScrollTrigger.update);
      gsap.ticker.add(t=>lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);
    }

    // progress
    const prog=document.getElementById('prog');
    ScrollTrigger.create({start:0,end:'max',onUpdate:s=>{prog.style.width=(s.progress*100)+'%';}});

    // nav bg
    const nav=document.querySelector('.nav');
    ScrollTrigger.create({start:'top -30',end:'max',
      onUpdate:s=>nav&&nav.classList.toggle('scrolled',s.scroll()>30),
      onLeaveBack:()=>nav&&nav.classList.remove('scrolled')});

    // reveals
    document.querySelectorAll('.rv').forEach(el=>{
      ScrollTrigger.create({trigger:el,start:'top 88%',once:true,onEnter:()=>el.classList.add('in')});
    });

    // counters
    function count(el){
      const target=+el.dataset.count, suf=el.dataset.suf||'', dur=1400, t0=performance.now();
      (function step(now){const p=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-p,3);
        el.textContent=Math.floor(target*e)+suf; if(p<1)requestAnimationFrame(step); else el.textContent=target+suf;})(t0);
    }
    document.querySelectorAll('[data-count]').forEach(el=>{
      ScrollTrigger.create({trigger:el,start:'top 90%',once:true,onEnter:()=>count(el)});
    });
  } else {
    document.querySelectorAll('.rv').forEach(el=>el.classList.add('in'));
  }

  // ---- guarantee background videos actually play (mobile-safe) ----
  const vids=[...document.querySelectorAll('.bgvid')];
  function kick(){ vids.forEach(v=>{ v.muted=true; const pr=v.play&&v.play(); if(pr&&pr.catch)pr.catch(()=>{}); }); }
  kick();
  window.addEventListener('load',kick);
  // some mobile browsers only allow play after first interaction
  ['touchstart','click','scroll'].forEach(ev=>window.addEventListener(ev,kick,{once:true,passive:true}));
  // pause offscreen videos to save battery, resume when visible
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{
      const v=e.target; if(e.isIntersecting){const p=v.play&&v.play();if(p&&p.catch)p.catch(()=>{});}else{v.pause&&v.pause();}
    }),{threshold:.05});
    vids.forEach(v=>io.observe(v));
  }
})();
