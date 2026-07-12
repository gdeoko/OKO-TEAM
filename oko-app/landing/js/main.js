/* ОКО landing — scroll orchestration */
(function(){
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

  // ---- loader ----
  const load=document.getElementById('load'), lbar=document.getElementById('loadbar');
  let lp=0; const li=setInterval(()=>{ lp=Math.min(100,lp+Math.random()*24); lbar.style.width=lp+'%';
    if(lp>=100){ clearInterval(li); setTimeout(()=>load.classList.add('gone'),300);} },140);
  window.addEventListener('load',()=>{ lp=100; lbar.style.width='100%'; setTimeout(()=>load.classList.add('gone'),400); });

  gsap.registerPlugin(ScrollTrigger);

  // ---- Lenis smooth scroll ----
  let lenis=null;
  if(!reduce && window.Lenis){
    lenis=new Lenis({ lerp:0.09, wheelMultiplier:1, smoothWheel:true });
    lenis.on('scroll',ScrollTrigger.update);
    gsap.ticker.add(t=>lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);
  }

  // ---- progress bar + nav bg ----
  const prog=document.getElementById('prog');
  const nav=document.querySelector('.nav');
  ScrollTrigger.create({ start:0, end:'max', onUpdate:s=>{ prog.style.width=(s.progress*100)+'%'; } });
  ScrollTrigger.create({ start:'top -40', end:'max', onUpdate:s=>{ nav&&nav.classList.toggle('scrolled', s.scroll()>40); },
    onLeaveBack:()=>nav&&nav.classList.remove('scrolled') });

  // ---- custom cursor ----
  const cur=document.getElementById('cur'), curr=document.getElementById('curr');
  if(cur && matchMedia('(hover:hover)').matches){
    let cx=0,cy=0,rx=0,ry=0;
    window.addEventListener('pointermove',e=>{ cx=e.clientX;cy=e.clientY; cur.style.left=cx+'px';cur.style.top=cy+'px'; });
    (function loop(){ rx+=(cx-rx)*0.18; ry+=(cy-ry)*0.18; curr.style.left=rx+'px'; curr.style.top=ry+'px'; requestAnimationFrame(loop); })();
    document.querySelectorAll('a,.card,.btn,.stat').forEach(el=>{
      el.addEventListener('pointerenter',()=>{ curr.style.width='54px';curr.style.height='54px';curr.style.borderColor='#9AFF00'; });
      el.addEventListener('pointerleave',()=>{ curr.style.width='34px';curr.style.height='34px';curr.style.borderColor='rgba(154,255,0,.5)'; });
    });
  }

  // ---- HERO: dive into pupil ----
  ScrollTrigger.create({
    trigger:'#hero', start:'top top', end:'bottom top', scrub:true,
    onUpdate:s=>{ if(window.OKOeye) window.OKOeye.zoom=s.progress; }
  });

  // ---- MANIFEST: reveal lines word-by-word on scroll ----
  const lines=[...document.querySelectorAll('[data-mani]')];
  gsap.to({}, {}); // ensure gsap ready
  ScrollTrigger.create({
    trigger:'#manifest', start:'top top', end:'bottom bottom', scrub:true,
    onUpdate:s=>{
      const p=s.progress*lines.length;
      lines.forEach((l,i)=>{
        const local=Math.max(0,Math.min(1, p-i));
        l.style.color = local>0.5 ? '#fff' : 'rgba(255,255,255,.16)';
        const gs=l.querySelectorAll('.g'); gs.forEach(g=>g.style.color = local>0.5 ? '#9AFF00':'rgba(154,255,0,.25)');
      });
    }
  });

  // ---- reveals ----
  document.querySelectorAll('.reveal').forEach((el,i)=>{
    ScrollTrigger.create({ trigger:el, start:'top 86%', once:true,
      onEnter:()=>{ el.style.transitionDelay=(i%3*0.06)+'s'; el.classList.add('in'); } });
  });

  // ---- counters ----
  function animCount(el){
    const target=+el.dataset.count, pre=el.dataset.pre||'', suf=el.dataset.suf||'';
    const dur=1500, t0=performance.now();
    function step(now){ const p=Math.min(1,(now-t0)/dur); const e=1-Math.pow(1-p,3);
      let v=Math.floor(target*e);
      let disp = v>=1000 ? Math.floor(v/1000) : v;
      el.textContent=pre+disp+suf; if(p<1) requestAnimationFrame(step);
      else { let f=target>=1000?Math.floor(target/1000):target; el.textContent=pre+f+suf; } }
    requestAnimationFrame(step);
  }
  document.querySelectorAll('[data-count]').forEach(el=>{
    ScrollTrigger.create({ trigger:el, start:'top 88%', once:true, onEnter:()=>animCount(el) });
  });

  // ---- CINEMATIC scrub ----
  const vid=document.getElementById('cine-vid');
  const steps=[...document.querySelectorAll('.cine-step')];
  let vidReady=false, vidDur=0;
  if(vid){
    vid.addEventListener('loadedmetadata',()=>{ vidReady=true; vidDur=vid.duration||1; });
    vid.addEventListener('error',()=>{ vidReady=false; });
    // sources are declared in HTML (<source> mp4 + webm); just kick loading
    vid.load();
  }
  ScrollTrigger.create({
    trigger:'#cine', start:'top top', end:'bottom bottom', scrub:0.5,
    onUpdate:s=>{
      const p=s.progress;
      if(vidReady && vid){ try{ vid.currentTime=Math.min(vidDur-0.05, p*vidDur); }catch(e){} }
      const idx=Math.min(steps.length-1, Math.floor(p*steps.length));
      steps.forEach((st,i)=>st.classList.toggle('on', i===idx));
    }
  });

  ScrollTrigger.refresh();
})();
