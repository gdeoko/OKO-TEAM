/* ЗооОпт v4 — «фильм»: наезд в двери магазина + живые отделы.
   Без WebGL: фото/видео сцены. Видео подхватываются автоматически, если файл есть. */
const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, Lenis = window.Lenis;
gsap.registerPlugin(ScrollTrigger);

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
let whoosh = () => {};

/* ═══════════ ФИЛЬМ: скраб фасад → внутрь ═══════════ */
function initFilm(){
  const facade = document.getElementById('f-facade');
  const interior = document.getElementById('f-interior');
  const flash = document.querySelector('.film-flash');
  const hero = document.querySelector('.film-hero');
  const video = document.getElementById('flyin');

  let useVideo = false, vDur = 0;
  video.addEventListener('loadedmetadata', () => {
    vDur = video.duration || 0;
    if (vDur > 0.5 && !RM) {
      useVideo = true;
      video.style.display = 'block';
      facade.style.display = 'none';
      interior.style.display = 'none';
    }
  });
  video.addEventListener('error', () => { useVideo = false; }, true);
  video.src = 'assets/scene_flyin.mp4'; // нет файла — тихо остаёмся на кен-бёрнсе

  const sm = (a,b,x) => { const t = Math.min(1, Math.max(0, (x-a)/(b-a))); return t*t*(3-2*t); };

  ScrollTrigger.create({
    trigger: '#film', start: 'top top', end: 'bottom bottom', scrub: true,
    onUpdate(s){
      const p = s.progress;
      hero.style.opacity = (1 - sm(0.02, 0.15, p)).toFixed(3);
      hero.style.transform = `translateY(${sm(0.02,0.15,p)*-46}px) scale(${1+sm(0.02,0.3,p)*0.12})`;
      hero.style.pointerEvents = p < 0.06 ? 'auto' : 'none';
      if (useVideo){
        if (video.readyState >= 1) video.currentTime = Math.min(vDur*0.999, p*vDur);
        flash.style.opacity = 0;
        return;
      }
      // кен-бёрнс: наезд в двери
      const z = 1 + sm(0, 0.62, p) * 2.7;
      facade.style.transform = `scale(${z})`;
      facade.style.opacity = (1 - sm(0.52, 0.66, p)).toFixed(3);
      flash.style.opacity = (sm(0.46,0.58,p) * (1-sm(0.6,0.74,p)) * 0.85).toFixed(3);
      interior.style.opacity = sm(0.55, 0.7, p).toFixed(3);
      interior.style.transform = `scale(${1.3 - sm(0.55, 1, p) * 0.28})`;
    }
  });
  ScrollTrigger.create({trigger:'#film',start:'top bottom',end:'bottom top',
    onToggle:s=>document.body.classList.toggle('in-film',s.isActive)});
}

/* ═══════════ СКРАБ: бегущий пёс ═══════════
   Хостинг не отдаёт HTTP Range → seekable пустой → currentTime зажат в 0.
   Лечение: fetch → blob → src. Работает и в Safari. */
const pickSrc = (v) =>
  (v.canPlayType('video/webm; codecs="vp9"') && (v.dataset.webm||'')) || v.dataset.src;

async function blobify(v, url){
  const r = await fetch(url); if(!r.ok) throw new Error(r.status);
  v.src = URL.createObjectURL(await r.blob());
  await new Promise((res, rej) => {
    if (v.readyState >= 1) return res();
    v.addEventListener('loadedmetadata', res, {once:true});
    v.addEventListener('error', rej, {once:true});
  });
}

function initRun(){
  const v = document.getElementById('runvid'); if(!v) return;
  const flat = () => document.getElementById('run').style.height = '100svh';
  if (RM) return flat();
  const url = pickSrc(v);
  [...v.querySelectorAll('source')].forEach(s => s.remove());
  blobify(v, url).then(() => {
    gsap.to(v, {currentTime: Math.max(0, v.duration - 0.05), ease:'none',
      scrollTrigger:{trigger:'#run', start:'top top', end:'bottom bottom', scrub:.5}});
  }).catch(flat);
}

/* ═══════════ ОТДЕЛЫ: параллакс + ленивые видео-сцены ═══════════ */
function initDepts(){
  document.querySelectorAll('.dept').forEach(sec => {
    const bg = sec.querySelector('.dept-bg');
    if (bg && !RM) gsap.fromTo(bg, {yPercent:-7}, {yPercent:7, ease:'none',
      scrollTrigger:{trigger:sec, start:'top bottom', end:'bottom top', scrub:.4}});
    const v = sec.querySelector('.dept-video');
    if (v && !RM){
      let armed = false;
      new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting && !armed){
          armed = true;
          v.loop = true;
          blobify(v, pickSrc(v)).then(() => { v.classList.add('on'); v.play().catch(()=>{}); })
            .catch(() => v.remove());
        } else if (armed && v.src){ e.isIntersecting ? v.play().catch(()=>{}) : v.pause(); }
      }), {threshold:.25}).observe(sec);
    }
    ScrollTrigger.create({trigger:sec, start:'top 55%', once:true, onEnter:()=>whoosh()});
  });
  // страховка: возобновлять лупы, если браузер их притормозил
  setInterval(() => {
    document.querySelectorAll('.dept-video.on').forEach(v => {
      const r = v.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight && v.paused) v.play().catch(()=>{});
    });
  }, 1500);

  const walker = document.querySelector('.dept-walker');
  if (walker && !RM){
    gsap.to(walker, {y:-10, duration:1.6, yoyo:true, repeat:-1, ease:'sine.inOut'});
    gsap.fromTo(walker, {xPercent:6}, {xPercent:-6, ease:'none',
      scrollTrigger:{trigger:'#dept-dogs', start:'top bottom', end:'bottom top', scrub:.5}});
  }
}

/* ═══════════ МАРКЕТ: параллакс фото ═══════════ */
function initShowcase(){
  const bg = document.querySelector('.show-bg'); if(!bg || RM) return;
  gsap.fromTo(bg, {yPercent:-7}, {yPercent:7, ease:'none',
    scrollTrigger:{trigger:'#show', start:'top bottom', end:'bottom top', scrub:.4}});
}

/* ═══════════ ЗВУК ═══════════ */
function initAudio(){
  const btn = document.getElementById('sound'); if(!btn) return;
  let ctx = null, on = false;
  function boot(){
    ctx = new (window.AudioContext||window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 680; lp.connect(master);
    [55,82.4,110,164.8].forEach((fq,i)=>{
      const o = ctx.createOscillator(); o.type = i%2?'sine':'triangle'; o.frequency.value = fq;
      const g = ctx.createGain(); g.gain.value = .12/(i+1); o.connect(g); g.connect(lp); o.start();
      const l = ctx.createOscillator(); l.frequency.value = .05+i*.03;
      const lg = ctx.createGain(); lg.gain.value = .05; l.connect(lg); lg.connect(g.gain); l.start();
    });
    master.gain.linearRampToValueAtTime(.5, ctx.currentTime+1.5);
    const len = ctx.sampleRate*.5, buf = ctx.createBuffer(1,len,ctx.sampleRate), d = buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i] = (Math.random()*2-1)*(1-i/len);
    whoosh = () => { if(!on||RM) return;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=1.1;
      bp.frequency.setValueAtTime(700, ctx.currentTime);
      bp.frequency.exponentialRampToValueAtTime(160, ctx.currentTime+.45);
      const g = ctx.createGain(); g.gain.setValueAtTime(.4, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime+.5);
      src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start();
    };
  }
  btn.addEventListener('click', () => {
    on = !on; btn.classList.toggle('on', on);
    if(on){ if(!ctx) boot(); else ctx.resume(); } else ctx && ctx.suspend();
    btn.querySelector('.slabel').textContent = on ? 'звук вкл' : 'звук выкл';
  });
}

/* ═══════════ КУРСОР / СКРОЛЛ / UI ═══════════ */
function initCursor(){
  if(RM || matchMedia('(hover:none)').matches) return;
  const cur = document.getElementById('cursor');
  const pos = {x:innerWidth/2, y:innerHeight/2}, tgt = {...pos};
  let seen = false;
  addEventListener('pointermove', e => { tgt.x=e.clientX; tgt.y=e.clientY;
    if(!seen){ seen=true; cur.classList.add('on'); } });
  gsap.ticker.add(() => { pos.x+=(tgt.x-pos.x)*.2; pos.y+=(tgt.y-pos.y)*.2;
    cur.style.left=pos.x+'px'; cur.style.top=pos.y+'px'; });
  document.querySelectorAll('[data-cursor],a,button').forEach(el => {
    el.addEventListener('pointerenter', () => cur.classList.add('hot'));
    el.addEventListener('pointerleave', () => cur.classList.remove('hot'));
  });
}

function initScroll(){
  const lenis = new Lenis({lerp:RM?1:.09, wheelMultiplier:1.05});
  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t*1000)); gsap.ticker.lagSmoothing(0);

  document.querySelectorAll('[data-scroll],.nav-links a,.foot-col a[href^="#"],.brand[href^="#"]').forEach(el => {
    const target = el.getAttribute('data-scroll')||el.getAttribute('href');
    if(!target||!target.startsWith('#')||target==='#') return;
    el.addEventListener('click', e => { e.preventDefault();
      const n = document.querySelector(target);
      if(n) lenis.scrollTo(n, {offset:-70, duration:1.4}); });
  });

  const nav = document.getElementById('nav');
  const catsEl = document.getElementById('cats');
  const navCheck = () => nav.classList.toggle('solid', scrollY > catsEl.offsetTop - 90);
  lenis.on('scroll', navCheck); addEventListener('resize', navCheck); navCheck();

  gsap.utils.toArray('.rv').forEach(el => {
    gsap.to(el, {opacity:1, y:0, duration:1, ease:'power3.out',
      scrollTrigger:{trigger:el, start:'top 88%'}});
  });
  gsap.utils.toArray('[data-count]').forEach(el => {
    const end = +el.dataset.count;
    ScrollTrigger.create({trigger:el, start:'top 90%', once:true, onEnter:() => {
      gsap.to({v:0}, {v:end, duration:1.6, ease:'power2.out',
        onUpdate(){ el.textContent = Math.round(this.targets()[0].v); }});
    }});
  });
}

function preloader(){
  const pre = document.getElementById('pre');
  gsap.delayedCall(1.15, () => pre.classList.add('done'));
}

initFilm(); initRun(); initDepts(); initShowcase();
initScroll(); initAudio(); initCursor(); preloader();
