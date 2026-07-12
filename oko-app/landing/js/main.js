/* ОКО app landing — reveals, counters, nav, phone parallax */
(function(){
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  const load=document.getElementById('load');
  const hide=()=>load&&load.classList.add('gone');
  addEventListener('load',()=>setTimeout(hide,500)); setTimeout(hide,2600);

  const nav=document.querySelector('.nav'), prog=document.getElementById('prog');
  function onScroll(){
    const max=document.documentElement.scrollHeight-innerHeight;
    if(prog) prog.style.width=(max>0?scrollY/max*100:0)+'%';
    if(nav) nav.classList.toggle('scrolled',scrollY>28);
  }
  addEventListener('scroll',onScroll,{passive:true}); onScroll();

  const io=('IntersectionObserver'in window)?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}}),{threshold:.14,rootMargin:'0px 0px -6% 0px'}):null;
  document.querySelectorAll('.rv').forEach(el=>io?io.observe(el):el.classList.add('in'));

  function count(el){const target=+el.dataset.count,suf=el.dataset.suf||'',dur=1400,t0=performance.now();
    (function s(now){const p=Math.min(1,(now-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=Math.floor(target*e)+suf;p<1?requestAnimationFrame(s):el.textContent=target+suf;})(performance.now());}
  const io2=('IntersectionObserver'in window)?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){count(e.target);io2.unobserve(e.target);}}),{threshold:.5}):null;
  document.querySelectorAll('[data-count]').forEach(el=>io2?io2.observe(el):count(el));

  // hero phone parallax (mouse + gyro), subtle
  if(!reduce){
    const fan=document.getElementById('fan');
    const phones=[...document.querySelectorAll('#fan .phone')];
    const base=phones.map(p=>p.style.transform||getComputedStyle(p).transform);
    let mx=0,my=0,cx=0,cy=0;
    addEventListener('pointermove',e=>{ if(matchMedia('(hover:hover)').matches){ mx=(e.clientX/innerWidth-.5); my=(e.clientY/innerHeight-.5);} },{passive:true});
    addEventListener('deviceorientation',e=>{ if(e.gamma!=null){ mx=Math.max(-.5,Math.min(.5,e.gamma/40)); my=Math.max(-.5,Math.min(.5,(e.beta-45)/40)); } },{passive:true});
    (function loop(){ cx+=(mx-cx)*.06; cy+=(my-cy)*.06;
      phones.forEach(p=>{ const d=+p.dataset.depth||14;
        const rx=(-cy*d*0.5).toFixed(2), ry=(cx*d*0.5).toFixed(2), tx=(cx*d).toFixed(1), ty=(cy*d*0.5).toFixed(1);
        p.style.transform=`${p.classList.contains('ph-l')?'translateX(calc(-50% - clamp(150px,17vw,240px))) rotate(-9deg)':p.classList.contains('ph-r')?'translateX(calc(-50% + clamp(150px,17vw,240px))) rotate(9deg)':''} translate3d(${tx}px,${ty}px,0) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
      requestAnimationFrame(loop);
    })();
  }
})();
