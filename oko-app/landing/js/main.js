/* ОКО landing — reveals, counters, nav (native scroll; 3D scene reads scroll itself) */
(function(){
  const load=document.getElementById('load');
  const hide=()=>load&&load.classList.add('gone');
  window.addEventListener('load',()=>setTimeout(hide,600));
  setTimeout(hide,3000);

  const nav=document.querySelector('.nav');
  const prog=document.getElementById('prog');
  function onScroll(){
    const max=document.documentElement.scrollHeight-innerHeight;
    const p=max>0?scrollY/max:0;
    if(prog) prog.style.width=(p*100)+'%';
    if(nav) nav.classList.toggle('scrolled', scrollY>30);
  }
  addEventListener('scroll',onScroll,{passive:true}); onScroll();

  // reveals
  const rvs=[...document.querySelectorAll('.rv')];
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){e.target.classList.add('in'); io.unobserve(e.target);} }),{threshold:.15,rootMargin:'0px 0px -8% 0px'});
    rvs.forEach(el=>io.observe(el));
  } else rvs.forEach(el=>el.classList.add('in'));

  // counters
  function count(el){
    const target=+el.dataset.count, suf=el.dataset.suf||'', dur=1400, t0=performance.now();
    (function step(now){const p=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-p,3);
      el.textContent=Math.floor(target*e)+suf; if(p<1)requestAnimationFrame(step); else el.textContent=target+suf;})(performance.now());
  }
  const cs=[...document.querySelectorAll('[data-count]')];
  if('IntersectionObserver' in window){
    const io2=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){count(e.target); io2.unobserve(e.target);} }),{threshold:.5});
    cs.forEach(el=>io2.observe(el));
  } else cs.forEach(count);
})();
