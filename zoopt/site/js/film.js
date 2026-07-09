/* ЗооОпт — кино-движок (каркас): полёт по 8 сценам (ken-burns/crossfade — плейсхолдер
   под видео-скраб), разлёт пачки, каталог, опт, звук, курсор. Всё на GSAP+Lenis. */
const gsap=window.gsap, ScrollTrigger=window.ScrollTrigger, Lenis=window.Lenis;
gsap.registerPlugin(ScrollTrigger);
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
let whoosh=()=>{};

/* ═══ ФИЛЬМ: машина сцен ═══ */
function initFilm(){
  const scenes=[...document.querySelectorAll('.scene')];
  const caps=[...document.querySelectorAll('.cap')];
  const flash=document.querySelector('.flash');
  const N=scenes.length;                 // 8
  const bgs=scenes.map(s=>s.querySelector('.bg'));
  const hudCh=document.getElementById('hud-ch'),hudBar=document.getElementById('hud-bar'),hudPct=document.getElementById('hud-pct');
  const NAMES=['зооопт · главная','вход','каталог','собакам','кошкам','аквариум','опт','бренды'];
  const railNodes=[...document.querySelectorAll('#rail .node')];
  const scrollInd=document.querySelector('.scroll-ind');
  let last=0;

  function render(p){
    const f=p*(N-1);                     // позиция в «сценах» 0..N-1
    const cur=Math.min(N-1,Math.floor(f));
    const frac=f-cur;                    // 0..1 внутри перехода cur→cur+1
    scenes.forEach((s,i)=>{
      let op=0, z=1;
      if(i===cur){ op=1-smooth(.78,1,frac); z=1+ .16*frac + .08; }
      else if(i===cur+1){ op=smooth(0,.5,frac); z=1.16 - .08*frac; }
      s.style.opacity=op.toFixed(3);
      bgs[i].style.transform=`scale(${z.toFixed(3)})`;
    });
    // подписи: активна та, что ближе к целому
    const active=Math.round(f);
    caps.forEach((c,i)=>{
      const d=Math.abs(f-i);
      const al=1-smooth(.12,.42,d);
      c.style.opacity=al.toFixed(3);
      c.style.transform=`translateY(${(1-al)*30}px)`;
      c.style.pointerEvents=al>.6?'auto':'none';
    });
    if(scrollInd) scrollInd.style.opacity=(1-smooth(.02,.12,p)).toFixed(3);
    // вспышка на входе в двери (сцена 0→1)
    if(flash) flash.style.opacity=(smooth(.06,.12,p)*(1-smooth(.12,.2,p))*.8).toFixed(3);
    // hud + rail
    hudBar.style.width=(p*100).toFixed(1)+'%'; hudPct.textContent=Math.round(p*100)+'%';
    hudCh.textContent=NAMES[Math.min(N-1,active)];
    const railMap=[0,3,4,5,6];
    railNodes.forEach((n,k)=>n.classList.toggle('on',active===railMap[k]));
    if(active!==last){last=active; whoosh();}
  }
  ScrollTrigger.create({trigger:'#film',start:'top top',end:'bottom bottom',scrub:.4,
    onUpdate:s=>render(s.progress)});
  ScrollTrigger.create({trigger:'#film',start:'top bottom',end:'bottom top',
    onToggle:s=>document.body.classList.toggle('in-film',s.isActive)});
  render(0);

  // рейл-клик = перелёт
  const filmEl=document.getElementById('film');
  railNodes.forEach(n=>n.addEventListener('click',()=>{
    const t=+n.dataset.t, y=filmEl.offsetTop+t*(filmEl.offsetHeight-innerHeight);
    window.__lenis?window.__lenis.scrollTo(y,{duration:1.4}):scrollTo(0,y);
  }));
}

/* ═══ РАЗЛЁТ: пачка → корм → миска ═══ */
function initExplode(){
  const pack=document.querySelector('.ex-pack'), kib=document.querySelector('.ex-kibble'), bowl=document.querySelector('.ex-bowl');
  const title=document.getElementById('ex-title'), body=document.getElementById('ex-body');
  if(!pack) return;
  let phase=-1;
  ScrollTrigger.create({trigger:'#explode',start:'top top',end:'bottom bottom',scrub:.5,
    onUpdate:s=>{
      const p=s.progress;
      // 0-.4 пачка растёт и «раскрывается» → 0.35-.7 корм разлетается → .65-1 собирается в миску
      pack.style.opacity=(1-smooth(.32,.5,p)).toFixed(3);
      pack.style.transform=`scale(${(1+smooth(0,.5,p)*.5)}) rotate(${smooth(.3,.5,p)*-6}deg)`;
      kib.style.opacity=(smooth(.3,.45,p)*(1-smooth(.62,.8,p))).toFixed(3);
      kib.style.transform=`scale(${(.7+smooth(.3,.8,p)*.9)})`;
      bowl.style.opacity=smooth(.66,.82,p).toFixed(3);
      bowl.style.transform=`scale(${(.85+smooth(.66,1,p)*.2)})`;
      const ph=p<.4?0:p<.72?1:2;
      if(ph!==phase){phase=ph;
        if(ph===0){title.textContent='Настоящее мясо и витамины';body.textContent='Внутри — качество: мясо, злаки, витамины. Листайте — пачка раскрывается.';}
        if(ph===1){title.textContent='Корм высыпается';body.textContent='Гранулы, мясо и добавки — всё, что нужно вашему питомцу.';}
        if(ph===2){title.textContent='Готово к кормлению';body.textContent='Полная миска пользы. И так — каждый день, по складским ценам.';}
      }
    }});
}

/* ═══ звук ═══ */
function initAudio(){
  const btn=document.getElementById('sound'); if(!btn) return;
  let ctx=null,on=false;
  function boot(){
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    const master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=680;lp.connect(master);
    [55,82.4,110,164.8].forEach((fq,i)=>{const o=ctx.createOscillator();o.type=i%2?'sine':'triangle';o.frequency.value=fq;
      const g=ctx.createGain();g.gain.value=.12/(i+1);o.connect(g);g.connect(lp);o.start();
      const l=ctx.createOscillator();l.frequency.value=.05+i*.03;const lg=ctx.createGain();lg.gain.value=.05;l.connect(lg);lg.connect(g.gain);l.start();});
    master.gain.linearRampToValueAtTime(.5,ctx.currentTime+1.5);
    const len=ctx.sampleRate*.5,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);
    whoosh=()=>{if(!on||RM)return;const src=ctx.createBufferSource();src.buffer=buf;
      const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.1;
      bp.frequency.setValueAtTime(700,ctx.currentTime);bp.frequency.exponentialRampToValueAtTime(160,ctx.currentTime+.45);
      const g=ctx.createGain();g.gain.setValueAtTime(.4,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.5);
      src.connect(bp);bp.connect(g);g.connect(ctx.destination);src.start();};
  }
  btn.addEventListener('click',()=>{on=!on;btn.classList.toggle('on',on);
    if(on){if(!ctx)boot();else ctx.resume();}else ctx&&ctx.suspend();
    btn.querySelector('.slabel').textContent=on?'звук вкл':'звук выкл';});
}

/* ═══ курсор ═══ */
function initCursor(){
  if(RM||matchMedia('(hover:none)').matches)return;
  const cur=document.getElementById('cursor');const pos={x:innerWidth/2,y:innerHeight/2},tgt={...pos};let seen=false;
  addEventListener('pointermove',e=>{tgt.x=e.clientX;tgt.y=e.clientY;if(!seen){seen=true;cur.classList.add('on');}});
  gsap.ticker.add(()=>{pos.x+=(tgt.x-pos.x)*.2;pos.y+=(tgt.y-pos.y)*.2;cur.style.left=pos.x+'px';cur.style.top=pos.y+'px';});
  document.querySelectorAll('[data-cursor],a,button').forEach(el=>{el.addEventListener('pointerenter',()=>cur.classList.add('hot'));el.addEventListener('pointerleave',()=>cur.classList.remove('hot'));});
}

/* ═══ скролл / UI ═══ */
function initScroll(){
  const lenis=new Lenis({lerp:RM?1:.09,wheelMultiplier:1.05});window.__lenis=lenis;
  lenis.on('scroll',ScrollTrigger.update);gsap.ticker.add(t=>lenis.raf(t*1000));gsap.ticker.lagSmoothing(0);
  document.querySelectorAll('[data-scroll],.nav-links a[href^="#"],.foot-col a[href^="#"],.brand[href^="#"]').forEach(el=>{
    const target=el.getAttribute('data-scroll')||el.getAttribute('href');
    if(!target||!target.startsWith('#')||target==='#')return;
    el.addEventListener('click',e=>{e.preventDefault();const n=document.querySelector(target);if(n)lenis.scrollTo(n,{offset:-70,duration:1.4});});});
  const nav=document.getElementById('nav'),catsEl=document.getElementById('cats');
  const navCheck=()=>nav.classList.toggle('solid',scrollY>catsEl.offsetTop-90);
  lenis.on('scroll',navCheck);addEventListener('resize',navCheck);navCheck();
  gsap.utils.toArray('.rv').forEach(el=>gsap.to(el,{opacity:1,y:0,duration:1,ease:'power3.out',scrollTrigger:{trigger:el,start:'top 88%'}}));
  gsap.utils.toArray('[data-count]').forEach(el=>{const end=+el.dataset.count;
    ScrollTrigger.create({trigger:el,start:'top 90%',once:true,onEnter:()=>gsap.to({v:0},{v:end,duration:1.6,ease:'power2.out',onUpdate(){el.textContent=Math.round(this.targets()[0].v);}})});});
}
function preloader(){gsap.delayedCall(1.1,()=>document.getElementById('pre').classList.add('done'));}

initFilm(); initExplode(); initScroll(); initAudio(); initCursor(); preloader();
